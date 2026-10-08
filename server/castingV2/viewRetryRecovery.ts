/**
 * THE SWEEP'S HALF OF A TRY AGAIN (#1208 slice 2).
 *
 * The Sign adjudicator asks "did the durable boundary commit?"; this one asks
 * the same question about a far smaller fork:
 *
 *   **Did a picture land under THIS operation?**
 *
 * The fork variable is the retried asset's own `provenance.retryOperationId` —
 * never anything the dead process believed, and never the operation's own
 * status, which is exactly what a crash leaves wrong. A picture landed means
 * the customer has the view they asked for and the 50 credits bought it. No
 * picture means nothing was delivered and the charge goes back.
 *
 * ⚠ **A FREE TRY AGAIN NEVER CHARGES, SO "NO CHARGE" IS ITS ORDINARY STATE.**
 * An unjudged view's retry costs nothing (his ruling on #1220), so a crashed
 * free retry has an empty ledger and closes free — the same road a paid retry
 * takes when it dies before its deduct. Nothing is refunded on a guess in
 * either case, because the ledger is read rather than assumed.
 */
import { and, eq, inArray } from "drizzle-orm";

import { creditTransactions } from "../../drizzle/schema";
import { recordRefund, refundReferenceFor } from "../casting/atomicCredits";
import { flatPressRefundOwed, type FlatPressOperation } from "../casting/flatPressCharge";
import { operationChargeReference } from "../casting/operationContract";
import {
  finalizeClaimedGenerationOperationFailure,
  finalizeGenerationOperationFailure,
  finalizeGenerationOperationSuccess,
} from "../db/generationOperations";
import { pressViewLanded, retriedViewLanded } from "../db/castingV2ViewRetry";
import { getDb } from "../db/connection";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/viewRetryRecovery");

export type ViewRetryRecoveryOutcome =
  | { type: "durable_success"; chargedCredits: number }
  | { type: "paid_failure"; chargedCredits: number; refundedCredits: number }
  /** Terminal, and the user was never charged — so nothing is owed back. */
  | { type: "free_failure"; reason: string }
  | { type: "recovery_required"; reason: string; chargedCredits: number; refundedCredits: number };

/**
 * ⚠ **ONE DECLARATION, TWO NAMES — and the declaration lives in
 * `flatPressCharge.ts` (#1903 review finding 2).** This adjudicator settles
 * two roads: the Try again, whose money is its own row, and a flat-priced
 * press, whose money is one row over five. The second road's callers must not
 * have to speak the first road's vocabulary to use it, so the shape is named
 * there under a road-neutral name and re-exported here under the name every
 * existing caller already passes. Aliased, never re-typed: a second copy of
 * the structure a refund is decided from is working law 4 on a money path.
 */
export type RecoverableViewRetryOperation = FlatPressOperation;

export type ViewRetryRecoveryDependencies = {
  landed?: typeof retriedViewLanded;
  refund?: typeof recordRefund;
  finalizeSuccess?: typeof finalizeGenerationOperationSuccess;
  finalizeFailure?: typeof finalizeGenerationOperationFailure;
  finalizeClaimedFailure?: typeof finalizeClaimedGenerationOperationFailure;
  /**
   * WHOSE WORDS THE CUSTOMER READS — the only thing that differs between the
   * two roads this adjudicator settles (#1903).
   *
   * Defaulted to the Try again's, so every existing caller and every arm
   * written before the redo existed keeps its exact sentences.
   */
  wording?: ViewReplacementWording;
  /**
   * CAN A ROW ON THIS ROAD EVER CARRY A CHARGE? Default `true` — the Try
   * again's does, and refunding it is the whole point.
   *
   * ⚠ **`false` MAKES AN UNEXPECTED CHARGE PARK INSTEAD OF REFUND (#1903).** A
   * flat-priced press keeps the money on its own row and its slots settle at
   * zero, so a charged slot is not a case to handle — it is a fact nothing on
   * that road can explain, and the safe act is to stop and tell a person
   * rather than to pay it out beside the press's own settlement.
   *
   * It is per road and never inferred from the charge being zero: "zero today"
   * and "zero by construction" are different claims, and only the second one
   * justifies refusing to refund.
   */
  chargeIsExpected?: boolean;
};

