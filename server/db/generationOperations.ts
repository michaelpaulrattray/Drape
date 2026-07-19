import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  generations,
  generationOperationLocks,
  generationOperations,
  type Generation,
  type GenerationOperation,
} from "../../drizzle/schema";
import {
  assertCreditConservation,
  assertGenerationOperationKind,
  assertGenerationOperationLandingStatus,
  assertGenerationOperationPhase,
  assertGenerationOperationProgress,
  assertGenerationOperationStatus,
  assertOperationLockKey,
  assertPublicOperationResult,
  boardItemOperationLockKey,
  type GenerationOperationChildStatus,
  type GenerationOperationKind,
  type GenerationOperationOutcome,
  type GenerationOperationPhase,
  type GenerationOperationProgress,
  type PublicGenerationOperation,
  hashGenerationOperationClaim,
  modelOperationLockKey,
  operationChargeReference,
} from "../casting/operationContract";
import { createModuleLogger } from "../logging/logger";
import { getDb, withTransaction, type TransactionHandle } from "./connection";

const log = createModuleLogger("db/generationOperations");
export const DEFAULT_GENERATION_OPERATION_LEASE_MS = 15 * 60 * 1000;
const DEFAULT_GENERATION_OPERATION_HEARTBEAT_MS = 30 * 1000;

type ActiveHeartbeat = {
  timer: ReturnType<typeof setInterval>;
  failure: unknown | null;
  inFlight: Promise<void> | null;
};

const activeHeartbeats = new Map<string, ActiveHeartbeat>();

async function stopOperationHeartbeat(operationId: string): Promise<unknown | null> {
  const active = activeHeartbeats.get(operationId);
  if (!active) return null;
  clearInterval(active.timer);
  activeHeartbeats.delete(operationId);
  await active.inFlight?.catch(() => undefined);
  return active.failure;
}

function startOperationHeartbeat(userId: number, operationId: string): void {
  if (activeHeartbeats.has(operationId)) return;
  const active: ActiveHeartbeat = { timer: undefined as never, failure: null, inFlight: null };
  active.timer = setInterval(() => {
    if (active.failure || active.inFlight) return;
    active.inFlight = heartbeatGenerationOperation({ userId, operationId })
      .then(() => undefined)
      .catch((error) => {
        active.failure = error;
        log.error({ err: error, operationId }, "[GenerationOperations] operation heartbeat failed");
      })
      .finally(() => { active.inFlight = null; });
  }, DEFAULT_GENERATION_OPERATION_HEARTBEAT_MS);
  active.timer.unref?.();
  activeHeartbeats.set(operationId, active);
}

export interface ClaimGenerationOperationInput {
  userId: number;
  clientRequestId: string;
  kind: GenerationOperationKind;
  modelId?: number | null;
  originBoardId?: number | null;
  originItemId?: number | null;
  payload: unknown;
}

export type AcquireGenerationOperationLockResult =
  | { type: "acquired"; operationId: string; lockKey: string; expiresAt: Date }
  | Extract<GenerationOperationOutcome, { type: "resource_busy" }>;

function isMysqlDuplicateKeyError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; errno?: unknown; cause?: unknown };
    if (candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062) return true;
    current = candidate.cause;
  }
  return false;
}

