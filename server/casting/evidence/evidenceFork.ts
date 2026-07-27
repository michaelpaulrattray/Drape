import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  generationOperationLocks,
  generationOperations,
  generations,
  modelAssets,
  modelEvidenceCrops,
  modelIdentityFeatures,
  modelIdentityFeatureVersions,
  modelIdentitySnapshots,
  modelPackageSnapshots,
  modelPackageSnapshotSlots,
  modelReferencePlates,
  modelSnapshotFeatureSelections,
  models,
  storageCleanupBatches,
  storageCleanupItems,
  type Model,
  type ModelAsset,
  type ModelEvidenceCrop,
  type ModelIdentityFeature,
  type ModelIdentityFeatureVersion,
  type ModelIdentitySnapshot,
  type ModelPackageSnapshot,
  type ModelPackageSnapshotSlot,
  type ModelReferencePlate,
  type ModelSnapshotFeatureSelection,
} from "../../../drizzle/schema";
import { storageCopyExact } from "../../storage";
import { withTransaction, type TransactionHandle } from "../../db/connection";
import { createStorageCleanupManifestIn } from "../../db/storageCleanup";
import {
  finalizeClaimedGenerationOperationFailure,
  finalizeClaimedGenerationOperationSuccessIn,
} from "../../db/generationOperations";
import { modelOperationLockKey } from "../operationContract";
import { availableModelWhere } from "../modelAvailability";
import {
  buildEvidenceCropStorageKey,
  buildReferencePlateStorageKey,
  copyCanonicalEvidenceExact,
  type PrivateEvidenceStorageAdapter,
} from "./evidenceDelivery";

const PUBLIC_FORK_PREFIX = "fork";

export class EvidenceForkError extends Error {
  readonly code:
    | "source_unavailable"
    | "operation_unavailable"
    | "snapshot_unavailable"
    | "copy_unavailable"
    | "commit_conflict";

  constructor(code: EvidenceForkError["code"]) {
    super("The Cast could not be copied. Nothing was charged.");
    this.name = "EvidenceForkError";
    this.code = code;
  }
}

export interface EvidenceForkPublicCopy {
  key: string;
  url: string;
  byteSize: number;
  contentHash: string;
  contentType: string;
}

export interface EvidenceForkDependencies {
  privateStorage: PrivateEvidenceStorageAdapter;
  copyPublic(input: {
    sourceKey: string;
    destinationKey: string;
  }): Promise<EvidenceForkPublicCopy>;
  generateId?: () => string;
}

interface PlannedPublicAsset {
  source: ModelAsset;
  destinationKey: string;
  stepKey: string;
}

interface PlannedPrivateObject {
  kind: "plate" | "crop";
  source: ModelReferencePlate | ModelEvidenceCrop;
  destinationId: string;
  destinationKey: string;
  stepKey: string;
}

interface ForkGraph {
  sourceModel: Model;
  identity: ModelIdentitySnapshot;
  packageSnapshot: ModelPackageSnapshot;
  slots: ModelPackageSnapshotSlot[];
  assets: ModelAsset[];
  featureSelections: ModelSnapshotFeatureSelection[];
  features: ModelIdentityFeature[];
  featureVersions: ModelIdentityFeatureVersion[];
  plates: ModelReferencePlate[];
  crops: ModelEvidenceCrop[];
}

interface PreparedEvidenceFork {
  targetModelId: number;
  cleanupBatchId: string;
  graph: ForkGraph;
  publicAssets: PlannedPublicAsset[];
  privateObjects: PlannedPrivateObject[];
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return Number((result[0] as { affectedRows?: unknown })?.affectedRows ?? 0);
  }
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

function forkPublicKey(input: {
  userId: number;
  modelId: number;
  operationId: string;
  objectId: string;
}): string {
  return `users/${input.userId}/models/${input.modelId}/${PUBLIC_FORK_PREFIX}/${input.operationId}/${input.objectId}.webp`;
}

function copiedName(name: string | null): string {
  const base = name?.trim() || "Untitled Cast";
  return `${base} copy`.slice(0, 128);
}

