/**
 * EAR-CONTOUR ROUTING — placement, one more time, at the last place it is wrong.
 *
 * The difference view did its job: on the finished pass the forehead diffs BLACK
 * and the only bright things left are the hair's own edge — which is the edit —
 * and **both ear crossings**, where a warm rim runs down the ear's contour and
 * the boundary stops dead at the lobe. That is a seam, and it is the whole of
 * what stands between this pass and its acceptance criterion.
 *
 * The founder's instruction is placement rather than polish, for the third time
 * running and for the same reason each time: *treat the ear like the face
 * carve-out and the glasses frames — excluded, composited back verbatim,
 * boundary hugging its outline.* Same for the glasses arms. A seam that is not
 * there cannot be blended badly.
 *
 * # What this measures, and why it is not a tautology
 *
 * Excluding the ear obviously removes the boundary from inside the ear; counting
 * that would be checking arithmetic against itself. So the instrument is the
 * SEAM, in a neighbourhood around the ear that the exclusion does not define:
 * the tonal step across the applied boundary wherever both sides are the same
 * kind of surface. A routed zone can still seam just outside the ear, and this
 * would say so.
 *
 * The eye is the other half and it is the one that matters, because the real
 * risk of an exclusion is the opposite failure: an ear composited back verbatim
 * into a head of new hair can read as pasted on. No metric is claimed for that.
 * The crops are at 100% and the difference panel rides along, by law.
 *
 * Nothing is generated — the grow render is on disk, and every variant here is
 * the SAME painted pixels composited differently. That is the only honest way to
 * compare placements: a fresh render would confound the routing with the model
 * having a different day.
 *
 *   npx tsx scripts/calibration/ear-routing.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  coverage,
  dilateMask,
  harvestMatteFrom,
  intersectMask,
  placeDestinationZone,
  subtractMask,
  unionMasks,
} from "../../server/castingV2/maskGeometry";
import {
  compositeMasked,
  harmonizeSeam,
  matchGrain,
  outsideMaskUnchanged,
  readRaster,
  writePng,
  type Mask,
  type Raster,
} from "../../server/castingV2/maskedComposite";
import { birefnetMatte, sam3, toMask } from "./lib/segment.mts";
import { differenceView } from "./lib/differenceView.mts";

const OUT = "output/masked/ear-routing";
mkdirSync(OUT, { recursive: true });

const MASTER = "output/masked/specimens/wire-08.png";
const RAW = "output/masked/max-delta/grow-raw.png";
const AFRO_ZONE = "output/masked/max-delta/aligned-afro-zone.png";
/** How far around the ear counts as "at the ear" when scoring the seam. */
const EAR_NEIGHBOURHOOD = 16;

/**
 * The tonal step across the applied boundary, inside a named neighbourhood.
 *
 * A pair of rings, one pixel each side. Where the two sides differ enormously
 * the boundary is a genuine content change (hair meeting wall) and is skipped;
 * what remains is the same kind of surface meeting itself, where any step is the
 * defect. Restricting it to a neighbourhood is what turns a whole-frame average
 * into a question about the ear.
 */
function seamStepIn(
  master: Raster,
  composite: Raster,
  applied: Mask,
  where: Mask,
): { meanStep: number; maxStep: number; pixels: number } {
  const { width, height } = applied;
  let total = 0;
  let max = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = y * width + x;
      if (where.data[pixel] === 0) continue;
      if (applied.data[pixel] === 0) continue;
      const outside = [pixel - 1, pixel + 1, pixel - width, pixel + width]
        .find((neighbour) => applied.data[neighbour] === 0);
      if (outside === undefined) continue;
      const inAt = pixel * 3;
      const outAt = outside * 3;
      const step = Math.abs(composite.data[inAt] - master.data[outAt])
        + Math.abs(composite.data[inAt + 1] - master.data[outAt + 1])
        + Math.abs(composite.data[inAt + 2] - master.data[outAt + 2]);
      /* A content boundary is not a seam — hair is allowed to meet a wall. */
      if (step > 120) continue;
      total += step / 3;
      if (step / 3 > max) max = step / 3;
      count += 1;
    }
  }
  return { meanStep: count === 0 ? 0 : total / count, maxStep: max, pixels: count };
}