function assertPositiveId(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${label} must be a positive integer`);
}

function affectedRows(result: unknown): number {
  const candidate = result as { affectedRows?: unknown } | [{ affectedRows?: unknown }];
  const value = Array.isArray(candidate) ? candidate[0]?.affectedRows : candidate?.affectedRows;
  return typeof value === "number" ? value : 0;
}

function assertOptionalPositiveId(value: number | null | undefined, label: string): void {
  if (value !== null && value !== undefined) assertPositiveId(value, label);
}

function assertOperationIdentity(operationId: string): void {
  operationChargeReference(operationId);
}

function outcomeFromExisting(operation: GenerationOperation): GenerationOperationOutcome {
  switch (operation.status) {
    case "claimed":
    case "running":
      return { type: "in_progress", operationId: operation.id, status: operation.status };
    case "partial":
    case "succeeded":
      return { type: "replay_success", operationId: operation.id, result: operation.result };
    case "failed":
      return {
        type: "replay_failure",
        operationId: operation.id,
        errorCode: operation.errorCode || "INTERNAL_SERVER_ERROR",
        publicMessage: operation.publicMessage || "The operation failed.",
      };
    case "recovery_required":
    default:
      return {
        type: "recovery_required",
        operationId: operation.id,
        publicMessage: operation.publicMessage ||
          `Operation ${operation.id} needs support review before it can be retried.`,
      };
  }
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/**
 * Fail-closed projection for the future authenticated operation read surface.
 * It deliberately omits payload hashes, ledger references, lock ownership,
 * internal child errors and child result URLs.
 */
export function toPublicGenerationOperation(
  operation: GenerationOperation,
  children: Generation[] = [],
): PublicGenerationOperation {
  assertGenerationOperationKind(operation.kind);
  assertGenerationOperationStatus(operation.status);
  if (operation.phase !== null) assertGenerationOperationPhase(operation.phase);
  assertGenerationOperationLandingStatus(operation.landingStatus);
  if (operation.progress !== null) assertGenerationOperationProgress(operation.progress);
  if (operation.result !== null) assertPublicOperationResult(operation.result);
  assertCreditConservation(operation.chargedCredits, operation.refundedCredits);

  const publicChildren = children.map((child) => {
    if (child.operationId !== operation.id || child.userId !== operation.userId) {
      throw new TypeError("Generation child belongs to a different operation");
    }
    const status = child.status as GenerationOperationChildStatus;
    if (!["pending", "processing", "completed", "failed"].includes(status)) {
      throw new TypeError("Generation child has an invalid status");
    }
    if (!Number.isSafeInteger(child.pointsCost) || child.pointsCost < 0) {
      throw new TypeError("Generation child has an invalid points cost");
    }
    return {
      id: child.id,
      stepKey: child.stepKey,
      viewAngle: child.viewAngle,
      status,
      pointsCost: child.pointsCost,
      createdAt: child.createdAt.toISOString(),
      completedAt: iso(child.completedAt),
    };
  });

  return {
    operationId: operation.id,
    clientRequestId: operation.clientRequestId,
    kind: operation.kind,
    modelId: operation.modelId,
    originBoardId: operation.originBoardId,
    originItemId: operation.originItemId,
    status: operation.status,
    phase: operation.phase,
    progress: operation.progress,
    plannedCredits: operation.plannedCredits,
    chargedCredits: operation.chargedCredits,
    refundedCredits: operation.refundedCredits,
    netCredits: operation.chargedCredits - operation.refundedCredits,
    result: operation.result,
    publicMessage: operation.publicMessage,
    createdAt: operation.createdAt.toISOString(),
    updatedAt: operation.updatedAt.toISOString(),
    completedAt: iso(operation.completedAt),
    heartbeatAt: iso(operation.heartbeatAt),
    leaseExpiresAt: iso(operation.leaseExpiresAt),
    cancellable: false,
    landingStatus: operation.landingStatus,
    landedItemId: operation.landedItemId,
    landingAcknowledgedAt: iso(operation.landingAcknowledgedAt),
    children: publicChildren,
  };
}

async function getOperationForUser(
  userId: number,
  operationId: string,
  tx?: TransactionHandle,
): Promise<GenerationOperation | null> {
  const db = tx ?? await getDb();
  if (!db) return null;
  const [operation] = await db
    .select()
    .from(generationOperations)
    .where(and(eq(generationOperations.id, operationId), eq(generationOperations.userId, userId)))
    .limit(1);
  return operation ?? null;
}

export async function claimGenerationOperation(
  input: ClaimGenerationOperationInput,
): Promise<GenerationOperationOutcome> {
  assertPositiveId(input.userId, "userId");
  assertGenerationOperationKind(input.kind);
  assertOptionalPositiveId(input.modelId, "modelId");
  assertOptionalPositiveId(input.originBoardId, "originBoardId");
  assertOptionalPositiveId(input.originItemId, "originItemId");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const payloadHash = hashGenerationOperationClaim(input);
  const operationId = randomUUID();
  try {
    await db.insert(generationOperations).values({
      id: operationId,
      userId: input.userId,
      clientRequestId: input.clientRequestId,
      kind: input.kind,
      modelId: input.modelId ?? null,
      originBoardId: input.originBoardId ?? null,
      originItemId: input.originItemId ?? null,
      payloadHash,
      status: "claimed",
    });
    return { type: "claimed", operationId, payloadHash };
  } catch (error) {
    if (!isMysqlDuplicateKeyError(error)) throw error;
    const [existing] = await db
      .select()
      .from(generationOperations)
      .where(and(
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.clientRequestId, input.clientRequestId),
      ))
      .limit(1);
    if (!existing) throw error;
    if (existing.kind !== input.kind || existing.payloadHash !== payloadHash) {
      log.fatal(
        { userId: input.userId, clientRequestId: input.clientRequestId, operationId: existing.id },
        "[GenerationOperations] Client request id was reused with a different trusted payload",
      );
      return { type: "payload_conflict", operationId: existing.id };
    }
    return outcomeFromExisting(existing);
  }
}

export async function acquireGenerationOperationLock(input: {
  userId: number;
  operationId: string;
  kind: GenerationOperationKind;
  lockKey: string;
  leaseMs?: number;
  now?: Date;
}): Promise<AcquireGenerationOperationLockResult> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  assertGenerationOperationKind(input.kind);
  assertOperationLockKey(input.lockKey);
  const leaseMs = input.leaseMs ?? DEFAULT_GENERATION_OPERATION_LEASE_MS;
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) throw new TypeError("leaseMs must be positive");
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + leaseMs);
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const operation = await getOperationForUser(input.userId, input.operationId);
  if (!operation) throw new Error("Generation operation not found");
  if (operation.kind !== input.kind) throw new Error("Generation operation kind mismatch");
  if (operation.status !== "claimed" && operation.status !== "running") {
    throw new Error("A terminal generation operation cannot acquire a lock");
  }
  const allowedLockKeys = [
    operation.modelId ? modelOperationLockKey(operation.modelId) : null,
    operation.originItemId ? boardItemOperationLockKey(operation.originItemId) : null,
  ].filter((lockKey): lockKey is string => lockKey !== null);
  if (!allowedLockKeys.includes(input.lockKey)) {
    throw new Error("Operation lock does not match a resource in the trusted claim");
  }

  try {
    await db.insert(generationOperationLocks).values({
      lockKey: input.lockKey,
      operationId: input.operationId,
      kind: input.kind,
      acquiredAt: now,
      expiresAt,
    });
    return { type: "acquired", operationId: input.operationId, lockKey: input.lockKey, expiresAt };
  } catch (error) {
    if (!isMysqlDuplicateKeyError(error)) throw error;
    const [byKey] = await db
      .select()
      .from(generationOperationLocks)
      .where(eq(generationOperationLocks.lockKey, input.lockKey))
      .limit(1);
    const [byOperation] = await db
      .select()
      .from(generationOperationLocks)
      .where(eq(generationOperationLocks.operationId, input.operationId))
      .limit(1);
    const existing = byKey ?? byOperation;
    if (existing?.operationId === input.operationId && existing.lockKey === input.lockKey) {
      return {
        type: "acquired",
        operationId: input.operationId,
        lockKey: input.lockKey,
        expiresAt: existing.expiresAt,
      };
    }
    if (byOperation?.operationId === input.operationId) {
      throw new Error("Generation operation already owns a different resource lock");
    }

    const publicMessage = "Another operation is already changing this Cast. Wait for it to finish before retrying.";
    const failed = await db
      .update(generationOperations)
      .set({
        status: "failed",
        errorCode: "CONFLICT",
        publicMessage,
        completedAt: new Date(),
      })
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.status, "claimed"),
      ));
    if (affectedRows(failed) !== 1) {
      throw new Error("Resource-busy operation could not be finalized safely");
    }
    log.warn(
      {
        operationId: input.operationId,
        lockKey: input.lockKey,
        ownerOperationId: existing?.operationId,
        expired: existing ? existing.expiresAt.getTime() <= now.getTime() : undefined,
      },
      "[GenerationOperations] Resource lock refused without stealing it",
    );
    return {
      type: "resource_busy",
      operationId: input.operationId,
      lockKey: input.lockKey,
      ownerOperationId: existing?.operationId,
    };
  }
}

export async function markGenerationOperationRunning(input: {
  userId: number;
  operationId: string;
  modelId?: number | null;
  expectedIdentityRevisionId?: string | null;
  plannedCredits: number;
  requiredLockKey?: string;
  phase?: GenerationOperationPhase;
  now?: Date;
  leaseMs?: number;
  /** Production executors opt in; low-level migration/tests can exercise the
   * receipt transition without leaving a process timer behind. */
  heartbeat?: boolean;
}): Promise<{ operationId: string; chargeReferenceId: string }> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  assertOptionalPositiveId(input.modelId, "modelId");
  if (!Number.isSafeInteger(input.plannedCredits) || input.plannedCredits < 0) {
    throw new TypeError("plannedCredits must be a non-negative integer");
  }
  if (input.requiredLockKey) assertOperationLockKey(input.requiredLockKey);
  const phase = input.phase ?? "planning";
  assertGenerationOperationPhase(phase);
  const now = input.now ?? new Date();
  const leaseMs = input.leaseMs ?? DEFAULT_GENERATION_OPERATION_LEASE_MS;
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) throw new TypeError("leaseMs must be positive");
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);
  const chargeReferenceId = operationChargeReference(input.operationId);

  try {
    await withTransaction(async (tx) => {
    const operation = await getOperationForUser(input.userId, input.operationId, tx);
    if (!operation) throw new Error("Generation operation not found");
    if (operation.status === "running") {
      if (operation.chargeReferenceId !== chargeReferenceId) {
        throw new Error("Running operation has an invalid charge reference");
      }
      if (operation.plannedCredits !== input.plannedCredits) {
        throw new Error("Running operation cannot change its planned credits");
      }
      if (input.modelId !== undefined && input.modelId !== null && operation.modelId !== input.modelId) {
        throw new Error("Running operation cannot change its model");
      }
      if (
        input.expectedIdentityRevisionId !== undefined &&
        (operation.expectedIdentityRevisionId ?? null) !== input.expectedIdentityRevisionId
      ) {
        throw new Error("Running operation cannot change its expected identity revision");
      }
      if (input.requiredLockKey) {
        const [lock] = await tx
          .select({ operationId: generationOperationLocks.operationId })
          .from(generationOperationLocks)
          .where(eq(generationOperationLocks.lockKey, input.requiredLockKey))
          .limit(1);
        if (lock?.operationId !== input.operationId) {
          throw new Error("Running operation no longer owns the required lock");
        }
      }
      if (operation.phase !== phase) throw new Error("Running operation cannot change its phase during start replay");
      return;
    }
    if (operation.status !== "claimed") throw new Error("Only a claimed operation can start");

    if (input.requiredLockKey) {
      const [lock] = await tx
        .select({ operationId: generationOperationLocks.operationId })
        .from(generationOperationLocks)
        .where(eq(generationOperationLocks.lockKey, input.requiredLockKey))
        .limit(1);
      if (lock?.operationId !== input.operationId) throw new Error("Generation operation does not own the required lock");
    }

    const started = await tx
      .update(generationOperations)
      .set({
        status: "running",
        modelId: input.modelId ?? operation.modelId,
        expectedIdentityRevisionId: input.expectedIdentityRevisionId ?? null,
        plannedCredits: input.plannedCredits,
        chargeReferenceId,
        phase,
        heartbeatAt: now,
        leaseExpiresAt,
      })
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.status, "claimed"),
      ));
    if (affectedRows(started) !== 1) throw new Error("Generation operation start lost its state race");
    if (input.requiredLockKey) {
      const renewed = await tx
        .update(generationOperationLocks)
        .set({ expiresAt: leaseExpiresAt })
        .where(and(
          eq(generationOperationLocks.lockKey, input.requiredLockKey),
          eq(generationOperationLocks.operationId, input.operationId),
        ));
      if (affectedRows(renewed) !== 1) throw new Error("Generation operation start could not renew its lock");
    }
    });
  } catch (error) {
    // The start transaction may have committed even when the caller lost its
    // response. Read the receipt before deciding: a matching running row is
    // an idempotent success; a still-claimed row is sealed free; anything
    // ambiguous remains locked for the stale adjudicator/support.
    const operation = await getOperationForUser(input.userId, input.operationId).catch(() => null);
    if (
      operation?.status === "running" &&
      operation.chargeReferenceId === chargeReferenceId &&
      operation.plannedCredits === input.plannedCredits &&
      operation.phase === phase
    ) {
      if (input.heartbeat) startOperationHeartbeat(input.userId, input.operationId);
      return { operationId: input.operationId, chargeReferenceId };
    }
    if (operation?.status === "claimed") {
      const publicMessage = "The operation could not start. Nothing was charged.";
      try {
        await finalizeClaimedGenerationOperationFailure({
          userId: input.userId,
          operationId: input.operationId,
          errorCode: "INTERNAL_SERVER_ERROR",
          publicMessage,
        });
      } catch (sealError) {
        await markClaimedGenerationOperationRecoveryRequired({
          userId: input.userId,
          operationId: input.operationId,
          publicMessage: `The start state needs support review. Operation ${input.operationId}.`,
        }).catch((recoveryError) => {
          log.fatal({ err: recoveryError, sealError, operationId: input.operationId }, "[GenerationOperations] start could not be sealed");
        });
      }
    }
    throw error;
  }

  if (input.heartbeat) startOperationHeartbeat(input.userId, input.operationId);
  return { operationId: input.operationId, chargeReferenceId };
}

export async function heartbeatGenerationOperation(input: {
  userId: number;
  operationId: string;
  now?: Date;
  leaseMs?: number;
}): Promise<{ heartbeatAt: Date; leaseExpiresAt: Date }> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  const heartbeatAt = input.now ?? new Date();
  const leaseMs = input.leaseMs ?? DEFAULT_GENERATION_OPERATION_LEASE_MS;
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) throw new TypeError("leaseMs must be positive");
  const leaseExpiresAt = new Date(heartbeatAt.getTime() + leaseMs);

  await withTransaction(async (tx) => {
    const renewedOperation = await tx
      .update(generationOperations)
      .set({ heartbeatAt, leaseExpiresAt })
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.status, "running"),
      ));
    if (affectedRows(renewedOperation) !== 1) {
      throw new Error("Only the owned running operation can heartbeat");
    }
    const [lock] = await tx
      .select({ lockKey: generationOperationLocks.lockKey })
      .from(generationOperationLocks)
      .where(eq(generationOperationLocks.operationId, input.operationId))
      .limit(1);
    if (!lock) return;
    const renewedLock = await tx
      .update(generationOperationLocks)
      .set({ expiresAt: leaseExpiresAt })
      .where(and(
        eq(generationOperationLocks.operationId, input.operationId),
        eq(generationOperationLocks.lockKey, lock.lockKey),
      ));
    if (affectedRows(renewedLock) !== 1) throw new Error("Operation heartbeat lost its resource lock");
  });
  return { heartbeatAt, leaseExpiresAt };
}

export async function updateGenerationOperationProgress(input: {
  userId: number;
  operationId: string;
  phase: GenerationOperationPhase;
  progress: GenerationOperationProgress;
}): Promise<void> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  assertGenerationOperationPhase(input.phase);
  assertGenerationOperationProgress(input.progress);
  await withTransaction(async (tx) => {
    const [operation] = await tx
      .select()
      .from(generationOperations)
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
      ))
      .limit(1)
      .for("update");
    if (!operation || operation.status !== "running") {
      throw new Error("Only the owned running operation can update progress");
    }
    const previous = operation.progress;
    if (previous) {
      assertGenerationOperationProgress(previous);
      if (
        input.progress.total < previous.total ||
        input.progress.completed < previous.completed ||
        input.progress.failed < previous.failed
      ) {
        throw new Error("Operation progress cannot move backwards");
      }
      const previousSteps = new Map(previous.steps.map((step) => [step.stepKey, step.status]));
      for (const step of input.progress.steps) {
        const prior = previousSteps.get(step.stepKey);
        if ((prior === "completed" || prior === "failed") && step.status !== prior) {
          throw new Error("A terminal operation step cannot change state");
        }
      }
    }
    await tx
      .update(generationOperations)
      .set({ phase: input.phase, progress: input.progress })
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.status, "running"),
      ));
  });
}

/** Rebuild the bounded parent summary from durable child rows. The parent row
 * is locked while children are read, so parallel slot settlement cannot make
 * the public summary regress or lose a sibling's terminal state. */
export async function syncGenerationOperationProgress(operationId: string): Promise<void> {
  assertOperationIdentity(operationId);
  await withTransaction(async (tx) => {
    const [operation] = await tx
      .select()
      .from(generationOperations)
      .where(eq(generationOperations.id, operationId))
      .limit(1)
      .for("update");
    if (!operation || operation.status !== "running") return;
    const children = await tx
      .select()
      .from(generations)
      .where(eq(generations.operationId, operationId));
    const newestByStep = new Map<string, Generation>();
    for (const child of children) {
      if (!child.stepKey) continue;
      const current = newestByStep.get(child.stepKey);
      if (!current || child.id > current.id) newestByStep.set(child.stepKey, child);
    }
    const steps = Array.from(newestByStep.values())
      .sort((a, b) => a.id - b.id)
      .map((child) => ({
        stepKey: child.stepKey!,
        viewAngle: child.viewAngle,
        status: child.status as GenerationOperationChildStatus,
      }));
    const progress: GenerationOperationProgress = {
      total: steps.length,
      completed: steps.filter((step) => step.status === "completed").length,
      failed: steps.filter((step) => step.status === "failed").length,
      steps,
    };
    assertGenerationOperationProgress(progress);
    await tx
      .update(generationOperations)
      .set({ progress })
      .where(and(
        eq(generationOperations.id, operationId),
        eq(generationOperations.status, "running"),
      ));
  });
}

/** Bind the model created by a model.create operation without allowing a
 * running receipt to be rebound to a different row. */
export async function bindGenerationOperationModel(input: {
  userId: number;
  operationId: string;
  modelId: number;
}): Promise<void> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  assertPositiveId(input.modelId, "modelId");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const bound = await db
    .update(generationOperations)
    .set({ modelId: input.modelId })
    .where(and(
      eq(generationOperations.id, input.operationId),
      eq(generationOperations.userId, input.userId),
      eq(generationOperations.status, "running"),
      isNull(generationOperations.modelId),
    ));
  if (affectedRows(bound) === 1) return;
  const operation = await getOperationForUser(input.userId, input.operationId);
  if (operation?.status === "running" && operation.modelId === input.modelId) return;
  throw new Error("Generation operation model binding lost its state race");
}

/** Structural/authorization truth may change after the resource lock is won.
 * Seal that claimed operation as a free failure and release its lock together. */
export async function finalizeClaimedGenerationOperationFailure(input: {
  userId: number;
  operationId: string;
  errorCode: string;
  publicMessage: string;
}): Promise<void> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  if (!/^[A-Z_]{2,32}$/.test(input.errorCode)) throw new TypeError("Invalid public error code");
  const publicMessage = input.publicMessage.trim();
  if (!publicMessage) throw new TypeError("Public failure message is required");
  await stopOperationHeartbeat(input.operationId);
  await withTransaction(async (tx) => {
    const finalized = await tx
      .update(generationOperations)
      .set({
        status: "failed",
        errorCode: input.errorCode,
        publicMessage,
        chargedCredits: 0,
        refundedCredits: 0,
        completedAt: new Date(),
      })
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.status, "claimed"),
      ));
    if (affectedRows(finalized) !== 1) {
      throw new Error("Claimed operation failure finalization lost its state race");
    }
    await tx.delete(generationOperationLocks).where(eq(generationOperationLocks.operationId, input.operationId));
  });
}

/** If even a free, pre-start refusal cannot be durably recorded, seal the
 * claimed receipt and retain its lock for support review. Releasing the lock
 * here would let a second writer run while the first outcome is unknown. */
export async function markClaimedGenerationOperationRecoveryRequired(input: {
  userId: number;
  operationId: string;
  publicMessage: string;
}): Promise<void> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  const publicMessage = input.publicMessage.trim();
  if (!publicMessage) throw new TypeError("Recovery message is required");
  await stopOperationHeartbeat(input.operationId);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const marked = await db
    .update(generationOperations)
    .set({
      status: "recovery_required",
      errorCode: "INTERNAL_SERVER_ERROR",
      publicMessage,
      chargedCredits: 0,
      refundedCredits: 0,
    })
    .where(and(
      eq(generationOperations.id, input.operationId),
      eq(generationOperations.userId, input.userId),
      eq(generationOperations.status, "claimed"),
    ));
  if (affectedRows(marked) !== 1) {
    throw new Error("Claimed operation recovery mark lost its state race");
  }
  // Deliberately retain any operation lock: support must adjudicate this row.
}

async function loadRunningOperation(
  tx: TransactionHandle,
  userId: number,
  operationId: string,
): Promise<GenerationOperation> {
  const operation = await getOperationForUser(userId, operationId, tx);
  if (!operation) throw new Error("Generation operation not found");
  if (operation.status !== "running") throw new Error("Only a running operation can be finalized");
  return operation;
}

function assertTotalsFitPlan(operation: GenerationOperation, chargedCredits: number): void {
  if (chargedCredits > operation.plannedCredits) {
    throw new Error("Operation charged credits exceed its server-planned total");
  }
}

export async function finalizeGenerationOperationSuccess(input: {
  userId: number;
  operationId: string;
  result: unknown;
  chargedCredits: number;
  refundedCredits: number;
  terminalStatus?: "partial" | "succeeded";
}): Promise<Extract<GenerationOperationOutcome, { type: "replay_success" }>> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  assertPublicOperationResult(input.result);
  assertCreditConservation(input.chargedCredits, input.refundedCredits);
  const terminalStatus = input.terminalStatus ?? "succeeded";
  if (terminalStatus !== "partial" && terminalStatus !== "succeeded") {
    throw new TypeError("Invalid successful terminal operation status");
  }
  const heartbeatFailure = await stopOperationHeartbeat(input.operationId);
  if (heartbeatFailure) throw new Error("Operation heartbeat failed before success finalization", { cause: heartbeatFailure });

  await withTransaction(async (tx) => {
    const operation = await loadRunningOperation(tx, input.userId, input.operationId);
    assertTotalsFitPlan(operation, input.chargedCredits);
    const finalized = await tx
      .update(generationOperations)
      .set({
        status: terminalStatus,
        result: input.result,
        errorCode: null,
        publicMessage: null,
        chargedCredits: input.chargedCredits,
        refundedCredits: input.refundedCredits,
        completedAt: new Date(),
      })
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.status, "running"),
      ));
    if (affectedRows(finalized) !== 1) throw new Error("Generation operation success finalization lost its state race");
    await tx.delete(generationOperationLocks).where(eq(generationOperationLocks.operationId, input.operationId));
  });
  return { type: "replay_success", operationId: input.operationId, result: input.result };
}

export async function finalizeGenerationOperationFailure(input: {
  userId: number;
  operationId: string;
  errorCode: string;
  publicMessage: string;
  chargedCredits: number;
  refundedCredits: number;
}): Promise<Extract<GenerationOperationOutcome, { type: "replay_failure" }>> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  assertCreditConservation(input.chargedCredits, input.refundedCredits);
  if (!/^[A-Z_]{2,32}$/.test(input.errorCode)) throw new TypeError("Invalid public error code");
  const publicMessage = input.publicMessage.trim();
  if (!publicMessage) throw new TypeError("Public failure message is required");
  const heartbeatFailure = await stopOperationHeartbeat(input.operationId);
  if (heartbeatFailure) throw new Error("Operation heartbeat failed before failure finalization", { cause: heartbeatFailure });

  await withTransaction(async (tx) => {
    const operation = await loadRunningOperation(tx, input.userId, input.operationId);
    assertTotalsFitPlan(operation, input.chargedCredits);
    const finalized = await tx
      .update(generationOperations)
      .set({
        status: "failed",
        result: null,
        errorCode: input.errorCode,
        publicMessage,
        chargedCredits: input.chargedCredits,
        refundedCredits: input.refundedCredits,
        completedAt: new Date(),
      })
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.status, "running"),
      ));
    if (affectedRows(finalized) !== 1) throw new Error("Generation operation failure finalization lost its state race");
    await tx.delete(generationOperationLocks).where(eq(generationOperationLocks.operationId, input.operationId));
  });
  return {
    type: "replay_failure",
    operationId: input.operationId,
    errorCode: input.errorCode,
    publicMessage,
  };
}

export async function markGenerationOperationRecoveryRequired(input: {
  userId: number;
  operationId: string;
  publicMessage: string;
  chargedCredits: number;
  refundedCredits: number;
}): Promise<Extract<GenerationOperationOutcome, { type: "recovery_required" }>> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  assertCreditConservation(input.chargedCredits, input.refundedCredits);
  const publicMessage = input.publicMessage.trim();
  if (!publicMessage) throw new TypeError("Recovery message is required");
  await stopOperationHeartbeat(input.operationId);

  await withTransaction(async (tx) => {
    const operation = await loadRunningOperation(tx, input.userId, input.operationId);
    assertTotalsFitPlan(operation, input.chargedCredits);
    const marked = await tx
      .update(generationOperations)
      .set({
        status: "recovery_required",
        errorCode: "INTERNAL_SERVER_ERROR",
        publicMessage,
        chargedCredits: input.chargedCredits,
        refundedCredits: input.refundedCredits,
      })
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.status, "running"),
      ));
    if (affectedRows(marked) !== 1) throw new Error("Generation operation recovery mark lost its state race");
    // Deliberately no lock delete. Recovery-required work remains sealed.
  });
  return { type: "recovery_required", operationId: input.operationId, publicMessage };
}

export async function getGenerationOperationOutcome(
  userId: number,
  operationId: string,
): Promise<GenerationOperationOutcome | null> {
  assertPositiveId(userId, "userId");
  assertOperationIdentity(operationId);
  const operation = await getOperationForUser(userId, operationId);
  return operation ? outcomeFromExisting(operation) : null;
}
