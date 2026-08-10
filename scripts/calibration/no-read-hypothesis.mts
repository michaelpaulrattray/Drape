/**
 * ARE THE NO-READS THE STRONGEST DELIVERIES? (founder/Fable hypothesis)
 *
 * The tilt instrument declined 11 of 25 renders, and the pattern was not random:
 * it failed on NBP for all three male casts while reading GPT2 almost
 * everywhere. The hypothesis is that this is not missing data at all — **NBP's
 * narrowed aperture defeats SAM's eye detection, so a no-read MARKS a strong
 * delivery** rather than an absent one. m-flat's "NO READ" render visibly
 * carries the full effect.
 *
 * If that is right, the instrument has been systematically blind to exactly the
 * renders it most needed to score, and every "unmeasured" in the matrix was
 * evidence pointing the other way. It would also mean my report of "8 of 13
 * unmeasurable" described a bias, not a gap.
 *
 * # The test IS the fix
 *
 * Re-segmenting a narrowed eye at full-frame scale is the failing step: the eyes
 * occupy about a thousandth of the frame, and making them smaller and thinner is
 * exactly the direction that loses a detector. So read from the ZONE instead —
 * crop to where the MASTER's eyes are (the master always reads), segment inside
 * that crop where the eyes fill the frame, and measure in crop coordinates.
 * Angles survive the crop untouched because the pixel aspect is preserved.
 *
 * The crop comes from the MASTER, never from the render, so the measurement
 * cannot move to wherever the answer is convenient.
 *
 *   CONFIRMED  renders that would not read at full frame now read, and read HIGH
 *   REFUTED    they read low, or still do not read
 *
 *   npx tsx scripts/calibration/no-read-hypothesis.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { cornersFromEyeMasks, cornersFromMask, readingFrom } from "../../server/castingV2/canthalTilt";
import type { Mask } from "../../server/castingV2/maskedComposite";

const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });
const OUT = "output/masked/eye-shape-matrix";
const RESOLUTION_DEG = 1.1;

const CASTS = [
  { key: "m-flat", master: "output/masked/bare-faced/cand-11.png" },
  { key: "m-level", master: "output/masked/bare-faced/cand-10.png" },
  { key: "m-mid", master: "output/masked/bare-faced/cand-15.png" },
  { key: "f-low", master: "output/masked/bare-faced/cand-06.png" },
  { key: "f-mid", master: "output/masked/bare-faced/cand-01.png" },
  { key: "f-specs", master: "output/masked/specimens/fresh-01.png" },
];

type Box = { left: number; top: number; width: number; height: number };

/** Both rungs of the ladder, over whatever image is handed in. */
async function readTilt(image: Buffer, width: number, height: number) {
  try {
    const [right, left] = await Promise.all([
      reader.region({ image, name: "right eye" }),
      reader.region({ image, name: "left eye" }),
    ]);
    const { outers, inners } = cornersFromEyeMasks(right, left);
    return readingFrom(outers, inners, width, height);
  } catch { /* next rung */ }
  try {
    const eyes: Mask = await reader.region({ image, name: "eyes" });
    const { outers, inners } = cornersFromMask(eyes);
    return readingFrom(outers, inners, width, height);
  } catch {
    return null;
  }
}

/** The method that produced the no-reads: segment the whole frame. */
const tiltFullFrame = (bytes: Buffer, width: number, height: number) => readTilt(bytes, width, height);

/** The proposed fix: segment inside the master's own eye zone. */
async function tiltViaZone(bytes: Buffer, box: Box) {
  const crop = await sharp(bytes).extract(box).png().toBuffer();
  return readTilt(crop, box.width, box.height);
}

const rows: { cast: string; engine: string; fullFrameRead: boolean; zoneDelta: number | null }[] = [];

for (const cast of CASTS) {
  const master = readFileSync(cast.master);
  const meta = await sharp(master).metadata();
  const W = meta.width!, H = meta.height!;

  const eyes = await reader.region({ image: master, name: "eyes" });
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let index = 0; index < eyes.data.length; index += 1) {
    if (eyes.data[index] <= 127) continue;
    const x = index % W;
    const y = Math.floor(index / W);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  /* Generous, because the point is that a render's eyes may sit slightly
     differently — a tight crop would clip the thing being measured. */
  const padX = Math.round((maxX - minX) * 0.45);
  const padY = Math.round((maxY - minY) * 2.2);
  const left = Math.max(0, minX - padX);
  const top = Math.max(0, minY - padY);
  const box: Box = {
    left,
    top,
    width: Math.min(W - left, (maxX - minX) + padX * 2),
    height: Math.min(H - top, (maxY - minY) + padY * 2),
  };

  const baselineZone = await tiltViaZone(master, box);
  console.log(
    `\n### ${cast.key}  zone ${box.width}x${box.height}  `
    + `baseline(zone) ${baselineZone ? `${baselineZone.meanDeg.toFixed(2)}deg` : "NO READ"}`,
  );

  for (const engine of ["nbp", "gpt2"]) {
    const file = `${OUT}/${cast.key}-${engine}.png`;
    if (!existsSync(file)) continue;
    const bytes = readFileSync(file);
    const full = await tiltFullFrame(bytes, W, H);
    const zone = await tiltViaZone(bytes, box);
    const delta = zone && baselineZone ? zone.meanDeg - baselineZone.meanDeg : null;
    rows.push({ cast: cast.key, engine, fullFrameRead: full !== null, zoneDelta: delta });
    console.log(
      `  ${engine.padEnd(5)} full-frame ${full ? `${full.meanDeg.toFixed(2)}deg` : "NO READ "}`
      + `   zone ${zone ? `${zone.meanDeg.toFixed(2)}deg` : "NO READ"}`
      + (delta === null ? "" : `   delta ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`),
    );
  }
}

writeFileSync(`${OUT}/no-read-hypothesis.json`, `${JSON.stringify(rows, null, 2)}\n`);

const mean = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
const rescued = rows.filter((row) => !row.fullFrameRead && row.zoneDelta !== null);
const alreadyRead = rows.filter((row) => row.fullFrameRead && row.zoneDelta !== null);

console.log("\n=== the hypothesis: a no-read MARKS a strong delivery ===");
console.log(`would not read full-frame : ${rescued.length} of them, ${rescued.filter((r) => r.zoneDelta !== null).length} now readable via the zone`);
console.log(`  mean tilt delta         : ${mean(rescued.map((row) => row.zoneDelta!)).toFixed(2)}deg`);
console.log(`read full-frame           : ${alreadyRead.length}`);
console.log(`  mean tilt delta         : ${mean(alreadyRead.map((row) => row.zoneDelta!)).toFixed(2)}deg`);

const confirmed = rescued.length > 0
  && mean(rescued.map((row) => row.zoneDelta!))
    > mean(alreadyRead.map((row) => row.zoneDelta!)) + RESOLUTION_DEG;
console.log(confirmed
  ? "\nCONFIRMED — the no-reads were the STRONGEST deliveries, not absent data. The instrument was blind to exactly the renders it most needed to score, and the matrix understated NBP."
  : "\nNOT CONFIRMED on these numbers. Say so rather than let the story stand — the zone fix may still be worth keeping for coverage.");

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
