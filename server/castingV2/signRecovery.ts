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
import { CAST_VIEW_ANGLES } from "../../shared/boardTypes";
import { recordRefund, refundReferenceFor } from "../casting/atomicCredits";
import { flatPressRefundOwed } from "../casting/flatPressCharge";
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
import { CAST_PACKAGE_VIEWS } from "./castViewPackage";
import {
  committedPackageAngles,
  packagePromotionChargeReference,
  packageSlotChargeReference,
  promisedPackageAngles,
  unsettledPackageAngles,
} from "./packageOrchestrator";

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
  committedAngles?: typeof committedPackageAngles;
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
  /*
    Every reference this Sign COULD have refunded under, not the ones today's
    profile would produce. `CAST_VIEW_ANGLES` rather than `CAST_PACKAGE_VIEWS`
    for the D-102 reason: a Sign bought under a different composition has slot
    refunds this build does not sell, and missing them here understates
    `alreadyRefunded` — which is the number the conservation ceiling is measured
    against. The promotion reference joins them, because a total loss refunds
    that too and a second sweep must see it (D-103).
  */
  const refundReferences = [
    refundReferenceFor(chargeReference),
    refundReferenceFor(packagePromotionChargeReference(operation.id)),
    ...CAST_VIEW_ANGLES.map((angle) =>
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
    WHAT THIS SIGN PROMISED — read from the operation's own durable audit rows.

    When there are none — a crash before any view was opened — the fallback is
    today's profile. It decides one thing only: whether this Sign owed any views
    at all, which is what makes "not one landed" a total loss rather than a Sign
    that promised nothing.

    ⚠ **IT NO LONGER DECIDES THE PRICE, AND THE CHECK THAT USED TO IS GONE
    (#1968).** What stood here derived `CASTING_V2_SIGN_COSTS.promotion +
    CAST_PACKAGE_VIEW_PRICE × promise.angles.length` and PARKED the operation
    when it disagreed with `plannedCredits`, on the stated ground that *"this
    Sign was bought under a package composition this build cannot reconstruct,
    and the honest move is a human rather than a refund of the wrong size"*.

    That reasoning was right and its premise is gone: his reprice makes the
    Sign one flat charge, so the composition cannot imply a price any more, and
    **the refund size now comes from the LEDGER rather than from any
    constant** — see the total-loss branch below. Keeping the comparison would
    have parked every Sign in flight across this deploy: an 8,500 charge
    against a 3,250 derivation, a customer left charged until a human looked,
    for a price change that is not a fault.

    What still protects the money is the conservation ceiling in that branch,
    which compares against `ledger.charge.credits` — a durable row, not a
    build-time number.
  */
  const promise = await (options.promisedAngles ?? promisedPackageAngles)({
    userId: operation.userId,
    operationId: operation.id,
  });

  /*
    ⚠ **NO PER-VIEW REFUND LOOP ANY MORE — #1968, and this is the half of the
    card that moves real money.**

    What stood here read `unsettledPackageAngles` and refunded
    `CAST_PACKAGE_VIEW_PRICE` under each one's slot reference, writing a
    recovered-failure marker beside it. His word of 2026-10-08 ends it:

      > *"Drop the 700 base + 200 per view split, since views are cut from two
      > sheets and can't be refunded one by one... Credits only come back if
      > the Sign can't be delivered at all."*

    So an unsettled view is now settled by the confession alone, exactly as a
    refused view is on the live road. The markers still matter — a slot with no
    marker renders as an empty shimmer forever, which is the founder's own gate
    condition — so they are still written below, with `refunded: 0`.

    ⚠ **A SIGN PART-REFUNDED BY SLICE UNDER THE OLD BUILD IS NOT CLAWED BACK
    AND IS NOT PAID TWICE.** Those rows are still summed into
    `ledger.alreadyRefunded` (`readSignLedger` reads every slot reference over
    `CAST_VIEW_ANGLES` for exactly this reason, D-102), and the total-loss
    branch refunds the charge MINUS that sum. A partial package keeps whatever
    slices it was already given.
  */
  const unsettled = await (options.unsettledAngles ?? unsettledPackageAngles)({
    userId: operation.userId,
    modelId: cast.modelId,
    promised: promise.angles,
  });

  let refundedCredits = ledger.alreadyRefunded;
  let unrecorded = 0;

  /*
    ⚠ **THE CONSERVATION CEILING, AND #1968 MOVED IT AHEAD OF THE SETTLE.**

    It lived inside the two refund loops, comparing a code constant against the
    ledger before each payment. There is one payment now and its size is a
    SUBTRACTION over two ledger figures, so the only way it can be wrong is a
    ledger that already contradicts itself — more refunded under this operation
    than was ever charged for it.

    That is a support case on either road, so it is asked once, here, before
    anything is settled or sealed. **The first shape of this repair treated it
    as a benign "nothing left to give back" and sealed a receipt over it**, and
    `never refunds more than was charged` is the arm that caught it — a sealed
    receipt is exactly what destroys the trail a human would need.
  */
  if (refundedCredits > ledger.charge.credits) {
    log.error(
      { operationId: operation.id, refundedCredits, charged: ledger.charge.credits },
      "[signRecovery] the ledger shows more refunded than charged — stopping",
    );
    return park(options, operation, {
      type: "recovery_required",
      reason: "the ledger shows more refunded than charged",
      chargedCredits: ledger.charge.credits,
      refundedCredits,
    });
  }
  for (const angle of unsettled) {
    /*
      The failure is written where the ROOM reads it, not only where support
      does. A slot that was never settled and has no marker renders as an empty
      shimmer forever — the founder's gate condition is that it confesses in
      place instead. Since #1968 it confesses with no money beside it.
    */
    await (options.recordSlotFailure ?? recordRecoveredSlotFailure)({
      userId: operation.userId,
      modelId: cast.modelId,
      angle: angle as CastViewAngle,
      failure: {
        reason: "This view didn't arrive",
        /* No slice comes back for a view (#1968), and no reference either —
           `failView` carries why the absence is the signal. */
        refunded: 0,
      },
    }).catch((error) => {
      log.error(
        { operationId: operation.id, angle, err: error },
        "[signRecovery] could not write the failed-slot marker",
      );
    });
  }

  /*
    ZERO OF N, decided the way the live orchestrator decides it (founder ruling,
    2026-08-02) — but recomputed from the asset rows, because by the time this
    runs the process that built the package is dead and its beliefs are gone.

    The invariant it lives under is no longer "the CAS is set, so the promotion
    is retained" but "the CAS is set AND at least one view landed". Both halves
    are durable, so a crash at any point still settles the same way, and the
    reference is derived by the shared helper — byte-identical to the one the
    live path would have used, so if that path got the refund out before dying,
    this one is a no-op rather than a second payment.
  */
  const committed = await (options.committedAngles ?? committedPackageAngles)({
    userId: operation.userId,
    modelId: cast.modelId,
    promised: promise.angles,
  });
  if (committed.length === 0 && promise.angles.length > 0) {
    /*
      ⚠ **THE WHOLE CHARGE, READ OFF THE LEDGER, MINUS WHATEVER ALREADY WENT
      BACK — #1968, and deriving it is what lets one build settle both prices.**

      It read `CASTING_V2_SIGN_COSTS.promotion` — correct while five slices
      refunded themselves alongside it and summed to the charge. With the
      slices gone there is ONE refund, and a build-time constant is the wrong
      place to read its size from: a Sign in flight across this deploy was
      charged 8,500 and today's price is 3,250, so a constant would short the
      customer by 5,250 on our own outage.

      `ledger.charge.credits` is the durable row this operation actually wrote,
      and `alreadyRefunded` already counts every slot refund the old build may
      have managed before it died (D-102). Their difference is exactly what is
      still owed, whatever price the Sign was bought at.

      It cannot go negative: a ledger whose refunds already exceed its charge
      is caught by the conservation ceiling below before this is read.
    */
    /*
      ⚠ **THE RULE IS ASKED, NOT RESTATED.** `flatPressRefundOwed` is the one
      definition of *"could not be delivered at all"*, shared with the live
      orchestrator and with the paid redo — two spellings of one founder ruling
      is working law 4 on a money path, and this branch and the live one decide
      the same question from different evidence hours apart.

      Never negative: the ceiling above has already parked a ledger whose
      refunds exceed its charge, so this is the honest remainder and nothing
      more. The branch is only entered with `committed.length === 0`, so the
      helper answers the whole charge here — it is asked anyway, because the
      day *delivered* means something subtler, this road must move with the
      other one rather than be remembered. Zero is the ordinary case for a Sign a previous pass settled, or one
      the old build part-refunded all the way to its charge.
    */
    const owed = flatPressRefundOwed({
      chargedCredits: ledger.charge.credits,
      delivered: committed.length,
    }) - refundedCredits;
    if (owed === 0) {
      log.warn(
        { operationId: operation.id, refundedCredits, charged: ledger.charge.credits },
        "[signRecovery] total loss with nothing still owed — the charge is already fully refunded",
      );
    }
    const outcome = owed > 0
      ? await (options.refund ?? recordRefund)(
        operation.userId,
        owed,
        "Cast package: nothing arrived — the Sign refunded in full",
        packagePromotionChargeReference(operation.id),
      )
      : { recorded: true, duplicate: true, amount: 0, reference: packagePromotionChargeReference(operation.id) };
    if (outcome.recorded && !outcome.duplicate) refundedCredits += outcome.amount;
    else if (!outcome.recorded) {
      unrecorded += 1;
      log.error(
        { operationId: operation.id, reference: outcome.reference },
        "[signRecovery] the promotion refund did not record — the owner remains charged",
      );
    }
    log.error(
      {
        operationId: operation.id,
        modelId: cast.modelId,
        promised: promise.angles.length,
        refundedCredits,
      },
      "[signRecovery] TOTAL LOSS — not one view landed; the whole Sign refunded, base included",
    );
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

  /*
    VIEWS SOLD, not slots sealed — and they stopped being the same number.

    `activation.slots` includes the `frontClose` slot that `activateSignedCast`
    seals from the 1K anchor to satisfy the snapshot authority (D-97). Under
    package v3.1 `frontClose` is no longer a view anybody buys, so counting
    slots would report SIX views on a five-view Sign — on a receipt whose whole
    purpose is to be read by support when something went wrong.

    Intersected with this Sign's own promise, so the count is what she paid for
    however the composition moves under her. The live path was always right
    (`signService` counts committed views); only recovery read the slots.
  */
  const sealed = activation.type === "activated"
    ? new Set(activation.slots.filter(
      (angle) => promise.angles.includes(angle as CastViewAngle),
    ))
    : new Set<string>();
  const views = activation.type === "activated" ? sealed.size : promise.angles.length;
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
