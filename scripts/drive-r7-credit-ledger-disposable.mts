/**
 * R7-1B disposable MySQL gate.
 *
 * Creates a fresh database beside the configured DEVELOPMENT database, applies
 * migrations 0000-0005, runs the read-only duplicate audit, applies 0006, runs
 * the real concurrent ledger suite, and drops only the database it created.
 * It refuses production-like app ids and database names outside its prefix.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import mysql from "mysql2/promise";

const PREFIX = "drape_r7_1b_disposable_";

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const executable = process.platform === "win32" ? "cmd.exe" : command;
  const executableArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", [command, ...args].join(" ")]
    : args;
  const result = spawnSync(executable, executableArgs, { env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}`);
}

async function applyMigrationRange(connection: mysql.Connection, firstIndex: number, lastIndex: number) {
  const files = (await readdir("drizzle"))
    .filter((file) => {
      if (!/^\d{4}_.+\.sql$/.test(file)) return false;
      const index = Number(file.slice(0, 4));
      return index >= firstIndex && index <= lastIndex;
    })
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
  if (sourceUrl.pathname.replace(/^\//, "") !== "railway") {
    throw new Error("Refusing: configured development URL must target the railway database");
  }

  const databaseName = `${PREFIX}${Date.now()}_${randomBytes(3).toString("hex")}`;
  if (!new RegExp(`^${PREFIX}[0-9]+_[a-f0-9]{6}$`).test(databaseName)) {
    throw new Error("Unsafe disposable database name");
  }

  const serverUrl = new URL(sourceUrl);
  serverUrl.pathname = "/";
  const testUrl = new URL(sourceUrl);
  testUrl.pathname = `/${databaseName}`;
  const admin = await mysql.createConnection(serverUrl.toString());

  try {
    await admin.query(`CREATE DATABASE \`${databaseName}\``);
    console.log(`[disposable] created ${databaseName} on ${sourceUrl.host}`);
    const testConnection = await mysql.createConnection(testUrl.toString());
    try {
      await applyMigrationRange(testConnection, 0, 5);

      run(
        process.platform === "win32" ? "pnpm.cmd" : "pnpm",
        ["exec", "tsx", "scripts/audit-credit-reference-duplicates.mts"],
        { ...process.env, DATABASE_URL: testUrl.toString() },
      );

      await applyMigrationRange(testConnection, 6, 6);
    } finally {
      await testConnection.end();
    }

    run(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["exec", "vitest", "run", "server/r7-credit-ledger-db.test.ts"],
      { ...process.env, DATABASE_URL: "", TEST_DATABASE_URL: testUrl.toString() },
    );
    console.log("[disposable] R7-1B audit, migration, concurrency, and mixed-runtime gates passed");
  } finally {
    if (!databaseName.startsWith(PREFIX)) throw new Error("Cleanup guard refused database name");
    await admin.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    await admin.end();
    console.log(`[disposable] dropped ${databaseName}`);
  }
}

main().catch((error) => {
  console.error("[disposable] failed:", error);
  process.exitCode = 1;
});
