/**
 * Ceremony — the intent declaration on the ink design store
 * (`casting_ink_designs.intents`, migration 0035, ruled fable-937).
 *
 * Inert on its own: a column nothing writes is a column nothing writes. It
 * lands AHEAD of the code that names it, which is the ordering this program
 * runs under — a new COLUMN is in every INSERT the moment its writer ships, and
 * the typechecker says so out loud, which is how this split was chosen.
 *
 *   npx tsx scripts/ceremony-ink-design-intents.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-ink-design-intents.mts --production
 *
 * The world is named, never guessed; the refusals and the read-apply-read-back
 * rite live in `lib/ceremony.mts`.
 *
 * # WHAT IT READS BACK, and why the type alone is not enough
 *
 * A JSON column's DDL says `json` and nothing about what may be in it — the
 * members live in `shared/referenceIntents.ts` and are enforced at the door.
 * So the readback here proves the two things the DATABASE can actually be
 * wrong about: that the column is there and NOT NULL (a nullable one would let
 * a writer file a design with no declared intent, which is the whole point of
 * the amendment), and that its default is the one value a pre-existing row
 * could honestly have.
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

const TABLE = "casting_ink_designs";
const COLUMN = "intents";

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
try {
  await proveTheReader(world.connection);

  /* The parent migration is 0034's table. A column ceremony run against a
     database that never took the table would otherwise fail with MySQL's own
     wording, which reads like a bug rather than like an order of operations. */
  if (!await tableExists(world.connection, TABLE)) {
    throw new Error(
      `\`${TABLE}\` does not exist in this world — run ceremony-ink-designs.mts (0034) first`,
    );
  }

  await applyOnce({
    what: "the intent declaration is on the ink design table",
    isApplied: async () => await columnType(world.connection, TABLE, COLUMN) !== null,
    apply: () => replayMigration(world.connection, "drizzle/0035_ink_design_intents.sql"),
  });

  const [columns] = await world.connection.query<any[]>(
    `SHOW COLUMNS FROM \`${TABLE}\` LIKE ?`,
    [COLUMN],
  );
  const column = columns[0];
  if (!column) throw new Error(`\`${COLUMN}\` is missing from \`${TABLE}\``);
  console.log(`  ${COLUMN}  ${column.Type}  null=${column.Null}  default=${column.Default ?? "(none)"}`);
  if (String(column.Null).toUpperCase() !== "NO") {
    throw new Error("`intents` is nullable — a design with no declared intent could be filed");
  }

  const [rows] = await world.connection.query<any[]>(`SELECT COUNT(*) AS n FROM \`${TABLE}\``);
  console.log(`rows: ${rows[0].n}`);
} catch (cause) {
  failure = cause;
}

process.exit(await closeCeremony(world, failure));
