import { randomUUID } from "node:crypto";
import {
  STORAGE_CLEANUP_BATCH_KINDS,
  STORAGE_CLEANUP_BATCH_STATUSES,
  STORAGE_CLEANUP_BACKENDS,
  STORAGE_CLEANUP_ITEM_STATUSES,
  type StorageCleanupBatchKind,
  type StorageCleanupBatchStatus,
  type StorageCleanupBackend,
  type StorageCleanupItemStatus,
} from "../../drizzle/schema";
import { normalizeOwnedStorageKey } from "./deletionAudit";
import { assertClientRequestId } from "../../shared/clientRequestId";

export interface StorageCleanupManifest {
  id: string;
  userId: number;
  operationId: string;
  kind: StorageCleanupBatchKind;
  storageItems: StorageCleanupManifestItem[];
  expectedCount: number;
}

export interface StorageCleanupManifestItem {
  storageKey: string;
  storageBackend: StorageCleanupBackend;
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

export function assertStorageCleanupBackend(value: unknown): asserts value is StorageCleanupBackend {
  if (!STORAGE_CLEANUP_BACKENDS.includes(value as StorageCleanupBackend)) {
    throw new TypeError("Unknown storage-cleanup backend");
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

export function normalizeCleanupManifestItems(
  storageItems: readonly {
    storageKey: unknown;
    storageBackend: unknown;
  }[],
): StorageCleanupManifestItem[] {
  const items = new Map<string, StorageCleanupManifestItem>();
  for (const candidate of storageItems) {
    assertStorageCleanupBackend(candidate.storageBackend);
    const key = normalizeOwnedStorageKey(candidate.storageKey);
    if (!key || key.length > 512) {
      throw new TypeError("Storage-cleanup manifests require normalized keys of at most 512 characters");
    }
    const item = {
      storageKey: key,
      storageBackend: candidate.storageBackend,
    };
    items.set(`${item.storageBackend}\0${item.storageKey}`, item);
  }
  return Array.from(items.values()).sort((left, right) =>
    left.storageBackend.localeCompare(right.storageBackend)
    || left.storageKey.localeCompare(right.storageKey)
  );
}

export function buildStorageCleanupManifest(input: {
  id?: string;
  userId: number;
  operationId: string;
  kind: StorageCleanupBatchKind;
  storageItems: readonly {
    storageKey: unknown;
    storageBackend: unknown;
  }[];
}): StorageCleanupManifest {
  assertPositiveInteger(input.userId, "userId");
  assertClientRequestId(input.operationId);
  assertStorageCleanupBatchKind(input.kind);
  const id = input.id ?? randomUUID();
  assertClientRequestId(id);
  const storageItems = normalizeCleanupManifestItems(input.storageItems);
  return {
    id,
    userId: input.userId,
    operationId: input.operationId,
    kind: input.kind,
    storageItems,
    expectedCount: storageItems.length,
  };
}
