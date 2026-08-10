/**
 * THE BISECT, AS PICTURES — this shift's founder tile pack (fable-186: a cell
 * is not CLOSED until its pack exists, with the weaknesses in the captions).
 *
 * Seven tiles, ONE SCALE, the same window in source pixels for every row, so
 * the only thing that varies between tiles is what the recipe did. A tile that
 * sets its own scale normalises away exactly the size it exists to show.
 *
 *   npx tsx scripts/calibration/count-bisect-sheet.mts
 *
 * The story left to right, and it is a short one:
 *
 *   the crop we are trying to carry              her lips at 5.42% of her face
 *   the same prompt with NO crop, ×3             4.23 / 4.26 / 4.33% — her own
 *   the same prompt with the crop, named, ×3     4.46 / 4.50 / 4.73% — fuller
 *
 * Two references is enough. The five-slot recipe was never the reason it
 * worked. The captions carry the margin against the no-crop tiles rather than
 * against a band from another recipe, because that is the comparison the
 * pictures actually support.
 */
import { readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

import { loadMaskFile, type FaceMask } from "../lib/shapeOnFace.mts";

const EDIT_LAW = "output/edit-law";
const BISECT = "output/count-bisect";
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

const bisect = JSON.parse(await readFile(`${BISECT}/bisect.json`, "utf8"));
const cell = JSON.parse(await readFile(`${EDIT_LAW}/cell.json`, "utf8"));
const pct = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(2)}%`);

const tiles: Buffer[] = [];
const missing: string[] = [];
const push = async (label: string, frame: string, maskPath: string) => {
  const built = await tile(label, frame, await loadMaskFile(maskPath));
  if (built) tiles.push(built); else missing.push(label);
};

const minted = cell.lipReadings["a2-fuller"].fullness as number;
await push(`the crop — ${pct(minted)}`, `${EDIT_LAW}/a2-fuller.png`, `${EDIT_LAW}/reads/a2-fuller--lips.png`);
for (const row of (bisect.rows["null-no-crop"] ?? [])) {
  await push(`no crop — ${pct(row.fullness)}`, `${BISECT}/${row.label}.png`, `${BISECT}/reads/${row.label}--lips.png`);
}
for (const row of (bisect.rows["bisect-two-ref"] ?? [])) {
  await push(`2 refs, named — ${pct(row.fullness)}`, `${BISECT}/${row.label}.png`, `${BISECT}/reads/${row.label}--lips.png`);
}

if (tiles.length === 0) { console.error("no tiles built — NOT-RUN"); process.exit(1); }

const heights = await Promise.all(tiles.map(async (input) => (await sharp(input).metadata()).height!));
await writeFile(`${BISECT}/SHEET-count-bisect.png`, await sharp({
  create: { width: TILE * tiles.length, height: Math.max(...heights), channels: 3, background: "#0A0A0A" },
}).composite(tiles.map((input, index) => ({ input, left: index * TILE, top: 0 }))).png().toBuffer());

console.log(`wrote ${BISECT}/SHEET-count-bisect.png  (${tiles.length} tiles, one scale, same window)`);
if (missing.length > 0) console.log(`  named rather than dropped — no tile for: ${missing.join(", ")}`);

console.log("\nWHAT THE SHEET SHOWS THE NUMBERS UNDERSTATE, said first because he will see it first:");
console.log("  the leftmost tile — the lips we are trying to carry — is VISIBLY fuller than all");
console.log("  six others, INCLUDING the three that carried. The carried tiles are hard to tell");
console.log("  from the no-crop tiles by eye. That is the graded finding as a picture: the crop");
console.log("  gets a vote, it wins about a third of the distance, and a third of the distance is");
console.log("  not what a customer would call 'she has those lips'. Measurable is not delivered.");

console.log("\nTHE WEAKNESSES, in the captions' own terms:");
console.log("  · The margins are small in absolute terms — 0.13 to 0.40 percentage points of face");
console.log("    area above the no-crop tiles. They count because three paints of the identical");
console.log("    no-crop prompt spread only 0.10pp, so the engine's own wobble is narrower than");
console.log("    the effect. On the SHINE measure the same test fails, and this sheet therefore");
console.log("    makes no claim about gloss at all.");
console.log("  · n=3 per arm. Enough to see a consistent direction, not enough for a rate.");
console.log("  · Dropping five references to two also moves the crop's POSITION. A carry clears");
console.log("    both together; it cannot separate them, and nothing here claims it does.");
process.exit(0);
