/**
 * The render-fault detector, measured against real images.
 *
 * **The number that matters is FALSE POSITIVES.** A fire destroys an image the
 * customer paid for, and the refund does not give them the face back — so the
 * negative class is every real landed candidate this database still holds, and
 * any fire on one is a defect, not a tuning parameter.
 *
 * The positive class is SYNTHESISED, and the reason that is legitimate is that
 * the detector is structural and the provider's own failure was a composite:
 * it is looking for tile seams, and a tile seam is a tile seam. The risk is
 * building something that only detects MY compositing, so the synthesis varies
 * everything a real one would vary — grid arity, gutter width, gutter colour,
 * borders, deliberate misalignment — and re-encodes at provider-typical JPEG
 * quality so pristine gutters do not make the positives artificially easy.
 *
 * **What this cannot tell you: the false-negative rate.** There is one real
 * specimen in the world (D-93's nine-face grid) and it is in the production
 * database. Until it is in hand, recall is unmeasured — which is precisely why
 * the detector fails open and why it ships behind a flag.
 *
 *   npx tsx scripts/measure-render-fault.mts
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import sharp from "sharp";

import { detectRenderFault } from "../server/castingV2/renderFault";
import { openDatabase } from "./lib/dbConnection.mts";

const PUBLIC = process.env.R2_PUBLIC_URL!;

async function fetchImage(key: string): Promise<Buffer | null> {
  try {
    const response = await fetch(`${PUBLIC}/${key}`);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

/** Compose real faces into a contact sheet, the way a provider would slip. */
async function synthesiseGrid(
  sources: Buffer[],
  options: { cols: number; rows: number; gutter: number; gutterColour: string; jitter: number },
): Promise<Buffer> {
  const cell = 320;
  const { cols, rows, gutter, gutterColour, jitter } = options;
  const width = cols * cell + (cols + 1) * gutter;
  const height = rows * cell + (rows + 1) * gutter;

  const tiles = await Promise.all(
    Array.from({ length: cols * rows }, async (_, i) => {
      const source = sources[i % sources.length];
      const buffer = await sharp(source).resize(cell, cell, { fit: "cover" }).toBuffer();
      const col = i % cols;
      const row = Math.floor(i / cols);
      // Slight misalignment, because a real composite is rarely perfect.
      const wobble = () => Math.round((Math.sin(i * 7.3) * jitter));
      return {
        input: buffer,
        left: gutter + col * (cell + gutter) + wobble(),
        top: gutter + row * (cell + gutter) + wobble(),
      };
    }),
  );

  return sharp({ create: { width, height, channels: 3, background: gutterColour } })
    .composite(tiles)
    // Provider-typical encoding, so the seams are not laboratory-clean.
    .jpeg({ quality: 82 })
    .toBuffer();
}

const conn = await openDatabase(process.env.DATABASE_URL!);
const [rows] = await conn.query<any[]>(
  `SELECT imageKey FROM casting_candidates WHERE imageKey IS NOT NULL ORDER BY id DESC LIMIT 200`);
await conn.end();

console.log(`negative class: ${rows.length} real landed candidates\n`);

const real: Buffer[] = [];
let falsePositives = 0;
let unreadable = 0;

for (const row of rows) {
  const bytes = await fetchImage(row.imageKey);
  if (!bytes) { unreadable += 1; continue; }
  real.push(bytes);
  const verdict = await detectRenderFault(bytes);
  if (verdict.fault) {
    falsePositives += 1;
    console.log(`  FALSE POSITIVE on ${row.imageKey}`);
    console.log(`    ${verdict.detail}`);
  }
}

console.log(`\nreal candidates read:   ${real.length}${unreadable ? ` (${unreadable} unreadable)` : ""}`);
console.log(`FALSE POSITIVES:        ${falsePositives}  <- must be 0`);

if (real.length === 0) {
  console.log("\nno readable images — cannot measure");
  process.exit(1);
}

/* The synthesised positive class, varied so it is not one shape eight times. */
const shapes = [
  { cols: 3, rows: 3, gutter: 10, gutterColour: "#ffffff", jitter: 0, label: "3x3 white gutter" },
  { cols: 3, rows: 3, gutter: 4, gutterColour: "#111111", jitter: 2, label: "3x3 thin dark, jittered" },
  { cols: 2, rows: 2, gutter: 16, gutterColour: "#f2f2f2", jitter: 0, label: "2x2 wide light" },
  { cols: 4, rows: 2, gutter: 8, gutterColour: "#808080", jitter: 3, label: "4x2 grey, jittered" },
  { cols: 2, rows: 3, gutter: 6, gutterColour: "#ffffff", jitter: 1, label: "2x3 narrow white" },
  { cols: 3, rows: 1, gutter: 12, gutterColour: "#ffffff", jitter: 0, label: "3x1 strip" },
  { cols: 1, rows: 3, gutter: 12, gutterColour: "#ffffff", jitter: 0, label: "1x3 stack" },
  { cols: 3, rows: 3, gutter: 0, gutterColour: "#ffffff", jitter: 0, label: "3x3 EDGE TO EDGE (no gutter)" },
];

console.log("\nsynthesised positives:");
let caught = 0;
for (const shape of shapes) {
  const grid = await synthesiseGrid(real, shape);
  const verdict = await detectRenderFault(grid);
  if (verdict.fault) caught += 1;
  console.log(`  ${verdict.fault ? "CAUGHT " : "MISSED "} ${shape.label}`);
  if (!verdict.fault) console.log(`           (${verdict.reason}${verdict.detail ? `: ${verdict.detail}` : ""})`);
}
console.log(`\ncaught ${caught}/${shapes.length} synthesised grids`);
console.log("false-negative rate against REAL provider grids is UNMEASURED — one specimen exists and it is in production.");
process.exit(0);
