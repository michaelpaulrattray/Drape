/**
 * Disposable-MySQL proof for R7-5D. Storage is always an injected fake; this
 * suite can never contact R2 and TEST_DATABASE_URL never falls back to prod.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const DB_TEST_TIMEOUT = 60_000;

describeWithDatabase("R7-5D leased storage cleanup (disposable DB)", () => {
  let connection: Connection;
  let userId: number;
  let cleanupDb: typeof import("./db/storageCleanup");
  let worker: typeof import("./casting/storageCleanupWorker");
  let accountDeletion: typeof import("./db/accountDeletion");
  let withTransaction: typeof import("./db/connection")["withTransaction"];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [columns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM storage_cleanup_batches LIKE 'leaseToken'",
    );
    if (columns.length !== 1) throw new Error("Disposable database must have migration 0009 applied");
    const [inserted] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'R7-5D Test', 1, 1)",
      [`r7-5d-${randomUUID()}`],
    );
    userId = inserted.insertId;
    cleanupDb = await import("./db/storageCleanup");
    worker = await import("./casting/storageCleanupWorker");
    accountDeletion = await import("./db/accountDeletion");
    ({ withTransaction } = await import("./db/connection"));
  }, DB_TEST_TIMEOUT);

  beforeEach(async () => {
    await connection.execute("DELETE FROM storage_cleanup_items");
    await connection.execute("DELETE FROM storage_cleanup_batches");
    await connection.execute("DELETE FROM generations WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM wardrobe_sessions WHERE userId = ?", [userId]);
    await connection.execute(
      "UPDATE users SET avatarUrl = NULL, avatarKey = NULL, bannerUrl = NULL, bannerKey = NULL WHERE id = ?",
      [userId],
    );
  }, DB_TEST_TIMEOUT);

  afterAll(async () => {
    if (!connection) return;
    await connection.execute("DELETE FROM storage_cleanup_items");
    await connection.execute("DELETE FROM storage_cleanup_batches");
    await connection.execute("DELETE FROM generations WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM wardrobe_sessions WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
    await connection.end();
    delete process.env.DATABASE_URL;
  }, DB_TEST_TIMEOUT);

  async function manifest(keys: string[]) {
    const operationId = randomUUID();
    return withTransaction((tx) => cleanupDb.createStorageCleanupManifestIn(tx, {
      userId,
      operationId,
      kind: "model_delete",
      storageKeys: keys,
    }));
  }

  async function batchById(id: string) {
    const [[row]] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM storage_cleanup_batches WHERE id = ?",
      [id],
    );
    return row;
  }

  it("deletes each exact manifest key once, purges keys and conserves counts", async () => {
    const created = await manifest(["models/a/head.png", "models/a/back.png", "models/a/head.png"]);
    const calls: string[] = [];
    const result = await worker.processNextStorageCleanupBatch({
      deleteObject: async (key) => { calls.push(key); return { success: true }; },
    });
    expect(result).toMatchObject({ claimed: true, batchId: created.id, deleted: 2, status: "succeeded" });
    expect(calls).toEqual(["models/a/back.png", "models/a/head.png"]);
    const stored = await batchById(created.id);
    expect(stored).toMatchObject({ status: "succeeded", expectedCount: 2, deletedCount: 2, failedCount: 0 });
    await expect(cleanupDb.getStorageCleanupItemsForBatch(created.id)).resolves.toEqual([]);
  }, DB_TEST_TIMEOUT);

  it("recovers a crash after object deletion by replaying the idempotent delete", async () => {
    const created = await manifest(["models/crash/head.png"]);
    const now = new Date("2026-07-21T00:00:00.000Z");
    const leaseToken = randomUUID();
    const claimed = await cleanupDb.claimNextStorageCleanupBatch({
      leaseToken,
      now,
      leaseExpiresAt: new Date(now.getTime() + 1_000),
    });
    expect(claimed?.batch.id).toBe(created.id);
    const item = await cleanupDb.claimNextStorageCleanupItem({ batchId: created.id, leaseToken, now });
    expect(item?.storageKey).toBe("models/crash/head.png");
    // Simulate: R2 accepted DeleteObject, then the process died before DB settlement.
    await connection.execute(
      "UPDATE storage_cleanup_batches SET leaseExpiresAt = '2020-01-01 00:00:00' WHERE id = ?",
      [created.id],
    );
    const calls: string[] = [];
    const replay = await worker.processNextStorageCleanupBatch({
      now: new Date("2030-07-21T00:00:00.000Z"),
      deleteObject: async (key) => { calls.push(key); return { success: true }; },
    });
    expect(replay.status).toBe("succeeded");
    expect(calls).toEqual(["models/crash/head.png"]);
    await expect(cleanupDb.getStorageCleanupItemsForBatch(created.id)).resolves.toEqual([]);
  }, DB_TEST_TIMEOUT);

  it("backs off transient failure, does not repeat early, then succeeds", async () => {
    const created = await manifest(["models/retry/head.png"]);
    const now = new Date("2026-07-21T01:00:00.000Z");
    const first = await worker.processNextStorageCleanupBatch({
      now,
      deleteObject: async () => ({ success: false, retryable: true, errorCode: "SlowDown" }),
    });
    expect(first).toMatchObject({ status: "processing", retried: 1 });
    await expect(worker.processNextStorageCleanupBatch({
      now: new Date(now.getTime() + 30_000),
      deleteObject: async () => ({ success: true }),
    })).resolves.toMatchObject({ claimed: false });
    const calls: string[] = [];
    const second = await worker.processNextStorageCleanupBatch({
      now: new Date(now.getTime() + 61_000),
      deleteObject: async (key) => { calls.push(key); return { success: true }; },
    });
    expect(second.status).toBe("succeeded");
    expect(calls).toEqual(["models/retry/head.png"]);
    expect((await batchById(created.id)).deletedCount).toBe(1);
  }, DB_TEST_TIMEOUT);

  it("retains only permanent failures for explicit support repair", async () => {
    const created = await manifest(["models/partial/good.png", "models/partial/forbidden.png"]);
    const first = await worker.processNextStorageCleanupBatch({
      deleteObject: async (key) => key.endsWith("good.png")
        ? { success: true }
        : { success: false, retryable: false, errorCode: "AccessDenied" },
    });
    expect(first.status).toBe("partial");
    expect(await batchById(created.id)).toMatchObject({ expectedCount: 2, deletedCount: 1, failedCount: 1 });
    await expect(cleanupDb.getStorageCleanupItemsForBatch(created.id)).resolves.toMatchObject([
      { storageKey: "models/partial/forbidden.png", status: "failed", lastErrorCode: "AccessDenied" },
    ]);
    await expect(cleanupDb.requeueFailedStorageCleanupBatch({ batchId: created.id })).resolves.toBe(1);
    await expect(cleanupDb.getStorageCleanupItemsForBatch(created.id)).resolves.toMatchObject([
      {
        storageKey: "models/partial/forbidden.png",
        status: "pending",
        attempts: 0,
        lastErrorCode: "AccessDenied",
      },
    ]);
    const repaired = await worker.processNextStorageCleanupBatch({
      deleteObject: async () => ({ success: true }),
    });
    expect(repaired.status).toBe("succeeded");
    expect(await batchById(created.id)).toMatchObject({ expectedCount: 2, deletedCount: 2, failedCount: 0 });
  }, DB_TEST_TIMEOUT);

  it("seals an empty manifest without storage calls", async () => {
    const created = await manifest([]);
    let calls = 0;
    const result = await worker.processNextStorageCleanupBatch({
      deleteObject: async () => { calls += 1; return { success: true }; },
    });
    expect(result).toMatchObject({ batchId: created.id, status: "succeeded", deleted: 0 });
    expect(calls).toBe(0);
  }, DB_TEST_TIMEOUT);

  it("account discovery includes model-less owned outputs and rejects external URLs", async () => {
    await connection.execute(
      "UPDATE users SET avatarKey = 'users/test/avatar.png', bannerUrl = 'https://external.example/banner.png' WHERE id = ?",
      [userId],
    );
    await connection.execute(
      "INSERT INTO generations (userId, modelId, type, status, pointsCost, resultUrl) VALUES (?, NULL, 'wardrobeVTO', 'completed', 1, ?), (?, NULL, 'wardrobeVTO', 'completed', 1, ?)",
      [userId, "https://owned.example/vto/result.png", userId, "https://external.example/vto/result.png"],
    );
    await connection.execute(
      "INSERT INTO wardrobe_sessions (userId, modelId, modelImageUrl, history) VALUES (?, NULL, ?, JSON_ARRAY(?, ?))",
      [userId, "https://owned.example/uploads/model.png", "https://owned.example/vto/history.png", "https://external.example/vto/shared.png"],
    );
    const keys = await withTransaction((tx) => accountDeletion.collectAccountOwnedStorageKeysIn(
      tx,
      userId,
      "https://owned.example",
    ));
    expect(keys).toEqual([
      "users/test/avatar.png",
      "vto/history.png",
      "vto/result.png",
    ]);
    expect(keys.some((key) => key.includes("external"))).toBe(false);
  }, DB_TEST_TIMEOUT);

  it("account deletion erases every Wardrobe/Canvas source row whose owned key is queued", async () => {
    const [insertedUser] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified, avatarKey) VALUES (?, 'Erase Me', 1, 1, 'users/delete/avatar.png')",
      [`r7-5d-delete-${randomUUID()}`],
    );
    const deletingUserId = insertedUser.insertId;
    const [insertedModel] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'test', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
      [deletingUserId],
    );
    const modelId = insertedModel.insertId;
    const [insertedAsset] = await connection.execute<ResultSetHeader>(
      "INSERT INTO model_assets (modelId, viewType, storageUrl, pointsCost) VALUES (?, 'frontClose', ?, 0)",
      [modelId, "https://owned.example/models/account-anchor.png"],
    );
    const identitySnapshotId = randomUUID();
    const packageSnapshotId = randomUUID();
    await connection.execute(
      `INSERT INTO model_identity_snapshots
        (id, modelId, sequence, reason, masterPrompt, technicalSchema, preferences,
         identityText, identityTextHash, anchorAssetId, recipeVersion)
       VALUES (?, ?, 1, 'bootstrap', 'test', JSON_OBJECT(), JSON_OBJECT(), 'test', ?, ?, 'r7-test')`,
      [identitySnapshotId, modelId, "b".repeat(64), insertedAsset.insertId],
    );
    await connection.execute(
      `INSERT INTO model_package_snapshots (id, modelId, identitySnapshotId, sequence, reason)
       VALUES (?, ?, ?, 1, 'bootstrap')`,
      [packageSnapshotId, modelId, identitySnapshotId],
    );
    await connection.execute(
      `INSERT INTO model_package_snapshot_slots
        (id, packageSnapshotId, viewAngle, selectedAssetId, compatibility, selectionReason)
       VALUES (?, ?, 'frontClose', ?, 'current', 'bootstrap')`,
      [randomUUID(), packageSnapshotId, insertedAsset.insertId],
    );
    await connection.execute(
      "UPDATE models SET currentPackageSnapshotId = ?, stateVersion = 1 WHERE id = ?",
      [packageSnapshotId, modelId],
    );
    const [insertedGarment] = await connection.execute<ResultSetHeader>(
      "INSERT INTO wardrobe_garments (userId, slotType, originalImageUrl, originalImageKey) VALUES (?, 'tops', ?, 'garments/original.png')",
      [deletingUserId, "https://owned.example/garments/original.png"],
    );
    await connection.execute(
      "INSERT INTO wardrobe_outfits (userId, name, garmentIds, resultThumbUrl, resultThumbKey) VALUES (?, 'Outfit', JSON_ARRAY(?), ?, 'outfits/result.png')",
      [deletingUserId, insertedGarment.insertId, "https://owned.example/outfits/result.png"],
    );
    const [insertedSession] = await connection.execute<ResultSetHeader>(
      "INSERT INTO wardrobe_sessions (userId, modelId, modelImageUrl, history) VALUES (?, ?, ?, JSON_ARRAY(?))",
      [deletingUserId, modelId, "https://owned.example/shared/input.png", "https://owned.example/sessions/generated.png"],
    );
    await connection.execute(
      "INSERT INTO wardrobe_looks (userId, sessionId, modelId, imageUrl, name) VALUES (?, ?, ?, ?, 'Saved look')",
      [deletingUserId, insertedSession.insertId, modelId, "https://owned.example/looks/saved.png"],
    );
    const [insertedBoard] = await connection.execute<ResultSetHeader>(
      "INSERT INTO boards (userId, name, startedWith, thumbnailUrl, thumbnailKey) VALUES (?, 'Delete board', 'blank', ?, 'boards/thumb.png')",
      [deletingUserId, "https://owned.example/boards/thumb.png"],
    );
    const boardId = insertedBoard.insertId;
    const [firstItem] = await connection.execute<ResultSetHeader>(
      "INSERT INTO board_items (boardId, type, kind, label, imageUrl, imageKey) VALUES (?, 'reference', 'image', 'Owned', ?, 'boards/item.png')",
      [boardId, "https://owned.example/boards/item.png"],
    );
    const [secondItem] = await connection.execute<ResultSetHeader>(
      "INSERT INTO board_items (boardId, type, kind, label) VALUES (?, 'note', 'note', 'Note')",
      [boardId],
    );
    await connection.execute(
      "INSERT INTO board_item_versions (itemId, version, imageUrl) VALUES (?, 1, ?)",
      [firstItem.insertId, "https://owned.example/boards/history.png"],
    );
    await connection.execute(
      "INSERT INTO board_edges (boardId, sourceItemId, targetItemId, relation) VALUES (?, ?, ?, 'reference_for')",
      [boardId, firstItem.insertId, secondItem.insertId],
    );

    const previousPublicUrl = process.env.R2_PUBLIC_URL;
    process.env.R2_PUBLIC_URL = "https://owned.example";
    let result!: Awaited<ReturnType<typeof accountDeletion.deleteUserAccount>>;
    try {
      result = await accountDeletion.deleteUserAccount(deletingUserId);
    } finally {
      if (previousPublicUrl === undefined) delete process.env.R2_PUBLIC_URL;
      else process.env.R2_PUBLIC_URL = previousPublicUrl;
    }

    expect(result).toMatchObject({
      success: true,
      cleanupObjects: 8,
      deletedCounts: {
        boardEdges: 1,
        boardItemVersions: 1,
        boardItems: 2,
        boards: 1,
        wardrobeLooks: 1,
        wardrobeSessions: 1,
        wardrobeOutfits: 1,
        wardrobeGarments: 1,
        modelPackageSnapshotSlots: 1,
        modelPackageSnapshots: 1,
        modelIdentitySnapshots: 1,
        models: 1,
        user: 1,
      },
    });
    const expectedEmpty = [
      ["users", "id", deletingUserId],
      ["models", "userId", deletingUserId],
      ["model_package_snapshot_slots", "packageSnapshotId", packageSnapshotId],
      ["model_package_snapshots", "modelId", modelId],
      ["model_identity_snapshots", "modelId", modelId],
      ["wardrobe_garments", "userId", deletingUserId],
      ["wardrobe_outfits", "userId", deletingUserId],
      ["wardrobe_sessions", "userId", deletingUserId],
      ["wardrobe_looks", "userId", deletingUserId],
      ["boards", "userId", deletingUserId],
      ["board_items", "boardId", boardId],
      ["board_item_versions", "itemId", firstItem.insertId],
      ["board_edges", "boardId", boardId],
    ] as const;
    for (const [table, column, value] of expectedEmpty) {
      const [[row]] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM \`${table}\` WHERE \`${column}\` = ?`,
        [value],
      );
      expect(Number(row.n), `${table} should be erased`).toBe(0);
    }
    const cleanupItems = await cleanupDb.getStorageCleanupItemsForBatch(result.cleanupBatchId!);
    expect(cleanupItems.map((item) => item.storageKey).sort()).toEqual([
      "boards/item.png",
      "boards/thumb.png",
      "garments/original.png",
      "looks/saved.png",
      "models/account-anchor.png",
      "outfits/result.png",
      "sessions/generated.png",
      "users/delete/avatar.png",
    ]);
    expect(cleanupItems.some((item) => item.storageKey.includes("shared/input"))).toBe(false);
  }, DB_TEST_TIMEOUT);
});
