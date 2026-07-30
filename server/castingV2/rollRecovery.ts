import { and, eq, inArray, isNull, or } from "drizzle-orm";

import { castingCandidates, castingRolls, creditTransactions } from "../../drizzle/schema";
import { getDb } from "../db/connection";
import { recordRefund, refundReferenceFor } from "../casting/atomicCredits";
import { operationChargeReference } from "../casting/operationContract";
import {
  finalizeClaimedGenerationOperationFailure,
  finalizeGenerationOperationFailure,
  finalizeGenerationOperationSuccess,
} from "../db/generationOperations";
import { claimCandidateForRecovery } from "../db/castingV2";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/rollRecovery");

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) return Number((result[0] as { affectedRows?: unknown })?.affectedRows ?? 0);
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

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
 *    image and keeps it.
 *
 *    But "not landed" is NOT the same as "owed a refund", and conflating them
 *    was a real defect here: a discarded candidate was delivered and thrown
 *    away, an expired one was delivered after a cancel, a signed one became a
 *    Cast. Only genuinely unfinished work — and the torn `ready`-without-bytes
 *    write — can be settled by this sweep, and only after its CAS wins the row.
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
 * Did the user *get* this candidate, in the sense that owing them a refund
 * would be wrong?
 *
 * Wider than `hasLanded`, and the difference is the whole point. A discarded
 * candidate was delivered and then thrown away by its owner. An expired one
 * arrived after a cancel: delivered, unshown, and never refunded by law
 * (§F, §H.6). A signed one became a Cast. None of them is owed anything, and
 * an adjudicator that reasoned "not landed ⇒ refund" would hand money back for
 * every one of them the moment a lease lapsed.
 */
function wasDelivered(candidate: CandidateRow): boolean {
  return (
    hasLanded(candidate)
    || candidate.status === "discarded"
    || candidate.status === "signed"
    || candidate.status === "expired"
  );
}

/**
 * Candidates this sweep may still settle.
 *
 * Deliberately status-based rather than "everything that did not land". Only
 * work that never reached a terminal user-visible state can be owed a refund:
 *
 *   - `queued` / `dispatched` — genuinely unfinished;
 *   - `ready` with no `imageKey` — a torn write. `ready` is written after the
 *     bytes are in our storage, so a `ready` row without a key means the user
 *     cannot see the image, and keeping their money for it would be theft by
 *     bookkeeping (founder-ratified 2026-07-31).
 *
 * Everything else — `failed`, `cancelled`, `discarded`, `expired`, `signed` —
 * has already been settled by whoever put it in that state.
 */
