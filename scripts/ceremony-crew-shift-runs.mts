/**
 * Ceremony — the live shift row (`crew_shift_runs`, migration 0055; issue #272).
 *
 * One row is: one night-shift session, opened when it chooses its brief and
 * stamped terminal when it exits. It is what makes the Crew tab a VIEW of what
 * is happening rather than a report of what happened — the founder's own
 * complaint: *"if my shifts are running and i have no idea what they are
 * working on or doing thats dangerous"*.
 *
 * **This one is inert until it runs, and it fails soft rather than loudly.**
 * `server/db/crewShiftRuns.ts` answers `available: false` on an absent table, so
 * between the deploy and this ceremony the Crew tab is exactly what it is today
 * plus a strip that says the row is not live yet. Nothing breaks; nothing is
 * lost; the shift's own `crew-shift-start.mts` refuses and says so.
 *
 * One thing to do the day this runs against production, and it is one line:
 *
 *   delete `crew_shift_runs` from `DECLARED_BUT_UNMIGRATED` in
 *   `scripts/lib/schemaConformance.mts` — the deploy rite reddens on a stale
 *   exception, by design, and that redness is the reminder.
 *
 * TWO WORLDS, NAMED OUT LOUD. Dev and production are both Railway MySQL on the
 * same host with the same database name and differ only by port, so this script
 * refuses to guess: it takes the world as an argument and prints the port it is
 * about to alter before it alters anything.
 *
 *   npx tsx scripts/ceremony-crew-shift-runs.mts --dev
 *     reads DATABASE_URL from .env — the dev database, and only that
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-crew-shift-runs.mts --production
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

const TABLE = "crew_shift_runs";

const conn = await openDatabase(url);
try {
  /*
    THE READER IS PROVEN BEFORE ITS ANSWER IS BELIEVED (working law 2).

    "SHOW TABLES LIKE" returning nothing is the whole basis for deciding to
    create — and an empty result is also exactly what a wrong-database or a
    silently-failed query looks like. So the same reader is pointed at a table
    that certainly exists here first.
  */
  const [control] = await conn.query<any[]>("SHOW TABLES LIKE 'users'");
  if (control.length !== 1) {
    throw new Error("the existence reader cannot see `users` — wrong database, or a reader that cannot say yes");
  }

  const [before] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  if (before.length === 1) {
    console.log("ALREADY APPLIED — the shift-run table is here.");
  } else {
    /* The migration file itself, replayed rather than retyped: a ceremony that
       re-types its own DDL is a second copy of the schema and it drifts from the
       one every test ran against. */
    const sql = await readFile("drizzle/0055_crew_shift_runs.sql", "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await conn.query(trimmed);
    }
    const [after] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
    if (after.length !== 1) throw new Error("the migration ran and the table is not there — stop and investigate");
    console.log("APPLIED — the shift-run table exists.");
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
  const expected = [
    "id", "shift", "seat", "workKind", "cardRef", "cardTitle", "intent",
    "branch", "startedAt", "heartbeatAt", "endedAt", "outcome", "outcomeNote", "prNumber",
  ];
  for (const column of expected) {
    if (!names.includes(column)) throw new Error(`\`${column}\` is missing — the table is not the one the design describes`);
  }
  for (const surplus of names) {
    if (!expected.includes(surplus)) {
      throw new Error(`\`${surplus}\` is in this table and the design does not name it — stop and investigate`);
    }
  }

  /*
    `endedAt` MUST BE NULLABLE, AND IT IS THE WHOLE FEATURE.

    NULL means RUNNING — a member of the vocabulary, not a missing value. A NOT
    NULL here would make an open run unwritable, so the page could only ever
    show finished shifts, which is the exact defect #272 exists to fix. Read
    back rather than trusted, because a table created from an older copy of the
    migration would pass every check above.
  */
  for (const nullable of ["endedAt", "outcome", "outcomeNote", "prNumber", "cardRef", "cardTitle", "branch"]) {
    const column = columns.find((row) => String(row.Field) === nullable);
    if (String(column?.Null) !== "YES") {
      throw new Error(`\`${nullable}\` is NOT NULL — an open run could never be written`);
    }
  }
  /* And the two that must NOT be nullable: a run with no start and no heartbeat
     cannot be given a state at all. */
  for (const required of ["shift", "seat", "workKind", "intent", "startedAt", "heartbeatAt"]) {
    const column = columns.find((row) => String(row.Field) === required);
    if (String(column?.Null) !== "NO") {
      throw new Error(`\`${required}\` is nullable — a run without it has no state the page can derive`);
    }
  }

  const [rows] = await conn.query<any[]>(`SELECT COUNT(*) AS n FROM \`${TABLE}\``);
  console.log(`rows: ${rows[0].n}`);
  console.log("shifts write here through scripts/crew-shift-start.mts; the page reads it through crew.getState.");
  if (world === "production") {
    console.log(
      "Now delete the `crew_shift_runs` line from DECLARED_BUT_UNMIGRATED "
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
