/**
 * HOW MANY SLOTS A RENDER READS — the sweep's own starting number.
 *
 * Ordered fable-834 §1, from opus-623 §4. Roadmap §1 says it in its own words:
 *
 *   "On the repaint road the cost is the number of reads, not their repetition:
 *    two independent reads per slot (ground and guard) is a deliberate
 *    structural cost, and the sweep should start with how many SLOTS a render
 *    reads rather than with a cache."
 *
 * Every figure here is read off rows already paid for. No render, no segmenter
 * call, no credit — this script cannot spend.
 *
 * WHERE THE SLOTS COME FROM, and why not from the region nouns. A repainted row
 * carries `internalPrompt.repaint` — the dispatch record — whose `references[]`
 * name their own `slot`, beside `edited`, `carried` and `vacated`. That is the
 * recipe's own account of what it assembled, written at dispatch (working law
 * 5). Counting distinct region nouns in the census would have been an INFERENCE
 * about the same question, and it would have silently folded the occlusion
 * companions and the guard's second look into the slot count.
 *
 * WHAT THE TWO NUMBERS MEAN TOGETHER. `slots` is what the recipe assembled;
 * `segment`/`read` are what the request bought. The ratio is the thing the
 * roadmap asserts and has never measured: if a render buys ~2 reads per slot,
 * slot count IS the cost lever and caching repetition is not.
 *
 * REPORTING RULES OBEYED (docs/specs/INSTRUMENT_DOCTRINE.md):
 *   1. unmeasured is not free — every table prints its denominator, and a row
 *      with no census prints NOT MEASURED rather than a zero;
 *   2. an absent label reads as complete attribution — coverage above the table;
 *   6. every cell carries its own n, and the DISTRIBUTION is printed rather
 *      than a mean, because a mean over a bimodal population is how the last
 *      cost figure misled.
 *
 * THE CONTROLS RUN FIRST AND THIS SCRIPT REFUSES ON A CONTROL FAILURE (working
 * law 2). They drive the same extractors the real rows go through:
 *   POSITIVE  a synthetic row with 3 known slots and 7 known segment calls must
 *             read back as exactly 3 and 7 — the instrument can COUNT.
 *   NEGATIVE  a row with no `repaint` must read UNMEASURABLE and a row with no
 *             `census` must read NOT MEASURED — never 0. An instrument that
 *             cannot tell absence from zero would report the whole non-repaint
 *             population as zero-slot renders, which is the exact shape of the
 *             invented zero rule 1 exists for.
 *
 *   npx tsx scripts/slots-per-render-disposable.mts                  # dev
 *   railway.cmd run --service MySQL -- npx tsx scripts/slots-…       # production
 *
 * Optional: --since 2026-08-10T00:00:00Z   (default: the whole campaign window)
 *           --user 1
 */
import "dotenv/config";

import { openDatabase, resolveDatabaseUrl, utc, worldOf } from "./lib/dbConnection.mjs";
import { assertOneWorld } from "./lib/worldGuard.mjs";

/* ------------------------------------------------------------- extractors */

type Row = { id: number; createdAt: Date | string; internalPrompt: unknown; userId?: number };

/** A slot reading, or the REASON there is none. Never a zero standing in for absence. */
type SlotReading =
  | { measured: true; slots: string[]; edited: string[]; carried: string[]; vacated: string[]; references: number }
  | { measured: false; why: "no-internal-prompt" | "not-repainted" };

/** A call reading, or the REASON there is none. */
type CallReading =
  | { measured: true; segment: number; read: number; render: number; total: number }
  | { measured: false; why: "no-internal-prompt" | "no-census" };

const readJson = (value: unknown): any => {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return null; } }
  return null;
};

const names = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];

