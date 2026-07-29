/**
 * Private, bounded repair for the R7-7E accepted-asset relation.
 *
 * Planning is read-only. Apply is one all-or-nothing transaction:
 *
 *   owned model lock -> feature-version lock -> accepted candidate witness
 *   -> evidence-accept snapshot-slot witness -> current frontFull witness
 *   -> accepted asset proof -> exact conditional UPDATE -> postflight proof
 *
 * The tool has no route, worker, scheduler or startup caller.
 */
import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  type SQL,
} from "drizzle-orm";
import {
  castingEvidenceCandidates,
  generationOperations,
  modelAssets,
  modelIdentityFeatureVersions,
  modelPackageSnapshots,
  modelPackageSnapshotSlots,
  models,
} from "../../../drizzle/schema";
import { isProductionAppId } from "../deletionAudit";
import { availableModelWhere } from "../modelAvailability";
import { withTransaction, type TransactionHandle } from "../../db/connection";

export const EVIDENCE_ACCEPTED_ASSET_BACKFILL_ERRORS = [
  "accepted_asset_invalid",
  "accepted_asset_mismatch",
  "accepted_asset_missing",
  "current_front_full_mismatch",
  "fork_link_missing",
  "source_asset_invalid",
  "source_asset_missing",
  "witness_ambiguous",
  "witness_disagrees",
  "witness_missing",
] as const;

export type EvidenceAcceptedAssetBackfillError =
  typeof EVIDENCE_ACCEPTED_ASSET_BACKFILL_ERRORS[number];

export interface EvidenceAcceptedAssetBackfillSelector {
  userId?: number;
  modelIds: number[];
  expectedModelCount: number;
  expectedVersionCount: number;
  expectedBackfillCount: number;
}

export interface EvidenceAcceptedAssetBackfillPlanRow {
  modelId: number;
  versionId: string;
  sourceAssetId: number | null;
  acceptedAssetId: number | null;
  status: "ready" | "linked" | "blocked";
  errorCode: EvidenceAcceptedAssetBackfillError | null;
}

export interface EvidenceAcceptedAssetBackfillPlan {
  ready: boolean;
  expectedModelCount: number;
  expectedVersionCount: number;
  expectedBackfillCount: number;
  models: number[];
  rows: EvidenceAcceptedAssetBackfillPlanRow[];
}

export interface EvidenceAcceptedAssetBackfillResult {
  success: boolean;
  expectedModelCount: number;
  expectedVersionCount: number;
  expectedBackfillCount: number;
  updatedRows: number;
  rows: EvidenceAcceptedAssetBackfillPlanRow[];
}

export interface EvidenceAcceptedAssetBackfillArgs
  extends EvidenceAcceptedAssetBackfillSelector {
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
  currentPackageSnapshotId: string;
}

interface Assessment {
  row: EvidenceAcceptedAssetBackfillPlanRow;
  proposedAcceptedAssetId: number | null;
}

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    const header = result[0] as { affectedRows?: unknown } | undefined;
    return typeof header?.affectedRows === "number" ? header.affectedRows : 0;
  }
  const header = result as { affectedRows?: unknown } | null;
  return typeof header?.affectedRows === "number" ? header.affectedRows : 0;
}

function normalizeSelector(
  input: EvidenceAcceptedAssetBackfillSelector,
): EvidenceAcceptedAssetBackfillSelector {
  const modelIds = Array.from(new Set(input.modelIds)).sort((a, b) => a - b);
  if (input.userId === undefined && modelIds.length === 0) {
    throw new Error(
      "Evidence accepted-asset backfill requires a user id or model ids",
    );
  }
  if (input.userId !== undefined && !positiveInteger(input.userId)) {
    throw new Error("Evidence accepted-asset backfill user id must be positive");
  }
  if (modelIds.some((modelId) => !positiveInteger(modelId))) {
    throw new Error("Evidence accepted-asset backfill model ids must be positive");
  }
  for (const [value, label] of [
    [input.expectedModelCount, "model"],
    [input.expectedVersionCount, "version"],
  ] as const) {
    if (!positiveInteger(value)) {
      throw new Error(
        `Evidence accepted-asset backfill expected ${label} count must be positive`,
      );
    }
  }
  if (
    !Number.isSafeInteger(input.expectedBackfillCount)
    || input.expectedBackfillCount < 0
  ) {
    throw new Error(
      "Evidence accepted-asset backfill expected row count must be non-negative",
    );
  }
  return { ...input, modelIds };
}

