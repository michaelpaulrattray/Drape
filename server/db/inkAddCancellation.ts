import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import {
  castingEvidenceCandidateAttempts,
  castingEvidenceCandidates,
  castingEvidenceIngestions,
  generationOperationLocks,
  generationOperations,
  modelIdentityFeatureIntents,
  modelReferencePlates,
  models,
} from "../../drizzle/schema";
import { INK_ADD_CAPABILITY_KEY } from "../casting/evidence/evidenceCandidateContract";
import { parseEvidenceStorageKey } from "../casting/evidence/evidenceDelivery";
import { parseInkCandidatePublicStorageKey } from "../casting/evidence/inkCandidatePublicStorage";
import { availableModelWhere } from "../casting/modelAvailability";
import { modelOperationLockKey } from "../casting/operationContract";
import { withTransaction } from "./connection";
import { finalizeRunningGenerationOperationSuccessIn } from "./generationOperations";
import { createStorageCleanupManifestIn } from "./storageCleanup";

export class InkCancellationStateError extends Error {
  constructor(public readonly code:
    | "intent_unavailable"
    | "model_unavailable"
    | "operation_unavailable"
    | "candidate_unavailable") {
    super("The tattoo request could not be cancelled.");
    this.name = "InkCancellationStateError";
  }
}

export interface InkIntentCancelledResult {
  intentId: string;
  candidateId: string | null;
  status: "cancelled";
  cleanupObjects: number;
  chargedCredits: 0;
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return Number((result[0] as { affectedRows?: unknown })?.affectedRows ?? 0);
  }
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