async function lockSourceAndOperationIn(
  tx: TransactionHandle,
  input: { userId: number; sourceModelId: number; operationId: string },
): Promise<Model> {
  const [sourceModel] = await tx
    .select()
    .from(models)
    .where(and(
      eq(models.id, input.sourceModelId),
      eq(models.userId, input.userId),
      availableModelWhere(),
    ))
    .limit(1)
    .for("update");
  if (!sourceModel) throw new EvidenceForkError("source_unavailable");
  const [operation] = await tx
    .select({ id: generationOperations.id })
    .from(generationOperations)
    .where(and(
      eq(generationOperations.id, input.operationId),
      eq(generationOperations.userId, input.userId),
      eq(generationOperations.modelId, input.sourceModelId),
      eq(generationOperations.kind, "evidence_fork_copy"),
      eq(generationOperations.status, "claimed"),
    ))
    .limit(1)
    .for("update");
  const [lock] = await tx
    .select({ operationId: generationOperationLocks.operationId })
    .from(generationOperationLocks)
    .where(and(
      eq(generationOperationLocks.lockKey, modelOperationLockKey(input.sourceModelId)),
      eq(generationOperationLocks.operationId, input.operationId),
      eq(generationOperationLocks.kind, "evidence_fork_copy"),
    ))
    .limit(1)
    .for("update");
  if (!operation || lock?.operationId !== input.operationId) {
    throw new EvidenceForkError("operation_unavailable");
  }
  return sourceModel;
}

async function loadCurrentForkGraphIn(
  tx: TransactionHandle,
  sourceModel: Model,
): Promise<ForkGraph> {
  if (!sourceModel.currentPackageSnapshotId) {
    throw new EvidenceForkError("snapshot_unavailable");
  }
  const [packageSnapshot] = await tx
    .select()
    .from(modelPackageSnapshots)
    .where(and(
      eq(modelPackageSnapshots.id, sourceModel.currentPackageSnapshotId),
      eq(modelPackageSnapshots.modelId, sourceModel.id),
    ))
    .limit(1);
  if (!packageSnapshot) throw new EvidenceForkError("snapshot_unavailable");
  const [identity] = await tx
    .select()
    .from(modelIdentitySnapshots)
    .where(and(
      eq(modelIdentitySnapshots.id, packageSnapshot.identitySnapshotId),
      eq(modelIdentitySnapshots.modelId, sourceModel.id),
    ))
    .limit(1);
  if (!identity) throw new EvidenceForkError("snapshot_unavailable");
  const slots = await tx
    .select()
    .from(modelPackageSnapshotSlots)
    .where(eq(modelPackageSnapshotSlots.packageSnapshotId, packageSnapshot.id))
    .orderBy(asc(modelPackageSnapshotSlots.viewAngle));
  if (slots.length === 0) throw new EvidenceForkError("snapshot_unavailable");
  const assets = await tx
    .select()
    .from(modelAssets)
    .where(inArray(modelAssets.id, slots.map((slot) => slot.selectedAssetId)));
  const byAsset = new Map(assets.map((asset) => [asset.id, asset]));
  if (
    assets.length !== slots.length
    || !slots.every((slot) => {
      const asset = byAsset.get(slot.selectedAssetId);
      return asset?.modelId === sourceModel.id
        && asset.viewType === slot.viewAngle
        && Boolean(asset.storageKey);
    })
    || !byAsset.has(identity.anchorAssetId)
  ) {
    throw new EvidenceForkError("snapshot_unavailable");
  }
  const featureSelections = await tx
    .select()
    .from(modelSnapshotFeatureSelections)
    .where(and(
      eq(modelSnapshotFeatureSelections.modelId, sourceModel.id),
      eq(modelSnapshotFeatureSelections.identitySnapshotId, identity.id),
    ));
  const featureIds = featureSelections.map((selection) => selection.featureId);
  const featureVersionIds = featureSelections.map((selection) => selection.featureVersionId);
  const features = featureIds.length > 0
    ? await tx.select().from(modelIdentityFeatures).where(and(
      eq(modelIdentityFeatures.modelId, sourceModel.id),
      inArray(modelIdentityFeatures.id, featureIds),
    ))
    : [];
  const featureVersions = featureVersionIds.length > 0
    ? await tx.select().from(modelIdentityFeatureVersions).where(and(
      eq(modelIdentityFeatureVersions.modelId, sourceModel.id),
      inArray(modelIdentityFeatureVersions.id, featureVersionIds),
    ))
    : [];
  if (
    features.length !== new Set(featureIds).size
    || featureVersions.length !== new Set(featureVersionIds).size
  ) {
    throw new EvidenceForkError("snapshot_unavailable");
  }
  const plateIds = Array.from(new Set(featureVersions.flatMap((version) => [
    version.sourceReferencePlateId,
    version.acceptedCandidatePlateId,
  ].filter((id): id is string => Boolean(id)))));
  const cropIds = Array.from(new Set(featureVersions
    .map((version) => version.evidenceCropId)
    .filter((id): id is string => Boolean(id))));
  const plates = plateIds.length > 0
    ? await tx.select().from(modelReferencePlates).where(and(
      eq(modelReferencePlates.userId, sourceModel.userId),
      eq(modelReferencePlates.modelId, sourceModel.id),
      inArray(modelReferencePlates.id, plateIds),
    ))
    : [];
  const crops = cropIds.length > 0
    ? await tx.select().from(modelEvidenceCrops).where(and(
      eq(modelEvidenceCrops.userId, sourceModel.userId),
      eq(modelEvidenceCrops.modelId, sourceModel.id),
      inArray(modelEvidenceCrops.id, cropIds),
    ))
    : [];
  if (plates.length !== plateIds.length || crops.length !== cropIds.length) {
    throw new EvidenceForkError("snapshot_unavailable");
  }
  return {
    sourceModel,
    identity,
    packageSnapshot,
    slots,
    assets,
    featureSelections,
    features,
    featureVersions,
    plates,
    crops,
  };
}

