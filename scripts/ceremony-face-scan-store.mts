/**
 * Ceremony — the kept face scan (`casting_face_scans`, migration 0032).
 *
 * Inert on its own: a table nothing writes is a table nothing writes. It lands
 * AHEAD of the code that names it, which is the ordering this program runs
 * under — a new table is in every INSERT the moment its writer ships, and there
 * is no dark landing for one.
 *
 * TWO WORLDS, NAMED OUT LOUD. Dev and production are both Railway MySQL on the
 * same host with the same database name and differ only by port, so this script
 * refuses to guess: it takes the world as an argument and prints the port it is
 * about to alter before it alters anything.
 *
 *   npx tsx scripts/ceremony-face-scan-store.mts --dev
 *     reads DATABASE_URL from .env — the dev database, and only that
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-face-scan-store.mts --production
 *     reads MYSQL_PUBLIC_URL from the Railway service environment. NEVER from a
 *     file: a production ceremony that picked up a dev URL from `.env` would
 *     migrate the wrong database and report success.
 *
 * Idempotent: it reads the table's existence first and says ALREADY APPLIED
 * rather than failing, so a re-run is safe and is the independent confirmation.
 */
import { readFile } from "node:fs/promises";

import { openDatabase } from "./lib/dbConnection.mts";

const world = process.argv.includes("--production")
  ? "production"
  : process.argv.includes("--dev") ? "dev" : null;
if (world === null) {
  console.error("REFUSING: name the world — --dev or --production. This script does not guess.");
  process.exit(1);
}

if (world === "dev") await import("dotenv/config");
const url = world === "production" ? process.env.MYSQL_PUBLIC_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(
    world === "production"
      ? "REFUSING: MYSQL_PUBLIC_URL is not set. Run under `railway.cmd run --service MySQL`."
      : "REFUSING: DATABASE_URL is not set in .env.",
  );
  process.exit(1);
}
if (world === "production" && process.env.DATABASE_URL && process.env.DATABASE_URL === url) {
  console.error("REFUSING: MYSQL_PUBLIC_URL and DATABASE_URL are the same string — that is one world, not two.");
  process.exit(1);
}

/* The port is the only thing that tells the two apart. Printed before the DDL,
   so the log of this run says which database was changed. */
const port = new URL(url).port || "3306";
console.log(`world: ${world.toUpperCase()} · ${new URL(url).hostname}:${port}`);

const TABLE = "casting_face_scans";

const conn = await openDatabase(url);
try {
  /*
    THE READER IS PROVEN BEFORE ITS ANSWER IS BELIEVED (working law 2).

    "SHOW TABLES LIKE" returning nothing is the whole basis for deciding to
    create — and an empty result is also exactly what a wrong-database or a
    silently-failed query looks like. So the same reader is pointed at a table
    that certainly exists here first.
  */
  const [control] = await conn.query<any[]>("SHOW TABLES LIKE 'casting_candidates'");
  if (control.length !== 1) {
    throw new Error("the existence reader cannot see `casting_candidates` — wrong database, or a reader that cannot say yes");
  }

  const [before] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  if (before.length === 1) {
    console.log("ALREADY APPLIED — the kept-scan table is here.");
  } else {
    /* The migration file itself, replayed rather than retyped: a ceremony that
       re-types its own DDL is a second copy of the schema and it drifts from the
       one every test ran against. */
    const sql = await readFile("drizzle/0032_casting_face_scan_store.sql", "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await conn.query(trimmed);
    }
    const [after] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
    if (after.length !== 1) throw new Error("the migration ran and the table is not there — stop and investigate");
    console.log("APPLIED — the kept-scan table exists.");
  }

  const [columns] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\``);
  console.log(`columns: ${columns.map((row) => String(row.Field)).join(", ")}`);

  /*
    THE BOUND IS READ BACK, not assumed.

    One row per (candidate, version) is the founder's storage condition made
    mechanical, and it is enforced by a UNIQUE index whose every column is NOT
    NULL — MySQL lets NULLs repeat inside a unique index, which is how a key
    quietly stops being a key. A CREATE that parsed says nothing about either
    property, so both are read here.
  */
  const [indexes] = await conn.query<any[]>(`SHOW INDEX FROM \`${TABLE}\``);
  const identity = indexes.filter((row) => String(row.Key_name) === "uq_casting_face_scans_identity");
  if (identity.length !== 2 || identity.some((row) => Number(row.Non_unique) !== 0)) {
    throw new Error("the (candidateId, versionKey) key is not a two-column unique index — the one-row-per-version bound is not enforced");
  }
  const nullable = columns
    .filter((row) => ["candidateId", "versionKey"].includes(String(row.Field)))
    .filter((row) => String(row.Null) !== "NO");
  if (nullable.length > 0) {
    throw new Error(`${nullable.map((row) => row.Field).join(", ")} admits NULL — NULLs repeat inside a unique index, so the bound would not hold`);
  }
  console.log("bound: (candidateId, versionKey) UNIQUE, both NOT NULL ✓");

  const [rows] = await conn.query<any[]>(`SELECT COUNT(*) AS n FROM \`${TABLE}\``);
  console.log(`rows: ${rows[0].n} (nothing writes this yet — anything but 0 is a finding)`);
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
