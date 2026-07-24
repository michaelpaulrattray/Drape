/**
 * Private R7-7B6 Cast-slot pin convergence.
 *
 * This module is not routed and has no worker/scheduler entry point. Planning
 * is read-only. Applying is bounded by a frozen cohort plus exact model and
 * pinned-row counts. Each model is handled in its own transaction:
 *
 *   model row lock -> model operation-lock fence -> parity proof -> pin clear
 *   -> parity proof
 *
 * Only model_assets.pinned is mutated. Canvas board-item metadata pins are a
 * separate presentation mechanism and are never read or written here.
 */
import { and, eq, inArray, isNull, ne, type SQL } from "drizzle-orm";
import {
  generationOperationLocks,
  modelAssets,
  models,
} from "../../drizzle/schema";
import { withTransaction, type TransactionHandle } from "../db/connection";
import {
  compareSnapshotShadowCohort,
  compareSnapshotShadowState,
  readSnapshotShadowStateIn,
  type SnapshotShadowState,
} from "./snapshotShadow";
import { captureSnapshotReadMode } from "./snapshotReadScope";

export interface SnapshotPinConvergenceSelector {
  userId?: number;
  modelIds: number[];
  expectedModelCount: number;
  expectedPinnedRowCount: number;
}

export interface SnapshotPinConvergenceSubject {
  modelId: number;
  userId: number;
}

export const SNAPSHOT_PIN_CONVERGENCE_ERROR_CODES = [
  "active_operation",
  "model_unavailable",
  "parity_blocked",
  "scope_not_enabled",
  "pinned_count_changed",
  "write_count_mismatch",
  "postflight_parity_failed",
  "pin_clear_failed",
] as const;

export type SnapshotPinConvergenceErrorCode =
  typeof SNAPSHOT_PIN_CONVERGENCE_ERROR_CODES[number];

export interface SnapshotPinConvergencePlanModel {
  modelId: number;
  pinnedRows: number;
  status: "ready" | "clean" | "blocked";
  errorCode: "active_operation" | "parity_blocked" | "scope_not_enabled" | null;
}

export interface SnapshotPinConvergencePlan {
  ready: boolean;
  expectedModelCount: number;
  expectedPinnedRowCount: number;
  subjects: SnapshotPinConvergenceSubject[];
  models: SnapshotPinConvergencePlanModel[];
}

export interface SnapshotPinConvergenceModelResult {
  modelId: number;
  pinnedRowsBefore: number;
  clearedRows: number;
  status: "cleared" | "clean" | "failed";
  errorCode: SnapshotPinConvergenceErrorCode | null;
}

export interface SnapshotPinConvergencePostflight {
  auditedModels: number;
  parityModels: number;
  mismatchedModels: number;
  remainingPinnedRows: number;
}

export interface SnapshotPinConvergenceResult {
  success: boolean;
  expectedModelCount: number;
  expectedPinnedRowCount: number;
  preflight: SnapshotPinConvergencePlanModel[];
  results: SnapshotPinConvergenceModelResult[];
  postflight: SnapshotPinConvergencePostflight;
}

interface PinAssessment {
  pinnedRows: number;
  postClearParity: boolean;
}

class SnapshotPinConvergenceFailure extends Error {
  constructor(readonly code: SnapshotPinConvergenceErrorCode) {
    super(code);
    this.name = "SnapshotPinConvergenceFailure";
  }
}

function positiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function nonNegativeSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function normalizeSelector(
  input: SnapshotPinConvergenceSelector,
): SnapshotPinConvergenceSelector {
  for (const modelId of input.modelIds) {
    positiveSafeInteger(modelId, "Snapshot pin convergence model id");
  }
  const modelIds = Array.from(new Set(input.modelIds)).sort((a, b) => a - b);
  if (input.userId === undefined && modelIds.length === 0) {
    throw new Error("Snapshot pin convergence requires a user id or at least one model id");
  }
  if (input.userId !== undefined) {
    positiveSafeInteger(input.userId, "Snapshot pin convergence user id");
  }
  positiveSafeInteger(
    input.expectedModelCount,
    "Snapshot pin convergence expected model count",
  );
  nonNegativeSafeInteger(
    input.expectedPinnedRowCount,
    "Snapshot pin convergence expected pinned row count",
  );
  return { ...input, modelIds };
}

