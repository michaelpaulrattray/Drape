/**
 * Ceremony — the cut disposition on a stored design
 * (`casting_ink_designs.cutRoute`, migration 0047).
 *
 * # What this column is FOR, so a future operator knows what they are enabling
 *
 * fable-1137 §4's containment condition: **a design row whose cut disposition
 * is `null` never rides to a render.** NULL means *nobody looked* — the state
 * of every row written while `CASTING_INK_CUT_SCOPE` was off — and on this road
 * unexamined bytes may be a photograph of a person. Without the column the
 * control has nothing to read, and every row in the table is indistinguishable
 * from every other.
 *
 * # TWO WORLDS, NAMED OUT LOUD
 *
 * Dev and production are both Railway MySQL on the same host with the same
 * database name and differ only by port, so this script refuses to guess: it
 * takes the world as an argument and prints the port it is about to alter
 * before it alters anything.
 *
 *   npx tsx scripts/ceremony-ink-cut-route.mts --dev
 *     reads DATABASE_URL from .env — the dev database, and only that
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-ink-cut-route.mts --production
 *     reads MYSQL_PUBLIC_URL from the Railway service environment. NEVER from a
 *     file: a production ceremony that picked up a dev URL from `.env` would
 *     migrate the wrong database and report success.
 *
 * Idempotent: it reads the column's current shape first and says ALREADY
 * APPLIED rather than failing, so a re-run is safe and is the independent
 * confirmation.
 *
 * # IT MUST NOT INVENT A VALUE, AND THE READ-BACK IS WHERE THAT IS PROVED
 *
 * There is no backfill and there must never be one: the three ways to guess a
 * disposition were each rejected with a reason (opus-846 §2, ratified
 * fable-1142 §2). So the read-back asserts the column is NULLABLE and that
 * every existing row is NULL — a ceremony that quietly defaulted the rows would
 * be filing a claim about what was done to a customer's picture, which is the
 * one thing this column exists to be trusted about.
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

const MIGRATION = "drizzle/0047_ink_design_cut_route.sql";
const TABLE = "casting_ink_designs";
const COLUMN = "cutRoute";

/** Whether a live column's DDL is the closed two-member vocabulary 0047 installs. */
function isRouteEnum(ddl: string | null): boolean {
  if (ddl === null) return false;
  const normalized = ddl.trim().toLowerCase().replace(/\s+/g, "");
  return normalized === "enum('cut','ridewhole')";
}

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
try {
  await proveTheReader(world.connection);

  if (!await tableExists(world.connection, TABLE)) {
    throw new Error(
      `\`${TABLE}\` is not here. This ceremony ALTERS the ink design store; it `
      + "does not create it, and the absence of it means this world is not the "
      + "one you think it is.",
    );
  }

  await applyOnce({
    what: `${COLUMN} exists on ${TABLE}`,
    isApplied: async () => isRouteEnum(await columnType(world.connection, TABLE, COLUMN)),
    apply: () => replayMigration(world.connection, MIGRATION),
  });

  console.log("read back from the live table:");

  const ddl = await columnType(world.connection, TABLE, COLUMN);
  if (!isRouteEnum(ddl)) {
    throw new Error(
      `\`${TABLE}\`.\`${COLUMN}\` is ${ddl ?? "absent"}, not enum('cut','rideWhole') — `
      + "the disposition the containment condition reads is not there",
    );
  }

  const [columns] = await world.connection.query<any[]>(
    `SHOW COLUMNS FROM \`${TABLE}\` LIKE ?`,
    [COLUMN],
  );
  const nullable = String(columns[0]?.Null ?? "").toUpperCase();
  if (nullable !== "YES") {
    throw new Error(
      `\`${TABLE}\`.\`${COLUMN}\` is NOT NULL — NULL is the sentinel meaning nobody `
      + "looked, and a column that cannot hold it has no way to say so",
    );
  }
  const columnDefault = columns[0]?.Default ?? null;
  if (columnDefault !== null) {
    throw new Error(
      `\`${TABLE}\`.\`${COLUMN}\` has a DEFAULT of ${JSON.stringify(columnDefault)} — a default `
      + "here is a guess about what was done to a customer's picture",
    );
  }

  /*
    NOTHING WAS BACKFILLED, read rather than promised. Every row must be NULL
    after this: there is no source to derive a disposition from, and a row that
    came out non-NULL would mean something invented one.
  */
  const [[counts]] = await world.connection.query<any[]>(
    `SELECT COUNT(*) AS total, SUM(\`${COLUMN}\` IS NOT NULL) AS stated FROM \`${TABLE}\``,
  ) as unknown as [[{ total: number; stated: number | null }]];
  const stated = Number(counts.stated ?? 0);
  console.log(`  ${TABLE}.${COLUMN}  ${ddl}  NULLABLE  ${counts.total} row(s), ${stated} stated`);
  if (stated !== 0) {
    throw new Error(
      `${stated} row(s) already carry a disposition. Nothing writes this column before `
      + "the upload wire lands, so a non-NULL row means a value was invented for it.",
    );
  }
} catch (error) {
  failure = error;
}
process.exit(await closeCeremony(world, failure));
