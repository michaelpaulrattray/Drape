/**
 * THE HARVEST GATE, ON A REAL FACE — the defect I shipped, and its fix.
 *
 * # What was wrong
 *
 * `finish-pass.mts` passed BiRefNet's **subject** matte as `edgeMatte`. The
 * mechanism was right and the input was wrong: a subject matte is opaque across
 * the whole person, so it confirms the painter's repainted CLOTHING exactly as
 * readily as her hair. The person-never-stage wall was not enforced; it only
 * looked enforced, because every fixture so far ran hair against a plain wall
 * where no clothing sat inside the zone to fail on.
 *
 * The founder's generalisation is what exposed it: *hair is a layer over the
 * master world* — the zone may cover any territory the style reaches, and the
 * composite keeps **only matte-confirmed strands**, reverting every other pixel
 * inside the zone to the master. Under that law the wrong matte is not a finish
 * detail, it is the wall missing.
 *
 * # Why this fixture can see it when the last one could not
 *
 * Two changes, and both are the point:
 *
 *   1. **The zone is generous** — grown until it genuinely covers her t-shirt,
 *      which the harvest law explicitly permits. A wall is untestable in a room
 *      with nothing on the other side of it.
 *   2. **The test territory is segmented from the MASTER, not from the matte
 *      under test.** Asking "did the pixels the harvest matte called non-hair
 *      revert?" is a tautology. Asking "did HER SHIRT survive?" is not — a
 *      harvest matte with stray confirmations on the shoulder would fail it.
 *
 * Both composites run against the same zone, the same patch and the same
 * territory, so the only variable is the matte. The old behaviour is kept as the
 * NEGATIVE CONTROL rather than deleted: a wall that has never been watched
 * failing is not a wall anyone should trust (law #2).
 *
 * Nothing is generated. The grow render is already on disk; this spends only
 * segmentation calls.
 *
 *   npx tsx scripts/calibration/harvest-gate.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  coverage,
  dilateMask,
  harvestMatteFrom,
  intersectMask,
  subtractMask,
  unionMasks,
} from "../../server/castingV2/maskGeometry";
import {
  compositeMasked,
  outsideMaskUnchanged,
  readRaster,
  writePng,
  type Mask,
  type Raster,
} from "../../server/castingV2/maskedComposite";
import { birefnetMatte, sam3, toMask } from "./lib/segment.mts";
import { differenceView } from "./lib/differenceView.mts";

const OUT = "output/masked/harvest-gate";
mkdirSync(OUT, { recursive: true });

const MASTER = "output/masked/specimens/wire-08.png";
const RAW = "output/masked/max-delta/grow-raw.png";
const AFRO_ZONE = "output/masked/max-delta/aligned-afro-zone.png";

/**
 * The generous zone is grown in PASSES, not in one big radius, and the reason is
 * worth writing down because a single large number silently did nothing.
 *
 * `dilateMask` is a blur-and-threshold, so its reach is not its radius: a
 * gaussian spread from a small blob falls under the threshold well before
 * `radius` pixels, and how far it actually carries depends on how big the blob
 * already is. Asked for 220 in one call it stopped at her jaw — a zone covering
 * 42% of the frame and **zero pixels of her shirt**, which is the exact shape of
 * a wall test that passes by testing nothing.
 *
 * Iterating a modest step is a real dilation instead: each pass starts from a
 * larger blob, so the reach accumulates rather than decaying. The loop stops as
 * soon as the zone genuinely covers clothing, so the growth is the minimum the
 * question needs rather than a number chosen to look impressive.
 */
const GROW_STEP = 48;
const MAX_PASSES = 12;
/** Enough of her shirt inside the zone that "did it survive" is a real question. */
const CLOTHING_NEEDED = 40_000;

/** Share of a mask's own extent carrying a genuine blend value (D-215). */
function rampShare(mask: Mask): number {
  let ramp = 0;
  let nonzero = 0;
  for (let pixel = 0; pixel < mask.data.length; pixel += 1) {
    const value = mask.data[pixel];
    if (value > 0) nonzero += 1;
    if (value >= 26 && value <= 229) ramp += 1;
  }
  return nonzero === 0 ? 0 : ramp / nonzero;
}

/**
 * Did HER pixels survive, over a territory nobody in the composite chose?
 *
 * Counts, inside `territory`, how many pixels the composite moved off the master
 * and by how much. Under the harvest law this is zero on clothing: the painter
 * may repaint the shirt all it likes, but no shirt pixel is hair, so none of it
 * is harvested.
 */
function survival(master: Raster, composite: Raster, territory: Mask): {
  pixels: number;
  changed: number;
  meanDelta: number;
  maxDelta: number;
} {
  let pixels = 0;
  let changed = 0;
  let total = 0;
  let max = 0;
  for (let pixel = 0; pixel < territory.data.length; pixel += 1) {
    if (territory.data[pixel] === 0) continue;
    pixels += 1;
    const at = pixel * 3;
    let delta = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const step = Math.abs(composite.data[at + channel] - master.data[at + channel]);
      delta += step;
      if (step > max) max = step;
    }
    if (delta > 0) changed += 1;
    total += delta / 3;
  }
  return { pixels, changed, meanDelta: pixels ? total / pixels : 0, maxDelta: max };
}

