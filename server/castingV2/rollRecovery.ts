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
import {
  ROLL_CANCEL_REFUND_DESCRIPTION,
  ROLL_UNSEEN_REFUND_DESCRIPTION,
  rollSliceRefundDescription,
} from "./sliceRefundLedger";

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
 *    One more torn write sits on the other side of that line (#868): a row the
 *    live catch marked `failed` and then died before its refund recorded. The
 *    row IS settled — no CAS, nothing to claim — but the money is not, and the
 *    ledger alone can say so. `isTornFailure` is that reading; it pays the
 *    slice once under the reference the live catch would have used.
 *
 *    And the same reading is owed to a row that becomes `failed` while this
 *    sweep is mid-loop (#896). Losing the CAS says another process moved the
 *    row; it does not say that process finished. Those rows are collected and
 *    re-asked of a FRESH snapshot before the receipt is sealed, because the
 *    `torn` set was derived from the stale one and can never contain them.
 *
 *    The cancel has the same two writes in the same order (#955): `cancelRoll`
 *    CASes a `queued` row to `cancelled` and THEN records its refund. So a
 *    `cancelled` row is torn on exactly the terms a `failed` one is, and
 *    `isTornCancel` is the same reading of the same ledger — at the snapshot
 *    and at the lost-claim re-read alike.
 *
 *    And the landing into a cancelled roll has them too (#994): `landCandidate`
 *    writes `expired` with `expiredReason = 'cancelled_unseen'` in one
 *    statement and the generosity refund follows as a second write.
 *    `isTornUnseen` reads that row by its reason — never by `expired` alone,
 *    which the retention sweep also writes — under the unseen reference.
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

/**
 * The receipt's own sentences, exported so the LIVE road (#855) can throw the
 * words it just sealed: a mutation saying one thing while the receipt it wrote
 * says another is the mismatch `refineService`'s "MATCH the number beside it"
 * comment exists to forbid.
 */
export const ROLL_RECOVERY_SENTENCE = {
  didNotFinish: "The sheet didn't finish. Everything that didn't arrive was refunded.",
  didNotStart: "The sheet didn't start. You were not charged.",
  supportReview: (operationId: string) =>
    `This operation needs support review before it can be retried. Operation ${operationId}.`,
} as const;

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
 * candidate was delivered and then thrown away by its owner. A signed one
 * became a Cast. Neither is owed anything, and an adjudicator that reasoned
 * "not landed ⇒ refund" would hand money back for both the moment a lease
 * lapsed.
 *
 * `expired` sits here for a different reason, and it is worth stating because
 * the law behind it changed. Since the generosity ruling (2026-07-31) a
 * candidate that lands after a cancel IS refunded — but at the landing site,
 * under its own reference, by the code that knows it landed unseen. This sweep
 * must still keep its hands off, because `expired` is an overloaded status:
 * the 7-day retention sweep also writes it, over candidates the user looked at
 * for a week. Refunding on the strength of the status alone would pay people
 * back for work they received, which is exactly what the sweep correction
 * (44748ae5) forbade.
 *
 * ⚠ **That overload ended with migration 0018, and this paragraph said it was
 * still scheduled until #994.** `expiredReason` separates the two meanings, and
 * `landCandidate` writes it in the same statement as the status. So this
 * function is no longer the last word on the MONEY of an `expired` row:
 * `isTornUnseen` pays a `cancelled_unseen` slice whose refund never wrote.
 *
 * What stays here is the CLASSIFICATION, deliberately unchanged. An unseen
 * landing is a finished render, and whether a cancelled roll's recovery receipt
 * reads as partial or failed is a question about the sentence the customer
 * sees, not about money — a different change from #994's.
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
/** Exported so the deploy-collision assertion tests the REAL predicate. */
export function isSettleable(candidate: CandidateRow): boolean {
  if (candidate.status === "queued" || candidate.status === "dispatched") return true;
  return candidate.status === "ready" && !candidate.imageKey;
}

/**
 * The torn write inside the live catch (#868).
 *
 * `dispatchCandidate`'s catch writes `failed` and THEN records the refund. A
 * dropped connection or a process death between the two leaves a `failed`
 * row whose slice was never paid back — and `isSettleable` is right not to
 * count it, because "already settled by whoever put it in that state" is
 * what `failed` means for the CAS. Whether the MONEY landed is a different
 * question, and only the ledger can answer it: a `failed` row that was
 * charged for and has no refund row under its own reference is owed once.
 *
 * This is the retry adjudicator's rule (`retryRecovery.ts`: *already `failed`
 * means the service settled it and died after; the ledger decides whether the
 * refund landed, and pays it once if not*), held to on the roll's side. No CAS
 * is needed — the row is already terminal — and the refund reference is the
 * one the live catch would have used, so a live process racing this refund
 * lands as the ledger's duplicate, never as a second payment.
 */
export function isTornFailure(
  candidate: CandidateRow,
  ledger: Pick<OperationLedger, "refundedReferences">,
  operationId: string,
): boolean {
  return (
    candidate.status === "failed"
    && candidate.pointsCost > 0
    && !ledger.refundedReferences.has(candidateRefundReference(operationId, candidate.publicId))
  );
}

/**
 * The torn write inside the cancel (#955) — `isTornFailure`'s sibling, not a
 * second policy.
 *
 * `cancelRoll` CASes a `queued` row to `cancelled` and then records the
 * refund. A process death between the two leaves the row terminal and the
 * slice charged, and until this reading nothing could see it: `isSettleable`
 * excludes `cancelled` (correctly, for the CAS), `isTornFailure` asked only
 * about `failed`, and `wasDelivered` does not name it — so the slice sat in no
 * set at all.
 *
 * Only `queued` rows are ever cancelled, so a `cancelled` row never reached
 * the provider and cannot have been delivered; the one question is the money,
 * and the ledger answers it under the reference the cancel itself uses. The
 * charge gate has already run by the time this is asked, so a cancel that beat
 * the deduct is never paid from here.
 */
export function isTornCancel(
  candidate: CandidateRow,
  ledger: Pick<OperationLedger, "refundedReferences">,
  operationId: string,
): boolean {
  return (
    candidate.status === "cancelled"
    && candidate.pointsCost > 0
    && !ledger.refundedReferences.has(candidateRefundReference(operationId, candidate.publicId))
  );
}

/**
 * The torn write inside the unseen landing (#994) — the third sibling.
 *
 * A tile already with the provider when its roll was cancelled runs to the
 * end and lands `expired`; the generosity ruling (2026-07-31) pays it back
 * under its own `:unseen` reference, as a second write after the landing. A
 * process death between the two left the slice charged, and the sweep could
 * not see it: `expired` was also what the retention sweep writes over tiles the
 * customer looked at for a week.
 *
 * ⚠ **It asks the REASON, never the status alone.** `expiredReason` is written
 * in the landing's own statement (migration 0018), so `cancelled_unseen` is
 * exactly the landing that owes the refund. `retention` is delivered work, and
 * a NULL reason is a row that predates the column: both stay unpaid, because a
 * status alone is precisely the reading the sweep correction (44748ae5)
 * forbade.
 */
export function isTornUnseen(
  candidate: CandidateRow,
  ledger: Pick<OperationLedger, "refundedReferences">,
  operationId: string,
): boolean {
  return (
    candidate.status === "expired"
    && candidate.expiredReason === "cancelled_unseen"
    && candidate.pointsCost > 0
    && !ledger.refundedReferences.has(candidateUnseenRefundReference(operationId, candidate.publicId))
  );
}

/** Any torn write: settled on the row, never paid on the ledger. */
function isTornSettlement(
  candidate: CandidateRow,
  ledger: Pick<OperationLedger, "refundedReferences">,
  operationId: string,
): boolean {
  return (
    isTornFailure(candidate, ledger, operationId)
    || isTornCancel(candidate, ledger, operationId)
    || isTornUnseen(candidate, ledger, operationId)
  );
}

/**
 * The one place a settled row's refund is named: which charge reference it is
 * returned under, and the sentence the customer reads beside it. The live
 * writers use the same pair, so a late refund from a process that was only slow
 * lands as the ledger's duplicate, never a second payment.
 */
function sliceRefund(
  candidate: CandidateRow,
  operationId: string,
): { chargeReference: string; description: string } {
  if (candidate.status === "expired") {
    return {
      chargeReference: candidateUnseenChargeReference(operationId, candidate.publicId),
      description: ROLL_UNSEEN_REFUND_DESCRIPTION,
    };
  }
  return {
    chargeReference: candidateChargeReference(operationId, candidate.publicId),
    description: candidate.status === "cancelled"
      ? ROLL_CANCEL_REFUND_DESCRIPTION
      : rollSliceRefundDescription(candidate.failureClass),
  };
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
 * The generosity slice: a candidate that was dispatched when its roll was
 * cancelled, ran to completion, and landed `expired` — generated, paid for,
 * and never shown to anyone.
 *
 * It refunds under a reference of its own (founder ruling, 2026-07-31) so the
 * ledger can tell "we failed you" apart from "you cancelled and we ate the
 * cost". The COGS is real and absorbed; the credits go back because the
 * product promise is *cancel refunds everything you haven't seen*, and no
 * abuse vector follows from it — an expired candidate is never projected, so
 * nobody can cancel their way to free images.
 */
export function candidateUnseenChargeReference(
  operationId: string,
  candidatePublicId: string,
): string {
  return `${candidateChargeReference(operationId, candidatePublicId)}:unseen`;
}

export function candidateUnseenRefundReference(operationId: string, candidatePublicId: string): string {
  return refundReferenceFor(candidateUnseenChargeReference(operationId, candidatePublicId));
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
  /**
   * The per-candidate refund references that hold a refund row — the SAME rows
   * `alreadyRefunded` sums, kept by identity so the adjudicator can ask of one
   * `failed` candidate "did its refund land?" rather than only "how much came
   * back in total?" (#868). A sum cannot tell a torn write from a settled one.
   */
  refundedReferences: ReadonlySet<string>;
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
/** Exported for the retry adjudicator (`retryRecovery.ts`), which reads ONE row with the same rule. */
export async function readOperationLedger(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  operation: { id: string; userId: number },
  candidates: readonly CandidateRow[],
): Promise<OperationLedger> {
  const chargeReference = operationChargeReference(operation.id);
  /*
    Both references a slice can be returned under (#994). The `:unseen` one was
    missing, so a generosity refund that DID land was left out of
    `alreadyRefunded` — out of the conservation ceiling and out of recovery's
    receipt, while the live receipt counted it — and one that did NOT land could
    never be told from one that did.
  */
  const refundReferences = new Set(
    candidates.flatMap((candidate) => [
      candidateRefundReference(operation.id, candidate.publicId),
      candidateUnseenRefundReference(operation.id, candidate.publicId),
    ]),
  );

  const rows = await db
    .select()
    .from(creditTransactions)
    .where(and(
      eq(creditTransactions.userId, operation.userId),
      inArray(creditTransactions.referenceId, [chargeReference, ...Array.from(refundReferences)]),
    ));

  const chargeRows = rows.filter((row) => row.referenceId === chargeReference);
  // Re-pinned to the reference set rather than "anything that is not the
  // charge", so the sum cannot quietly depend on the WHERE having been applied.
  const refundRows = rows.filter(
    (row) =>
      row.referenceId !== null
      && refundReferences.has(row.referenceId)
      && row.type === "refund"
      && row.amount > 0,
  );
  const alreadyRefunded = refundRows.reduce((sum, row) => sum + row.amount, 0);
  // The WHERE above pins every row to a known reference, so a null here is
  // unreachable; the filter is for the type, not the data.
  const refundedReferences: ReadonlySet<string> = new Set(
    refundRows.map((row) => row.referenceId).filter((reference): reference is string => reference !== null),
  );

  if (chargeRows.length === 0) {
    return { charge: { kind: "not_charged" }, alreadyRefunded, refundedReferences };
  }
  if (chargeRows.length > 1) {
    return {
      charge: { kind: "ambiguous", reason: "duplicate charge rows for one operation" },
      alreadyRefunded,
      refundedReferences,
    };
  }
  const [charge] = chargeRows;
  if (charge.type !== "generation" || charge.amount >= 0) {
    return {
      charge: { kind: "ambiguous", reason: "charge reference holds a non-charge ledger row" },
      alreadyRefunded,
      refundedReferences,
    };
  }
  return {
    charge: { kind: "charged", credits: Math.abs(charge.amount) },
    alreadyRefunded,
    refundedReferences,
  };
}

/**
 * THE CANCEL'S REFUNDS, READ AT THE LIVE SEAL (#994) — `isTornCancel`'s rule,
 * asked by `createRoll` before it writes the receipt.
 *
 * The receipt used to add up the `cancelled` ROWS and call that refunded. A row
 * says the cancel won its CAS; it cannot say the refund after it recorded. And
 * the live seal is the LAST reader of this operation: once `createRoll` writes
 * the receipt, the operation is terminal and recovery never sees it. So a cancel
 * whose `recordRefund` came back `recorded: false` left the slice charged with
 * nothing anywhere left to notice, under a receipt saying it had been returned.
 *
 * So the ledger answers, and a slice it shows unpaid is paid here, once, under
 * the cancel's own reference and in the cancel's words. A cancel that is only
 * SLOW (its CAS won, its refund not yet written) meets this as the ledger's
 * duplicate, and whichever writes second is told `recorded` without a second
 * payment.
 *
 * ⚠ **It fails toward "not refunded".** A ledger it cannot read, or one that
 * shows no charge, counts every cancelled slice as unrecorded: the receipt then
 * quotes the operation for support rather than claiming credits came back that
 * nothing has shown were returned.
 */
export async function settleCancelledSlices(input: {
  userId: number;
  operationId: string;
  candidates: readonly CandidateRow[];
}): Promise<{ refundedCredits: number; unrecorded: number }> {
  const cancelled = input.candidates.filter(
    (candidate) => candidate.status === "cancelled" && candidate.pointsCost > 0,
  );
  if (cancelled.length === 0) return { refundedCredits: 0, unrecorded: 0 };
  const unread = { refundedCredits: 0, unrecorded: cancelled.length };
  const operation = { id: input.operationId, userId: input.userId };

  let ledger: OperationLedger;
  try {
    const db = await getDb();
    if (!db) {
      log.error({ operationId: operation.id }, "[rollRecovery] no database to read the cancel's refunds at the seal");
      return unread;
    }
    ledger = await readOperationLedger(db, operation, cancelled);
  } catch (error) {
    log.error({ operationId: operation.id, err: error }, "[rollRecovery] the cancel's refunds could not be read at the seal");
    return unread;
  }
  if (ledger.charge.kind !== "charged") {
    // The live seal runs only after the deduct succeeded, so this is the
    // sequence broken somewhere. Nothing is paid on a ledger that disagrees.
    log.error(
      { operationId: operation.id, charge: ledger.charge.kind },
      "[rollRecovery] the live seal found no clean charge — cancelled slices left for support",
    );
    return unread;
  }

  let refundedCredits = 0;
  let unrecorded = 0;
  for (const candidate of cancelled) {
    if (!isTornCancel(candidate, ledger, operation.id)) {
      refundedCredits += candidate.pointsCost;
      continue;
    }
    log.warn(
      { operationId: operation.id, candidate: candidate.publicId, slice: candidate.pointsCost },
      "[rollRecovery] a cancelled slice has no refund on the ledger at the seal — paying it",
    );
    const { chargeReference, description } = sliceRefund(candidate, operation.id);
    const outcome = await recordRefund(operation.userId, candidate.pointsCost, description, chargeReference);
    if (outcome.recorded) refundedCredits += outcome.amount;
    else unrecorded += 1;
  }
  return { refundedCredits, unrecorded };
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
        publicMessage: ROLL_RECOVERY_SENTENCE.didNotFinish,
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
        publicMessage: ROLL_RECOVERY_SENTENCE.didNotStart,
      });
    } else {
      await finalizeFailure({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "PRECONDITION_FAILED",
        publicMessage: ROLL_RECOVERY_SENTENCE.didNotStart,
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
  const ledger = await readOperationLedger(db, operation, candidates);
  const { charge, alreadyRefunded } = ledger;
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

  // Charged, settled on the row, and never paid back — the torn write, from
  // the live catch (#868), the cancel (#955) or the unseen landing (#994).
  // Read here, after the charge
  // gate, because "owed" is a question about the ledger and the ledger has
  // only now been read; an unpaid roll fails its rows above and never reaches
  // this line.
  const torn = candidates.filter((candidate) => isTornSettlement(candidate, ledger, operation.id));

  if (owed.length === 0 && torn.length === 0) {
    // Everything landed; the crash was after the last candidate. Nothing owed.
    //
    // `landed` is the SNAPSHOT's count here and that is correct rather than an
    // oversight of #956: an empty `owed` means no row was `queued`, `dispatched`
    // or `ready`-without-key when we looked, so every row was already terminal
    // and nothing can land after. The seal below re-reads because it is reached
    // only when something WAS still in flight.
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
  /**
   * Rows whose CAS we lost (#896). Held rather than dropped: the winner may
   * have died between writing `failed` and recording its refund, which is the
   * one case where "their settlement stands" is false. Re-read once, below.
   */
  const lostClaims: CandidateRow[] = [];

  /**
   * One slice back, under the candidate's own reference. Returns the
   * escalation when the ceiling would be breached; otherwise records the
   * refund (or counts it unrecorded) and returns nothing. Shared by the
   * unfinished rows and the torn ones so the ceiling and the unrecorded
   * count are one rule over both.
   */
  const refundSlice = async (candidate: CandidateRow): Promise<RollRecoveryOutcome | undefined> => {
    const slice = candidate.pointsCost;
    if (slice <= 0) return undefined;
    if (refundedCredits + slice > charge.credits) {
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
    /*
      Composed through the same fork the live writers use, never a constant
      (PR #871 review): a torn `render_fault` row carries its class, and the
      ledger line the customer reads must name the event that happened. An
      unfinished row has no class and lands on `candidateAbsent` as before.
      A torn cancel says what the cancel would have said (#955), and a torn
      unseen landing what the landing would have said, under its own `:unseen`
      reference (#994) — the customer cancelled both, and "did not arrive"
      would be the wrong event.
    */
    const { chargeReference, description } = sliceRefund(candidate, operation.id);
    const outcome = await recordRefund(operation.userId, slice, description, chargeReference);
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
    return undefined;
  };

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
      /*
        Losing the CAS proves somebody else moved the row. It does NOT prove
        their settlement finished, and assuming it did is how a slice is
        stranded (#896) — so the row is set aside and re-asked of the ledger
        below, after everything this sweep means to pay has been paid.
      */
      log.info(
        { operationId: operation.id, candidate: candidate.publicId },
        "[rollRecovery] candidate settled by a live process first — re-reading before sealing",
      );
      lostClaims.push(candidate);
      continue;
    }

    const breached = await refundSlice(candidate);
    if (breached) return breached;
    refundedCount += 1;

    if (providerOutcome === "delivered") {
      log.warn(
        { operationId: operation.id, candidate: candidate.publicId },
        "[rollRecovery] provider delivered work we never landed — refunded anyway, COGS absorbed",
      );
    }
  }

  for (const candidate of torn) {
    // Already `failed`, `cancelled` or unseen-`expired`, so there is no CAS to win and nothing
    // to ask the provider: the live process settled this slice and died
    // before its refund wrote. The same reference, the same ceiling, the same
    // unrecorded count — one money rule, not a second one.
    log.warn(
      { operationId: operation.id, candidate: candidate.publicId, slice: candidate.pointsCost },
      "[rollRecovery] settled slice with no refund on the ledger — paying the torn write",
    );
    const breached = await refundSlice(candidate);
    if (breached) return breached;
    refundedCount += 1;
  }

  /*
    THE CLAIMS WE LOST, RE-ASKED OF THE LEDGER (#896).

    `torn` was derived from the snapshot taken at the top of this function, so
    it can only ever hold rows that were ALREADY `failed` when we looked. A row
    that was `dispatched` then and is `failed` now was in neither set: it went
    to the owed loop, lost its CAS, and — before this block existed — fell
    through `continue` into a sealed receipt with its slice unpaid. That is the
    same ending as #868 by a different road, and once the operation is terminal
    nothing looks at it again: `isSettleable` cannot see a `failed` row, so no
    later sweep recovers it.

    The reading is the torn write's own rule applied to a fresh snapshot, not a
    second money policy: re-read the rows, re-read the ledger, and pay only
    what `isTornFailure` says is owed. A winner whose refund DID land is
    excluded by the ledger, exactly as it is in the loop above.

    ORDER MATTERS. This runs after the torn loop so the fresh ledger read
    already contains every refund this sweep wrote, which is what stops a row
    being paid twice by two readings of the same fact.

    `refundedCredits` is deliberately NOT re-seeded from the fresh ledger — it
    is this sweep's own arithmetic for the conservation ceiling, and the fresh
    `alreadyRefunded` includes the payments it has just made.

    A read that throws here abandons the adjudication exactly as a throw from
    the ledger gate above does. That is the safe direction: refunds are
    idempotent under their references, so the next sweep re-runs this whole
    function and pays what is still owed, once.
  */
  if (lostClaims.length > 0) {
    const settled = await db
      .select()
      .from(castingCandidates)
      .where(and(eq(castingCandidates.rollId, roll.id), eq(castingCandidates.userId, operation.userId)));
    const settledLedger = await readOperationLedger(db, operation, settled);
    const settledById = new Map(settled.map((row) => [row.id, row]));

    for (const lost of lostClaims) {
      const now = settledById.get(lost.id);
      // A `queued` row whose CAS we lost may have lost it to a CANCEL that then
      // died (#955) — the same stranding by the cancel's road. And a
      // `dispatched` one may have lost it to a landing into a cancelled roll
      // whose process died before the unseen refund (#994).
      if (!now || !isTornSettlement(now, settledLedger, operation.id)) continue;
      log.warn(
        { operationId: operation.id, candidate: now.publicId, slice: now.pointsCost },
        "[rollRecovery] the process that beat us to this row died before its refund — paying the slice",
      );
      const breached = await refundSlice(now);
      if (breached) return breached;
      refundedCount += 1;
    }
  }

  /*
    THE COUNTS ARE RE-READ ONCE, HERE, AND EVERYTHING THE CUSTOMER IS TOLD IS
    COUNTED FROM THAT ONE READING (#956).

    `landed` and `delivered` above came from the snapshot taken at the top of
    this function, and the CAS exists precisely because a live process may
    still be running: it can land a candidate between that SELECT and this
    statement. When it did, the sweep sealed the roll `failed` over a roll that
    had delivered an image, and undercounted `ready` on the receipt — the
    customer keeps the tile and is told it never arrived.

    ⚠ NO MONEY IS COUNTED FROM THIS READ, AND THAT IS THE WHOLE SHAPE OF THE
    FIX. `owed`, `torn`, the charge gate, `refundedCredits` and the
    conservation ceiling all stay on the original snapshot and its ledger,
    because they are this sweep's own arithmetic about what it paid. What moves
    is only what the roll and the receipt REPORT. A row that arrived late is
    not owed anything by us; it just has to be counted.

    ONE reading, not a conditional one. #896's fresh read exists a few lines
    above but runs only when a claim was lost, so counting from it would make
    the receipt mean two different things depending on a race — worse than one
    reading that is occasionally behind. This read is placed after every refund
    this sweep writes, so it sees the finished world rather than a midpoint.

    ⚠ IT FAILS TOWARD TODAY'S ANSWER. An empty result cannot mean every
    candidate vanished — the snapshot proved rows exist and nothing here
    deletes them — so it is a read that went wrong, and believing it would
    flip a delivered roll to `failed`, which is the exact harm this fix is
    about. On zero rows the snapshot's counts stand.
  */
  const atSeal = await db
    .select()
    .from(castingCandidates)
    .where(and(eq(castingCandidates.rollId, roll.id), eq(castingCandidates.userId, operation.userId)));
  const sealRows = atSeal.length > 0 ? atSeal : candidates;
  const sealLanded = sealRows.filter(hasLanded);
  const sealDelivered = sealRows.filter(wasDelivered);

  if (sealLanded.length !== landed.length || sealDelivered.length !== delivered.length) {
    log.info(
      {
        operationId: operation.id,
        landedAtStart: landed.length,
        landedAtSeal: sealLanded.length,
        deliveredAtStart: delivered.length,
        deliveredAtSeal: sealDelivered.length,
      },
      "[rollRecovery] candidates moved while this sweep ran — sealing on the re-read, not the snapshot",
    );
  }

  await db
    .update(castingRolls)
    .set({ status: sealDelivered.length > 0 ? "partial" : "failed" })
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
  // misreport both the roll and the receipt. Both are the re-read's figures,
  // so the receipt and the roll status can never disagree with each other.
  return sealDelivered.length > 0
    ? {
        type: "partial",
        ready: sealLanded.length,
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
