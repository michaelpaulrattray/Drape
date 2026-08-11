/** Guarded disposable-MySQL gate for the cumulative inert R7-7D lifecycle. */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { assertEvidenceComposerSchemaWithClient } from "../server/casting/evidence/evidenceComposerSchema";
import { openDatabase } from "./lib/dbConnection.mts";

const PREFIX = "drape_r7_7d_d2_disposable_";

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

async function applyMigrations(connection: mysql.Connection) {
  const files = (await readdir("drizzle"))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();
  for (const file of files) {
    const number = Number(file.slice(0, 4));
    if (number > 14) throw new Error("R7-7E driver refuses migrations after 0014");
    const sql = await readFile(`drizzle/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await connection.query(statement);
    }
    console.log(`[disposable] applied ${file}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const allowedFocused = new Set([
    "--focused-e2",
    "--focused-e3",
    "--focused-e5-link",
  ]);
  if (args.some((arg) => !allowedFocused.has(arg))) {
    throw new Error(
      `Unknown argument: ${args.find((arg) => !allowedFocused.has(arg))}`,
    );
  }
  const focusedE2 = args.includes("--focused-e2");
  const focusedE3 = args.includes("--focused-e3");
  const focusedE5Link = args.includes("--focused-e5-link");
  if ([focusedE2, focusedE3, focusedE5Link].filter(Boolean).length > 1) {
    throw new Error("Choose only one focused lifecycle gate");
  }
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
    try {
      await applyMigrations(connection);
      await assertEvidenceComposerSchemaWithClient(connection);
    } finally {
      await connection.end();
    }
    const testArgs = focusedE2
      ? [
          "exec",
          "vitest",
          "run",
          "--testNamePattern=E2",
          "server/r7-ink-add-lifecycle-db.test.ts",
        ]
      : focusedE3
      ? [
          "exec",
          "vitest",
          "run",
          "--testNamePattern=E3",
          "server/r7-ink-add-lifecycle-db.test.ts",
        ]
      : focusedE5Link
      ? [
          "exec",
          "vitest",
          "run",
          "--testNamePattern=E5.*accepted.asset",
          "server/r7-ink-add-lifecycle-db.test.ts",
        ]
      : [
          "exec",
          "vitest",
          "run",
          "server/r7-ink-add-lifecycle-db.test.ts",
        ];
    run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", testArgs, {
      ...process.env,
      DATABASE_URL: "",
      TEST_DATABASE_URL: testUrl.toString(),
    });
    console.log(
      focusedE2
        ? "[disposable] R7-7E2 package settlement and rollback gates passed"
        : focusedE3
        ? "[disposable] R7-7E3 progressive mint and post-mint expansion gates passed"
        : focusedE5Link
        ? "[disposable] R7-7E5 accepted-asset and Fork-link gates passed"
        : "[disposable] cumulative R7-7D lifecycle gates passed",
    );
  } finally {
    if (created) {
      if (!safeName.test(databaseName)) throw new Error("Cleanup guard refused database name");
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
