/**
 * THE EDIT-LAW CELL, AS PICTURES — the founder reads faces, not percentages.
 *
 * fable-182 asked for tiles alongside the cell's numbers. Three sheets, each
 * built only from frames and masks already on disk, so this costs nothing and
 * can be re-run after any arm is added:
 *
 *   SHEET-lips    the founding case in one row — bare master, the gloss ask,
 *                 fuller+gloss, and each remove-gloss paint. The question
 *                 "did it come back bare AND fuller" is answerable by eye here.
 *   SHEET-carry   the minted lips crop against what each hair-edit delivered.
 *   SHEET-ears    the intro anchors against the item and instance edits.
 *
 *   npx tsx scripts/calibration/edit-law-sheets.mts
 *
 * A tile whose frame or mask is missing is drawn as a labelled gap rather than
 * skipped, so a sheet can never quietly show fewer arms than were run.
 */
import { readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

import { loadMaskFile, boxOf, componentsOf, type FaceMask } from "../lib/shapeOnFace.mts";

const OUT = "output/edit-law";
const BENCH = "output/cprime";
const TILE = 260;
const LABEL = 34;

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function caption(text: string, width: number): Promise<Buffer> {
  return sharp(Buffer.from(
    `<svg width="${width}" height="${LABEL}"><rect width="${width}" height="${LABEL}" fill="#0A0A0A"/>`
    + `<text x="8" y="22" font-family="Inter, Arial" font-size="15" fill="#EBEBEB">${escape(text)}</text></svg>`,
  )).png().toBuffer();
}

async function gap(text: string): Promise<Buffer> {
  return sharp(Buffer.from(
    `<svg width="${TILE}" height="${TILE}"><rect width="${TILE}" height="${TILE}" fill="#1A1A1A"/>`
    + `<text x="12" y="${TILE / 2}" font-family="Inter, Arial" font-size="14" fill="#777">${escape(text)}</text></svg>`,
  )).png().toBuffer();
}

/**
 * One tile: a FIXED-SIZE window of source pixels centred on the feature.
 *
 * The first draft cropped each tile to its own mask's bounding box and resized
 * that to fill the tile — which normalises size away. A mouth measured as a
 * quarter fuller and a hoop measured at half its carried size both came out
 * looking the same as everything beside them, because the crop had silently
 * rescaled each one to fit. A sheet whose whole job is "is this bigger" cannot
 * be built out of tiles that each set their own scale.
 *
 * So every tile in a row takes the SAME window in source pixels, centred on the
 * feature's centroid, and is scaled by the same factor. Sizes across a row are
 * then directly comparable by eye, which is the only way the founder is being
 * asked to read them.
 */
async function tile(
  label: string, framePath: string, mask: FaceMask | null,
  window: { w: number; h: number },
): Promise<Buffer> {
  const bytes = await readFile(framePath).catch(() => null);
  if (!bytes || !mask) {
    return sharp(await gap(!bytes ? "frame not on disk" : "no mask"))
      .extend({ top: LABEL, background: "#0A0A0A" })
      .composite([{ input: await caption(label, TILE), top: 0, left: 0 }])
      .png().toBuffer();
  }
  const meta = await sharp(bytes).metadata();
  const left = Math.max(0, Math.min(meta.width! - window.w, Math.round(mask.cx - window.w / 2)));
  const top = Math.max(0, Math.min(meta.height! - window.h, Math.round(mask.cy - window.h / 2)));
  const cropped = await sharp(bytes)
    .extract({ left, top, width: Math.min(window.w, meta.width!), height: Math.min(window.h, meta.height!) })
    .resize({ width: TILE, height: Math.round(TILE * window.h / window.w) })
    .png().toBuffer();
  const drawn = await sharp(cropped).metadata();
  return sharp(cropped)
    .extend({ top: LABEL, background: "#0A0A0A" })
    .composite([{ input: await caption(label, TILE), top: 0, left: 0 }])
    .resize({ width: TILE, height: drawn.height! + LABEL })
    .png().toBuffer();
}

/** Every tile in a row is the same window, so the row has ONE scale. */
const LIP_WINDOW = { w: 460, h: 340 };
const EAR_WINDOW = { w: 300, h: 400 };

async function row(name: string, tiles: Buffer[]): Promise<void> {
  if (tiles.length === 0) { console.log(`  ${name}: nothing to draw`); return; }
  /* Derived from the tiles themselves — a hard-coded strip height silently
     crops the bottom off every tile when a window's aspect changes. */
  const heights = await Promise.all(tiles.map(async (input) => (await sharp(input).metadata()).height!));
  const height = Math.max(...heights);
  const canvas = sharp({
    create: { width: TILE * tiles.length, height, channels: 3, background: "#0A0A0A" },
  });
  await writeFile(`${OUT}/${name}.png`, await canvas
    .composite(tiles.map((input, index) => ({ input, left: index * TILE, top: 0 })))
    .png().toBuffer());
  console.log(`  wrote ${OUT}/${name}.png  (${tiles.length} tiles)`);
}

const lipsMask = (label: string, dir = `${OUT}/reads`) => loadMaskFile(`${dir}/${label}--lips.png`);

/* ------------------------------------------------------------ SHEET-lips */

/**
 * The captions carry the numbers from the cell's own ledger, so a tile and a
 * table can never disagree — and they carry the WEAKNESS too. fable-186: the
 * pack is a trust document, so a measure that could not answer says so on the
 * picture rather than in a footnote the founder has to go and find.
 */
const cell = await readFile(`${OUT}/cell.json`, "utf8").then(JSON.parse).catch(() => null);
const lipReadings: Record<string, { fullness: number; specular: number }> = cell?.lipReadings ?? {};
const fullness = (label: string) => {
  const reading = lipReadings[label];
  return reading ? ` — ${(reading.fullness * 100).toFixed(2)}% full` : "";
};

const lipRow: Buffer[] = [];
lipRow.push(await tile(
  `master — bare${cell ? ` — ${(cell.controls.masterLips.fullness * 100).toFixed(2)}% full` : ""}`,
  `${OUT}/master.png`, await lipsMask("master"), LIP_WINDOW,
));
for (const [label, text] of [
  ["a0-maxgloss", "a0 max gloss (control)"],
  ["a1-gloss", "a1 gloss asked"],
  ["a2-fuller", "a2 fuller + gloss"],
  ["a4-matte-fuller", "a4 fuller, MATTE (control)"],
  ["a5-wet-fuller", "a5 fuller, WET (control)"],
  ["a3-remove-1", "a3 gloss struck (1)"],
  ["a3-remove-2", "a3 gloss struck (2)"],
  ["a3-remove-3", "a3 gloss struck (3)"],
] as const) {
  lipRow.push(await tile(`${text}${fullness(label)}`, `${OUT}/${label}.png`, await lipsMask(label), LIP_WINDOW));
}
await row("SHEET-lips", lipRow);
console.log(
  "  caption note: '% full' is the lips as a share of the face. The unedited repaint band is"
  + `\n  ${cell ? `${(cell.controls.bandFullness.lo * 100).toFixed(2)}–${(cell.controls.bandFullness.hi * 100).toFixed(2)}%` : "—"}`
  + ", so anything above it is genuinely a fuller mouth. GLOSS is deliberately not"
  + "\n  captioned as a verdict on these tiles — the measure could not separate shine from"
  + "\n  volume on a fuller lip, which is why a4 and a5 are in the row for the eye to judge.",
);

/*
  A SECOND LIPS ROW, AND THE REASON IT EXISTS IS THE REASON IT IS LABELLED.

  One scale answers "is it fuller" and is too small to answer "is it shiny".
  A tight crop answers "is it shiny" and destroys every size comparison. Both
  are honest; neither is honest unlabelled, so each row says on its own face
  which question it can be asked.
*/
const surfaceRow: Buffer[] = [];
for (const [label, text] of [
  ["master", "master — bare"],
  ["a4-matte-fuller", "a4 MATTE control"],
  ["a5-wet-fuller", "a5 WET control"],
  ["a3-remove-1", "a3 gloss struck (1)"],
  ["a3-remove-2", "a3 gloss struck (2)"],
  ["a3-remove-3", "a3 gloss struck (3)"],
] as const) {
  const mask = await lipsMask(label);
  const frame = label === "master" ? `${OUT}/master.png` : `${OUT}/${label}.png`;
  /* Each tile fills its own frame: SIZES ARE NOT COMPARABLE HERE, by design. */
  const box = mask ? boxOf(mask, 20) : null;
  const window = box ? { w: box.w, h: box.h } : LIP_WINDOW;
  surfaceRow.push(await tile(text, frame, mask, window));
}
await row("SHEET-lips-surface", surfaceRow);
console.log("  SHEET-lips-surface is cropped to fill — SIZES ARE NOT COMPARABLE on it, only shine.");

/* ----------------------------------------------------------- SHEET-carry */

const carryRow: Buffer[] = [];
carryRow.push(await tile(`a2 — the minted crop${fullness("a2-fuller")}`, `${OUT}/a2-fuller.png`, await lipsMask("a2-fuller"), LIP_WINDOW));
for (let index = 1; index <= 3; index += 1) {
  const label = `b-carry-${index}`;
  carryRow.push(await tile(`b${index} — hair edited${fullness(label)}`, `${OUT}/${label}.png`, await lipsMask(label), LIP_WINDOW));
}
for (let index = 1; index <= 3; index += 1) {
  const label = `bp-scoped-${index}`;
  carryRow.push(await tile(`b'${index} — clause scoped${fullness(label)}`, `${OUT}/${label}.png`, await lipsMask(label), LIP_WINDOW));
}
for (let index = 1; index <= 3; index += 1) {
  const label = `bq-legible-${index}`;
  carryRow.push(await tile(`b"${index} — crop at 3x${fullness(label)}`, `${OUT}/${label}.png`, await lipsMask(label), LIP_WINDOW));
}
for (let index = 1; index <= 3; index += 1) {
  const label = `br-first-${index}`;
  carryRow.push(await tile(`b'''${index} — crop sent FIRST${fullness(label)}`, `${OUT}/${label}.png`, await lipsMask(label), LIP_WINDOW));
}
await row("SHEET-carry", carryRow);

/* ------------------------------------------------------------ SHEET-ears */

/** The larger earring component on one side of the face, or null. */
async function hoop(label: string, dir: string, side: "img-left" | "img-right"): Promise<FaceMask | null> {
  const earrings = await loadMaskFile(`${dir}/${label}--earring.png`);
  const face = await loadMaskFile(`${dir}/${label}--face.png`);
  if (!earrings || !face) return null;
  let best: FaceMask | null = null;
  for (const component of componentsOf(earrings, 150).kept) {
    const componentSide = component.cx < face.cx ? "img-left" : "img-right";
    if (componentSide !== side) continue;
    if (!best || component.pixels > best.pixels) best = component;
  }
  return best;
}

const earRow: Buffer[] = [];
earRow.push(await tile("intro anchor — left", `${BENCH}/cell2g-1.png`, await hoop("cell2g-1", `${BENCH}/reads`, "img-left"), EAR_WINDOW));
earRow.push(await tile("intro anchor — right", `${BENCH}/cell2g-1.png`, await hoop("cell2g-1", `${BENCH}/reads`, "img-right"), EAR_WINDOW));
for (const [label, text] of [
  ["c-bigger-1", "c — both bigger"],
  ["d-oneear-1", "d — left edited"],
] as const) {
  earRow.push(await tile(`${text}, left`, `${OUT}/${label}.png`, await hoop(label, `${OUT}/reads`, "img-left"), EAR_WINDOW));
  earRow.push(await tile(`${text}, right`, `${OUT}/${label}.png`, await hoop(label, `${OUT}/reads`, "img-right"), EAR_WINDOW));
}
await row("SHEET-ears", earRow);

process.exit(0);
