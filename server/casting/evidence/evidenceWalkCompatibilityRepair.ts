/**
 * Private, bounded compatibility-only repair for an existing Walk that the
 * former anterior-pec visibility rule incorrectly marked stale.
 *
 * Planning is SELECT-only. Apply is one all-or-nothing transaction:
 *
 *   owned model lock -> absent operation-lock fence -> exact evidence-accept
 *   package/feature/parent witnesses -> selected Walk asset + slot restore ->
 *   postflight proof.
 *
 * The tool has no route, worker, scheduler or startup caller.
 */
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  generationOperationLocks,
  modelAssets,
  modelIdentityFeatures,
  modelIdentityFeatureVersions,
  modelPackageSnapshots,
  modelPackageSnapshotSlots,
  models,
  modelSnapshotFeatureSelections,
} from "../../../drizzle/schema";
import { withTransaction, type TransactionHandle } from "../../db/connection";
import { isProductionAppId } from "../deletionAudit";
import { availableModelWhere } from "../modelAvailability";
import {
  INK_ADD_ONTOLOGY_VERSION,
  INK_ADD_SURFACE,
  INK_ADD_ZONE,
} from "./composer/inkAddRecipe";
import { INK_ADD_CAPABILITY_KEY } from "./evidenceCandidateContract";
import { inkPackageDirective } from "./evidencePackageRegistry";

export const EVIDENCE_WALK_COMPATIBILITY_REPAIR_ERRORS = [
  "active_operation",
  "feature_graph_invalid",
  "package_lineage_invalid",
  "walk_asset_invalid",
  "walk_slot_invalid",
] as const;
export type EvidenceWalkCompatibilityRepairError =
  typeof EVIDENCE_WALK_COMPATIBILITY_REPAIR_ERRORS[number];

export interface EvidenceWalkCompatibilityRepairSelector {
  userId?: number;
  modelIds: number[];
  expectedModelCount: number;
  expectedRepairCount: number;
}

export interface EvidenceWalkCompatibilityRepairRow {
  modelId: number;
  walkAssetId: number | null;
  status: "ready" | "repaired" | "blocked";
  errorCode: EvidenceWalkCompatibilityRepairError | null;
}

export interface EvidenceWalkCompatibilityRepairPlan {
  ready: boolean;
  expectedModelCount: number;
  expectedRepairCount: number;
  models: number[];
  rows: EvidenceWalkCompatibilityRepairRow[];
}

export interface EvidenceWalkCompatibilityRepairResult {
  success: boolean;
  expectedModelCount: number;
  expectedRepairCount: number;
  restoredAssets: number;
  updatedSlots: number;
  rows: EvidenceWalkCompatibilityRepairRow[];
}

export interface EvidenceWalkCompatibilityRepairArgs
  extends EvidenceWalkCompatibilityRepairSelector {
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
}

interface Assessment {
  row: EvidenceWalkCompatibilityRepairRow;
  userId: number;
  packageSnapshotId: string;
  walkAssetId: number | null;
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
  return Number((result as { affectedRows?: unknown }).affectedRows ?? 0);
}

function normalizedSelector(
  input: EvidenceWalkCompatibilityRepairSelector,
): EvidenceWalkCompatibilityRepairSelector {
  const modelIds = Array.from(new Set(input.modelIds)).sort((a, b) => a - b);
  if (
    (input.userId !== undefined && !positiveInteger(input.userId))
    || modelIds.some((id) => !positiveInteger(id))
    || (input.userId === undefined && modelIds.length === 0)
    || !positiveInteger(input.expectedModelCount)
    || !Number.isSafeInteger(input.expectedRepairCount)
    || input.expectedRepairCount < 0
  ) {
    throw new TypeError("Invalid evidence Walk compatibility repair selector");
  }
  return { ...input, modelIds };
}

