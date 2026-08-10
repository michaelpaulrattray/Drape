import "dotenv/config";
import mysql from "mysql2/promise";
const c = await mysql.createConnection(process.env.DATABASE_URL!);
const [rows] = await c.query<any[]>(
  "select id, publicId, createdAt, status from casting_candidate_variants where candidateId=359 order by id desc limit 8");
for (const r of rows) console.log(`v${r.id} ${r.status ?? ""} ${new Date(r.createdAt).toISOString()}`);
const [seg] = await c.query<any[]>("select id, variantId, region from casting_segments order by id desc limit 6");
for (const r of seg) console.log(`seg#${r.id} v${r.variantId} ${r.region}`);
await c.end();
