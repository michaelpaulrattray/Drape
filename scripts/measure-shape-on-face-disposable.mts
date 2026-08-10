/**
 * IS IT THE SAME OBJECT, OR ONLY AN OBJECT IN THE SAME PLACE?
 *
 * The C′ bench measured shape agreement as IoU in IMAGE coordinates, and under
 * Nano Banana Pro the head itself wanders 58 px between paints — so a perfectly
 * reproduced pair of glasses on a moved head scores badly, and a re-invented
 * pair on a still head scores well. The image-space number cannot tell the two
 * apart, and the founder tile pack shows by eye that it matters: NBP's frames 3
 * and 4 are wearing visibly chunkier glasses than 1, 2 and 5.
 *
 * So this re-computes IoU in the FACE's own frame. Mask B is mapped into mask
 * A's coordinates through each paint's own face centroid and face scale, and
 * only then overlapped. Head translation and head size cancel; what is left is
 * the shape question alone.
 *
 * Costs nothing: every mask is already on disk in `output/cprime/reads/`,
 * cached by the bench. No engine, no reader, no network.
 *
 *   npx tsx scripts/measure-shape-on-face-disposable.mts
 */
import { existsSync, readFileSync } from "node:fs";

import sharp from "sharp";

const READS = "output/cprime/reads";

type Mask = { data: Buffer; width: number; height: number; pixels: number; cx: number; cy: number };

async function mask(label: string, item: string): Promise<Mask | null> {
  const path = `${READS}/${label}--${item}.png`;
  if (!existsSync(path)) return null;
  const { data, info } = await sharp(readFileSync(path)).greyscale().raw().toBuffer({ resolveWithObject: true });
  let pixels = 0; let sumX = 0; let sumY = 0;
  for (let index = 0; index < data.length; index += 1) {
    if (data[index] === 0) continue;
    pixels += 1;
    sumX += index % info.width;
    sumY += Math.floor(index / info.width);
  }
  if (pixels === 0) return null;
  return { data, width: info.width, height: info.height, pixels, cx: sumX / pixels, cy: sumY / pixels };
}

/**
 * B's mask, redrawn where it would sit if B's head were A's head.
 *
 * # WHY THIS MAPS BACKWARDS
 *
 * The obvious direction — walk B's set pixels, scatter each into A's grid — is
 * what the first version did, and it PERFORATES: when the scale factor is above
 * 1 the mapped points no longer tile the plane, so a solid mask arrives full of
 * holes and reads as disagreement. Dilating to close them then costs the
 * identity case its own points, which is exactly what the control caught: a
 * mask remapped onto its own face scored 0.953 when it must score 1.000.
 *
 * Walking A's grid and sampling B instead cannot perforate — every destination
 * pixel is visited exactly once, by construction. Nearest-neighbour sampling is
 * deliberate: this is a binary mask, and interpolating one invents partial
 * membership that the overlap count would then need a threshold to resolve.
 */
function ontoFaceOf(b: Mask, faceB: Mask, faceA: Mask, a: Mask): Uint8Array {
  /* A's pixels are expressed in B's frame, so this is the inverse of the scale
     that would carry B forward into A. */
  const scale = Math.sqrt(faceB.pixels) / Math.sqrt(faceA.pixels);
  const out = new Uint8Array(a.width * a.height);
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const sourceX = Math.round(faceB.cx + (x - faceA.cx) * scale);
      const sourceY = Math.round(faceB.cy + (y - faceA.cy) * scale);
      if (sourceX < 0 || sourceY < 0 || sourceX >= b.width || sourceY >= b.height) continue;
      if (b.data[sourceY * b.width + sourceX]! > 0) out[y * a.width + x] = 1;
    }
  }
  return out;
}

function iou(a: Mask, mapped: Uint8Array): number {
  let both = 0; let either = 0;
  for (let index = 0; index < mapped.length; index += 1) {
    const inA = a.data[index]! > 0;
    const inB = mapped[index] === 1;
    if (!inA && !inB) continue;
    either += 1;
    if (inA && inB) both += 1;
  }
  return either === 0 ? 0 : both / either;
}

const CELLS: Record<string, string[]> = {
  "CELL 1  NBP, no ask": ["cell1-1", "cell1-2", "cell1-3", "cell1-4", "cell1-5"],
  "CELL 2  NBP, eyes to green": ["cell2-1", "cell2-2", "cell2-3", "cell2-4", "cell2-5"],
  "CELL 2g GPT Image 2, eyes to green": ["cell2g-1", "cell2g-2", "cell2g-3"],
};

/* ------------------------------------------------------------- control */

console.log("THE CONTROL, BEFORE ANY FIGURE");
{
  const a = await mask("cell1-1", "glasses");
  const face = await mask("cell1-1", "face");
  if (!a || !face) {
    console.log("  NO-READ on cell1-1 — the control did not run, so nothing below is backed.");
  } else {
    const self = iou(a, ontoFaceOf(a, face, face, a));
    console.log(`  a mask remapped onto its OWN face      IoU ${self.toFixed(3)}   ${self > 0.97 ? "the remap is faithful" : "THE REMAP LOSES SHAPE — every figure below is understated"}`);
  }
}

/* --------------------------------------------------------- the figures */

for (const [title, labels] of Object.entries(CELLS)) {
  console.log(`\n${title}`);
  for (const item of ["glasses", "hair", "earring"]) {
    const scores: number[] = [];
    let skipped = 0;
    for (let i = 0; i < labels.length; i += 1) {
      for (let j = i + 1; j < labels.length; j += 1) {
        const [a, b, faceA, faceB] = await Promise.all([
          mask(labels[i]!, item), mask(labels[j]!, item),
          mask(labels[i]!, "face"), mask(labels[j]!, "face"),
        ]);
        if (!a || !b || !faceA || !faceB) { skipped += 1; continue; }
        if (a.width !== b.width || a.height !== b.height) { skipped += 1; continue; }
        scores.push(iou(a, ontoFaceOf(b, faceB, faceA, a)));
      }
    }
    if (scores.length === 0) { console.log(`  ${item.padEnd(9)} NO PAIRS READ — reported as a NO-READ, not as a zero`); continue; }
    const mean = scores.reduce((total, value) => total + value, 0) / scores.length;
    console.log(
      `  ${item.padEnd(9)} shape agreement ON THE FACE  mean ${mean.toFixed(3)}  worst ${Math.min(...scores).toFixed(3)}`
      + `  over ${scores.length} pairs${skipped > 0 ? ` (${skipped} skipped: geometry or NO-READ)` : ""}`,
    );
  }
}

process.exit(0);
