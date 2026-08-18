/**
 * Ceremony — the plate's own words (`casting_ink_plates.promptDigest`,
 * migration 0038).
 *
 *   npx tsx scripts/ceremony-ink-plate-prompt-digest.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-ink-plate-prompt-digest.mts --production
 *
 * The world is named, never guessed; the read-apply-read-back rite lives in
 * `lib/ceremony.mts`.
 *
 * # THE ORDER THIS ONE SITS IN
 *
 * It ALTERS a table 0037 creates, so it cannot run first and it says so rather
 * than failing at MySQL's own error. In production neither has been applied,
 * and both ride the same bundled sitting — 0034, 0037, this, and the variants
 * provenance column — so that a single founder ceremony discharges the whole
 * pending set instead of interrupting him four times.
 *
 * # WHAT IT READS BACK
 *
 * That the column is a `varchar(64)` and **NULLABLE**, which is the decision
 * rather than the column. Nullable is what lets the two rows minted before this
 * existed stay honest: a NOT NULL column would have forced a backfill that
 * guessed which version of the prompt was live when a row was written, and a
 * guessed digest is worse than an absent one — it would read as a measurement.
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

const TABLE = "casting_ink_plates";
const COLUMN = "promptDigest";

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
try {
  await proveTheReader(world.connection);

  if (!await tableExists(world.connection, TABLE)) {
    throw new Error(
      `\`${TABLE}\` is not here — run scripts/ceremony-ink-plates.mts (0037) first. `
      + "This ceremony alters that table; it does not create it.",
    );
  }

  await applyOnce({
    what: `${TABLE}.${COLUMN} is here`,
    isApplied: async () => await columnType(world.connection, TABLE, COLUMN) !== null,
    apply: () => replayMigration(world.connection, "drizzle/0038_casting_ink_plate_prompt_digest.sql"),
  });

  console.log("read back from the live table:");

  const type = await columnType(world.connection, TABLE, COLUMN);
  if (type === null) throw new Error(`\`${COLUMN}\` is missing after the apply`);
  if (!/^varchar\(64\)$/i.test(type)) {
    throw new Error(`\`${COLUMN}\` is ${type}, not varchar(64) — a sha256 hex digest is 64 characters`);
  }
  console.log(`  ${COLUMN}    ${type}`);

  /* NULLABLE is the decision. A NOT NULL column here would have demanded a
     backfill that guessed which prompt an older row stood on. */
  const [columns] = await world.connection.query<any[]>(
    `SHOW COLUMNS FROM \`${TABLE}\` LIKE ?`,
    [COLUMN],
  );
  const nullable = String(columns[0]?.Null ?? "").toUpperCase();
  if (nullable !== "YES") {
    throw new Error(
      `\`${COLUMN}\` is NOT NULL, and the rows minted before it existed have no honest value — `
      + "a backfilled digest would read as a measurement of words nobody recorded",
    );
  }
  console.log(`  nullable       YES — older rows say "not on this one" rather than guessing`);
} catch (error) {
  failure = error;
}
process.exit(await closeCeremony(world, failure));
