/**
 * WHAT THE VERIFICATION SAID, AND THEREFORE WHAT THE MINT COULD EARN.
 * (The free reading opus-446 promised: `internalPrompt.verification` is on the
 * row, so the difference between a render that filed and one that filed nothing
 * is a SELECT rather than another purchase.)
 *
 *   npx tsx scripts/read-earned-disposable.mts
 *   railway run --service MySQL npx tsx scripts/read-earned-disposable.mts
 */
import "dotenv/config";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const url = resolveDatabaseUrl();
if (!url) throw new Error("no database url");
console.log(`world: ${worldOf(url)}`);
const conn = await openDatabase(url);
const [rows] = await conn.execute(
  `SELECT v.id, v.requestText,
          JSON_UNQUOTE(JSON_EXTRACT(v.internalPrompt, '$.verification')) AS verification,
          (SELECT COUNT(*) FROM casting_reference_library l WHERE l.variantId = v.id) AS filed
     FROM casting_candidate_variants v
    WHERE v.status = 'ready' AND v.internalPrompt IS NOT NULL
    ORDER BY v.id DESC LIMIT 4`,
);
for (const row of rows as Array<Record<string, unknown>>) {
  console.log("");
  console.log(`#${row.id} filed ${row.filed} · "${String(row.requestText ?? "").slice(0, 40)}"`);
  let parsed: any = null;
  try { parsed = JSON.parse(String(row.verification)); } catch { /* printed raw below */ }
  if (!parsed) { console.log(`  verification: ${String(row.verification).slice(0, 200)}`); continue; }
  const checks = Array.isArray(parsed.checks) ? parsed.checks : [];
  console.log(`  unavailable=${parsed.unavailable} · checks=${checks.length}`);
  for (const check of checks.slice(0, 6)) {
    console.log(`    ${String(check.facet ?? "?").padEnd(18)} read=${check.read} verified=${check.verified}`
      + ` saw="${String(check.saw ?? "").slice(0, 40)}"`);
  }
}
await conn.end();
process.exit(0);
