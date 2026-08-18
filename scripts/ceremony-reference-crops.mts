/**
 * Ceremony — the reference crop store (`casting_reference_crops`, migration
 * 0040, ruled fable-1015 §3).
 *
 * Inert on its own: a table nothing writes is a table nothing writes. It lands
 * AHEAD of the code that names it, which is the ordering this program runs
 * under — a new table is in every INSERT the moment its writer ships, and there
 * is no dark landing for one.
 *
 *   npx tsx scripts/ceremony-reference-crops.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-reference-crops.mts --production
 *
 * The world is named, never guessed; the refusals and the read-apply-read-back
 * rite live in `lib/ceremony.mts`.
 *
 * # WHAT THIS ONE READS BACK, and why it is not just "the table exists"
 *
 * Three of its columns are ENUMS whose members are a copy of a TypeScript
 * vocabulary — `intent` from the CROP-form members of the ingestion map,
 * `source` from the fourth-source list, `provenance` from the ink road's own
 * two words. `referenceCropSchema.test.ts` compares the migration FILE against
 * those constants on every commit; this compares what the DATABASE actually
 * accepted against the same constants, which is a different fact — a file can
 * be right about a table that was created from an older copy of it.
 *
 * # AND IT ASSERTS AN ABSENCE, which is unusual and deliberate
 *
 * The fence on this road is that no geometry locating the cut inside somebody's
 * photograph is ever stored. That is an ABSENCE, and an absence nobody checks
 * is an absence that quietly ends: a later ALTER adding `bboxX` would break the
 * promise while every positive check here stayed green. So the columns that
 * must NOT exist are named and their absence is read back.
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
import {
  CASTING_REFERENCE_CROP_INTENTS,
  CASTING_REFERENCE_CROP_SOURCES,
} from "../drizzle/schema.js";
import { INK_PROVENANCES } from "../shared/inkProvenance.js";

const TABLE = "casting_reference_crops";

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
    what: "the reference crop table is here",
    isApplied: () => tableExists(world.connection, TABLE),
    apply: () => replayMigration(world.connection, "drizzle/0040_casting_reference_crops.sql"),
  });

  /* WHAT THE DATABASE ACTUALLY ACCEPTED — see the header. A CREATE that
     succeeded says the statement parsed; this says the values it will take are
     the values the product can produce. */
  console.log("enums, read back from the live table:");
  console.log(await assertEnum(world.connection, "intent", CASTING_REFERENCE_CROP_INTENTS));
  console.log(await assertEnum(world.connection, "source", CASTING_REFERENCE_CROP_SOURCES));
  console.log(await assertEnum(world.connection, "provenance", INK_PROVENANCES));

  /* Our own bytes, never a pointer — the condition this table inherits from the
     ink store, and the reason `storageKey` is asserted rather than assumed. */
  const storageKey = await columnType(world.connection, TABLE, "storageKey");
  if (storageKey === null) throw new Error("`storageKey` is missing — nothing would hold the bytes");
  console.log(`  storageKey  ${storageKey}`);

  /* THE ABSENCE, read back. See the header: a fence nobody checks is a fence
     that ends quietly. */
  const forbidden = ["bboxX", "bboxY", "bboxW", "bboxH", "frameWidth", "frameHeight", "sourceKey"];
  const present: string[] = [];
  for (const column of forbidden) {
    if (await columnType(world.connection, TABLE, column) !== null) present.push(column);
  }
  if (present.length > 0) {
    throw new Error(
      `\`${TABLE}\` carries [${present.join(", ")}] — geometry locates this cut inside a photograph we do not keep`,
    );
  }
  console.log(`  absent      ${forbidden.join(" · ")}  (no geometry into a stranger's frame)`);

  const [rows] = await world.connection.query<any[]>(`SELECT COUNT(*) AS n FROM \`${TABLE}\``);
  console.log(`rows: ${rows[0].n}`);
} catch (cause) {
  failure = cause;
}

process.exit(await closeCeremony(world, failure));
