/**
 * DOES AUTO-EXPAND ACTUALLY FIX THE THING CONTACT PREDICTS?
 *
 * The fixture produced a natural experiment nobody designed. In the compound
 * scenario — where the glasses themselves change shape — FLUX.2 Pro rendered a
 * visibly BROKEN result: doubled, ghosting frame outlines, the old rim showing
 * through the new one. NBP and GPT Image 2 did not.
 *
 * The cause is structural rather than a bad model day. **The mask was segmented
 * from the OLD glasses.** An engine that draws a larger, bolder frame paints
 * outside that footprint, the paint is clipped at the mask boundary, and what
 * survives is the new frame's interior sitting inside the old frame's edges.
 * A same-region edit that changes an object's SILHOUETTE cannot use a tight
 * segmentation of the object as it currently is.
 *
 * And the boundary-contact rider ranked them correctly before anyone looked:
 *
 *   flux  93.3% contact  — visibly broken
 *   nbp   76.5% contact  — coherent
 *   gpt2  70.5% contact  — coherent
 *
 * So the ordering carries information even though the absolute figures are high
 * for everything (a tight object mask is painted to its own edge by definition —
 * the glasses go right up to where the glasses are). **That is the precondition
 * the rider does not state: contact is read as a COMPARISON against the same
 * zone's other candidates, or against the same edit at a larger zone. It is not
 * an absolute threshold on a tight mask.**
 *
 * This re-composites the SAME saved renders against progressively grown zones.
 * No new spend. If the rider is right, growth lets the clipped paint land and
 * the contact figure falls; if contact stays pinned near 100% however far the
 * zone grows, then expansion is not the remedy and the edit belongs on the
 * full-frame path — which is the 60% routing decision arriving early.
 *
 *   npx tsx scripts/calibration/boundary-contact-expansion.mts
 */
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { coverage, dilateMask, subtractMask, unionMasks, type Mask } from "../../server/castingV2/maskGeometry";
import {
  compositeMasked,
  outsideMaskUnchanged,
  readRaster,
  seamBand,
  writePng,
  type Raster,
} from "../../server/castingV2/maskedComposite";
import { boundaryContact } from "./lib/contact.mts";

const FIXTURE = "output/masked/glasses-fixture";
const OUT = "output/masked/boundary-expansion";
mkdirSync(OUT, { recursive: true });

const MASTER_FILE = "output/masked/specimens/fresh-02.png";
const FEATHER = 3;
const RADII = [0, 8, 16, 32];

async function toMask(bytes: Buffer): Promise<Mask> {
  const meta = await sharp(bytes).metadata();
  const pipeline = meta.hasAlpha ? sharp(bytes).extractChannel(3) : sharp(bytes).toColourspace("b-w");
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (data.length !== info.width * info.height) throw new Error("mask not single-channel");
  return { data, width: info.width, height: info.height };
}

const master: Raster = await readRaster(readFileSync(MASTER_FILE));
const base = await toMask(readFileSync(`${FIXTURE}/a-compound-mask.png`));

console.log(`compound-scenario zone grown, same saved renders, no new spend\n`);
console.log("  engine  radius  coverage   contact@2   seam mean   outside");

const rows: any[] = [];
for (const engine of ["nbp", "gpt2", "flux"]) {
  const patch = await readRaster(readFileSync(`${FIXTURE}/a-compound-${engine}-raw.png`).length > 0
    ? await sharp(readFileSync(`${FIXTURE}/a-compound-${engine}-raw.png`))
      .resize(master.width, master.height, { fit: "fill" }).png().toBuffer()
    : readFileSync(`${FIXTURE}/a-compound-${engine}-raw.png`));
  for (const radius of RADII) {
    const zone = radius === 0 ? base : await dilateMask(base, radius);
    const { composite, applied } = await compositeMasked({ master, patch, mask: zone, featherRadius: FEATHER });
    const outside = outsideMaskUnchanged(master, composite, applied);
    const seam = seamBand(master, composite, applied);
    const rider = boundaryContact(master, composite, zone, [2]);
    const contactShare = rider.contact[0]!.paintedShareOfRing;
    console.log(
      `  ${engine.padEnd(6)}  r=${String(radius).padEnd(4)}  ${(coverage(zone) * 100).toFixed(2)}%`
      + `      ${(contactShare * 100).toFixed(1)}%`
      + `        ${seam.meanDelta.toFixed(1)}`
      + `        ${outside.identical ? "identical" : `CHANGED ${outside.changedPixels}`}`,
    );
    if (radius === 32 || radius === 0) {
      writeFileSync(`${OUT}/a-${engine}-r${radius}.png`, await writePng(composite));
    }
    rows.push({
      engine, radius,
      coverage: coverage(zone),
      contactAt2: contactShare,
      paintedPixels: rider.paintedPixels,
      seamMeanDelta: seam.meanDelta,
      outsideIdentical: outside.identical,
    });
  }
  console.log("");
}

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ master: MASTER_FILE, radii: RADII, rows }, null, 2)}\n`);
console.log(`written to ${OUT}`);
