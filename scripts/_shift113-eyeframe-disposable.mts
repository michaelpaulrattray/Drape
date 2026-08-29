/**
 * DISPOSABLE — foreman-113, 2026-08-30. The eye frame for his page.
 *
 * Two columns, four faces, one question asked of all four: "where are the
 * eyebrows?" The red is the studio's own answer, painted exactly where it gave
 * it — nothing is placed by hand and nothing is chosen for effect. LEFT are two
 * faces with no eyebrow hair; RIGHT are two with eyebrows, asked the same word
 * in the same sitting, and they are on the sheet because a picture of a failure
 * with no control beside it is an anecdote.
 *
 * The pixel counts are READ OUT of the run's own report rather than retyped, so
 * a number under a face cannot drift from the arm that produced it.
 *
 *   npx tsx scripts/_shift113-eyeframe-disposable.mts
 *
 * No network, no database, no money.
 */
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";

import sharp from "sharp";

const OUT = "output/_shift113";
mkdirSync(OUT, { recursive: true });

const report = readFileSync(`${OUT}/report.md`, "utf8");
function pixelsOf(id: string): number {
  const block = report.split(`## ${id} `)[1];
  if (block === undefined) throw new Error(`${id} is not in the report`);
  const line = block.split("\n").find((l) => l.trim().startsWith("mask:"));
  if (line === undefined) throw new Error(`${id} has no mask line`);
  const match = /mask: (\d+) px/.exec(line);
  if (match === null) throw new Error(`${id} produced no pixel count - it cannot be captioned`);
  return Number(match[1]);
}

/* left column = no eyebrow hair; right column = eyebrows. Same word, same sitting. */
const GRID = [
  [{ id: "BR-ANG-C-2", label: "NO eyebrows" }, { id: "BR-LAM-K-2", label: "HAS eyebrows" }],
  [{ id: "BR-ANG-C-0", label: "NO eyebrows" }, { id: "BR-53", label: "HAS eyebrows" }],
];

const COL = 620;
const CAP = 40;
const tiles: sharp.OverlayOptions[] = [];
let rowTop = 0;
let cellHeight = 0;

for (const row of GRID) {
  for (const [index, cell] of row.entries()) {
    const file = `${OUT}/${cell.id}-WHERE.png`;
    if (!existsSync(file)) throw new Error(`${file} is missing`);
    const meta = await sharp(file).metadata();
    const width = meta.width ?? 1024;
    const height = meta.height ?? 1536;
    /* Tight on the eye band so the shape of the answer is visible at the size
       his page draws it. */
    const crop = await sharp(file)
      .extract({ left: 0, top: Math.round(height * 0.14), width, height: Math.round(height * 0.20) })
      .resize({ width: COL })
      .png()
      .toBuffer();
    const cropMeta = await sharp(crop).metadata();
    cellHeight = cropMeta.height ?? 0;
    tiles.push({ input: crop, left: index * COL, top: rowTop });
    tiles.push({
      input: Buffer.from(
        `<svg width="${COL}" height="${CAP}"><rect width="${COL}" height="${CAP}" fill="#000"/>`
        + `<text x="8" y="27" font-family="Arial,Helvetica,sans-serif" font-size="20" fill="#fff">`
        + `${cell.label} &#8212; studio answered ${pixelsOf(cell.id).toLocaleString("en-US")} px</text></svg>`,
      ),
      left: index * COL,
      top: rowTop + cellHeight,
    });
  }
  rowTop += cellHeight + CAP;
}

await sharp({ create: { width: COL * 2, height: rowTop, channels: 3, background: "#000" } })
  .composite(tiles)
  .jpeg({ quality: 88 })
  .toFile(`${OUT}/EYE-brows.jpg`);
const size = statSync(`${OUT}/EYE-brows.jpg`).size;
console.log(`${OUT}/EYE-brows.jpg  ${COL * 2}x${rowTop}  ${size} bytes`);
process.exit(0);
