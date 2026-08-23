/**
 * Ceremony — **THE TALLY, WIDENED** (`casting_ink_form_demand.kind` gains two
 * members and the table gains `pathAtRefusal`, migration 0052): a wardrobe-path
 * cast refused a tattoo because its own outfit covers the surface, counted
 * (design `docs/specs/CASTING_V2_TWO_PATHS_DESIGN.md` §9, countersigned
 * fable-1334 question 2 — *WIDEN, with §9's driven-through-the-refusal arm as a
 * condition of the landing*).
 *
 *   npx tsx scripts/ceremony-ink-form-demand-paths.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-ink-form-demand-paths.mts --production
 *
 * The world is named, never guessed; the refusals and the read-apply-read-back
 * rite live in `lib/ceremony.mts`.
 *
 * # WHY IT IS A BLOCKING PREREQUISITE OF THE CODE — 0051's reason exactly
 *
 * `pathAtRefusal` is a new column on a table the code READS. Drizzle names its
 * columns in the statement, so the moment `drizzle/schema.ts` gains it, every
 * read of `casting_ink_form_demand` asks for it — flag or no flag, dark or not.
 * Against a database that has not taken this migration that is not a dark
 * landing; it is an error on a table somebody is trying to read a demand signal
 * out of.
 *
 * So the order is **this command → the schema and the writer land dark → the
 * flip**, and at the commit that carries migration 0052 `drizzle/schema.ts`
 * deliberately does not name the column and `INK_FORM_DEMAND_KINDS` does not
 * carry the two new members. `server/castingV2/inkFormDemandMigration.test.ts`
 * pins that.
 *
 * # WHAT IT READS BACK, and why each one is worth a round trip
 *
 * **The enum's MEMBERS, in order, by value.** This is the one ceremony in the
 * folder that MODIFIES an existing column rather than only adding, and the
 * safety of that rests entirely on the edit being append-only: an enum whose
 * members are reordered or renamed rewrites what every existing row MEANS,
 * silently, because MySQL stores the index and not the word. A copy of this
 * migration that listed the four members alphabetically would turn every
 * `torsoUnstated` row into `surfaceCovered` with no error anywhere. So the
 * members are read back as a list and the two originals are asserted to be
 * FIRST and in their original order.
 *
 * **`pathAtRefusal`'s nullability and its absent default**, for 0051's reason
 * one table over: a DEFAULT would stamp every historical row with a path claim,
 * and here the historical rows are refusals that happened before the paths
 * existed at all.
 *
 * **The row count, unchanged.** A `MODIFY COLUMN` on an enum should rewrite no
 * row and lose none. It is read before and after and compared, because "should"
 * is what this program does not accept about a live table.
 *
 * **And it asserts an ABSENCE: no account column.** The privacy shape of this
 * table is that a demand row cannot be joined back to a person — no userId, no
 * candidateId, no designId, absent from the ROW rather than omitted from a
 * projection. That is the property most likely to be quietly repaired by
 * somebody who wants to know who asked, so it is checked here rather than
 * trusted to review.
 */
import {
  applyOnce,
  closeCeremony,
  openCeremonyWorld,
  proveTheReader,
  replayMigration,
  tableExists,
} from "./lib/ceremony.mts";

const TABLE = "casting_ink_form_demand";

type Connection = Awaited<ReturnType<typeof openCeremonyWorld>>["connection"];

/** The enum members a column declares, in the order MySQL stores them. */
async function enumMembers(connection: Connection, column: string): Promise<string[] | null> {
  const [rows] = await connection.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\` LIKE ?`, [column]);
  if (rows.length !== 1) return null;
  const type = String(rows[0].Type);
  const match = /^enum\((.*)\)$/i.exec(type);
  if (!match) return null;
  return match[1]!.split(",").map((one) => one.trim().replace(/^'|'$/g, ""));
}

async function columnFacts(
  connection: Connection,
  column: string,
): Promise<{ type: string; nullable: boolean; dflt: string | null } | null> {
  const [rows] = await connection.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\` LIKE ?`, [column]);
  if (rows.length !== 1) return null;
  return {
    type: String(rows[0].Type),
    nullable: String(rows[0].Null).toUpperCase() === "YES",
    dflt: rows[0].Default === null ? null : String(rows[0].Default),
  };
}

async function rowCount(connection: Connection): Promise<number> {
  const [rows] = await connection.query<any[]>(`SELECT COUNT(*) AS n FROM \`${TABLE}\``);
  return Number(rows[0].n);
}

/** The members this migration asks for, in the order it asks for them. */
const WANTED_KINDS = ["torsoNonbinary", "torsoUnstated", "surfaceCovered", "surfaceCoverageUnread"];
/** The two that already exist — they must stay FIRST and in this order, or
 *  every stored row changes meaning without an error anywhere. */
