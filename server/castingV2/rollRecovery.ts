import { and, eq, inArray } from "drizzle-orm";

import { castingCandidates, castingRolls, creditTransactions } from "../../drizzle/schema";
import { getDb } from "../db/connection";
import { recordRefund, refundReferenceFor } from "../casting/atomicCredits";
import { operationChargeReference } from "../casting/operationContract";
import {
  finalizeClaimedGenerationOperationFailure,
  finalizeGenerationOperationFailure,
  finalizeGenerationOperationSuccess,
} from "../db/generationOperations";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/rollRecovery");

/**
 * Bespoke recovery adjudicator for `castingV2.roll` (plan §E, §F, §H.6).
 *
 * Follows the `recoverEvidencePackageSyncOperation` precedent: the sweep finds
 * an operation whose lease expired mid-flight and asks this to decide what
 * actually happened, using the candidate rows as durable truth rather than
 * anything the crashed process believed.
 *
 * TWO LAWS SHAPE EVERYTHING HERE.
 *
 * 1. Recovery adjudicates and refunds; it never re-drives provider work. A
 *    candidate that did not land does not get regenerated — it gets refunded.
 *    Regenerating would spend money nobody asked for, on a request whose owner
 *    has long since closed the tab.
 *
 * 2. Landed is durable truth. `imageKey` is written to our own storage before
 *    a candidate becomes `ready`, so a `ready` row means the user has the
 *    image and keeps it. Anything else owes them their credits back.
 *
 * WHY THE PROVIDER QUERY EXISTS AT ALL. §H.6 says ambiguous dispatched
 * outcomes are verified against the provider "where queryable". Verified
 * 2026-07-31 on fal: a request stays queryable after completion even under
 * `sync_mode`, so the branch is real rather than dead code. But it does not
 * change the user's outcome — we have no image to give them either way, so the
 * refund happens regardless. What it changes is our accounting honesty: it
 * distinguishes "the provider never did the work" from "the provider did the
 * work and we lost it", and only the second means we ate the COGS. That
 * distinction is recorded, not billed.
 */

export type RollRecoveryOutcome =
  | { type: "durable_success"; ready: number; chargedCredits: number }
  | { type: "partial"; ready: number; refunded: number; chargedCredits: number; refundedCredits: number }
  | { type: "paid_failure"; refunded: number; chargedCredits: number; refundedCredits: number }
  /** Terminal, and the user was never charged — so nothing is owed back. */
  | { type: "free_failure"; reason: string }
  | { type: "recovery_required"; reason: string; chargedCredits: number; refundedCredits: number };

/** The operation as the sweep hands it over. */
export type RecoverableRollOperation = {
  id: string;
  userId: number;
  status: "claimed" | "running";
  chargedCredits: number;
  refundedCredits: number;
};

type CandidateRow = typeof castingCandidates.$inferSelect;

/** A candidate has landed when its bytes are in OUR storage, not a provider's. */
function hasLanded(candidate: CandidateRow): boolean {
  return candidate.status === "ready" && Boolean(candidate.imageKey);
}

/**
 * The per-candidate refund reference.
 *
 * Derived through the shared helper from a deterministic per-slice charge key,
 * never assembled by string concatenation at two call sites — writer and
 * recovery must produce byte-identical references or the ledger's uniqueness
 * cannot make retries idempotent. Mirrors `mintPackage`'s `:slot:<angle>`
 * shape.
 */
export function candidateChargeReference(operationId: string, candidatePublicId: string): string {
  return `${operationChargeReference(operationId)}:candidate:${candidatePublicId}`;
}

export function candidateRefundReference(operationId: string, candidatePublicId: string): string {
  return refundReferenceFor(candidateChargeReference(operationId, candidatePublicId));
}

/**
 * What the ledger says about this operation's charge — the only authority on
 * whether money actually moved.
 *
 * The roll's own rows cannot answer this. The pinned sequence commits rows
 * BEFORE the deduct (claim → locked transaction → rows → running → pinned
 * deduct → dispatch), so a roll row exists in a window where nothing has been
 * charged. Refunding on the strength of the rows alone would mint credits out
 * of a crash. `generation_operations.chargedCredits` is no help either — it is
 * written at finalize, and a stale operation by definition never got there.
 */
