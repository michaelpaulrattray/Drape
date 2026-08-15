/**
 * WHAT THE NEXT RENDER'S PROMPT SAID ABOUT HER EARRINGS — read-only.
 * (fable-586/587: both sides filed with crops and digests, and the right one
 * drifted anyway, so the question is whether the crops RODE.)
 *
 * Prints only the earring clauses and the reference count — never the whole
 * internal prompt.
 *
 *   railway run --service MySQL npx tsx scripts/read-carry-in-prompt-disposable.mts
 */
import "dotenv/config";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const url = resolveDatabaseUrl();
if (!url) throw new Error("no database url");
console.log(`world: ${worldOf(url)}`);
const conn = await openDatabase(url);
const [who] = await conn.execute(
  `SELECT userId FROM casting_candidate_variants WHERE status='ready'
    GROUP BY userId ORDER BY MAX(createdAt) DESC LIMIT 1`);
const userId = (who as Array<{ userId: number }>)[0]!.userId;
const [rows] = await conn.execute(
  `SELECT id, requestText, JSON_UNQUOTE(JSON_EXTRACT(internalPrompt, '$.prompt')) AS prompt
     FROM casting_candidate_variants WHERE userId = ? AND status='ready' ORDER BY id DESC LIMIT 2`,
  [userId]);
for (const row of rows as Array<{ id: number; requestText: string; prompt: string | null }>) {
  const prompt = row.prompt ?? "";
  const references = (prompt.match(/reference \d+/gi) ?? []).map((one) => one.toLowerCase());
  const earringLines = prompt.split(/(?<=\.)\s+/).filter((line) => /earring|cross|pendant/i.test(line));
  console.log("");
  console.log(`variant ${row.id} · "${row.requestText}"`);
  console.log(`  references named: ${Array.from(new Set(references)).join(", ") || "none"}`);
  console.log(`  earring clauses (${earringLines.length}):`);
  for (const line of earringLines.slice(0, 4)) console.log(`    · ${line.trim().slice(0, 150)}`);
}
await conn.end();
process.exit(0);
