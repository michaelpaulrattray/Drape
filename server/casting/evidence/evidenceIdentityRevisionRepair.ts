/**
 * Private, bounded repair for evidence acceptance that incorrectly advanced
 * the legacy facial-identity revision.
 *
 * Planning is SELECT-only. Apply is one all-or-nothing transaction:
 *
 *   owned model lock -> absent operation-lock fence -> immutable snapshot and
 *   feature witnesses -> exact revision + false-staleness correction ->
 *   postflight proof.
 *
 * The tool has no route, worker, scheduler or startup caller.
 */
import { createHash } from "node:crypto";
import {
  and,
  eq,
  inArray,
  isNotNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import {
  generationOperationLocks,
  modelAssets,
  modelIdentityFeatures,
  modelIdentityFeatureVersions,
  modelIdentitySnapshots,
  modelPackageSnapshots,
  modelPackageSnapshotSlots,
  models,
  modelSnapshotFeatureSelections,
} from "../../../drizzle/schema";
import {
  CANONICAL_VIEW_ANGLES,
  type CanonicalViewAngle,
} from "../../../shared/boardTypes";
import { withTransaction, type TransactionHandle } from "../../db/connection";
import { stableCanonicalJson } from "../operationContract";
import { isProductionAppId } from "../deletionAudit";
import { availableModelWhere } from "../modelAvailability";
import { INK_ADD_CAPABILITY_KEY } from "./evidenceCandidateContract";
import { affectedViewsForInkAdd } from "./inkViewImpact";
import { isSupportedInkPackageTuple } from "./evidencePackageRegistry";

export const EVIDENCE_IDENTITY_REVISION_REPAIR_ERRORS = [
  "active_operation",
  "accepted_asset_invalid",
  "accepted_revision_mismatch",
  "anchor_invalid",
  "anchor_revision_missing",
  "feature_graph_invalid",
  "identity_snapshot_invalid",
  "package_lineage_invalid",
  "package_slot_graph_invalid",
  "revision_shape_invalid",
] as const;

export type EvidenceIdentityRevisionRepairError =
  typeof EVIDENCE_IDENTITY_REVISION_REPAIR_ERRORS[number];

export interface EvidenceIdentityRevisionRepairSelector {
  userId?: number;
  modelIds: number[];
  expectedModelCount: number;
  expectedRepairCount: number;
  expectedRestoredViewCount: number;
}

export interface EvidenceIdentityRevisionRepairRow {
  modelId: number;
  acceptedAssetId: number | null;
  fromRevisionHash: string | null;
  toRevisionHash: string | null;
  restoredViews: CanonicalViewAngle[];
  restoredAssetIds: number[];
  status: "ready" | "repaired" | "blocked";
  errorCode: EvidenceIdentityRevisionRepairError | null;
}

export interface EvidenceIdentityRevisionRepairPlan {
  ready: boolean;
  expectedModelCount: number;
  expectedRepairCount: number;
  expectedRestoredViewCount: number;
  models: number[];
  rows: EvidenceIdentityRevisionRepairRow[];
}

export interface EvidenceIdentityRevisionRepairResult {
  success: boolean;
  expectedModelCount: number;
  expectedRepairCount: number;
  expectedRestoredViewCount: number;
  updatedModels: number;
  updatedAcceptedAssets: number;
  restoredAssets: number;
  updatedSlots: number;
  rows: EvidenceIdentityRevisionRepairRow[];
}

export interface EvidenceIdentityRevisionRepairArgs
  extends EvidenceIdentityRevisionRepairSelector {
  databaseUrl: string;
  appId: string;
  apply: boolean;
  allowWrite: boolean;
  allowProductionReadOnly: boolean;
  allowProductionWrite: boolean;
  confirmAppId: string | null;
  confirmHost: string | null;
  confirmDatabase: string | null;
}

interface Subject {
  modelId: number;
  userId: number;
  currentPackageSnapshotId: string;
  identityRevisionId: string | null;
}

interface Assessment {
  row: EvidenceIdentityRevisionRepairRow;
  userId: number;
  packageSnapshotId: string;
  anchorAssetId: number | null;
  restoredViews: CanonicalViewAngle[];
  restoredAssetIds: number[];
  needsRevisionRepair: boolean;
  fromRevision: string | null;
  toRevision: string | null;
}

interface PackageSlotWitness {
  viewAngle: CanonicalViewAngle;
  selectedAssetId: number;
  compatibility: "current" | "stale";
  selectionReason: string;
}

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return Number(
      (result[0] as { affectedRows?: unknown } | undefined)?.affectedRows ?? 0,
    );
  }
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

