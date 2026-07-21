import { randomUUID } from "node:crypto";
import { storageDelete } from "../storage";
import {
  claimNextStorageCleanupBatch,
  claimNextStorageCleanupItem,
  finalizeStorageCleanupBatch,
  getStorageCleanupHealth,
  renewStorageCleanupLease,
  settleStorageCleanupItemFailure,
  settleStorageCleanupItemSuccess,
} from "../db/storageCleanup";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("casting/storageCleanupWorker");
const DEFAULT_LEASE_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 5;

export interface StorageDeleteResult {
  success: boolean;
  errorCode?: string;
  retryable?: boolean;
}

export function storageCleanupRetryDelayMs(attempt: number): number {
  const schedule = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
  return schedule[Math.min(Math.max(attempt - 1, 0), schedule.length - 1)];
}

export async function processNextStorageCleanupBatch(input: {
  now?: Date;
  clock?: () => Date;
  leaseMs?: number;
  maxAttempts?: number;
  deleteObject?: (storageKey: string) => Promise<StorageDeleteResult>;
} = {}): Promise<{
  claimed: boolean;
  batchId?: string;
  deleted: number;
  retried: number;
  failed: number;
  status?: "processing" | "succeeded" | "partial" | "failed";
}> {
  const clock = input.clock ?? (() => new Date());
  const now = input.now ?? clock();
  const leaseMs = input.leaseMs ?? DEFAULT_LEASE_MS;
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) throw new TypeError("leaseMs must be positive");
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts <= 0) throw new TypeError("maxAttempts must be positive");
  const deleteObject = input.deleteObject ?? storageDelete;
  const leaseToken = randomUUID();
  const claimed = await claimNextStorageCleanupBatch({
    leaseToken,
    now,
    leaseExpiresAt: new Date(now.getTime() + leaseMs),
  });
  if (!claimed) return { claimed: false, deleted: 0, retried: 0, failed: 0 };

  let deleted = 0;
  let retried = 0;
  let failed = 0;
  while (true) {
    const heartbeatAt = input.now ?? clock();
    if (!await renewStorageCleanupLease({
      batchId: claimed.batch.id,
      leaseToken,
      now: heartbeatAt,
      leaseExpiresAt: new Date(heartbeatAt.getTime() + leaseMs),
    })) {
      throw new Error("Storage-cleanup worker lost its batch lease");
    }
    const item = await claimNextStorageCleanupItem({
      batchId: claimed.batch.id,
      leaseToken,
      now: heartbeatAt,
    });
    if (!item) break;
    let result: StorageDeleteResult;
    try {
      result = await deleteObject(item.storageKey);
    } catch (error) {
      result = {
        success: false,
        errorCode: error instanceof Error ? error.name : "STORAGE_DELETE_THROW",
        retryable: true,
      };
    }
    if (result.success) {
      await settleStorageCleanupItemSuccess({ batchId: claimed.batch.id, itemId: item.id, leaseToken });
      deleted += 1;
      continue;
    }
    const terminal = result.retryable === false || item.attempts >= maxAttempts;
    const settledAt = input.now ?? clock();
    await settleStorageCleanupItemFailure({
      batchId: claimed.batch.id,
      itemId: item.id,
      leaseToken,
      errorCode: result.errorCode ?? "STORAGE_DELETE_FAILED",
      retryAt: terminal ? null : new Date(settledAt.getTime() + storageCleanupRetryDelayMs(item.attempts)),
    });
    if (terminal) failed += 1;
    else retried += 1;
  }
  const batch = await finalizeStorageCleanupBatch({
    batchId: claimed.batch.id,
    leaseToken,
    now: input.now ?? clock(),
  });
  if (batch.status === "pending") throw new Error("A claimed cleanup batch cannot return to pending");
  if (batch.status === "partial" || batch.status === "failed") {
    log.error({
      batchId: batch.id,
      status: batch.status,
      expectedCount: batch.expectedCount,
      deletedCount: batch.deletedCount,
      failedCount: batch.failedCount,
    }, "[StorageCleanup] batch requires support repair");
  }
  return { claimed: true, batchId: batch.id, deleted, retried, failed, status: batch.status };
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;
let sweepRunning = false;

export function startStorageCleanupWorker(): void {
  if (process.env.ENABLE_STORAGE_CLEANUP_WORKER !== "true" || sweepTimer) return;
  const run = async () => {
    if (sweepRunning) return;
    sweepRunning = true;
    try {
      const result = await processNextStorageCleanupBatch();
      if (result.claimed) log.info(result, "[StorageCleanup] bounded batch processed");
      const health = await getStorageCleanupHealth();
      if (health.partialBatches || health.failedBatches || health.staleLeases) {
        log.warn(health, "[StorageCleanup] cleanup health requires attention");
      }
    } catch (error) {
      log.error({ err: error }, "[StorageCleanup] worker sweep failed safely");
    } finally {
      sweepRunning = false;
    }
  };
  const startup = setTimeout(run, 60_000);
  startup.unref?.();
  sweepTimer = setInterval(run, 60_000);
  sweepTimer.unref?.();
}
