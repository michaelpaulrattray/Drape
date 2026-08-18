/**
 * WITHIN-REGION ANCHORING — founder question, settled on the hair fixture.
 *
 * When an edit repeats on the SAME region, where do the pixels come from?
 *
 *   CHAIN   the current master's region. Bounded — the mask still confines it —
 *           but every round resamples the previous round's output, so whatever
 *           a generation costs in detail is paid again each time.
 *   BASE    the BASE image's region plus the accumulated region recipe. Every
 *           same-region edit is generation one.
 *
 * D-152 settled this at WHOLE-IMAGE scale — "pixels teach, words remember" —
 * after v2's parent-pixel pin cost quality and went visibly blurred six deep.
 * The open question is whether the same answer holds at REGION scale, where the
 * mask already bounds the damage and the chain is much shorter.
 *
 * It is not obvious in advance. The argument for the chain at region scale is
 * real: a relative instruction ("a bit shorter than this") has no referent
 * except the current look, and base-anchoring has to reconstruct that referent
 * from words. So the seat's recommendation — base by default, chain reserved for
 * explicitly relative edits — is a hypothesis this measures rather than assumes.
 *
 * # The instrument
 *
 * Both rules run the SAME five-instruction sequence on the SAME region of the
 * SAME face, so the only difference is where round N's pixels came from.
 * Instruction 3 is deliberately RELATIVE ("a little longer"), because that is
 * the case the recommendation carves out, and a fixture that only tested
 * absolute instructions would answer an easier question than the one asked.
 *
 * Measured per round, both mechanical, both against the base:
 *
 *   sharpness   Laplacian variance of the REGION, as a ratio to the base
 *               region. The gauntlet's gate is 0.75 — below 75% of the
 *               original's detail is flagged. This is the metric that caught
 *               v2's photocopy loss.
 *   tone        mean luminance of the region, as a ratio to base. Reported, not
 *               gated — a colour instruction is SUPPOSED to move tone, so a
 *               tripwire here would cry wolf on the edit it was asked to make
 *               (the D-147 lesson).
 *
 * Steadiness — whether round 1's instruction is still visible at round 5 — gets
 * a strip for the founder's eye. No metric is claimed for it, because the honest
 * measure is a judge and this fixture is deliberately model-free.
 *
 *   npx tsx scripts/calibration/within-region-anchoring.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { coverage, dilateMask, subtractMask } from "../../server/castingV2/maskGeometry";
import type { Mask } from "../../server/castingV2/maskedComposite";
import {
  compositeMasked,
  outsideMaskUnchanged,
  readRaster,
  writePng,
  type Raster,
} from "../../server/castingV2/maskedComposite";
import { runFalImageJob } from "../../server/providers/falTransport";
import { FAL_GPT_IMAGE_2_EDIT } from "../../server/providers/falImages";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required");

const OUT = "output/masked/anchoring";
mkdirSync(OUT, { recursive: true });

const SPECIMEN = "output/masked/specimens/wire-04.png";
const FEATHER = 4;
const PAD = 20;

/**
 * Five instructions on one region, cumulative.
 *
 * Number 3 is relative on purpose — it is the case the seat's recommendation
 * reserves for the chain, so it has to be inside the sequence rather than
 * politely left out.
 */
