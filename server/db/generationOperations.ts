import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import {
  boardItems,
  boardItemVersions,
  boards,
  generations,
  generationOperationLocks,
  generationOperations,
  modelAssets,
  modelIdentitySnapshots,
  modelPackageSnapshots,
  models,
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
  type GenerationOperationLandingStatus,
} from "../casting/operationContract";
import { createModuleLogger } from "../logging/logger";
import { getDb, withTransaction, type TransactionHandle } from "./connection";
import { fillEmptyCastNodeWithVersionIn } from "./boards";
import { assertOwnedAvailableModelIn } from "./modelReferenceFence";
import { isModelAvailableStatus, isModelDraftStatus } from "../../shared/modelLifecycle";
import type { BoardItemCanvasMetadata, Provenance } from "../../shared/boardTypes";

const log = createModuleLogger("db/generationOperations");
export const DEFAULT_GENERATION_OPERATION_LEASE_MS = 15 * 60 * 1000;
const DEFAULT_GENERATION_OPERATION_HEARTBEAT_MS = 30 * 1000;

type ActiveHeartbeat = {
  timer: ReturnType<typeof setInterval>;
  failure: unknown | null;
  inFlight: Promise<void> | null;
};

const activeHeartbeats = new Map<string, ActiveHeartbeat>();
const RECENT_OPERATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const DRAFT_AUTO_NAME = "Draft Model";

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
  if (operation.subjectDeletedAt) {
    return { type: "deleted_subject", operationId: operation.id };
  }
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

async function loadOperationChildren(
  operationIds: string[],
  tx?: TransactionHandle,
): Promise<Map<string, Generation[]>> {
  const grouped = new Map<string, Generation[]>();
  if (operationIds.length === 0) return grouped;
  const db = tx ?? await getDb();
  if (!db) return grouped;
  const rows = await db
    .select()
    .from(generations)
    .where(inArray(generations.operationId, operationIds))
    .orderBy(generations.id);
  for (const row of rows) {
    if (!row.operationId) continue;
    const children = grouped.get(row.operationId) ?? [];
    children.push(row);
    grouped.set(row.operationId, children);
  }
  return grouped;
}

export async function getPublicGenerationOperation(
  userId: number,
  operationId: string,
): Promise<PublicGenerationOperation | null> {
  assertPositiveId(userId, "userId");
  assertOperationIdentity(operationId);
  const operation = await getOperationForUser(userId, operationId);
  if (!operation || operation.subjectDeletedAt) return null;
  const children = await loadOperationChildren([operation.id]);
  return toPublicGenerationOperation(operation, children.get(operation.id) ?? []);
}

export async function getRecentPublicGenerationOperation(input: {
  userId: number;
  clientRequestId: string;
}): Promise<PublicGenerationOperation | null> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.clientRequestId);
  const db = await getDb();
  if (!db) return null;
  const [operation] = await db
    .select()
    .from(generationOperations)
    .where(and(
      eq(generationOperations.userId, input.userId),
      eq(generationOperations.clientRequestId, input.clientRequestId),
    ))
    .limit(1);
  if (!operation || operation.subjectDeletedAt) return null;
  const children = await loadOperationChildren([operation.id]);
  return toPublicGenerationOperation(operation, children.get(operation.id) ?? []);
}

