/**
 * THE FRINGE FIXTURE — the harvest gate with NO geometry helping it.
 *
 * Every fixture so far protected the face with a carve-out and then asked
 * whether the composite held. This one takes the carve-out away.
 *
 * A fringe has to cross the forehead, so the founder's law is explicit that the
 * geometric protection yields here: *the zone may cover any territory the style
 * reaches; protection is at HARVEST.* Only matte-confirmed strands survive, and
 * every other pixel inside the zone reverts to the master — so the skin BETWEEN
 * the strands is her own skin, at 30% alpha where a strand is 30% there.
 *
 * That means this fixture runs with **no exclusions at all**: no face carve-out,
 * no frame exclusion, nothing subtracted last. If the harvest gate holds when it
 * is the only thing standing between a whole-frame repaint and her face, it
 * holds. If it does not, this is where that is discovered — on a fixture, before
 * the product path, which is the entire point of the order these were done in.
 *
 * # Two cases, because the gate has two kinds of neighbour
 *
 *   FRINGE      strands over her FOREHEAD. The assertion is that master skin
 *               survives between them — a fringe that composites as a solid
 *               block has not been harvested, it has been pasted.
 *   HAIR DOWN   strands over her SHIRT. The assertion is that the shirt between
 *               and beneath them diffs BLACK against the master, which is
 *               person-never-stage enforced by subtraction rather than by asking
 *               a model to be careful.
 *
 * One specimen for both, so the two differ in the instruction and nothing else.
 *
 * # What is at risk, stated before the run
 *
 * With no carve-out, her EYES, her MOUTH and her GLASSES are inside the zone and
 * are protected only by not being hair. Those three are measured per region and
 * reported whether or not they are flattering, because a gate that leaks onto a
 * mouth is a finding this fixture exists to produce.
 *
 *   npx tsx scripts/calibration/fringe-fixture.mts [--engine gpt2]
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
import { birefnetMatte, sam3 } from "./lib/segment.mts";
import { differenceView } from "./lib/differenceView.mts";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required");

const OUT = "output/masked/fringe-fixture";
mkdirSync(OUT, { recursive: true });

/** Hair up in a bun, wide open forehead, fine wire glasses, grey tee on grey. */
const MASTER = "output/masked/specimens/wire-02.png";
const GROW_STEP = 48;
const MAX_PASSES = 14;

type Case = {
  name: string;
  instruction: string;
  /** What the style must reach before the zone is generous enough to test. */
  reaches: "forehead" | "shirt";
};

const CASES: Case[] = [
  {
    name: "fringe",
    instruction:
      "Give her a soft, wispy fringe of fine hair falling across her forehead, "
      + "with individual strands and gaps between them. Change nothing else about her.",
    reaches: "forehead",
  },
  {
    name: "hair-down",
    instruction:
      "Let her hair down out of the bun: long, loose hair falling over her shoulders "
      + "and onto her chest. Change nothing else about her.",
    reaches: "shirt",
  },
];

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

function pixelsIn(mask: Mask): number {
  let count = 0;
  for (let index = 0; index < mask.data.length; index += 1) if (mask.data[index] > 0) count += 1;
  return count;
}

/** How far a composite moved off the master, over one named region. */
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

/**
 * IS THIS A HARVEST OR A PASTED BLOCK? — the assertion a coverage number cannot
 * make.
 *
 * Inside the area the new hair actually claims, a wispy fringe leaves skin
 * showing between strands and a soft alpha at their edges. A block does not. So
 * the harvest matte is read as three populations over the neighbour region:
 * fully hair, partly hair (a strand edge), and untouched master. A real fringe
 * has all three; a paste has only the first.
 */
function harvestTexture(harvest: Mask, neighbour: Mask): {
  claimed: number;
  solid: number;
  blended: number;
  master: number;
} {
  /* Only where the fringe reached — elsewhere "all master" is trivially true. */
  let solid = 0;
  let blended = 0;
  let masterPixels = 0;
  let claimed = 0;
  for (let pixel = 0; pixel < neighbour.data.length; pixel += 1) {
    if (neighbour.data[pixel] === 0) continue;
    claimed += 1;
    const alpha = harvest.data[pixel];
    if (alpha === 0) masterPixels += 1;
    else if (alpha >= 250) solid += 1;
    else blended += 1;
  }
  return { claimed, solid, blended, master: masterPixels };
}

async function writeMask(mask: Mask, name: string): Promise<void> {
  await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
    .png()
    .toFile(`${OUT}/${name}.png`);
}

/* -------------------------------------------------------------------- run */

