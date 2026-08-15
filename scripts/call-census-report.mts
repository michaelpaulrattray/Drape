/**
 * WHERE A PAID EDIT'S MINUTES AND MONEY GO — read back from the rows renders
 * already write.
 *
 * The founder's order for the latency-and-cost program is *stopwatch every
 * stage before optimising*, and this is the stopwatch's dial. Each landed
 * variant carries a `census` on its `internalPrompt`: every outbound model call
 * that request made before the row was written, with its stage, its model and
 * its milliseconds. This adds them up across a window.
 *
 * What each column answers:
 *
 *   calls/render   the cost lever. Seven calls at a tenth of a cent is a
 *                  different problem from one call at ten cents.
 *   sum vs wall    the latency lever. Sum far above wall means the calls run
 *                  together and only the slowest matters; sum ≈ wall means a
 *                  queue of serial round trips, which is an architecture
 *                  question rather than a provider one.
 *   by stage       where to start. `segment` dominating says caching the
 *                  master's regions is the first move; `read` dominating says
 *                  the verification budget is.
 *
 *   npx tsx scripts/call-census-report.mts                     # dev database
 *   railway.cmd run --service MySQL -- npx tsx scripts/…       # production
 *
 * Optional: --since 2026-08-14T00:00:00Z   (default: the last 7 days)
 *           --user 1
 *
 * NO PII and no creative content: the census is a bill, never a transcript —
 * stages, models, milliseconds, and region words from the closed vocabulary.
 */
import "dotenv/config";

import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mjs";

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const sinceRaw = arg("since");
const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
if (Number.isNaN(since.getTime())) {
  console.error(`--since is not a date: ${sinceRaw}`);
  process.exit(1);
}
const userId = arg("user");

const databaseUrl = resolveDatabaseUrl();
const db = await openDatabase(databaseUrl);

const [rows] = await db.query(
  `SELECT id, createdAt, internalPrompt
     FROM casting_candidate_variants
    WHERE createdAt >= ?
      AND internalPrompt IS NOT NULL
      ${userId ? "AND userId = ?" : ""}
    ORDER BY createdAt`,
  userId ? [since, Number(userId)] : [since],
);

const readJson = (value: unknown): any => {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return null; } }
  return null;
};

type Bucket = { calls: number; ms: number; tokensIn: number; tokensOut: number; tokenCalls: number };
const add = (into: Map<string, Bucket>, key: string, ms: number, tokens?: { in: number; out: number }) => {
  const bucket = into.get(key) ?? { calls: 0, ms: 0, tokensIn: 0, tokensOut: 0, tokenCalls: 0 };
  bucket.calls += 1;
  bucket.ms += ms;
  if (tokens) {
    bucket.tokensIn += tokens.in;
    bucket.tokensOut += tokens.out;
    bucket.tokenCalls += 1;
  }
  into.set(key, bucket);
};

const perRenderCalls: number[] = [];
const perRenderWall: number[] = [];
const perRenderSum: number[] = [];
const byStage = new Map<string, Bucket>();
const byModel = new Map<string, Bucket>();
/* WHICH QUESTIONS the reads were spent on. Recorded on every call since
   `aboutOf` existed, summed by the request's own closing log line — and read
   back across a window by nothing at all until now. Same shape as the field
   that gave `byAbout` its comment: collected, never asserted. */
const byAbout = new Map<string, Bucket>();
let censused = 0;
let failedCalls = 0;

for (const row of rows as any[]) {
  const census = readJson(row.internalPrompt)?.census;
  if (!census || !Array.isArray(census.calls)) continue;
  censused += 1;
  perRenderCalls.push(census.calls.length);
  perRenderWall.push(Number(census.wallMs) || 0);
  perRenderSum.push(Number(census.total?.ms) || 0);
  failedCalls += Number(census.total?.failed) || 0;
  for (const call of census.calls) {
    /* Absent, malformed or partial usage is treated as UNMEASURED rather than
       as free — the writer refuses to invent a zero and so does the reader. */
    const usage = call.tokens;
    const tokens = usage && typeof usage.in === "number" && typeof usage.out === "number"
      ? { in: usage.in, out: usage.out }
      : undefined;
    add(byStage, String(call.stage), Number(call.ms) || 0, tokens);
    add(byModel, `${call.provider}:${call.model}`, Number(call.ms) || 0, tokens);
    if (typeof call.about === "string" && call.about.length > 0) {
      add(byAbout, call.about, Number(call.ms) || 0, tokens);
    }
  }
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
};
const p90 = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]!;
};

console.log(`\nWHAT A PAID EDIT COSTS — since ${since.toISOString()}${userId ? ` · user ${userId}` : ""}`);
console.log(`  world: ${worldOf(databaseUrl)}   (dev is :52008, production is :23768)\n`);

if (censused === 0) {
  /* An unread window, stated as one. The census landed 2026-08-15; every render
     before it carries no field, and a row with no census is not a render that
     made no calls. */
  console.log(`  ${(rows as any[]).length} variants in this window and NONE carries a census.`);
  console.log("  That is an unread window, not a free product — the census shipped 2026-08-15.\n");
  await db.end();
  process.exit(0);
}