async function listSubjectsIn(
  tx: TransactionHandle,
  selector: EvidenceWalkCompatibilityRepairSelector,
  lock: boolean,
): Promise<Subject[]> {
  const filters = [
    isNotNull(models.currentPackageSnapshotId),
    availableModelWhere(),
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
  errorCode: EvidenceWalkCompatibilityRepairError,
  walkAssetId: number | null = null,
): Assessment {
  return {
    row: {
      modelId: subject.modelId,
      walkAssetId,
      status: "blocked",
      errorCode,
    },
    userId: subject.userId,
    packageSnapshotId: subject.currentPackageSnapshotId,
    walkAssetId,
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
  const operations = lock
    ? await operationQuery.for("update")
    : await operationQuery;
  if (operations.length > 0) return blocked(subject, "active_operation");

  const packagesQuery = tx
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
  const packages = lock
    ? await packagesQuery.for("update")
    : await packagesQuery;
  const currentPackage = packages[0];
  if (
    packages.length !== 1
    || currentPackage.reason !== "evidence_accept"
    || !currentPackage.parentPackageSnapshotId
  ) {
    return blocked(subject, "package_lineage_invalid");
  }
  const parentPackagesQuery = tx
    .select({ id: modelPackageSnapshots.id })
    .from(modelPackageSnapshots)
    .where(and(
      eq(modelPackageSnapshots.id, currentPackage.parentPackageSnapshotId),
      eq(modelPackageSnapshots.modelId, subject.modelId),
    ));
  const parentPackages = lock
    ? await parentPackagesQuery.for("update")
    : await parentPackagesQuery;
  if (parentPackages.length !== 1) {
    return blocked(subject, "package_lineage_invalid");
  }

  const featureQuery = tx
    .select({
      category: modelIdentityFeatures.category,
      ontologyVersion: modelIdentityFeatureVersions.ontologyVersion,
      zone: modelIdentityFeatureVersions.zone,
      surface: modelIdentityFeatureVersions.surface,
      side: modelIdentityFeatureVersions.side,
      acceptedAssetId: modelIdentityFeatureVersions.acceptedAssetId,
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
        currentPackage.identitySnapshotId,
      ),
    ));
  const features = lock ? await featureQuery.for("update") : await featureQuery;
  const feature = features[0];
  const directive = feature
    ? inkPackageDirective({
        capabilityKey: INK_ADD_CAPABILITY_KEY,
        ontologyVersion: feature.ontologyVersion,
        zone: feature.zone,
        surface: feature.surface,
        side: feature.side,
        angle: "sideFull",
      })
    : null;
  if (
    features.length !== 1
    || feature.category !== "ink"
    || feature.ontologyVersion !== INK_ADD_ONTOLOGY_VERSION
    || feature.zone !== INK_ADD_ZONE
    || feature.surface !== INK_ADD_SURFACE
    || !positiveInteger(feature.acceptedAssetId ?? 0)
    || !directive
    || directive.existingSelectionImpact !== "unaffected"
    || directive.visibility !== "hidden_omit"
    || directive.requiredVisibleAnatomicalSide !== null
    || directive.normalizedTargetZone !== null
  ) {
    return blocked(subject, "feature_graph_invalid");
  }

  const currentSlotQuery = tx
    .select({
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
      eq(modelPackageSnapshotSlots.viewAngle, "sideFull"),
    ));
  const parentSlotQuery = tx
    .select({
      selectedAssetId: modelPackageSnapshotSlots.selectedAssetId,
      compatibility: modelPackageSnapshotSlots.compatibility,
    })
    .from(modelPackageSnapshotSlots)
    .where(and(
      eq(
        modelPackageSnapshotSlots.packageSnapshotId,
        currentPackage.parentPackageSnapshotId,
      ),
      eq(modelPackageSnapshotSlots.viewAngle, "sideFull"),
    ));
  const currentSlots = lock
    ? await currentSlotQuery.for("update")
    : await currentSlotQuery;
  const parentSlots = lock
    ? await parentSlotQuery.for("update")
    : await parentSlotQuery;
  const currentSlot = currentSlots[0];
  const parentSlot = parentSlots[0];
  const walkAssetId = currentSlot?.selectedAssetId ?? null;
  if (
    currentSlots.length !== 1
    || parentSlots.length !== 1
    || !positiveInteger(walkAssetId ?? 0)
    || currentSlot.selectionReason !== "carried"
    || parentSlot.selectedAssetId !== walkAssetId
    || parentSlot.compatibility !== "current"
    || !["current", "stale"].includes(currentSlot.compatibility)
  ) {
    return blocked(subject, "walk_slot_invalid", walkAssetId);
  }

  const assetsQuery = tx
    .select({
      id: modelAssets.id,
      viewType: modelAssets.viewType,
      storageUrl: modelAssets.storageUrl,
      status: modelAssets.status,
    })
    .from(modelAssets)
    .where(and(
      eq(modelAssets.id, walkAssetId!),
      eq(modelAssets.modelId, subject.modelId),
    ));
  const assets = lock ? await assetsQuery.for("update") : await assetsQuery;
  const asset = assets[0];
  const assetState = (
    asset?.status
    && typeof asset.status === "object"
    && !Array.isArray(asset.status)
  )
    ? (asset.status as { state?: unknown }).state
    : null;
  if (
    assets.length !== 1
    || asset.viewType !== "sideFull"
    || !asset.storageUrl.trim()
    || !["current", "stale"].includes(String(assetState))
    || (
      (currentSlot.compatibility === "current" && assetState !== "current")
      || (currentSlot.compatibility === "stale" && assetState !== "stale")
    )
  ) {
    return blocked(subject, "walk_asset_invalid", walkAssetId);
  }

  return {
    row: {
      modelId: subject.modelId,
      walkAssetId,
      status: currentSlot.compatibility === "stale" ? "ready" : "repaired",
      errorCode: null,
    },
    userId: subject.userId,
    packageSnapshotId: subject.currentPackageSnapshotId,
    walkAssetId,
  };
}

async function inspectIn(
  tx: TransactionHandle,
  selector: EvidenceWalkCompatibilityRepairSelector,
  lock: boolean,
): Promise<{ subjects: Subject[]; assessments: Assessment[] }> {
  const normalized = normalizedSelector(selector);
  const subjects = await listSubjectsIn(tx, normalized, lock);
  if (subjects.length !== normalized.expectedModelCount) {
    throw new Error(
      `Evidence Walk compatibility repair cohort count mismatch: expected ${normalized.expectedModelCount}, found ${subjects.length}`,
    );
  }
  const assessments: Assessment[] = [];
  for (const subject of subjects) {
    assessments.push(await assessSubjectIn(tx, subject, lock));
  }
  const readyRows = assessments.filter(({ row }) => row.status === "ready").length;
  if (readyRows !== normalized.expectedRepairCount) {
    throw new Error(
      `Evidence Walk compatibility repair row count mismatch: expected ${normalized.expectedRepairCount}, found ${readyRows}`,
    );
  }
  return { subjects, assessments };
}

export async function planEvidenceWalkCompatibilityRepair(
  input: EvidenceWalkCompatibilityRepairSelector,
): Promise<EvidenceWalkCompatibilityRepairPlan> {
  const normalized = normalizedSelector(input);
  return withTransaction(async (tx) => {
    const inspected = await inspectIn(tx, normalized, false);
    const rows = inspected.assessments.map(({ row }) => row);
    return {
      ready: rows.every((row) => row.status !== "blocked"),
      expectedModelCount: normalized.expectedModelCount,
      expectedRepairCount: normalized.expectedRepairCount,
      models: inspected.subjects.map(({ modelId }) => modelId),
      rows,
    };
  });
}

export async function applyEvidenceWalkCompatibilityRepair(
  input: EvidenceWalkCompatibilityRepairSelector,
): Promise<EvidenceWalkCompatibilityRepairResult> {
  const normalized = normalizedSelector(input);
  return withTransaction(async (tx) => {
    const inspected = await inspectIn(tx, normalized, true);
    if (inspected.assessments.some(({ row }) => row.status === "blocked")) {
      return {
        success: false,
        expectedModelCount: normalized.expectedModelCount,
        expectedRepairCount: normalized.expectedRepairCount,
        restoredAssets: 0,
        updatedSlots: 0,
        rows: inspected.assessments.map(({ row }) => row),
      };
    }
    let restoredAssets = 0;
    let updatedSlots = 0;
    const repairedAt = new Date().toISOString();
    for (const assessment of inspected.assessments) {
      if (assessment.row.status !== "ready" || !assessment.walkAssetId) continue;
      const assetResult = await tx
        .update(modelAssets)
        .set({ status: { state: "current", at: repairedAt } })
        .where(and(
          eq(modelAssets.id, assessment.walkAssetId),
          eq(modelAssets.modelId, assessment.row.modelId),
          sql`JSON_UNQUOTE(JSON_EXTRACT(${modelAssets.status}, '$.state')) = 'stale'`,
        ));
      if (affectedRows(assetResult) !== 1) {
        throw new Error(
          "Evidence Walk compatibility repair asset write count mismatch",
        );
      }
      restoredAssets += 1;
      const slotResult = await tx
        .update(modelPackageSnapshotSlots)
        .set({ compatibility: "current" })
        .where(and(
          eq(
            modelPackageSnapshotSlots.packageSnapshotId,
            assessment.packageSnapshotId,
          ),
          eq(modelPackageSnapshotSlots.viewAngle, "sideFull"),
          eq(
            modelPackageSnapshotSlots.selectedAssetId,
            assessment.walkAssetId,
          ),
          eq(modelPackageSnapshotSlots.compatibility, "stale"),
          eq(modelPackageSnapshotSlots.selectionReason, "carried"),
        ));
      if (affectedRows(slotResult) !== 1) {
        throw new Error(
          "Evidence Walk compatibility repair slot write count mismatch",
        );
      }
      updatedSlots += 1;
    }
    if (
      restoredAssets !== normalized.expectedRepairCount
      || updatedSlots !== normalized.expectedRepairCount
    ) {
      throw new Error("Evidence Walk compatibility repair write total mismatch");
    }
    const postflight = await inspectIn(tx, {
      ...normalized,
      expectedRepairCount: 0,
    }, true);
    const postflightRows = postflight.assessments.map(({ row }) => row);
    if (postflightRows.some((row) => row.status !== "repaired")) {
      throw new Error("Evidence Walk compatibility repair postflight failed");
    }
    return {
      success: true,
      expectedModelCount: normalized.expectedModelCount,
      expectedRepairCount: normalized.expectedRepairCount,
      restoredAssets,
      updatedSlots,
      rows: inspected.assessments.map(({ row }) =>
        row.status === "ready"
          ? { ...row, status: "repaired" as const }
          : row
      ),
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

export function parseEvidenceWalkCompatibilityRepairArgs(
  argv: string[],
): EvidenceWalkCompatibilityRepairArgs {
  let databaseUrl = "";
  let appId = "";
  let userId: number | undefined;
  let expectedModelCount = 0;
  let expectedRepairCount: number | undefined;
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
    if (flag === "--allow-evidence-walk-compatibility-repair-write") {
      allowWrite = true;
      continue;
    }
    if (flag === "--allow-production-read-only") {
      allowProductionReadOnly = true;
      continue;
    }
    if (flag === "--allow-production-evidence-walk-compatibility-repair") {
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
    else if (flag === "--model-id") modelIds.push(parsePositiveInteger(value, flag));
    else if (flag === "--expected-model-count") {
      expectedModelCount = parsePositiveInteger(value, flag);
    } else if (flag === "--expected-repair-count") {
      expectedRepairCount = parseNonNegativeInteger(value, flag);
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
  const production = isProductionAppId(appId);
  if (production && !apply && !allowProductionReadOnly) {
    throw new Error(
      "Production evidence Walk compatibility planning requires --allow-production-read-only",
    );
  }
  if (apply) {
    if (!allowWrite) {
      throw new Error(
        "Applying evidence Walk compatibility repair requires --allow-evidence-walk-compatibility-repair-write",
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
        "Production evidence Walk compatibility repair requires --allow-production-evidence-walk-compatibility-repair",
      );
    }
  } else if (allowWrite || allowProductionWrite) {
    throw new Error(
      "Evidence Walk compatibility write flags are valid only with --apply",
    );
  }

  return {
    databaseUrl,
    appId,
    ...(userId !== undefined ? { userId } : {}),
    modelIds: normalizedIds,
    expectedModelCount,
    expectedRepairCount,
    apply,
    allowWrite,
    allowProductionReadOnly,
    allowProductionWrite,
    confirmAppId,
    confirmHost,
    confirmDatabase,
  };
}
