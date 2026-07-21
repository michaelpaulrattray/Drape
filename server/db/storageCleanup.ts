/**
 * R7-5B storage-cleanup manifest persistence.
 *
 * These helpers are deliberately not routed and never call storage. R7-5C
 * creates a manifest inside its deletion transaction; R7-5D later owns the
 * lease/worker state machine.
 */
import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import {
  storageCleanupBatches,
  storageCleanupItems,
  type StorageCleanupBatch,
  type StorageCleanupItem,
} from "../../drizzle/schema";
import type { TransactionHandle } from "./connection";
import { getDb, withTransaction } from "./connection";
import {
  buildStorageCleanupManifest,
  assertStorageCleanupCounts,
  type StorageCleanupManifest,
} from "../casting/storageCleanupContract";

export interface ClaimedStorageCleanupBatch {
  batch: StorageCleanupBatch;
  leaseToken: string;
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) return Number((result[0] as { affectedRows?: unknown })?.affectedRows ?? 0);
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

export async function createStorageCleanupManifestIn(
  tx: TransactionHandle,
  input: Parameters<typeof buildStorageCleanupManifest>[0],
): Promise<StorageCleanupManifest> {
  const manifest = buildStorageCleanupManifest(input);
  await tx.insert(storageCleanupBatches).values({
    id: manifest.id,
    userId: manifest.userId,
    operationId: manifest.operationId,
    kind: manifest.kind,
    status: "pending",
    expectedCount: manifest.expectedCount,
    deletedCount: 0,
    failedCount: 0,
  });
  if (manifest.storageKeys.length > 0) {
    await tx.insert(storageCleanupItems).values(
      manifest.storageKeys.map((storageKey) => ({
        batchId: manifest.id,
        storageKey,
        status: "pending" as const,
        attempts: 0,
      })),
    );
  }
  return manifest;
}

export async function getStorageCleanupBatchByOperation(
  userId: number,
  operationId: string,
): Promise<StorageCleanupBatch | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [batch] = await db
    .select()
    .from(storageCleanupBatches)
    .where(and(
      eq(storageCleanupBatches.userId, userId),
      eq(storageCleanupBatches.operationId, operationId),
    ))
    .limit(1);
  return batch ?? null;
}

export async function getStorageCleanupItemsForBatch(
  batchId: string,
): Promise<StorageCleanupItem[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(storageCleanupItems)
    .where(eq(storageCleanupItems.batchId, batchId))
    .orderBy(asc(storageCleanupItems.id));
}

/** Claim one due batch. An expired lease is the only crash-recovery signal;
 * item rows left processing by the old owner are returned to pending. */
export async function claimNextStorageCleanupBatch(input: {
  leaseToken: string;
  now: Date;
  leaseExpiresAt: Date;
}): Promise<ClaimedStorageCleanupBatch | null> {
  return withTransaction(async (tx) => {
    const [batch] = await tx
      .select()
      .from(storageCleanupBatches)
      .where(or(
        eq(storageCleanupBatches.status, "pending"),
        and(
          eq(storageCleanupBatches.status, "processing"),
          or(
            isNull(storageCleanupBatches.leaseExpiresAt),
            lte(storageCleanupBatches.leaseExpiresAt, input.now),
          ),
        ),
      ))
      .orderBy(asc(storageCleanupBatches.createdAt))
      .limit(1)
      .for("update");
    if (!batch) return null;
    const claimed = await tx
      .update(storageCleanupBatches)
      .set({
        status: "processing",
        leaseToken: input.leaseToken,
        leaseExpiresAt: input.leaseExpiresAt,
        heartbeatAt: input.now,
        attemptedAt: input.now,
      })
      .where(and(
        eq(storageCleanupBatches.id, batch.id),
        or(
          eq(storageCleanupBatches.status, "pending"),
          and(
            eq(storageCleanupBatches.status, "processing"),
            or(
              isNull(storageCleanupBatches.leaseExpiresAt),
              lte(storageCleanupBatches.leaseExpiresAt, input.now),
            ),
          ),
        ),
      ));
    if (affectedRows(claimed) !== 1) return null;
    await tx
      .update(storageCleanupItems)
      .set({ status: "pending", nextAttemptAt: null })
      .where(and(
        eq(storageCleanupItems.batchId, batch.id),
        eq(storageCleanupItems.status, "processing"),
      ));
    return {
      batch: {
        ...batch,
        status: "processing",
        leaseToken: input.leaseToken,
        leaseExpiresAt: input.leaseExpiresAt,
        heartbeatAt: input.now,
        attemptedAt: input.now,
      },
      leaseToken: input.leaseToken,
    };
  });
}