async function prepareEvidenceForkIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    sourceModelId: number;
    operationId: string;
    generateId: () => string;
  },
): Promise<PreparedEvidenceFork> {
  const sourceModel = await lockSourceAndOperationIn(tx, input);
  const graph = await loadCurrentForkGraphIn(tx, sourceModel);
  const [inserted] = await tx
    .insert(models)
    .values({
      userId: input.userId,
      name: copiedName(sourceModel.name),
      masterPrompt: graph.identity.masterPrompt,
      technicalSchema: graph.identity.technicalSchema,
      preferences: graph.identity.preferences,
      status: "provisioning",
      identityRevisionId: sourceModel.identityRevisionId,
      stateVersion: 0,
    })
    .$returningId();
  if (!inserted?.id) throw new EvidenceForkError("commit_conflict");
  const targetModelId = inserted.id;
  const publicAssets = graph.assets.map((source, index) => {
    const objectId = input.generateId();
    return {
      source,
      destinationKey: forkPublicKey({
        userId: input.userId,
        modelId: targetModelId,
        operationId: input.operationId,
        objectId,
      }),
      stepKey: `asset_${index + 1}`,
    };
  });
  const privateObjects: PlannedPrivateObject[] = [
    ...graph.plates.map((source, index) => {
      const destinationId = input.generateId();
      return {
        kind: "plate" as const,
        source,
        destinationId,
        destinationKey: buildReferencePlateStorageKey({
          userId: input.userId,
          modelId: targetModelId,
          plateId: destinationId,
        }),
        stepKey: `plate_${index + 1}`,
      };
    }),
    ...graph.crops.map((source, index) => {
      const destinationId = input.generateId();
      return {
        kind: "crop" as const,
        source,
        destinationId,
        destinationKey: buildEvidenceCropStorageKey({
          userId: input.userId,
          modelId: targetModelId,
          cropId: destinationId,
        }),
        stepKey: `crop_${index + 1}`,
      };
    }),
  ];
  const manifest = await createStorageCleanupManifestIn(tx, {
    id: input.generateId(),
    userId: input.userId,
    operationId: input.operationId,
    kind: "candidate_cleanup",
    storageItems: [
      ...publicAssets.map((copy) => ({
        storageKey: copy.destinationKey,
        storageBackend: "public_r2" as const,
      })),
      ...privateObjects.map((copy) => ({
        storageKey: copy.destinationKey,
        storageBackend: "private_evidence_r2" as const,
      })),
    ],
  });
  const auditSteps = [
    ...publicAssets.map((copy) => copy.stepKey),
    ...privateObjects.map((copy) => copy.stepKey),
  ];
  if (auditSteps.length > 0) {
    await tx.insert(generations).values(auditSteps.map((stepKey) => ({
      userId: input.userId,
      modelId: targetModelId,
      operationId: input.operationId,
      stepKey,
      type: "evidenceCandidate" as const,
      status: "processing" as const,
      pointsCost: 0,
    })));
  }
  return {
    targetModelId,
    cleanupBatchId: manifest.id,
    graph,
    publicAssets,
    privateObjects,
  };
}