/** A mask as a viewable picture, because a number about a mask is not the mask. */
async function writeMask(mask: Mask, name: string): Promise<void> {
  await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
    .png()
    .toFile(`${OUT}/${name}.png`);
}

/* -------------------------------------------------------------------- run */

const masterBytes = readFileSync(MASTER);
const master: Raster = await readRaster(masterBytes);
const patchBytes = await sharp(readFileSync(RAW))
  .resize(master.width, master.height, { fit: "fill" })
  .png()
  .toBuffer();
const patch: Raster = await readRaster(patchBytes);
console.log(`master ${master.width}x${master.height}\n`);

/* ---- what the master is: territory, and the face that is never in a hair zone ---- */
console.log("segmenting the master…");
const masterHair = await sam3(masterBytes, "hair");
const masterFace = await sam3(masterBytes, "face skin");
/* Record-gated (D-213): she is visibly wearing one. This is the wall's test
   territory and it comes from HER image, not from anything the fix produced. */
const masterShirt = await sam3(masterBytes, "t-shirt");
const masterSubject = await birefnetMatte(masterBytes);
console.log(`  hair      ${(coverage(masterHair.all) * 100).toFixed(2)}%  ${masterHair.instances} instance(s)  scores ${masterHair.scores.join(", ")}`);
console.log(`  face skin ${(coverage(masterFace.all) * 100).toFixed(2)}%`);
console.log(`  t-shirt   ${(coverage(masterShirt.all) * 100).toFixed(2)}%  ${masterShirt.instances} instance(s)  scores ${masterShirt.scores.join(", ")}`);
console.log(`  subject   ${(coverage(masterSubject) * 100).toFixed(2)}%  ramp ${(rampShare(masterSubject) * 100).toFixed(1)}%`);
await writeMask(masterShirt.all, "MASK-master-shirt");

/* ---- the generous zone the harvest law permits ---- */
const afroZone = await toMask(readFileSync(AFRO_ZONE));
const clothingCovered = (mask: Mask): number => {
  const overlap = intersectMask(mask, masterShirt.all);
  let pixels = 0;
  for (let index = 0; index < overlap.data.length; index += 1) if (overlap.data[index] > 0) pixels += 1;
  return pixels;
};

console.log("\ngrowing the zone until it genuinely covers clothing…");
let grown = unionMasks(masterHair.all, afroZone);
let passes = 0;
while (clothingCovered(grown) < CLOTHING_NEEDED && passes < MAX_PASSES) {
  grown = await dilateMask(grown, GROW_STEP);
  passes += 1;
  console.log(
    `  pass ${passes}  zone ${(coverage(grown) * 100).toFixed(2)}%  `
    + `clothing covered ${clothingCovered(grown).toLocaleString()} px`,
  );
}
/* The face is carved out LAST, by law — a hair zone never contains the face,
   however generous the rest of it gets (D-211). */
const zone = subtractMask(grown, masterFace.all);
await writeMask(zone, "MASK-generous-zone");

const territory = intersectMask(zone, masterShirt.all);
const territoryPixels = clothingCovered(zone);
console.log(`\ngenerous zone ${(coverage(zone) * 100).toFixed(2)}% of frame after ${passes} pass(es)`);
console.log(`  of her t-shirt, the zone covers ${territoryPixels.toLocaleString()} px`);
if (territoryPixels < CLOTHING_NEEDED) {
  /* Loud, not silent. A vacuous wall test reads exactly like a passing one. */
  throw new Error(
    `the zone covers only ${territoryPixels} px of clothing after ${passes} passes — this fixture `
    + "cannot see the defect it exists to see; raise MAX_PASSES or GROW_STEP until it can",
  );
}
await writeMask(territory, "MASK-test-territory");

/* ---- the two mattes ---- */
console.log("\nsegmenting the patch…");
const patchSubject = await birefnetMatte(patchBytes);
const patchHair = await sam3(patchBytes, "hair");
console.log(`  patch subject ${(coverage(patchSubject) * 100).toFixed(2)}%  ramp ${(rampShare(patchSubject) * 100).toFixed(1)}%`);
console.log(`  patch hair    ${(coverage(patchHair.all) * 100).toFixed(2)}%  ${patchHair.instances} instance(s)  scores ${patchHair.scores.join(", ")}`);

