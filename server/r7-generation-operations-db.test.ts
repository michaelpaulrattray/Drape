/** Disposable-DB proof for migrations 0007/0008 and the durable operation contract. */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("R7 durable generation-operation foundation (disposable DB)", () => {
  let connection: Connection;
  let userId: number;
  let operations: typeof import("./db/generationOperations");
  let modelDb: typeof import("./db/models");
  let generationDb: typeof import("./db/generations");
  let creditDb: typeof import("./db/credits");
  let recovery: typeof import("./casting/operationRecovery");
  let boardOps: typeof import("./lib/boardOps");
  let mintPackage: typeof import("./casting/mintPackage");

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [columns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM generation_operations LIKE 'leaseExpiresAt'",
    );
    if (columns.length !== 1) throw new Error("Disposable database must have migration 0008 applied");
    const [inserted] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'R7 Operation Test', 1, 1)",
      [`r7-operation-${randomUUID()}`],
    );
    userId = inserted.insertId;
    await connection.execute("INSERT INTO points (userId, balance) VALUES (?, 5000)", [userId]);
    operations = await import("./db/generationOperations");
    modelDb = await import("./db/models");
    generationDb = await import("./db/generations");
    creditDb = await import("./db/credits");
    recovery = await import("./casting/operationRecovery");
    boardOps = await import("./lib/boardOps");
    mintPackage = await import("./casting/mintPackage");
  });

  beforeEach(async () => {
    await connection.execute("DELETE FROM generations WHERE userId = ?", [userId]);
    await connection.execute(
      "DELETE v FROM board_item_versions v JOIN board_items i ON i.id = v.itemId JOIN boards b ON b.id = i.boardId WHERE b.userId = ?",
      [userId],
    );
    await connection.execute(
      "DELETE i FROM board_items i JOIN boards b ON b.id = i.boardId WHERE b.userId = ?",
      [userId],
    );
    await connection.execute("DELETE FROM boards WHERE userId = ?", [userId]);
    await connection.execute(
      "DELETE a FROM model_assets a JOIN models m ON m.id = a.modelId WHERE m.userId = ?",
      [userId],
    );
    await connection.execute("DELETE FROM models WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM point_transactions WHERE userId = ?", [userId]);
    await connection.execute("UPDATE points SET balance = 5000, creditsUsed = 0 WHERE userId = ?", [userId]);
    await connection.execute(
      "DELETE l FROM generation_operation_locks l JOIN generation_operations o ON o.id = l.operationId WHERE o.userId = ?",
      [userId],
    );
    await connection.execute("DELETE FROM generation_operations WHERE userId = ?", [userId]);
  }, 30_000);

  afterAll(async () => {
    if (!connection) return;
    await connection.execute("DELETE FROM generations WHERE userId = ?", [userId]);
    await connection.execute(
      "DELETE v FROM board_item_versions v JOIN board_items i ON i.id = v.itemId JOIN boards b ON b.id = i.boardId WHERE b.userId = ?",
      [userId],
    );
    await connection.execute(
      "DELETE i FROM board_items i JOIN boards b ON b.id = i.boardId WHERE b.userId = ?",
      [userId],
    );
    await connection.execute("DELETE FROM boards WHERE userId = ?", [userId]);
    await connection.execute(
      "DELETE a FROM model_assets a JOIN models m ON m.id = a.modelId WHERE m.userId = ?",
      [userId],
    );
    await connection.execute("DELETE FROM models WHERE userId = ?", [userId]);
    await connection.execute(
      "DELETE l FROM generation_operation_locks l JOIN generation_operations o ON o.id = l.operationId WHERE o.userId = ?",
      [userId],
    );
    await connection.execute("DELETE FROM generation_operations WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM point_transactions WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM points WHERE userId = ?", [userId]);
    await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
    await connection.end();
    delete process.env.DATABASE_URL;
  });

  const claim = (clientRequestId: string, payload: unknown = { modelId: 44 }) =>
    operations.claimGenerationOperation({
      userId,
      clientRequestId,
      kind: "casting.iterate",
      modelId: 44,
      payload,
    });

  async function createEmptyCastTarget(existingBoardId?: number) {
    let boardId = existingBoardId;
    if (!boardId) {
      const [board] = await connection.execute<ResultSetHeader>(
        "INSERT INTO boards (userId, name, startedWith, status) VALUES (?, 'R7 Landing Board', 'casting', 'active')",
        [userId],
      );
      boardId = board.insertId;
    }
    const [item] = await connection.execute<ResultSetHeader>(
      "INSERT INTO board_items (boardId, type, kind, label, positionX, positionY, width, height, metadata) VALUES (?, 'model', 'cast_config', 'Cast', 0, 0, 280, 420, JSON_OBJECT())",
      [boardId],
    );
    return { boardId, itemId: item.insertId };
  }

  async function createPendingLanding(input: {
    boardId: number;
    itemId: number;
    label: string;
  }) {
    const model = await modelDb.createModel({
      userId,
      name: input.label,
      masterPrompt: `${input.label} master prompt`,
      technicalSchema: {},
      preferences: {},
      status: "draft",
    });
    if (!model.modelId) throw new Error("landing model insert failed");
    const imageUrl = `https://example.com/${input.label.toLowerCase()}-${randomUUID()}.png`;
    const asset = await modelDb.createModelAsset({
      modelId: model.modelId,
      viewType: "frontClose",
      resolution: "1K",
      storageUrl: imageUrl,
      pointsCost: 0,
    });
    if (!asset.assetId) throw new Error("landing asset insert failed");
    const requestId = randomUUID();
    const claimed = await operations.claimGenerationOperation({
      userId,
      clientRequestId: requestId,
      kind: "canvas.cast",
      modelId: model.modelId,
      originBoardId: input.boardId,
      originItemId: input.itemId,
      payload: { boardId: input.boardId, itemId: input.itemId, label: input.label },
    });
    if (claimed.type !== "claimed") throw new Error("landing claim failed");
    await operations.markGenerationOperationRunning({
      userId,
      operationId: claimed.operationId,
      modelId: model.modelId,
      plannedCredits: 0,
      phase: "landing",
    });
    await operations.finalizeGenerationOperationSuccess({
      userId,
      operationId: claimed.operationId,
      result: {
        success: true,
        itemId: input.itemId,
        modelId: model.modelId,
        assetId: asset.assetId,
        imageUrl,
        creditCost: 0,
        placed: false,
      },
      chargedCredits: 0,
      refundedCredits: 0,
      landing: { status: "pending" },
    });
    return {
      operationId: claimed.operationId,
      clientRequestId: requestId,
      modelId: model.modelId,
      assetId: asset.assetId,
      imageUrl,
    };
  }

  it("creates one receipt for twenty concurrent identical claims", async () => {
    const clientRequestId = randomUUID();
    const outcomes = await Promise.all(Array.from({ length: 20 }, () => claim(clientRequestId)));
    expect(outcomes.filter((outcome) => outcome.type === "claimed")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.type === "in_progress")).toHaveLength(19);
    expect(new Set(outcomes.map((outcome) => outcome.operationId))).toHaveLength(1);

    const [[row]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n, MAX(LENGTH(payloadHash)) AS hashLength FROM generation_operations WHERE userId = ? AND clientRequestId = ?",
      [userId, clientRequestId],
    );
    expect(Number(row.n)).toBe(1);
    expect(Number(row.hashLength)).toBe(64);
  }, 60_000);

  it("refuses same request id with a different trusted envelope", async () => {
    const clientRequestId = randomUUID();
    const first = await claim(clientRequestId, { feedback: "pink hair" });
    expect(first.type).toBe("claimed");
    await expect(claim(clientRequestId, { feedback: "black hair" })).resolves.toEqual({
      type: "payload_conflict",
      operationId: first.operationId,
    });
    const [[count]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM generation_operations WHERE userId = ? AND clientRequestId = ?",
      [userId, clientRequestId],
    );
    expect(Number(count.n)).toBe(1);
  });

  it("gives one of two model writers the lock and never steals an expired row", async () => {
    const first = await claim(randomUUID());
    const second = await claim(randomUUID());
    if (first.type !== "claimed" || second.type !== "claimed") throw new Error("claims failed");
    const expiredNow = new Date("2020-01-01T00:00:00Z");
    await expect(operations.acquireGenerationOperationLock({
      userId,
      operationId: first.operationId,
      kind: "casting.iterate",
      lockKey: "model:44",
      leaseMs: 1_000,
      now: expiredNow,
    })).resolves.toMatchObject({ type: "acquired", operationId: first.operationId });
    await expect(operations.acquireGenerationOperationLock({
      userId,
      operationId: second.operationId,
      kind: "casting.iterate",
      lockKey: "model:44",
    })).resolves.toEqual({
      type: "resource_busy",
      operationId: second.operationId,
      lockKey: "model:44",
      ownerOperationId: first.operationId,
    });

    const [[lock]] = await connection.query<RowDataPacket[]>(
      "SELECT operationId FROM generation_operation_locks WHERE lockKey = 'model:44'",
    );
    const [[loser]] = await connection.query<RowDataPacket[]>(
      "SELECT status, errorCode FROM generation_operations WHERE id = ?",
      [second.operationId],
    );
    expect(lock.operationId).toBe(first.operationId);
    expect(loser).toMatchObject({ status: "failed", errorCode: "CONFLICT" });
  });

  it("refuses a lock key that disagrees with the claimed resource", async () => {
    const claimed = await claim(randomUUID());
    if (claimed.type !== "claimed") throw new Error("claim failed");
    await expect(operations.acquireGenerationOperationLock({
      userId,
      operationId: claimed.operationId,
      kind: "casting.iterate",
      lockKey: "model:45",
    })).rejects.toThrow("does not match a resource in the trusted claim");
    await expect(operations.acquireGenerationOperationLock({
      userId,
      operationId: claimed.operationId,
      kind: "casting.iterate",
      lockKey: "board-item:44",
    })).rejects.toThrow("does not match a resource in the trusted claim");
  });

  it("heartbeats only the owned running receipt and renews its lock", async () => {
    const claimed = await claim(randomUUID());
    if (claimed.type !== "claimed") throw new Error("claim failed");
    await operations.acquireGenerationOperationLock({
      userId,
      operationId: claimed.operationId,
      kind: "casting.iterate",
      lockKey: "model:44",
    });
    const startedAt = new Date("2026-07-19T01:00:00.000Z");
    await operations.markGenerationOperationRunning({
      userId,
      operationId: claimed.operationId,
      modelId: 44,
      plannedCredits: 300,
      requiredLockKey: "model:44",
      phase: "generating",
      now: startedAt,
      leaseMs: 60_000,
    });
    const heartbeatAt = new Date(startedAt.getTime() + 30_000);
    await operations.heartbeatGenerationOperation({
      userId,
      operationId: claimed.operationId,
      now: heartbeatAt,
      leaseMs: 120_000,
    });
    const [[receipt]] = await connection.query<RowDataPacket[]>(
      "SELECT heartbeatAt, leaseExpiresAt, TIMESTAMPDIFF(SECOND, heartbeatAt, leaseExpiresAt) AS leaseSeconds FROM generation_operations WHERE id = ?",
      [claimed.operationId],
    );
    const [[lock]] = await connection.query<RowDataPacket[]>(
      "SELECT expiresAt FROM generation_operation_locks WHERE operationId = ?",
      [claimed.operationId],
    );
    // Railway's proxy/session timezone may render JS Date values with a
    // fixed offset; compare database-owned lease truth instead of host time.
    expect(Number(receipt.leaseSeconds)).toBe(120);
    expect(new Date(receipt.leaseExpiresAt).getTime()).toBe(new Date(lock.expiresAt).getTime());

    await operations.finalizeGenerationOperationSuccess({
      userId,
      operationId: claimed.operationId,
      result: { assetId: 1 },
      chargedCredits: 0,
      refundedCredits: 0,
    });
    await expect(operations.heartbeatGenerationOperation({ userId, operationId: claimed.operationId }))
      .rejects.toThrow("running operation");
  }, 30_000);

  it("derives monotonic parent progress from linked child attempts", async () => {
    const claimed = await claim(randomUUID());
    if (claimed.type !== "claimed") throw new Error("claim failed");
    await operations.markGenerationOperationRunning({
      userId,
      operationId: claimed.operationId,
      modelId: 44,
      plannedCredits: 600,
      phase: "refreshing",
    });
    const first = await generationDb.createGeneration({
      userId, modelId: 44, operationId: claimed.operationId,
      stepKey: "view:sideClose", viewAngle: "sideClose",
      type: "multiView", status: "processing", pointsCost: 300,
    });
    const second = await generationDb.createGeneration({
      userId, modelId: 44, operationId: claimed.operationId,
      stepKey: "view:backFull", viewAngle: "backFull",
      type: "multiView", status: "processing", pointsCost: 300,
    });
    if (!first.generationId || !second.generationId) throw new Error("child insert failed");
    await Promise.all([
      generationDb.updateGeneration(first.generationId, { status: "completed", resultUrl: "https://example.com/a.png", completedAt: new Date() }),
      generationDb.updateGeneration(second.generationId, { status: "failed", errorMessage: "failed", completedAt: new Date() }),
    ]);
    const [[receipt]] = await connection.query<RowDataPacket[]>(
      "SELECT progress FROM generation_operations WHERE id = ?",
      [claimed.operationId],
    );
    const progress = typeof receipt.progress === "string" ? JSON.parse(receipt.progress) : receipt.progress;
    expect(progress).toMatchObject({ total: 2, completed: 1, failed: 1 });
  }, 30_000);

  it("sweeps an untouched stale claim to a free terminal failure and releases its lock", async () => {
    const claimed = await claim(randomUUID());
    if (claimed.type !== "claimed") throw new Error("claim failed");
    await operations.acquireGenerationOperationLock({
      userId, operationId: claimed.operationId, kind: "casting.iterate", lockKey: "model:44",
    });
    await connection.execute(
      "UPDATE generation_operations SET updatedAt = '2020-01-01 00:00:00' WHERE id = ?",
      [claimed.operationId],
    );
    const result = await recovery.sweepStaleGenerationOperations({ limit: 5 });
    expect(result).toMatchObject({ inspected: 1, resolved: 1, recoveryRequired: 0 });
    const [[receipt]] = await connection.query<RowDataPacket[]>(
      "SELECT status, chargedCredits, refundedCredits FROM generation_operations WHERE id = ?",
      [claimed.operationId],
    );
    const [[lock]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM generation_operation_locks WHERE operationId = ?",
      [claimed.operationId],
    );
    expect(receipt).toMatchObject({ status: "failed", chargedCredits: 0, refundedCredits: 0 });
    expect(Number(lock.n)).toBe(0);
  }, 30_000);

  it("refunds one proven paid failure exactly once under concurrent adjudicators", async () => {
    const claimed = await claim(randomUUID());
    if (claimed.type !== "claimed") throw new Error("claim failed");
    await operations.acquireGenerationOperationLock({
      userId, operationId: claimed.operationId, kind: "casting.iterate", lockKey: "model:44",
    });
    const started = await operations.markGenerationOperationRunning({
      userId, operationId: claimed.operationId, modelId: 44, plannedCredits: 300,
      requiredLockKey: "model:44", phase: "generating",
    });
    const charged = await creditDb.deductCredits(
      userId, 300, "generation", "Recovery test charge", started.chargeReferenceId,
    );
    expect(charged.success).toBe(true);
    await generationDb.createGeneration({
      userId, modelId: 44, operationId: claimed.operationId,
      stepKey: "iterate", viewAngle: "frontClose", type: "iteration",
      status: "failed", pointsCost: 300, errorMessage: "provider failed", completedAt: new Date(),
    });
    await connection.execute(
      "UPDATE generation_operations SET leaseExpiresAt = '2020-01-01 00:00:00' WHERE id = ?",
      [claimed.operationId],
    );
    await Promise.all([
      recovery.sweepStaleGenerationOperations({ limit: 5 }),
      recovery.sweepStaleGenerationOperations({ limit: 5 }),
    ]);
    const [[receipt]] = await connection.query<RowDataPacket[]>(
      "SELECT status, chargedCredits, refundedCredits FROM generation_operations WHERE id = ?",
      [claimed.operationId],
    );
    const [[ledger]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n, SUM(amount) AS net FROM point_transactions WHERE userId = ?",
      [userId],
    );
    const [[balance]] = await connection.query<RowDataPacket[]>("SELECT balance FROM points WHERE userId = ?", [userId]);
    expect(receipt).toMatchObject({ status: "failed", chargedCredits: 300, refundedCredits: 300 });
    expect(Number(ledger.n)).toBe(2);
    expect(Number(ledger.net)).toBe(0);
    expect(Number(balance.balance)).toBe(5000);
  }, 60_000);

  it("finalizes a proven durable paid result without refunding it", async () => {
    const createdModel = await modelDb.createModel({
      userId,
      name: "Recovery Result",
      masterPrompt: "A recovery-test cast",
      technicalSchema: {},
      preferences: {},
      status: "draft",
    });
    if (!createdModel.modelId) throw new Error("model insert failed");
    const claimed = await operations.claimGenerationOperation({
      userId,
      clientRequestId: randomUUID(),
      kind: "casting.headshot",
      modelId: createdModel.modelId,
      payload: { modelId: createdModel.modelId },
    });
    if (claimed.type !== "claimed") throw new Error("claim failed");
    const lockKey = `model:${createdModel.modelId}`;
    await operations.acquireGenerationOperationLock({
      userId, operationId: claimed.operationId, kind: "casting.headshot", lockKey,
    });
    const started = await operations.markGenerationOperationRunning({
      userId, operationId: claimed.operationId, modelId: createdModel.modelId,
      plannedCredits: 300, requiredLockKey: lockKey, phase: "generating",
    });
    const charged = await creditDb.deductCredits(
      userId, 300, "generation", "Durable recovery test charge", started.chargeReferenceId,
    );
    expect(charged.success).toBe(true);
    const resultUrl = `https://example.com/recovered-${randomUUID()}.png`;
    const asset = await modelDb.createModelAsset({
      modelId: createdModel.modelId,
      viewType: "frontClose",
      resolution: "1K",
      storageUrl: resultUrl,
      pointsCost: 300,
    });
    if (!asset.assetId) throw new Error("asset insert failed");
    await generationDb.createGeneration({
      userId, modelId: createdModel.modelId, operationId: claimed.operationId,
      stepKey: "headshot", viewAngle: "frontClose", type: "castingImage",
      status: "completed", pointsCost: 300, resultUrl, completedAt: new Date(),
    });
    await connection.execute(
      "UPDATE generation_operations SET leaseExpiresAt = '2020-01-01 00:00:00' WHERE id = ?",
      [claimed.operationId],
    );
    const result = await recovery.sweepStaleGenerationOperations({ limit: 5 });
    expect(result).toMatchObject({ inspected: 1, resolved: 1, recoveryRequired: 0 });
    const [[receipt]] = await connection.query<RowDataPacket[]>(
      "SELECT status, result, chargedCredits, refundedCredits FROM generation_operations WHERE id = ?",
      [claimed.operationId],
    );
    const storedResult = typeof receipt.result === "string" ? JSON.parse(receipt.result) : receipt.result;
    const [[balance]] = await connection.query<RowDataPacket[]>("SELECT balance FROM points WHERE userId = ?", [userId]);
    expect(receipt).toMatchObject({ status: "succeeded", chargedCredits: 300, refundedCredits: 0 });
    expect(storedResult).toEqual({ assetId: asset.assetId });
    expect(Number(balance.balance)).toBe(4700);
  }, 60_000);

  it("scopes public operation reads and refuses acknowledgement before landing", async () => {
    const target = await createEmptyCastTarget();
    const pending = await createPendingLanding({ ...target, label: "Owned Landing" });

    await expect(operations.getPublicGenerationOperation(userId, pending.operationId))
      .resolves.toMatchObject({ operationId: pending.operationId, landingStatus: "pending" });
    await expect(operations.getPublicGenerationOperation(userId + 999_999, pending.operationId))
      .resolves.toBeNull();
    await expect(operations.getRecentPublicGenerationOperation({
      userId,
      clientRequestId: pending.clientRequestId,
    })).resolves.toMatchObject({ operationId: pending.operationId });
    await expect(operations.getRecentPublicGenerationOperation({
      userId: userId + 999_999,
      clientRequestId: pending.clientRequestId,
    })).resolves.toBeNull();
    await expect(operations.listActivePublicGenerationOperations({ userId, boardId: target.boardId }))
      .resolves.toEqual([expect.objectContaining({ operationId: pending.operationId })]);
    await expect(operations.acknowledgeGenerationOperation({ userId, operationId: pending.operationId }))
      .resolves.toEqual({ type: "landing_required" });
    await expect(operations.landGenerationOperationResult({
      userId: userId + 999_999,
      operationId: pending.operationId,
      boardId: target.boardId,
      itemId: target.itemId,
    })).resolves.toEqual({ type: "not_found" });
    const [[item]] = await connection.query<RowDataPacket[]>(
      "SELECT imageUrl, sourceModelId FROM board_items WHERE id = ?",
      [target.itemId],
    );
    expect(item).toMatchObject({ imageUrl: null, sourceModelId: null });
  }, 60_000);

  it("lands one operation exactly once across parallel callers", async () => {
    const target = await createEmptyCastTarget();
    const pending = await createPendingLanding({ ...target, label: "Parallel Landing" });
    await modelDb.createModelAsset({
      modelId: pending.modelId,
      viewType: "frontClose",
      resolution: "1K",
      storageUrl: `https://example.com/newer-${randomUUID()}.png`,
      pointsCost: 0,
    });
    const outcomes = await Promise.all(Array.from({ length: 12 }, () =>
      operations.landGenerationOperationResult({
        userId,
        operationId: pending.operationId,
        boardId: target.boardId,
        itemId: target.itemId,
      })));
    expect(outcomes.every((outcome) => outcome.type === "landed")).toBe(true);
    expect(outcomes.filter((outcome) => outcome.type === "landed" && outcome.landedNow)).toHaveLength(1);
    const [[item]] = await connection.query<RowDataPacket[]>(
      "SELECT imageUrl, sourceModelId, metadata FROM board_items WHERE id = ?",
      [target.itemId],
    );
    const [[versions]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n, MAX(version) AS maxVersion FROM board_item_versions WHERE itemId = ?",
      [target.itemId],
    );
    const [[receipt]] = await connection.query<RowDataPacket[]>(
      "SELECT landingStatus, landedItemId, landingAcknowledgedAt FROM generation_operations WHERE id = ?",
      [pending.operationId],
    );
    expect(item).toMatchObject({ imageUrl: pending.imageUrl, sourceModelId: pending.modelId });
    expect(Number(versions.n)).toBe(1);
    expect(Number(versions.maxVersion)).toBe(1);
    expect(receipt.landingStatus).toBe("landed");
    expect(Number(receipt.landedItemId)).toBe(target.itemId);
    expect(receipt.landingAcknowledgedAt).not.toBeNull();
    await expect(operations.listActivePublicGenerationOperations({ userId, boardId: target.boardId }))
      .resolves.toEqual([]);
    await expect(operations.acknowledgeGenerationOperation({ userId, operationId: pending.operationId }))
      .resolves.toMatchObject({
        type: "acknowledged",
        acknowledgedNow: false,
        operation: { landingStatus: "landed" },
      });
  }, 90_000);

  it("lets foreground close and mint reconcile an exact bridge landing without a false conflict", async () => {
    const target = await createEmptyCastTarget();
    const pending = await createPendingLanding({ ...target, label: "Foreground Race Draft" });

    await expect(operations.landGenerationOperationResult({
      userId,
      operationId: pending.operationId,
      ...target,
    })).resolves.toMatchObject({ type: "landed", landedNow: true });

    // The takeover is still open when the bridge wins. Closing it repeats the
    // same library fill and must be an idempotent reconciliation, not CONFLICT.
    await expect(boardOps.executeFillFromLibrary({
      userId,
      itemId: target.itemId,
      modelId: pending.modelId,
    })).resolves.toMatchObject({ draft: true, modelId: pending.modelId });
    let [[versionCount]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM board_item_versions WHERE itemId = ?",
      [target.itemId],
    );
    expect(Number(versionCount.n)).toBe(1);

    // Minting in the still-open takeover repeats the fill again. It must
    // remove draft provenance and sync the model name without appending a
    // pretend image version.
    await expect(mintPackage.executeMintPackage({
      userId,
      modelId: pending.modelId,
      tier: "draft",
      characterName: "Foreground Minted",
    })).resolves.toMatchObject({ minted: true, generated: [], failed: [] });
    await expect(boardOps.executeFillFromLibrary({
      userId,
      itemId: target.itemId,
      modelId: pending.modelId,
    })).resolves.toMatchObject({ draft: false, label: "Foreground Minted" });

    const [[item]] = await connection.query<RowDataPacket[]>(
      "SELECT label, imageUrl, sourceModelId, metadata FROM board_items WHERE id = ?",
      [target.itemId],
    );
    [[versionCount]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM board_item_versions WHERE itemId = ?",
      [target.itemId],
    );
    const metadata = typeof item.metadata === "string" ? JSON.parse(item.metadata) : item.metadata;
    expect(item).toMatchObject({
      label: "Foreground Minted",
      imageUrl: pending.imageUrl,
      sourceModelId: pending.modelId,
    });
    expect(metadata.provenance).toMatchObject({
      type: "library_cast",
      modelId: pending.modelId,
      viewAngle: "frontClose",
    });
    expect(metadata.provenance).not.toHaveProperty("draft");
    expect(Number(versionCount.n)).toBe(1);
  }, 90_000);

  it("gives one tab the acknowledgement ceremony for a terminal non-landing operation", async () => {
    const claimed = await claim(randomUUID(), { free: true });
    if (claimed.type !== "claimed") throw new Error("acknowledgement claim failed");
    await operations.markGenerationOperationRunning({
      userId,
      operationId: claimed.operationId,
      modelId: 44,
      plannedCredits: 0,
      phase: "finalizing",
    });
    await operations.finalizeGenerationOperationSuccess({
      userId,
      operationId: claimed.operationId,
      result: { success: true },
      chargedCredits: 0,
      refundedCredits: 0,
    });

    const outcomes = await Promise.all(Array.from({ length: 10 }, () =>
      operations.acknowledgeGenerationOperation({ userId, operationId: claimed.operationId })));
    expect(outcomes.every((outcome) => outcome.type === "acknowledged")).toBe(true);
    expect(outcomes.filter((outcome) => outcome.type === "acknowledged" && outcome.acknowledgedNow)).toHaveLength(1);
    await expect(operations.listActivePublicGenerationOperations({ userId })).resolves.toEqual([]);
  }, 60_000);

  it("recognizes an exact origin stamp committed before its terminal receipt", async () => {
    const target = await createEmptyCastTarget();
    const pending = await createPendingLanding({ ...target, label: "Committed Origin" });
    const metadata = JSON.stringify({
      provenance: { type: "library_cast", modelId: pending.modelId, viewAngle: "frontClose", draft: true },
      version: 1,
      status: null,
      isGenerating: false,
    });
    await connection.execute(
      "UPDATE board_items SET imageUrl = ?, sourceModelId = ?, metadata = ? WHERE id = ?",
      [pending.imageUrl, pending.modelId, metadata, target.itemId],
    );
    await connection.execute(
      "INSERT INTO board_item_versions (itemId, version, imageUrl, tool) VALUES (?, 1, ?, 'initial')",
      [target.itemId, pending.imageUrl],
    );

    await expect(operations.landGenerationOperationResult({
      userId,
      operationId: pending.operationId,
      ...target,
    })).resolves.toMatchObject({
      type: "landed",
      operation: { landingStatus: "landed", landedItemId: target.itemId },
    });
    const [[versions]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM board_item_versions WHERE itemId = ?",
      [target.itemId],
    );
    expect(Number(versions.n)).toBe(1);
  }, 60_000);

  it("lets only one of two operations fill the same empty node", async () => {
    const target = await createEmptyCastTarget();
    const first = await createPendingLanding({ ...target, label: "First Winner" });
    const second = await createPendingLanding({ ...target, label: "Second Winner" });
    const outcomes = await Promise.all([
      operations.landGenerationOperationResult({ userId, operationId: first.operationId, ...target }),
      operations.landGenerationOperationResult({ userId, operationId: second.operationId, ...target }),
    ]);
    expect(outcomes.map((outcome) => outcome.type).sort()).toEqual(["landed", "relink_required"]);
    const [[versions]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM board_item_versions WHERE itemId = ?",
      [target.itemId],
    );
    const [receipts] = await connection.query<RowDataPacket[]>(
      "SELECT landingStatus, landedItemId, landingAcknowledgedAt FROM generation_operations WHERE id IN (?, ?) ORDER BY landingStatus",
      [first.operationId, second.operationId],
    );
    expect(Number(versions.n)).toBe(1);
    expect(receipts.map((row) => row.landingStatus).sort()).toEqual(["landed", "relink_required"]);
    const loser = receipts.find((row) => row.landingStatus === "relink_required")!;
    expect(loser.landedItemId).toBeNull();
    expect(loser.landingAcknowledgedAt).toBeNull();
  }, 60_000);

  it("marks a vanished origin for relink and deliberately lands on another owned empty Cast node", async () => {
    const origin = await createEmptyCastTarget();
    const pending = await createPendingLanding({ ...origin, label: "Relink Result" });
    await connection.execute("DELETE FROM board_items WHERE id = ?", [origin.itemId]);
    await expect(operations.landGenerationOperationResult({
      userId,
      operationId: pending.operationId,
      boardId: origin.boardId,
      itemId: origin.itemId,
    })).resolves.toMatchObject({ type: "relink_required", operation: { landingStatus: "relink_required" } });

    const replacement = await createEmptyCastTarget(origin.boardId);
    await expect(operations.landGenerationOperationResult({
      userId,
      operationId: pending.operationId,
      boardId: replacement.boardId,
      itemId: replacement.itemId,
    })).resolves.toMatchObject({
      type: "landed",
      operation: { landingStatus: "landed", landedItemId: replacement.itemId },
    });
    const [[version]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM board_item_versions WHERE itemId = ?",
      [replacement.itemId],
    );
    expect(Number(version.n)).toBe(1);
  }, 60_000);

  it("lets one tab dismiss an unplaced result while preserving the saved model", async () => {
    const origin = await createEmptyCastTarget();
    const pending = await createPendingLanding({ ...origin, label: "Keep In Models" });
    await connection.execute("DELETE FROM board_items WHERE id = ?", [origin.itemId]);
    await operations.landGenerationOperationResult({
      userId,
      operationId: pending.operationId,
      boardId: origin.boardId,
      itemId: origin.itemId,
    });

    const outcomes = await Promise.all(Array.from({ length: 8 }, () =>
      operations.dismissGenerationOperationLanding({ userId, operationId: pending.operationId })));
    expect(outcomes.every((outcome) => outcome.type === "dismissed")).toBe(true);
    expect(outcomes.filter((outcome) => outcome.type === "dismissed" && outcome.dismissedNow)).toHaveLength(1);
    const [[model]] = await connection.query<RowDataPacket[]>(
      "SELECT id, status FROM models WHERE id = ?",
      [pending.modelId],
    );
    expect(model).toMatchObject({ id: pending.modelId, status: "draft" });
    await expect(operations.listActivePublicGenerationOperations({ userId, boardId: origin.boardId }))
      .resolves.toEqual([]);
  }, 60_000);

  it("keeps ambiguous processing work recovery-required and locked", async () => {
    const claimed = await claim(randomUUID());
    if (claimed.type !== "claimed") throw new Error("claim failed");
    await operations.acquireGenerationOperationLock({
      userId, operationId: claimed.operationId, kind: "casting.iterate", lockKey: "model:44",
    });
    await operations.markGenerationOperationRunning({
      userId, operationId: claimed.operationId, modelId: 44, plannedCredits: 300,
      requiredLockKey: "model:44", phase: "generating",
    });
    await generationDb.createGeneration({
      userId, modelId: 44, operationId: claimed.operationId,
      stepKey: "iterate", viewAngle: "frontClose", type: "iteration",
      status: "processing", pointsCost: 300,
    });
    await connection.execute(
      "UPDATE generation_operations SET leaseExpiresAt = '2020-01-01 00:00:00' WHERE id = ?",
      [claimed.operationId],
    );
    const result = await recovery.sweepStaleGenerationOperations({ limit: 5 });
    expect(result).toMatchObject({ inspected: 1, recoveryRequired: 1 });
    const [[receipt]] = await connection.query<RowDataPacket[]>(
      "SELECT status FROM generation_operations WHERE id = ?",
      [claimed.operationId],
    );
    const [[lock]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM generation_operation_locks WHERE operationId = ?",
      [claimed.operationId],
    );
    expect(receipt.status).toBe("recovery_required");
    expect(Number(lock.n)).toBe(1);
  }, 30_000);

  it("does not strand a lock when the same operation asks for a different resource", async () => {
    const claimed = await operations.claimGenerationOperation({
      userId,
      clientRequestId: randomUUID(),
      kind: "canvas.recast",
      modelId: 44,
      originItemId: 99,
      payload: { modelId: 44, originItemId: 99 },
    });
    if (claimed.type !== "claimed") throw new Error("claim failed");
    const contender = await operations.claimGenerationOperation({
      userId,
      clientRequestId: randomUUID(),
      kind: "canvas.recast",
      modelId: 45,
      originItemId: 99,
      payload: { modelId: 45, originItemId: 99 },
    });
    if (contender.type !== "claimed") throw new Error("contender claim failed");
    await operations.acquireGenerationOperationLock({
      userId,
      operationId: claimed.operationId,
      kind: "canvas.recast",
      lockKey: "model:44",
    });
    await operations.acquireGenerationOperationLock({
      userId,
      operationId: contender.operationId,
      kind: "canvas.recast",
      lockKey: "board-item:99",
    });
    await expect(operations.acquireGenerationOperationLock({
      userId,
      operationId: claimed.operationId,
      kind: "canvas.recast",
      lockKey: "board-item:99",
    })).rejects.toThrow("already owns a different resource lock");

    const [[operation]] = await connection.query<RowDataPacket[]>(
      "SELECT status FROM generation_operations WHERE id = ?",
      [claimed.operationId],
    );
    const [[lock]] = await connection.query<RowDataPacket[]>(
      "SELECT lockKey FROM generation_operation_locks WHERE operationId = ?",
      [claimed.operationId],
    );
    const [[contestedLock]] = await connection.query<RowDataPacket[]>(
      "SELECT operationId FROM generation_operation_locks WHERE lockKey = 'board-item:99'",
    );
    expect(operation.status).toBe("claimed");
    expect(lock.lockKey).toBe("model:44");
    expect(contestedLock.operationId).toBe(contender.operationId);
  });

  it("starts, finalizes and replays public success while releasing the lock atomically", async () => {
    const clientRequestId = randomUUID();
    const claimed = await claim(clientRequestId, { feedback: "pink hair", referenceImageBase64: "never persisted" });
    if (claimed.type !== "claimed") throw new Error("claim failed");
    await operations.acquireGenerationOperationLock({
      userId,
      operationId: claimed.operationId,
      kind: "casting.iterate",
      lockKey: "model:44",
    });
    const running = await operations.markGenerationOperationRunning({
      userId,
      operationId: claimed.operationId,
      modelId: 44,
      expectedIdentityRevisionId: "revision-1",
      plannedCredits: 350,
      requiredLockKey: "model:44",
    });
    expect(running.chargeReferenceId).toBe(`op:${claimed.operationId}:charge`);
    await expect(operations.markGenerationOperationRunning({
      userId,
      operationId: claimed.operationId,
      modelId: 44,
      expectedIdentityRevisionId: "revision-1",
      plannedCredits: 350,
      requiredLockKey: "model:44",
    })).resolves.toEqual(running);
    await expect(operations.markGenerationOperationRunning({
      userId,
      operationId: claimed.operationId,
      modelId: 44,
      expectedIdentityRevisionId: "revision-1",
      plannedCredits: 351,
      requiredLockKey: "model:44",
    })).rejects.toThrow("cannot change its planned credits");
    const result = { modelId: 44, assetId: 91, storageUrl: "https://assets.example/result.png" };
    await operations.finalizeGenerationOperationSuccess({
      userId,
      operationId: claimed.operationId,
      result,
      chargedCredits: 350,
      refundedCredits: 0,
    });
    await expect(claim(clientRequestId, { feedback: "pink hair", referenceImageBase64: "never persisted" }))
      .resolves.toEqual({ type: "replay_success", operationId: claimed.operationId, result });

    const [[stored]] = await connection.query<RowDataPacket[]>(
      "SELECT status, payloadHash, result FROM generation_operations WHERE id = ?",
      [claimed.operationId],
    );
    const [[lockCount]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM generation_operation_locks WHERE operationId = ?",
      [claimed.operationId],
    );
    expect(stored.status).toBe("succeeded");
    expect(JSON.stringify(stored)).not.toContain("pink hair");
    expect(JSON.stringify(stored)).not.toContain("never persisted");
    expect(Number(lockCount.n)).toBe(0);
  }, 30_000);

  it("stores partial as a first-class terminal state and replays its exact result", async () => {
    const clientRequestId = randomUUID();
    const claimed = await claim(clientRequestId, { angles: ["sideClose", "backFull"] });
    if (claimed.type !== "claimed") throw new Error("claim failed");
    await operations.markGenerationOperationRunning({
      userId,
      operationId: claimed.operationId,
      modelId: 44,
      plannedCredits: 600,
    });
    const result = { refreshedAngles: ["sideClose"], failedAngles: ["backFull"] };
    await operations.finalizeGenerationOperationSuccess({
      userId,
      operationId: claimed.operationId,
      result,
      chargedCredits: 600,
      refundedCredits: 300,
      terminalStatus: "partial",
    });
    await expect(claim(clientRequestId, { angles: ["sideClose", "backFull"] })).resolves.toEqual({
      type: "replay_success",
      operationId: claimed.operationId,
      result,
    });
    const [[stored]] = await connection.query<RowDataPacket[]>(
      "SELECT status, chargedCredits, refundedCredits, result FROM generation_operations WHERE id = ?",
      [claimed.operationId],
    );
    expect(stored).toMatchObject({ status: "partial", chargedCredits: 600, refundedCredits: 300 });
    expect(stored.result).toEqual(result);
  });

  it("links child attempts to their parent while keeping legacy rows nullable", async () => {
    const claimed = await claim(randomUUID());
    if (claimed.type !== "claimed") throw new Error("claim failed");
    const linked = await generationDb.createGeneration({
      userId,
      modelId: 44,
      operationId: claimed.operationId,
      stepKey: "view:sideClose",
      viewAngle: "sideClose",
      type: "multiView",
      status: "processing",
      pointsCost: 300,
    });
    const legacy = await generationDb.createGeneration({
      userId,
      modelId: 44,
      type: "iteration",
      status: "processing",
      pointsCost: 350,
    });
    expect(linked.success).toBe(true);
    expect(legacy.success).toBe(true);
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT operationId, stepKey, viewAngle FROM generations WHERE id IN (?, ?) ORDER BY id",
      [linked.generationId, legacy.generationId],
    );
    expect(rows).toEqual([
      { operationId: claimed.operationId, stepKey: "view:sideClose", viewAngle: "sideClose" },
      { operationId: null, stepKey: null, viewAngle: null },
    ]);
  });

  it("replays terminal failures and keeps recovery-required locks sealed", async () => {
    const failedRequestId = randomUUID();
    const failed = await claim(failedRequestId);
    if (failed.type !== "claimed") throw new Error("claim failed");
    await operations.markGenerationOperationRunning({
      userId,
      operationId: failed.operationId,
      modelId: 44,
      plannedCredits: 350,
    });
    await operations.finalizeGenerationOperationFailure({
      userId,
      operationId: failed.operationId,
      errorCode: "PRECONDITION_FAILED",
      publicMessage: "The requested edit could not be completed.",
      chargedCredits: 350,
      refundedCredits: 350,
    });
    await expect(claim(failedRequestId)).resolves.toEqual({
      type: "replay_failure",
      operationId: failed.operationId,
      errorCode: "PRECONDITION_FAILED",
      publicMessage: "The requested edit could not be completed.",
    });

    const recovery = await claim(randomUUID());
    if (recovery.type !== "claimed") throw new Error("claim failed");
    await operations.acquireGenerationOperationLock({
      userId,
      operationId: recovery.operationId,
      kind: "casting.iterate",
      lockKey: "model:44",
    });
    await operations.markGenerationOperationRunning({
      userId,
      operationId: recovery.operationId,
      modelId: 44,
      plannedCredits: 350,
      requiredLockKey: "model:44",
    });
    await operations.markGenerationOperationRecoveryRequired({
      userId,
      operationId: recovery.operationId,
      publicMessage: "Quote this operation id to support.",
      chargedCredits: 350,
      refundedCredits: 0,
    });
    const [[lockCount]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM generation_operation_locks WHERE operationId = ?",
      [recovery.operationId],
    );
    expect(Number(lockCount.n)).toBe(1);
  }, 30_000);

  it("seals a claimed operation for recovery without releasing its lock", async () => {
    const recovery = await claim(randomUUID());
    if (recovery.type !== "claimed") throw new Error("claim failed");
    await operations.acquireGenerationOperationLock({
      userId,
      operationId: recovery.operationId,
      kind: "casting.iterate",
      lockKey: "model:44",
    });
    await operations.markClaimedGenerationOperationRecoveryRequired({
      userId,
      operationId: recovery.operationId,
      publicMessage: "The refusal receipt needs support review.",
    });

    await expect(operations.getGenerationOperationOutcome(userId, recovery.operationId)).resolves.toEqual({
      type: "recovery_required",
      operationId: recovery.operationId,
      publicMessage: "The refusal receipt needs support review.",
    });
    const [[lockCount]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM generation_operation_locks WHERE operationId = ?",
      [recovery.operationId],
    );
    expect(Number(lockCount.n)).toBe(1);
  });

  it("atomically mints one clean draft exactly once under concurrent transition attempts", async () => {
    const revisionId = randomUUID();
    const [inserted] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status, identityRevisionId) VALUES (?, 'Draft', '{}', JSON_OBJECT(), JSON_OBJECT(), 'draft', ?)",
      [userId, revisionId],
    );
    const modelId = inserted.insertId;
    try {
      const outcomes = await Promise.all(Array.from({ length: 20 }, (_, index) =>
        modelDb.mintModelAtomically({
          modelId,
          userId,
          agencyId: `MOD-R7-${String(index).padStart(2, "0")}`,
          name: `Mint winner ${index}`,
          expectedIdentityRevisionId: revisionId,
        })));
      expect(outcomes.filter((outcome) => outcome.success)).toHaveLength(1);
      expect(outcomes.filter((outcome) => !outcome.success)).toHaveLength(19);

      const [[stored]] = await connection.query<RowDataPacket[]>(
        "SELECT name, agencyId, status, mintedAt, identityRevisionId FROM models WHERE id = ?",
        [modelId],
      );
      expect(stored.status).toBe("active");
      expect(stored.mintedAt).not.toBeNull();
      expect(stored.identityRevisionId).toBe(revisionId);
      expect(String(stored.name)).toMatch(/^Mint winner \d+$/);
      expect(String(stored.agencyId)).toMatch(/^MOD-R7-\d{2}$/);
    } finally {
      await connection.execute("DELETE FROM models WHERE id = ?", [modelId]);
    }
  }, 30_000);

  it("allows only one concurrent terminal state transition", async () => {
    const claimed = await claim(randomUUID());
    if (claimed.type !== "claimed") throw new Error("claim failed");
    await operations.markGenerationOperationRunning({
      userId,
      operationId: claimed.operationId,
      modelId: 44,
      plannedCredits: 0,
    });
    const outcomes = await Promise.allSettled([
      operations.finalizeGenerationOperationSuccess({
        userId,
        operationId: claimed.operationId,
        result: { modelId: 44 },
        chargedCredits: 0,
        refundedCredits: 0,
      }),
      operations.finalizeGenerationOperationFailure({
        userId,
        operationId: claimed.operationId,
        errorCode: "INTERNAL_SERVER_ERROR",
        publicMessage: "The operation failed.",
        chargedCredits: 0,
        refundedCredits: 0,
      }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
  });

  it("rolls the terminal receipt back when lock release fails", async () => {
    const claimed = await claim(randomUUID());
    if (claimed.type !== "claimed") throw new Error("claim failed");
    await operations.acquireGenerationOperationLock({
      userId,
      operationId: claimed.operationId,
      kind: "casting.iterate",
      lockKey: "model:44",
    });
    await operations.markGenerationOperationRunning({
      userId,
      operationId: claimed.operationId,
      modelId: 44,
      plannedCredits: 0,
      requiredLockKey: "model:44",
    });

    await connection.query(`
      CREATE TRIGGER r7_fail_lock_delete
      BEFORE DELETE ON generation_operation_locks
      FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected lock release failure'
    `);
    try {
      await expect(operations.finalizeGenerationOperationSuccess({
        userId,
        operationId: claimed.operationId,
        result: { modelId: 44 },
        chargedCredits: 0,
        refundedCredits: 0,
      })).rejects.toThrow();
    } finally {
      await connection.query("DROP TRIGGER IF EXISTS r7_fail_lock_delete");
    }

    const [[operation]] = await connection.query<RowDataPacket[]>(
      "SELECT status, result, completedAt FROM generation_operations WHERE id = ?",
      [claimed.operationId],
    );
    const [[lock]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM generation_operation_locks WHERE operationId = ?",
      [claimed.operationId],
    );
    expect(operation).toMatchObject({ status: "running", result: null, completedAt: null });
    expect(Number(lock.n)).toBe(1);
  }, 30_000);

  it("refuses terminal accounting above the server-planned price", async () => {
    const claimed = await claim(randomUUID());
    if (claimed.type !== "claimed") throw new Error("claim failed");
    await operations.markGenerationOperationRunning({
      userId,
      operationId: claimed.operationId,
      modelId: 44,
      plannedCredits: 300,
    });
    await expect(operations.finalizeGenerationOperationSuccess({
      userId,
      operationId: claimed.operationId,
      result: { modelId: 44 },
      chargedCredits: 350,
      refundedCredits: 0,
    })).rejects.toThrow("exceed its server-planned total");
    await expect(operations.getGenerationOperationOutcome(userId, claimed.operationId))
      .resolves.toMatchObject({ type: "in_progress", status: "running" });
  });

  it("leaves the pre-0008 runtime insert shape compatible with the additive schema", async () => {
    const [inserted] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'Legacy runtime model', '{}', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
      [userId],
    );
    expect(inserted.insertId).toBeGreaterThan(0);
    await connection.execute("DELETE FROM models WHERE id = ?", [inserted.insertId]);
  });
});
