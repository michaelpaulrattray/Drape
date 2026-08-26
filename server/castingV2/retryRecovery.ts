/**
 * RECOVERY FOR A CRASHED RETRY (#122 shape 1) — settle one slice whose
 * operation's process died with it.
 *
 * A retry is one candidate under an operation of its own
 * (`retryService.ts`), and the roll adjudicator cannot see it: that one finds
 * its rows through `casting_rolls.operationId`, and no roll points at a retry
 * operation. What a retry operation DOES carry, from the claim and BEFORE any
 * money, is the candidate lock (`casting-candidate:<id>`), deleted only by the
 * finalizers — so the lock row is the link, for exactly the window recovery
 * cares about.
 *
 * The rule is the roll's, over one row:
 *
 *   - **Did the slice land?** `ready` with bytes in OUR storage means the
 *     customer has the picture they paid for; the charge is kept.
 *   - **Anything unfinished** (`queued`, `dispatched`, `ready` with no key) is
 *     CAS'd to `failed:unrecovered` and refunded under the RETRY's own
 *     reference — only if the ledger shows the charge and no prior refund.
 *   - **Already `failed`** means the service settled it and died after: the
 *     ledger decides whether the refund landed, and pays it once if not.
 *   - **No lock row, no candidate, an ambiguous ledger** → `recovery_required`.
 *     Fail CLOSED: a guessed refund is worse than a parked operation support
 *     can read.
 *
 * Adjudication and sealing are separate, as in `rollRecovery.ts`: the seal is
 * in one place so "every terminal decision ends the operation" is structural.
 */
import { and, eq } from "drizzle-orm";
import { castingCandidates } from "../../drizzle/schema";
import { getDb } from "../db/connection";
import { claimCandidateForRecovery } from "../db/castingV2";
import { getOperationLockByOperation } from "../db/generationOperations";
import {
  finalizeClaimedGenerationOperationFailure,
  finalizeGenerationOperationFailure,
  finalizeGenerationOperationSuccess,
} from "../db";
import { recordRefund } from "../casting/atomicCredits";
import { createModuleLogger } from "../logging/logger";
import { candidateChargeReference, isSettleable, readOperationLedger } from "./rollRecovery";

const log = createModuleLogger("castingV2/retryRecovery");

export type RetryRecoveryOutcome =
  | { type: "durable_success"; chargedCredits: number }
  | { type: "paid_failure"; chargedCredits: number; refundedCredits: number }
  /** Terminal, and the user was never charged — so nothing is owed back. */
  | { type: "free_failure"; reason: string }
  | { type: "recovery_required"; reason: string; chargedCredits: number; refundedCredits: number };

export type RecoverableRetryOperation = {
  id: string;
  userId: number;
  status: "claimed" | "running";
  chargedCredits: number;
  refundedCredits: number;
};

export type RetryRecoveryDependencies = {
  claimCandidate?: typeof claimCandidateForRecovery;
  readLock?: typeof getOperationLockByOperation;
  refund?: typeof recordRefund;
  finalizeSuccess?: typeof finalizeGenerationOperationSuccess;
  finalizeFailure?: typeof finalizeGenerationOperationFailure;
  finalizeClaimedFailure?: typeof finalizeClaimedGenerationOperationFailure;
};

/** `casting-candidate:<id>` → id, or null for any other lock. */
export function candidateIdOfLockKey(lockKey: string): number | null {
  const match = /^casting-candidate:([1-9][0-9]*)$/.exec(lockKey);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}

/** The customer's sentence for a swept retry — named, so the sheet and the receipt agree. */
export const RECOVERED_RETRY_SENTENCE = "That retry didn't make it. Your credits are back.";

export async function recoverCastingV2RetryOperation(
  operation: RecoverableRetryOperation,
  options: RetryRecoveryDependencies = {},
): Promise<RetryRecoveryOutcome> {
  const outcome = await adjudicateRetryOperation(operation, options);
  return sealRetryReceipt(operation, outcome, options);
}

