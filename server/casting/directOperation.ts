import { TRPCError, type TRPC_ERROR_CODE_KEY } from "@trpc/server";
import {
  acquireGenerationOperationLock,
  claimGenerationOperation,
  finalizeClaimedGenerationOperationSuccess,
  finalizeClaimedGenerationOperationFailure,
  finalizeGenerationOperationFailure,
  finalizeGenerationOperationSuccess,
  getGenerationOperationOutcome,
  markClaimedGenerationOperationRecoveryRequired,
  markGenerationOperationRecoveryRequired,
} from "../db";
import type {
  GenerationOperationKind,
  GenerationOperationLandingStatus,
  PublicOperationResult,
} from "./operationContract";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("casting/directOperation");

const PUBLIC_TRPC_CODES = new Set<TRPC_ERROR_CODE_KEY>([
  "BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND",
  "METHOD_NOT_SUPPORTED", "TIMEOUT", "CONFLICT", "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE", "UNPROCESSABLE_CONTENT", "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST", "INTERNAL_SERVER_ERROR", "NOT_IMPLEMENTED",
]);

function trpcCode(value: string): TRPC_ERROR_CODE_KEY {
  return PUBLIC_TRPC_CODES.has(value as TRPC_ERROR_CODE_KEY)
    ? value as TRPC_ERROR_CODE_KEY
    : "INTERNAL_SERVER_ERROR";
}

export type DirectOperationGate =
  | { type: "execute"; operationId: string }
  | { type: "replay"; operationId: string; result: unknown };

export async function beginDirectOperation(input: {
  userId: number;
  clientRequestId: string;
  kind: GenerationOperationKind;
  modelId?: number | null;
  originBoardId?: number | null;
  originItemId?: number | null;
  payload: unknown;
  lockKey?: string;
}): Promise<DirectOperationGate> {
  const claim = await claimGenerationOperation(input);
  switch (claim.type) {
    case "deleted_subject":
      throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
    case "replay_success":
      return { type: "replay", operationId: claim.operationId, result: claim.result };
    case "replay_failure":
      throw new TRPCError({ code: trpcCode(claim.errorCode), message: claim.publicMessage });
    case "payload_conflict":
      throw new TRPCError({
        code: "CONFLICT",
        message: "That request id was already used for a different action. Nothing was run.",
      });
    case "in_progress":
      throw new TRPCError({
        code: "CONFLICT",
        message: `This action is already in progress. Operation ${claim.operationId}.`,
      });
    case "recovery_required":
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: claim.publicMessage });
    case "resource_busy":
      throw new TRPCError({ code: "CONFLICT", message: "Another operation is already changing this Cast." });
    case "claimed":
      break;
  }

  if (input.lockKey) {
    const lock = await acquireGenerationOperationLock({
      userId: input.userId,
      operationId: claim.operationId,
      kind: input.kind,
      lockKey: input.lockKey,
    });
    if (lock.type === "resource_busy") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Another operation is already changing this Cast. Wait for it to finish before retrying.",
      });
    }
  }
  return { type: "execute", operationId: claim.operationId };
}

export async function failClaimedDirectOperation(input: {
  userId: number;
  operationId: string;
  error: unknown;
}): Promise<never> {
  const error = input.error instanceof TRPCError
    ? input.error
    : new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The operation could not start." });
  try {
    await finalizeClaimedGenerationOperationFailure({
      userId: input.userId,
      operationId: input.operationId,
      errorCode: error.code,
      publicMessage: error.message,
    });
  } catch (receiptError) {
    const existing = await terminalOutcomeAfterWriteError(input.userId, input.operationId);
    if (existing?.type === "replay_failure") throw error;
    const publicMessage = `The result needs support review before this action can be retried. Operation ${input.operationId}.`;
    try {
      await markClaimedGenerationOperationRecoveryRequired({
        userId: input.userId,
        operationId: input.operationId,
        publicMessage,
      });
    } catch (recoveryError) {
      log.fatal(
        { operationId: input.operationId, receiptError, err: recoveryError },
        "[DirectOperation] claimed receipt and recovery mark both failed",
      );
    }
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: publicMessage });
  }
  throw error;
}

