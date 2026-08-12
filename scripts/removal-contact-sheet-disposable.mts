/**
 * THE AUDIT SHEET — every face's master beside every frame painted from it, at
 * the size the question needs.
 *
 * The false-pass half of D-236 is settled by human eyes, and eyes on a portrait
 * at thumbnail size cannot see a ghost rim or a changed woman. But eyes on
 * twenty-four full portraits, one at a time, lose the comparison that matters:
 * the master and its paint have to be in the same field of view or "same woman"
 * is being judged from memory.
 *
 * So each row is one face — master first, then her paints in order — cropped to
 * the head, where every fact in question lives (the frames are shoulders-up
 * portraits; the glasses, the earlobes, the nose and the identity are all in the
 * top half).
 *
 *   npx tsx scripts/removal-contact-sheet-disposable.mts output/shift63-removal-class
 */
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const DIR = process.argv[2] ?? "output/shift63-removal-class";
const CELL = Number(process.env.CELL ?? 420);

const files = (await readdir(DIR)).filter((name) => name.endsWith(".png") && !name.startsWith("sheet-"));
const masters = new Map<string, string>();
try {
  for (const name of (await readdir(path.join(DIR, "masters"))).filter((n) => n.endsWith(".png"))) {
    masters.set(name.slice(0, 8), path.join(DIR, "masters", name));
  }
} catch { /* the synthesis arm keeps its specimen in the same folder */ }

/** `row` puts every file in the folder in one strip — the way to look at eight
 *  masters at once and choose a specimen. */
const ONE_ROW = process.argv[3] === "row";
const rows = new Map<string, string[]>();
for (const name of files.sort()) {
  const face = ONE_ROW ? "all" : name.slice(0, 8);
  if (!rows.has(face)) rows.set(face, []);
  rows.get(face)!.push(path.join(DIR, name));
}

/**
 * The window onto the frame, as fractions of it — head by default.
 *
 * A septum stud is a few dozen pixels in a 1024x1536 portrait and does not
 * survive a 420px cell, which is the same downsample problem the marks reader
 * had: what changes the answer is what the eye is SHOWN. `BOX=0.35,0.18,0.3,0.22`
 * puts the nose across the whole cell.
 */
const BOX = (process.env.BOX ?? "0,0,1,0.55").split(",").map(Number);
const cell = async (file: string): Promise<Buffer> => {
  const image = sharp(file);
  const meta = await image.metadata();
  const full = { width: meta.width ?? 1024, height: meta.height ?? 1536 };
  return await image
    .extract({
      left: Math.round(full.width * BOX[0]), top: Math.round(full.height * BOX[1]),
      width: Math.round(full.width * BOX[2]), height: Math.round(full.height * BOX[3]),
    })
    .resize({ width: CELL })
    .png()
    .toBuffer();
};

let sheet = 0;
for (const [face, paints] of rows) {
  const cells: Buffer[] = [];
  const master = masters.get(face);
  if (master) cells.push(await cell(master));
  for (const paint of paints) cells.push(await cell(paint));

  const first = await sharp(cells[0]).metadata();
  const rowHeight = first.height ?? CELL;
  const canvas = sharp({
    create: {
      width: CELL * cells.length, height: rowHeight,
      channels: 3, background: { r: 20, g: 20, b: 20 },
    },
  });
  const out = path.join(DIR, `sheet-${face}.png`);
  await writeFile(out, await canvas
    .composite(cells.map((buffer, at) => ({ input: buffer, left: CELL * at, top: 0 })))
    .png().toBuffer());
  console.log(`${face}  ${cells.length} cells${master ? " (master first)" : ""} → ${out}`);
  sheet += 1;
}
console.log(`\n${sheet} sheets.`);
process.exit(0);
