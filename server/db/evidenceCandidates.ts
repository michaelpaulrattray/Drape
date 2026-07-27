import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
} from "drizzle-orm";
import {
  castingEvidenceCandidateAttempts,
  castingEvidenceCandidates,
  castingEvidenceIngestions,
  modelIdentityFeatureIntents,
  modelReferencePlates,
  models,
  storageCleanupBatches,
} from "../../drizzle/schema";
import { parseEvidenceStorageKey } from "../casting/evidence/evidenceDelivery";
import { availableModelWhere } from "../casting/modelAvailability";
import { createStorageCleanupManifestIn } from "./storageCleanup";
import { withTransaction, type TransactionHandle } from "./connection";

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return Number((result[0] as { affectedRows?: unknown })?.affectedRows ?? 0);
  }
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

function assertCandidatePrivateKey(input: {
  key: string;
  userId: number;
  modelId: number;
  privatePlateId: string;
}): void {
  const parsed = parseEvidenceStorageKey(input.key);
  if (
    parsed.userId !== input.userId
    || parsed.modelId !== input.modelId
    || parsed.kind !== "candidate"
    || parsed.entityId !== input.privatePlateId
  ) {
    throw new Error("Candidate private-key ownership is invalid");
  }
}

async function lockAvailableModelIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number },
): Promise<void> {
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
  if (!model) throw new Error("Candidate model is unavailable");
}

/**
 * Worker-only expiry primitive. Browser reads never mutate candidate state.
 * The model is locked before candidate/intent rows, and the complete mixed
 * cleanup manifest is durable before any active slot or owned row changes.
 */