type ChargeTruth =
  | { kind: "charged"; credits: number }
  | { kind: "not_charged" }
  | { kind: "ambiguous"; reason: string };

async function readChargeTruth(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  operation: { id: string; userId: number },
): Promise<ChargeTruth> {
  const reference = operationChargeReference(operation.id);
  const rows = await db
    .select()
    .from(creditTransactions)
    .where(and(
      eq(creditTransactions.userId, operation.userId),
      eq(creditTransactions.referenceId, reference),
    ));
  if (rows.length === 0) return { kind: "not_charged" };
  if (rows.length > 1) return { kind: "ambiguous", reason: "duplicate charge rows for one operation" };
  const [charge] = rows;
  if (charge.type !== "generation" || charge.amount >= 0) {
    return { kind: "ambiguous", reason: "charge reference holds a non-charge ledger row" };
  }
  return { kind: "charged", credits: Math.abs(charge.amount) };
}

/** Fails every unfinished candidate without paying anything back. */
async function failUnpaidCandidates(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  operation: { userId: number },
  candidates: readonly CandidateRow[],
): Promise<void> {
  for (const candidate of candidates) {
    await db
      .update(castingCandidates)
      .set({ status: "failed", failureClass: "unpaid" })
      .where(and(
        eq(castingCandidates.id, candidate.id),
        eq(castingCandidates.userId, operation.userId),
        inArray(castingCandidates.status, ["queued", "dispatched"]),
      ));
  }
}

/**
 * Asks the provider what became of a dispatched request.
 *
 * Injected rather than imported so recovery can be tested without a network,
 * and so the sweep never accidentally reaches for a provider that is down.
 */
export type ProviderProbe = (input: {
  provider: string | null;
  providerRef: string | null;
}) => Promise<"delivered" | "not_delivered" | "unknown">;

export type RollRecoveryDependencies = {
  probe?: ProviderProbe;
  finalizeSuccess?: typeof finalizeGenerationOperationSuccess;
  finalizeFailure?: typeof finalizeGenerationOperationFailure;
  finalizeClaimedFailure?: typeof finalizeClaimedGenerationOperationFailure;
};

/**
 * Adjudicate, then seal the receipt.
 *
 * The two halves are separate on purpose. Adjudication decides what happened
 * and moves the money; sealing writes the terminal receipt that stops the
 * sweep re-examining this operation forever. Keeping the seal in one place —
 * rather than at each of the adjudicator's exits — is what makes "every
 * terminal decision ends the operation" structural instead of remembered.
 */
export async function recoverCastingV2RollOperation(
  operation: RecoverableRollOperation,
  options: RollRecoveryDependencies = {},
): Promise<RollRecoveryOutcome> {
  const outcome = await adjudicateRollOperation(operation, options);
  return sealRollReceipt(operation, outcome, options);
}