/** Persist a free pre-start answer (such as a clarification question) as a
 * successful receipt. This keeps classification replay-safe without claiming
 * that an image was generated or any credits moved. */
export async function completeClaimedDirectOperationSuccess(input: {
  userId: number;
  operationId: string;
  result: PublicOperationResult;
}): Promise<void> {
  try {
    await finalizeClaimedGenerationOperationSuccess(input);
  } catch (receiptError) {
    const existing = await terminalOutcomeAfterWriteError(input.userId, input.operationId);
    if (existing?.type === "replay_success") return;
    const publicMessage = `The result needs support review before this action can be retried. Operation ${input.operationId}.`;
    try {
      await markClaimedGenerationOperationRecoveryRequired({
        userId: input.userId,
        operationId: input.operationId,
        publicMessage,
      });
    } catch (recoveryError) {
      log.fatal(
        { operationId: input.operationId, receiptError, err: recoveryError },
        "[DirectOperation] claimed success receipt and recovery mark both failed",
      );
    }
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: publicMessage });
  }
}

async function markRecoveryAfterReceiptFailure(input: {
  userId: number;
  operationId: string;
  chargedCredits: number;
  refundedCredits: number;
  cause: unknown;
}): Promise<never> {
  const publicMessage = `The result needs support review before this action can be retried. Operation ${input.operationId}.`;
  try {
    await markGenerationOperationRecoveryRequired({
      userId: input.userId,
      operationId: input.operationId,
      publicMessage,
      chargedCredits: input.chargedCredits,
      refundedCredits: input.refundedCredits,
    });
  } catch (recoveryError) {
    log.fatal(
      { operationId: input.operationId, err: recoveryError },
      "[DirectOperation] terminal receipt and recovery mark both failed",
    );
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: publicMessage });
}

async function terminalOutcomeAfterWriteError(userId: number, operationId: string) {
  return getGenerationOperationOutcome(userId, operationId).catch(() => null);
}

export async function requireDirectOperationRecovery(input: {
  userId: number;
  operationId: string;
  chargedCredits: number;
  refundedCredits: number;
  cause: unknown;
}): Promise<never> {
  return markRecoveryAfterReceiptFailure(input);
}

export async function completeDirectOperationSuccess(input: {
  userId: number;
  operationId: string;
  result: PublicOperationResult;
  chargedCredits: number;
  refundedCredits: number;
  landing?: {
    status: GenerationOperationLandingStatus;
    landedItemId?: number | null;
    acknowledgedAt?: Date | null;
  };
}): Promise<void> {
  try {
    await finalizeGenerationOperationSuccess(input);
  } catch (error) {
    const existing = await terminalOutcomeAfterWriteError(input.userId, input.operationId);
    if (existing?.type === "replay_success") return;
    await markRecoveryAfterReceiptFailure({ ...input, cause: error });
  }
}

export async function completeDirectOperationFailure(input: {
  userId: number;
  operationId: string;
  error: unknown;
  chargedCredits: number;
  refundedCredits: number;
}): Promise<never> {
  const error = input.error instanceof TRPCError
    ? input.error
    : new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The operation failed." });
  try {
    await finalizeGenerationOperationFailure({
      userId: input.userId,
      operationId: input.operationId,
      errorCode: error.code,
      publicMessage: error.message,
      chargedCredits: input.chargedCredits,
      refundedCredits: input.refundedCredits,
    });
  } catch (receiptError) {
    const existing = await terminalOutcomeAfterWriteError(input.userId, input.operationId);
    if (existing?.type === "replay_failure") throw error;
    await markRecoveryAfterReceiptFailure({
      userId: input.userId,
      operationId: input.operationId,
      chargedCredits: input.chargedCredits,
      refundedCredits: input.refundedCredits,
      cause: receiptError,
    });
  }
  throw error;
}
