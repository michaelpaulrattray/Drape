/**
 * WHICH DOOR DOES THE PALE SKIN-VEIL COME THROUGH?
 *
 * The founder's D ruling: the band of forehead under the fringe reads a shade
 * lighter and flatter than her real skin, with a findable soft edge — subtle and
 * hairline-hugging in C, wider and following the strands down in D. The painter
 * rendered her forehead lighter than reality and both modes admit a translucent
 * film of it.
 *
 * # Why this is measured before it is gated
 *
 * Reading the code, BOTH mechanisms should already refuse a lightening:
 *
 *   `differenceMatte`  projects (patch − master) onto (strand − master). Her
 *                      forehead is light and the strand is dark brown, so a
 *                      LIGHTER painter-forehead points away from the strand —
 *                      a negative projection, clamped to zero.
 *   `adoptInteraction` in shadow mode takes only darkening; `lumPatch >= lumMaster`
 *                      is discarded outright.
 *
 * So on paper neither can pass a pale veil, and the founder can plainly see one.
 * **When the reasoning and the picture disagree, the picture is right and the
 * reasoning has a door it does not know about.** Finding it is the whole job
 * here; gating a door that is not the one leaking would have been the third
 * wrong diagnosis in this sequence.
 *
 * Every claimed pixel is therefore attributed to the mask that claimed it, and
 * the lightening is measured separately per door.
 *
 *   npx tsx scripts/calibration/veil-door.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { dilateMask, harvestMatteFrom } from "../../server/castingV2/maskGeometry";
import {
  adoptInteraction,
  compositeMasked,
  differenceMatte,
  readRaster,
  type Mask,
  type Raster,
} from "../../server/castingV2/maskedComposite";
import { birefnetMatte, sam3 } from "./lib/segment.mts";
import { differenceView } from "./lib/differenceView.mts";

const OUT = "output/masked/veil";
mkdirSync(OUT, { recursive: true });

const masterBytes = readFileSync("output/masked/specimens/wire-02.png");
const master: Raster = await readRaster(masterBytes);
const patchBytes = await sharp(readFileSync("output/masked/fringe-fixture/fringe-raw.png"))
  .resize(master.width, master.height, { fit: "fill" })
  .png()
  .toBuffer();
const patch: Raster = await readRaster(patchBytes);

const luma = (raster: Raster, pixel: number): number => {
  const at = pixel * 3;
  return 0.2126 * raster.data[at] + 0.7152 * raster.data[at + 1] + 0.0722 * raster.data[at + 2];
};

console.log("segmenting…");
const hair = await sam3(masterBytes, "hair");
const faceSkin = await sam3(masterBytes, "face skin");
const eyewear = await sam3(masterBytes, "eyeglasses");
const patchSubject = await birefnetMatte(patchBytes);
const patchHair = await sam3(patchBytes, "hair");

/* The forehead: her face skin above the glasses, derived not drawn. */
let browLine = master.height;
for (let pixel = 0; pixel < eyewear.all.data.length; pixel += 1) {
  if (eyewear.all.data[pixel] === 0) continue;
  const y = Math.floor(pixel / master.width);
  if (y < browLine) browLine = y;
}
const forehead: Mask = {
  data: Buffer.from(faceSkin.all.data.map((value, index) => (Math.floor(index / master.width) < browLine ? value : 0))),
  width: master.width,
  height: master.height,
};

/*
  FIRST: is the painter's forehead actually lighter, and by how much? If it is
  not, the veil is being introduced by us rather than admitted from the paint,
  and the whole search moves.
*/
let painterLighter = 0;
let painterDarker = 0;
let lightSum = 0;
let foreheadPixels = 0;
for (let pixel = 0; pixel < forehead.data.length; pixel += 1) {
  if (forehead.data[pixel] === 0) continue;
  foreheadPixels += 1;
  const step = luma(patch, pixel) - luma(master, pixel);
  if (step > 2) { painterLighter += 1; lightSum += step; }
  if (step < -2) painterDarker += 1;
}
console.log(`\nher forehead: ${foreheadPixels.toLocaleString()} px`);
console.log(`  the painter made ${painterLighter.toLocaleString()} of them LIGHTER (mean +${(lightSum / Math.max(1, painterLighter)).toFixed(1)} luma)`);
console.log(`  and ${painterDarker.toLocaleString()} darker`);