function revisionFrom(provenance: unknown): string | null {
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    return null;
  }
  const value = (provenance as { identityRevisionId?: unknown })
    .identityRevisionId;
  return typeof value === "string" && value.trim() ? value : null;
}

function roleFrom(provenance: unknown): string | null {
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    return null;
  }
  const value = (provenance as { identityRole?: unknown }).identityRole;
  return typeof value === "string" ? value : null;
}

function revisionHash(value: string | null): string | null {
  return value
    ? createHash("sha256").update(value).digest("hex").slice(0, 16)
    : null;
}

function sameDocuments(
  left: {
    masterPrompt: string;
    technicalSchema: unknown;
    preferences: unknown;
  },
  right: {
    masterPrompt: string;
    technicalSchema: unknown;
    preferences: unknown;
  },
): boolean {
  return left.masterPrompt === right.masterPrompt
    && stableCanonicalJson(left.technicalSchema)
      === stableCanonicalJson(right.technicalSchema)
    && stableCanonicalJson(left.preferences)
      === stableCanonicalJson(right.preferences);
}

function normalizeSelector(
  input: EvidenceIdentityRevisionRepairSelector,
): EvidenceIdentityRevisionRepairSelector {
  const modelIds = Array.from(new Set(input.modelIds)).sort((a, b) => a - b);
  if (input.userId === undefined && modelIds.length === 0) {
    throw new Error(
      "Evidence identity-revision repair requires a user id or model ids",
    );
  }
  if (input.userId !== undefined && !positiveInteger(input.userId)) {
    throw new Error("Evidence identity-revision repair user id must be positive");
  }
  if (modelIds.some((modelId) => !positiveInteger(modelId))) {
    throw new Error("Evidence identity-revision repair model ids must be positive");
  }
  if (!positiveInteger(input.expectedModelCount)) {
    throw new Error(
      "Evidence identity-revision repair expected model count must be positive",
    );
  }
  if (
    !Number.isSafeInteger(input.expectedRepairCount)
    || input.expectedRepairCount < 0
  ) {
    throw new Error(
      "Evidence identity-revision repair expected row count must be non-negative",
    );
  }
  if (
    !Number.isSafeInteger(input.expectedRestoredViewCount)
    || input.expectedRestoredViewCount < 0
  ) {
    throw new Error(
      "Evidence identity-revision repair expected restored-view count must be non-negative",
    );
  }
  return { ...input, modelIds };
}

async function listSubjectsIn(
  tx: TransactionHandle,
  selector: Pick<EvidenceIdentityRevisionRepairSelector, "userId" | "modelIds">,
  lock: boolean,
): Promise<Subject[]> {
  const filters: SQL[] = [
    availableModelWhere(),
    isNotNull(models.currentPackageSnapshotId),
  ];
  if (selector.userId !== undefined) {
    filters.push(eq(models.userId, selector.userId));
  }
  if (selector.modelIds.length > 0) {
    filters.push(inArray(models.id, selector.modelIds));
  }
  const query = tx
    .select({
      modelId: models.id,
      userId: models.userId,
      currentPackageSnapshotId: models.currentPackageSnapshotId,
      identityRevisionId: models.identityRevisionId,
    })
    .from(models)
    .where(and(...filters))
    .orderBy(models.id);
  const rows = lock ? await query.for("update") : await query;
  return rows.map((row) => ({
    ...row,
    currentPackageSnapshotId: row.currentPackageSnapshotId!,
  }));
}

function blocked(
  subject: Subject,
  errorCode: EvidenceIdentityRevisionRepairError,
  input: {
    acceptedAssetId?: number | null;
    fromRevision?: string | null;
    toRevision?: string | null;
  } = {},
): Assessment {
  const fromRevision = input.fromRevision ?? subject.identityRevisionId;
  const toRevision = input.toRevision ?? null;
  return {
    row: {
      modelId: subject.modelId,
      acceptedAssetId: input.acceptedAssetId ?? null,
      fromRevisionHash: revisionHash(fromRevision),
      toRevisionHash: revisionHash(toRevision),
      restoredViews: [],
      restoredAssetIds: [],
      status: "blocked",
      errorCode,
    },
    userId: subject.userId,
    packageSnapshotId: subject.currentPackageSnapshotId,
    anchorAssetId: null,
    restoredViews: [],
    restoredAssetIds: [],
    needsRevisionRepair: false,
    fromRevision,
    toRevision,
  };
}

