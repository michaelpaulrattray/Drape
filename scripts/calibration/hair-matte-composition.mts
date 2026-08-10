/**
 * THE HAIR ROW — can a region and a matte be composed into what neither is alone?
 *
 * Shop round two left the hair row in an awkward place, and the awkwardness is
 * the finding:
 *
 *   SAM 3        knows exactly WHERE the hair is (3.69%, score 0.93) but its
 *                masks are 100% BINARY — every non-zero pixel is 255, verified
 *                on the alpha channel. No edge, no wisps, a cut-out boundary.
 *   BiRefNet     produces a TRUE matte — a real edge ramp, 2.7% of its own
 *   Matting      extent — but only of the WHOLE SUBJECT; it cannot tell hair
 *                from shoulder. (Not the "46% soft" this file first claimed;
 *                see the metric note below for why that figure was junk.)
 *
 * D-212's rider says soft boundaries must be mattes, never binary outlines. So
 * neither model fills the hair row, and the honest question is whether the
 * INTERSECTION does: take the region from the one that knows where, and the edge
 * from the one that knows how soft.
 *
 * # Why this is a probe and not a claim
 *
 * The composition is plausible, and plausible is exactly what this program
 * punishes. The specific way it can fail: SAM 3's hard boundary may sit INSIDE
 * the matte's flyaway zone, in which case `min` clips the very wisps the matte
 * was brought in to preserve — a soft edge that is soft in the wrong place, which
 * would read as a fine result on a coverage number and as a haircut on the face.
 *
 * So both forms are measured, and the second exists because of that risk:
 *
 *   plain       min(region, matte)
 *   grown       min(dilate(region, r), matte) — the region grown past its own
 *               boundary so the MATTE decides where the hair ends, which is the
 *               whole point of bringing a matte
 *
 * `dilateMask` is the real helper (D-212 permits a coarse dilation only where it
 * is buried under something finer — here it is buried under the matte, which is
 * the finer thing, so this is the sanctioned use).
 *
 * # The operation this needs and the repo does not have
 *
 * `maskGeometry` exports union (`max`) and subtract (`min(a, 255-b)`) but no
 * intersection. Intersection is `min(a, b)`. It is computed inline here rather
 * than added to the operations layer, because product code is not being touched
 * before the founder's face wall — this records that the routing row needs
 * `intersectMask` when it is built.
 *
 *   npx tsx scripts/calibration/hair-matte-composition.mts
 */
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { coverage, dilateMask, type Mask } from "../../server/castingV2/maskGeometry";
import { featherMask } from "../../server/castingV2/maskedComposite";

const SHOP = "output/masked/segmentation-shop-2";
const OUT = "output/masked/hair-composition";
mkdirSync(OUT, { recursive: true });

const SPECIMEN = "output/masked/specimens/fresh-02.png";

/** Read a mask from wherever it actually lives — alpha for cut-outs (D-210). */
async function readMask(file: string): Promise<Mask> {
  const bytes = readFileSync(file);
  const meta = await sharp(bytes).metadata();
  const pipeline = meta.hasAlpha
    ? sharp(bytes).extractChannel(3)
    : sharp(bytes).toColourspace("b-w");
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (data.length !== info.width * info.height) {
    throw new Error(`not single channel: ${data.length} for ${info.width}x${info.height}`);
  }
  return { data, width: info.width, height: info.height };
}

/** Intersection — `min(a, b)`. The operation `maskGeometry` is missing. */
function intersect(a: Mask, b: Mask): Mask {
  if (a.width !== b.width || a.height !== b.height) throw new Error("size mismatch");
  const data = Buffer.allocUnsafe(a.data.length);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = a.data[index] < b.data[index] ? a.data[index] : b.data[index];
  }
  return { data, width: a.width, height: a.height };
}

/**
 * "Strictly between 0 and 255" is NOT a measure of softness, and using it here
 * nearly certified a wrong verdict.
 *
 * BiRefNet's matte interior sits at 250–254 rather than exactly 255, so that
 * definition counted the solid middle of a subject as edge and reported 46%
 * "soft" for a mask whose actual ramp is a hairline. Round one's ratified
 * "61% soft" for the same endpoint carries the same defect: the verdict (it IS a
 * true matte) survives, the number that justified it does not.
 *
 * A ramp is a genuinely INTERMEDIATE value. `RAMP_LOW`/`RAMP_HIGH` cut off the
 * near-transparent and near-opaque tails, so what remains is the blend itself —
 * which is the thing D-212's rider is asking about when it says soft boundaries
 * must be mattes. D-203: a score with no floor is not a score.
 */
const RAMP_LOW = 26;
const RAMP_HIGH = 229;

function describe(label: string, mask: Mask): Record<string, unknown> {
  let ramp = 0;
  let nonzero = 0;
  let nearOpaque = 0;
  for (let index = 0; index < mask.data.length; index += 1) {
    const value = mask.data[index];
    if (value > 0) nonzero += 1;
    if (value > RAMP_HIGH) nearOpaque += 1;
    if (value >= RAMP_LOW && value <= RAMP_HIGH) ramp += 1;
  }
  const row = {
    label,
    coverage: coverage(mask),
    extent: nonzero / mask.data.length,
    ramp: ramp / mask.data.length,
    /* Of everything in play, how much is genuine blend rather than solid fill?
       A cut-out scores ~0 here however many distinct byte values it contains. */
    rampShareOfExtent: nonzero === 0 ? 0 : ramp / nonzero,
    nearOpaqueShareOfExtent: nonzero === 0 ? 0 : nearOpaque / nonzero,
  };
  console.log(
    `  ${label.padEnd(34)} coverage ${(row.coverage * 100).toFixed(2)}%`
    + `  extent ${(row.extent * 100).toFixed(2)}%`
    + `  RAMP ${(row.ramp * 100).toFixed(2)}%`
    + `  ramp/extent ${(row.rampShareOfExtent * 100).toFixed(1)}%`
    + `  solid/extent ${(row.nearOpaqueShareOfExtent * 100).toFixed(1)}%`,
  );
  return row;
}

