/**
 * WHAT THE RENDER SAID ABOUT THE THING IT WAS ALSO SHOWING.
 *
 * The crops rode (opus-448). So the open question is whether the WORDS beside
 * them agreed: a recipe that hands the engine two pictures of one object and
 * two different sentences about it is asking for two different paintings.
 *
 * Reads the dispatched repaint prompt — the real one — and prints only the
 * clauses that name the carried slots.
 *
 *   railway run --service MySQL npx tsx scripts/read-carried-words-disposable.mts
 */
import "dotenv/config";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const url = resolveDatabaseUrl();
if (!url) throw new Error("no database url");
console.log(`world: ${worldOf(url)}`);
const conn = await openDatabase(url);
const [rows] = await conn.execute(
  `SELECT id, requestText,
          JSON_UNQUOTE(JSON_EXTRACT(internalPrompt, '$.repaint.prompt')) AS prompt,
          JSON_UNQUOTE(JSON_EXTRACT(internalPrompt, '$.repaint.carried')) AS carried
     FROM casting_candidate_variants
    WHERE status = 'ready' AND JSON_EXTRACT(internalPrompt, '$.repaint.carried') IS NOT NULL
    ORDER BY id DESC LIMIT 3`,
);
for (const row of rows as Array<Record<string, unknown>>) {
  const carried = JSON.parse(String(row.carried ?? "[]")) as string[];
  if (carried.length === 0) continue;
  console.log("");
  console.log(`#${row.id} "${String(row.requestText ?? "").slice(0, 40)}" · carried ${JSON.stringify(carried)}`);
  const prompt = String(row.prompt ?? "");
  for (const sentence of prompt.split(/(?<=\.)\s+/)) {
    if (/reference \d|earring|horn|cross/i.test(sentence)) {
      console.log(`   · ${sentence.trim().slice(0, 190)}`);
    }
  }
}
await conn.end();
process.exit(0);
