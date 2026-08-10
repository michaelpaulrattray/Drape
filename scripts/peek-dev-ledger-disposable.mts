import "dotenv/config";
import mysql from "mysql2/promise";
const c = await mysql.createConnection(process.env.DATABASE_URL!);
const [rows] = await c.query<any[]>(
  "select id, amount, type, referenceId, balanceAfter, createdAt from point_transactions where userId=1 order by id desc limit 10");
for (const r of rows) {
  console.log(`#${r.id} ${String(r.amount).padStart(5)} ${String(r.type).padEnd(10)} bal ${String(r.balanceAfter).padStart(7)}  ${String(r.referenceId).slice(0, 46)}  ${new Date(r.createdAt).toISOString()}`);
}
const [bal] = await c.query<any[]>("select balance, creditsUsed from points where userId=1");
console.log("balance", bal[0]?.balance, "used", bal[0]?.creditsUsed);
await c.end();

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