/**
 * THE THREE SENTENCES A SWEPT VIEW REPLACEMENT CAN SAY.
 *
 * ⚠ **COPY, and the whole of what this adjudicator does not share between the
 * two roads (#1903).** Everything else about settling a replaced view is
 * identical by construction rather than by coincidence: the fork variable is
 * *did a picture land under this operation*, which is the right question on
 * both roads, and the money is read off the ledger rather than from anything a
 * dead process believed. So the redo reuses this adjudicator and hands it its
 * own words, instead of a second 200-line copy of refund arithmetic whose
 * drift would be a customer refunded twice or not at all.
 */
export type ViewReplacementWording = {
  /** The description written on the refund row. */
  readonly refundDescription: string;
  /** Said on a swept operation that WAS charged and has now been refunded. */
  readonly paidSentence: string;
  /** Said on a swept operation that never charged, so nothing is owed. */
  readonly freeSentence: string;
};

/** The customer's sentence for a swept Try again — one wording, two writers. */
export const RECOVERED_VIEW_RETRY_SENTENCE =
  "That view didn't arrive when you asked again. Your credits were returned.";
export const RECOVERED_VIEW_RETRY_FREE_SENTENCE =
  "That view didn't arrive when you asked again. You were not charged.";
export const VIEW_RETRY_SUPPORT_REVIEW_SENTENCE = (operationId: string) =>
  `This view retry needs support review before it can be settled. Operation ${operationId}.`;

/** The Try again's words — the default, and every pre-#1903 arm's sentences. */
export const VIEW_RETRY_RECOVERY_WORDING: ViewReplacementWording = {
  refundDescription: "That view didn't arrive when you asked again",
  paidSentence: RECOVERED_VIEW_RETRY_SENTENCE,
  freeSentence: RECOVERED_VIEW_RETRY_FREE_SENTENCE,
};

/**
 * The redo's words (#1903).
 *
 * Still **one view** per sentence, because the operation being settled is one
 * view — a customer who pressed redo and lost her back view should be told
 * about her back view, not handed a sentence about a package four fifths of
 * which arrived.
 */
export const PACKAGE_REDO_RECOVERY_WORDING: ViewReplacementWording = {
  refundDescription: "That view didn't arrive when you asked for all the views again",
  paidSentence: "That view didn't arrive when you asked for all the views again. Your credits are back.",
  freeSentence: "That view didn't arrive when you asked for all the views again. You were not charged.",
};

export async function recoverCastingV2ViewRetryOperation(
  operation: RecoverableViewRetryOperation,
  options: ViewRetryRecoveryDependencies = {},
): Promise<ViewRetryRecoveryOutcome> {
  const outcome = await adjudicate(operation, options);
  return seal(operation, outcome, options);
}

/**
 * THE SWEEP'S HALF OF A PACKAGE REDO (#1903) — the same adjudicator, its own
 * words.
 *
 * A named entry point rather than a flag at the dispatch, so the recovery
 * table reads as what it is: five operations per press, each settled on its own
 * question, by the control that already settles a replaced view correctly.
 */
export async function recoverCastingV2PackageRedoOperation(
  operation: RecoverableViewRetryOperation,
  options: ViewRetryRecoveryDependencies = {},
): Promise<ViewRetryRecoveryOutcome> {
  return recoverCastingV2ViewRetryOperation(operation, {
    ...options,
    wording: options.wording ?? PACKAGE_REDO_RECOVERY_WORDING,
    /*
      ⚠ **A REDO SLOT SETTLES AT ZERO, SO A CHARGE ON ONE IS PARKED (#1903
      review finding).** The press holds the whole 3,250; these five rows plan
      0 and settle 0/0. Before this, a slot found charged was REFUNDED — the
      per-slice road from the old 350-a-view price, unreachable by design and
      still wired, which is exactly the shape working law 7 calls a sibling
      waiting to happen. It is the press fence's back door: a slot refund
      beside a press settlement pays one failure twice.
    */
    chargeIsExpected: options.chargeIsExpected ?? false,
  });
}

/**
 * The press's words (#1903, the flat price).
 *
 * ⚠ **A PRESS SPEAKS ABOUT THE WHOLE ASK, not about one view**, which is
 * the one place its sentences differ from the slot's above. It is only ever
 * read when NOTHING arrived — a press that delivered anything keeps its
 * charge and is sealed as a success — so the paid sentence can say so
 * plainly.
 */
