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
function beardPass(
  before: readonly string[],
  heritages: readonly string[],
  rollSeed: string,
  strategy: Strategy,
): string[] {
  const out: string[] = [];
  const placed: Array<{ heritage: string; beard: string | null }> = [];
  for (let position = 0; position < before.length; position += 1) {
    let facialHair = before[position]!;
    /*
      ⚠ THE FIRST REPLICA HARD-CODED THIS TO "" AND MATCHED 0 OF 2000 SHEETS.

      `intent.heritage` is EMPTY on this brief, and the first model read that as
      "every candidate has no heritage". It does not: the RESOLVER draws one per
      candidate, so `neighbours(primary)` returns only the previously-placed
      candidates in the SAME neighbourhood — and the rule therefore fires far
      less often on a heritage-VARIED sheet than on a locked one.

      Found by DRIVING the real function on hand-built sheets
      (`_beard-rule-probe-disposable.mts`) rather than by reading it again: four
      identical bare values with one heritage came back `.***`, which is exactly
      what the first replica predicted — so the rule was never wrong, the INPUT
      was. Three readings of the code had already eliminated the wrong suspects.
    */
    const primary = heritages[position] ?? "";
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

type Sheet = { seed: string; before: string[]; heritages: string[]; real: string[] };
const sheets: Sheet[] = [];
for (let s = 0; s < SHEETS; s += 1) {
  const rollSeed = `taste-census-${s}`;
  const resolved = Array.from({ length: PER_SHEET }, (_, position) =>
    resolveCandidateIdentity(intent, position, rollSeed) as any);
  const before = resolved.map((r) => String(r.realized?.facialHair ?? "null"));
  const heritages = resolved.map((r) => String(r.heritage?.[0]?.heritage ?? ""));
  const tasted = applySheetTaste(resolved, rollSeed, {
    statedFacialHair: false, authoredParts: new Set(),
  }) as any[];
  sheets.push({ seed: rollSeed, before, heritages, real: tasted.map((r) => String(r.realized?.facialHair ?? "null")) });
}

/* ─── ⚠ THE REPLICA ARM. Nothing is reported unless this passes. ─── */

let mismatched = 0;
const firstMismatch: string[] = [];
for (const sheet of sheets) {
  const replica = beardPass(sheet.before, sheet.heritages, sheet.seed, "today");
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
    /*
      THE PASS'S OWN PURPOSE: neighbouring pairs sharing a beard bucket.

      ⚠ COUNTED, NOT FLAGGED — and the first version flagged. It asked whether a
      sheet held AT LEAST ONE such pair, which with eight candidates over TWO
      buckets is ~100% for every strategy including the null one. A measure that
      returns 99.9% on all five arms discriminates nothing, and the bar written
      on it was theatre.
    */
    for (let i = 1; i < values.length; i += 1) {
      if (beardBucket(values[i] as never) === beardBucket(values[i - 1] as never)) adjacentTwins += 1;
    }
  }
  const total = SHEETS * PER_SHEET;
  const meanDistinct = distinct.reduce((a, b) => a + b, 0) / distinct.length;
  /*
    ⚠ TOTAL DISTORTION, NOT "ANY VALUE OVER ITS WEIGHT" — and the first version
    used the second. Every flip moves mass from one bucket to the other BY
    DESIGN, so *no value above its declared weight* is satisfiable only by never
    flipping: it failed TODAY and all three candidates, and passed only the
    amputation. **A bar that only the null candidate can clear is not a bar.**

    What discriminates is the SIZE of the distortion — the sum of
    |actual − declared| across the vocabulary — read against TODAY's rather than
    against zero.
  */
  const distortion = [...DECLARED.entries()].reduce((sum, [value, weight]) => {
    const actual = ((marginal.get(value) ?? 0) / total) * 100;
    return sum + Math.abs(actual - (weight / DECLARED_TOTAL) * 100);
  }, 0);
  return {
    label, meanDistinct, movedPct: (moved / total) * 100,
    twinsPerSheet: adjacentTwins / SHEETS, distortion,
    top: [...marginal.entries()].sort((a, b) => b[1] - a[1])[0]!,
    total,
  };
};

const rows = [
  read("RAW DRAW (no pass)", (s) => s.before),
  read("TODAY", (s) => s.real),
  read("never flip", (s) => beardPass(s.before, s.heritages, s.seed, "never")),
  read("UNIFORM", (s) => beardPass(s.before, s.heritages, s.seed, "uniform")),
  read("EXCLUDE", (s) => beardPass(s.before, s.heritages, s.seed, "exclude")),
  read("CYCLE", (s) => beardPass(s.before, s.heritages, s.seed, "cycle")),
];

const floor = rows[0]!.meanDistinct;
const today = rows[1]!;
console.log("THE BAR — ⚠ CORRECTED BY THIS RUN. Two of the three I proposed in the yield");
console.log("  sweep were degenerate, and the run is what showed it (see the reader's notes):");
console.log(`  1  distinct/sheet must reach the RAW DRAW's ${floor.toFixed(2)}`);
console.log(`  2  total marginal distortion must not EXCEED today's ${today.distortion.toFixed(1)} points`);
console.log(`  3  adjacent same-bucket PAIRS PER SHEET must not exceed today's ${today.twinsPerSheet.toFixed(2)}\n`);
console.log(`${"".padEnd(20)}${"distinct".padStart(9)}${"moved".padStart(8)}${"twins/sheet".padStart(13)}${"distortion".padStart(12)}   top value`);
for (const row of rows) {
  const pass = row.label === "RAW DRAW (no pass)" || row.label === "TODAY"
    ? ""
    : (row.meanDistinct >= floor && row.distortion <= today.distortion && row.twinsPerSheet <= today.twinsPerSheet
      ? "  <== PASSES ALL THREE" : "");
  console.log(
    `${row.label.padEnd(20)}${row.meanDistinct.toFixed(2).padStart(9)}${`${row.movedPct.toFixed(1)}%`.padStart(8)}`
    + `${row.twinsPerSheet.toFixed(2).padStart(13)}${row.distortion.toFixed(1).padStart(12)}`
    + `   ${`${row.top[0]} ${(row.top[1] / row.total * 100).toFixed(1)}%`.padEnd(20)}${pass}`,
  );
}
console.log("\n⚠ `never flip` is the NULL CANDIDATE and rule 3 is the only thing that kills it:");
console.log("  4.17 adjacent same-bucket pairs against every flipping arm's 3.27. A repair that");
console.log("  scores well by abandoning the pass's purpose is not a repair.");
console.log("");
console.log("⚠ AND RULES 2 AND 3 CANNOT SEPARATE THE THREE CANDIDATES FROM EACH OTHER — read");
console.log("  the columns: all four flipping arms sit at exactly 3.27 twins and 31.4");
console.log("  distortion. That is not a coincidence and it should be understood before anyone");
console.log("  quotes those columns. Every strategy makes the SAME BUCKET decisions and differs");
console.log("  only in which value it picks INSIDE the target bucket — twins are counted by");
console.log("  bucket, so they cannot move; and the surplus mass lands on values that are all");
console.log("  already ABOVE their declared weight, so |actual - declared| sums to the same");
console.log("  total however that surplus is split.");
console.log("");
console.log("  So rules 2 and 3 are GUARDS — they prove no candidate makes anything worse — and");
console.log("  DISTINCT-PER-SHEET is the only measure that CHOOSES. On it: EXCLUDE at 5.30 is");
console.log("  the only arm that reaches the raw draw's 5.27; CYCLE 5.14 and UNIFORM 5.04 fall");
console.log("  short of it, and today is 4.98.");
console.log("⚠ NOTHING IS BUILT. These are numbers for a shape decision that belongs to the");
console.log("  reviewer (fable-1668), and any winner still needs the ordinary-population arm.");

process.exit(0);