/** Boundary pixels of the applied mask that sit strictly inside a region. */
function boundaryInside(applied: Mask, region: Mask): number {
  const { width, height } = applied;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = y * width + x;
      if (region.data[pixel] === 0 || applied.data[pixel] === 0) continue;
      const crosses = [pixel - 1, pixel + 1, pixel - width, pixel + width]
        .some((neighbour) => applied.data[neighbour] === 0);
      if (crosses) count += 1;
    }
  }
  return count;
}

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

console.log("segmenting the master — every prompt record-gated (D-213)…");
const hair = await sam3(masterBytes, "hair");
const face = await sam3(masterBytes, "face skin");
/*
  She has ears, and she is visibly wearing glasses. Neither is an open question.

  **A BILATERAL REGION IS ASKED FOR ONE SIDE AT A TIME**, and this cost a run to
  learn. Asked for "ear", SAM 3 returns exactly ONE instance — and which one
  depends on the wording: "ear" came back with her left, "ears" with her right,
  each at ~0.16% and each perfectly good. The metadata gives it away (`index: 1`
  against `index: 0`): the model found both and hands back one. A fixture that
  took either would have routed around one ear, measured a real improvement, and
  reported the seam closed while it was still there on the other side of her
  head — the exact shape of a finding that is half true.

  So the sides are separate questions, which is also what D-213 asks for: a
  specific question with a determinate answer, never an open one. "left" and
  "right" resolve ANATOMICALLY — her left ear is on the viewer's right — and the
  check below proves that rather than trusting it.
*/
const leftEar = await sam3(masterBytes, "left ear");
const rightEar = await sam3(masterBytes, "right ear");
const ears = {
  all: unionMasks(leftEar.all, rightEar.all),
  instances: leftEar.instances + rightEar.instances,
  scores: [...leftEar.scores, ...rightEar.scores],
};
const eyewear = await sam3(masterBytes, "eyeglasses");
const lenses = await sam3(masterBytes, "eyeglass lenses");
const subject = await birefnetMatte(masterBytes);
/* Frames INCLUDING the arms: the union minus the lens interiors (D-217). The
   arms are what run back past the temple into the hair, so they are exactly the
   part this routing is about. */
const frames = subtractMask(eyewear.all, lenses.all);

console.log(`  hair    ${(coverage(hair.all) * 100).toFixed(2)}%`);
console.log(`  face    ${(coverage(face.all) * 100).toFixed(2)}%`);
console.log(`  ear     ${(coverage(ears.all) * 100).toFixed(2)}%  ${ears.instances} instance(s)  scores ${ears.scores.map((s) => s?.toFixed(3)).join(", ")}`);
console.log(`  eyewear ${(coverage(eyewear.all) * 100).toFixed(2)}%   lenses ${(coverage(lenses.all) * 100).toFixed(2)}%   frames+arms ${(coverage(frames) * 100).toFixed(2)}%`);
await writeMask(ears.all, "MASK-ears");
await writeMask(frames, "MASK-frames-and-arms");

