/**
 * THE INTERLEAVE — hair and glasses, and the ordering rule that turns out not to
 * be needed.
 *
 * The depth stack governs distinct layers: background → clothes → earrings →
 * {hair, glasses}. The last pair is not linearly ordered and cannot be made so
 * by argument: wisps fall in FRONT of the frames while the arms tuck UNDER the
 * hair, in the same picture, at the same time. Any rule that puts one above the
 * other is wrong somewhere.
 *
 * The founder's refinement is that no rule is needed, because **the per-pixel
 * harvest already resolves it**: painted-glasses pixels land only where glasses
 * were confirmed, and every hair pixel inside the zone reverts to MASTER
 * strands — which therefore overlay the new frames in their exact original
 * positions. Temple hair beats an arm the same way. This fixture is that claim
 * put in front of a camera.
 *
 * # The setup, and why the master is a composite
 *
 * The master here is the FRINGE COMPOSITE from `fringe-fixture.mts` — a face
 * carrying fine strands across the forehead, exactly the content an added pair
 * of frames would have to cross. That also makes this the workstream's first
 * two-edit chain, which is what a real session looks like.
 *
 * The instruction changes the frames' SILHOUETTE, so by D-218 the destination
 * cannot be a tight matte of the frames as they are — a bolder frame would paint
 * outside the old footprint, get clipped, and leave the new rim inside the old
 * rim's edges, which is precisely what FLUX did on the glasses fixture. A grown
 * zone, and nothing subtracted from it.
 *
 * # The assertion
 *
 * Every strand of HER hair inside the zone diffs BLACK against the master, while
 * the frames themselves change. Not "mostly black" — the harvest gate is a
 * comparison, so the number is a count of pixels and it is allowed to be zero.
 *
 *   npx tsx scripts/calibration/interleave-fixture.mts
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
} from "../../server/castingV2/maskGeometry";
import {
  compositeMasked,
  outsideMaskUnchanged,
  readRaster,
  writePng,
  type Mask,
  type Raster,
} from "../../server/castingV2/maskedComposite";
import { runFalImageJob } from "../../server/providers/falTransport";
import { FAL_GPT_IMAGE_2_EDIT } from "../../server/providers/falImages";
import { birefnetMatte, sam3 } from "./lib/segment.mts";
import { differenceView } from "./lib/differenceView.mts";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required");

const OUT = "output/masked/interleave-fixture";
mkdirSync(OUT, { recursive: true });

/** The fringe composite: fine strands across a forehead, over fine wire frames. */
const MASTER = "output/masked/fringe-fixture/fringe.png";
const INSTRUCTION =
  "Replace her fine wire glasses with bold, chunky black plastic frames. "
  + "Change nothing else about her.";
/** The frames get bigger, so the zone must be bigger than the frames are (D-218). */
const ZONE_REACH = 40;

function pixelsIn(mask: Mask): number {
  let count = 0;
  for (let index = 0; index < mask.data.length; index += 1) if (mask.data[index] > 0) count += 1;
  return count;
}

function movement(master: Raster, composite: Raster, where: Mask): {
  pixels: number;
  moved: number;
  meanDelta: number;
  maxDelta: number;
} {
  let pixels = 0;
  let moved = 0;
  let total = 0;
  let max = 0;
  for (let pixel = 0; pixel < where.data.length; pixel += 1) {
    if (where.data[pixel] === 0) continue;
    pixels += 1;
    const at = pixel * 3;
    let delta = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      delta += Math.abs(composite.data[at + channel] - master.data[at + channel]);
    }
    if (delta > 0) moved += 1;
    total += delta / 3;
    if (delta / 3 > max) max = delta / 3;
  }
  return { pixels, moved, meanDelta: pixels ? total / pixels : 0, maxDelta: max };
}

async function writeMask(mask: Mask, name: string): Promise<void> {
  await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
    .png()
    .toFile(`${OUT}/${name}.png`);
}

/* -------------------------------------------------------------------- run */

const masterBytes = readFileSync(MASTER);
const master: Raster = await readRaster(masterBytes);
console.log(`master ${MASTER} ${master.width}x${master.height}\n`);

console.log("segmenting the master…");
const hair = await sam3(masterBytes, "hair");
const eyewear = await sam3(masterBytes, "eyeglasses");
const eyes = await sam3(masterBytes, "eyes");
console.log(`  hair       ${(coverage(hair.all) * 100).toFixed(2)}%  scores ${hair.scores.map((s) => s?.toFixed(3)).join(", ")}`);
console.log(`  eyeglasses ${(coverage(eyewear.all) * 100).toFixed(2)}%  scores ${eyewear.scores.map((s) => s?.toFixed(3)).join(", ")}`);
console.log(`  eyes       ${(coverage(eyes.all) * 100).toFixed(2)}%`);

/*
  THE FIXTURE'S PRECONDITION, checked rather than assumed. If none of her hair
  falls inside the frames' destination zone there is no interleave to resolve,
  and every protection figure below would be the trivial success of a test with
  no subject. This must stop the run, not pass quietly.
*/
const zone = await dilateMask(eyewear.all, ZONE_REACH);
const hairInZone = intersectMask(hair.all, zone);
const hairInZonePixels = pixelsIn(hairInZone);
console.log(`\nzone ${(coverage(zone) * 100).toFixed(2)}% (frames grown ${ZONE_REACH}px — a bolder frame needs room, D-218)`);
console.log(`  her hair inside that zone: ${hairInZonePixels.toLocaleString()} px`);
if (hairInZonePixels < 2000) {
  throw new Error(
    `only ${hairInZonePixels} px of her hair falls inside the frames' zone — there is no `
    + "interleave here to resolve, so this fixture would pass by testing nothing",
  );
}
await writeMask(zone, "MASK-zone");
await writeMask(hairInZone, "MASK-her-hair-in-the-zone");