async function sealRollReceipt(
  operation: RecoverableRollOperation,
  outcome: RollRecoveryOutcome,
  options: RollRecoveryDependencies,
): Promise<RollRecoveryOutcome> {
  // The sweep writes its own recovery_required receipt for this case, and a
  // second writer would race it.
  if (outcome.type === "recovery_required") return outcome;

  const finalizeSuccess = options.finalizeSuccess ?? finalizeGenerationOperationSuccess;
  const finalizeFailure = options.finalizeFailure ?? finalizeGenerationOperationFailure;
  const finalizeClaimedFailure =
    options.finalizeClaimedFailure ?? finalizeClaimedGenerationOperationFailure;

  try {
    if (outcome.type === "durable_success" || outcome.type === "partial") {
      await finalizeSuccess({
        userId: operation.userId,
        operationId: operation.id,
        // Deliberately spare. The receipt is a money-and-status record; the
        // sheet itself is read from the roll projection, which is the only
        // surface that knows what a candidate may show (§J).
        result: {
          ready: outcome.ready,
          refunded: outcome.type === "partial" ? outcome.refunded : 0,
        },
        chargedCredits: outcome.chargedCredits,
        refundedCredits: outcome.type === "partial" ? outcome.refundedCredits : 0,
        terminalStatus: outcome.type === "partial" ? "partial" : "succeeded",
      });
      return outcome;
    }

    if (outcome.type === "paid_failure") {
      await finalizeFailure({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "PRECONDITION_FAILED",
        publicMessage: "The sheet didn't finish. Everything that didn't arrive was refunded.",
        chargedCredits: outcome.chargedCredits,
        refundedCredits: outcome.refundedCredits,
      });
      return outcome;
    }

    // free_failure. A crash before the charge can leave the operation either
    // `claimed` or `running`, and those take different finalizers — the
    // running one refuses a claimed row outright.
    if (operation.status === "claimed") {
      await finalizeClaimedFailure({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "PRECONDITION_FAILED",
        publicMessage: "The sheet didn't start. You were not charged.",
      });
    } else {
      await finalizeFailure({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "PRECONDITION_FAILED",
        publicMessage: "The sheet didn't start. You were not charged.",
        chargedCredits: 0,
        refundedCredits: 0,
      });
    }
    return outcome;
  } catch (error) {
    /*
      The money is already settled correctly at this point — only the receipt
      failed. Escalating rather than returning the clean outcome keeps the
      operation visible to support instead of leaving a user staring at a
      sheet that never resolves.
    */
    log.error(
      { operationId: operation.id, outcome: outcome.type, err: error },
      "[rollRecovery] adjudication settled but the receipt did not seal",
    );
    return {
      type: "recovery_required",
      reason: "receipt did not seal after adjudication",
      chargedCredits: "chargedCredits" in outcome ? outcome.chargedCredits : 0,
      refundedCredits: "refundedCredits" in outcome ? outcome.refundedCredits : 0,
    };
  }
}