async function assessSubjectIn(
  tx: TransactionHandle,
  subject: Subject,
  lock: boolean,
): Promise<Assessment> {
  const operationQuery = tx
    .select({ operationId: generationOperationLocks.operationId })
    .from(generationOperationLocks)
    .where(eq(generationOperationLocks.lockKey, `model:${subject.modelId}`))
    .limit(1);
  const operationRows = lock
    ? await operationQuery.for("update")
    : await operationQuery;
  if (operationRows.length > 0) return blocked(subject, "active_operation");

  const packages = await tx
    .select({
      identitySnapshotId: modelPackageSnapshots.identitySnapshotId,
      parentPackageSnapshotId: modelPackageSnapshots.parentPackageSnapshotId,
      reason: modelPackageSnapshots.reason,
    })
    .from(modelPackageSnapshots)
    .where(and(
      eq(modelPackageSnapshots.id, subject.currentPackageSnapshotId),
      eq(modelPackageSnapshots.modelId, subject.modelId),
    ));
  if (
    packages.length !== 1
    || packages[0].reason !== "evidence_accept"
    || !packages[0].parentPackageSnapshotId
  ) {
    return blocked(subject, "identity_snapshot_invalid");
  }
  const parentPackages = await tx
    .select({ id: modelPackageSnapshots.id })
    .from(modelPackageSnapshots)
    .where(and(
      eq(
        modelPackageSnapshots.id,
        packages[0].parentPackageSnapshotId!,
      ),
      eq(modelPackageSnapshots.modelId, subject.modelId),
    ));
  if (parentPackages.length !== 1) {
    return blocked(subject, "package_lineage_invalid");
  }
  const identities = await tx
    .select()
    .from(modelIdentitySnapshots)
    .where(and(
      eq(modelIdentitySnapshots.id, packages[0].identitySnapshotId),
      eq(modelIdentitySnapshots.modelId, subject.modelId),
    ));
  if (
    identities.length !== 1
    || identities[0].reason !== "evidence_accept"
    || !identities[0].parentSnapshotId
  ) {
    return blocked(subject, "identity_snapshot_invalid");
  }
  const identity = identities[0];
  const parents = await tx
    .select()
    .from(modelIdentitySnapshots)
    .where(and(
      eq(modelIdentitySnapshots.id, identity.parentSnapshotId!),
      eq(modelIdentitySnapshots.modelId, subject.modelId),
    ));
  if (
    parents.length !== 1
    || parents[0].anchorAssetId !== identity.anchorAssetId
    || !sameDocuments(identity, parents[0])
  ) {
    return blocked(subject, "identity_snapshot_invalid");
  }

  const currentSlotsQuery = tx
    .select({
      viewAngle: modelPackageSnapshotSlots.viewAngle,
      selectedAssetId: modelPackageSnapshotSlots.selectedAssetId,
      compatibility: modelPackageSnapshotSlots.compatibility,
      selectionReason: modelPackageSnapshotSlots.selectionReason,
    })
    .from(modelPackageSnapshotSlots)
    .where(and(
      eq(
        modelPackageSnapshotSlots.packageSnapshotId,
        subject.currentPackageSnapshotId,
      ),
    ));
  const parentSlotsQuery = tx
    .select({
      viewAngle: modelPackageSnapshotSlots.viewAngle,
      selectedAssetId: modelPackageSnapshotSlots.selectedAssetId,
      compatibility: modelPackageSnapshotSlots.compatibility,
      selectionReason: modelPackageSnapshotSlots.selectionReason,
    })
    .from(modelPackageSnapshotSlots)
    .where(eq(
      modelPackageSnapshotSlots.packageSnapshotId,
      parentPackages[0].id,
    ));
  const currentSlots = (lock
    ? await currentSlotsQuery.for("update")
    : await currentSlotsQuery) as PackageSlotWitness[];
  const parentSlots = (lock
    ? await parentSlotsQuery.for("update")
    : await parentSlotsQuery) as PackageSlotWitness[];
  const currentByAngle = new Map(
    currentSlots.map((slot) => [slot.viewAngle, slot]),
  );
  const parentByAngle = new Map(
    parentSlots.map((slot) => [slot.viewAngle, slot]),
  );
  const frontClose = currentByAngle.get("frontClose");
  const frontFull = currentByAngle.get("frontFull");
  if (
    currentByAngle.size !== currentSlots.length
    || parentByAngle.size !== parentSlots.length
    || currentSlots.length !== parentSlots.length
    || !frontClose
    || !frontFull
    || frontClose.selectedAssetId !== identity.anchorAssetId
    || frontClose.selectionReason !== "carried"
    || frontFull.compatibility !== "current"
    || frontFull.selectionReason !== "evidence_accept"
  ) {
    return blocked(subject, "package_slot_graph_invalid");
  }

  const selectedFeatures = await tx
    .select({
      acceptedAssetId: modelIdentityFeatureVersions.acceptedAssetId,
      sourceAssetId: modelIdentityFeatureVersions.sourceAssetId,
      ontologyVersion: modelIdentityFeatureVersions.ontologyVersion,
      zone: modelIdentityFeatureVersions.zone,
      surface: modelIdentityFeatureVersions.surface,
      side: modelIdentityFeatureVersions.side,
      category: modelIdentityFeatures.category,
    })
    .from(modelSnapshotFeatureSelections)
    .innerJoin(
      modelIdentityFeatureVersions,
      and(
        eq(
          modelIdentityFeatureVersions.id,
          modelSnapshotFeatureSelections.featureVersionId,
        ),
        eq(
          modelIdentityFeatureVersions.modelId,
          modelSnapshotFeatureSelections.modelId,
        ),
      ),
    )
    .innerJoin(
      modelIdentityFeatures,
      and(
        eq(
          modelIdentityFeatures.id,
          modelSnapshotFeatureSelections.featureId,
        ),
        eq(
          modelIdentityFeatures.modelId,
          modelSnapshotFeatureSelections.modelId,
        ),
      ),
    )
    .where(and(
      eq(modelSnapshotFeatureSelections.modelId, subject.modelId),
      eq(
        modelSnapshotFeatureSelections.identitySnapshotId,
        identity.id,
      ),
    ));
  if (
    selectedFeatures.length !== 1
    || selectedFeatures[0].category !== "ink"
    || !isSupportedInkPackageTuple({
      capabilityKey: INK_ADD_CAPABILITY_KEY,
      ontologyVersion: selectedFeatures[0].ontologyVersion,
      zone: selectedFeatures[0].zone,
      surface: selectedFeatures[0].surface,
      side: selectedFeatures[0].side,
    })
    || !positiveInteger(selectedFeatures[0].acceptedAssetId ?? 0)
    || selectedFeatures[0].acceptedAssetId !== frontFull.selectedAssetId
    || selectedFeatures[0].sourceAssetId === selectedFeatures[0].acceptedAssetId
  ) {
    return blocked(subject, "feature_graph_invalid");
  }
  const acceptedAssetId = selectedFeatures[0].acceptedAssetId!;
  const affectedViews = new Set(affectedViewsForInkAdd({
    capabilityKey: INK_ADD_CAPABILITY_KEY,
    ontologyVersion: selectedFeatures[0].ontologyVersion,
    zone: selectedFeatures[0].zone,
    surface: selectedFeatures[0].surface,
    side: selectedFeatures[0].side,
  }));
  const restoredViews: CanonicalViewAngle[] = [];
  const restoredAssetIds: number[] = [];
  for (const angle of CANONICAL_VIEW_ANGLES) {
    const currentSlot = currentByAngle.get(angle);
    const parentSlot = parentByAngle.get(angle);
    if (!currentSlot && !parentSlot) continue;
    if (!currentSlot || !parentSlot) {
      return blocked(subject, "package_slot_graph_invalid", {
        acceptedAssetId,
      });
    }
    if (angle === "frontFull") {
      if (
        currentSlot.selectedAssetId !== acceptedAssetId
        || currentSlot.compatibility !== "current"
        || currentSlot.selectionReason !== "evidence_accept"
      ) {
        return blocked(subject, "package_slot_graph_invalid", {
          acceptedAssetId,
        });
      }
      continue;
    }
    if (
      currentSlot.selectedAssetId !== parentSlot.selectedAssetId
      || currentSlot.selectionReason !== "carried"
      || !["current", "stale"].includes(parentSlot.compatibility)
    ) {
      return blocked(subject, "package_slot_graph_invalid", {
        acceptedAssetId,
      });
    }
    if (affectedViews.has(angle)) {
      if (currentSlot.compatibility !== "stale") {
        return blocked(subject, "package_slot_graph_invalid", {
          acceptedAssetId,
        });
      }
      continue;
    }
    if (parentSlot.compatibility === "stale") {
      if (currentSlot.compatibility !== "stale") {
        return blocked(subject, "package_slot_graph_invalid", {
          acceptedAssetId,
        });
      }
      continue;
    }
    if (currentSlot.compatibility === "stale") {
      restoredViews.push(angle);
      restoredAssetIds.push(currentSlot.selectedAssetId);
    } else if (currentSlot.compatibility !== "current") {
      return blocked(subject, "package_slot_graph_invalid", {
        acceptedAssetId,
      });
    }
  }
  if (new Set(restoredAssetIds).size !== restoredAssetIds.length) {
    return blocked(subject, "package_slot_graph_invalid", {
      acceptedAssetId,
    });
  }

  const requiredAssetIds = Array.from(new Set([
    identity.anchorAssetId,
    acceptedAssetId,
    ...currentSlots.map((slot) => slot.selectedAssetId),
  ])).sort((left, right) => left - right);
  const assetsQuery = tx
    .select({
      id: modelAssets.id,
      viewType: modelAssets.viewType,
      storageUrl: modelAssets.storageUrl,
      status: modelAssets.status,
      provenance: modelAssets.provenance,
    })
    .from(modelAssets)
    .where(and(
      eq(modelAssets.modelId, subject.modelId),
      inArray(modelAssets.id, requiredAssetIds),
    ));
  const assets = lock ? await assetsQuery.for("update") : await assetsQuery;
  if (assets.length !== requiredAssetIds.length) {
    return blocked(subject, "package_slot_graph_invalid", { acceptedAssetId });
  }
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const anchor = assets.find((asset) => asset.id === identity.anchorAssetId);
  const accepted = assets.find((asset) => asset.id === acceptedAssetId);
  const targetRevision = revisionFrom(anchor?.provenance);
  const acceptedRevision = revisionFrom(accepted?.provenance);
  if (
    !anchor
    || anchor.viewType !== "frontClose"
    || !anchor.storageUrl.trim()
    || roleFrom(anchor.provenance) !== "anchor"
  ) {
    return blocked(subject, "anchor_invalid", { acceptedAssetId });
  }
  if (!targetRevision) {
    return blocked(subject, "anchor_revision_missing", { acceptedAssetId });
  }
  if (
    !accepted
    || accepted.viewType !== "frontFull"
    || !accepted.storageUrl.trim()
    || roleFrom(accepted.provenance) !== "display"
  ) {
    return blocked(subject, "accepted_asset_invalid", {
      acceptedAssetId,
      toRevision: targetRevision,
    });
  }
  for (const angle of restoredViews) {
    const slot = currentByAngle.get(angle)!;
    const asset = assetById.get(slot.selectedAssetId);
    const state = (
      asset?.status
      && typeof asset.status === "object"
      && !Array.isArray(asset.status)
    )
      ? (asset.status as { state?: unknown }).state
      : null;
    if (
      !asset
      || asset.viewType !== angle
      || !asset.storageUrl.trim()
      || state !== "stale"
    ) {
      return blocked(subject, "package_slot_graph_invalid", {
        acceptedAssetId,
        toRevision: targetRevision,
      });
    }
  }
  if (!subject.identityRevisionId || !acceptedRevision) {
    return blocked(subject, "revision_shape_invalid", {
      acceptedAssetId,
      toRevision: targetRevision,
    });
  }
  if (
    subject.identityRevisionId === targetRevision
    && acceptedRevision === targetRevision
  ) {
    if (restoredViews.length > 0) {
      return blocked(subject, "accepted_revision_mismatch", {
        acceptedAssetId,
        fromRevision: subject.identityRevisionId,
        toRevision: targetRevision,
      });
    }
    return {
      row: {
        modelId: subject.modelId,
        acceptedAssetId,
        fromRevisionHash: revisionHash(subject.identityRevisionId),
        toRevisionHash: revisionHash(targetRevision),
        restoredViews: [],
        restoredAssetIds: [],
        status: "repaired",
        errorCode: null,
      },
      userId: subject.userId,
      packageSnapshotId: subject.currentPackageSnapshotId,
      anchorAssetId: identity.anchorAssetId,
      restoredViews: [],
      restoredAssetIds: [],
      needsRevisionRepair: false,
      fromRevision: subject.identityRevisionId,
      toRevision: targetRevision,
    };
  }
  if (
    subject.identityRevisionId === targetRevision
    || acceptedRevision !== subject.identityRevisionId
  ) {
    return blocked(subject, "accepted_revision_mismatch", {
      acceptedAssetId,
      fromRevision: subject.identityRevisionId,
      toRevision: targetRevision,
    });
  }
  if (restoredViews.length === 0) {
    return blocked(subject, "package_slot_graph_invalid", {
      acceptedAssetId,
      fromRevision: subject.identityRevisionId,
      toRevision: targetRevision,
    });
  }
  return {
    row: {
      modelId: subject.modelId,
      acceptedAssetId,
      fromRevisionHash: revisionHash(subject.identityRevisionId),
      toRevisionHash: revisionHash(targetRevision),
      restoredViews,
      restoredAssetIds,
      status: "ready",
      errorCode: null,
    },
    userId: subject.userId,
    packageSnapshotId: subject.currentPackageSnapshotId,
    anchorAssetId: identity.anchorAssetId,
    restoredViews,
    restoredAssetIds,
    needsRevisionRepair: true,
    fromRevision: subject.identityRevisionId,
    toRevision: targetRevision,
  };
}

