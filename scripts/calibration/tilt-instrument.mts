/**
 * VERIFY THE INSTRUMENT BEFORE BELIEVING ITS FINDINGS (working law 2).
 *
 * The canthal-tilt measure is about to decide three things: which specimen the
 * fox-eyes capability probe runs on, whether any probe render actually complied,
 * and eventually whether a paying user's ask is refused for free because her
 * eyes already sweep. None of that is allowed to rest on a number nobody has
 * checked.
 *
 * # TWO INSTRUMENTS WERE TRIED HERE, AND THE FIRST ONE FAILED THIS FILE
 *
 * Asking `moondream3-preview/point` for "outer corner of the eye" gave an **8.3
 * degree noise floor on repeat measurements of one unchanged face** and a 16.7
 * degree residual against a transform it had been handed. It could not see an 8
 * degree change, so it could never have seen a render. Corners now come from the
 * extremal columns of the SAM-class eye mask instead — a swap, not a tune, which
 * is the fidelity law's own instruction. Noise floor: zero, because a
 * segmentation's edge is arithmetic rather than aim.
 *
 * # THE CONTROL THAT WAS WRONG, AND WHY IT IS WORTH WRITING DOWN
 *
 * The first control here rotated the image and expected the reading to follow.
 * It did not, and the instrument was nearly condemned for it. **Canthal tilt is
 * measured per eye against that eye's own inner-to-outer axis, so a head tilt
 * raises one eye's angle and lowers the other's and the MEAN is invariant.**
 * That invariance is exactly what you want — a tilted head must not read as
 * upswept eyes — so the control was testing for a property the measure is
 * correct not to have. Fifth boundary error of this workstream, same shape as
 * the other four: a check built against the wrong thing, firing on something
 * that was working.
 *
 * # THE CONTROL THAT CAN ACTUALLY GO RED
 *
 * A TENT WARP: every pixel is lifted in proportion to its distance from the
 * face's vertical midline, `y' = y - k*|x - cx|`. That raises the OUTER corner
 * of each eye more than its inner one, on both sides at once, and by pure
 * geometry it adds exactly `atan(k)` degrees to every canthal tilt in the frame
 * — no model, no render, no opinion. So:
 *
 *   measured(tent(image, k)) - measured(image)  ==  atan(k)
 *
 * The negative control rides along: `k = 0` must move the reading by nothing.
 *
 *   npx tsx scripts/calibration/tilt-instrument.mts
 */import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { cornersFromMask, medianReading, readingFrom, type TiltReading } from "../../server/castingV2/canthalTilt";

const OUT = "output/masked/tilt-instrument";
mkdirSync(OUT, { recursive: true });

const SPECIMEN = process.argv[2] ?? "output/masked/probe/18c9c4fb-e6a6-4aaa-b6ba-3e689fba021f.png";
const SAMPLES = Number(process.env.TILT_SAMPLES ?? 5);
/* Expected added tilt, in degrees. `k = tan(theta)` makes the warp add exactly theta. */
const ANGLES = [0, 8, 4];

const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

/**
 * One live reading. The corners come from the EYE MASK's extremal columns
 * rather than from a point model — the point model failed this very control
 * (8.3deg noise floor, 16.7deg residual against a known rotation), and the
 * answer to an instrument that cannot see is a different instrument.
 */
async function readTilt(image: Buffer, width: number, height: number): Promise<TiltReading | null> {
  try {
    const eyes = await reader.region({ image, name: "eyes" });
    const { outers, inners } = cornersFromMask(eyes);
    return readingFrom(outers, inners, width, height);
  } catch (error) {
    console.log(`    (reading failed: ${String(error).slice(0, 70)})`);
    return null;
  }
}

/**
 * THE TENT WARP — lift every pixel in proportion to its distance from the
 * midline, which adds a known angle to every canthal tilt in the frame.
 *
 * Inverse mapping (for each destination pixel, ask where it came from), because
 * that is the only way to fill an output without holes. Nearest-neighbour is
 * fine here: the segmenter is being asked where an edge is, and a resample that
 * softens edges would flatter the instrument rather than test it.
 */