async function adjudicateRetryOperation(
  operation: RecoverableRetryOperation,
  options: RetryRecoveryDependencies,
): Promise<RetryRecoveryOutcome> {
  const db = await getDb();
  if (!db) {
    return {
      type: "recovery_required",
      reason: "database unavailable during recovery",
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    };
  }

  const lock = await (options.readLock ?? getOperationLockByOperation)(operation.id);
  const candidateId = lock ? candidateIdOfLockKey(lock.lockKey) : null;
  if (candidateId === null) {
    /*
      A retry claims with the candidate lock BEFORE any money moves, and the
      lock lives until a finalizer deletes it. No lock under a still-open
      operation is a state this road does not produce — so nothing is
      refunded on a guess, and support reads the operation.
    */
    return {
      type: "recovery_required",
      reason: lock ? "retry operation holds a lock that names no candidate" : "retry operation holds no candidate lock",
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    };
  }

  const [candidate] = await db
    .select()
    .from(castingCandidates)
    .where(and(eq(castingCandidates.id, candidateId), eq(castingCandidates.userId, operation.userId)))
    .limit(1);
  /*
    The WHERE above already scopes the row to the operation's user (invariant
    1); it is re-proven here in code because this adjudicator moves money on
    the strength of that row, and a reader whose filter was ever loosened
    would otherwise refund one user for another's slice without a test able
    to see it.
  */
  if (!candidate || candidate.userId !== operation.userId) {
    return {
      type: "recovery_required",
      reason: "the locked candidate is not this user's or no longer exists",
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    };
  }

  /*
    THE CHARGE GATE — the roll's own reader over one row. The reset lands
    before the deduct, so a `queued` row proves the retry was PLANNED, never
    that it was paid for; everything below may only give back what the ledger
    shows was taken, and never twice.
  */
  const { charge, alreadyRefunded } = await readOperationLedger(db, operation, [candidate]);
  if (charge.kind === "ambiguous") {
    return {
      type: "recovery_required",
      reason: charge.reason,
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    };
  }

  const landed = candidate.status === "ready" && Boolean(candidate.imageKey);
  if (landed) {
    if (charge.kind === "not_charged") {
      // Impossible under the pinned sequence — dispatch happens after the
      // deduct. If it happens anyway, a human looks.
      return {
        type: "recovery_required",
        reason: "a retried candidate landed under an operation with no recorded charge",
        chargedCredits: 0,
        refundedCredits: operation.refundedCredits,
      };
    }
    return { type: "durable_success", chargedCredits: charge.credits };
  }

  if (isSettleable(candidate)) {
    /*
      CAS before refund, the roll's rule: a live process racing this sweep to
      the same row loses or wins the transition, never both, so the refund
      below fires at most once per slice.
    */
    const won = await (options.claimCandidate ?? claimCandidateForRecovery)({
      userId: operation.userId,
      candidateId: candidate.id,
      failureClass: "unrecovered",
    });
    if (!won) {
      // A live process moved it first; adjudicate again next sweep against
      // whatever it wrote.
      return {
        type: "recovery_required",
        reason: "the candidate moved while recovery was settling it",
        chargedCredits: operation.chargedCredits,
        refundedCredits: operation.refundedCredits,
      };
    }
  } else if (candidate.status !== "failed") {
    /*
      `discarded`, `signed`, `expired`, `cancelled` — states a retried slice
      reaches only AFTER landing, or under a cancel that cannot touch a
      terminal roll. Not this road's to settle; say so rather than guess.
    */
    return {
      type: "recovery_required",
      reason: `the retried candidate is ${candidate.status}, which this adjudicator does not settle`,
      chargedCredits: operation.chargedCredits,
      refundedCredits: operation.refundedCredits,
    };
  }

  if (charge.kind === "not_charged") {
    return { type: "free_failure", reason: "the retry was never charged" };
  }
  if (alreadyRefunded >= charge.credits) {
    // The service refunded and died before the receipt. Nothing more is owed.
    return { type: "paid_failure", chargedCredits: charge.credits, refundedCredits: alreadyRefunded };
  }
  const owed = charge.credits - alreadyRefunded;
  const refund = await (options.refund ?? recordRefund)(
    operation.userId,
    owed,
    "Casting retry did not arrive (recovered)",
    candidateChargeReference(operation.id, candidate.publicId),
  );
  if (!refund.recorded) {
    log.error(
      { operationId: operation.id, candidate: candidate.publicId },
      "[retryRecovery] refund did not record — parking for support",
    );
    return {
      type: "recovery_required",
      reason: "the refund did not record",
      chargedCredits: charge.credits,
      refundedCredits: alreadyRefunded,
    };
  }
  return { type: "paid_failure", chargedCredits: charge.credits, refundedCredits: alreadyRefunded + refund.amount };
}

async function sealRetryReceipt(
  operation: RecoverableRetryOperation,
  outcome: RetryRecoveryOutcome,
  options: RetryRecoveryDependencies,
): Promise<RetryRecoveryOutcome> {
  // The sweep writes its own recovery_required receipt for this case.
  if (outcome.type === "recovery_required") return outcome;

  const finalizeSuccess = options.finalizeSuccess ?? finalizeGenerationOperationSuccess;
  const finalizeFailure = options.finalizeFailure ?? finalizeGenerationOperationFailure;
  const finalizeClaimedFailure = options.finalizeClaimedFailure ?? finalizeClaimedGenerationOperationFailure;

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
        publicMessage: RECOVERED_RETRY_SENTENCE,
        chargedCredits: outcome.chargedCredits,
        refundedCredits: outcome.refundedCredits,
      });
      return outcome;
    }
    // free_failure: a crash before the charge leaves the operation `claimed`
    // or `running`, and those take different finalizers.
    if (operation.status === "claimed") {
      await finalizeClaimedFailure({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "PRECONDITION_FAILED",
        publicMessage: "That retry didn't start. You were not charged.",
      });
    } else {
      await finalizeFailure({
        userId: operation.userId,
        operationId: operation.id,
        errorCode: "PRECONDITION_FAILED",
        publicMessage: "That retry didn't start. You were not charged.",
        chargedCredits: 0,
        refundedCredits: 0,
      });
    }
    return outcome;
  } catch (error) {
    log.error(
      { operationId: operation.id, outcome: outcome.type, err: error },
      "[retryRecovery] adjudication settled but the receipt did not seal",
    );
    return {
      type: "recovery_required",
      reason: "receipt did not seal after adjudication",
      chargedCredits: "chargedCredits" in outcome ? outcome.chargedCredits : 0,
      refundedCredits: "refundedCredits" in outcome ? outcome.refundedCredits : 0,
    };
  }
}
