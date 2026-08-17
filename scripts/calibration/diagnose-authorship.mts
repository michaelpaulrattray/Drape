/**
 * DIAGNOSE BEFORE BUILDING — the two residual defects, and whose fault they are.
 *
 * The founder's second pass named two things and called them AUTHORSHIP rather
 * than compositing: the hair-end hem, and the afro silhouette. Compositing work
 * cannot fix either if the paint already has them, so **the first move is to open
 * the painter's raw output.** Five minutes, decisive, and it decides which lever
 * gets pulled.
 *
 * # 1. The hair-end hem — is the ZONE authoring the haircut?
 *
 * The hypothesis is uncomfortable and specific: an inpainting model completes
 * content within its canvas, so a zone edge sitting at mid-chest **invites a neat
 * hem just inside it**. That would also explain why boundary-contact never fires
 * on this case — the paint carefully never touches the edge it is respecting.
 *
 * Two readings, and they are told apart mechanically:
 *
 *   BOX-AUTHORED   the hem follows the zone's own boundary shape. The automatic
 *                  tell is CORRELATION: per column, how far the hair ends sits
 *                  against how far the zone reaches. A hem that is the box in
 *                  disguise tracks it.
 *   PAINTER-BLUNT  the ends sit where the painter puts them regardless, which
 *                  routes to prompt craft rather than geometry.
 *
 * Likely both. The correlation is measured here; the zone-tracking test (same
 * edit, two zone depths) follows if this says box.
 *
 * # 2. The afro silhouette — is the paint already a blob?
 *
 * The outline reads smooth with coils only inside. **If the paint is blobby, no
 * matte can un-blob it** — the harvest can only ever be as good as what it
 * harvests. Measured as edge ROUGHNESS: how much the silhouette's own perimeter
 * deviates from a smoothed version of itself, on the RAW paint and on the master
 * for comparison, so the number has something to be relative to.
 *
 *   npx tsx scripts/calibration/diagnose-authorship.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { coverage, dilateMask } from "../../server/castingV2/maskGeometry";
import type { Mask } from "../../server/castingV2/maskedComposite";
import { readRaster, type Raster } from "../../server/castingV2/maskedComposite";
import { birefnetMatte, sam3 } from "./lib/segment.mts";

const OUT = "output/masked/diagnose";
mkdirSync(OUT, { recursive: true });

/** Per column, the lowest row carrying a real run of the mask. */
function lowestPerColumn(mask: Mask, minRun = 4): Int32Array {
  const lowest = new Int32Array(mask.width).fill(-1);
  for (let x = 0; x < mask.width; x += 1) {
    let run = 0;
    for (let y = mask.height - 1; y >= 0; y -= 1) {
      if (mask.data[y * mask.width + x] > 128) {
        run += 1;
        if (run >= minRun) { lowest[x] = y; break; }
      } else run = 0;
    }
  }
  return lowest;
}

/** Pearson correlation over columns where both series exist. */
function correlate(a: Int32Array, b: Int32Array): { r: number; n: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] < 0 || b[index] < 0) continue;
    xs.push(a[index]);
    ys.push(b[index]);
  }
  const n = xs.length;
  if (n < 8) return { r: 0, n };
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n;
  let top = 0;
  let leftSq = 0;
  let rightSq = 0;
  for (let index = 0; index < n; index += 1) {
    const dx = xs[index] - meanX;
    const dy = ys[index] - meanY;
    top += dx * dy;
    leftSq += dx * dx;
    rightSq += dy * dy;
  }
  const denominator = Math.sqrt(leftSq * rightSq);
  return { r: denominator === 0 ? 0 : top / denominator, n };
}

/**
 * How rough is a silhouette? Mean absolute deviation of its own perimeter from a
 * blurred copy of itself, in pixels, measured only where the outline exists.
 *
 * A coil-broken afro perimeter wanders; a blob's does not. The master is measured
 * the same way in the same units, so the number is a comparison rather than a
 * figure nobody can calibrate.
 */
async function edgeRoughness(mask: Mask, blurPx = 6): Promise<number> {
  const { data } = await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  })
    .blur(blurPx)
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  let total = 0;
  let count = 0;
  for (let pixel = 0; pixel < mask.data.length; pixel += 1) {
    const value = mask.data[pixel];
    const smoothed = data[pixel];
    /* Only the transition zone — the interior and the far background have
       nothing to say about how ragged an outline is. */
    if (smoothed <= 8 || smoothed >= 247) continue;
    total += Math.abs(value - smoothed);
    count += 1;
  }
  return count === 0 ? 0 : total / count;
}

async function writeMask(mask: Mask, name: string): Promise<void> {
  await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
    .png()
    .toFile(`${OUT}/${name}.png`);
}

/* ============================ 1. THE HAIR-END HEM ============================ */

console.log("=== 1. THE HAIR-END HEM — is the zone authoring the haircut? ===\n");

const hdMasterBytes = readFileSync("output/masked/specimens/wire-02.png");
const hdMaster: Raster = await readRaster(hdMasterBytes);
const hdRawBytes = await sharp(readFileSync("output/masked/fringe-fixture/hair-down-raw.png"))
  .resize(hdMaster.width, hdMaster.height, { fit: "fill" })
  .png()
  .toBuffer();

/* The zone exactly as the fixture built it: 11 passes of a 48px dilation. */
const hdHair = await sam3(hdMasterBytes, "hair");
let hdZone: Mask = hdHair.all;
for (let pass = 0; pass < 11; pass += 1) hdZone = await dilateMask(hdZone, 48);
console.log(`zone ${(coverage(hdZone) * 100).toFixed(2)}% of frame`);

