import "dotenv/config";
import mysql from "mysql2/promise";
const uri = process.env.DATABASE_URL!;
console.log("port", new URL(uri).port);
const c = await mysql.createConnection({ uri, timezone: "Z" });
const [cols] = await c.query<any[]>("SHOW COLUMNS FROM casting_segments");
console.log(cols.map((r: any) => r.Field).join(", "));
const [rows] = await c.query<any[]>(
  "SELECT id, facet, variantId, maskKey, contentKey, bboxX, bboxY, bboxW, bboxH, frameWidth, frameHeight, region"
  + " FROM casting_segments ORDER BY id DESC LIMIT 40");
for (const r of rows) console.log(r.id, String(r.facet).padEnd(22), String(r.region).padEnd(16), "v" + r.variantId, (r.bboxW + "x" + r.bboxH).padEnd(10), r.maskKey ? "mask" : "NO MASK");
await c.end();

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