async function listSubjectsIn(
  tx: TransactionHandle,
  input: Pick<SnapshotPinConvergenceSelector, "userId" | "modelIds">,
): Promise<SnapshotPinConvergenceSubject[]> {
  const filters: SQL[] = [
    isNull(models.deletedAt),
    ne(models.status, "archived"),
  ];
  if (input.userId !== undefined) filters.push(eq(models.userId, input.userId));
  if (input.modelIds.length > 0) filters.push(inArray(models.id, input.modelIds));
  return tx
    .select({ modelId: models.id, userId: models.userId })
    .from(models)
    .where(and(...filters))
    .orderBy(models.id);
}

function assertExpectedModelCount(
  subjects: SnapshotPinConvergenceSubject[],
  expectedModelCount: number,
): void {
  if (subjects.length !== expectedModelCount) {
    throw new Error(
      `Snapshot pin convergence cohort count mismatch: expected ${expectedModelCount}, found ${subjects.length}`,
    );
  }
}

function stateWithPinsCleared(state: SnapshotShadowState): SnapshotShadowState {
  return {
    ...state,
    assets: state.assets.map((asset) => (
      asset.pinned ? { ...asset, pinned: false } : asset
    )),
  };
}

/**
 * Pure pre-write law: the proposed pin-only change must be sufficient to make
 * the ordinary R6-vs-snapshot consumer audit fully clean. It cannot conceal or
 * repair structural, selection, identity, seal, or other consumer drift.
 */
export function assessSnapshotPinConvergenceState(
  state: SnapshotShadowState,
): PinAssessment {
  const pinnedRows = state.assets.filter((asset) => asset.pinned).length;
  return {
    pinnedRows,
    postClearParity: compareSnapshotShadowState(stateWithPinsCleared(state)).parity,
  };
}

async function hasActiveModelOperationIn(
  tx: TransactionHandle,
  modelId: number,
  lock: boolean,
): Promise<boolean> {
  let query = tx
    .select({ operationId: generationOperationLocks.operationId })
    .from(generationOperationLocks)
    .where(eq(generationOperationLocks.lockKey, `model:${modelId}`))
    .limit(1);
  if (lock) query = query.for("update") as typeof query;
  return (await query).length > 0;
}

async function inspectSubjectIn(
  tx: TransactionHandle,
  subject: SnapshotPinConvergenceSubject,
): Promise<SnapshotPinConvergencePlanModel> {
  const activeOperation = await hasActiveModelOperationIn(tx, subject.modelId, false);
  const state = await readSnapshotShadowStateIn(tx, {
    userId: subject.userId,
    modelId: subject.modelId,
  });
  const assessment = assessSnapshotPinConvergenceState(state);
  if (captureSnapshotReadMode(subject.userId) !== "snapshot") {
    return {
      modelId: subject.modelId,
      pinnedRows: assessment.pinnedRows,
      status: "blocked",
      errorCode: "scope_not_enabled",
    };
  }
  if (activeOperation) {
    return {
      modelId: subject.modelId,
      pinnedRows: assessment.pinnedRows,
      status: "blocked",
      errorCode: "active_operation",
    };
  }
  if (!assessment.postClearParity) {
    return {
      modelId: subject.modelId,
      pinnedRows: assessment.pinnedRows,
      status: "blocked",
      errorCode: "parity_blocked",
    };
  }
  return {
    modelId: subject.modelId,
    pinnedRows: assessment.pinnedRows,
    status: assessment.pinnedRows > 0 ? "ready" : "clean",
    errorCode: null,
  };
}

