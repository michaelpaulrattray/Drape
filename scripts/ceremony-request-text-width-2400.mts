/**
 * Ceremony — the record of what they asked fits what they are now allowed to
 * ask (`casting_candidate_variants.requestText` 400 → 2400; migration 0085;
 * card #26).
 *
 * His word, 2026-10-15, verbatim: *"yes raise the refine limit to 2000"*. The
 * refine box goes 200 → 2,000, an answered refine can then store up to 2,141
 * characters (the router's longest answer plus the studio's own clause), and
 * the column held 400. This is the second run of the same ceremony as
 * `scripts/ceremony-request-text-width.mts` (220 → 400, #1126), and it is a
 * separate file rather than an edit of that one because that file is the
 * receipt of a ceremony that already ran on both worlds.
 *
 * WHY THIS IS A CEREMONY AND NOT THE RITE'S JOB. Widening a varchar is a
 * `MODIFY COLUMN`, which `scripts/lib/ceremonyAutoApply.mts` refuses by design
 * (it cannot tell a widening from a narrowing). And the rite's schema check
 * compares NAMES, not widths, so nothing on the deploy road would notice the
 * column lagging the code: ⚠ **this must run on PRODUCTION BEFORE the code that
 * declares 2400 merges**, or a long answered refine's INSERT carries more than
 * the live column holds.
 *
 *   npx tsx scripts/ceremony-request-text-width-2400.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-request-text-width-2400.mts --production
 *
 * Idempotent: it reads the column's width first and says ALREADY APPLIED rather
 * than failing, so a re-run is safe and is the independent confirmation. It
 * refuses any width that is neither 400 nor 2400 — a column nobody expected is
 * a wrong database, not a job for this script.
 */
import { readFile } from "node:fs/promises";

import { openCeremonyWorld } from "./lib/ceremony.mts";
import { openDatabase } from "./lib/dbConnection.mts";

const { connection: conn } = await openCeremonyWorld(process.argv);

const TABLE = "casting_candidate_variants";
const COLUMN = "requestText";
const FROM = 400;
const TO = 2400;
const MIGRATION = "drizzle/0085_casting_v2_request_text_2400.sql";

async function readWidth(c: Awaited<ReturnType<typeof openDatabase>>): Promise<{ width: number; type: string }> {
  const [columns] = await c.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\` LIKE '${COLUMN}'`);
  if (columns.length !== 1) throw new Error(`\`${COLUMN}\` is not a column of \`${TABLE}\` — wrong database, or an unapplied 0023`);
  const type = String(columns[0].Type);
  const match = /^varchar\((\d+)\)$/i.exec(type);
  if (!match) throw new Error(`\`${COLUMN}\` is \`${type}\`, not a varchar — refusing to alter a column this script does not know`);
  return { width: Number(match[1]), type };
}

try {
  /* The reader is proven before its answer is believed (working law 2): a
     column that certainly exists, read by the same reader. */
  const [control] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\` LIKE 'publicId'`);
  if (control.length !== 1) throw new Error("the column reader cannot see `publicId` — wrong database, or a reader that cannot say yes");

  const before = await readWidth(conn);
  const [[{ n }]] = await conn.query<any[]>(`SELECT COUNT(*) AS n FROM \`${TABLE}\``);
  console.log(`${TABLE}.${COLUMN} is ${before.type}; rows: ${n}`);

  if (before.width === TO) {
    console.log(`ALREADY APPLIED — ${COLUMN} is varchar(${TO}).`);
  } else if (before.width !== FROM) {
    throw new Error(`${COLUMN} is varchar(${before.width}) — neither ${FROM} nor ${TO}; stop and look`);
  } else {
    const sql = await readFile(MIGRATION, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await conn.query(trimmed);
    }
    const after = await readWidth(conn);
    if (after.width !== TO) throw new Error(`${MIGRATION} ran and ${COLUMN} is varchar(${after.width}) — stop and investigate`);
    console.log(`APPLIED ${MIGRATION} — ${COLUMN} is now ${after.type}`);
  }

  /* Nothing was lost: a widening cannot truncate, and the row count is read on
     both sides because "additive" is a claim about data and not only DDL. */
  const [[{ n: rowsAfter }]] = await conn.query<any[]>(`SELECT COUNT(*) AS n FROM \`${TABLE}\``);
  if (Number(rowsAfter) !== Number(n)) throw new Error(`row count moved across the alter: ${n} -> ${rowsAfter} — stop`);
  console.log(`rows after: ${rowsAfter} (unchanged)`);
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
