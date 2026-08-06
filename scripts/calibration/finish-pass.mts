/**
 * THE FINISH PASS — proven against the exact images the founder marked up.
 *
 * Three observations from the founder's eye on exhibits 8 and 9, with acceptance
 * criteria attached. Two of them turn out to share one cause, which is worth
 * saying rather than building the same fix twice:
 *
 *   FOREHEAD LINE   a faint tonal boundary where the zone's edge crosses skin.
 *                   Repainted skin a whisper off master skin — and feathering
 *                   cannot hide a TONAL mismatch, it only makes the line soft.
 *                   Fix: `harmonizeSeam` (the band blends tone) + `matchGrain`
 *                   (both sides share one texture).
 *                   Accept: no visible boundary line on skin at 100% zoom.
 *
 *   BLOCKY WISPS    fine strands truncated to hard edges.
 *   AFRO HALO       the silhouette fading out on the zone's uniform opacity ramp
 *                   rather than on the hair's own edge.
 *                   **One cause**: the visible edge was taken from a geometric
 *                   construct instead of from the hair. Fix: `edgeMatte` — matte
 *                   the PAINTED RESULT and blend by the paint's own alpha, with
 *                   the zone as outer bound only.
 *                   Accept: strands not steps; coil texture to the silhouette.
 *
 * # Why this costs nothing to run
 *
 * The max-delta grow render is already on disk, and it exercises all three at
 * once: its zone crosses skin at the forehead AND carries a hair silhouette. So
 * the before and after are the SAME generated pixels composited two ways, which
 * is the only honest comparison — a fresh render would confound the finish pass
 * with the model having a different day.
 *
 * One BiRefNet call mattes the patch. Nothing else is spent.
 *
 *   npx tsx scripts/calibration/finish-pass.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { coverage, placeDestinationZone, unionMasks, type Mask } from "../../server/castingV2/maskGeometry";
import {
  compositeMasked,
  harmonizeSeam,
  matchGrain,
  outsideMaskUnchanged,
  readRaster,
  writePng,
  type Raster,
} from "../../server/castingV2/maskedComposite";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required");

const OUT = "output/masked/finish-pass";
mkdirSync(OUT, { recursive: true });

const MASTER = "output/masked/specimens/wire-08.png";
const RAW = "output/masked/max-delta/grow-raw.png";
const ZONE = "output/masked/max-delta/grow-zone.png";
const FEATHER_BEFORE = 4;

async function toMask(bytes: Buffer): Promise<Mask> {
  const meta = await sharp(bytes).metadata();
  const pipeline = meta.hasAlpha ? sharp(bytes).extractChannel(3) : sharp(bytes).toColourspace("b-w");
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (data.length !== info.width * info.height) throw new Error("mask not single-channel");
  return { data, width: info.width, height: info.height };
}

/**
 * Matte the PAINTED RESULT. BiRefNet Matting, ratified in round one for exactly
 * this — whole-subject work with a real edge ramp.
 */
async function matteOf(bytes: Buffer): Promise<Mask> {
  const response = await fetch("https://fal.run/fal-ai/birefnet/v2", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
      "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 3600 }),
    },
    body: JSON.stringify({
      image_url: `data:image/png;base64,${bytes.toString("base64")}`,
      mask_only: true, model: "Matting", output_format: "png",
    }),
  });
  if (!response.ok) throw new Error(`birefnet: ${(await response.text()).slice(0, 160)}`);
  const json = await response.json() as any;
  const url = json?.mask_image?.url ?? json?.image?.url;
  const raw = url.startsWith("data:")
    ? Buffer.from(url.split(",")[1], "base64")
    : Buffer.from(await (await fetch(url)).arrayBuffer());
  return toMask(raw);
}

