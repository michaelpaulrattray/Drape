import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import {
  castingEvidenceCandidates,
  modelAssets,
  modelEvidenceCrops,
  modelIdentityFeatures,
  modelIdentityFeatureIntents,
  modelIdentityFeatureVersions,
  modelIdentitySnapshots,
  modelPackageSnapshots,
  modelPackageSnapshotSlots,
  modelReferencePlates,
  modelSnapshotFeatureSelections,
  models,
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
} from "../../drizzle/schema";
import {
  CANONICAL_VIEW_ANGLES,
  type CanonicalViewAngle,
} from "../../shared/boardTypes";
import {
  isModelDraftStatus,
  isModelMintedStatus,
} from "../../shared/modelLifecycle";
import { withTransaction, type TransactionHandle } from "../db/connection";
import { availableModelWhere } from "./modelAvailability";
import { assetIdentityRole, identityStampFor, mintRevisionId } from "./identity/anchorSelector";
import {
  commitModelSnapshotTransition,
  type SnapshotTransitionResult,
} from "./snapshotTransitions";
import { finalizeRunningGenerationOperationSuccessIn } from "../db/generationOperations";

export const WHOLE_CAST_RESTORE_RECIPE_VERSION = "r7-whole-cast-restore-v1";

export const CAST_STATE_UNAVAILABLE_REASONS = [
  "current",
  "pair_unavailable",
  "anchor_unavailable",
  "feature_unavailable",
] as const;

export type CastStateUnavailableReason =
  typeof CAST_STATE_UNAVAILABLE_REASONS[number];

export interface PublicCastStateRestorePoint {
  restorePointId: string;
  createdAt: string;
  label: string;
  previewUrl: string | null;
  selectedViewCount: number;
  featureCount: number;
  current: boolean;
  available: boolean;
  unavailableReason: CastStateUnavailableReason | null;
}

export interface PublicCastStateHistory {
  enabled: boolean;
  lifecycle: "draft" | "minted";
  canRestore: boolean;
  forkRequired: boolean;
  blockedByPendingEvidence: boolean;
  restorePoints: PublicCastStateRestorePoint[];
}

interface RestoreHistoryRows {
  model: Model;
  identities: ModelIdentitySnapshot[];
  packages: ModelPackageSnapshot[];
  slots: ModelPackageSnapshotSlot[];
  assets: ModelAsset[];
  featureSelections: ModelSnapshotFeatureSelection[];
  features: ModelIdentityFeature[];
  featureVersions: ModelIdentityFeatureVersion[];
  plates: ModelReferencePlate[];
  crops: ModelEvidenceCrop[];
  pendingEvidence: boolean;
}

