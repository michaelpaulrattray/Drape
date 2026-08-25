/**
 * DISPOSABLE — **GRADING THE THREE FACIAL-HAIR REPAIRS, OFFLINE AND FREE**
 * (ordered fable-1670 §6, against the bar in
 * `docs/specs/CASTING_V2_YIELD_RULE_SWEEP.md` §4a).
 *
 * # The defect, measured
 *
 * `applySheetTaste`'s twin-breaker uses facial hair as its FALLBACK axis, reached
 * exactly when the hair rules stand down because the brief authored the hair.
 * When a candidate's beard BUCKET is already present nearby it flips to the OTHER
 * bucket and re-picks from that bucket's WEIGHTED pool — and for a man in his
 * 40s the `bearded` pool is ~47% `short beard`. So the pass whose job is to break
 * twins CONCENTRATES the axis:
 *
 *   short beard 17.0% → 27.4%   ·   distinct per sheet 5.27 → 4.98   ·   22.8% moved
 *
 * # ⚠ THE CONTROL THAT MAKES THIS AN INSTRUMENT RATHER THAN MY OPINION
 *
 * The three candidates cannot be measured through the real `applySheetTaste`
 * without editing the product, and fable-1668 puts shape changes with the
 * reviewer rather than in a build. So the beard rule is REPLICATED here — and a
 * replica of a rule is worth nothing until it is proven to BE the rule.
 *
 * **So the replica configured as TODAY must reproduce the real pass's output
 * EXACTLY — per sheet, per position, value for value, not merely in aggregate.**
 * That arm runs first and the script REFUSES to report any candidate if it fails.
 * A candidate graded on a replica that drifts from the product is a number that
 * describes nothing.
 *
 * # The three candidates (§4a)
 *
 *   UNIFORM   re-pick uniformly inside the target bucket. The bucket choice is
 *             already the taste decision; weighting inside it re-imposes the
 *             population prior the flip was overriding.
 *   EXCLUDE   drop values already on the sheet from the re-pick pool — which is
 *             what the STYLE rule one block up already does and this one
 *             conspicuously does not.
 *   CYCLE     rotate through the target bucket's members by position, the way
 *             `energy` does, with a per-roll offset.
 *
 * # The bar, stated before the numbers
 *
 *   1. distinct values per sheet must NOT fall below the raw draw's 5.27
 *   2. no single value may exceed its declared weight in the marginal
 *   3. the pass must still BREAK TWINS — the whole reason it exists — so the
 *      share of sheets carrying an adjacent same-bucket pair must not rise
 *      above today's
 *
 * ⚠ Rule 3 is the one that makes this honest. A "repair" that simply stops
 * re-picking scores perfectly on 1 and 2 and abandons the pass's purpose, so the
 * NULL candidate (never flip at all) is measured beside the three and is expected
 * to fail rule 3.
 *
 * Free: pure functions, no network, no database, no spend.
 */
import "dotenv/config";

import { resolveCandidateIdentity } from "../server/castingV2/cohortPhotorealHuman";
import { applySheetTaste } from "../server/castingV2/realizedAxes";
import { EMPTY_STATED_SKIN } from "../server/castingV2/castingIntent";
import { beardBucket, sameNeighbourhood } from "../server/castingV2/heritageNeighbourhoods";

const SHEETS = Number(process.argv.find((a) => a.startsWith("--sheets="))?.slice(9) ?? 2000);
const PER_SHEET = 8;

/* His roll #216's shape, read off production. */
const intent = {
  cohort: "photoreal_human",
  role: null,
  characterNotes: "Bald. Severe bone structure with pronounced brow ridge, deep-set eyes, hard jawline, gaunt cheeks.",
  sex: "male",
  ageBand: "40s",
  heritage: [],
  hair: null,
  build: null,
  energy: "grave",
  look: null,
  statedSkin: EMPTY_STATED_SKIN,
} as never;

/* Quoted from `realizedAxes.ts`. A hand copy of a product constant is this
   campaign's most-repeated defect, so the replica arm below is what proves it. */
