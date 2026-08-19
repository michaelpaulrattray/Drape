/**
 * Ceremony — **THE WHOLE ATTACH ROAD'S SCHEMA, IN ONE COMMAND**: the
 * attached-reference store (`casting_reference_attachments`, migration 0043) and
 * the two reader outcomes the same flip switches on (0044, 0045).
 *
 * # ⚠ WHY IT CARRIES THREE, AND WHAT IT WAS BEFORE (ordered fable-1123 §1)
 *
 * It carried 0043 alone, and the founder's card carried a DIFFERENT command —
 * `ceremony-reference-read-hair-outcomes.mts`, which carries 0044 and 0045 — so
 * his sitting as written would have flipped `CASTING_REFERENCE_ATTACH_SCOPE`
 * with 0043 never applied. **Production was read by name on 2026-08-20 and
 * `casting_reference_attachments` was ABSENT** while its neighbours 0040 and
 * 0041 were present: the table had never joined a production ceremony.
 *
 * What that would have cost him is not subtle. The attach door writes a row on
 * every upload, so the headline feature of that sitting — *attach any picture* —
 * would have answered a 500 on his first tap; and `candidateRetention`'s sweep
 * tolerates an absent attachment table only while the flag is OFF, so the flip
 * turns a tolerated absence into a throwing sweep.
 *
 * One command rather than two is the founder-desk rule this program already
 * runs on (`UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §9.14): the three files belong
 * to one road that opens on one flip, and asking him for the same chore twice is
 * using his desk as our memory. **Each file is still judged by ITS OWN
 * evidence**, so a database holding one and not the others lands only what it is
 * missing, and the SQL is replayed rather than retyped — a ceremony that
 * re-types its own DDL is a second copy of the schema.
 *
 * `ceremony-reference-read-hair-outcomes.mts` still exists and still carries
 * 0044/0045 alone. It is not the card's command any more, and running either is
 * safe: both replay the same files and both say ALREADY APPLIED.
 *
 * Inert on its own: a table nothing writes is a table nothing writes, and the
 * attach door is behind `CASTING_REFERENCE_ATTACH_SCOPE`, which is off
 * everywhere. It lands AHEAD of the code that names it, which is the ordering
 * this program runs under — a new table is in every INSERT the moment its
 * writer ships, and there is no dark landing for one.
 *
 *   npx tsx scripts/ceremony-reference-attachments.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-reference-attachments.mts --production
 *
 * The world is named, never guessed; the refusals and the read-apply-read-back
 * rite live in `lib/ceremony.mts`.
 *
 * # WHAT THIS ONE READS BACK
 *
 * `provenance` is an ENUM whose members are a copy of a TypeScript vocabulary —
 * the ink road's own two words, and the one column the real-person fence rests
 * on. `referenceAttachSchema.test.ts` compares the migration FILE against that
 * constant on every commit; this compares what the DATABASE actually accepted,
 * which is a different fact: a file can be right about a table that was created
 * from an older copy of it. MySQL's answer to a value outside an enum is the
 * EMPTY STRING, so a drifted column would record a provenance that names none.
 *
 * # AND IT ASSERTS AN ABSENCE, which is unusual and deliberate
 *
 * This table keeps a PHOTOGRAPH OF A PERSON, so its short column list is the
 * privacy boundary rather than a convenience. An absence nobody checks is an
 * absence that quietly ends: a later ALTER adding `sentence` would break the
 * promise while every positive check here stayed green. The columns that must
 * NOT exist are named and their absence is read back — including `intents`,
 * whose absence is an argument the migration makes in its own text rather than
 * an omission somebody may helpfully repair.
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
import { INK_PROVENANCES } from "../shared/inkProvenance.js";

const TABLE = "casting_reference_attachments";

/** The members MySQL reports for an enum column, in its own order. */
function membersOf(ddl: string): string[] {
  const match = /^enum\((.*)\)$/i.exec(ddl.trim());
  if (!match) throw new Error(`not an enum column: ${ddl}`);
  return match[1]!.split(",").map((value) => value.trim().replace(/^'|'$/g, ""));
}