export async function listActivePublicGenerationOperations(input: {
  userId: number;
  boardId?: number;
  modelId?: number;
  now?: Date;
  limit?: number;
}): Promise<PublicGenerationOperation[]> {
  assertPositiveId(input.userId, "userId");
  assertOptionalPositiveId(input.boardId, "boardId");
  assertOptionalPositiveId(input.modelId, "modelId");
  const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
  const recentSince = new Date((input.now ?? new Date()).getTime() - RECENT_OPERATION_WINDOW_MS);
  const db = await getDb();
  if (!db) return [];
  const filters = [
    eq(generationOperations.userId, input.userId),
    isNull(generationOperations.subjectDeletedAt),
    or(
      inArray(generationOperations.status, ["claimed", "running", "recovery_required"]),
      and(
        inArray(generationOperations.status, ["partial", "succeeded", "failed"]),
        isNull(generationOperations.landingAcknowledgedAt),
        gte(generationOperations.completedAt, recentSince),
      ),
    )!,
  ];
  if (input.boardId !== undefined) filters.push(eq(generationOperations.originBoardId, input.boardId));
  if (input.modelId !== undefined) filters.push(eq(generationOperations.modelId, input.modelId));
  const operations = await db
    .select()
    .from(generationOperations)
    .where(and(...filters))
    .orderBy(
      sql`CASE WHEN ${generationOperations.status} IN ('claimed', 'running', 'recovery_required') THEN 0 ELSE 1 END`,
      desc(generationOperations.createdAt),
    )
    .limit(limit);
  const children = await loadOperationChildren(operations.map((operation) => operation.id));
  return operations.map((operation) =>
    toPublicGenerationOperation(operation, children.get(operation.id) ?? [])
  );
}

export type AcknowledgeGenerationOperationResult =
  | { type: "acknowledged"; operation: PublicGenerationOperation; acknowledgedNow: boolean }
  | { type: "not_found" }
  | { type: "not_terminal" }
  | { type: "landing_required" };

export async function acknowledgeGenerationOperation(input: {
  userId: number;
  operationId: string;
  now?: Date;
}): Promise<AcknowledgeGenerationOperationResult> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  const outcome = await withTransaction(async (tx) => {
    const [operation] = await tx
      .select()
      .from(generationOperations)
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
      ))
      .limit(1)
      .for("update");
    if (!operation) return "not_found" as const;
    if (operation.status === "claimed" || operation.status === "running" || operation.status === "recovery_required") {
      return "not_terminal" as const;
    }
    if (operation.landingStatus === "pending" || operation.landingStatus === "relink_required") {
      return "landing_required" as const;
    }
    if (!operation.landingAcknowledgedAt) {
      const acknowledged = await tx
        .update(generationOperations)
        .set({ landingAcknowledgedAt: input.now ?? new Date() })
        .where(and(
          eq(generationOperations.id, operation.id),
          eq(generationOperations.userId, input.userId),
          isNull(generationOperations.landingAcknowledgedAt),
        ));
      return affectedRows(acknowledged) === 1 ? "acknowledged_now" as const : "already_acknowledged" as const;
    }
    return "already_acknowledged" as const;
  });
  if (outcome === "not_found" || outcome === "not_terminal" || outcome === "landing_required") {
    return { type: outcome };
  }
  const operation = await getPublicGenerationOperation(input.userId, input.operationId);
  if (!operation) return { type: "not_found" };
  return { type: "acknowledged", operation, acknowledgedNow: outcome === "acknowledged_now" };
}

function operationResultIdentity(result: unknown): {
  modelId: number;
  assetId: number | null;
  imageUrl: string | null;
} | null {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const record = result as Record<string, unknown>;
  const modelId = record.modelId;
  if (!Number.isSafeInteger(modelId) || (modelId as number) <= 0) return null;
  const assetId = Number.isSafeInteger(record.assetId) && (record.assetId as number) > 0
    ? record.assetId as number
    : null;
  const imageUrl = typeof record.imageUrl === "string" && record.imageUrl.trim()
    ? record.imageUrl
    : null;
  if (!assetId && !imageUrl) return null;
  return { modelId: modelId as number, assetId, imageUrl };
}

function boardMetadata(value: unknown): BoardItemCanvasMetadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as BoardItemCanvasMetadata
    : {};
}

export type LandGenerationOperationResult =
  | { type: "landed"; operation: PublicGenerationOperation; landedNow: boolean }
  | { type: "relink_required"; operation: PublicGenerationOperation }
  | { type: "not_found" }
  | { type: "not_terminal" }
  | { type: "landing_not_required" }
  | { type: "invalid_result" };

export type DismissGenerationOperationLandingResult =
  | { type: "dismissed"; operation: PublicGenerationOperation; dismissedNow: boolean }
  | { type: "not_found" }
  | { type: "not_terminal" }
  | { type: "landing_not_required" };

