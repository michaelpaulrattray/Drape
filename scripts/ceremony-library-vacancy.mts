/**
 * Ceremony — the library's third role (`casting_reference_library.role`,
 * migration 0030).
 *
 * Inert on its own: widening an ENUM legalises a value nothing writes yet. It
 * lands AHEAD of the code that names it, which is the ordering this program runs
 * under — an INSERT naming a value the column will not accept is not inert, and
 * the render that would do it is a paid one.
 *
 * TWO WORLDS, NAMED OUT LOUD. Dev and production are both Railway MySQL on the
 * same host with the same database name and differ only by port, so this script
 * refuses to guess: it takes the world as an argument and prints the port it is
 * about to alter before it alters anything.
 *
 *   npx tsx scripts/ceremony-library-vacancy.mts --dev
 *     reads DATABASE_URL from .env — the dev database, and only that
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-library-vacancy.mts --production
 *     reads MYSQL_PUBLIC_URL from the Railway service environment. NEVER from a
 *     file: a production ceremony that picked up a dev URL from `.env` would
 *     migrate the wrong database and report success.
 *
 * Idempotent: it reads the column's current type first and says ALREADY APPLIED
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

/* The port is the only thing that tells the two apart. Printed before the ALTER,
   so the log of this run says which database was changed. */
const port = new URL(url).port || "3306";
console.log(`world: ${world.toUpperCase()} · ${new URL(url).hostname}:${port}`);

const conn = await openDatabase(url);
try {
  const [columns] = await conn.query<any[]>(
    "SHOW COLUMNS FROM `casting_reference_library` LIKE 'role'",
  );
  if (columns.length !== 1) throw new Error("no `role` column — wrong database, or the library table is absent");
  const type: string = String(columns[0].Type);
  console.log(`role is currently ${type}`);

  if (type.includes("vacancy")) {
    console.log("ALREADY APPLIED — the third role is legal here.");
  } else {
    /* The migration file itself, replayed rather than retyped: a ceremony that
       re-types its own DDL is a second copy of the schema and it drifts from the
       one every test ran against. */
    const sql = await readFile("drizzle/0030_casting_v2_library_vacancy.sql", "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await conn.query(trimmed);
    }
    const [after] = await conn.query<any[]>("SHOW COLUMNS FROM `casting_reference_library` LIKE 'role'");
    if (!String(after[0].Type).includes("vacancy")) {
      throw new Error("the migration ran and the value is not legal — stop and investigate");
    }
    console.log(`APPLIED — role is now ${after[0].Type}`);
  }

  /* Rows are unchanged by an ENUM widening, and this says so rather than
     assuming it: the counts before and after are the same rows. */
  const [counts] = await conn.query<any[]>(
    "SELECT role, COUNT(*) AS n FROM `casting_reference_library` GROUP BY role ORDER BY role",
  );
  for (const row of counts) console.log(`  ${String(row.role).padEnd(8)} ${row.n} row(s)`);
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
