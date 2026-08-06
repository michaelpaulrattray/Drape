/**
 * THE RELATIVE CARVE-OUT — the re-run D-220 said it was owed.
 *
 * D-220 settled base-anchoring as the default but could NOT settle the exception
 * for explicitly relative edits, and said so rather than reasoning its way there.
 * The reason was a fixture defect: instruction 3 was relative ("a little longer
 * than this") but rounds 1 and 2 had changed colour and wave, **not length** — so
 * "this" and the base were the same length, both rules had the same referent, and
 * the two could not diverge no matter what they did.
 *
 * The fix is the whole design of this file: **every relative instruction follows
 * a change to THE SAME FACET it is relative to.**
 *
 *   1. "much longer hair, well past her shoulders"   <- moves LENGTH
 *   2. "a bit shorter than this"                     <- relative to LENGTH
 *   3. "shorter again"                               <- relative to LENGTH
 *
 * Now the referents genuinely differ. Under the CHAIN, "this" is the long hair
 * the model is looking at, and shorter-than-long is medium. Under BASE
 * ANCHORING the model sees the original bob plus a recipe, so "this" has no
 * picture to point at — if it resolves against the bob, shorter-than-bob is very
 * short, and the carve-out is real.
 *
 * # The measure
 *
 * Length is measured, not eyeballed: segment the hair on each result and take
 * the **lowest hair pixel** as a fraction of frame height. That is a direct
 * mechanical reading of how long the hair is, and it needs no judge.
 *
 * The prediction is stated BEFORE the run, so the result can contradict it:
 * chain should descend monotonically from long; anchored may undershoot at
 * instruction 2 by cutting from the base rather than from the long hair. If
 * anchored tracks chain, the exception is unnecessary and one rule is simpler
 * than two.
 *
 * # THE RE-RUN, and the confound it exists to remove (D-222)
 *
 * The first run of this file produced a direction and a number, and only the
 * direction survived. Chain came in at 52.3% while anchored sat pinned at 56.3%
 * — and 56.3% was **the zone's own lower boundary**, not her hair. A 90px
 * dilation of a bob reaches about that far, the figure repeated to the decimal
 * across three separate renders, and a repeated figure is what saturation looks
 * like. "Much longer, well past her shoulders" was being cut off by the mask
 * before anyone measured it, so the 3.9pp gap was a FLOOR and not a measurement.
 *
 * Two things change here, and the second is the one that matters:
 *
 *   1. **The zone is generous** — grown until it reaches the bottom of the
 *      frame, so hair asked to go past the shoulders has somewhere to go. That
 *      is free now: the harvest gate keeps only confirmed strands and reverts
 *      every other pixel in the zone to the master, so a zone covering her whole
 *      torso costs nothing and protects her shirt exactly.
 *   2. **Saturation is DETECTED rather than reasoned about afterwards.** Every
 *      reading is compared to the zone's own floor, and a reading that touches it
 *      is reported as clipped and refused as a magnitude. An instrument that
 *      cannot tell you it has hit its ceiling is an instrument that will let you
 *      publish the ceiling as a finding, which is exactly what happened.
 *
 *   npx tsx scripts/calibration/anchoring-relative-rerun.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { coverage, dilateMask, harvestMatteFrom, subtractMask } from "../../server/castingV2/maskGeometry";
import { compositeMasked, outsideMaskUnchanged, readRaster, writePng, type Mask, type Raster } from "../../server/castingV2/maskedComposite";
import { runFalImageJob } from "../../server/providers/falTransport";
import { FAL_GPT_IMAGE_2_EDIT } from "../../server/providers/falImages";
import { birefnetMatte, sam3 } from "./lib/segment.mts";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required");

const OUT = "output/masked/anchoring-relative";
mkdirSync(OUT, { recursive: true });

const SPECIMEN = "output/masked/specimens/wire-04.png";
const FEATHER = 4;
/*
  Grown in PASSES until the zone reaches the bottom of the frame. `dilateMask` is
  a blur-and-threshold, so its reach is not its radius — one call asking for 90
  stopped just below her shoulders and clipped the very instruction the sequence
  opens with. Iterating a modest step accumulates instead of decaying.
*/
const GROW_STEP = 48;
const MAX_PASSES = 16;
/** A reading within this of the zone's floor is the ZONE, not her hair. */
const SATURATION_MARGIN = 0.02;

const SEQUENCE = [
  { text: "much longer hair, well past her shoulders", relative: false },
  { text: "a bit shorter than this", relative: true },
  { text: "shorter again", relative: true },
];

const PRESERVE =
  " Keep her face, identity, bone structure, skin, expression, glasses, pose, "
  + "clothing, lighting and the plain studio background exactly as they are.";