/** Deliberately keep a completed result in Models without placing it. This is
 * an acknowledgement, not deletion: the model/assets and operation receipt
 * remain durable and no credit/provider path is reachable. */
export async function dismissGenerationOperationLanding(input: {
  userId: number;
  operationId: string;
  now?: Date;
}): Promise<DismissGenerationOperationLandingResult> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  const outcome = await withTransaction(async (tx) => {
    const [operation] = await tx
      .select()
      .from(generationOperations)
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
      ))
      .limit(1)
      .for("update");
    if (!operation) return "not_found" as const;
    if (operation.status !== "partial" && operation.status !== "succeeded") {
      return "not_terminal" as const;
    }
    if (operation.landingStatus === "dismissed") return "already_dismissed" as const;
    if (operation.landingStatus !== "pending" && operation.landingStatus !== "relink_required") {
      return "landing_not_required" as const;
    }
    const dismissed = await tx
      .update(generationOperations)
      .set({
        landingStatus: "dismissed",
        landedItemId: null,
        landingAcknowledgedAt: input.now ?? new Date(),
      })
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        inArray(generationOperations.landingStatus, ["pending", "relink_required"]),
      ));
    if (affectedRows(dismissed) !== 1) throw new Error("Operation dismissal lost its receipt race");
    return "dismissed_now" as const;
  });
  if (outcome === "not_found" || outcome === "not_terminal" || outcome === "landing_not_required") {
    return { type: outcome };
  }
  const operation = await getPublicGenerationOperation(input.userId, input.operationId);
  if (!operation) return { type: "not_found" };
  return { type: "dismissed", operation, dismissedNow: outcome === "dismissed_now" };
}

/** Free exactly-once operation landing. Both the receipt and target node are
 * locked before validation, and the node stamp/version/acknowledgement commit
 * together. No credit or provider module is reachable from this helper. */
