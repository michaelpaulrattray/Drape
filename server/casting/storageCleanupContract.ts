import { randomUUID } from "node:crypto";
import {
  STORAGE_CLEANUP_BATCH_KINDS,
  STORAGE_CLEANUP_BATCH_STATUSES,
  STORAGE_CLEANUP_ITEM_STATUSES,
  type StorageCleanupBatchKind,
  type StorageCleanupBatchStatus,
  type StorageCleanupItemStatus,
} from "../../drizzle/schema";
import { normalizeOwnedStorageKey } from "./deletionAudit";
import { assertClientRequestId } from "../../shared/clientRequestId";

export interface StorageCleanupManifest {
  id: string;
  userId: number;
  operationId: string;
  kind: StorageCleanupBatchKind;
  storageKeys: string[];
  expectedCount: number;
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
}

function assertNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
}

export function assertStorageCleanupBatchKind(value: unknown): asserts value is StorageCleanupBatchKind {
  if (!STORAGE_CLEANUP_BATCH_KINDS.includes(value as StorageCleanupBatchKind)) {
    throw new TypeError("Unknown storage-cleanup batch kind");
  }
}

export function assertStorageCleanupBatchStatus(value: unknown): asserts value is StorageCleanupBatchStatus {
  if (!STORAGE_CLEANUP_BATCH_STATUSES.includes(value as StorageCleanupBatchStatus)) {
    throw new TypeError("Unknown storage-cleanup batch status");
  }
}

export function assertStorageCleanupItemStatus(value: unknown): asserts value is StorageCleanupItemStatus {
  if (!STORAGE_CLEANUP_ITEM_STATUSES.includes(value as StorageCleanupItemStatus)) {
    throw new TypeError("Unknown storage-cleanup item status");
  }
}

export function assertStorageCleanupCounts(input: {
  status: StorageCleanupBatchStatus;
  expectedCount: number;
  deletedCount: number;
  failedCount: number;
}): void {
  assertStorageCleanupBatchStatus(input.status);
  assertNonNegativeInteger(input.expectedCount, "expectedCount");
  assertNonNegativeInteger(input.deletedCount, "deletedCount");
  assertNonNegativeInteger(input.failedCount, "failedCount");
  if (input.deletedCount + input.failedCount > input.expectedCount) {
    throw new TypeError("Storage-cleanup settled counts exceed the manifest total");
  }
  if (input.status === "pending" && (input.deletedCount !== 0 || input.failedCount !== 0)) {
    throw new TypeError("A pending storage-cleanup batch cannot have settled items");
  }
  if (
    input.status === "succeeded" &&
    (input.deletedCount !== input.expectedCount || input.failedCount !== 0)
  ) {
    throw new TypeError("A succeeded storage-cleanup batch must delete every item");
  }
  if (
    input.status === "partial" &&
    (input.failedCount === 0 || input.deletedCount + input.failedCount !== input.expectedCount)
  ) {
    throw new TypeError("A partial storage-cleanup batch must settle with at least one failure");
  }
}

export function normalizeCleanupManifestKeys(storageKeys: readonly unknown[]): string[] {
  const keys = new Set<string>();
  for (const candidate of storageKeys) {
    const key = normalizeOwnedStorageKey(candidate);
    if (!key || key.length > 512) {
      throw new TypeError("Storage-cleanup manifests require normalized keys of at most 512 characters");
    }
    keys.add(key);
  }
  return Array.from(keys).sort();
}

export function buildStorageCleanupManifest(input: {
  id?: string;
  userId: number;
  operationId: string;
  kind: StorageCleanupBatchKind;
  storageKeys: readonly unknown[];
}): StorageCleanupManifest {
  assertPositiveInteger(input.userId, "userId");
  assertClientRequestId(input.operationId);
  assertStorageCleanupBatchKind(input.kind);
  const id = input.id ?? randomUUID();
  assertClientRequestId(id);
  const storageKeys = normalizeCleanupManifestKeys(input.storageKeys);
  return {
    id,
    userId: input.userId,
    operationId: input.operationId,
    kind: input.kind,
    storageKeys,
    expectedCount: storageKeys.length,
  };
}
