import { TRPCError } from "@trpc/server";
import {
  beginDirectOperation,
  completeDirectOperationFailure,
  requireDirectOperationRecovery,
  type DirectOperationGate,
} from "../directOperation";
import {
  getGenerationOperationOutcomeByClaim,
  markGenerationOperationRunning,
} from "../../db/generationOperations";
import {
  commitCancelInkAddIntent,
  InkCancellationStateError,
  type InkIntentCancelledResult,
} from "../../db/inkAddCancellation";
import { findOwnedInkIntentClaimSubject } from "../../db/inkAddIntents";
import { modelOperationLockKey } from "../operationContract";
import { captureEvidenceComposerEnabled } from "./evidenceComposerScope";

const CANCEL_FAILURE =
  "The tattoo request could not be cancelled. Your Cast was not changed.";

type BeginOperation = (input: Parameters<typeof beginDirectOperation>[0]) =>
  Promise<DirectOperationGate>;

export interface InkIntentCancellationDependencies {
  enabledForUser?: (userId: number) => boolean;
  findClaimSubject?: typeof findOwnedInkIntentClaimSubject;
  getOutcomeByClaim?: typeof getGenerationOperationOutcomeByClaim;
  begin?: BeginOperation;
  markRunning?: typeof markGenerationOperationRunning;
  commit?: typeof commitCancelInkAddIntent;
  completeFailure?: typeof completeDirectOperationFailure;
  requireRecovery?: typeof requireDirectOperationRecovery;
}

function closedCancelledResult(value: unknown): InkIntentCancelledResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: CANCEL_FAILURE });
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.intentId !== "string"
    || !(row.candidateId === null || typeof row.candidateId === "string")
    || row.status !== "cancelled"
    || !Number.isSafeInteger(row.cleanupObjects)
    || (row.cleanupObjects as number) < 0
    || row.chargedCredits !== 0
  ) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: CANCEL_FAILURE });
  }
  return row as unknown as InkIntentCancelledResult;
}

export async function cancelInkAddIntent(
  dependencies: InkIntentCancellationDependencies,
  input: {
    userId: number;
    intentId: string;
    clientRequestId: string;
  },
): Promise<InkIntentCancelledResult> {
  const enabled = dependencies.enabledForUser ?? captureEvidenceComposerEnabled;
  if (!enabled(input.userId)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Tattoo previews are not available for this account.",
    });
  }
  const subject = await (
    dependencies.findClaimSubject ?? findOwnedInkIntentClaimSubject
  )({
    userId: input.userId,
    intentId: input.intentId,
  });
  if (!subject) {
    throw new TRPCError({ code: "NOT_FOUND", message: CANCEL_FAILURE });
  }
  const getOutcome = dependencies.getOutcomeByClaim
    ?? getGenerationOperationOutcomeByClaim;
  const claim = {
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: "evidence_candidate_cancel" as const,
    modelId: subject.modelId,
    payload: { intentId: input.intentId },
  };
  const existing = await getOutcome(claim);
  if (existing?.type === "replay_success") {
    return closedCancelledResult(existing.result);
  }
  if (existing?.type === "replay_failure") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: existing.publicMessage,
    });
  }
  if (existing?.type === "payload_conflict") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "That request id was already used for a different action.",
    });
  }
  if (existing?.type === "in_progress") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This cancellation is already in progress.",
    });
  }
  if (existing?.type === "recovery_required") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: existing.publicMessage,
    });
  }
  if (existing?.type === "deleted_subject") {
    throw new TRPCError({ code: "NOT_FOUND", message: CANCEL_FAILURE });
  }

  const gate = await (dependencies.begin ?? beginDirectOperation)({
    ...claim,
    lockKey: modelOperationLockKey(subject.modelId),
  });
  if (gate.type === "replay") return closedCancelledResult(gate.result);
  try {
    await (dependencies.markRunning ?? markGenerationOperationRunning)({
      userId: input.userId,
      operationId: gate.operationId,
      modelId: subject.modelId,
      plannedCredits: 0,
      requiredLockKey: modelOperationLockKey(subject.modelId),
      phase: "cleaning",
      heartbeat: false,
    });
    return await (dependencies.commit ?? commitCancelInkAddIntent)({
      userId: input.userId,
      modelId: subject.modelId,
      intentId: input.intentId,
      operationId: gate.operationId,
    });
  } catch (error) {
    const terminal = await getOutcome(claim).catch(() => null);
    if (terminal?.type === "replay_success") {
      return closedCancelledResult(terminal.result);
    }
    if (terminal?.type === "replay_failure") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: terminal.publicMessage,
      });
    }
    if (terminal?.type === "recovery_required") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: terminal.publicMessage,
      });
    }
    if (!terminal) {
      return (dependencies.requireRecovery ?? requireDirectOperationRecovery)({
        userId: input.userId,
        operationId: gate.operationId,
        chargedCredits: 0,
        refundedCredits: 0,
        cause: error,
      });
    }
    const publicError = error instanceof InkCancellationStateError
      ? new TRPCError({ code: "PRECONDITION_FAILED", message: CANCEL_FAILURE })
      : error instanceof TRPCError
        ? new TRPCError({ code: error.code, message: CANCEL_FAILURE })
        : new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: CANCEL_FAILURE });
    return (dependencies.completeFailure ?? completeDirectOperationFailure)({
      userId: input.userId,
      operationId: gate.operationId,
      error: publicError,
      chargedCredits: 0,
      refundedCredits: 0,
    });
  }
}
