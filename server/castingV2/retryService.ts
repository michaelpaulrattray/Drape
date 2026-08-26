/**
 * THE RETRY — one failed sheet slice, rendered again (#122 shape 1).
 *
 * His word, verbatim (2026-08-26): *"Retry on engine-error/didn't-arrive
 * tiles — same prompt, one slice, 20 credits, refunded again on failure"*.
 * Design: `docs/specs/CASTING_V2_RETRY_DESIGN.md`.
 *
 * The roll road's money pattern applied to ONE slice, in the roll road's own
 * order:
 *
 *   flag → admit (free) → claim (+ candidate lock) → reset CAS → running →
 *   pinned deduct → dispatch → settle → roll status → receipt
 *
 * - **The failed row IS the slot.** A sheet slot is `(rollId, position)` and
 *   it is unique, so a retry re-uses the failed candidate row: `failed →
 *   queued` by CAS, then the same `dispatchCandidate` every roll slice goes
 *   through. Nothing about what a delivered frame is changes — only who is
 *   paying for this attempt.
 * - **Its own operation.** Kind `castingV2.retry`, so the charge and the
 *   refund carry references derived from THIS operation and can never
 *   collide with the slice's original refund (keyed on the roll's). The
 *   candidate lock is the double-tap cover at the wire (fable-974's shape).
 * - **Rows before money, dispatch after money.** The reset lands before the
 *   deduct, so the recovery adjudicator's rule holds: a `queued` row under an
 *   operation with no charge is a crash before the money moved.
 * - **A charge that does not land restores the ORIGINAL failure class**, not
 *   `unpaid`: the first attempt was charged and refunded, and the tile must
 *   keep saying so.
 *
 * Everything before the claim is free and says why.
 */
import { TRPCError } from "@trpc/server";
import { CANDIDATE_RENDER } from "./briefCompiler";
import { censusOfAttempt } from "./callCensus";
import { CASTING_V2_RETRY_PRICE_CREDITS } from "../casting/castingCreditCosts";
import {
  beginDirectOperation,
  completeDirectOperationFailure,
  completeDirectOperationSuccess,
  failClaimedDirectOperation,
} from "../casting/directOperation";
import { operationChargeReference } from "../casting/operationContract";
import { recordRefund } from "../casting/atomicCredits";
import { candidateChargeReference } from "./rollRecovery";
import { deductCredits } from "../db/credits";
import { markGenerationOperationRunning } from "../db/generationOperations";
import {
  getOwnedCandidateForRetry,
  listRollCandidateStatuses,
  resetCandidateForRetry,
  restoreCandidateFailure,
  setRollStatus,
} from "../db/castingV2";
import { captureCastingFramingTrimEnabled, captureCastingRetryEnabled } from "./castingV2Scope";
import { FRAMING_TRIM_RENDER } from "./framingTrimStep";
import { castingCreativeEngine } from "./rollEngine";
import { dispatchCandidate, type RollServiceDependencies, type Settlement } from "./rollService";
import { assertNotFrozen } from "./spendGuards";
import { createModuleLogger } from "../logging/logger";
import { candidateFailureKind, isRetryableFailure } from "../../shared/candidateFailure";
import type { StatedInk } from "./castingIntent";
import type { CreativeEngine } from "../providers/types";

const log = createModuleLogger("castingV2/retryService");

export type RetryServiceDependencies = {
  engine?: () => CreativeEngine;
  begin?: typeof beginDirectOperation;
  markRunning?: typeof markGenerationOperationRunning;
  deduct?: typeof deductCredits;
  storeImage?: RollServiceDependencies["storeImage"];
  /** The flag, as a seam — so both sides can be driven with the flag as the only variable. */
  retryEnabled?: (userId: number) => boolean;
  trimEnabled?: (userId: number) => boolean;
};

export type RetryInput = {
  userId: number;
  clientRequestId: string;
  candidatePublicId: string;
};