function sameSourceHead(model: Model, prepared: PreparedEvidenceFork): boolean {
  return model.stateVersion === prepared.graph.sourceModel.stateVersion
    && model.currentPackageSnapshotId === prepared.graph.sourceModel.currentPackageSnapshotId
    && model.identityRevisionId === prepared.graph.sourceModel.identityRevisionId;
}

async function commitEvidenceForkIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    sourceModelId: number;
    operationId: string;
    prepared: PreparedEvidenceFork;
    publicCopies: Map<number, EvidenceForkPublicCopy>;
    generateId: () => string;
  },
): Promise<{ modelId: number; copiedObjects: number }> {
  const sourceModel = await lockSourceAndOperationIn(tx, input);
  if (!sameSourceHead(sourceModel, input.prepared)) {
    throw new EvidenceForkError("commit_conflict");
  }
  const [target] = await tx
    .select()
    .from(models)
    .where(and(
      eq(models.id, input.prepared.targetModelId),
      eq(models.userId, input.userId),
      eq(models.status, "provisioning"),
      isNull(models.deletedAt),
      eq(models.stateVersion, 0),
      isNull(models.currentPackageSnapshotId),
    ))
    .limit(1)
    .for("update");
  if (!target) throw new EvidenceForkError("commit_conflict");

  const assetIdMap = new Map<number, number>();
  for (const planned of input.prepared.publicAssets) {
    const copy = input.publicCopies.get(planned.source.id);
    if (!copy || copy.key !== planned.destinationKey) {
      throw new EvidenceForkError("copy_unavailable");
    }
    const [inserted] = await tx.insert(modelAssets).values({
      modelId: target.id,
      viewType: planned.source.viewType,
      resolution: planned.source.resolution,
      storageUrl: copy.url,
      storageKey: copy.key,
      pointsCost: 0,
      pinned: false,
      status: planned.source.status,
      provenance: planned.source.provenance,
    }).$returningId();
    if (!inserted?.id) throw new EvidenceForkError("commit_conflict");
    assetIdMap.set(planned.source.id, inserted.id);
  }
  const plateIdMap = new Map<string, string>();
  const cropIdMap = new Map<string, string>();
  for (const planned of input.prepared.privateObjects) {
    if (planned.kind === "plate") plateIdMap.set(planned.source.id, planned.destinationId);
    else cropIdMap.set(planned.source.id, planned.destinationId);
  }
  for (const planned of input.prepared.privateObjects) {
    if (planned.kind === "plate") {
      const source = planned.source as ModelReferencePlate;
      await tx.insert(modelReferencePlates).values({
        id: planned.destinationId,
        userId: input.userId,
        modelId: target.id,
        featureIntentId: null,
        kind: source.kind,
        storageKey: planned.destinationKey,
        mime: source.mime,
        width: source.width,
        height: source.height,
        byteSize: source.byteSize,
        contentHash: source.contentHash,
        createdByOperationId: input.operationId,
        createdByOperationStepKey: planned.stepKey,
      });
    } else {
      const source = planned.source as ModelEvidenceCrop;
      const mappedPlateId = plateIdMap.get(source.plateId);
      if (!mappedPlateId) throw new EvidenceForkError("snapshot_unavailable");
      await tx.insert(modelEvidenceCrops).values({
        id: planned.destinationId,
        userId: input.userId,
        modelId: target.id,
        plateId: mappedPlateId,
        ontologyVersion: source.ontologyVersion,
        zone: source.zone,
        surface: source.surface,
        side: source.side,
        sourceX: source.sourceX,
        sourceY: source.sourceY,
        sourceWidth: source.sourceWidth,
        sourceHeight: source.sourceHeight,
        sourceImageWidth: source.sourceImageWidth,
        sourceImageHeight: source.sourceImageHeight,
        storageKey: planned.destinationKey,
        mime: source.mime,
        width: source.width,
        height: source.height,
        byteSize: source.byteSize,
        contentHash: source.contentHash,
        cropRecipeVersion: source.cropRecipeVersion,
        createdByOperationId: input.operationId,
        createdByOperationStepKey: planned.stepKey,
      });
    }
  }

  const featureIdMap = new Map<string, string>();
  for (const source of input.prepared.graph.features) {
    const id = input.generateId();
    featureIdMap.set(source.id, id);
    await tx.insert(modelIdentityFeatures).values({
      id,
      modelId: target.id,
      category: source.category,
      createdByOperationId: input.operationId,
    });
  }
  const versionIdMap = new Map<string, string>();
  for (const source of input.prepared.graph.featureVersions) {
    const id = input.generateId();
    const featureId = featureIdMap.get(source.featureId);
    const sourceAssetId = assetIdMap.get(source.sourceAssetId);
    const acceptedCandidatePlateId = plateIdMap.get(source.acceptedCandidatePlateId);
    if (!featureId || !sourceAssetId || !acceptedCandidatePlateId) {
      throw new EvidenceForkError("snapshot_unavailable");
    }
    versionIdMap.set(source.id, id);
    await tx.insert(modelIdentityFeatureVersions).values({
      id,
      modelId: target.id,
      featureId,
      operation: source.operation,
      ontologyVersion: source.ontologyVersion,
      zone: source.zone,
      surface: source.surface,
      side: source.side,
      normalizedDescriptor: source.normalizedDescriptor,
      sourceAssetId,
      sourceViewAngle: source.sourceViewAngle,
      sourceReferencePlateId: source.sourceReferencePlateId
        ? plateIdMap.get(source.sourceReferencePlateId) ?? null
        : null,
      acceptedCandidatePlateId,
      evidenceCropId: source.evidenceCropId
        ? cropIdMap.get(source.evidenceCropId) ?? null
        : null,
      recipeVersion: source.recipeVersion,
      createdByOperationId: input.operationId,
    });
  }

  const identitySnapshotId = input.generateId();
  const packageSnapshotId = input.generateId();
  const anchorAssetId = assetIdMap.get(input.prepared.graph.identity.anchorAssetId);
  if (!anchorAssetId) throw new EvidenceForkError("snapshot_unavailable");
  await tx.insert(modelIdentitySnapshots).values({
    id: identitySnapshotId,
    modelId: target.id,
    sequence: 1,
    parentSnapshotId: null,
    restoredFromSnapshotId: null,
    reason: "fork_bootstrap",
    masterPrompt: input.prepared.graph.identity.masterPrompt,
    technicalSchema: input.prepared.graph.identity.technicalSchema,
    preferences: input.prepared.graph.identity.preferences,
    identityText: input.prepared.graph.identity.identityText,
    identityTextHash: input.prepared.graph.identity.identityTextHash,
    anchorAssetId,
    recipeVersion: input.prepared.graph.identity.recipeVersion,
    createdByOperationId: input.operationId,
  });
  await tx.insert(modelPackageSnapshots).values({
    id: packageSnapshotId,
    modelId: target.id,
    identitySnapshotId,
    sequence: 1,
    parentPackageSnapshotId: null,
    reason: "create",
    createdByOperationId: input.operationId,
  });
  await tx.insert(modelPackageSnapshotSlots).values(
    input.prepared.graph.slots.map((source) => {
      const selectedAssetId = assetIdMap.get(source.selectedAssetId);
      if (!selectedAssetId) throw new EvidenceForkError("snapshot_unavailable");
      return {
        id: input.generateId(),
        packageSnapshotId,
        viewAngle: source.viewAngle,
        selectedAssetId,
        compatibility: source.compatibility,
        selectionReason: "carried" as const,
        sourceSelectionId: null,
      };
    }),
  );
  if (input.prepared.graph.featureSelections.length > 0) {
    await tx.insert(modelSnapshotFeatureSelections).values(
      input.prepared.graph.featureSelections.map((source) => {
        const featureId = featureIdMap.get(source.featureId);
        const featureVersionId = versionIdMap.get(source.featureVersionId);
        if (!featureId || !featureVersionId) {
          throw new EvidenceForkError("snapshot_unavailable");
        }
        return {
          id: input.generateId(),
          modelId: target.id,
          identitySnapshotId,
          featureId,
          featureVersionId,
          selectionReason: "carried" as const,
          sourceSelectionId: null,
        };
      }),
    );
  }
  const published = await tx.update(models).set({
    status: "draft",
    currentPackageSnapshotId: packageSnapshotId,
    stateVersion: 1,
    identityRevisionId: sourceModel.identityRevisionId,
    sealedIdentitySnapshotId: null,
    sealedPackageSnapshotId: null,
    agencyId: null,
    mintedAt: null,
  }).where(and(
    eq(models.id, target.id),
    eq(models.userId, input.userId),
    eq(models.status, "provisioning"),
    eq(models.stateVersion, 0),
    isNull(models.currentPackageSnapshotId),
    isNull(models.deletedAt),
  ));
  if (affectedRows(published) !== 1) throw new EvidenceForkError("commit_conflict");
  await tx.delete(storageCleanupItems)
    .where(eq(storageCleanupItems.batchId, input.prepared.cleanupBatchId));
  const removedBatch = await tx.delete(storageCleanupBatches).where(and(
    eq(storageCleanupBatches.id, input.prepared.cleanupBatchId),
    eq(storageCleanupBatches.operationId, input.operationId),
    eq(storageCleanupBatches.status, "pending"),
  ));
  if (affectedRows(removedBatch) !== 1) throw new EvidenceForkError("commit_conflict");
  await tx.update(generations).set({
    status: "completed",
    completedAt: new Date(),
  }).where(and(
    eq(generations.operationId, input.operationId),
    eq(generations.modelId, target.id),
    eq(generations.status, "processing"),
  ));
  const result = {
    modelId: target.id,
    copiedObjects:
      input.prepared.publicAssets.length + input.prepared.privateObjects.length,
  };
  await finalizeClaimedGenerationOperationSuccessIn(tx, {
    userId: input.userId,
    operationId: input.operationId,
    result,
  });
  return result;
}