const masterBytes = readFileSync(MASTER);
const master: Raster = await readRaster(masterBytes);
const masterUri = `data:image/png;base64,${masterBytes.toString("base64")}`;
console.log(`master ${MASTER} ${master.width}x${master.height}\n`);

console.log("segmenting the master — every prompt record-gated (D-213)…");
const hair = await sam3(masterBytes, "hair");
const faceSkin = await sam3(masterBytes, "face skin");
const shirt = await sam3(masterBytes, "t-shirt");
const eyes = await sam3(masterBytes, "eyes");
const mouth = await sam3(masterBytes, "lips");
const eyewear = await sam3(masterBytes, "eyeglasses");
const subject = await birefnetMatte(masterBytes);
for (const [label, result] of [
  ["hair", hair], ["face skin", faceSkin], ["t-shirt", shirt],
  ["eyes", eyes], ["lips", mouth], ["eyeglasses", eyewear],
] as const) {
  console.log(`  ${label.padEnd(10)} ${(coverage(result.all) * 100).toFixed(2)}%  ${result.instances} instance(s)  scores ${result.scores.map((s) => s?.toFixed(3)).join(", ")}`);
}
console.log(`  subject    ${(coverage(subject) * 100).toFixed(2)}%  ramp ${(rampShare(subject) * 100).toFixed(1)}%\n`);

/*
  THE FOREHEAD, derived rather than drawn. It is the part of her face skin
  ABOVE her glasses — a landmark the segmentation already gives us, so no
  ellipse is invented for it (the maskGeometry rasteriser says why).
*/
let browLine = master.height;
for (let pixel = 0; pixel < eyewear.all.data.length; pixel += 1) {
  if (eyewear.all.data[pixel] === 0) continue;
  const y = Math.floor(pixel / master.width);
  if (y < browLine) browLine = y;
}
const forehead: Mask = {
  data: Buffer.from(faceSkin.all.data.map((value, index) => (Math.floor(index / master.width) < browLine ? value : 0))),
  width: master.width,
  height: master.height,
};
console.log(`forehead = face skin above the glasses (y < ${browLine}) — ${(coverage(forehead) * 100).toFixed(2)}%`);
await writeMask(forehead, "MASK-forehead");

const NEIGHBOUR: Record<Case["reaches"], Mask> = { forehead, shirt: shirt.all };

