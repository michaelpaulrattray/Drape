/**
 * `janitor-publicid-shapes` — CAN THE PRODUCT STILL REACH EVERY ROW IT HAS? (#2496)
 *
 *     npx tsx scripts/janitor-publicid-shapes.mts            the listing
 *     npx tsx scripts/janitor-publicid-shapes.mts --json     the same, machine-readable
 *
 * The class it reads for, the two verdicts, why they are weighted differently
 * and what it deliberately cannot see are all in `scripts/lib/publicIdShapes.mts`
 * and in `docs/JANITOR_LOG.md`. This file finds the tables, reads their rows and
 * prints.
 *
 * ⚠ **Three of the thirteen tables are judged by their OWN route's parser and
 * not by the shared `z.string().uuid()` door, and the run PRINTS which** — two
 * image routes that are stricter and the campaign door that is looser. A verdict
 * without the rule behind it is not readable, so the `--json` document carries
 * the same mapping.
 *
 * # It reads whichever world its environment names, and SAYS WHICH
 *
 * `openDatabase()` resolves `MYSQL_PUBLIC_URL` before `DATABASE_URL`, so a plain
 * local run reads the DEV database off `.env` and
 * `railway run --service MySQL -- …` reads PRODUCTION — and the door prints the
 * host and port either way. That line is load-bearing rather than decorative:
 * the two worlds differ only by port (`:52008` dev, `:23768` production) with
 * the same host and the same database name, and a reading whose world has to be
 * inferred has been inferred wrongly here before.
 *
 * **The dev database is the subject that matters.** Production rows are written
 * by the product alone; dev rows are written by the product AND by every
 * disposable a shift has ever run, which is the whole class.
 *
 * # ⚠ A TABLE IT COULD NOT READ IS NAMED, AND THE RUN IS THEN NOT A TOTAL
 *
 * The dev database has repeatedly sat behind the schema (memory
 * `r6-recovery-state`: migration 0005 was live in production and absent from
 * dev), so a table in `schema.ts` may genuinely not exist in the world being
 * read. An unreadable table is reported as `unread` with its driver error, and
 * the summary then says the reading is a FLOOR and not a total.
 *
 * That is #2501's lesson arriving in another instrument on the same day it was
 * written: a pre-deploy log that had aged out of retention was read by hand as
 * *"the container printed nothing"*, which was a different and wrong fact.
 * **Absence of evidence is reported as absence of evidence.**
 *
 * # The exit code is half the report
 *
 *     0  every table read, every value reachable (`unminted` rows may be listed)
 *     2  at least one value its own route can never load again
 *     3  no fault found, but a table could not be read — a FLOOR, not a total
 *     1  refused — nothing was read, or a width has no judge
 *
 * ⚠ **3 exists because 0 was wrong here, and it was wrong in the direction this
 * card is about.** The first cut printed a loud FLOOR warning over an unreadable
 * table and still exited 0, so a shift recording the code alone would have
 * filed an incomplete reading as a clean one. That is #2501's step-3 mistake
 * exactly — an artifact that had aged out of retention read as *"the container
 * printed nothing"* — and a reading tool must never let the cheap half of its
 * output say more than it knows.
 */
/* The DEV world — the one that matters here — lives in `.env`, so it is loaded.
   That is normally the setup for reading dev under a production wrapper by
   mistake, and the repair is already in the door: `resolveDatabaseUrl()` prefers
   `MYSQL_PUBLIC_URL`, which only exists when somebody wrapped the command on
   purpose, and `assertSameWorld` refuses a mismatch outright. */
import "dotenv/config";

import {
  JUDGED_WIDTHS,
  judgeId,
  judgedPublicIdStores,
  PUBLIC_ID_COLUMN,
  routeParserFor,
  TABLE_ROUTE_PARSERS,
  type PublicIdStore,
} from "./lib/publicIdShapes.mts";
import { openDatabase, worldOf, resolveDatabaseUrl } from "./lib/dbConnection.mts";

type Finding = {
  table: string;
  width: number;
  value: string;
  unreachable: boolean;
  unminted: boolean;
};

type TableReading =
  | { table: string; symbol: string; width: number; read: true; rows: number; findings: Finding[] }
  | { table: string; symbol: string; width: number; read: false; error: string };

const asJson = process.argv.includes("--json");

