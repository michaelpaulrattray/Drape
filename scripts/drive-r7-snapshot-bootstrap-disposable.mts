/** Guarded disposable-MySQL gate for R7-7A bootstrap + atomic transitions. */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import mysql from "mysql2/promise";

const PREFIX = "drape_r7_7a2_disposable_";

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const executable = process.platform === "win32" ? "cmd.exe" : command;
  const executableArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", [command, ...args].join(" ")]
    : args;
  const result = spawnSync(executable, executableArgs, { env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}`);
}

async function applyMigrations(connection: mysql.Connection) {
  const files = (await readdir("drizzle"))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file) && Number(file.slice(0, 4)) <= 10)
    .sort();
  for (const file of files) {
    const sql = await readFile(`drizzle/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await connection.query(statement);
    }
    console.log(`[disposable] applied ${file}`);
  }
}

async function dropDisposableDatabase(input: {
  serverUrl: URL;
  databaseName: string;
  safeName: RegExp;
}) {
  if (!input.safeName.test(input.databaseName)) {
    throw new Error("Cleanup guard refused database name");
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    let cleanup: mysql.Connection | undefined;
    try {
      cleanup = await mysql.createConnection({
        uri: input.serverUrl.toString(),
        connectTimeout: 15_000,
        enableKeepAlive: true,
      });
      await cleanup.query(`DROP DATABASE IF EXISTS \`${input.databaseName}\``);
      console.log(`[disposable] dropped ${input.databaseName}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    } finally {
      await cleanup?.end().catch(() => undefined);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Disposable database cleanup failed");
}

async function main() {
  const args = process.argv.slice(2);
  const allowedArgs = new Set(["--focused-b3", "--focused-iterate"]);
  if (args.some((arg) => !allowedArgs.has(arg))) {
    throw new Error(`Unknown argument: ${args.find((arg) => !allowedArgs.has(arg))}`);
  }
  const focusedB3 = args.includes("--focused-b3");
  const focusedIterate = args.includes("--focused-iterate");
  if (focusedB3 && focusedIterate) {
    throw new Error("Choose only one focused disposable gate");
  }
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
    try {
      await applyMigrations(connection);
    } finally {
      await connection.end();
    }

    const vitestArgs = focusedB3
      ? [
          "exec", "vitest", "run",
          "--testTimeout=60000", "--hookTimeout=60000", "--fileParallelism=false", "--reporter=verbose",
          "--testNamePattern=snapshot.*ledger",
          "server/r7-snapshot-transitions-db.test.ts",
        ]
      : focusedIterate
        ? [
            "exec", "vitest", "run",
            "--testTimeout=60000", "--hookTimeout=60000", "--fileParallelism=false", "--reporter=verbose",
            "--testNamePattern=snapshot-selected.*iteration",
            "server/r7-snapshot-transitions-db.test.ts",
          ]
      : [
          "exec", "vitest", "run",
          "--testTimeout=60000", "--hookTimeout=60000", "--fileParallelism=false", "--reporter=verbose",
          "server/casting/snapshotBootstrap.test.ts",
          "server/r7-snapshot-selection-contract.test.ts",
          "server/r7-snapshot-bootstrap-db.test.ts",
          "server/r7-snapshot-transitions-db.test.ts",
        ];
    run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", vitestArgs, {
      ...process.env,
      DATABASE_URL: "",
      TEST_DATABASE_URL: testUrl.toString(),
    });
    console.log(
      focusedB3
        ? "[disposable] R7-7B3 snapshot-selected restore gate passed"
        : focusedIterate
          ? "[disposable] R7-7B3 snapshot-selected iteration gate passed"
          : "[disposable] R7-7A bootstrap, transition, rollback and race gates passed",
    );
  } finally {
    if (created) {
      // The Railway public proxy may close a connection while the multi-minute
      // DB suite runs. Cleanup must not depend on that original socket.
      await admin.end().catch(() => undefined);
      await dropDisposableDatabase({ serverUrl, databaseName, safeName });
    } else {
      await admin.end();
    }
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error("[disposable] failed:", error);
    process.exit(1);
  },
);
