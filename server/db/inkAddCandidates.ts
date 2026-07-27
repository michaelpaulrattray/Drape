import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  castingEvidenceCandidateAttempts,
  castingEvidenceCandidates,
  generationOperationLocks,
  generationOperations,
  generations,
  modelIdentityFeatureIntents,
  modelPackageSnapshotSlots,
  modelReferencePlates,
  modelSnapshotFeatureSelections,
  models,
} from "../../drizzle/schema";
import {
  INK_ADD_CAPABILITY_KEY,
  INK_ADD_PRICE_CREDITS,
  type EvidenceProbeOutcome,
} from "../casting/evidence/evidenceCandidateContract";
import {
  INK_ADD_COMPOSER_RECIPE_VERSION,
  INK_ADD_IMAGE_ENGINE,
  INK_ADD_PROBE_MODEL,
  INK_ADD_PROBE_RECIPE_VERSION,
  INK_ADD_TARGET_VIEW,
  type InkAddSide,
} from "../casting/evidence/composer/inkAddRecipe";
import type { InkCandidateProbeTruth } from "../casting/evidence/composer/inkProbe";
import {
  buildEvidenceCandidateStorageKey,
  parseEvidenceStorageKey,
} from "../casting/evidence/evidenceDelivery";
import { availableModelWhere } from "../casting/modelAvailability";
import { modelOperationLockKey } from "../casting/operationContract";
import { buildEffectiveCastState } from "../casting/effectiveCastState";
import { readSnapshotShadowStateIn } from "../casting/snapshotShadow";
import { createStorageCleanupManifestIn } from "./storageCleanup";
import { withTransaction, type TransactionHandle } from "./connection";

export const INK_CANDIDATE_PUBLIC_FAILURE =
  "The tattoo preview could not be created. Any charged credits were refunded.";

export type InkCandidateStateCode =
  | "model_unavailable"
  | "operation_unavailable"
  | "intent_unavailable"
  | "candidate_unavailable"
  | "snapshot_head_changed"
  | "source_unavailable"
  | "feature_already_selected"
  | "candidate_already_active"
  | "attempt_unavailable"
  | "attempt_state_changed";

export class InkCandidateStateError extends Error {
  constructor(public readonly code: InkCandidateStateCode) {
    super(INK_CANDIDATE_PUBLIC_FAILURE);
    this.name = "InkCandidateStateError";
  }
}

export interface PreparedInkCandidateAttempt {
  userId: number;
  modelId: number;
  operationId: string;
  operationKind: "evidence_candidate_generate" | "evidence_candidate_retry";
  candidateId: string;
  intentId: string;
  attemptId: string;
  attemptNumber: 1 | 2;
  generationId: number;
  privatePlateId: string;
  privateStorageKey: string;
  identitySnapshotId: string;
  packageSnapshotId: string;
  expectedStateVersion: number;
  sourceAssetId: number;
  sourceUrl: string;
  anchorUrl: string;
  identityText: string;
  side: InkAddSide;
  normalizedDescriptor: string;
  reference: null | {
    plateId: string;
    storageKey: string;
    byteSize: number;
    contentHash: string;
  };
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return Number((result[0] as { affectedRows?: unknown })?.affectedRows ?? 0);
  }
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

async function lockOwnedDraftModelIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number },
) {
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
  if (!model) throw new InkCandidateStateError("model_unavailable");
  return model;
}

