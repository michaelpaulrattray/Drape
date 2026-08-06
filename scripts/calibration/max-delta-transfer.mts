/**
 * FIXTURE — cross-image style transfer at maximum delta. Both directions.
 *
 * Spec: `docs/specs/masked-editing/FIXTURE_style-transfer-max-delta.md`.
 *
 * A crew-cut master and a giant-afro reference: the largest hair delta the
 * product can be asked for, chosen because everything smaller is a special case
 * of it. Material came free from the bespectacled roll and its retention
 * neighbours — `wire-08` is shaved, `fresh-06` wears a big afro.
 *
 * # The two directions are not symmetrical, and pretending they are is how a
 * fixture flatters a technique
 *
 *   GROW    crew cut -> afro. Paint hair over background. The destination is
 *           empty and nothing is occluded. Expected easy.
 *   SHRINK  afro -> crew cut. **Reconstruct what was behind the hair.** The
 *           backdrop, the ears, the neck and the shoulder line were never
 *           photographed. "Paint background over it" is a sentence, not an
 *           operation, and this is the honest ceiling test of local editing.
 *
 * Scored separately, always.
 *
 * # The zone, and why it is not a segmentation
 *
 * D-218's silhouette law, now in `requestMatte`: an edit that changes an
 * object's outline never uses a tight segmentation of the object as it is. Both
 * directions change the silhouette, so both use a grown DESTINATION ZONE — which
 * is the sanctioned path the guard points at, not a way around it.
 *
 * For GROW the zone is the REFERENCE's hair, landmark-aligned onto the master's
 * head via a similarity transform from eye centres (`moondream3-preview/point`,
 * both controls clean, cross-checked against SAM 3's eye mask), then padded and
 * unioned with the master's own hair so the existing cut can be replaced.
 *
 * For SHRINK the zone is the master's OWN hair, padded — that is precisely the
 * area that has to stop being hair.
 *
 * **The face is carved out of both, last** (D-211). Alignment moves the zone; it
 * never moves the exemption.
 *
 * Engine is GPT Image 2 — founder-ratified provisional default for face-region
 * masked edits, 2026-08-06.
 *
 *   npx tsx scripts/calibration/max-delta-transfer.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { coverage, dilateMask, subtractMask, unionMasks, type Mask } from "../../server/castingV2/maskGeometry";
import {
  compositeMasked,
  outsideMaskUnchanged,
  readRaster,
  seamBand,
  writePng,
  type Raster,
} from "../../server/castingV2/maskedComposite";
import { runFalImageJob } from "../../server/providers/falTransport";
import { FAL_GPT_IMAGE_2_EDIT } from "../../server/providers/falImages";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required");

const OUT = "output/masked/max-delta";
mkdirSync(OUT, { recursive: true });

const CREWCUT = "output/masked/specimens/wire-08.png";
const AFRO = "output/masked/specimens/fresh-06.png";
const FEATHER = 4;
const PAD = 24;

/* --------------------------------------------------------------- machinery */

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
  if (!Array.isArray(json.masks) || json.masks.length === 0) {
    throw new Error(`"${prompt}" returned an empty mask set — refusing to build a zone from nothing`);
  }
  const url = json.masks[0]?.url ?? json.masks[0];
  const bytes = url.startsWith("data:")
    ? Buffer.from(url.split(",")[1], "base64")
    : Buffer.from(await (await fetch(url)).arrayBuffer());
  return toMask(bytes);
}

/** Two eye centres in PIXELS, cross-checked upstream by the landmark shop. */
async function eyePoints(dataUri: string, width: number, height: number) {
  const json = await fal("fal-ai/moondream3-preview/point", { image_url: dataUri, prompt: "eye" });
  const points: { x: number; y: number }[] = json.points ?? [];
  if (points.length < 2) throw new Error(`landmark model returned ${points.length} eye point(s) — cannot align`);
  const sorted = [...points].sort((a, b) => a.x - b.x).slice(0, 2);
  return sorted.map((p) => ({ x: p.x * width, y: p.y * height }));
}

