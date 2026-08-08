/**
 * WHAT THE CAMPAIGN HAS ACTUALLY SPENT — read from the ledger, never counted
 * from memory. The ceiling is a founder-set limit and a remembered number is a
 * claim (working law 1).
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/campaign-charges-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");

const connection = await openDatabase(databaseUrl);
const [totals] = await connection.query<any[]>(
  `SELECT SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS gross,
          SUM(CASE WHEN amount > 0 AND type = 'refund' THEN amount ELSE 0 END) AS refunded,
          COUNT(*) AS rows_
     FROM point_transactions
    WHERE userId = 1 AND createdAt >= '2026-08-07 00:00:00'`,
);
const [recent] = await connection.query<any[]>(
  `SELECT amount, type, referenceId, createdAt
     FROM point_transactions WHERE userId = 1 ORDER BY id DESC LIMIT 5`,
);
await connection.end();

const gross = Number(totals[0]?.gross ?? 0);
const refunded = Number(totals[0]?.refunded ?? 0);
console.log(`campaign gross charges since 2026-08-07: ${gross} of 5,000`);
console.log(`  refunded back: ${refunded}    net: ${gross - refunded}    rows: ${totals[0]?.rows_}`);
console.log(`\nmost recent:`);
for (const row of recent) {
  console.log(`  ${String(row.amount).padStart(5)}  ${String(row.type).padEnd(11)} `
    + `${String(row.referenceId ?? "").slice(0, 46).padEnd(46)} ${utc(row.createdAt)}`);
}
