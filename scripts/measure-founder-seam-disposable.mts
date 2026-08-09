/**
 * WHY THE SEAM DETECTOR SAID NOTHING ABOUT THE SEAM THE FOUNDER SAW.
 *
 * fable-114 §1 put the question the right way round: if the shadow detector
 * scored his shirt seam we get instrument-versus-eye calibration for free, and
 * if it did NOT we have a blind spot at exactly the founder-visible amplitude —
 * worse and more important. Production's logs answer it: the hair-down render
 * (`op=e94cb500`, 09:48:58Z) logged `composited — outside the mask,
 * byte-identical to her master` and **no seam line at all**. `compositeSeam`
 * returned `torn: false`.
 *
 * This measures why, on his own frames, using the PRODUCT'S OWN detector rather
 * than a second implementation of it.
 *
 * # The mask is reconstructed, and the direction of that error is stated
 *
 * The applied mask is not stored on a delivered render (diagnostic capture only
 * fires behind a refusal), so `applied` here is the change footprint: pixels
 * where the delivered frame differs from the master by more than a re-encode.
 * That is a SUBSET of the true applied region — wherever the painter reproduced
 * the master exactly, the true mask covers a pixel this one does not — so the
 * reconstructed boundary can sit inside the real one. It cannot invent a step
 * that is not there, which is the direction that matters for a null result.
 *
 * # Two questions, because they are two different physical quantities
 *
 * 1. `compositeSeam`'s own verdict, with its own thresholds: a TEAR is one
 *    material replacing another across the boundary, ~200 luma levels on the
 *    run-6 specimen, and the bar is 80.
 * 2. The COHERENCE of the step: a blend seam is a small, consistent tonal
 *    offset along a boundary — invisible per pixel and obvious as a line,
 *    because the eye integrates along an edge and a threshold does not. Mean
 *    signed excess against its own spread is what a line looks like to
 *    arithmetic.
 *
 *   npx tsx scripts/measure-founder-seam-disposable.mts
 */
import { readFileSync } from "node:fs";

import { readRaster, type Mask, type Raster } from "../server/castingV2/maskedComposite.js";
import { compositeSeam, SEAM_EXCESS_LEVELS } from "../server/castingV2/compositeIntegrity.js";

const DIR = "output/founder-finding-4";
/** The band the founder marked in his crop: the shirt at the shoulder/underarm. */
const SHIRT = { x0: 40, x1: 520, y0: 780, y1: 1200 };
/** A re-encode's floor, the same one the revert measurement uses. */
const NOISE = 8;

const master = await readRaster(readFileSync(`${DIR}/master.png`));
const composite = await readRaster(readFileSync(`${DIR}/v163-hair-down.png`));

const luma = (frame: Raster, pixel: number): number => {
  const at = pixel * 3;
  return (frame.data[at]! * 299 + frame.data[at + 1]! * 587 + frame.data[at + 2]! * 114) / 1000;
};

const { width, height } = master;
const applied: Mask = { data: Buffer.alloc(width * height, 0), width, height };
let changed = 0;
for (let pixel = 0; pixel < width * height; pixel += 1) {
  const at = pixel * 3;
  const delta = Math.max(
    Math.abs(composite.data[at]! - master.data[at]!),
    Math.abs(composite.data[at + 1]! - master.data[at + 1]!),
    Math.abs(composite.data[at + 2]! - master.data[at + 2]!),
  );
  if (delta > NOISE) { applied.data[pixel] = 255; changed += 1; }
}
console.log(`frame ${width}x${height}   reconstructed applied region: ${changed.toLocaleString()} px\n`);

/* ------------------------------------------------------- 1. the product's own verdict */

const verdict = compositeSeam({ master, composite, applied });
console.log("--- compositeSeam, the detector that shipped ---");
console.log(`torn            ${verdict.torn}`);
console.log(`boundaryPixels  ${verdict.boundaryPixels.toLocaleString()}`);
console.log(`tornPixels      ${verdict.tornPixels}   (bar: ${SEAM_EXCESS_LEVELS} luma levels)`);
console.log(`share           ${(verdict.share * 100).toFixed(4)}%`);
console.log(`worstExcess     ${verdict.worstExcess.toFixed(1)}`);
console.log(`detail          ${verdict.detail}\n`);

/* --------------------------------------------- 2. the step, unsigned and signed */

type Sample = { excess: number; signed: number; x: number; y: number };
const samples: Sample[] = [];
const inside = (x: number, y: number) => applied.data[y * width + x] === 255;

for (let y = 1; y < height - 1; y += 1) {
  for (let x = 1; x < width - 1; x += 1) {
    if (!inside(x, y)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (inside(nx, ny)) continue;
      const insidePixel = y * width + x;
      const outsidePixel = ny * width + nx;
      const delivered = luma(composite, insidePixel) - luma(composite, outsidePixel);
      const original = luma(master, insidePixel) - luma(master, outsidePixel);
      samples.push({ excess: Math.abs(delivered) - Math.abs(original), signed: delivered - original, x, y });
    }
  }
}

const report = (label: string, rows: Sample[]) => {
  if (rows.length === 0) { console.log(`${label}: no boundary`); return; }
  const excesses = rows.map((row) => row.excess).sort((a, b) => a - b);
  const at = (q: number) => excesses[Math.min(excesses.length - 1, Math.floor(q * excesses.length))]!;
  const signedMean = rows.reduce((total, row) => total + row.signed, 0) / rows.length;
  const spread = Math.sqrt(rows.reduce((total, row) => total + (row.signed - signedMean) ** 2, 0) / rows.length);
  const over = (bar: number) => rows.filter((row) => row.excess > bar).length;
  console.log(`${label}`);
  console.log(`  boundary samples ${rows.length.toLocaleString()}`);
  console.log(`  excess  p50 ${at(0.5).toFixed(1)}  p90 ${at(0.9).toFixed(1)}  `
    + `p99 ${at(0.99).toFixed(1)}  max ${excesses.at(-1)!.toFixed(1)}`);
  console.log(`  over    >20 ${over(20)}   >40 ${over(40)}   >80 ${over(80)}   (the bar is >80, ≥50 px)`);
  console.log(`  signed  mean ${signedMean.toFixed(2)}  sd ${spread.toFixed(2)}  `
    + `|mean|/sd ${(Math.abs(signedMean) / (spread || 1)).toFixed(3)}`);
};

report("--- the whole boundary ---", samples);
console.log("");
report(
  "--- the founder's band: the shirt at the shoulder and underarm ---",
  samples.filter((row) => row.x >= SHIRT.x0 && row.x <= SHIRT.x1 && row.y >= SHIRT.y0 && row.y <= SHIRT.y1),
);

console.log(
  "\nA tear is one material replacing another and reads in the hundreds. A blend seam is a\n"
  + "small consistent offset the eye integrates along an edge — which is a coherence, not an\n"
  + "amplitude, and no threshold on |step| can be lowered far enough to find it without\n"
  + "drowning in texture.",
);
