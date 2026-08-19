/**
 * Ceremony — the placement column stops being a fence
 * (`casting_ink_designs.placement` and `casting_ink_form_demand.placement`,
 * migration 0046).
 *
 *   npx tsx scripts/ceremony-ink-placement-opens.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-ink-placement-opens.mts --production
 *
 * The world is named, never guessed; the read-apply-read-back rite lives in
 * `lib/ceremony.mts`.
 *
 * # THIS ONE ALTERS TABLES THAT ALREADY HOLD ROWS
 *
 * Unlike most of this program's ceremonies, nothing is created here. Both
 * tables exist and one of them holds his own uploads, so the ceremony refuses
 * outright if either is absent — their absence would mean this is not the world
 * you think it is, and a `CREATE`-shaped recovery is not what this file does.
 *
 * # WHAT IT READS BACK, AND WHY BOTH COLUMNS
 *
 * That both are `varchar(64)` and still `NOT NULL`. The second column is the
 * one worth naming: `casting_ink_form_demand` is the counter fable-1078 said
 * *"keeps counting placements as information, never as refusal grounds"*, and
 * its writer catches its own failure — so a placement its column cannot hold is
 * dropped silently and the counter goes on reading healthy while counting
 * nothing. A ceremony that read back only the design table would leave exactly
 * that half unproven.
 *
 * # NOT NULL IS PART OF THE READING, NOT AN INCIDENTAL
 *
 * A `MODIFY` restates the whole column definition, so nullability is something
 * this ALTER can silently change. There is no such thing as a design filed at
 * nowhere: the customer's word is the row's reason to exist, and a NULL
 * placement would be a design nobody could ever put anywhere. Read back, not
 * assumed.
 */
import {
  applyOnce,
  closeCeremony,
  columnType,
  openCeremonyWorld,
  proveTheReader,
  replayMigration,
  tableExists,
} from "./lib/ceremony.mts";

const MIGRATION = "drizzle/0046_ink_placement_opens.sql";
const COLUMN = "placement";
const TABLES = ["casting_ink_designs", "casting_ink_form_demand"] as const;

/** Whether a live column's DDL is the open shape this migration installs. */
function isOpen(ddl: string | null): boolean {
  return ddl !== null && /^varchar\(64\)$/i.test(ddl.trim());
}

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
try {
  await proveTheReader(world.connection);

  for (const table of TABLES) {
    if (!await tableExists(world.connection, table)) {
      throw new Error(
        `\`${table}\` is not here. This ceremony ALTERS the ink road's tables; `
        + "it does not create them, and the absence of one means this world is "
        + "not the one you think it is.",
      );
    }
  }

  await applyOnce({
    /* BOTH, deliberately. An `isApplied` that asked about one column would
       report ALREADY APPLIED on a world where the first ALTER landed and the
       second did not — and the half that would be left behind is the silent
       one. */
    what: `${COLUMN} is open on both ${TABLES.join(" and ")}`,
    isApplied: async () => {
      for (const table of TABLES) {
        if (!isOpen(await columnType(world.connection, table, COLUMN))) return false;
      }
      return true;
    },
    apply: () => replayMigration(world.connection, MIGRATION),
  });

  console.log("read back from the live tables:");

  for (const table of TABLES) {
    const ddl = await columnType(world.connection, table, COLUMN);
    if (ddl === null) throw new Error(`\`${COLUMN}\` is missing from \`${table}\` after the apply`);
    if (!isOpen(ddl)) {
      throw new Error(
        `\`${table}\`.\`${COLUMN}\` is ${ddl}, not varchar(64) — the column is still a fence, `
        + "and a customer's own placement word would be refused by the database",
      );
    }

    const [columns] = await world.connection.query<any[]>(
      `SHOW COLUMNS FROM \`${table}\` LIKE ?`,
      [COLUMN],
    );
    const nullable = String(columns[0]?.Null ?? "").toUpperCase();
    if (nullable !== "NO") {
      throw new Error(
        `\`${table}\`.\`${COLUMN}\` became NULLABLE — a MODIFY restates the whole column, `
        + "and a design filed at nowhere is a row that can never be put anywhere",
      );
    }

    /* The rows are counted rather than trusted: enum → varchar is lossless in
       the manual, and the manual is not this database. A count that dropped is
       the loudest possible symptom and costs one statement to see. */
    const [[{ n }]] = await world.connection.query<any[]>(
      `SELECT COUNT(*) AS n FROM \`${table}\``,
    ) as unknown as [[{ n: number }]];
    console.log(`  ${table.padEnd(25)} ${ddl}  NOT NULL  ${n} row(s)`);
  }
} catch (error) {
  failure = error;
}
process.exit(await closeCeremony(world, failure));