/* ---- render ---- */
console.log("\nrendering…");
const started = Date.now();
const job = await runFalImageJob({
  apiKey,
  endpoint: FAL_GPT_IMAGE_2_EDIT,
  body: {
    prompt: INSTRUCTION,
    image_urls: [`data:image/png;base64,${masterBytes.toString("base64")}`],
    num_images: 1,
    quality: "medium",
    output_format: "png",
  },
  timeoutMs: 300_000,
  pollIntervalMs: 1_500,
});
const returnedMeta = await sharp(job.bytes).metadata();
const patchBytes = returnedMeta.width === master.width && returnedMeta.height === master.height
  ? job.bytes
  : await sharp(job.bytes).resize(master.width, master.height, { fit: "fill" }).png().toBuffer();
const patch: Raster = await readRaster(patchBytes);
writeFileSync(`${OUT}/raw.png`, patchBytes);
console.log(`  returned ${returnedMeta.width}x${returnedMeta.height} in ${((Date.now() - started) / 1000).toFixed(1)}s`);

/* ---- the harvest: this time the confirmed content is GLASSES ---- */
const patchSubject = await birefnetMatte(patchBytes);
const patchFrames = await sam3(patchBytes, "eyeglasses");
const harvest = await harvestMatteFrom({ content: patchFrames.all, matte: patchSubject });
await writeMask(harvest, "MASK-harvest");
console.log(`  painted eyeglasses ${(coverage(patchFrames.all) * 100).toFixed(2)}%   harvest matte ${(coverage(harvest) * 100).toFixed(2)}%`);

const composed = await compositeMasked({ master, patch, mask: zone, edgeMatte: harvest, featherRadius: 4 });
writeFileSync(`${OUT}/composite.png`, await writePng(composed.composite));
const outside = outsideMaskUnchanged(master, composed.composite, composed.applied);

/*
  THE ASSERTION. Her hair inside the zone, minus wherever the harvest confirmed
  glasses — every one of those pixels is hers, unchanged. The subtraction is
  there because a strand that genuinely sits BEHIND the new frame is supposed to
  be covered; the interleave is not "hair always wins", it is "each pixel goes to
  whatever is actually there".
*/
const strandsNotUnderFrames: Mask = {
  data: Buffer.from(hairInZone.data.map((value, index) => (harvest.data[index] === 0 ? value : 0))),
  width: master.width,
  height: master.height,
};
const strands = movement(master, composed.composite, strandsNotUnderFrames);
const framesChanged = movement(master, composed.composite, eyewear.all);
const eyesMoved = movement(master, composed.composite, eyes.all);

console.log(`\n  byte-identity outside the applied mask   ${outside.identical}`);
console.log(`  HER strands in the zone, not under a frame: ${strands.moved.toLocaleString()} of ${strands.pixels.toLocaleString()} px moved`
  + `  mean ${strands.meanDelta.toFixed(2)}  max ${strands.maxDelta.toFixed(0)}`);
console.log(`  the frames themselves: ${framesChanged.moved.toLocaleString()} of ${framesChanged.pixels.toLocaleString()} px moved`
  + `  mean ${framesChanged.meanDelta.toFixed(2)}  max ${framesChanged.maxDelta.toFixed(0)}`);
console.log(`  her eyes: ${eyesMoved.moved.toLocaleString()} of ${eyesMoved.pixels.toLocaleString()} px moved`
  + `  mean ${eyesMoved.meanDelta.toFixed(2)}  max ${eyesMoved.maxDelta.toFixed(0)}`);

const diff = await differenceView(masterBytes, readFileSync(`${OUT}/composite.png`), { gain: 6 });
writeFileSync(`${OUT}/DIFF-composite.png`, diff.panel);
console.log(`  frame moved ${(diff.changedShare * 100).toFixed(2)}%, max ${diff.maxDelta} levels, gain ${diff.gain}x`);

/* The founder's bar: master | composite | raw painter output | difference. The
   raw is in this one because what the painter did to her face is the argument. */
const box = { left: 240, top: 330, width: 560, height: 340 };
const cells = [
  await sharp(masterBytes).extract(box).png().toBuffer(),
  await sharp(readFileSync(`${OUT}/composite.png`)).extract(box).png().toBuffer(),
  await sharp(patchBytes).extract(box).png().toBuffer(),
  await sharp(diff.panel).extract(box).png().toBuffer(),
];
await sharp({ create: { width: box.width, height: box.height * 4 + 24, channels: 3, background: "#0A0A0A" } })
  .composite(cells.map((input, index) => ({ input, left: 0, top: index * (box.height + 8) })))
  .png()
  .toFile(`${OUT}/JUDGE-interleave.png`);
console.log("  JUDGE-interleave.png — master / composite / raw painter output / difference, lossless, 100%");

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({
  master: MASTER, instruction: INSTRUCTION, zoneReach: ZONE_REACH,
  hairInZone: hairInZonePixels,
  harvest: { coverage: coverage(harvest) },
  outsideIdentical: outside.identical,
  strandsNotUnderFrames: strands,
  frames: framesChanged,
  eyes: eyesMoved,
  frameMoved: diff.changedShare,
}, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);
