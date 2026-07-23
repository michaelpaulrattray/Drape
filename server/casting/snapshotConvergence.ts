/**
 * Private R7-7A snapshot convergence orchestration.
 *
 * This is not routed and has no background entry point. Callers must name a
 * bounded cohort and an exact expected model count. Planning is read-only;
 * applying delegates each model to the already-reviewed, model-row-locked,
 * idempotent bootstrap transaction, then proves parity over the same frozen
 * model-id cohort.
 */
import { and, eq, inArray, isNull, ne, type SQL } from "drizzle-orm";
import { models } from "../../drizzle/schema";
import { withTransaction } from "../db/connection";
import { bootstrapModelSnapshot, type SnapshotBootstrapResult } from "./snapshotBootstrap";
import {
  compareSnapshotShadowCohort,
  type SnapshotShadowReport,
} from "./snapshotShadow";
import {
  summarizeSnapshotShadowReports,
  type SnapshotShadowAuditSummary,
} from "./snapshotShadowAudit";

export interface SnapshotConvergenceSelector {
  userId?: number;
  modelIds: number[];
  expectedModelCount: number;
}

export interface SnapshotConvergenceSubject {
  modelId: number;
  userId: number;
}

export interface SnapshotConvergencePlan {
  subjects: SnapshotConvergenceSubject[];
  summary: SnapshotShadowAuditSummary;
  models: SnapshotShadowReport[];
}

export interface SnapshotConvergenceModelResult {
  modelId: number;
  status: SnapshotBootstrapResult["status"] | "failed";
  errorCode: "bootstrap_failed" | null;
}

export interface SnapshotConvergenceResult {
  success: boolean;
  expectedModelCount: number;
  preflight: SnapshotShadowAuditSummary;
  results: SnapshotConvergenceModelResult[];
  postflight: SnapshotShadowAuditSummary;
}

function normalizeSelector(input: SnapshotConvergenceSelector): SnapshotConvergenceSelector {
  const modelIds = Array.from(new Set(input.modelIds))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);
  if (input.userId === undefined && modelIds.length === 0) {
    throw new Error("Snapshot convergence requires a user id or at least one model id");
  }
  if (input.userId !== undefined && (!Number.isInteger(input.userId) || input.userId <= 0)) {
    throw new Error("Snapshot convergence user id must be a positive integer");
  }
  if (!Number.isInteger(input.expectedModelCount) || input.expectedModelCount <= 0) {
    throw new Error("Snapshot convergence expected model count must be a positive integer");
  }
  return { ...input, modelIds };
}

async function listSubjects(
  input: Pick<SnapshotConvergenceSelector, "userId" | "modelIds">,
): Promise<SnapshotConvergenceSubject[]> {
  return withTransaction(async (tx) => {
    const filters: SQL[] = [
      isNull(models.deletedAt),
      ne(models.status, "archived"),
    ];
    if (input.userId !== undefined) filters.push(eq(models.userId, input.userId));
    if (input.modelIds.length > 0) filters.push(inArray(models.id, input.modelIds));
    const rows = await tx
      .select({ modelId: models.id, userId: models.userId })
      .from(models)
      .where(and(...filters))
      .orderBy(models.id);
    return rows;
  });
}

function assertExpectedCount(
  subjects: SnapshotConvergenceSubject[],
  expectedModelCount: number,
): void {
  if (subjects.length !== expectedModelCount) {
    throw new Error(
      `Snapshot convergence cohort count mismatch: expected ${expectedModelCount}, found ${subjects.length}`,
    );
  }
}

async function reportsForSubjects(
  input: SnapshotConvergenceSelector,
  subjects: SnapshotConvergenceSubject[],
): Promise<SnapshotShadowReport[]> {
  if (subjects.length === 0) return [];
  return compareSnapshotShadowCohort({
    ...(input.userId !== undefined ? { userId: input.userId } : {}),
    modelIds: subjects.map((subject) => subject.modelId),
  });
}

export async function planSnapshotConvergence(
  rawInput: SnapshotConvergenceSelector,
): Promise<SnapshotConvergencePlan> {
  const input = normalizeSelector(rawInput);
  const subjects = await listSubjects(input);
  assertExpectedCount(subjects, input.expectedModelCount);
  const models = await reportsForSubjects(input, subjects);
  if (models.length !== subjects.length) {
    throw new Error("Snapshot convergence cohort changed during the read-only preflight");
  }
  return {
    subjects,
    summary: summarizeSnapshotShadowReports(models).summary,
    models,
  };
}