export type RetryResult = {
  candidateId: string;
  rollId: string;
  outcome: "ready" | "failed";
  chargedCredits: number;
  refundedCredits: number;
  /** Truthful even when it went wrong: a refund that did not record is never "you weren't charged". */
  refundRecorded: boolean;
  /** Set on a failure — the chip's class, so the sheet can say why without a poll. */
  failureClass: string | null;
};

/** The roll states a slice may be retried in: terminal and not cancelled. */
const RETRYABLE_ROLL_STATUSES = new Set(["complete", "partial", "failed"]);

export const RETRY_NOT_AVAILABLE_MESSAGE = "Retrying a tile isn't available for this account yet.";

/**
 * The sentence for a CONTENT FILTER tile, said free before the claim. It
 * names shape two rather than offering shape one, because his word puts
 * content-filter tiles on the rewrite road and a plain retry here would be a
 * decision this door is not allowed to take.
 */
export const RETRY_NOT_THIS_KIND_MESSAGE =
  "This tile was refused by the engine's filter, not by an engine error — "
  + "retrying the same words isn't offered here. Softer wording is coming.";

/**
 * Prompt read back off the row. The roll road writes
 * `internalPrompt: { prompt, resolved }` on every candidate (measured 144/144
 * on production, #129); a row without one refuses free rather than rendering
 * an empty string.
 */
export function promptOfInternal(internalPrompt: unknown): string | null {
  if (!internalPrompt || typeof internalPrompt !== "object") return null;
  const prompt = (internalPrompt as { prompt?: unknown }).prompt;
  return typeof prompt === "string" && prompt.trim().length > 0 ? prompt : null;
}

/**
 * What the roll's brief said about ink, read back off the roll's own
 * persisted compile — so a retried face keeps the born-ink disclosure its
 * siblings got. Null when the roll was compiled outside the born-ink flag or
 * the shape is not what the compiler writes.
 */
export function statedInkOfCompiledBrief(compiledBrief: unknown): StatedInk | null {
  if (!compiledBrief || typeof compiledBrief !== "object") return null;
  const intent = (compiledBrief as { intent?: unknown }).intent;
  if (!intent || typeof intent !== "object") return null;
  const statedInk = (intent as { statedInk?: unknown }).statedInk;
  if (!statedInk || typeof statedInk !== "object") return null;
  return statedInk as StatedInk;
}

/**
 * The roll's status after a rescued slice, read from every row: all `ready`
 * (or already signed/kept-and-discarded — the delivered set) means `complete`,
 * anything still failed means `partial`.
 *
 * A sibling IN FLIGHT (`queued`/`dispatched` — another retry running on the
 * same sheet) is undelivered too. Nothing serialises retries per roll — the
 * lock is per slice — so two taps seconds apart are both admitted; the first
 * to land must write `partial` and leave the last word to the second's own
 * settlement, because the failure path never writes roll status and the
 * from-guard can never move a `complete` roll back (review of #151, finding 2).
 */
export function rollStatusAfterRetry(statuses: readonly string[]): "complete" | "partial" {
  const undelivered = statuses.filter((status) =>
    status === "failed" || status === "cancelled" || status === "expired"
    || status === "queued" || status === "dispatched");
  return undelivered.length === 0 ? "complete" : "partial";
}