export async function expireNextReadyEvidenceCandidate(input: {
  now?: Date;
} = {}): Promise<{
  candidateId: string;
  intentId: string;
  cleanupBatchId: string;
  cleanupObjects: number;
} | null> {
  const now = input.now ?? new Date();
  return withTransaction(async (tx) => {
    const [discovered] = await tx
      .select({
        id: castingEvidenceCandidates.id,
        userId: castingEvidenceCandidates.userId,
        modelId: castingEvidenceCandidates.modelId,
      })
      .from(castingEvidenceCandidates)
      .where(and(
        eq(castingEvidenceCandidates.status, "ready"),
        eq(castingEvidenceCandidates.activeSlot, "active"),
        isNotNull(castingEvidenceCandidates.expiresAt),
        lte(castingEvidenceCandidates.expiresAt, now),
      ))
      .orderBy(asc(castingEvidenceCandidates.id))
      .limit(1);
    if (!discovered) return null;

    await lockAvailableModelIn(tx, discovered);
    const [candidate] = await tx
      .select()
      .from(castingEvidenceCandidates)
      .where(and(
        eq(castingEvidenceCandidates.id, discovered.id),
        eq(castingEvidenceCandidates.userId, discovered.userId),
        eq(castingEvidenceCandidates.modelId, discovered.modelId),
        eq(castingEvidenceCandidates.status, "ready"),
        eq(castingEvidenceCandidates.activeSlot, "active"),
        isNotNull(castingEvidenceCandidates.expiresAt),
        lte(castingEvidenceCandidates.expiresAt, now),
        isNull(castingEvidenceCandidates.cleanupBatchId),
      ))
      .limit(1)
      .for("update");
    if (!candidate) return null;
    const [intent] = await tx
      .select()
      .from(modelIdentityFeatureIntents)
      .where(and(
        eq(modelIdentityFeatureIntents.id, candidate.intentId),
        eq(modelIdentityFeatureIntents.userId, candidate.userId),
        eq(modelIdentityFeatureIntents.modelId, candidate.modelId),
        eq(modelIdentityFeatureIntents.status, "pending"),
        isNotNull(modelIdentityFeatureIntents.activeCapabilityKey),
      ))
      .limit(1)
      .for("update");
    if (!intent) throw new Error("Candidate intent is unavailable");
    const attempts = await tx
      .select()
      .from(castingEvidenceCandidateAttempts)
      .where(eq(castingEvidenceCandidateAttempts.candidateId, candidate.id))
      .orderBy(asc(castingEvidenceCandidateAttempts.attemptNumber))
      .for("update");
    const [reference] = await tx
      .select()
      .from(modelReferencePlates)
      .where(and(
        eq(modelReferencePlates.featureIntentId, intent.id),
        eq(modelReferencePlates.userId, candidate.userId),
        eq(modelReferencePlates.modelId, candidate.modelId),
      ))
      .limit(1)
      .for("update");

    const storageItems: Array<{
      storageKey: string;
      storageBackend: "private_evidence_r2" | "public_r2";
    }> = [];
    for (const attempt of attempts) {
      if (attempt.privateStorageKey) {
        assertCandidatePrivateKey({
          key: attempt.privateStorageKey,
          userId: candidate.userId,
          modelId: candidate.modelId,
          privatePlateId: attempt.privatePlateId,
        });
        storageItems.push({
          storageKey: attempt.privateStorageKey,
          storageBackend: "private_evidence_r2",
        });
      }
      if (attempt.promotedPublicStorageKey) {
        storageItems.push({
          storageKey: attempt.promotedPublicStorageKey,
          storageBackend: "public_r2",
        });
      }
    }
    if (reference) {
      const parsed = parseEvidenceStorageKey(reference.storageKey);
      if (
        parsed.userId !== candidate.userId
        || parsed.modelId !== candidate.modelId
        || parsed.kind !== "plate"
        || parsed.entityId !== reference.id
      ) {
        throw new Error("Candidate reference ownership is invalid");
      }
      storageItems.push({
        storageKey: reference.storageKey,
        storageBackend: "private_evidence_r2",
      });
    }
    const operationId = randomUUID();
    const manifest = await createStorageCleanupManifestIn(tx, {
      id: randomUUID(),
      userId: candidate.userId,
      operationId,
      kind: "candidate_cleanup",
      storageItems,
    });
    if (attempts.length > 0) {
      await tx
        .update(castingEvidenceCandidateAttempts)
        .set({
          status: "cleanup_pending",
          cleanupBatchId: manifest.id,
        })
        .where(and(
          eq(castingEvidenceCandidateAttempts.candidateId, candidate.id),
          inArray(
            castingEvidenceCandidateAttempts.id,
            attempts.map((attempt) => attempt.id),
          ),
        ));
    }
    const candidateUpdated = await tx
      .update(castingEvidenceCandidates)
      .set({
        status: "expired",
        activeSlot: null,
        cleanupBatchId: manifest.id,
        resolvedAt: now,
        resolvedByOperationId: operationId,
      })
      .where(and(
        eq(castingEvidenceCandidates.id, candidate.id),
        eq(castingEvidenceCandidates.status, "ready"),
        eq(castingEvidenceCandidates.activeSlot, "active"),
        isNull(castingEvidenceCandidates.cleanupBatchId),
      ));
    if (affectedRows(candidateUpdated) !== 1) {
      throw new Error("Candidate expiry lost its state race");
    }
    const intentUpdated = await tx
      .update(modelIdentityFeatureIntents)
      .set({
        status: "cancelled",
        activeCapabilityKey: null,
        resolvedCandidateId: candidate.id,
        resolvedByOperationId: operationId,
        resolvedAt: now,
      })
      .where(and(
        eq(modelIdentityFeatureIntents.id, intent.id),
        eq(modelIdentityFeatureIntents.status, "pending"),
        isNotNull(modelIdentityFeatureIntents.activeCapabilityKey),
      ));
    if (affectedRows(intentUpdated) !== 1) {
      throw new Error("Candidate intent expiry lost its state race");
    }
    if (reference) {
      await tx.delete(castingEvidenceIngestions).where(and(
        eq(castingEvidenceIngestions.userId, candidate.userId),
        eq(castingEvidenceIngestions.modelId, candidate.modelId),
        eq(castingEvidenceIngestions.attachedEntityKind, "reference_plate"),
        eq(castingEvidenceIngestions.attachedEntityId, reference.id),
        eq(castingEvidenceIngestions.storageKey, reference.storageKey),
      ));
      const deleted = await tx.delete(modelReferencePlates).where(and(
        eq(modelReferencePlates.id, reference.id),
        eq(modelReferencePlates.userId, candidate.userId),
        eq(modelReferencePlates.modelId, candidate.modelId),
        eq(modelReferencePlates.storageKey, reference.storageKey),
      ));
      if (affectedRows(deleted) !== 1) {
        throw new Error("Candidate reference expiry lost its state race");
      }
    }
    return {
      candidateId: candidate.id,
      intentId: intent.id,
      cleanupBatchId: manifest.id,
      cleanupObjects: manifest.expectedCount,
    };
  });
}

/**
 * A failed first attempt may be deleted while its included retry becomes the
 * active ready result. Scrub that superseded attempt after exact-key deletion
 * without resolving or hiding the still-active candidate.
 */