const EXISTING_KINDS = ["torsoNonbinary", "torsoUnstated"];

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
try {
  await proveTheReader(world.connection);

  if (!await tableExists(world.connection, TABLE)) {
    throw new Error(`\`${TABLE}\` is not here — this ceremony widens a table the ink road already writes (migration 0041)`);
  }

  /*
    HALF-APPLIED IS NAMED RATHER THAN RETRIED. Two statements, so a run
    interrupted between them leaves the enum widened and the column absent.
    Replaying in that state fails on the MODIFY with nothing useful said, so it
    is caught here with the repair stated — and the repair is simply to re-run,
    because a MODIFY to the shape it already has is a no-op rather than a fault.
  */
  const kindsBefore = await enumMembers(world.connection, "kind");
  const pathBefore = await columnFacts(world.connection, "pathAtRefusal");
  const widened = kindsBefore !== null && WANTED_KINDS.every((one) => kindsBefore.includes(one));
  if (widened && pathBefore === null) {
    console.log("  half-applied: the enum is widened and `pathAtRefusal` is absent — the replay below finishes it");
  }

  const rowsBefore = await rowCount(world.connection);

  const outcome = await applyOnce({
    what: "the tally can count a covered surface, and says which path",
    isApplied: async () => {
      const kinds = await enumMembers(world.connection, "kind");
      const path = await columnFacts(world.connection, "pathAtRefusal");
      return kinds !== null && path !== null && WANTED_KINDS.every((one) => kinds.includes(one));
    },
    apply: () => replayMigration(world.connection, "drizzle/0052_ink_form_demand_paths.sql"),
  });

  /*
    THE ENUM, READ BACK BY VALUE AND BY POSITION.

    MySQL stores an enum as an INDEX, so the words' ORDER is the data. Appending
    is safe and reordering is a silent rewrite of every row's meaning — this is
    the one assertion in this file that protects something already stored.
  */
  const kinds = await enumMembers(world.connection, "kind");
  if (kinds === null) throw new Error("`kind` is not an enum after a successful apply — stop and investigate");
  for (const [index, member] of EXISTING_KINDS.entries()) {
    if (kinds[index] !== member) {
      throw new Error(
        `\`kind\` reads [${kinds.join(", ")}] — '${member}' is no longer at position ${index + 1}, so every stored row of that kind now means something else`,
      );
    }
  }
  for (const member of WANTED_KINDS) {
    if (!kinds.includes(member)) throw new Error(`\`kind\` is missing '${member}' — it reads [${kinds.join(", ")}]`);
  }
  if (kinds.length !== WANTED_KINDS.length) {
    throw new Error(`\`kind\` carries ${kinds.length} members and the migration asks for ${WANTED_KINDS.length}: [${kinds.join(", ")}]`);
  }
  console.log(`  kind         enum(${kinds.join(", ")})  NOT NULL`);

  const path = await columnFacts(world.connection, "pathAtRefusal");
  if (path === null) throw new Error("`pathAtRefusal` is missing after a successful apply — stop and investigate");
  if (path.type !== "enum('wardrobe','basics')") {
    throw new Error(`\`pathAtRefusal\` is \`${path.type}\` and the migration asks for enum('wardrobe','basics')`);
  }
  if (!path.nullable) {
    throw new Error("`pathAtRefusal` is NOT NULL — a refusal recorded before the paths existed has no honest value to hold");
  }
  if (path.dflt !== null) {
    throw new Error(
      `\`pathAtRefusal\` carries DEFAULT '${path.dflt}' — every historical refusal has been stamped with a path it did not happen on`,
    );
  }
  console.log(`  pathAtRefusal ${path.type}  NULL  no default`);

  /*
    THE PRIVACY SHAPE, ASSERTED RATHER THAN REVIEWED. A demand row may not be
    joinable back to a person: the account is ABSENT FROM THE ROW, which is a
    stronger promise than leaving it out of a projection and is the one somebody
    solving a real problem would quietly undo.
  */
  const [columns] = await world.connection.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\``);
  const identifying = columns
    .map((row: any) => String(row.Field))
    .filter((name: string) => /user|account|candidate|design|session|cast/i.test(name));
  if (identifying.length > 0) {
    throw new Error(
      `\`${TABLE}\` carries [${identifying.join(", ")}] — a demand row must not be joinable back to a person, and this table's whole shape is that promise`,
    );
  }
  console.log("  absent       any column naming a person, a cast or a design");

  /*
    NOTHING WAS LOST. A MODIFY on an appended enum rewrites no row; this is the
    reading that says so rather than the sentence that assumes it.
  */
  const rowsAfter = await rowCount(world.connection);
  console.log(`rows: ${rowsBefore} before · ${rowsAfter} after`);
  if (outcome === "applied" && rowsAfter !== rowsBefore) {
    throw new Error(`the widening changed the row count ${rowsBefore} -> ${rowsAfter} — an enum edit rewrote data`);
  }

  /*
    AND WHAT THE HISTORICAL ROWS SAY. Every row that existed before this ran was
    a torso-form refusal on a cast with no path, so `pathAtRefusal` must read
    NULL on all of them. A non-zero count on the applying sitting is the DEFAULT
    failure above having already happened.
  */
  const [pathCounts] = await world.connection.query<any[]>(
    `SELECT SUM(\`pathAtRefusal\` IS NOT NULL) AS pathSet FROM \`${TABLE}\``,
  );
  const pathSet = Number(pathCounts[0].pathSet ?? 0);
  console.log(`      path recorded on ${pathSet} of ${rowsAfter}`);
  if (outcome === "applied" && pathSet > 0) {
    throw new Error(
      `the ALTER backfilled ${pathSet} of ${rowsAfter} historical refusals — the migration carried a DEFAULT and the pre-paths distinction is gone`,
    );
  }
} catch (cause) {
  failure = cause;
}

process.exit(await closeCeremony(world, failure));
