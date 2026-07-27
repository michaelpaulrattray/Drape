import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  castingEvidenceCandidateAttempts,
  castingEvidenceCandidates,
  generationOperationLocks,
  generationOperations,
  modelIdentityFeatureIntents,
  modelPackageSnapshotSlots,
  modelReferencePlates,
  modelSnapshotFeatureSelections,
  models,
  storageCleanupBatches,
  storageCleanupItems,
} from "../../drizzle/schema";
import { INK_ADD_CAPABILITY_KEY } from "../casting/evidence/evidenceCandidateContract";
import { parseEvidenceStorageKey } from "../casting/evidence/evidenceDelivery";
import { parseInkCandidatePublicStorageKey } from "../casting/evidence/inkCandidatePublicStorage";
import { INK_ADD_TARGET_VIEW } from "../casting/evidence/composer/inkAddRecipe";
import { availableModelWhere } from "../casting/modelAvailability";
import { modelOperationLockKey } from "../casting/operationContract";
import { createStorageCleanupManifestIn } from "./storageCleanup";
import { getDb, withTransaction, type TransactionHandle } from "./connection";

export const INK_ACCEPT_PUBLIC_MESSAGE =
  "The tattoo preview could not be accepted. Your Cast was not changed.";

export class InkAcceptanceStateError extends Error {
  constructor(public readonly code:
    | "candidate_unavailable"
    | "model_unavailable"
    | "operation_unavailable"
    | "snapshot_head_changed"
    | "feature_already_selected"
    | "attempt_unavailable"
    | "public_key_changed") {
    super(INK_ACCEPT_PUBLIC_MESSAGE);
    this.name = "InkAcceptanceStateError";
  }
}

export interface PreparedInkCandidateAcceptance {
  userId: number;
  modelId: number;
  operationId: string;
  candidateId: string;
  intentId: string;
  attemptId: string;
  privatePlateId: string;
  privateStorageKey: string;
  byteSize: number;
  contentHash: string;
  width: number;
  height: number;
  publicStorageKey: string;
  expectedStateVersion: number;
  identitySnapshotId: string;
  packageSnapshotId: string;
  sourceAssetId: number;
  sourceReferencePlateId: string | null;
  ontologyVersion: string;
  zone: string;
  surface: string;
  side: string;
  normalizedDescriptor: string;
  composerRecipeVersion: string;
  actualImageEngine: string;
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return Number((result[0] as { affectedRows?: unknown } | undefined)?.affectedRows ?? 0);
  }
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

async function reusableReservedPublicKeyIn(
  tx: TransactionHandle,
  input: {
    key: string;
    userId: number;
    modelId: number;
    candidateId: string;
  },
): Promise<string> {
  let parsed;
  try {
    parsed = parseInkCandidatePublicStorageKey(input.key);
  } catch {
    throw new InkAcceptanceStateError("public_key_changed");
  }
  if (
    parsed.userId !== input.userId
    || parsed.modelId !== input.modelId
    || parsed.candidateId !== input.candidateId
  ) {
    throw new InkAcceptanceStateError("public_key_changed");
  }
  const [failedReservationOwner] = await tx
    .select({ id: generationOperations.id })
    .from(generationOperations)
    .where(and(
      eq(generationOperations.id, parsed.operationId),
      eq(generationOperations.userId, input.userId),
      eq(generationOperations.modelId, input.modelId),
      eq(generationOperations.kind, "evidence_candidate_accept"),
      eq(generationOperations.status, "failed"),
    ))
    .limit(1)
    .for("update");
  if (!failedReservationOwner) {
    throw new InkAcceptanceStateError("public_key_changed");
  }
  const [unsettledItem] = await tx
    .select({ id: storageCleanupItems.id })
    .from(storageCleanupItems)
    .where(and(
      eq(storageCleanupItems.storageBackend, "public_r2"),
      eq(storageCleanupItems.storageKey, input.key),
    ))
    .limit(1)
    .for("update");
  if (unsettledItem) {
    throw new InkAcceptanceStateError("public_key_changed");
  }
  const [cleanup] = await tx
    .select({
      status: storageCleanupBatches.status,
      expectedCount: storageCleanupBatches.expectedCount,
      deletedCount: storageCleanupBatches.deletedCount,
      failedCount: storageCleanupBatches.failedCount,
    })
    .from(storageCleanupBatches)
    .where(and(
      eq(storageCleanupBatches.operationId, parsed.operationId),
      eq(storageCleanupBatches.userId, input.userId),
      eq(storageCleanupBatches.kind, "candidate_cleanup"),
    ))
    .limit(1)
    .for("update");
  if (
    cleanup
    && (
      cleanup.status !== "succeeded"
      || cleanup.expectedCount !== cleanup.deletedCount
      || cleanup.failedCount !== 0
    )
  ) {
    throw new InkAcceptanceStateError("public_key_changed");
  }
  return input.key;
}

