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
import { loadMaskFile, ontoFaceOf, iouWithMapped, type FaceMask } from "./lib/shapeOnFace.mts";

const READS = "output/cprime/reads";

/*
  THE ARITHMETIC MOVED TO `lib/shapeOnFace.mts` (2026-08-10), unchanged, when
  the accessory cell needed the same instrument per instance. Its reasoning —
  including why the remap samples backwards — lives with the code there.
*/
const mask = (label: string, item: string): Promise<FaceMask | null> =>
  loadMaskFile(`${READS}/${label}--${item}.png`);

const iou = iouWithMapped;

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
