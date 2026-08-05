/**
 * SHOPPING FAL'S SEGMENTATION CATALOGUE — verify each endpoint RUNS before it
 * enters the routing table (founder order, D-212).
 *
 * No model id in this file was recalled from memory. Each was found in the
 * catalogue and its request schema read from fal's own OpenAPI
 * (`/api/openapi/queue/openapi.json?endpoint_id=...`), because a guessed field
 * name is accepted silently and does nothing — D-202's class, and the reason
 * D-208's header was looked up rather than remembered.
 *
 * What this measures, per candidate:
 *   runs         did the endpoint answer at all, and with a mask
 *   coverage     alpha-weighted, so a faint halo is not scored as solid area
 *   softness     share of pixels strictly between 0 and 255 — a MATTE has an
 *                edge, a binary outline does not, and the founder's rider says
 *                soft boundaries must be mattes
 *
 * Masks are saved so the founder can look at them. Nothing is chosen here; this
 * produces the routing-table draft's evidence column.
 *
 *   npx tsx scripts/calibration/segmentation-shop.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

import { coverage } from "../../server/castingV2/maskGeometry";

const KEY = process.env.FAL_KEY;
if (!KEY) throw new Error("FAL_KEY required");

const SPECIMEN = "output/quality-unit/specimens/built-base.png";
const OUT = "output/masked/segmentation-shop";

const image = readFileSync(SPECIMEN);
const dataUri = `data:image/png;base64,${image.toString("base64")}`;
const meta = await sharp(image).metadata();
const WIDTH = meta.width ?? 1024;
const HEIGHT = meta.height ?? 1536;

async function run(endpoint: string, body: Record<string, unknown>) {
  const started = Date.now();
  const response = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${KEY}`,
      "Content-Type": "application/json",
      /* D-208 applies here too — a mask is a picture of a person's face. */
      "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 3600 }),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return { ok: false as const, detail: (await response.text()).slice(0, 200), ms: Date.now() - started };
  }
  return { ok: true as const, json: await response.json(), ms: Date.now() - started };
}

/** Pull the mask bytes out, whatever the model called the field. */
async function fetchMask(json: any): Promise<Buffer | null> {
  const url = json?.mask_image?.url ?? json?.image?.url ?? json?.images?.[0]?.url;
  if (typeof url !== "string") return null;
  if (url.startsWith("data:")) return Buffer.from(url.split(",")[1], "base64");
  const bytes = await fetch(url);
  return bytes.ok ? Buffer.from(await bytes.arrayBuffer()) : null;
}

/**
 * Normalise anything a segmenter returns into our one-byte-per-pixel mask.
 *
 * **At the master's resolution, and refused rather than resized if it differs**
 * — a mask resampled to fit is a lossy step inside the path that promises not to
 * have one, and D-210 says the stride is proven, never inherited.
 */
async function toMask(bytes: Buffer) {
  const { data, info } = await sharp(bytes)
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mismatched = info.width !== WIDTH || info.height !== HEIGHT;
  if (data.length !== info.width * info.height) {
    throw new Error(`mask is not single-channel: ${data.length} for ${info.width}x${info.height}`);
  }
  let soft = 0;
  for (let index = 0; index < data.length; index += 1) {
    if (data[index] !== 0 && data[index] !== 255) soft += 1;
  }
  return {
    mask: { data, width: info.width, height: info.height },
    mismatched,
    dims: `${info.width}x${info.height}`,
    softness: soft / data.length,
  };
}

const CANDIDATES = [
  {
    name: "evf-sam · hair",
    endpoint: "fal-ai/evf-sam",
    body: { image_url: dataUri, prompt: "hair", mask_only: true, blur_mask: 5 },
  },
  {
    name: "evf-sam · eyebrows",
    endpoint: "fal-ai/evf-sam",
    body: { image_url: dataUri, prompt: "eyebrows", mask_only: true, blur_mask: 3 },
  },
  {
    name: "evf-sam · eyes",
    endpoint: "fal-ai/evf-sam",
    body: { image_url: dataUri, prompt: "eyes", mask_only: true, blur_mask: 3 },
  },
  {
    name: "evf-sam · face (carve-out)",
    endpoint: "fal-ai/evf-sam",
    body: { image_url: dataUri, prompt: "face skin", mask_only: true, blur_mask: 5 },
  },
  {
    /* A NEGATIVE CONTROL: this specimen wears no glasses. A segmenter that
       returns a confident mask for eyewear here is inventing one, and that is
       exactly the false-positive that would delete something real later. */
    name: "evf-sam · eyeglasses (NEGATIVE CONTROL — she wears none)",
    endpoint: "fal-ai/evf-sam",
    body: { image_url: dataUri, prompt: "eyeglasses", mask_only: true, blur_mask: 3 },
  },
  {
    name: "birefnet/v2 · matting (whole subject)",
    endpoint: "fal-ai/birefnet/v2",
    body: { image_url: dataUri, mask_only: true, model: "Matting", output_format: "png" },
  },
];

const rows: unknown[] = [];
for (const candidate of CANDIDATES) {
  const result = await run(candidate.endpoint, candidate.body);
  if (!result.ok) {
    console.log(`  ${candidate.name.padEnd(46)} FAILED — ${result.detail}`);
    rows.push({ ...candidate, ok: false, detail: result.detail });
    continue;
  }
  const bytes = await fetchMask(result.json);
  if (!bytes) {
    console.log(`  ${candidate.name.padEnd(46)} answered, no mask in the payload`);
    rows.push({ ...candidate, ok: false, detail: "no mask field" });
    continue;
  }
  const read = await toMask(bytes);
  const area = coverage(read.mask);
  writeFileSync(`${OUT}/${candidate.name.replace(/[^a-z0-9]+/gi, "-")}.png`, bytes);
  console.log(
    `  ${candidate.name.padEnd(46)} ${read.dims}${read.mismatched ? " (MISMATCH)" : ""}`
    + `  coverage ${(area * 100).toFixed(1)}%  soft ${(read.softness * 100).toFixed(1)}%`
    + `  ${result.ms}ms`,
  );
  rows.push({
    name: candidate.name,
    endpoint: candidate.endpoint,
    ok: true,
    dims: read.dims,
    matchesMaster: !read.mismatched,
    coverage: area,
    softness: read.softness,
    ms: result.ms,
  });
}

writeFileSync(`${OUT}/results.json`, JSON.stringify({ specimen: SPECIMEN, rows }, null, 2));
console.log(`\nmasks written to ${OUT}`);
