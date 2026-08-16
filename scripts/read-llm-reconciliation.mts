/**
 * "HOW DID OPUS SPEND $100 IN LLM CREDITS, IT'S NOT EVEN IMAGE GENERATION?"
 * — the founder's own question, answered in his terms (fable-684 §6).
 *
 * # The shape of the answer, and why it is this way round
 *
 * The obvious build is to add our rows up and hand him the total. That total
 * would be wrong, and worse, wrong in a way nothing could catch: our rows are
 * written by the PRODUCT, and most of that money was spent by BENCHES and
 * COURT campaigns — scripts that call the same account and write no row at all.
 * A derived total would have looked complete and been a fraction.
 *
 * So the money is READ and the shape is DERIVED:
 *
 *   READ     OpenRouter's own `/api/v1/key` — lifetime, month, week, today.
 *            Not our arithmetic, so nothing about our record-keeping can make
 *            it wrong. fal's balance is behind an admin key we do not hold, so
 *            its figure is derived and labelled.
 *   DERIVED  what the product's own rows can account for, by stage, with the
 *            gap between the two named rather than closed.
 *
 * **The gap is the answer.** Read minus product-attributable is the campaign
 * work, and saying so honestly is more useful than a table that quietly
 * pretends the product spent it.
 *
 * # What "unpriced" means here, in three different strengths
 *
 *   NO ROW      benches and courts write nothing. Structurally invisible; only
 *               the READ total sees them at all.
 *   NO CENSUS   rows written before the census landed carry no call list.
 *   NO TOKENS   rows written before `tokens` landed carry calls but no token
 *               counts, and OpenRouter bills by the token — so their dollar
 *               share cannot be computed even though their COUNTS can.
 *
 * Each is counted and printed. A window this cannot price is named as unpriced
 * (fable-684 §6), never rounded into the total.
 *
 *   npx tsx scripts/read-llm-reconciliation.mts
 *   npx tsx scripts/read-llm-reconciliation.mts --production
 *   npx tsx scripts/read-llm-reconciliation.mts --days 30
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";

import { openDatabase, worldOf } from "./lib/dbConnection.mts";
import { readOpenRouterUsage } from "./lib/openrouterBalance.mts";
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

console.log(`LLM SPEND RECONCILIATION — ${worldOf(url)}`
  + `${production ? "  (PRODUCTION, by ceremony)" : "  (dev, from .env)"}`);
console.log(`window: the last ${days} day(s)\n`);

/* ── 1. THE MONEY, READ ──────────────────────────────────────────────────── */

console.log("READ — the accounts' own figures, not our arithmetic");
const usage = await readOpenRouterUsage();
if (!usage.ok) {
  console.log(`  openrouter UNREAD — ${usage.why}`);
} else {
  console.log(`  openrouter   today $${usage.daily.toFixed(2)}`
    + `   this week $${usage.weekly.toFixed(2)}`
    + `   this month $${usage.monthly.toFixed(2)}`
    + `   lifetime $${usage.lifetime.toFixed(2)}`);
  console.log(`               per-day / per-model breakdown: ${usage.isManagementKey
    ? "available (this IS a management key)"
    : "REFUSED — /api/v1/activity wants a management key; this is an ordinary one"}`);
}

/* ── 2. WHAT THE PRODUCT'S OWN ROWS ACCOUNT FOR ──────────────────────────── */

const connection = await openDatabase(url);
const since = new Date(Date.now() - days * 86_400_000);
const [rows] = await connection.query<any[]>(
  `SELECT createdAt, internalPrompt FROM casting_candidate_variants
    WHERE createdAt >= ? ORDER BY createdAt`,
  [since.toISOString().slice(0, 19).replace("T", " ")],
);

type StageTally = { calls: number; ms: number; tokensIn: number; tokensOut: number; tokenCalls: number };
const byStage = new Map<string, StageTally>();
const byDay = new Map<string, { rows: number; calls: number; tokenCalls: number }>();
let noCensus = 0;
let noTokens = 0;
let openrouterCalls = 0;

