/**
 * THE WALK — the founder's own failed sequence, re-run on the masked path.
 *
 * On the night the finale was suspended, the founder walked production intending
 * to SIGN, and drift blocked the sale. Three of those defects are edits, and this
 * runs all three against one bespectacled face:
 *
 *   FRECKLES    "the freckles edit replaced her hairstyle wholesale"
 *               -> assert HER HAIR is byte-identical
 *   EARRINGS    "the earrings edit DELETED her glasses"
 *               -> assert HER GLASSES are byte-identical
 *   REMOVAL     "'remove her glasses' refused with 'I can't find any glasses'
 *               at a face visibly wearing them"
 *               -> assert it does not refuse, and that her face and hair survive
 *
 * Same person, three separate asks from the same master — which is what the walk
 * was. Nothing is chained: base-anchored is the default for repeats (D-220), and
 * each of these is a fresh instruction about a different facet anyway.
 *
 * # THREE EDITS, THREE MECHANISMS — and that is the point, not an inconsistency
 *
 * The workstream has three tools and each of these needs a different one. Using
 * the harvest gate for all of them would be the fidelity law's failure in
 * reverse: reaching for the impressive instrument where a plain one is correct.
 *
 *   FRECKLES  a TEXTURE edit inside a region that already exists. There is no
 *             overlay to harvest — freckles are not a thing sitting on top of
 *             her, they are her skin being different. So it is a plain masked
 *             composite on the face-skin matte, and the guarantee does the work.
 *   EARRINGS  OVERLAY content. Destination from a LANDMARK (an earring is not
 *             there yet, so nothing can segment it — D-213 and its sibling),
 *             harvest from the painted earrings, and the master's hair passed as
 *             `occludedBy` so anything behind it renders behind it.
 *   REMOVAL   an ABSENCE. Nothing to harvest either: what we want is the
 *             painter's answer for what is behind the frames, inside a region
 *             covering where the frames are.
 *
 * # The refusal that started it
 *
 * The old removal consulted the RECORD, which said her glasses were base-worn
 * rather than an accessory, and answered "I can't find any glasses" while she
 * was visibly wearing them. Here the question is put to the pixels: SAM 3 is
 * asked for eyeglasses on her actual image, and either it finds them or the
 * refusal is honest. That is `present` in the contract, checked the only way
 * that cannot lie to her.
 *
 *   npx tsx scripts/calibration/the-walk.mts
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
import { runFalImageJob } from "../../server/providers/falTransport";
import { FAL_GPT_IMAGE_2_EDIT } from "../../server/providers/falImages";
import { birefnetMatte, pointAt, sam3 } from "./lib/segment.mts";
import { differenceView } from "./lib/differenceView.mts";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required");

const OUT = "output/masked/the-walk";
mkdirSync(OUT, { recursive: true });

/** Updo, exposed ears, bold frames, clear skin — all three asks are legible. */
const MASTER = "output/masked/specimens/chunky-02.png";

const PRESERVE =
  " Keep her identity, bone structure, pose, expression, clothing, lighting and the "
  + "plain studio background exactly as they are.";

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

function discAt(point: { x: number; y: number }, radius: number, width: number, height: number): Mask {
  const data = Buffer.alloc(width * height, 0);
  const cx = point.x * width;
  const cy = point.y * height;
  for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(height, Math.ceil(cy + radius)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(width, Math.ceil(cx + radius)); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) data[y * width + x] = 255;
    }
  }
  return { data, width, height };
}

async function render(instruction: string, image: Buffer): Promise<Buffer> {
  const job = await runFalImageJob({
    apiKey: apiKey!,
    endpoint: FAL_GPT_IMAGE_2_EDIT,
    body: {
      prompt: instruction + PRESERVE,
      image_urls: [`data:image/png;base64,${image.toString("base64")}`],
      num_images: 1,
      quality: "high",
      output_format: "png",
    },
    timeoutMs: 300_000,
    pollIntervalMs: 1_500,
  });
  return job.bytes;
}

/* -------------------------------------------------------------------- run */

const masterBytes = readFileSync(MASTER);
const master: Raster = await readRaster(masterBytes);
console.log(`master ${MASTER} ${master.width}x${master.height}\n`);

console.log("segmenting the master…");
const hair = await sam3(masterBytes, "hair");
const faceSkin = await sam3(masterBytes, "face skin");
const eyewear = await sam3(masterBytes, "eyeglasses");
const eyes = await sam3(masterBytes, "eyes");
const subject = await birefnetMatte(masterBytes);
console.log(`  hair ${(coverage(hair.all) * 100).toFixed(2)}%  face skin ${(coverage(faceSkin.all) * 100).toFixed(2)}%`
  + `  eyeglasses ${(coverage(eyewear.all) * 100).toFixed(2)}% @ ${eyewear.scores[0]?.toFixed(3)}`);