const region = await readMask(`${SHOP}/sam-3-hair.png`);
const matte = await readMask(`${SHOP}/birefnet-v2-Matting-whole-subject-.png`);

/*
  CONTROL THE INSTRUMENT BEFORE BELIEVING IT (D-203, working law 2).

  FLOOR: SAM 3's region is provably hard — its alpha is binary, every non-zero
  byte is 255. The ramp metric must read ~0 on it. If a binary cut-out scores as
  soft, the metric is measuring noise and no verdict below it counts.

  CEILING: the same region put through the REAL `featherMask` at a known radius.
  A mask that provably HAS a ramp must read as having one. Without this half, a
  metric that returns zero for everything would look like a strict instrument
  instead of a dead one.
*/
console.log("=== instrument controls ===");
const floorRow = describe("FLOOR  binary region (ramp≈0)", region);
const ceilingRow = describe("CEIL   region feathered r=6", await featherMask(region, 6));
const floorRamp = floorRow.rampShareOfExtent as number;
const ceilingRamp = ceilingRow.rampShareOfExtent as number;
if (floorRamp > 0.02) {
  throw new Error(`instrument FAILS its floor: a binary mask scored ${(floorRamp * 100).toFixed(1)}% ramp`);
}
if (ceilingRamp < 0.05) {
  throw new Error(`instrument FAILS its ceiling: a feathered mask scored only ${(ceilingRamp * 100).toFixed(1)}% ramp`);
}
console.log(`  → instrument separates hard from feathered: ${(floorRamp * 100).toFixed(1)}% vs ${(ceilingRamp * 100).toFixed(1)}%\n`);

console.log("=== the two sources, as they arrive ===");
const rows = [describe("sam-3 hair (region)", region), describe("birefnet Matting (subject)", matte)];

console.log("\n=== composed ===");
const plain = intersect(region, matte);
rows.push(describe("plain  min(region, matte)", plain));

const grown: Record<number, Mask> = {};
for (const radius of [4, 8, 16]) {
  grown[radius] = intersect(await dilateMask(region, radius), matte);
  rows.push(describe(`grown  r=${radius}`, grown[radius]));
}

/*
  Save each as a visible artifact. The numbers above cannot tell you whether the
  softness landed at the HAIRLINE or somewhere useless, and that is the whole
  question — so the masks get looked at (D-202).
*/
const W = 300;
const H = 450;
const base = await sharp(readFileSync(SPECIMEN)).resize(W, H, { fit: "fill" }).removeAlpha().toBuffer();
const panels: Buffer[] = [];
const order: [string, Mask][] = [
  ["region (binary)", region],
  ["matte (subject)", matte],
  ["plain", plain],
  ["grown r=4", grown[4]],
  ["grown r=8", grown[8]],
  ["grown r=16", grown[16]],
];
for (const [label, mask] of order) {
  writeFileSync(
    `${OUT}/${label.replace(/[^a-z0-9]+/gi, "-")}.png`,
    await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } }).png().toBuffer(),
  );
  /*
    D-210, caught here for the third time in one session: sharp PROMOTES a raw
    single-channel buffer to three channels through `.resize()` — proven, not
    assumed (`info.channels === 3`, 405000 bytes for a 300x450 result). Reading
    it one byte per pixel walks the first third of an RGB-interleaved buffer and
    draws a striped wedge that looks like a mask if you are not paying attention.
    Force the colourspace back, then ASSERT the stride rather than trusting it.
  */
  const resized = await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
    .resize(W, H, { fit: "fill" })
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (resized.data.length !== W * H) {
    throw new Error(`preview stride is wrong: ${resized.data.length} bytes for ${W}x${H} (channels=${resized.info.channels})`);
  }
  const small = resized.data;
  const tint = Buffer.alloc(W * H * 4);
  for (let index = 0; index < W * H; index += 1) {
    tint[index * 4] = 255;
    tint[index * 4 + 1] = 30;
    tint[index * 4 + 2] = 30;
    tint[index * 4 + 3] = Math.round(small[index] * 0.62);
  }
  panels.push(
    await sharp(base).composite([{ input: tint, raw: { width: W, height: H, channels: 4 } }]).jpeg({ quality: 92 }).toBuffer(),
  );
}
await sharp({ create: { width: W * panels.length, height: H, channels: 3, background: "#111" } })
  .composite(panels.map((input, index) => ({ input, left: index * W, top: 0 })))
  .jpeg({ quality: 93 })
  .toFile(`${OUT}/COMPOSITION-strip.jpg`);

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ specimen: SPECIMEN, rows }, null, 2)}\n`);
console.log(`\nstrip order: ${order.map(([label]) => label).join(" | ")}`);
console.log(`written to ${OUT}`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
