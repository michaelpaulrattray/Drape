/** Guarded disposable-MySQL gate for R7-7C1/C2 migration and runtime. */
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import mysql, { type ResultSetHeader } from "mysql2/promise";
import { openDatabase } from "./lib/dbConnection.mts";

const PREFIX = "drape_r7_7c1_disposable_";

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
    if (migrationNumber > 11) {
      throw new Error("R7-7C1 driver refuses migrations after 0011");
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
  const admin = await openDatabase({
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

    const connection = await openDatabase({
      uri: testUrl.toString(),
      connectTimeout: 15_000,
    });
    const legacyModelBatchId = randomUUID();
    const legacyAccountBatchId = randomUUID();
    try {
      await applyMigrationRange(connection, 0, 10);
      const [user] = await connection.execute<ResultSetHeader>(
        "INSERT INTO users (openId, name, approved, emailVerified) VALUES ('r7-7c1-pre-0011', 'Pre-0011 row', 1, 1)",
      );
      await connection.execute(
        "INSERT INTO storage_cleanup_batches (id, userId, operationId, kind) VALUES (?, ?, ?, 'model_delete')",
        [legacyModelBatchId, user.insertId, randomUUID()],
      );
      await connection.execute(
        "INSERT INTO storage_cleanup_batches (id, userId, operationId, kind) VALUES (?, ?, ?, 'account_delete')",
        [legacyAccountBatchId, user.insertId, randomUUID()],
      );
      await applyMigrationRange(connection, 11, 11);
    } finally {
      await connection.end();
    }

    run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
      "exec",
      "vitest",
      "run",
      "server/r7-evidence-ingestion-contract.test.ts",
      "server/r7-evidence-ingestion-schema-db.test.ts",
      "server/r7-evidence-ingestion-runtime-db.test.ts",
    ], {
      ...process.env,
      DATABASE_URL: "",
      TEST_DATABASE_URL: testUrl.toString(),
      R7_7C1_LEGACY_MODEL_BATCH_ID: legacyModelBatchId,
      R7_7C1_LEGACY_ACCOUNT_BATCH_ID: legacyAccountBatchId,
    });
    // C4's operation-bound route service is deliberately isolated from the
    // C1/C2 schema/runtime files so hosted-MySQL latency cannot make unrelated
    // five-second schema assertions contend with its longer transactions.
    run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
      "exec",
      "vitest",
      "run",
      "server/r7-evidence-operations-db.test.ts",
    ], {
      ...process.env,
      DATABASE_URL: "",
      TEST_DATABASE_URL: testUrl.toString(),
    });
    // C3 resets the complete disposable fixture between lifecycle cases. Run
    // it in a separate process so its resets cannot race C1/C2 suites.
    run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
      "exec",
      "vitest",
      "run",
      "server/r7-evidence-lifecycle-db.test.ts",
    ], {
      ...process.env,
      DATABASE_URL: "",
      TEST_DATABASE_URL: testUrl.toString(),
    });
    console.log("[disposable] R7-7C1/C2/C3/C4 migration, ingestion, replay, recovery and lifecycle gates passed");
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

main().then(() => process.exit(0)).catch((error) => {
  console.error("[disposable] failed:", error);
  process.exit(1);
});
