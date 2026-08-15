/**
 * WHAT A RENDER RECORDS ABOUT ITS OWN VERIFICATION — read-only, both worlds.
 *
 * The mint files only what the verification EARNED, and dev renders earn
 * nothing while production renders earn plenty. Before buying another render,
 * this asks what the rows already say: which keys `internalPrompt` holds, and
 * whether any of them is a record of the checks.
 *
 *   npx tsx scripts/read-verification-trace-disposable.mts
 *   railway run --service MySQL npx tsx scripts/read-verification-trace-disposable.mts
 */
import "dotenv/config";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const url = resolveDatabaseUrl();
if (!url) throw new Error("no database url");
console.log(`world: ${worldOf(url)}`);
const conn = await openDatabase(url);
const [rows] = await conn.execute(
  `SELECT v.id, v.requestText, JSON_KEYS(v.internalPrompt) AS promptKeys,
          (SELECT COUNT(*) FROM casting_reference_library l WHERE l.variantId = v.id) AS filed
     FROM casting_candidate_variants v
    WHERE v.status = 'ready' AND v.internalPrompt IS NOT NULL
    ORDER BY v.id DESC LIMIT 6`,
);
for (const row of rows as Array<Record<string, unknown>>) {
  console.log(`  #${row.id} filed ${row.filed} · "${String(row.requestText ?? "").slice(0, 34)}"`);
  console.log(`      keys: ${String(row.promptKeys)}`);
}
await conn.end();
process.exit(0);
