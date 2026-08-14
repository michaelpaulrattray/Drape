/**
 * Ceremony — the library's third role (`casting_reference_library.role`,
 * migration 0030).
 *
 * Inert on its own: widening an ENUM legalises a value nothing writes yet. It
 * lands AHEAD of the code that names it, which is the ordering this program runs
 * under — an INSERT naming a value the column will not accept is not inert, and
 * the render that would do it is a paid one.
 *
 * The world discipline, the proven reader, the verbatim replay and the run-twice
 * safety are the SHARED skeleton (`lib/ceremony.mts`, fable-486 §e) rather than
 * a hand-copy of the ceremony before this one. What is left here is what is
 * actually particular: which column, which migration file, and what evidence to
 * print when it is done.
 *
 *   npx tsx scripts/ceremony-library-vacancy.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-library-vacancy.mts --production
 */
import {
  applyOnce,
  closeCeremony,
  columnType,
  openCeremonyWorld,
  proveTheReader,
  replayMigration,
} from "./lib/ceremony.mts";

const TABLE = "casting_reference_library";
const COLUMN = "role";
const VALUE = "vacancy";
const MIGRATION = "drizzle/0030_casting_v2_library_vacancy.sql";

const world = await openCeremonyWorld(process.argv);
try {
  await proveTheReader(world.connection);

  const type = await columnType(world.connection, TABLE, COLUMN);
  if (type === null) throw new Error(`no \`${COLUMN}\` column — wrong database, or the library table is absent`);
  console.log(`${COLUMN} is currently ${type}`);

  await applyOnce({
    what: `\`${VALUE}\` is legal in ${TABLE}.${COLUMN}`,
    isApplied: async () => (await columnType(world.connection, TABLE, COLUMN))?.includes(VALUE) ?? false,
    apply: async () => {
      const statements = await replayMigration(world.connection, MIGRATION);
      console.log(`replayed ${MIGRATION} — ${statements} statement(s)`);
    },
  });

  /* Rows are unchanged by an ENUM widening, and this says so rather than
     assuming it: the counts after are the same rows. */
  const [counts] = await world.connection.query<any[]>(
    `SELECT ${COLUMN}, COUNT(*) AS n FROM \`${TABLE}\` GROUP BY ${COLUMN} ORDER BY ${COLUMN}`,
  );
  for (const row of counts) console.log(`  ${String(row[COLUMN]).padEnd(8)} ${row.n} row(s)`);
} catch (cause) {
  process.exit(await closeCeremony(world, cause));
}

process.exit(await closeCeremony(world));