export interface WholeCastRestorePointPlan {
  identity: ModelIdentitySnapshot;
  packageSnapshot: ModelPackageSnapshot;
  slots: ModelPackageSnapshotSlot[];
  availableSlots: Array<{
    selection: ModelPackageSnapshotSlot;
    asset: ModelAsset;
  }>;
  unavailableAngles: CanonicalViewAngle[];
  featureSelections: ModelSnapshotFeatureSelection[];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isFailureMarker(asset: ModelAsset): boolean {
  const status = asset.status as { state?: unknown } | null;
  return !asset.storageUrl.trim() || status?.state === "failed";
}

function iso(value: Date | string | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = value ? new Date(value) : new Date(0);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

const IDENTITY_REASON_LABELS: Record<ModelIdentitySnapshot["reason"], string> = {
  bootstrap: "Original Cast",
  create: "Created",
  identity_edit: "Identity edited",
  anchor_reroll: "Headshot recast",
  document_compact: "Prompt refined",
  evidence_accept: "Evidence accepted",
  evidence_remove: "Evidence removed",
  restore: "Restored state",
  fork_bootstrap: "Forked draft",
};

function pairForIdentity(
  identity: ModelIdentitySnapshot,
  packages: readonly ModelPackageSnapshot[],
): ModelPackageSnapshot | null {
  const matches = packages.filter((snapshot) => {
    if (snapshot.identitySnapshotId !== identity.id) return false;
    if (identity.createdByOperationId) {
      return snapshot.createdByOperationId === identity.createdByOperationId;
    }
    return snapshot.createdByOperationId === null
      && identity.reason === "bootstrap"
      && snapshot.reason === "bootstrap";
  });
  return matches.length === 1 ? matches[0] : null;
}

function featureGraphCloses(
  input: {
    model: Model;
    selections: readonly ModelSnapshotFeatureSelection[];
    features: readonly ModelIdentityFeature[];
    versions: readonly ModelIdentityFeatureVersion[];
    assets: readonly ModelAsset[];
    selectedAssetIds: ReadonlySet<number>;
    plates: readonly ModelReferencePlate[];
    crops: readonly ModelEvidenceCrop[];
  },
): boolean {
  const featureById = new Map(input.features.map((row) => [row.id, row]));
  const versionById = new Map(input.versions.map((row) => [row.id, row]));
  const assetById = new Map(input.assets.map((row) => [row.id, row]));
  const plateById = new Map(input.plates.map((row) => [row.id, row]));
  const cropById = new Map(input.crops.map((row) => [row.id, row]));
  const seenFeatures = new Set<string>();
  const seenVersions = new Set<string>();

  for (const selection of input.selections) {
    const feature = featureById.get(selection.featureId);
    const version = versionById.get(selection.featureVersionId);
    if (
      selection.modelId !== input.model.id
      || !feature
      || feature.modelId !== input.model.id
      || !version
      || version.modelId !== input.model.id
      || version.featureId !== feature.id
      || seenFeatures.has(feature.id)
      || seenVersions.has(version.id)
    ) {
      return false;
    }
    seenFeatures.add(feature.id);
    seenVersions.add(version.id);

    const acceptedAsset = version.acceptedAssetId
      ? assetById.get(version.acceptedAssetId)
      : null;
    if (
      !acceptedAsset
      || acceptedAsset.modelId !== input.model.id
      || isFailureMarker(acceptedAsset)
      || !input.selectedAssetIds.has(acceptedAsset.id)
    ) {
      return false;
    }
    if (version.sourceAssetId) {
      const sourceAsset = assetById.get(version.sourceAssetId);
      if (
        !sourceAsset
        || sourceAsset.modelId !== input.model.id
        || isFailureMarker(sourceAsset)
      ) {
        return false;
      }
    }
    const acceptedPlate = plateById.get(version.acceptedCandidatePlateId);
    if (
      !acceptedPlate
      || acceptedPlate.modelId !== input.model.id
      || acceptedPlate.userId !== input.model.userId
      || acceptedPlate.kind !== "accepted_candidate"
      || !acceptedPlate.storageKey.trim()
    ) {
      return false;
    }
    if (version.sourceReferencePlateId) {
      const sourcePlate = plateById.get(version.sourceReferencePlateId);
      if (
        !sourcePlate
        || sourcePlate.modelId !== input.model.id
        || sourcePlate.userId !== input.model.userId
        || sourcePlate.kind !== "uploaded_reference"
        || !sourcePlate.storageKey.trim()
      ) {
        return false;
      }
    }
    if (version.evidenceCropId) {
      const crop = cropById.get(version.evidenceCropId);
      const cropPlate = crop ? plateById.get(crop.plateId) : null;
      if (
        !crop
        || crop.modelId !== input.model.id
        || crop.userId !== input.model.userId
        || !crop.storageKey.trim()
        || !cropPlate
        || cropPlate.modelId !== input.model.id
        || cropPlate.userId !== input.model.userId
        || !cropPlate.storageKey.trim()
      ) {
        return false;
      }
    }
  }
  return true;
}

export function resolveWholeCastRestorePoint(
  rows: RestoreHistoryRows,
  identity: ModelIdentitySnapshot,
): WholeCastRestorePointPlan | null {
  const packageSnapshot = pairForIdentity(identity, rows.packages);
  if (
    !packageSnapshot
    || identity.modelId !== rows.model.id
    || !identity.identityText.trim()
    || sha256(identity.identityText) !== identity.identityTextHash
  ) {
    return null;
  }
  const slots = rows.slots.filter(
    (selection) => selection.packageSnapshotId === packageSnapshot.id,
  );
  const assetById = new Map(rows.assets.map((asset) => [asset.id, asset]));
  const seenAngles = new Set<string>();
  const seenAssets = new Set<number>();
  const availableSlots: WholeCastRestorePointPlan["availableSlots"] = [];
  const unavailableAngles: CanonicalViewAngle[] = [];
  for (const selection of slots) {
    if (
      !CANONICAL_VIEW_ANGLES.includes(selection.viewAngle as CanonicalViewAngle)
      || seenAngles.has(selection.viewAngle)
      || seenAssets.has(selection.selectedAssetId)
    ) {
      return null;
    }
    seenAngles.add(selection.viewAngle);
    seenAssets.add(selection.selectedAssetId);
    const asset = assetById.get(selection.selectedAssetId);
    if (
      !asset
      || asset.modelId !== rows.model.id
      || asset.viewType !== selection.viewAngle
      || isFailureMarker(asset)
    ) {
      unavailableAngles.push(selection.viewAngle as CanonicalViewAngle);
      continue;
    }
    availableSlots.push({ selection, asset });
  }
  const front = availableSlots.find(
    (row) => row.selection.viewAngle === "frontClose",
  );
  if (
    !front
    || identity.anchorAssetId !== front.asset.id
    || front.asset.viewType !== "frontClose"
    || assetIdentityRole(front.asset) !== "anchor"
  ) {
    return null;
  }
  const featureSelections = rows.featureSelections.filter(
    (selection) => selection.identitySnapshotId === identity.id,
  );
  if (!featureGraphCloses({
    model: rows.model,
    selections: featureSelections,
    features: rows.features,
    versions: rows.featureVersions,
    assets: rows.assets,
    selectedAssetIds: new Set(
      availableSlots.map(({ asset }) => asset.id),
    ),
    plates: rows.plates,
    crops: rows.crops,
  })) {
    return null;
  }
  return {
    identity,
    packageSnapshot,
    slots,
    availableSlots,
    unavailableAngles,
    featureSelections,
  };
}

function unavailableReason(
  rows: RestoreHistoryRows,
  identity: ModelIdentitySnapshot,
  currentIdentityId: string | null,
): CastStateUnavailableReason | null {
  if (identity.id === currentIdentityId) return "current";
  const pair = pairForIdentity(identity, rows.packages);
  if (!pair) return "pair_unavailable";
  const selections = rows.featureSelections.filter(
    (selection) => selection.identitySnapshotId === identity.id,
  );
  const plan = resolveWholeCastRestorePoint(rows, identity);
  if (plan) return null;
  const anchor = rows.assets.find((asset) => asset.id === identity.anchorAssetId);
  if (
    !anchor
    || anchor.modelId !== rows.model.id
    || anchor.viewType !== "frontClose"
    || isFailureMarker(anchor)
  ) {
    return "anchor_unavailable";
  }
  return selections.length > 0 ? "feature_unavailable" : "pair_unavailable";
}

export function buildPublicCastStateHistory(
  rows: RestoreHistoryRows,
  enabled: boolean,
): PublicCastStateHistory {
  const currentPackage = rows.packages.find(
    (snapshot) => snapshot.id === rows.model.currentPackageSnapshotId,
  ) ?? null;
  const currentIdentityId = currentPackage?.identitySnapshotId ?? null;
  const draft = isModelDraftStatus(rows.model.status);
  const minted = isModelMintedStatus(rows.model.status);
  if (!draft && !minted) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  }
  const restorePoints = [...rows.identities]
    .sort((a, b) => b.sequence - a.sequence)
    .map((identity): PublicCastStateRestorePoint => {
      const pair = pairForIdentity(identity, rows.packages);
      const reason = unavailableReason(rows, identity, currentIdentityId);
      const plan = resolveWholeCastRestorePoint(rows, identity);
      const anchor = rows.assets.find((asset) => asset.id === identity.anchorAssetId);
      const featureCount = rows.featureSelections.filter(
        (selection) => selection.identitySnapshotId === identity.id,
      ).length;
      return {
        restorePointId:
          pair?.id ?? `unavailable:${sha256(identity.id).slice(0, 24)}`,
        createdAt: iso(identity.createdAt),
        label: IDENTITY_REASON_LABELS[identity.reason],
        previewUrl: anchor && !isFailureMarker(anchor) ? anchor.storageUrl : null,
        selectedViewCount: plan?.availableSlots.length ?? 0,
        featureCount,
        current: identity.id === currentIdentityId,
        available: enabled
          && draft
          && !rows.pendingEvidence
          && reason === null,
        unavailableReason: reason,
      };
    });
  return {
    enabled,
    lifecycle: draft ? "draft" : "minted",
    canRestore: enabled
      && draft
      && !rows.pendingEvidence
      && restorePoints.some((point) => point.available),
    forkRequired: minted,
    blockedByPendingEvidence: rows.pendingEvidence,
    restorePoints,
  };
}

async function readRestoreHistoryRowsIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number; lock?: boolean },
): Promise<RestoreHistoryRows> {
  const modelQuery = tx
    .select()
    .from(models)
    .where(and(
      eq(models.id, input.modelId),
      eq(models.userId, input.userId),
      availableModelWhere(),
    ))
    .limit(1);
  const [model] = input.lock
    ? await modelQuery.for("update")
    : await modelQuery;
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });

  const [
    identities,
    packages,
    assets,
    featureSelections,
    features,
    featureVersions,
    plates,
    crops,
    activeIntents,
    activeCandidates,
  ] = await Promise.all([
    tx.select().from(modelIdentitySnapshots)
      .where(eq(modelIdentitySnapshots.modelId, input.modelId))
      .orderBy(desc(modelIdentitySnapshots.sequence)),
    tx.select().from(modelPackageSnapshots)
      .where(eq(modelPackageSnapshots.modelId, input.modelId))
      .orderBy(desc(modelPackageSnapshots.sequence)),
    tx.select().from(modelAssets)
      .where(eq(modelAssets.modelId, input.modelId))
      .orderBy(desc(modelAssets.createdAt), desc(modelAssets.id)),
    tx.select().from(modelSnapshotFeatureSelections)
      .where(eq(modelSnapshotFeatureSelections.modelId, input.modelId)),
    tx.select().from(modelIdentityFeatures)
      .where(eq(modelIdentityFeatures.modelId, input.modelId)),
    tx.select().from(modelIdentityFeatureVersions)
      .where(eq(modelIdentityFeatureVersions.modelId, input.modelId)),
    tx.select().from(modelReferencePlates)
      .where(and(
        eq(modelReferencePlates.modelId, input.modelId),
        eq(modelReferencePlates.userId, input.userId),
      )),
    tx.select().from(modelEvidenceCrops)
      .where(and(
        eq(modelEvidenceCrops.modelId, input.modelId),
        eq(modelEvidenceCrops.userId, input.userId),
      )),
    tx.select({ id: modelIdentityFeatureIntents.id })
      .from(modelIdentityFeatureIntents)
      .where(and(
        eq(modelIdentityFeatureIntents.modelId, input.modelId),
        eq(modelIdentityFeatureIntents.userId, input.userId),
        isNotNull(modelIdentityFeatureIntents.activeCapabilityKey),
      ))
      .limit(1),
    tx.select({ id: castingEvidenceCandidates.id })
      .from(castingEvidenceCandidates)
      .where(and(
        eq(castingEvidenceCandidates.modelId, input.modelId),
        eq(castingEvidenceCandidates.userId, input.userId),
        isNotNull(castingEvidenceCandidates.activeSlot),
      ))
      .limit(1),
  ]);
  const packageIds = packages.map((snapshot) => snapshot.id);
  const slots = packageIds.length > 0
    ? await tx.select().from(modelPackageSnapshotSlots)
      .where(inArray(modelPackageSnapshotSlots.packageSnapshotId, packageIds))
    : [];
  return {
    model,
    identities,
    packages,
    slots,
    assets,
    featureSelections,
    features,
    featureVersions,
    plates,
    crops,
    pendingEvidence: activeIntents.length > 0 || activeCandidates.length > 0,
  };
}