function isSettleable(candidate: CandidateRow): boolean {
  if (candidate.status === "queued" || candidate.status === "dispatched") return true;
  return candidate.status === "ready" && !candidate.imageKey;
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

type OperationLedger = {
  charge: ChargeTruth;
  /** Credits already returned under this operation, by whoever returned them. */
  alreadyRefunded: number;
};

/**
 * Reads the charge and every per-candidate refund this operation has already
 * recorded, in one statement.
 *
 * Prior refunds are read rather than re-recorded. An earlier version leaned on
 * `recordRefund` being idempotent to *recover* the totals — re-issuing a
 * refund for an already-refunded candidate and letting the ledger's uniqueness
 * absorb it. That works only while every re-issue is genuinely a duplicate;
 * the moment one is not, it is a second refund. Reading is exact and cannot
 * pay anyone twice.
 */
async function readOperationLedger(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  operation: { id: string; userId: number },
  candidates: readonly CandidateRow[],
): Promise<OperationLedger> {
  const chargeReference = operationChargeReference(operation.id);
  const refundReferences = candidates.map((candidate) =>
    candidateRefundReference(operation.id, candidate.publicId),
  );

  const rows = await db
    .select()
    .from(creditTransactions)
    .where(and(
      eq(creditTransactions.userId, operation.userId),
      inArray(creditTransactions.referenceId, [chargeReference, ...refundReferences]),
    ));

  const chargeRows = rows.filter((row) => row.referenceId === chargeReference);
  const alreadyRefunded = rows
    .filter((row) => row.referenceId !== chargeReference && row.type === "refund" && row.amount > 0)
    .reduce((sum, row) => sum + row.amount, 0);

  if (chargeRows.length === 0) return { charge: { kind: "not_charged" }, alreadyRefunded };
  if (chargeRows.length > 1) {
    return {
      charge: { kind: "ambiguous", reason: "duplicate charge rows for one operation" },
      alreadyRefunded,
    };
  }
  const [charge] = chargeRows;
  if (charge.type !== "generation" || charge.amount >= 0) {
    return {
      charge: { kind: "ambiguous", reason: "charge reference holds a non-charge ledger row" },
      alreadyRefunded,
    };
  }
  return { charge: { kind: "charged", credits: Math.abs(charge.amount) }, alreadyRefunded };
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
        or(
          inArray(castingCandidates.status, ["queued", "dispatched"]),
          and(eq(castingCandidates.status, "ready"), isNull(castingCandidates.imageKey)),
        ),
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
  /** The candidate CAS. Injected so a test can make this sweep *lose* it. */
  claimCandidate?: typeof claimCandidateForRecovery;
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
  const delivered = candidates.filter(wasDelivered);
  const owed = candidates.filter(isSettleable);

  /*
    THE CHARGE GATE. Rows are durable before money moves, so their existence
    proves work was *planned*, never that it was paid for. Everything below
    this point may only give back what the ledger shows was taken.
  */
  const { charge, alreadyRefunded } = await readOperationLedger(db, operation, candidates);
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

    /*
      One more look at the ledger before we tell the user they were not
      charged. The gap between "no charge yet" and this line is a live
      process's deduct landing late — a stalled request whose lease lapsed. We
      have just failed its rows, so it can no longer dispatch, but if its money
      moved, "you were not charged" would be a lie sealed into a terminal
      receipt that nothing revisits. Cheap read, unbounded consequence.
    */
    const recheck = await readOperationLedger(db, operation, candidates);
    if (recheck.charge.kind !== "not_charged") {
      log.error(
        { operationId: operation.id, rollId: roll.publicId },
        "[rollRecovery] a charge appeared while adjudicating an unpaid roll — escalating",
      );
      return {
        type: "recovery_required",
        reason: "a charge landed after the roll was adjudicated unpaid",
        chargedCredits: recheck.charge.kind === "charged" ? recheck.charge.credits : 0,
        refundedCredits: recheck.alreadyRefunded,
      };
    }

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

  // Credits already returned by the live process or by a cancel, read from the
  // ledger rather than re-issued. They count toward both the receipt total and
  // the conservation ceiling.
  let refundedCredits = alreadyRefunded;
  let refundedCount = 0;
  let unrecorded = 0;

  for (const candidate of owed) {
    // Ask the provider only for work we actually dispatched. A `queued`
    // candidate never reached them, so there is nothing to ask about.
    let providerOutcome: "delivered" | "not_delivered" | "unknown" = "not_delivered";
    if (candidate.status === "dispatched") {
      providerOutcome = options.probe
        ? await options
            .probe({ provider: candidate.provider, providerRef: candidate.providerRef })
            .catch(() => "unknown" as const)
        : "unknown";
    }

    /*
      CLAIM THE ROW BEFORE PAYING FOR IT.

      This CAS is what makes the refund safe, so it must come first. A live
      process can outlive its lease — one heartbeat failure stops the
      heartbeat permanently while dispatch keeps running — so between this
      sweep's SELECT and this moment, that process may have landed the
      candidate. Refunding first and CASing afterwards meant the refund was
      already committed by the time we discovered we had lost: delivered AND
      refunded, the one outcome the whole design exists to prevent.

      Losing here is not an error. It means someone else settled this
      candidate, and their settlement stands.
    */
    // The predicate re-proves the settleable states at CAS time, including the
    // torn write — still `ready`, still without bytes in our storage.
    const claimed = await (options.claimCandidate ?? claimCandidateForRecovery)({
      userId: operation.userId,
      candidateId: candidate.id,
      failureClass:
        providerOutcome === "delivered" ? "provider_delivered_unlanded" : "unrecovered",
    });
    if (!claimed) {
      log.info(
        { operationId: operation.id, candidate: candidate.publicId },
        "[rollRecovery] candidate settled by a live process first — not refunding",
      );
      continue;
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

    if (providerOutcome === "delivered") {
      log.warn(
        { operationId: operation.id, candidate: candidate.publicId },
        "[rollRecovery] provider delivered work we never landed — refunded anyway, COGS absorbed",
      );
    }
  }

  await db
    .update(castingRolls)
    .set({ status: delivered.length > 0 ? "partial" : "failed" })
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

  // `delivered`, not `landed`: a roll whose only survivor was discarded by its
  // owner still delivered something, and calling that a total failure would
  // misreport both the roll and the receipt.
  return delivered.length > 0
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