export function slotsOf(internalPrompt: unknown): SlotReading {
  const prompt = readJson(internalPrompt);
  if (!prompt) return { measured: false, why: "no-internal-prompt" };
  const repaint = prompt.repaint;
  /* The mark of the repaint road. Absent on every other road BY CONSTRUCTION
     (`repaint: undefined` at the non-repaint landing), which is what makes its
     absence a road fact rather than a missing field. */
  if (!repaint || typeof repaint !== "object") return { measured: false, why: "not-repainted" };

  const references = Array.isArray(repaint.references) ? repaint.references : [];
  const referenceSlots = references
    .map((reference: any) => (typeof reference?.slot === "string" ? reference.slot : null))
    .filter((slot: string | null): slot is string => slot !== null);

  const edited = names(repaint.edited);
  const carried = names(repaint.carried);
  const vacated = names(repaint.vacated);

  /* THE UNION, not the sum. A slot can be both carried and named on a
     reference, and adding those would count one crop twice — which is the
     direction that flatters the ratio this reading exists to test. */
  const slots = [...new Set([...referenceSlots, ...edited, ...carried])].sort();
  return { measured: true, slots, edited, carried, vacated, references: references.length };
}

export function callsOf(internalPrompt: unknown): CallReading {
  const prompt = readJson(internalPrompt);
  if (!prompt) return { measured: false, why: "no-internal-prompt" };
  const census = prompt.census;
  if (!census || typeof census !== "object") return { measured: false, why: "no-census" };
  const stage = (name: string): number => {
    const bucket = census.byStage?.[name];
    return typeof bucket?.calls === "number" ? bucket.calls : 0;
  };
  const total = typeof census.total?.calls === "number" ? census.total.calls : 0;
  return { measured: true, segment: stage("segment"), read: stage("read"), render: stage("render"), total };
}

/* ---------------------------------------------------------------- controls */

function runControls(): void {
  const failures: string[] = [];

  /* POSITIVE — three distinct slots across four references (one repeated, so
     the union is exercised rather than the length), seven segment calls. */
  const positive = {
    repaint: {
      references: [
        { slot: "hair" }, { slot: "eye@left" }, { slot: "eye@left" }, { slot: null },
      ],
      edited: ["eye@left"],
      carried: ["hair", "earring@right"],
      vacated: [],
    },
    census: { byStage: { segment: { calls: 7 }, read: { calls: 9 }, render: { calls: 1 } }, total: { calls: 17 } },
  };
  const positiveSlots = slotsOf(positive);
  const positiveCalls = callsOf(positive);
  if (!positiveSlots.measured || positiveSlots.slots.length !== 3) {
    failures.push(`POSITIVE slots: expected 3, got ${positiveSlots.measured ? positiveSlots.slots.length : "unmeasured"}`);
  }
  if (!positiveCalls.measured || positiveCalls.segment !== 7 || positiveCalls.read !== 9) {
    failures.push(`POSITIVE calls: expected segment 7 / read 9, got ${JSON.stringify(positiveCalls)}`);
  }

  /* NEGATIVE — the two absences that must never read as zero. */
  const noRepaint = slotsOf({ census: { byStage: { segment: { calls: 4 } }, total: { calls: 4 } } });
  if (noRepaint.measured || noRepaint.why !== "not-repainted") {
    failures.push(`NEGATIVE not-repainted: expected unmeasurable, got ${JSON.stringify(noRepaint)}`);
  }
  const noCensus = callsOf({ repaint: { references: [{ slot: "hair" }], edited: [], carried: [], vacated: [] } });
  if (noCensus.measured || noCensus.why !== "no-census") {
    failures.push(`NEGATIVE no-census: expected NOT MEASURED, got ${JSON.stringify(noCensus)}`);
  }
  const noPrompt = slotsOf(null);
  if (noPrompt.measured || noPrompt.why !== "no-internal-prompt") {
    failures.push(`NEGATIVE no-internal-prompt: expected unmeasurable, got ${JSON.stringify(noPrompt)}`);
  }

  console.log("CONTROLS");
  console.log(`  POSITIVE  3 slots from 4 references (one repeated) + 7 segment / 9 read   ${failures.some((f) => f.startsWith("POSITIVE")) ? "FAIL" : "pass"}`);
  console.log(`  NEGATIVE  no repaint → UNMEASURABLE · no census → NOT MEASURED · no row → UNMEASURABLE   ${failures.some((f) => f.startsWith("NEGATIVE")) ? "FAIL" : "pass"}`);
  if (failures.length > 0) {
    console.error("\nCONTROL FAILURE — no verdict below this line counts:");
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("");
}

/* -------------------------------------------------------------------- main */

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

runControls();

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) throw new Error("no database URL");