async function adjudicateRollOperation(
  operation: RecoverableRollOperation,
  options: RollRecoveryDependencies = {},
): Promise<RollRecoveryOutcome> {
  const db = await getDb();
  if (!db) {
    return {
      type: "recovery_required",
      reason: "database unavailable during recovery",
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    };
  }

  const [roll] = await db
    .select()
    .from(castingRolls)
    .where(eq(castingRolls.operationId, operation.id))
    .limit(1);

  if (!roll) {
    /*
      The operation exists but no roll does. That means the crash happened
      between claiming the operation and committing the rows — and because the
      charge only ever happens AFTER those rows are durable, there is nothing
      to refund. Reporting a paid failure here would invent a refund for money
      that was never taken.
    */
    return { type: "free_failure", reason: "no roll rows were committed" };
  }

  const candidates = await db
    .select()
    .from(castingCandidates)
    .where(and(eq(castingCandidates.rollId, roll.id), eq(castingCandidates.userId, operation.userId)));

  const landed = candidates.filter(hasLanded);
  const owed = candidates.filter((candidate) => !hasLanded(candidate));

  /*
    THE CHARGE GATE. Rows are durable before money moves, so their existence
    proves work was *planned*, never that it was paid for. Everything below
    this point may only give back what the ledger shows was taken.
  */
  const charge = await readChargeTruth(db, operation);
  if (charge.kind === "ambiguous") {
    return {
      type: "recovery_required",
      reason: charge.reason,
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    };
  }
  if (charge.kind === "not_charged") {
    if (landed.length > 0) {
      /*
        Impossible under the pinned sequence — dispatch happens after the
        deduct, so nothing can land unpaid. If it happens anyway, the sequence
        was violated somewhere and a human must look; silently keeping free
        images or silently refunding nothing are both dishonest answers.
      */
      return {
        type: "recovery_required",
        reason: "candidates landed under an operation with no recorded charge",
        chargedCredits: 0,
        refundedCredits: operation.refundedCredits,
      };
    }
    await failUnpaidCandidates(db, operation, owed);
    await db
      .update(castingRolls)
      .set({ status: "failed" })
      .where(and(eq(castingRolls.id, roll.id), inArray(castingRolls.status, ["pending", "generating"])));
    log.warn(
      { operationId: operation.id, rollId: roll.publicId, candidates: owed.length },
      "[rollRecovery] crash before the charge — rows failed, nothing refunded",
    );
    return { type: "free_failure", reason: "operation crashed before the charge was recorded" };
  }

  if (owed.length === 0) {
    // Everything landed; the crash was after the last candidate. Nothing owed.
    await db
      .update(castingRolls)
      .set({ status: "complete" })
      .where(and(eq(castingRolls.id, roll.id), inArray(castingRolls.status, ["pending", "generating"])));
    return { type: "durable_success", ready: landed.length, chargedCredits: charge.credits };
  }

  let refundedCredits = 0;
  let refundedCount = 0;
  let unrecorded = 0;

  for (const candidate of owed) {
    // Ask the provider only for work we actually dispatched. A `queued`
    // candidate never reached them, so there is nothing to ask about.
    let delivered: "delivered" | "not_delivered" | "unknown" = "not_delivered";
    if (candidate.status === "dispatched") {
      delivered = options.probe
        ? await options
            .probe({ provider: candidate.provider, providerRef: candidate.providerRef })
            .catch(() => "unknown" as const)
        : "unknown";
    }

    const slice = candidate.pointsCost;
    if (slice > 0 && refundedCredits + slice > charge.credits) {
      /*
        The ceiling. Slices are read from each candidate's own row, so a
        corrupted or mis-seeded `pointsCost` could otherwise refund more than
        was ever charged. Conservation is not an assertion we hope holds — it
        is enforced here, and breaching it is a support case, not a silent
        overpayment.
      */
      log.error(
        { operationId: operation.id, candidate: candidate.publicId, slice, refundedCredits, charged: charge.credits },
        "[rollRecovery] refund slices would exceed the recorded charge — stopping",
      );
      return {
        type: "recovery_required",
        reason: "refund slices exceed the recorded charge",
        chargedCredits: charge.credits,
        refundedCredits,
      };
    }
    if (slice > 0) {
      const outcome = await recordRefund(
        operation.userId,
        slice,
        "Casting candidate did not arrive",
        candidateChargeReference(operation.id, candidate.publicId),
      );
      if (outcome.recorded) {
        refundedCredits += outcome.amount;
      } else {
        /*
          A refund that failed to record is never reported as "you weren't
          charged" (the atomicCredits law). Count it so the operation lands in
          recovery_required rather than quietly claiming conservation.
        */
        unrecorded += 1;
        log.error(
          { operationId: operation.id, candidate: candidate.publicId, reference: outcome.reference },
          "[rollRecovery] refund slice did not record — user remains charged",
        );
      }
    }
    refundedCount += 1;

    await db
      .update(castingCandidates)
      .set({
        status: "failed",
        failureClass: delivered === "delivered" ? "provider_delivered_unlanded" : "unrecovered",
      })
      .where(
        and(
          eq(castingCandidates.id, candidate.id),
          eq(castingCandidates.userId, operation.userId),
          // CAS: never overwrite a status a live process reached first.
          inArray(castingCandidates.status, ["queued", "dispatched"]),
        ),
      );

    if (delivered === "delivered") {
      log.warn(
        { operationId: operation.id, candidate: candidate.publicId },
        "[rollRecovery] provider delivered work we never landed — refunded anyway, COGS absorbed",
      );
    }
  }

  await db
    .update(castingRolls)
    .set({ status: landed.length > 0 ? "partial" : "failed" })
    .where(and(eq(castingRolls.id, roll.id), inArray(castingRolls.status, ["pending", "generating"])));

  if (unrecorded > 0) {
    return {
      type: "recovery_required",
      reason: `${unrecorded} refund slice(s) failed to record`,
      // The ledger's figure, not the operation row's — the operation row's
      // `chargedCredits` is only written at finalize, which a stale operation
      // never reached.
      chargedCredits: charge.credits,
      refundedCredits,
    };
  }

  return landed.length > 0
    ? {
        type: "partial",
        ready: landed.length,
        refunded: refundedCount,
        chargedCredits: charge.credits,
        refundedCredits,
      }
    : {
        type: "paid_failure",
        refunded: refundedCount,
        chargedCredits: charge.credits,
        refundedCredits,
      };
}
