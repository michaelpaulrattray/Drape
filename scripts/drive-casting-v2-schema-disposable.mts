/**
 * Migration 0017 verification on a disposable database (plan §G, M4 slice a).
 *
 * The repo's discipline is that a schema slice proves itself on a throwaway
 * database before it reaches a shared one. This creates a temporary database on
 * the same server as `DATABASE_URL`, replays the whole journal into it, asserts
 * the roll domain came out as designed, and drops it again.
 *
 * It never touches the database named in DATABASE_URL, and refuses to run if
 * that database looks like production.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const PREFIX = "drape_castingv2_schema_";
const SAFE_NAME = new RegExp(`^${PREFIX}[a-z0-9]+$`);

/**
 * The boundary that actually separates dev from production here.
 *
 * Both databases are hosted on Railway and both are reached from a dev machine
 * through a public proxy host, so the hostname says nothing — an earlier
 * version of this guard rejected the legitimate dev URL on that basis. What
 * does separate them is policy (CLAUDE.md): the production URL never lives in
 * `.env`; it is supplied inline for one command as part of a deliberate
 * ceremony. So this refuses a production-looking database name, and refuses
 * any URL that did not come from `.env`.
 */
function assertNotProduction(url: URL, fromDotEnv: boolean): void {
  const database = url.pathname.slice(1).toLowerCase();
  if (["prod", "production"].some((marker) => database.includes(marker))) {
    throw new Error(`Refusing to run: database "${database}" looks like production`);
  }
  if (!fromDotEnv) {
    throw new Error(
      "Refusing to run: DATABASE_URL was overridden rather than read from .env. " +
        "This script creates and drops a database on the target server and is dev-only.",
    );
  }
}