async function listSubjectsIn(
  tx: TransactionHandle,
  input: Pick<EvidenceAcceptedAssetBackfillSelector, "userId" | "modelIds">,
  lock: boolean,
): Promise<Subject[]> {
  const filters: SQL[] = [
    availableModelWhere(),
    isNotNull(models.currentPackageSnapshotId),
  ];
  if (input.userId !== undefined) filters.push(eq(models.userId, input.userId));
  if (input.modelIds.length > 0) filters.push(inArray(models.id, input.modelIds));
  const query = tx
    .select({
      modelId: models.id,
      currentPackageSnapshotId: models.currentPackageSnapshotId,
    })
    .from(models)
    .where(and(...filters))
    .orderBy(models.id);
  const rows = lock ? await query.for("update") : await query;
  return rows.map((row) => ({
    modelId: row.modelId,
    currentPackageSnapshotId: row.currentPackageSnapshotId!,
  }));
}

function blocked(
  version: typeof modelIdentityFeatureVersions.$inferSelect,
  errorCode: EvidenceAcceptedAssetBackfillError,
): Assessment {
  return {
    row: {
      modelId: version.modelId,
      versionId: version.id,
      sourceAssetId: version.sourceAssetId,
      acceptedAssetId: version.acceptedAssetId,
      status: "blocked",
      errorCode,
    },
    proposedAcceptedAssetId: null,
  };
}

async function frontFullAssetExistsIn(
  tx: TransactionHandle,
  input: { modelId: number; assetId: number; lock: boolean },
): Promise<boolean> {
  const query = tx
    .select({ id: modelAssets.id })
    .from(modelAssets)
    .where(and(
      eq(modelAssets.id, input.assetId),
      eq(modelAssets.modelId, input.modelId),
      eq(modelAssets.viewType, "frontFull"),
    ))
    .limit(1);
  return (input.lock ? await query.for("update") : await query).length === 1;
}

async function currentFrontFullIn(
  tx: TransactionHandle,
  input: Subject & { lock: boolean },
): Promise<number | null> {
  const query = tx
    .select({ selectedAssetId: modelPackageSnapshotSlots.selectedAssetId })
    .from(modelPackageSnapshotSlots)
    .where(and(
      eq(
        modelPackageSnapshotSlots.packageSnapshotId,
        input.currentPackageSnapshotId,
      ),
      eq(modelPackageSnapshotSlots.viewAngle, "frontFull"),
    ));
  const rows = input.lock ? await query.for("update") : await query;
  return rows.length === 1 ? rows[0].selectedAssetId : null;
}