async function lockRunningOperationIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    modelId: number;
    operationId: string;
    operationKind: PreparedInkCandidateAttempt["operationKind"];
  },
) {
  const [operation] = await tx
    .select()
    .from(generationOperations)
    .where(and(
      eq(generationOperations.id, input.operationId),
      eq(generationOperations.userId, input.userId),
      eq(generationOperations.modelId, input.modelId),
      eq(generationOperations.kind, input.operationKind),
      eq(generationOperations.status, "running"),
      eq(generationOperations.plannedCredits, INK_ADD_PRICE_CREDITS),
    ))
    .limit(1)
    .for("update");
  if (!operation) throw new InkCandidateStateError("operation_unavailable");
  const [lock] = await tx
    .select({ operationId: generationOperationLocks.operationId })
    .from(generationOperationLocks)
    .where(and(
      eq(generationOperationLocks.lockKey, modelOperationLockKey(input.modelId)),
      eq(generationOperationLocks.operationId, input.operationId),
      eq(generationOperationLocks.kind, input.operationKind),
    ))
    .limit(1)
    .for("update");
  if (!lock) throw new InkCandidateStateError("operation_unavailable");
  return operation;
}

function assertOperationHead(
  operation: {
    expectedStateVersion: number | null;
    expectedIdentitySnapshotId: string | null;
    expectedPackageSnapshotId: string | null;
  },
  input: {
    stateVersion: number;
    identitySnapshotId: string;
    packageSnapshotId: string;
  },
): void {
  if (
    operation.expectedStateVersion !== input.stateVersion
    || operation.expectedIdentitySnapshotId !== input.identitySnapshotId
    || operation.expectedPackageSnapshotId !== input.packageSnapshotId
  ) {
    throw new InkCandidateStateError("snapshot_head_changed");
  }
}

async function createAttemptIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    modelId: number;
    operationId: string;
    candidateId: string;
    attemptId: string;
    attemptNumber: 1 | 2;
    privatePlateId: string;
  },
): Promise<{ generationId: number; privateStorageKey: string }> {
  const privateStorageKey = buildEvidenceCandidateStorageKey({
    userId: input.userId,
    modelId: input.modelId,
    privatePlateId: input.privatePlateId,
  });
  const [inserted] = await tx
    .insert(generations)
    .values({
      userId: input.userId,
      modelId: input.modelId,
      operationId: input.operationId,
      stepKey: `attempt:${input.attemptNumber}`,
      viewAngle: INK_ADD_TARGET_VIEW,
      type: "evidenceCandidate",
      status: "pending",
      pointsCost: input.attemptNumber === 1 ? INK_ADD_PRICE_CREDITS : 0,
      resultUrl: null,
      metadata: {
        candidateId: input.candidateId,
        attemptNumber: input.attemptNumber,
        billingRole: input.attemptNumber === 1
          ? "charged_attempt"
          : "included_retry",
        engine: INK_ADD_IMAGE_ENGINE,
        recipeVersion: INK_ADD_COMPOSER_RECIPE_VERSION,
      },
    })
    .$returningId();
  await tx.insert(castingEvidenceCandidateAttempts).values({
    id: input.attemptId,
    candidateId: input.candidateId,
    attemptNumber: input.attemptNumber,
    generationId: inserted.id,
    status: "planned",
    privatePlateId: input.privatePlateId,
    privateStorageKey,
    actualImageEngine: INK_ADD_IMAGE_ENGINE,
    composerRecipeVersion: INK_ADD_COMPOSER_RECIPE_VERSION,
    probeModel: INK_ADD_PROBE_MODEL,
    probeRecipeVersion: INK_ADD_PROBE_RECIPE_VERSION,
  });
  return { generationId: inserted.id, privateStorageKey };
}

async function rejectReadyCandidateForRetryIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    modelId: number;
    intentId: string;
    operationId: string;
  },
): Promise<void> {
  const [candidate] = await tx
    .select()
    .from(castingEvidenceCandidates)
    .where(and(
      eq(castingEvidenceCandidates.userId, input.userId),
      eq(castingEvidenceCandidates.modelId, input.modelId),
      eq(castingEvidenceCandidates.intentId, input.intentId),
      eq(castingEvidenceCandidates.status, "ready"),
      eq(castingEvidenceCandidates.activeSlot, "active"),
    ))
    .limit(1)
    .for("update");
  if (!candidate) throw new InkCandidateStateError("candidate_unavailable");
  const attempts = await tx
    .select()
    .from(castingEvidenceCandidateAttempts)
    .where(eq(castingEvidenceCandidateAttempts.candidateId, candidate.id))
    .orderBy(asc(castingEvidenceCandidateAttempts.attemptNumber))
    .for("update");
  const storageItems = attempts
    .filter((attempt) => attempt.privateStorageKey !== null)
    .map((attempt) => {
      const parsed = parseEvidenceStorageKey(attempt.privateStorageKey!);
      if (
        parsed.userId !== input.userId
        || parsed.modelId !== input.modelId
        || parsed.kind !== "candidate"
        || parsed.entityId !== attempt.privatePlateId
      ) {
        throw new InkCandidateStateError("attempt_unavailable");
      }
      return {
        storageKey: attempt.privateStorageKey!,
        storageBackend: "private_evidence_r2" as const,
      };
    });
  const manifest = await createStorageCleanupManifestIn(tx, {
    id: randomUUID(),
    userId: input.userId,
    operationId: randomUUID(),
    kind: "candidate_cleanup",
    storageItems,
  });
  if (attempts.length > 0) {
    await tx
      .update(castingEvidenceCandidateAttempts)
      .set({ status: "cleanup_pending", cleanupBatchId: manifest.id })
      .where(eq(castingEvidenceCandidateAttempts.candidateId, candidate.id));
  }
  const updated = await tx
    .update(castingEvidenceCandidates)
    .set({
      status: "rejected",
      activeSlot: null,
      cleanupBatchId: manifest.id,
      resolvedAt: new Date(),
      resolvedByOperationId: input.operationId,
    })
    .where(and(
      eq(castingEvidenceCandidates.id, candidate.id),
      eq(castingEvidenceCandidates.status, "ready"),
      eq(castingEvidenceCandidates.activeSlot, "active"),
    ));
  if (affectedRows(updated) !== 1) {
    throw new InkCandidateStateError("candidate_unavailable");
  }
}

/**
 * Reserve the complete paid episode and its first exact-key attempt while the
 * model/operation lock is held. No provider, storage, or credit work happens
 * in this transaction.
 */