/**
 * Free identity-preserving Fork. No provider or credit API is imported.
 * Source and destination never share a public or private object key.
 */
export async function forkEvidenceAwareCast(
  dependencies: EvidenceForkDependencies,
  input: {
    userId: number;
    sourceModelId: number;
    operationId: string;
  },
): Promise<{ modelId: number; copiedObjects: number }> {
  const generateId = dependencies.generateId ?? randomUUID;
  let prepared: PreparedEvidenceFork | null = null;
  try {
    prepared = await withTransaction((tx) => prepareEvidenceForkIn(tx, {
      ...input,
      generateId,
    }));
    const publicCopies = new Map<number, EvidenceForkPublicCopy>();
    for (const planned of prepared.publicAssets) {
      if (!planned.source.storageKey) throw new EvidenceForkError("copy_unavailable");
      const copied = await dependencies.copyPublic({
        sourceKey: planned.source.storageKey,
        destinationKey: planned.destinationKey,
      });
      if (copied.key !== planned.destinationKey) {
        throw new EvidenceForkError("copy_unavailable");
      }
      publicCopies.set(planned.source.id, copied);
    }
    for (const planned of prepared.privateObjects) {
      await copyCanonicalEvidenceExact(dependencies.privateStorage, {
        sourceKey: planned.source.storageKey,
        destinationKey: planned.destinationKey,
        byteSize: planned.source.byteSize,
        contentHash: planned.source.contentHash,
      });
    }
    return await withTransaction((tx) => commitEvidenceForkIn(tx, {
      ...input,
      prepared: prepared!,
      publicCopies,
      generateId,
    }));
  } catch (error) {
    if (prepared) {
      await withTransaction(async (tx) => {
        await tx.update(generations).set({
          status: "failed",
          errorMessage: "Fork copy failed",
          completedAt: new Date(),
        }).where(and(
          eq(generations.operationId, input.operationId),
          eq(generations.modelId, prepared!.targetModelId),
          eq(generations.status, "processing"),
        ));
      }).catch(() => undefined);
    }
    await finalizeClaimedGenerationOperationFailure({
      userId: input.userId,
      operationId: input.operationId,
      errorCode: "FORK_COPY_FAILED",
      publicMessage: "The Cast could not be copied. Nothing was charged.",
    }).catch(() => undefined);
    throw error instanceof EvidenceForkError
      ? error
      : new EvidenceForkError("copy_unavailable");
  }
}

