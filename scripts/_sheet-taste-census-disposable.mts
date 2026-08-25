/**
 * DISPOSABLE — **the axis census, run through the SHEET TASTE PASS this time.**
 * Free: pure functions, no network, no database, no spend.
 *
 * WHY A SECOND CENSUS. The first one (`_axis-draw-census-disposable.mts`) drove
 * `resolveCandidateIdentity` alone and found the draw healthy: facial hair's
 * marginal matched its declared weights to a tenth of a point, and a sheet where
 * ONE value took 5 or more of the 8 happened in **0 of 2000** sheets.
 *
 * His roll #216 has `FACIAL HAIR: short beard` on **5 of 8**.
 *
 * A finding that a real sheet is impossible under the model means the MODEL is
 * missing a step, not that the sheet is a miracle. The missing step is
 * `applySheetTaste` — the compiler resolves eight identities and then runs a
 * sheet-level pass over them, and that pass RE-PICKS facial hair whenever a
 * candidate's beard BUCKET is already present among its neighbours.
 *
 * So this drives BOTH steps, exactly as `briefCompiler.ts` does, and reports
 * the same two questions before and after the pass. The difference between the
 * two columns is the pass's own contribution, which is the thing nobody has
 * ever measured.
 *
 *   npx tsx scripts/_sheet-taste-census-disposable.mts --sheets=2000
 */
import "dotenv/config";

import { resolveCandidateIdentity } from "../server/castingV2/cohortPhotorealHuman";
import { applySheetTaste } from "../server/castingV2/realizedAxes";
import { EMPTY_STATED_SKIN } from "../server/castingV2/castingIntent";
import { HAIR_PARTS } from "../shared/castingRealization";

const SHEETS = Number(process.argv.find((a) => a.startsWith("--sheets="))?.slice(9) ?? 2000);
const PER_SHEET = 8;
/*
  `--authored` runs the ORDINARY case instead of his: a brief that states no
  hair, so the sheet may author every part and the beard rule compares only
  against SAME-FAMILY neighbours. It answers the question his sheet cannot —
  whether the pass's effect on facial hair is a property of stated-hair briefs
  or of every sheet in the product.
*/
const AUTHORED = process.argv.includes("--authored");

/*
  HIS ROLL #216's SHAPE, read off production rather than invented: male, 40s,
  energy locked to "grave", build/heritage/hair/look/role all open,
  `poolTendencies` all null (confirmed at the rows for rolls 206-216).

  `BALD` is the one that matters here: his brief states the hair, so the
  compiler hands the taste pass an EMPTY authored-parts set — and with
  `authorsCut` false the beard rule compares against EVERY nearby candidate
  rather than only same-family ones.
*/
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

type Cell = { before: string[]; after: string[] };
const sheets: Cell[] = [];

for (let s = 0; s < SHEETS; s += 1) {
  const rollSeed = `taste-census-${s}`;
  const resolved = Array.from({ length: PER_SHEET }, (_, position) =>
    resolveCandidateIdentity(intent, position, rollSeed) as any);
  const before = resolved.map((r) => String(r.realized?.facialHair ?? "null"));
  /*
    THE COMPILER'S OWN CALL SHAPE. A brief that states the hair produces an
    EMPTY authored-parts set (`briefCompiler.ts`: every part the deference does
    not cover, and "Bald." covers them), and it did not state facial hair.
  */
  const tasted = applySheetTaste(resolved, rollSeed, {
    statedFacialHair: false,
    authoredParts: AUTHORED ? new Set(HAIR_PARTS) : new Set(),
  }) as any[];
  const after = tasted.map((r) => String(r.realized?.facialHair ?? "null"));
  sheets.push({ before, after });
}

const report = (label: string, pick: (c: Cell) => string[]) => {
  const marginal = new Map<string, number>();
  const distinct: number[] = [];
  let dominated = 0;
  let fiveOfEight = 0;
  for (const sheet of sheets) {
    const values = pick(sheet);
    const counts = new Map<string, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
      marginal.set(v, (marginal.get(v) ?? 0) + 1);
    }
    distinct.push(counts.size);
    const top = Math.max(...counts.values());
    if (top >= 5) { dominated += 1; fiveOfEight += 1; }
  }
  const total = SHEETS * PER_SHEET;
  const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;
  console.log(`════ ${label} ════`);
  for (const [value, n] of [...marginal.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${value.padEnd(18)} ${String(n).padStart(6)}  ${pct(n, total)}`);
  }
  const hist = new Map<number, number>();
  for (const d of distinct) hist.set(d, (hist.get(d) ?? 0) + 1);
  console.log(`  distinct values in a sheet of ${PER_SHEET}: mean ${(distinct.reduce((a, b) => a + b, 0) / distinct.length).toFixed(2)}`);
  console.log(`    ${[...hist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${pct(v, SHEETS)}`).join("  ")}`);
  console.log(`  ONE value takes 5+ of ${PER_SHEET}: ${pct(fiveOfEight, SHEETS)}   ← his sheet is here\n`);
};

console.log(`SHEET TASTE CENSUS — ${SHEETS} sheets x ${PER_SHEET}, ${AUTHORED ? "an ORDINARY brief (hair unstated, every part authorable)" : "his roll #216's brief shape (hair STATED, nothing authorable)"}`);
console.log("facial hair, before and after the sheet-level taste pass\n");
report("BEFORE the taste pass (the weighted draw alone)", (c) => c.before);
report("AFTER the taste pass (what is actually composed into the prompt)", (c) => c.after);

const moved = sheets.reduce((n, c) => n + c.before.filter((v, i) => v !== c.after[i]).length, 0);
console.log(`the pass moved ${moved} of ${SHEETS * PER_SHEET} values (${((moved / (SHEETS * PER_SHEET)) * 100).toFixed(1)}%)`);

process.exit(0);