export async function prepareInkCandidateGeneration(input: {
  userId: number;
  modelId: number;
  intentId: string;
  operationId: string;
  operationKind: PreparedInkCandidateAttempt["operationKind"];
  candidateId: string;
  attemptId: string;
  privatePlateId: string;
}): Promise<PreparedInkCandidateAttempt> {
  return withTransaction(async (tx) => {
    const model = await lockOwnedDraftModelIn(tx, input);
    const operation = await lockRunningOperationIn(tx, input);

    let state;
    try {
      state = buildEffectiveCastState({
        ...(await readSnapshotShadowStateIn(tx, input)),
        model,
      });
    } catch {
      throw new InkCandidateStateError("snapshot_head_changed");
    }
    if (state.status !== "current" || !state.identity || !state.package) {
      throw new InkCandidateStateError("snapshot_head_changed");
    }
    assertOperationHead(operation, {
      stateVersion: model.stateVersion,
      identitySnapshotId: state.identity.id,
      packageSnapshotId: state.package.id,
    });

    const [activeCandidate] = await tx
      .select({ id: castingEvidenceCandidates.id })
      .from(castingEvidenceCandidates)
      .where(and(
        eq(castingEvidenceCandidates.intentId, input.intentId),
        eq(castingEvidenceCandidates.activeSlot, "active"),
      ))
      .limit(1)
      .for("update");
    if (input.operationKind === "evidence_candidate_retry") {
      if (!activeCandidate) {
        throw new InkCandidateStateError("candidate_unavailable");
      }
      await rejectReadyCandidateForRetryIn(tx, input);
    } else if (activeCandidate) {
      throw new InkCandidateStateError("candidate_already_active");
    }

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
    if (!intent || !intent.normalizedDescriptor) {
      throw new InkCandidateStateError("intent_unavailable");
    }
    if (
      intent.identitySnapshotId !== state.identity.id
      || intent.sourceAssetId !== state.selectedViews.find(
        (view) => view.angle === INK_ADD_TARGET_VIEW,
      )?.asset.id
    ) {
      throw new InkCandidateStateError("source_unavailable");
    }
    const source = state.selectedViews.find(
      (view) => view.angle === INK_ADD_TARGET_VIEW,
    );
    if (
      !source
      || source.compatibility !== "current"
      || !source.asset.storageUrl
      || !state.anchor.storageUrl
    ) {
      throw new InkCandidateStateError("source_unavailable");
    }
    const [selectedFeature] = await tx
      .select({ id: modelSnapshotFeatureSelections.id })
      .from(modelSnapshotFeatureSelections)
      .where(and(
        eq(modelSnapshotFeatureSelections.modelId, input.modelId),
        eq(modelSnapshotFeatureSelections.identitySnapshotId, state.identity.id),
      ))
      .limit(1)
      .for("update");
    if (selectedFeature) {
      throw new InkCandidateStateError("feature_already_selected");
    }
    if (
      intent.expectedStateVersion !== model.stateVersion
      || intent.packageSnapshotId !== state.package.id
    ) {
      const rebased = await tx
        .update(modelIdentityFeatureIntents)
        .set({
          expectedStateVersion: model.stateVersion,
          packageSnapshotId: state.package.id,
        })
        .where(and(
          eq(modelIdentityFeatureIntents.id, intent.id),
          eq(modelIdentityFeatureIntents.status, "pending"),
          eq(modelIdentityFeatureIntents.identitySnapshotId, state.identity.id),
          eq(modelIdentityFeatureIntents.sourceAssetId, source.asset.id),
        ));
      if (affectedRows(rebased) !== 1) {
        throw new InkCandidateStateError("snapshot_head_changed");
      }
    }
    const [reference] = await tx
      .select()
      .from(modelReferencePlates)
      .where(and(
        eq(modelReferencePlates.featureIntentId, intent.id),
        eq(modelReferencePlates.userId, input.userId),
        eq(modelReferencePlates.modelId, input.modelId),
      ))
      .limit(1)
      .for("update");

    await tx.insert(castingEvidenceCandidates).values({
      id: input.candidateId,
      userId: input.userId,
      modelId: input.modelId,
      intentId: intent.id,
      originatingOperationId: input.operationId,
      capabilityKey: INK_ADD_CAPABILITY_KEY,
      activeSlot: "active",
      expectedStateVersion: model.stateVersion,
      identitySnapshotId: state.identity.id,
      packageSnapshotId: state.package.id,
      targetViewAngle: INK_ADD_TARGET_VIEW,
      sourceAssetId: source.asset.id,
      status: "processing",
      composerRecipeVersion: INK_ADD_COMPOSER_RECIPE_VERSION,
      probeRecipeVersion: INK_ADD_PROBE_RECIPE_VERSION,
    });
    const attempt = await createAttemptIn(tx, {
      ...input,
      attemptNumber: 1,
    });
    return {
      ...input,
      attemptNumber: 1,
      generationId: attempt.generationId,
      privateStorageKey: attempt.privateStorageKey,
      identitySnapshotId: state.identity.id,
      packageSnapshotId: state.package.id,
      expectedStateVersion: model.stateVersion,
      sourceAssetId: source.asset.id,
      sourceUrl: source.asset.storageUrl,
      anchorUrl: state.anchor.storageUrl,
      identityText: state.identity.identityText,
      side: intent.side as InkAddSide,
      normalizedDescriptor: intent.normalizedDescriptor,
      reference: reference
        ? {
            plateId: reference.id,
            storageKey: reference.storageKey,
            byteSize: reference.byteSize,
            contentHash: reference.contentHash,
          }
        : null,
    };
  });
}

