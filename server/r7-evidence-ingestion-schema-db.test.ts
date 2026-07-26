/**
 * Disposable-DB proof for additive migration 0011. TEST_DATABASE_URL must
 * name the isolated database created by the guarded R7-7C1 runner.
 */
import { randomUUID } from "node:crypto";
import mysql, {
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("R7-7C1 owned-evidence schema (disposable DB)", () => {
  let connection: Connection;
  let userId: number;
  let modelId: number;
  const cleanupBatchIds: string[] = [];
  const ingestionIds: string[] = [];
  const plateIds: string[] = [];
  const cropIds: string[] = [];

  beforeAll(async () => {
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [tables] = await connection.query<RowDataPacket[]>(
      "SHOW TABLES LIKE 'casting_evidence_ingestions'",
    );
    if (tables.length !== 1) {
      throw new Error("Disposable database must have migration 0011 applied");
    }
    const [inserted] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'R7-7C1 Test', 1, 1)",
      [`r7-7c1-${randomUUID()}`],
    );
    userId = inserted.insertId;
    const [model] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'Evidence Cast', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
      [userId],
    );
    modelId = model.insertId;
  });

  afterAll(async () => {
    if (!connection) return;
    if (cropIds.length > 0) {
      await connection.query(
        `DELETE FROM model_evidence_crops WHERE id IN (${cropIds.map(() => "?").join(",")})`,
        cropIds,
      );
    }
    if (plateIds.length > 0) {
      await connection.query(
        `DELETE FROM model_reference_plates WHERE id IN (${plateIds.map(() => "?").join(",")})`,
        plateIds,
      );
    }
    if (ingestionIds.length > 0) {
      await connection.query(
        `DELETE FROM casting_evidence_ingestions WHERE id IN (${ingestionIds.map(() => "?").join(",")})`,
        ingestionIds,
      );
    }
    if (cleanupBatchIds.length > 0) {
      await connection.query(
        `DELETE FROM storage_cleanup_batches WHERE id IN (${cleanupBatchIds.map(() => "?").join(",")})`,
        cleanupBatchIds,
      );
    }
    await connection.execute("DELETE FROM models WHERE id = ?", [modelId]);
    await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
    await connection.end();
  });

  it("preserves pre-0011 cleanup rows and keeps both old insert kinds valid", async () => {
    const legacyIds = [
      process.env.R7_7C1_LEGACY_MODEL_BATCH_ID,
      process.env.R7_7C1_LEGACY_ACCOUNT_BATCH_ID,
    ];
    expect(legacyIds.every((id) => /^[0-9a-f-]{36}$/i.test(id ?? ""))).toBe(true);
    const [legacyRows] = await connection.query<RowDataPacket[]>(
      "SELECT id, kind FROM storage_cleanup_batches WHERE id IN (?, ?) ORDER BY kind",
      legacyIds,
    );
    expect(legacyRows.map((row) => row.kind).sort()).toEqual([
      "account_delete",
      "model_delete",
    ]);

    for (const kind of ["model_delete", "account_delete", "evidence_cleanup"]) {
      const id = randomUUID();
      cleanupBatchIds.push(id);
      await connection.execute(
        "INSERT INTO storage_cleanup_batches (id, userId, operationId, kind) VALUES (?, ?, ?, ?)",
        [id, userId, randomUUID(), kind],
      );
    }
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT kind FROM storage_cleanup_batches WHERE id IN (${cleanupBatchIds.map(() => "?").join(",")}) ORDER BY kind`,
      cleanupBatchIds,
    );
    expect(rows.map((row) => row.kind).sort()).toEqual([
      "account_delete",
      "evidence_cleanup",
      "model_delete",
    ]);
  });

  it("keeps evidence persistence URL-free and without database foreign keys", async () => {
    for (const table of [
      "casting_evidence_ingestions",
      "model_reference_plates",
      "model_evidence_crops",
    ]) {
      const [columns] = await connection.query<RowDataPacket[]>(
        `SHOW COLUMNS FROM \`${table}\``,
      );
      expect(columns.map((row) => String(row.Field).toLowerCase()))
        .not.toEqual(expect.arrayContaining([expect.stringMatching(/url/)]));
      const [foreignKeys] = await connection.execute<RowDataPacket[]>(
        "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL",
        [table],
      );
      expect(foreignKeys).toEqual([]);
    }
  });

  it("accepts one receipt, immutable plate and contextual crop with exact owned keys", async () => {
    const plateId = randomUUID();
    const plateOperationId = randomUUID();
    const plateIngestionId = randomUUID();
    const plateKey = `users/${userId}/models/${modelId}/evidence/plates/${plateId}.webp`;
    plateIds.push(plateId);
    ingestionIds.push(plateIngestionId);

    await connection.execute(
      "INSERT INTO casting_evidence_ingestions (id, userId, modelId, operationId, purpose, storageKey, mime, width, height, byteSize, contentHash) VALUES (?, ?, ?, ?, 'reference_plate', ?, 'image/webp', 2048, 2048, 4096, ?)",
      [plateIngestionId, userId, modelId, plateOperationId, plateKey, "a".repeat(64)],
    );
    await connection.execute(
      "UPDATE casting_evidence_ingestions SET status = 'stored' WHERE id = ? AND status = 'planned'",
      [plateIngestionId],
    );
    await connection.execute(
      "INSERT INTO model_reference_plates (id, userId, modelId, kind, storageKey, mime, width, height, byteSize, contentHash, createdByOperationId) VALUES (?, ?, ?, 'uploaded_reference', ?, 'image/webp', 2048, 2048, 4096, ?, ?)",
      [plateId, userId, modelId, plateKey, "a".repeat(64), plateOperationId],
    );
    await connection.execute(
      "UPDATE casting_evidence_ingestions SET status = 'attached', attachedEntityKind = 'reference_plate', attachedEntityId = ?, attachedAt = NOW() WHERE id = ? AND status = 'stored'",
      [plateId, plateIngestionId],
    );

    const cropId = randomUUID();
    const cropOperationId = randomUUID();
    const cropIngestionId = randomUUID();
    const cropKey = `users/${userId}/models/${modelId}/evidence/crops/${cropId}.webp`;
    cropIds.push(cropId);
    ingestionIds.push(cropIngestionId);
    await connection.execute(
      "INSERT INTO casting_evidence_ingestions (id, userId, modelId, operationId, purpose, status, storageKey, mime, width, height, byteSize, contentHash) VALUES (?, ?, ?, ?, 'evidence_crop', 'stored', ?, 'image/webp', 1024, 1024, 2048, ?)",
      [cropIngestionId, userId, modelId, cropOperationId, cropKey, "b".repeat(64)],
    );
    await connection.execute(
      "INSERT INTO model_evidence_crops (id, userId, modelId, plateId, ontologyVersion, zone, surface, side, sourceX, sourceY, sourceWidth, sourceHeight, sourceImageWidth, sourceImageHeight, storageKey, mime, width, height, byteSize, contentHash, cropRecipeVersion, createdByOperationId) VALUES (?, ?, ?, ?, 'ink-pilot-v1', 'upper_torso', 'front', 'center', 0.1, 0.2, 0.5, 0.6, 2048, 2048, ?, 'image/webp', 1024, 1024, 2048, ?, 'crop-v1', ?)",
      [cropId, userId, modelId, plateId, cropKey, "b".repeat(64), cropOperationId],
    );
    await connection.execute(
      "UPDATE casting_evidence_ingestions SET status = 'attached', attachedEntityKind = 'evidence_crop', attachedEntityId = ?, attachedAt = NOW() WHERE id = ? AND status = 'stored'",
      [cropId, cropIngestionId],
    );

    const [[plate]] = await connection.query<RowDataPacket[]>(
      "SELECT kind, storageKey FROM model_reference_plates WHERE id = ?",
      [plateId],
    );
    const [[crop]] = await connection.query<RowDataPacket[]>(
      "SELECT plateId, storageKey, sourceX, sourceWidth FROM model_evidence_crops WHERE id = ?",
      [cropId],
    );
    expect(plate).toEqual({ kind: "uploaded_reference", storageKey: plateKey });
    expect(crop).toMatchObject({
      plateId,
      storageKey: cropKey,
      sourceX: "0.100000000",
      sourceWidth: "0.500000000",
    });
  }, 20_000);

  it("rejects duplicate operation/key identities and unreviewed enum values", async () => {
    const operationId = randomUUID();
    const ingestionId = randomUUID();
    const key = `users/${userId}/models/${modelId}/evidence/plates/${randomUUID()}.webp`;
    ingestionIds.push(ingestionId);
    await connection.execute(
      "INSERT INTO casting_evidence_ingestions (id, userId, modelId, operationId, purpose, storageKey, mime, width, height, byteSize, contentHash) VALUES (?, ?, ?, ?, 'reference_plate', ?, 'image/webp', 512, 512, 1024, ?)",
      [ingestionId, userId, modelId, operationId, key, "c".repeat(64)],
    );
    await expect(connection.execute(
      "INSERT INTO casting_evidence_ingestions (id, userId, modelId, operationId, purpose, storageKey, mime, width, height, byteSize, contentHash) VALUES (?, ?, ?, ?, 'reference_plate', ?, 'image/webp', 512, 512, 1024, ?)",
      [randomUUID(), userId, modelId, operationId, `${key}.other`, "d".repeat(64)],
    )).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    await expect(connection.execute(
      "INSERT INTO casting_evidence_ingestions (id, userId, modelId, operationId, purpose, storageKey, mime, width, height, byteSize, contentHash) VALUES (?, ?, ?, ?, 'reference_plate', ?, 'image/webp', 512, 512, 1024, ?)",
      [randomUUID(), userId, modelId, randomUUID(), key, "d".repeat(64)],
    )).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    await expect(connection.execute(
      "INSERT INTO casting_evidence_ingestions (id, userId, modelId, operationId, purpose, storageKey, mime, width, height, byteSize, contentHash) VALUES (?, ?, ?, ?, 'candidate_output', ?, 'image/webp', 512, 512, 1024, ?)",
      [randomUUID(), userId, modelId, randomUUID(), `${key}.candidate`, "d".repeat(64)],
    )).rejects.toBeTruthy();
  });
});
