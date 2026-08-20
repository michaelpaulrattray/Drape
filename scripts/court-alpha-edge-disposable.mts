/**
 * THE EDGE, WHERE THE TWO RECOMPOSITES DIFFER — free, no call.
 *
 * The first edge crops were taken from the middle of the picture, which is all
 * mask and shows nothing about the boundary. This finds a box that actually
 * STRADDLES the cutout's edge (measured, not chosen by eye) and lays the two
 * recomposites over MAGENTA so transparency is visible rather than assumed —
 * the same trick that caught the `dest-in` no-op on this road.
 *
 *   npx tsx scripts/court-alpha-edge-disposable.mts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const REPO = resolve(import.meta.dirname, "..");
const OUT = resolve(REPO, "output/court-upscale-alpha");
const BOX = 200;
const ZOOM = 4;

async function alphaOf(file: string): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(resolve(OUT, file))
    .ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const soft = await alphaOf("2-recomposite-soft.png");

/*
  THE BUSIEST BOUNDARY BOX, found by counting transitions rather than picked —
  a box is scored by how many of its pixels sit next to a pixel of the opposite
  opacity, so the winner is the most boundary-dense window in the picture.
*/
let best = { left: 0, top: 0, score: -1 };
const step = 40;
for (let top = 0; top + BOX <= soft.height; top += step) {
  for (let left = 0; left + BOX <= soft.width; left += step) {
    let score = 0;
    for (let y = top; y < top + BOX; y += 2) {
      for (let x = left; x < left + BOX - 1; x += 2) {
        const here = soft.data[y * soft.width + x] > 127;
        const next = soft.data[y * soft.width + x + 1] > 127;
        if (here !== next) score += 1;
      }
    }
    if (score > best.score) best = { left, top, score };
  }
}
console.log(`boundary box ${best.left},${best.top} ${BOX}x${BOX} — ${best.score} opacity transitions in it`);

for (const [file, name] of [
  ["2-recomposite-soft.png", "edge-soft-on-magenta-4x.png"],
  ["3-recomposite-hard.png", "edge-hard-on-magenta-4x.png"],
] as const) {
  const cropped = await sharp(resolve(OUT, file))
    .extract({ left: best.left, top: best.top, width: BOX, height: BOX })
    .png()
    .toBuffer();
  /* OVER MAGENTA: a colour that appears in no tattoo and no skin, so anything
     showing through is transparency and not a guess. */
  const over = await sharp({
    create: { width: BOX, height: BOX, channels: 4, background: { r: 255, g: 0, b: 255, alpha: 1 } },
  })
    .composite([{ input: cropped, blend: "over" }])
    .resize({ width: BOX * ZOOM, height: BOX * ZOOM, kernel: "nearest" })
    .png()
    .toBuffer();
  await writeFile(resolve(OUT, name), over);
  console.log(`${name}  ${BOX * ZOOM}x${BOX * ZOOM}`);
}

/* And the same box out of the MODEL'S RAW ANSWER, so the fringe it painted
   against the flattened photograph is visible beside both repairs. */
const raw = await sharp(resolve(OUT, "1-model-raw.png"))
  .extract({ left: best.left, top: best.top, width: BOX, height: BOX })
  .resize({ width: BOX * ZOOM, height: BOX * ZOOM, kernel: "nearest" })
  .png()
  .toBuffer();
await writeFile(resolve(OUT, "edge-model-raw-4x.png"), raw);
console.log("edge-model-raw-4x.png");

process.exit(0);
