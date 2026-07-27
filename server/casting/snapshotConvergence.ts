/**
 * Private R7-7A snapshot convergence orchestration.
 *
 * This is not routed and has no background entry point. Callers must name a
 * bounded cohort and an exact expected model count. Planning is read-only;
 * applying delegates each model to the already-reviewed, model-row-locked,
 * idempotent bootstrap transaction, then proves parity over the same frozen
 * model-id cohort.
 */
import { and, eq, inArray, type SQL } from "drizzle-orm";
import { generationOperationLocks, models } from "../../drizzle/schema";
import { withTransaction } from "../db/connection";
import {
  bootstrapIdleModelSnapshot,
  SnapshotBootstrapActiveOperationError,
  type SnapshotBootstrapResult,
} from "./snapshotBootstrap";
import { modelOperationLockKey } from "./operationContract";
import {
  compareSnapshotShadowCohort,
  type SnapshotShadowReport,
} from "./snapshotShadow";
import {
  summarizeSnapshotShadowReports,
  type SnapshotShadowAuditSummary,
} from "./snapshotShadowAudit";
import { availableModelWhere } from "./modelAvailability";

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
  ready: boolean;
  activeOperationModelIds: number[];
  subjects: SnapshotConvergenceSubject[];
  summary: SnapshotShadowAuditSummary;
  models: SnapshotShadowReport[];
}

export interface SnapshotConvergenceModelResult {
  modelId: number;
  status: SnapshotBootstrapResult["status"] | "failed";
  errorCode: "bootstrap_failed" | "active_operation" | "cohort_blocked" | null;
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

async function listSubjectsAndActiveOperations(
  input: Pick<SnapshotConvergenceSelector, "userId" | "modelIds">,
): Promise<{
  subjects: SnapshotConvergenceSubject[];
  activeOperationModelIds: number[];
}> {
  return withTransaction(async (tx) => {
    const filters: SQL[] = [
      availableModelWhere(),
    ];
    if (input.userId !== undefined) filters.push(eq(models.userId, input.userId));
    if (input.modelIds.length > 0) filters.push(inArray(models.id, input.modelIds));
    const subjects = await tx
      .select({ modelId: models.id, userId: models.userId })
      .from(models)
      .where(and(...filters))
      .orderBy(models.id);
    const lockKeys = new Map(
      subjects.map((subject) => [
        modelOperationLockKey(subject.modelId),
        subject.modelId,
      ]),
    );
    const activeLocks = lockKeys.size === 0
      ? []
      : await tx
          .select({ lockKey: generationOperationLocks.lockKey })
          .from(generationOperationLocks)
          .where(inArray(
            generationOperationLocks.lockKey,
            Array.from(lockKeys.keys()),
          ));
    const activeOperationModelIds = activeLocks
      .map((lock) => lockKeys.get(lock.lockKey))
      .filter((modelId): modelId is number => modelId !== undefined)
      .sort((left, right) => left - right);
    return { subjects, activeOperationModelIds };
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
  const { subjects, activeOperationModelIds } = await listSubjectsAndActiveOperations(input);
  assertExpectedCount(subjects, input.expectedModelCount);
  const models = await reportsForSubjects(input, subjects);
  if (models.length !== subjects.length) {
    throw new Error("Snapshot convergence cohort changed during the read-only preflight");
  }
  return {
    ready: activeOperationModelIds.length === 0,
    activeOperationModelIds,
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
  if (!preflight.ready) {
    const activeModelIds = new Set(preflight.activeOperationModelIds);
    return {
      success: false,
      expectedModelCount: input.expectedModelCount,
      preflight: preflight.summary,
      results: preflight.subjects.map((subject) => ({
        modelId: subject.modelId,
        status: "failed",
        errorCode: activeModelIds.has(subject.modelId)
          ? "active_operation"
          : "cohort_blocked",
      })),
      postflight: preflight.summary,
    };
  }
  const results: SnapshotConvergenceModelResult[] = [];
  for (const subject of preflight.subjects) {
    try {
      const result = await bootstrapIdleModelSnapshot({
        userId: subject.userId,
        modelId: subject.modelId,
      });
      results.push({
        modelId: subject.modelId,
        status: result.status,
        errorCode: null,
      });
    } catch (error) {
      // The CLI/report deliberately exposes no raw DB, prompt, model or
      // identity error text. Support can investigate this bounded model id.
      results.push({
        modelId: subject.modelId,
        status: "failed",
        errorCode: error instanceof SnapshotBootstrapActiveOperationError
          ? "active_operation"
          : "bootstrap_failed",
      });
    }
  }

  const postModels = await reportsForSubjects(input, preflight.subjects);
  const postflight = summarizeSnapshotShadowReports(postModels).summary;
  const success = (
    preflight.ready
    && results.every((result) => result.status !== "failed")
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
