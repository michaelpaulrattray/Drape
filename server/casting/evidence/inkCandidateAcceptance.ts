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
  findOwnedInkCandidateClaimSubject,
  InkAcceptanceStateError,
  prepareInkCandidateAcceptance,
  prepareInkProjectionCandidateAcceptance,
  queueUnacceptedPublicCopyCleanup,
  type PreparedInkCandidateAcceptance,
  type PreparedInkProjectionCandidateAcceptance,
} from "../../db/inkAddAcceptance";
import { modelOperationLockKey } from "../operationContract";
import { storagePut } from "../../storage";
import {
  readCanonicalEvidenceBytesExact,
  type PrivateEvidenceStorageAdapter,
} from "./evidenceDelivery";
import {
  commitInkCandidateAcceptance,
  commitInkProjectionCandidateAcceptance,
  type InkCandidateAcceptedResult,
  type InkProjectionCandidateAcceptedResult,
} from "./inkAcceptanceCommit";
import { captureEvidenceComposerEnabled } from "./evidenceComposerScope";
import { inkCandidatePublicStorageKey } from "./inkCandidatePublicStorage";

const ACCEPT_FAILURE =
  "The tattoo preview could not be accepted. Your Cast was not changed.";

type BeginOperation = (input: Parameters<typeof beginDirectOperation>[0]) =>
  Promise<DirectOperationGate>;

export interface InkCandidateAcceptanceDependencies {
  delivery: PrivateEvidenceStorageAdapter;
  enabledForUser?: (userId: number) => boolean;
  findClaimSubject?: typeof findOwnedInkCandidateClaimSubject;
  getOutcomeByClaim?: typeof getGenerationOperationOutcomeByClaim;
  begin?: BeginOperation;
  markRunning?: typeof markGenerationOperationRunning;
  prepare?: typeof prepareInkCandidateAcceptance;
  prepareProjection?: typeof prepareInkProjectionCandidateAcceptance;
  putPublic?: typeof storagePut;
  commit?: typeof commitInkCandidateAcceptance;
  commitProjection?: typeof commitInkProjectionCandidateAcceptance;
  queueCleanup?: typeof queueUnacceptedPublicCopyCleanup;
  completeFailure?: typeof completeDirectOperationFailure;
  requireRecovery?: typeof requireDirectOperationRecovery;
}

export type EvidenceCandidateAcceptedResult =
  | InkCandidateAcceptedResult
  | InkProjectionCandidateAcceptedResult;

function closedAcceptedResult(value: unknown): EvidenceCandidateAcceptedResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: ACCEPT_FAILURE });
  }
  const row = value as Record<string, unknown>;
  const commonInvalid =
    typeof row.candidateId !== "string"
    || row.status !== "accepted"
    || !Number.isSafeInteger(row.modelId)
    || !Number.isSafeInteger(row.assetId)
    || typeof row.identitySnapshotId !== "string"
    || typeof row.packageSnapshotId !== "string"
    || !Number.isSafeInteger(row.stateVersion)
    || row.chargedCredits !== 0;
  const projection = row.purpose === "feature_projection";
  const purposeInvalid = projection
    ? (
        typeof row.targetViewAngle !== "string"
        || !Array.isArray(row.projectedFeatureVersionIds)
        || row.projectedFeatureVersionIds.length < 1
        || row.projectedFeatureVersionIds.some(
          (id) => typeof id !== "string" || !id,
        )
      )
    : (
        typeof row.featureId !== "string"
        || typeof row.featureVersionId !== "string"
      );
  if (commonInvalid || purposeInvalid) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: ACCEPT_FAILURE });
  }
  return row as unknown as EvidenceCandidateAcceptedResult;
}

function publicFailure(error: unknown): TRPCError {
  if (error instanceof InkAcceptanceStateError) {
    return new TRPCError({
      code: error.code === "model_unavailable"
        || error.code === "candidate_unavailable"
        || error.code === "attempt_unavailable"
        ? "NOT_FOUND"
        : "PRECONDITION_FAILED",
      message: ACCEPT_FAILURE,
    });
  }
  if (error instanceof TRPCError) {
    return new TRPCError({ code: error.code, message: ACCEPT_FAILURE });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: ACCEPT_FAILURE });
}