export async function landGenerationOperationResult(input: {
  userId: number;
  operationId: string;
  boardId: number;
  itemId: number;
  now?: Date;
}): Promise<LandGenerationOperationResult> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  assertPositiveId(input.boardId, "boardId");
  assertPositiveId(input.itemId, "itemId");
  const now = input.now ?? new Date();
  const transactionResult = await withTransaction(async (tx) => {
    const [operation] = await tx
      .select()
      .from(generationOperations)
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
      ))
      .limit(1)
      .for("update");
    if (!operation) return "not_found" as const;
    if (operation.status !== "partial" && operation.status !== "succeeded") {
      return "not_terminal" as const;
    }
    if (operation.landingStatus === "landed") return { type: "landed" as const, landedNow: false };
    if (operation.landingStatus !== "pending" && operation.landingStatus !== "relink_required") {
      return "landing_not_required" as const;
    }

    const identity = operationResultIdentity(operation.result);
    if (!identity) return "invalid_result" as const;
    const { modelId } = identity;
    const [model] = await tx
      .select()
      .from(models)
      .where(and(eq(models.id, modelId), eq(models.userId, input.userId)))
      .limit(1)
      .for("update");
    if (!model || !isModelAvailableStatus(model.status)) return "invalid_result" as const;
    const assetFilters = [
      eq(modelAssets.modelId, modelId),
      eq(modelAssets.viewType, "frontClose"),
      identity.assetId
        ? eq(modelAssets.id, identity.assetId)
        : eq(modelAssets.storageUrl, identity.imageUrl!),
    ];
    const [asset] = await tx
      .select()
      .from(modelAssets)
      .where(and(...assetFilters))
      .orderBy(desc(modelAssets.id))
      .limit(1)
      .for("update");
    if (!asset?.storageUrl) return "invalid_result" as const;

    const isAutomaticOrigin =
      operation.originBoardId === input.boardId && operation.originItemId === input.itemId;
    const [board] = await tx
      .select({ id: boards.id })
      .from(boards)
      .where(and(
        eq(boards.id, input.boardId),
        eq(boards.userId, input.userId),
        eq(boards.status, "active"),
      ))
      .limit(1);
    if (!board) return "not_found" as const;
    const draft = isModelDraftStatus(model.status);
    const honestName = draft && model.name === DRAFT_AUTO_NAME ? null : model.name;
    const fill = await fillEmptyCastNodeWithVersionIn(tx, {
      boardId: input.boardId,
      itemId: input.itemId,
      modelId,
      build: (item) => {
        const provenance: Provenance = {
          type: "library_cast",
          modelId,
          viewAngle: "frontClose",
          ...(draft ? { draft: true } : {}),
        };
        const metadata: BoardItemCanvasMetadata = {
          ...boardMetadata(item.metadata),
          provenance,
          status: null,
          isGenerating: false,
          version: 1,
        };
        return {
          update: {
            imageUrl: asset.storageUrl,
            label: honestName || item.label || null,
            metadata,
            sourceModelId: modelId,
          },
          version: { imageUrl: asset.storageUrl, tool: "initial" },
        };
      },
    });
    let exactOriginAlreadyLanded = false;
    if (fill === "not_empty" && isAutomaticOrigin) {
      const [existingItem] = await tx
        .select()
        .from(boardItems)
        .where(and(eq(boardItems.id, input.itemId), eq(boardItems.boardId, input.boardId)))
        .limit(1);
      const provenance = boardMetadata(existingItem?.metadata).provenance;
      const [matchingVersion] = existingItem
        ? await tx
          .select({ id: boardItemVersions.id })
          .from(boardItemVersions)
          .where(and(
            eq(boardItemVersions.itemId, existingItem.id),
            eq(boardItemVersions.imageUrl, asset.storageUrl),
          ))
          .limit(1)
        : [];
      exactOriginAlreadyLanded = !!existingItem &&
        existingItem.deletedAt === null &&
        existingItem.sourceModelId === modelId &&
        existingItem.imageUrl === asset.storageUrl &&
        !!provenance &&
        "modelId" in provenance &&
        provenance.modelId === modelId &&
        !!matchingVersion;
    }
    if (fill !== "filled" && !exactOriginAlreadyLanded) {
      if (fill === "not_found" && !isAutomaticOrigin) return "not_found" as const;
      await tx
        .update(generationOperations)
        .set({ landingStatus: "relink_required", landedItemId: null })
        .where(and(
          eq(generationOperations.id, operation.id),
          eq(generationOperations.userId, input.userId),
        ));
      return { type: "relink_required" as const };
    }
    const landed = await tx
      .update(generationOperations)
      .set({
        landingStatus: "landed",
        landedItemId: input.itemId,
        landingAcknowledgedAt: now,
      })
      .where(and(
        eq(generationOperations.id, operation.id),
        eq(generationOperations.userId, input.userId),
        inArray(generationOperations.landingStatus, ["pending", "relink_required"]),
      ));
    if (affectedRows(landed) !== 1) throw new Error("Operation landing lost its receipt race");
    return { type: "landed" as const, landedNow: true };
  });

  if (
    typeof transactionResult === "string"
  ) return { type: transactionResult };
  const operation = await getPublicGenerationOperation(input.userId, input.operationId);
  if (!operation) return { type: "not_found" };
  return transactionResult.type === "landed"
    ? { type: "landed", operation, landedNow: transactionResult.landedNow }
    : { type: "relink_required", operation };
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
  // A pre-deletion request id keeps its durable receipt, but deletion marks it
  // subjectDeletedAt. Classify that receipt before consulting the model row so
  // replay can refuse without exposing the old saved result.
  const [preexisting] = await db
    .select()
    .from(generationOperations)
    .where(and(
      eq(generationOperations.userId, input.userId),
      eq(generationOperations.clientRequestId, input.clientRequestId),
    ))
    .limit(1);
  if (preexisting) {
    if (preexisting.subjectDeletedAt) return outcomeFromExisting(preexisting);
    if (preexisting.kind !== input.kind || preexisting.payloadHash !== payloadHash) {
      return { type: "payload_conflict", operationId: preexisting.id };
    }
    return outcomeFromExisting(preexisting);
  }
  try {
    const values = {
      id: operationId,
      userId: input.userId,
      clientRequestId: input.clientRequestId,
      kind: input.kind,
      modelId: input.modelId ?? null,
      originBoardId: input.originBoardId ?? null,
      originItemId: input.originItemId ?? null,
      payloadHash,
      status: "claimed" as const,
    };
    if (input.modelId != null) {
      await withTransaction(async (tx) => {
        await assertOwnedAvailableModelIn(tx, { modelId: input.modelId!, userId: input.userId });
        await tx.insert(generationOperations).values(values);
      });
    } else {
      await db.insert(generationOperations).values(values);
    }
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

    const effectiveModelId = input.modelId ?? operation.modelId;
    let expectedStateVersion: number | null = null;
    let expectedPackageSnapshotId: string | null = null;
    let expectedIdentitySnapshotId: string | null = null;
    if (effectiveModelId != null) {
      const [model] = await tx
        .select({
          id: models.id,
          stateVersion: models.stateVersion,
          currentPackageSnapshotId: models.currentPackageSnapshotId,
        })
        .from(models)
        .where(and(
          eq(models.id, effectiveModelId),
          eq(models.userId, input.userId),
          ne(models.status, "archived"),
          isNull(models.deletedAt),
        ))
        .limit(1)
        .for("update");
      if (!model) throw new Error("Generation operation model is no longer available");
      expectedStateVersion = model.stateVersion;
      expectedPackageSnapshotId = model.currentPackageSnapshotId;
      if (model.currentPackageSnapshotId) {
        if (model.stateVersion <= 0) {
          throw new Error("Generation operation model snapshot pointer and state version disagree");
        }
        const [snapshot] = await tx
          .select({ identitySnapshotId: modelIdentitySnapshots.id })
          .from(modelPackageSnapshots)
          .innerJoin(
            modelIdentitySnapshots,
            and(
              eq(modelIdentitySnapshots.id, modelPackageSnapshots.identitySnapshotId),
              eq(modelIdentitySnapshots.modelId, effectiveModelId),
            ),
          )
          .where(and(
            eq(modelPackageSnapshots.id, model.currentPackageSnapshotId),
            eq(modelPackageSnapshots.modelId, effectiveModelId),
          ))
          .limit(1);
        if (!snapshot) throw new Error("Generation operation model snapshot head is invalid");
        expectedIdentitySnapshotId = snapshot.identitySnapshotId;
      } else if (model.stateVersion !== 0) {
        throw new Error("Generation operation model snapshot pointer and state version disagree");
      }
    }

    const started = await tx
      .update(generationOperations)
      .set({
        status: "running",
        modelId: effectiveModelId,
        expectedIdentityRevisionId: input.expectedIdentityRevisionId ?? null,
        expectedStateVersion,
        expectedIdentitySnapshotId,
        expectedPackageSnapshotId,
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

/**
 * Re-resolve the model's snapshot head after the running receipt captured it
 * and before a paid executor begins. The operation's model lock is the
 * concurrency fence; this read proves the receipt still names the exact
 * state/package/identity head the executor is about to spend against.
 */
export async function assertGenerationOperationSnapshotHead(input: {
  userId: number;
  operationId: string;
  modelId: number;
}): Promise<void> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  assertPositiveId(input.modelId, "modelId");
  await withTransaction(async (tx) => {
    const operation = await getOperationForUser(input.userId, input.operationId, tx);
    if (
      !operation
      || operation.status !== "running"
      || operation.modelId !== input.modelId
    ) {
      throw new Error("Generation operation is not running for this model");
    }

    const lockKey = modelOperationLockKey(input.modelId);
    const [lock] = await tx
      .select({ operationId: generationOperationLocks.operationId })
      .from(generationOperationLocks)
      .where(eq(generationOperationLocks.lockKey, lockKey))
      .limit(1);
    if (lock?.operationId !== input.operationId) {
      throw new Error("Generation operation no longer owns the model lock");
    }

    const [model] = await tx
      .select({
        stateVersion: models.stateVersion,
        currentPackageSnapshotId: models.currentPackageSnapshotId,
      })
      .from(models)
      .where(and(
        eq(models.id, input.modelId),
        eq(models.userId, input.userId),
        ne(models.status, "archived"),
        isNull(models.deletedAt),
      ))
      .limit(1);
    if (!model) throw new Error("Generation operation model is no longer available");

    let identitySnapshotId: string | null = null;
    if (model.currentPackageSnapshotId) {
      const [head] = await tx
        .select({ identitySnapshotId: modelPackageSnapshots.identitySnapshotId })
        .from(modelPackageSnapshots)
        .where(and(
          eq(modelPackageSnapshots.id, model.currentPackageSnapshotId),
          eq(modelPackageSnapshots.modelId, input.modelId),
        ))
        .limit(1);
      if (!head) throw new Error("Generation operation model snapshot head is invalid");
      identitySnapshotId = head.identitySnapshotId;
    }

    if (
      operation.expectedStateVersion !== model.stateVersion
      || (operation.expectedPackageSnapshotId ?? null) !== (model.currentPackageSnapshotId ?? null)
      || (operation.expectedIdentitySnapshotId ?? null) !== identitySnapshotId
    ) {
      throw new Error("Generation operation model snapshot head changed before execution");
    }
  });
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
  await withTransaction(async (tx) => {
    // A newly-created model can become visible before this receipt is bound.
    // Lock/fence it here so deletion either sees the bound running operation
    // and refuses, or commits first and makes this binding fail NOT_FOUND.
    await assertOwnedAvailableModelIn(tx, { modelId: input.modelId, userId: input.userId });
    const bound = await tx
      .update(generationOperations)
      .set({ modelId: input.modelId })
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.status, "running"),
        isNull(generationOperations.modelId),
      ));
    if (affectedRows(bound) === 1) return;
    const operation = await getOperationForUser(input.userId, input.operationId, tx);
    if (operation?.status === "running" && operation.modelId === input.modelId) return;
    throw new Error("Generation operation model binding lost its state race");
  });
}

