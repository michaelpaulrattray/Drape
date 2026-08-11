/**
 * REHEARSE THE CEREMONY before the founder runs it.
 *
 * Creates a throwaway database on the dev server, replays the journal up to
 * BUT NOT INCLUDING the two migrations the ceremony applies — so the rehearsal
 * database is in exactly production's shape — then runs the real ceremony
 * script against it, twice.
 *
 * Twice, because the second run is the half that matters: a ceremony that
 * cannot be re-run after a partial failure is a ceremony nobody can recover
 * from at 3am, and "ALREADY APPLIED" has to be a real branch rather than a
 * hopeful comment.
 *
 * It never touches the database named in DATABASE_URL, and refuses if that URL
 * did not come from `.env` or looks like production.
 *
 *   npx tsx scripts/rehearse-segment-ceremony-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";
import { openDatabase } from "./lib/dbConnection.mts";

const PREFIX = "drape_ceremony_rehearsal_";
const SKIP = ["0025_casting_v2_segment_store", "0026_casting_v2_variant_lineage"];

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
if (databaseUrlFromDotEnv() !== active) {
  throw new Error("Refusing: DATABASE_URL was overridden rather than read from .env. This script creates and drops a database.");
}
const url = new URL(active);
if (["prod", "production"].some((marker) => url.pathname.toLowerCase().includes(marker))) {
  throw new Error(`Refusing: database "${url.pathname}" looks like production`);
}

const databaseName = `${PREFIX}${Math.random().toString(36).slice(2, 10)}`;
if (!new RegExp(`^${PREFIX}[a-z0-9]+$`).test(databaseName)) throw new Error("generated an unsafe database name");

const server = await openDatabase({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  multipleStatements: false,
});

const rehearsalUrl = new URL(active);
rehearsalUrl.pathname = `/${databaseName}`;

let exitCode = 1;
try {
  await server.query(`CREATE DATABASE \`${databaseName}\``);
  await server.changeUser({ database: databaseName });

  const files = (await readdir("drizzle"))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .filter((file) => !SKIP.some((skipped) => file.startsWith(skipped)))
    .sort();
  for (const file of files) {
    const sql = await readFile(`drizzle/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await server.query(trimmed);
    }
  }
  console.log(`[rehearsal] ${databaseName}: ${files.length} migration(s), both ceremony migrations HELD BACK\n`);

  /* Production's shape, asserted rather than assumed. */
  const [columns] = await server.query<any[]>("SHOW COLUMNS FROM `casting_candidate_variants` LIKE 'parentVariantId'");
  const [tables] = await server.query<any[]>("SHOW TABLES LIKE 'casting_segments'");
  if (columns.length !== 0 || tables.length !== 0) {
    throw new Error("the rehearsal database already has the ceremony's objects — it is not production's shape");
  }
  console.log("[rehearsal] confirmed: no parentVariantId, no casting_segments — production's shape\n");

  const run = (label: string) => new Promise<number>((resolve) => {
    console.log(`── ${label}`);
    const child = spawn("npx", ["tsx", "scripts/ceremony-segment-store.mts"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      /* The ceremony reads MYSQL_PUBLIC_URL and nothing else — the same
         variable name the founder's run will carry, pointed here. */
      env: { ...process.env, MYSQL_PUBLIC_URL: rehearsalUrl.toString() },
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });

  const first = await run("FIRST RUN — applies both");
  if (first !== 0) throw new Error("the ceremony failed on its first run");
  const second = await run("\nSECOND RUN — must say ALREADY APPLIED and change nothing");
  if (second !== 0) throw new Error("the ceremony failed on its second run — it is not re-runnable");

  const [afterColumns] = await server.query<any[]>("SHOW COLUMNS FROM `casting_candidate_variants` LIKE 'parentVariantId'");
  const [afterTables] = await server.query<any[]>("SHOW TABLES LIKE 'casting_segments'");
  const [afterIndex] = await server.query<any[]>(
    "SHOW INDEX FROM `casting_candidate_variants` WHERE Key_name = 'idx_casting_variants_parent'",
  );
  if (afterColumns.length !== 1 || afterTables.length !== 1 || afterIndex.length !== 1) {
    throw new Error("after two runs the objects are not exactly once present");
  }
  console.log("\n[rehearsal] REHEARSED CLEAN — both objects present exactly once after two runs.");
  exitCode = 0;
} finally {
  await server.changeUser({ database: undefined as never }).catch(() => undefined);
  await server.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
  console.log(`[rehearsal] dropped ${databaseName}`);
  await server.end();
}

process.exit(exitCode);