async function assessVersionIn(
  tx: TransactionHandle,
  subject: Subject,
  version: typeof modelIdentityFeatureVersions.$inferSelect,
  lock: boolean,
): Promise<Assessment> {
  if (
    version.sourceAssetId !== null
    && (
      !positiveInteger(version.sourceAssetId)
      || version.sourceAssetId === version.acceptedAssetId
    )
  ) {
    return blocked(version, "source_asset_invalid");
  }
  if (
    version.sourceAssetId !== null
    && !await frontFullAssetExistsIn(tx, {
      modelId: subject.modelId,
      assetId: version.sourceAssetId,
      lock,
    })
  ) {
    return blocked(version, "source_asset_missing");
  }
  const currentFrontFull = await currentFrontFullIn(tx, { ...subject, lock });

  if (version.acceptedAssetId !== null) {
    if (!positiveInteger(version.acceptedAssetId)) {
      return blocked(version, "accepted_asset_invalid");
    }
    if (currentFrontFull !== version.acceptedAssetId) {
      return blocked(version, "current_front_full_mismatch");
    }
    if (!await frontFullAssetExistsIn(tx, {
      modelId: subject.modelId,
      assetId: version.acceptedAssetId,
      lock,
    })) {
      return blocked(version, "accepted_asset_missing");
    }
    return {
      row: {
        modelId: version.modelId,
        versionId: version.id,
        sourceAssetId: version.sourceAssetId,
        acceptedAssetId: version.acceptedAssetId,
        status: "linked",
        errorCode: null,
      },
      proposedAcceptedAssetId: version.acceptedAssetId,
    };
  }

  const operationQuery = tx
    .select({ kind: generationOperations.kind })
    .from(generationOperations)
    .where(and(
      eq(generationOperations.id, version.createdByOperationId),
      eq(generationOperations.modelId, version.modelId),
    ));
  const operationRows = lock
    ? await operationQuery.for("update")
    : await operationQuery;
  if (
    operationRows.length === 1
    && operationRows[0].kind === "evidence_fork_copy"
  ) {
    return blocked(version, "fork_link_missing");
  }

  const candidateQuery = tx
    .select({ acceptedAssetId: castingEvidenceCandidates.acceptedAssetId })
    .from(castingEvidenceCandidates)
    .where(and(
      eq(castingEvidenceCandidates.modelId, version.modelId),
      eq(
        castingEvidenceCandidates.resolvedByOperationId,
        version.createdByOperationId,
      ),
      eq(castingEvidenceCandidates.status, "accepted"),
      isNotNull(castingEvidenceCandidates.acceptedAssetId),
    ));
  const candidates = lock
    ? await candidateQuery.for("update")
    : await candidateQuery;

  const slotQuery = tx
    .select({ selectedAssetId: modelPackageSnapshotSlots.selectedAssetId })
    .from(modelPackageSnapshots)
    .innerJoin(
      modelPackageSnapshotSlots,
      eq(
        modelPackageSnapshotSlots.packageSnapshotId,
        modelPackageSnapshots.id,
      ),
    )
    .where(and(
      eq(modelPackageSnapshots.modelId, version.modelId),
      eq(
        modelPackageSnapshots.createdByOperationId,
        version.createdByOperationId,
      ),
      eq(modelPackageSnapshotSlots.viewAngle, "frontFull"),
      eq(modelPackageSnapshotSlots.selectionReason, "evidence_accept"),
    ));
  const slots = lock ? await slotQuery.for("update") : await slotQuery;

  if (candidates.length === 0 || slots.length === 0) {
    return blocked(version, "witness_missing");
  }
  if (candidates.length !== 1 || slots.length !== 1) {
    return blocked(version, "witness_ambiguous");
  }
  const candidateAssetId = candidates[0].acceptedAssetId;
  const slotAssetId = slots[0].selectedAssetId;
  if (
    !positiveInteger(candidateAssetId ?? 0)
    || candidateAssetId !== slotAssetId
  ) {
    return blocked(version, "witness_disagrees");
  }
  if (candidateAssetId !== currentFrontFull) {
    return blocked(version, "current_front_full_mismatch");
  }
  if (
    version.sourceAssetId === null
    || version.sourceAssetId === candidateAssetId
  ) {
    return blocked(version, "source_asset_invalid");
  }
  if (!await frontFullAssetExistsIn(tx, {
    modelId: subject.modelId,
    assetId: candidateAssetId!,
    lock,
  })) {
    return blocked(version, "accepted_asset_missing");
  }
  return {
    row: {
      modelId: version.modelId,
      versionId: version.id,
      sourceAssetId: version.sourceAssetId,
      acceptedAssetId: null,
      status: "ready",
      errorCode: null,
    },
    proposedAcceptedAssetId: candidateAssetId!,
  };
}