/*
  THE REFUSAL THAT STARTED THE WALK, answered by the pixels. The old path asked
  the RECORD whether she had glasses; this asks her picture. She is wearing
  them, SAM 3 finds them at a high score, and so the removal cannot be refused
  for not finding what is plainly there.
*/
if (pixelsIn(eyewear.all) === 0) {
  throw new Error("SAM 3 found no eyeglasses on a face that is wearing them — the walk's own defect");
}
console.log(`  -> "I can't find any glasses" is UNAVAILABLE on this path: ${pixelsIn(eyewear.all).toLocaleString()} px of frames found\n`);

const report: any[] = [];

/* ---------------------------------------------------- 1. FRECKLES ---- */
{
  console.log('=== 1. FRECKLES — "the freckles edit replaced her hairstyle" ===');
  /* A texture edit inside a region that exists: the face-skin matte IS the mask,
     minus the eyes, which are not skin and must not be repainted. */
  const zone = subtractMask(faceSkin.all, await dilateMask(unionMasks(eyes.all, eyewear.all), 4));
  console.log(`  zone ${(coverage(zone) * 100).toFixed(2)}% — her face skin, eyes and frames carved out`);
  const patchBytes = await render(
    "Give her light natural freckles scattered across her nose and cheeks.",
    masterBytes,
  );
  const sized = await sharp(patchBytes).resize(master.width, master.height, { fit: "fill" }).png().toBuffer();
  writeFileSync(`${OUT}/1-freckles-raw.png`, sized);
  const composed = await compositeMasked({
    master, patch: await readRaster(sized), mask: zone, featherRadius: 4,
  });
  writeFileSync(`${OUT}/1-freckles.png`, await writePng(composed.composite));

  const hairKept = movement(master, composed.composite, hair.all);
  const rawHair = movement(master, await readRaster(sized), hair.all);
  const outside = outsideMaskUnchanged(master, composed.composite, composed.applied);
  console.log(`  HER HAIR after the composite: ${hairKept.moved.toLocaleString()} of ${hairKept.pixels.toLocaleString()} px moved  mean ${hairKept.meanDelta.toFixed(2)}`);
  console.log(`  HER HAIR in the painter's raw output: ${rawHair.moved.toLocaleString()} px moved  mean ${rawHair.meanDelta.toFixed(2)}  <- what the walk saw`);
  console.log(`  byte-identity outside the applied mask: ${outside.identical}`);
  report.push({ step: "freckles", hairKept, rawHair, outsideIdentical: outside.identical });
}

/* ---------------------------------------------------- 2. EARRINGS ---- */
{
  console.log('\n=== 2. EARRINGS — "the earrings edit deleted her glasses" ===');
  /* Overlay content that is not there yet, so the destination comes from a
     LANDMARK, never from segmenting an earring nobody is wearing. */
  const lobes = await pointAt(masterBytes, "earlobe");
  const phantom = await pointAt(masterBytes, "wristwatch");
  if (phantom.length > 0) throw new Error("the landmark model located a wristwatch — it is guessing");
  if (lobes.length !== 2) throw new Error(`landmark returned ${lobes.length} lobe(s), expected 2`);
  const span = Math.hypot((lobes[0].x - lobes[1].x) * master.width, (lobes[0].y - lobes[1].y) * master.height);
  const zone = unionMasks(...lobes.map((lobe) => discAt(lobe, span * 0.12, master.width, master.height)));
  console.log(`  zone ${(coverage(zone) * 100).toFixed(2)}% — two discs at the landmark lobes, r=${(span * 0.12).toFixed(0)}px`);

  const patchBytes = await render("Give her small gold stud earrings.", masterBytes);
  const sized = await sharp(patchBytes).resize(master.width, master.height, { fit: "fill" }).png().toBuffer();
  writeFileSync(`${OUT}/2-earrings-raw.png`, sized);

  const patchSubject = await birefnetMatte(sized);
  /*
    ONE SIDE AT A TIME, and the first run of this file got it wrong having
    already written the lesson down for ears. Asked for "earring", SAM 3 returns
    a single instance, so the composite delivered ONE earring while the painter
    had drawn two — a wall that held perfectly and still shipped a wrong picture.
    A bilateral region is two questions. It is two questions everywhere.
  */
  const leftEarring = await sam3(sized, "left earring");
  const rightEarring = await sam3(sized, "right earring");
  const patchEarrings = { all: unionMasks(leftEarring.all, rightEarring.all) };
  const apart = Math.abs(leftEarring.all.data.findIndex((value) => value > 0) % master.width
    - rightEarring.all.data.findIndex((value) => value > 0) % master.width);
  if (apart < master.width * 0.1) {
    throw new Error(`both earring masks landed within ${apart}px horizontally — they are the same earring`);
  }
  /* The depth stack: her hair sits in front of anything at the lobe, so it is
     passed as `occludedBy` and the earring renders behind it by construction. */
  const harvest = await harvestMatteFrom({
    content: patchEarrings.all, matte: patchSubject, occludedBy: hair.all,
  });
  console.log(`  painted earrings ${(coverage(patchEarrings.all) * 100).toFixed(3)}%  harvest ${(coverage(harvest) * 100).toFixed(3)}%`);
  const composed = await compositeMasked({
    master, patch: await readRaster(sized), mask: zone, edgeMatte: harvest, featherRadius: 3,
  });
  writeFileSync(`${OUT}/2-earrings.png`, await writePng(composed.composite));

  const glassesKept = movement(master, composed.composite, eyewear.all);
  const rawGlasses = movement(master, await readRaster(sized), eyewear.all);
  const outside = outsideMaskUnchanged(master, composed.composite, composed.applied);
  console.log(`  HER GLASSES after the composite: ${glassesKept.moved.toLocaleString()} of ${glassesKept.pixels.toLocaleString()} px moved  mean ${glassesKept.meanDelta.toFixed(2)}`);
  console.log(`  HER GLASSES in the painter's raw output: ${rawGlasses.moved.toLocaleString()} px moved  mean ${rawGlasses.meanDelta.toFixed(2)}  <- what the walk saw`);
  console.log(`  byte-identity outside the applied mask: ${outside.identical}`);
  report.push({ step: "earrings", glassesKept, rawGlasses, outsideIdentical: outside.identical });
}