const SEQUENCE = [
  { text: "copper red hair", relative: false },
  { text: "loose waves through it", relative: false },
  { text: "a little longer than this", relative: true },
  { text: "lighter, strawberry blonde", relative: false },
  { text: "swept over to one side", relative: false },
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

async function fal(endpoint: string, body: Record<string, unknown>) {
  const response = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
      "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 3600 }),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${endpoint}: ${(await response.text()).slice(0, 180)}`);
  return response.json() as any;
}

async function segment(dataUri: string, prompt: string): Promise<Mask> {
  const json = await fal("fal-ai/sam-3/image", {
    image_url: dataUri, prompt, include_scores: true, output_format: "png",
  });
  if (!Array.isArray(json.masks) || json.masks.length === 0) throw new Error(`"${prompt}" returned nothing`);
  const url = json.masks[0]?.url ?? json.masks[0];
  const bytes = url.startsWith("data:")
    ? Buffer.from(url.split(",")[1], "base64")
    : Buffer.from(await (await fetch(url)).arrayBuffer());
  return toMask(bytes);
}

/**
 * Laplacian variance INSIDE the mask only.
 *
 * Measuring the whole frame would average the region's detail against an
 * unchanged face and a flat backdrop, which is most of the picture — the signal
 * would be swamped by pixels that are byte-identical by construction. D-147's
 * lesson in its general form: a metric that returns nearly the same number
 * whatever happens is measuring the wrong thing.
 */
async function regionSharpness(raster: Raster, mask: Mask): Promise<number> {
  const grey = await sharp(raster.data, {
    raw: { width: raster.width, height: raster.height, channels: 3 },
  }).toColourspace("b-w").raw().toBuffer({ resolveWithObject: true });
  if (grey.data.length !== raster.width * raster.height) {
    throw new Error(`sharpness stride wrong: ${grey.data.length} (channels=${grey.info.channels})`);
  }
  const { width, height } = raster;
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = y * width + x;
      if (mask.data[at] < 128) continue;
      const laplace = 4 * grey.data[at]
        - grey.data[at - 1] - grey.data[at + 1]
        - grey.data[at - width] - grey.data[at + width];
      sum += laplace;
      sumSquares += laplace * laplace;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSquares / count - mean * mean;
}

function regionTone(raster: Raster, mask: Mask): number {
  let total = 0;
  let count = 0;
  for (let pixel = 0; pixel < mask.data.length; pixel += 1) {
    if (mask.data[pixel] < 128) continue;
    const at = pixel * 3;
    total += (raster.data[at] + raster.data[at + 1] + raster.data[at + 2]) / 3;
    count += 1;
  }
  return count === 0 ? 0 : total / count;
}

async function renderFrom(source: Buffer, prompt: string): Promise<Buffer> {
  const job = await runFalImageJob({
    apiKey: apiKey!,
    endpoint: FAL_GPT_IMAGE_2_EDIT,
    body: {
      prompt: prompt + PRESERVE,
      image_urls: [`data:image/png;base64,${source.toString("base64")}`],
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

const baseBytes = readFileSync(SPECIMEN);
const baseUri = `data:image/png;base64,${baseBytes.toString("base64")}`;
const base: Raster = await readRaster(baseBytes);

console.log("building the region's destination zone…");
const hair = await segment(baseUri, "hair");
const face = await segment(baseUri, "face skin");
/* ONE zone, fixed for the whole sequence — a region's destination zone does not
   move because an instruction was added, and letting it move would confound the
   two rules with a third variable. */
const zone = subtractMask(await dilateMask(hair, PAD), face);
console.log(`  hair ${(coverage(hair) * 100).toFixed(2)}%  zone ${(coverage(zone) * 100).toFixed(2)}%`);

const baseSharp = await regionSharpness(base, zone);
const baseTone = regionTone(base, zone);
console.log(`  base region sharpness ${baseSharp.toFixed(1)}  tone ${baseTone.toFixed(1)}\n`);

const rows: any[] = [];
const finals: Record<string, Buffer[]> = { base: [baseBytes], chain: [], anchored: [] };

for (const rule of ["chain", "anchored"] as const) {
  console.log(`### ${rule}`);
  /* Annotated for the engine buffer the loop assigns back into it — see
     `specimens.mts`, same shape, same reason. */
  let currentMaster: Buffer = baseBytes;
  for (let round = 0; round < SEQUENCE.length; round += 1) {
    /*
      The only difference between the two rules, and it is one line each:
      CHAIN sends the CURRENT composite and the NEW instruction alone.
      BASE sends the ORIGINAL and the WHOLE recipe so far.
    */
    const source = rule === "chain" ? currentMaster : baseBytes;
    const prompt = rule === "chain"
      ? `Change only this woman's hair: ${SEQUENCE[round].text}.`
      : `Change only this woman's hair: ${SEQUENCE.slice(0, round + 1).map((s) => s.text).join(", then ")}.`;

    const patchBytes = await renderFrom(source, prompt);
    const meta = await sharp(patchBytes).metadata();
    const sized = meta.width !== base.width || meta.height !== base.height
      ? await sharp(patchBytes).resize(base.width, base.height, { fit: "fill" }).png().toBuffer()
      : patchBytes;
    const patch = await readRaster(sized);

    /* Composited onto the BASE master either way — the composite's job is
       unchanged by the sourcing rule, and holding it fixed is what keeps this a
       one-variable experiment. */
    const { composite, applied } = await compositeMasked({ master: base, patch, mask: zone, featherRadius: FEATHER });
    const outside = outsideMaskUnchanged(base, composite, applied);
    const compositeBytes = await writePng(composite);

    const sharpness = await regionSharpness(composite, zone);
    const tone = regionTone(composite, zone);
    const ratio = sharpness / baseSharp;

    writeFileSync(`${OUT}/${rule}-${round + 1}.png`, compositeBytes);
    currentMaster = compositeBytes;
    if (round === SEQUENCE.length - 1) finals[rule].push(compositeBytes);

    console.log(
      `  ${round + 1}. "${SEQUENCE[round].text}"${SEQUENCE[round].relative ? " [relative]" : ""}`
      + `  sharpness ${(ratio * 100).toFixed(0)}%${ratio < 0.75 ? " ** BELOW THE 0.75 GATE **" : ""}`
      + `  tone ${((tone / baseTone) * 100).toFixed(0)}%`
      + `  outside ${outside.identical ? "identical" : `CHANGED ${outside.changedPixels}`}`,
    );
    rows.push({
      rule, round: round + 1, instruction: SEQUENCE[round].text, relative: SEQUENCE[round].relative,
      sharpness, sharpnessRatio: ratio, tone, toneRatio: tone / baseTone,
      outsideIdentical: outside.identical,
    });
  }
  console.log("");
}

/* Strips — steadiness is an eye question and gets an exhibit, not a number. */
const W = 300;
const H = 450;
for (const rule of ["chain", "anchored"] as const) {
  const cells: Buffer[] = [await sharp(baseBytes).resize(W, H, { fit: "fill" }).jpeg({ quality: 92 }).toBuffer()];
  for (let round = 1; round <= SEQUENCE.length; round += 1) {
    cells.push(await sharp(readFileSync(`${OUT}/${rule}-${round}.png`)).resize(W, H, { fit: "fill" }).jpeg({ quality: 92 }).toBuffer());
  }
  await sharp({ create: { width: W * cells.length, height: H, channels: 3, background: "#0A0A0A" } })
    .composite(cells.map((input, index) => ({ input, left: index * W, top: 0 })))
    .jpeg({ quality: 93 })
    .toFile(`${OUT}/STRIP-${rule}.jpg`);
}

console.log("=== verdict material ===");
for (const rule of ["chain", "anchored"] as const) {
  const final = rows.filter((row) => row.rule === rule).at(-1)!;
  const worst = Math.min(...rows.filter((row) => row.rule === rule).map((row) => row.sharpnessRatio));
  console.log(`  ${rule.padEnd(9)} final sharpness ${(final.sharpnessRatio * 100).toFixed(0)}%  worst round ${(worst * 100).toFixed(0)}%`);
}
writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ specimen: SPECIMEN, sequence: SEQUENCE, baseSharp, baseTone, rows }, null, 2)}\n`);
console.log(`\nwritten to ${OUT} — steadiness is the founder's eye on STRIP-chain.jpg vs STRIP-anchored.jpg`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