/** One named region from SAM 3 — the ratified source for region geometry. */
async function segment(bytes: Buffer, prompt: string): Promise<Mask> {
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
  if (!Array.isArray(json.masks) || json.masks.length === 0) throw new Error(`"${prompt}" returned nothing`);
  const url = json.masks[0]?.url ?? json.masks[0];
  const raw = url.startsWith("data:")
    ? Buffer.from(url.split(",")[1], "base64")
    : Buffer.from(await (await fetch(url)).arrayBuffer());
  return toMask(raw);
}

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
 * The tonal step across the boundary, measured ONLY where both sides are the
 * same kind of thing — which is the forehead case and not the hairline.
 *
 * A pair of rings, one pixel inside and one pixel outside. Where the two differ
 * enormously the boundary is a genuine content change (hair meeting wall) and is
 * skipped; what remains is skin meeting skin, where any step is the defect.
 */
function skinStep(master: Raster, composite: Raster, zone: Mask): { meanStep: number; pixels: number } {
  const { width, height } = zone;
  let total = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = y * width + x;
      if (zone.data[pixel] === 0) continue;
      const outsideNeighbour = [pixel - 1, pixel + 1, pixel - width, pixel + width]
        .find((neighbour) => zone.data[neighbour] === 0);
      if (outsideNeighbour === undefined) continue;
      const inAt = pixel * 3;
      const outAt = outsideNeighbour * 3;
      const step = Math.abs(composite.data[inAt] - master.data[outAt])
        + Math.abs(composite.data[inAt + 1] - master.data[outAt + 1])
        + Math.abs(composite.data[inAt + 2] - master.data[outAt + 2]);
      /* Skip genuine content boundaries — this measures skin, not silhouette. */
      if (step > 120) continue;
      total += step / 3;
      count += 1;
    }
  }
  return { meanStep: count === 0 ? 0 : total / count, pixels: count };
}

/* -------------------------------------------------------------------- run */

const masterBytes = readFileSync(MASTER);
const master: Raster = await readRaster(masterBytes);
const rawBytes = readFileSync(RAW);
const zone = await toMask(readFileSync(ZONE));

const sized = await sharp(rawBytes).resize(master.width, master.height, { fit: "fill" }).png().toBuffer();
const patch: Raster = await readRaster(sized);
console.log(`master ${master.width}x${master.height}  zone ${(coverage(zone) * 100).toFixed(2)}%\n`);

/*
  THE PLACEMENT LAW (founder addendum). The shipped zone was a plain dilation,
  which sweeps outward equally in every direction — so making room for a bigger
  afro also pushed the boundary DOWN across open forehead, which is the worst
  seam real estate in the picture. `placeDestinationZone` grows generously into
  background and barely onto skin, so the lower boundary hugs the hairline where
  texture hides a seam for free.
*/
const masterSubject = await matteOf(masterBytes);
const masterHair = await segment(masterBytes, "hair");
const masterFace = await segment(masterBytes, "face skin");
const placedZone = await placeDestinationZone({
  /* The HAIR, plus where the reference's hair lands after alignment — NOT the
     old zone, which was already dilated and carries the swept forehead skin the
     placement law exists to decline. Passing it here defeated the law entirely
     on the first run, and the seam-on-skin pixel count going UP is what said so. */
  region: unionMasks(masterHair, await toMask(readFileSync("output/masked/max-delta/aligned-afro-zone.png"))),
  subject: masterSubject,
  reach: 24,
  skinMargin: 8,
  exclude: masterFace,
});
console.log(`placed zone ${(coverage(placedZone) * 100).toFixed(2)}% (was ${(coverage(zone) * 100).toFixed(2)}%)\n`);

/* ---- BEFORE: exactly what shipped in exhibit 8 ---- */
const before = await compositeMasked({ master, patch, mask: zone, featherRadius: FEATHER_BEFORE });
const beforeStep = skinStep(master, before.composite, zone);
console.log("BEFORE — uniform feather on the zone's boundary");
console.log(`  applied-alpha ramp share ${(rampShare(before.applied) * 100).toFixed(1)}%`);
console.log(`  tonal step across skin    ${beforeStep.meanStep.toFixed(2)} levels over ${beforeStep.pixels} px`);
writeFileSync(`${OUT}/before.png`, await writePng(before.composite));