async function toMask(bytes: Buffer): Promise<Mask> {
  const meta = await sharp(bytes).metadata();
  const pipeline = meta.hasAlpha ? sharp(bytes).extractChannel(3) : sharp(bytes).toColourspace("b-w");
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (data.length !== info.width * info.height) throw new Error("mask not single-channel");
  return { data, width: info.width, height: info.height };
}

async function segment(bytes: Buffer, prompt: string): Promise<Mask | null> {
  const response = await fetch("https://fal.run/fal-ai/sam-3/image", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
      "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 3600 }),
    },
    body: JSON.stringify({
      image_url: `data:image/png;base64,${bytes.toString("base64")}`,
      prompt, include_scores: true, output_format: "png",
    }),
  });
  if (!response.ok) throw new Error(`${prompt}: ${(await response.text()).slice(0, 160)}`);
  const json = await response.json() as any;
  if (!Array.isArray(json.masks) || json.masks.length === 0) return null;
  const url = json.masks[0]?.url ?? json.masks[0];
  const raw = url.startsWith("data:")
    ? Buffer.from(url.split(",")[1], "base64")
    : Buffer.from(await (await fetch(url)).arrayBuffer());
  return toMask(raw);
}

/**
 * How long is the hair? The lowest hair pixel, as a fraction of frame height.
 *
 * A row must carry a few hair pixels to count, so one stray speck cannot report
 * waist-length hair — the same reflex as not trusting a single bright pixel.
 */
function hairLength(mask: Mask): number {
  const MIN_RUN = 6;
  for (let y = mask.height - 1; y >= 0; y -= 1) {
    let count = 0;
    for (let x = 0; x < mask.width; x += 1) if (mask.data[y * mask.width + x] > 128) count += 1;
    if (count >= MIN_RUN) return y / mask.height;
  }
  return 0;
}

const baseBytes = readFileSync(SPECIMEN);
const base: Raster = await readRaster(baseBytes);

console.log("building the zone — grown until hair asked past the shoulders cannot be clipped…");
const hair = await segment(baseBytes, "hair");
const face = await segment(baseBytes, "face skin");
if (!hair || !face) throw new Error("could not segment the base");

/** The lowest row the zone reaches, as a fraction of frame height — its floor. */
function zoneFloor(mask: Mask): number {
  for (let y = mask.height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < mask.width; x += 1) if (mask.data[y * mask.width + x] > 0) return y / mask.height;
  }
  return 0;
}

let grown = hair;
let passes = 0;
while (zoneFloor(grown) < 0.97 && passes < MAX_PASSES) {
  grown = await dilateMask(grown, GROW_STEP);
  passes += 1;
}
const zone = subtractMask(grown, face);
const floor = zoneFloor(zone);
const baseLength = hairLength(hair);
console.log(`  zone ${(coverage(zone) * 100).toFixed(2)}% after ${passes} pass(es), floor at ${(floor * 100).toFixed(1)}% down the frame`);
console.log(`  base hair reaches ${(baseLength * 100).toFixed(1)}%`);
if (floor < 0.9) {
  /* Loud. A clipped instrument reports the mask's shape as the model's answer,
     which is the exact defect this re-run exists to remove. */
  throw new Error(
    `the zone only reaches ${(floor * 100).toFixed(1)}% down the frame — "much longer, well past `
    + "her shoulders" + `" would be clipped and every magnitude below would be the mask's`,
  );
}
console.log("");

console.log("PREDICTION, recorded before the run: chain descends monotonically from long;");
console.log("anchored may undershoot at step 2 by cutting from the BASE rather than the long hair.\n");

