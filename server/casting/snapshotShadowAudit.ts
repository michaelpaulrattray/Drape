import {
  SNAPSHOT_SHADOW_MISMATCH_KINDS,
  SNAPSHOT_SHADOW_SURFACES,
  affectedSnapshotShadowSurfaces,
  type SnapshotShadowMismatchKind,
  type SnapshotShadowReport,
  type SnapshotShadowSurface,
} from "./snapshotShadow";

export interface SnapshotShadowAuditArgs {
  databaseUrl: string;
  appId: string;
  userId?: number;
  modelIds: number[];
  allowProductionReadOnly: boolean;
}

function positiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

export function parseSnapshotShadowAuditArgs(argv: string[]): SnapshotShadowAuditArgs {
  let databaseUrl = "";
  let appId = "";
  let userId: number | undefined;
  const modelIds: number[] = [];
  let allowProductionReadOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--allow-production-read-only") {
      allowProductionReadOnly = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    if (flag === "--database-url") databaseUrl = value;
    else if (flag === "--app-id") appId = value;
    else if (flag === "--user-id") userId = positiveInteger(value, "--user-id");
    else if (flag === "--model-id") modelIds.push(positiveInteger(value, "--model-id"));
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
  if (target.protocol !== "mysql:") throw new Error("--database-url must use mysql:");
  if (!target.pathname.replace(/^\//, "")) throw new Error("--database-url must name a database");
  if (!appId.trim()) throw new Error("--app-id is required");
  if (userId === undefined && modelIds.length === 0) {
    throw new Error("Provide --user-id or at least one --model-id; full-database scans are refused");
  }
  const production = appId.toLowerCase().includes("production");
  if (production && !allowProductionReadOnly) {
    throw new Error("Production snapshot audit requires --allow-production-read-only");
  }
  return {
    databaseUrl,
    appId,
    ...(userId !== undefined ? { userId } : {}),
    modelIds: Array.from(new Set(modelIds)).sort((a, b) => a - b),
    allowProductionReadOnly,
  };
}

export interface SnapshotShadowAuditModel extends SnapshotShadowReport {
  affectedSurfaces: SnapshotShadowSurface[];
}

export interface SnapshotShadowAuditSummary {
  auditedModels: number;
  parityModels: number;
  mismatchedModels: number;
  headStates: Record<SnapshotShadowReport["headState"], number>;
  mismatchKinds: Record<SnapshotShadowMismatchKind, number>;
  affectedSurfaces: Record<SnapshotShadowSurface, number>;
}

export function summarizeSnapshotShadowReports(reports: SnapshotShadowReport[]): {
  summary: SnapshotShadowAuditSummary;
  models: SnapshotShadowAuditModel[];
} {
  const models = [...reports]
    .sort((a, b) => a.modelId - b.modelId)
    .map((report) => ({
      ...report,
      affectedSurfaces: affectedSnapshotShadowSurfaces(report),
    }));
  const headStates: SnapshotShadowAuditSummary["headStates"] = {
    headless: 0,
    current: 0,
    invalid: 0,
  };
  const mismatchKinds = Object.fromEntries(
    SNAPSHOT_SHADOW_MISMATCH_KINDS.map((kind) => [kind, 0]),
  ) as SnapshotShadowAuditSummary["mismatchKinds"];
  const affectedSurfaces = Object.fromEntries(
    SNAPSHOT_SHADOW_SURFACES.map((surface) => [surface, 0]),
  ) as SnapshotShadowAuditSummary["affectedSurfaces"];
  for (const model of models) {
    headStates[model.headState] += 1;
    for (const mismatch of model.mismatchKinds) mismatchKinds[mismatch] += 1;
    for (const surface of model.affectedSurfaces) affectedSurfaces[surface] += 1;
  }
  const parityModels = models.filter((model) => model.parity).length;
  return {
    summary: {
      auditedModels: models.length,
      parityModels,
      mismatchedModels: models.length - parityModels,
      headStates,
      mismatchKinds,
      affectedSurfaces,
    },
    models,
  };
}