async function applyJournal(connection: mysql.Connection): Promise<number> {
  const files = (await readdir("drizzle"))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();
  for (const file of files) {
    const sql = await readFile(`drizzle/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await connection.query(trimmed);
    }
  }
  return files.length;
}

/**
 * Compare against `.env` directly rather than trying to observe the
 * environment before dotenv: ESM hoists every import, so dotenv has already
 * run by the time any top-level statement here executes. Reading the file is
 * the only reliable way to tell "this came from .env" from "this was
 * overridden for one command", which is the production ceremony.
 */
function databaseUrlFromDotEnv(): string | null {
  try {
    const line = readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("DATABASE_URL="));
    return line ? line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

const active = process.env.DATABASE_URL!;
const url = new URL(active);
assertNotProduction(url, databaseUrlFromDotEnv() === active);

const databaseName = `${PREFIX}${Math.random().toString(36).slice(2, 10)}`;
if (!SAFE_NAME.test(databaseName)) throw new Error("generated an unsafe database name");

const server = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  multipleStatements: false,
});

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

try {
  await server.query(`CREATE DATABASE \`${databaseName}\``);
  console.log(`[schema] created disposable database ${databaseName}`);
  await server.changeUser({ database: databaseName });

  const applied = await applyJournal(server);
  console.log(`[schema] applied ${applied} migration file(s)\n`);

  const [tables] = await server.query<mysql.RowDataPacket[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
    [databaseName],
  );
  const names = new Set(tables.map((row) => row.TABLE_NAME as string));
  for (const table of ["casting_sessions", "casting_rolls", "casting_candidates"]) {
    check(`${table} exists`, names.has(table));
  }

  // The enum must have gained the new value without losing the evidence one —
  // two retention policies, two values.
  const [columns] = await server.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'storage_cleanup_batches' AND COLUMN_NAME = 'kind'`,
    [databaseName],
  );
  const kindType = String(columns[0]?.COLUMN_TYPE ?? "");
  check("cleanup kind keeps candidate_cleanup", kindType.includes("'candidate_cleanup'"));
  check("cleanup kind gains casting_candidate_cleanup", kindType.includes("'casting_candidate_cleanup'"));

  const [indexes] = await server.query<mysql.RowDataPacket[]>(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'casting_%'`,
    [databaseName],
  );
  const indexNames = new Set(indexes.map((row) => row.INDEX_NAME as string));
  // The uniques are the concurrency defences; if any is missing the CAS design
  // silently degrades to last-write-wins.
  for (const unique of [
    "uq_casting_rolls_operation",
    "uq_casting_rolls_session_index",
    "uq_casting_candidates_roll_position",
    "uq_casting_candidates_signed_cast",
  ]) {
    check(`${unique} present`, indexNames.has(unique));
  }
  check("tray index present", indexNames.has("idx_casting_candidates_tray"));

  // Prove the uniques actually bite, rather than trusting the catalogue.
  await server.query(
    `INSERT INTO casting_sessions (publicId, userId, status) VALUES ('s-1', 1, 'open')`,
  );
  const [[session]] = await server.query<mysql.RowDataPacket[][]>(
    `SELECT id FROM casting_sessions WHERE publicId = 's-1'`,
  );
  const sessionId = (session as unknown as { id: number }).id;

  await server.query(
    `INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, operationId)
     VALUES ('r-1', ?, 1, 1, 'a dad in his 30s', 'op-1')`,
    [sessionId],
  );

  let duplicateIndexRejected = false;
  try {
    await server.query(
      `INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, operationId)
       VALUES ('r-2', ?, 1, 1, 'same index', 'op-2')`,
      [sessionId],
    );
  } catch {
    duplicateIndexRejected = true;
  }
  check("two rolls cannot share a rollIndex in one session", duplicateIndexRejected);

  let duplicateOperationRejected = false;
  try {
    await server.query(
      `INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, operationId)
       VALUES ('r-3', ?, 1, 2, 'replay', 'op-1')`,
      [sessionId],
    );
  } catch {
    duplicateOperationRejected = true;
  }
  check("one operation cannot mint two rolls", duplicateOperationRejected);

  const [[roll]] = await server.query<mysql.RowDataPacket[][]>(
    `SELECT id FROM casting_rolls WHERE publicId = 'r-1'`,
  );
  const rollId = (roll as unknown as { id: number }).id;

  await server.query(
    `INSERT INTO casting_candidates (publicId, rollId, sessionId, userId, position, pointsCost)
     VALUES ('c-1', ?, ?, 1, 0, 20)`,
    [rollId, sessionId],
  );
  let duplicatePositionRejected = false;
  try {
    await server.query(
      `INSERT INTO casting_candidates (publicId, rollId, sessionId, userId, position, pointsCost)
       VALUES ('c-2', ?, ?, 1, 0, 20)`,
      [rollId, sessionId],
    );
  } catch {
    duplicatePositionRejected = true;
  }
  check("two candidates cannot share a position in one roll", duplicatePositionRejected);

  // The signed-cast backstop must permit many unsigned candidates (NULL) while
  // refusing two candidates claiming the same Cast.
  await server.query(
    `INSERT INTO casting_candidates (publicId, rollId, sessionId, userId, position, pointsCost)
     VALUES ('c-3', ?, ?, 1, 1, 20)`,
    [rollId, sessionId],
  );
  const [manyNulls] = await server.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM casting_candidates WHERE signedCastId IS NULL`,
  );
  check("many candidates may be unsigned at once", Number(manyNulls[0].n) >= 2);

  await server.query(`UPDATE casting_candidates SET signedCastId = 42 WHERE publicId = 'c-1'`);
  let duplicateSignRejected = false;
  try {
    await server.query(`UPDATE casting_candidates SET signedCastId = 42 WHERE publicId = 'c-3'`);
  } catch {
    duplicateSignRejected = true;
  }
  check("two candidates cannot claim one Cast", duplicateSignRejected);
} finally {
  await server.changeUser({ database: undefined as unknown as string }).catch(() => undefined);
  if (SAFE_NAME.test(databaseName)) {
    await server.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    console.log(`\n[schema] dropped ${databaseName}`);
  }
  await server.end();
}

if (failures > 0) {
  console.error(`\n[schema] ${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("[schema] migration 0017 verified on a disposable database");