const rows: any[] = [];
for (const rule of ["chain", "anchored"] as const) {
  console.log(`### ${rule}`);
  let currentMaster = baseBytes;
  for (let round = 0; round < SEQUENCE.length; round += 1) {
    const source = rule === "chain" ? currentMaster : baseBytes;
    const prompt = rule === "chain"
      ? `Change only this woman's hair: ${SEQUENCE[round].text}.`
      : `Change only this woman's hair: ${SEQUENCE.slice(0, round + 1).map((s) => s.text).join(", then ")}.`;

    const job = await runFalImageJob({
      apiKey: apiKey!,
      endpoint: FAL_GPT_IMAGE_2_EDIT,
      body: {
        prompt: prompt + PRESERVE,
        image_urls: [`data:image/png;base64,${source.toString("base64")}`],
        num_images: 1, quality: "high", output_format: "png",
      },
      timeoutMs: 300_000,
      pollIntervalMs: 1_500,
    });
    const meta = await sharp(job.bytes).metadata();
    const sized = meta.width !== base.width || meta.height !== base.height
      ? await sharp(job.bytes).resize(base.width, base.height, { fit: "fill" }).png().toBuffer()
      : job.bytes;

    /*
      THE HARVEST GATE, and it is what makes the generous zone free. The zone now
      covers her whole torso; without this the composite would take the painter's
      shirt and shoulders along with the hair. With it, only confirmed strands
      survive and every other pixel in the zone reverts to her.
    */
    const patchSubject = await birefnetMatte(sized);
    const patchHair = await sam3(sized, "hair");
    const harvest = await harvestMatteFrom({ content: patchHair.all, matte: patchSubject });

    const { composite, applied } = await compositeMasked({
      master: base, patch: await readRaster(sized), mask: zone, edgeMatte: harvest, featherRadius: FEATHER,
    });
    const outside = outsideMaskUnchanged(base, composite, applied);
    const compositeBytes = await writePng(composite);
    writeFileSync(`${OUT}/${rule}-${round + 1}.png`, compositeBytes);
    currentMaster = compositeBytes;

    const resultHair = await segment(compositeBytes, "hair");
    const length = resultHair ? hairLength(resultHair) : 0;
    /* Is this her hair, or the edge of the mask? Asked every time, not once. */
    const clipped = length >= floor - SATURATION_MARGIN;
    console.log(
      `  ${round + 1}. "${SEQUENCE[round].text}"${SEQUENCE[round].relative ? " [relative]" : ""}`
      + `  hair reaches ${(length * 100).toFixed(1)}%`
      + `  (base ${(baseLength * 100).toFixed(1)}%, zone floor ${(floor * 100).toFixed(1)}%)`
      + `${clipped ? "  ** CLIPPED — this is the zone, not the hair **" : ""}`
      + `  outside ${outside.identical ? "identical" : `CHANGED ${outside.changedPixels}`}`,
    );
    rows.push({
      rule, round: round + 1, instruction: SEQUENCE[round].text, relative: SEQUENCE[round].relative,
      length, clipped, outsideIdentical: outside.identical,
    });
  }
  console.log("");
}

const W = 300;
const H = 450;
for (const rule of ["chain", "anchored"] as const) {
  const cells: Buffer[] = [await sharp(baseBytes).resize(W, H, { fit: "fill" }).jpeg({ quality: 92 }).toBuffer()];
  for (let round = 1; round <= SEQUENCE.length; round += 1) {
    cells.push(await sharp(readFileSync(`${OUT}/${rule}-${round}.png`)).resize(W, H, { fit: "fill" }).jpeg({ quality: 92 }).toBuffer());
  }
  await sharp({ create: { width: W * cells.length, height: H, channels: 3, background: "#0A0A0A" } })
    .composite(cells.map((input, index) => ({ input, left: index * W, top: 0 })))
    .jpeg({ quality: 93 }).toFile(`${OUT}/STRIP-${rule}.jpg`);
}

console.log("=== does the relative instruction resolve differently? ===");
const chain = rows.filter((row) => row.rule === "chain");
const anchored = rows.filter((row) => row.rule === "anchored");
let anyClipped = false;
for (let round = 0; round < SEQUENCE.length; round += 1) {
  const gap = Math.abs(chain[round].length - anchored[round].length);
  const clipped = chain[round].clipped || anchored[round].clipped;
  if (clipped) anyClipped = true;
  console.log(
    `  step ${round + 1}${SEQUENCE[round].relative ? " [relative]" : "          "}`
    + `  chain ${(chain[round].length * 100).toFixed(1)}%  anchored ${(anchored[round].length * 100).toFixed(1)}%`
    + `  gap ${(gap * 100).toFixed(1)}pp`
    + `${clipped ? "  — CLIPPED, gap is a FLOOR not a measurement" : ""}`,
  );
}
/*
  THE VERDICT IS PER STEP, not per run, and the first version was not — it
  refused the whole run because step 1 touched the floor. Step 1 is the ABSOLUTE
  instruction ("much longer, well past her shoulders"), and hair drawn to the
  bottom of the frame is the FRAME's limit rather than the mask's. The relative
  steps are the ones the carve-out is about, and if they are clear of the floor
  their gaps are measurements whatever step 1 did.
*/
const relativeClipped = SEQUENCE
  .map((step, index) => step.relative && (chain[index].clipped || anchored[index].clipped))
  .some(Boolean);
console.log(
  relativeClipped
    ? "\nVERDICT: a RELATIVE step touched the zone's floor. D-222's confound survives where it\n"
      + "matters and no magnitude may be quoted — grow the zone further."
    : "\nVERDICT: every RELATIVE step is clear of the zone's floor, so D-222's confound is\n"
      + "REMOVED where the carve-out lives and those gaps are measurements rather than floors."
      + (anyClipped
        ? "\n(Step 1 did touch the floor. That is the absolute instruction reaching the bottom of\n"
          + "the FRAME, so its own magnitude still does not count — but it does not contaminate\n"
          + "the relative steps, which start from whatever step 1 produced either way.)"
        : ""),
);
writeFileSync(`${OUT}/results.json`, `${JSON.stringify({
  specimen: SPECIMEN, baseLength, zoneFloor: floor, saturationMargin: SATURATION_MARGIN,
  anyClipped, sequence: SEQUENCE, rows,
}, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);
