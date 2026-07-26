/** Disposable-MySQL proof for the owner-scoped C5C evidence read. */
import { randomUUID } from "node:crypto";
import mysql, {
  type Connection,
  type ResultSetHeader,
} from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("R7-7C5C owner-scoped evidence delivery", () => {
  let connection: Connection;
  let ownerId: number;
  let foreignId: number;
  let modelId: number;
  const plateId = randomUUID();
  const cropId = randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [owner] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Delivery owner', 1, 1)",
      [`r7-7c5c-owner-${randomUUID()}`],
    );
    const [foreign] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Delivery foreign', 1, 1)",
      [`r7-7c5c-foreign-${randomUUID()}`],
    );
    ownerId = owner.insertId;
    foreignId = foreign.insertId;
    const [model] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'Delivery Cast', '{}', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
      [ownerId],
    );
    modelId = model.insertId;
    const actualPlateKey =
      `users/${ownerId}/models/${modelId}/evidence/plates/${plateId}.webp`;
    const actualCropKey =
      `users/${ownerId}/models/${modelId}/evidence/crops/${cropId}.webp`;
    await connection.execute(
      `INSERT INTO model_reference_plates
       (id, userId, modelId, kind, storageKey, mime, width, height, byteSize, contentHash, createdByOperationId)
       VALUES (?, ?, ?, 'uploaded_reference', ?, 'image/webp', 512, 768, 12, ?, ?)`,
      [plateId, ownerId, modelId, actualPlateKey, "a".repeat(64), randomUUID()],
    );
    await connection.execute(
      `INSERT INTO model_evidence_crops
       (id, userId, modelId, plateId, ontologyVersion, zone, surface, side,
        sourceX, sourceY, sourceWidth, sourceHeight, sourceImageWidth, sourceImageHeight,
        storageKey, mime, width, height, byteSize, contentHash, cropRecipeVersion, createdByOperationId)
       VALUES (?, ?, ?, ?, 'v1', 'face', 'skin', 'front',
        0, 0, 1, 1, 512, 768, ?, 'image/webp', 256, 256, 12, ?, 'v1', ?)`,
      [cropId, ownerId, modelId, plateId, actualCropKey, "b".repeat(64), randomUUID()],
    );
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.execute("DELETE FROM model_evidence_crops WHERE id = ?", [cropId]);
    await connection.execute("DELETE FROM model_reference_plates WHERE id = ?", [plateId]);
    await connection.execute("DELETE FROM models WHERE id = ?", [modelId]);
    await connection.execute("DELETE FROM users WHERE id IN (?, ?)", [ownerId, foreignId]);
    await connection.end();
    delete process.env.DATABASE_URL;
  });

  it("returns owner rows and makes foreign, archived and deleted Casts absent", async () => {
    const { readOwnedEvidenceDelivery } = await import("./db/evidenceDelivery");
    await expect(readOwnedEvidenceDelivery({
      userId: ownerId,
      kind: "plate",
      entityId: plateId,
    })).resolves.toMatchObject({
      ownerId,
      modelId,
      entityId: plateId,
      kind: "plate",
      byteSize: 12,
    });
    await expect(readOwnedEvidenceDelivery({
      userId: ownerId,
      kind: "crop",
      entityId: cropId,
    })).resolves.toMatchObject({
      ownerId,
      modelId,
      entityId: cropId,
      kind: "crop",
      byteSize: 12,
    });
    await expect(readOwnedEvidenceDelivery({
      userId: foreignId,
      kind: "plate",
      entityId: plateId,
    })).resolves.toBeNull();

    await connection.execute("UPDATE models SET status = 'archived' WHERE id = ?", [modelId]);
    await expect(readOwnedEvidenceDelivery({
      userId: ownerId,
      kind: "plate",
      entityId: plateId,
    })).resolves.toBeNull();
    await connection.execute(
      "UPDATE models SET status = 'draft', deletedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [modelId],
    );
    await expect(readOwnedEvidenceDelivery({
      userId: ownerId,
      kind: "crop",
      entityId: cropId,
    })).resolves.toBeNull();
  });
});
