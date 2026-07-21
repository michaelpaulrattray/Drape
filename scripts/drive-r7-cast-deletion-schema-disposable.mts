/** Guarded disposable-MySQL gate for R7-5B migration 0009. */
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import mysql, { type ResultSetHeader } from "mysql2/promise";

const PREFIX = "drape_r7_5b_disposable_";

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
  if (!new RegExp(`^${PREFIX}[0-9]+_[a-f0-9]{6}$`).test(databaseName)) {
    throw new Error("Unsafe disposable database name");
  }

  const serverUrl = new URL(sourceUrl);
  serverUrl.pathname = "/";
  const testUrl = new URL(sourceUrl);
  testUrl.pathname = `/${databaseName}`;
  const admin = await mysql.createConnection({ uri: serverUrl.toString(), connectTimeout: 15_000 });
  let created = false;
  try {
    const [databaseRows] = await admin.query("SHOW DATABASES");
    const staleDisposableNames = (databaseRows as Array<Record<string, string>>)
      .flatMap((row) => Object.values(row))
      .filter((name) => name.startsWith(PREFIX));
    if (staleDisposableNames.length > 0) {
      throw new Error(`Refusing: stale disposable databases require review (${staleDisposableNames.join(", ")})`);
    }
    await admin.query(`CREATE DATABASE \`${databaseName}\``);
    created = true;
    console.log(`[disposable] created ${databaseName} on ${sourceUrl.host}`);

    const testConnection = await mysql.createConnection({ uri: testUrl.toString(), connectTimeout: 15_000 });
    const legacyOperationId = randomUUID();
    let legacyModelId = 0;
    let legacyItemId = 0;
    try {
      await applyMigrationRange(testConnection, 0, 8);
      const [legacyUser] = await testConnection.execute<ResultSetHeader>(
        "INSERT INTO users (openId, name, approved, emailVerified) VALUES ('r7-5b-pre-0009', 'Pre-0009 row', 1, 1)",
      );
      const [legacyModel] = await testConnection.execute<ResultSetHeader>(
        "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'Pre-0009 Cast', '{}', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
        [legacyUser.insertId],
      );
      legacyModelId = legacyModel.insertId;
      await testConnection.execute(
        "INSERT INTO generation_operations (id, userId, clientRequestId, kind, modelId, payloadHash) VALUES (?, ?, ?, 'casting.iterate', ?, ?)",
        [legacyOperationId, legacyUser.insertId, randomUUID(), legacyModelId, "b".repeat(64)],
      );
      const [legacyBoard] = await testConnection.execute<ResultSetHeader>(
        "INSERT INTO boards (userId, name, startedWith, status) VALUES (?, 'Pre-0009 board', 'casting', 'active')",
        [legacyUser.insertId],
      );
      const [legacyItem] = await testConnection.execute<ResultSetHeader>(
        "INSERT INTO board_items (boardId, type, kind, label, sourceModelId, metadata) VALUES (?, 'model', 'cast_config', 'Pre-0009 Cast', ?, JSON_OBJECT())",
        [legacyBoard.insertId, legacyModelId],
      );
      legacyItemId = legacyItem.insertId;
      await applyMigrationRange(testConnection, 9, 9);
    } finally {
      await testConnection.end();
    }

    run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
      "exec", "vitest", "run",
      "server/r7-storage-cleanup-contract.test.ts",
      "server/r7-cast-deletion-schema-db.test.ts",
    ], {
      ...process.env,
      DATABASE_URL: "",
      TEST_DATABASE_URL: testUrl.toString(),
      R7_5B_LEGACY_MODEL_ID: String(legacyModelId),
      R7_5B_LEGACY_OPERATION_ID: legacyOperationId,
      R7_5B_LEGACY_ITEM_ID: String(legacyItemId),
    });
    console.log("[disposable] R7-5B migration, mixed-runtime and atomic-manifest gates passed");
  } finally {
    if (created) {
      if (!new RegExp(`^${PREFIX}[0-9]+_[a-f0-9]{6}$`).test(databaseName)) {
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
