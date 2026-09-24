/**
 * Ceremony — the record of what she asked fits what she is allowed to ask
 * (`casting_candidate_variants.requestText` 220 → 400; migration 0066; #1126).
 *
 * WHY THIS IS A CEREMONY AND NOT THE RITE'S JOB. Widening a varchar is a
 * `MODIFY COLUMN`, which `scripts/lib/ceremonyAutoApply.mts` refuses by design:
 * telling a widening from a narrowing needs the current width compared with the
 * target's, and a classifier sometimes right about `MODIFY` is worse than one
 * never asked. So a person runs this, naming the world, and it reads the
 * column's current width before it alters anything.
 *
 * His word, on the Desk card `refine-record-width-1126`, 2026-09-25: "a" —
 * widen it — with the condition "as long as it doesnt interfere with the
 * shift". It does not: the alter fires no deploy, touches no running process,
 * and on an empty table takes about a second. The code that pins the width
 * (`REFINE_REQUEST_TEXT_MAX_LENGTH`, the schema declaration) follows in its own
 * PR; until it lands the code simply keeps trimming at 220 into a wider column.
 *
 * TWO WORLDS, NAMED OUT LOUD. Dev and production are both Railway MySQL on the
 * same host and differ only by port, so this script refuses to guess: it takes
 * the world as an argument and prints the port before it alters anything.
 *
 *   npx tsx scripts/ceremony-request-text-width.mts --dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-request-text-width.mts --production
 *
 * Idempotent: it reads the column's width first and says ALREADY APPLIED
 * rather than failing, so a re-run is safe and is the independent confirmation.
 * It refuses any width that is neither 220 nor 400 — a column nobody expected
 * is a wrong database, not a job for this script.
 */
import { readFile } from "node:fs/promises";

import { openCeremonyWorld } from "./lib/ceremony.mts";
import { openDatabase } from "./lib/dbConnection.mts";

const { connection: conn } = await openCeremonyWorld(process.argv);

const TABLE = "casting_candidate_variants";
const COLUMN = "requestText";
const FROM = 220;
const TO = 400;
const MIGRATION = "drizzle/0066_casting_v2_request_text_400.sql";

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