for (const row of rows) {
  const payload = row.internalPrompt && typeof row.internalPrompt === "object"
    ? row.internalPrompt
    : (() => { try { return JSON.parse(String(row.internalPrompt)); } catch { return null; } })();
  const census = payload?.census;
  const day = new Date(row.createdAt).toISOString().slice(0, 10);
  const dayTally = byDay.get(day) ?? { rows: 0, calls: 0, tokenCalls: 0 };
  dayTally.rows += 1;
  if (!census || !Array.isArray(census.calls)) {
    noCensus += 1;
    byDay.set(day, dayTally);
    continue;
  }
  let rowHasTokens = false;
  for (const call of census.calls as Array<Record<string, any>>) {
    const stage = String(call?.stage ?? "other");
    const tally = byStage.get(stage) ?? { calls: 0, ms: 0, tokensIn: 0, tokensOut: 0, tokenCalls: 0 };
    tally.calls += 1;
    tally.ms += Number(call?.ms) || 0;
    if (call?.tokens) {
      rowHasTokens = true;
      tally.tokensIn += Number(call.tokens.in) || 0;
      tally.tokensOut += Number(call.tokens.out) || 0;
      tally.tokenCalls += 1;
      dayTally.tokenCalls += 1;
    }
    if (call?.provider === "openrouter") openrouterCalls += 1;
    byStage.set(stage, tally);
    dayTally.calls += 1;
  }
  if (!rowHasTokens) noTokens += 1;
  byDay.set(day, dayTally);
}

console.log(`\nDERIVED — what the product's own rows can account for`);
console.log(`  ${rows.length} edit row(s) in the window`);
console.log(`    ${noCensus} carry NO CENSUS      (written before the census landed — invisible)`);
console.log(`    ${noTokens} carry NO TOKEN COUNTS (calls countable, dollars not — OpenRouter bills by the token)`);

if (byStage.size > 0) {
  const totalCalls = [...byStage.values()].reduce((sum, tally) => sum + tally.calls, 0);
  console.log("\n  where the calls go — the SHAPE of the spend, which is countable today");
  console.log("    stage        calls   share      seconds   token calls");
  for (const [stage, tally] of [...byStage].sort((a, b) => b[1].calls - a[1].calls)) {
    console.log(
      `    ${stage.padEnd(12)}${String(tally.calls).padStart(5)}`
      + `${`${((tally.calls / totalCalls) * 100).toFixed(1)}%`.padStart(8)}`
      + `${(tally.ms / 1000).toFixed(0).padStart(11)}s`
      + `${String(tally.tokenCalls).padStart(14)}`,
    );
  }
  console.log(`\n  of those, ${openrouterCalls} went to OPENROUTER — the account the $100 question is about.`);
  const tokened = [...byStage.values()].reduce((sum, tally) => sum + tally.tokenCalls, 0);
  console.log(tokened === 0
    ? "  NONE of them carry token counts yet, so their DOLLAR share is UNPRICED.\n"
      + "  The counts still answer the shape of his question; the money needs ordinary\n"
      + "  use to produce rows on the build that records tokens. ACCUMULATE — do not\n"
      + "  buy renders to watch our own instrument."
    : `  ${tokened} of them carry token counts, so a dollar split is now computable.`);
}

/* ── 3. FAL, BESIDE IT ───────────────────────────────────────────────────── */

const balance = await readFalBalance();
const traffic = await readFalTraffic(connection, since.toISOString());
await connection.end();
const prices = await readFalPrices(traffic.models.map((model) => model.model));
console.log(`\n  ${falLine(balance, { traffic, priced: priceFalCalls(traffic.models, prices) })}`);

/* ── 4. THE GAP, WHICH IS THE ANSWER ─────────────────────────────────────── */

console.log("\nTHE GAP — and it is the answer, not a defect in the table");
if (usage.ok) {
  console.log(`  OpenRouter says this key spent $${usage.weekly.toFixed(2)} in the last 7 days`);
}
console.log("  The product's rows can never account for most of it, BY CONSTRUCTION:");
console.log("    · benches and court campaigns call the same account and write NO ROW");
console.log("    · face scans mint nothing at all, by design");
console.log("    · rows older than the census, and rows older than the token field");
console.log("  So the honest decomposition is: READ total − what the product can show =");
console.log("  the campaign work. That difference is where the money went, and it is");
console.log("  measurement of ourselves rather than of the customer's product.");
console.log("\n  What would close it properly: a MANAGEMENT key on OpenRouter and an ADMIN");
console.log("  key on fal. Both are dashboard errands, both give per-day and per-model");
console.log("  breakdowns, and both are on the founder's queue.");

process.exit(0);