async function inspectIn(
  tx: TransactionHandle,
  selector: EvidenceAcceptedAssetBackfillSelector,
  lock: boolean,
): Promise<{
  subjects: Subject[];
  assessments: Assessment[];
}> {
  const normalized = normalizeSelector(selector);
  const subjects = await listSubjectsIn(tx, normalized, lock);
  if (subjects.length !== normalized.expectedModelCount) {
    throw new Error(
      `Evidence accepted-asset backfill cohort count mismatch: expected ${normalized.expectedModelCount}, found ${subjects.length}`,
    );
  }
  const assessments: Assessment[] = [];
  for (const subject of subjects) {
    const query = tx
      .select()
      .from(modelIdentityFeatureVersions)
      .where(eq(modelIdentityFeatureVersions.modelId, subject.modelId))
      .orderBy(modelIdentityFeatureVersions.id);
    const versions = lock ? await query.for("update") : await query;
    for (const version of versions) {
      assessments.push(await assessVersionIn(tx, subject, version, lock));
    }
  }
  if (assessments.length !== normalized.expectedVersionCount) {
    throw new Error(
      `Evidence accepted-asset backfill version count mismatch: expected ${normalized.expectedVersionCount}, found ${assessments.length}`,
    );
  }
  const readyRows = assessments.filter(
    (assessment) => assessment.row.status === "ready",
  ).length;
  if (readyRows !== normalized.expectedBackfillCount) {
    throw new Error(
      `Evidence accepted-asset backfill row count mismatch: expected ${normalized.expectedBackfillCount}, found ${readyRows}`,
    );
  }
  return { subjects, assessments };
}

export async function planEvidenceAcceptedAssetBackfill(
  input: EvidenceAcceptedAssetBackfillSelector,
): Promise<EvidenceAcceptedAssetBackfillPlan> {
  const normalized = normalizeSelector(input);
  return withTransaction(async (tx) => {
    const inspected = await inspectIn(tx, normalized, false);
    const rows = inspected.assessments.map((assessment) => assessment.row);
    return {
      ready: rows.every((row) => row.status !== "blocked"),
      expectedModelCount: normalized.expectedModelCount,
      expectedVersionCount: normalized.expectedVersionCount,
      expectedBackfillCount: normalized.expectedBackfillCount,
      models: inspected.subjects.map((subject) => subject.modelId),
      rows,
    };
  });
}

