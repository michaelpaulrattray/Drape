/**
 * Disposable-DB proof for additive migration 0010. TEST_DATABASE_URL must
 * name the isolated database created by the guarded R7-7A1 runner.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("R7-7A1 snapshot-selection schema (disposable DB)", () => {
  let connection: Connection;
  let userId: number;
  const ownedModelIds: number[] = [];
  const ownedOperationIds: string[] = [];

  beforeAll(async () => {
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [columns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM models LIKE 'currentPackageSnapshotId'",
    );
    if (columns.length !== 1) throw new Error("Disposable database must have migration 0010 applied");
    const [inserted] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'R7-7A1 Test', 1, 1)",
      [`r7-7a1-${randomUUID()}`],
    );
    userId = inserted.insertId;
  });

  afterAll(async () => {
    if (!connection) return;
    if (ownedModelIds.length > 0) {
      const placeholders = ownedModelIds.map(() => "?").join(",");
      await connection.execute(
        `DELETE s FROM model_package_snapshot_slots s JOIN model_package_snapshots p ON p.id = s.packageSnapshotId WHERE p.modelId IN (${placeholders})`,
        ownedModelIds,
      );
      await connection.execute(`DELETE FROM model_package_snapshots WHERE modelId IN (${placeholders})`, ownedModelIds);
      await connection.execute(`DELETE FROM model_identity_snapshots WHERE modelId IN (${placeholders})`, ownedModelIds);
      await connection.execute(`DELETE FROM model_assets WHERE modelId IN (${placeholders})`, ownedModelIds);
      await connection.execute(`DELETE FROM models WHERE id IN (${placeholders})`, ownedModelIds);
    }
    for (const id of ownedOperationIds) {
      await connection.execute("DELETE FROM generation_operations WHERE id = ?", [id]);
    }
    await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
    await connection.end();
  });

  it("preserves pre-0010 rows with null heads, zero state and null receipt expectations", async () => {
    const legacyModelId = Number(process.env.R7_7A1_LEGACY_MODEL_ID);
    const legacyAssetId = Number(process.env.R7_7A1_LEGACY_ASSET_ID);
    const legacyOperationId = process.env.R7_7A1_LEGACY_OPERATION_ID;
    expect(legacyModelId).toBeGreaterThan(0);
    expect(legacyAssetId).toBeGreaterThan(0);
    expect(legacyOperationId).toMatch(/^[0-9a-f-]{36}$/i);

    const [[model]] = await connection.query<RowDataPacket[]>(
      "SELECT currentPackageSnapshotId, stateVersion, sealedIdentitySnapshotId, sealedPackageSnapshotId FROM models WHERE id = ?",
      [legacyModelId],
    );
    const [[operation]] = await connection.query<RowDataPacket[]>(
      "SELECT expectedStateVersion, expectedIdentitySnapshotId, expectedPackageSnapshotId FROM generation_operations WHERE id = ?",
      [legacyOperationId],
    );
    const [[asset]] = await connection.query<RowDataPacket[]>(
      "SELECT modelId, viewType, storageUrl FROM model_assets WHERE id = ?",
      [legacyAssetId],
    );
    expect(model).toEqual({
      currentPackageSnapshotId: null,
      stateVersion: 0,
      sealedIdentitySnapshotId: null,
      sealedPackageSnapshotId: null,
    });
    expect(operation).toEqual({
      expectedStateVersion: null,
      expectedIdentitySnapshotId: null,
      expectedPackageSnapshotId: null,
    });
    expect(Number(asset.modelId)).toBe(legacyModelId);
    expect(asset).toMatchObject({ viewType: "frontClose", storageUrl: "https://example.invalid/r7-7a1-legacy.png" });
  });

  it("keeps old runtime model, asset and operation insert shapes valid", async () => {
    const [model] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'Mixed runtime model', '{}', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
      [userId],
    );
    ownedModelIds.push(model.insertId);
    const [asset] = await connection.execute<ResultSetHeader>(
      "INSERT INTO model_assets (modelId, viewType, resolution, storageUrl, pointsCost) VALUES (?, 'frontClose', '1K', 'https://example.invalid/r7-7a1-mixed.png', 0)",
      [model.insertId],
    );
    const operationId = randomUUID();
    ownedOperationIds.push(operationId);
    await connection.execute(
      "INSERT INTO generation_operations (id, userId, clientRequestId, kind, modelId, payloadHash) VALUES (?, ?, ?, 'casting.iterate', ?, ?)",
      [operationId, userId, randomUUID(), model.insertId, "a".repeat(64)],
    );
    const [[stored]] = await connection.query<RowDataPacket[]>(
      "SELECT stateVersion, currentPackageSnapshotId FROM models WHERE id = ?",
      [model.insertId],
    );
    expect(stored).toEqual({ stateVersion: 0, currentPackageSnapshotId: null });
    expect(asset.insertId).toBeGreaterThan(0);
  });

  it("accepts one valid immutable identity/package/slot state", async () => {
    const [model] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'Snapshot model', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
      [userId],
    );
    ownedModelIds.push(model.insertId);
    const [asset] = await connection.execute<ResultSetHeader>(
      "INSERT INTO model_assets (modelId, viewType, resolution, storageUrl, pointsCost) VALUES (?, 'frontClose', '1K', 'https://example.invalid/r7-7a1-head.png', 0)",
      [model.insertId],
    );
    const identityId = randomUUID();
    const packageId = randomUUID();
    await connection.execute(
      "INSERT INTO model_identity_snapshots (id, modelId, sequence, reason, masterPrompt, technicalSchema, preferences, identityText, identityTextHash, anchorAssetId, recipeVersion) VALUES (?, ?, 1, 'bootstrap', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'identity', ?, ?, 'bootstrap-v1')",
      [identityId, model.insertId, "b".repeat(64), asset.insertId],
    );
    await connection.execute(
      "INSERT INTO model_package_snapshots (id, modelId, identitySnapshotId, sequence, reason) VALUES (?, ?, ?, 1, 'bootstrap')",
      [packageId, model.insertId, identityId],
    );
    await connection.execute(
      "INSERT INTO model_package_snapshot_slots (id, packageSnapshotId, viewAngle, selectedAssetId, compatibility, selectionReason) VALUES (?, ?, 'frontClose', ?, 'current', 'bootstrap')",
      [randomUUID(), packageId, asset.insertId],
    );
    await connection.execute(
      "UPDATE models SET currentPackageSnapshotId = ?, stateVersion = 1 WHERE id = ? AND currentPackageSnapshotId IS NULL AND stateVersion = 0",
      [packageId, model.insertId],
    );
    const [[stored]] = await connection.query<RowDataPacket[]>(
      "SELECT currentPackageSnapshotId, stateVersion FROM models WHERE id = ?",
      [model.insertId],
    );
    expect(stored).toEqual({ currentPackageSnapshotId: packageId, stateVersion: 1 });
  });

  it("rejects duplicate sequences, angles, selected assets and unknown enum values", async () => {
    const [model] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'Constraint model', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
      [userId],
    );
    ownedModelIds.push(model.insertId);
    const [asset] = await connection.execute<ResultSetHeader>(
      "INSERT INTO model_assets (modelId, viewType, resolution, storageUrl, pointsCost) VALUES (?, 'frontClose', '1K', 'https://example.invalid/r7-7a1-constraint.png', 0)",
      [model.insertId],
    );
    const identityId = randomUUID();
    const packageId = randomUUID();
    await connection.execute(
      "INSERT INTO model_identity_snapshots (id, modelId, sequence, reason, masterPrompt, technicalSchema, preferences, identityText, identityTextHash, anchorAssetId, recipeVersion) VALUES (?, ?, 1, 'bootstrap', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'identity', ?, ?, 'bootstrap-v1')",
      [identityId, model.insertId, "c".repeat(64), asset.insertId],
    );
    await expect(connection.execute(
      "INSERT INTO model_identity_snapshots (id, modelId, sequence, reason, masterPrompt, technicalSchema, preferences, identityText, identityTextHash, anchorAssetId, recipeVersion) VALUES (?, ?, 1, 'bootstrap', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'identity', ?, ?, 'bootstrap-v1')",
      [randomUUID(), model.insertId, "d".repeat(64), asset.insertId],
    )).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    await expect(connection.execute(
      "INSERT INTO model_identity_snapshots (id, modelId, sequence, reason, masterPrompt, technicalSchema, preferences, identityText, identityTextHash, anchorAssetId, recipeVersion) VALUES (?, ?, 2, 'invented_reason', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'identity', ?, ?, 'bootstrap-v1')",
      [randomUUID(), model.insertId, "e".repeat(64), asset.insertId],
    )).rejects.toBeTruthy();

    await connection.execute(
      "INSERT INTO model_package_snapshots (id, modelId, identitySnapshotId, sequence, reason) VALUES (?, ?, ?, 1, 'bootstrap')",
      [packageId, model.insertId, identityId],
    );
    await connection.execute(
      "INSERT INTO model_package_snapshot_slots (id, packageSnapshotId, viewAngle, selectedAssetId, compatibility, selectionReason) VALUES (?, ?, 'frontClose', ?, 'current', 'bootstrap')",
      [randomUUID(), packageId, asset.insertId],
    );
    await expect(connection.execute(
      "INSERT INTO model_package_snapshot_slots (id, packageSnapshotId, viewAngle, selectedAssetId, compatibility, selectionReason) VALUES (?, ?, 'frontClose', ?, 'current', 'bootstrap')",
      [randomUUID(), packageId, asset.insertId + 1],
    )).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    await expect(connection.execute(
      "INSERT INTO model_package_snapshot_slots (id, packageSnapshotId, viewAngle, selectedAssetId, compatibility, selectionReason) VALUES (?, ?, 'sideClose', ?, 'current', 'bootstrap')",
      [randomUUID(), packageId, asset.insertId],
    )).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
  });
});
