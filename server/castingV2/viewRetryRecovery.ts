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
import {
  pressViewLanded,
  readPressRefusedSheetRefund,
  retriedViewLanded,
  viewReplacementInFlight,
} from "../db/castingV2ViewRetry";
import { getDb } from "../db/connection";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/viewRetryRecovery");

export type ViewRetryRecoveryOutcome =
  /**
   * A picture landed. `refundedCredits` is present only when something WAS
   * given back beside it — a Regenerate's shares for a refused sheet (#2133) —
   * so the receipt the sweep seals carries the money that actually moved.
   */
  | { type: "durable_success"; chargedCredits: number; refundedCredits?: number }
  | { type: "paid_failure"; chargedCredits: number; refundedCredits: number }
  /** Terminal, and the user was never charged — so nothing is owed back. */
  | { type: "free_failure"; reason: string }
  /**
   * NOT SETTLED, AND NOT A FAILURE — the row is left exactly as it was found
   * (#1903 review finding, the sweep side of B1).
   *
   * ⚠ **IT IS NOT `recovery_required`, AND THE DIFFERENCE IS THE WHOLE POINT.**
   * `recovery_required` means *a human must look*, and the sweep never returns
   * to one. This means *ask again in a few minutes*: the work is still
   * happening, the sweep simply arrived before it could be judged. Parking a
   * healthy press for support would turn a transient heartbeat failure into a
   * support ticket per redo.
   *
   * Nothing is written on this road — no refund, no receipt, no status change —
   * so it is safe to return it from anywhere above the money.
   */
  | { type: "deferred"; reason: string }
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
  /**
   * CAN A PICTURE STILL ARRIVE UNDER THIS OPERATION? — asked BEFORE the ledger
   * is acted on, and the sweep side of #1903's review finding B1.
   *
   * ⚠ **ABSENT MEANS "DO NOT ASK", WHICH IS EVERY ROAD'S BEHAVIOUR BEFORE
   * THIS EXISTED.** Only a road that can tell the difference supplies it: the
   * flat-priced press can, because its pictures land under rows it does not
   * own. The Try again cannot — the row that would have to be fenced is the
   * one being adjudicated, and the answer about itself is always yes.
   *
   * ⚠ **SO THE TRY AGAIN IS FENCED ON THE COMMIT SIDE INSTEAD (#2073), and it
   * needs no reader here.** The sweep's claim stamps `recoveryAttemptedAt`
   * before this adjudicator reads anything, and `commitRetriedViewAsset`
   * refuses an operation that carries the stamp, under the same row lock. So
   * by the time the landed read below runs, every picture that will ever land
   * under this operation already has — the read is complete rather than a
   * snapshot of a moving world. #1924 named the Sign's fenced-status machinery
   * as the repair; the claim is a fence that already existed and did not need
   * a new status, a fenced finalizer or a widened sweep selection.
   *
   * `true` leaves the operation untouched for the next sweep pass. It is not a
   * refusal and not a failure: the lease lapsed, the work did not.
   */
  stillArriving?: (input: {
    userId: number;
    modelId: number;
    operationId: string;
  }) => Promise<boolean>;
  /**
   * WHAT IS OWED BACK WHEN SOMETHING DID LAND — asked only then (#2133).
   *
   * ⚠ **ABSENT MEANS ZERO, WHICH IS HIS FLAT RULE AND EVERY ROAD'S ANSWER
   * BEFORE THIS EXISTED.** Only the Regenerate's press supplies it: #2127
   * refunds one share per view a sheet the image provider refused would have
   * made, and those shares are owed even when the other sheet delivered. The
   * press reads them off its slots' sealed receipts
   * (`readPressRefusedSheetRefund`), the same reading the live process pays
   * from, so the two arrive at one amount under one reference.
   */
  refusedSheetRefund?: (input: {
    userId: number;
    modelId: number;
    operationId: string;
    chargedCredits: number;
  }) => Promise<number>;
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
  /**
   * The description on a refund paid BESIDE a delivery — a Regenerate's
   * refused-sheet shares (#2133). Only a road that supplies
   * `refusedSheetRefund` can reach it.
   */
  readonly refusedSheetRefundDescription?: string;
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
/*
  ⚠ **"Your credits were returned." AND NOT "Your credits are back." — #1940's
  one vocabulary, inherited when `main` merged forward on 2026-10-09.**

  Both of this road's sentences were written on this branch before #1940
  landed, in a spelling that card explicitly retired; its guard
  (`moneyWording1940.test.ts`) names this file and reddened on the merge, which
  is that guard doing exactly what it is for on the first sentences it could
  not have seen.

  ⚠ **AND THE SLOT'S `paidSentence` BELOW IS NOW UNREACHABLE BY
  CONSTRUCTION.** Under the flat price a slot row never carries a charge, so
  the sweep either parks it (a charge it cannot explain) or closes it free.
  It is kept rather than deleted because the three sentences are one type for
  both roads, and the press's own `paidSentence` IS reachable — a total loss.
  Named here so the next reader does not take its presence as evidence that a
  slot can still be refunded.

  ⚠ **THE SLOT SAYS NOTHING ABOUT MONEY, AND THAT IS THE #1903 REVIEW'S
  FINDING RATHER THAN A STYLE CHOICE.** `freeSentence` read *"You were not
  charged."* — true of the slot ROW, which settles at 0/0, and false of what
  the customer did: she paid 3,250 for the press. It is the same class this PR
  fixed on the partial-failure toast, one road further in, and the repair is
  the same one: remove the money claim rather than reword it. **The division
  is now clean — a slot speaks about a picture, the press row speaks about the
  money** — and it holds for both of the slot's terminal sentences.

  ⚠ **AND IT IS A LATENT LIE RATHER THAN A LIVE ONE — read at the code before
  it was changed, because that decides whether this is a customer bug or
  housekeeping.** The ONLY customer-facing reader of a generation operation's
  `publicMessage` is `castingV2Variants.ts`'s settled-failure read, which
  INNER JOINs `castingCandidateVariants` on `operationId`; a redo slot creates
  no variant, so it can never be selected. Every other reader of these rows is
  internal — the deletion guard, the recovery sweep, this module. **Nobody has
  been told this.** Said as a FLOOR: one derived read of today's readers, not a
  proof that no future surface will show a slot's receipt — which is exactly
  why the sentence is made honest now rather than left for that surface to
  find.
*/
export const PACKAGE_REDO_RECOVERY_WORDING: ViewReplacementWording = {
  refundDescription: "That view didn't arrive when you asked for all the views again",
  /*
    ⚠ **NO MONEY CLAUSE ON ANY OF THE THREE, which is one sentence further than
    the review asked and the arm that found it is why.** The finding named
    `freeSentence`; an arm asserting the slot makes no money claim then caught
    `paidSentence` saying *"Your credits were returned."* — the same defect, one
    line down, on a sentence the comment above correctly calls unreachable.

    Leaving it on the unreachable one would have made the guard depend on
    reachability, which is a claim that has to be re-proved every time this road
    changes. All three are money-free instead, so the division holds whatever
    becomes reachable: a slot speaks about a picture, the press speaks about the
    credits.
  */
  paidSentence: "That view didn't arrive when you asked for all the views again.",
  freeSentence: "That view didn't arrive when you asked for all the views again.",
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
 * THE TWO LEDGER DESCRIPTIONS A REGENERATE'S PRESS REFUND CAN CARRY — said
 * once here, written by both the live press (`packageRedoService.ts`) and this
 * sweep (#2133), so a refund reads the same whichever of them paid it.
 */
export const PACKAGE_REDO_NOTHING_ARRIVED_REFUND_DESCRIPTION =
  "No views arrived when you asked for all of them again";
export const PACKAGE_REDO_REFUSED_SHEET_REFUND_DESCRIPTION =
  "Some views didn't arrive when you asked for all of them again";

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
  refundDescription: PACKAGE_REDO_NOTHING_ARRIVED_REFUND_DESCRIPTION,
  refusedSheetRefundDescription: PACKAGE_REDO_REFUSED_SHEET_REFUND_DESCRIPTION,
  paidSentence: "None of the views arrived when you asked for them again. Your credits were returned.",
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
  /*
    ⚠ **THE PRESS'S OWN REQUEST ID IS REQUIRED (#2133)** — its slots are
    claimed under ids derived from it, and the refused-sheet read below finds
    them by that derivation. The sweep spreads the whole operation row in, so
    the field is already there; the type makes a caller that drops it a
    compile error rather than a press whose shares read as zero.
  */
  operation: RecoverableViewRetryOperation & { clientRequestId: string },
  options: ViewRetryRecoveryDependencies = {},
): Promise<ViewRetryRecoveryOutcome> {
  return recoverFlatPressCharge(operation, {
    ...options,
    /*
      ⚠ **THE SHARES A REFUSED SHEET IS OWED, READ OFF THE SLOTS' SEALED
      RECEIPTS (#2133).** A press that died after a sheet was refused twice and
      after another view landed used to be settled here as "something landed,
      nothing owed" — the refusal lived only in the dead process's memory. The
      refused slot now writes it on its own receipt, and this reads it with the
      same derivation the live press pays from, so a press the live process
      already refunded reads as already paid and a press it did not is paid
      here, once, under the press's own reference.
    */
    refusedSheetRefund: options.refusedSheetRefund ?? (async (input) => (
      await readPressRefusedSheetRefund({
        userId: input.userId,
        modelId: input.modelId,
        pressClientRequestId: operation.clientRequestId,
        chargedCredits: input.chargedCredits,
      })
    ).owed),
    wording: options.wording ?? PACKAGE_REDO_PRESS_RECOVERY_WORDING,
    landed: options.landed ?? (async (input) => pressViewLanded({
      userId: input.userId,
      modelId: input.modelId,
      pressOperationId: input.operationId,
    })),
    /*
      ⚠ **THE ONE ROAD THAT CAN ANSWER IT, SO THE ONLY ONE THAT ASKS (#1903
      review finding, the sweep side of B1).** A press's pictures land under
      rows it does not own, so "is anything still coming" is a question about
      OTHER operations — which is exactly why it can be asked at all, and
      exactly why the Try again cannot ask it about itself.
    */
    stillArriving: options.stillArriving ?? (async (input) => viewReplacementInFlight({
      userId: input.userId,
      modelId: input.modelId,
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

  /*
    ⚠ **NOTHING IS SETTLED WHILE A PICTURE CAN STILL ARRIVE (#1903 review
    finding, the sweep side of B1) — and this is checked BEFORE the landed
    read, not after it.**

    The read below is a plain, unlocked select. On the flat-price road that
    made the whole adjudication a check-then-write race: the press's lease
    lapses while its slots are alive, the sweep sees nothing committed YET,
    records the refund, and seals the press failed — and the slots, which fence
    on the press being `running` and so were admitted all along, commit
    afterwards. The customer keeps the new views AND the 3,250. A slot
    transaction holding the press row lock with an uncommitted asset is
    invisible to this read by ordinary isolation, so it needs no timing luck.

    ⚠ **IT GUARDS BOTH DIRECTIONS, which is why it sits above the fork rather
    than beside the refund.** Sealing the press SUCCEEDED early is the mirror
    harm and is not hypothetical: a success also moves the press out of
    `running`, so every slot still rendering would then be fenced out and its
    picture thrown away — the customer rightly charged, and short the views she
    paid for.

    ⚠ **DEFERRING IS NOT PARKING.** The row is left exactly as found and the
    next sweep pass asks again (`claimRecoveryAttempt` has already stamped
    `recoveryAttemptedAt`, so that is ~5 minutes away). It converges in every
    case: if the process is alive it settles the press itself; if it is dead
    the slots' own leases lapse, their own recovery makes them terminal, and
    the pass after that settles the press here.
  */
  if (options.stillArriving) {
    const arriving = await options.stillArriving({
      userId: operation.userId,
      modelId: operation.modelId,
      operationId: operation.id,
    });
    if (arriving) {
      return {
        type: "deferred",
        reason: "a view of this Cast can still arrive — nothing is settled yet",
      };
    }
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
  /*
    ⚠ **AND THE ONE AMENDMENT, WHEN SOMETHING LANDED (#2133).** His flat rule
    owes nothing back once a picture arrived, except #2127's shares for views a
    sheet the image provider refused would have made. Only the Regenerate's
    press supplies the reader; every other road gets zero, which is the flat
    rule exactly. A total loss never asks it: the whole charge is owed, and the
    shares are inside that whole rather than on top of it.
  */
  const refundOwed = landed && options.refusedSheetRefund
    ? await options.refusedSheetRefund({
        userId: operation.userId,
        modelId: operation.modelId,
        operationId: operation.id,
        chargedCredits: charged,
      })
    : flatPressRefundOwed({
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
    /*
      - it landed and the live press already paid a refused sheet's shares
        (#2133): the receipt says so, rather than reading as nothing back.
    */
    return landed
      ? {
          type: "durable_success",
          chargedCredits: charged,
          ...(alreadyRefunded > 0 ? { refundedCredits: alreadyRefunded } : {}),
        }
      : { type: "paid_failure", chargedCredits: charged, refundedCredits: alreadyRefunded };
  }

  /*
    ⚠ **ONE REFERENCE, AND IT IS WHAT MAKES A SECOND PAYER HARMLESS (#2133).**
    The live press pays its refund under this same reference, with an amount
    taken from the same reading. So if it pays between this read and this
    write, the write below is a ledger duplicate, never a second refund; and an
    amount that disagreed would be refused by the ledger and parked below,
    never paid on top. That is why this road needs no re-read after a fence,
    where the Sign (whose shares sit under per-slot references) did.
  */
  const owed = refundOwed - alreadyRefunded;
  const wording = options.wording ?? VIEW_RETRY_RECOVERY_WORDING;
  const refund = await (options.refund ?? recordRefund)(
    operation.userId,
    owed,
    landed
      ? wording.refusedSheetRefundDescription ?? wording.refundDescription
      : wording.refundDescription,
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
  /*
    Something landed and only the refused-sheet shares came back: the press
    DELIVERED, so it is sealed as a success carrying the refund, not as a
    failure that would tell the customer none of the views arrived.
  */
  if (landed) {
    return {
      type: "durable_success",
      chargedCredits: charged,
      refundedCredits: alreadyRefunded + refund.amount,
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
  /* Nothing is sealed, because nothing was decided: the row is left running
     for the next pass (#1903 review finding). Returning before the finalizers
     is the whole of it — there is no receipt to write for "ask me later". */
  if (outcome.type === "deferred") return outcome;

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
        refundedCredits: outcome.refundedCredits ?? 0,
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
      refundedCredits: "refundedCredits" in outcome ? outcome.refundedCredits ?? 0 : 0,
    };
  }
}