const sinceRaw = arg("since") ?? "2026-08-07T00:00:00Z";
const since = new Date(sinceRaw);
if (Number.isNaN(since.getTime())) { console.error(`--since is not a date: ${sinceRaw}`); process.exit(1); }
const userId = arg("user");

console.log(`world   ${worldOf(databaseUrl)}`);
console.log(`window  since ${since.toISOString()}${userId ? ` · user ${userId}` : " · all users"}`);
console.log("");

const db = await openDatabase(databaseUrl);
const [rows] = await db.query<any[]>(
  `SELECT id, userId, createdAt, internalPrompt
     FROM casting_candidate_variants
    WHERE createdAt >= ?
      ${userId ? "AND userId = ?" : ""}
    ORDER BY createdAt`,
  userId ? [since, Number(userId)] : [since],
);
await db.end();

/* ------------------------------------------------------ THE RE-RUN TRIGGER
   `--coverage` is the one-line shift-OPEN check named in POST_SIGN_ROADMAP §1
   (ruled fable-835 §3). It lives in THIS script rather than in a second one so
   the trigger cannot drift from the instrument that answers it (law 4).

   The bar counts ROWS, not calls: the open question is whether reads scale with
   slots, so the unit that has to accumulate is the render — 25 rows is what
   puts more than n=1 or n=2 in each slot-count cell, which is exactly what made
   production unquotable at the first reading. */
const COVERAGE_BAR_ROWS = 25;
if (process.argv.includes("--coverage")) {
  let qualifying = 0;
  for (const row of rows as Row[]) {
    if (!slotsOf(row.internalPrompt).measured) continue;
    const census = readJson(row.internalPrompt)?.census;
    if (!census || typeof census !== "object") continue;
    const labelled = Object.keys(census.byAbout ?? {})
      .some((about) => /^(interpret|reask\.|verify|caption|describe|classify|gate)/.test(about));
    if (labelled) qualifying += 1;
  }
  const fires = qualifying >= COVERAGE_BAR_ROWS;
  console.log(
    `READ-BUDGET RE-RUN TRIGGER — ${qualifying}/${COVERAGE_BAR_ROWS} censused-with-purpose `
    + `repainted rows in ${worldOf(databaseUrl)} → ${fires ? "FIRES — re-run the reading" : "HOLDS"}`,
  );
  process.exit(0);
}

/* THE QUERY'S OWN CONTROL (doctrine entry 6, the query half): a population of
   zero is reported as a population of zero, and the reason it could not be a
   broken question is that the same table answered the row count first. */
console.log(`POPULATION — ${rows.length} variant rows in the window`);
if (rows.length === 0) {
  console.log("  no rows: nothing to measure. This is a real zero only if the window is right.");
  process.exit(0);
}

type Measured = { id: number; when: string; user: number; slots: string[]; calls: CallReading; pointed: boolean };
const measured: Measured[] = [];
const unmeasurable = new Map<string, number>();