export async function planSnapshotPinConvergence(
  rawInput: SnapshotPinConvergenceSelector,
): Promise<SnapshotPinConvergencePlan> {
  const input = normalizeSelector(rawInput);
  return withTransaction(async (tx) => {
    const subjects = await listSubjectsIn(tx, input);
    assertExpectedModelCount(subjects, input.expectedModelCount);
    const planned: SnapshotPinConvergencePlanModel[] = [];
    for (const subject of subjects) planned.push(await inspectSubjectIn(tx, subject));
    const pinnedRows = planned.reduce((total, model) => total + model.pinnedRows, 0);
    if (pinnedRows !== input.expectedPinnedRowCount) {
      throw new Error(
        `Snapshot pin convergence pinned-row count mismatch: expected ${input.expectedPinnedRowCount}, found ${pinnedRows}`,
      );
    }
    return {
      ready: planned.every((model) => model.status !== "blocked"),
      expectedModelCount: input.expectedModelCount,
      expectedPinnedRowCount: input.expectedPinnedRowCount,
      subjects,
      models: planned,
    };
  });
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return (result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
  }
  return (result as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
}

async function lockFrozenSubjectIn(
  tx: TransactionHandle,
  subject: SnapshotPinConvergenceSubject,
): Promise<void> {
  const [model] = await tx
    .select({ id: models.id })
    .from(models)
    .where(and(
      eq(models.id, subject.modelId),
      eq(models.userId, subject.userId),
      isNull(models.deletedAt),
      ne(models.status, "archived"),
    ))
    .limit(1)
    .for("update");
  if (!model) throw new SnapshotPinConvergenceFailure("model_unavailable");
}

async function convergeOneSubject(
  subject: SnapshotPinConvergenceSubject,
  expectedPinnedRows: number,
): Promise<SnapshotPinConvergenceModelResult> {
  try {
    return await withTransaction(async (tx) => {
      await lockFrozenSubjectIn(tx, subject);
      if (captureSnapshotReadMode(subject.userId) !== "snapshot") {
        throw new SnapshotPinConvergenceFailure("scope_not_enabled");
      }
      // The exact-key FOR UPDATE also fences an absent row under InnoDB's
      // repeatable-read next-key locking, preventing a new model operation from
      // acquiring this resource until the pin transaction commits.
      if (await hasActiveModelOperationIn(tx, subject.modelId, true)) {
        throw new SnapshotPinConvergenceFailure("active_operation");
      }
      const state = await readSnapshotShadowStateIn(tx, {
        userId: subject.userId,
        modelId: subject.modelId,
      });
      const assessment = assessSnapshotPinConvergenceState(state);
      if (assessment.pinnedRows !== expectedPinnedRows) {
        throw new SnapshotPinConvergenceFailure("pinned_count_changed");
      }
      if (!assessment.postClearParity) {
        throw new SnapshotPinConvergenceFailure("parity_blocked");
      }
      if (assessment.pinnedRows === 0) {
        return {
          modelId: subject.modelId,
          pinnedRowsBefore: 0,
          clearedRows: 0,
          status: "clean",
          errorCode: null,
        };
      }

      const updated = await tx
        .update(modelAssets)
        .set({ pinned: false })
        .where(and(
          eq(modelAssets.modelId, subject.modelId),
          eq(modelAssets.pinned, true),
        ));
      if (affectedRows(updated) !== assessment.pinnedRows) {
        throw new SnapshotPinConvergenceFailure("write_count_mismatch");
      }

      const postState = await readSnapshotShadowStateIn(tx, {
        userId: subject.userId,
        modelId: subject.modelId,
      });
      const postAssessment = assessSnapshotPinConvergenceState(postState);
      if (postAssessment.pinnedRows !== 0 || !compareSnapshotShadowState(postState).parity) {
        throw new SnapshotPinConvergenceFailure("postflight_parity_failed");
      }
      return {
        modelId: subject.modelId,
        pinnedRowsBefore: assessment.pinnedRows,
        clearedRows: assessment.pinnedRows,
        status: "cleared",
        errorCode: null,
      };
    });
  } catch (error) {
    return {
      modelId: subject.modelId,
      pinnedRowsBefore: expectedPinnedRows,
      clearedRows: 0,
      status: "failed",
      errorCode: error instanceof SnapshotPinConvergenceFailure
        ? error.code
        : "pin_clear_failed",
    };
  }
}

async function pinnedRowsForModels(modelIds: number[]): Promise<number> {
  if (modelIds.length === 0) return 0;
  return withTransaction(async (tx) => (
    await tx
      .select({ id: modelAssets.id })
      .from(modelAssets)
      .where(and(
        inArray(modelAssets.modelId, modelIds),
        eq(modelAssets.pinned, true),
      ))
  ).length);
}

export async function convergeSnapshotPins(
  rawInput: SnapshotPinConvergenceSelector,
): Promise<SnapshotPinConvergenceResult> {
  const input = normalizeSelector(rawInput);
  const preflight = await planSnapshotPinConvergence(input);
  const results: SnapshotPinConvergenceModelResult[] = [];

  if (preflight.ready) {
    for (const subject of preflight.subjects) {
      const planned = preflight.models.find((model) => model.modelId === subject.modelId);
      results.push(await convergeOneSubject(subject, planned?.pinnedRows ?? 0));
    }
  } else {
    for (const model of preflight.models) {
      results.push({
        modelId: model.modelId,
        pinnedRowsBefore: model.pinnedRows,
        clearedRows: 0,
        status: model.status === "blocked" ? "failed" : "clean",
        errorCode: model.errorCode,
      });
    }
  }

  const frozenModelIds = preflight.subjects.map((subject) => subject.modelId);
  const reports = frozenModelIds.length > 0
    ? await compareSnapshotShadowCohort({
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
        modelIds: frozenModelIds,
      })
    : [];
  const parityModels = reports.filter((report) => report.parity).length;
  const remainingPinnedRows = await pinnedRowsForModels(frozenModelIds);
  const postflight: SnapshotPinConvergencePostflight = {
    auditedModels: reports.length,
    parityModels,
    mismatchedModels: reports.length - parityModels,
    remainingPinnedRows,
  };
  const success = (
    preflight.ready
    && results.every((result) => result.status !== "failed")
    && postflight.auditedModels === input.expectedModelCount
    && postflight.mismatchedModels === 0
    && postflight.remainingPinnedRows === 0
  );
  return {
    success,
    expectedModelCount: input.expectedModelCount,
    expectedPinnedRowCount: input.expectedPinnedRowCount,
    preflight: preflight.models,
    results,
    postflight,
  };
}

export interface SnapshotPinConvergenceArgs extends SnapshotPinConvergenceSelector {
  databaseUrl: string;
  appId: string;
  apply: boolean;
  allowPinConvergenceWrite: boolean;
  allowProductionReadOnly: boolean;
  allowProductionPinConvergence: boolean;
  confirmAppId: string | null;
  confirmHost: string | null;
  confirmDatabase: string | null;
}

function parsePositiveInteger(value: string, label: string): number {
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`${label} must be a positive integer`);
  return positiveSafeInteger(Number(value), label);
}