/* ---- AFTER: tone harmonised, grain matched, edge from the paint's matte ---- */
console.log("\nmatting the painted result…");
const paintMatte = await matteOf(sized);
console.log(`  patch matte coverage ${(coverage(paintMatte) * 100).toFixed(2)}%  ramp ${(rampShare(paintMatte) * 100).toFixed(1)}%`);

const harmonised = harmonizeSeam({ master, patch, mask: placedZone, bandPx: 14 });
const grained = matchGrain({ master, patch: harmonised, mask: placedZone, ringPx: 6 });
const after = await compositeMasked({ master, patch: grained, mask: placedZone, edgeMatte: paintMatte, featherRadius: 4 });
const afterStep = skinStep(master, after.composite, placedZone);

console.log("\nAFTER — harmonised, grained, edge taken from the paint");
console.log(`  applied-alpha ramp share ${(rampShare(after.applied) * 100).toFixed(1)}%`);
console.log(`  tonal step across skin    ${afterStep.meanStep.toFixed(2)} levels over ${afterStep.pixels} px`);
writeFileSync(`${OUT}/after.png`, await writePng(after.composite));

/* The guarantee is not allowed to lapse because the finish got prettier. */
const outsideBefore = outsideMaskUnchanged(master, before.composite, before.applied);
const outsideAfter = outsideMaskUnchanged(master, after.composite, after.applied);
console.log(`\n  byte-identity outside  before ${outsideBefore.identical}  after ${outsideAfter.identical}`);

console.log("\n=== acceptance ===");
console.log(`  tonal step on skin:  ${beforeStep.meanStep.toFixed(2)} -> ${afterStep.meanStep.toFixed(2)} levels`
  + `  ${afterStep.meanStep < beforeStep.meanStep ? "improved" : "NOT IMPROVED"}`);
console.log(`  edge ramp share:     ${(rampShare(before.applied) * 100).toFixed(1)}% -> ${(rampShare(after.applied) * 100).toFixed(1)}%`
  + `  (a matte-governed edge should carry far more genuine blend than a uniform feather)`);
console.log("  strands and coil texture: the founder's eye on CROP-silhouette.jpg, no metric claimed");

/* Crops at 100%, because both acceptance criteria are stated at 100% zoom. */
const crops: [string, { left: number; top: number; width: number; height: number }][] = [
  ["silhouette", { left: 240, top: 40, width: 560, height: 380 }],
  ["forehead", { left: 330, top: 300, width: 420, height: 260 }],
];
for (const [name, box] of crops) {
  const cells: Buffer[] = [];
  for (const file of [`${OUT}/before.png`, `${OUT}/after.png`]) {
    cells.push(await sharp(readFileSync(file)).extract(box).jpeg({ quality: 97 }).toBuffer());
  }
  await sharp({ create: { width: box.width * 2 + 8, height: box.height, channels: 3, background: "#0A0A0A" } })
    .composite(cells.map((input, index) => ({ input, left: index * (box.width + 8), top: 0 })))
    .jpeg({ quality: 97 })
    .toFile(`${OUT}/CROP-${name}.jpg`);
  console.log(`  wrote CROP-${name}.jpg (before | after, 100%)`);
}

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({
  master: MASTER, raw: RAW,
  before: { rampShare: rampShare(before.applied), skinStep: beforeStep, outsideIdentical: outsideBefore.identical },
  after: { rampShare: rampShare(after.applied), skinStep: afterStep, outsideIdentical: outsideAfter.identical },
  patchMatte: { coverage: coverage(paintMatte), rampShare: rampShare(paintMatte) },
}, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);
