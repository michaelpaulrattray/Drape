import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashGenerationOperationClaim } from "./casting/operationContract";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const R2 = "https://pub-r7-5c-test.r2.dev";

describeWithDatabase("R7-5C atomic final Cast deletion (disposable DB)", () => {
  let connection: Connection;
  let deletion: typeof import("./casting/finalCastDeletion");
  let modelsDb: typeof import("./db/models");
  let wardrobeDb: typeof import("./db/wardrobe");
  let boardsDb: typeof import("./db/boards");
  let bugReportsDb: typeof import("./db/bugReports");
  let operationsDb: typeof import("./db/generationOperations");

  beforeAll(async () => {
    const parsed = new URL(testDatabaseUrl!);
    if (!parsed.pathname.slice(1).startsWith("drape_r7_5c_disposable_")) {
      throw new Error("R7-5C DB tests require the guarded disposable database");
    }
    process.env.DATABASE_URL = testDatabaseUrl!;
    process.env.R2_PUBLIC_URL = R2;
    connection = await mysql.createConnection(testDatabaseUrl!);
    deletion = await import("./casting/finalCastDeletion");
    modelsDb = await import("./db/models");
    wardrobeDb = await import("./db/wardrobe");
    boardsDb = await import("./db/boards");
    bugReportsDb = await import("./db/bugReports");
    operationsDb = await import("./db/generationOperations");
  });

  beforeEach(async () => {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of [
      "storage_cleanup_items", "storage_cleanup_batches", "generation_operation_locks",
      "generation_operations", "audit_logs", "bug_reports",
      "board_edges", "board_item_versions", "board_items", "boards", "wardrobe_looks",
      "wardrobe_sessions", "model_package_snapshot_slots", "model_package_snapshots",
      "model_identity_snapshots", "model_assets", "generations", "models", "users",
    ]) await connection.query(`TRUNCATE TABLE \`${table}\``);
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  }, 60_000);

  afterAll(async () => {
    await connection?.end();
    delete process.env.DATABASE_URL;
    delete process.env.R2_PUBLIC_URL;
  });

  async function createUser(): Promise<number> {
    const [inserted] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Delete test', 1, 1)",
      [`r7-5c-${randomUUID()}`],
    );
    return inserted.insertId;
  }

  async function createModel(userId: number, status: "draft" | "active" | "locked" = "draft") {
    const [inserted] = await connection.execute<ResultSetHeader>(
      `INSERT INTO models
        (userId, agencyId, name, masterPrompt, technicalSchema, preferences, status, identityRevisionId, mintedAt)
       VALUES (?, ?, 'Delete Me', 'identity prose', JSON_OBJECT('face', 'evidence'),
         JSON_OBJECT('referenceImage', ?), ?, 'revision-secret', ?)`,
      [
        userId,
        status === "draft" ? null : `MOD-${randomUUID().slice(0, 8)}`,
        `${R2}/models/${userId}/reference.png`,
        status,
        status === "draft" ? null : new Date(),
      ],
    );
    return inserted.insertId;
  }

  async function createRunningDelete(
    userId: number,
    modelId: number,
    identity?: { clientRequestId: string; payloadHash: string },
  ) {
    const operationId = randomUUID();
    const clientRequestId = identity?.clientRequestId ?? randomUUID();
    await connection.execute(
      `INSERT INTO generation_operations
        (id, userId, clientRequestId, kind, modelId, payloadHash, status, plannedCredits, chargedCredits,
         refundedCredits, chargeReferenceId, phase, heartbeatAt, leaseExpiresAt)
       VALUES (?, ?, ?, 'model.delete', ?, ?, 'running', 0, 0, 0, ?, 'finalizing', NOW(), DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
      [operationId, userId, clientRequestId, modelId, identity?.payloadHash ?? "d".repeat(64), `op:${operationId}:charge`],
    );
    await connection.execute(
      "INSERT INTO generation_operation_locks (lockKey, operationId, kind, expiresAt) VALUES (?, ?, 'model.delete', DATE_ADD(NOW(), INTERVAL 15 MINUTE))",
      [`model:${modelId}`, operationId],
    );
    return operationId;
  }

  async function row(sql: string, params: unknown[] = []) {
    const [rows] = await connection.execute<RowDataPacket[]>(sql, params);
    return rows[0] ?? null;
  }

  async function count(table: string, where = "1=1", params: unknown[] = []) {
    const result = await row(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, params);
    return Number(result?.n ?? 0);
  }

  async function pause(ms = 100) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  it("atomically removes dependencies, repairs Canvas truth, scrubs receipts and preserves independent work", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    const headUrl = `${R2}/models/${userId}/head.png`;
    const backUrl = `${R2}/models/${userId}/back.png`;
    const sharedMetadataUrl = `${R2}/shared/reference-input.png`;
    await connection.execute(
      `INSERT INTO model_assets (modelId, viewType, storageUrl, storageKey, pointsCost)
       VALUES (?, 'frontClose', ?, ?, 350), (?, 'backFull', ?, NULL, 300)`,
      [modelId, headUrl, `models/${userId}/head.png`, modelId, backUrl],
    );
    const headAsset = await row(
      "SELECT id FROM model_assets WHERE modelId = ? AND viewType = 'frontClose'",
      [modelId],
    );
    const backAsset = await row(
      "SELECT id FROM model_assets WHERE modelId = ? AND viewType = 'backFull'",
      [modelId],
    );
    const identitySnapshotId = randomUUID();
    const packageSnapshotId = randomUUID();
    await connection.execute(
      `INSERT INTO model_identity_snapshots
        (id, modelId, sequence, reason, masterPrompt, technicalSchema, preferences,
         identityText, identityTextHash, anchorAssetId, recipeVersion)
       VALUES (?, ?, 1, 'bootstrap', 'identity prose', JSON_OBJECT('face', 'evidence'),
         JSON_OBJECT(), 'identity prose', ?, ?, 'r7-test')`,
      [identitySnapshotId, modelId, "a".repeat(64), headAsset.id],
    );
    await connection.execute(
      `INSERT INTO model_package_snapshots
        (id, modelId, identitySnapshotId, sequence, reason)
       VALUES (?, ?, ?, 1, 'bootstrap')`,
      [packageSnapshotId, modelId, identitySnapshotId],
    );
    await connection.execute(
      `INSERT INTO model_package_snapshot_slots
        (id, packageSnapshotId, viewAngle, selectedAssetId, compatibility, selectionReason)
       VALUES (?, ?, 'frontClose', ?, 'current', 'bootstrap'),
              (?, ?, 'backFull', ?, 'current', 'bootstrap')`,
      [randomUUID(), packageSnapshotId, headAsset.id, randomUUID(), packageSnapshotId, backAsset.id],
    );
    await connection.execute(
      `UPDATE models
       SET currentPackageSnapshotId = ?, stateVersion = 1
       WHERE id = ?`,
      [packageSnapshotId, modelId],
    );
    await connection.execute(
      `INSERT INTO generations (userId, modelId, type, status, pointsCost, resultUrl, errorMessage, metadata)
       VALUES (?, ?, 'iteration', 'completed', 350, ?, ?, JSON_OBJECT('input', ?))`,
      [userId, modelId, `${R2}/models/${userId}/attempt.png`, `saved ${sharedMetadataUrl}`, sharedMetadataUrl],
    );
    const priorOperationId = randomUUID();
    const priorRequestId = randomUUID();
    await connection.execute(
      `INSERT INTO generation_operations
        (id, userId, clientRequestId, kind, modelId, payloadHash, status, plannedCredits, chargedCredits,
         refundedCredits, chargeReferenceId, result, publicMessage, completedAt)
       VALUES (?, ?, ?, 'casting.iterate', ?, ?, 'succeeded', 350, 350, 0, ?, JSON_OBJECT('assetUrl', ?), ?, NOW())`,
      [
        priorOperationId, userId, priorRequestId, modelId, "a".repeat(64),
        `op:${priorOperationId}:charge`, sharedMetadataUrl, `See ${sharedMetadataUrl}`,
      ],
    );
    await connection.execute(
      `UPDATE generation_operations
       SET expectedStateVersion = 1, expectedIdentitySnapshotId = ?, expectedPackageSnapshotId = ?
       WHERE id = ?`,
      [identitySnapshotId, packageSnapshotId, priorOperationId],
    );
    const unboundOperationId = randomUUID();
    await connection.execute(
      `INSERT INTO generation_operations
        (id, userId, clientRequestId, kind, modelId, payloadHash, status, plannedCredits, chargedCredits, refundedCredits)
       VALUES (?, ?, ?, 'casting.headshot', NULL, ?, 'running', 350, 0, 0)`,
      [unboundOperationId, userId, randomUUID(), "b".repeat(64)],
    );
    await connection.execute(
      `INSERT INTO wardrobe_sessions (userId, modelId, modelImageUrl, history, tattooMapData)
       VALUES (?, ?, ?, JSON_ARRAY(?), JSON_OBJECT('map', ?))`,
      [userId, modelId, sharedMetadataUrl, `${R2}/models/${userId}/wardrobe-history.png`, sharedMetadataUrl],
    );
    const session = await row("SELECT id FROM wardrobe_sessions WHERE modelId = ?", [modelId]);
    await connection.execute(
      `INSERT INTO wardrobe_looks (userId, sessionId, modelId, imageUrl, name)
       VALUES (?, ?, ?, ?, 'Saved look')`,
      [userId, session.id, modelId, `${R2}/models/${userId}/look.png`],
    );
    await connection.execute(
      "INSERT INTO bug_reports (userId, description, modelId) VALUES (?, 'A sufficiently detailed report', ?)",
      [userId, modelId],
    );
    await connection.execute(
      `INSERT INTO audit_logs (userId, action, resourceType, resourceId, metadata)
       VALUES (?, 'model.deleted', 'model', ?, JSON_OBJECT('modelName', 'Delete Me', 'agencyId', 'secret'))`,
      [userId, String(modelId)],
    );

    const [boardA] = await connection.execute<ResultSetHeader>(
      "INSERT INTO boards (userId, name, thumbnailUrl, thumbnailKey, startedWith) VALUES (?, 'Linked', ?, ?, 'casting')",
      [userId, headUrl, "shared/unrelated-thumbnail.png"],
    );
    const [linked] = await connection.execute<ResultSetHeader>(
      `INSERT INTO board_items
        (boardId, type, kind, label, imageUrl, imageKey, sourceModelId, metadata)
       VALUES (?, 'model', 'cast_config', 'Delete Me', ?, ?, ?, JSON_OBJECT('provenance', JSON_OBJECT('type','cast_root','modelId',?)))`,
      [boardA.insertId, headUrl, `models/${userId}/head.png`, modelId, modelId],
    );
    await connection.execute(
      "INSERT INTO board_item_versions (itemId, version, imageUrl, tool) VALUES (?, 1, ?, 'initial')",
      [linked.insertId, headUrl],
    );
    const [downstream] = await connection.execute<ResultSetHeader>(
      `INSERT INTO board_items (boardId, type, kind, label, imageUrl, metadata)
       VALUES (?, 'iteration', 'image', 'Independent output', ?, JSON_OBJECT())`,
      [boardA.insertId, `${R2}/independent/downstream.png`],
    );
    await connection.execute(
      "INSERT INTO board_edges (boardId, sourceItemId, targetItemId, relation) VALUES (?, ?, ?, 'generated_from_cast')",
      [boardA.insertId, linked.insertId, downstream.insertId],
    );

    const [boardB] = await connection.execute<ResultSetHeader>(
      "INSERT INTO boards (userId, name, thumbnailUrl, startedWith) VALUES (?, 'History', ?, 'blank')",
      [userId, backUrl],
    );
    const [copied] = await connection.execute<ResultSetHeader>(
      `INSERT INTO board_items (boardId, type, kind, label, imageUrl, metadata)
       VALUES (?, 'iteration', 'image', 'Copied then edited', ?, JSON_OBJECT('reference', ?))`,
      [boardB.insertId, backUrl, headUrl],
    );
    const independentUrl = `${R2}/independent/original.png`;
    await connection.execute(
      `INSERT INTO board_item_versions (itemId, version, imageUrl, tool)
       VALUES (?, 1, ?, 'initial'), (?, 2, ?, 'chat')`,
      [copied.insertId, independentUrl, copied.insertId, backUrl],
    );
    const [historyOnly] = await connection.execute<ResultSetHeader>(
      `INSERT INTO board_items (boardId, type, kind, label, imageUrl, metadata)
       VALUES (?, 'iteration', 'image', 'Independent current', ?, JSON_OBJECT())`,
      [boardB.insertId, `${R2}/independent/current.png`],
    );
    await connection.execute(
      `INSERT INTO board_item_versions (itemId, version, imageUrl, tool)
       VALUES (?, 1, ?, 'initial'), (?, 2, ?, 'chat')`,
      [historyOnly.insertId, headUrl, historyOnly.insertId, `${R2}/independent/current.png`],
    );

    await expect(deletion.planFinalCastDeletion({ userId, modelId })).resolves.toEqual({
      castViews: 2,
      canvasPlacements: 1,
      affectedBoards: 2,
      wardrobeSessions: 1,
      wardrobeLooks: 1,
    });

    const deleteRequestId = randomUUID();
    const deletePayload = { modelId };
    const operationId = await createRunningDelete(userId, modelId, {
      clientRequestId: deleteRequestId,
      payloadHash: hashGenerationOperationClaim({
        clientRequestId: deleteRequestId,
        kind: "model.delete",
        modelId,
        payload: deletePayload,
      }),
    });
    const result = await deletion.executeFinalCastDeletion({ userId, modelId, operationId, currentPublicUrl: R2 });
    expect(result.deleted).toBe(true);
    expect(result.counts).toMatchObject({
      assets: 2, identitySnapshots: 1, packageSnapshots: 1, snapshotSlots: 2,
      canvasItems: 1, affectedBoards: 2, wardrobeSessions: 1,
      wardrobeLooks: 1, generationAttempts: 1, priorOperations: 1, bugReportsScrubbed: 1,
    });

    expect(await row("SELECT status, deletedAt, agencyId, name, masterPrompt, technicalSchema, preferences, identityRevisionId, currentPackageSnapshotId, stateVersion, sealedIdentitySnapshotId, sealedPackageSnapshotId, mintedAt FROM models WHERE id = ?", [modelId]))
      .toMatchObject({
        status: "archived", agencyId: null, name: null, masterPrompt: "[deleted]",
        identityRevisionId: null, currentPackageSnapshotId: null, stateVersion: 0,
        sealedIdentitySnapshotId: null, sealedPackageSnapshotId: null, mintedAt: null,
      });
    expect(await count("model_package_snapshot_slots", "packageSnapshotId = ?", [packageSnapshotId])).toBe(0);
    expect(await count("model_package_snapshots", "modelId = ?", [modelId])).toBe(0);
    expect(await count("model_identity_snapshots", "modelId = ?", [modelId])).toBe(0);
    expect(await count("model_assets", "modelId = ?", [modelId])).toBe(0);
    expect(await count("wardrobe_sessions", "modelId = ?", [modelId])).toBe(0);
    expect(await count("wardrobe_looks", "modelId = ?", [modelId])).toBe(0);
    expect(await count("board_items", "id = ?", [linked.insertId])).toBe(0);
    expect(await count("board_edges", "sourceItemId = ? OR targetItemId = ?", [linked.insertId, linked.insertId])).toBe(0);
    expect(await count("board_items", "id = ?", [downstream.insertId])).toBe(1);
    expect(await row("SELECT imageUrl FROM board_items WHERE id = ?", [copied.insertId]))
      .toEqual({ imageUrl: independentUrl });
    expect(await count("board_item_versions", "imageUrl IN (?, ?)", [headUrl, backUrl])).toBe(0);
    expect(await row("SELECT thumbnailUrl FROM boards WHERE id = ?", [boardA.insertId]))
      .toEqual({ thumbnailUrl: `${R2}/independent/downstream.png` });
    expect(await row("SELECT thumbnailUrl FROM boards WHERE id = ?", [boardB.insertId]))
      .toEqual({ thumbnailUrl: `${R2}/independent/current.png` });

    expect(await row("SELECT modelId, operationId, stepKey, viewAngle, resultUrl, errorMessage, metadata FROM generations WHERE userId = ?", [userId]))
      .toEqual({ modelId: null, operationId: null, stepKey: null, viewAngle: null, resultUrl: null, errorMessage: null, metadata: null });
    expect(await row("SELECT modelId, result, publicMessage, expectedIdentityRevisionId, expectedStateVersion, expectedIdentitySnapshotId, expectedPackageSnapshotId, subjectDeletedAt FROM generation_operations WHERE id = ?", [priorOperationId]))
      .toMatchObject({
        modelId: null, result: null, publicMessage: null, expectedIdentityRevisionId: null,
        expectedStateVersion: null, expectedIdentitySnapshotId: null, expectedPackageSnapshotId: null,
      });
    expect(await row("SELECT status, modelId, expectedIdentityRevisionId, expectedStateVersion, expectedIdentitySnapshotId, expectedPackageSnapshotId, chargeReferenceId, result, chargedCredits, refundedCredits, subjectDeletedAt FROM generation_operations WHERE id = ?", [operationId]))
      .toMatchObject({
        status: "succeeded", modelId: null, expectedIdentityRevisionId: null, chargeReferenceId: null,
        expectedStateVersion: null, expectedIdentitySnapshotId: null, expectedPackageSnapshotId: null,
        chargedCredits: 0, refundedCredits: 0, subjectDeletedAt: null,
      });
    expect(await operationsDb.claimGenerationOperation({
      userId,
      clientRequestId: priorRequestId,
      kind: "casting.iterate",
      modelId,
      payload: { original: true },
    })).toMatchObject({ type: "deleted_subject", operationId: priorOperationId });
    expect(await operationsDb.claimGenerationOperation({
      userId,
      clientRequestId: deleteRequestId,
      kind: "model.delete",
      modelId,
      payload: deletePayload,
    })).toMatchObject({ type: "replay_success", operationId, result: expect.objectContaining({ deleted: true }) });

    const [[manifest]] = await connection.query<RowDataPacket[]>(
      "SELECT id, expectedCount FROM storage_cleanup_batches WHERE operationId = ?",
      [operationId],
    );
    const [cleanupRows] = await connection.query<RowDataPacket[]>(
      "SELECT storageKey FROM storage_cleanup_items WHERE batchId = ? ORDER BY storageKey",
      [manifest.id],
    );
    expect(cleanupRows.map((entry) => entry.storageKey)).toEqual(Array.from(new Set(cleanupRows.map((entry) => entry.storageKey))).sort());
    expect(Number(manifest.expectedCount)).toBe(cleanupRows.length);
    const cleanupKeys = cleanupRows.map((entry) => entry.storageKey);
    expect(cleanupKeys).not.toContain("external.example/not-owned.png");
    expect(cleanupKeys).not.toContain("shared/reference-input.png");
    expect(cleanupKeys).not.toContain("shared/unrelated-thumbnail.png");
    expect(cleanupKeys).not.toContain(`models/${userId}/reference.png`);
    expect(cleanupKeys).toEqual(expect.arrayContaining([
      `models/${userId}/head.png`,
      `models/${userId}/back.png`,
      `models/${userId}/attempt.png`,
      `models/${userId}/wardrobe-history.png`,
      `models/${userId}/look.png`,
    ]));
    expect(await count("point_transactions", "userId = ?", [userId])).toBe(0);

    const retainedAudits = await connection.query<RowDataPacket[]>(
      "SELECT metadata FROM audit_logs WHERE resourceType = 'model' AND resourceId = ? ORDER BY id",
      [String(modelId)],
    );
    expect(retainedAudits[0]).toHaveLength(2);
    expect(retainedAudits[0].map((entry) => JSON.stringify(entry.metadata))).not.toEqual(
      expect.arrayContaining([expect.stringContaining("Delete Me"), expect.stringContaining("agencyId")]),
    );

    await expect(wardrobeDb.createSession({ userId, modelId, modelImageUrl: headUrl })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(wardrobeDb.saveLook({ userId, modelId, imageUrl: headUrl })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(boardsDb.addBoardItem({
      boardId: boardB.insertId, type: "model", kind: "cast_config", sourceModelId: modelId,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(boardsDb.updateBoardItem(historyOnly.insertId, {
      metadata: { provenance: { type: "library_cast", modelId, viewAngle: "frontClose" } },
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await row("SELECT sourceModelId FROM board_items WHERE id = ?", [historyOnly.insertId]))
      .toEqual({ sourceModelId: null });
    await expect(bugReportsDb.createBugReport({
      userId, modelId, description: "Cannot reattach a deleted Cast",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(operationsDb.claimGenerationOperation({
      userId, clientRequestId: randomUUID(), kind: "casting.iterate", modelId, payload: {},
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(operationsDb.bindGenerationOperationModel({
      userId, operationId: unboundOperationId, modelId,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await row("SELECT modelId FROM generation_operations WHERE id = ?", [unboundOperationId]))
      .toEqual({ modelId: null });
    await expect(modelsDb.updateModel(modelId, { name: "Resurrected" })).resolves.toMatchObject({ success: false, error: "Model not found" });
  }, 120_000);

  for (const status of ["draft", "active", "locked"] as const) {
    it(`uses the same deletion service for ${status} Casts`, async () => {
      const userId = await createUser();
      const modelId = await createModel(userId, status);
      const operationId = await createRunningDelete(userId, modelId);
      await expect(deletion.executeFinalCastDeletion({ userId, modelId, operationId, currentPublicUrl: R2 }))
        .resolves.toMatchObject({ deleted: true });
      expect(await row("SELECT status, deletedAt FROM models WHERE id = ?", [modelId]))
        .toMatchObject({ status: "archived" });
    }, 60_000);
  }

  it("refuses a foreign-owner deletion claim without creating a receipt", async () => {
    const ownerId = await createUser();
    const strangerId = await createUser();
    const modelId = await createModel(ownerId);
    await expect(operationsDb.claimGenerationOperation({
      userId: strangerId,
      clientRequestId: randomUUID(),
      kind: "model.delete",
      modelId,
      payload: { modelId },
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await count("generation_operations", "userId = ?", [strangerId])).toBe(0);
  }, 60_000);

  it("lets only one concurrent delete own the model and create a manifest", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    const first = await operationsDb.claimGenerationOperation({
      userId, clientRequestId: randomUUID(), kind: "model.delete", modelId, payload: { modelId },
    });
    const second = await operationsDb.claimGenerationOperation({
      userId, clientRequestId: randomUUID(), kind: "model.delete", modelId, payload: { modelId },
    });
    if (first.type !== "claimed" || second.type !== "claimed") throw new Error("delete claims were not created");
    const lockKey = `model:${modelId}`;
    await expect(operationsDb.acquireGenerationOperationLock({
      userId, operationId: first.operationId, kind: "model.delete", lockKey,
    })).resolves.toMatchObject({ type: "acquired" });
    await operationsDb.markGenerationOperationRunning({
      userId,
      operationId: first.operationId,
      modelId,
      plannedCredits: 0,
      requiredLockKey: lockKey,
      phase: "finalizing",
      heartbeat: false,
    });
    await expect(operationsDb.acquireGenerationOperationLock({
      userId, operationId: second.operationId, kind: "model.delete", lockKey,
    })).resolves.toMatchObject({ type: "resource_busy", ownerOperationId: first.operationId });
    await expect(deletion.executeFinalCastDeletion({
      userId, modelId, operationId: first.operationId, currentPublicUrl: R2,
    })).resolves.toMatchObject({ deleted: true });
    expect(await count("storage_cleanup_batches", "userId = ?", [userId])).toBe(1);
    expect(await row("SELECT status FROM generation_operations WHERE id = ?", [second.operationId]))
      .toEqual({ status: "failed" });
  }, 60_000);

  it("fences a rename that loses the deletion race and scrubs one that wins it", async () => {
    const userId = await createUser();

    const deleteFirstModelId = await createModel(userId);
    await connection.beginTransaction();
    await connection.execute("SELECT id FROM models WHERE id = ? FOR UPDATE", [deleteFirstModelId]);
    const losingRename = modelsDb.updateModel(deleteFirstModelId, { name: "Must not return" });
    await pause();
    await connection.execute(
      "UPDATE models SET status = 'archived', deletedAt = NOW(), name = NULL WHERE id = ?",
      [deleteFirstModelId],
    );
    await connection.commit();
    await expect(losingRename).resolves.toMatchObject({ success: false, error: "Model not found" });
    expect(await row("SELECT status, deletedAt, name FROM models WHERE id = ?", [deleteFirstModelId]))
      .toMatchObject({ status: "archived", name: null });

    const writerFirstModelId = await createModel(userId);
    const operationId = await createRunningDelete(userId, writerFirstModelId);
    await connection.beginTransaction();
    await connection.execute("SELECT id FROM models WHERE id = ? FOR UPDATE", [writerFirstModelId]);
    await connection.execute("UPDATE models SET name = 'Writer won first' WHERE id = ?", [writerFirstModelId]);
    const deletionPromise = deletion.executeFinalCastDeletion({
      userId, modelId: writerFirstModelId, operationId, currentPublicUrl: R2,
    });
    await pause();
    await connection.commit();
    await expect(deletionPromise).resolves.toMatchObject({ deleted: true });
    expect(await row("SELECT status, deletedAt, name FROM models WHERE id = ?", [writerFirstModelId]))
      .toMatchObject({ status: "archived", name: null });
  }, 60_000);

  it("refuses deletion while another model operation is unsettled", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    const activeOperationId = randomUUID();
    await connection.execute(
      `INSERT INTO generation_operations
        (id, userId, clientRequestId, kind, modelId, payloadHash, status, plannedCredits, chargedCredits, refundedCredits)
       VALUES (?, ?, ?, 'casting.headshot', ?, ?, 'running', 350, 0, 0)`,
      [activeOperationId, userId, randomUUID(), modelId, "a".repeat(64)],
    );
    const deleteOperationId = await createRunningDelete(userId, modelId);
    await expect(deletion.executeFinalCastDeletion({
      userId, modelId, operationId: deleteOperationId, currentPublicUrl: R2,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await row("SELECT status, deletedAt, name FROM models WHERE id = ?", [modelId]))
      .toEqual({ status: "draft", deletedAt: null, name: "Delete Me" });
    expect(await count("storage_cleanup_batches", "operationId = ?", [deleteOperationId])).toBe(0);
    expect(await row("SELECT status FROM generation_operations WHERE id = ?", [activeOperationId]))
      .toEqual({ status: "running" });
  }, 60_000);

  for (const failurePoint of [
    "after_manifest", "after_canvas", "after_dependencies", "before_tombstone", "before_receipt",
  ] as const) {
    it(`rolls back every row and manifest on ${failurePoint}`, async () => {
      const userId = await createUser();
      const modelId = await createModel(userId);
      await connection.execute(
        "INSERT INTO model_assets (modelId, viewType, storageUrl, storageKey, pointsCost) VALUES (?, 'frontClose', ?, ?, 350)",
        [modelId, `${R2}/rollback/${modelId}.png`, `rollback/${modelId}.png`],
      );
      const operationId = await createRunningDelete(userId, modelId);
      await expect(deletion.executeFinalCastDeletion({
        userId, modelId, operationId, currentPublicUrl: R2, failurePoint,
      })).rejects.toThrow(`Injected Cast deletion failure: ${failurePoint}`);
      expect(await row("SELECT status, deletedAt, name FROM models WHERE id = ?", [modelId]))
        .toEqual({ status: "draft", deletedAt: null, name: "Delete Me" });
      expect(await count("model_assets", "modelId = ?", [modelId])).toBe(1);
      expect(await count("storage_cleanup_batches", "operationId = ?", [operationId])).toBe(0);
      expect(await row("SELECT status FROM generation_operations WHERE id = ?", [operationId]))
        .toEqual({ status: "running" });
      expect(await count("generation_operation_locks", "operationId = ?", [operationId])).toBe(1);
    }, 60_000);
  }
});
