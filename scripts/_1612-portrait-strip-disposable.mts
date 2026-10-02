/**
 * DISPOSABLE — #1612, the `frontClose` bound: the strip for his eye.
 *
 * Six of his own frames in order of how much picture sits below the face, with
 * the line this court draws. Same shape as the close-up strip his Desk reply
 * #248 closed ("this looks good"), so the two are read the same way.
 *
 * Local only, no network, no writes beyond the file it makes.
 *   npx tsx scripts/_1612-portrait-strip-disposable.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve("output/_1612-frames");
const CELL = 230;
const CELL_H = Math.round(CELL * 1.49);
const CAPTION = 118;

/** Measured 2026-10-02 through `fal-ai/sam-3/image` + BiRefNet; 10/10 repeats identical. */
const FRAMES: Array<{ asset: string; room: string; verdict: string; who: string; slot: string }> = [
  { asset: "336", room: "1.10", verdict: "KEEP", who: "Jenny Craig", slot: "Portrait" },
  { asset: "295", room: "1.51", verdict: "KEEP", who: "Shina", slot: "Portrait" },
  { asset: "343", room: "2.32", verdict: "KEEP", who: "Kai", slot: "Portrait" },
  { asset: "381", room: "3.03", verdict: "KEEP", who: "Hingu", slot: "Portrait" },
  { asset: "337", room: "4.61", verdict: "TRY AGAIN", who: "Jenny Craig", slot: "Full length" },
  { asset: "320", room: "7.72", verdict: "TRY AGAIN", who: "Sifr2", slot: "Full length" },
];

/** Where the line is drawn — after the fourth cell, in the empty band 3.03 … 4.61. */
const LINE_AFTER = 3;

const sharp = (await import("sharp")).default;
const cells = await Promise.all(
  FRAMES.map(async (entry) =>
    sharp(readFileSync(path.join(DIR, `${entry.asset}.png`)))
      .resize({ width: CELL, height: CELL_H, fit: "contain", background: "#EBEBEB" })
      .toBuffer()),
);

const width = CELL * FRAMES.length;
const height = CELL_H + CAPTION;
const captions = FRAMES.map((entry, index) => {
  const x = index * CELL + CELL / 2;
  const line = index === LINE_AFTER
    ? `<rect x="${(index + 1) * CELL - 2}" y="0" width="4" height="${height}" fill="#0A0A0A"/>`
      + `<text x="${(index + 1) * CELL + 10}" y="18" font-family="Inter, Arial" font-size="15" font-weight="600" fill="#0A0A0A">the line: 3.7</text>`
    : "";
  return `
    ${line}
    <text x="${x}" y="${CELL_H + 30}" text-anchor="middle" font-family="Inter, Arial" font-size="22" font-weight="600" fill="#0A0A0A">${entry.room}</text>
    <text x="${x}" y="${CELL_H + 54}" text-anchor="middle" font-family="Inter, Arial" font-size="15" fill="#0A0A0A">${entry.who}</text>
    <text x="${x}" y="${CELL_H + 76}" text-anchor="middle" font-family="Inter, Arial" font-size="13" fill="#555">${entry.slot}</text>
    <text x="${x}" y="${CELL_H + 100}" text-anchor="middle" font-family="Inter, Arial" font-size="15" font-weight="600" fill="${entry.verdict === "KEEP" ? "#0A0A0A" : "#8a1c1c"}">${entry.verdict}</text>`;
}).join("");

const plate = await sharp({
  create: { width, height, channels: 3, background: "#EBEBEB" },
})
  .composite([
    ...cells.map((buffer, index) => ({ input: buffer, left: index * CELL, top: 0 })),
    { input: Buffer.from(`<svg width="${width}" height="${height}">${captions}</svg>`), left: 0, top: 0 },
  ])
  .png()
  .toBuffer();

const out = path.resolve("output/_1612-portrait-bound-strip.png");
writeFileSync(out, plate);
console.log(`wrote ${out} — ${width}×${height}, ${Math.round(plate.length / 1024)} KB`);

process.exit(0);
