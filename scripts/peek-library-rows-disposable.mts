import "dotenv/config";
import mysql from "mysql2/promise";
const c = await mysql.createConnection(process.env.DATABASE_URL!);
const [rows] = await c.query<any[]>(
  "select id, slot, variantId, refusedReason, refusedCoverage, refusedContentKey is not null hasCrop"
  + " from casting_reference_library order by id");
console.log(`${rows.length} library rows`);
for (const r of rows) console.log(` #${r.id} ${String(r.slot).padEnd(16)} v${r.variantId} ${String(r.refusedReason ?? "stored").padEnd(18)} ${r.refusedCoverage === null ? "" : (r.refusedCoverage/100).toFixed(1)+"%"} ${r.hasCrop ? "· pixels" : ""}`);
await c.end();
