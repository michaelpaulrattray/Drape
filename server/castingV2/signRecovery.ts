/**
 * The bespoke recovery adjudicator for `castingV2.sign` (plan §E, §F, D-92).
 *
 * The roll adjudicator asks "what landed?". This one asks a single sharper
 * question first, and everything else follows from the answer:
 *
 *   **Did the durable boundary commit?**
 *
 * The fork variable is `casting_candidates.signedCastId` — never the
 * operation's `modelId`, which is bound at activation and is therefore null on
 * exactly the crashes this exists for. If the CAS is set, a Cast exists and was
 * paid for; the promotion is never refunded and the work left is to finish the
 * package honestly. If it is not set, nothing was created, and the whole price
 * goes back.
 *
 * TWO ORDERING LAWS, both of them money:
 *
 * 1. **Fence before you touch the money.** A live process can outlive its lease
 *    and still be holding an open Sign transaction. Refunding first and
 *    discovering that afterwards produces the one outcome the design exists to
 *    prevent: a Cast that exists AND was fully refunded. So the operation is
 *    moved out of `running` inside the same transaction that reads the fork
 *    variable — after which the live transaction's own `FOR UPDATE` re-prove
 *    fails and it rolls back. (D-92 words this as "finalise first"; the honest
 *    form is `recovery_required` first and the true receipt afterwards — see
 *    `fenceCastingV2SignOperationIn`.)
 * 2. **Read prior refunds; never re-issue them to find out.** Idempotent
 *    references make a duplicate refund a no-op, which works right up until the
 *    day one of them is not a duplicate.
 */
import { and, eq, inArray } from "drizzle-orm";

import { creditTransactions } from "../../drizzle/schema";
import { recordRefund, refundReferenceFor } from "../casting/atomicCredits";
import { operationChargeReference } from "../casting/operationContract";
import {
  fenceCastingV2SignOperationIn,
  finalizeClaimedGenerationOperationFailure,
  finalizeFencedCastingV2SignOperation,
  markClaimedGenerationOperationRecoveryRequired,
  markGenerationOperationRecoveryRequired,
  parkFencedCastingV2SignOperation,
} from "../db/generationOperations";
import {
  activateSignedCast,
  findCastBySignOperation,
  recordRecoveredSlotFailure,
} from "../db/castingV2Sign";
import { getDb, withTransaction } from "../db/connection";
import { createModuleLogger } from "../logging/logger";
import type { CastViewAngle } from "../../shared/boardTypes";
import { CAST_PACKAGE_VIEWS, CAST_PACKAGE_VIEW_PRICE } from "./castViewPackage";
import {
  packageSlotChargeReference,
  promisedPackageAngles,
  unsettledPackageAngles,
} from "./packageOrchestrator";
import { CASTING_V2_SIGN_COSTS } from "../casting/castingCreditCosts";

const log = createModuleLogger("castingV2/signRecovery");

export type SignRecoveryOutcome =
  | { type: "durable_success"; views: number; chargedCredits: number; refundedCredits: number }
  | { type: "partial"; views: number; chargedCredits: number; refundedCredits: number }
  | { type: "paid_failure"; chargedCredits: number; refundedCredits: number }
  /** Terminal, and the user was never charged — nothing is owed back. */
  | { type: "free_failure"; reason: string }
  | { type: "recovery_required"; reason: string; chargedCredits: number; refundedCredits: number };

export type RecoverableSignOperation = {
  id: string;
  userId: number;
  status: "claimed" | "running" | "recovery_required";
  chargedCredits: number;
  refundedCredits: number;
  /**
   * What the server planned to charge, written at the running transition.
   *
   * The cross-check on the promised view list: if the two disagree, this Sign
   * was charged under a package this build cannot reconstruct, and guessing
   * would under-refund silently.
   */
  plannedCredits: number;
};

