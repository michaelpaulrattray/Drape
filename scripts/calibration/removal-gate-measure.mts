/**
 * WHY THE COMPOSITE PUT THE GLASSES BACK — measured, not reasoned about.
 *
 * The painter removes (raw frames: 0.000% eyeglasses, both engines). The
 * production composite hands them back as a pale ghost. `explain` says the
 * vacancy is computed correctly — 1.366%, the frames' whole footprint — and that
 * what finally lands is ~1.1% at visibly partial strength. A partial alpha over
 * a vacancy IS a ghost: master frame blended with painted skin.
 *
 * The suspect is `harvestGate`. It narrows a claim by NOVELTY — how far the
 * painted pixel sits from the master, scaled against the painter's own global
 * drift (`quiet = 2×baseline`, `loud = 6×baseline`) — and below `keepAt` it
 * scales the alpha down rather than cutting it. That gate was calibrated to
 * suppress a veil of painter-forehead inside a hair silhouette. A removal's
 * vacancy is the opposite case: it is exactly the content we want, and the
 * painter's drift is high because these engines re-render the whole frame.
 *
 * If the drift is high enough, `quiet`/`loud` rise above the frame-to-skin delta
 * and the gate reverts the very pixels the removal depends on. This measures
 * that directly. No engine is called.
 *
 *   npx tsx scripts/calibration/removal-gate-measure.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { readRaster } from "../../server/castingV2/maskedComposite";

const OUT = "output/masked/glasses-fixture";
const master = await readRaster(readFileSync("output/masked/specimens/fresh-02.png"));

/** The frames' own footprint, as the fixture segmented it from the master. */
const maskPng = readFileSync(`${OUT}/c-remove-glasses-mask.png`);
const sharp = (await import("sharp")).default;
const { data: maskData, info } = await sharp(maskPng).raw().toBuffer({ resolveWithObject: true });
const stride = maskData.length / (info.width * info.height);

const deltaAt = (a: typeof master, b: typeof master, pixel: number) => {
  const at = pixel * 3;
  return (Math.abs(a.data[at] - b.data[at])
    + Math.abs(a.data[at + 1] - b.data[at + 1])
    + Math.abs(a.data[at + 2] - b.data[at + 2])) / 3;
};

for (const engine of ["nbp", "gpt2"]) {
  const painted = await readRaster(readFileSync(`${OUT}/c-remove-glasses-${engine}-raw.png`));
  const inZone: number[] = [];
  const outZone: number[] = [];
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const delta = deltaAt(master, painted, pixel);
    if (maskData[pixel * stride] > 0) inZone.push(delta); else outZone.push(delta);
  }
  outZone.sort((a, b) => a - b);
  inZone.sort((a, b) => a - b);
  /* The same statistic the compositor uses: the median drift over territory the
     instruction never named. */
  const baseline = outZone[Math.floor(outZone.length / 2)] ?? 0;
  const quiet = Math.max(2, baseline * 2);
  const loud = Math.max(quiet + 1, baseline * 6);
  const novelty = (delta: number) => Math.max(0, Math.min(1, (delta - quiet) / (loud - quiet)));
  const KEEP_AT = 0.35;

  const median = inZone[Math.floor(inZone.length / 2)] ?? 0;
  const reverted = inZone.filter((delta) => novelty(delta) < KEEP_AT).length;

  console.log(`\n### ${engine}`);
  console.log(`  painter drift outside the zone (baseline): ${baseline.toFixed(1)}`);
  console.log(`  gate thresholds: quiet ${quiet.toFixed(1)}  loud ${loud.toFixed(1)}  keepAt ${KEEP_AT}`);
  console.log(`  frame-to-skin delta inside the zone: median ${median.toFixed(1)}`
    + `  p10 ${(inZone[Math.floor(inZone.length * 0.1)] ?? 0).toFixed(1)}`
    + `  p90 ${(inZone[Math.floor(inZone.length * 0.9)] ?? 0).toFixed(1)}`);
  console.log(`  novelty at the median: ${novelty(median).toFixed(2)}`);
  console.log(`  zone pixels the gate SOFTENS OR REVERTS: ${reverted} of ${inZone.length}`
    + ` (${((reverted / inZone.length) * 100).toFixed(1)}%)`);
}
