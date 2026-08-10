/** Guarded disposable-MySQL proof for R7-7D D4A intent/reference authority. */
import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import mysql, {
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import sharp from "sharp";
import type { PrivateEvidenceStorageAdapter } from "../server/casting/evidence/evidenceDelivery";
import { assertEvidenceComposerSchemaWithClient } from "../server/casting/evidence/evidenceComposerSchema";

const PREFIX = "drape_r7_7d_d4a_disposable_";

async function applyMigrations(connection: Connection) {
  const files = (await readdir("drizzle"))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();
  for (const file of files) {
    const number = Number(file.slice(0, 4));
    if (number > 13) throw new Error("R7-7D D4A driver refuses migrations after 0013");
    const migration = await readFile(`drizzle/${file}`, "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await connection.query(statement);
    }
    console.log(`[disposable] applied ${file}`);
  }
}

async function one(
  connection: Connection,
  sql: string,
  params: unknown[] = [],
): Promise<RowDataPacket> {
  const [rows] = await connection.execute<RowDataPacket[]>(sql, params);
  if (!rows[0]) throw new Error("Expected one row");
  return rows[0];
}

async function createFixture(connection: Connection) {
  const [user] = await connection.execute<ResultSetHeader>(
    "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'D4A owner', 1, 1)",
    [`r7-d4a-${randomUUID()}`],
  );
  const userId = user.insertId;
  const identityId = randomUUID();
  const packageId = randomUUID();
  const [model] = await connection.execute<ResultSetHeader>(
    "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status, currentPackageSnapshotId, stateVersion) VALUES (?, 'D4A Cast', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'draft', ?, 1)",
    [userId, packageId],
  );
  const modelId = model.insertId;
  const [head] = await connection.execute<ResultSetHeader>(
    "INSERT INTO model_assets (modelId, viewType, storageUrl, storageKey, pointsCost, pinned, provenance) VALUES (?, 'frontClose', ?, ?, 0, 0, JSON_OBJECT('identityRole', 'anchor'))",
    [
      modelId,
      "https://public.example/d4a-head.webp",
      `users/${userId}/models/${modelId}/d4a-head.webp`,
    ],
  );
  const [full] = await connection.execute<ResultSetHeader>(
    "INSERT INTO model_assets (modelId, viewType, storageUrl, storageKey, pointsCost, pinned) VALUES (?, 'frontFull', ?, ?, 0, 0)",
    [
      modelId,
      "https://public.example/d4a-full.webp",
      `users/${userId}/models/${modelId}/d4a-full.webp`,
    ],
  );
  await connection.execute(
    "INSERT INTO model_identity_snapshots (id, modelId, sequence, reason, masterPrompt, technicalSchema, preferences, identityText, identityTextHash, anchorAssetId, recipeVersion) VALUES (?, ?, 1, 'create', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'identity', ?, ?, 'd4a')",
    [
      identityId,
      modelId,
      createHash("sha256").update("identity").digest("hex"),
      head.insertId,
    ],
  );
  await connection.execute(
    "INSERT INTO model_package_snapshots (id, modelId, identitySnapshotId, sequence, reason) VALUES (?, ?, ?, 1, 'create')",
    [packageId, modelId, identityId],
  );
  await connection.execute(
    "INSERT INTO model_package_snapshot_slots (id, packageSnapshotId, viewAngle, selectedAssetId, compatibility, selectionReason) VALUES (?, ?, 'frontClose', ?, 'current', 'generated'), (?, ?, 'frontFull', ?, 'current', 'generated')",
    [
      randomUUID(),
      packageId,
      head.insertId,
      randomUUID(),
      packageId,
      full.insertId,
    ],
  );
  return {
    userId,
    modelId,
    identityId,
    packageId,
    fullAssetId: full.insertId,
  };
}

async function claimedIntent(
  connection: Connection,
  userId: number,
  modelId: number,
) {
  const operationId = randomUUID();
  await connection.execute(
    "INSERT INTO generation_operations (id, userId, clientRequestId, kind, modelId, payloadHash, status) VALUES (?, ?, ?, 'evidence_intent_begin', ?, ?, 'claimed')",
    [operationId, userId, randomUUID(), modelId, "d".repeat(64)],
  );
  await connection.execute(
    "INSERT INTO generation_operation_locks (lockKey, operationId, kind, expiresAt) VALUES (?, ?, 'evidence_intent_begin', DATE_ADD(NOW(), INTERVAL 10 MINUTE))",
    [`model:${modelId}`, operationId],
  );
  return operationId;
}

async function main() {
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
    throw new Error("Refusing: configured development URL must target railway");
  }
  const databaseName =
    `${PREFIX}${Date.now()}_${randomBytes(3).toString("hex")}`;
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
  const previousDatabaseUrl = process.env.DATABASE_URL;
  try {
    const [databaseRows] = await admin.query("SHOW DATABASES");
    const stale = (databaseRows as Array<Record<string, string>>)
      .flatMap((row) => Object.values(row))
      .filter((name) => name.startsWith(PREFIX));
    if (stale.length > 0) {
      throw new Error(`Refusing stale D4A databases: ${stale.join(", ")}`);
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
      await applyMigrations(connection);
      await assertEvidenceComposerSchemaWithClient(connection);
      process.env.DATABASE_URL = testUrl.toString();
      const { commitBeginInkAddIntent } =
        await import("../server/db/inkAddIntents");
      const { stageOwnedInkIntentReference } =
        await import("../server/casting/evidence/evidenceOperations");
      const { canonicalizeEvidenceDataUrl } =
        await import("../server/casting/evidence/imageValidation");
      const { claimGenerationOperation } =
        await import("../server/db/generationOperations");

      const owner = await createFixture(connection);
      const operationId = await claimedIntent(
        connection,
        owner.userId,
        owner.modelId,
      );
      const intentId = randomUUID();
      assert.deepEqual(await commitBeginInkAddIntent({
        userId: owner.userId,
        modelId: owner.modelId,
        operationId,
        intentId,
        sourceAssetId: owner.fullAssetId,
        side: "left",
        normalizedDescriptor: "fine-line Gemini twins",
      }), { intentId });
      const intent = await one(
        connection,
        "SELECT status, side, normalizedDescriptor, expectedStateVersion, identitySnapshotId, packageSnapshotId FROM model_identity_feature_intents WHERE id = ?",
        [intentId],
      );
      assert.deepEqual(intent, {
        status: "pending",
        side: "left",
        normalizedDescriptor: "fine-line Gemini twins",
        expectedStateVersion: 1,
        identitySnapshotId: owner.identityId,
        packageSnapshotId: owner.packageId,
      });
      const completed = await one(
        connection,
        "SELECT status, expectedStateVersion, expectedPackageSnapshotId FROM generation_operations WHERE id = ?",
        [operationId],
      );
      assert.equal(completed.status, "succeeded");
      assert.equal(completed.expectedStateVersion, 1);
      assert.equal(completed.expectedPackageSnapshotId, owner.packageId);
      assert.equal(Number((await one(
        connection,
        "SELECT COUNT(*) AS count FROM generation_operation_locks WHERE operationId = ?",
        [operationId],
      )).count), 0);

      const objects = new Map<string, Buffer>();
      const delivery: PrivateEvidenceStorageAdapter = {
        async putCanonical(key, bytes) {
          objects.set(key, Buffer.from(bytes));
          return { key };
        },
        async resolveOwnerDelivery(_userId, key) {
          return `/api/evidence/plate/${key.split("/").at(-1)!.replace(/\.webp$/, "")}`;
        },
        async deleteExact() {
          return { success: true };
        },
        async readCanonical() {
          throw new Error("not used");
        },
        async listCanonicalKeys() {
          return [];
        },
      };
      const png = await sharp({
        create: {
          width: 256,
          height: 256,
          channels: 4,
          background: { r: 30, g: 30, b: 30, alpha: 1 },
        },
      }).png().toBuffer();
      const referenceRequestId = randomUUID();
      const imageDataUrl = `data:image/png;base64,${png.toString("base64")}`;
      const canonical = await canonicalizeEvidenceDataUrl(imageDataUrl);
      const preclaim = await claimGenerationOperation({
        userId: owner.userId,
        clientRequestId: referenceRequestId,
        kind: "evidence_intent_reference",
        modelId: owner.modelId,
        payload: {
          intentId,
          contentHash: canonical.contentHash,
        },
      });
      assert.equal(preclaim.type, "claimed");
      const reference = await stageOwnedInkIntentReference({ delivery }, {
        userId: owner.userId,
        intentId,
        clientRequestId: referenceRequestId,
        imageDataUrl,
      });
      assert.equal(reference.delivery, `/api/evidence/plate/${reference.plateId}`);
      assert.equal(objects.size, 1);
      assert.deepEqual(await stageOwnedInkIntentReference({ delivery }, {
        userId: owner.userId,
        intentId,
        clientRequestId: referenceRequestId,
        imageDataUrl,
      }), reference);
      assert.equal(objects.size, 1);
      const plate = await one(
        connection,
        "SELECT userId, modelId, featureIntentId, kind, contentHash FROM model_reference_plates WHERE id = ?",
        [reference.plateId],
      );
      assert.equal(plate.userId, owner.userId);
      assert.equal(plate.modelId, owner.modelId);
      assert.equal(plate.featureIntentId, intentId);
      assert.equal(plate.kind, "uploaded_reference");
      assert.equal(plate.contentHash, reference.contentHash);

      const victim = await createFixture(connection);
      const attacker = await createFixture(connection);
      const foreignOperationId = await claimedIntent(
        connection,
        attacker.userId,
        attacker.modelId,
      );
      await assert.rejects(
        commitBeginInkAddIntent({
          userId: attacker.userId,
          modelId: attacker.modelId,
          operationId: foreignOperationId,
          intentId: randomUUID(),
          sourceAssetId: victim.fullAssetId,
          side: "right",
          normalizedDescriptor: "small black star",
        }),
        (error: unknown) =>
          (error as { code?: string }).code === "source_unavailable",
      );
      assert.equal(Number((await one(
        connection,
        "SELECT COUNT(*) AS count FROM model_identity_feature_intents WHERE modelId = ?",
        [attacker.modelId],
      )).count), 0);
      console.log("[disposable] D4A crash-resume, replay, and cross-owner assertions passed");
    } finally {
      await connection.end();
      const db = await (await import("../server/db/connection")).getDb();
      await (db as { $client?: { end?: () => Promise<void> } } | null)
        ?.$client?.end?.();
    }
  } finally {
    process.env.DATABASE_URL = previousDatabaseUrl!;
    if (created) {
      if (!safeName.test(databaseName)) throw new Error("Cleanup guard refused database name");
      await admin.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
      console.log(`[disposable] dropped ${databaseName}`);
    }
    await admin.end();
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error("[disposable] D4A failed:", error);
  process.exit(1);
});