export async function renewStorageCleanupLease(input: {
  batchId: string;
  leaseToken: string;
  now: Date;
  leaseExpiresAt: Date;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const renewed = await db
    .update(storageCleanupBatches)
    .set({ heartbeatAt: input.now, leaseExpiresAt: input.leaseExpiresAt })
    .where(and(
      eq(storageCleanupBatches.id, input.batchId),
      eq(storageCleanupBatches.status, "processing"),
      eq(storageCleanupBatches.leaseToken, input.leaseToken),
    ));
  return affectedRows(renewed) === 1;
}

export async function claimNextStorageCleanupItem(input: {
  batchId: string;
  leaseToken: string;
  now: Date;
}): Promise<(StorageCleanupItem & { attempts: number }) | null> {
  return withTransaction(async (tx) => {
    const [batch] = await tx
      .select({ id: storageCleanupBatches.id })
      .from(storageCleanupBatches)
      .where(and(
        eq(storageCleanupBatches.id, input.batchId),
        eq(storageCleanupBatches.status, "processing"),
        eq(storageCleanupBatches.leaseToken, input.leaseToken),
      ))
      .limit(1)
      .for("update");
    if (!batch) return null;
    const [item] = await tx
      .select()
      .from(storageCleanupItems)
      .where(and(
        eq(storageCleanupItems.batchId, input.batchId),
        eq(storageCleanupItems.status, "pending"),
        or(
          isNull(storageCleanupItems.nextAttemptAt),
          lte(storageCleanupItems.nextAttemptAt, input.now),
        ),
      ))
      .orderBy(asc(storageCleanupItems.id))
      .limit(1)
      .for("update");
    if (!item) return null;
    const attempts = item.attempts + 1;
    const claimed = await tx
      .update(storageCleanupItems)
      .set({ status: "processing", attempts, nextAttemptAt: null })
      .where(and(
        eq(storageCleanupItems.id, item.id),
        eq(storageCleanupItems.batchId, input.batchId),
        eq(storageCleanupItems.status, "pending"),
      ));
    return affectedRows(claimed) === 1 ? { ...item, status: "processing", attempts } : null;
  });
}

export async function settleStorageCleanupItemSuccess(input: {
  batchId: string;
  itemId: number;
  leaseToken: string;
}): Promise<void> {
  await withTransaction(async (tx) => {
    const [batch] = await tx
      .select({ id: storageCleanupBatches.id })
      .from(storageCleanupBatches)
      .where(and(
        eq(storageCleanupBatches.id, input.batchId),
        eq(storageCleanupBatches.status, "processing"),
        eq(storageCleanupBatches.leaseToken, input.leaseToken),
      ))
      .limit(1)
      .for("update");
    if (!batch) throw new Error("Storage-cleanup lease was lost before success settlement");
    const removed = await tx
      .delete(storageCleanupItems)
      .where(and(
        eq(storageCleanupItems.id, input.itemId),
        eq(storageCleanupItems.batchId, input.batchId),
        eq(storageCleanupItems.status, "processing"),
      ));
    if (affectedRows(removed) !== 1) throw new Error("Storage-cleanup item success lost its state race");
    const incremented = await tx
      .update(storageCleanupBatches)
      .set({ deletedCount: sql`${storageCleanupBatches.deletedCount} + 1` })
      .where(eq(storageCleanupBatches.id, input.batchId));
    if (affectedRows(incremented) !== 1) throw new Error("Storage-cleanup batch count update failed");
  });
}

export async function settleStorageCleanupItemFailure(input: {
  batchId: string;
  itemId: number;
  leaseToken: string;
  errorCode: string;
  retryAt: Date | null;
}): Promise<void> {
  await withTransaction(async (tx) => {
    const [batch] = await tx
      .select({ id: storageCleanupBatches.id })
      .from(storageCleanupBatches)
      .where(and(
        eq(storageCleanupBatches.id, input.batchId),
        eq(storageCleanupBatches.status, "processing"),
        eq(storageCleanupBatches.leaseToken, input.leaseToken),
      ))
      .limit(1)
      .for("update");
    if (!batch) throw new Error("Storage-cleanup lease was lost before failure settlement");
    const terminal = input.retryAt === null;
    const settled = await tx
      .update(storageCleanupItems)
      .set({
        status: terminal ? "failed" : "pending",
        nextAttemptAt: input.retryAt,
        lastErrorCode: input.errorCode.slice(0, 64),
      })
      .where(and(
        eq(storageCleanupItems.id, input.itemId),
        eq(storageCleanupItems.batchId, input.batchId),
        eq(storageCleanupItems.status, "processing"),
      ));
    if (affectedRows(settled) !== 1) throw new Error("Storage-cleanup item failure lost its state race");
  });
}

export async function finalizeStorageCleanupBatch(input: {
  batchId: string;
  leaseToken: string;
  now: Date;
}): Promise<StorageCleanupBatch> {
  return withTransaction(async (tx) => {
    const [batch] = await tx
      .select()
      .from(storageCleanupBatches)
      .where(and(
        eq(storageCleanupBatches.id, input.batchId),
        eq(storageCleanupBatches.status, "processing"),
        eq(storageCleanupBatches.leaseToken, input.leaseToken),
      ))
      .limit(1)
      .for("update");
    if (!batch) throw new Error("Storage-cleanup lease was lost before batch settlement");
    const items = await tx
      .select()
      .from(storageCleanupItems)
      .where(eq(storageCleanupItems.batchId, input.batchId))
      .orderBy(asc(storageCleanupItems.id))
      .for("update");
    const failedCount = items.filter((item) => item.status === "failed").length;
    const unsettled = items.filter((item) => item.status !== "failed");
    if (batch.deletedCount + items.length !== batch.expectedCount) {
      throw new Error("Storage-cleanup manifest count conservation failed");
    }
    const status = unsettled.length > 0
      ? "processing" as const
      : failedCount > 0
        ? (batch.deletedCount > 0 ? "partial" as const : "failed" as const)
        : "succeeded" as const;
    assertStorageCleanupCounts({
      status,
      expectedCount: batch.expectedCount,
      deletedCount: batch.deletedCount,
      failedCount,
    });
    const dueAt = unsettled.reduce<Date | null>((earliest, item) => {
      const candidate = item.nextAttemptAt ?? input.now;
      return !earliest || candidate < earliest ? candidate : earliest;
    }, null);
    const finalized = await tx
      .update(storageCleanupBatches)
      .set({
        status,
        failedCount,
        leaseToken: null,
        leaseExpiresAt: status === "processing" ? dueAt : null,
        heartbeatAt: input.now,
      })
      .where(and(
        eq(storageCleanupBatches.id, input.batchId),
        eq(storageCleanupBatches.leaseToken, input.leaseToken),
      ));
    if (affectedRows(finalized) !== 1) throw new Error("Storage-cleanup batch settlement lost its state race");
    return {
      ...batch,
      status,
      failedCount,
      leaseToken: null,
      leaseExpiresAt: status === "processing" ? dueAt : null,
      heartbeatAt: input.now,
    };
  });
}

export async function getStorageCleanupHealth(now = new Date()): Promise<{
  pendingBatches: number;
  processingBatches: number;
  succeededBatches: number;
  partialBatches: number;
  failedBatches: number;
  retainedFailedItems: number;
  staleLeases: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const batches = await db.select({
    status: storageCleanupBatches.status,
    leaseToken: storageCleanupBatches.leaseToken,
    leaseExpiresAt: storageCleanupBatches.leaseExpiresAt,
  })
    .from(storageCleanupBatches);
  const failedItems = await db.select({ id: storageCleanupItems.id }).from(storageCleanupItems)
    .where(eq(storageCleanupItems.status, "failed"));
  return {
    pendingBatches: batches.filter((row) => row.status === "pending").length,
    processingBatches: batches.filter((row) => row.status === "processing").length,
    succeededBatches: batches.filter((row) => row.status === "succeeded").length,
    partialBatches: batches.filter((row) => row.status === "partial").length,
    failedBatches: batches.filter((row) => row.status === "failed").length,
    retainedFailedItems: failedItems.length,
    staleLeases: batches.filter((row) =>
      row.status === "processing"
      && row.leaseToken !== null
      && row.leaseExpiresAt !== null
      && row.leaseExpiresAt <= now
    ).length,
  };
}

export async function inspectStorageCleanupReconciliation(): Promise<{
  batches: number;
  retainedItems: number;
  countMismatches: number;
  failedCountMismatches: number;
  succeededWithRetainedKeys: number;
  itemsWithoutBatch: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const batches = await db.select().from(storageCleanupBatches);
  const items = await db.select({
    id: storageCleanupItems.id,
    batchId: storageCleanupItems.batchId,
    status: storageCleanupItems.status,
  }).from(storageCleanupItems);
  const byBatch = new Map<string, typeof items>();
  for (const item of items) byBatch.set(item.batchId, [...(byBatch.get(item.batchId) ?? []), item]);
  const known = new Set(batches.map((batch) => batch.id));
  return {
    batches: batches.length,
    retainedItems: items.length,
    countMismatches: batches.filter((batch) =>
      batch.deletedCount + (byBatch.get(batch.id)?.length ?? 0) !== batch.expectedCount
    ).length,
    failedCountMismatches: batches.filter((batch) =>
      (byBatch.get(batch.id) ?? []).filter((item) => item.status === "failed").length !== batch.failedCount
    ).length,
    succeededWithRetainedKeys: batches.filter((batch) =>
      batch.status === "succeeded" && (byBatch.get(batch.id)?.length ?? 0) > 0
    ).length,
    itemsWithoutBatch: items.filter((item) => !known.has(item.batchId)).length,
  };
}

/** Explicit support repair: make terminal failed keys eligible again. */
export async function requeueFailedStorageCleanupBatch(input: {
  batchId: string;
  now?: Date;
}): Promise<number> {
  return withTransaction(async (tx) => {
    const [batch] = await tx.select().from(storageCleanupBatches)
      .where(eq(storageCleanupBatches.id, input.batchId)).limit(1).for("update");
    if (!batch || (batch.status !== "partial" && batch.status !== "failed")) return 0;
    const reset = await tx.update(storageCleanupItems).set({
      status: "pending",
      attempts: 0,
      nextAttemptAt: input.now ?? new Date(),
    }).where(and(
      eq(storageCleanupItems.batchId, input.batchId),
      eq(storageCleanupItems.status, "failed"),
    ));
    const count = affectedRows(reset);
    if (count > 0) {
      await tx.update(storageCleanupBatches).set({
        status: "processing",
        failedCount: 0,
        leaseToken: null,
        leaseExpiresAt: input.now ?? new Date(),
      }).where(eq(storageCleanupBatches.id, input.batchId));
    }
    return count;
  });
}
