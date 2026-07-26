/**
 * Disposable-DB proof for C3 recovery, deletion and privacy lifecycle.
 * TEST_DATABASE_URL must name the scratch database created by the guarded
 * R7-7C driver; this suite never falls back to DATABASE_URL.
 */
import { randomUUID } from "node:crypto";
import mysql, {
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const PUBLIC_URL = "https://r7-7c3.invalid";

describeWithDatabase("R7-7C3 evidence lifecycle (disposable DB)", () => {
  let connection: Connection;
  let recovery: typeof import("./db/evidenceRecovery");
  let cleanupWorker: typeof import("./casting/storageCleanupWorker");
  let cleanupDb: typeof import("./db/storageCleanup");
  let operationRecovery: typeof import("./casting/operationRecovery");
  let finalDeletion: typeof import("./casting/finalCastDeletion");
  let accountDeletion: typeof import("./db/accountDeletion");
  let gdpr: typeof import("./db/gdprExport");

  beforeAll(async () => {
    const parsed = new URL(testDatabaseUrl!);
    const databaseName = parsed.pathname.slice(1);
    if (
      !databaseName.startsWith("drape_r7_7c1_disposable_")
      && !databaseName.startsWith("drape_r7_7c5a_disposable_")
    ) {
      throw new Error("R7-7C3 DB tests require the guarded R7-7C disposable database");
    }
    process.env.DATABASE_URL = testDatabaseUrl!;
    process.env.R2_PUBLIC_URL = PUBLIC_URL;
    connection = await mysql.createConnection(testDatabaseUrl!);
    recovery = await import("./db/evidenceRecovery");
    cleanupWorker = await import("./casting/storageCleanupWorker");
    cleanupDb = await import("./db/storageCleanup");
    operationRecovery = await import("./casting/operationRecovery");
    finalDeletion = await import("./casting/finalCastDeletion");
    accountDeletion = await import("./db/accountDeletion");
    gdpr = await import("./db/gdprExport");
  });

  beforeEach(async () => {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of [
      "storage_cleanup_items",
      "storage_cleanup_batches",
      "model_evidence_crops",
      "model_reference_plates",
      "casting_evidence_ingestions",
      "generation_operation_locks",
      "generation_operations",
      "audit_logs",
      "bug_reports",
      "board_edges",
      "board_item_versions",
      "board_items",
      "boards",
      "wardrobe_looks",
      "wardrobe_sessions",
      "wardrobe_outfits",
      "wardrobe_garments",
      "model_package_snapshot_slots",
      "model_package_snapshots",
      "model_identity_snapshots",
      "model_assets",
      "generations",
      "point_transactions",
      "points",
      "referrals",
      "change_request_attachments",
      "change_requests",
      "models",
      "users",
    ]) await connection.query(`TRUNCATE TABLE \`${table}\``);
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  }, 60_000);

  afterAll(async () => {
    await connection?.end();
    delete process.env.DATABASE_URL;
    delete process.env.R2_PUBLIC_URL;
  });

  async function createOwnerAndModel(): Promise<{ userId: number; modelId: number }> {
    const [owner] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'C3 owner', 1, 1)",
      [`r7-7c3-${randomUUID()}`],
    );
    const [model] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'C3 Draft', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
      [owner.insertId],
    );
    return { userId: owner.insertId, modelId: model.insertId };
  }

  async function insertReceipt(input: {
    userId: number;
    modelId: number;
    operationId?: string;
    purpose?: "reference_plate" | "evidence_crop";
    status?: "planned" | "stored" | "attached" | "cleanup_pending" | "cleaned";
    entityId?: string;
    ageMinutes?: number;
  }) {
    const id = randomUUID();
    const entityId = input.entityId ?? randomUUID();
    const operationId = input.operationId ?? randomUUID();
    const purpose = input.purpose ?? "reference_plate";
    const segment = purpose === "reference_plate" ? "plates" : "crops";
    const storageKey =
      `users/${input.userId}/models/${input.modelId}/evidence/${segment}/${entityId}.webp`;
    const status = input.status ?? "planned";
    await connection.execute(
      `INSERT INTO casting_evidence_ingestions
        (id, userId, modelId, operationId, purpose, status, storageKey, mime,
         width, height, byteSize, contentHash, attachedEntityKind, attachedEntityId,
         attachedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'image/webp', 640, 960, 4096, ?,
         ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? MINUTE), DATE_SUB(NOW(), INTERVAL ? MINUTE))`,
      [
        id,
        input.userId,
        input.modelId,
        operationId,
        purpose,
        status,
        storageKey,
        "a".repeat(64),
        status === "attached" ? purpose : null,
        status === "attached" ? entityId : null,
        status === "attached" ? new Date() : null,
        input.ageMinutes ?? 0,
        input.ageMinutes ?? 0,
      ],
    );
    return { id, entityId, operationId, purpose, status, storageKey };
  }

  async function one(sql: string, params: unknown[] = []) {
    const [rows] = await connection.execute<RowDataPacket[]>(sql, params);
    return rows[0] ?? null;
  }

  it("free-fails a stale claim and holds private cleanup without attempt burn before the adapter", async () => {
    const { userId, modelId } = await createOwnerAndModel();
    const operationId = randomUUID();
    const receipt = await insertReceipt({
      userId,
      modelId,
      operationId,
      ageMinutes: 20,
    });
    await connection.execute(
      `INSERT INTO generation_operations
        (id, userId, clientRequestId, kind, modelId, payloadHash, status,
         plannedCredits, chargedCredits, refundedCredits, createdAt, updatedAt)
       VALUES (?, ?, ?, 'evidence_plate_ingest', ?, ?, 'claimed', 0, 0, 0,
         DATE_SUB(NOW(), INTERVAL 20 MINUTE), DATE_SUB(NOW(), INTERVAL 20 MINUTE))`,
      [operationId, userId, randomUUID(), modelId, "b".repeat(64)],
    );

    expect(await recovery.planNextEvidenceIngestionCleanup()).toBeNull();
    const swept = await operationRecovery.sweepStaleGenerationOperations({
      now: new Date(),
      limit: 5,
    });
    expect(swept.resolved).toBe(1);
    expect((await one(
      "SELECT status, chargedCredits, refundedCredits FROM generation_operations WHERE id = ?",
      [operationId],
    ))).toEqual({ status: "failed", chargedCredits: 0, refundedCredits: 0 });

    const planned = await recovery.planNextEvidenceIngestionCleanup();
    expect(planned).toMatchObject({ receiptId: receipt.id, storageKey: receipt.storageKey });
    const deleteObject = vi.fn(async () => ({ success: true }));
    const processed = await cleanupWorker.processNextStorageCleanupBatch({ deleteObject });
    expect(processed).toMatchObject({ claimed: false, deleted: 0 });
    expect(deleteObject).not.toHaveBeenCalled();
    expect(await one(
      "SELECT storageBackend, status, attempts FROM storage_cleanup_items WHERE batchId = ?",
      [planned?.batchId],
    )).toEqual({
      storageBackend: "private_evidence_r2",
      status: "pending",
      attempts: 0,
    });
    expect(await recovery.settleCompletedEvidenceCleanups()).toBe(0);
    expect((await one(
      "SELECT status, cleanupBatchId FROM casting_evidence_ingestions WHERE id = ?",
      [receipt.id],
    ))).toMatchObject({ status: "cleanup_pending", cleanupBatchId: planned?.batchId });
  }, 30_000);

  it("keeps active operations out and reports adapter-pending private cleanup honestly", async () => {
    const { userId, modelId } = await createOwnerAndModel();
    for (const status of ["claimed", "recovery_required"] as const) {
      const operationId = randomUUID();
      await insertReceipt({ userId, modelId, operationId, ageMinutes: 20 });
      await connection.execute(
        `INSERT INTO generation_operations
          (id, userId, clientRequestId, kind, modelId, payloadHash, status,
           plannedCredits, chargedCredits, refundedCredits)
         VALUES (?, ?, ?, 'evidence_plate_ingest', ?, ?, ?, 0, 0, 0)`,
        [operationId, userId, randomUUID(), modelId, "c".repeat(64), status],
      );
    }
    expect(await recovery.planNextEvidenceIngestionCleanup()).toBeNull();

    await connection.execute(
      "UPDATE generation_operations SET status = 'failed'",
    );
    const planned = await recovery.planNextEvidenceIngestionCleanup();
    expect(planned).not.toBeNull();
    const processed = await cleanupWorker.processNextStorageCleanupBatch({
      maxAttempts: 1,
      deleteObject: async () => ({ success: false, retryable: false, errorCode: "REFUSED" }),
    });
    expect(processed).toMatchObject({ claimed: false, deleted: 0 });
    const health = await cleanupDb.getStorageCleanupHealth();
    expect(health.cleanupPendingEvidenceReceipts).toBe(1);
    expect(health.failedEvidenceManifests).toBe(0);
    expect(health.pendingPrivateBatches).toBe(1);
    expect(await one(
      "SELECT storageBackend, status, attempts FROM storage_cleanup_items WHERE batchId = ?",
      [planned?.batchId],
    )).toEqual({
      storageBackend: "private_evidence_r2",
      status: "pending",
      attempts: 0,
    });
    expect(await recovery.settleCompletedEvidenceCleanups()).toBe(0);
  }, 30_000);

  it("manifests and atomically removes every evidence row during final Cast deletion", async () => {
    const { userId, modelId } = await createOwnerAndModel();
    const plate = await insertReceipt({
      userId,
      modelId,
      status: "attached",
    });
    await connection.execute(
      `INSERT INTO model_reference_plates
        (id, userId, modelId, kind, storageKey, mime, width, height, byteSize,
         contentHash, createdByOperationId)
       VALUES (?, ?, ?, 'uploaded_reference', ?, 'image/webp', 640, 960, 4096, ?, ?)`,
      [plate.entityId, userId, modelId, plate.storageKey, "a".repeat(64), plate.operationId],
    );
    await connection.execute(
      `INSERT INTO model_assets
        (modelId, viewType, storageUrl, storageKey, pointsCost)
       VALUES (?, 'frontClose', ?, ?, 0)`,
      [modelId, `${PUBLIC_URL}/${plate.storageKey}`, plate.storageKey],
    );
    const crop = await insertReceipt({
      userId,
      modelId,
      purpose: "evidence_crop",
      status: "attached",
    });
    await connection.execute(
      `INSERT INTO model_evidence_crops
        (id, userId, modelId, plateId, ontologyVersion, zone, surface, side,
         sourceX, sourceY, sourceWidth, sourceHeight, sourceImageWidth,
         sourceImageHeight, storageKey, mime, width, height, byteSize,
         contentHash, cropRecipeVersion, createdByOperationId)
       VALUES (?, ?, ?, ?, 'v1', 'face', 'skin', 'front',
         0.1, 0.1, 0.5, 0.5, 640, 960, ?, 'image/webp', 320, 480, 2048, ?, 'v1', ?)`,
      [
        crop.entityId,
        userId,
        modelId,
        plate.entityId,
        crop.storageKey,
        "d".repeat(64),
        crop.operationId,
      ],
    );
    const deleteOperationId = randomUUID();
    await connection.execute(
      `INSERT INTO generation_operations
        (id, userId, clientRequestId, kind, modelId, payloadHash, status,
         plannedCredits, chargedCredits, refundedCredits, phase)
       VALUES (?, ?, ?, 'model.delete', ?, ?, 'running', 0, 0, 0, 'finalizing')`,
      [deleteOperationId, userId, randomUUID(), modelId, "e".repeat(64)],
    );
    await connection.execute(
      `INSERT INTO generation_operation_locks
        (lockKey, operationId, kind, expiresAt)
       VALUES (?, ?, 'model.delete', DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
      [`model:${modelId}`, deleteOperationId],
    );

    const result = await finalDeletion.executeFinalCastDeletion({
      userId,
      modelId,
      operationId: deleteOperationId,
      currentPublicUrl: PUBLIC_URL,
    });
    expect(result.counts).toMatchObject({
      evidenceIngestions: 2,
      referencePlates: 1,
      evidenceCrops: 1,
      assets: 1,
      cleanupObjects: 3,
    });
    expect(Number((await one(
      "SELECT COUNT(*) AS n FROM casting_evidence_ingestions WHERE modelId = ?",
      [modelId],
    ))?.n)).toBe(0);
    expect(Number((await one(
      "SELECT COUNT(*) AS n FROM model_reference_plates WHERE modelId = ?",
      [modelId],
    ))?.n)).toBe(0);
    const [manifestItems] = await connection.query<RowDataPacket[]>(
      `SELECT i.storageKey, i.storageBackend
       FROM storage_cleanup_items i
       INNER JOIN storage_cleanup_batches b ON b.id = i.batchId
       WHERE b.operationId = ?
       ORDER BY i.storageKey, i.storageBackend`,
      [deleteOperationId],
    );
    expect(manifestItems).toHaveLength(3);
    expect(manifestItems).toEqual(expect.arrayContaining([
      { storageKey: crop.storageKey, storageBackend: "private_evidence_r2" },
      { storageKey: plate.storageKey, storageBackend: "private_evidence_r2" },
      { storageKey: plate.storageKey, storageBackend: "public_r2" },
    ]));
  }, 30_000);

  it("exports owner-delivery metadata only, then account deletion manifests and removes evidence", async () => {
    const { userId, modelId } = await createOwnerAndModel();
    const plate = await insertReceipt({ userId, modelId, status: "attached" });
    await connection.execute(
      `INSERT INTO model_reference_plates
        (id, userId, modelId, kind, storageKey, mime, width, height, byteSize,
         contentHash, createdByOperationId)
       VALUES (?, ?, ?, 'uploaded_reference', ?, 'image/webp', 640, 960, 4096, ?, ?)`,
      [plate.entityId, userId, modelId, plate.storageKey, "f".repeat(64), plate.operationId],
    );
    const adapter = {
      putCanonical: vi.fn(),
      resolveOwnerDelivery: vi.fn(async (_owner: number, key: string) => `owner://${key}`),
      deleteExact: vi.fn(),
    };
    const exported = await gdpr.exportUserData(userId, adapter);
    expect(exported?.evidence.referencePlates).toEqual([expect.objectContaining({
      kind: "uploaded_reference",
      ownerDelivery: `owner://${plate.storageKey}`,
    })]);
    expect(JSON.stringify(exported?.evidence)).not.toContain("cleanupBatchId");
    expect(JSON.stringify(exported?.evidence)).not.toContain("operationId");
    expect(JSON.stringify(exported?.evidence)).not.toContain('"storageKey"');

    const deleted = await accountDeletion.deleteUserAccount(userId);
    expect(deleted.success).toBe(true);
    expect(deleted.deletedCounts).toMatchObject({
      evidenceIngestions: 1,
      referencePlates: 1,
      evidenceCrops: 0,
    });
    const [items] = await connection.query<RowDataPacket[]>(
      "SELECT storageKey, storageBackend FROM storage_cleanup_items WHERE batchId = ?",
      [deleted.cleanupBatchId],
    );
    expect(items).toContainEqual({
      storageKey: plate.storageKey,
      storageBackend: "private_evidence_r2",
    });
    expect(await one("SELECT id FROM casting_evidence_ingestions WHERE id = ?", [plate.id]))
      .toBeNull();
  }, 30_000);
});
