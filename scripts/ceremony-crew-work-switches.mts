/**
 * Ceremony — his background-work switches, and the counts beside them
 * (`crew_work_switches` + `crew_queue_counts`, migration 0056; issue #277).
 *
 * **BOTH TABLES IN ONE SCRIPT, ON PURPOSE.** They arrive together and they are
 * useless apart — switches with no counts give him a toggle over an unknown
 * quantity, counts with no switches give him a number he cannot act on. One
 * script is ONE COMMAND for him rather than two, which is the whole reason.
 *
 * **It is inert until it runs, and it fails soft.** `server/db/crewWorkSwitches.ts`
 * answers `available: false` on an absent table, so between the deploy and this
 * ceremony the Crew tab is exactly what it is today plus a panel that says it is
 * not live yet. The shift-side reader treats an absent table as OFF — his own
 * bar, *"a fresh install, a lost row, an unreadable value: OFF"* — and
 * `crew-shift-start.mts` REFUSES to open a background run.
 *
 * ⚠ **NO ROW IS SEEDED, AND THAT IS THE DESIGN.** It is tempting to insert six
 * rows set to false so the page has something to draw. Do not: with one row per
 * key, "off" is the ABSENCE of a row, so seeding would replace a property that
 * holds by construction with one that holds because an INSERT got the value
 * right. He turns them on from the page; until he does, the store is empty and
 * everything reads off.
 *
 * One thing to do the day this runs against production, and it is one line:
 *
 *   delete `crew_work_switches` and `crew_queue_counts` from
 *   `DECLARED_BUT_UNMIGRATED` in `scripts/lib/schemaConformance.mts` — the
 *   deploy rite reddens on a stale exception, by design, and that redness is
 *   the reminder. The PIN in `server/schemaConformance.test.ts` moves in the
 *   SAME commit; `crew_replies` reddened main for exactly that mistake.
 *
 * TWO WORLDS, NAMED OUT LOUD. Dev and production are both Railway MySQL on the
 * same host with the same database name and differ only by port, so this script
 * refuses to guess: it takes the world as an argument and prints the port it is
 * about to alter before it alters anything.
 *
 *   npx tsx scripts/ceremony-crew-work-switches.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-crew-work-switches.mts --production
 *
 * Idempotent: it reads each table's existence first and says ALREADY APPLIED
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

const port = new URL(url).port || "3306";
console.log(`world: ${world.toUpperCase()} · ${new URL(url).hostname}:${port}`);

/** The two tables, with the columns each must end up holding. */
const TABLES = [
  { name: "crew_work_switches", columns: ["id", "switchKey", "enabled", "changedByUserId", "changedAt"] },
  { name: "crew_queue_counts", columns: ["id", "categoryKey", "openCount", "countedAt"] },
] as const;

const conn = await openDatabase(url);
try {
  /*
    THE READER IS PROVEN BEFORE ITS ANSWER IS BELIEVED (working law 2).
    "SHOW TABLES LIKE" returning nothing is the whole basis for deciding to
    create — and an empty result is also what a wrong-database or a
    silently-failed query looks like.
  */
  const [control] = await conn.query<any[]>("SHOW TABLES LIKE 'users'");
  if (control.length !== 1) {
    throw new Error("the existence reader cannot see `users` — wrong database, or a reader that cannot say yes");
  }

  const missing = [] as string[];
  for (const table of TABLES) {
    const [before] = await conn.query<any[]>(`SHOW TABLES LIKE '${table.name}'`);
    if (before.length === 1) console.log(`ALREADY APPLIED — \`${table.name}\` is here.`);
    else missing.push(table.name);
  }

  if (missing.length > 0) {
    /* The migration file itself, replayed rather than retyped: a ceremony that
       re-types its own DDL is a second copy of the schema and it drifts from
       the one every test ran against.

       ⚠ Both CREATEs are replayed even when only one table is missing — the
       statements are `CREATE TABLE`, so the one that exists would throw. The
       partial case is real (a ceremony interrupted between the two), so each
       statement is run only when ITS table is absent. */
    const sql = await readFile("drizzle/0056_crew_work_switches.sql", "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      const target = TABLES.find((table) => trimmed.includes(`CREATE TABLE \`${table.name}\``));
      if (target && !missing.includes(target.name)) {
        console.log(`skipping the CREATE for \`${target.name}\` — it is already here.`);
        continue;
      }
      await conn.query(trimmed);
    }
    for (const name of missing) {
      const [after] = await conn.query<any[]>(`SHOW TABLES LIKE '${name}'`);
      if (after.length !== 1) throw new Error(`the migration ran and \`${name}\` is not there — stop and investigate`);
      console.log(`APPLIED — \`${name}\` exists.`);
    }
  }

  for (const table of TABLES) {
    /*
      WHAT IS ACTUALLY THERE, read back rather than assumed. A CREATE that
      succeeded says the statement parsed; this says the columns are the ones
      the design named — and the SHORT LIST IS THE BOUNDARY, so a column nobody
      expected appearing here is a finding rather than a curiosity.
    */
    const [columns] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${table.name}\``);
    const names = columns.map((row) => String(row.Field));
    console.log(`${table.name}: ${names.join(", ")}`);
    for (const column of table.columns) {
      if (!names.includes(column)) throw new Error(`\`${table.name}.${column}\` is missing — not the table the design describes`);
    }
    for (const surplus of names) {
      if (!(table.columns as readonly string[]).includes(surplus)) {
        throw new Error(`\`${table.name}.${surplus}\` is here and the design does not name it — stop and investigate`);
      }
    }

    /*
      ⚠ THE UNIQUE KEY IS THE LOAD-BEARING CONSTRAINT AND IS READ BACK.

      Both tables are UPSERTED on their key. Without the unique index the
      `ON DUPLICATE KEY UPDATE` in `crew-count-queue.mts` silently becomes an
      INSERT, the table grows a second row per category, and "is it on" starts
      depending on which row the reader saw first. A table created from an older
      copy of the migration would pass every check above and fail this one.
    */
    const [indexes] = await conn.query<any[]>(`SHOW INDEX FROM \`${table.name}\``);
    const unique = indexes.filter((row) => Number(row.Non_unique) === 0).map((row) => String(row.Key_name));
    const keyColumn = table.name === "crew_work_switches" ? "switchKey" : "categoryKey";
    const expected = table.name === "crew_work_switches" ? "uq_crew_work_switches_key" : "uq_crew_queue_counts_key";
    if (!unique.includes(expected)) {
      throw new Error(`\`${table.name}\` has no unique index on \`${keyColumn}\` — the upsert would silently duplicate rows`);
    }

    const [rows] = await conn.query<any[]>(`SELECT COUNT(*) AS n FROM \`${table.name}\``);
    console.log(`  rows: ${rows[0].n}`);
  }

  console.log(
    "\nNo row is seeded, deliberately: with one row per key, OFF is the ABSENCE of a row, so an empty\n"
    + "store reads off by construction rather than by an INSERT getting the value right. He turns them\n"
    + "on from /admin/crew; shifts read them through scripts/crew-work-switches.mts and never write them.",
  );
  if (world === "production") {
    console.log(
      "\nNow delete the `crew_work_switches` and `crew_queue_counts` lines from DECLARED_BUT_UNMIGRATED\n"
      + "(scripts/lib/schemaConformance.mts) AND their entries in the pin in\n"
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
