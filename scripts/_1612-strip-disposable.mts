/**
 * DISPOSABLE — build #1612 part 3's eye strip: the same cast, no template beside
 * template, so his eye can judge the court rather than read its table.
 *
 * Writes to output/ only. No network, no credits, no database.
 */
import { writeFileSync } from "node:fs";

import sharp from "sharp";

const DIR = "output/1612-part3/court";
const CELL_W = 620;

async function cell(file: string, caption: string): Promise<Buffer> {
  const body = await sharp(`${DIR}/${file}`).resize(CELL_W, null).toBuffer();
  const meta = await sharp(body).metadata();
  const label = Buffer.from(
    `<svg width="${CELL_W}" height="64"><rect width="100%" height="100%" fill="#0A0A0A"/>`
    + `<text x="20" y="41" font-family="Inter, Arial" font-size="25" fill="#EBEBEB">${caption}</text></svg>`,
  );
  return sharp({
    create: { width: CELL_W, height: (meta.height ?? 0) + 64, channels: 3, background: { r: 10, g: 10, b: 10 } },
  })
    .composite([{ input: label, top: 0, left: 0 }, { input: body, top: 64, left: 0 }])
    .png()
    .toBuffer();
}

async function strip(name: string, cells: Array<{ file: string; caption: string }>): Promise<void> {
  const built = await Promise.all(cells.map((one) => cell(one.file, one.caption)));
  const metas = await Promise.all(built.map((bytes) => sharp(bytes).metadata()));
  const height = Math.max(...metas.map((meta) => meta.height ?? 0));
  const width = CELL_W * built.length + 16 * (built.length - 1);
  const out = await sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 10, b: 10 } },
  })
    .composite(built.map((input, index) => ({ input, top: 0, left: index * (CELL_W + 16) })))
    .png()
    .toBuffer();
  writeFileSync(`output/1612-part3/${name}`, out);
  console.log(`${name}: ${width}x${height}`);
}

await strip("1612-strip-sifr2.png", [
  { file: "56-A-no-template-1.png", caption: "Sifr2 — no template" },
  { file: "56-B-template-5.png", caption: "Sifr2 — with the template" },
]);
await strip("1612-strip-pika.png", [
  { file: "63-A-no-template-1.png", caption: "Pika — no template" },
  { file: "63-B-template-2.png", caption: "Pika — with the template (refused: not her)" },
]);

process.exit(0);
