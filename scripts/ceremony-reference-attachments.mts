/**
 * Ceremony — the attached-reference store (`casting_reference_attachments`,
 * migration 0043; design §2, countersigned fable-1063 §1–§2).
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
} catch (cause) {
  failure = cause;
}

process.exit(await closeCeremony(world, failure));