export async function commitCancelInkAddIntent(input: {
  userId: number;
  modelId: number;
  intentId: string;
  operationId: string;
  now?: Date;
}): Promise<InkIntentCancelledResult> {
  const cancelledAt = input.now ?? new Date();
  return withTransaction(async (tx) => {
    const [model] = await tx
      .select({ id: models.id })
      .from(models)
      .where(and(
        eq(models.id, input.modelId),
        eq(models.userId, input.userId),
        availableModelWhere(),
      ))
      .limit(1)
      .for("update");
    if (!model) throw new InkCancellationStateError("model_unavailable");
    const [operation] = await tx
      .select({ id: generationOperations.id })
      .from(generationOperations)
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.modelId, input.modelId),
        eq(generationOperations.kind, "evidence_candidate_cancel"),
        eq(generationOperations.status, "running"),
        eq(generationOperations.plannedCredits, 0),
      ))
      .limit(1)
      .for("update");
    if (!operation) throw new InkCancellationStateError("operation_unavailable");
    const [lock] = await tx
      .select({ operationId: generationOperationLocks.operationId })
      .from(generationOperationLocks)
      .where(eq(
        generationOperationLocks.lockKey,
        modelOperationLockKey(input.modelId),
      ))
      .limit(1)
      .for("update");
    if (lock?.operationId !== input.operationId) {
      throw new InkCancellationStateError("operation_unavailable");
    }
    const [candidate] = await tx
      .select()
      .from(castingEvidenceCandidates)
      .where(and(
        eq(castingEvidenceCandidates.userId, input.userId),
        eq(castingEvidenceCandidates.modelId, input.modelId),
        eq(castingEvidenceCandidates.intentId, input.intentId),
        eq(castingEvidenceCandidates.status, "ready"),
        eq(castingEvidenceCandidates.activeSlot, "active"),
        isNull(castingEvidenceCandidates.cleanupBatchId),
      ))
      .limit(1)
      .for("update");
    const [intent] = await tx
      .select()
      .from(modelIdentityFeatureIntents)
      .where(and(
        eq(modelIdentityFeatureIntents.id, input.intentId),
        eq(modelIdentityFeatureIntents.userId, input.userId),
        eq(modelIdentityFeatureIntents.modelId, input.modelId),
        eq(modelIdentityFeatureIntents.capabilityKey, INK_ADD_CAPABILITY_KEY),
        eq(modelIdentityFeatureIntents.activeCapabilityKey, INK_ADD_CAPABILITY_KEY),
        eq(modelIdentityFeatureIntents.status, "pending"),
      ))
      .limit(1)
      .for("update");
    if (!intent) throw new InkCancellationStateError("intent_unavailable");
    const attempts = candidate
      ? await tx
        .select()
        .from(castingEvidenceCandidateAttempts)
        .where(eq(castingEvidenceCandidateAttempts.candidateId, candidate.id))
        .orderBy(asc(castingEvidenceCandidateAttempts.attemptNumber))
        .for("update")
      : [];
    const [reference] = await tx
      .select()
      .from(modelReferencePlates)
      .where(and(
        eq(modelReferencePlates.featureIntentId, intent.id),
        eq(modelReferencePlates.userId, input.userId),
        eq(modelReferencePlates.modelId, input.modelId),
        eq(modelReferencePlates.kind, "uploaded_reference"),
      ))
      .limit(1)
      .for("update");

    const storageItems = new Map<string, {
      storageKey: string;
      storageBackend: "private_evidence_r2" | "public_r2";
    }>();
    for (const attempt of attempts) {
      if (attempt.privateStorageKey) {
        const parsed = parseEvidenceStorageKey(attempt.privateStorageKey);
        if (
          parsed.userId !== input.userId
          || parsed.modelId !== input.modelId
          || parsed.kind !== "candidate"
          || parsed.entityId !== attempt.privatePlateId
        ) {
          throw new InkCancellationStateError("candidate_unavailable");
        }
        storageItems.set(`private:${attempt.privateStorageKey}`, {
          storageKey: attempt.privateStorageKey,
          storageBackend: "private_evidence_r2",
        });
      }
      if (attempt.promotedPublicStorageKey) {
        const parsed = parseInkCandidatePublicStorageKey(
          attempt.promotedPublicStorageKey,
        );
        if (
          parsed.userId !== input.userId
          || parsed.modelId !== input.modelId
          || parsed.candidateId !== candidate?.id
        ) {
          throw new InkCancellationStateError("candidate_unavailable");
        }
        storageItems.set(`public:${attempt.promotedPublicStorageKey}`, {
          storageKey: attempt.promotedPublicStorageKey,
          storageBackend: "public_r2",
        });
      }
    }
    if (reference) {
      const parsed = parseEvidenceStorageKey(reference.storageKey);
      if (
        parsed.userId !== input.userId
        || parsed.modelId !== input.modelId
        || parsed.kind !== "plate"
        || parsed.entityId !== reference.id
      ) {
        throw new InkCancellationStateError("intent_unavailable");
      }
      storageItems.set(`private:${reference.storageKey}`, {
        storageKey: reference.storageKey,
        storageBackend: "private_evidence_r2",
      });
    }
    const manifest = await createStorageCleanupManifestIn(tx, {
      id: randomUUID(),
      userId: input.userId,
      operationId: input.operationId,
      kind: "candidate_cleanup",
      storageItems: Array.from(storageItems.values()),
    });
    if (attempts.length > 0) {
      const attemptsQueued = await tx
        .update(castingEvidenceCandidateAttempts)
        .set({ status: "cleanup_pending", cleanupBatchId: manifest.id })
        .where(and(
          eq(castingEvidenceCandidateAttempts.candidateId, candidate!.id),
          inArray(
            castingEvidenceCandidateAttempts.id,
            attempts.map((attempt) => attempt.id),
          ),
        ));
      if (affectedRows(attemptsQueued) !== attempts.length) {
        throw new InkCancellationStateError("candidate_unavailable");
      }
    }
    if (candidate) {
      const candidateCancelled = await tx
        .update(castingEvidenceCandidates)
        .set({
          status: "cancelled",
          activeSlot: null,
          cleanupBatchId: manifest.id,
          resolvedAt: cancelledAt,
          resolvedByOperationId: input.operationId,
        })
        .where(and(
          eq(castingEvidenceCandidates.id, candidate.id),
          eq(castingEvidenceCandidates.status, "ready"),
          eq(castingEvidenceCandidates.activeSlot, "active"),
          isNull(castingEvidenceCandidates.cleanupBatchId),
        ));
      if (affectedRows(candidateCancelled) !== 1) {
        throw new InkCancellationStateError("candidate_unavailable");
      }
    }
    const intentCancelled = await tx
      .update(modelIdentityFeatureIntents)
      .set({
        status: "cancelled",
        activeCapabilityKey: null,
        resolvedCandidateId: candidate?.id ?? null,
        resolvedByOperationId: input.operationId,
        resolvedAt: cancelledAt,
      })
      .where(and(
        eq(modelIdentityFeatureIntents.id, intent.id),
        eq(modelIdentityFeatureIntents.status, "pending"),
        isNotNull(modelIdentityFeatureIntents.activeCapabilityKey),
      ));
    if (affectedRows(intentCancelled) !== 1) {
      throw new InkCancellationStateError("intent_unavailable");
    }
    if (reference) {
      await tx.delete(castingEvidenceIngestions).where(and(
        eq(castingEvidenceIngestions.userId, input.userId),
        eq(castingEvidenceIngestions.modelId, input.modelId),
        eq(castingEvidenceIngestions.attachedEntityKind, "reference_plate"),
        eq(castingEvidenceIngestions.attachedEntityId, reference.id),
        eq(castingEvidenceIngestions.storageKey, reference.storageKey),
      ));
      const removedReference = await tx
        .delete(modelReferencePlates)
        .where(and(
          eq(modelReferencePlates.id, reference.id),
          eq(modelReferencePlates.userId, input.userId),
          eq(modelReferencePlates.modelId, input.modelId),
          eq(modelReferencePlates.featureIntentId, intent.id),
          eq(modelReferencePlates.storageKey, reference.storageKey),
        ));
      if (affectedRows(removedReference) !== 1) {
        throw new InkCancellationStateError("intent_unavailable");
      }
    }
    const result: InkIntentCancelledResult = {
      intentId: intent.id,
      candidateId: candidate?.id ?? null,
      status: "cancelled",
      cleanupObjects: manifest.expectedCount,
      chargedCredits: 0,
    };
    await finalizeRunningGenerationOperationSuccessIn(tx, {
      userId: input.userId,
      operationId: input.operationId,
      result,
    });
    return result;
  });
}
