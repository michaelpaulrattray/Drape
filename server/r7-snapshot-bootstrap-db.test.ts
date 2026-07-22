import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("R7-7A2 convergent snapshot bootstrap (disposable DB)", () => {
  let connection: Connection;
  let bootstrapModelSnapshot: typeof import("./casting/snapshotBootstrap").bootstrapModelSnapshot;

  beforeAll(async () => {
    const parsed = new URL(testDatabaseUrl!);
    if (!parsed.pathname.slice(1).startsWith("drape_r7_7a2_disposable_")) {
      throw new Error("R7-7A2 DB tests require the guarded disposable database");
    }
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    ({ bootstrapModelSnapshot } = await import("./casting/snapshotBootstrap"));
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
});