export async function settleNextCompletedSupersededAttemptCleanup(): Promise<{
  candidateId: string;
  attemptId: string;
  cleanupBatchId: string;
} | null> {
  return withTransaction(async (tx) => {
    const [row] = await tx
      .select({
        attemptId: castingEvidenceCandidateAttempts.id,
        candidateId: castingEvidenceCandidateAttempts.candidateId,
        batchId: storageCleanupBatches.id,
      })
      .from(castingEvidenceCandidateAttempts)
      .innerJoin(
        castingEvidenceCandidates,
        eq(
          castingEvidenceCandidates.id,
          castingEvidenceCandidateAttempts.candidateId,
        ),
      )
      .innerJoin(
        storageCleanupBatches,
        eq(
          storageCleanupBatches.id,
          castingEvidenceCandidateAttempts.cleanupBatchId,
        ),
      )
      .where(and(
        eq(castingEvidenceCandidateAttempts.status, "cleanup_pending"),
        inArray(castingEvidenceCandidates.status, ["processing", "ready"]),
        eq(castingEvidenceCandidates.activeSlot, "active"),
        eq(storageCleanupBatches.kind, "candidate_cleanup"),
        eq(storageCleanupBatches.status, "succeeded"),
      ))
      .orderBy(asc(castingEvidenceCandidateAttempts.createdAt))
      .limit(1)
      .for("update");
    if (!row) return null;
    const scrubbed = await tx
      .update(castingEvidenceCandidateAttempts)
      .set({
        status: "cleaned",
        privateStorageKey: null,
        mime: null,
        width: null,
        height: null,
        byteSize: null,
        contentHash: null,
        promotedPublicStorageKey: null,
      })
      .where(and(
        eq(castingEvidenceCandidateAttempts.id, row.attemptId),
        eq(castingEvidenceCandidateAttempts.candidateId, row.candidateId),
        eq(castingEvidenceCandidateAttempts.status, "cleanup_pending"),
        eq(castingEvidenceCandidateAttempts.cleanupBatchId, row.batchId),
      ));
    if (affectedRows(scrubbed) !== 1) {
      throw new Error("Superseded candidate attempt cleanup lost its state race");
    }
    return {
      candidateId: row.candidateId,
      attemptId: row.attemptId,
      cleanupBatchId: row.batchId,
    };
  });
}

/**
 * Scrub sensitive candidate metadata only after the exact-key worker proves
 * every object in the manifest was deleted.
 */
export async function settleNextCompletedCandidateCleanup(): Promise<{
  candidateId: string;
  cleanupBatchId: string;
} | null> {
  return withTransaction(async (tx) => {
    const [row] = await tx
      .select({
        candidate: castingEvidenceCandidates,
        batchId: storageCleanupBatches.id,
      })
      .from(castingEvidenceCandidates)
      .innerJoin(
        storageCleanupBatches,
        eq(storageCleanupBatches.id, castingEvidenceCandidates.cleanupBatchId),
      )
      .where(and(
        inArray(castingEvidenceCandidates.status, [
          "rejected",
          "cancelled",
          "expired",
          "invalid",
        ]),
        eq(storageCleanupBatches.kind, "candidate_cleanup"),
        eq(storageCleanupBatches.status, "succeeded"),
      ))
      .orderBy(asc(castingEvidenceCandidates.resolvedAt))
      .limit(1)
      .for("update");
    if (!row) return null;
    const [intent] = await tx
      .select({ id: modelIdentityFeatureIntents.id })
      .from(modelIdentityFeatureIntents)
      .where(and(
        eq(modelIdentityFeatureIntents.id, row.candidate.intentId),
        eq(modelIdentityFeatureIntents.userId, row.candidate.userId),
        eq(modelIdentityFeatureIntents.modelId, row.candidate.modelId),
      ))
      .limit(1)
      .for("update");
    if (!intent) throw new Error("Candidate cleanup intent is unavailable");
    await tx
      .update(castingEvidenceCandidateAttempts)
      .set({
        status: "cleaned",
        privateStorageKey: null,
        mime: null,
        width: null,
        height: null,
        byteSize: null,
        contentHash: null,
        promotedPublicStorageKey: null,
      })
      .where(and(
        eq(castingEvidenceCandidateAttempts.candidateId, row.candidate.id),
        eq(castingEvidenceCandidateAttempts.status, "cleanup_pending"),
        eq(castingEvidenceCandidateAttempts.cleanupBatchId, row.batchId),
      ));
    const scrubbed = await tx
      .update(modelIdentityFeatureIntents)
      .set({ normalizedDescriptor: null })
      .where(eq(modelIdentityFeatureIntents.id, intent.id));
    if (affectedRows(scrubbed) !== 1) {
      throw new Error("Candidate cleanup scrubbing lost its state race");
    }
    return { candidateId: row.candidate.id, cleanupBatchId: row.batchId };
  });
}
