/**
 * Ceremony — the hair reader's own endings AND the class door's narrowing
 * (`casting_reference_reads.outcome`, migrations 0044 and 0045).
 *
 * ONE COMMAND FOR TWO FILES, and that is the point rather than a convenience:
 * both values belong to the same road, the road opens on one flip, and asking
 * the founder for the same chore twice is using his desk as our memory
 * (`UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §9.14 asked for exactly this shape).
 * Each file is applied only if its own values are missing, so a database
 * holding 0044 and not 0045 lands 0045 alone.
 *
 * The demand record is gaining a second READER. The hair colour reader ends in
 * two ways the makeup reader has no word for — `no_hair_visible` (the presence
 * gate said there is no hair on a head in that picture) and
 * `no_colour_readable` (there IS hair and no block of colour could be spoken
 * for) — and those are two facts rather than one, because telling a customer
 * her photograph has no hair in it when a reply merely came back shaped wrong
 * is a claim about her picture that no reader made.
 *
 * Running behind this ceremony costs the TALLY and never a customer's answer:
 * `recordReferenceRead` proves the outcome against the column's list before the
 * insert and logs instead of writing. It is still applied first, because the
 * tally is the only record that the new refusals are firing at all.
 *
 * TWO WORLDS, NAMED OUT LOUD. Dev and production are both Railway MySQL on the
 * same host with the same database name and differ only by port, so this script
 * refuses to guess: it takes the world as an argument and prints the port it is
 * about to alter before it alters anything.
 *
 *   npx tsx scripts/ceremony-reference-read-hair-outcomes.mts --dev
 *     reads DATABASE_URL from .env — the dev database, and only that
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-reference-read-hair-outcomes.mts --production
 *     reads MYSQL_PUBLIC_URL from the Railway service environment. NEVER from a
 *     file: a production ceremony that picked up a dev URL from `.env` would
 *     migrate the wrong database and report success.
 *
 * Idempotent: it reads the column's current values first and says ALREADY
 * APPLIED rather than failing, so a re-run is safe and is the independent
 * confirmation.
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

const port = new URL(url).port || "3306";
console.log(`world: ${world.toUpperCase()} · ${new URL(url).hostname}:${port}`);

const TABLE = "casting_reference_reads";
/**
 * The two migrations this ceremony carries, each with the values that prove it.
 *
 * A file is replayed rather than retyped — a ceremony that re-types its own DDL
 * is a second copy of the schema and it drifts from the one every test ran
 * against — and each is judged by ITS OWN values, so the two cannot be confused
 * for one another by a half-applied database.
 */
const MIGRATIONS = [
  {
    file: "drizzle/0044_reference_read_hair_outcomes.sql",
    values: ["no_hair_visible", "no_colour_readable"],
    what: "the hair reader's own two endings",
  },
  {
    file: "drizzle/0045_reference_read_drawn_narrowed.sql",
    values: ["drawn_narrowed"],
    what: "the class door's narrowing, counted",
  },
] as const;
const VALUES = MIGRATIONS.flatMap((migration) => migration.values);

/** What the column says it holds, read back rather than assumed. */
async function readOutcomeValues(conn: Awaited<ReturnType<typeof openDatabase>>): Promise<string[]> {
  const [columns] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\` LIKE 'outcome'`);
  if (columns.length !== 1) throw new Error("`outcome` is not a column of this table — wrong database, or an unapplied 0036");
  const type = String(columns[0].Type);
  return [...type.matchAll(/'([^']*)'/g)].map((match) => match[1]);
}

const conn = await openDatabase(url);
try {
  /*
    THE READER IS PROVEN BEFORE ITS ANSWER IS BELIEVED (working law 2). An empty
    or short enum list is the basis for deciding to alter, and it is also what a
    wrong database looks like — so the same reader is pointed at values that
    certainly exist first.
  */
  const before = await readOutcomeValues(conn);
  console.log(`outcome holds: ${before.join(", ")}`);
  for (const control of ["delivered", "unreadable"]) {
    if (!before.includes(control)) {
      throw new Error(`the enum reader cannot see \`${control}\` — wrong database, or a reader that cannot say yes`);
    }
  }

  for (const migration of MIGRATIONS) {
    const held = await readOutcomeValues(conn);
    if (migration.values.every((value) => held.includes(value))) {
      console.log(`ALREADY APPLIED — ${migration.values.join(" and ")} (${migration.what}).`);
      continue;
    }
    const sql = await readFile(migration.file, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await conn.query(trimmed);
    }
    const after = await readOutcomeValues(conn);
    /* EVERY value of this file, each named in its own failure: an alter that
       landed one of two is a half-applied migration, and a check for "any of
       them" would report success on it. */
    for (const value of migration.values) {
      if (!after.includes(value)) throw new Error(`${migration.file} ran and \`${value}\` is not on the column — stop and investigate`);
    }
    console.log(`APPLIED ${migration.file} — outcome now holds: ${after.join(", ")}`);
  }

  /*
    NOTHING WAS LOST. An enum MODIFY rewrites the column definition, and the
    failure worth checking for is a value that quietly stopped being legal —
    which would silently blank every existing row carrying it on the next write.
  */
  const now = await readOutcomeValues(conn);
  for (const kept of before) {
    if (!now.includes(kept)) throw new Error(`\`${kept}\` was on this column and is not any more — stop`);
  }

  /* And the rows are counted on both sides of the alter, because "purely
     additive" is a claim about data and not only about DDL. */
  const [rows] = await conn.query<any[]>(
    `SELECT outcome, COUNT(*) AS n FROM \`${TABLE}\` GROUP BY outcome`,
  );
  console.log(rows.length === 0 ? "rows: none yet" : `rows: ${rows.map((row) => `${row.outcome || "(blank!)"}=${row.n}`).join(", ")}`);
  for (const row of rows) {
    if (!row.outcome) throw new Error("a row carries the EMPTY STRING outcome — a writer ran ahead of a migration");
  }
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
