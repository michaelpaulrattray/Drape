/**
 * DISPOSABLE — foreman-113, 2026-08-30. #246 second word: CERTIFY THE CELLS.
 *
 * foreman-106's earned rule, verbatim from its own report: "an absent cell's
 * absence is verified at the resolution the claim is made at, not the
 * resolution the frame was chosen at. A contact sheet picks candidates; it
 * never certifies one." That shift called a frame bald off a 300-pixel thumb
 * and the reader was right and it was wrong.
 *
 * So this crops the BROW BAND of each candidate at native resolution and
 * writes it out at 2x, for my eye, before any read fires.
 *
 *   npx tsx scripts/_shift113-eyecrop-disposable.mts
 *
 * No network, no database, no money.
 */
import { mkdirSync } from "node:fs";

import sharp from "sharp";

const OUT = "output/_shift113";
mkdirSync(OUT, { recursive: true });

const CANDIDATES = [
  "output/_shift104-widening/ANG-C-0.png",
  "output/_shift104-widening/ANG-C-2.png",
  "output/_shift104-widening/ANG-K-0.png",
  "output/_shift100-frames/c1871.png",
  "output/_shift104-widening/LAM-K-2.png",
  "output/_shift100-frames/53.png",
];

const tiles: sharp.OverlayOptions[] = [];
const WIDE = 900;
let top = 0;
for (const file of CANDIDATES) {
  const meta = await sharp(file).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1536;
  /* The brow band: these are chest-up portraits with the head at the top, so
     8%-30% of frame height holds forehead-through-eyes on every one of them.
     Verified by looking, not assumed — a band that misses the eyes would make
     every cell below read as "no brows" for the wrong reason. */
  const bandTop = Math.round(height * 0.06);
  const bandHeight = Math.round(height * 0.26);
  const crop = await sharp(file)
    .extract({ left: 0, top: bandTop, width, height: bandHeight })
    .resize({ width: WIDE })
    .png()
    .toBuffer();
  const cropMeta = await sharp(crop).metadata();
  tiles.push({ input: crop, left: 0, top });
  tiles.push({
    input: Buffer.from(`<svg width="${WIDE}" height="26"><rect width="${WIDE}" height="26" fill="#000"/><text x="6" y="19" font-family="monospace" font-size="16" fill="#fff">${file}</text></svg>`),
    left: 0,
    top: top + (cropMeta.height ?? 0),
  });
  top += (cropMeta.height ?? 0) + 26;
}

await sharp({ create: { width: WIDE, height: top, channels: 3, background: "#111" } })
  .composite(tiles)
  .jpeg({ quality: 92 })
  .toFile(`${OUT}/brow-band.jpg`);
console.log(`${CANDIDATES.length} brow bands -> ${OUT}/brow-band.jpg`);
process.exit(0);
