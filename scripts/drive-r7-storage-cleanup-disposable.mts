/** Guarded disposable-MySQL gate for the R7-5D cleanup worker. */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import mysql from "mysql2/promise";

const PREFIX = "drape_r7_5d_disposable_";

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const executable = process.platform === "win32" ? "cmd.exe" : command;
  const executableArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", [command, ...args].join(" ")]
    : args;
  const result = spawnSync(executable, executableArgs, { env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}`);
}

async function applyAllMigrations(connection: mysql.Connection) {
  const files = (await readdir("drizzle")).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
  for (const file of files) {
    const source = await readFile(`drizzle/${file}`, "utf8");
    for (const statement of source.split("--> statement-breakpoint")) {
      if (statement.trim()) await connection.query(statement);
    }
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
      .flatMap((entry) => Object.values(entry))
      .filter((name) => name.startsWith(PREFIX));
    if (stale.length) throw new Error(`Refusing: stale disposable databases require review (${stale.join(", ")})`);
    await admin.query(`CREATE DATABASE \`${databaseName}\``);
    created = true;
    const test = await mysql.createConnection({ uri: testUrl.toString(), connectTimeout: 15_000 });
    try {
      await applyAllMigrations(test);
    } finally {
      await test.end();
    }
    run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
      "exec", "vitest", "run", "server/r7-storage-cleanup-worker-db.test.ts",
    ], {
      ...process.env,
      DATABASE_URL: "",
      TEST_DATABASE_URL: testUrl.toString(),
      R2_PUBLIC_URL: "https://owned.example",
    });
    console.log("[disposable] R7-5D lease, crash, retry, repair and exact-origin gates passed");
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
