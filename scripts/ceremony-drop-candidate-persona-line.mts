/**
 * Ceremony — drop `casting_candidates.personaLine` (migration 0068; #1241).
 *
 * His brief, 2026-09-25 (terminal): candidates are auditioners and carry no
 * personality by design, so the disposition retires end to end — the tile slot,
 * the props, the projections, and then this column. His word on running it,
 * verbatim and SCOPED TO THIS ACT: *"you have approval to run this act on my
 * behalf no word required"*. A DROP is refused by the rite's auto-apply by
 * design (`scripts/lib/ceremonyAutoApply.mts`), which is why a ceremony exists.
 *
 *   npx tsx scripts/ceremony-drop-candidate-persona-line.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-drop-candidate-persona-line.mts --production
 *
 * # ⚠ HOW THIS DIFFERS FROM #1184'S, AND WHY THE REFUSAL IS NOT A ROW COUNT
 *
 * #1184 dropped an EMPTY table, so "refuse a non-zero row count" was the whole
 * guard and the drop was destructive by shape only. This one deletes real
 * values: measured the hour it was written, **production held 411 candidate rows
 * with 7 non-null dispositions, newest 2026-08-02**, and **dev held 117 with 104,
 * newest that day** (dev still runs the house road, which is what writes them).
 * Refusing on non-zero would refuse forever and teach nothing.
 *
 * So what it refuses is being pointed at the WRONG THING, and it reports the
 * loss rather than hiding it:
 *
 *  - the column reader is proven on a column that certainly exists before its
 *    "absent" answer is believed (working law 2) — a wrong database looks
 *    exactly like an applied migration;
 *  - it REFUSES a column whose declared shape is not the one the schema
 *    retired (`varchar(160)`, nullable) — if it is something else, this is not
 *    the column this migration was written against;
 *  - it PRINTS the rows it is about to blank, and the newest date among them,
 *    so the receipt carries what was destroyed and not merely that it was;
 *  - it REFUSES if the table's total row count moves across the act — a DROP
 *    COLUMN must not lose a row;
 *  - ALREADY APPLIED is a first-class outcome, so the second run is the
 *    independent confirmation.
 */
import { readFile } from "node:fs/promises";

import { openCeremonyWorld } from "./lib/ceremony.mts";

const { world, where, connection: conn } = await openCeremonyWorld(process.argv);

const TABLE = "casting_candidates";
const COLUMN = "personaLine";
const MIGRATION = "drizzle/0068_casting_v2_drop_candidate_persona_line.sql";
/** The shape `drizzle/schema.ts` declared until #1241 removed it. */
const DECLARED = { Type: "varchar(160)", Null: "YES" };

type ColumnRow = { Field: string; Type: string; Null: string };

async function column(name: string): Promise<ColumnRow | null> {
  const [rows] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\` LIKE '${name}'`);
  return (rows[0] as ColumnRow | undefined) ?? null;
}

async function rowCount(): Promise<number> {
  const [[row]] = await conn.query<any[]>(`SELECT COUNT(*) AS n FROM \`${TABLE}\``);
  return Number(row.n);
}

try {
  console.log(`world: ${world} @ ${where}`);

  /* THE READER, PROVEN FIRST (working law 2). `position` is on this table in
     every migration that has ever created it, so a reader that cannot see it is
     not reading the table it thinks it is. */
  if (!(await column("position"))) {
    throw new Error(`the column reader cannot see \`${TABLE}.position\` — wrong database, or a reader that cannot say yes`);
  }

  const before = await rowCount();
  console.log(`${TABLE} rows: ${before}`);

  const found = await column(COLUMN);
  if (!found) {
    console.log(`ALREADY APPLIED — \`${TABLE}.${COLUMN}\` is absent.`);
  } else {
    if (found.Type !== DECLARED.Type || found.Null !== DECLARED.Null) {
      throw new Error(`\`${TABLE}.${COLUMN}\` is ${found.Type} ${found.Null === "YES" ? "NULL" : "NOT NULL"}, not the ${DECLARED.Type} nullable column this migration was written against — stop and look`);
    }

    /* WHAT IS BEING DESTROYED, ON THE RECEIPT. This is the honest half: the
       values are captions nothing draws any more, and saying how many there are
       is the difference between a measured deletion and a hopeful one. */
    const [[loss]] = await conn.query<any[]>(
      `SELECT SUM(\`${COLUMN}\` IS NOT NULL) AS nonNull, MAX(createdAt) AS newest FROM \`${TABLE}\` WHERE \`${COLUMN}\` IS NOT NULL`,
    );
    console.log(`  dropping ${Number(loss.nonNull ?? 0)} non-null value(s); newest written ${loss.newest ?? "(none)"}`);

    const sql = await readFile(MIGRATION, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await conn.query(trimmed);
    }

    if (await column(COLUMN)) {
      throw new Error(`${MIGRATION} ran and \`${TABLE}.${COLUMN}\` is still present — stop and investigate`);
    }
    console.log(`APPLIED ${MIGRATION} — \`${TABLE}.${COLUMN}\` is gone`);
  }

  /* A DROP COLUMN must not lose a ROW. Read after the act, every time — including
     the ALREADY APPLIED road, where it is the reading that says the table is
     still the one the first run left. */
  const after = await rowCount();
  if (after !== before) {
    throw new Error(`${TABLE} held ${before} rows and now holds ${after} — a column drop must not move rows; stop and investigate`);
  }
  console.log(`${TABLE} rows: ${after} (unchanged)`);
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
