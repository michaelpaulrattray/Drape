/**
 * SCOUT FOR THE ROUTING BENCH — free, and it exists so the bench's price is a
 * reading rather than a division.
 *
 * opus-647 §4 priced the routing bench at ~$1.07 by dividing OpenRouter's
 * 30-day books ($98.09) by their request count (10,107). That average blends
 * the refine interpreter with the treatment stage, which is a different prompt
 * of a different size — so the figure is honest about the ACCOUNT and says
 * nothing reliable about THIS call. This scout replaces it with:
 *
 *   1. the per-token rates the provider's own books imply for the pinned
 *      interpreter model, solved from prompt/completion tokens and usd;
 *   2. the real size of the system prompt each arm sends, measured off the
 *      exported string rather than guessed;
 *   3. the corpus itself — every refine instruction ever typed, counted and
 *      deduped, in whichever world it is pointed at.
 *
 * Read-only. Selects only. No transport, no credits, no renders.
 *
 *   npx tsx scripts/scout-open-lane-clause-disposable.mts              (dev)
 *   railway.cmd run --service MySQL -- npx tsx scripts/scout-open-lane-clause-disposable.mts
 */
import { openDatabase } from "./lib/dbConnection.mts";
import {
  readOpenRouterActivity,
  readOpenRouterBalance,
  balanceLine,
} from "./lib/openrouterBalance.mts";
import { DEFAULT_INTERPRETER_MODEL } from "../server/providers/openrouterText";
import { refineParseSystemPrompt } from "../server/castingV2/refineInterpreter";

const production = process.env.MYSQL_PUBLIC_URL !== undefined;
if (!production) await import("dotenv/config");
const url = production ? process.env.MYSQL_PUBLIC_URL : process.env.DATABASE_URL;
if (!url) {
  console.error("REFUSING: no database URL. For production run under `railway.cmd run --service MySQL`.");
  process.exit(1);
}
const parsed = new URL(url);
console.log(`world: ${production ? "PRODUCTION" : "DEV"} · ${parsed.hostname}:${parsed.port || "3306"}`);

/* ── 1. the money, from the provider's own books ───────────────────────────── */

console.log(`\n=== MONEY ===`);
console.log(balanceLine(await readOpenRouterBalance()));

const activity = await readOpenRouterActivity();
if (!activity.ok) {
  console.log(`activity UNREAD — ${activity.why}`);
} else {
  const mine = activity.rows.filter((row) => row.model === DEFAULT_INTERPRETER_MODEL);
  if (mine.length === 0) {
    console.log(`no activity rows for ${DEFAULT_INTERPRETER_MODEL} in the 30-day window`);
  } else {
    const usd = mine.reduce((sum, row) => sum + row.usd, 0);
    const requests = mine.reduce((sum, row) => sum + row.requests, 0);
    const prompt = mine.reduce((sum, row) => sum + row.promptTokens, 0);
    const completion = mine.reduce((sum, row) => sum + row.completionTokens, 0);
    console.log(`${DEFAULT_INTERPRETER_MODEL} · 30d $${usd.toFixed(4)} · ${requests} requests`);
    console.log(`  prompt ${prompt.toLocaleString()} tok · completion ${completion.toLocaleString()} tok`);
    console.log(`  blended per request  $${(usd / Math.max(requests, 1)).toFixed(5)}`);
    /*
      THE PUBLISHED RATES, CHECKED AGAINST THE BOOKS RATHER THAN ASSUMED. If the
      reconstruction lands within a few per cent of what the provider charged,
      the rates are the right ones to price a call of a KNOWN size with — which
      is what the bench needs and what a blended per-request average cannot say.
    */
    for (const [inRate, outRate] of [[3, 15], [1.5, 7.5]] as const) {
      const modelled = (prompt / 1e6) * inRate + (completion / 1e6) * outRate;
      const err = usd === 0 ? NaN : ((modelled - usd) / usd) * 100;
      console.log(`  @ $${inRate}/$${outRate} per Mtok → $${modelled.toFixed(4)}  (${err >= 0 ? "+" : ""}${err.toFixed(1)}% vs books)`);
    }
    console.log(`  per-day rows:`);
    for (const row of mine.sort((a, b) => (a.date < b.date ? 1 : -1))) {
      console.log(`    ${row.date}  $${row.usd.toFixed(4)}  ${row.requests} req  ${row.promptTokens.toLocaleString()}/${row.completionTokens.toLocaleString()} tok`);
    }
  }
}

/* ── 2. the prompt each arm sends, measured ────────────────────────────────── */

console.log(`\n=== THE PROMPT ===`);
for (const mode of ["edit", "classify"] as const) {
  const text = refineParseSystemPrompt(mode);
  console.log(`  mode ${mode.padEnd(5)} ${text.length.toLocaleString()} chars · ${text.split("\n").length} lines · ~${Math.round(text.length / 3.7).toLocaleString()} tok (chars/3.7)`);
}

/* ── 3. the corpus ─────────────────────────────────────────────────────────── */

const connection = await openDatabase(url);
const [rows] = await connection.query<any[]>(
  "SELECT id, candidateId, instructions, createdAt FROM casting_candidate_variants "
  + "WHERE instructions IS NOT NULL ORDER BY createdAt ASC",
);
await connection.end();

/*
  THE COLUMN HOLDS THE WHOLE CHAIN, NOT THE ASK — and this is the correction the
  bench's price turns on.

  `instructions` is the CUMULATIVE list of every instruction on that candidate,
  so a row reading `["remove her glasses","change her hair colour to black"]` is
  one customer's second edit, not two asks. `interpretRefinement` is called with
  ONE sentence. So the corpus the bench must drive is the set of distinct
  ATOMS, and counting rows (or summing chain lengths, which is where "55 refine
  instructions" came from) overstates it by the depth of the chains.
*/
const chains: string[][] = [];
for (const row of rows) {
  const raw = row.instructions;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try { value = JSON.parse(raw); } catch { value = [raw]; }
  }
  const chain = (Array.isArray(value) ? value : [value])
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  if (chain.length > 0) chains.push(chain);
}

const atomCounts = new Map<string, number>();
for (const chain of chains) {
  for (const atom of chain) {
    const key = atom.toLowerCase();
    atomCounts.set(key, (atomCounts.get(key) ?? 0) + 1);
  }
}
const atoms = [...atomCounts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
const summed = chains.reduce((total, chain) => total + chain.length, 0);

console.log(`\n=== THE CORPUS ===`);
console.log(`  variant rows with instructions:      ${rows.length}`);
console.log(`  chains (non-empty):                  ${chains.length}`);
console.log(`  SUM of chain lengths (with repeats): ${summed}   <- the "55" figure's shape`);
console.log(`  DISTINCT ATOMS — what the interpreter is ever called with: ${atoms.length}`);
console.log(`\n  every distinct atom, most-repeated first (n = how many chains carry it):`);
for (const [index, [text, count]] of atoms.entries()) {
  console.log(`   ${String(index + 1).padStart(3)}. n=${String(count).padStart(2)}  ${JSON.stringify(text)}`);
}

process.exit(0);
