import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  generationOperationLocks,
  generationOperations,
  type GenerationOperation,
} from "../../drizzle/schema";
import {
  assertCreditConservation,
  assertGenerationOperationKind,
  assertOperationLockKey,
  assertPublicOperationResult,
  boardItemOperationLockKey,
  type GenerationOperationKind,
  type GenerationOperationOutcome,
  hashGenerationOperationClaim,
  modelOperationLockKey,
  operationChargeReference,
} from "../casting/operationContract";
import { createModuleLogger } from "../logging/logger";
import { getDb, withTransaction, type TransactionHandle } from "./connection";

const log = createModuleLogger("db/generationOperations");
const DEFAULT_LEASE_MS = 15 * 60 * 1000;

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
  const leaseMs = input.leaseMs ?? DEFAULT_LEASE_MS;
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
}): Promise<{ operationId: string; chargeReferenceId: string }> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  assertOptionalPositiveId(input.modelId, "modelId");
  if (!Number.isSafeInteger(input.plannedCredits) || input.plannedCredits < 0) {
    throw new TypeError("plannedCredits must be a non-negative integer");
  }
  if (input.requiredLockKey) assertOperationLockKey(input.requiredLockKey);
  const chargeReferenceId = operationChargeReference(input.operationId);

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
      })
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.status, "claimed"),
      ));
    if (affectedRows(started) !== 1) throw new Error("Generation operation start lost its state race");
  });

  return { operationId: input.operationId, chargeReferenceId };
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
}): Promise<Extract<GenerationOperationOutcome, { type: "replay_success" }>> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  assertPublicOperationResult(input.result);
  assertCreditConservation(input.chargedCredits, input.refundedCredits);

  await withTransaction(async (tx) => {
    const operation = await loadRunningOperation(tx, input.userId, input.operationId);
    assertTotalsFitPlan(operation, input.chargedCredits);
    const finalized = await tx
      .update(generationOperations)
      .set({
        status: "succeeded",
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
