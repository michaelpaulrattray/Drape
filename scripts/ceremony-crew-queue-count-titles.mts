/**
 * Ceremony — the card titles under his background-work switch
 * (`crew_queue_counts.titles`, migration 0057; issue #285).
 *
 * Founder, 2026-08-30, looking at the live panel: *"am i suppose to see a list
 * under these categories?"* — then **"file it"**. This is the one command that
 * turns the numbers into a list.
 *
 * ⚠ **IT IS INERT UNTIL IT RUNS, AND NOTHING BREAKS MEANWHILE.** Both sides of
 * the column already work without it: `scripts/crew-count-queue.mts` asks
 * `SHOW COLUMNS` and falls back to the count-only INSERT, and
 * `server/db/crewWorkSwitches.ts` catches ER_BAD_FIELD_ERROR and re-reads
 * without it — so between the deploy and this command his Crew tab is exactly
 * the panel he has today, counts and all.
 *
 * TWO WORLDS, NAMED OUT LOUD. Dev and production are both Railway MySQL on the
 * same host with the same database name and differ only by port, so this script
 * refuses to guess: it takes the world as an argument and prints the port it is
 * about to alter before it alters anything.
 *
 *   npx tsx scripts/ceremony-crew-queue-count-titles.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-crew-queue-count-titles.mts --production
 *
 * Idempotent: it reads the column's existence first and says ALREADY APPLIED
 * rather than failing, so a re-run is safe and is the independent confirmation.
 *
 * One thing to do the day this runs against production, and it is one line:
 *
 *   delete `crew_queue_counts.titles` from DECLARED_COLUMNS_BUT_UNMIGRATED in
 *   `scripts/lib/schemaConformance.mts` AND its pin in
 *   `server/schemaConformance.test.ts`, in the SAME commit. The deploy rite
 *   reddens on a stale exception by design, and that redness is the reminder;
 *   `crew_replies` reddened main for exactly that mistake.
 */
import { readFile } from "node:fs/promises";

import { openDatabase } from "./lib/dbConnection.mts";

const TABLE = "crew_queue_counts";
const COLUMN = "titles";

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

const conn = await openDatabase(url);
try {
  /*
    THE READER IS PROVEN BEFORE ITS ANSWER IS BELIEVED (working law 2).
    "SHOW COLUMNS … LIKE" returning nothing is the whole basis for deciding to
    ALTER — and an empty result is also what a wrong database, a missing table
    or a silently-failed query looks like. `categoryKey` has been on this table
    since migration 0056, so a reader that cannot find IT cannot be trusted to
    say `titles` is absent.
  */
  const [table] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  if (table.length !== 1) {
    throw new Error(
      `\`${TABLE}\` does not exist in this world — run scripts/ceremony-crew-work-switches.mts first (migration 0056)`,
    );
  }
  const [control] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\` LIKE 'categoryKey'`);
  if (control.length !== 1) {
    throw new Error("the column reader cannot see `categoryKey` — wrong database, or a reader that cannot say yes");
  }

  const [before] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\` LIKE '${COLUMN}'`);
  if (before.length === 1) {
    console.log(`ALREADY APPLIED — \`${TABLE}.${COLUMN}\` is here.`);
  } else {
    /* The migration file itself, replayed rather than retyped: a ceremony that
       re-types its own DDL is a second copy of the schema and it drifts from
       the one every test ran against. */
    const sql = await readFile("drizzle/0057_crew_queue_count_titles.sql", "utf8");
    const statements = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);
    if (statements.length !== 1) {
      throw new Error(`expected exactly one statement in migration 0057, read ${statements.length} — stop and investigate`);
    }
    await conn.query(statements[0]!);
    const [after] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\` LIKE '${COLUMN}'`);
    if (after.length !== 1) throw new Error(`the migration ran and \`${TABLE}.${COLUMN}\` is not there — stop and investigate`);
    console.log(`APPLIED — \`${TABLE}.${COLUMN}\` exists.`);
  }

  /*
    WHAT IS ACTUALLY THERE, read back rather than assumed (working law 1).
    NULLABLE is the load-bearing property: every row already on this table was
    written before the column existed, so a NOT NULL column with no default
    would either fail the ALTER or silently invent an empty string as a value
    somebody wrote. The panel reads NULL as "no titles yet", which is the same
    thing it reads for a category nobody has counted.
  */
  const [columns] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\``);
  const row = columns.find((entry) => String(entry.Field) === COLUMN);
  if (!row) throw new Error(`\`${TABLE}.${COLUMN}\` vanished between the ALTER and the read-back — stop and investigate`);
  console.log(`  ${COLUMN}: ${String(row.Type)} · ${String(row.Null) === "YES" ? "nullable" : "NOT NULL"}`);
  if (String(row.Null) !== "YES") {
    throw new Error(`\`${TABLE}.${COLUMN}\` is NOT NULL — the rows written before this column exists could not be honest`);
  }

  const [counts] = await conn.query<any[]>(
    `SELECT COUNT(*) AS n, SUM(\`${COLUMN}\` IS NOT NULL) AS filled FROM \`${TABLE}\``,
  );
  console.log(`  rows: ${counts[0].n} · with titles: ${Number(counts[0].filled ?? 0)}`);
  console.log(
    "\nNo row is back-filled, deliberately: the titles and the count are ONE reading, and inventing\n"
    + "titles beside a count taken hours ago would be the confident-wrong-number failure this card is\n"
    + "about. The next shift's `scripts/crew-count-queue.mts` fills them all in one pass.",
  );
  if (world === "production") {
    console.log(
      "\nNow delete the `crew_queue_counts.titles` line from DECLARED_COLUMNS_BUT_UNMIGRATED\n"
      + "(scripts/lib/schemaConformance.mts) AND its entry in the pin in\n"
      + "server/schemaConformance.test.ts — in ONE commit. The deploy rite reddens until you do.",
    );
  }
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
