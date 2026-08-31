/**
 * Ceremony — his "not relevant" tap gets its table (`crew_card_intents`,
 * migration 0059; issue #325's second half).
 *
 * Founder, 2026-08-31, at the live panel: *"should there be a delete icon next
 * to them so i can close them or remove them myself if they are not relevant?"*
 * This is the one command that turns the tap on.
 *
 * ⚠ **IT IS INERT UNTIL IT RUNS, AND NOTHING BREAKS MEANWHILE.** Both sides
 * already work without it: `server/db/crewCardIntents.ts` catches
 * ER_NO_SUCH_TABLE and returns `available: false`, and the panel withholds the
 * buttons in that window rather than drawing controls over a store that cannot
 * record them. So between the deploy and this command his Crew tab is exactly
 * the panel he has today.
 *
 * ⚠ **AND THE FALLBACK WITHHOLDS THE CONTROL RATHER THAN DRAWING A DEAD ONE.**
 * An empty intent list and an absent table are the same shape in a bare map and
 * mean opposite things — one is "he has tapped nothing", the other is "a tap
 * cannot be recorded". Drawing the button over the second is the lying-control
 * shape his own stub ruling forbids.
 *
 * TWO WORLDS, NAMED OUT LOUD. Dev and production are both Railway MySQL on the
 * same host with the same database name and differ only by port, so this script
 * refuses to guess: it takes the world as an argument and prints the port it is
 * about to alter before it alters anything.
 *
 *   npx tsx scripts/ceremony-crew-card-intents.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-crew-card-intents.mts --production
 *
 * Idempotent: it reads the table's existence first and says ALREADY APPLIED
 * rather than failing, so a re-run is safe and is the independent confirmation.
 *
 * One thing to do the day this runs against production, and it is one line:
 *
 *   delete `crew_card_intents` from DECLARED_BUT_UNMIGRATED in
 *   `scripts/lib/schemaConformance.mts` AND its pin in
 *   `server/schemaConformance.test.ts`, in the SAME commit. The deploy rite
 *   reddens on a stale exception by design, and that redness is the reminder.
 */
import { readFile } from "node:fs/promises";

import { openDatabase } from "./lib/dbConnection.mts";

const TABLE = "crew_card_intents";
const MIGRATION = "drizzle/0059_crew_card_intents.sql";

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
    "SHOW TABLES LIKE" returning nothing is the whole basis for deciding to
    CREATE — and an empty result is also what a wrong database or a silently
    failed query looks like. So the reader is asked about a table that certainly
    exists here first.
  */
  const [control] = await conn.query<any[]>("SHOW TABLES LIKE 'users'");
  if (control.length !== 1) {
    throw new Error("the existence reader cannot see `users` — wrong database, or a reader that cannot say yes");
  }

  const [before] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  if (before.length === 1) {
    console.log("ALREADY APPLIED — the card-intent table is here.");
  } else {
    /* The migration file itself, replayed rather than retyped: a ceremony that
       re-types its own DDL is a second copy of the schema and it drifts from the
       one every test ran against. */
    const sql = await readFile(MIGRATION, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await conn.query(trimmed);
    }
    const [after] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
    if (after.length !== 1) throw new Error("the migration ran and the table is not there — stop and investigate");
    console.log("APPLIED — the card-intent table exists.");
  }

  /*
    WHAT IS ACTUALLY THERE, read back rather than assumed (working law 1). A
    CREATE that succeeded says the statement parsed; this says the columns are
    the ones the design named — and the SHORT LIST IS THE BOUNDARY, so a column
    nobody expected appearing here is a finding rather than a curiosity.
  */
  const [columns] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\``);
  const names = columns.map((row) => String(row.Field));
  console.log(`columns: ${names.join(", ")}`);
  const expected = [
    "id", "issueNumber", "intent", "markedByUserId", "markedAt",
    "withdrawnAt", "resolution", "resolutionNote", "resolvedAt",
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
    THE FOUR NULLABLE COLUMNS ARE THE FEATURE, NOT A TOLERANCE.

    `withdrawnAt` NULL means the mark still stands; `resolution` NULL means no
    shift has answered yet. Both are members of the vocabulary rather than
    missing values, and a NOT NULL on either would make a fresh tap unwritable —
    the row could only ever be created already answered.
  */
  for (const nullable of ["withdrawnAt", "resolution", "resolutionNote", "resolvedAt"]) {
    const column = columns.find((row) => String(row.Field) === nullable);
    if (String(column?.Null) !== "YES") {
      throw new Error(`\`${nullable}\` is NOT NULL — a fresh, unanswered tap could never be written`);
    }
  }
  /* And the ones that must NOT be nullable: a mark with no card, no meaning or
     no author is not a thing anybody can act on. */
  for (const required of ["issueNumber", "intent", "markedByUserId", "markedAt"]) {
    const column = columns.find((row) => String(row.Field) === required);
    if (String(column?.Null) !== "NO") {
      throw new Error(`\`${required}\` is nullable — a mark without it says nothing a shift could act on`);
    }
  }

  /*
    THE UNIQUE INDEX IS THE CONCURRENCY DESIGN AND IS READ BACK TOO. Without it
    the tap's upsert becomes an append, and two rows saying different things
    about one card would leave the reader to pick — which is the shape
    `crew_queue_counts.categoryKey` is unique to avoid.
  */
  const [indexes] = await conn.query<any[]>(`SHOW INDEX FROM \`${TABLE}\``);
  const unique = indexes.find((row) => String(row.Key_name) === "uq_crew_card_intents_issue");
  if (!unique) throw new Error("`uq_crew_card_intents_issue` is missing — the tap would append rather than upsert");
  if (Number(unique.Non_unique) !== 0) throw new Error("`uq_crew_card_intents_issue` is not UNIQUE — two rows could describe one card");
  console.log("index: uq_crew_card_intents_issue · unique ✓");

  const [rows] = await conn.query<any[]>(`SELECT COUNT(*) AS n FROM \`${TABLE}\``);
  console.log(`rows: ${rows[0].n}`);
  console.log("he writes here by tapping Not relevant; shifts answer through scripts/crew-card-intents.mts --resolve.");
  if (world === "production") {
    console.log(
      "Now delete the `crew_card_intents` line from DECLARED_BUT_UNMIGRATED "
      + "(scripts/lib/schemaConformance.mts) and its pin in server/schemaConformance.test.ts; "
      + "the deploy rite reddens until you do.",
    );
  }
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
