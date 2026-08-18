/**
 * Ceremony — the ink design store (`casting_ink_designs`, migration 0034).
 *
 * Inert on its own: a table nothing writes is a table nothing writes. It lands
 * AHEAD of the code that names it, which is the ordering this program runs
 * under — a new table is in every INSERT the moment its writer ships, and there
 * is no dark landing for one.
 *
 *   npx tsx scripts/ceremony-ink-designs.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-ink-designs.mts --production
 *
 * The world is named, never guessed; the refusals and the read-apply-read-back
 * rite live in `lib/ceremony.mts`.
 *
 * # WHAT THIS ONE READS BACK, and why it is not just "the table exists"
 *
 * Three of its columns are ENUMS whose members are a hand-written copy of a
 * TypeScript vocabulary (`INK_PLACEMENTS`, `INK_SIDES`, `INK_PROVENANCES`).
 * `inkDesignSchema.test.ts` compares the migration FILE against those constants
 * on every commit; this compares what the DATABASE actually accepted against
 * the same constants, which is a different fact — a file can be right about a
 * table that was created from an older copy of it.
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
import { INK_PLACEMENTS } from "../shared/inkPlacementVocabulary.js";
import { INK_SIDES } from "../shared/inkReleasedPlacements.js";
import { INK_PROVENANCES } from "../shared/inkProvenance.js";

const TABLE = "casting_ink_designs";

/** The members MySQL reports for an enum column, in its own order. */
function membersOf(ddl: string): string[] {
  const match = /^enum\((.*)\)$/i.exec(ddl.trim());
  if (!match) throw new Error(`not an enum column: ${ddl}`);
  return match[1]!.split(",").map((value) => value.trim().replace(/^'|'$/g, ""));
}

async function assertEnum(
  connection: Awaited<ReturnType<typeof openCeremonyWorld>>["connection"],
  column: string,
  expected: readonly string[],
): Promise<string> {
  const ddl = await columnType(connection, TABLE, column);
  if (ddl === null) throw new Error(`\`${column}\` is missing from \`${TABLE}\``);
  const actual = membersOf(ddl);
  const same = actual.length === expected.length && actual.every((value, index) => value === expected[index]);
  if (!same) {
    throw new Error(
      `\`${column}\` accepts [${actual.join(", ")}] but the vocabulary is [${expected.join(", ")}]`,
    );
  }
  return `  ${column.padEnd(11)} ${actual.join(" · ")}`;
}

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
try {
  await proveTheReader(world.connection);

  await applyOnce({
    what: "the ink design table is here",
    isApplied: () => tableExists(world.connection, TABLE),
    apply: () => replayMigration(world.connection, "drizzle/0034_casting_ink_designs.sql"),
  });

  /* WHAT THE DATABASE ACTUALLY ACCEPTED — see the header. A CREATE that
     succeeded says the statement parsed; this says the values it will take are
     the values the product can produce. */
  console.log("enums, read back from the live table:");
  console.log(await assertEnum(world.connection, "placement", INK_PLACEMENTS));
  console.log(await assertEnum(world.connection, "side", INK_SIDES));
  console.log(await assertEnum(world.connection, "provenance", INK_PROVENANCES));

  /* The condition this table inherited: our own bytes, never a pointer. A
     column that could hold somebody else's URL reopens the deferred-delete
     question (L10), so its absence is asserted rather than assumed. */
  const storageKey = await columnType(world.connection, TABLE, "storageKey");
  if (storageKey === null) throw new Error("`storageKey` is missing — nothing would hold the bytes");
  console.log(`  storageKey  ${storageKey}`);

  const [rows] = await world.connection.query<any[]>(`SELECT COUNT(*) AS n FROM \`${TABLE}\``);
  console.log(`rows: ${rows[0].n}`);
} catch (cause) {
  failure = cause;
}

process.exit(await closeCeremony(world, failure));
