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
    operations = await import("./db/generationOperations");
    modelDb = await import("./db/models");
    generationDb = await import("./db/generations");
  });

  beforeEach(async () => {
    await connection.execute("DELETE FROM generations WHERE userId = ?", [userId]);
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
      "DELETE l FROM generation_operation_locks l JOIN generation_operations o ON o.id = l.operationId WHERE o.userId = ?",
      [userId],
    );
    await connection.execute("DELETE FROM generation_operations WHERE userId = ?", [userId]);
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
