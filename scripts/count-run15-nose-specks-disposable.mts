/**
 * THE COUNT WHERE THE FRECKLES ACTUALLY ARE.
 *
 * The density counter reads a cheek-and-nose BAND, and on this woman the band
 * is 55% skin and dominated by lower cheek — so a scatter concentrated on her
 * nose bridge is averaged against a large area that never changes. It reported
 * 01 at +9% and 03 at +3% over her floor, inside a noise of 77 specks of her
 * own pore texture.
 *
 * This counts the same way, on the same population, in the SUB-WINDOW where the
 * pigment is visible at 8× (`output/marks-court/ZOOM-run15-nose.png`) — the
 * upper nose. Nothing else changes: same local-skin baseline, same threshold
 * from the amplitude registry, same connected components, her master first.
 *
 * It reads the PATCH files the counter already wrote, so the population is
 * identical by construction rather than by a second segmentation that could
 * move between frames.
 *
 *   npx tsx scripts/count-run15-nose-specks-disposable.mts
 */
import sharp from "sharp";

import { CHANGE_AMPLITUDE } from "../server/castingV2/changeAmplitude";

const DARKER_BY = CHANGE_AMPLITUDE.marks.levels;
const MIN_AREA = 3;
const MAX_AREA = 120;
/* The nose bridge, in patch coordinates — the window the 8× look used. */
const WINDOW = { left: 100, top: 8, width: 100, height: 60 };

const FRAMES = [
  { name: "00 her master", file: "output/marks-court/PATCH-00.png" },
  { name: "01 freckles", file: "output/marks-court/PATCH-01.png" },
  { name: "03 gloss", file: "output/marks-court/PATCH-03.png" },
  { name: "04 hoops", file: "output/marks-court/PATCH-04.png" },
  { name: "05 removal", file: "output/marks-court/PATCH-05.png" },
];

function baseline(values: Buffer, skin: Uint8Array, width: number, height: number, radius = 10): Float32Array {
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (!skin[pixel]) continue;
      let sum = 0;
      let count = 0;
      for (let dy = Math.max(0, y - radius); dy <= Math.min(height - 1, y + radius); dy += 1) {
        for (let dx = Math.max(0, x - radius); dx <= Math.min(width - 1, x + radius); dx += 1) {
          const near = dy * width + dx;
          if (!skin[near]) continue;
          sum += values[near]!;
          count += 1;
        }
      }
      out[pixel] = count > 0 ? sum / count : values[pixel]!;
    }
  }
  return out;
}

let floor: number | null = null;
console.log("frame            skin px   specks   per 1000   vs her floor");
console.log("-".repeat(64));
for (const frame of FRAMES) {
  const raw = await sharp(frame.file).extract(WINDOW).greyscale().raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = raw.info;
  /* The counter blacked out everything off the population, so skin is anything
     that is not pure black — the same mask on every frame by construction. */
  const skin = new Uint8Array(width * height);
  let pixels = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (raw.data[pixel]! === 0) continue;
    skin[pixel] = 1;
    pixels += 1;
  }
  const local = baseline(raw.data, skin, width, height);
  const dark = new Uint8Array(width * height);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (!skin[pixel]) continue;
    if (local[pixel]! - raw.data[pixel]! >= DARKER_BY) dark[pixel] = 1;
  }
  const seen = new Uint8Array(width * height);
  let specks = 0;
  for (let start = 0; start < width * height; start += 1) {
    if (!dark[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    let area = 0;
    while (stack.length > 0) {
      const pixel = stack.pop()!;
      area += 1;
      const x = pixel % width;
      const y = (pixel - x) / width;
      for (const near of [
        x > 0 ? pixel - 1 : -1, x < width - 1 ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1, y < height - 1 ? pixel + width : -1,
      ]) {
        if (near < 0 || seen[near] || !dark[near]) continue;
        seen[near] = 1;
        stack.push(near);
      }
    }
    if (area >= MIN_AREA && area <= MAX_AREA) specks += 1;
  }
  const perThousand = (specks / pixels) * 1000;
  if (floor === null) floor = perThousand;
  console.log(`${frame.name.padEnd(16)} ${String(pixels).padStart(7)} ${String(specks).padStart(8)}`
    + `   ${perThousand.toFixed(2).padStart(8)}   ${perThousand >= floor ? "+" : "−"}`
    + `${Math.abs(perThousand - floor).toFixed(2)} (${(((perThousand / floor) - 1) * 100).toFixed(0)}%)`);
}
