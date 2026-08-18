/**
 * Ceremony — the plate store (`casting_ink_plates`, migration 0037).
 *
 * Inert on its own: a table nothing writes is a table nothing writes. It lands
 * AHEAD of the code that names it, which is the ordering this program runs
 * under — a new table is in every INSERT the moment its writer ships, and there
 * is no dark landing for one.
 *
 *   npx tsx scripts/ceremony-ink-plates.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-ink-plates.mts --production
 *
 * The world is named, never guessed; the refusals and the read-apply-read-back
 * rite live in `lib/ceremony.mts`.
 *
 * # WHAT THIS ONE READS BACK, beyond "the table exists"
 *
 * Three facts that are DECISIONS rather than columns, and that a database
 * created from an older copy of the migration could disagree with:
 *
 *   templateKind   an enum whose members are a hand-written copy of a TypeScript
 *                  vocabulary. `inkPlateSchema.test.ts` compares the migration
 *                  FILE against the constant on every commit; this compares what
 *                  the DATABASE actually accepted, which is a different fact.
 *   engine         a VARCHAR on purpose. If it ever came back as an enum, the
 *                  plate court could not file the specimen that LOST without a
 *                  migration — which is exactly the row nobody would then file.
 *   the unique key on (designId, engine), which is what makes "a design is
 *                  plated once per engine" exact under a race rather than exact
 *                  in the comments.
 *
 * It also asserts that `casting_ink_designs` is already here. A plate hangs off
 * a design and the sweep reaches it through one; a plate table alone would be a
 * table whose rows could never be found, let alone purged.
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
import { INK_TEMPLATE_KINDS } from "../shared/inkTemplateKinds.js";

const TABLE = "casting_ink_plates";
const PARENT = "casting_ink_designs";

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

  /* The parent first. A plate with no design table is a row nothing can find. */
  if (!await tableExists(world.connection, PARENT)) {
    throw new Error(
      `\`${PARENT}\` is not here — run scripts/ceremony-ink-designs.mts first. `
      + "A plate hangs off a design, and the sweep reaches it through one.",
    );
  }

  await applyOnce({
    what: "the plate table is here",
    isApplied: () => tableExists(world.connection, TABLE),
    apply: () => replayMigration(world.connection, "drizzle/0037_casting_ink_plates.sql"),
  });

  console.log("read back from the live table:");

  const templateKind = await columnType(world.connection, TABLE, "templateKind");
  if (templateKind === null) throw new Error("`templateKind` is missing — nothing would say which form");
  const members = membersOf(templateKind);
  const same = members.length === INK_TEMPLATE_KINDS.length
    && members.every((value, index) => value === INK_TEMPLATE_KINDS[index]);
  if (!same) {
    throw new Error(
      `\`templateKind\` accepts [${members.join(", ")}] but the vocabulary is `
      + `[${INK_TEMPLATE_KINDS.join(", ")}]`,
    );
  }
  console.log(`  templateKind   ${members.join(" · ")}`);

  /* A string, so a court's LOSER can be filed without a migration. */
  const engine = await columnType(world.connection, TABLE, "engine");
  if (engine === null) throw new Error("`engine` is missing — the court would have no axis");
  if (!/^varchar/i.test(engine)) {
    throw new Error(`\`engine\` is ${engine}, not a varchar — a court cannot file the model that lost`);
  }
  console.log(`  engine         ${engine}`);

  /* The founder's approval, bound to the artifact rather than only to the suite. */
  const templateDigest = await columnType(world.connection, TABLE, "templateDigest");
  if (templateDigest === null) {
    throw new Error("`templateDigest` is missing — no plate would say which artwork it stands on");
  }
  console.log(`  templateDigest ${templateDigest}`);

  /* One plate per design per engine, in the schema rather than in the comments. */
  const [indexes] = await world.connection.query<any[]>(
    `SHOW INDEX FROM \`${TABLE}\` WHERE Key_name = 'uq_casting_ink_plates_design_engine'`,
  );
  const columns = indexes
    .sort((a: any, b: any) => a.Seq_in_index - b.Seq_in_index)
    .map((row: any) => row.Column_name);
  if (columns.join(",") !== "designId,engine") {
    throw new Error(
      `the unique key reads [${columns.join(", ") || "nothing"}] rather than (designId, engine) — `
      + "without it two mints of one design on one engine can both write",
    );
  }
  if (Number(indexes[0]?.Non_unique) !== 0) {
    throw new Error("the (designId, engine) index is not UNIQUE, so it enforces nothing");
  }
  console.log(`  unique         (${columns.join(", ")})`);

  const [rows] = await world.connection.query<any[]>(`SELECT COUNT(*) AS n FROM \`${TABLE}\``);
  console.log(`rows: ${rows[0].n}`);
} catch (cause) {
  failure = cause;
}

process.exit(await closeCeremony(world, failure));
