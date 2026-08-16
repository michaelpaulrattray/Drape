/**
 * THE FAL SPEND LINE, DRIVEN AGAINST REAL ROWS — the reading that proves the
 * line before it goes into a receipt (fable-684 §1).
 *
 * `falSpend.mts`'s suite drives every branch through a fake `fetch`, which
 * proves the arithmetic and proves nothing about whether the census is where
 * this thinks it is. So this runs the same functions over an actual database
 * and prints the breakdown the one-line receipt compresses.
 *
 * Reads only. Spends nothing but the two GETs fal answers for free.
 *
 *   npx tsx scripts/read-fal-spend-disposable.mts              (dev, from .env)
 *   npx tsx scripts/read-fal-spend-disposable.mts --production (by ceremony)
 *   npx tsx scripts/read-fal-spend-disposable.mts --days 30
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";

import { openDatabase, worldOf } from "./lib/dbConnection.mts";
import {
  falLine,
  priceFalCalls,
  readFalBalance,
  readFalPrices,
  readFalTraffic,
} from "./lib/falSpend.mts";

const production = process.argv.includes("--production");
const daysArg = process.argv.indexOf("--days");
const days = daysArg > -1 ? Number(process.argv[daysArg + 1]) : 7;
if (!Number.isFinite(days) || days <= 0) throw new Error("--days wants a positive number");

/** Production's URL, read by name off the MySQL service and never printed. */
function productionUrl(): string {
  const out = execFileSync("railway.cmd", ["variables", "--service", "MySQL", "--kv"], {
    encoding: "utf8", shell: true, maxBuffer: 32 * 1024 * 1024,
  });
  const line = out.split(/\r?\n/).map((row) => row.trim())
    .find((row) => row.startsWith("MYSQL_PUBLIC_URL="));
  if (!line) throw new Error("MYSQL_PUBLIC_URL not readable from the MySQL service");
  return line.slice("MYSQL_PUBLIC_URL=".length);
}

const url = production ? productionUrl() : process.env.DATABASE_URL;
if (!url) throw new Error("no database url");
console.log(`WORLD: ${worldOf(url)}${production ? "  (PRODUCTION, by ceremony)" : "  (dev, from .env)"}`);

const balance = await readFalBalance();
console.log(`\nbalance: ${balance.ok ? `$${balance.remaining}` : `UNREAD — ${balance.why}`}`);

const connection = await openDatabase(url);
const since = new Date(Date.now() - days * 86_400_000).toISOString();
const traffic = await readFalTraffic(connection, since);
await connection.end();

const prices = await readFalPrices(traffic.models.map((model) => model.model));
console.log(`prices: ${prices.ok ? `${prices.prices.size} read from fal` : `UNREAD — ${prices.why}`}`);

const priced = priceFalCalls(traffic.models, prices);

console.log(`\nwindow ${traffic.from.slice(0, 10)} → ${traffic.to.slice(0, 10)} (${days}d)`);
console.log(`refine rows ${traffic.refineRows}, of which ${traffic.refineRowsWithCensus} carried a census`);
console.log(`roll renders from candidate rows: ${traffic.rollRenders}`);
console.log("");
for (const model of priced.models) {
  const usd = model.usd === null ? "     —" : `$${model.usd.toFixed(3)}`.padStart(8);
  console.log(`  ${usd}  ${String(model.calls).padStart(5)} calls  ${model.model}`);
  console.log(`            ${model.note}`);
}
console.log(`\n  TOTAL $${priced.usd.toFixed(2)}  (${priced.unpriced.length} model(s) unpriced)`);
console.log(`\nthe receipt line:\n${falLine(balance, { traffic, priced })}`);
/* An entrypoint ends by ending the process — the house rule, and its own guard
   caught this file the first time the suite ran over it. */
process.exit(0);