/* ---------------------------------------------------- 3. REMOVAL ---- */
{
  console.log('\n=== 3. REMOVAL — "I can\'t find any glasses", at a face wearing them ===');
  /* Removing frames needs the region they occupy plus room for what was behind
     them; there is no overlay to harvest, because the wanted content is absence. */
  const zone = await dilateMask(eyewear.all, 20);
  console.log(`  zone ${(coverage(zone) * 100).toFixed(2)}% — the frames she is actually wearing, plus room for what is behind them`);
  const patchBytes = await render("Remove her glasses completely. She is not wearing glasses.", masterBytes);
  const sized = await sharp(patchBytes).resize(master.width, master.height, { fit: "fill" }).png().toBuffer();
  writeFileSync(`${OUT}/3-removal-raw.png`, sized);
  const composed = await compositeMasked({
    master, patch: await readRaster(sized), mask: zone, featherRadius: 4,
  });
  writeFileSync(`${OUT}/3-removal.png`, await writePng(composed.composite));

  const framesGone = movement(master, composed.composite, eyewear.all);
  const hairKept = movement(master, composed.composite, hair.all);
  const skinOutside = movement(
    master, composed.composite,
    subtractMask(faceSkin.all, await dilateMask(eyewear.all, 28)),
  );
  const outside = outsideMaskUnchanged(master, composed.composite, composed.applied);
  console.log(`  the frames: ${framesGone.moved.toLocaleString()} of ${framesGone.pixels.toLocaleString()} px moved  mean ${framesGone.meanDelta.toFixed(2)}  <- the edit happened`);
  console.log(`  HER HAIR: ${hairKept.moved.toLocaleString()} of ${hairKept.pixels.toLocaleString()} px moved`);
  console.log(`  HER FACE beyond the zone: ${skinOutside.moved.toLocaleString()} of ${skinOutside.pixels.toLocaleString()} px moved`);
  console.log(`  byte-identity outside the applied mask: ${outside.identical}`);
  report.push({ step: "removal", framesGone, hairKept, skinOutside, outsideIdentical: outside.identical });
}

/* ------------------------------------------- the wall's own panels ---- */
console.log("\nbuilding the panels — master | composite | painter's raw output | difference");
const PANELS: [string, string][] = [
  ["1-freckles", "freckles that do not touch her hair"],
  ["2-earrings", "earrings that do not touch her glasses"],
  ["3-removal", "a removal that can see her face"],
];
for (const [name, caption] of PANELS) {
  const compositeBytes = readFileSync(`${OUT}/${name}.png`);
  const rawBytes = readFileSync(`${OUT}/${name}-raw.png`);
  const diff = await differenceView(masterBytes, compositeBytes, { gain: 6 });
  const rawDiff = await differenceView(masterBytes, rawBytes, { gain: 6 });
  writeFileSync(`${OUT}/DIFF-${name}.png`, diff.panel);
  writeFileSync(`${OUT}/DIFF-${name}-raw.png`, rawDiff.panel);
  console.log(
    `  ${caption}: composite moved ${(diff.changedShare * 100).toFixed(2)}% of the frame, `
    + `the painter's raw output moved ${(rawDiff.changedShare * 100).toFixed(2)}%`,
  );

  const W = 380;
  const cells = await Promise.all([masterBytes, compositeBytes, rawBytes, diff.panel].map(
    (bytes) => sharp(bytes).resize(W).jpeg({ quality: 95 }).toBuffer(),
  ));
  const height = (await sharp(cells[0]).metadata()).height!;
  await sharp({ create: { width: W * 4 + 24, height, channels: 3, background: "#0A0A0A" } })
    .composite(cells.map((input, index) => ({ input, left: index * (W + 8), top: 0 })))
    .jpeg({ quality: 95 })
    .toFile(`${OUT}/WALL-${name}.jpg`);
  report.find((row) => name.includes(row.step))!.frameMoved = { composite: diff.changedShare, raw: rawDiff.changedShare };
}

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ master: MASTER, steps: report }, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);