export const PACKAGE_REDO_PRESS_RECOVERY_WORDING: ViewReplacementWording = {
  refundDescription: "No views arrived when you asked for all of them again",
  paidSentence: "None of the views arrived when you asked for them again. Your credits are back.",
  freeSentence: "None of the views arrived when you asked for them again. You were not charged.",
};

/**
 * THE SWEEP'S HALF OF A FLAT-PRICED PRESS — one charge, and credits back only
 * when nothing could be delivered at all (#1903; **#1968 reuses this**).
 *
 * ⚠ **THE ADJUDICATOR DOES NOT KNOW WHICH ROAD IT IS SETTLING, and that is
 * the point of routing a second road through it.** What it does is fixed: read
 * the ledger under this operation's charge reference, ask ONE injected question
 * — did anything land — and refund the whole charge exactly once if the answer
 * is no. The only things a road supplies are that reader and its own sentences.
 *
 * So the redo and the Sign cannot come to disagree about his rule: there is one
 * implementation of it — {@link flatPressRefundOwed} — and BOTH the live
 * services and this sweep's own adjudicator ask it. ⚠ **That was not true
 * until #1903's review finding 2**: this road passed through to a
 * `landed ? keep : refund` written out again inside `adjudicate`, which
 * agreed with the helper by inspection rather than by construction.
 *
 * ⚠ **AND ITS PARAMETER IS `FlatPressOperation`, NOT THE TRY AGAIN'S TYPE** —
 * same declaration, road-neutral name, so #1968's Sign can settle its press
 * here without importing a vocabulary that does not describe it. A caller who
 * finds the shape wrong for their road writes a second adjudicator, and a
 * second adjudicator is the one thing this module exists to prevent.
 *
 * ⚠ **`landed` IS NOT OPTIONAL HERE.** The default reader asks about ONE
 * operation, and a press has no picture of its own — falling back to it would
 * refund every press that ever ran, including the ones that delivered
 * everything.
 */
export async function recoverFlatPressCharge(
  operation: FlatPressOperation,
  options: ViewRetryRecoveryDependencies & {
    landed: NonNullable<ViewRetryRecoveryDependencies["landed"]>;
  },
): Promise<ViewRetryRecoveryOutcome> {
  return recoverCastingV2ViewRetryOperation(operation, options);
}

/**
 * The whole-package redo's press, as the sweep meets it (#1903).
 *
 * A named entry point rather than a flag at the dispatch, so the recovery table
 * reads as what it is: one money row per press, settled by the shared
 * flat-price adjudication, with the redo's own words.
 */
export async function recoverCastingV2PackageRedoPressOperation(
  operation: RecoverableViewRetryOperation,
  options: ViewRetryRecoveryDependencies = {},
): Promise<ViewRetryRecoveryOutcome> {
  return recoverFlatPressCharge(operation, {
    ...options,
    wording: options.wording ?? PACKAGE_REDO_PRESS_RECOVERY_WORDING,
    landed: options.landed ?? (async (input) => pressViewLanded({
      userId: input.userId,
      modelId: input.modelId,
      pressOperationId: input.operationId,
    })),
  });
}