async function main(): Promise<number> {
  /* Refuses on an empty population or an unjudged width, before anything is
     opened — a reading nobody can trust is worse than no reading. */
  const stores: PublicIdStore[] = judgedPublicIdStores();

  const url = resolveDatabaseUrl();
  const db = await openDatabase();
  const readings: TableReading[] = [];
  try {
    for (const store of stores) {
      try {
        const [rows] = await db.query<Array<Record<string, unknown>>>(
          /* The table name comes from the schema's own declaration, never from
             an argument or an environment value, so there is no road from
             outside this process into this statement. */
          `select \`${PUBLIC_ID_COLUMN}\` as value from \`${store.table}\``,
        );
        const findings: Finding[] = [];
        for (const row of rows) {
          const value = typeof row.value === "string" ? row.value : String(row.value ?? "");
          const verdict = judgeId(value, store);
          if (verdict.unreachable || verdict.unminted) {
            findings.push({ table: store.table, width: store.width, value, ...verdict });
          }
        }
        readings.push({ ...store, read: true, rows: rows.length, findings });
      } catch (error: unknown) {
        readings.push({
          ...store,
          read: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    await db.end();
  }

  const unread = readings.filter((reading): reading is Extract<TableReading, { read: false }> => !reading.read);
  const read = readings.filter((reading): reading is Extract<TableReading, { read: true }> => reading.read);
  const rows = read.reduce((total, reading) => total + reading.rows, 0);
  const findings = read.flatMap((reading) => reading.findings);
  const unreachable = findings.filter((finding) => finding.unreachable);
  const unminted = findings.filter((finding) => finding.unminted && !finding.unreachable);

  if (asJson) {
    console.log(JSON.stringify(
      {
        world: worldOf(url),
        tables: stores.length,
        /* The rule each table was judged by, so no verdict in this document
           arrives without the parser that produced it (#2516's finding). */
        parsers: stores.map((store) => ({
          table: store.table,
          parser: routeParserFor(store).spelling,
          source: routeParserFor(store).source,
        })),
        rows,
        unread: unread.map((reading) => ({ table: reading.table, error: reading.error })),
        unreachable,
        unmintedOnly: unminted,
        total: unread.length === 0,
      },
      null,
      2,
    ));
    return exitCode(unreachable.length, unread.length);
  }

  console.log(`world: ${worldOf(url)}`);
  console.log(
    `\nTABLES DECLARING ${PUBLIC_ID_COLUMN} (${stores.length}), widths ${JUDGED_WIDTHS.join("/")}:`,
  );
  for (const reading of readings) {
    const shape = `${reading.table} (${reading.width})`.padEnd(42);
    if (!reading.read) {
      console.log(`  ${shape} UNREAD — ${reading.error}`);
      continue;
    }
    const faults = reading.findings.filter((finding) => finding.unreachable).length;
    const odd = reading.findings.length - faults;
    console.log(
      `  ${shape} ${String(reading.rows).padStart(6)} rows  `
        + `${faults} unreachable  ${odd} unminted`,
    );
  }

  console.log(`\nrows judged: ${rows}`);

  console.log(`\nUNREACHABLE — its own route's parser refuses it (${unreachable.length}):`);
  for (const finding of unreachable) {
    console.log(`  ${finding.table}.${PUBLIC_ID_COLUMN} = ${JSON.stringify(finding.value)}`);
  }

  console.log(
    `\nUNMINTED ONLY — reachable, but not what the product's mint emits (${unminted.length}).`
      + " Reported, not a fault:",
  );
  for (const finding of unminted) {
    console.log(`  ${finding.table}.${PUBLIC_ID_COLUMN} = ${JSON.stringify(finding.value)}`);
  }

  if (unread.length > 0) {
    console.log(
      `\n⚠ ${unread.length} of ${stores.length} table(s) could not be read, so this reading is a FLOOR`
        + " and not a total. They are named above with the driver's own words.",
    );
  }

  /* ⚠ THE RULE EACH ODD TABLE WAS JUDGED BY, PRINTED EVERY RUN rather than left
     in a docblock. Three of the thirteen do not go through the shared
     `z.string().uuid()` door, and a clean run is only readable if it says which
     rule it applied: the campaign parser is LOOSER than its own mint, so the
     fault axis cannot fire in that table at all, and the two image routes are
     STRICTER, which is the gap the relay's finding on PR #2516 named — an
     uppercase id there reads unreachable now and read as fine before. */
  const judgedByTheirOwnDoor = readings.filter((reading) => TABLE_ROUTE_PARSERS[reading.table]);
  if (judgedByTheirOwnDoor.length > 0) {
    console.log("\nnote: these tables are NOT judged by the shared z.string().uuid() door:");
    for (const reading of judgedByTheirOwnDoor) {
      const parser = routeParserFor(reading);
      console.log(`  ${reading.table} — ${parser.spelling}  (${parser.source})`);
    }
    console.log(
      "  A looser door means the fault axis cannot fire in that table at all; a stricter one means a"
        + " value the shared door accepts is still a row whose picture the product cannot serve.",
    );
  }

  console.log(`\nFAULTS (unreachable): ${unreachable.length}`);
  return exitCode(unreachable.length, unread.length);
}

/**
 * The verdict as a number. A fault outranks an incomplete reading, because a row
 * nobody can load is worse news than a table nobody could read — but an
 * incomplete reading never reports itself as a clean one.
 */
function exitCode(unreachable: number, unread: number): number {
  if (unreachable > 0) return 2;
  return unread > 0 ? 3 : 0;
}

/* Ends by ending the process (`scriptExitDiscipline`): nothing imports this
   file — it is a command, and a command's LAST top-level statement exits. */
main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(
      `janitor-publicid-shapes: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