export async function getOwnedCastStateHistory(input: {
  userId: number;
  modelId: number;
  enabled: boolean;
}): Promise<PublicCastStateHistory> {
  if (!input.enabled) {
    return withTransaction(async (tx) => {
      const [model] = await tx
        .select({ status: models.status })
        .from(models)
        .where(and(
          eq(models.id, input.modelId),
          eq(models.userId, input.userId),
          availableModelWhere(),
        ))
        .limit(1);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      const draft = isModelDraftStatus(model.status);
      const minted = isModelMintedStatus(model.status);
      if (!draft && !minted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      return {
        enabled: false,
        lifecycle: draft ? "draft" : "minted",
        canRestore: false,
        forkRequired: minted,
        blockedByPendingEvidence: false,
        restorePoints: [],
      };
    });
  }
  return withTransaction(async (tx) => buildPublicCastStateHistory(
    await readRestoreHistoryRowsIn(tx, input),
    input.enabled,
  ));
}

export interface WholeCastRestoreResult {
  modelId: number;
  stateVersion: number;
  restored: true;
  selectedViewCount: number;
  missingAngles: CanonicalViewAngle[];
}

export async function commitWholeCastRestore(input: {
  userId: number;
  modelId: number;
  operationId: string;
  restorePointId: string;
}): Promise<SnapshotTransitionResult<WholeCastRestoreResult>> {
  return commitModelSnapshotTransition({
    userId: input.userId,
    modelId: input.modelId,
    operationId: input.operationId,
    expectedKind: "casting.restore_state",
    featureAuthority: "evidence_aware",
    mutate: async (tx, context) => {
      if (!context.current) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This Cast has no saved state to restore.",
        });
      }
      if (!isModelDraftStatus(context.model.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Minted identity is immutable — fork it.",
        });
      }
      const rows = await readRestoreHistoryRowsIn(tx, {
        userId: input.userId,
        modelId: input.modelId,
      });
      if (rows.pendingEvidence) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Finish or discard the current evidence edit before restoring this Cast.",
        });
      }
      const targetPackage = rows.packages.find(
        (snapshot) => snapshot.id === input.restorePointId,
      );
      const targetIdentity = targetPackage
        ? rows.identities.find(
            (identity) => identity.id === targetPackage.identitySnapshotId,
          )
        : null;
      if (!targetPackage || !targetIdentity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That saved Cast state is unavailable.",
        });
      }
      if (
        targetIdentity.id === context.current.identitySnapshot.id
        || targetIdentity.sequence >= context.current.identitySnapshot.sequence
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Choose an earlier Cast state to restore.",
        });
      }
      const target = resolveWholeCastRestorePoint(rows, targetIdentity);
      if (!target || target.packageSnapshot.id !== input.restorePointId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "That saved Cast state is incomplete and cannot be restored.",
        });
      }

      const revisionId = mintRevisionId();
      const updated = await tx.update(models).set({
        masterPrompt: target.identity.masterPrompt,
        technicalSchema: target.identity.technicalSchema,
        preferences: target.identity.preferences,
        identityRevisionId: revisionId,
      }).where(and(
        eq(models.id, input.modelId),
        eq(models.userId, input.userId),
        eq(models.status, "draft"),
        isNull(models.deletedAt),
      ));
      const affected = Array.isArray(updated)
        ? (updated[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0
        : (updated as { affectedRows?: number }).affectedRows ?? 0;
      if (affected !== 1) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This Cast changed before the restore could finish.",
        });
      }

      const restoredAt = new Date().toISOString();
      for (const { selection, asset } of target.availableSlots) {
        const sourceProvenance =
          asset.provenance && typeof asset.provenance === "object"
            ? asset.provenance as { inputs?: unknown }
            : null;
        await tx.insert(modelAssets).values({
          modelId: input.modelId,
          viewType: selection.viewAngle,
          resolution: asset.resolution,
          storageUrl: asset.storageUrl,
          storageKey: asset.storageKey,
          pointsCost: 0,
          pinned: false,
          status: selection.compatibility === "current"
            ? null
            : { state: "stale", at: restoredAt },
          provenance: {
            restoredFromAssetId: asset.id,
            inputs: sourceProvenance?.inputs ?? null,
            engine: "restore",
            ...identityStampFor({
              role: selection.viewAngle === "frontClose" ? "anchor" : "display",
              revisionId,
              identityText: target.identity.identityText,
            }),
          },
        });
      }

      return {
        result: {
          modelId: input.modelId,
          stateVersion: context.model.stateVersion + 1,
          restored: true,
          selectedViewCount: target.availableSlots.length,
          missingAngles: target.unavailableAngles,
        },
        transition: {
          packageReason: "whole_restore",
          identity: {
            reason: "restore",
            anchorAssetId: target.identity.anchorAssetId,
            recipeVersion: WHOLE_CAST_RESTORE_RECIPE_VERSION,
            restoredFromSnapshotId: target.identity.id,
          },
          slotMode: "replaceWithHistorical",
          slotChanges: target.availableSlots.map(({ selection, asset }) => ({
            viewAngle: selection.viewAngle as CanonicalViewAngle,
            selectedAssetId: asset.id,
            compatibility: selection.compatibility,
            selectionReason: "restored" as const,
            sourceSelectionId: selection.id,
          })),
          featureSelections: {
            replaceWithHistorical: target.featureSelections.map((selection) => ({
              featureId: selection.featureId,
              featureVersionId: selection.featureVersionId,
              sourceSelectionId: selection.id,
            })),
          },
        },
      };
    },
    finalize: async (tx, committed) => {
      await finalizeRunningGenerationOperationSuccessIn(tx, {
        userId: input.userId,
        operationId: input.operationId,
        result: committed.result,
      });
    },
  });
}

