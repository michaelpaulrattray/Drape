/**
 * THE CONFIGURATION DIFF, AS PICTURES (owed to the founder per fable-186).
 *
 * One row, ONE SCALE, so the only thing that varies between tiles is what the
 * recipe did. Left to right: the crop being carried, the recipe that reverted,
 * and the recipe that carried — with the gloss mirror last, which is the tile
 * that shows a crop failing to deliver in the very recipe that carries a hoop.
 *
 *   npx tsx scripts/calibration/carry-diff-sheet.mts
 */
import { readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

import { loadMaskFile, type FaceMask } from "../lib/shapeOnFace.mts";

const EDIT_LAW = "output/edit-law";
const DIFF = "output/carry-diff";
const TILE = 260;
const LABEL = 34;
const WINDOW = { w: 460, h: 340 };

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function caption(text: string): Promise<Buffer> {
  return sharp(Buffer.from(
    `<svg width="${TILE}" height="${LABEL}"><rect width="${TILE}" height="${LABEL}" fill="#0A0A0A"/>`
    + `<text x="8" y="22" font-family="Inter, Arial" font-size="14" fill="#EBEBEB">${escape(text)}</text></svg>`,
  )).png().toBuffer();
}

async function tile(label: string, frame: string, mask: FaceMask | null): Promise<Buffer | null> {
  const bytes = await readFile(frame).catch(() => null);
  if (!bytes || !mask) return null;
  const meta = await sharp(bytes).metadata();
  const left = Math.max(0, Math.min(meta.width! - WINDOW.w, Math.round(mask.cx - WINDOW.w / 2)));
  const top = Math.max(0, Math.min(meta.height! - WINDOW.h, Math.round(mask.cy - WINDOW.h / 2)));
  const cropped = await sharp(bytes)
    .extract({ left, top, width: WINDOW.w, height: WINDOW.h })
    .resize({ width: TILE, height: Math.round(TILE * WINDOW.h / WINDOW.w) })
    .png().toBuffer();
  return sharp(cropped).extend({ top: LABEL, background: "#0A0A0A" })
    .composite([{ input: await caption(label), top: 0, left: 0 }]).png().toBuffer();
}

const diff = JSON.parse(await readFile(`${DIFF}/diff.json`, "utf8"));
const cell = JSON.parse(await readFile(`${EDIT_LAW}/cell.json`, "utf8"));
const pct = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(2)}%`);

const tiles: Buffer[] = [];
const minted = cell.lipReadings["a2-fuller"].fullness as number;
const push = async (label: string, frame: string, maskPath: string) => {
  const built = await tile(label, frame, await loadMaskFile(maskPath));
  if (built) tiles.push(built); else console.log(`  missing: ${label}`);
};

await push(`the crop carried — ${pct(minted)}`, `${EDIT_LAW}/a2-fuller.png`, `${EDIT_LAW}/reads/a2-fuller--lips.png`);
for (const index of [1, 2]) {
  const reading = cell.lipReadings[`b-carry-${index}`];
  await push(`2 refs — REVERTED${reading ? ` ${pct(reading.fullness)}` : ""}`,
    `${EDIT_LAW}/b-carry-${index}.png`, `${EDIT_LAW}/reads/b-carry-${index}--lips.png`);
}
for (const row of (diff.rows["fuller-in-carrying-config"] ?? [])) {
  await push(`5 refs — CARRIED ${pct(row.fullness)}`, `${DIFF}/${row.label}.png`, `${DIFF}/reads/${row.label}--lips.png`);
}
for (const row of (diff.rows["gloss-in-carrying-config"] ?? []).slice(0, 2)) {
  await push(`gloss crop — shine ${pct(row.specular)}`, `${DIFF}/${row.label}.png`, `${DIFF}/reads/${row.label}--lips.png`);
}

const heights = await Promise.all(tiles.map(async (input) => (await sharp(input).metadata()).height!));
await writeFile(`${DIFF}/SHEET-configuration-diff.png`, await sharp({
  create: { width: TILE * tiles.length, height: Math.max(...heights), channels: 3, background: "#0A0A0A" },
}).composite(tiles.map((input, index) => ({ input, left: index * TILE, top: 0 }))).png().toBuffer());

console.log(`wrote ${DIFF}/SHEET-configuration-diff.png  (${tiles.length} tiles, one scale)`);
console.log("The gloss tiles carry a SHINE number, not a fullness one — that crop was asked to");
console.log("change a surface, and the natural band tops out at 2.75%.");
process.exit(0);
