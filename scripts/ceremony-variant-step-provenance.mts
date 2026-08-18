/**
 * Ceremony — where each step's words came from
 * (`casting_candidate_variants.stepProvenance`, migration 0039).
 *
 *   npx tsx scripts/ceremony-variant-step-provenance.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-variant-step-provenance.mts --production
 *
 * The world is named, never guessed; the read-apply-read-back rite lives in
 * `lib/ceremony.mts`.
 *
 * # THE NUMBER MOVED, AND THAT IS WORTH SAYING OUT LOUD
 *
 * This column was designed as migration 0038 (fable-968) and the record still
 * calls it that in places. 0038 was taken by the plate's prompt digest while
 * the provenance window waited for a ceremony to ride with, so it is **0039**.
 * A ceremony that replayed the file it was named after would apply somebody
 * else's migration and read back a column that is not this one.
 *
 * # THE ORDER THIS ONE SITS IN — AND IT IS THE ONE THAT DOES NOT DEPEND
 *
 * It alters `casting_candidate_variants`, which exists in every world and has
 * since Casting V2 shipped. Unlike its three bundle-mates it has no
 * predecessor to wait for: 0034 creates the ink designs, 0037 the plates, 0038
 * alters 0037's table. This one can be applied on its own at any point.
 *
 * It rides the bundle anyway, because the bundle exists for HIS time rather
 * than for the dependency graph — one founder sitting discharging the whole
 * pending set instead of four interruptions.
 *
 * # WHAT IT READS BACK
 *
 * That the column is `json` and **NULLABLE**, which is the decision rather than
 * the column. Whether a step's words came off a photograph is not recoverable
 * from the words, so there is no honest backfill — a NOT NULL column would have
 * forced one, and a guessed provenance reads exactly like a measured one.
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

const TABLE = "casting_candidate_variants";
const COLUMN = "stepProvenance";

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
try {
  await proveTheReader(world.connection);

  if (!await tableExists(world.connection, TABLE)) {
    throw new Error(
      `\`${TABLE}\` is not here. This ceremony alters the Casting V2 variants `
      + "table; it does not create it, and its absence means this world is not "
      + "the one you think it is.",
    );
  }

  await applyOnce({
    what: `${TABLE}.${COLUMN} is here`,
    isApplied: async () => await columnType(world.connection, TABLE, COLUMN) !== null,
    apply: () => replayMigration(world.connection, "drizzle/0039_casting_v2_variant_step_provenance.sql"),
  });

  console.log("read back from the live table:");

  const type = await columnType(world.connection, TABLE, COLUMN);
  if (type === null) throw new Error(`\`${COLUMN}\` is missing after the apply`);
  if (!/^json$/i.test(type)) {
    throw new Error(`\`${COLUMN}\` is ${type}, not json — it carries one entry per step, not a scalar`);
  }
  console.log(`  ${COLUMN}   ${type}`);

  /* NULLABLE is the decision, not the column. Whether a step's words came off a
     photograph is not recoverable from the words, so a NOT NULL column would
     have demanded a backfill that invented an answer — and an invented
     provenance reads exactly like a measured one. */
  const [columns] = await world.connection.query<any[]>(
    `SHOW COLUMNS FROM \`${TABLE}\` LIKE ?`,
    [COLUMN],
  );
  const nullable = String(columns[0]?.Null ?? "").toUpperCase();
  if (nullable !== "YES") {
    throw new Error(
      `\`${COLUMN}\` is NOT NULL, and no row written before it existed has an honest value — `
      + "there is no backfill for where a sentence came from",
    );
  }
  console.log(`  nullable         YES — older rows say "not on this one" rather than guessing`);
} catch (error) {
  failure = error;
}
process.exit(await closeCeremony(world, failure));
