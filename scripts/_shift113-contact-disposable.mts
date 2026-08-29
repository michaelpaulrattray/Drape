/**
 * DISPOSABLE — foreman-113, 2026-08-30. #246 second-word fixture survey.
 *
 * Builds ONE contact sheet of every candidate frame so my eye can pick the
 * absent/present cells BEFORE any paid read. It picks nothing itself.
 *
 * foreman-106's earned rule binds what may be done with the output: a contact
 * sheet PICKS candidates, it never certifies one — every cell chosen here is
 * re-opened at full resolution before it is called absent.
 *
 *   npx tsx scripts/_shift113-contact-disposable.mts
 *
 * No network, no database, no money.
 */
import { readdirSync, mkdirSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

const SOURCES = ["output/_shift100-frames", "output/_shift104-widening"];
const OUT = "output/_shift113";
mkdirSync(OUT, { recursive: true });

const CELL = 300;
const COLS = 7;

type Cell = { label: string; file: string };
const cells: Cell[] = [];
for (const dir of SOURCES) {
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".png")) continue;
    if (name.includes("WHERE") || name.startsWith("STRIP") || name === "contact.png" || name === "deck-check.png") continue;
    cells.push({ label: `${path.basename(dir).replace("_shift", "")}/${name.replace(".png", "")}`, file: path.join(dir, name) });
  }
}
if (cells.length === 0) throw new Error("no frames found — the survey would print an empty sheet and read as 'nothing available'");

const rows = Math.ceil(cells.length / COLS);
const composites: sharp.OverlayOptions[] = [];
for (const [index, cell] of cells.entries()) {
  const thumb = await sharp(cell.file).resize(CELL, CELL, { fit: "contain", background: "#111" }).png().toBuffer();
  composites.push({ input: thumb, left: (index % COLS) * CELL, top: Math.floor(index / COLS) * (CELL + 22) });
  const caption = await sharp({
    create: { width: CELL, height: 22, channels: 3, background: "#000" },
  }).composite([{
    input: Buffer.from(`<svg width="${CELL}" height="22"><text x="4" y="16" font-family="monospace" font-size="14" fill="#fff">${cell.label}</text></svg>`),
  }]).png().toBuffer();
  composites.push({ input: caption, left: (index % COLS) * CELL, top: Math.floor(index / COLS) * (CELL + 22) + CELL });
}

await sharp({ create: { width: COLS * CELL, height: rows * (CELL + 22), channels: 3, background: "#111" } })
  .composite(composites)
  .jpeg({ quality: 88 })
  .toFile(`${OUT}/contact.jpg`);

console.log(`${cells.length} frames -> ${OUT}/contact.jpg`);
for (const cell of cells) console.log(`  ${cell.label}  ${cell.file}`);
process.exit(0);
