import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boardItems, boardItemVersions, modelAssets, models } from "../drizzle/schema";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("R7-7A3 atomic snapshot transitions (disposable DB)", () => {
  let connection: Connection;
  let operations: typeof import("./db/generationOperations");
  let bootstrapModelSnapshot: typeof import("./casting/snapshotBootstrap").bootstrapModelSnapshot;
  let compareModelSnapshotShadow: typeof import("./casting/snapshotShadow").compareModelSnapshotShadow;
  let compareSnapshotShadowCohort: typeof import("./casting/snapshotShadow").compareSnapshotShadowCohort;
  let commitModelSnapshotTransition: typeof import("./casting/snapshotTransitions").commitModelSnapshotTransition;
  let commitDocumentCompactionSnapshot: typeof import("./casting/snapshotTransitions").commitDocumentCompactionSnapshot;
  let commitRestoredSlotSnapshot: typeof import("./casting/snapshotTransitions").commitRestoredSlotSnapshot;
  let commitHeadshotSnapshot: typeof import("./casting/snapshotTransitions").commitHeadshotSnapshot;
  let commitImageRefineSnapshot: typeof import("./casting/snapshotTransitions").commitImageRefineSnapshot;
  let commitIteratedIdentitySnapshot: typeof import("./casting/snapshotTransitions").commitIteratedIdentitySnapshot;
  let commitCanvasRecastSnapshot: typeof import("./casting/snapshotTransitions").commitCanvasRecastSnapshot;
  let commitRefreshedSlotsSnapshot: typeof import("./casting/snapshotTransitions").commitRefreshedSlotsSnapshot;
  let commitGeneratedPackageSnapshot: typeof import("./casting/snapshotTransitions").commitGeneratedPackageSnapshot;

  beforeAll(async () => {
    const parsed = new URL(testDatabaseUrl!);
    if (!parsed.pathname.slice(1).startsWith("drape_r7_7a2_disposable_")) {
      throw new Error("R7-7A3 DB tests require the guarded snapshot disposable database");
    }
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection({
      uri: testDatabaseUrl!,
      connectTimeout: 15_000,
      enableKeepAlive: true,
    });
    operations = await import("./db/generationOperations");
    ({ bootstrapModelSnapshot } = await import("./casting/snapshotBootstrap"));
    ({ compareModelSnapshotShadow, compareSnapshotShadowCohort } = await import("./casting/snapshotShadow"));
    ({
      commitModelSnapshotTransition,
      commitDocumentCompactionSnapshot,
      commitRestoredSlotSnapshot,
      commitHeadshotSnapshot,
      commitImageRefineSnapshot,
      commitIteratedIdentitySnapshot,
      commitCanvasRecastSnapshot,
      commitRefreshedSlotsSnapshot,
      commitGeneratedPackageSnapshot,
    } = await import("./casting/snapshotTransitions"));
  });

  beforeEach(async () => {
    await connection?.end().catch(() => undefined);
    connection = await mysql.createConnection({
      uri: testDatabaseUrl!,
      connectTimeout: 15_000,
      enableKeepAlive: true,
    });
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of [
      "generation_operation_locks",
      "generation_operations",
      "model_package_snapshot_slots",
      "model_package_snapshots",
      "model_identity_snapshots",
      "model_assets",
      "models",
      "board_item_versions",
      "board_edges",
      "board_items",
      "boards",
      "users",
    ]) await connection.query(`TRUNCATE TABLE \`${table}\``);
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  }, 60_000);

  afterAll(async () => {
    await connection?.end().catch(() => undefined);
    const db = await (await import("./db/connection")).getDb();
    if (db && typeof (db as { $client?: { end?: () => Promise<void> } }).$client?.end === "function") {
      await (db as { $client: { end: () => Promise<void> } }).$client.end();
    }
    delete process.env.DATABASE_URL;
  });

  async function createUser(): Promise<number> {
    const [inserted] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Transition test', 1, 1)",
      [`r7-7a3-${randomUUID()}`],
    );
    return inserted.insertId;
  }

  async function createModel(userId: number, status = "draft"): Promise<number> {
    const [inserted] = await connection.execute<ResultSetHeader>(
      `INSERT INTO models
        (userId, name, masterPrompt, technicalSchema, preferences, status)
       VALUES (?, 'Transition Cast', 'identity-v1', JSON_OBJECT('hair', 'brown'),
         JSON_OBJECT('hairColor', 'Brown'), ?)`,
      [userId, status],
    );
    return inserted.insertId;
  }

  async function addAsset(input: {
    modelId: number;
    viewAngle: "frontClose" | "sideClose" | "backFull";
    role?: "anchor" | "display";
    revisionId?: string;
    url?: string;
  }): Promise<number> {
    const [inserted] = await connection.execute<ResultSetHeader>(
      `INSERT INTO model_assets (modelId, viewType, storageUrl, pointsCost, provenance)
       VALUES (?, ?, ?, 0, ?)`,
      [
        input.modelId,
        input.viewAngle,
        input.url ?? `https://example.invalid/${randomUUID()}.png`,
        JSON.stringify({
          ...(input.role ? { identityRole: input.role } : {}),
          ...(input.revisionId ? { identityRevisionId: input.revisionId } : {}),
        }),
      ],
    );
    return inserted.insertId;
  }

  async function one(sql: string, params: unknown[] = []): Promise<RowDataPacket> {
    const [rows] = await connection.execute<RowDataPacket[]>(sql, params);
    if (!rows[0]) throw new Error("Expected one row");
    return rows[0];
  }

  async function count(table: string, where = "1=1", params: unknown[] = []): Promise<number> {
    const row = await one(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`, params);
    return Number(row.count);
  }

  async function startModelOperation(
    userId: number,
    modelId: number,
    kind: "casting.iterate" | "casting.compact" | "casting.mint" | "casting.add_views" | "casting.restore" | "casting.headshot" | "casting.refresh" | "canvas.recast" = "casting.iterate",
  ): Promise<string> {
    const claimed = await operations.claimGenerationOperation({
      userId,
      clientRequestId: randomUUID(),
      kind,
      modelId,
      payload: { modelId, feedback: "snapshot transition test" },
    });
    if (claimed.type !== "claimed") throw new Error("operation claim failed");
    const lockKey = `model:${modelId}`;
    const locked = await operations.acquireGenerationOperationLock({
      userId,
      operationId: claimed.operationId,
      kind,
      lockKey,
    });
    if (locked.type !== "acquired") throw new Error("operation lock failed");
    await operations.markGenerationOperationRunning({
      userId,
      operationId: claimed.operationId,
      modelId,
      plannedCredits: 0,
      requiredLockKey: lockKey,
      phase: "finalizing",
    });
    return claimed.operationId;
  }

  async function createBootstrappedModel(userId: number): Promise<{
    modelId: number;
    anchorAssetId: number;
    sideAssetId: number;
    identitySnapshotId: string;
    packageSnapshotId: string;
  }> {
    const modelId = await createModel(userId);
    const anchorAssetId = await addAsset({ modelId, viewAngle: "frontClose", role: "anchor" });
    const sideAssetId = await addAsset({
      modelId,
      viewAngle: "sideClose",
      revisionId: "genesis",
    });
    const head = await bootstrapModelSnapshot({ userId, modelId });
    if (head.status === "headless") throw new Error("bootstrap unexpectedly headless");
    return {
      modelId,
      anchorAssetId,
      sideAssetId,
      identitySnapshotId: head.identitySnapshotId,
      packageSnapshotId: head.packageSnapshotId,
    };
  }

  it("compares a converged head read-only without exposing identity or storage content", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const beforeModel = await one(
      `SELECT stateVersion, currentPackageSnapshotId, sealedIdentitySnapshotId,
        sealedPackageSnapshotId, masterPrompt, technicalSchema, preferences
       FROM models WHERE id = ?`,
      [base.modelId],
    );
    const beforeCounts = {
      identities: await count("model_identity_snapshots", "modelId = ?", [base.modelId]),
      packages: await count("model_package_snapshots", "modelId = ?", [base.modelId]),
      slots: await count(
        "model_package_snapshot_slots",
        "packageSnapshotId = ?",
        [base.packageSnapshotId],
      ),
      assets: await count("model_assets", "modelId = ?", [base.modelId]),
    };

    const report = await compareModelSnapshotShadow({ userId, modelId: base.modelId });

    expect(report).toMatchObject({
      modelId: base.modelId,
      parity: true,
      headState: "current",
      stateVersion: 1,
      currentPackageSnapshotId: base.packageSnapshotId,
      currentIdentitySnapshotId: base.identitySnapshotId,
      mismatchKinds: [],
    });
    expect(JSON.stringify(report)).not.toMatch(
      /identity-v1|hairColor|example\.invalid|models\/|storageKey|masterPrompt|technicalSchema|preferences/,
    );
    expect(await one(
      `SELECT stateVersion, currentPackageSnapshotId, sealedIdentitySnapshotId,
        sealedPackageSnapshotId, masterPrompt, technicalSchema, preferences
       FROM models WHERE id = ?`,
      [base.modelId],
    )).toEqual(beforeModel);
    expect({
      identities: await count("model_identity_snapshots", "modelId = ?", [base.modelId]),
      packages: await count("model_package_snapshots", "modelId = ?", [base.modelId]),
      slots: await count(
        "model_package_snapshot_slots",
        "packageSnapshotId = ?",
        [base.packageSnapshotId],
      ),
      assets: await count("model_assets", "modelId = ?", [base.modelId]),
    }).toEqual(beforeCounts);
  }, 60_000);

  it("reports legacy document and selected-slot drift using only bounded mismatch kinds and hashes", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    await connection.execute(
      "UPDATE models SET masterPrompt = 'PRIVATE DRIFTED IDENTITY DOCUMENT' WHERE id = ?",
      [base.modelId],
    );
    const newerSideId = await addAsset({
      modelId: base.modelId,
      viewAngle: "sideClose",
      url: "https://example.invalid/private-newer-side.png",
    });

    const report = await compareModelSnapshotShadow({ userId, modelId: base.modelId });

    expect(report.parity).toBe(false);
    expect(report.mismatchKinds).toEqual([
      "identity_documents",
      "slot_asset",
      "consumer_package_state",
      "consumer_mint_plan",
      "consumer_export",
      "consumer_models_registry",
    ]);
    expect(report.legacyPackage.displayedHeadshotAssetId).toBe(base.anchorAssetId);
    expect(report.legacyPackage.hash).not.toBe(report.snapshotPackage.hash);
    expect(report.legacyIdentity.hash).not.toBe(report.snapshotIdentity.hash);
    expect(JSON.stringify(report)).not.toMatch(
      /PRIVATE DRIFTED|private-newer-side|example\.invalid|storageKey|masterPrompt/,
    );
    expect(newerSideId).not.toBe(base.sideAssetId);
  }, 60_000);

  it("fails closed for cross-model selections, incomplete mint seals, and foreign owners", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const foreignUserId = await createUser();
    const foreignModelId = await createModel(foreignUserId);
    const foreignSideId = await addAsset({ modelId: foreignModelId, viewAngle: "sideClose" });
    await connection.execute(
      `UPDATE model_package_snapshot_slots
       SET selectedAssetId = ?
       WHERE packageSnapshotId = ? AND viewAngle = 'sideClose'`,
      [foreignSideId, base.packageSnapshotId],
    );
    await connection.execute(
      `UPDATE models
       SET status = 'active', sealedIdentitySnapshotId = ?, sealedPackageSnapshotId = NULL
       WHERE id = ?`,
      [base.identitySnapshotId, base.modelId],
    );

    const report = await compareModelSnapshotShadow({ userId, modelId: base.modelId });

    expect(report.parity).toBe(false);
    expect(report.mismatchKinds).toEqual([
      "slot_asset",
      "snapshot_selection_invalid",
      "seal_pointer_pair",
      "mint_seal_missing",
      "consumer_package_state",
      "consumer_mint_plan",
      "consumer_refresh_plan",
      "consumer_export",
      "consumer_models_registry",
    ]);
    await expect(compareModelSnapshotShadow({
      userId: foreignUserId,
      modelId: base.modelId,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
  }, 60_000);

  it("bounds cohort scans by user/model selectors and excludes archived or tombstoned Casts", async () => {
    const firstUserId = await createUser();
    const first = await createBootstrappedModel(firstUserId);
    const second = await createBootstrappedModel(firstUserId);
    const deleted = await createBootstrappedModel(firstUserId);
    const otherUserId = await createUser();
    const other = await createBootstrappedModel(otherUserId);
    await connection.execute("UPDATE models SET status = 'archived' WHERE id = ?", [second.modelId]);
    await connection.execute("UPDATE models SET deletedAt = NOW(3) WHERE id = ?", [deleted.modelId]);

    await expect(compareSnapshotShadowCohort({})).rejects.toThrow(
      "requires a user id or at least one model id",
    );
    expect((await compareSnapshotShadowCohort({ userId: firstUserId }))
      .map((item) => item.modelId)).toEqual([first.modelId]);
    expect((await compareSnapshotShadowCohort({
      modelIds: [other.modelId, first.modelId, other.modelId],
    })).map((item) => item.modelId)).toEqual([first.modelId, other.modelId]);
    expect((await compareSnapshotShadowCohort({
      userId: firstUserId,
      modelIds: [first.modelId, other.modelId],
    })).map((item) => item.modelId)).toEqual([first.modelId]);
  }, 60_000);

  it("creates the first headshot and initial identity/package snapshots atomically", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    const operationId = await startModelOperation(userId, modelId, "casting.headshot");

    const committed = await commitHeadshotSnapshot({
      userId,
      modelId,
      operationId,
      candidate: {
        storageUrl: "https://example.invalid/first-headshot.png",
        storageKey: "casting/first-headshot.png",
        pointsCost: 350,
        engine: "test-engine",
      },
    });

    expect(committed.result).toMatchObject({
      isReRoll: false,
      identityRevisionId: "genesis",
      staledAssetIds: [],
    });
    expect(await count("model_assets", "modelId = ?", [modelId])).toBe(1);
    expect(await count("model_identity_snapshots", "modelId = ? AND reason = 'create'", [modelId])).toBe(1);
    expect(await count("model_package_snapshots", "modelId = ? AND reason = 'create'", [modelId])).toBe(1);
    const assetRow = await one(
      "SELECT storageKey, provenance FROM model_assets WHERE id = ?",
      [committed.result.assetId],
    );
    const provenance = typeof assetRow.provenance === "string"
      ? JSON.parse(assetRow.provenance)
      : assetRow.provenance;
    expect(assetRow.storageKey).toBe("casting/first-headshot.png");
    expect(provenance).toMatchObject({
      identityRole: "anchor",
      identityRevisionId: "genesis",
      engine: "test-engine",
    });
    const modelRow = await one(
      "SELECT stateVersion, currentPackageSnapshotId, identityRevisionId FROM models WHERE id = ?",
      [modelId],
    );
    expect(Number(modelRow.stateVersion)).toBe(1);
    expect(modelRow.currentPackageSnapshotId).toBe(committed.packageSnapshotId);
    expect(modelRow.identityRevisionId).toBeNull();
  });

  it("re-rolls a draft headshot with a new revision and stale-all package truth", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    await connection.execute("UPDATE model_assets SET pinned = 1 WHERE id = ?", [base.sideAssetId]);
    const backAssetId = await addAsset({ modelId: base.modelId, viewAngle: "backFull" });
    // Converge the just-added legacy view before the receipt captures truth.
    await bootstrapModelSnapshot({ userId, modelId: base.modelId });
    const operationId = await startModelOperation(userId, base.modelId, "casting.headshot");

    const committed = await commitHeadshotSnapshot({
      userId,
      modelId: base.modelId,
      operationId,
      candidate: {
        storageUrl: "https://example.invalid/rerolled-headshot.png",
        storageKey: "casting/rerolled-headshot.png",
        pointsCost: 350,
        engine: "test-engine",
      },
    });

    expect(committed.result.isReRoll).toBe(true);
    expect(committed.result.identityRevisionId).toMatch(/^rev-/);
    expect(new Set(committed.result.staledAssetIds)).toEqual(new Set([base.sideAssetId, backAssetId]));
    const staleRows = await connection.execute<RowDataPacket[]>(
      "SELECT id, pinned, status FROM model_assets WHERE id IN (?, ?) ORDER BY id",
      [base.sideAssetId, backAssetId],
    );
    expect(staleRows[0]).toHaveLength(2);
    for (const row of staleRows[0]) {
      const status = typeof row.status === "string" ? JSON.parse(row.status) : row.status;
      expect(status?.state).toBe("stale");
    }
    expect(Number(staleRows[0].find((row) => Number(row.id) === base.sideAssetId)?.pinned)).toBe(1);
    expect(await count("model_identity_snapshots", "modelId = ? AND reason = 'anchor_reroll'", [base.modelId])).toBe(1);
    expect(await count("model_package_snapshots", "modelId = ? AND reason = 'identity_change'", [base.modelId])).toBe(1);
    const selected = await one(
      `SELECT s.selectedAssetId, s.compatibility
         FROM model_package_snapshot_slots s
        WHERE s.packageSnapshotId = ? AND s.viewAngle = 'frontClose'`,
      [committed.packageSnapshotId],
    );
    expect(Number(selected.selectedAssetId)).toBe(committed.result.assetId);
    expect(selected.compatibility).toBe("current");
    const carriedSide = await one(
      `SELECT compatibility, selectionReason
         FROM model_package_snapshot_slots
        WHERE packageSnapshotId = ? AND viewAngle = 'sideClose'`,
      [committed.packageSnapshotId],
    );
    expect(carriedSide).toMatchObject({ compatibility: "stale", selectionReason: "carried" });
  });

  it("snapshot headshot keeps the ledger transition on immutable identity documents", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const originalIdentity = await one(
      `SELECT masterPrompt, technicalSchema, preferences
         FROM model_identity_snapshots
        WHERE id = (SELECT identitySnapshotId FROM model_package_snapshots
                     WHERE id = (SELECT currentPackageSnapshotId FROM models WHERE id = ?))`,
      [base.modelId],
    );
    await connection.execute(
      `UPDATE models
          SET masterPrompt = 'drifted legacy prompt',
              technicalSchema = JSON_OBJECT('drifted', TRUE),
              preferences = JSON_OBJECT('drifted', TRUE)
        WHERE id = ?`,
      [base.modelId],
    );
    const operationId = await startModelOperation(userId, base.modelId, "casting.headshot");

    const committed = await commitHeadshotSnapshot({
      userId,
      modelId: base.modelId,
      operationId,
      readMode: "snapshot",
      candidate: {
        storageUrl: "https://example.invalid/snapshot-rerolled-headshot.png",
        storageKey: "casting/snapshot-rerolled-headshot.png",
        pointsCost: 350,
        engine: "test-engine",
      },
    });

    const modelRow = await one(
      "SELECT masterPrompt, technicalSchema, preferences FROM models WHERE id = ?",
      [base.modelId],
    );
    const newIdentity = await one(
      "SELECT masterPrompt, technicalSchema, preferences FROM model_identity_snapshots WHERE id = ?",
      [committed.identitySnapshotId],
    );
    expect(modelRow.masterPrompt).toBe(originalIdentity.masterPrompt);
    expect(newIdentity.masterPrompt).toBe(originalIdentity.masterPrompt);
    expect(modelRow.technicalSchema).toEqual(originalIdentity.technicalSchema);
    expect(newIdentity.technicalSchema).toEqual(originalIdentity.technicalSchema);
    expect(modelRow.preferences).toEqual(originalIdentity.preferences);
    expect(newIdentity.preferences).toEqual(originalIdentity.preferences);
  });

  it("commits a structured Canvas recast, stale-all snapshot and board landing atomically", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    await connection.execute("UPDATE model_assets SET pinned = 1 WHERE id = ?", [base.sideAssetId]);
    const [board] = await connection.execute<ResultSetHeader>(
      "INSERT INTO boards (userId, name, startedWith) VALUES (?, 'Recast board', 'casting')",
      [userId],
    );
    const [item] = await connection.execute<ResultSetHeader>(
      `INSERT INTO board_items
        (boardId, type, kind, label, imageUrl, sourceModelId, metadata)
       VALUES (?, 'model', 'cast_config', 'Cast', 'https://example.invalid/original.png', ?, JSON_OBJECT())`,
      [board.insertId, base.modelId],
    );
    await connection.execute(
      `INSERT INTO board_item_versions (itemId, version, imageUrl, tool)
       VALUES (?, 1, 'https://example.invalid/original.png', 'initial')`,
      [item.insertId],
    );
    const operationId = await startModelOperation(userId, base.modelId, "canvas.recast");

    const committed = await commitCanvasRecastSnapshot({
      userId,
      modelId: base.modelId,
      operationId,
      patch: {
        source: "structured",
        edits: [{
          kind: "leaf",
          leaf: "person.face.jawline",
          operation: "modify",
          value: "Sharp / Chiseled",
        }],
      },
      candidate: {
        storageUrl: "https://example.invalid/canvas-recast.png",
        storageKey: "casting/canvas-recast.png",
        pointsCost: 350,
        engine: "test-engine",
      },
      landing: async (tx) => {
        await tx.update(boardItems).set({
          imageUrl: "https://example.invalid/canvas-recast.png",
          metadata: { version: 2, isGenerating: false },
        }).where(eq(boardItems.id, item.insertId));
        await tx.insert(boardItemVersions).values({
          itemId: item.insertId,
          version: 2,
          imageUrl: "https://example.invalid/canvas-recast.png",
          tool: "attributes",
        });
      },
    });

    expect(committed.result.identityRevisionId).toMatch(/^rev-/);
    expect(committed.result.staledAssetIds).toContain(base.sideAssetId);
    expect(await count("model_identity_snapshots", "modelId = ? AND reason = 'identity_edit'", [base.modelId])).toBe(1);
    expect(await count("model_package_snapshots", "modelId = ? AND reason = 'identity_change'", [base.modelId])).toBe(1);
    const modelRow = await one("SELECT masterPrompt, preferences, stateVersion FROM models WHERE id = ?", [base.modelId]);
    const preferences = typeof modelRow.preferences === "string" ? JSON.parse(modelRow.preferences) : modelRow.preferences;
    expect(preferences.jawline).toBe("Sharp / Chiseled");
    expect(String(modelRow.masterPrompt)).toContain("Sharp / Chiseled");
    expect(Number(modelRow.stateVersion)).toBe(2);
    const assetRow = await one("SELECT storageKey, provenance FROM model_assets WHERE id = ?", [committed.result.assetId]);
    const provenance = typeof assetRow.provenance === "string" ? JSON.parse(assetRow.provenance) : assetRow.provenance;
    expect(assetRow.storageKey).toBe("casting/canvas-recast.png");
    expect(provenance).toMatchObject({
      identityRole: "anchor",
      identityEditSource: "structured",
      engine: "test-engine",
    });
    const itemRow = await one("SELECT imageUrl, metadata FROM board_items WHERE id = ?", [item.insertId]);
    expect(itemRow.imageUrl).toBe("https://example.invalid/canvas-recast.png");
    expect(await count("board_item_versions", "itemId = ?", [item.insertId])).toBe(2);
    const stale = await one("SELECT pinned, status FROM model_assets WHERE id = ?", [base.sideAssetId]);
    const staleStatus = typeof stale.status === "string" ? JSON.parse(stale.status) : stale.status;
    expect(Number(stale.pinned)).toBe(1);
    expect(staleStatus?.state).toBe("stale");
  }, 60_000);

  it("commits a Canvas reroll without changing documents", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const before = await one(
      "SELECT masterPrompt, technicalSchema, preferences FROM models WHERE id = ?",
      [base.modelId],
    );
    const operationId = await startModelOperation(userId, base.modelId, "canvas.recast");
    const committed = await commitCanvasRecastSnapshot({
      userId,
      modelId: base.modelId,
      operationId,
      patch: null,
      candidate: {
        storageUrl: "https://example.invalid/canvas-reroll.png",
        storageKey: "casting/canvas-reroll.png",
        pointsCost: 350,
        engine: "test-engine",
      },
      landing: async () => undefined,
    });
    const after = await one(
      "SELECT masterPrompt, technicalSchema, preferences FROM models WHERE id = ?",
      [base.modelId],
    );
    expect(after.masterPrompt).toBe(before.masterPrompt);
    expect(JSON.stringify(after.technicalSchema)).toBe(JSON.stringify(before.technicalSchema));
    expect(JSON.stringify(after.preferences)).toBe(JSON.stringify(before.preferences));
    expect(await count("model_identity_snapshots", "modelId = ? AND reason = 'anchor_reroll'", [base.modelId])).toBe(1);
    expect(await count("model_package_snapshots", "modelId = ? AND reason = 'identity_change'", [base.modelId])).toBe(1);
    expect(committed.result.releasedDependents).toEqual([]);
  }, 60_000);

  it("rolls the Canvas landing and identity transition back together", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const beforeModel = await one(
      "SELECT identityRevisionId, stateVersion, currentPackageSnapshotId FROM models WHERE id = ?",
      [base.modelId],
    );
    const beforeAssets = await count("model_assets", "modelId = ?", [base.modelId]);
    const beforeIdentities = await count("model_identity_snapshots", "modelId = ?", [base.modelId]);
    const beforePackages = await count("model_package_snapshots", "modelId = ?", [base.modelId]);
    const operationId = await startModelOperation(userId, base.modelId, "canvas.recast");

    await expect(commitCanvasRecastSnapshot({
      userId,
      modelId: base.modelId,
      operationId,
      patch: null,
      candidate: {
        storageUrl: "https://example.invalid/rollback-reroll.png",
        storageKey: "casting/rollback-reroll.png",
        pointsCost: 350,
      },
      landing: async () => { throw new Error("board landing failed"); },
    })).rejects.toThrow("board landing failed");

    const afterModel = await one(
      "SELECT identityRevisionId, stateVersion, currentPackageSnapshotId FROM models WHERE id = ?",
      [base.modelId],
    );
    expect(afterModel).toMatchObject(beforeModel);
    expect(await count("model_assets", "modelId = ?", [base.modelId])).toBe(beforeAssets);
    expect(await count("model_identity_snapshots", "modelId = ?", [base.modelId])).toBe(beforeIdentities);
    expect(await count("model_package_snapshots", "modelId = ?", [base.modelId])).toBe(beforePackages);
  }, 60_000);

  it("appends a package state, copies unchanged slots and advances the head once", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId);

    const committed = await commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.iterate",
      mutate: async (tx) => {
        const [inserted] = await tx.insert(modelAssets).values({
          modelId: base.modelId,
          viewType: "sideClose",
          resolution: "1K",
          storageUrl: `https://example.invalid/side-refine-${randomUUID()}.png`,
          pointsCost: 0,
        }).$returningId();
        if (!inserted?.id) throw new Error("refined asset insert failed");
        return {
          result: { assetId: inserted.id },
          transition: {
            packageReason: "image_refine" as const,
            slotChanges: [{
              viewAngle: "sideClose" as const,
              selectedAssetId: inserted.id,
              compatibility: "current" as const,
              selectionReason: "generated" as const,
            }],
          },
        };
      },
    });

    expect(committed).toMatchObject({
      modelId: base.modelId,
      identitySnapshotId: base.identitySnapshotId,
      stateVersion: 2,
      selectedSlotCount: 2,
    });
    expect(await count("model_identity_snapshots", "modelId = ?", [base.modelId])).toBe(1);
    expect(await count("model_package_snapshots", "modelId = ?", [base.modelId])).toBe(2);
    const [slots] = await connection.execute<RowDataPacket[]>(
      `SELECT viewAngle, selectedAssetId, compatibility, selectionReason, sourceSelectionId
       FROM model_package_snapshot_slots WHERE packageSnapshotId = ? ORDER BY viewAngle`,
      [committed.packageSnapshotId],
    );
    expect(slots).toHaveLength(2);
    expect(slots.find((slot) => slot.viewAngle === "frontClose")).toMatchObject({
      selectedAssetId: base.anchorAssetId,
      compatibility: "current",
      selectionReason: "carried",
    });
    expect(slots.find((slot) => slot.viewAngle === "sideClose")).toMatchObject({
      selectedAssetId: committed.result.assetId,
      compatibility: "current",
      selectionReason: "generated",
    });
    expect(slots.every((slot) => typeof slot.sourceSelectionId === "string")).toBe(true);

    let replayCallbackInvoked = false;
    await expect(commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.iterate",
      mutate: async () => {
        replayCallbackInvoked = true;
        return { result: null, transition: { packageReason: "image_refine" as const } };
      },
    })).rejects.toMatchObject({
      name: "SnapshotTransitionAlreadyCommittedError",
      packageSnapshotId: committed.packageSnapshotId,
    });
    expect(replayCallbackInvoked).toBe(false);
  }, 60_000);

  it("copy-forwards a compatible historical slot and selects it atomically", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    const anchorAssetId = await addAsset({
      modelId,
      viewAngle: "frontClose",
      role: "anchor",
      revisionId: "genesis",
    });
    const sourceAssetId = await addAsset({
      modelId,
      viewAngle: "sideClose",
      revisionId: "genesis",
      url: "https://example.invalid/side-old.png",
    });
    const currentSideAssetId = await addAsset({
      modelId,
      viewAngle: "sideClose",
      revisionId: "genesis",
      url: "https://example.invalid/side-current.png",
    });
    const head = await bootstrapModelSnapshot({ userId, modelId });
    if (head.status === "headless") throw new Error("bootstrap unexpectedly headless");
    const previousSideSlot = await one(
      `SELECT id FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'sideClose'`,
      [head.packageSnapshotId],
    );
    const operationId = await startModelOperation(userId, modelId, "casting.restore");

    const committed = await commitRestoredSlotSnapshot({
      userId,
      modelId,
      operationId,
      angle: "sideClose",
      assetId: sourceAssetId,
      readMode: "r6",
    });

    expect(committed.result.url).toBe("https://example.invalid/side-old.png");
    expect(committed.result.version).toBe(3);
    expect(committed.result.assetId).not.toBe(sourceAssetId);
    expect(committed.result.assetId).not.toBe(currentSideAssetId);
    const restoredAsset = await one("SELECT * FROM model_assets WHERE id = ?", [committed.result.assetId]);
    expect(restoredAsset.storageUrl).toBe("https://example.invalid/side-old.png");
    expect(Number(restoredAsset.pointsCost)).toBe(0);
    expect(Number(restoredAsset.pinned)).toBe(0);
    const restoredProvenance = typeof restoredAsset.provenance === "string"
      ? JSON.parse(restoredAsset.provenance)
      : restoredAsset.provenance;
    expect(restoredProvenance).toMatchObject({
      restoredFromAssetId: sourceAssetId,
      identityRole: "display",
      identityRevisionId: "genesis",
    });
    const selectedSide = await one(
      `SELECT selectedAssetId, compatibility, selectionReason, sourceSelectionId
       FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'sideClose'`,
      [committed.packageSnapshotId],
    );
    expect(Number(selectedSide.selectedAssetId)).toBe(committed.result.assetId);
    expect(selectedSide.compatibility).toBe("current");
    expect(selectedSide.selectionReason).toBe("restored");
    expect(selectedSide.sourceSelectionId).toBe(previousSideSlot.id);
    const selectedHead = await one(
      `SELECT selectedAssetId, selectionReason
       FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'frontClose'`,
      [committed.packageSnapshotId],
    );
    expect(Number(selectedHead.selectedAssetId)).toBe(anchorAssetId);
    expect(selectedHead.selectionReason).toBe("carried");
    expect(await count("model_identity_snapshots", "modelId = ?", [modelId])).toBe(1);
  }, 60_000);

  it("snapshot restore treats the package selection as current when the ledger has a newer unselected row", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    await addAsset({
      modelId,
      viewAngle: "frontClose",
      role: "anchor",
      revisionId: "genesis",
    });
    const selectedSideAssetId = await addAsset({
      modelId,
      viewAngle: "sideClose",
      revisionId: "genesis",
      url: "https://example.invalid/side-selected.png",
    });
    const head = await bootstrapModelSnapshot({ userId, modelId });
    if (head.status === "headless") throw new Error("bootstrap unexpectedly headless");
    const previousSideSlot = await one(
      `SELECT id FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'sideClose'`,
      [head.packageSnapshotId],
    );
    const newerUnselectedAssetId = await addAsset({
      modelId,
      viewAngle: "sideClose",
      revisionId: "genesis",
      url: "https://example.invalid/side-newer-unselected.png",
    });
    const operationId = await startModelOperation(userId, modelId, "casting.restore");

    const committed = await commitRestoredSlotSnapshot({
      userId,
      modelId,
      operationId,
      angle: "sideClose",
      assetId: newerUnselectedAssetId,
      readMode: "snapshot",
    });

    expect(committed.result.url).toBe("https://example.invalid/side-newer-unselected.png");
    expect(committed.result.version).toBe(3);
    expect(committed.result.assetId).not.toBe(newerUnselectedAssetId);
    const selectedSide = await one(
      `SELECT selectedAssetId, compatibility, selectionReason, sourceSelectionId
       FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'sideClose'`,
      [committed.packageSnapshotId],
    );
    expect(Number(selectedSide.selectedAssetId)).toBe(committed.result.assetId);
    expect(selectedSide.compatibility).toBe("current");
    expect(selectedSide.selectionReason).toBe("restored");
    expect(selectedSide.sourceSelectionId).toBe(previousSideSlot.id);
    expect(Number(selectedSideAssetId)).not.toBe(newerUnselectedAssetId);
    expect(await count("model_identity_snapshots", "modelId = ?", [modelId])).toBe(1);
  }, 60_000);

  it("commits every successful refreshed view in one package snapshot", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const backAssetId = await addAsset({
      modelId: base.modelId,
      viewAngle: "backFull",
      url: "https://example.invalid/back-old.png",
    });
    const converged = await bootstrapModelSnapshot({ userId, modelId: base.modelId });
    if (converged.status === "headless") throw new Error("bootstrap unexpectedly headless");
    const priorIdentitySnapshotId = converged.identitySnapshotId;
    const operationId = await startModelOperation(userId, base.modelId, "casting.refresh");

    const committed = await commitRefreshedSlotsSnapshot({
      userId,
      modelId: base.modelId,
      operationId,
      candidates: [
        {
          angle: "sideClose",
          storageUrl: "https://example.invalid/side-refreshed.png",
          storageKey: "casting/side-refreshed.png",
          engine: "test-engine",
          pointsCost: 300,
        },
        {
          angle: "backFull",
          storageUrl: "https://example.invalid/back-refreshed.png",
          storageKey: "casting/back-refreshed.png",
          engine: "test-engine",
          pointsCost: 300,
        },
      ],
    });

    expect(committed.result.refreshed).toHaveLength(2);
    expect(await count("model_identity_snapshots", "modelId = ?", [base.modelId])).toBe(1);
    const packageRow = await one(
      "SELECT reason, identitySnapshotId FROM model_package_snapshots WHERE id = ?",
      [committed.packageSnapshotId],
    );
    expect(packageRow.reason).toBe("slot_refresh");
    expect(packageRow.identitySnapshotId).toBe(priorIdentitySnapshotId);
    const [slots] = await connection.execute<RowDataPacket[]>(
      `SELECT viewAngle, selectedAssetId, compatibility, selectionReason, sourceSelectionId
       FROM model_package_snapshot_slots WHERE packageSnapshotId = ? ORDER BY viewAngle`,
      [committed.packageSnapshotId],
    );
    const byAngle = Object.fromEntries(slots.map((row) => [row.viewAngle, row]));
    expect(byAngle.frontClose.selectionReason).toBe("carried");
    expect(Number(byAngle.frontClose.selectedAssetId)).toBe(base.anchorAssetId);
    for (const angle of ["sideClose", "backFull"] as const) {
      expect(byAngle[angle]).toMatchObject({ compatibility: "current", selectionReason: "refreshed" });
      expect(Number(byAngle[angle].selectedAssetId)).not.toBe(angle === "sideClose" ? base.sideAssetId : backAssetId);
      expect(byAngle[angle].sourceSelectionId).toBeTruthy();
    }
    const [assets] = await connection.execute<RowDataPacket[]>(
      `SELECT viewType, storageKey, pointsCost, provenance FROM model_assets
       WHERE id IN (?, ?) ORDER BY viewType`,
      committed.result.refreshed.map((row) => row.assetId),
    );
    expect(assets).toHaveLength(2);
    for (const row of assets) {
      const provenance = typeof row.provenance === "string" ? JSON.parse(row.provenance) : row.provenance;
      expect(row.storageKey).toMatch(/^casting\/(side|back)-refreshed\.png$/);
      expect(Number(row.pointsCost)).toBe(300);
      expect(provenance).toMatchObject({ source: "refresh", identityRole: "display", engine: "test-engine" });
    }
  }, 60_000);

  it("rolls back every refreshed asset when one candidate cannot be persisted", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    await addAsset({ modelId: base.modelId, viewAngle: "backFull" });
    await bootstrapModelSnapshot({ userId, modelId: base.modelId });
    const operationId = await startModelOperation(userId, base.modelId, "casting.refresh");
    const beforeAssets = await count("model_assets", "modelId = ?", [base.modelId]);
    const beforePackages = await count("model_package_snapshots", "modelId = ?", [base.modelId]);
    const beforeModel = await one(
      "SELECT stateVersion, currentPackageSnapshotId FROM models WHERE id = ?",
      [base.modelId],
    );

    await expect(commitRefreshedSlotsSnapshot({
      userId,
      modelId: base.modelId,
      operationId,
      candidates: [
        {
          angle: "sideClose",
          storageUrl: "https://example.invalid/side-refreshed.png",
          storageKey: "casting/side-refreshed.png",
          pointsCost: 300,
        },
        {
          angle: "backFull",
          storageUrl: "https://example.invalid/back-refreshed.png",
          storageKey: `casting/${"x".repeat(300)}.png`,
          pointsCost: 300,
        },
      ],
    })).rejects.toThrow();

    expect(await count("model_assets", "modelId = ?", [base.modelId])).toBe(beforeAssets);
    expect(await count("model_package_snapshots", "modelId = ?", [base.modelId])).toBe(beforePackages);
    const afterModel = await one(
      "SELECT stateVersion, currentPackageSnapshotId FROM models WHERE id = ?",
      [base.modelId],
    );
    expect(Number(afterModel.stateVersion)).toBe(Number(beforeModel.stateVersion));
    expect(afterModel.currentPackageSnapshotId).toBe(beforeModel.currentPackageSnapshotId);
  }, 60_000);

  it("adds multiple draft views as one package while preserving identity truth", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId, "casting.add_views");

    const committed = await commitGeneratedPackageSnapshot({
      userId,
      modelId: base.modelId,
      operationId,
      operationKind: "casting.add_views",
      mode: "add_views",
      mintTier: "production",
      candidates: [
        {
          angle: "backFull",
          storageUrl: "https://example.invalid/back-generated.png",
          storageKey: "casting/back-generated.png",
          engine: "test-engine",
          pointsCost: 300,
        },
        {
          angle: "threeQuarter",
          storageUrl: "https://example.invalid/three-quarter-generated.png",
          storageKey: "casting/three-quarter-generated.png",
          engine: "test-engine",
          pointsCost: 300,
        },
      ],
    });

    expect(committed.result).toMatchObject({ minted: false, agencyId: null });
    expect(committed.result.generated).toHaveLength(2);
    expect(await count("model_identity_snapshots", "modelId = ?", [base.modelId])).toBe(1);
    const packageRow = await one(
      "SELECT reason, identitySnapshotId FROM model_package_snapshots WHERE id = ?",
      [committed.packageSnapshotId],
    );
    expect(packageRow).toMatchObject({ reason: "add_views", identitySnapshotId: base.identitySnapshotId });
    const [slots] = await connection.execute<RowDataPacket[]>(
      `SELECT viewAngle, compatibility, selectionReason FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? ORDER BY viewAngle`,
      [committed.packageSnapshotId],
    );
    const byAngle = Object.fromEntries(slots.map((row) => [row.viewAngle, row]));
    expect(byAngle.frontClose.selectionReason).toBe("carried");
    expect(byAngle.sideClose.selectionReason).toBe("carried");
    expect(byAngle.backFull).toMatchObject({ compatibility: "current", selectionReason: "generated" });
    expect(byAngle.threeQuarter).toMatchObject({ compatibility: "current", selectionReason: "generated" });
    const [assets] = await connection.execute<RowDataPacket[]>(
      "SELECT storageKey, provenance FROM model_assets WHERE id IN (?, ?)",
      committed.result.generated.map((row) => row.assetId),
    );
    expect(assets).toHaveLength(2);
    for (const row of assets) {
      const provenance = typeof row.provenance === "string" ? JSON.parse(row.provenance) : row.provenance;
      expect(provenance).toMatchObject({
        source: "add_views",
        mintTier: "production",
        identityRole: "display",
        engine: "test-engine",
      });
    }
  }, 60_000);

  it("mints and seals one atomic package, then appends late views against the sealed identity", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const mintOperationId = await startModelOperation(userId, base.modelId, "casting.mint");

    const minted = await commitGeneratedPackageSnapshot({
      userId,
      modelId: base.modelId,
      operationId: mintOperationId,
      operationKind: "casting.mint",
      mode: "mint",
      mintTier: "draft",
      candidates: [],
      mint: { agencyId: "MOD-27-A1B2C3", name: "Sealed Cast" },
    });

    expect(minted.result).toEqual({ generated: [], agencyId: "MOD-27-A1B2C3", minted: true });
    const mintedModel = await one(
      `SELECT name, agencyId, status, mintedAt, stateVersion, currentPackageSnapshotId,
        sealedIdentitySnapshotId, sealedPackageSnapshotId
       FROM models WHERE id = ?`,
      [base.modelId],
    );
    expect(mintedModel.name).toBe("Sealed Cast");
    expect(mintedModel.agencyId).toBe("MOD-27-A1B2C3");
    expect(mintedModel.status).toBe("active");
    expect(mintedModel.mintedAt).not.toBeNull();
    expect(Number(mintedModel.stateVersion)).toBe(2);
    expect(mintedModel.currentPackageSnapshotId).toBe(minted.packageSnapshotId);
    expect(mintedModel.sealedIdentitySnapshotId).toBe(base.identitySnapshotId);
    expect(mintedModel.sealedPackageSnapshotId).toBe(minted.packageSnapshotId);
    expect(await one("SELECT reason FROM model_package_snapshots WHERE id = ?", [minted.packageSnapshotId]))
      .toMatchObject({ reason: "mint" });
    await operations.finalizeGenerationOperationSuccess({
      userId,
      operationId: mintOperationId,
      result: { minted: true },
      chargedCredits: 0,
      refundedCredits: 0,
    });

    const lateOperationId = await startModelOperation(userId, base.modelId, "casting.add_views");
    const late = await commitGeneratedPackageSnapshot({
      userId,
      modelId: base.modelId,
      operationId: lateOperationId,
      operationKind: "casting.add_views",
      mode: "late_view",
      mintTier: "production",
      candidates: [{
        angle: "backFull",
        storageUrl: "https://example.invalid/late-back.png",
        storageKey: "casting/late-back.png",
        engine: "test-engine",
        pointsCost: 300,
      }],
    });

    expect(late.result).toMatchObject({ minted: true, agencyId: "MOD-27-A1B2C3" });
    const latePackage = await one(
      "SELECT reason, identitySnapshotId FROM model_package_snapshots WHERE id = ?",
      [late.packageSnapshotId],
    );
    expect(latePackage).toMatchObject({ reason: "late_view", identitySnapshotId: base.identitySnapshotId });
    const lateSlot = await one(
      `SELECT compatibility, selectionReason FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'backFull'`,
      [late.packageSnapshotId],
    );
    expect(lateSlot).toMatchObject({ compatibility: "current", selectionReason: "late_view" });
    const sealedAfterLate = await one(
      "SELECT sealedIdentitySnapshotId, sealedPackageSnapshotId FROM models WHERE id = ?",
      [base.modelId],
    );
    expect(sealedAfterLate.sealedIdentitySnapshotId).toBe(base.identitySnapshotId);
    expect(sealedAfterLate.sealedPackageSnapshotId).toBe(minted.packageSnapshotId);
  }, 60_000);

  it("lazily seals a legacy minted Cast before accepting a late view", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId, "active");
    await connection.execute(
      "UPDATE models SET agencyId = 'MOD-27-LEGACY', mintedAt = NOW() WHERE id = ?",
      [modelId],
    );
    await addAsset({ modelId, viewAngle: "frontClose", role: "anchor" });
    const bootstrapped = await bootstrapModelSnapshot({ userId, modelId });
    if (bootstrapped.status === "headless") throw new Error("bootstrap unexpectedly headless");
    const sealed = await one(
      "SELECT sealedIdentitySnapshotId, sealedPackageSnapshotId FROM models WHERE id = ?",
      [modelId],
    );
    expect(sealed.sealedIdentitySnapshotId).toBe(bootstrapped.identitySnapshotId);
    expect(sealed.sealedPackageSnapshotId).toBe(bootstrapped.packageSnapshotId);

    const operationId = await startModelOperation(userId, modelId, "casting.add_views");
    const late = await commitGeneratedPackageSnapshot({
      userId,
      modelId,
      operationId,
      operationKind: "casting.add_views",
      mode: "late_view",
      mintTier: "core",
      candidates: [{
        angle: "sideClose",
        storageUrl: "https://example.invalid/legacy-late-side.png",
        storageKey: "casting/legacy-late-side.png",
        pointsCost: 300,
      }],
    });
    expect(late.result).toMatchObject({ minted: true, agencyId: "MOD-27-LEGACY" });
    expect(await one("SELECT identitySnapshotId, reason FROM model_package_snapshots WHERE id = ?", [late.packageSnapshotId]))
      .toMatchObject({ identitySnapshotId: bootstrapped.identitySnapshotId, reason: "late_view" });
  }, 60_000);

  it("rolls back generated views, lifecycle, and seal pointers when mint settlement fails", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId, "casting.mint");
    const beforeAssets = await count("model_assets", "modelId = ?", [base.modelId]);

    await expect(commitGeneratedPackageSnapshot({
      userId,
      modelId: base.modelId,
      operationId,
      operationKind: "casting.mint",
      mode: "mint",
      mintTier: "core",
      candidates: [
        {
          angle: "backFull",
          storageUrl: "https://example.invalid/back-generated.png",
          storageKey: "casting/back-generated.png",
          pointsCost: 300,
        },
        {
          angle: "threeQuarter",
          storageUrl: "https://example.invalid/three-quarter-generated.png",
          storageKey: `casting/${"x".repeat(300)}.png`,
          pointsCost: 300,
        },
      ],
      mint: { agencyId: "MOD-27-FAIL00", name: "Must Roll Back" },
    })).rejects.toThrow();

    expect(await count("model_assets", "modelId = ?", [base.modelId])).toBe(beforeAssets);
    expect(await count("model_package_snapshots", "modelId = ?", [base.modelId])).toBe(1);
    const model = await one(
      `SELECT name, agencyId, status, mintedAt, stateVersion, currentPackageSnapshotId,
        sealedIdentitySnapshotId, sealedPackageSnapshotId
       FROM models WHERE id = ?`,
      [base.modelId],
    );
    expect(model.name).toBe("Transition Cast");
    expect(model.agencyId).toBeNull();
    expect(model.status).toBe("draft");
    expect(model.mintedAt).toBeNull();
    expect(Number(model.stateVersion)).toBe(1);
    expect(model.currentPackageSnapshotId).toBe(base.packageSnapshotId);
    expect(model.sealedIdentitySnapshotId).toBeNull();
    expect(model.sealedPackageSnapshotId).toBeNull();
  }, 60_000);

  it("commits an image-only refinement as one display asset and package selection", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId, "casting.iterate");

    const committed = await commitImageRefineSnapshot({
      userId,
      modelId: base.modelId,
      operationId,
      candidate: {
        targetAssetId: base.sideAssetId,
        storageUrl: "https://example.invalid/side-refined.png",
        storageKey: "models/side-refined.png",
        engine: "test",
        pointsCost: 350,
      },
      imageOnlyCategories: ["image.lighting"],
    });

    const asset = await one("SELECT * FROM model_assets WHERE id = ?", [committed.result.assetId]);
    expect(asset).toMatchObject({
      modelId: base.modelId,
      viewType: "sideClose",
      storageUrl: "https://example.invalid/side-refined.png",
      storageKey: "models/side-refined.png",
      pointsCost: 350,
    });
    const provenance = typeof asset.provenance === "string" ? JSON.parse(asset.provenance) : asset.provenance;
    expect(provenance).toMatchObject({
      identityRole: "display",
      identityRevisionId: "genesis",
      engine: "test",
      imageOnlyCategories: ["image.lighting"],
    });
    const selected = await one(
      `SELECT selectedAssetId, compatibility, selectionReason
       FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'sideClose'`,
      [committed.packageSnapshotId],
    );
    expect(selected).toMatchObject({
      selectedAssetId: committed.result.assetId,
      compatibility: "current",
      selectionReason: "generated",
    });
    expect(await one("SELECT reason, identitySnapshotId FROM model_package_snapshots WHERE id = ?", [committed.packageSnapshotId]))
      .toEqual({ reason: "image_refine", identitySnapshotId: base.identitySnapshotId });
    expect(await count("model_identity_snapshots", "modelId = ?", [base.modelId])).toBe(1);
    expect(await one("SELECT masterPrompt, identityRevisionId FROM models WHERE id = ?", [base.modelId]))
      .toEqual({ masterPrompt: "identity-v1", identityRevisionId: null });
  }, 60_000);

  it("commits a typed identity iteration with a paired head and stale carried siblings", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId, "casting.iterate");

    const committed = await commitIteratedIdentitySnapshot({
      userId,
      modelId: base.modelId,
      operationId,
      patch: {
        source: "text",
        edits: [{
          kind: "leaf",
          leaf: "person.hair.color",
          operation: "modify",
          value: { base: "Hot Pink", override: "" },
        }],
      },
      candidate: {
        targetAssetId: base.anchorAssetId,
        storageUrl: "https://example.invalid/head-pink.png",
        storageKey: "models/head-pink.png",
        engine: "test",
        pointsCost: 350,
      },
    });

    const model = await one(
      "SELECT masterPrompt, preferences, identityRevisionId, stateVersion, currentPackageSnapshotId FROM models WHERE id = ?",
      [base.modelId],
    );
    expect(model.masterPrompt).toContain("Hot Pink");
    const preferences = typeof model.preferences === "string" ? JSON.parse(model.preferences) : model.preferences;
    expect(preferences.hairColor).toBe("Hot Pink");
    expect(String(model.identityRevisionId)).toMatch(/^rev-/);
    expect(model).toMatchObject({ stateVersion: 2, currentPackageSnapshotId: committed.packageSnapshotId });
    expect(committed.result).toMatchObject({
      assetId: expect.any(Number),
      identityRevisionId: model.identityRevisionId,
      releasedDependents: [],
    });
    const anchor = await one("SELECT viewType, storageKey, pointsCost, status, provenance FROM model_assets WHERE id = ?", [committed.result.assetId]);
    expect(anchor).toMatchObject({ viewType: "frontClose", storageKey: "models/head-pink.png", pointsCost: 350 });
    const anchorProvenance = typeof anchor.provenance === "string" ? JSON.parse(anchor.provenance) : anchor.provenance;
    expect(anchorProvenance).toMatchObject({
      identityRole: "anchor",
      identityRevisionId: model.identityRevisionId,
      identityEditSource: "text",
    });
    const sideAsset = await one("SELECT status FROM model_assets WHERE id = ?", [base.sideAssetId]);
    const sideStatus = typeof sideAsset.status === "string" ? JSON.parse(sideAsset.status) : sideAsset.status;
    expect(sideStatus).toMatchObject({ state: "stale" });
    const selectedHead = await one(
      `SELECT selectedAssetId, compatibility, selectionReason
       FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'frontClose'`,
      [committed.packageSnapshotId],
    );
    expect(selectedHead).toMatchObject({
      selectedAssetId: committed.result.assetId,
      compatibility: "current",
      selectionReason: "generated",
    });
    const selectedSide = await one(
      `SELECT selectedAssetId, compatibility, selectionReason
       FROM model_package_snapshot_slots
       WHERE packageSnapshotId = ? AND viewAngle = 'sideClose'`,
      [committed.packageSnapshotId],
    );
    expect(selectedSide).toMatchObject({
      selectedAssetId: base.sideAssetId,
      compatibility: "stale",
      selectionReason: "carried",
    });
    expect(await count("model_identity_snapshots", "modelId = ?", [base.modelId])).toBe(2);
    expect(await one("SELECT reason, anchorAssetId, createdByOperationId FROM model_identity_snapshots WHERE id = ?", [committed.identitySnapshotId]))
      .toMatchObject({ reason: "identity_edit", anchorAssetId: committed.result.assetId, createdByOperationId: operationId });
  }, 60_000);

  it("pairs an identity append with a package append and stales every carried sibling", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId);

    const committed = await commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.iterate",
      mutate: async (tx) => {
        await tx.update(models).set({
          masterPrompt: "identity-v2 pink hair",
          technicalSchema: { hair: "pink" },
          preferences: { hairColor: "Hot Pink" },
          identityRevisionId: "revision-v2",
        }).where(eq(models.id, base.modelId));
        const [inserted] = await tx.insert(modelAssets).values({
          modelId: base.modelId,
          viewType: "frontClose",
          resolution: "1K",
          storageUrl: `https://example.invalid/new-anchor-${randomUUID()}.png`,
          pointsCost: 0,
        }).$returningId();
        if (!inserted?.id) throw new Error("new anchor insert failed");
        return {
          result: { assetId: inserted.id },
          transition: {
            packageReason: "identity_change" as const,
            identity: {
              reason: "identity_edit" as const,
              anchorAssetId: inserted.id,
              recipeVersion: "r7-identity-edit-v1",
            },
            slotChanges: [{
              viewAngle: "frontClose" as const,
              selectedAssetId: inserted.id,
              compatibility: "current" as const,
              selectionReason: "generated" as const,
            }],
          },
        };
      },
    });

    expect(committed.identitySnapshotId).not.toBe(base.identitySnapshotId);
    const identity = await one(
      "SELECT parentSnapshotId, reason, masterPrompt, anchorAssetId, createdByOperationId FROM model_identity_snapshots WHERE id = ?",
      [committed.identitySnapshotId],
    );
    expect(identity).toMatchObject({
      parentSnapshotId: base.identitySnapshotId,
      reason: "identity_edit",
      masterPrompt: "identity-v2 pink hair",
      anchorAssetId: committed.result.assetId,
      createdByOperationId: operationId,
    });
    const side = await one(
      `SELECT compatibility, selectionReason, selectedAssetId
       FROM model_package_snapshot_slots WHERE packageSnapshotId = ? AND viewAngle = 'sideClose'`,
      [committed.packageSnapshotId],
    );
    expect(side).toMatchObject({
      compatibility: "stale",
      selectionReason: "carried",
      selectedAssetId: base.sideAssetId,
    });
    expect(await one("SELECT stateVersion, currentPackageSnapshotId FROM models WHERE id = ?", [base.modelId]))
      .toEqual({ stateVersion: 2, currentPackageSnapshotId: committed.packageSnapshotId });
  }, 60_000);

  it("compacts documents while preserving the separate anchor, displayed headshot and compatibility", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    const anchorAssetId = await addAsset({ modelId, viewAngle: "frontClose", role: "anchor" });
    const displayedAssetId = await addAsset({ modelId, viewAngle: "frontClose", role: "display" });
    const sideAssetId = await addAsset({ modelId, viewAngle: "sideClose" });
    const head = await bootstrapModelSnapshot({ userId, modelId });
    if (head.status === "headless") throw new Error("bootstrap unexpectedly headless");
    const operationId = await startModelOperation(userId, modelId, "casting.compact");

    const committed = await commitDocumentCompactionSnapshot({
      userId,
      modelId,
      operationId,
      compactedMasterPrompt: "identity-v1 compacted",
    });

    const identity = await one(
      "SELECT anchorAssetId, masterPrompt, reason FROM model_identity_snapshots WHERE id = ?",
      [committed.identitySnapshotId],
    );
    expect(identity).toEqual({
      anchorAssetId,
      masterPrompt: "identity-v1 compacted",
      reason: "document_compact",
    });
    const [slots] = await connection.execute<RowDataPacket[]>(
      `SELECT viewAngle, selectedAssetId, compatibility, selectionReason
       FROM model_package_snapshot_slots WHERE packageSnapshotId = ? ORDER BY viewAngle`,
      [committed.packageSnapshotId],
    );
    expect(slots).toEqual([
      {
        viewAngle: "frontClose",
        selectedAssetId: displayedAssetId,
        compatibility: "current",
        selectionReason: "carried",
      },
      {
        viewAngle: "sideClose",
        selectedAssetId: sideAssetId,
        compatibility: "current",
        selectionReason: "carried",
      },
    ]);
  }, 60_000);

  it("seals the exact mint package after the existing lifecycle transition succeeds", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId, "casting.mint");
    const committed = await commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.mint",
      mutate: async (tx) => {
        await tx.update(models).set({ status: "active", mintedAt: new Date() }).where(eq(models.id, base.modelId));
        return {
          result: { minted: true },
          transition: { packageReason: "mint" as const, seal: true },
        };
      },
    });
    expect(await one(
      `SELECT status, stateVersion, currentPackageSnapshotId,
        sealedIdentitySnapshotId, sealedPackageSnapshotId
       FROM models WHERE id = ?`,
      [base.modelId],
    )).toEqual({
      status: "active",
      stateVersion: 2,
      currentPackageSnapshotId: committed.packageSnapshotId,
      sealedIdentitySnapshotId: base.identitySnapshotId,
      sealedPackageSnapshotId: committed.packageSnapshotId,
    });
    await operations.finalizeGenerationOperationSuccess({
      userId,
      operationId,
      result: { minted: true },
      chargedCredits: 0,
      refundedCredits: 0,
    });

    // Post-mint cosmetic/image-only refinement may advance the package, but
    // it must keep pointing at the exact sealed identity snapshot. The mint
    // package itself remains the immutable seal evidence.
    const refineOperationId = await startModelOperation(userId, base.modelId, "casting.iterate");
    const refined = await commitImageRefineSnapshot({
      userId,
      modelId: base.modelId,
      operationId: refineOperationId,
      candidate: {
        targetAssetId: base.sideAssetId,
        storageUrl: "https://example.invalid/minted-side-refined.png",
        storageKey: "models/minted-side-refined.png",
        pointsCost: 350,
      },
      imageOnlyCategories: ["image.lighting"],
    });
    expect(await one(
      `SELECT stateVersion, currentPackageSnapshotId,
        sealedIdentitySnapshotId, sealedPackageSnapshotId
       FROM models WHERE id = ?`,
      [base.modelId],
    )).toEqual({
      stateVersion: 3,
      currentPackageSnapshotId: refined.packageSnapshotId,
      sealedIdentitySnapshotId: base.identitySnapshotId,
      sealedPackageSnapshotId: committed.packageSnapshotId,
    });
    expect(await one(
      "SELECT identitySnapshotId, reason FROM model_package_snapshots WHERE id = ?",
      [refined.packageSnapshotId],
    )).toEqual({ identitySnapshotId: base.identitySnapshotId, reason: "image_refine" });
    expect(await count("model_identity_snapshots", "modelId = ?", [base.modelId])).toBe(1);
  }, 60_000);

  it("rolls legacy writes back when a package-only transition changes identity documents", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId);
    const assetsBefore = await count("model_assets", "modelId = ?", [base.modelId]);

    await expect(commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.iterate",
      mutate: async (tx) => {
        await tx.update(models).set({ masterPrompt: "silently changed" }).where(eq(models.id, base.modelId));
        await tx.insert(modelAssets).values({
          modelId: base.modelId,
          viewType: "backFull",
          resolution: "1K",
          storageUrl: `https://example.invalid/rolled-back-${randomUUID()}.png`,
          pointsCost: 0,
        });
        return { result: null, transition: { packageReason: "slot_generate" as const } };
      },
    })).rejects.toThrow("package-only transition cannot change identity documents");

    expect(await count("model_assets", "modelId = ?", [base.modelId])).toBe(assetsBefore);
    expect(await count("model_package_snapshots", "modelId = ?", [base.modelId])).toBe(1);
    expect(await one("SELECT masterPrompt, stateVersion, currentPackageSnapshotId FROM models WHERE id = ?", [base.modelId]))
      .toEqual({ masterPrompt: "identity-v1", stateVersion: 1, currentPackageSnapshotId: base.packageSnapshotId });
  }, 60_000);

  it("refuses a stale receipt before invoking the writer callback", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId);
    await connection.execute("UPDATE models SET stateVersion = stateVersion + 1 WHERE id = ?", [base.modelId]);
    let invoked = false;
    await expect(commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.iterate",
      mutate: async () => {
        invoked = true;
        return { result: null, transition: { packageReason: "image_refine" as const } };
      },
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(invoked).toBe(false);
    expect(await count("model_package_snapshots", "modelId = ?", [base.modelId])).toBe(1);
  }, 60_000);

  it("refuses a stale legacy identity revision before invoking the writer callback", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId);
    await connection.execute(
      "UPDATE models SET identityRevisionId = 'revision-outside-operation' WHERE id = ?",
      [base.modelId],
    );
    let invoked = false;
    await expect(commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.iterate",
      mutate: async () => {
        invoked = true;
        return { result: null, transition: { packageReason: "image_refine" as const } };
      },
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(invoked).toBe(false);
    expect(await count("model_package_snapshots", "modelId = ?", [base.modelId])).toBe(1);
  }, 60_000);

  it("refuses an operation-kind mismatch before invoking the writer callback", async () => {
    const userId = await createUser();
    const base = await createBootstrappedModel(userId);
    const operationId = await startModelOperation(userId, base.modelId);
    let invoked = false;
    await expect(commitModelSnapshotTransition({
      userId,
      modelId: base.modelId,
      operationId,
      expectedKind: "casting.compact",
      mutate: async () => {
        invoked = true;
        return { result: null, transition: { packageReason: "identity_change" as const } };
      },
    })).rejects.toThrow("running snapshot operation was not found");
    expect(invoked).toBe(false);
    expect(await count("model_package_snapshots", "modelId = ?", [base.modelId])).toBe(1);
  }, 60_000);
});