async function adjudicate(
  operation: RecoverableViewRetryOperation,
  options: ViewRetryRecoveryDependencies,
): Promise<ViewRetryRecoveryOutcome> {
  const db = await getDb();
  if (!db) {
    return {
      type: "recovery_required",
      reason: "database unavailable during recovery",
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    };
  }

  /*
    THE LEDGER FIRST, AND BOTH REFERENCES IN ONE STATEMENT.

    Read prior refunds; never re-issue one to find out whether it landed. The
    references are derived through the shared helpers rather than typed here,
    because the live road and this one must produce byte-identical strings or
    the ledger's uniqueness stops making a repeat harmless.
  */
  const chargeReference = operationChargeReference(operation.id);
  const refundReference = refundReferenceFor(chargeReference);
  const rows = await db
    .select()
    .from(creditTransactions)
    .where(and(
      eq(creditTransactions.userId, operation.userId),
      inArray(creditTransactions.referenceId, [chargeReference, refundReference]),
    ));

  const charged = rows
    .filter((row) => row.referenceId === chargeReference && row.type === "generation")
    .reduce((sum, row) => sum + Math.abs(row.amount), 0);
  const alreadyRefunded = rows
    .filter((row) => row.referenceId === refundReference && row.type === "refund" && row.amount > 0)
    .reduce((sum, row) => sum + row.amount, 0);

  /*
    ⚠ **A CHARGE ON A ROW THAT CANNOT BE CHARGED IS PARKED, NEVER REFUNDED
    (#1903 review finding, "the per-slot refund branch still lives").**

    Under the flat price a redo's five slot rows plan 0 and settle 0/0: the
    money is on the press. So a charged slot is not an edge case of this road,
    it is **evidence that something happened which this road cannot produce** —
    and the one thing never to do with money you cannot explain is move it. A
    refund here would be the back door the press fence above was just built to
    close: hand back a slot's worth of credits against a press that has its own
    settlement, and the two roads pay for one failure twice.

    `chargeIsExpected` is declared per road rather than inferred, because
    inferring it is the same mistake one level up: the Try again's charge is
    perfectly ordinary and must keep refunding exactly as it does.
  */
  if (charged > 0 && options.chargeIsExpected === false) {
    log.error(
      { operationId: operation.id, modelId: operation.modelId, charged },
      "[viewRetryRecovery] a row that cannot be charged carries a charge — parking for support",
    );
    return {
      type: "recovery_required",
      reason: "charged on a road whose rows settle at zero — the money is on another row",
      chargedCredits: charged,
      refundedCredits: alreadyRefunded,
    };
  }

  if (operation.modelId === null) {
    /*
      The Cast is bound at the claim, before any money moves, so a charged
      operation with no Cast is a shape this road does not produce. Park it
      rather than refund it: a refund here would be issued without ever having
      asked whether a picture landed.

      ⚠ With NO charge there is nothing to park over and nothing to ask: no
      Cast means no asset rows to read, and the ledger is already empty. That
      closes free, exactly as it did before the landed read moved below.
    */
    if (charged === 0) {
      return { type: "free_failure", reason: "no charge on the ledger, and no Cast to ask about" };
    }
    return {
      type: "recovery_required",
      reason: "charged with no Cast bound — cannot ask whether a view landed",
      chargedCredits: charged,
      refundedCredits: alreadyRefunded,
    };
  }

  const landed = await (options.landed ?? retriedViewLanded)({
    userId: operation.userId,
    modelId: operation.modelId,
    operationId: operation.id,
  });
  /*
    ⚠ **A PICTURE THAT LANDED IS A SUCCESS EVEN WHEN NOTHING WAS CHARGED
    (#1903 review finding, "false receipt").**

    The ledger used to be consulted first: `charged === 0` returned
    `free_failure` before anything asked whether a picture had arrived. So a
    free ask that DID deliver and then crashed was sealed *"That view didn't
    arrive… You were not charged"* — a sentence that is wrong about the only
    thing the customer can see, while being right about the money.

    ⚠ **The flat price makes this the redo's ORDINARY road rather than an edge
    case, which is why it moved now.** A redo's slots charge nothing by
    design, so *every* slot swept after a crash took the free branch — and the
    ones that had already committed their picture were told it never came.

    The money answer does not change: nothing was charged, so nothing goes
    back, and `chargedCredits: 0` is what the receipt carries. Only the story
    changes, and it changes to the true one.

    A landed picture is necessarily `running` — the commit's own fence demands
    it — so sealing this as a success cannot meet the `claimed` finalizer.
  */
  if (charged === 0) {
    return landed
      ? { type: "durable_success", chargedCredits: 0 }
      : { type: "free_failure", reason: "no charge on the ledger" };
  }

  /*
    ⚠ **THE RULE IS ASKED HERE, NOT RESPELLED (#1903 review finding 2).**

    This function used to carry its own `landed ? keep : refund`, and the live
    services carry {@link flatPressRefundOwed}. The two agreed — and two
    spellings of one founder ruling on a money path can only ever come to
    disagree, which is a customer refunded twice or not at all depending on
    whether her press died. The relay's finding named it before it drifted,
    which is the cheapest moment there is.

    So there is now ONE definition of "what does a flat-priced ask owe back",
    and both the process that still has its renders in hand and the sweep that
    meets the rows hours later read it from the same place. **#1968's Sign
    calls it too**, which is the whole reason it is a module.

    It is right for the Try again as well, and that is not a coincidence being
    exploited: a Try again is a flat-priced ask with exactly one unit, so
    "credits back only if nothing could be delivered" IS its rule. Behaviour
    is unchanged in every arm — `charged` is already proven non-zero above, so
    the helper returns 0 exactly when a picture landed and `charged` exactly
    when none did.
  */
  const refundOwed = flatPressRefundOwed({
    chargedCredits: charged,
    delivered: landed ? 1 : 0,
  });

  if (refundOwed <= alreadyRefunded) {
    /*
      Nothing further is owed — but by two different roads, and the customer
      reads a different sentence on each, so the STORY is still chosen by
      whether a picture landed rather than by the arithmetic:

      - it landed: she asked, she received, she paid once. His rule exactly.
      - it did not: the service refunded and then died before its receipt.
        The money is already back; only the row was left open.
    */
    return landed
      ? { type: "durable_success", chargedCredits: charged }
      : { type: "paid_failure", chargedCredits: charged, refundedCredits: alreadyRefunded };
  }

  const owed = refundOwed - alreadyRefunded;
  const wording = options.wording ?? VIEW_RETRY_RECOVERY_WORDING;
  const refund = await (options.refund ?? recordRefund)(
    operation.userId,
    owed,
    wording.refundDescription,
    chargeReference,
  );
  if (!refund.recorded) {
    log.error(
      { operationId: operation.id, modelId: operation.modelId },
      "[viewRetryRecovery] refund did not record — parking for support",
    );
    return {
      type: "recovery_required",
      reason: "the refund did not record",
      chargedCredits: charged,
      refundedCredits: alreadyRefunded,
    };
  }
  return {
    type: "paid_failure",
    chargedCredits: charged,
    refundedCredits: alreadyRefunded + refund.amount,
  };
}

