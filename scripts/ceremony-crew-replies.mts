/**
 * Ceremony — the Crew tab's reply table (`crew_replies`, migration 0054).
 *
 * One row is: something the founder typed into `/admin/crew`, against a
 * needs-you card or as a note to the shift. It is the founder's half of the
 * Crew tab's store (design `docs/specs/CREW_TAB_DESIGN.md` §3); the other half
 * is `server/crew/crew-briefing.json`, which needs no ceremony because it
 * deploys with the code.
 *
 * **This one IS inert until the flag flips, and that is the whole ordering.**
 * `CREW_TAB_SCOPE` is off everywhere, so no procedure reaches this table and no
 * row can be written before this runs. Running it is therefore safe at any
 * time and is a NAMED PRECONDITION of the flip rather than of the code: flip
 * the flag first and the founder's first reply meets a missing table.
 *
 * Two things to do the day this runs against production, both of them one line:
 *
 *   1. delete `crew_replies` from `DECLARED_BUT_UNMIGRATED` in
 *      `scripts/lib/schemaConformance.mts` — the deploy rite reddens on a stale
 *      exception, by design, and that redness is the reminder.
 *   2. move the `CREW_TAB_SCOPE` row in
 *      `scripts/lib/productionFlagPositions.mts` in the commit that records the
 *      founder's flip.
 *
 * TWO WORLDS, NAMED OUT LOUD. Dev and production are both Railway MySQL on the
 * same host with the same database name and differ only by port, so this script
 * refuses to guess: it takes the world as an argument and prints the port it is
 * about to alter before it alters anything.
 *
 *   npx tsx scripts/ceremony-crew-replies.mts --dev
 *     reads DATABASE_URL from .env — the dev database, and only that
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-crew-replies.mts --production
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

const TABLE = "crew_replies";

const conn = await openDatabase(url);
try {
  /*
    THE READER IS PROVEN BEFORE ITS ANSWER IS BELIEVED (working law 2).

    "SHOW TABLES LIKE" returning nothing is the whole basis for deciding to
    create — and an empty result is also exactly what a wrong-database or a
    silently-failed query looks like. So the same reader is pointed at a table
    that certainly exists here first. If the control cannot see THAT, the
    negative below is not evidence of anything.
  */
  const [control] = await conn.query<any[]>("SHOW TABLES LIKE 'users'");
  if (control.length !== 1) {
    throw new Error("the existence reader cannot see `users` — wrong database, or a reader that cannot say yes");
  }

  const [before] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  if (before.length === 1) {
    console.log("ALREADY APPLIED — the crew reply table is here.");
  } else {
    /* The migration file itself, replayed rather than retyped: a ceremony that
       re-types its own DDL is a second copy of the schema and it drifts from the
       one every test ran against. */
    const sql = await readFile("drizzle/0054_crew_replies.sql", "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await conn.query(trimmed);
    }
    const [after] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
    if (after.length !== 1) throw new Error("the migration ran and the table is not there — stop and investigate");
    console.log("APPLIED — the crew reply table exists.");
  }

  /*
    WHAT IS ACTUALLY THERE, read back rather than assumed. A CREATE that
    succeeded says the statement parsed; this says the columns are the ones the
    design named — and the SHORT LIST IS THE BOUNDARY, so a column nobody
    expected appearing here is a finding rather than a curiosity.
  */
  const [columns] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\``);
  const names = columns.map((row) => String(row.Field));
  console.log(`columns: ${names.join(", ")}`);
  const expected = ["id", "cardId", "body", "authorUserId", "createdAt"];
  for (const column of expected) {
    if (!names.includes(column)) throw new Error(`\`${column}\` is missing — the table is not the one the design describes`);
  }
  for (const surplus of names) {
    if (!expected.includes(surplus)) {
      throw new Error(`\`${surplus}\` is in this table and the design does not name it — stop and investigate`);
    }
  }

  /*
    `cardId` MUST BE NULLABLE. NULL is a journal note — a member of the
    vocabulary, not a missing value — so a NOT NULL here would silently turn
    every cardless reply into a write error in front of the founder. Read back
    rather than trusted, because a table created from an older copy of the
    migration would pass every check above.
  */
  const cardId = columns.find((row) => String(row.Field) === "cardId");
  if (String(cardId?.Null) !== "YES") {
    throw new Error("`cardId` is NOT NULL — a journal note (cardId NULL) could never be written");
  }

  const [rows] = await conn.query<any[]>(`SELECT COUNT(*) AS n FROM \`${TABLE}\``);
  console.log(`rows: ${rows[0].n}`);
  console.log(
    "nothing writes here until CREW_TAB_SCOPE is set — this is the precondition of that flip, "
    + "not of the code.",
  );
  /* The exception line tracks PRODUCTION — the rite's conformance read is of
     that world alone — so the instruction to delete it prints only when this
     run is the one that discharges it. After a --dev run the line must STAY,
     or the rite reddens on a production table that is genuinely absent. */
  if (world === "production") {
    console.log(
      "Now delete the `crew_replies` line from DECLARED_BUT_UNMIGRATED "
      + "(scripts/lib/schemaConformance.mts); the deploy rite reddens until you do.",
    );
  }
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