export type SignRecoveryDependencies = {
  findCast?: typeof findCastBySignOperation;
  promisedAngles?: typeof promisedPackageAngles;
  park?: typeof parkFencedCastingV2SignOperation;
  parkRunning?: typeof markGenerationOperationRecoveryRequired;
  parkClaimed?: typeof markClaimedGenerationOperationRecoveryRequired;
  unsettledAngles?: typeof unsettledPackageAngles;
  refund?: typeof recordRefund;
  recordSlotFailure?: typeof recordRecoveredSlotFailure;
  activate?: typeof activateSignedCast;
  finalizeFenced?: typeof finalizeFencedCastingV2SignOperation;
  finalizeClaimedFailure?: typeof finalizeClaimedGenerationOperationFailure;
};

type ChargeTruth =
  | { kind: "charged"; credits: number }
  | { kind: "not_charged" }
  | { kind: "ambiguous"; reason: string };

type SignLedger = {
  charge: ChargeTruth;
  /** Everything already given back under this operation, by anyone. */
  alreadyRefunded: number;
};

/**
 * What the ledger says about this Sign — the only authority on whether money
 * moved.
 *
 * The Cast's own rows cannot answer it. The charge happens BEFORE the durable
 * boundary, so a Cast that exists proves a charge exists, but a Cast that does
 * not exist proves nothing either way: the crash may have been before the
 * deduct or after it. `generation_operations.chargedCredits` is no help either,
 * because it is written at finalize and a stale operation never got there.
 */
