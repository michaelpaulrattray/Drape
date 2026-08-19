/**
 * THE COURT ON ONE SHEET, for the founder's own eyes (working law 9).
 *
 * Fifteen frames read one at a time is a reading nobody can check. This crops
 * each render to the band the tattoo lives in and lays the four arms out in
 * rows, so which arm carried the ink is a glance rather than a claim.
 *
 * The subject faces camera, so HER LEFT ARM IS ON THE RIGHT OF EVERY TILE.
 */
import sharp from "sharp";
import path from "node:path";
import { readdir } from "node:fs/promises";

const OUT = path.resolve("output/single-view-arm-court");
const files = await readdir(OUT);
const ROWS = [
  { label: "A — left blank, words \"her left\"   CORRECT = ink on the RIGHT of the tile", match: ["sv-c1-asis.png", "sv-c2-asis.png", "sv-c3-asis.png", "ext-a4-A-left.png", "ext-a5-A-left.png"] },
  { label: "B — the A plate hand-flopped, words \"her left\"   (not a road the product travels)", match: ["sv-m1-mirrored.png", "sv-m2-mirrored.png"] },
  { label: "C — right blank, words \"her right\"   CORRECT = ink on the LEFT of the tile", match: ["sv-right-r1-asis.png", "sv-right-r2-asis.png", "ext-c3-C-right.png", "ext-c4-C-right.png", "ext-c5-C-right.png"] },
  { label: "D — right blank on the CLEAN plate, words \"her right\"   CORRECT = LEFT of the tile", match: ["ext-d1-D-right-clean.png", "ext-d2-D-right-clean.png", "ext-d3-D-right-clean.png"] },
];
for (const row of ROWS) {
  for (const file of row.match) if (!files.includes(file)) throw new Error(`the panel names a frame that is not there: ${file}`);
}

const TILE_W = 420, TILE_H = 300, HEAD = 34, PAD = 8;
const cols = Math.max(...ROWS.map((row) => row.match.length));
const width = PAD + cols * (TILE_W + PAD);
const height = ROWS.reduce((sum) => sum + HEAD + TILE_H + PAD, PAD);

const layers: sharp.OverlayOptions[] = [];
let top = PAD;
for (const row of ROWS) {
  layers.push({
    input: Buffer.from(`<svg width="${width}" height="${HEAD}"><text x="4" y="22" font-family="Helvetica,Arial" font-size="17" fill="#0A0A0A">${row.label.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}</text></svg>`),
    left: PAD, top,
  });
  top += HEAD;
  let left = PAD;
  for (const file of row.match) {
    const meta = await sharp(path.join(OUT, file)).metadata();
    const w = meta.width ?? 0, h = meta.height ?? 0;
    /* The band the upper arms occupy in a full-length frontFull frame, measured
       off the frames rather than guessed: shoulders to just below the elbow. */
    const tile = await sharp(path.join(OUT, file))
      .extract({ left: Math.round(w * 0.22), top: Math.round(h * 0.20), width: Math.round(w * 0.56), height: Math.round(h * 0.28) })
      .resize({ width: TILE_W, height: TILE_H, fit: "contain", background: "#ffffff" })
      .toBuffer();
    layers.push({ input: tile, left, top });
    left += TILE_W + PAD;
  }
  top += TILE_H + PAD;
}

const file = path.join(OUT, "COURT-PANEL-single-view-arm.jpg");
await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
  .composite(layers).jpeg({ quality: 92 }).toFile(file);
console.log(`wrote ${file}  (${width}×${height})`);
process.exit(0);