async function inspectIn(
  tx: TransactionHandle,
  selector: EvidenceIdentityRevisionRepairSelector,
  lock: boolean,
): Promise<{ subjects: Subject[]; assessments: Assessment[] }> {
  const normalized = normalizeSelector(selector);
  const subjects = await listSubjectsIn(tx, normalized, lock);
  if (subjects.length !== normalized.expectedModelCount) {
    throw new Error(
      `Evidence identity-revision repair cohort count mismatch: expected ${normalized.expectedModelCount}, found ${subjects.length}`,
    );
  }
  const assessments: Assessment[] = [];
  for (const subject of subjects) {
    assessments.push(await assessSubjectIn(tx, subject, lock));
  }
  const readyRows = assessments.filter(
    ({ row }) => row.status === "ready",
  ).length;
  if (readyRows !== normalized.expectedRepairCount) {
    throw new Error(
      `Evidence identity-revision repair row count mismatch: expected ${normalized.expectedRepairCount}, found ${readyRows}`,
    );
  }
  const restoredViews = assessments.reduce(
    (total, assessment) => total + assessment.restoredViews.length,
    0,
  );
  if (restoredViews !== normalized.expectedRestoredViewCount) {
    throw new Error(
      `Evidence identity-revision repair restored-view count mismatch: expected ${normalized.expectedRestoredViewCount}, found ${restoredViews}`,
    );
  }
  return { subjects, assessments };
}

