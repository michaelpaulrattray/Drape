/**
 * Private, bounded repair for evidence acceptance that incorrectly advanced
 * the legacy facial-identity revision.
 *
 * Planning is SELECT-only. Apply is one all-or-nothing transaction:
 *
 *   owned model lock -> absent operation-lock fence -> immutable snapshot and
 *   feature witnesses -> exact model/asset correction -> postflight proof.
 *
 * The tool has no route, worker, scheduler or startup caller.
 */
import { createHash } from "node:crypto";
import {
  and,
  eq,
  inArray,
  isNotNull,
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
import { withTransaction, type TransactionHandle } from "../../db/connection";
import { stableCanonicalJson } from "../operationContract";
import { isProductionAppId } from "../deletionAudit";
import { availableModelWhere } from "../modelAvailability";

export const EVIDENCE_IDENTITY_REVISION_REPAIR_ERRORS = [
  "active_operation",
  "accepted_asset_invalid",
  "accepted_revision_mismatch",
  "anchor_invalid",
  "anchor_revision_missing",
  "feature_graph_invalid",
  "identity_snapshot_invalid",
  "revision_shape_invalid",
] as const;

export type EvidenceIdentityRevisionRepairError =
  typeof EVIDENCE_IDENTITY_REVISION_REPAIR_ERRORS[number];

export interface EvidenceIdentityRevisionRepairSelector {
  userId?: number;
  modelIds: number[];
  expectedModelCount: number;
  expectedRepairCount: number;
}

export interface EvidenceIdentityRevisionRepairRow {
  modelId: number;
  acceptedAssetId: number | null;
  fromRevisionHash: string | null;
  toRevisionHash: string | null;
  status: "ready" | "repaired" | "blocked";
  errorCode: EvidenceIdentityRevisionRepairError | null;
}

export interface EvidenceIdentityRevisionRepairPlan {
  ready: boolean;
  expectedModelCount: number;
  expectedRepairCount: number;
  models: number[];
  rows: EvidenceIdentityRevisionRepairRow[];
}

export interface EvidenceIdentityRevisionRepairResult {
  success: boolean;
  expectedModelCount: number;
  expectedRepairCount: number;
  updatedModels: number;
  updatedAssets: number;
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
  fromRevision: string | null;
  toRevision: string | null;
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
      status: "blocked",
      errorCode,
    },
    userId: subject.userId,
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
    })
    .from(modelPackageSnapshots)
    .where(and(
      eq(modelPackageSnapshots.id, subject.currentPackageSnapshotId),
      eq(modelPackageSnapshots.modelId, subject.modelId),
    ));
  if (packages.length !== 1) {
    return blocked(subject, "identity_snapshot_invalid");
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

  const slots = await tx
    .select({
      viewAngle: modelPackageSnapshotSlots.viewAngle,
      selectedAssetId: modelPackageSnapshotSlots.selectedAssetId,
      compatibility: modelPackageSnapshotSlots.compatibility,
    })
    .from(modelPackageSnapshotSlots)
    .where(and(
      eq(
        modelPackageSnapshotSlots.packageSnapshotId,
        subject.currentPackageSnapshotId,
      ),
      inArray(modelPackageSnapshotSlots.viewAngle, ["frontClose", "frontFull"]),
    ));
  const frontClose = slots.filter((slot) => slot.viewAngle === "frontClose");
  const frontFull = slots.filter((slot) => slot.viewAngle === "frontFull");
  if (
    frontClose.length !== 1
    || frontFull.length !== 1
    || frontClose[0].selectedAssetId !== identity.anchorAssetId
    || frontClose[0].compatibility !== "current"
    || frontFull[0].compatibility !== "current"
  ) {
    return blocked(subject, "identity_snapshot_invalid");
  }

  const selectedFeatures = await tx
    .select({
      acceptedAssetId: modelIdentityFeatureVersions.acceptedAssetId,
      sourceAssetId: modelIdentityFeatureVersions.sourceAssetId,
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
    || !positiveInteger(selectedFeatures[0].acceptedAssetId ?? 0)
    || selectedFeatures[0].acceptedAssetId !== frontFull[0].selectedAssetId
    || selectedFeatures[0].sourceAssetId === selectedFeatures[0].acceptedAssetId
  ) {
    return blocked(subject, "feature_graph_invalid");
  }
  const acceptedAssetId = selectedFeatures[0].acceptedAssetId!;
  const assetsQuery = tx
    .select({
      id: modelAssets.id,
      viewType: modelAssets.viewType,
      storageUrl: modelAssets.storageUrl,
      provenance: modelAssets.provenance,
    })
    .from(modelAssets)
    .where(and(
      eq(modelAssets.modelId, subject.modelId),
      inArray(modelAssets.id, [identity.anchorAssetId, acceptedAssetId]),
    ));
  const assets = lock ? await assetsQuery.for("update") : await assetsQuery;
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
    return {
      row: {
        modelId: subject.modelId,
        acceptedAssetId,
        fromRevisionHash: revisionHash(subject.identityRevisionId),
        toRevisionHash: revisionHash(targetRevision),
        status: "repaired",
        errorCode: null,
      },
      userId: subject.userId,
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
  return {
    row: {
      modelId: subject.modelId,
      acceptedAssetId,
      fromRevisionHash: revisionHash(subject.identityRevisionId),
      toRevisionHash: revisionHash(targetRevision),
      status: "ready",
      errorCode: null,
    },
    userId: subject.userId,
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
        updatedModels: 0,
        updatedAssets: 0,
        rows: inspected.assessments.map(({ row }) => row),
      };
    }
    let updatedModels = 0;
    let updatedAssets = 0;
    for (const assessment of inspected.assessments) {
      if (
        assessment.row.status !== "ready"
        || !assessment.fromRevision
        || !assessment.toRevision
        || !assessment.row.acceptedAssetId
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
      updatedAssets += 1;
    }
    if (
      updatedModels !== normalized.expectedRepairCount
      || updatedAssets !== normalized.expectedRepairCount
    ) {
      throw new Error("Evidence identity-revision repair write total mismatch");
    }
    const postflight = await inspectIn(tx, {
      ...normalized,
      expectedRepairCount: 0,
    }, true);
    const rows = postflight.assessments.map(({ row }) => row);
    if (rows.some((row) => row.status !== "repaired")) {
      throw new Error("Evidence identity-revision repair postflight failed");
    }
    return {
      success: true,
      expectedModelCount: normalized.expectedModelCount,
      expectedRepairCount: normalized.expectedRepairCount,
      updatedModels,
      updatedAssets,
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
    apply,
    allowWrite,
    allowProductionReadOnly,
    allowProductionWrite,
    confirmAppId,
    confirmHost,
    confirmDatabase,
  };
}