/*
  THE INSTRUMENT'S OWN CHECK, before any of its verdicts count (law #2).

  Not "did it return two" — two calls always return two. **Two ears, disjoint,
  on opposite sides of her head.** That is the fact the routing depends on, and
  it is the one that was silently false a run ago. If both prompts land on the
  same ear the seam measurement halves and still reads like a success, so this
  stops the run instead.
*/
const centroid = (mask: Mask) => {
  let sumX = 0;
  let sumY = 0;
  let pixels = 0;
  for (let pixel = 0; pixel < mask.data.length; pixel += 1) {
    if (!mask.data[pixel]) continue;
    sumX += pixel % mask.width;
    sumY += Math.floor(pixel / mask.width);
    pixels += 1;
  }
  return { x: sumX / pixels, y: sumY / pixels, pixels };
};
const leftAt = centroid(leftEar.all);
const rightAt = centroid(rightEar.all);
let shared = 0;
const both = intersectMask(leftEar.all, rightEar.all);
for (let pixel = 0; pixel < both.data.length; pixel += 1) if (both.data[pixel] > 0) shared += 1;
console.log(`  her left ear at x=${leftAt.x.toFixed(0)}, her right at x=${rightAt.x.toFixed(0)}, sharing ${shared} px`);
if (shared > 0) throw new Error(`the two ear masks overlap by ${shared} px — they are the same ear`);
if (!(leftAt.x > master.width / 2 && rightAt.x < master.width / 2)) {
  throw new Error("the ear masks are not on opposite sides of her head — sides did not resolve anatomically");
}
const earArea = coverage(ears.all);
if (earArea < 0.001 || earArea > 0.04) throw new Error(`ear coverage ${(earArea * 100).toFixed(2)}% is outside its class band`);

const reachable = unionMasks(hair.all, await toMask(readFileSync(AFRO_ZONE)));
const earNeighbourhood = await dilateMask(ears.all, EAR_NEIGHBOURHOOD);

const patchSubject = await birefnetMatte(patchBytes);
const patchHair = await sam3(patchBytes, "hair");
const harvest = await harvestMatteFrom({ content: patchHair.all, matte: patchSubject });
console.log(`\nharvest matte ${(coverage(harvest) * 100).toFixed(2)}%\n`);

/*
  DOES THE EAR NEED EXCLUDING AT ALL? Ask the matte before building on it.

  The routing instruction was written when `edgeMatte` was a SUBJECT matte, which
  is opaque across the ear like everything else — under that matte the ear is
  inside the edit and its contour is a boundary the composite has to blend. A
  HAIR matte has no opinion about the ear at all, so the ear may already be
  reverting to master per-pixel, and the exclusion may be adding a hole to a
  place that is already empty.
*/
const inEar = intersectMask(harvest, ears.all);
let earPaint = 0;
let earPixels = 0;
for (let pixel = 0; pixel < inEar.data.length; pixel += 1) {
  if (ears.all.data[pixel] === 0) continue;
  earPixels += 1;
  if (inEar.data[pixel] > 0) earPaint += 1;
}
const inEarSubject = intersectMask(patchSubject, ears.all);
let earPaintSubject = 0;
for (let pixel = 0; pixel < inEarSubject.data.length; pixel += 1) {
  if (ears.all.data[pixel] > 0 && inEarSubject.data[pixel] > 0) earPaintSubject += 1;
}
console.log(`of ${earPixels} ear pixels, the HARVEST matte confirms ${earPaint} — the SUBJECT matte confirms ${earPaintSubject}\n`);

const variants: { name: string; label: string; exclude: Mask }[] = [
  { name: "face-only", label: "face carved out (what shipped)", exclude: face.all },
  { name: "face-ears", label: "+ the ears", exclude: unionMasks(face.all, ears.all) },
  { name: "face-ears-frames", label: "+ the ears and the glasses arms", exclude: unionMasks(face.all, ears.all, frames) },
];

