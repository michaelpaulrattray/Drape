/**
 * R7-5B storage-cleanup manifest persistence.
 *
 * These helpers are deliberately not routed and never call storage. R7-5C
 * creates a manifest inside its deletion transaction; R7-5D later owns the
 * lease/worker state machine.
 */
import { and, asc, eq } from "drizzle-orm";
import {
  storageCleanupBatches,
  storageCleanupItems,
  type StorageCleanupBatch,
  type StorageCleanupItem,
} from "../../drizzle/schema";
import type { TransactionHandle } from "./connection";
import { getDb } from "./connection";
import {
  buildStorageCleanupManifest,
  type StorageCleanupManifest,
} from "../casting/storageCleanupContract";

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