export async function markInkCandidateAttemptGenerating(
  input: Pick<
    PreparedInkCandidateAttempt,
    "userId" | "modelId" | "operationId" | "candidateId" | "attemptId" | "generationId"
  >,
): Promise<void> {
  await withTransaction(async (tx) => {
    await lockOwnedDraftModelIn(tx, input);
    const attempt = await tx
      .update(castingEvidenceCandidateAttempts)
      .set({ status: "generating" })
      .where(and(
        eq(castingEvidenceCandidateAttempts.id, input.attemptId),
        eq(castingEvidenceCandidateAttempts.candidateId, input.candidateId),
        eq(castingEvidenceCandidateAttempts.generationId, input.generationId),
        eq(castingEvidenceCandidateAttempts.status, "planned"),
      ));
    if (affectedRows(attempt) !== 1) {
      throw new InkCandidateStateError("attempt_state_changed");
    }
    const generation = await tx
      .update(generations)
      .set({ status: "processing" })
      .where(and(
        eq(generations.id, input.generationId),
        eq(generations.operationId, input.operationId),
        eq(generations.status, "pending"),
      ));
    if (affectedRows(generation) !== 1) {
      throw new InkCandidateStateError("attempt_state_changed");
    }
  });
}

export async function markInkCandidateAttemptStored(input: {
  prepared: PreparedInkCandidateAttempt;
  image: {
    mime: "image/webp";
    width: number;
    height: number;
    byteSize: number;
    contentHash: string;
  };
}): Promise<void> {
  await withTransaction(async (tx) => {
    await lockOwnedDraftModelIn(tx, input.prepared);
    const updated = await tx
      .update(castingEvidenceCandidateAttempts)
      .set({
        status: "stored",
        mime: input.image.mime,
        width: input.image.width,
        height: input.image.height,
        byteSize: input.image.byteSize,
        contentHash: input.image.contentHash,
        storedAt: new Date(),
      })
      .where(and(
        eq(castingEvidenceCandidateAttempts.id, input.prepared.attemptId),
        eq(castingEvidenceCandidateAttempts.candidateId, input.prepared.candidateId),
        eq(castingEvidenceCandidateAttempts.status, "generating"),
        eq(
          castingEvidenceCandidateAttempts.privateStorageKey,
          input.prepared.privateStorageKey,
        ),
      ));
    if (affectedRows(updated) !== 1) {
      throw new InkCandidateStateError("attempt_state_changed");
    }
  });
}

function probeFields(probe: InkCandidateProbeTruth) {
  return {
    predictedVisibility: probe.predictedVisibility,
    identityOutcome: probe.identityOutcome,
    placementOutcome: probe.placementOutcome,
    featureMatchOutcome: probe.featureMatchOutcome,
    poseFramingOutcome: probe.poseFramingOutcome,
    unexpectedInkOutcome: probe.unexpectedInkOutcome,
    overallOutcome: probe.overallOutcome,
    probedAt: new Date(),
  };
}