/*
  THE CONTROL THAT MAKES "NO DIFFERENCE" MEAN SOMETHING.

  If the three variants come out identical, that is either "the exclusion is
  redundant" or "this fixture cannot tell variants apart" — and those look the
  same from the outside. So every variant also runs under the OLD subject matte,
  where the ear genuinely is inside the edit. A difference there and none under
  the harvest matte is the finding; no difference anywhere is a broken bench.
*/
const results: any[] = [];
for (const [matteName, matte] of [["harvest", harvest], ["subject", patchSubject]] as const) {
  console.log(`=== under the ${matteName} matte ===`);
  for (const variant of variants) {
    const zone = await placeDestinationZone({
      region: reachable, subject, reach: 24, skinMargin: 8, exclude: variant.exclude,
    });
    const composed = await compositeMasked({
      master, patch, mask: zone, edgeMatte: matte, featherRadius: 4,
    });
    const atEar = seamStepIn(master, composed.composite, composed.applied, earNeighbourhood);
    const crossings = boundaryInside(composed.applied, ears.all);
    /*
      COUNT AND MAGNITUDE, because the count alone is the D-202 trap wearing a
      number. "Moved" here means any byte differs, and a two-level shift across
      half an ear is invisible while reading as 50% changed. What the criterion
      is about is how FAR they moved, and how far the worst one moved.
    */
    let earMoved = 0;
    let earTotal = 0;
    let earMax = 0;
    let earPixelCount = 0;
    for (let pixel = 0; pixel < ears.all.data.length; pixel += 1) {
      if (ears.all.data[pixel] === 0) continue;
      earPixelCount += 1;
      const at = pixel * 3;
      let delta = 0;
      for (let channel = 0; channel < 3; channel += 1) {
        delta += Math.abs(composed.composite.data[at + channel] - master.data[at + channel]);
      }
      if (delta > 0) earMoved += 1;
      earTotal += delta / 3;
      if (delta / 3 > earMax) earMax = delta / 3;
    }
    const earMean = earPixelCount ? earTotal / earPixelCount : 0;
    console.log(
      `  ${variant.name.padEnd(17)} ear moved ${String(earMoved).padStart(5)} px  `
      + `mean ${earMean.toFixed(2)}  max ${earMax.toFixed(0)} levels  `
      + `boundary in ear ${String(crossings).padStart(4)}  seam mean ${atEar.meanStep.toFixed(2)}`,
    );
    results.push({ matte: matteName, variant: variant.name, earMoved, earMean, earMax, crossings, seam: atEar });
  }
  console.log("");
}

/*
  THE FINISH LADDER — does either finish step still earn its place?

  `harmonizeSeam` and `matchGrain` were built for the founder's forehead line,
  BEFORE the placement law moved the boundary off open skin and before the
  harvest matte took the visible edge from the paint. Two fixes for a seam that
  those two changes may have removed outright. So the routed zone is composited
  three ways up the ladder — bare, tone, tone and grain — and each step has to
  show what it bought.

  This is the founder's success condition for the whole pass stated as a
  measurement: *the finish completes with zero grain machinery on the critical
  path.* If bare wins, grain is reserve.
*/
const CHOSEN = variants[variants.length - 1];
const chosenZone = await placeDestinationZone({
  region: reachable, subject, reach: 24, skinMargin: 8, exclude: CHOSEN.exclude,
});
const harmonised = harmonizeSeam({ master, patch, mask: chosenZone, bandPx: 14 });
const grained = matchGrain({ master, patch: harmonised, mask: chosenZone, ringPx: 6 });

const everywhere: Mask = {
  data: Buffer.alloc(master.width * master.height, 255),
  width: master.width,
  height: master.height,
};
const ladder: { rung: string; source: Raster }[] = [
  { rung: "bare", source: patch },
  { rung: "tone", source: harmonised },
  { rung: "tone+grain", source: grained },
];
const rungs: any[] = [];
console.log(`=== the finish ladder, on "${CHOSEN.label}" ===`);
for (const { rung, source } of ladder) {
  const composed = await compositeMasked({
    master, patch: source, mask: chosenZone, edgeMatte: harvest, featherRadius: 4,
  });
  writeFileSync(`${OUT}/finish-${rung.replace("+", "-")}.png`, await writePng(composed.composite));
  const atEar = seamStepIn(master, composed.composite, composed.applied, earNeighbourhood);
  const overall = seamStepIn(master, composed.composite, composed.applied, everywhere);
  const outside = outsideMaskUnchanged(master, composed.composite, composed.applied);
  console.log(
    `  ${rung.padEnd(11)} seam at ear ${atEar.meanStep.toFixed(2)}  whole boundary ${overall.meanStep.toFixed(2)} `
    + `(max ${overall.maxStep.toFixed(0)}) over ${overall.pixels} px   byte-identity outside ${outside.identical}`,
  );
  rungs.push({ rung, seamAtEar: atEar, seamOverall: overall, outsideIdentical: outside.identical });
}

