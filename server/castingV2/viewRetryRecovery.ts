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
import { operationChargeReference } from "../casting/operationContract";
import {
  finalizeClaimedGenerationOperationFailure,
  finalizeGenerationOperationFailure,
  finalizeGenerationOperationSuccess,
} from "../db/generationOperations";
import { retriedViewLanded } from "../db/castingV2ViewRetry";
import { getDb } from "../db/connection";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/viewRetryRecovery");

export type ViewRetryRecoveryOutcome =
  | { type: "durable_success"; chargedCredits: number }
  | { type: "paid_failure"; chargedCredits: number; refundedCredits: number }
  /** Terminal, and the user was never charged — so nothing is owed back. */
  | { type: "free_failure"; reason: string }
  | { type: "recovery_required"; reason: string; chargedCredits: number; refundedCredits: number };

export type RecoverableViewRetryOperation = {
  id: string;
  userId: number;
  modelId: number | null;
  status: "claimed" | "running";
  chargedCredits: number;
  refundedCredits: number;
};

export type ViewRetryRecoveryDependencies = {
  landed?: typeof retriedViewLanded;
  refund?: typeof recordRefund;
  finalizeSuccess?: typeof finalizeGenerationOperationSuccess;
  finalizeFailure?: typeof finalizeGenerationOperationFailure;
  finalizeClaimedFailure?: typeof finalizeClaimedGenerationOperationFailure;
};

/** The customer's sentence for a swept Try again — one wording, two writers. */
export const RECOVERED_VIEW_RETRY_SENTENCE =
  "That view didn't arrive when you asked again. Your credits are back.";
export const RECOVERED_VIEW_RETRY_FREE_SENTENCE =
  "That view didn't arrive when you asked again. You were not charged.";
export const VIEW_RETRY_SUPPORT_REVIEW_SENTENCE = (operationId: string) =>
  `This view retry needs support review before it can be settled. Operation ${operationId}.`;

export async function recoverCastingV2ViewRetryOperation(
  operation: RecoverableViewRetryOperation,
  options: ViewRetryRecoveryDependencies = {},
): Promise<ViewRetryRecoveryOutcome> {
  const outcome = await adjudicate(operation, options);
  return seal(operation, outcome, options);
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

  if (charged === 0) {
    /*
      Either the retry died before its deduct, or it was a FREE one and never
      had a deduct to die before. Both owe nothing, and neither is a guess: the
      ledger is empty.
    */
    return { type: "free_failure", reason: "no charge on the ledger" };
  }

  if (operation.modelId === null) {
    /*
      The Cast is bound at the claim, before any money moves, so a charged
      operation with no Cast is a shape this road does not produce. Park it
      rather than refund it: a refund here would be issued without ever having
      asked whether a picture landed.
    */
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
  if (landed) {
    /*
      The picture is in her room. The customer asked for a view, got it, and
      paid for it once — his rule exactly. Nothing goes back.
    */
    return { type: "durable_success", chargedCredits: charged };
  }

  if (alreadyRefunded >= charged) {
    // The service refunded and died before the receipt. Nothing more is owed.
    return { type: "paid_failure", chargedCredits: charged, refundedCredits: alreadyRefunded };
  }

  const owed = charged - alreadyRefunded;
  const refund = await (options.refund ?? recordRefund)(
    operation.userId,
    owed,
    "That view didn't arrive when you asked again",
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
        publicMessage: RECOVERED_VIEW_RETRY_SENTENCE,
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
        publicMessage: RECOVERED_VIEW_RETRY_FREE_SENTENCE,
      });
    } else {
      await finalizeFailure({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "PRECONDITION_FAILED",
        publicMessage: RECOVERED_VIEW_RETRY_FREE_SENTENCE,
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
