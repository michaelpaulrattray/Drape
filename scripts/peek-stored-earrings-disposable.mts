import "dotenv/config";
import mysql from "mysql2/promise";
const c = await mysql.createConnection(process.env.DATABASE_URL!);
const [rows] = await c.query<any[]>(
  "select l.id, l.slot, l.storageKey is not null hasKey, l.maskKey is not null hasMask, l.bboxW, l.variantId, v.imageKey is not null hasFrame"
  + " from casting_reference_library l left join casting_candidate_variants v on v.id=l.variantId where l.slot like 'earring%' order by l.id");
for (const r of rows) console.log(`#${r.id} ${r.slot} v${r.variantId} key=${!!r.hasKey} mask=${!!r.hasMask} bboxW=${r.bboxW} frame=${!!r.hasFrame}`);
await c.end();