export async function prepareIncludedInkCandidateRetry(input: {
  prepared: PreparedInkCandidateAttempt;
  probe: InkCandidateProbeTruth;
  attemptId: string;
  privatePlateId: string;
}): Promise<PreparedInkCandidateAttempt> {
  return withTransaction(async (tx) => {
    const model = await lockOwnedDraftModelIn(tx, input.prepared);
    const operation = await lockRunningOperationIn(tx, input.prepared);
    assertOperationHead(operation, {
      stateVersion: model.stateVersion,
      identitySnapshotId: input.prepared.identitySnapshotId,
      packageSnapshotId: input.prepared.packageSnapshotId,
    });
    const failed = await tx
      .update(castingEvidenceCandidateAttempts)
      .set({ status: "probe_failed", ...probeFields(input.probe) })
      .where(and(
        eq(castingEvidenceCandidateAttempts.id, input.prepared.attemptId),
        eq(castingEvidenceCandidateAttempts.candidateId, input.prepared.candidateId),
        eq(castingEvidenceCandidateAttempts.status, "stored"),
      ));
    if (affectedRows(failed) !== 1) {
      throw new InkCandidateStateError("attempt_state_changed");
    }
    await tx
      .update(generations)
      .set({
        status: "failed",
        errorMessage: "Candidate validation did not pass.",
        completedAt: new Date(),
      })
      .where(eq(generations.id, input.prepared.generationId));
    const cleanup = await createStorageCleanupManifestIn(tx, {
      id: randomUUID(),
      userId: input.prepared.userId,
      operationId: randomUUID(),
      kind: "candidate_cleanup",
      storageItems: [{
        storageKey: input.prepared.privateStorageKey,
        storageBackend: "private_evidence_r2",
      }],
    });
    await tx
      .update(castingEvidenceCandidateAttempts)
      .set({ status: "cleanup_pending", cleanupBatchId: cleanup.id })
      .where(eq(castingEvidenceCandidateAttempts.id, input.prepared.attemptId));
    const attempt = await createAttemptIn(tx, {
      userId: input.prepared.userId,
      modelId: input.prepared.modelId,
      operationId: input.prepared.operationId,
      candidateId: input.prepared.candidateId,
      attemptId: input.attemptId,
      attemptNumber: 2,
      privatePlateId: input.privatePlateId,
    });
    return {
      ...input.prepared,
      attemptId: input.attemptId,
      attemptNumber: 2,
      generationId: attempt.generationId,
      privatePlateId: input.privatePlateId,
      privateStorageKey: attempt.privateStorageKey,
    };
  });
}

export async function completeInkCandidateReady(input: {
  prepared: PreparedInkCandidateAttempt;
  probe: InkCandidateProbeTruth;
  expiresAt: Date;
}): Promise<void> {
  await withTransaction(async (tx) => {
    const model = await lockOwnedDraftModelIn(tx, input.prepared);
    const operation = await lockRunningOperationIn(tx, input.prepared);
    assertOperationHead(operation, {
      stateVersion: model.stateVersion,
      identitySnapshotId: input.prepared.identitySnapshotId,
      packageSnapshotId: input.prepared.packageSnapshotId,
    });
    const attempt = await tx
      .update(castingEvidenceCandidateAttempts)
      .set({ status: "probe_passed", ...probeFields(input.probe) })
      .where(and(
        eq(castingEvidenceCandidateAttempts.id, input.prepared.attemptId),
        eq(castingEvidenceCandidateAttempts.candidateId, input.prepared.candidateId),
        eq(castingEvidenceCandidateAttempts.status, "stored"),
        isNull(castingEvidenceCandidateAttempts.overallOutcome),
      ));
    if (affectedRows(attempt) !== 1) {
      throw new InkCandidateStateError("attempt_state_changed");
    }
    const candidate = await tx
      .update(castingEvidenceCandidates)
      .set({
        status: "ready",
        readyAttemptId: input.prepared.attemptId,
        expiresAt: input.expiresAt,
      })
      .where(and(
        eq(castingEvidenceCandidates.id, input.prepared.candidateId),
        eq(castingEvidenceCandidates.userId, input.prepared.userId),
        eq(castingEvidenceCandidates.modelId, input.prepared.modelId),
        eq(castingEvidenceCandidates.intentId, input.prepared.intentId),
        eq(castingEvidenceCandidates.status, "processing"),
        eq(castingEvidenceCandidates.activeSlot, "active"),
        eq(
          castingEvidenceCandidates.expectedStateVersion,
          input.prepared.expectedStateVersion,
        ),
        eq(
          castingEvidenceCandidates.identitySnapshotId,
          input.prepared.identitySnapshotId,
        ),
        eq(
          castingEvidenceCandidates.packageSnapshotId,
          input.prepared.packageSnapshotId,
        ),
      ));
    if (affectedRows(candidate) !== 1) {
      throw new InkCandidateStateError("candidate_unavailable");
    }
    await tx
      .update(generations)
      .set({ status: "completed", resultUrl: null, completedAt: new Date() })
      .where(eq(generations.id, input.prepared.generationId));
  });
}

