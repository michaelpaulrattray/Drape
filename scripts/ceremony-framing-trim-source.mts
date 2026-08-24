/**
 * Ceremony — **THE FRAMING TRIM'S KEPT ORIGINAL** (`casting_candidates.sourceKey`,
 * migration 0053): where a trimmed candidate's UNTRIMMED 1536x2304 frame lives,
 * so a later framing change is a re-trim rather than a re-render.
 * (Founder ruling 2026-08-24 on his own eye at the court's strips; design
 * `docs/specs/CASTING_FRAMING_TRIM_BUILD.md` §7, KEEP ruled fable-1576 §1, its
 * true price ruled fable-1577 §1.)
 *
 *   npx tsx scripts/ceremony-framing-trim-source.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-framing-trim-source.mts --production
 *
 * The world is named, never guessed; the refusals and the read-apply-read-back
 * rite live in `lib/ceremony.mts`.
 *
 * # WHY THIS IS A BLOCKING PREREQUISITE OF THE CODE, NOT OF THE FLIP
 *
 * Migration 0051's ceremony wrote the argument and it holds unchanged here:
 * **this adds a column to a table the whole studio already SELECTs.** Drizzle
 * names its columns in the statement, so the moment `drizzle/schema.ts` gains
 * this one, every read of `casting_candidates` in the product asks for it —
 * flag or no flag, dark or not. Against a production database that has not
 * taken this migration that is not a dark landing; it is the casting tray
 * failing to load for everybody.
 *
 * So the order is **this command -> the schema half -> the write -> his gate ->
 * the flip**, and until this command has run in a world, the schema half must
 * not reach it. At the commit that carries migration 0053, `drizzle/schema.ts`
 * deliberately does not name the column.
 *
 * # WHAT IT READS BACK, and why each one is worth a round trip
 *
 * **The DEFAULT, which is the one that would be a permanent, silent loss.**
 * `NULL` here means *this candidate has no kept original* — cast before the trim
 * existed, or cast on an untrimmed roll — and that meaning survives only if the
 * ALTER left the historical rows alone. MySQL fills every existing row with a
 * column's DEFAULT when one is given, so a copy of this migration carrying one
 * would stamp every historical candidate with a claim that it has an original
 * somewhere. **There is no repair afterwards**, and a table created from such a
 * copy looks entirely healthy: the reader would go hunting for objects that were
 * never written, and the retention manifest would queue deletes for keys that do
 * not exist.
 *
 * **The width, because a truncated storage key is a lost object.** 512, the same
 * as `imageKey` and `thumbKey`, because it holds the same kind of thing. Under
 * `STRICT_TRANS_TABLES` a narrower column errors at the write — but the worse
 * world is a lenient one, where the key is silently cut and the object it names
 * can never be found again by the purge. It is read back BY VALUE.
 *
 * **And it asserts the NEIGHBOURS are still there.** `imageKey` and `thumbKey`
 * are the two keys `candidateRetention.ts` enumerates today, and this column is
 * the third member of that list. If either neighbour has gone, the manifest this
 * column is about to join is not the manifest this design was written against.
 */
import {
  applyOnce,
  closeCeremony,
  openCeremonyWorld,
  proveTheReader,
  replayMigration,
  tableExists,
} from "./lib/ceremony.mts";

const TABLE = "casting_candidates";
const COLUMN = "sourceKey";
const WANTED_TYPE = "varchar(512)";

type Connection = Awaited<ReturnType<typeof openCeremonyWorld>>["connection"];

/**
 * A column's live DDL, its nullability AND its default — the same reading
 * `ceremony-two-paths.mts` needed and for the same reason: `columnType` in the
 * shared skeleton answers the Type alone, and the thing that can destroy data
 * here is the DEFAULT.
 */
async function columnFacts(
  connection: Connection,
  column: string,
): Promise<{ type: string; nullable: boolean; dflt: string | null } | null> {
  const [rows] = await connection.query<any[]>(
    `SHOW COLUMNS FROM \`${TABLE}\` LIKE ?`,
    [column],
  );
  if (rows.length !== 1) return null;
  return {
    type: String(rows[0].Type),
    nullable: String(rows[0].Null).toUpperCase() === "YES",
    dflt: rows[0].Default === null ? null : String(rows[0].Default),
  };
}

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
try {
  await proveTheReader(world.connection);

  if (!await tableExists(world.connection, TABLE)) {
    throw new Error(`\`${TABLE}\` is not here — this ceremony adds a column to a table the studio already reads`);
  }

  /* THE NEIGHBOURS, before anything is applied. This column joins a manifest
     built from `[imageKey, thumbKey]`; if either is gone, the list this design
     was written against is not the list on the service. */
  for (const neighbour of ["imageKey", "thumbKey"]) {
    if (await columnFacts(world.connection, neighbour) === null) {
      throw new Error(
        `\`${neighbour}\` is missing — this column is the third member of the retention manifest's key list, and that list is not what this design was written against`,
      );
    }
  }

  const outcome = await applyOnce({
    what: "the kept original's key is on the candidate",
    isApplied: async () => await columnFacts(world.connection, COLUMN) !== null,
    apply: () => replayMigration(world.connection, "drizzle/0053_casting_candidates_source_key.sql"),
  });

  /* THE SHAPE, off the database rather than off the file that asked for it. */
  const facts = await columnFacts(world.connection, COLUMN);
  if (facts === null) throw new Error(`\`${COLUMN}\` is missing after a successful apply — stop and investigate`);
  if (facts.type !== WANTED_TYPE) {
    throw new Error(
      `\`${COLUMN}\` is \`${facts.type}\` and the migration asks for \`${WANTED_TYPE}\` — a truncated storage key names an object the purge can never find again`,
    );
  }
  if (!facts.nullable) {
    throw new Error(`\`${COLUMN}\` is NOT NULL — a candidate cast before the trim existed has no honest value to hold`);
  }
  if (facts.dflt !== null) {
    throw new Error(
      `\`${COLUMN}\` carries DEFAULT '${facts.dflt}' — every historical candidate has been stamped with a claim that it has a kept original, and that cannot be undone`,
    );
  }
  console.log(`  ${COLUMN.padEnd(12)} ${facts.type}  NULL  no default`);

  /*
    WHAT THE HISTORICAL ROWS SAY. On the sitting that applies it, every row must
    read NULL — a non-zero count is the DEFAULT failure above having already
    happened, and it is a finding rather than a warning. On a confirmation re-run
    the count is printed and nothing is asserted, because by then the product may
    legitimately have kept some originals.
  */
  const [counts] = await world.connection.query<any[]>(
    `SELECT COUNT(*) AS n, SUM(\`${COLUMN}\` IS NOT NULL) AS kept FROM \`${TABLE}\``,
  );
  const total = Number(counts[0].n);
  const kept = Number(counts[0].kept ?? 0);
  console.log(`rows: ${total} · a kept original on ${kept}`);
  if (outcome === "applied" && kept > 0) {
    throw new Error(
      `the ALTER backfilled ${kept} of ${total} historical candidates — the migration carried a DEFAULT, and every one of those rows now names an object that was never written`,
    );
  }
} catch (cause) {
  failure = cause;
}
process.exit(await closeCeremony(world, failure));
