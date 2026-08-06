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
 *   npx tsx scripts/calibration/anchoring-relative-rerun.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { coverage, dilateMask, subtractMask, type Mask } from "../../server/castingV2/maskGeometry";
import { compositeMasked, outsideMaskUnchanged, readRaster, writePng, type Raster } from "../../server/castingV2/maskedComposite";
import { runFalImageJob } from "../../server/providers/falTransport";
import { FAL_GPT_IMAGE_2_EDIT } from "../../server/providers/falImages";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required");

const OUT = "output/masked/anchoring-relative";
mkdirSync(OUT, { recursive: true });

const SPECIMEN = "output/masked/specimens/wire-04.png";
const FEATHER = 4;
/* Generous, because the sequence deliberately GROWS hair first and a zone cut to
   the bob would clip the long version — D-218's silhouette law, obeyed. */
const PAD = 90;

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

console.log("building the zone (padded for the growth this sequence asks for)…");
const hair = await segment(baseBytes, "hair");
const face = await segment(baseBytes, "face skin");
if (!hair || !face) throw new Error("could not segment the base");
const zone = subtractMask(await dilateMask(hair, PAD), face);
const baseLength = hairLength(hair);
console.log(`  zone ${(coverage(zone) * 100).toFixed(2)}%  base hair reaches ${(baseLength * 100).toFixed(1)}% down the frame\n`);

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

    const { composite, applied } = await compositeMasked({
      master: base, patch: await readRaster(sized), mask: zone, featherRadius: FEATHER,
    });
    const outside = outsideMaskUnchanged(base, composite, applied);
    const compositeBytes = await writePng(composite);
    writeFileSync(`${OUT}/${rule}-${round + 1}.png`, compositeBytes);
    currentMaster = compositeBytes;

    const resultHair = await segment(compositeBytes, "hair");
    const length = resultHair ? hairLength(resultHair) : 0;
    console.log(
      `  ${round + 1}. "${SEQUENCE[round].text}"${SEQUENCE[round].relative ? " [relative]" : ""}`
      + `  hair reaches ${(length * 100).toFixed(1)}%`
      + `  (base ${(baseLength * 100).toFixed(1)}%)`
      + `  outside ${outside.identical ? "identical" : `CHANGED ${outside.changedPixels}`}`,
    );
    rows.push({ rule, round: round + 1, instruction: SEQUENCE[round].text, relative: SEQUENCE[round].relative, length, outsideIdentical: outside.identical });
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
for (let round = 0; round < SEQUENCE.length; round += 1) {
  const gap = Math.abs(chain[round].length - anchored[round].length);
  console.log(
    `  step ${round + 1}${SEQUENCE[round].relative ? " [relative]" : "          "}`
    + `  chain ${(chain[round].length * 100).toFixed(1)}%  anchored ${(anchored[round].length * 100).toFixed(1)}%`
    + `  gap ${(gap * 100).toFixed(1)}pp`,
  );
}
writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ specimen: SPECIMEN, baseLength, sequence: SEQUENCE, rows }, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);