/**
 * Warp `source` onto the destination frame by the similarity transform that
 * carries the source's eye centres onto the destination's.
 *
 * Inverse mapping with bilinear sampling: for every DESTINATION pixel we ask
 * where it came from, which is the only way to fill the output without holes.
 * Bilinear rather than nearest because the thing being warped is a matte, and a
 * nearest-neighbour resample of a soft edge puts a staircase back into the one
 * boundary the matte exists to keep smooth.
 */
function alignMask(
  source: Mask,
  from: { x: number; y: number }[],
  to: { x: number; y: number }[],
): Mask {
  const fromMid = { x: (from[0].x + from[1].x) / 2, y: (from[0].y + from[1].y) / 2 };
  const toMid = { x: (to[0].x + to[1].x) / 2, y: (to[0].y + to[1].y) / 2 };
  const fromVec = { x: from[1].x - from[0].x, y: from[1].y - from[0].y };
  const toVec = { x: to[1].x - to[0].x, y: to[1].y - to[0].y };
  const fromLen = Math.hypot(fromVec.x, fromVec.y);
  const toLen = Math.hypot(toVec.x, toVec.y);
  const scale = toLen / fromLen;
  const angle = Math.atan2(toVec.y, toVec.x) - Math.atan2(fromVec.y, fromVec.x);

  /* The INVERSE transform, applied per destination pixel. */
  const cos = Math.cos(-angle) / scale;
  const sin = Math.sin(-angle) / scale;

  const data = Buffer.alloc(source.width * source.height, 0);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const dx = x - toMid.x;
      const dy = y - toMid.y;
      const sx = cos * dx - sin * dy + fromMid.x;
      const sy = sin * dx + cos * dy + fromMid.y;
      if (sx < 0 || sy < 0 || sx >= source.width - 1 || sy >= source.height - 1) continue;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const a = source.data[y0 * source.width + x0];
      const b = source.data[y0 * source.width + x0 + 1];
      const c = source.data[(y0 + 1) * source.width + x0];
      const d = source.data[(y0 + 1) * source.width + x0 + 1];
      data[y * source.width + x] = Math.round(
        a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy,
      );
    }
  }
  return { data, width: source.width, height: source.height };
}

async function writeMask(mask: Mask, file: string) {
  writeFileSync(file, await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  }).png().toBuffer());
}

/* --------------------------------------------------------------- the runs */

const crewBytes = readFileSync(CREWCUT);
const afroBytes = readFileSync(AFRO);
const crewUri = `data:image/png;base64,${crewBytes.toString("base64")}`;
const afroUri = `data:image/png;base64,${afroBytes.toString("base64")}`;
const crew: Raster = await readRaster(crewBytes);
const afro: Raster = await readRaster(afroBytes);

console.log("segmenting and locating…");
const crewHair = await segment(crewUri, "hair");
const afroHair = await segment(afroUri, "hair");
const crewFace = await segment(crewUri, "face skin");
const afroFace = await segment(afroUri, "face skin");
const crewEyes = await eyePoints(crewUri, crew.width, crew.height);
const afroEyes = await eyePoints(afroUri, afro.width, afro.height);
console.log(`  crew hair ${(coverage(crewHair) * 100).toFixed(2)}%  afro hair ${(coverage(afroHair) * 100).toFixed(2)}%`);
console.log(`  crew eyes ${crewEyes.map((p) => `(${Math.round(p.x)},${Math.round(p.y)})`).join(" ")}`);
console.log(`  afro eyes ${afroEyes.map((p) => `(${Math.round(p.x)},${Math.round(p.y)})`).join(" ")}`);

/* GROW: the afro's hair zone, carried onto the crew-cut head. */
const afroOnCrew = alignMask(afroHair, afroEyes, crewEyes);
const growZone = subtractMask(
  await dilateMask(unionMasks(afroOnCrew, crewHair), PAD),
  crewFace,
);

