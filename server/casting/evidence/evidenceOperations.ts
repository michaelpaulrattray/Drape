import { randomUUID } from "node:crypto";
import { TRPCError, type TRPC_ERROR_CODE_KEY } from "@trpc/server";
import {
  beginDirectOperation,
  type DirectOperationGate,
} from "../directOperation";
import { modelOperationLockKey } from "../operationContract";
import {
  putCanonicalEvidence,
  resolveEvidenceOwnerDelivery,
  type EvidenceDeliveryAdapter,
} from "./evidenceDelivery";
import {
  canonicalizeEvidenceDataUrl,
  EvidenceImageValidationError,
} from "./imageValidation";
import {
  attachAndCompleteReferencePlateOperation,
  discardReferencePlateOperation,
  EvidenceOperationStateError,
  findOwnedEvidencePlateById,
  inspectOwnedDraftEvidenceTarget,
  inspectOwnedDraftPlate,
  markReferencePlateOperationStored,
  prepareReferencePlateOperation,
  type EvidencePlateClosedResult,
} from "../../db/evidenceOperations";
import { getGenerationOperationOutcomeByRequest } from "../../db/generationOperations";

export interface EvidenceOperationDependencies {
  delivery: EvidenceDeliveryAdapter;
  generateId?: () => string;
  begin?: typeof beginDirectOperation;
}

export interface EvidencePlateResponse extends EvidencePlateClosedResult {
  delivery: string;
}

const EVIDENCE_REPLAY_TRPC_CODES = new Set<TRPC_ERROR_CODE_KEY>([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE",
  "TOO_MANY_REQUESTS",
  "INTERNAL_SERVER_ERROR",
]);

function closedPlateResult(value: unknown): EvidencePlateClosedResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Saved reference metadata is unavailable." });
  }
  const result = value as Record<string, unknown>;
  if (
    typeof result.plateId !== "string"
    || result.mime !== "image/webp"
    || !Number.isSafeInteger(result.width)
    || !Number.isSafeInteger(result.height)
    || !Number.isSafeInteger(result.byteSize)
    || typeof result.contentHash !== "string"
    || !/^[0-9a-f]{64}$/.test(result.contentHash)
  ) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Saved reference metadata is unavailable." });
  }
  return {
    plateId: result.plateId,
    mime: "image/webp",
    width: result.width as number,
    height: result.height as number,
    byteSize: result.byteSize as number,
    contentHash: result.contentHash,
  };
}

async function ownerResponse(
  delivery: EvidenceDeliveryAdapter,
  userId: number,
  result: EvidencePlateClosedResult,
): Promise<EvidencePlateResponse> {
  const plate = await findOwnedEvidencePlateById({
    userId,
    plateId: result.plateId,
  });
  if (
    !plate
    || plate.result.mime !== result.mime
    || plate.result.width !== result.width
    || plate.result.height !== result.height
    || plate.result.byteSize !== result.byteSize
    || plate.result.contentHash !== result.contentHash
  ) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Reference image not found." });
  }
  return {
    ...result,
    delivery: await resolveEvidenceOwnerDelivery(delivery, {
      userId,
      key: plate.storageKey,
    }),
  };
}

function operationFailure(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  if (error instanceof EvidenceImageValidationError) {
    throw new TRPCError({
      code: error.code.includes("too_large") ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST",
      message: error.message,
    });
  }
  if (error instanceof EvidenceOperationStateError) {
    const code = error.code === "model_unavailable" || error.code === "plate_unavailable"
      ? "NOT_FOUND"
      : error.code === "plate_in_use"
        ? "PRECONDITION_FAILED"
        : "CONFLICT";
    throw new TRPCError({ code, message: error.message });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "The reference image action could not be completed. Nothing was charged.",
  });
}

