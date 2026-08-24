/**
 * ARM H's OVERLAYS, REBUILT WITHOUT RE-BUYING THE READS.
 *
 * `_framing-armh-disposable.mts` made its sixteen reads, printed them, and then
 * died in its own presentation step — `sharp` refusing a composite whose tile
 * was a pixel taller than the canvas. **The reads had been paid for and the
 * record had not yet been written**, because the log and json writes sat AFTER
 * the contact sheets. So a crash in the layer that draws pictures destroyed the
 * artifact of a measurement that had already cost money.
 *
 * That is the lesson and it is why this file exists rather than a re-run: **the
 * record is written before the presentation, always.** This script re-draws the
 * overlays from the boxes the run printed — transcribed, not re-measured — and
 * writes the log and json the first run owed.
 *
 * No read, no render, no credit. It opens eight pictures and draws rectangles.
 *
 *   npx tsx scripts/_framing-armh-sheets-disposable.mts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { boxOutlineSvg } from "./lib/termsPalette.mts";

const OUT = "output/framing-court";
const SUIT_DIR = "output/two-paths-court-round5/arm3-wardrobe-covered";

type Box = { left: number; top: number; width: number; height: number };
type Read = {
  cell: "SUIT" | "HAIR";
  id: string;
  file: string;
  word: "head" | "hair";
  box: Box;
  pixels: number | null;
  faceTop: number | null;
  faceHeight: number | null;
};

/* Transcribed from the run's own stdout. Nothing here is re-derived. */
const READS: Read[] = [
  { cell: "SUIT", id: "pos1", file: `${SUIT_DIR}/pos1.png`, word: "head", box: { width: 412, height: 592, left: 303, top: 80 }, pixels: null, faceTop: 191, faceHeight: 481 },
  { cell: "SUIT", id: "pos1", file: `${SUIT_DIR}/pos1.png`, word: "hair", box: { width: 382, height: 313, left: 314, top: 78 }, pixels: null, faceTop: 191, faceHeight: 481 },
  { cell: "SUIT", id: "pos3", file: `${SUIT_DIR}/pos3.png`, word: "head", box: { width: 334, height: 479, left: 334, top: 100 }, pixels: null, faceTop: 185, faceHeight: 396 },
  { cell: "SUIT", id: "pos3", file: `${SUIT_DIR}/pos3.png`, word: "hair", box: { width: 326, height: 274, left: 335, top: 98 }, pixels: null, faceTop: 185, faceHeight: 396 },
  { cell: "SUIT", id: "pos5", file: `${SUIT_DIR}/pos5.png`, word: "head", box: { width: 379, height: 555, left: 317, top: 35 }, pixels: null, faceTop: 160, faceHeight: 432 },
  { cell: "SUIT", id: "pos5", file: `${SUIT_DIR}/pos5.png`, word: "hair", box: { width: 359, height: 330, left: 316, top: 34 }, pixels: null, faceTop: 160, faceHeight: 432 },
  { cell: "SUIT", id: "pos7", file: `${SUIT_DIR}/pos7.png`, word: "head", box: { width: 360, height: 533, left: 333, top: 102 }, pixels: null, faceTop: 217, faceHeight: 419 },
  { cell: "SUIT", id: "pos7", file: `${SUIT_DIR}/pos7.png`, word: "hair", box: { width: 362, height: 309, left: 332, top: 101 }, pixels: null, faceTop: 217, faceHeight: 419 },
  { cell: "HAIR", id: "caveman-pos0", file: `${OUT}/arm3-caveman-pos0.png`, word: "head", box: { width: 540, height: 686, left: 245, top: 194 }, pixels: 268878, faceTop: null, faceHeight: null },
  { cell: "HAIR", id: "caveman-pos0", file: `${OUT}/arm3-caveman-pos0.png`, word: "hair", box: { width: 564, height: 584, left: 236, top: 193 }, pixels: 112630, faceTop: null, faceHeight: null },
  { cell: "HAIR", id: "caveman-pos2", file: `${OUT}/arm3-caveman-pos2.png`, word: "head", box: { width: 546, height: 764, left: 210, top: 110 }, pixels: 301321, faceTop: null, faceHeight: null },
  { cell: "HAIR", id: "caveman-pos2", file: `${OUT}/arm3-caveman-pos2.png`, word: "hair", box: { width: 542, height: 428, left: 208, top: 107 }, pixels: 120057, faceTop: null, faceHeight: null },
  { cell: "HAIR", id: "caveman-pos4", file: `${OUT}/arm3-caveman-pos4.png`, word: "head", box: { width: 525, height: 904, left: 263, top: 5 }, pixels: 317880, faceTop: null, faceHeight: null },
  { cell: "HAIR", id: "caveman-pos4", file: `${OUT}/arm3-caveman-pos4.png`, word: "hair", box: { width: 531, height: 591, left: 259, top: 0 }, pixels: 158520, faceTop: null, faceHeight: null },
  { cell: "HAIR", id: "caveman-pos6", file: `${OUT}/arm3-caveman-pos6.png`, word: "head", box: { width: 463, height: 709, left: 279, top: 123 }, pixels: 242180, faceTop: null, faceHeight: null },
  { cell: "HAIR", id: "caveman-pos6", file: `${OUT}/arm3-caveman-pos6.png`, word: "hair", box: { width: 447, height: 371, left: 288, top: 121 }, pixels: 72016, faceTop: null, faceHeight: null },
];

