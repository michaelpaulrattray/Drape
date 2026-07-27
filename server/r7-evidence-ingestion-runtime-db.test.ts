/**
 * Disposable-DB proof for the C2 planned -> stored -> attached primitive.
 * TEST_DATABASE_URL must name the scratch database created by the guarded
 * R7-7C driver; this suite never falls back to DATABASE_URL.
 */
import { randomUUID } from "node:crypto";
import mysql, {
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { dbReferencePlateIngestionPersistence } from "./db/evidenceIngestion";
import type { EvidenceDeliveryAdapter } from "./casting/evidence/evidenceDelivery";
import {
  canonicalizeEvidenceImage,
  type CanonicalEvidenceImage,
} from "./casting/evidence/imageValidation";
import { stageCanonicalReferencePlate } from "./casting/evidence/referencePlateIngestion";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("R7-7C2 evidence ingestion runtime (disposable DB)", () => {
  let connection: Connection;
  let ownerId: number;
  let modelId: number;
  let image: CanonicalEvidenceImage;
  const ingestionIds: string[] = [];
  const plateIds: string[] = [];

  beforeAll(async () => {
    connection = await mysql.createConnection(testDatabaseUrl!);
    const source = await sharp({
      create: {
        width: 640,
        height: 960,
        channels: 3,
        background: { r: 70, g: 80, b: 90 },
      },
    }).png().toBuffer();
    image = await canonicalizeEvidenceImage({
      bytes: source,
      declaredMime: "image/png",
    });
    const [insertedUser] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'R7-7C2 Owner', 1, 1)",
      [`r7-7c2-${randomUUID()}`],
    );
    ownerId = insertedUser.insertId;
    const [insertedModel] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'C2 Draft', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
      [ownerId],
    );
    modelId = insertedModel.insertId;
  });

  afterAll(async () => {
    if (!connection) return;
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
    await connection.execute("DELETE FROM models WHERE id = ?", [modelId]);
    await connection.execute("DELETE FROM users WHERE id = ?", [ownerId]);
    await connection.end();
  });

  function ids(): { ingestionId: string; plateId: string; generateId: () => string } {
    const ingestionId = randomUUID();
    const plateId = randomUUID();
    ingestionIds.push(ingestionId);
    plateIds.push(plateId);
    const values = [ingestionId, plateId];
    return { ingestionId, plateId, generateId: () => values.shift()! };
  }

  function adapter(
    putCanonical: EvidenceDeliveryAdapter["putCanonical"],
  ): EvidenceDeliveryAdapter {
    return {
      putCanonical,
      resolveOwnerDelivery: async (_userId, key) => `disposable-owner://${key}`,
      deleteExact: async () => ({ success: true }),
    };
  }

  it("commits the planned receipt before put, then lands stored and attached exactly once", async () => {
    const operationId = randomUUID();
    const generated = ids();
    const putCanonical = vi.fn(async (key: string) => {
      const [[receipt]] = await connection.query<RowDataPacket[]>(
        "SELECT status, storageKey FROM casting_evidence_ingestions WHERE id = ?",
        [generated.ingestionId],
      );
      const [plates] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM model_reference_plates WHERE id = ?",
        [generated.plateId],
      );
      expect(receipt).toEqual({ status: "planned", storageKey: key });
      expect(plates).toEqual([]);
      return { key };
    });

    const result = await stageCanonicalReferencePlate({
      persistence: dbReferencePlateIngestionPersistence,
      delivery: adapter(putCanonical),
      generateId: generated.generateId,
    }, {
      userId: ownerId,
      modelId,
      operationId,
      stepKey: "reference",
      image,
    });

    expect(putCanonical).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      plateId: generated.plateId,
      mime: "image/webp",
      width: 640,
      height: 960,
      byteSize: image.byteSize,
      contentHash: image.contentHash,
    });
    expect(result.delivery).toBe(
      `disposable-owner://users/${ownerId}/models/${modelId}/evidence/plates/${generated.plateId}.webp`,
    );
    const [[receipt]] = await connection.query<RowDataPacket[]>(
      "SELECT status, attachedEntityKind, attachedEntityId FROM casting_evidence_ingestions WHERE id = ?",
      [generated.ingestionId],
    );
    const [[plate]] = await connection.query<RowDataPacket[]>(
      "SELECT userId, modelId, storageKey, mime, width, height, byteSize, contentHash, createdByOperationId FROM model_reference_plates WHERE id = ?",
      [generated.plateId],
    );
    expect(receipt).toEqual({
      status: "attached",
      attachedEntityKind: "reference_plate",
      attachedEntityId: generated.plateId,
    });
    expect(plate).toEqual({
      userId: ownerId,
      modelId,
      storageKey: `users/${ownerId}/models/${modelId}/evidence/plates/${generated.plateId}.webp`,
      mime: "image/webp",
      width: 640,
      height: 960,
      byteSize: image.byteSize,
      contentHash: image.contentHash,
      createdByOperationId: operationId,
    });
  }, 20_000);

  it("keeps a durable planned receipt and no plate when storage returns another key", async () => {
    const generated = ids();
    const otherPlateId = randomUUID();
    await expect(stageCanonicalReferencePlate({
      persistence: dbReferencePlateIngestionPersistence,
      delivery: adapter(async () => ({
        key: `users/${ownerId}/models/${modelId}/evidence/plates/${otherPlateId}.webp`,
      })),
      generateId: generated.generateId,
    }, {
      userId: ownerId,
      modelId,
      operationId: randomUUID(),
      stepKey: "reference",
      image,
    })).rejects.toMatchObject({ code: "returned_key_mismatch" });

    const [[receipt]] = await connection.query<RowDataPacket[]>(
      "SELECT status FROM casting_evidence_ingestions WHERE id = ?",
      [generated.ingestionId],
    );
    const [plates] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM model_reference_plates WHERE id = ?",
      [generated.plateId],
    );
    expect(receipt.status).toBe("planned");
    expect(plates).toEqual([]);
  }, 20_000);

  it("keeps stored truth and no plate when the model head changes during object put", async () => {
    const generated = ids();
    await expect(stageCanonicalReferencePlate({
      persistence: dbReferencePlateIngestionPersistence,
      delivery: adapter(async (key) => {
        await connection.execute(
          "UPDATE models SET stateVersion = stateVersion + 1 WHERE id = ?",
          [modelId],
        );
        return { key };
      }),
      generateId: generated.generateId,
    }, {
      userId: ownerId,
      modelId,
      operationId: randomUUID(),
      stepKey: "reference",
      image,
    })).rejects.toMatchObject({ code: "snapshot_head_changed" });

    const [[receipt]] = await connection.query<RowDataPacket[]>(
      "SELECT status FROM casting_evidence_ingestions WHERE id = ?",
      [generated.ingestionId],
    );
    const [plates] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM model_reference_plates WHERE id = ?",
      [generated.plateId],
    );
    expect(receipt.status).toBe("stored");
    expect(plates).toEqual([]);
    await connection.execute(
      "UPDATE models SET stateVersion = stateVersion - 1 WHERE id = ?",
      [modelId],
    );
  }, 20_000);

  it("refuses foreign and minted models before storage and leaves no receipt", async () => {
    const putCanonical = vi.fn();
    for (const attempt of [
      { userId: ownerId + 99, status: "draft" },
      { userId: ownerId, status: "active" },
    ]) {
      await connection.execute("UPDATE models SET status = ? WHERE id = ?", [
        attempt.status,
        modelId,
      ]);
      const generated = ids();
      await expect(stageCanonicalReferencePlate({
        persistence: dbReferencePlateIngestionPersistence,
        delivery: adapter(putCanonical),
        generateId: generated.generateId,
      }, {
        userId: attempt.userId,
        modelId,
        operationId: randomUUID(),
        stepKey: "reference",
        image,
      })).rejects.toMatchObject({ code: "model_unavailable" });
      const [receipts] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM casting_evidence_ingestions WHERE id = ?",
        [generated.ingestionId],
      );
      expect(receipts).toEqual([]);
    }
    expect(putCanonical).not.toHaveBeenCalled();
    await connection.execute("UPDATE models SET status = 'draft' WHERE id = ?", [modelId]);
  }, 20_000);
});