export async function stageOwnedReferencePlate(
  dependencies: EvidenceOperationDependencies,
  input: {
    userId: number;
    modelId: number;
    clientRequestId: string;
    imageDataUrl: string;
  },
): Promise<EvidencePlateResponse> {
  try {
    if (!await inspectOwnedDraftEvidenceTarget(input)) {
      throw new EvidenceOperationStateError("model_unavailable");
    }
    const image = await canonicalizeEvidenceDataUrl(input.imageDataUrl);
    const begin = dependencies.begin ?? beginDirectOperation;
    const gate = await begin({
      userId: input.userId,
      clientRequestId: input.clientRequestId,
      kind: "evidence_plate_ingest",
      modelId: input.modelId,
      payload: { modelId: input.modelId, contentHash: image.contentHash },
      lockKey: modelOperationLockKey(input.modelId),
      resumeClaimedEvidence: true,
    });
    if (gate.type === "replay") {
      return ownerResponse(
        dependencies.delivery,
        input.userId,
        closedPlateResult(gate.result),
      );
    }
    const generateId = dependencies.generateId ?? randomUUID;
    const prepared = await prepareReferencePlateOperation({
      userId: input.userId,
      modelId: input.modelId,
      operationId: gate.operationId,
      stepKey: "reference",
      ingestionId: generateId(),
      plateId: generateId(),
      image,
    });
    await putCanonicalEvidence(dependencies.delivery, {
      key: prepared.storageKey,
      image,
    });
    await markReferencePlateOperationStored({
      userId: input.userId,
      modelId: input.modelId,
      operationId: gate.operationId,
      prepared,
      image,
    });
    const result = await attachAndCompleteReferencePlateOperation({
      userId: input.userId,
      modelId: input.modelId,
      operationId: gate.operationId,
      prepared,
      image,
    });
    return ownerResponse(dependencies.delivery, input.userId, result);
  } catch (error) {
    return operationFailure(error);
  }
}

function discardReplay(value: unknown, plateId: string): { plateId: string; discarded: true } {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || (value as Record<string, unknown>).plateId !== plateId
    || (value as Record<string, unknown>).discarded !== true
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "That request id was already used for a different reference image.",
    });
  }
  return { plateId, discarded: true };
}

export async function discardOwnedReferencePlate(input: {
  userId: number;
  plateId: string;
  clientRequestId: string;
  begin?: typeof beginDirectOperation;
}): Promise<{ plateId: string; discarded: true }> {
  try {
    const existing = await getGenerationOperationOutcomeByRequest({
      userId: input.userId,
      clientRequestId: input.clientRequestId,
      kind: "evidence_plate_discard",
    });
    if (existing?.type === "replay_success") {
      return discardReplay(existing.result, input.plateId);
    }
    if (existing?.type === "replay_failure") {
      throw new TRPCError({
        code: EVIDENCE_REPLAY_TRPC_CODES.has(
          existing.errorCode as TRPC_ERROR_CODE_KEY,
        )
          ? existing.errorCode as TRPC_ERROR_CODE_KEY
          : "INTERNAL_SERVER_ERROR",
        message: existing.publicMessage,
      });
    }
    if (existing?.type === "deleted_subject") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Reference image not found." });
    }
    if (existing?.type === "recovery_required") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: existing.publicMessage });
    }
    const plate = await inspectOwnedDraftPlate(input);
    if (!plate) throw new EvidenceOperationStateError("plate_unavailable");
    const begin = input.begin ?? beginDirectOperation;
    const gate: DirectOperationGate = await begin({
      userId: input.userId,
      clientRequestId: input.clientRequestId,
      kind: "evidence_plate_discard",
      modelId: plate.modelId,
      payload: { modelId: plate.modelId, plateId: input.plateId },
      lockKey: modelOperationLockKey(plate.modelId),
      resumeClaimedEvidence: true,
    });
    if (gate.type === "replay") return discardReplay(gate.result, input.plateId);
    return await discardReferencePlateOperation({
      userId: input.userId,
      modelId: plate.modelId,
      plateId: input.plateId,
      operationId: gate.operationId,
    });
  } catch (error) {
    return operationFailure(error);
  }
}