/*
  THE GROWTH SWEEP. D-216 put r≈4 on one specimen and said so; this reports what
  each radius costs on both sides at once — ramp share is what the wisps need,
  clothing leakage is what the wall cannot give up. A radius is only defensible
  with both figures beside it.
*/
console.log("\ngrowth sweep — ramp is what wisps need, leakage is what the wall forbids");
const sweep: { growPx: number; coverage: number; ramp: number; changed: number; meanDelta: number }[] = [];
for (const growPx of [0, 4, 8, 16, 32]) {
  const candidate = await harvestMatteFrom({ content: patchHair.all, matte: patchSubject, growPx });
  const trial = await compositeMasked({ master, patch, mask: zone, edgeMatte: candidate, featherRadius: 4 });
  const leak = survival(master, trial.composite, territory);
  sweep.push({
    growPx,
    coverage: coverage(candidate),
    ramp: rampShare(candidate),
    changed: leak.changed,
    meanDelta: leak.meanDelta,
  });
  console.log(
    `  r=${String(growPx).padStart(2)}  matte ${(coverage(candidate) * 100).toFixed(2)}%  `
    + `ramp ${(rampShare(candidate) * 100).toFixed(1)}%  `
    + `shirt pixels moved ${String(leak.changed).padStart(7)}  mean ${leak.meanDelta.toFixed(2)} levels`,
  );
}

/* ---- the comparison: same zone, same patch, one variable ---- */
const harvest = await harvestMatteFrom({ content: patchHair.all, matte: patchSubject });
await writeMask(harvest, "MASK-harvest-matte");
await writeMask(patchSubject, "MASK-subject-matte");

const defect = await compositeMasked({ master, patch, mask: zone, edgeMatte: patchSubject, featherRadius: 4 });
const fixed = await compositeMasked({ master, patch, mask: zone, edgeMatte: harvest, featherRadius: 4 });
writeFileSync(`${OUT}/subject-matte.png`, await writePng(defect.composite));
writeFileSync(`${OUT}/harvest-matte.png`, await writePng(fixed.composite));

const defectLeak = survival(master, defect.composite, territory);
const fixedLeak = survival(master, fixed.composite, territory);

console.log("\n=== THE WALL, measured on her t-shirt ===");
console.log(`  territory                     ${defectLeak.pixels.toLocaleString()} px of her own shirt, inside the zone`);
console.log(`  NEGATIVE CONTROL (subject)    ${defectLeak.changed.toLocaleString()} px moved  `
  + `mean ${defectLeak.meanDelta.toFixed(2)}  max ${defectLeak.maxDelta} levels`);
console.log(`  the harvest gate              ${fixedLeak.changed.toLocaleString()} px moved  `
  + `mean ${fixedLeak.meanDelta.toFixed(2)}  max ${fixedLeak.maxDelta} levels`);

/* The guarantee is not allowed to lapse because the wall went up. */
const outsideDefect = outsideMaskUnchanged(master, defect.composite, defect.applied);
const outsideFixed = outsideMaskUnchanged(master, fixed.composite, fixed.applied);
console.log(`\n  byte-identity outside the applied mask — control ${outsideDefect.identical}  harvest ${outsideFixed.identical}`);

/* ---- difference views, by law ---- */
for (const [name, file] of [["subject-matte", `${OUT}/subject-matte.png`], ["harvest-matte", `${OUT}/harvest-matte.png`]] as const) {
  const diff = await differenceView(masterBytes, readFileSync(file), { gain: 6 });
  writeFileSync(`${OUT}/DIFF-${name}.png`, diff.panel);
  console.log(`  DIFF-${name}.png — ${(diff.changedShare * 100).toFixed(2)}% of the frame moved, max ${diff.maxDelta} levels, gain ${diff.gain}x`);
}

/* A crop of the shoulder at 100%, where the two composites are supposed to differ. */
const box = { left: 60, top: 1080, width: 900, height: 420 };
const cells: Buffer[] = [];
for (const file of [MASTER, `${OUT}/subject-matte.png`, `${OUT}/harvest-matte.png`]) {
  cells.push(await sharp(readFileSync(file)).extract(box).jpeg({ quality: 97 }).toBuffer());
}
await sharp({ create: { width: box.width, height: box.height * 3 + 16, channels: 3, background: "#0A0A0A" } })
  .composite(cells.map((input, index) => ({ input, left: 0, top: index * (box.height + 8) })))
  .jpeg({ quality: 97 })
  .toFile(`${OUT}/CROP-shoulder.jpg`);
console.log("  CROP-shoulder.jpg — master / subject matte / harvest matte, 100%");

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({
  master: MASTER, patch: RAW, growth: { step: GROW_STEP, passes },
  zone: { coverage: coverage(zone), clothingPixelsCovered: territoryPixels },
  mattes: {
    subject: { coverage: coverage(patchSubject), ramp: rampShare(patchSubject) },
    harvest: { coverage: coverage(harvest), ramp: rampShare(harvest) },
  },
  sweep,
  wall: { negativeControl: defectLeak, harvestGate: fixedLeak },
  outsideIdentical: { negativeControl: outsideDefect.identical, harvestGate: outsideFixed.identical },
}, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);