export async function convergeSnapshotCohort(
  rawInput: SnapshotConvergenceSelector,
): Promise<SnapshotConvergenceResult> {
  const input = normalizeSelector(rawInput);
  const preflight = await planSnapshotConvergence(input);
  const results: SnapshotConvergenceModelResult[] = [];
  for (const subject of preflight.subjects) {
    try {
      const result = await bootstrapModelSnapshot({
        userId: subject.userId,
        modelId: subject.modelId,
      });
      results.push({
        modelId: subject.modelId,
        status: result.status,
        errorCode: null,
      });
    } catch {
      // The CLI/report deliberately exposes no raw DB, prompt, model or
      // identity error text. Support can investigate this bounded model id.
      results.push({
        modelId: subject.modelId,
        status: "failed",
        errorCode: "bootstrap_failed",
      });
    }
  }

  const postModels = await reportsForSubjects(input, preflight.subjects);
  const postflight = summarizeSnapshotShadowReports(postModels).summary;
  const success = (
    results.every((result) => result.status !== "failed")
    && postModels.length === input.expectedModelCount
    && postflight.mismatchedModels === 0
  );
  return {
    success,
    expectedModelCount: input.expectedModelCount,
    preflight: preflight.summary,
    results,
    postflight,
  };
}

export interface SnapshotConvergenceArgs extends SnapshotConvergenceSelector {
  databaseUrl: string;
  appId: string;
  apply: boolean;
  allowConvergenceWrite: boolean;
  allowProductionReadOnly: boolean;
  allowProductionConvergence: boolean;
  confirmAppId: string | null;
  confirmHost: string | null;
  confirmDatabase: string | null;
}

function positiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

export function parseSnapshotConvergenceArgs(argv: string[]): SnapshotConvergenceArgs {
  let databaseUrl = "";
  let appId = "";
  let userId: number | undefined;
  let expectedModelCount = 0;
  let apply = false;
  let allowConvergenceWrite = false;
  let allowProductionReadOnly = false;
  let allowProductionConvergence = false;
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
    if (flag === "--allow-convergence-write") {
      allowConvergenceWrite = true;
      continue;
    }
    if (flag === "--allow-production-read-only") {
      allowProductionReadOnly = true;
      continue;
    }
    if (flag === "--allow-production-convergence") {
      allowProductionConvergence = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    if (flag === "--database-url") databaseUrl = value;
    else if (flag === "--app-id") appId = value;
    else if (flag === "--user-id") userId = positiveInteger(value, "--user-id");
    else if (flag === "--model-id") modelIds.push(positiveInteger(value, "--model-id"));
    else if (flag === "--expected-model-count") {
      expectedModelCount = positiveInteger(value, "--expected-model-count");
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
  if (target.protocol !== "mysql:") throw new Error("--database-url must use mysql:");
  const databaseName = target.pathname.replace(/^\//, "");
  if (!databaseName) throw new Error("--database-url must name a database");
  if (!appId.trim()) throw new Error("--app-id is required");
  const normalizedModelIds = Array.from(new Set(modelIds)).sort((a, b) => a - b);
  if (userId === undefined && normalizedModelIds.length === 0) {
    throw new Error("Provide --user-id or at least one --model-id; full-database convergence is refused");
  }
  if (expectedModelCount <= 0) throw new Error("--expected-model-count is required");

  const production = appId.toLowerCase().includes("production");
  if (production && !apply && !allowProductionReadOnly) {
    throw new Error("Production convergence planning requires --allow-production-read-only");
  }
  if (apply) {
    if (!allowConvergenceWrite) {
      throw new Error("Applying convergence requires --allow-convergence-write");
    }
    if (confirmAppId !== appId) {
      throw new Error("--confirm-app-id must exactly match --app-id before applying convergence");
    }
    if (confirmHost !== target.host) {
      throw new Error("--confirm-host must exactly match the database URL before applying convergence");
    }
    if (confirmDatabase !== databaseName) {
      throw new Error("--confirm-database must exactly match the database URL before applying convergence");
    }
    if (production && !allowProductionConvergence) {
      throw new Error("Production convergence requires --allow-production-convergence");
    }
  } else if (allowConvergenceWrite || allowProductionConvergence) {
    throw new Error("Convergence write authorization flags are valid only with --apply");
  }

  return {
    databaseUrl,
    appId,
    ...(userId !== undefined ? { userId } : {}),
    modelIds: normalizedModelIds,
    expectedModelCount,
    apply,
    allowConvergenceWrite,
    allowProductionReadOnly,
    allowProductionConvergence,
    confirmAppId,
    confirmHost,
    confirmDatabase,
  };
}
