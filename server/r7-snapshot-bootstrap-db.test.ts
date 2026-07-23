import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("R7-7A2 convergent snapshot bootstrap (disposable DB)", () => {
  let connection: Connection;
  let bootstrapModelSnapshot: typeof import("./casting/snapshotBootstrap").bootstrapModelSnapshot;
  let resolveOwnedEffectiveCastState: typeof import("./casting/effectiveCastState").resolveOwnedEffectiveCastState;
  let planSnapshotConvergence: typeof import("./casting/snapshotConvergence").planSnapshotConvergence;
  let convergeSnapshotCohort: typeof import("./casting/snapshotConvergence").convergeSnapshotCohort;

  beforeAll(async () => {
    const parsed = new URL(testDatabaseUrl!);
    if (!/^(?:drape_r7_7a2_disposable_|drape_r7_7b1_disposable_)/.test(
      parsed.pathname.slice(1),
    )) {
      throw new Error("Snapshot DB tests require a guarded disposable database");
    }
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    ({ bootstrapModelSnapshot } = await import("./casting/snapshotBootstrap"));
    ({ resolveOwnedEffectiveCastState } = await import("./casting/effectiveCastState"));
    ({ planSnapshotConvergence, convergeSnapshotCohort } = await import("./casting/snapshotConvergence"));
  });

  beforeEach(async () => {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of [
      "model_package_snapshot_slots",
      "model_package_snapshots",
      "model_identity_snapshots",
      "model_assets",
      "models",
      "users",
    ]) await connection.query(`TRUNCATE TABLE \`${table}\``);
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  }, 60_000);

  afterAll(async () => {
    await connection?.end();
    const db = await (await import("./db/connection")).getDb();
    if (db && typeof (db as { $client?: { end?: () => Promise<void> } }).$client?.end === "function") {
      await (db as { $client: { end: () => Promise<void> } }).$client.end();
    }
    delete process.env.DATABASE_URL;
  });

  async function createUser(label = "owner"): Promise<number> {
    const [inserted] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Snapshot test', 1, 1)",
      [`r7-7a2-${label}-${randomUUID()}`],
    );
    return inserted.insertId;
  }

  async function createModel(userId: number, over: { status?: string; deleted?: boolean } = {}): Promise<number> {
    const [inserted] = await connection.execute<ResultSetHeader>(
      `INSERT INTO models
        (userId, name, masterPrompt, technicalSchema, preferences, status, deletedAt)
       VALUES (?, 'Bootstrap Cast', 'identity-v1', JSON_OBJECT('hair', 'brown'),
         JSON_OBJECT('hairColor', 'Brown'), ?, ?)`,
      [userId, over.status ?? "draft", over.deleted ? new Date() : null],
    );
    return inserted.insertId;
  }

  async function addAsset(input: {
    modelId: number;
    viewType?: string;
    url?: string;
    role?: "anchor" | "display";
    stale?: boolean;
  }): Promise<number> {
    const [inserted] = await connection.execute<ResultSetHeader>(
      `INSERT INTO model_assets
        (modelId, viewType, storageUrl, pointsCost, provenance, status)
       VALUES (?, ?, ?, 0, ?, ?)`,
      [
        input.modelId,
        input.viewType ?? "frontClose",
        input.url ?? `https://example.invalid/${randomUUID()}.png`,
        JSON.stringify(input.role ? { identityRole: input.role } : {}),
        input.stale ? JSON.stringify({ state: "stale" }) : null,
      ],
    );
    return inserted.insertId;
  }

  async function count(table: string, where = "1=1", params: unknown[] = []): Promise<number> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`,
      params,
    );
    return Number(rows[0]?.count ?? 0);
  }

  async function one(sql: string, params: unknown[] = []): Promise<RowDataPacket> {
    const [rows] = await connection.execute<RowDataPacket[]>(sql, params);
    if (!rows[0]) throw new Error("Expected one row");
    return rows[0];
  }

  it("leaves a model without an anchor snapshot-headless", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    await addAsset({ modelId, role: "display" });
    await addAsset({ modelId, url: "", role: "anchor" });
    await expect(bootstrapModelSnapshot({ userId, modelId })).resolves.toEqual({ status: "headless", modelId });
    expect(await count("model_identity_snapshots")).toBe(0);
    expect(await count("model_package_snapshots")).toBe(0);
    expect(await one("SELECT currentPackageSnapshotId, stateVersion FROM models WHERE id = ?", [modelId]))
      .toEqual({ currentPackageSnapshotId: null, stateVersion: 0 });
  }, 60_000);

  it("creates one truthful head and replays without duplicating it", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    const anchorId = await addAsset({ modelId, role: "anchor", url: "https://example.invalid/anchor.png" });
    const displayId = await addAsset({
      modelId,
      role: "display",
      stale: true,
      url: "https://example.invalid/display.png",
    });
    await addAsset({ modelId, viewType: "sideClose", url: "https://example.invalid/side-old.png" });
    const sideId = await addAsset({ modelId, viewType: "sideClose", url: "https://example.invalid/side-new.png" });
    await addAsset({ modelId, viewType: "backFull", url: "" });

    const created = await bootstrapModelSnapshot({ userId, modelId });
    expect(created).toMatchObject({ status: "created", modelId, stateVersion: 1, selectedSlotCount: 2 });
    const identity = await one("SELECT * FROM model_identity_snapshots WHERE modelId = ?", [modelId]);
    expect(Number(identity.anchorAssetId)).toBe(anchorId);
    expect(identity.createdByOperationId).toBeNull();
    const slots = await connection.execute<RowDataPacket[]>(
      "SELECT viewAngle, selectedAssetId, compatibility FROM model_package_snapshot_slots ORDER BY viewAngle",
    );
    expect(slots[0]).toEqual([
      { viewAngle: "frontClose", selectedAssetId: displayId, compatibility: "stale" },
      { viewAngle: "sideClose", selectedAssetId: sideId, compatibility: "current" },
    ]);

    const replay = await bootstrapModelSnapshot({ userId, modelId });
    expect(replay).toMatchObject({
      status: "current",
      identitySnapshotId: created.status === "headless" ? "" : created.identitySnapshotId,
      packageSnapshotId: created.status === "headless" ? "" : created.packageSnapshotId,
      stateVersion: 1,
    });
    expect(await count("model_identity_snapshots")).toBe(1);
    expect(await count("model_package_snapshots")).toBe(1);
  }, 60_000);

  it("resolves a real bootstrapped head and preserves anchor/display separation", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    const anchorId = await addAsset({ modelId, role: "anchor" });
    const displayId = await addAsset({ modelId, role: "display" });
    await addAsset({ modelId, viewType: "sideClose" });
    await bootstrapModelSnapshot({ userId, modelId });

    const state = await resolveOwnedEffectiveCastState({ userId, modelId });
    expect(state).toMatchObject({
      authority: "snapshot",
      status: "current",
      stateVersion: 1,
      anchor: { id: anchorId },
      displayedHeadshot: { id: displayId },
    });
    expect(state.selectedViews.map((view) => view.angle)).toEqual([
      "frontClose",
      "sideClose",
    ]);
  }, 60_000);

  it("refuses foreign ownership and a pointerless anchored Cast without writes", async () => {
    const ownerId = await createUser("owner");
    const strangerId = await createUser("stranger");
    const modelId = await createModel(ownerId);
    await addAsset({ modelId, role: "anchor" });

    await expect(resolveOwnedEffectiveCastState({ userId: strangerId, modelId }))
      .rejects.toMatchObject({ code: "model_not_found" });
    await expect(resolveOwnedEffectiveCastState({ userId: ownerId, modelId }))
      .rejects.toMatchObject({ code: "snapshot_head_missing" });
    expect(await count("model_identity_snapshots", "modelId = ?", [modelId])).toBe(0);
    expect(await count("model_package_snapshots", "modelId = ?", [modelId])).toBe(0);
    expect(Number((await one("SELECT stateVersion FROM models WHERE id = ?", [modelId])).stateVersion))
      .toBe(0);
  }, 60_000);

  it("refuses a cross-model selected asset through the transactional loader", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    await addAsset({ modelId, role: "anchor" });
    await addAsset({ modelId, viewType: "sideClose" });
    await bootstrapModelSnapshot({ userId, modelId });

    const otherModelId = await createModel(userId);
    const otherAssetId = await addAsset({ modelId: otherModelId, viewType: "sideClose" });
    await connection.execute(
      `UPDATE model_package_snapshot_slots
       SET selectedAssetId = ?
       WHERE packageSnapshotId = (SELECT currentPackageSnapshotId FROM models WHERE id = ?)
         AND viewAngle = 'sideClose'`,
      [otherAssetId, modelId],
    );

    await expect(resolveOwnedEffectiveCastState({ userId, modelId }))
      .rejects.toMatchObject({ code: "slot_asset_invalid" });
  }, 60_000);

  it("converges package drift without inventing a new identity snapshot", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    await addAsset({ modelId, role: "anchor" });
    const first = await bootstrapModelSnapshot({ userId, modelId });
    const newSide = await addAsset({ modelId, viewType: "sideClose" });
    const second = await bootstrapModelSnapshot({ userId, modelId });
    expect(second).toMatchObject({ status: "converged", stateVersion: 2, selectedSlotCount: 2 });
    expect(await count("model_identity_snapshots")).toBe(1);
    expect(await count("model_package_snapshots")).toBe(2);
    const currentSide = await one(
      `SELECT s.selectedAssetId
       FROM models m JOIN model_package_snapshot_slots s ON s.packageSnapshotId = m.currentPackageSnapshotId
       WHERE m.id = ? AND s.viewAngle = 'sideClose'`,
      [modelId],
    );
    expect(Number(currentSide.selectedAssetId)).toBe(newSide);
    expect(first.status).toBe("created");
  }, 60_000);

  it("converges document/anchor drift with a paired identity and package append", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    await addAsset({ modelId, role: "anchor" });
    const first = await bootstrapModelSnapshot({ userId, modelId });
    await connection.execute(
      "UPDATE models SET masterPrompt = 'identity-v2', technicalSchema = JSON_OBJECT('hair', 'pink') WHERE id = ?",
      [modelId],
    );
    const newAnchor = await addAsset({ modelId, role: "anchor" });
    const second = await bootstrapModelSnapshot({ userId, modelId });
    expect(second).toMatchObject({ status: "converged", stateVersion: 2 });
    expect(await count("model_identity_snapshots")).toBe(2);
    expect(await count("model_package_snapshots")).toBe(2);
    const current = await one(
      `SELECT i.parentSnapshotId, i.anchorAssetId, p.parentPackageSnapshotId
       FROM models m
       JOIN model_package_snapshots p ON p.id = m.currentPackageSnapshotId
       JOIN model_identity_snapshots i ON i.id = p.identitySnapshotId
       WHERE m.id = ?`,
      [modelId],
    );
    expect(Number(current.anchorAssetId)).toBe(newAnchor);
    expect(current.parentSnapshotId).toBe(first.status === "headless" ? null : first.identitySnapshotId);
    expect(current.parentPackageSnapshotId).toBe(first.status === "headless" ? null : first.packageSnapshotId);
  }, 60_000);

  it("serializes concurrent first bootstrap into one created head and one replay", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    await addAsset({ modelId, role: "anchor" });
    const results = await Promise.all([
      bootstrapModelSnapshot({ userId, modelId }),
      bootstrapModelSnapshot({ userId, modelId }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["created", "current"]);
    expect(await count("model_identity_snapshots")).toBe(1);
    expect(await count("model_package_snapshots")).toBe(1);
    expect(Number((await one("SELECT stateVersion FROM models WHERE id = ?", [modelId])).stateVersion)).toBe(1);
  }, 60_000);

  it("refuses a current head whose selected asset belongs to another model", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    await addAsset({ modelId, role: "anchor" });
    await bootstrapModelSnapshot({ userId, modelId });

    const otherModelId = await createModel(userId);
    const foreignAssetId = await addAsset({ modelId: otherModelId, role: "anchor" });
    await connection.execute(
      "UPDATE model_package_snapshot_slots SET selectedAssetId = ? WHERE packageSnapshotId = (SELECT currentPackageSnapshotId FROM models WHERE id = ?)",
      [foreignAssetId, modelId],
    );
    await expect(bootstrapModelSnapshot({ userId, modelId }))
      .rejects.toThrow("package snapshot selection is invalid");
    expect(Number((await one("SELECT stateVersion FROM models WHERE id = ?", [modelId])).stateVersion)).toBe(1);
    expect(await count("model_package_snapshots", "modelId = ?", [modelId])).toBe(1);
  }, 60_000);

  it("refuses foreign, archived, deleted and corrupt-head models without snapshot writes", async () => {
    const ownerId = await createUser("owner");
    const strangerId = await createUser("stranger");
    const foreignModel = await createModel(ownerId);
    await addAsset({ modelId: foreignModel, role: "anchor" });
    await expect(bootstrapModelSnapshot({ userId: strangerId, modelId: foreignModel }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    const archivedModel = await createModel(ownerId, { status: "archived" });
    await addAsset({ modelId: archivedModel, role: "anchor" });
    await expect(bootstrapModelSnapshot({ userId: ownerId, modelId: archivedModel }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    const deletedModel = await createModel(ownerId, { deleted: true });
    await addAsset({ modelId: deletedModel, role: "anchor" });
    await expect(bootstrapModelSnapshot({ userId: ownerId, modelId: deletedModel }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    const corruptModel = await createModel(ownerId);
    await addAsset({ modelId: corruptModel, role: "anchor" });
    await connection.execute(
      "UPDATE models SET currentPackageSnapshotId = ?, stateVersion = 1 WHERE id = ?",
      [randomUUID(), corruptModel],
    );
    await expect(bootstrapModelSnapshot({ userId: ownerId, modelId: corruptModel }))
      .rejects.toThrow("snapshot head is invalid");

    const corruptVersionModel = await createModel(ownerId);
    await addAsset({ modelId: corruptVersionModel, role: "anchor" });
    await connection.execute("UPDATE models SET stateVersion = 1 WHERE id = ?", [corruptVersionModel]);
    await expect(bootstrapModelSnapshot({ userId: ownerId, modelId: corruptVersionModel }))
      .rejects.toThrow("pointer and state version disagree");
    expect(await count("model_identity_snapshots")).toBe(0);
    expect(await count("model_package_snapshots")).toBe(0);
  }, 60_000);

  it("plans read-only, converges a fixed cohort, proves parity, and replays without duplicate heads", async () => {
    const userId = await createUser();
    const headedModelId = await createModel(userId);
    await addAsset({ modelId: headedModelId, role: "anchor" });
    const headlessModelId = await createModel(userId);

    const plan = await planSnapshotConvergence({
      userId,
      modelIds: [],
      expectedModelCount: 2,
    });
    expect(plan.subjects.map((subject) => subject.modelId)).toEqual([
      headedModelId,
      headlessModelId,
    ]);
    expect(plan.summary).toMatchObject({
      auditedModels: 2,
      parityModels: 1,
      mismatchedModels: 1,
    });
    expect(await count("model_identity_snapshots")).toBe(0);
    expect(await count("model_package_snapshots")).toBe(0);

    const first = await convergeSnapshotCohort({
      userId,
      modelIds: [],
      expectedModelCount: 2,
    });
    expect(first).toMatchObject({
      success: true,
      expectedModelCount: 2,
      postflight: { auditedModels: 2, parityModels: 2, mismatchedModels: 0 },
    });
    expect(first.results).toEqual([
      { modelId: headedModelId, status: "created", errorCode: null },
      { modelId: headlessModelId, status: "headless", errorCode: null },
    ]);
    expect(await count("model_identity_snapshots")).toBe(1);
    expect(await count("model_package_snapshots")).toBe(1);

    const replay = await convergeSnapshotCohort({
      userId,
      modelIds: [],
      expectedModelCount: 2,
    });
    expect(replay.success).toBe(true);
    expect(replay.results).toEqual([
      { modelId: headedModelId, status: "current", errorCode: null },
      { modelId: headlessModelId, status: "headless", errorCode: null },
    ]);
    expect(await count("model_identity_snapshots")).toBe(1);
    expect(await count("model_package_snapshots")).toBe(1);
  }, 60_000);

  it("refuses an unexpected cohort count before writing any snapshot", async () => {
    const userId = await createUser();
    const modelId = await createModel(userId);
    await addAsset({ modelId, role: "anchor" });
    await expect(convergeSnapshotCohort({
      userId,
      modelIds: [],
      expectedModelCount: 2,
    })).rejects.toThrow("cohort count mismatch: expected 2, found 1");
    expect(await count("model_identity_snapshots")).toBe(0);
    expect(await count("model_package_snapshots")).toBe(0);
  }, 60_000);

  it("reports per-model bootstrap failures without exposing raw errors or claiming cohort parity", async () => {
    const userId = await createUser();
    const goodModelId = await createModel(userId);
    await addAsset({ modelId: goodModelId, role: "anchor" });
    const corruptModelId = await createModel(userId);
    await addAsset({ modelId: corruptModelId, role: "anchor" });
    await connection.execute(
      "UPDATE models SET currentPackageSnapshotId = ?, stateVersion = 1 WHERE id = ?",
      [randomUUID(), corruptModelId],
    );

    const result = await convergeSnapshotCohort({
      userId,
      modelIds: [],
      expectedModelCount: 2,
    });
    expect(result.success).toBe(false);
    expect(result.results).toEqual([
      { modelId: goodModelId, status: "created", errorCode: null },
      { modelId: corruptModelId, status: "failed", errorCode: "bootstrap_failed" },
    ]);
    expect(result.postflight.mismatchedModels).toBe(1);
    expect(JSON.stringify(result)).not.toContain("snapshot head is invalid");
    expect(await count("model_identity_snapshots", "modelId = ?", [goodModelId])).toBe(1);
    expect(await count("model_identity_snapshots", "modelId = ?", [corruptModelId])).toBe(0);
  }, 60_000);
});