export const productionEvidenceForkDependencies = (
  privateStorage: PrivateEvidenceStorageAdapter,
): EvidenceForkDependencies => ({
  privateStorage,
  copyPublic: storageCopyExact,
});

/**
 * After exact cleanup succeeds, remove the invisible shell left by a failed
 * or crashed Fork. Audit children retain no model/object locator.
 */
export async function settleNextCompletedEvidenceForkCleanup(): Promise<{
  operationId: string;
  modelId: number;
} | null> {
  return withTransaction(async (tx) => {
    const [row] = await tx
      .select({
        operationId: generationOperations.id,
        modelId: generations.modelId,
        batchId: storageCleanupBatches.id,
      })
      .from(storageCleanupBatches)
      .innerJoin(generationOperations, and(
        eq(generationOperations.id, storageCleanupBatches.operationId),
        eq(generationOperations.kind, "evidence_fork_copy"),
        inArray(generationOperations.status, ["failed", "recovery_required"]),
      ))
      .innerJoin(generations, and(
        eq(generations.operationId, generationOperations.id),
        isNull(generations.resultUrl),
      ))
      .where(and(
        eq(storageCleanupBatches.kind, "candidate_cleanup"),
        eq(storageCleanupBatches.status, "succeeded"),
      ))
      .orderBy(asc(storageCleanupBatches.createdAt))
      .limit(1)
      .for("update");
    if (!row || row.modelId === null) return null;
    const [target] = await tx
      .select({ id: models.id })
      .from(models)
      .where(and(
        eq(models.id, row.modelId),
        eq(models.status, "provisioning"),
        isNull(models.deletedAt),
        eq(models.stateVersion, 0),
        isNull(models.currentPackageSnapshotId),
      ))
      .limit(1)
      .for("update");
    if (!target) throw new Error("Failed Fork cleanup target is unavailable");
    await tx.delete(models).where(and(
      eq(models.id, target.id),
      eq(models.status, "provisioning"),
      eq(models.stateVersion, 0),
      isNull(models.currentPackageSnapshotId),
    ));
    await tx.update(generations).set({
      modelId: null,
      operationId: null,
      stepKey: null,
      resultUrl: null,
      errorMessage: null,
      metadata: null,
    }).where(and(
      eq(generations.operationId, row.operationId),
      eq(generations.modelId, target.id),
    ));
    return { operationId: row.operationId, modelId: target.id };
  });
}