async function seal(
  operation: RecoverableViewRetryOperation,
  outcome: ViewRetryRecoveryOutcome,
  options: ViewRetryRecoveryDependencies,
): Promise<ViewRetryRecoveryOutcome> {
  // The sweep writes its own recovery_required receipt for this case.
  if (outcome.type === "recovery_required") return outcome;

  const finalizeSuccess = options.finalizeSuccess ?? finalizeGenerationOperationSuccess;
  const finalizeFailure = options.finalizeFailure ?? finalizeGenerationOperationFailure;
  const finalizeClaimedFailure = options.finalizeClaimedFailure
    ?? finalizeClaimedGenerationOperationFailure;
  /* The customer's words, per road. Read here as well as in the adjudicator
     because the sentence the receipt carries is sealed in this function and the
     refund description is written in that one. */
  const wording = options.wording ?? VIEW_RETRY_RECOVERY_WORDING;

  try {
    if (outcome.type === "durable_success") {
      await finalizeSuccess({
        userId: operation.userId,
        operationId: operation.id,
        result: { outcome: "ready", recovered: true },
        chargedCredits: outcome.chargedCredits,
        refundedCredits: 0,
        terminalStatus: "succeeded",
      });
      return outcome;
    }
    if (outcome.type === "paid_failure") {
      await finalizeFailure({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "PRECONDITION_FAILED",
        publicMessage: wording.paidSentence,
        chargedCredits: outcome.chargedCredits,
        refundedCredits: outcome.refundedCredits,
      });
      return outcome;
    }
    /*
      free_failure: a crash before the charge leaves the operation `claimed` or
      `running`, and those take different finalizers.
    */
    if (operation.status === "claimed") {
      await finalizeClaimedFailure({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "PRECONDITION_FAILED",
        publicMessage: wording.freeSentence,
      });
    } else {
      await finalizeFailure({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "PRECONDITION_FAILED",
        publicMessage: wording.freeSentence,
        chargedCredits: 0,
        refundedCredits: 0,
      });
    }
    return outcome;
  } catch (error) {
    log.error(
      { operationId: operation.id, outcome: outcome.type, err: error },
      "[viewRetryRecovery] adjudication settled but the receipt did not seal",
    );
    return {
      type: "recovery_required",
      reason: "receipt did not seal after adjudication",
      chargedCredits: "chargedCredits" in outcome ? outcome.chargedCredits : 0,
      refundedCredits: "refundedCredits" in outcome ? outcome.refundedCredits : 0,
    };
  }
}