const report: any[] = [];
for (const scenario of CASES) {
  console.log(`\n=== ${scenario.name} — "${scenario.instruction.slice(0, 62)}…" ===`);
  const neighbour = NEIGHBOUR[scenario.reaches];

  /*
    THE ZONE. Grown until it genuinely covers the territory the instruction
    needs, and then **nothing is subtracted from it** — no face, no frames, no
    eyes. The harvest gate is the only protection in this fixture, on purpose.
  */
  let grown = hair.all;
  let passes = 0;
  const covered = (mask: Mask) => pixelsIn(intersectMask(mask, neighbour));
  const needed = Math.round(pixelsIn(neighbour) * 0.5);
  while (covered(grown) < needed && passes < MAX_PASSES) {
    grown = await dilateMask(grown, GROW_STEP);
    passes += 1;
  }
  if (covered(grown) < needed) {
    throw new Error(`the zone reaches only ${covered(grown)} of ${needed} ${scenario.reaches} pixels after ${passes} passes`);
  }
  const zone = grown;
  console.log(`  zone ${(coverage(zone) * 100).toFixed(2)}% after ${passes} pass(es), covering ${covered(zone).toLocaleString()} ${scenario.reaches} px — nothing excluded`);
  await writeMask(zone, `MASK-zone-${scenario.name}`);

  /* ---- render: full-frame context, local harvest ---- */
  console.log("  rendering…");
  const started = Date.now();
  const job = await runFalImageJob({
    apiKey,
    endpoint: FAL_GPT_IMAGE_2_EDIT,
    body: {
      prompt: scenario.instruction,
      image_urls: [masterUri],
      num_images: 1,
      quality: "medium",
      output_format: "png",
    },
    timeoutMs: 300_000,
    pollIntervalMs: 1_500,
  });
  /* The transport already downloads the bytes — fal's CDN expires them in an
     hour, so it never hands back a URL to fetch later. */
  const returned = job.bytes;
  const returnedMeta = await sharp(returned).metadata();
  /* Master hygiene: the MASTER is never resampled. The patch is, and it is
     stated rather than hidden — we are about to discard most of it anyway. */
  const patchBytes = returnedMeta.width === master.width && returnedMeta.height === master.height
    ? returned
    : await sharp(returned).resize(master.width, master.height, { fit: "fill" }).png().toBuffer();
  const patch: Raster = await readRaster(patchBytes);
  writeFileSync(`${OUT}/${scenario.name}-raw.png`, patchBytes);
  console.log(`  returned ${returnedMeta.width}x${returnedMeta.height} in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  /* ---- the harvest ---- */
  const patchSubject = await birefnetMatte(patchBytes);
  const patchHair = await sam3(patchBytes, "hair");
  const harvest = await harvestMatteFrom({ content: patchHair.all, matte: patchSubject });
  await writeMask(harvest, `MASK-harvest-${scenario.name}`);
  console.log(`  harvest matte ${(coverage(harvest) * 100).toFixed(2)}%  ramp ${(rampShare(harvest) * 100).toFixed(1)}%`);

  const composed = await compositeMasked({ master, patch, mask: zone, edgeMatte: harvest, featherRadius: 4 });
  writeFileSync(`${OUT}/${scenario.name}.png`, await writePng(composed.composite));
  const outside = outsideMaskUnchanged(master, composed.composite, composed.applied);

  /*
    ASSERTION ONE — the strands actually landed. Without this, every protection
    figure below is the trivial success of an edit that did nothing.
  */
  const reached = pixelsIn(intersectMask(harvest, neighbour));
  const texture = harvestTexture(harvest, neighbour);

  /*
    ASSERTION TWO — everything in the zone that is NOT confirmed hair is HERS,
    byte for byte. This is the harvest law stated as a comparison.
  */
  const unclaimed: Mask = {
    data: Buffer.from(neighbour.data.map((value, index) => (harvest.data[index] === 0 ? value : 0))),
    width: master.width,
    height: master.height,
  };
  const kept = movement(master, composed.composite, intersectMask(unclaimed, zone));

  /* ASSERTION THREE — the regions with no protection but not-being-hair. */
  const perRegion = {
    eyes: movement(master, composed.composite, eyes.all),
    lips: movement(master, composed.composite, mouth.all),
    eyeglasses: movement(master, composed.composite, eyewear.all),
  };

  const diff = await differenceView(masterBytes, readFileSync(`${OUT}/${scenario.name}.png`), { gain: 6 });
  writeFileSync(`${OUT}/DIFF-${scenario.name}.png`, diff.panel);

  console.log(`  byte-identity outside the applied mask   ${outside.identical}`);
  console.log(`  strands landed on the ${scenario.reaches}: ${reached.toLocaleString()} px`
    + `  (solid ${texture.solid.toLocaleString()} / blended ${texture.blended.toLocaleString()} / master ${texture.master.toLocaleString()})`);
  console.log(`  HER ${scenario.reaches} where no strand landed: ${kept.moved.toLocaleString()} of ${kept.pixels.toLocaleString()} px moved`
    + `  mean ${kept.meanDelta.toFixed(2)}  max ${kept.maxDelta.toFixed(0)} levels`);
  for (const [region, figure] of Object.entries(perRegion)) {
    console.log(`  ${region.padEnd(11)} ${figure.moved.toLocaleString()} of ${figure.pixels.toLocaleString()} px moved  mean ${figure.meanDelta.toFixed(2)}  max ${figure.maxDelta.toFixed(0)}`);
  }
  console.log(`  frame moved ${(diff.changedShare * 100).toFixed(2)}%, max ${diff.maxDelta} levels`);

  report.push({
    case: scenario.name,
    instruction: scenario.instruction,
    zone: { coverage: coverage(zone), passes, excluded: "nothing" },
    harvest: { coverage: coverage(harvest), ramp: rampShare(harvest) },
    outsideIdentical: outside.identical,
    strandsLanded: reached,
    texture,
    neighbourKept: kept,
    perRegion,
    frameMoved: diff.changedShare,
  });

  /* The founder's bar: master | composite | difference, at 100%, lossless. */
  const box = scenario.reaches === "forehead"
    ? { left: 262, top: 200, width: 500, height: 340 }
    : { left: 180, top: 820, width: 664, height: 460 };
  const cells = [
    await sharp(masterBytes).extract(box).png().toBuffer(),
    await sharp(readFileSync(`${OUT}/${scenario.name}.png`)).extract(box).png().toBuffer(),
    await sharp(diff.panel).extract(box).png().toBuffer(),
  ];
  await sharp({ create: { width: box.width, height: box.height * 3 + 16, channels: 3, background: "#0A0A0A" } })
    .composite(cells.map((input, index) => ({ input, left: 0, top: index * (box.height + 8) })))
    .png()
    .toFile(`${OUT}/JUDGE-${scenario.name}.png`);
  console.log(`  JUDGE-${scenario.name}.png — master / composite / difference (${diff.gain}x), lossless, 100%`);
}

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ master: MASTER, browLine, cases: report }, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);