export async function applyEvidenceAcceptedAssetBackfill(
  input: EvidenceAcceptedAssetBackfillSelector,
): Promise<EvidenceAcceptedAssetBackfillResult> {
  const normalized = normalizeSelector(input);
  return withTransaction(async (tx) => {
    const inspected = await inspectIn(tx, normalized, true);
    if (inspected.assessments.some(({ row }) => row.status === "blocked")) {
      return {
        success: false,
        expectedModelCount: normalized.expectedModelCount,
        expectedVersionCount: normalized.expectedVersionCount,
        expectedBackfillCount: normalized.expectedBackfillCount,
        updatedRows: 0,
        rows: inspected.assessments.map(({ row }) => row),
      };
    }
    let updatedRows = 0;
    for (const assessment of inspected.assessments) {
      if (assessment.row.status !== "ready") continue;
      const result = await tx
        .update(modelIdentityFeatureVersions)
        .set({ acceptedAssetId: assessment.proposedAcceptedAssetId! })
        .where(and(
          eq(modelIdentityFeatureVersions.id, assessment.row.versionId),
          eq(modelIdentityFeatureVersions.modelId, assessment.row.modelId),
          eq(
            modelIdentityFeatureVersions.sourceAssetId,
            assessment.row.sourceAssetId!,
          ),
          isNull(modelIdentityFeatureVersions.acceptedAssetId),
        ));
      if (affectedRows(result) !== 1) {
        throw new Error("Evidence accepted-asset backfill write count mismatch");
      }
      updatedRows += 1;
    }
    if (updatedRows !== normalized.expectedBackfillCount) {
      throw new Error("Evidence accepted-asset backfill write total mismatch");
    }
    const postflight = await inspectIn(tx, {
      ...normalized,
      expectedBackfillCount: 0,
    }, true);
    const rows = postflight.assessments.map(({ row }) => row);
    if (rows.some((row) => row.status !== "linked")) {
      throw new Error("Evidence accepted-asset backfill postflight failed");
    }
    return {
      success: true,
      expectedModelCount: normalized.expectedModelCount,
      expectedVersionCount: normalized.expectedVersionCount,
      expectedBackfillCount: normalized.expectedBackfillCount,
      updatedRows,
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

export function parseEvidenceAcceptedAssetBackfillArgs(
  argv: string[],
): EvidenceAcceptedAssetBackfillArgs {
  let databaseUrl = "";
  let appId = "";
  let userId: number | undefined;
  let expectedModelCount = 0;
  let expectedVersionCount = 0;
  let expectedBackfillCount: number | undefined;
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
    if (flag === "--allow-evidence-link-backfill-write") {
      allowWrite = true;
      continue;
    }
    if (flag === "--allow-production-read-only") {
      allowProductionReadOnly = true;
      continue;
    }
    if (flag === "--allow-production-evidence-link-backfill") {
      allowProductionWrite = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${flag} requires a value`);
    }
    if (flag === "--database-url") databaseUrl = value;
    else if (flag === "--app-id") appId = value;
    else if (flag === "--user-id") {
      userId = parsePositiveInteger(value, flag);
    } else if (flag === "--model-id") {
      modelIds.push(parsePositiveInteger(value, flag));
    } else if (flag === "--expected-model-count") {
      expectedModelCount = parsePositiveInteger(value, flag);
    } else if (flag === "--expected-version-count") {
      expectedVersionCount = parsePositiveInteger(value, flag);
    } else if (flag === "--expected-backfill-count") {
      expectedBackfillCount = parseNonNegativeInteger(value, flag);
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
  const modelIdsNormalized = Array.from(new Set(modelIds)).sort((a, b) => a - b);
  if (userId === undefined && modelIdsNormalized.length === 0) {
    throw new Error(
      "Provide --user-id or --model-id; full-database backfill is refused",
    );
  }
  if (!positiveInteger(expectedModelCount)) {
    throw new Error("--expected-model-count is required");
  }
  if (!positiveInteger(expectedVersionCount)) {
    throw new Error("--expected-version-count is required");
  }
  if (expectedBackfillCount === undefined) {
    throw new Error("--expected-backfill-count is required");
  }
  const production = isProductionAppId(appId);
  if (production && !apply && !allowProductionReadOnly) {
    throw new Error(
      "Production evidence-link planning requires --allow-production-read-only",
    );
  }
  if (apply) {
    if (!allowWrite) {
      throw new Error(
        "Applying evidence-link backfill requires --allow-evidence-link-backfill-write",
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
        "Production evidence-link backfill requires --allow-production-evidence-link-backfill",
      );
    }
  } else if (allowWrite || allowProductionWrite) {
    throw new Error("Evidence-link write flags are valid only with --apply");
  }

  return {
    databaseUrl,
    appId,
    ...(userId !== undefined ? { userId } : {}),
    modelIds: modelIdsNormalized,
    expectedModelCount,
    expectedVersionCount,
    expectedBackfillCount,
    apply,
    allowWrite,
    allowProductionReadOnly,
    allowProductionWrite,
    confirmAppId,
    confirmHost,
    confirmDatabase,
  };
}
