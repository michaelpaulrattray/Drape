/**
 * WHAT ACTUALLY RODE — and it was persisted all along.
 *
 * fable-595 ordered a column built to record the dispatched reference list.
 * `internalPrompt.repaint` already holds exactly that: `edited`, `carried`,
 * `standing`, `vacated`, and `references` with each one's kind, slot, digest
 * and `sentGeometry`. So the carry question is a SELECT on his own rows.
 *
 *   railway run --service MySQL npx tsx scripts/read-what-rode-disposable.mts
 */
import "dotenv/config";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const url = resolveDatabaseUrl();
if (!url) throw new Error("no database url");
console.log(`world: ${worldOf(url)}`);
const conn = await openDatabase(url);
const [rows] = await conn.execute(
  `SELECT id, requestText, createdAt,
          JSON_UNQUOTE(JSON_EXTRACT(internalPrompt, '$.repaint')) AS repaint
     FROM casting_candidate_variants
    WHERE status = 'ready' AND JSON_EXTRACT(internalPrompt, '$.repaint') IS NOT NULL
    ORDER BY id DESC LIMIT 4`,
);
for (const row of rows as Array<Record<string, unknown>>) {
  console.log("");
  console.log(`#${row.id} · ${String(row.createdAt).slice(0, 21)} · "${String(row.requestText ?? "").slice(0, 44)}"`);
  let repaint: any = null;
  try { repaint = JSON.parse(String(row.repaint)); } catch { console.log("  (unreadable)"); continue; }
  console.log(`  edited   ${JSON.stringify(repaint.edited)}`);
  console.log(`  carried  ${JSON.stringify(repaint.carried)}`);
  console.log(`  standing ${JSON.stringify(repaint.standing)}`);
  for (const reference of repaint.references ?? []) {
    console.log(`    ref ${String(reference.kind).padEnd(8)} slot ${String(reference.slot ?? "—").padEnd(16)}`
      + ` ${reference.sentGeometry} ${String(reference.digest ?? "").slice(0, 12)}`);
  }
}
await conn.end();
process.exit(0);
