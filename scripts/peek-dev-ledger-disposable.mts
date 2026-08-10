import "dotenv/config";

/*
  THROUGH `openDatabase`, AND THE TEN HOURS ARE THE REASON (shift 36).

  This script used to open its own `mysql.createConnection` and print
  `new Date(row.createdAt).toISOString()`. A raw connection parses a DATETIME as
  LOCAL, so on this machine (UTC+10) every line it printed stamped a "Z" on a
  time that was **ten hours early** — on the money ledger, which is the last
  place to be quietly wrong about a clock.

  Driven on row #390 before the fix, against the campaign ledger reader that
  already goes through the helper:

    bare    2026-08-10T09:25:38.000Z
    helper  2026-08-10 19:25:38Z      ← the same row, same reference
*/
import { openDatabase, utc } from "./lib/dbConnection.mjs";

const c = await openDatabase();
const [rows] = await c.query<any[]>(
  "select id, amount, type, referenceId, balanceAfter, createdAt from point_transactions where userId=1 order by id desc limit 10");
for (const r of rows) {
  console.log(`#${r.id} ${String(r.amount).padStart(5)} ${String(r.type).padEnd(10)} bal ${String(r.balanceAfter).padStart(7)}  ${String(r.referenceId).slice(0, 46)}  ${utc(r.createdAt)}`);
}
const [bal] = await c.query<any[]>("select balance, creditsUsed from points where userId=1");
console.log("balance", bal[0]?.balance, "used", bal[0]?.creditsUsed);
await c.end();

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
