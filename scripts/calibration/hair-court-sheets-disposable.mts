/**
 * CONTACT SHEETS, so the truth can be declared BY EYE before the machine
 * answers.
 *
 * The order matters: the eye goes first, then the capture. A truth column
 * written after seeing the reader's choice is not a control, it is agreement.
 *
 *   npx tsx scripts/calibration/hair-court-sheets-disposable.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const OUT = "output/hair-court";
const masters = JSON.parse(readFileSync(`${OUT}/masters.json`, "utf8")) as Array<{
  candidateId: number; file: string;
}>;

const CELL = 430;
const LABEL = 34;
const COLS = 4;
const PER_SHEET = 12;

for (let sheet = 0; sheet * PER_SHEET < masters.length; sheet += 1) {
  const slice = masters.slice(sheet * PER_SHEET, (sheet + 1) * PER_SHEET);
  const rows = Math.ceil(slice.length / COLS);
  const width = COLS * CELL;
  const height = rows * (CELL + LABEL);

  const composites: sharp.OverlayOptions[] = [];
  for (const [index, master] of slice.entries()) {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    /* The HEAD is the subject, so the cell keeps the top of the portrait rather
       than a centre crop that cuts a bun off. */
    const cell = await sharp(master.file)
      .resize({ width: CELL, height: CELL, fit: "cover", position: "top" })
      .png()
      .toBuffer();
    composites.push({ input: cell, left: col * CELL, top: row * (CELL + LABEL) });
    const label = Buffer.from(
      `<svg width="${CELL}" height="${LABEL}"><rect width="${CELL}" height="${LABEL}" fill="#111"/>`
      + `<text x="8" y="24" font-family="monospace" font-size="22" fill="#fff">cand-${master.candidateId}</text></svg>`,
    );
    composites.push({ input: label, left: col * CELL, top: row * (CELL + LABEL) + CELL });
  }

  const file = `${OUT}/SHEET-${sheet + 1}.png`;
  await sharp({ create: { width, height, channels: 3, background: "#000" } })
    .composite(composites).png().toFile(file);
  console.log(`${file}  (${slice.length} faces)`);
}

writeFileSync(`${OUT}/sheet-order.json`, JSON.stringify(masters.map((m) => m.candidateId)));