mkdirSync(OUT, { recursive: true });

/* THE RECORD FIRST. The whole point of this file. */
writeFileSync(`${OUT}/armH.json`, JSON.stringify({ reads: READS, calls: 16, source: "transcribed from the run's stdout after its presentation step crashed" }, null, 2), "utf8");

const TILE_W = 512;
const TILE_H = 768;

for (const word of ["head", "hair"] as const) {
  const mine = READS.filter((read) => read.word === word);
  const tiles: Buffer[] = [];
  for (const read of mine) {
    const source = sharp(readFileSync(read.file));
    const { width = 1024, height = 1536 } = await source.metadata();

    /*
      THE SHARED HELPER, NOT A HAND-ROLLED RECTANGLE. `boxOutlineSvg` is the
      owner of what a box on a photograph looks like in this product — thin,
      pure white, one pixel, half-offset so the stroke does not straddle two
      rows — and it exists because the founder ruled on 2026-08-11 that
      on-image geometry is monochrome everywhere. My first draft drew a green
      box and a red line and `onImageGeometryMonochrome` went red on it, which
      is the guard doing precisely its job on precisely its class.
    */
    const boxes = [{ x: read.box.left, y: read.box.top, width: read.box.width, height: read.box.height }];
    /* The face box's top edge, as a full-width one-pixel rule — the same white,
       distinguished by being a line across the frame rather than a rectangle. */
    if (read.faceTop !== null) boxes.push({ x: 0, y: read.faceTop, width, height: 1 });
    const overlays: sharp.OverlayOptions[] = [
      { input: Buffer.from(boxOutlineSvg(width, height, boxes)), top: 0, left: 0 },
    ];
    /*
      TWO PASSES, AND THIS IS THE DEFECT THAT KILLED BOTH EARLIER DRAFTS.
      **sharp's pipeline order is not the call order** — `resize` is applied
      BEFORE `composite` however they are chained, so `.composite(bars).resize()`
      shrinks the frame to 320px first and then tries to lay a 1024px bar on it,
      which it refuses with "must have same dimensions or smaller". The error
      names the composite and the cause is the resize, which is why it survived
      one rewrite: I changed the drawing and the drawing was innocent.
    */
    const drawn = await source.composite(overlays).png().toBuffer();
    /* The full-size annotated frame is kept too: a one-pixel white rule is the
       ruled mark and it does not survive a heavy downscale, so the contact
       sheet is for comparing eight at once and THIS is for looking closely. */
    writeFileSync(`${OUT}/ARMH-${word}-${read.id}.png`, drawn);
    tiles.push(
      await sharp(drawn)
        .resize({ width: TILE_W, height: TILE_H, fit: "contain", background: "#141414" })
        .png()
        .toBuffer(),
    );
  }
  const sheet = await sharp({
    create: { width: TILE_W * tiles.length, height: TILE_H, channels: 3, background: "#141414" },
  })
    .composite(tiles.map((tile, i) => ({ input: tile, left: TILE_W * i, top: 0 })))
    .png()
    .toBuffer();
  writeFileSync(`${OUT}/ARMH-${word}.png`, sheet);
  console.log(`kept ${OUT}/ARMH-${word}.png — the box is "${word}"; where a full-width rule crosses the frame, that is the face box top`);
  console.log(`  order: ${mine.map((read) => read.id).join(", ")}`);
}

/* And the last statement ends the process. */
process.exit(0);