for (const row of rows as Row[]) {
  const slots = slotsOf(row.internalPrompt);
  if (!slots.measured) {
    unmeasurable.set(slots.why, (unmeasurable.get(slots.why) ?? 0) + 1);
    continue;
  }
  const prompt = readJson(row.internalPrompt);
  measured.push({
    id: row.id,
    when: utc(row.createdAt),
    user: Number(row.userId ?? 0),
    slots: slots.slots,
    calls: callsOf(row.internalPrompt),
    /* THE ASK CLASS, taken from a field the row already carries (fable-834 §1
       — split if cheap, do not build a classifier). `askScope` is present on a
       POINTED ask and absent on a typed one, and its presence is documented as
       the mark of one. */
    pointed: typeof prompt?.askScope === "string" && prompt.askScope.length > 0,
  });
}

console.log(`  repainted rows (measurable)   ${measured.length}`);
for (const [why, count] of [...unmeasurable].sort((a, b) => b[1] - a[1])) {
  console.log(`  UNMEASURABLE · ${why.padEnd(20)} ${count}`);
}
console.log(`  coverage: ${measured.length}/${rows.length} rows carry a repaint record`);
console.log("");

if (measured.length === 0) {
  console.log("No repainted rows in this window — the reading is UNAVAILABLE, not zero.");
  process.exit(0);
}

/* --------------------------------------------- the distribution, not a mean */

const histogram = (values: number[]): string[] => {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, count]) => `    ${String(value).padStart(3)} slots   n=${String(count).padStart(3)}  ${"█".repeat(Math.min(count, 60))}`);
};

const slotCounts = measured.map((entry) => entry.slots.length);
console.log(`SLOTS PER RENDER — distribution over n=${measured.length} repainted rows`);
for (const line of histogram(slotCounts)) console.log(line);
const sorted = [...slotCounts].sort((a, b) => a - b);
const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
console.log(`    min ${sorted[0]} · median ${at(0.5)} · p90 ${at(0.9)} · max ${sorted[sorted.length - 1]}`);
console.log("");

/* ------------------------------------------------ reads against those slots */

const withCalls = measured.filter((entry) => entry.calls.measured);
console.log(`READS PER SLOT — n=${withCalls.length} of ${measured.length} repainted rows carry a census`);
console.log(`  coverage: ${withCalls.length}/${measured.length}; the rest print NOT MEASURED and are excluded, never zeroed`);
if (withCalls.length > 0) {
  console.log("");
  console.log("   slots   n   segment/render   read/render   (segment+read)/slot");
  const bySlots = new Map<number, Measured[]>();
  for (const entry of withCalls) {
    const key = entry.slots.length;
    bySlots.set(key, [...(bySlots.get(key) ?? []), entry]);
  }
  for (const [count, entries] of [...bySlots.entries()].sort((a, b) => a[0] - b[0])) {
    const segment = entries.reduce((sum, e) => sum + (e.calls.measured ? e.calls.segment : 0), 0) / entries.length;
    const read = entries.reduce((sum, e) => sum + (e.calls.measured ? e.calls.read : 0), 0) / entries.length;
    const perSlot = count === 0 ? NaN : (segment + read) / count;
    console.log(
      `   ${String(count).padStart(5)}   ${String(entries.length).padStart(3)}`
      + `   ${segment.toFixed(1).padStart(12)}   ${read.toFixed(1).padStart(11)}`
      + `   ${Number.isNaN(perSlot) ? "  n/a" : perSlot.toFixed(2).padStart(19)}`,
    );
  }
}
console.log("");

/* --------------------------------------------------------- by the ask class */

const pointed = measured.filter((entry) => entry.pointed);
const typed = measured.filter((entry) => !entry.pointed);
console.log("BY ASK CLASS — `askScope` present = she pointed at a rectangle");
for (const [label, group] of [["pointed", pointed], ["typed  ", typed]] as const) {
  if (group.length === 0) { console.log(`  ${label}  n=0 — no rows of this class in the window`); continue; }
  const counts = group.map((entry) => entry.slots.length).sort((a, b) => a - b);
  console.log(
    `  ${label}  n=${String(group.length).padStart(3)}`
    + `   slots min ${counts[0]} · median ${counts[Math.floor(counts.length / 2)]} · max ${counts[counts.length - 1]}`,
  );
}
console.log("");