const zone = await dilateMask(hair.all, 48);
const tapered = await harvestMatteFrom({ content: patchHair.all, matte: patchSubject, taperPx: 8 });
const strands = differenceMatte({ master, patch, confirmed: tapered, reachPx: 40 });
const withStrands: Mask = {
  data: Buffer.from(tapered.data.map((value, index) => Math.max(value, strands.alpha.data[index]))),
  width: master.width,
  height: master.height,
};

/** Attribute the lightening on her forehead to whichever mask claimed it. */
async function attribute(label: string, harvest: Mask): Promise<any> {
  const adopted = adoptInteraction({ master, patch, harvest, bandPx: 14, mode: "shadow" });
  const composed = await compositeMasked({
    master, patch: adopted.patch, mask: zone, edgeMatte: adopted.alpha, featherRadius: 4,
  });

  const doors = { taper: 0, strand: 0, band: 0 };
  let lightened = 0;
  let lightenedSum = 0;
  let alphaSum = 0;
  for (let pixel = 0; pixel < forehead.data.length; pixel += 1) {
    if (forehead.data[pixel] === 0) continue;
    const step = luma(composed.composite, pixel) - luma(master, pixel);
    if (step <= 1) continue;
    lightened += 1;
    lightenedSum += step;
    alphaSum += composed.applied.data[pixel];
    /* Which mask is responsible? The most specific claim wins the attribution. */
    if (tapered.data[pixel] > 0) doors.taper += 1;
    else if (strands.alpha.data[pixel] > 0) doors.strand += 1;
    else doors.band += 1;
  }
  console.log(
    `\n${label}: ${lightened.toLocaleString()} forehead px LIGHTER than hers, mean +${(lightenedSum / Math.max(1, lightened)).toFixed(2)} luma`
    + `  (mean alpha ${(alphaSum / Math.max(1, lightened)).toFixed(0)}/255)`,
  );
  console.log(`   through the harvest taper ${doors.taper.toLocaleString()}   the strand matte ${doors.strand.toLocaleString()}   the shadow band ${doors.band.toLocaleString()}`);
  return { label, lightened, meanStep: lightenedSum / Math.max(1, lightened), doors };
}

const modeC = await attribute("MODE C", tapered);
const modeD = await attribute("MODE D", withStrands);

/* The founder's own view: the veil, amplified, so its edge is findable. */
for (const [label, harvest] of [["C", tapered], ["D", withStrands]] as const) {
  const adopted = adoptInteraction({ master, patch, harvest, bandPx: 14, mode: "shadow" });
  const composed = await compositeMasked({
    master, patch: adopted.patch, mask: zone, edgeMatte: adopted.alpha, featherRadius: 4,
  });
  const raster = composed.composite;
  /* A veil map: only the LIGHTENING, amplified, on her forehead. */
  const veil = Buffer.alloc(master.width * master.height * 3, 0);
  for (let pixel = 0; pixel < forehead.data.length; pixel += 1) {
    const step = luma(raster, pixel) - luma(master, pixel);
    if (step <= 0) continue;
    const value = Math.min(255, Math.round(step * 24));
    veil[pixel * 3] = value;
    veil[pixel * 3 + 1] = value;
    veil[pixel * 3 + 2] = value;
  }
  await sharp(veil, { raw: { width: master.width, height: master.height, channels: 3 } })
    .png()
    .toFile(`${OUT}/VEIL-${label}.png`);
}
console.log("\nVEIL-C.png / VEIL-D.png — every lightened pixel, amplified 24x. Black is her own skin.");

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({
  forehead: { pixels: foreheadPixels, painterLighter, painterDarker },
  modes: [modeC, modeD],
}, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);