console.log(`  renders measured   ${censused} of ${(rows as any[]).length} in the window`);
console.log(`  calls per render   median ${median(perRenderCalls)} · p90 ${p90(perRenderCalls)} · max ${Math.max(...perRenderCalls)}`);
console.log(`  call seconds       median ${(median(perRenderSum) / 1000).toFixed(1)}s summed across calls`);
console.log(`  wall seconds       median ${(median(perRenderWall) / 1000).toFixed(1)}s · p90 ${(p90(perRenderWall) / 1000).toFixed(1)}s`);
const parallelism = median(perRenderWall) === 0 ? 0 : median(perRenderSum) / median(perRenderWall);
console.log(`  sum ÷ wall         ${parallelism.toFixed(2)}×  ${parallelism > 1.5 ? "— running together; the slowest call is the target" : "— serial round trips; the ORDER is the target"}`);
if (failedCalls > 0) console.log(`  failed calls       ${failedCalls} (money out, nothing delivered by them)`);

/*
  HOW MUCH OF THIS WINDOW IS PRICEABLE, said out loud.

  A token-billed model with no token counts prints no token column, and an
  absent column reads exactly like a free one. The same trap as the unread
  window above it: silence is not a measurement.
*/
const tokenCalls = [...byModel.values()].reduce((sum, one) => sum + one.tokenCalls, 0);
const allCalls = [...byModel.values()].reduce((sum, one) => sum + one.calls, 0);
console.log(
  tokenCalls === 0
    ? `  tokens             NONE of ${allCalls} calls carries a token count — an UNPRICED window,`
      + "\n                     not a free one. The count shipped 2026-08-16."
    : `  tokens             ${tokenCalls} of ${allCalls} calls priced`,
);

const table = (title: string, buckets: Map<string, Bucket>) => {
  console.log(`\n  ${title}`);
  const total = [...buckets.values()].reduce((sum, one) => sum + one.ms, 0);
  for (const [key, bucket] of [...buckets.entries()].sort((a, b) => b[1].ms - a[1].ms)) {
    const share = total === 0 ? 0 : (bucket.ms / total) * 100;
    /*
      TOKENS WITH THEIR DENOMINATOR, always. "412k tokens" over calls that half
      of them never reported is a number that reads as a measurement and is an
      undercount; `4/39 priced` says which it is at a glance.
    */
    const priced = bucket.tokenCalls === 0
      ? ""
      : `  ${((bucket.tokensIn + bucket.tokensOut) / 1000).toFixed(1)}k tok`
        + ` (${bucket.tokenCalls}/${bucket.calls} priced)`;
    console.log(
      `    ${key.padEnd(34)} ${String(bucket.calls).padStart(5)} calls  `
      + `${(bucket.ms / 1000).toFixed(1).padStart(7)}s  ${share.toFixed(1).padStart(5)}%  `
      + `${(bucket.ms / bucket.calls / 1000).toFixed(1)}s each${priced}`,
    );
  }
};

table("BY STAGE — where the seconds go", byStage);
table("BY MODEL — where the invoice goes", byModel);

/*
  AND BY QUESTION, which is the only table that names a LEVER.

  The stage table says "segmentation costs 40s a render"; it cannot say whether
  that is one question asked forty times or forty questions asked once, and
  those have opposite fixes. `about` is the closed region vocabulary only — a
  region name, never a customer's sentence — so this stays a bill.

  Per-render rather than totals, because the window's size is arbitrary and
  "1.9 calls per render about eyes" is a number somebody can act on.
*/
console.log(`\n  BY QUESTION — what the reads were bought for (${censused} renders)`);
const askedTotal = [...byAbout.values()].reduce((sum, one) => sum + one.ms, 0);
const asked = [...byAbout.entries()].sort((a, b) => b[1].ms - a[1].ms);
if (asked.length === 0) {
  console.log("    no call in this window carried a question — every one was prose (interpreter, treatment).");
} else {
  for (const [question, bucket] of asked.slice(0, 20)) {
    const share = askedTotal === 0 ? 0 : (bucket.ms / askedTotal) * 100;
    console.log(
      `    ${question.padEnd(34)} ${String(bucket.calls).padStart(5)} calls  `
      + `${(bucket.ms / 1000).toFixed(1).padStart(7)}s  ${share.toFixed(1).padStart(5)}%  `
      + `${(bucket.calls / censused).toFixed(2)}/render`,
    );
  }
  if (asked.length > 20) console.log(`    … and ${asked.length - 20} more questions`);
}

console.log(`
  READ THE LAST COLUMN OF THE STAGE TABLE FIRST. A stage that is many cheap
  calls is a caching problem; one that is few expensive calls is a routing or a
  model problem. They have different fixes and the totals alone hide which.

  AND READ "sum ÷ wall" AS WHAT IT ARITHMETICALLY IS: the MEAN NUMBER OF CALLS
  IN FLIGHT across the window, since the sum of call durations over an interval
  is the integral of concurrency across it. A figure near 1.0 says the render
  spends its whole clock with about one provider call outstanding. It does NOT
  say nothing runs in parallel — a bilateral region's two halves go out
  together by construction — it says the parallelism there is, and the idle
  there is, cancel to about one.

  TWO BIASES, BOTH DOWNWARD, both from the row being written before the request
  ends (\`censusSoFar\`): a call still IN FLIGHT at that moment contributes its
  elapsed time to the wall and nothing to the sum, and anything after the
  picture is stored is missing from both. So this ratio and these totals are
  FLOORS. The complete figure is in the request's own closing log line, and the
  two are meant to be read together.
`);

await db.end();
process.exit(0);