/* ------------------------------ WHY the read stage is the shape it is ------
   The flatness of `read/render` against slot count is the headline, and a flat
   line can be MANUFACTURED by truncation: `censusSoFar` snapshots at the
   landing, so if reads were still arriving afterwards every row would be
   clipped at a similar place and the flatness would be the clip rather than the
   product. So the mechanism is named rather than inferred — a read stage whose
   purposes are per-RENDER (`interpret`, `verify`, `caption`) is flat because of
   what it buys, while one full of per-slot purposes and flat anyway is a
   truncation artifact and this reading would be withdrawn.

   Reads carry `about` from the closed `ReadPurpose` list, and the coverage line
   below is doctrine entry 2: an absent label reads as complete attribution. */
const readPurposes = new Map<string, number>();
let labelledReads = 0;
let totalReads = 0;
const readsPerRow: number[] = [];
for (const row of rows as Row[]) {
  const prompt = readJson(row.internalPrompt);
  const census = prompt?.census;
  if (!census || typeof census !== "object") continue;
  const stageCalls = typeof census.byStage?.read?.calls === "number" ? census.byStage.read.calls : 0;
  if (slotsOf(row.internalPrompt).measured) readsPerRow.push(stageCalls);
  totalReads += stageCalls;
  for (const [about, bucket] of Object.entries(census.byAbout ?? {})) {
    /* Only the read stage's own vocabulary — region nouns belong to segment. */
    if (!/^(interpret|reask\.|verify|caption|describe|classify|gate)/.test(about)) continue;
    const calls = typeof (bucket as any)?.calls === "number" ? (bucket as any).calls : 0;
    readPurposes.set(about, (readPurposes.get(about) ?? 0) + calls);
    labelledReads += calls;
  }
}
console.log(`WHY THE READS — read-stage purposes, ${labelledReads}/${totalReads} read calls carry a purpose label`);
if (labelledReads === 0) {
  console.log("  NOT MEASURED — no read call in this window carries a purpose. The");
  console.log("  flatness claim is UNSUPPORTED by mechanism here and rests on the");
  console.log("  distribution alone; say so rather than asserting the cause.");
} else {
  for (const [purpose, calls] of [...readPurposes.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${purpose.padEnd(20)} ${String(calls).padStart(4)}  ${((calls / labelledReads) * 100).toFixed(0)}% of labelled reads`);
  }
}
if (readsPerRow.length > 0) {
  const sortedReads = [...readsPerRow].sort((a, b) => a - b);
  console.log(`  read calls per repainted row: min ${sortedReads[0]} · median ${sortedReads[Math.floor(sortedReads.length / 2)]} · max ${sortedReads[sortedReads.length - 1]} (n=${sortedReads.length})`);
  console.log("  a hard ceiling repeated across rows would be the truncation tell.");
}
console.log("");

/* ------------------------------------------------------- which slots, named */

const slotFrequency = new Map<string, number>();
for (const entry of measured) for (const slot of entry.slots) slotFrequency.set(slot, (slotFrequency.get(slot) ?? 0) + 1);
console.log(`WHICH SLOTS — over n=${measured.length} repainted rows (closed vocabulary; no sentence appears here)`);
for (const [slot, count] of [...slotFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  console.log(`  ${slot.padEnd(28)} ${String(count).padStart(4)}  ${((count / measured.length) * 100).toFixed(0)}% of renders`);
}

/* A SCRIPT ENDS BY ENDING THE PROCESS (`scriptExitDiscipline.test.ts`). The
   database handle above is closed, but the rule is on the entrypoint and not
   on what it happens to open — and this script reddened that suite before the
   line existed, which is the rule earning itself again. */
process.exit(0);
