import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lt,
  notExists,
} from "drizzle-orm";
import {
  castingEvidenceIngestions,
  generationOperations,
  storageCleanupBatches,
  storageCleanupItems,
  type CastingEvidenceIngestion,
  type StorageCleanupBatch,
} from "../../drizzle/schema";
import { parseEvidenceStorageKey } from "../casting/evidence/evidenceDelivery";
import { createStorageCleanupManifestIn } from "./storageCleanup";
import { withTransaction, type TransactionHandle } from "./connection";

export const EVIDENCE_INGESTION_RECOVERY_WINDOW_MS = 10 * 60 * 1000;
const ACTIVE_OPERATION_STATUSES = [
  "claimed",
  "running",
  "recovery_required",
] as const;

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return Number((result[0] as { affectedRows?: unknown })?.affectedRows ?? 0);
  }
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

function assertReceiptKey(receipt: CastingEvidenceIngestion): void {
  const parsed = parseEvidenceStorageKey(receipt.storageKey);
  const expectedKind = receipt.purpose === "reference_plate" ? "plate" : "crop";
  if (
    parsed.userId !== receipt.userId
    || parsed.modelId !== receipt.modelId
    || parsed.kind !== expectedKind
  ) {
    throw new Error("Evidence cleanup receipt key ownership is invalid");
  }
}

async function existingEvidenceCleanupBatchIn(
  tx: TransactionHandle,
  receipt: CastingEvidenceIngestion,
): Promise<StorageCleanupBatch | null> {
  const [batch] = await tx
    .select()
    .from(storageCleanupBatches)
    .where(eq(storageCleanupBatches.operationId, receipt.operationId))
    .limit(1)
    .for("update");
  if (!batch) return null;
  const items = await tx
    .select({
      storageKey: storageCleanupItems.storageKey,
      storageBackend: storageCleanupItems.storageBackend,
    })
    .from(storageCleanupItems)
    .where(eq(storageCleanupItems.batchId, batch.id))
    .for("update");
  if (
    batch.userId !== receipt.userId
    || batch.kind !== "evidence_cleanup"
    || batch.expectedCount !== 1
    || items.length !== 1
    || items[0]?.storageKey !== receipt.storageKey
    || items[0]?.storageBackend !== "private_evidence_r2"
  ) {
    throw new Error("Evidence cleanup operation is bound to another manifest");
  }
  return batch;
}

/**
 * Claim one aged, non-attached receipt after its operation is terminal (or
 * absent after a mixed-version crash), then atomically link one exact-key
 * evidence-cleanup manifest. Active/recovery-required operations are never
 * cleaned out from under replay or support.
 */