/** A free pre-start request may be fulfilled without generation (for example,
 * a typed clarification question). Persist the public result so a transport
 * retry replays the same answer instead of re-running classification. */
export async function finalizeClaimedGenerationOperationSuccess(input: {
  userId: number;
  operationId: string;
  result: unknown;
}): Promise<void> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  assertPublicOperationResult(input.result);
  await stopOperationHeartbeat(input.operationId);
  await withTransaction(async (tx) => {
    const finalized = await tx
      .update(generationOperations)
      .set({
        status: "succeeded",
        result: input.result,
        errorCode: null,
        publicMessage: null,
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
      throw new Error("Claimed operation success finalization lost its state race");
    }
    await tx.delete(generationOperationLocks).where(eq(generationOperationLocks.operationId, input.operationId));
  });
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
  landing?: {
    status: GenerationOperationLandingStatus;
    landedItemId?: number | null;
    acknowledgedAt?: Date | null;
  };
}): Promise<Extract<GenerationOperationOutcome, { type: "replay_success" }>> {
  assertPositiveId(input.userId, "userId");
  assertOperationIdentity(input.operationId);
  assertPublicOperationResult(input.result);
  assertCreditConservation(input.chargedCredits, input.refundedCredits);
  const terminalStatus = input.terminalStatus ?? "succeeded";
  if (terminalStatus !== "partial" && terminalStatus !== "succeeded") {
    throw new TypeError("Invalid successful terminal operation status");
  }
  if (input.landing) {
    assertGenerationOperationLandingStatus(input.landing.status);
    assertOptionalPositiveId(input.landing.landedItemId, "landedItemId");
    if (input.landing.status === "landed" && !input.landing.landedItemId) {
      throw new TypeError("A landed operation requires its board item id");
    }
    if (input.landing.status !== "landed" && input.landing.landedItemId) {
      throw new TypeError("Only a landed operation can record a board item id");
    }
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
        ...(input.landing ? {
          landingStatus: input.landing.status,
          landedItemId: input.landing.landedItemId ?? null,
          landingAcknowledgedAt: input.landing.acknowledgedAt ?? null,
        } : {}),
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
