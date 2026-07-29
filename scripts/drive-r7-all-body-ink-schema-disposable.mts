/** Guarded disposable-MySQL proof for R7-7G migrations 0015 and 0016. */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import mysql, {
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import {
  EvidenceComposerSchemaMismatchError,
  assertEvidenceComposerSchemaWithClient,
} from "../server/casting/evidence/evidenceComposerSchema";

const PREFIX = "drape_r7_7g_schema_disposable_";

async function applyMigrationRange(
  connection: Connection,
  first: number,
  last: number,
): Promise<void> {
  const files = (await readdir("drizzle"))
    .filter((file) => {
      if (!/^\d{4}_.+\.sql$/.test(file)) return false;
      const number = Number(file.slice(0, 4));
      return number >= first && number <= last;
    })
    .sort();
  for (const file of files) {
    const number = Number(file.slice(0, 4));
    if (number > 16) {
      throw new Error("R7-7G schema driver refuses migrations after 0016");
    }
    const sql = await readFile(`drizzle/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await connection.query(statement);
    }
    console.log(`[disposable] applied ${file}`);
  }
}

async function expectFenceMismatch(connection: Connection): Promise<void> {
  await assert.rejects(
    assertEvidenceComposerSchemaWithClient(connection),
    EvidenceComposerSchemaMismatchError,
  );
}

async function one(
  connection: Connection,
  sql: string,
  params: unknown[] = [],
): Promise<RowDataPacket> {
  const [rows] = await connection.execute<RowDataPacket[]>(sql, params);
  assert.ok(rows[0], "Expected one database row");
  return rows[0];
}

async function main(): Promise<void> {
  const configured = process.env.DATABASE_URL;
  if (!configured) throw new Error("DATABASE_URL is required (development DB only)");
  if (process.env.VITE_APP_ID !== "drape-local") {
    throw new Error("Refusing disposable database work outside the documented local app id");
  }
  const sourceUrl = new URL(configured);
  if (
    sourceUrl.protocol !== "mysql:"
    || sourceUrl.pathname.replace(/^\//, "") !== "railway"
  ) {
    throw new Error("Refusing: configured development URL must target the railway MySQL database");
  }

  const databaseName = `${PREFIX}${Date.now()}_${randomBytes(3).toString("hex")}`;
  const safeName = new RegExp(`^${PREFIX}[0-9]+_[a-f0-9]{6}$`);
  if (!safeName.test(databaseName)) throw new Error("Unsafe disposable database name");
  const serverUrl = new URL(sourceUrl);
  serverUrl.pathname = "/";
  const testUrl = new URL(sourceUrl);
  testUrl.pathname = `/${databaseName}`;
  const admin = await mysql.createConnection({
    uri: serverUrl.toString(),
    connectTimeout: 15_000,
  });
  let created = false;
  try {
    const [databaseRows] = await admin.query<RowDataPacket[]>("SHOW DATABASES");
    const stale = databaseRows
      .flatMap((row) => Object.values(row).map(String))
      .filter((name) => name.startsWith(PREFIX));
    if (stale.length > 0) {
      throw new Error(`Refusing: stale disposable databases require review (${stale.join(", ")})`);
    }
    await admin.query(`CREATE DATABASE \`${databaseName}\``);
    created = true;
    console.log(`[disposable] created ${databaseName} on ${sourceUrl.host}`);

    const connection = await mysql.createConnection({
      uri: testUrl.toString(),
      connectTimeout: 15_000,
      enableKeepAlive: true,
    });
    try {
      await applyMigrationRange(connection, 0, 14);
      await expectFenceMismatch(connection);

      const [user] = await connection.execute<ResultSetHeader>(
        "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'R7-7G schema', 1, 1)",
        [`r7-7g-schema-${randomUUID()}`],
      );
      const [model] = await connection.execute<ResultSetHeader>(
        "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'R7-7G Cast', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
        [user.insertId],
      );
      const intentId = randomUUID();
      const intentOperationId = randomUUID();
      const identitySnapshotId = randomUUID();
      const packageSnapshotId = randomUUID();
      await connection.execute(
        "INSERT INTO model_identity_feature_intents (id, userId, modelId, capabilityKey, activeCapabilityKey, category, operation, ontologyVersion, zone, surface, side, normalizedDescriptor, sourceAssetId, expectedStateVersion, identitySnapshotId, packageSnapshotId, createdByOperationId) VALUES (?, ?, ?, 'ink.add.front_upper_torso.v1', 'ink.add.front_upper_torso.v1', 'ink', 'add', 'r7-7g', 'upper_torso', 'front', 'center', 'legacy chest tattoo', 1, 0, ?, ?, ?)",
        [
          intentId,
          user.insertId,
          model.insertId,
          identitySnapshotId,
          packageSnapshotId,
          intentOperationId,
        ],
      );
      const candidateId = randomUUID();
      await connection.execute(
        "INSERT INTO casting_evidence_candidates (id, userId, modelId, intentId, originatingOperationId, capabilityKey, activeSlot, expectedStateVersion, identitySnapshotId, packageSnapshotId, targetViewAngle, sourceAssetId, composerRecipeVersion, probeRecipeVersion) VALUES (?, ?, ?, ?, ?, 'ink.add.front_upper_torso.v1', 'active', 0, ?, ?, 'frontFull', 1, 'r7-7g', 'r7-7g')",
        [
          candidateId,
          user.insertId,
          model.insertId,
          intentId,
          randomUUID(),
          identitySnapshotId,
          packageSnapshotId,
        ],
      );
      const attemptId = randomUUID();
      await connection.execute(
        "INSERT INTO casting_evidence_candidate_attempts (id, candidateId, attemptNumber, privatePlateId, actualImageEngine, composerRecipeVersion, probeModel, probeRecipeVersion) VALUES (?, ?, 1, ?, 'gemini-pro-image', 'r7-7g', 'probe', 'r7-7g')",
        [attemptId, candidateId, randomUUID()],
      );
      const featureId = randomUUID();
      const featureVersionId = randomUUID();
      const acceptedOperationId = randomUUID();
      await connection.execute(
        "INSERT INTO model_identity_features (id, modelId, category, createdByOperationId) VALUES (?, ?, 'ink', ?)",
        [featureId, model.insertId, acceptedOperationId],
      );
      await connection.execute(
        "INSERT INTO model_identity_feature_versions (id, modelId, featureId, operation, ontologyVersion, zone, surface, side, normalizedDescriptor, sourceAssetId, sourceViewAngle, acceptedCandidatePlateId, recipeVersion, createdByOperationId, acceptedAssetId) VALUES (?, ?, ?, 'present', 'r7-7g', 'upper_torso', 'front', 'center', 'legacy chest tattoo', 1, 'frontFull', ?, 'r7-7g', ?, 1)",
        [
          featureVersionId,
          model.insertId,
          featureId,
          randomUUID(),
          acceptedOperationId,
        ],
      );

      await applyMigrationRange(connection, 15, 15);
      await expectFenceMismatch(connection);
      await applyMigrationRange(connection, 16, 16);
      await assertEvidenceComposerSchemaWithClient(connection);

      assert.deepEqual(
        await one(
          connection,
          "SELECT intentId, purpose FROM casting_evidence_candidates WHERE id = ?",
          [candidateId],
        ),
        { intentId, purpose: "feature_authoring" },
      );
      assert.deepEqual(
        await one(
          connection,
          "SELECT priorInkOutcome FROM casting_evidence_candidate_attempts WHERE id = ?",
          [attemptId],
        ),
        { priorInkOutcome: null },
      );
      assert.deepEqual(
        await one(
          connection,
          "SELECT createdByOperationStepKey FROM model_identity_features WHERE id = ?",
          [featureId],
        ),
        { createdByOperationStepKey: "primary" },
      );
      assert.deepEqual(
        await one(
          connection,
          "SELECT createdByOperationStepKey FROM model_identity_feature_versions WHERE id = ?",
          [featureVersionId],
        ),
        { createdByOperationStepKey: "primary" },
      );

      const projectionCandidateId = randomUUID();
      await connection.execute(
        "INSERT INTO casting_evidence_candidates (id, userId, modelId, intentId, originatingOperationId, capabilityKey, activeSlot, expectedStateVersion, identitySnapshotId, packageSnapshotId, targetViewAngle, sourceAssetId, composerRecipeVersion, probeRecipeVersion, purpose) VALUES (?, ?, ?, NULL, ?, 'ink.project.v1', NULL, 0, ?, ?, 'sideFull', 1, 'r7-7g', 'r7-7g', 'feature_projection')",
        [
          projectionCandidateId,
          user.insertId,
          model.insertId,
          randomUUID(),
          identitySnapshotId,
          packageSnapshotId,
        ],
      );
      await connection.execute(
        "INSERT INTO casting_evidence_candidate_feature_targets (id, candidateId, userId, modelId, identitySnapshotId, featureId, featureVersionId, coverageBasis) VALUES (?, ?, ?, ?, ?, ?, ?, 'registry_affected')",
        [
          randomUUID(),
          projectionCandidateId,
          user.insertId,
          model.insertId,
          identitySnapshotId,
          featureId,
          featureVersionId,
        ],
      );
      await connection.execute(
        "INSERT INTO model_identity_feature_projection_evidence (id, userId, modelId, featureId, featureVersionId, targetViewAngle, sourceAssetId, acceptedAssetId, acceptedCandidatePlateId, recipeVersion, createdByOperationId, createdByOperationStepKey) VALUES (?, ?, ?, ?, ?, 'sideFull', 1, 2, ?, 'r7-7g', ?, 'projection:sideFull')",
        [
          randomUUID(),
          user.insertId,
          model.insertId,
          featureId,
          featureVersionId,
          randomUUID(),
          randomUUID(),
        ],
      );
      assert.equal(
        Number(
          (
            await one(
              connection,
              "SELECT COUNT(*) AS count FROM casting_evidence_candidate_feature_targets WHERE candidateId = ?",
              [projectionCandidateId],
            )
          ).count,
        ),
        1,
      );
      console.log("[disposable] R7-7G mixed-version defaults and final schema fence passed");
    } finally {
      await connection.end();
    }
  } finally {
    if (created) {
      if (!safeName.test(databaseName)) throw new Error("Cleanup guard refused database name");
      await admin.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
      console.log(`[disposable] dropped ${databaseName}`);
    }
    await admin.end();
  }
}

main().catch((error) => {
  console.error("[disposable] R7-7G schema failed:", error);
  process.exitCode = 1;
});
