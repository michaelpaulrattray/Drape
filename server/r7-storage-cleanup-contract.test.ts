import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assertStorageCleanupBatchKind,
  assertStorageCleanupBatchStatus,
  assertStorageCleanupCounts,
  assertStorageCleanupItemStatus,
  buildStorageCleanupManifest,
  normalizeCleanupManifestKeys,
} from "./casting/storageCleanupContract";

describe("R7-5B storage-cleanup contract", () => {
  it("normalizes, deduplicates and sorts exact owned keys", () => {
    expect(normalizeCleanupManifestKeys([
      "/models/12/back.png",
      "models/12/head.png",
      " models/12/back.png ",
    ])).toEqual(["models/12/back.png", "models/12/head.png"]);
  });

  it.each([
    ["external URL", "https://example.com/model.png"],
    ["parent traversal", "models/12/../secret.png"],
    ["backslash", "models\\12\\head.png"],
    ["empty key", " / "],
    ["overlong key", `models/${"x".repeat(506)}`],
  ])("refuses an unsafe %s before it can become cleanup authority", (_label, key) => {
    expect(() => normalizeCleanupManifestKeys([key])).toThrow(
      "Storage-cleanup manifests require normalized keys",
    );
  });

  it("builds a count-bound manifest with strict UUID and owner inputs", () => {
    const operationId = randomUUID();
    const manifest = buildStorageCleanupManifest({
      userId: 41,
      operationId,
      kind: "model_delete",
      storageKeys: ["models/41/head.png", "models/41/head.png", "models/41/back.png"],
    });
    expect(manifest).toMatchObject({
      userId: 41,
      operationId,
      kind: "model_delete",
      expectedCount: 2,
      storageKeys: ["models/41/back.png", "models/41/head.png"],
    });
    expect(manifest.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(() => buildStorageCleanupManifest({
      userId: 0,
      operationId,
      kind: "model_delete",
      storageKeys: [],
    })).toThrow("userId must be a positive integer");
    expect(() => buildStorageCleanupManifest({
      userId: 41,
      operationId: "not-a-request-id",
      kind: "model_delete",
      storageKeys: [],
    })).toThrow();
  });

  it("keeps batch, item and count states inside their closed contracts", () => {
    for (const status of ["pending", "processing", "succeeded", "partial", "failed"] as const) {
      expect(() => assertStorageCleanupBatchStatus(status)).not.toThrow();
    }
    for (const status of ["pending", "processing", "succeeded", "failed"] as const) {
      expect(() => assertStorageCleanupItemStatus(status)).not.toThrow();
    }
    for (const kind of ["model_delete", "account_delete"] as const) {
      expect(() => assertStorageCleanupBatchKind(kind)).not.toThrow();
    }
    expect(() => assertStorageCleanupBatchStatus("complete")).toThrow();
    expect(() => assertStorageCleanupItemStatus("partial")).toThrow();
    expect(() => assertStorageCleanupBatchKind("url_delete")).toThrow();

    expect(() => assertStorageCleanupCounts({
      status: "pending", expectedCount: 2, deletedCount: 0, failedCount: 0,
    })).not.toThrow();
    expect(() => assertStorageCleanupCounts({
      status: "succeeded", expectedCount: 2, deletedCount: 2, failedCount: 0,
    })).not.toThrow();
    expect(() => assertStorageCleanupCounts({
      status: "partial", expectedCount: 2, deletedCount: 1, failedCount: 1,
    })).not.toThrow();
    expect(() => assertStorageCleanupCounts({
      status: "pending", expectedCount: 2, deletedCount: 1, failedCount: 0,
    })).toThrow("pending storage-cleanup batch");
    expect(() => assertStorageCleanupCounts({
      status: "succeeded", expectedCount: 2, deletedCount: 1, failedCount: 0,
    })).toThrow("delete every item");
    expect(() => assertStorageCleanupCounts({
      status: "partial", expectedCount: 2, deletedCount: 1, failedCount: 0,
    })).toThrow("at least one failure");
    expect(() => assertStorageCleanupCounts({
      status: "failed", expectedCount: 2, deletedCount: 2, failedCount: 1,
    })).toThrow("exceed the manifest total");
  });
});

describe("R7-5B migration 0009 shape", () => {
  it("is an additive seven-statement migration with no destructive SQL", async () => {
    const sql = await readFile(new URL("../drizzle/0009_final_cast_deletion.sql", import.meta.url), "utf8");
    const statements = sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean);
    expect(statements).toHaveLength(7);
    expect(statements.filter((statement) => /^CREATE TABLE/i.test(statement))).toHaveLength(2);
    expect(statements.filter((statement) => /^ALTER TABLE.+ ADD /is.test(statement))).toHaveLength(2);
    expect(statements.filter((statement) => /^CREATE INDEX/i.test(statement))).toHaveLength(3);
    expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE|RENAME)\b/i);
    expect(sql).toContain("ALTER TABLE `models` ADD `deletedAt` timestamp");
    expect(sql).toContain("ALTER TABLE `generation_operations` ADD `subjectDeletedAt` timestamp");
    expect(sql).toContain("CREATE INDEX `idx_board_items_source_model`");
  });

  it("changes the 0008 snapshot only by the approved columns, index and two tables", async () => {
    const before = JSON.parse(await readFile(
      new URL("../drizzle/meta/0008_snapshot.json", import.meta.url), "utf8",
    ));
    const after = JSON.parse(await readFile(
      new URL("../drizzle/meta/0009_snapshot.json", import.meta.url), "utf8",
    ));
    expect(after.prevId).toBe(before.id);
    expect(Object.keys(after.tables.storage_cleanup_batches.columns)).toEqual([
      "id", "userId", "operationId", "kind", "status", "expectedCount", "deletedCount",
      "failedCount", "leaseToken", "leaseExpiresAt", "heartbeatAt", "attemptedAt", "createdAt", "updatedAt",
    ]);
    expect(Object.keys(after.tables.storage_cleanup_items.columns)).toEqual([
      "id", "batchId", "storageKey", "status", "attempts", "nextAttemptAt", "lastErrorCode", "createdAt", "updatedAt",
    ]);
    expect(after.tables.models.columns.deletedAt).toMatchObject({ type: "timestamp", notNull: false });
    expect(after.tables.generation_operations.columns.subjectDeletedAt)
      .toMatchObject({ type: "timestamp", notNull: false });
    expect(after.tables.board_items.indexes.idx_board_items_source_model)
      .toEqual({ name: "idx_board_items_source_model", columns: ["sourceModelId"], isUnique: false });

    const expected = structuredClone(before);
    expected.id = after.id;
    expected.prevId = before.id;
    expected.tables.models.columns.deletedAt = after.tables.models.columns.deletedAt;
    expected.tables.generation_operations.columns.subjectDeletedAt =
      after.tables.generation_operations.columns.subjectDeletedAt;
    expected.tables.board_items.indexes.idx_board_items_source_model =
      after.tables.board_items.indexes.idx_board_items_source_model;
    expected.tables.storage_cleanup_batches = after.tables.storage_cleanup_batches;
    expected.tables.storage_cleanup_items = after.tables.storage_cleanup_items;
    expect(after).toEqual(expected);
  });
});