async function readSignLedger(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  operation: { id: string; userId: number },
): Promise<SignLedger> {
  const chargeReference = operationChargeReference(operation.id);
  const refundReferences = [
    refundReferenceFor(chargeReference),
    ...CAST_PACKAGE_VIEWS.map((angle) =>
      refundReferenceFor(packageSlotChargeReference(operation.id, angle))),
  ];

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
      charge: { kind: "ambiguous", reason: "duplicate charge rows for one Sign" },
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

export async function recoverCastingV2SignOperation(
  operation: RecoverableSignOperation,
  options: SignRecoveryDependencies = {},
): Promise<SignRecoveryOutcome> {
  const db = await getDb();
  if (!db) {
    return {
      type: "recovery_required",
      reason: "database unavailable during recovery",
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    };
  }

  const ledger = await readSignLedger(db, operation);
  if (ledger.charge.kind === "ambiguous") {
    // Pre-fence, so the operation is still `running` and the standard marker
    // owns it. A ledger nobody can read is a human's problem, not a retry's.
    await parkRunning(options, operation, ledger.charge.reason);
    return {
      type: "recovery_required",
      reason: ledger.charge.reason,
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    };
  }

  /*
    A `claimed` Sign never reached the running transition, and the deduct
    happens after it — so there is no charge, no Cast, and nothing to give back.
    Its finalizer is the claimed one; the running finalizer refuses a claimed
    row outright.
  */
  if (operation.status === "claimed") {
    if (ledger.charge.kind === "charged") {
      await (options.parkClaimed ?? markClaimedGenerationOperationRecoveryRequired)({
        userId: operation.userId,
        operationId: operation.id,
        publicMessage:
          `This Cast needs support review before it can be retried. Operation ${operation.id}.`,
      }).catch((error) => {
        log.error({ operationId: operation.id, err: error }, "[signRecovery] could not park a claimed Sign");
      });
      return {
        type: "recovery_required",
        reason: "a claimed Sign carries a charge",
        chargedCredits: ledger.charge.credits,
        refundedCredits: ledger.alreadyRefunded,
      };
    }
    await (options.finalizeClaimedFailure ?? finalizeClaimedGenerationOperationFailure)({
      userId: operation.userId,
      operationId: operation.id,
      errorCode: "PRECONDITION_FAILED",
      publicMessage: "That Cast wasn't signed. You were not charged.",
    });
    return { type: "free_failure", reason: "the Sign never started" };
  }

  /*
    THE FENCE, and the fork variable read under it.

    One transaction: take the operation row, read whether the candidate CAS is
    set, and move the operation out of `running` — in that order, because
    reading first and fencing afterwards leaves precisely the window where a
    live Sign commits between the two and gets refunded anyway.

    An operation already in `recovery_required` was fenced by an earlier pass
    that did not get to seal. Re-adjudicating is safe: the verdict is a pure
    function of the candidate CAS and the ledger, and every action below is
    idempotent.
  */
  if (operation.status === "running") {
    const fenced = await withTransaction((tx) => fenceCastingV2SignOperationIn(tx, {
      userId: operation.userId,
      operationId: operation.id,
      publicMessage:
        `This Cast is being settled by support automation. Operation ${operation.id}.`,
      chargedCredits: ledger.charge.kind === "charged" ? ledger.charge.credits : 0,
      refundedCredits: Math.min(
        ledger.alreadyRefunded,
        ledger.charge.kind === "charged" ? ledger.charge.credits : 0,
      ),
    }));
    if (!fenced) {
      // The live process finished between the sweep's read and this statement.
      // Its settlement stands.
      return { type: "free_failure", reason: "the Sign settled itself first" };
    }
  }

  const cast = await (options.findCast ?? findCastBySignOperation)(operation.userId, operation.id);

  /* ---- fork A: the boundary never committed. Nothing exists; refund it all. */
  if (!cast) {
    if (ledger.charge.kind === "not_charged") {
      await sealFailure(options, operation, 0, 0, "That Cast wasn't signed. You were not charged.");
      return { type: "free_failure", reason: "the Sign crashed before the charge" };
    }
    const owed = ledger.charge.credits - ledger.alreadyRefunded;
    let refunded = ledger.alreadyRefunded;
    if (owed > 0) {
      const outcome = await (options.refund ?? recordRefund)(
        operation.userId,
        owed,
        "Sign didn't complete",
        operationChargeReference(operation.id),
      );
      if (!outcome.recorded) {
        log.error(
          { operationId: operation.id, reference: outcome.reference },
          "[signRecovery] the Sign refund did not record — the owner remains charged",
        );
        return park(options, operation, {
          type: "recovery_required",
          reason: "the full Sign refund did not record",
          chargedCredits: ledger.charge.credits,
          refundedCredits: refunded,
        });
      }
      // Not `+= amount` unconditionally: an exact duplicate is already inside
      // `alreadyRefunded`, and counting it again overstates the receipt (and can
      // trip the conservation ceiling on a perfectly healthy Cast).
      if (!outcome.duplicate) refunded += outcome.amount;
    }
    await sealFailure(
      options,
      operation,
      ledger.charge.credits,
      refunded,
      "That Cast wasn't signed. Everything you paid was refunded.",
    );
    return { type: "paid_failure", chargedCredits: ledger.charge.credits, refundedCredits: refunded };
  }

  /* ---- fork B: the Cast exists. The promotion stands; finish the package. */
  if (cast.candidateSignedCastId !== cast.modelId || cast.candidateStatus !== "signed") {
    /*
      Structurally unreachable — the model row and the candidate CAS commit in
      one transaction — so if it happens, a human looks. Silently refunding a
      Cast that exists, or silently keeping money for one that does not, are
      both worse than an operation support can see.
    */
    return park(options, operation, {
      type: "recovery_required",
      reason: "the Cast and its candidate disagree about the signature",
      chargedCredits: ledger.charge.kind === "charged" ? ledger.charge.credits : 0,
      refundedCredits: ledger.alreadyRefunded,
    });
  }
  if (ledger.charge.kind === "not_charged") {
    // authority exists ⟹ money was taken. If that is false, the sequence was
    // violated somewhere and nothing here should guess which way.
    return park(options, operation, {
      type: "recovery_required",
      reason: "a Cast exists under a Sign with no recorded charge",
      chargedCredits: 0,
      // Conservation refuses a refund larger than a charge, and this branch has
      // no charge to compare against — the figure a human needs is in the log.
      refundedCredits: 0,
    });
  }

  /*
    WHAT THIS SIGN PAID FOR, not what today's profile sells.

    Read from the operation's own durable audit rows. When there are none — a
    crash before any view was opened — the fallback is today's profile, and it
    is only trustworthy if the price agrees with it. It if does not, this Sign
    was bought under a package composition this build cannot reconstruct, and
    the honest move is a human rather than a refund of the wrong size.
  */
  const promise = await (options.promisedAngles ?? promisedPackageAngles)({
    userId: operation.userId,
    operationId: operation.id,
  });
  const impliedPrice =
    CASTING_V2_SIGN_COSTS.promotion + CAST_PACKAGE_VIEW_PRICE * promise.angles.length;
  if (operation.plannedCredits > 0 && impliedPrice !== operation.plannedCredits) {
    return park(options, operation, {
      type: "recovery_required",
      reason: `the promised package (${promise.angles.length} views, ${promise.source}) does not match the ${operation.plannedCredits} planned`,
      chargedCredits: ledger.charge.credits,
      refundedCredits: ledger.alreadyRefunded,
    });
  }

  const unsettled = await (options.unsettledAngles ?? unsettledPackageAngles)({
    userId: operation.userId,
    modelId: cast.modelId,
    promised: promise.angles,
  });

  let refundedCredits = ledger.alreadyRefunded;
  let unrecorded = 0;
  for (const angle of unsettled) {
    if (refundedCredits + CAST_PACKAGE_VIEW_PRICE > ledger.charge.credits) {
      /*
        The conservation ceiling. Slices are read from a code constant and the
        ledger from the database; if they ever disagree enough to overpay, that
        is a support case, not a silent overpayment.
      */
      log.error(
        { operationId: operation.id, angle, refundedCredits, charged: ledger.charge.credits },
        "[signRecovery] slot refunds would exceed the recorded charge — stopping",
      );
      return park(options, operation, {
        type: "recovery_required",
        reason: "slot refunds would exceed the recorded charge",
        chargedCredits: ledger.charge.credits,
        refundedCredits,
      });
    }
    const outcome = await (options.refund ?? recordRefund)(
      operation.userId,
      CAST_PACKAGE_VIEW_PRICE,
      "Cast package: a view didn't arrive",
      packageSlotChargeReference(operation.id, angle),
    );
    // Same rule as the full refund above: a duplicate was already counted in
    // `alreadyRefunded`, so adding it again would report money moving twice.
    if (outcome.recorded && !outcome.duplicate) refundedCredits += outcome.amount;
    else if (!outcome.recorded) {
      unrecorded += 1;
      log.error(
        { operationId: operation.id, angle, reference: outcome.reference },
        "[signRecovery] slot refund did not record — the owner remains charged",
      );
    }
    /*
      The failure is written where the ROOM reads it, not only where support
      does. A slot that was refunded but has no marker renders as an empty
      shimmer forever — the founder's gate condition is that it confesses in
      place instead.
    */
    await (options.recordSlotFailure ?? recordRecoveredSlotFailure)({
      userId: operation.userId,
      modelId: cast.modelId,
      angle: angle as CastViewAngle,
      failure: {
        reason: "This view didn't arrive",
        refunded: outcome.recorded ? outcome.amount : 0,
        refundReference: outcome.reference,
      },
    }).catch((error) => {
      log.error(
        { operationId: operation.id, angle, err: error },
        "[signRecovery] could not write the failed-slot marker",
      );
    });
  }

  const activation = await (options.activate ?? activateSignedCast)({
    userId: operation.userId,
    operationId: operation.id,
    modelId: cast.modelId,
  });
  if (activation.type === "unavailable") {
    return park(options, operation, {
      type: "recovery_required",
      reason: "the Cast could not be activated",
      chargedCredits: ledger.charge.credits,
      refundedCredits,
    });
  }

  if (unrecorded > 0) {
    return park(options, operation, {
      type: "recovery_required",
      reason: `${unrecorded} view refund(s) failed to record`,
      chargedCredits: ledger.charge.credits,
      refundedCredits,
    });
  }

  const views = activation.type === "activated" ? activation.slots.length : CAST_PACKAGE_VIEWS.length;
  const partial = unsettled.length > 0 || refundedCredits > 0;
  await (options.finalizeFenced ?? finalizeFencedCastingV2SignOperation)({
    userId: operation.userId,
    operationId: operation.id,
    outcome: {
      type: "success",
      result: {
        castPublicId: cast.agencyId,
        views,
        failedViews: unsettled.length,
      },
      terminalStatus: partial ? "partial" : "succeeded",
    },
    chargedCredits: ledger.charge.credits,
    refundedCredits,
    // The bind the live process never got to make. `bindGenerationOperationModel`
    // is gated on `running`, which the fence has already left — so the receipt
    // carries the link or nothing does.
    modelId: cast.modelId,
  });

  log.info(
    {
      operationId: operation.id,
      modelId: cast.modelId,
      recoveredViews: unsettled.length,
      refundedCredits,
    },
    "[signRecovery] a signed Cast was finished by recovery",
  );

  return partial
    ? { type: "partial", views, chargedCredits: ledger.charge.credits, refundedCredits }
    : {
        type: "durable_success",
        views,
        chargedCredits: ledger.charge.credits,
        refundedCredits,
      };
}

/**
 * A dead end: leave the operation where a human will see it, and take it OUT
 * of the sweep's fenced selection.
 *
 * The fence and a genuine support case share one status, so without this the
 * next pass would re-adjudicate a parked Sign every few minutes — overwriting
 * its support message, and eventually sealing a clean receipt over a customer
 * who is still short. The error code is the discriminator; parking rewrites it
 * to the standard one.
 */
async function park(
  options: SignRecoveryDependencies,
  operation: RecoverableSignOperation,
  outcome: Extract<SignRecoveryOutcome, { type: "recovery_required" }>,
): Promise<SignRecoveryOutcome> {
  const publicMessage =
    `This Cast needs support review before it can be retried. Operation ${operation.id}.`;
  try {
    await (options.park ?? parkFencedCastingV2SignOperation)({
      userId: operation.userId,
      operationId: operation.id,
      publicMessage,
      chargedCredits: outcome.chargedCredits,
      refundedCredits: Math.min(outcome.refundedCredits, outcome.chargedCredits),
    });
  } catch (error) {
    log.error(
      { operationId: operation.id, reason: outcome.reason, err: error },
      "[signRecovery] could not park a Sign that needs support — it will be re-adjudicated",
    );
  }
  log.error(
    { operationId: operation.id, reason: outcome.reason },
    "[signRecovery] parked for support review",
  );
  return outcome;
}

/** Pre-fence parking: the operation is still `running`, so the standard marker owns it. */
async function parkRunning(
  options: SignRecoveryDependencies,
  operation: RecoverableSignOperation,
  reason: string,
): Promise<void> {
  await (options.parkRunning ?? markGenerationOperationRecoveryRequired)({
    userId: operation.userId,
    operationId: operation.id,
    publicMessage:
      `This Cast needs support review before it can be retried. Operation ${operation.id}.`,
    chargedCredits: operation.chargedCredits,
    refundedCredits: Math.min(operation.refundedCredits, operation.chargedCredits),
  }).catch((error) => {
    log.error({ operationId: operation.id, reason, err: error }, "[signRecovery] could not park a running Sign");
  });
}

async function sealFailure(
  options: SignRecoveryDependencies,
  operation: RecoverableSignOperation,
  chargedCredits: number,
  refundedCredits: number,
  publicMessage: string,
): Promise<void> {
  await (options.finalizeFenced ?? finalizeFencedCastingV2SignOperation)({
    userId: operation.userId,
    operationId: operation.id,
    outcome: { type: "failure", errorCode: "PRECONDITION_FAILED", publicMessage },
    chargedCredits,
    refundedCredits,
  });
}
