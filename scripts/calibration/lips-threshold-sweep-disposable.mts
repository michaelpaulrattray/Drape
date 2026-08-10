/* Calibrating the gloss instrument on CONTROL specimens only — master (bare)
   against the glossy family — before any arm exists to fit it to.

   WITHDRAWN 2026-08-10, shift 23, and this is the ROOT of the class rather than
   another instance of it. `glossy: true` below labels thirteen frames as the
   positive class because each was SENT a gloss crop. That is a label taken from
   the INPUT, not from the delivered pixels — it assumes the very thing the
   instrument was built to test. Fitting a threshold to it cannot fail to
   confirm it.

   What the label was worth, measured afterwards: three paints of one identical
   prompt spread 0.67pp on this measure, wider than the gap between any two
   groups here; and the measure reads gloss-STRUCK frames above the gloss-ASKED
   frame, so it fails its own positive control by SIGN. The +50 choice this
   script selected is therefore unearned in the nude region. It survives only
   where the specimens are extreme and outcome-verified — a maximal wet ask at
   3.60% and a matte control at 0.26%.

   THE CLASS, for the sweep: a control class defined by what was ASKED FOR or
   SENT rather than by what was DELIVERED. Any instrument fitted to such a class
   inherits the assumption it was meant to test. A positive control must be
   labelled by a verified outcome — which in practice means an extreme ask that
   the measure can be seen to order — or it is not a control.

   See glossy-family-sweep-disposable.mts for the reading. Kept, not deleted:
   the numbers it prints are still the numbers, and re-running it against an
   outcome-labelled class is the natural next use. */
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { loadMaskFile } from "../lib/shapeOnFace.mts";

const specs = [
  { label: "master", frame: "output/edit-law/master.png", mask: "output/edit-law/reads/master--lips.png", glossy: false },
  ...[1, 2, 3].map((i) => ({ label: `cell2g-${i}`, frame: `output/cprime/cell2g-${i}.png`, mask: `output/cprime/reads/cell2g-${i}--lips.png`, glossy: true })),
  ...[1, 2, 3, 4, 5].map((i) => ({ label: `gpt2-crop-${i}`, frame: `output/accessory-cell/gpt2-crop-${i}.png`, mask: `output/accessory-cell/reads/gpt2-crop-${i}--lips.png`, glossy: true })),
  ...[1, 2, 3, 4, 5].map((i) => ({ label: `gpt2-cutout-${i}`, frame: `output/accessory-cell/gpt2-cutout-${i}.png`, mask: `output/accessory-cell/reads/gpt2-cutout-${i}--lips.png`, glossy: true })),
];

const THRESHOLDS = [20, 35, 50, 65, 80];
const rows: { label: string; glossy: boolean; values: number[]; p95: number }[] = [];
for (const spec of specs) {
  const mask = await loadMaskFile(spec.mask);
  if (!mask) { console.log(`${spec.label}: no mask`); continue; }
  const { data, info } = await sharp(await readFile(spec.frame)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== mask.width) { console.log(`${spec.label}: size mismatch`); continue; }
  const lum: number[] = [];
  for (let i = 0; i < mask.data.length; i += 1) {
    if (mask.data[i] === 0) continue;
    lum.push(0.2126 * data[i * 3]! + 0.7152 * data[i * 3 + 1]! + 0.0722 * data[i * 3 + 2]!);
  }
  const sorted = [...lum].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  rows.push({
    label: spec.label, glossy: spec.glossy,
    values: THRESHOLDS.map((t) => lum.filter((v) => v > median + t).length / lum.length),
    p95: sorted[Math.floor(sorted.length * 0.95)]! / median,
  });
}

console.log("\n  frame".padEnd(18) + THRESHOLDS.map((t) => `+${t}`.padStart(9)).join("") + "   p95/med");
for (const row of rows) {
  console.log(`  ${row.label.padEnd(16)}` + row.values.map((v) => `${(v * 100).toFixed(2)}%`.padStart(9)).join("") + `   ${row.p95.toFixed(3)}`);
}

const bare = rows.find((r) => !r.glossy)!;
const glossy = rows.filter((r) => r.glossy);
console.log("\n  SEPARATION — gap between the bare master and the LOWEST glossy frame, over the family's own spread");
console.log("  threshold".padEnd(14) + "bare".padStart(9) + "glossy lo".padStart(11) + "glossy hi".padStart(11) + "gap".padStart(9) + "gap/spread".padStart(12));
THRESHOLDS.forEach((t, i) => {
  const values = glossy.map((r) => r.values[i]!);
  const lo = Math.min(...values); const hi = Math.max(...values);
  const gap = lo - bare.values[i]!;
  console.log(`  +${String(t).padEnd(12)}` + `${(bare.values[i]! * 100).toFixed(2)}%`.padStart(9)
    + `${(lo * 100).toFixed(2)}%`.padStart(11) + `${(hi * 100).toFixed(2)}%`.padStart(11)
    + `${(gap * 100).toFixed(2)}%`.padStart(9) + (hi - lo === 0 ? "—" : (gap / (hi - lo)).toFixed(2)).padStart(12));
});
const p95bare = bare.p95; const p95lo = Math.min(...glossy.map((r) => r.p95)); const p95hi = Math.max(...glossy.map((r) => r.p95));
console.log(`\n  p95/median    bare ${p95bare.toFixed(3)}   glossy ${p95lo.toFixed(3)}–${p95hi.toFixed(3)}   gap ${(p95lo - p95bare).toFixed(3)}`);
process.exit(0);
