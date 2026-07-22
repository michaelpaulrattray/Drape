/** Guarded disposable-MySQL gate for R7-7A1 migration 0010. */
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import mysql, { type ResultSetHeader } from "mysql2/promise";

const PREFIX = "drape_r7_7a1_disposable_";

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const executable = process.platform === "win32" ? "cmd.exe" : command;
  const executableArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", [command, ...args].join(" ")]
    : args;
  const result = spawnSync(executable, executableArgs, { env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}`);
}

async function applyMigrationRange(connection: mysql.Connection, first: number, last: number) {
  const files = (await readdir("drizzle"))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file) && Number(file.slice(0, 4)) >= first && Number(file.slice(0, 4)) <= last)
    .sort();
  for (const file of files) {
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
  if ((process.env.VITE_APP_ID ?? "").toLowerCase().includes("production")) {
    throw new Error("Refusing disposable database work under a production app id");
  }
  const sourceUrl = new URL(configured);
  if (sourceUrl.protocol !== "mysql:" || sourceUrl.pathname.replace(/^\//, "") !== "railway") {
    throw new Error("Refusing: configured development URL must target the railway MySQL database");
  }
  const databaseName = `${PREFIX}${Date.now()}_${randomBytes(3).toString("hex")}`;
  const safeName = new RegExp(`^${PREFIX}[0-9]+_[a-f0-9]{6}$`);
  if (!safeName.test(databaseName)) throw new Error("Unsafe disposable database name");

  const serverUrl = new URL(sourceUrl);
  serverUrl.pathname = "/";
  const testUrl = new URL(sourceUrl);
  testUrl.pathname = `/${databaseName}`;
  const admin = await mysql.createConnection({ uri: serverUrl.toString(), connectTimeout: 15_000 });
  let created = false;
  try {
    const [databaseRows] = await admin.query("SHOW DATABASES");
    const stale = (databaseRows as Array<Record<string, string>>)
      .flatMap((row) => Object.values(row))
      .filter((name) => name.startsWith(PREFIX));
    if (stale.length > 0) throw new Error(`Refusing: stale disposable databases require review (${stale.join(", ")})`);

    await admin.query(`CREATE DATABASE \`${databaseName}\``);
    created = true;
    console.log(`[disposable] created ${databaseName} on ${sourceUrl.host}`);

    const connection = await mysql.createConnection({ uri: testUrl.toString(), connectTimeout: 15_000 });
    const legacyOperationId = randomUUID();
    let legacyModelId = 0;
    let legacyAssetId = 0;
    try {
      await applyMigrationRange(connection, 0, 9);
      const [user] = await connection.execute<ResultSetHeader>(
        "INSERT INTO users (openId, name, approved, emailVerified) VALUES ('r7-7a1-pre-0010', 'Pre-0010 row', 1, 1)",
      );
      const [model] = await connection.execute<ResultSetHeader>(
        "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'Pre-0010 Cast', 'legacy identity', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
        [user.insertId],
      );
      legacyModelId = model.insertId;
      const [asset] = await connection.execute<ResultSetHeader>(
        "INSERT INTO model_assets (modelId, viewType, resolution, storageUrl, pointsCost) VALUES (?, 'frontClose', '1K', 'https://example.invalid/r7-7a1-legacy.png', 0)",
        [legacyModelId],
      );
      legacyAssetId = asset.insertId;
      await connection.execute(
        "INSERT INTO generation_operations (id, userId, clientRequestId, kind, modelId, payloadHash) VALUES (?, ?, ?, 'casting.iterate', ?, ?)",
        [legacyOperationId, user.insertId, randomUUID(), legacyModelId, "f".repeat(64)],
      );
      await applyMigrationRange(connection, 10, 10);
    } finally {
      await connection.end();
    }

    run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
      "exec", "vitest", "run",
      "server/r7-snapshot-selection-contract.test.ts",
      "server/r7-snapshot-selection-schema-db.test.ts",
    ], {
      ...process.env,
      DATABASE_URL: "",
      TEST_DATABASE_URL: testUrl.toString(),
      R7_7A1_LEGACY_MODEL_ID: String(legacyModelId),
      R7_7A1_LEGACY_ASSET_ID: String(legacyAssetId),
      R7_7A1_LEGACY_OPERATION_ID: legacyOperationId,
    });
    console.log("[disposable] R7-7A1 migration, mixed-runtime and constraint gates passed");
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
  console.error("[disposable] failed:", error);
  process.exitCode = 1;
});