/* SHRINK: the afro's own hair is exactly what must stop being hair. */
const shrinkZone = subtractMask(await dilateMask(afroHair, PAD), afroFace);

await writeMask(afroOnCrew, `${OUT}/aligned-afro-zone.png`);
await writeMask(growZone, `${OUT}/grow-zone.png`);
await writeMask(shrinkZone, `${OUT}/shrink-zone.png`);

const DIRECTIONS = [
  {
    key: "grow",
    master: crew,
    masterBytes: crewBytes,
    uri: crewUri,
    zone: growZone,
    prompt:
      "Change only this woman's hair. Give her a large, full, natural afro — voluminous "
      + "and rounded, well beyond her current close-cropped hair. Keep her face, identity, "
      + "bone structure, skin, expression, glasses, pose, clothing, lighting and the plain "
      + "studio background exactly as they are.",
  },
  {
    key: "shrink",
    master: afro,
    masterBytes: afroBytes,
    uri: afroUri,
    zone: shrinkZone,
    prompt:
      "Change only this woman's hair. Give her a very short, close-cropped crew cut. "
      + "Where her large hair used to be there must now be the same plain, evenly lit "
      + "studio background, and her ears, neck and shoulder line must be visible and "
      + "anatomically correct. Keep her face, identity, bone structure, skin, expression, "
      + "pose, clothing and lighting exactly as they are.",
  },
];

const rows: any[] = [];
for (const direction of DIRECTIONS) {
  const area = coverage(direction.zone);
  console.log(`\n### ${direction.key} — destination zone ${(area * 100).toFixed(2)}% of frame`);
  /* The routing number the fixture exists to read. */
  if (area > 0.6) {
    console.log(`  zone exceeds the 60% ceiling — this is where the full-frame path takes over`);
  }

  const job = await runFalImageJob({
    apiKey: apiKey!,
    endpoint: FAL_GPT_IMAGE_2_EDIT,
    body: {
      prompt: direction.prompt,
      image_urls: [direction.uri],
      num_images: 1,
      quality: "high",
      output_format: "png",
    },
    timeoutMs: 300_000,
    pollIntervalMs: 1_500,
  });

  const meta = await sharp(job.bytes).metadata();
  const resized = meta.width !== direction.master.width || meta.height !== direction.master.height;
  const patchBytes = resized
    ? await sharp(job.bytes).resize(direction.master.width, direction.master.height, { fit: "fill" }).png().toBuffer()
    : job.bytes;
  const patch = await readRaster(patchBytes);

  const { composite, applied } = await compositeMasked({
    master: direction.master, patch, mask: direction.zone, featherRadius: FEATHER,
  });
  const outside = outsideMaskUnchanged(direction.master, composite, applied);
  const seam = seamBand(direction.master, composite, applied);

  writeFileSync(`${OUT}/${direction.key}-raw.png`, job.bytes);
  writeFileSync(`${OUT}/${direction.key}-composite.png`, await writePng(composite));

  console.log(
    `  outside ${outside.identical ? "BYTE-IDENTICAL" : `CHANGED ${outside.changedPixels}`}`
    + `  seam mean ${seam.meanDelta.toFixed(1)} max ${seam.maxDelta}`
    + `  ${resized ? "[patch resized] " : ""}`,
  );

  rows.push({
    direction: direction.key,
    zoneCoverage: area,
    patchResized: resized,
    outsideIdentical: outside.identical,
    changedPixels: outside.changedPixels,
    seamMeanDelta: seam.meanDelta,
    seamMaxDelta: seam.maxDelta,
    seamPixels: seam.pixels,
  });
}

writeFileSync(
  `${OUT}/results.json`,
  `${JSON.stringify({ crewcut: CREWCUT, afro: AFRO, pad: PAD, featherRadius: FEATHER, rows }, null, 2)}\n`,
);
console.log(`\nwritten to ${OUT}`);
console.log("Occlusion honesty on SHRINK is a founder-eye call — no metric is claimed for it.");
