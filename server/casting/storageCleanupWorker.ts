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
import {
  planNextEvidenceIngestionCleanup,
  settleCompletedEvidenceCleanups,
} from "../db/evidenceRecovery";
import { createModuleLogger } from "../logging/logger";
import { sweepStaleGenerationOperations } from "./operationRecovery";
import { getConfiguredPrivateEvidenceStorageAdapter } from "./evidence/privateEvidenceStorage";
import {
  expireNextReadyEvidenceCandidate,
  settleNextCompletedCandidateCleanup,
  settleNextCompletedIntentOnlyCleanup,
  settleNextCompletedSupersededAttemptCleanup,
} from "../db/evidenceCandidates";
import { settleNextCompletedEvidenceForkCleanup } from "./evidence/evidenceFork";

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

type StorageCleanupHealth = Awaited<ReturnType<typeof getStorageCleanupHealth>>;

export function storageCleanupHealthRequiresAttention(
  health: StorageCleanupHealth,
): boolean {
  return Boolean(
    health.partialBatches
    || health.failedBatches
    || health.staleLeases
    || health.cleanupPendingEvidenceReceipts
    || health.failedEvidenceManifests
    || health.pendingPrivateBatches
    || (
      health.oldestNonAttachedEvidenceAgeMs !== null
      && health.oldestNonAttachedEvidenceAgeMs >= 15 * 60 * 1000
    ),
  );
}

/**
 * SAY IT WHEN IT CHANGES, AND ONCE AN HOUR OTHERWISE.
 *
 * The health counts are CUMULATIVE — `failedBatches` is every batch that has
 * ever failed — so a single historic failure made this warn every 60 seconds
 * forever. It did: two days of identical lines reading `failedBatches: 5`, at
 * `warn`, in production. Nobody read the fifth one, which is the point. An
 * alert ignored for a week is invariant 7 with a schedule, and the cost was
 * real — those five batches were the founder's diagnostic frames failing to
 * delete, and the noise is why it took a log sweep looking for something else
 * to notice.
 *
 * So: a line when the picture CHANGES, a heartbeat at most hourly while it
 * stays bad, and — the half that is easy to forget — **a line when it clears**.
 * Silence after a warning is ambiguous between "fixed" and "the worker died";
 * saying so out loud is what makes the quiet trustworthy.
 */
type HealthReportState = { fingerprint: string; at: number; wasBad: boolean };
const healthReport: HealthReportState = { fingerprint: "", at: 0, wasBad: false };
export const STORAGE_CLEANUP_HEALTH_HEARTBEAT_MS = 60 * 60 * 1000;

export function reportStorageCleanupHealth(
  health: StorageCleanupHealth,
  now: number = Date.now(),
  sink: { warn: typeof log.warn; info: typeof log.info } = log,
): "logged" | "suppressed" | "recovered" {
  const bad = storageCleanupHealthRequiresAttention(health);
  if (!bad) {
    if (!healthReport.wasBad) return "suppressed";
    healthReport.wasBad = false;
    healthReport.fingerprint = "";
    healthReport.at = now;
    sink.info(health, "[StorageCleanup] cleanup health is clear again");
    return "recovered";
  }
  /* The counts that decide the verdict, not the whole object: a timestamp or a
     millisecond age drifting by one would make every sweep look like a change
     and put us straight back to a line a minute. */
  const fingerprint = JSON.stringify([
    health.partialBatches, health.failedBatches, health.staleLeases,
    health.cleanupPendingEvidenceReceipts, health.failedEvidenceManifests,
    health.pendingPrivateBatches, health.retainedFailedItems,
  ]);
  const changed = fingerprint !== healthReport.fingerprint;
  const stale = now - healthReport.at >= STORAGE_CLEANUP_HEALTH_HEARTBEAT_MS;
  if (!changed && !stale) return "suppressed";
  healthReport.fingerprint = fingerprint;
  healthReport.at = now;
  healthReport.wasBad = true;
  sink.warn(
    { ...health, why: changed ? "changed" : "hourly heartbeat" },
    "[StorageCleanup] cleanup health requires attention",
  );
  return "logged";
}

/** For tests, which must not inherit a previous case's memo. */
export function resetStorageCleanupHealthReport(): void {
  healthReport.fingerprint = "";
  healthReport.at = 0;
  healthReport.wasBad = false;
}

export async function processNextStorageCleanupBatch(input: {
  now?: Date;
  clock?: () => Date;
  leaseMs?: number;
  maxAttempts?: number;
  deleteObject?: (storageKey: string) => Promise<StorageDeleteResult>;
  deletePrivateObject?: (storageKey: string) => Promise<StorageDeleteResult>;
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
  const deletePublicObject = input.deleteObject ?? storageDelete;
  const configuredPrivateAdapter = input.deletePrivateObject
    ? null
    : getConfiguredPrivateEvidenceStorageAdapter();
  const deletePrivateObject = input.deletePrivateObject
    ?? (configuredPrivateAdapter
      ? (storageKey: string) => configuredPrivateAdapter.deleteExact(storageKey)
      : null);
  const leaseToken = randomUUID();
  const claimed = await claimNextStorageCleanupBatch({
    leaseToken,
    now,
    leaseExpiresAt: new Date(now.getTime() + leaseMs),
    privateEvidenceAvailable: deletePrivateObject !== null,
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
      result = item.storageBackend === "private_evidence_r2"
        ? await deletePrivateObject!(item.storageKey)
        : await deletePublicObject(item.storageKey);
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
      // Evidence receipts use a shorter recovery window than the generic
      // operation sweeper. Free-fail stale operation authority first, then
      // manifest at most one exact evidence key for deletion.
      await sweepStaleGenerationOperations({ limit: 5 });
      await planNextEvidenceIngestionCleanup();
      await settleCompletedEvidenceCleanups({ limit: 10 });
      await settleNextCompletedEvidenceForkCleanup();
      if (process.env.ENABLE_EVIDENCE_CANDIDATE_WORKER === "true") {
        await expireNextReadyEvidenceCandidate();
        await settleNextCompletedSupersededAttemptCleanup();
        await settleNextCompletedCandidateCleanup();
        await settleNextCompletedIntentOnlyCleanup();
      }
      const result = await processNextStorageCleanupBatch();
      if (result.claimed) log.info(result, "[StorageCleanup] bounded batch processed");
      await settleCompletedEvidenceCleanups({ limit: 10 });
      await settleNextCompletedEvidenceForkCleanup();
      if (process.env.ENABLE_EVIDENCE_CANDIDATE_WORKER === "true") {
        await settleNextCompletedSupersededAttemptCleanup();
        await settleNextCompletedCandidateCleanup();
        await settleNextCompletedIntentOnlyCleanup();
      }
      const health = await getStorageCleanupHealth();
      reportStorageCleanupHealth(health);
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
