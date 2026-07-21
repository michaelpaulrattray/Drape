/**
 * Disposable-DB proof for migration 0009 and the storage-cleanup manifest.
 * TEST_DATABASE_URL must name the isolated database created by the guarded
 * R7-5B driver; unit tests never fall back to ambient DATABASE_URL.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("R7-5B final Cast-deletion schema (disposable DB)", () => {
  let connection: Connection;
  let userId: number;
  let cleanupDb: typeof import("./db/storageCleanup");
  let withTransaction: typeof import("./db/connection")["withTransaction"];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [columns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM models LIKE 'deletedAt'",
    );
    if (columns.length !== 1) throw new Error("Disposable database must have migration 0009 applied");
    const [inserted] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'R7-5B Test', 1, 1)",
      [`r7-5b-${randomUUID()}`],
    );
    userId = inserted.insertId;
    cleanupDb = await import("./db/storageCleanup");
    ({ withTransaction } = await import("./db/connection"));
  });

  beforeEach(async () => {
    await connection.execute(
      "DELETE i FROM storage_cleanup_items i JOIN storage_cleanup_batches b ON b.id = i.batchId WHERE b.userId = ?",
      [userId],
    );
    await connection.execute("DELETE FROM storage_cleanup_batches WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM generation_operations WHERE userId = ?", [userId]);
    await connection.execute(
      "DELETE i FROM board_items i JOIN boards b ON b.id = i.boardId WHERE b.userId = ?",
      [userId],
    );
    await connection.execute("DELETE FROM boards WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM models WHERE userId = ?", [userId]);
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.execute(
      "DELETE i FROM storage_cleanup_items i JOIN storage_cleanup_batches b ON b.id = i.batchId WHERE b.userId = ?",
      [userId],
    );
    await connection.execute("DELETE FROM storage_cleanup_batches WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM generation_operations WHERE userId = ?", [userId]);
    await connection.execute(
      "DELETE i FROM board_items i JOIN boards b ON b.id = i.boardId WHERE b.userId = ?",
      [userId],
    );
    await connection.execute("DELETE FROM boards WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM models WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
    await connection.end();
    delete process.env.DATABASE_URL;
  });

  it("installs only the expected nullable compatibility columns and lookup index", async () => {
    const [modelColumn] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM models LIKE 'deletedAt'",
    );
    const [operationColumn] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM generation_operations LIKE 'subjectDeletedAt'",
    );
    const [sourceIndex] = await connection.query<RowDataPacket[]>(
      "SHOW INDEX FROM board_items WHERE Key_name = 'idx_board_items_source_model'",
    );
    expect(modelColumn).toHaveLength(1);
    expect(modelColumn[0]).toMatchObject({ Null: "YES", Default: null });
    expect(operationColumn).toHaveLength(1);
    expect(operationColumn[0]).toMatchObject({ Null: "YES", Default: null });
    expect(sourceIndex).toHaveLength(1);
    expect(sourceIndex[0]).toMatchObject({ Column_name: "sourceModelId", Non_unique: 1 });
  });

  it("preserves rows written before 0009 with null deletion markers", async () => {
    const legacyModelId = Number(process.env.R7_5B_LEGACY_MODEL_ID);
    const legacyOperationId = process.env.R7_5B_LEGACY_OPERATION_ID;
    const legacyItemId = Number(process.env.R7_5B_LEGACY_ITEM_ID);
    expect(legacyModelId).toBeGreaterThan(0);
    expect(legacyOperationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(legacyItemId).toBeGreaterThan(0);

    const [[model]] = await connection.query<RowDataPacket[]>(
      "SELECT status, deletedAt FROM models WHERE id = ?",
      [legacyModelId],
    );
    const [[operation]] = await connection.query<RowDataPacket[]>(
      "SELECT status, subjectDeletedAt FROM generation_operations WHERE id = ?",
      [legacyOperationId],
    );
    const [[item]] = await connection.query<RowDataPacket[]>(
      "SELECT sourceModelId FROM board_items WHERE id = ?",
      [legacyItemId],
    );
    expect(model).toEqual({ status: "draft", deletedAt: null });
    expect(operation).toEqual({ status: "claimed", subjectDeletedAt: null });
    expect(Number(item.sourceModelId)).toBe(legacyModelId);
  });

  it("keeps the pre-0009 runtime insert shapes valid after the additive migration", async () => {
    const [model] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'Mixed runtime model', '{}', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
      [userId],
    );
    const operationId = randomUUID();
    await connection.execute(
      "INSERT INTO generation_operations (id, userId, clientRequestId, kind, modelId, payloadHash) VALUES (?, ?, ?, 'casting.iterate', ?, ?)",
      [operationId, userId, randomUUID(), model.insertId, "a".repeat(64)],
    );
    const [board] = await connection.execute<ResultSetHeader>(
      "INSERT INTO boards (userId, name, startedWith, status) VALUES (?, 'Mixed runtime board', 'casting', 'active')",
      [userId],
    );
    const [item] = await connection.execute<ResultSetHeader>(
      "INSERT INTO board_items (boardId, type, kind, label, sourceModelId, metadata) VALUES (?, 'model', 'cast_config', 'Mixed runtime Cast', ?, JSON_OBJECT())",
      [board.insertId, model.insertId],
    );
    const [[storedModel]] = await connection.query<RowDataPacket[]>(
      "SELECT deletedAt FROM models WHERE id = ?",
      [model.insertId],
    );
    const [[storedOperation]] = await connection.query<RowDataPacket[]>(
      "SELECT subjectDeletedAt FROM generation_operations WHERE id = ?",
      [operationId],
    );
    expect(storedModel.deletedAt).toBeNull();
    expect(storedOperation.subjectDeletedAt).toBeNull();
    expect(item.insertId).toBeGreaterThan(0);
  });

  it("persists one deduplicated, count-bound manifest atomically", async () => {
    const operationId = randomUUID();
    const manifest = await withTransaction((tx) => cleanupDb.createStorageCleanupManifestIn(tx, {
      userId,
      operationId,
      kind: "model_delete",
      storageKeys: ["models/a/head.png", "/models/a/back.png", "models/a/head.png"],
    }));
    expect(manifest.expectedCount).toBe(2);

    await expect(cleanupDb.getStorageCleanupBatchByOperation(userId, operationId)).resolves.toMatchObject({
      id: manifest.id,
      userId,
      operationId,
      kind: "model_delete",
      status: "pending",
      expectedCount: 2,
      deletedCount: 0,
      failedCount: 0,
      leaseToken: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      attemptedAt: null,
    });
    await expect(cleanupDb.getStorageCleanupItemsForBatch(manifest.id)).resolves.toMatchObject([
      { batchId: manifest.id, storageKey: "models/a/back.png", status: "pending", attempts: 0 },
      { batchId: manifest.id, storageKey: "models/a/head.png", status: "pending", attempts: 0 },
    ]);
  });

  it("rolls back both the batch and its items when the source transaction fails", async () => {
    const operationId = randomUUID();
    await expect(withTransaction(async (tx) => {
      await cleanupDb.createStorageCleanupManifestIn(tx, {
        userId,
        operationId,
        kind: "model_delete",
        storageKeys: ["models/rollback/head.png", "models/rollback/back.png"],
      });
      throw new Error("injected source-row failure");
    })).rejects.toThrow("injected source-row failure");

    const [[batchCount]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM storage_cleanup_batches WHERE operationId = ?",
      [operationId],
    );
    const [[itemCount]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM storage_cleanup_items i JOIN storage_cleanup_batches b ON b.id = i.batchId WHERE b.operationId = ?",
      [operationId],
    );
    expect(Number(batchCount.n)).toBe(0);
    expect(Number(itemCount.n)).toBe(0);
  });

  it("makes the operation id and each exact key unique without partial residue", async () => {
    const operationId = randomUUID();
    const first = await withTransaction((tx) => cleanupDb.createStorageCleanupManifestIn(tx, {
      userId,
      operationId,
      kind: "model_delete",
      storageKeys: ["models/unique/head.png"],
    }));
    await expect(withTransaction((tx) => cleanupDb.createStorageCleanupManifestIn(tx, {
      id: randomUUID(),
      userId,
      operationId,
      kind: "model_delete",
      storageKeys: ["models/unique/other.png"],
    }))).rejects.toThrow();
    await expect(connection.execute(
      "INSERT INTO storage_cleanup_items (batchId, storageKey) VALUES (?, ?)",
      [first.id, "models/unique/head.png"],
    )).rejects.toThrow();

    const [[batches]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM storage_cleanup_batches WHERE operationId = ?",
      [operationId],
    );
    const [[items]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM storage_cleanup_items WHERE batchId = ?",
      [first.id],
    );
    expect(Number(batches.n)).toBe(1);
    expect(Number(items.n)).toBe(1);
  });

  it("refuses invalid keys before insert and invalid closed statuses at MySQL", async () => {
    const operationId = randomUUID();
    await expect(withTransaction((tx) => cleanupDb.createStorageCleanupManifestIn(tx, {
      userId,
      operationId,
      kind: "model_delete",
      storageKeys: ["https://external.example/not-owned.png"],
    }))).rejects.toThrow("normalized keys");
    await expect(cleanupDb.getStorageCleanupBatchByOperation(userId, operationId)).resolves.toBeNull();

    const batchId = randomUUID();
    await expect(connection.execute(
      "INSERT INTO storage_cleanup_batches (id, userId, operationId, kind, status) VALUES (?, ?, ?, 'model_delete', 'complete')",
      [batchId, userId, randomUUID()],
    )).rejects.toThrow();
    await connection.execute(
      "INSERT INTO storage_cleanup_batches (id, userId, operationId, kind) VALUES (?, ?, ?, 'model_delete')",
      [batchId, userId, randomUUID()],
    );
    await expect(connection.execute(
      "INSERT INTO storage_cleanup_items (batchId, storageKey, status) VALUES (?, 'models/status/head.png', 'partial')",
      [batchId],
    )).rejects.toThrow();
  });
});
