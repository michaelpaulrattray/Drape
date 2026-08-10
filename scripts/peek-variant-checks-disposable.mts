import "dotenv/config";
import mysql from "mysql2/promise";
const c = await mysql.createConnection(process.env.DATABASE_URL!);
const [cols] = await c.query<any[]>("SHOW COLUMNS FROM casting_candidate_variants");
console.log(cols.map((r:any)=>r.Field).join(", "));
const [rows] = await c.query<any[]>(
  "select id, requestText, outcome, stepDeltas from casting_candidate_variants where id in (144,145,146)");
for (const r of rows) {
  console.log(`\n--- v${r.id}  ${String(r.instruction).slice(0,80)}`);
  const raw = typeof r.stepDeltas === "string" ? JSON.parse(r.stepDeltas || "null") : r.stepDeltas;
  const steps = Array.isArray(raw) ? raw : [];
  const v = steps.at(-1) ?? null;
  if (!v) { console.log("  no verification recorded"); continue; }
  console.log("  keys:", Object.keys(v).join(", "));
  for (const check of (v.verification?.checks ?? v.checks ?? [])) {
    console.log(`  ${String(check.facet).padEnd(22)} read=${check.read} verified=${check.verified} binding=${check.binding}`);
    if (check.saw) console.log(`     saw: ${String(check.saw).slice(0, 140)}`);
  }
}
await c.end();
