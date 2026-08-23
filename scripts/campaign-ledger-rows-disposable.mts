/**
 * EVERY CAMPAIGN ROW, NAMEABLE — because the ledger is the authority precisely
 * when every row in it can be pointed at (fable-055).
 *
 * Shift 3 parked the campaign at 1,000 credits. Shift 4 READ 1,050, of which
 * its own paid render was 25 — leaving 25 that the earlier count did not
 * include and nobody had identified. An unexplained number in the pack's money
 * section would be the only one in it without a source, so this prints the
 * whole run with a running total and lets the odd row be named by timestamp,
 * description and reference rather than inferred from a difference.
 *
 * It also states run-13's own five steps separately, so "the walk cost 100"
 * stops being arithmetic and becomes rows.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/campaign-ledger-rows-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");

const connection = await openDatabase(databaseUrl);
const [rows] = await connection.query<any[]>(
  `SELECT id, amount, type, description, referenceId, createdAt
     FROM point_transactions
    WHERE userId = 1 AND createdAt >= '2026-08-07 00:00:00'
    ORDER BY id ASC`,
);
await connection.end();

let gross = 0;
let refunded = 0;
console.log(
  "    id  when                  amt  type        description / reference".padEnd(120),
);
for (const row of rows) {
  const amount = Number(row.amount);
  if (amount < 0) gross += -amount;
  if (amount > 0 && row.type === "refund") refunded += amount;
  const running = amount < 0 ? `  → gross ${gross}` : "";
  console.log(
    `${String(row.id).padStart(6)}  ${utc(row.createdAt)}  ${String(amount).padStart(5)}  `
    + `${String(row.type).padEnd(10)}  ${String(row.description ?? "").slice(0, 40).padEnd(40)}  `
    + `${String(row.referenceId ?? "").slice(0, 44)}${running}`,
  );
}

/* No ceiling: the founder removed it outright on 2026-08-23 — verbatim "no
   cieling remove it" (relayed fable-1439). This stays a READING and governs
   nothing; the discipline that was always the real control is untouched. */
console.log(`\ngross ${gross}   refunded ${refunded}   net ${gross - refunded}   rows ${rows.length}`);

/* Run-13's window, from its own walk.json: started 13:59:23Z, last step done a
   few minutes later. Stated as ROWS so the walk's cost is read, not counted. */
const RUN13_FROM = Date.parse("2026-08-08T13:59:00Z");
const RUN13_TO = Date.parse("2026-08-08T14:35:00Z");
const runThirteen = rows.filter((row) => {
  const at = Date.parse(`${utc(row.createdAt).replace(" ", "T")}Z`);
  return at >= RUN13_FROM && at <= RUN13_TO;
});
console.log(`\nrun-13 window (13:59–14:35Z): ${runThirteen.length} rows`);
let runGross = 0;
for (const row of runThirteen) {
  const amount = Number(row.amount);
  if (amount < 0) runGross += -amount;
  console.log(
    `  ${utc(row.createdAt)}  ${String(amount).padStart(5)}  ${String(row.type).padEnd(10)}  `
    + `${String(row.referenceId ?? "").slice(0, 44)}`,
  );
}
console.log(`  run-13 gross: ${runGross}`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