export async function retryCandidate(
  dependencies: RetryServiceDependencies,
  input: RetryInput,
): Promise<RetryResult> {
  const retryEnabled = dependencies.retryEnabled ?? captureCastingRetryEnabled;
  if (!retryEnabled(input.userId)) {
    // The flag's own door: nothing read, nothing claimed. NOT_FOUND rather
    // than FORBIDDEN, the ink studio's shape — outside the flag the procedure
    // does not exist.
    throw new TRPCError({ code: "NOT_FOUND", message: RETRY_NOT_AVAILABLE_MESSAGE });
  }

  const price = CASTING_V2_RETRY_PRICE_CREDITS;
  await assertNotFrozen(input.userId);

  /* ---- admission: every refusal here is free and before the claim ---- */

  const owned = await getOwnedCandidateForRetry(input.userId, input.candidatePublicId);
  if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Candidate not found" });
  const { candidate, roll } = owned;

  if (candidate.status !== "failed") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: candidate.status === "queued" || candidate.status === "dispatched"
        ? "That tile is already casting."
        : "That tile isn't one that failed, so there is nothing to retry.",
    });
  }
  const priorFailureClass = candidate.failureClass ?? "unknown";
  const kind = candidateFailureKind(candidate.failureClass);
  if (!isRetryableFailure(kind)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: kind === "content_filter"
        ? RETRY_NOT_THIS_KIND_MESSAGE
        : "That tile isn't one a retry can serve.",
    });
  }
  if (!RETRYABLE_ROLL_STATUSES.has(roll.status)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: roll.status === "cancelled"
        ? "That roll was cancelled, so its tiles can't be retried."
        : "The sheet is still casting — retry a tile once it has finished.",
    });
  }
  const prompt = promptOfInternal(candidate.internalPrompt);
  if (prompt === null) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "That tile has no recorded prompt to retry with.",
    });
  }

  /* ---- the claim, with the candidate lock as the double-tap cover ---- */

  const gate = await (dependencies.begin ?? beginDirectOperation)({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: "castingV2.retry",
    candidateLockPublicId: candidate.publicId,
    payload: { candidatePublicId: candidate.publicId, attempt: candidate.attemptCount + 1 },
  });
  if (gate.type === "replay") {
    // Idempotency, not an error: the same request id returns the retry it
    // already bought rather than buying a second one.
    return gate.result as RetryResult;
  }
  const operationId = gate.operationId;

  /* ---- the reset: rows before money ---- */

  const reset = await resetCandidateForRetry({
    userId: input.userId,
    candidateId: candidate.id,
    pointsCost: price,
  });
  if (!reset) {
    // Somebody else moved the row between the read and this statement — a
    // second tap that beat the lock, a sweep. Nothing charged; the claimed
    // finalizer closes it free.
    return failClaimedDirectOperation({
      userId: input.userId,
      operationId,
      error: new TRPCError({
        code: "CONFLICT",
        message: "That tile changed while you tapped — nothing was charged. Refresh the sheet.",
      }),
    });
  }

  try {
    await (dependencies.markRunning ?? markGenerationOperationRunning)({
      userId: input.userId,
      operationId,
      plannedCredits: price,
      phase: "generating",
      heartbeat: true,
    });
  } catch (error) {
    await restoreCandidateFailure({ userId: input.userId, candidateId: candidate.id, failureClass: priorFailureClass });
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId,
      error,
      chargedCredits: 0,
      refundedCredits: 0,
    });
  }

  /* ---- the pinned deduct ---- */

  const deduct = dependencies.deduct ?? deductCredits;
  const charge = await deduct(
    input.userId,
    price,
    "generation",
    "Casting retry (pending)",
    operationChargeReference(operationId),
    "castingV2",
  );
  if (!charge.success) {
    /*
      Nothing was dispatched, so nothing is owed back — and the slice goes back
      to exactly what it was: its ORIGINAL failure, already refunded. Not
      `unpaid`, which would tell the customer this slice was never charged
      when its first attempt was.
    */
    await restoreCandidateFailure({ userId: input.userId, candidateId: candidate.id, failureClass: priorFailureClass });
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId,
      error: new TRPCError({
        code: "BAD_REQUEST",
        message: charge.error || `Not enough credits. Retrying a tile costs ${price} credits.`,
      }),
      chargedCredits: 0,
      refundedCredits: 0,
    });
  }

  /* ---- dispatch: the roll road's own unit, once ---- */

  const engine = (dependencies.engine ?? castingCreativeEngine)();
  const trimEnabled = (dependencies.trimEnabled ?? captureCastingFramingTrimEnabled)(input.userId);
  const { value, error, census } = await censusOfAttempt(() => dispatchCandidate({
    dependencies: { storeImage: dependencies.storeImage },
    engine,
    userId: input.userId,
    operationId,
    candidate: { id: candidate.id, publicId: candidate.publicId, position: candidate.position, pointsCost: price },
    prompt,
    size: trimEnabled ? `${FRAMING_TRIM_RENDER.width}x${FRAMING_TRIM_RENDER.height}` : CANDIDATE_RENDER.size,
    trimEnabled,
    quality: CANDIDATE_RENDER.quality,
    accountDown: { tripped: false },
    statedInk: statedInkOfCompiledBrief(roll.compiledBrief),
    rollPublicId: roll.publicId,
  }));
  log.info(
    {
      operationId,
      candidate: candidate.publicId,
      attempt: candidate.attemptCount + 1,
      delivered: error === undefined && (value as Settlement | undefined)?.outcome === "ready",
      calls: census.total.calls,
      failedCalls: census.total.failed,
      callMs: census.total.ms,
      wallMs: census.wallMs,
      byModel: census.byModel,
    },
    "[retryService] what this retried tile cost in calls and seconds",
  );
  if (error !== undefined) {
    /*
      `dispatchCandidate` settles every exit itself — a throw past it is the
      census wrapper's own, or something after the settlement. The money is
      already right or already logged; the receipt says support.
    */
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId,
      error,
      chargedCredits: price,
      refundedCredits: 0,
    });
  }
  const settlement = value as Settlement;

  if (settlement.outcome === "ready") {
    /*
      A rescued slice moves a TERMINAL roll — the only writer that does. Read
      from the rows rather than inferred from this one settlement, and guarded
      on the terminal pair so a roll the road is still writing is never
      touched.
    */
    const statuses = await listRollCandidateStatuses(input.userId, roll.id);
    await setRollStatus({
      userId: input.userId,
      rollId: roll.id,
      status: rollStatusAfterRetry(statuses),
      from: ["partial", "failed"],
    });
    const result: RetryResult = {
      candidateId: candidate.publicId,
      rollId: roll.publicId,
      outcome: "ready",
      chargedCredits: price,
      refundedCredits: 0,
      refundRecorded: true,
      failureClass: null,
    };
    await completeDirectOperationSuccess({
      userId: input.userId,
      operationId,
      result,
      chargedCredits: price,
      refundedCredits: 0,
      terminalStatus: "succeeded",
    });
    return result;
  }

  /*
    Failed again — or landed nowhere. A `failed` settlement refunded itself
    under THIS operation's reference inside `dispatchCandidate`. A `skipped`
    one did NOT: it means the dispatch CAS or the landing CAS was lost, and
    on the roll road that is a cancel that already refunded the slice. Here
    it is not — cancel is a no-op on a terminal roll — but the RETENTION
    SWEEP expires `queued`/`dispatched` rows too, so a retry on a sheet at
    the edge of its seven days can lose its CAS to the sweep mid-render
    (review of #151, finding 1). Nobody else refunds a retry's charge, so
    this road does: under its own reference, once, and a refund that does
    not record is said so rather than sealed as "0 credits were refunded".
  */
  let refunded = settlement.refundedCredits;
  let refundUnrecorded = settlement.refundUnrecorded === true;
  if (settlement.outcome !== "failed" && refunded === 0 && !refundUnrecorded) {
    const refund = await recordRefund(
      input.userId,
      price,
      "Casting retry landed nowhere",
      candidateChargeReference(operationId, candidate.publicId),
    );
    refunded = refund.recorded ? refund.amount : 0;
    refundUnrecorded = !refund.recorded;
    log.warn(
      { operationId, candidate: candidate.publicId, outcome: settlement.outcome, recorded: refund.recorded },
      "[retryService] the retried tile landed nowhere — refunded under the retry's own reference",
    );
  }
  const refundSentence = refundUnrecorded
    ? `The refund could not be recorded — quote operation ${operationId} and support will restore the balance.`
    : `${refunded} credits were refunded.`;
  log.warn(
    { operationId, candidate: candidate.publicId, failureClass: settlement.failureClass ?? "unknown", refunded },
    "[retryService] the retried tile failed again — refunded under the retry's own reference",
  );
  return completeDirectOperationFailure({
    userId: input.userId,
    operationId,
    error: new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `That tile didn't arrive again. ${refundSentence}`,
    }),
    chargedCredits: price,
    refundedCredits: refunded,
  });
}