const world = await openCeremonyWorld(process.argv);
let failure: unknown;
try {
  await proveTheReader(world.connection);

  await applyOnce({
    what: "the attached-reference table is here",
    isApplied: () => tableExists(world.connection, TABLE),
    apply: () => replayMigration(world.connection, "drizzle/0043_casting_reference_attachments.sql"),
  });

  const provenance = await columnType(world.connection, TABLE, "provenance");
  if (provenance === null) throw new Error("`provenance` is missing — the fence's own column");
  const members = membersOf(provenance);
  const same = members.length === INK_PROVENANCES.length
    && members.every((value, index) => value === INK_PROVENANCES[index]);
  if (!same) {
    throw new Error(
      `\`provenance\` accepts [${members.join(", ")}] but the vocabulary is [${INK_PROVENANCES.join(", ")}]`,
    );
  }
  console.log(`  provenance  ${members.join(" · ")}`);

  /* Our own bytes, never a pointer — the condition this table inherits from the
     ink store, and the reason `storageKey` is asserted rather than assumed. */
  const storageKey = await columnType(world.connection, TABLE, "storageKey");
  if (storageKey === null) throw new Error("`storageKey` is missing — nothing would hold the bytes");
  console.log(`  storageKey  ${storageKey}`);

  /* THE ABSENCE, read back. See the header. */
  const forbidden = ["intents", "placement", "side", "sentence", "instruction", "description"];
  const present: string[] = [];
  for (const column of forbidden) {
    if (await columnType(world.connection, TABLE, column) !== null) present.push(column);
  }
  if (present.length > 0) {
    throw new Error(
      `\`${TABLE}\` carries [${present.join(", ")}] — this row holds bytes and a provenance claim, and may not claim an ask, a body or a person`,
    );
  }
  console.log(`  absent      ${forbidden.join(" · ")}  (no ask, no body, no prose)`);

  const [rows] = await world.connection.query<any[]>(`SELECT COUNT(*) AS n FROM \`${TABLE}\``);
  console.log(`rows: ${rows[0].n} (the attach door is off everywhere — anything but 0 is a finding)`);

  /*
    AND THE TWO READER OUTCOMES THE SAME FLIP SWITCHES ON — see the header.

    Judged by their own values on their own column, so a database holding 0044
    and not 0045 lands 0045 alone. The reader is proven against a value that
    certainly exists before any absence is read as grounds to alter (working law
    2): an enum reader that cannot say `delivered` is a wrong database, not an
    unapplied migration.
  */
  const OUTCOME_TABLE = "casting_reference_reads";
  const outcomeValues = async (): Promise<string[]> => {
    const ddl = await columnType(world.connection, OUTCOME_TABLE, "outcome");
    if (ddl === null) throw new Error(`\`outcome\` is not a column of ${OUTCOME_TABLE} — wrong database, or an unapplied 0036`);
    return [...ddl.matchAll(/'([^']*)'/g)].map((match) => match[1]!);
  };
  const before = await outcomeValues();
  for (const control of ["delivered", "unreadable"]) {
    if (!before.includes(control)) {
      throw new Error(`the enum reader cannot see \`${control}\` — wrong database, or a reader that cannot say yes`);
    }
  }
  console.log(`  outcome     ${before.join(" · ")}`);

  for (const migration of [
    {
      file: "drizzle/0044_reference_read_hair_outcomes.sql",
      values: ["no_hair_visible", "no_colour_readable"],
      what: "the hair reader's own two endings",
    },
    {
      file: "drizzle/0045_reference_read_drawn_narrowed.sql",
      values: ["drawn_narrowed"],
      what: "the class door's narrowing, counted",
    },
  ]) {
    await applyOnce({
      what: `${migration.what} (${migration.values.join(", ")})`,
      /* EVERY value of the file, so an alter that landed one of two reads as
         unapplied rather than as done. */
      isApplied: async () => {
        const held = await outcomeValues();
        return migration.values.every((value) => held.includes(value));
      },
      apply: () => replayMigration(world.connection, migration.file),
    });
  }

  /* NOTHING WAS LOST. An enum MODIFY rewrites the column definition, and the
     failure worth checking for is a value that quietly stopped being legal —
     which would blank every existing row carrying it on the next write. */
  const now = await outcomeValues();
  for (const kept of before) {
    if (!now.includes(kept)) throw new Error(`\`${kept}\` was on \`outcome\` and is not any more — stop`);
  }

  const [reads] = await world.connection.query<any[]>(
    `SELECT outcome, COUNT(*) AS n FROM \`${OUTCOME_TABLE}\` GROUP BY outcome`,
  );
  console.log(reads.length === 0 ? "reads: none yet" : `reads: ${reads.map((row) => `${row.outcome || "(blank!)"}=${row.n}`).join(", ")}`);
  for (const row of reads) {
    if (!row.outcome) throw new Error("a read carries the EMPTY STRING outcome — a writer ran ahead of a migration");
  }
} catch (cause) {
  failure = cause;
}

process.exit(await closeCeremony(world, failure));