export async function planEvidenceIdentityRevisionRepair(
  input: EvidenceIdentityRevisionRepairSelector,
): Promise<EvidenceIdentityRevisionRepairPlan> {
  const normalized = normalizeSelector(input);
  return withTransaction(async (tx) => {
    const inspected = await inspectIn(tx, normalized, false);
    const rows = inspected.assessments.map(({ row }) => row);
    return {
      ready: rows.every((row) => row.status !== "blocked"),
      expectedModelCount: normalized.expectedModelCount,
      expectedRepairCount: normalized.expectedRepairCount,
      expectedRestoredViewCount: normalized.expectedRestoredViewCount,
      models: inspected.subjects.map(({ modelId }) => modelId),
      rows,
    };
  });
}

export async function applyEvidenceIdentityRevisionRepair(
  input: EvidenceIdentityRevisionRepairSelector,
): Promise<EvidenceIdentityRevisionRepairResult> {
  const normalized = normalizeSelector(input);
  return withTransaction(async (tx) => {
    const inspected = await inspectIn(tx, normalized, true);
    if (inspected.assessments.some(({ row }) => row.status === "blocked")) {
      return {
        success: false,
        expectedModelCount: normalized.expectedModelCount,
        expectedRepairCount: normalized.expectedRepairCount,
        expectedRestoredViewCount: normalized.expectedRestoredViewCount,
        updatedModels: 0,
        updatedAcceptedAssets: 0,
        restoredAssets: 0,
        updatedSlots: 0,
        rows: inspected.assessments.map(({ row }) => row),
      };
    }
    let updatedModels = 0;
    let updatedAcceptedAssets = 0;
    let restoredAssets = 0;
    let updatedSlots = 0;
    const repairedAt = new Date().toISOString();
    for (const assessment of inspected.assessments) {
      if (
        assessment.row.status !== "ready"
        || !assessment.needsRevisionRepair
        || !assessment.fromRevision
        || !assessment.toRevision
        || !assessment.row.acceptedAssetId
        || !assessment.anchorAssetId
      ) {
        continue;
      }
      const modelResult = await tx
        .update(models)
        .set({ identityRevisionId: assessment.toRevision })
        .where(and(
          eq(models.id, assessment.row.modelId),
          eq(models.userId, assessment.userId),
          eq(models.identityRevisionId, assessment.fromRevision),
          availableModelWhere(),
        ));
      if (affectedRows(modelResult) !== 1) {
        throw new Error("Evidence identity-revision repair model write count mismatch");
      }
      updatedModels += 1;
      const assetResult = await tx
        .update(modelAssets)
        .set({
          provenance: sql`JSON_SET(${modelAssets.provenance}, '$.identityRevisionId', ${assessment.toRevision})`,
        })
        .where(and(
          eq(modelAssets.id, assessment.row.acceptedAssetId),
          eq(modelAssets.modelId, assessment.row.modelId),
          sql`JSON_UNQUOTE(JSON_EXTRACT(${modelAssets.provenance}, '$.identityRevisionId')) = ${assessment.fromRevision}`,
        ));
      if (affectedRows(assetResult) !== 1) {
        throw new Error("Evidence identity-revision repair asset write count mismatch");
      }
      updatedAcceptedAssets += 1;
      const restoredAssetResult = await tx
        .update(modelAssets)
        .set({ status: { state: "current", at: repairedAt } })
        .where(and(
          eq(modelAssets.modelId, assessment.row.modelId),
          inArray(modelAssets.id, assessment.restoredAssetIds),
          sql`JSON_UNQUOTE(JSON_EXTRACT(${modelAssets.status}, '$.state')) = 'stale'`,
        ));
      if (affectedRows(restoredAssetResult) !== assessment.restoredAssetIds.length) {
        throw new Error(
          "Evidence identity-revision repair restored-asset write count mismatch",
        );
      }
      restoredAssets += assessment.restoredAssetIds.length;
      const slotPairs = assessment.restoredViews.map((viewAngle, index) =>
        and(
          eq(modelPackageSnapshotSlots.viewAngle, viewAngle),
          eq(
            modelPackageSnapshotSlots.selectedAssetId,
            assessment.restoredAssetIds[index],
          ),
        )
      );
      const slotPairWhere = or(...slotPairs);
      if (!slotPairWhere) {
        throw new Error("Evidence identity-revision repair slot set is empty");
      }
      const slotResult = await tx
        .update(modelPackageSnapshotSlots)
        .set({ compatibility: "current" })
        .where(and(
          eq(
            modelPackageSnapshotSlots.packageSnapshotId,
            assessment.packageSnapshotId,
          ),
          slotPairWhere,
          eq(modelPackageSnapshotSlots.compatibility, "stale"),
          eq(modelPackageSnapshotSlots.selectionReason, "carried"),
        ));
      if (affectedRows(slotResult) !== assessment.restoredViews.length) {
        throw new Error("Evidence identity-revision repair slot write count mismatch");
      }
      updatedSlots += assessment.restoredViews.length;
    }
    if (
      updatedModels !== normalized.expectedRepairCount
      || updatedAcceptedAssets !== normalized.expectedRepairCount
      || restoredAssets !== normalized.expectedRestoredViewCount
      || updatedSlots !== normalized.expectedRestoredViewCount
    ) {
      throw new Error("Evidence identity-revision repair write total mismatch");
    }
    const postflight = await inspectIn(tx, {
      ...normalized,
      expectedRepairCount: 0,
      expectedRestoredViewCount: 0,
    }, true);
    const postflightRows = postflight.assessments.map(({ row }) => row);
    if (postflightRows.some((row) => row.status !== "repaired")) {
      throw new Error("Evidence identity-revision repair postflight failed");
    }
    const rows = inspected.assessments.map(({ row }) => row.status === "ready"
      ? { ...row, status: "repaired" as const }
      : row);
    return {
      success: true,
      expectedModelCount: normalized.expectedModelCount,
      expectedRepairCount: normalized.expectedRepairCount,
      expectedRestoredViewCount: normalized.expectedRestoredViewCount,
      updatedModels,
      updatedAcceptedAssets,
      restoredAssets,
      updatedSlots,
      rows,
    };
  });
}

