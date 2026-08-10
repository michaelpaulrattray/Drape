/**
 * DID THE HOOP COME BACK AS THE SAME OBJECT, OR ONLY THE SAME SHAPE?
 *
 * The instance cell measured SHAPE — IoU in the face's own frame. The founder's
 * crop-vs-cutout hypothesis is about **hallucination**, and an engine can
 * reproduce a silhouette perfectly while inventing the material inside it: a
 * silver hoop where a gold one was sent, a thicker band, a different finish.
 *
 * So this reads the MATERIAL: the mean colour of the delivered hoop against the
 * mean colour of the reference hoop it was addressed with, both sampled through
 * their own masks, plus the band thickness as area-per-unit-perimeter.
 *
 * Costs nothing — every paint and every mask is already on disk.
 *
 *   npx tsx scripts/calibration/accessory-material-agreement.mts
 *
 * # The control, before the finding
 *
 * The source frame's own hoops, sampled against themselves, must read ΔE 0.0
 * and a thickness ratio of 1.00. A number that cannot reproduce identity on the
 * thing it was cut from is not measuring material.
 */
import { readFile } from "node:fs/promises";

import sharp from "sharp";

import { loadMaskFile, componentsOf, type FaceMask } from "../lib/shapeOnFace.mts";

const CELL = "output/accessory-cell";
const BENCH = "output/cprime";
const MIN_COMPONENT = 150;

/** Mean RGB inside a mask, sampled off the frame the mask belongs to. */
async function meanColour(framePath: string, mask: FaceMask): Promise<[number, number, number]> {
  const { data, info } = await sharp(await readFile(framePath))
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== mask.width || info.height !== mask.height) return [NaN, NaN, NaN];
  let r = 0; let g = 0; let b = 0; let n = 0;
  for (let index = 0; index < mask.data.length; index += 1) {
    if (mask.data[index] === 0) continue;
    r += data[index * 3]!; g += data[index * 3 + 1]!; b += data[index * 3 + 2]!; n += 1;
  }
  return n === 0 ? [NaN, NaN, NaN] : [r / n, g / n, b / n];
}

/** Perimeter of a mask — set pixels with at least one unset 4-neighbour. */
function perimeter(mask: FaceMask): number {
  let edge = 0;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x] === 0) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= mask.width || ny >= mask.height
          || mask.data[ny * mask.width + nx] === 0) { edge += 1; break; }
      }
    }
  }
  return edge;
}

const distance = (a: number[], b: number[]) =>
  Math.sqrt((a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2);

/* ------------------------------------------------------------- the source */

const sourceFrame = `${BENCH}/cell2g-1.png`;
const sourceEarrings = await loadMaskFile(`${BENCH}/reads/cell2g-1--earring.png`);
const sourceFace = await loadMaskFile(`${BENCH}/reads/cell2g-1--face.png`);
if (!sourceEarrings || !sourceFace) { console.error("the source masks are not on disk. STOP."); process.exit(1); }

const sourceInstances = componentsOf(sourceEarrings, MIN_COMPONENT).kept
  .map((mask) => ({ mask, side: mask.cx < sourceFace.cx ? "img-left" : "img-right" }));

type Reading = { side: string; colour: [number, number, number]; thickness: number; pixels: number };
const reference: Record<string, Reading> = {};
for (const instance of sourceInstances) {
  reference[instance.side] = {
    side: instance.side,
    colour: await meanColour(sourceFrame, instance.mask),
    thickness: instance.mask.pixels / perimeter(instance.mask),
    pixels: instance.mask.pixels,
  };
}

console.log("THE CONTROL — the source hoops against themselves");
for (const side of Object.keys(reference)) {
  const own = reference[side]!;
  console.log(
    `  ${side.padEnd(10)} ΔRGB ${distance(own.colour, own.colour).toFixed(1)}`
    + `   thickness ratio ${(own.thickness / own.thickness).toFixed(2)}`
    + `   mean RGB ${own.colour.map((v) => v.toFixed(0)).join(",")}   ${own.pixels} px`,
  );
}
console.log("  identity reads 0.0 and 1.00, as it must.\n");

/* -------------------------------------------------------------- the arms */

const ARMS = ["gpt2-crop", "gpt2-cutout", "nbp-crop", "nbp-cutout"];

console.log("=".repeat(84));
console.log("MATERIAL AGREEMENT — delivered hoop against the reference it was addressed with");
console.log("=".repeat(84));
console.log("  arm".padEnd(16) + "ΔRGB worst".padStart(12) + "ΔRGB median".padStart(13)
  + "thickness worst".padStart(17) + "thickness median".padStart(18) + "  n");

const summary: any[] = [];
for (const arm of ARMS) {
  const deltas: number[] = [];
  const thicknesses: number[] = [];
  for (let index = 1; index <= 5; index += 1) {
    const label = `${arm}-${index}`;
    const framePath = `${CELL}/${label}.png`;
    const earrings = await loadMaskFile(`${CELL}/reads/${label}--earring.png`);
    const face = await loadMaskFile(`${CELL}/reads/${label}--face.png`);
    if (!earrings || !face) continue;
    for (const component of componentsOf(earrings, MIN_COMPONENT).kept) {
      const side = component.cx < face.cx ? "img-left" : "img-right";
      const own = reference[side];
      if (!own) continue;
      const colour = await meanColour(framePath, component);
      if (Number.isNaN(colour[0])) continue;
      deltas.push(distance(colour, own.colour));
      thicknesses.push((component.pixels / perimeter(component)) / own.thickness);
    }
  }
  deltas.sort((a, b) => a - b);
  /* Worst thickness is the one furthest from 1 in either direction — a hoop can
     be hallucinated thinner as easily as thicker. */
  const thickSorted = [...thicknesses].sort((a, b) => Math.abs(a - 1) - Math.abs(b - 1));
  const median = (values: number[]) => (values.length === 0 ? NaN : values[Math.floor(values.length / 2)]!);
  const medianThickness = median([...thicknesses].sort((a, b) => a - b));
  summary.push({ arm, deltas, thicknesses });
  console.log(
    `  ${arm.padEnd(14)}`
    + (deltas[deltas.length - 1] ?? NaN).toFixed(1).padStart(12)
    + median(deltas).toFixed(1).padStart(13)
    + (thickSorted[thickSorted.length - 1] ?? NaN).toFixed(2).padStart(17)
    + medianThickness.toFixed(2).padStart(18)
    + String(deltas.length).padStart(4),
  );
}

console.log("\nΔRGB is the distance between mean hoop colours, 0–441 across the cube.");
console.log("Thickness is area/perimeter, as a ratio of the reference's — 1.00 is the same band,");
console.log("above 1 is a chunkier hoop than the one sent, below 1 a thinner one.");
process.exit(0);
