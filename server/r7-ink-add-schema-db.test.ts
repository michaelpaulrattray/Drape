/** Disposable-DB proof for additive R7-7D migration 0013. */
import { randomUUID } from "node:crypto";
import mysql, {
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertEvidenceComposerSchemaWithClient } from "./casting/evidence/evidenceComposerSchema";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("R7-7D D1 additive schema (disposable DB)", () => {
  let connection: Connection;
  let userId = 0;
  let modelId = 0;

  beforeAll(async () => {
    connection = await mysql.createConnection(testDatabaseUrl!);
    await assertEvidenceComposerSchemaWithClient(connection);
    const [user] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'R7-7D D1', 1, 1)",
      [`r7-7d-d1-db-${randomUUID()}`],
    );
    userId = user.insertId;
    const [model] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'D1 Cast', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
      [userId],
    );
    modelId = model.insertId;
  });

  afterAll(async () => {
    if (connection) await connection.end();
  });

  it("preserves every pre-0013 row with old-runtime-compatible defaults", async () => {
    const [[ingestion]] = await connection.query<RowDataPacket[]>(
      "SELECT stepKey FROM casting_evidence_ingestions WHERE id = ?",
      [process.env.R7_7D_D1_LEGACY_INGESTION_ID],
    );
    const [[plate]] = await connection.query<RowDataPacket[]>(
      "SELECT featureIntentId, createdByOperationStepKey FROM model_reference_plates WHERE id = ?",
      [process.env.R7_7D_D1_LEGACY_PLATE_ID],
    );
    const [[crop]] = await connection.query<RowDataPacket[]>(
      "SELECT createdByOperationStepKey FROM model_evidence_crops WHERE id = ?",
      [process.env.R7_7D_D1_LEGACY_CROP_ID],
    );
    expect(ingestion).toEqual({ stepKey: "primary" });
    expect(plate).toEqual({
      featureIntentId: null,
      createdByOperationStepKey: "primary",
    });
    expect(crop).toEqual({ createdByOperationStepKey: "primary" });
  });

  it("widens idempotency to operation plus step without weakening uniqueness", async () => {
    const plateId = randomUUID();
    await connection.execute(
      "INSERT INTO model_reference_plates (id, userId, modelId, kind, storageKey, mime, width, height, byteSize, contentHash, createdByOperationId, createdByOperationStepKey) VALUES (?, ?, ?, 'accepted_candidate', ?, 'image/webp', 100, 100, 100, ?, ?, 'candidate')",
      [plateId, userId, modelId, `d1/plate/${plateId}`, "d".repeat(64), process.env.R7_7D_D1_LEGACY_PLATE_OPERATION_ID],
    );
    await expect(connection.execute(
      "INSERT INTO model_reference_plates (id, userId, modelId, kind, storageKey, mime, width, height, byteSize, contentHash, createdByOperationId, createdByOperationStepKey) VALUES (?, ?, ?, 'accepted_candidate', ?, 'image/webp', 100, 100, 100, ?, ?, 'candidate')",
      [randomUUID(), userId, modelId, `d1/plate/${randomUUID()}`, "e".repeat(64), process.env.R7_7D_D1_LEGACY_PLATE_OPERATION_ID],
    )).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });

    const cropId = randomUUID();
    await connection.execute(
      "INSERT INTO model_evidence_crops (id, userId, modelId, plateId, ontologyVersion, zone, surface, side, sourceX, sourceY, sourceWidth, sourceHeight, sourceImageWidth, sourceImageHeight, storageKey, mime, width, height, byteSize, contentHash, cropRecipeVersion, createdByOperationId, createdByOperationStepKey) VALUES (?, ?, ?, ?, 'd1', 'upper_torso', 'front', 'center', 0, 0, 1, 1, 100, 100, ?, 'image/webp', 100, 100, 100, ?, 'd1', ?, 'candidate')",
      [cropId, userId, modelId, process.env.R7_7D_D1_LEGACY_PLATE_ID, `d1/crop/${cropId}`, "f".repeat(64), process.env.R7_7D_D1_LEGACY_CROP_OPERATION_ID],
    );
    await expect(connection.execute(
      "INSERT INTO model_evidence_crops (id, userId, modelId, plateId, ontologyVersion, zone, surface, side, sourceX, sourceY, sourceWidth, sourceHeight, sourceImageWidth, sourceImageHeight, storageKey, mime, width, height, byteSize, contentHash, cropRecipeVersion, createdByOperationId, createdByOperationStepKey) VALUES (?, ?, ?, ?, 'd1', 'upper_torso', 'front', 'center', 0, 0, 1, 1, 100, 100, ?, 'image/webp', 100, 100, 100, ?, 'd1', ?, 'candidate')",
      [randomUUID(), userId, modelId, process.env.R7_7D_D1_LEGACY_PLATE_ID, `d1/crop/${randomUUID()}`, "0".repeat(64), process.env.R7_7D_D1_LEGACY_CROP_OPERATION_ID],
    )).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });

    const ingestionId = randomUUID();
    await connection.execute(
      "INSERT INTO casting_evidence_ingestions (id, userId, modelId, operationId, stepKey, purpose, storageKey, mime, width, height, byteSize, contentHash) VALUES (?, ?, ?, ?, 'candidate', 'fork_copy', ?, 'image/webp', 100, 100, 100, ?)",
      [ingestionId, userId, modelId, process.env.R7_7D_D1_LEGACY_INGESTION_OPERATION_ID, `d1/ingestion/${ingestionId}`, "1".repeat(64)],
    );
    await expect(connection.execute(
      "INSERT INTO casting_evidence_ingestions (id, userId, modelId, operationId, stepKey, purpose, storageKey, mime, width, height, byteSize, contentHash) VALUES (?, ?, ?, ?, 'candidate', 'fork_copy', ?, 'image/webp', 100, 100, 100, ?)",
      [randomUUID(), userId, modelId, process.env.R7_7D_D1_LEGACY_INGESTION_OPERATION_ID, `d1/ingestion/${randomUUID()}`, "2".repeat(64)],
    )).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
  }, 20_000);

  it("enforces one active intent and candidate while retaining terminal history", async () => {
    const intentOperationId = randomUUID();
    const intentId = randomUUID();
    const insertIntent = async (id: string, operationId: string) =>
      connection.execute(
        "INSERT INTO model_identity_feature_intents (id, userId, modelId, capabilityKey, activeCapabilityKey, category, operation, ontologyVersion, zone, surface, side, normalizedDescriptor, sourceAssetId, expectedStateVersion, identitySnapshotId, packageSnapshotId, createdByOperationId) VALUES (?, ?, ?, 'ink.add.front_upper_torso.v1', 'ink.add.front_upper_torso.v1', 'ink', 'add', 'd1', 'upper_torso', 'front', 'center', 'fine-line rose', 1, 0, ?, ?, ?)",
        [id, userId, modelId, randomUUID(), randomUUID(), operationId],
      );
    await insertIntent(intentId, intentOperationId);
    await expect(insertIntent(randomUUID(), randomUUID()))
      .rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    await connection.execute(
      "UPDATE model_identity_feature_intents SET status = 'cancelled', activeCapabilityKey = NULL, resolvedAt = NOW() WHERE id = ?",
      [intentId],
    );
    const replacementIntentId = randomUUID();
    await insertIntent(replacementIntentId, randomUUID());

    const candidateId = randomUUID();
    const insertCandidate = async (id: string, operationId: string) =>
      connection.execute(
        "INSERT INTO casting_evidence_candidates (id, userId, modelId, intentId, originatingOperationId, capabilityKey, activeSlot, expectedStateVersion, identitySnapshotId, packageSnapshotId, targetViewAngle, sourceAssetId, composerRecipeVersion, probeRecipeVersion) VALUES (?, ?, ?, ?, ?, 'ink.add.front_upper_torso.v1', 'active', 0, ?, ?, 'frontFull', 1, 'd1', 'd1')",
        [id, userId, modelId, replacementIntentId, operationId, randomUUID(), randomUUID()],
      );
    await insertCandidate(candidateId, randomUUID());
    await expect(insertCandidate(randomUUID(), randomUUID()))
      .rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    await connection.execute(
      "UPDATE casting_evidence_candidates SET status = 'rejected', activeSlot = NULL, resolvedAt = NOW() WHERE id = ?",
      [candidateId],
    );
    await insertCandidate(randomUUID(), randomUUID());
  });

  it("enforces the two-attempt ceiling and closed probe vocabulary", async () => {
    const [[candidate]] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM casting_evidence_candidates WHERE modelId = ? AND activeSlot = 'active' LIMIT 1",
      [modelId],
    );
    for (const attemptNumber of [1, 2]) {
      await connection.execute(
        "INSERT INTO casting_evidence_candidate_attempts (id, candidateId, attemptNumber, privatePlateId, actualImageEngine, composerRecipeVersion, probeModel, probeRecipeVersion) VALUES (?, ?, ?, ?, 'gemini-pro-image', 'd1', 'probe', 'd1')",
        [randomUUID(), candidate.id, attemptNumber, randomUUID()],
      );
    }
    await expect(connection.execute(
      "INSERT INTO casting_evidence_candidate_attempts (id, candidateId, attemptNumber, privatePlateId, actualImageEngine, composerRecipeVersion, probeModel, probeRecipeVersion) VALUES (?, ?, 3, ?, 'gemini-pro-image', 'd1', 'probe', 'd1')",
      [randomUUID(), candidate.id, randomUUID()],
    )).rejects.toBeTruthy();
    await expect(connection.execute(
      "UPDATE casting_evidence_candidate_attempts SET overallOutcome = 'maybe' WHERE candidateId = ? AND attemptNumber = 1",
      [candidate.id],
    )).rejects.toBeTruthy();
  });

  it("keeps all new lifecycle tables free of database foreign keys", async () => {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME
         FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (
            'model_identity_feature_intents',
            'casting_evidence_candidates',
            'casting_evidence_candidate_attempts',
            'model_identity_features',
            'model_identity_feature_versions',
            'model_snapshot_feature_selections'
          )
          AND REFERENCED_TABLE_NAME IS NOT NULL`,
    );
    expect(rows).toEqual([]);
  });
});