/* Where the PAINTER put the ends, in its own raw output — before any of ours. */
const hdPaintedHair = await sam3(hdRawBytes, "hair");
await writeMask(hdPaintedHair.all, "hem-painted-hair");
await writeMask(hdZone, "hem-zone");

const hemLine = lowestPerColumn(hdPaintedHair.all);
const zoneLine = lowestPerColumn(hdZone);
const { r, n } = correlate(hemLine, zoneLine);

/* How far inside the zone's own floor the hem sits, per column. */
const gaps: number[] = [];
for (let x = 0; x < hemLine.length; x += 1) {
  if (hemLine[x] < 0 || zoneLine[x] < 0) continue;
  gaps.push(zoneLine[x] - hemLine[x]);
}
gaps.sort((a, b) => a - b);
const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
const touching = gaps.filter((gap) => gap <= 2).length;

console.log(`hem-to-zone shape correlation  r = ${r.toFixed(3)} over ${n} columns`);
console.log(`the painted ends sit a median ${medianGap}px INSIDE the zone's floor`);
console.log(`columns where the paint actually touches the zone edge: ${touching} of ${gaps.length}`);
console.log(
  Math.abs(r) > 0.6
    ? "\n  -> READS AS BOX-AUTHORED: the hem tracks the zone's own shape. Run the\n"
      + "     zone-tracking test (same edit, two depths) to confirm it MOVES with the box."
    : "\n  -> DOES NOT track the zone's shape. The painter is cutting hair bluntly on its\n"
      + "     own account, which routes to prompt craft rather than geometry.",
);
if (touching === 0) {
  console.log("  -> and it never touches the edge, which is exactly why boundary-contact never fires here.");
}

/* The picture, because a correlation is not a haircut. */
const hemBox = { left: 120, top: 1080, width: 784, height: 456 };
const hemCells = [
  await sharp(hdMasterBytes).extract(hemBox).png().toBuffer(),
  await sharp(hdRawBytes).extract(hemBox).png().toBuffer(),
];
await sharp({ create: { width: hemBox.width, height: hemBox.height * 2 + 8, channels: 3, background: "#0A0A0A" } })
  .composite(hemCells.map((input, index) => ({ input, left: 0, top: index * (hemBox.height + 8) })))
  .png()
  .toFile(`${OUT}/HEM-raw-paint.png`);
console.log("  HEM-raw-paint.png — master over the painter's RAW output, 100%, no compositing at all");

/* ========================= 2. THE AFRO SILHOUETTE ========================= */

console.log("\n=== 2. THE AFRO SILHOUETTE — is the paint already a blob? ===\n");

const afMasterBytes = readFileSync("output/masked/specimens/wire-08.png");
const afMaster: Raster = await readRaster(afMasterBytes);
const afRawBytes = await sharp(readFileSync("output/masked/max-delta/grow-raw.png"))
  .resize(afMaster.width, afMaster.height, { fit: "fill" })
  .png()
  .toBuffer();

const afMasterHair = await sam3(afMasterBytes, "hair");
const afPaintedHair = await sam3(afRawBytes, "hair");
const afMasterMatte = await birefnetMatte(afMasterBytes);
const afPaintedMatte = await birefnetMatte(afRawBytes);

const roughness = {
  masterSegmentation: await edgeRoughness(afMasterHair.all),
  paintedSegmentation: await edgeRoughness(afPaintedHair.all),
  masterMatte: await edgeRoughness(afMasterMatte),
  paintedMatte: await edgeRoughness(afPaintedMatte),
};
console.log("edge roughness (mean deviation of the outline from a smoothed copy, in levels):");
console.log(`  HER OWN hair, segmentation  ${roughness.masterSegmentation.toFixed(1)}`);
console.log(`  the PAINTED afro, segmentation ${roughness.paintedSegmentation.toFixed(1)}`);
console.log(`  HER OWN hair, matte         ${roughness.masterMatte.toFixed(1)}`);
console.log(`  the PAINTED afro, matte     ${roughness.paintedMatte.toFixed(1)}`);
console.log(
  roughness.paintedMatte < roughness.masterMatte * 0.85
    ? "\n  -> THE PAINT IS SMOOTHER THAN HER OWN HAIR. The blob is authored, not composited,\n"
      + "     and no matte can un-blob it. Levers: prompt the silhouette; run the hair row\n"
      + "     of the bake-off."
    : "\n  -> the painted edge is not measurably smoother than her own. If it still READS\n"
      + "     blobby the cause is downstream, not in the paint.",
);

/* Both silhouettes at 100%, raw paint only. */
const afroBox = { left: 620, top: 120, width: 380, height: 420 };
const afroCells = [
  await sharp(afMasterBytes).extract(afroBox).png().toBuffer(),
  await sharp(afRawBytes).extract(afroBox).png().toBuffer(),
];
await sharp({ create: { width: afroBox.width * 2 + 8, height: afroBox.height, channels: 3, background: "#0A0A0A" } })
  .composite(afroCells.map((input, index) => ({ input, left: index * (afroBox.width + 8), top: 0 })))
  .png()
  .toFile(`${OUT}/AFRO-raw-paint.png`);
console.log("  AFRO-raw-paint.png — her own hair beside the painter's RAW afro, 100%");

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({
  hem: { correlation: r, columns: n, medianGapInsideZone: medianGap, columnsTouchingEdge: touching, totalColumns: gaps.length },
  afro: roughness,
}, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
