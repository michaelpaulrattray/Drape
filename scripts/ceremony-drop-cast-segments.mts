/**
 * Ceremony — drop `casting_cast_segments` (migration 0067; #1184).
 *
 * His word, 2026-09-25 (terminal): "do it" — asked of the one card on the
 * Background Work panel that was his to decide, the table that landed ahead
 * of a Sign promotion nobody wrote (#1184). A DROP is refused by the rite's
 * auto-apply by design (`scripts/lib/ceremonyAutoApply.mts`) and is his act,
 * so a person runs this, naming the world.
 *
 *   npx tsx scripts/ceremony-drop-cast-segments.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-drop-cast-segments.mts --production
 *
 * WHAT IT REFUSES. It reads the table's row count before it drops anything
 * and REFUSES if the count is not zero — a table nothing reads or writes is
 * dropped on the strength of being empty, and "empty" is read here, not
 * remembered from the card. It says ALREADY APPLIED on a database where the
 * table is absent, so a re-run is the independent confirmation.
 */
import { readFile } from "node:fs/promises";

import { openCeremonyWorld } from "./lib/ceremony.mts";

const { connection: conn } = await openCeremonyWorld(process.argv);

const TABLE = "casting_cast_segments";
const MIGRATION = "drizzle/0067_casting_v2_drop_cast_segments.sql";

async function tablePresent(): Promise<boolean> {
  const [rows] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  return rows.length === 1;
}

try {
  /* The reader is proven before its answer is believed (working law 2): a
     table that certainly exists, read by the same reader. */
  const [control] = await conn.query<any[]>("SHOW TABLES LIKE 'casting_candidates'");
  if (control.length !== 1) throw new Error("the table reader cannot see `casting_candidates` — wrong database, or a reader that cannot say yes");

  if (!(await tablePresent())) {
    console.log(`ALREADY APPLIED — \`${TABLE}\` is absent.`);
  } else {
    const [[{ n }]] = await conn.query<any[]>(`SELECT COUNT(*) AS n FROM \`${TABLE}\``);
    console.log(`${TABLE} rows: ${n}`);
    if (Number(n) !== 0) throw new Error(`\`${TABLE}\` holds ${n} row(s) — this ceremony drops only an EMPTY table; stop and look`);
    const sql = await readFile(MIGRATION, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await conn.query(trimmed);
    }
    if (await tablePresent()) throw new Error(`${MIGRATION} ran and \`${TABLE}\` is still present — stop and investigate`);
    console.log(`APPLIED ${MIGRATION} — \`${TABLE}\` is gone`);
  }

  /* Nothing beside it moved: the neighbour this table was designed against. */
  const [[{ n: candidates }]] = await conn.query<any[]>("SELECT COUNT(*) AS n FROM `casting_candidates`");
  console.log(`casting_candidates rows: ${candidates} (untouched)`);
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
