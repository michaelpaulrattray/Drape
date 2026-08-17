/**
 * Ceremony — the kind-property store (`casting_open_kind_properties`,
 * migration 0033, `OPEN_KIND_PROPERTIES_DESIGN.md` §5).
 *
 * Inert on its own: a table nothing writes is a table nothing writes. It lands
 * AHEAD of the code that names it, which is the ordering this program runs
 * under — a new table is in every INSERT the moment its writer ships, and there
 * is no dark landing for one.
 *
 *   npx tsx scripts/ceremony-open-kind-properties.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-open-kind-properties.mts --production
 *
 * The world is named, never guessed; the refusals and the read-apply-read-back
 * rite live in `lib/ceremony.mts`, and the shape assertions in
 * `lib/openKindPropertyShape.mts` so the rehearsal can drive the same ones
 * against deliberately-wrong tables.
 */
import {
  applyOnce,
  closeCeremony,
  openCeremonyWorld,
  proveTheReader,
  replayMigration,
  tableExists,
} from "./lib/ceremony.mts";
import { assertKindPropertyShape, OPEN_KIND_PROPERTY_TABLE } from "./lib/openKindPropertyShape.mts";

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
try {
  await proveTheReader(world.connection);

  await applyOnce({
    what: "the kind-property table is here",
    isApplied: () => tableExists(world.connection, OPEN_KIND_PROPERTY_TABLE),
    apply: () => replayMigration(world.connection, "drizzle/0033_casting_open_kind_properties.sql"),
  });

  /* WHAT IS ACTUALLY THERE. A CREATE that succeeded says the statement parsed;
     this says the columns and the key are the ones the design ruled. */
  for (const line of await assertKindPropertyShape(world.connection)) console.log(line);

  const [rows] = await world.connection.query<any[]>(`SELECT COUNT(*) AS n FROM \`${OPEN_KIND_PROPERTY_TABLE}\``);
  console.log(`rows: ${rows[0].n}`);
} catch (cause) {
  failure = cause;
}

process.exit(await closeCeremony(world, failure));