export async function planNextEvidenceIngestionCleanup(input: {
  now?: Date;
  recoveryWindowMs?: number;
} = {}): Promise<{
  receiptId: string;
  batchId: string;
  storageKey: string;
} | null> {
  const now = input.now ?? new Date();
  const recoveryWindowMs =
    input.recoveryWindowMs ?? EVIDENCE_INGESTION_RECOVERY_WINDOW_MS;
  if (
    !Number.isSafeInteger(recoveryWindowMs)
    || recoveryWindowMs <= 0
    || recoveryWindowMs >= 15 * 60 * 1000
  ) {
    throw new TypeError("Evidence recovery window must be positive and shorter than 15 minutes");
  }
  const staleBefore = new Date(now.getTime() - recoveryWindowMs);

  return withTransaction(async (tx) => {
    const activeOperation = tx
      .select({ id: generationOperations.id })
      .from(generationOperations)
      .where(and(
        eq(generationOperations.id, castingEvidenceIngestions.operationId),
        inArray(generationOperations.status, ACTIVE_OPERATION_STATUSES),
      ));
    const [receipt] = await tx
      .select()
      .from(castingEvidenceIngestions)
      .where(and(
        inArray(castingEvidenceIngestions.status, ["planned", "stored"]),
        isNull(castingEvidenceIngestions.cleanupBatchId),
        lt(castingEvidenceIngestions.updatedAt, staleBefore),
        notExists(activeOperation),
      ))
      .orderBy(asc(castingEvidenceIngestions.updatedAt))
      .limit(1)
      .for("update");
    if (!receipt) return null;
    assertReceiptKey(receipt);

    const existing = await existingEvidenceCleanupBatchIn(tx, receipt);
    const batch = existing ?? await createStorageCleanupManifestIn(tx, {
      id: randomUUID(),
      userId: receipt.userId,
      operationId: receipt.operationId,
      kind: "evidence_cleanup",
      storageItems: [{
        storageKey: receipt.storageKey,
        storageBackend: "private_evidence_r2",
      }],
    });
    const linked = await tx
      .update(castingEvidenceIngestions)
      .set({
        status: "cleanup_pending",
        cleanupBatchId: batch.id,
        cleanupQueuedAt: now,
      })
      .where(and(
        eq(castingEvidenceIngestions.id, receipt.id),
        eq(castingEvidenceIngestions.userId, receipt.userId),
        eq(castingEvidenceIngestions.modelId, receipt.modelId),
        eq(castingEvidenceIngestions.operationId, receipt.operationId),
        inArray(castingEvidenceIngestions.status, ["planned", "stored"]),
        isNull(castingEvidenceIngestions.cleanupBatchId),
        eq(castingEvidenceIngestions.storageKey, receipt.storageKey),
        eq(castingEvidenceIngestions.contentHash, receipt.contentHash),
      ));
    if (affectedRows(linked) !== 1) {
      throw new Error("Evidence cleanup receipt lost its planning race");
    }
    return {
      receiptId: receipt.id,
      batchId: batch.id,
      storageKey: receipt.storageKey,
    };
  });
}

/** Mark one linked receipt cleaned only after its exact-key batch succeeded. */
export async function settleNextCompletedEvidenceCleanup(): Promise<{
  receiptId: string;
  batchId: string;
} | null> {
  return withTransaction(async (tx) => {
    const [row] = await tx
      .select({
        receipt: castingEvidenceIngestions,
        batchId: storageCleanupBatches.id,
      })
      .from(castingEvidenceIngestions)
      .innerJoin(
        storageCleanupBatches,
        eq(storageCleanupBatches.id, castingEvidenceIngestions.cleanupBatchId),
      )
      .where(and(
        eq(castingEvidenceIngestions.status, "cleanup_pending"),
        eq(storageCleanupBatches.kind, "evidence_cleanup"),
        eq(storageCleanupBatches.status, "succeeded"),
      ))
      .orderBy(asc(castingEvidenceIngestions.cleanupQueuedAt))
      .limit(1)
      .for("update");
    if (!row) return null;
    const updated = await tx
      .update(castingEvidenceIngestions)
      .set({ status: "cleaned" })
      .where(and(
        eq(castingEvidenceIngestions.id, row.receipt.id),
        eq(castingEvidenceIngestions.userId, row.receipt.userId),
        eq(castingEvidenceIngestions.modelId, row.receipt.modelId),
        eq(castingEvidenceIngestions.operationId, row.receipt.operationId),
        eq(castingEvidenceIngestions.status, "cleanup_pending"),
        eq(castingEvidenceIngestions.cleanupBatchId, row.batchId),
        eq(castingEvidenceIngestions.storageKey, row.receipt.storageKey),
      ));
    if (affectedRows(updated) !== 1) {
      throw new Error("Evidence cleanup receipt lost its success race");
    }
    return { receiptId: row.receipt.id, batchId: row.batchId };
  });
}

export async function settleCompletedEvidenceCleanups(input: {
  limit?: number;
} = {}): Promise<number> {
  const limit = Math.max(1, Math.min(input.limit ?? 10, 100));
  let settled = 0;
  while (settled < limit && await settleNextCompletedEvidenceCleanup()) {
    settled += 1;
  }
  return settled;
}