export async function preflightWholeCastRestore(input: {
  userId: number;
  modelId: number;
  restorePointId: string;
}): Promise<void> {
  await withTransaction(async (tx) => {
    const rows = await readRestoreHistoryRowsIn(tx, input);
    if (!isModelDraftStatus(rows.model.status)) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Minted identity is immutable — fork it.",
      });
    }
    if (rows.pendingEvidence) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Finish or discard the current evidence edit before restoring this Cast.",
      });
    }
    const currentPackage = rows.packages.find(
      (snapshot) => snapshot.id === rows.model.currentPackageSnapshotId,
    );
    const currentIdentity = currentPackage
      ? rows.identities.find(
          (identity) => identity.id === currentPackage.identitySnapshotId,
        )
      : null;
    const targetPackage = rows.packages.find(
      (snapshot) => snapshot.id === input.restorePointId,
    );
    const identity = targetPackage
      ? rows.identities.find((row) => row.id === targetPackage.identitySnapshotId)
      : null;
    if (
      !currentPackage
      || !currentIdentity
      || !identity
      || identity.id === currentPackage.identitySnapshotId
      || identity.sequence >= currentIdentity.sequence
      || !resolveWholeCastRestorePoint(rows, identity)
    ) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "That saved Cast state cannot be restored.",
      });
    }
  });
}
