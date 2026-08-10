/**
 * A ZOOM PAIR, WITH THE WINDOW DERIVED RATHER THAN CHOSEN.
 *
 * The boundary artifacts the founder found — the ghost rim where his glasses
 * were, the shirt seam under the arm — are small, and a crop window picked by
 * eye is a crop window that can be picked to flatter. So the window is derived
 * from the two frames themselves: the densest patch of change between them.
 * If the artifact is where the change is, the window finds it; if the window
 * finds nothing, that is a reading too.
 *
 * Emits BEFORE, AFTER and the amplified DIFFERENCE at the same window, so the
 * founder judges the frame and the instrument agrees or does not.
 *
 *   npx tsx scripts/pack-zoom-pair-disposable.mts --before a.png --after b.png \
 *     --name ghost-rim --out output/pack/boundary [--scale 3] [--fraction 0.22]
 */
import { mkdirSync } from "node:fs";

import sharp from "sharp";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const beforePath = arg("before");
const afterPath = arg("after");
const name = arg("name", "pair");
const OUT = arg("out", "output/pack/boundary");
const SCALE = Number(arg("scale", "3"));
const FRACTION = Number(arg("fraction", "0.22"));
/* Only look for the window inside this vertical band of the frame, when the
   caller knows which part of the body the artifact is on. Stated as an input
   rather than hidden in the search, so a narrowed search is visible. */
const BAND_TOP = Number(arg("bandTop", "0"));
const BAND_BOTTOM = Number(arg("bandBottom", "1"));
if (!beforePath || !afterPath) { console.error("--before and --after are required"); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const a = await sharp(beforePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const b = await sharp(afterPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
  console.error(`frames differ in size (${a.info.width}x${a.info.height} vs ${b.info.width}x${b.info.height}) — refusing to resample`);
  process.exit(1);
}
const W = a.info.width;
const H = a.info.height;

/* The per-pixel change, once — used both to find the window and to draw it. */
const delta = new Uint8Array(W * H);
for (let index = 0; index < W * H; index += 1) {
  const at = index * 4;
  delta[index] = Math.max(
    Math.abs(a.data[at]! - b.data[at]!),
    Math.abs(a.data[at + 1]! - b.data[at + 1]!),
    Math.abs(a.data[at + 2]! - b.data[at + 2]!),
  );
}

const win = { w: Math.round(W * FRACTION), h: Math.round(H * FRACTION) };
const step = Math.max(4, Math.round(Math.min(W, H) / 80));
const searchTop = Math.round(H * BAND_TOP);
const searchBottom = Math.min(H - win.h, Math.round(H * BAND_BOTTOM) - win.h);
let best = { left: 0, top: searchTop, score: -1 };
for (let top = searchTop; top <= searchBottom; top += step) {
  for (let left = 0; left <= W - win.w; left += step) {
    let score = 0;
    /* Sub-sampled: the window is thousands of pixels and the ranking only
       needs to be right, not exact. */
    for (let y = top; y < top + win.h; y += 3) {
      const row = y * W;
      for (let x = left; x < left + win.w; x += 3) score += delta[row + x]!;
    }
    if (score > best.score) best = { left, top, score };
  }
}

const box = { left: best.left, top: best.top, width: win.w, height: win.h };
console.log(`${name}: window derived at ${box.left},${box.top} ${box.width}x${box.height} (of ${W}x${H})`);

let changed = 0;
const diff = Buffer.alloc(win.w * win.h * 4);
for (let y = 0; y < win.h; y += 1) {
  for (let x = 0; x < win.w; x += 1) {
    const value = delta[(box.top + y) * W + (box.left + x)]!;
    if (value > 0) changed += 1;
    const shown = Math.min(255, value * 6);
    const at = (y * win.w + x) * 4;
    diff[at] = shown; diff[at + 1] = shown; diff[at + 2] = shown; diff[at + 3] = 255;
  }
}
console.log(`  pixels changed inside the window: ${changed.toLocaleString()} of ${(win.w * win.h).toLocaleString()}`);

for (const [label, file] of [["before", beforePath], ["after", afterPath]] as const) {
  await sharp(file).extract(box)
    .resize(box.width * SCALE, box.height * SCALE, { kernel: "nearest" })
    .png().toFile(`${OUT}/${name}-${label}.png`);
}
await sharp(diff, { raw: { width: win.w, height: win.h, channels: 4 } })
  .resize(box.width * SCALE, box.height * SCALE, { kernel: "nearest" })
  .png().toFile(`${OUT}/${name}-difference.png`);
console.log(`  written to ${OUT}/${name}-{before,after,difference}.png`);
process.exit(0);