function parsePositiveInteger(value: string, flag: string): number {
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`${flag} must be positive`);
  const parsed = Number(value);
  if (!positiveInteger(parsed)) throw new Error(`${flag} must be safe`);
  return parsed;
}

function parseNonNegativeInteger(value: string, flag: string): number {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) {
    throw new Error(`${flag} must be non-negative`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${flag} must be safe`);
  return parsed;
}

export function parseEvidenceIdentityRevisionRepairArgs(
  argv: string[],
): EvidenceIdentityRevisionRepairArgs {
  let databaseUrl = "";
  let appId = "";
  let userId: number | undefined;
  let expectedModelCount = 0;
  let expectedRepairCount: number | undefined;
  let expectedRestoredViewCount: number | undefined;
  let apply = false;
  let allowWrite = false;
  let allowProductionReadOnly = false;
  let allowProductionWrite = false;
  let confirmAppId: string | null = null;
  let confirmHost: string | null = null;
  let confirmDatabase: string | null = null;
  const modelIds: number[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--apply") {
      apply = true;
      continue;
    }
    if (flag === "--allow-evidence-identity-repair-write") {
      allowWrite = true;
      continue;
    }
    if (flag === "--allow-production-read-only") {
      allowProductionReadOnly = true;
      continue;
    }
    if (flag === "--allow-production-evidence-identity-repair") {
      allowProductionWrite = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${flag} requires a value`);
    }
    if (flag === "--database-url") databaseUrl = value;
    else if (flag === "--app-id") appId = value;
    else if (flag === "--user-id") userId = parsePositiveInteger(value, flag);
    else if (flag === "--model-id") {
      modelIds.push(parsePositiveInteger(value, flag));
    } else if (flag === "--expected-model-count") {
      expectedModelCount = parsePositiveInteger(value, flag);
    } else if (flag === "--expected-repair-count") {
      expectedRepairCount = parseNonNegativeInteger(value, flag);
    } else if (flag === "--expected-restored-view-count") {
      expectedRestoredViewCount = parseNonNegativeInteger(value, flag);
    } else if (flag === "--confirm-app-id") confirmAppId = value;
    else if (flag === "--confirm-host") confirmHost = value;
    else if (flag === "--confirm-database") confirmDatabase = value;
    else throw new Error(`Unknown argument: ${flag}`);
    index += 1;
  }

  if (!databaseUrl) throw new Error("--database-url is required");
  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error("--database-url must be a valid URL");
  }
  if (target.protocol !== "mysql:") {
    throw new Error("--database-url must use mysql:");
  }
  const databaseName = target.pathname.replace(/^\//, "");
  if (!databaseName) throw new Error("--database-url must name a database");
  if (!appId.trim()) throw new Error("--app-id is required");
  const normalizedIds = Array.from(new Set(modelIds)).sort((a, b) => a - b);
  if (userId === undefined && normalizedIds.length === 0) {
    throw new Error(
      "Provide --user-id or --model-id; full-database repair is refused",
    );
  }
  if (!positiveInteger(expectedModelCount)) {
    throw new Error("--expected-model-count is required");
  }
  if (expectedRepairCount === undefined) {
    throw new Error("--expected-repair-count is required");
  }
  if (expectedRestoredViewCount === undefined) {
    throw new Error("--expected-restored-view-count is required");
  }
  const production = isProductionAppId(appId);
  if (production && !apply && !allowProductionReadOnly) {
    throw new Error(
      "Production evidence identity-revision planning requires --allow-production-read-only",
    );
  }
  if (apply) {
    if (!allowWrite) {
      throw new Error(
        "Applying evidence identity-revision repair requires --allow-evidence-identity-repair-write",
      );
    }
    if (confirmAppId !== appId) {
      throw new Error("--confirm-app-id must exactly match --app-id");
    }
    if (confirmHost !== target.host) {
      throw new Error("--confirm-host must exactly match the database URL");
    }
    if (confirmDatabase !== databaseName) {
      throw new Error("--confirm-database must exactly match the database URL");
    }
    if (production && !allowProductionWrite) {
      throw new Error(
        "Production evidence identity-revision repair requires --allow-production-evidence-identity-repair",
      );
    }
  } else if (allowWrite || allowProductionWrite) {
    throw new Error(
      "Evidence identity-revision write flags are valid only with --apply",
    );
  }

  return {
    databaseUrl,
    appId,
    ...(userId !== undefined ? { userId } : {}),
    modelIds: normalizedIds,
    expectedModelCount,
    expectedRepairCount,
    expectedRestoredViewCount,
    apply,
    allowWrite,
    allowProductionReadOnly,
    allowProductionWrite,
    confirmAppId,
    confirmHost,
    confirmDatabase,
  };
}