export async function invalidateInkCandidate(input: {
  prepared: PreparedInkCandidateAttempt;
  probe?: InkCandidateProbeTruth;
  publicError: string;
}): Promise<void> {
  await withTransaction(async (tx) => {
    await lockOwnedDraftModelIn(tx, input.prepared);
    const attempts = await tx
      .select()
      .from(castingEvidenceCandidateAttempts)
      .where(eq(
        castingEvidenceCandidateAttempts.candidateId,
        input.prepared.candidateId,
      ))
      .orderBy(asc(castingEvidenceCandidateAttempts.attemptNumber))
      .for("update");
    if (input.probe) {
      await tx
        .update(castingEvidenceCandidateAttempts)
        .set({
          status: input.probe.overallOutcome === "unknown"
            ? "probe_unknown"
            : "probe_failed",
          ...probeFields(input.probe),
        })
        .where(and(
          eq(castingEvidenceCandidateAttempts.id, input.prepared.attemptId),
          eq(castingEvidenceCandidateAttempts.status, "stored"),
        ));
    }
    const storageItems = attempts
      .filter((attempt) => attempt.privateStorageKey !== null)
      .map((attempt) => ({
        storageKey: attempt.privateStorageKey!,
        storageBackend: "private_evidence_r2" as const,
      }));
    const cleanup = await createStorageCleanupManifestIn(tx, {
      id: randomUUID(),
      userId: input.prepared.userId,
      operationId: randomUUID(),
      kind: "candidate_cleanup",
      storageItems,
    });
    await tx
      .update(castingEvidenceCandidateAttempts)
      .set({ status: "cleanup_pending", cleanupBatchId: cleanup.id })
      .where(eq(
        castingEvidenceCandidateAttempts.candidateId,
        input.prepared.candidateId,
      ));
    const generationIds = attempts
      .map((attempt) => attempt.generationId)
      .filter((id): id is number => id !== null);
    if (generationIds.length > 0) {
      await tx
        .update(generations)
        .set({
          status: "failed",
          resultUrl: null,
          errorMessage: input.publicError,
          completedAt: new Date(),
        })
        .where(and(
          inArray(generations.id, generationIds),
          inArray(generations.status, ["pending", "processing"]),
        ));
    }
    const candidate = await tx
      .update(castingEvidenceCandidates)
      .set({
        status: "invalid",
        activeSlot: null,
        cleanupBatchId: cleanup.id,
        resolvedAt: new Date(),
        resolvedByOperationId: input.prepared.operationId,
      })
      .where(and(
        eq(castingEvidenceCandidates.id, input.prepared.candidateId),
        eq(castingEvidenceCandidates.status, "processing"),
        eq(castingEvidenceCandidates.activeSlot, "active"),
      ));
    if (affectedRows(candidate) !== 1) {
      throw new InkCandidateStateError("candidate_unavailable");
    }
  });
}

export async function findActiveOwnedInkCandidate(input: {
  userId: number;
  intentId: string;
}): Promise<{
  id: string;
  status: "processing" | "ready";
  expiresAt: Date | null;
} | null> {
  return withTransaction(async (tx) => {
    const [row] = await tx
      .select({
        id: castingEvidenceCandidates.id,
        status: castingEvidenceCandidates.status,
        expiresAt: castingEvidenceCandidates.expiresAt,
      })
      .from(castingEvidenceCandidates)
      .innerJoin(models, and(
        eq(models.id, castingEvidenceCandidates.modelId),
        eq(models.userId, input.userId),
        availableModelWhere(),
      ))
      .where(and(
        eq(castingEvidenceCandidates.userId, input.userId),
        eq(castingEvidenceCandidates.intentId, input.intentId),
        eq(castingEvidenceCandidates.activeSlot, "active"),
      ))
      .limit(1);
    if (!row || (row.status !== "processing" && row.status !== "ready")) {
      return null;
    }
    return {
      id: row.id,
      status: row.status,
      expiresAt: row.expiresAt,
    } as {
      id: string;
      status: "processing" | "ready";
      expiresAt: Date | null;
    };
  });
}