function parseNonNegativeInteger(value: string, label: string): number {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return nonNegativeSafeInteger(Number(value), label);
}

export function parseSnapshotPinConvergenceArgs(
  argv: string[],
): SnapshotPinConvergenceArgs {
  let databaseUrl = "";
  let appId = "";
  let userId: number | undefined;
  let expectedModelCount = 0;
  let expectedPinnedRowCount: number | undefined;
  let apply = false;
  let allowPinConvergenceWrite = false;
  let allowProductionReadOnly = false;
  let allowProductionPinConvergence = false;
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
    if (flag === "--allow-pin-convergence-write") {
      allowPinConvergenceWrite = true;
      continue;
    }
    if (flag === "--allow-production-read-only") {
      allowProductionReadOnly = true;
      continue;
    }
    if (flag === "--allow-production-pin-convergence") {
      allowProductionPinConvergence = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    if (flag === "--database-url") databaseUrl = value;
    else if (flag === "--app-id") appId = value;
    else if (flag === "--user-id") userId = parsePositiveInteger(value, "--user-id");
    else if (flag === "--model-id") {
      modelIds.push(parsePositiveInteger(value, "--model-id"));
    } else if (flag === "--expected-model-count") {
      expectedModelCount = parsePositiveInteger(value, "--expected-model-count");
    } else if (flag === "--expected-pinned-row-count") {
      expectedPinnedRowCount = parseNonNegativeInteger(
        value,
        "--expected-pinned-row-count",
      );
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
    throw new Error(
      "Provide --user-id or at least one --model-id; full-database pin convergence is refused",
    );
  }
  if (expectedModelCount <= 0) throw new Error("--expected-model-count is required");
  if (expectedPinnedRowCount === undefined) {
    throw new Error("--expected-pinned-row-count is required");
  }

  const production = appId.toLowerCase().includes("production");
  if (production && !apply && !allowProductionReadOnly) {
    throw new Error("Production pin-convergence planning requires --allow-production-read-only");
  }
  if (apply) {
    if (!allowPinConvergenceWrite) {
      throw new Error("Applying pin convergence requires --allow-pin-convergence-write");
    }
    if (confirmAppId !== appId) {
      throw new Error("--confirm-app-id must exactly match --app-id before applying pin convergence");
    }
    if (confirmHost !== target.host) {
      throw new Error("--confirm-host must exactly match the database URL before applying pin convergence");
    }
    if (confirmDatabase !== databaseName) {
      throw new Error("--confirm-database must exactly match the database URL before applying pin convergence");
    }
    if (production && !allowProductionPinConvergence) {
      throw new Error(
        "Production pin convergence requires --allow-production-pin-convergence",
      );
    }
  } else if (allowPinConvergenceWrite || allowProductionPinConvergence) {
    throw new Error("Pin-convergence write authorization flags are valid only with --apply");
  }

  return {
    databaseUrl,
    appId,
    ...(userId !== undefined ? { userId } : {}),
    modelIds: normalizedModelIds,
    expectedModelCount,
    expectedPinnedRowCount,
    apply,
    allowPinConvergenceWrite,
    allowProductionReadOnly,
    allowProductionPinConvergence,
    confirmAppId,
    confirmHost,
    confirmDatabase,
  };
}