async function tented(bytes: Buffer, k: number, width: number, height: number): Promise<Buffer> {
  if (k === 0) return bytes;
  const { data } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(width * height * 3, 0);
  const cx = width / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      /* Destination (x,y) was lifted by k*|x-cx|, so it came from further down. */
      const sourceY = Math.round(y + k * Math.abs(x - cx));
      if (sourceY < 0 || sourceY >= height) continue;
      const from = (sourceY * width + x) * 3;
      const to = (y * width + x) * 3;
      out[to] = data[from];
      out[to + 1] = data[from + 1];
      out[to + 2] = data[from + 2];
    }
  }
  return sharp(out, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

const master = readFileSync(SPECIMEN);
const meta = await sharp(master).metadata();
const W = meta.width!, H = meta.height!;
console.log(`instrument control on ${SPECIMEN}  (${W}x${H}, ${SAMPLES} samples per warp)\n`);

const rows: { angle: number; median: number; spread: number; asymmetry: number; n: number }[] = [];

for (const angle of ANGLES) {
  const image = await tented(master, Math.tan((angle * Math.PI) / 180), W, H);
  writeFileSync(`${OUT}/tented-${angle}.png`, image);

  const readings: TiltReading[] = [];
  for (let sample = 0; sample < SAMPLES; sample += 1) {
    const reading = await readTilt(image, W, H);
    if (reading) readings.push(reading);
  }
  if (readings.length === 0) {
    console.log(`+${String(angle).padStart(2)}deg  NO READINGS — the landmarker refused every sample`);
    continue;
  }
  const summary = medianReading(readings);
  rows.push({
    angle,
    median: summary.meanDeg,
    spread: summary.spreadDeg,
    asymmetry: summary.asymmetryDeg,
    n: readings.length,
  });
  console.log(
    `+${String(angle).padStart(2)}deg  measured ${summary.meanDeg.toFixed(2)}deg  `
    + `(spread ${summary.spreadDeg.toFixed(2)}, asymmetry ${summary.asymmetryDeg.toFixed(2)}, n=${readings.length})`,
  );
}

const base = rows.find((row) => row.angle === 0);
if (!base) {
  console.log("\nNO BASELINE — the instrument could not read the unrotated face. It is not usable.");
  process.exit(1);
}

console.log("\n=== POSITIVE CONTROL: does the reading follow a known TILT? ===");
let worstResidual = 0;
for (const row of rows) {
  if (row.angle === 0) continue;
  const observed = row.median - base.median;
  /* One sign, because the tent lifts both outer corners: the reading must go UP
     by the angle the warp added. A residual measured against |observed| would
     let a sign error pass, which is how a control stops being one. */
  const residual = Math.abs(observed - row.angle);
  worstResidual = Math.max(worstResidual, residual);
  console.log(
    `  warped +${String(row.angle).padStart(2)}deg -> reading moved ${observed.toFixed(2)}deg  `
    + `residual ${residual.toFixed(2)}deg`,
  );
}

console.log(`\nnoise floor (spread at 0deg): ${base.spread.toFixed(2)}deg`);
console.log(`worst residual against a known tilt: ${worstResidual.toFixed(2)}deg`);
const usable = worstResidual <= 3 && base.spread <= 4;
console.log(
  usable
    ? `\nUSABLE. Any tilt change smaller than ~${Math.max(base.spread, worstResidual).toFixed(1)}deg is inside the instrument's own noise and must not be called.`
    : `\nNOT USABLE AS IS. The instrument cannot follow a tilt it was handed, so it cannot be trusted about a render. Do not report tilt findings from it.`,
);

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ specimen: SPECIMEN, samples: SAMPLES, rows, worstResidual, usable }, null, 2)}\n`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