/*
  WHAT EACH STEP ACTUALLY DID TO THE PICTURE, localised — because "improved the
  seam by 0.02 levels" and "left a visible artefact somewhere else" are both
  true at once and only one of them is in the number.
*/
for (const [from, to, label] of [
  ["bare", "tone", "harmonizeSeam"],
  ["tone", "tone-grain", "matchGrain"],
] as const) {
  const diff = await differenceView(
    readFileSync(`${OUT}/finish-${from}.png`),
    readFileSync(`${OUT}/finish-${to}.png`),
    { gain: 10 },
  );
  writeFileSync(`${OUT}/DIFF-step-${label}.png`, diff.panel);
  console.log(`  ${label} moved ${(diff.changedShare * 100).toFixed(2)}% of the frame, max ${diff.maxDelta} levels`);
}

/*
  THE FOUNDER'S BAR, at 100% and with the difference beside it — master,
  composite, diff. The pair on its own is what sent me chasing a phantom for
  three rounds, so it never travels alone again.
*/
const bareBytes = readFileSync(`${OUT}/finish-bare.png`);
const bareDiff = await differenceView(masterBytes, bareBytes, { gain: 6 });
writeFileSync(`${OUT}/DIFF-finish-bare.png`, bareDiff.panel);
console.log(`\nfinish (bare) against the master: ${(bareDiff.changedShare * 100).toFixed(2)}% moved, max ${bareDiff.maxDelta} levels, gain ${bareDiff.gain}x`);

const JUDGE_AT: [string, { left: number; top: number; width: number; height: number }][] = [
  ["temple-ear-right", { left: 580, top: 340, width: 300, height: 400 }],
  ["temple-ear-left", { left: 200, top: 340, width: 300, height: 400 }],
];
for (const [name, box] of JUDGE_AT) {
  const cells = [
    await sharp(masterBytes).extract(box).png().toBuffer(),
    await sharp(bareBytes).extract(box).png().toBuffer(),
    await sharp(bareDiff.panel).extract(box).png().toBuffer(),
  ];
  await sharp({ create: { width: box.width * 3 + 16, height: box.height, channels: 3, background: "#0A0A0A" } })
    .composite(cells.map((input, index) => ({ input, left: index * (box.width + 8), top: 0 })))
    .png()
    .toFile(`${OUT}/JUDGE-${name}.png`);
  console.log(`  JUDGE-${name}.png — master | composite | difference (${bareDiff.gain}x), lossless, 100%`);
}

/* The grain artefact, where it shows: inside the hair mass, lossless. */
const hairBox = { left: 600, top: 300, width: 300, height: 260 };
const grainCells: Buffer[] = [];
for (const rung of ["bare", "tone", "tone-grain"]) {
  grainCells.push(await sharp(readFileSync(`${OUT}/finish-${rung}.png`)).extract(hairBox).png().toBuffer());
}
await sharp({ create: { width: hairBox.width * 3 + 16, height: hairBox.height, channels: 3, background: "#0A0A0A" } })
  .composite(grainCells.map((input, index) => ({ input, left: index * (hairBox.width + 8), top: 0 })))
  .png()
  .toFile(`${OUT}/CROP-grain-in-hair.png`);
console.log("  CROP-grain-in-hair.png — bare | tone | tone+grain inside the hair, lossless, 100%");

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({
  master: MASTER, patch: RAW, earNeighbourhood: EAR_NEIGHBOURHOOD,
  segmentation: {
    ear: { coverage: coverage(ears.all), instances: ears.instances, scores: ears.scores },
    framesAndArms: { coverage: coverage(frames) },
  },
  harvestMatte: { coverage: coverage(harvest), earPixelsConfirmed: earPaint, earPixels },
  earExclusionSweep: results,
  chosen: CHOSEN.name,
  finishLadder: rungs,
}, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);