export async function acceptInkAddCandidate(
  dependencies: InkCandidateAcceptanceDependencies,
  input: {
    userId: number;
    candidateId: string;
    clientRequestId: string;
  },
): Promise<EvidenceCandidateAcceptedResult> {
  const enabled = dependencies.enabledForUser ?? captureEvidenceComposerEnabled;
  if (!enabled(input.userId)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Tattoo previews are not available for this account.",
    });
  }
  const subject = await (
    dependencies.findClaimSubject ?? findOwnedInkCandidateClaimSubject
  )({
    userId: input.userId,
    candidateId: input.candidateId,
  });
  if (!subject) {
    throw new TRPCError({ code: "NOT_FOUND", message: ACCEPT_FAILURE });
  }
  const getOutcome = dependencies.getOutcomeByClaim
    ?? getGenerationOperationOutcomeByClaim;
  const existing = await getOutcome({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: "evidence_candidate_accept",
    modelId: subject.modelId,
    payload: { candidateId: input.candidateId },
  });
  if (existing?.type === "replay_success") {
    return closedAcceptedResult(existing.result);
  }
  if (existing?.type === "replay_failure") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: existing.publicMessage });
  }
  if (existing?.type === "payload_conflict") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "That request id was already used for a different action.",
    });
  }
  if (existing?.type === "in_progress") {
    throw new TRPCError({ code: "CONFLICT", message: "This acceptance is already in progress." });
  }
  if (existing?.type === "recovery_required") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: existing.publicMessage });
  }
  if (existing?.type === "deleted_subject") {
    throw new TRPCError({ code: "NOT_FOUND", message: ACCEPT_FAILURE });
  }

  const gate = await (dependencies.begin ?? beginDirectOperation)({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: "evidence_candidate_accept",
    modelId: subject.modelId,
    payload: { candidateId: input.candidateId },
    lockKey: modelOperationLockKey(subject.modelId),
  });
  if (gate.type === "replay") return closedAcceptedResult(gate.result);

  let prepared:
    | PreparedInkCandidateAcceptance
    | PreparedInkProjectionCandidateAcceptance
    | null = null;
  try {
    await (dependencies.markRunning ?? markGenerationOperationRunning)({
      userId: input.userId,
      operationId: gate.operationId,
      modelId: subject.modelId,
      expectedIdentityRevisionId: subject.identityRevisionId,
      plannedCredits: 0,
      requiredLockKey: modelOperationLockKey(subject.modelId),
      phase: "saving",
      heartbeat: false,
    });
    const destination = inkCandidatePublicStorageKey({
      userId: input.userId,
      modelId: subject.modelId,
      candidateId: input.candidateId,
      operationId: gate.operationId,
    });
    prepared = subject.purpose === "feature_projection"
      ? await (
          dependencies.prepareProjection
          ?? prepareInkProjectionCandidateAcceptance
        )({
          userId: input.userId,
          modelId: subject.modelId,
          operationId: gate.operationId,
          candidateId: input.candidateId,
          publicStorageKey: destination,
        })
      : await (dependencies.prepare ?? prepareInkCandidateAcceptance)({
          userId: input.userId,
          modelId: subject.modelId,
          operationId: gate.operationId,
          candidateId: input.candidateId,
          publicStorageKey: destination,
        });
    const bytes = await readCanonicalEvidenceBytesExact(dependencies.delivery, {
      key: prepared.privateStorageKey,
      byteSize: prepared.byteSize,
      contentHash: prepared.contentHash,
    });
    const stored = await (dependencies.putPublic ?? storagePut)(
      prepared.publicStorageKey,
      bytes,
      "image/webp",
    );
    if (
      stored.key !== prepared.publicStorageKey
      || typeof stored.url !== "string"
      || !stored.url.trim()
    ) {
      throw new Error("Public candidate copy was not verified");
    }
    return prepared.kind === "feature_projection"
      ? await (
          dependencies.commitProjection
          ?? commitInkProjectionCandidateAcceptance
        )({
          prepared,
          publicStorageUrl: stored.url,
        })
      : await (dependencies.commit ?? commitInkCandidateAcceptance)({
          prepared,
          publicStorageUrl: stored.url,
        });
  } catch (error) {
    const terminal = await getOutcome({
      userId: input.userId,
      clientRequestId: input.clientRequestId,
      kind: "evidence_candidate_accept",
      modelId: subject.modelId,
      payload: { candidateId: input.candidateId },
    }).catch(() => null);
    if (terminal?.type === "replay_success") {
      return closedAcceptedResult(terminal.result);
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
    if (prepared) {
      try {
        await (dependencies.queueCleanup ?? queueUnacceptedPublicCopyCleanup)({
          userId: input.userId,
          modelId: subject.modelId,
          operationId: gate.operationId,
          publicStorageKey: prepared.publicStorageKey,
        });
      } catch (cleanupError) {
        return (dependencies.requireRecovery ?? requireDirectOperationRecovery)({
          userId: input.userId,
          operationId: gate.operationId,
          chargedCredits: 0,
          refundedCredits: 0,
          cause: cleanupError,
        });
      }
    }
    return (dependencies.completeFailure ?? completeDirectOperationFailure)({
      userId: input.userId,
      operationId: gate.operationId,
      error: publicFailure(error),
      chargedCredits: 0,
      refundedCredits: 0,
    });
  }
}