const FACIAL_HAIR_40S: ReadonlyArray<readonly [string, number]> = [
  ["clean-shaven", 26], ["light stubble", 20], ["heavy stubble", 18],
  ["short beard", 17], ["full beard", 10], ["goatee", 5], ["moustache", 4],
];
const DECLARED = new Map(FACIAL_HAIR_40S);
const DECLARED_TOTAL = FACIAL_HAIR_40S.reduce((sum, [, w]) => sum + w, 0);

function hash(seed: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value >>> 0;
}
function weightedPick(entries: ReadonlyArray<readonly [string, number]>, seed: number): string {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = seed % total;
  for (const [value, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return value;
  }
  return entries[entries.length - 1]![0];
}

type Strategy = "today" | "uniform" | "exclude" | "cycle" | "never";

/**
 * The beard half of `applySheetTaste`, replicated. Everything outside the
 * re-pick is copied from the product; only the marked line differs per strategy.
 */
function beardPass(before: readonly string[], rollSeed: string, strategy: Strategy): string[] {
  const out: string[] = [];
  const placed: Array<{ heritage: string; beard: string | null }> = [];
  for (let position = 0; position < before.length; position += 1) {
    let facialHair = before[position]!;
    const primary = "";
    /* `authorsCut` is FALSE on a stated-hair brief, so the family filter does not
       apply and every nearby candidate counts — the product's own branch. */
    const nearby = placed.filter((entry) => sameNeighbourhood(entry.heritage, primary));
    const beardsHere = new Set(nearby.map((e) => e.beard).filter((b): b is string => b !== null));
    const mine = beardBucket(facialHair as never);
    if (mine !== null && beardsHere.has(mine) && strategy !== "never") {
      const wanted = mine === "bearded" ? "bare" : "bearded";
      const pool = FACIAL_HAIR_40S.filter(([value]) => beardBucket(value as never) === wanted);
      if (pool.length > 0) {
        const seed = hash(`${rollSeed}:facialHairTaste:${position}`);
        /* ── THE ONLY LINE THAT DIFFERS BETWEEN STRATEGIES ── */
        if (strategy === "today") {
          facialHair = weightedPick(pool, seed);
        } else if (strategy === "uniform") {
          facialHair = pool[seed % pool.length]![0];
        } else if (strategy === "exclude") {
          const fresh = pool.filter(([value]) => !out.includes(value));
          facialHair = weightedPick(fresh.length > 0 ? fresh : pool, seed);
        } else if (strategy === "cycle") {
          const offset = hash(`${rollSeed}:beardCycle`) % pool.length;
          facialHair = pool[(position + offset) % pool.length]![0];
        }
      }
    }
    placed.push({ heritage: primary, beard: beardBucket(facialHair as never) });
    out.push(facialHair);
  }
  return out;
}

/* ─── THE POPULATION ─── */

type Sheet = { seed: string; before: string[]; real: string[] };
const sheets: Sheet[] = [];
for (let s = 0; s < SHEETS; s += 1) {
  const rollSeed = `taste-census-${s}`;
  const resolved = Array.from({ length: PER_SHEET }, (_, position) =>
    resolveCandidateIdentity(intent, position, rollSeed) as any);
  const before = resolved.map((r) => String(r.realized?.facialHair ?? "null"));
  const tasted = applySheetTaste(resolved, rollSeed, {
    statedFacialHair: false, authoredParts: new Set(),
  }) as any[];
  sheets.push({ seed: rollSeed, before, real: tasted.map((r) => String(r.realized?.facialHair ?? "null")) });
}

/* ─── ⚠ THE REPLICA ARM. Nothing is reported unless this passes. ─── */

let mismatched = 0;
const firstMismatch: string[] = [];
for (const sheet of sheets) {
  const replica = beardPass(sheet.before, sheet.seed, "today");
  if (replica.join("|") !== sheet.real.join("|")) {
    mismatched += 1;
    if (firstMismatch.length === 0) {
      firstMismatch.push(`  seed ${sheet.seed}`, `  before  ${sheet.before.join(", ")}`,
        `  real    ${sheet.real.join(", ")}`, `  replica ${replica.join(", ")}`);
    }
  }
}
console.log(`THE BEARD REPAIR GRADING — ${SHEETS} sheets x ${PER_SHEET}, his roll #216's brief shape\n`);
console.log(`⚠ REPLICA ARM: the replica configured as TODAY against the REAL applySheetTaste`);
console.log(`   ${SHEETS - mismatched}/${SHEETS} sheets identical, value for value\n`);
if (mismatched > 0) {
  console.log(firstMismatch.join("\n"));
  console.log("\nREFUSING to grade any candidate — the replica is not the rule, so every number");
  console.log("below it would describe a thing the product does not do.");
  process.exit(1);
}

/* ─── THE READINGS ─── */

const read = (label: string, pick: (sheet: Sheet) => string[]) => {
  const marginal = new Map<string, number>();
  const distinct: number[] = [];
  let adjacentTwins = 0;
  let moved = 0;
  for (const sheet of sheets) {
    const values = pick(sheet);
    for (const v of values) marginal.set(v, (marginal.get(v) ?? 0) + 1);
    distinct.push(new Set(values).size);
    moved += values.filter((v, i) => v !== sheet.before[i]).length;
    /* THE PASS'S OWN PURPOSE: a neighbouring pair sharing a beard bucket. */
    for (let i = 1; i < values.length; i += 1) {
      if (beardBucket(values[i] as never) === beardBucket(values[i - 1] as never)) { adjacentTwins += 1; break; }
    }
  }
  const total = SHEETS * PER_SHEET;
  const meanDistinct = distinct.reduce((a, b) => a + b, 0) / distinct.length;
  const overweight = [...marginal.entries()]
    .filter(([value, n]) => (n / total) * 100 > ((DECLARED.get(value) ?? 0) / DECLARED_TOTAL) * 100 + 0.5)
    .map(([value, n]) => `${value} ${(n / total * 100).toFixed(1)}% vs ${((DECLARED.get(value) ?? 0) / DECLARED_TOTAL * 100).toFixed(1)}%`);
  return {
    label, meanDistinct, movedPct: (moved / total) * 100,
    twinPct: (adjacentTwins / SHEETS) * 100, overweight,
    top: [...marginal.entries()].sort((a, b) => b[1] - a[1])[0]!,
    total,
  };
};

const rows = [
  read("RAW DRAW (no pass)", (s) => s.before),
  read("TODAY", (s) => s.real),
  read("never flip", (s) => beardPass(s.before, s.seed, "never")),
  read("UNIFORM", (s) => beardPass(s.before, s.seed, "uniform")),
  read("EXCLUDE", (s) => beardPass(s.before, s.seed, "exclude")),
  read("CYCLE", (s) => beardPass(s.before, s.seed, "cycle")),
];

const floor = rows[0]!.meanDistinct;
const todayTwins = rows[1]!.twinPct;
console.log(`THE BAR:  distinct/sheet must not fall below the raw draw's ${floor.toFixed(2)}`);
console.log(`          no value above its declared weight`);
console.log(`          adjacent same-bucket pairs must not rise above TODAY's ${todayTwins.toFixed(1)}%\n`);
console.log(`${"".padEnd(20)}${"distinct".padStart(9)}${"moved".padStart(9)}${"twin pair".padStart(11)}   top value        overweight`);
for (const row of rows) {
  const pass = row.label === "RAW DRAW (no pass)" || row.label === "TODAY"
    ? ""
    : (row.meanDistinct >= floor && row.overweight.length === 0 && row.twinPct <= todayTwins ? "  ✅" : "  ❌");
  console.log(
    `${row.label.padEnd(20)}${row.meanDistinct.toFixed(2).padStart(9)}${`${row.movedPct.toFixed(1)}%`.padStart(9)}`
    + `${`${row.twinPct.toFixed(1)}%`.padStart(11)}   ${`${row.top[0]} ${(row.top[1] / row.total * 100).toFixed(1)}%`.padEnd(17)}`
    + `${row.overweight.length === 0 ? "none" : row.overweight.join("; ")}${pass}`,
  );
}
console.log("\n⚠ `never flip` is the NULL CANDIDATE and it is here to fail rule 3. A repair that");
console.log("  scores well by abandoning the pass's purpose is not a repair.");
console.log("⚠ NOTHING IS BUILT. These are numbers for a shape decision that belongs to the");
console.log("  reviewer (fable-1668), and any winner still needs the ordinary-population arm.");

process.exit(0);
