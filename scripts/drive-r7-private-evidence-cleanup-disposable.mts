/** Guarded disposable-MySQL gate for R7-7C5A cleanup-backend authority. */
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import mysql, {
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

const PREFIX = "drape_r7_7c5a_disposable_";

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
    if (migrationNumber > 12) {
      throw new Error("R7-7C5A driver refuses migrations after 0012");
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
    const legacyOperationId = randomUUID();
    let legacyModelId = 0;
    let legacyItemId = 0;
    try {
      await applyMigrationRange(connection, 0, 8);
      const [legacyUser] = await connection.execute<ResultSetHeader>(
        "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Pre-0009 row', 1, 1)",
        [`r7-7c5a-pre-0009-${randomUUID()}`],
      );
      const [legacyModel] = await connection.execute<ResultSetHeader>(
        "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status) VALUES (?, 'Pre-0009 Cast', '{}', JSON_OBJECT(), JSON_OBJECT(), 'draft')",
        [legacyUser.insertId],
      );
      legacyModelId = legacyModel.insertId;
      await connection.execute(
        "INSERT INTO generation_operations (id, userId, clientRequestId, kind, modelId, payloadHash) VALUES (?, ?, ?, 'casting.iterate', ?, ?)",
        [legacyOperationId, legacyUser.insertId, randomUUID(), legacyModelId, "b".repeat(64)],
      );
      const [legacyBoard] = await connection.execute<ResultSetHeader>(
        "INSERT INTO boards (userId, name, startedWith, status) VALUES (?, 'Pre-0009 board', 'casting', 'active')",
        [legacyUser.insertId],
      );
      const [legacyItem] = await connection.execute<ResultSetHeader>(
        "INSERT INTO board_items (boardId, type, kind, label, sourceModelId, metadata) VALUES (?, 'model', 'cast_config', 'Pre-0009 Cast', ?, JSON_OBJECT())",
        [legacyBoard.insertId, legacyModelId],
      );
      legacyItemId = legacyItem.insertId;
      await applyMigrationRange(connection, 9, 11);
      const [user] = await connection.execute<ResultSetHeader>(
        "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Pre-0012 row', 1, 1)",
        [`r7-7c5a-${randomUUID()}`],
      );
      const legacyBatchId = randomUUID();
      await connection.execute(
        "INSERT INTO storage_cleanup_batches (id, userId, operationId, kind) VALUES (?, ?, ?, 'model_delete')",
        [legacyBatchId, user.insertId, randomUUID()],
      );
      await connection.execute(
        "INSERT INTO storage_cleanup_items (batchId, storageKey) VALUES (?, 'models/pre-0012/public.png')",
        [legacyBatchId],
      );
      await applyMigrationRange(connection, 12, 12);
      const [[backfilled]] = await connection.query<RowDataPacket[]>(
        "SELECT storageBackend FROM storage_cleanup_items WHERE batchId = ?",
        [legacyBatchId],
      );
      if (backfilled?.storageBackend !== "public_r2") {
        throw new Error("Migration 0012 did not backfill the old-runtime cleanup item");
      }
      console.log("[disposable] old-runtime cleanup item backfilled to public_r2");
    } finally {
      await connection.end();
    }

    const testEnv = {
      ...process.env,
      DATABASE_URL: "",
      TEST_DATABASE_URL: testUrl.toString(),
      R7_5B_LEGACY_MODEL_ID: String(legacyModelId),
      R7_5B_LEGACY_OPERATION_ID: legacyOperationId,
      R7_5B_LEGACY_ITEM_ID: String(legacyItemId),
    };
    const suites = process.argv.includes("--focused-lifecycle")
      ? ["server/r7-evidence-lifecycle-db.test.ts"]
      : [
        "server/r7-cast-deletion-schema-db.test.ts",
        "server/r7-storage-cleanup-worker-db.test.ts",
        "server/r7-evidence-operations-db.test.ts",
        "server/r7-evidence-lifecycle-db.test.ts",
      ];
    for (const suite of suites) {
      run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
        "exec",
        "vitest",
        "run",
        suite,
      ], testEnv);
    }
    console.log("[disposable] R7-7C5A migration, tuple authority, mixed deletion and skip gates passed");
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
