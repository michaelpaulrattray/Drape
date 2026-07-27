/** Guarded disposable-MySQL gate for the inert R7-7D D1 schema slice. */
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import mysql, { type ResultSetHeader } from "mysql2/promise";
import {
  EvidenceComposerSchemaMismatchError,
  assertEvidenceComposerSchemaWithClient,
} from "../server/casting/evidence/evidenceComposerSchema";

const PREFIX = "drape_r7_7d_d1_disposable_";

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const executable = process.platform === "win32" ? "cmd.exe" : command;
  const executableArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", [command, ...args].join(" ")]
    : args;
  const result = spawnSync(executable, executableArgs, { env, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}`);
  }
}

async function applyMigrationRange(
  connection: mysql.Connection,
  first: number,
  last: number,
) {
  const files = (await readdir("drizzle"))
    .filter((file) => (
      /^\d{4}_.+\.sql$/.test(file)
      && Number(file.slice(0, 4)) >= first
      && Number(file.slice(0, 4)) <= last
    ))
    .sort();
  for (const file of files) {
    const migrationNumber = Number(file.slice(0, 4));
    if (migrationNumber > 13) {
      throw new Error("R7-7D D1 driver refuses migrations after 0013");
    }
    const sql = await readFile(`drizzle/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await connection.query(statement);
    }
    console.log(`[disposable] applied ${file}`);
  }
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
    const [databaseRows] = await admin.query("SHOW DATABASES");
    const stale = (databaseRows as Array<Record<string, string>>)
      .flatMap((row) => Object.values(row))
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
    });
    const legacy = {
      ingestionId: randomUUID(),
      ingestionOperationId: randomUUID(),
      plateId: randomUUID(),
      plateOperationId: randomUUID(),
      cropId: randomUUID(),
      cropOperationId: randomUUID(),
    };
    try {
      await applyMigrationRange(connection, 0, 12);
      const [user] = await connection.execute<ResultSetHeader>(
        "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Pre-0013 user', 1, 1)",
        [`r7-7d-d1-${randomUUID()}`],
      );
      const [model] = await connection.execute<ResultSetHeader>(
        "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'Pre-0013 Cast', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
        [user.insertId],
      );
      const plateKey = `users/${user.insertId}/models/${model.insertId}/evidence/plates/${legacy.plateId}.webp`;
      const cropKey = `users/${user.insertId}/models/${model.insertId}/evidence/crops/${legacy.cropId}.webp`;
      await connection.execute(
        "INSERT INTO model_reference_plates (id, userId, modelId, kind, storageKey, mime, width, height, byteSize, contentHash, createdByOperationId) VALUES (?, ?, ?, 'uploaded_reference', ?, 'image/webp', 100, 100, 100, ?, ?)",
        [legacy.plateId, user.insertId, model.insertId, plateKey, "a".repeat(64), legacy.plateOperationId],
      );
      await connection.execute(
        "INSERT INTO model_evidence_crops (id, userId, modelId, plateId, ontologyVersion, zone, surface, side, sourceX, sourceY, sourceWidth, sourceHeight, sourceImageWidth, sourceImageHeight, storageKey, mime, width, height, byteSize, contentHash, cropRecipeVersion, createdByOperationId) VALUES (?, ?, ?, ?, 'pre-0013', 'upper_torso', 'front', 'center', 0, 0, 1, 1, 100, 100, ?, 'image/webp', 100, 100, 100, ?, 'pre-0013', ?)",
        [legacy.cropId, user.insertId, model.insertId, legacy.plateId, cropKey, "b".repeat(64), legacy.cropOperationId],
      );
      await connection.execute(
        "INSERT INTO casting_evidence_ingestions (id, userId, modelId, operationId, purpose, storageKey, mime, width, height, byteSize, contentHash) VALUES (?, ?, ?, ?, 'reference_plate', ?, 'image/webp', 100, 100, 100, ?)",
        [legacy.ingestionId, user.insertId, model.insertId, legacy.ingestionOperationId, `${plateKey}.receipt`, "c".repeat(64)],
      );

      await assertEvidenceComposerSchemaWithClient(connection)
        .then(() => {
          throw new Error("Composer schema fence accepted pre-0013 shape");
        })
        .catch((error) => {
          if (!(error instanceof EvidenceComposerSchemaMismatchError)) throw error;
        });
      await applyMigrationRange(connection, 13, 13);
      await assertEvidenceComposerSchemaWithClient(connection);
    } finally {
      await connection.end();
    }

    run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
      "exec",
      "vitest",
      "run",
      "server/r7-ink-add-schema-db.test.ts",
    ], {
      ...process.env,
      DATABASE_URL: "",
      TEST_DATABASE_URL: testUrl.toString(),
      R7_7D_D1_LEGACY_INGESTION_ID: legacy.ingestionId,
      R7_7D_D1_LEGACY_INGESTION_OPERATION_ID: legacy.ingestionOperationId,
      R7_7D_D1_LEGACY_PLATE_ID: legacy.plateId,
      R7_7D_D1_LEGACY_PLATE_OPERATION_ID: legacy.plateOperationId,
      R7_7D_D1_LEGACY_CROP_ID: legacy.cropId,
      R7_7D_D1_LEGACY_CROP_OPERATION_ID: legacy.cropOperationId,
    });
    console.log("[disposable] R7-7D D1 migration and mixed-version gates passed");
  } finally {
    if (created) {
      if (!safeName.test(databaseName)) {
        throw new Error("Cleanup guard refused database name");
      }
      await admin.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
      console.log(`[disposable] dropped ${databaseName}`);
    }
    await admin.end();
  }
}

main().catch((error) => {
  console.error("[disposable] failed:", error);
  process.exitCode = 1;
});
