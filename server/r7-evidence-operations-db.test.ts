import { randomUUID } from "node:crypto";
import mysql, {
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import type { EvidenceDeliveryAdapter } from "./casting/evidence/evidenceDelivery";
import {
  discardOwnedReferencePlate,
  stageOwnedReferencePlate,
} from "./casting/evidence/evidenceOperations";
import {
  beginDirectOperation,
  failClaimedDirectOperation,
} from "./casting/directOperation";
import { modelOperationLockKey } from "./casting/operationContract";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("R7-7C4 evidence operations (disposable DB)", () => {
  let connection: Connection;
  let ownerId: number;
  let otherUserId: number;
  let modelId: number;
  let dataUrl: string;
  const userIds: number[] = [];

  beforeAll(async () => {
    connection = await mysql.createConnection(testDatabaseUrl!);
    const source = await sharp({
      create: {
        width: 512,
        height: 768,
        channels: 3,
        background: { r: 42, g: 80, b: 110 },
      },
    }).png().toBuffer();
    dataUrl = `data:image/png;base64,${source.toString("base64")}`;
    const [owner] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'C4 Owner', 1, 1)",
      [`r7-7c4-owner-${randomUUID()}`],
    );
    ownerId = owner.insertId;
    userIds.push(ownerId);
    const [other] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'C4 Other', 1, 1)",
      [`r7-7c4-other-${randomUUID()}`],
    );
    otherUserId = other.insertId;
    userIds.push(otherUserId);
    const [model] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'C4 Draft', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
      [ownerId],
    );
    modelId = model.insertId;
  });

  afterAll(async () => {
    if (!connection) return;
    await connection.execute(
      "DELETE FROM storage_cleanup_items WHERE batchId IN (SELECT id FROM storage_cleanup_batches WHERE userId IN (?, ?))",
      [ownerId, otherUserId],
    );
    await connection.execute(
      "DELETE FROM storage_cleanup_batches WHERE userId IN (?, ?)",
      [ownerId, otherUserId],
    );
    await connection.execute(
      "DELETE FROM model_evidence_crops WHERE userId IN (?, ?)",
      [ownerId, otherUserId],
    );
    await connection.execute(
      "DELETE FROM model_reference_plates WHERE userId IN (?, ?)",
      [ownerId, otherUserId],
    );
    await connection.execute(
      "DELETE FROM casting_evidence_ingestions WHERE userId IN (?, ?)",
      [ownerId, otherUserId],
    );
    await connection.execute(
      "DELETE FROM generation_operation_locks WHERE operationId IN (SELECT id FROM generation_operations WHERE userId IN (?, ?))",
      [ownerId, otherUserId],
    );
    await connection.execute(
      "DELETE FROM generation_operations WHERE userId IN (?, ?)",
      [ownerId, otherUserId],
    );
    await connection.execute("DELETE FROM models WHERE id = ?", [modelId]);
    await connection.execute("DELETE FROM users WHERE id IN (?, ?)", [
      ownerId,
      otherUserId,
    ]);
    await connection.end();
  });

  function adapter() {
    const objects = new Map<string, Uint8Array>();
    const value: EvidenceDeliveryAdapter = {
      putCanonical: vi.fn(async (key, bytes) => {
        objects.set(key, bytes);
        return { key };
      }),
      resolveOwnerDelivery: vi.fn(async (userId, key) => (
        `owner://${userId}/${encodeURIComponent(key)}`
      )),
      deleteExact: vi.fn(async () => ({ success: true })),
    };
    return { value, objects };
  }

  it("stages once, replays terminal metadata without a second put, and uses zero credits", async () => {
    const delivery = adapter();
    const clientRequestId = randomUUID();
    const first = await stageOwnedReferencePlate({ delivery: delivery.value }, {
      userId: ownerId,
      modelId,
      clientRequestId,
      imageDataUrl: dataUrl,
    });
    const replay = await stageOwnedReferencePlate({ delivery: delivery.value }, {
      userId: ownerId,
      modelId,
      clientRequestId,
      imageDataUrl: dataUrl,
    });
    expect(replay).toEqual(first);
    expect(delivery.value.putCanonical).toHaveBeenCalledTimes(1);
    expect(delivery.value.resolveOwnerDelivery).toHaveBeenCalledTimes(2);
    expect(first.delivery).toContain(`owner://${ownerId}/`);

    const [[operation]] = await connection.query<RowDataPacket[]>(
      "SELECT status, plannedCredits, chargedCredits, refundedCredits, phase, heartbeatAt, leaseExpiresAt, result FROM generation_operations WHERE userId = ? AND clientRequestId = ?",
      [ownerId, clientRequestId],
    );
    expect(operation.status).toBe("succeeded");
    expect(operation.plannedCredits).toBe(0);
    expect(operation.chargedCredits).toBe(0);
    expect(operation.refundedCredits).toBe(0);
    expect(operation.phase).toBeNull();
    expect(operation.heartbeatAt).toBeNull();
    expect(operation.leaseExpiresAt).toBeNull();
    expect(JSON.stringify(operation.result)).not.toMatch(/delivery|storage|url|reference/i);

    const [[receipt]] = await connection.query<RowDataPacket[]>(
      "SELECT status, attachedEntityId FROM casting_evidence_ingestions WHERE operationId = (SELECT id FROM generation_operations WHERE userId = ? AND clientRequestId = ?)",
      [ownerId, clientRequestId],
    );
    expect(receipt).toEqual({
      status: "attached",
      attachedEntityId: first.plateId,
    });
  }, 30_000);

  it("refuses foreign and minted models before storage or an operation receipt", async () => {
    const delivery = adapter();
    for (const attempt of [
      { userId: otherUserId, status: "draft" },
      { userId: ownerId, status: "active" },
    ]) {
      await connection.execute("UPDATE models SET status = ? WHERE id = ?", [
        attempt.status,
        modelId,
      ]);
      const clientRequestId = randomUUID();
      await expect(stageOwnedReferencePlate({ delivery: delivery.value }, {
        userId: attempt.userId,
        modelId,
        clientRequestId,
        imageDataUrl: dataUrl,
      })).rejects.toMatchObject({ code: "NOT_FOUND" });
      const [[count]] = await connection.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM generation_operations WHERE userId = ? AND clientRequestId = ?",
        [attempt.userId, clientRequestId],
      );
      expect(Number(count.n)).toBe(0);
    }
    expect(delivery.value.putCanonical).not.toHaveBeenCalled();
    await connection.execute("UPDATE models SET status = 'draft' WHERE id = ?", [modelId]);
  }, 30_000);

  it("reuses the one planned key after a transient storage refusal", async () => {
    const clientRequestId = randomUUID();
    let attempt = 0;
    const keys: string[] = [];
    const value: EvidenceDeliveryAdapter = {
      putCanonical: vi.fn(async (key) => {
        keys.push(key);
        attempt += 1;
        return { key: attempt === 1 ? `${key}.wrong` : key };
      }),
      resolveOwnerDelivery: vi.fn(async (_userId, key) => `owner://${key}`),
      deleteExact: vi.fn(async () => ({ success: true })),
    };
    await expect(stageOwnedReferencePlate({ delivery: value }, {
      userId: ownerId,
      modelId,
      clientRequestId,
      imageDataUrl: dataUrl,
    })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    const succeeded = await stageOwnedReferencePlate({ delivery: value }, {
      userId: ownerId,
      modelId,
      clientRequestId,
      imageDataUrl: dataUrl,
    });
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[0]).toContain(`/plates/${succeeded.plateId}.webp`);
    const [[count]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_evidence_ingestions WHERE operationId = (SELECT id FROM generation_operations WHERE userId = ? AND clientRequestId = ?)",
      [ownerId, clientRequestId],
    );
    expect(Number(count.n)).toBe(1);
  }, 30_000);

  it("discards atomically into one exact cleanup manifest and replays without storage access", async () => {
    const delivery = adapter();
    const staged = await stageOwnedReferencePlate({ delivery: delivery.value }, {
      userId: ownerId,
      modelId,
      clientRequestId: randomUUID(),
      imageDataUrl: dataUrl,
    });
    const discardRequestId = randomUUID();
    const first = await discardOwnedReferencePlate({
      userId: ownerId,
      plateId: staged.plateId,
      clientRequestId: discardRequestId,
    });
    const replay = await discardOwnedReferencePlate({
      userId: ownerId,
      plateId: staged.plateId,
      clientRequestId: discardRequestId,
    }).catch((error) => error);
    // The terminal receipt must be consulted before the now-deleted plate.
    expect(first).toEqual({ plateId: staged.plateId, discarded: true });
    expect(replay).toEqual(first);
    await expect(discardOwnedReferencePlate({
      userId: ownerId,
      plateId: randomUUID(),
      clientRequestId: discardRequestId,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(delivery.value.deleteExact).not.toHaveBeenCalled();

    const [[receipt]] = await connection.query<RowDataPacket[]>(
      "SELECT status, cleanupBatchId, storageKey FROM casting_evidence_ingestions WHERE attachedEntityId = ?",
      [staged.plateId],
    );
    expect(receipt.status).toBe("cleanup_pending");
    const [plates] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM model_reference_plates WHERE id = ?",
      [staged.plateId],
    );
    expect(plates).toEqual([]);
    const [[batch]] = await connection.query<RowDataPacket[]>(
      "SELECT kind, expectedCount, operationId FROM storage_cleanup_batches WHERE id = ?",
      [receipt.cleanupBatchId],
    );
    const [[item]] = await connection.query<RowDataPacket[]>(
      "SELECT storageKey, storageBackend FROM storage_cleanup_items WHERE batchId = ?",
      [receipt.cleanupBatchId],
    );
    const [[discardOperation]] = await connection.query<RowDataPacket[]>(
      "SELECT id, status, chargedCredits, refundedCredits FROM generation_operations WHERE userId = ? AND clientRequestId = ?",
      [ownerId, discardRequestId],
    );
    expect(batch).toEqual({
      kind: "evidence_cleanup",
      expectedCount: 1,
      operationId: discardOperation.id,
    });
    expect(item.storageKey).toBe(receipt.storageKey);
    expect(item.storageBackend).toBe("private_evidence_r2");
    expect(discardOperation.status).toBe("succeeded");
    expect(discardOperation.chargedCredits).toBe(0);
    expect(discardOperation.refundedCredits).toBe(0);
  }, 30_000);

  it("replays a stored discard failure with its original closed TRPC code", async () => {
    const delivery = adapter();
    const staged = await stageOwnedReferencePlate({ delivery: delivery.value }, {
      userId: ownerId,
      modelId,
      clientRequestId: randomUUID(),
      imageDataUrl: dataUrl,
    });
    const clientRequestId = randomUUID();
    const gate = await beginDirectOperation({
      userId: ownerId,
      clientRequestId,
      kind: "evidence_plate_discard",
      modelId,
      payload: { modelId, plateId: staged.plateId },
      lockKey: modelOperationLockKey(modelId),
      resumeClaimedEvidence: true,
    });
    expect(gate.type).toBe("execute");
    if (gate.type !== "execute") throw new Error("Expected a fresh discard claim");
    await expect(failClaimedDirectOperation({
      userId: ownerId,
      operationId: gate.operationId,
      error: new TRPCError({
        code: "CONFLICT",
        message: "The reference image is busy.",
      }),
    })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(discardOwnedReferencePlate({
      userId: ownerId,
      plateId: staged.plateId,
      clientRequestId,
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "The reference image is busy.",
    });
  }, 30_000);
});