export async function findOwnedInkCandidateClaimSubject(input: {
  userId: number;
  candidateId: string;
}): Promise<{ modelId: number; identityRevisionId: string | null } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [subject] = await db
    .select({
      modelId: models.id,
      identityRevisionId: models.identityRevisionId,
    })
    .from(castingEvidenceCandidates)
    .innerJoin(models, and(
      eq(models.id, castingEvidenceCandidates.modelId),
      eq(models.userId, input.userId),
      availableModelWhere(),
    ))
    .where(and(
      eq(castingEvidenceCandidates.id, input.candidateId),
      eq(castingEvidenceCandidates.userId, input.userId),
    ))
    .limit(1);
  return subject ?? null;
}

export async function prepareInkCandidateAcceptance(input: {
  userId: number;
  modelId: number;
  operationId: string;
  candidateId: string;
  publicStorageKey: string;
  now?: Date;
}): Promise<PreparedInkCandidateAcceptance> {
  return withTransaction(async (tx) => {
    const [model] = await tx
      .select()
      .from(models)
      .where(and(
        eq(models.id, input.modelId),
        eq(models.userId, input.userId),
        eq(models.status, "draft"),
        isNull(models.deletedAt),
      ))
      .limit(1)
      .for("update");
    if (!model) throw new InkAcceptanceStateError("model_unavailable");
    const [operation] = await tx
      .select()
      .from(generationOperations)
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.modelId, input.modelId),
        eq(generationOperations.kind, "evidence_candidate_accept"),
        eq(generationOperations.status, "running"),
        eq(generationOperations.plannedCredits, 0),
      ))
      .limit(1)
      .for("update");
    if (!operation) throw new InkAcceptanceStateError("operation_unavailable");
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
      throw new InkAcceptanceStateError("operation_unavailable");
    }
    if (
      operation.expectedStateVersion !== model.stateVersion
      || operation.expectedPackageSnapshotId !== model.currentPackageSnapshotId
    ) {
      throw new InkAcceptanceStateError("snapshot_head_changed");
    }
    const [candidate] = await tx
      .select()
      .from(castingEvidenceCandidates)
      .where(and(
        eq(castingEvidenceCandidates.id, input.candidateId),
        eq(castingEvidenceCandidates.userId, input.userId),
        eq(castingEvidenceCandidates.modelId, input.modelId),
        eq(castingEvidenceCandidates.status, "ready"),
        eq(castingEvidenceCandidates.activeSlot, "active"),
        gt(castingEvidenceCandidates.expiresAt, input.now ?? new Date()),
      ))
      .limit(1)
      .for("update");
    if (!candidate?.readyAttemptId) {
      throw new InkAcceptanceStateError("candidate_unavailable");
    }
    const [intent] = await tx
      .select()
      .from(modelIdentityFeatureIntents)
      .where(and(
        eq(modelIdentityFeatureIntents.id, candidate.intentId),
        eq(modelIdentityFeatureIntents.userId, input.userId),
        eq(modelIdentityFeatureIntents.modelId, input.modelId),
        eq(modelIdentityFeatureIntents.status, "pending"),
        eq(modelIdentityFeatureIntents.activeCapabilityKey, INK_ADD_CAPABILITY_KEY),
      ))
      .limit(1)
      .for("update");
    if (!intent?.normalizedDescriptor) {
      throw new InkAcceptanceStateError("candidate_unavailable");
    }
    const [attempt] = await tx
      .select()
      .from(castingEvidenceCandidateAttempts)
      .where(and(
        eq(castingEvidenceCandidateAttempts.id, candidate.readyAttemptId),
        eq(castingEvidenceCandidateAttempts.candidateId, candidate.id),
        eq(castingEvidenceCandidateAttempts.status, "probe_passed"),
        eq(castingEvidenceCandidateAttempts.overallOutcome, "pass"),
      ))
      .limit(1)
      .for("update");
    if (
      !attempt?.privateStorageKey
      || !attempt.byteSize
      || !attempt.contentHash
      || !attempt.width
      || !attempt.height
      || attempt.mime !== "image/webp"
    ) {
      throw new InkAcceptanceStateError("attempt_unavailable");
    }
    const parsed = parseEvidenceStorageKey(attempt.privateStorageKey);
    if (
      parsed.userId !== input.userId
      || parsed.modelId !== input.modelId
      || parsed.kind !== "candidate"
      || parsed.entityId !== attempt.privatePlateId
    ) {
      throw new InkAcceptanceStateError("attempt_unavailable");
    }
    if (
      candidate.expectedStateVersion !== model.stateVersion
      || candidate.identitySnapshotId !== operation.expectedIdentitySnapshotId
      || candidate.packageSnapshotId !== model.currentPackageSnapshotId
      || intent.identitySnapshotId !== candidate.identitySnapshotId
      || intent.packageSnapshotId !== candidate.packageSnapshotId
      || intent.sourceAssetId !== candidate.sourceAssetId
    ) {
      throw new InkAcceptanceStateError("snapshot_head_changed");
    }
    const [sourceSlot] = await tx
      .select({ selectedAssetId: modelPackageSnapshotSlots.selectedAssetId })
      .from(modelPackageSnapshotSlots)
      .where(and(
        eq(modelPackageSnapshotSlots.packageSnapshotId, candidate.packageSnapshotId),
        eq(modelPackageSnapshotSlots.viewAngle, INK_ADD_TARGET_VIEW),
        eq(modelPackageSnapshotSlots.selectedAssetId, candidate.sourceAssetId),
        eq(modelPackageSnapshotSlots.compatibility, "current"),
      ))
      .limit(1);
    if (!sourceSlot) throw new InkAcceptanceStateError("snapshot_head_changed");
    const [selectedFeature] = await tx
      .select({ id: modelSnapshotFeatureSelections.id })
      .from(modelSnapshotFeatureSelections)
      .where(and(
        eq(modelSnapshotFeatureSelections.modelId, input.modelId),
        eq(
          modelSnapshotFeatureSelections.identitySnapshotId,
          candidate.identitySnapshotId,
        ),
      ))
      .limit(1)
      .for("update");
    if (selectedFeature) {
      throw new InkAcceptanceStateError("feature_already_selected");
    }
    let publicStorageKey = input.publicStorageKey;
    if (
      attempt.promotedPublicStorageKey
      && attempt.promotedPublicStorageKey !== input.publicStorageKey
    ) {
      publicStorageKey = await reusableReservedPublicKeyIn(tx, {
        key: attempt.promotedPublicStorageKey,
        userId: input.userId,
        modelId: input.modelId,
        candidateId: candidate.id,
      });
    }
    if (!attempt.promotedPublicStorageKey) {
      const reserved = await tx
        .update(castingEvidenceCandidateAttempts)
        .set({ promotedPublicStorageKey: input.publicStorageKey })
        .where(and(
          eq(castingEvidenceCandidateAttempts.id, attempt.id),
          isNull(castingEvidenceCandidateAttempts.promotedPublicStorageKey),
          eq(castingEvidenceCandidateAttempts.status, "probe_passed"),
        ));
      if (affectedRows(reserved) !== 1) {
        throw new InkAcceptanceStateError("public_key_changed");
      }
    }
    const [sourceReference] = await tx
      .select({ id: modelReferencePlates.id })
      .from(modelReferencePlates)
      .where(and(
        eq(modelReferencePlates.featureIntentId, intent.id),
        eq(modelReferencePlates.userId, input.userId),
        eq(modelReferencePlates.modelId, input.modelId),
        eq(modelReferencePlates.kind, "uploaded_reference"),
      ))
      .limit(1)
      .for("update");
    return {
      userId: input.userId,
      modelId: input.modelId,
      operationId: input.operationId,
      candidateId: candidate.id,
      intentId: intent.id,
      attemptId: attempt.id,
      privatePlateId: attempt.privatePlateId,
      privateStorageKey: attempt.privateStorageKey,
      byteSize: attempt.byteSize,
      contentHash: attempt.contentHash,
      width: attempt.width,
      height: attempt.height,
      publicStorageKey,
      expectedStateVersion: candidate.expectedStateVersion,
      identitySnapshotId: candidate.identitySnapshotId,
      packageSnapshotId: candidate.packageSnapshotId,
      sourceAssetId: candidate.sourceAssetId,
      sourceReferencePlateId: sourceReference?.id ?? null,
      ontologyVersion: intent.ontologyVersion,
      zone: intent.zone,
      surface: intent.surface,
      side: intent.side,
      normalizedDescriptor: intent.normalizedDescriptor,
      composerRecipeVersion: candidate.composerRecipeVersion,
      actualImageEngine: attempt.actualImageEngine,
    };
  });
}

export async function queueUnacceptedPublicCopyCleanup(input: {
  userId: number;
  modelId: number;
  operationId: string;
  publicStorageKey: string;
}): Promise<void> {
  await withTransaction(async (tx) => {
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
    if (!model) return;
    const [existing] = await tx
      .select({ id: storageCleanupBatches.id })
      .from(storageCleanupBatches)
      .where(eq(storageCleanupBatches.operationId, input.operationId))
      .limit(1)
      .for("update");
    if (existing) return;
    await createStorageCleanupManifestIn(tx, {
      id: randomUUID(),
      userId: input.userId,
      operationId: input.operationId,
      kind: "candidate_cleanup",
      storageItems: [{
        storageKey: input.publicStorageKey,
        storageBackend: "public_r2",
      }],
    });
  });
}
