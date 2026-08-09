/**
 * DISPOSABLE — did the earrings render actually CHANGE her hair?
 *
 * The reader said `hairWorn` was verified on renders 1 and 2 and NOT verified
 * on render 3, describing the same head two different ways. Either the painter
 * restyled her hair, or the reader flipped on an unchanged picture. That is a
 * question about pixels, so it is answered with pixels (working law 1).
 *
 * A band table across the frame, master vs each variant, in mean absolute
 * luminance delta per block. A composite that keeps the master outside the
 * edit's mask leaves the hair blocks at ~0.
 */
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const DIR = "output/run6-audit";
const COLS = 8;
const ROWS = 12;

async function gray(path: string, width: number, height: number): Promise<Uint8Array> {
  const buffer = await readFile(path);
  const raw = await sharp(buffer)
    .resize(width, height, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  return new Uint8Array(raw);
}

function blockDeltas(a: Uint8Array, b: Uint8Array, width: number, height: number): number[][] {
  const table: number[][] = [];
  const blockW = Math.floor(width / COLS);
  const blockH = Math.floor(height / ROWS);
  for (let row = 0; row < ROWS; row += 1) {
    const line: number[] = [];
    for (let col = 0; col < COLS; col += 1) {
      let sum = 0;
      let count = 0;
      for (let y = row * blockH; y < (row + 1) * blockH; y += 1) {
        for (let x = col * blockW; x < (col + 1) * blockW; x += 1) {
          const index = y * width + x;
          sum += Math.abs(a[index]! - b[index]!);
          count += 1;
        }
      }
      line.push(count === 0 ? 0 : sum / count);
    }
    table.push(line);
  }
  return table;
}

function render(label: string, table: number[][]): void {
  console.log(`\n${label}  — mean |Δluma| per block, 8 cols × 12 rows (0 = untouched)`);
  console.log("      " + Array.from({ length: COLS }, (_, i) => `c${i}`.padStart(6)).join(""));
  table.forEach((line, row) => {
    console.log(`  r${String(row).padStart(2)} ` + line.map((v) => v.toFixed(1).padStart(6)).join(""));
  });
  const flat = table.flat();
  console.log(`  max ${Math.max(...flat).toFixed(2)}   mean ${(flat.reduce((s, v) => s + v, 0) / flat.length).toFixed(2)}`);
}

async function main(): Promise<void> {
  const meta = await sharp(await readFile(`${DIR}/00-master.png`)).metadata();
  const width = Math.min(512, meta.width ?? 512);
  const height = Math.round((width * (meta.height ?? 768)) / (meta.width ?? 512));
  console.log(`comparing at ${width}×${height} (source ${meta.width}×${meta.height})`);

  const master = await gray(`${DIR}/00-master.png`, width, height);
  for (const name of ["01-freckles", "02-lipgloss", "03-earrings"]) {
    const variant = await gray(`${DIR}/${name}.png`, width, height);
    render(`master → ${name}`, blockDeltas(master, variant, width, height));
  }

  /* And the pair the reader disagreed about, against each other. */
  const two = await gray(`${DIR}/02-lipgloss.png`, width, height);
  const three = await gray(`${DIR}/03-earrings.png`, width, height);
  render("02-lipgloss → 03-earrings (reader flipped between these two)", blockDeltas(two, three, width, height));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
