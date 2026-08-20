/**
 * Ceremony — the picture a design was taken out of
 * (`casting_ink_designs.sourceDigest`, migration 0048).
 *
 * # What this column is FOR, so a future operator knows what they are enabling
 *
 * fable-1149 §2b ruled the attach-pointed mint's reuse key: **(attachment
 * digest, placement, side)** — never two design rows minted from one picture,
 * and the side is in the key because the same design on her left and right arms
 * is two designs. The first member had nowhere to live: `digest` names the
 * bytes STORED, which on that road are the cutout, and a cutout is a
 * segmenter's output. Without this column the key names a fact the table does
 * not hold, and the mint would either re-cut and re-file the same picture on
 * every ask or silently reuse a design it never came from.
 *
 * # TWO WORLDS, NAMED OUT LOUD
 *
 * Dev and production are both Railway MySQL on the same host with the same
 * database name and differ only by port, so this script refuses to guess: it
 * takes the world as an argument and prints the port it is about to alter
 * before it alters anything.
 *
 *   npx tsx scripts/ceremony-ink-design-source-digest.mts --dev
 *     reads DATABASE_URL from .env — the dev database, and only that
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-ink-design-source-digest.mts --production
 *     reads MYSQL_PUBLIC_URL from the Railway service environment. NEVER from a
 *     file: a production ceremony that picked up a dev URL from `.env` would
 *     migrate the wrong database and report success.
 *
 * Idempotent: it reads the column's current shape first and says ALREADY
 * APPLIED rather than failing, so a re-run is safe and is the independent
 * confirmation.
 *
 * # ⚠ IN PRODUCTION THIS RUNS BESIDE ITS SIBLING, NOT INSTEAD OF IT
 *
 * `ceremony-ink-cut-route` (0047) is still outstanding in production — verified
 * at the table 2026-08-20, `cutRoute` absent there — and the deployed writer
 * already names it in every INSERT. Running this one alone leaves the ink
 * upload road broken on the other column. They are one table and one chore, and
 * the founder card asks for both in one sitting.
 *
 * # IT MUST NOT INVENT A VALUE, AND THE READ-BACK IS WHERE THAT IS PROVED
 *
 * There is no backfill and there must never be one: a row that exists today was
 * uploaded as a design rather than taken out of a picture, so there is nothing
 * to derive from and nothing a guess could be built out of. The read-back
 * asserts the column is NULLABLE, has no DEFAULT, and that every existing row
 * is NULL — a ceremony that quietly filled the rows would be claiming a design
 * came out of a picture nobody attached, which is the one thing the conflict
 * rule reads this column to decide.
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

const MIGRATION = "drizzle/0048_ink_design_source_digest.sql";
const TABLE = "casting_ink_designs";
const COLUMN = "sourceDigest";

/** Whether a live column's DDL is the digest width 0048 installs. */
function isDigestColumn(ddl: string | null): boolean {
  if (ddl === null) return false;
  return ddl.trim().toLowerCase().replace(/\s+/g, "") === "varchar(64)";
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
    isApplied: async () => isDigestColumn(await columnType(world.connection, TABLE, COLUMN)),
    apply: () => replayMigration(world.connection, MIGRATION),
  });

  console.log("read back from the live table:");

  const ddl = await columnType(world.connection, TABLE, COLUMN);
  if (!isDigestColumn(ddl)) {
    throw new Error(
      `\`${TABLE}\`.\`${COLUMN}\` is ${ddl ?? "absent"}, not varchar(64) — a width that `
      + "disagrees with the attachment digest it is compared against is a comparison "
      + "that silently truncates",
    );
  }

  const [columns] = await world.connection.query<any[]>(
    `SHOW COLUMNS FROM \`${TABLE}\` LIKE ?`,
    [COLUMN],
  );
  const nullable = String(columns[0]?.Null ?? "").toUpperCase();
  if (nullable !== "YES") {
    throw new Error(
      `\`${TABLE}\`.\`${COLUMN}\` is NOT NULL — NULL is what a design uploaded rather `
      + "than taken out of a picture says about itself, and a column that cannot hold "
      + "it has no way to say so",
    );
  }
  const columnDefault = columns[0]?.Default ?? null;
  if (columnDefault !== null) {
    throw new Error(
      `\`${TABLE}\`.\`${COLUMN}\` has a DEFAULT of ${JSON.stringify(columnDefault)} — a default `
      + "here is a claim that a design came out of a picture somebody attached",
    );
  }

  /*
    NOTHING WAS BACKFILLED, read rather than promised. Every row must be NULL
    after this: the mint that fills this column does not exist in either world
    yet, so a non-NULL row would mean a value was invented for it.
  */
  const [[counts]] = await world.connection.query<any[]>(
    `SELECT COUNT(*) AS total, SUM(\`${COLUMN}\` IS NOT NULL) AS stated FROM \`${TABLE}\``,
  ) as unknown as [[{ total: number; stated: number | null }]];
  const stated = Number(counts.stated ?? 0);
  console.log(`  ${TABLE}.${COLUMN}  ${ddl}  NULLABLE  ${counts.total} row(s), ${stated} stated`);
  if (stated !== 0) {
    throw new Error(
      `${stated} row(s) already name a source picture. Nothing writes this column before `
      + "the attach-pointed mint lands, so a non-NULL row means a value was invented for it.",
    );
  }
} catch (error) {
  failure = error;
}
process.exit(await closeCeremony(world, failure));
