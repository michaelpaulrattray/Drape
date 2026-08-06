/**
 * THE SHINE PROBE — the named hazard, tested before the gate is believed.
 *
 * Specular highlights are REAL hair content that is NOT strand-coloured: a
 * highlight moves toward white, away from a dark strand, so a naive projection
 * gate punches holes in glossy hair. The ruling names this explicitly and the
 * gate ships nowhere until shine survives it.
 *
 * The test is direct. Inside content the harvest confirms, isolate the BRIGHT
 * population — pixels well above the strand's own mean luminance, which is what
 * shine is — and ask each criterion what it would do to them.
 *
 *   npx tsx scripts/calibration/shine-probe.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { harvestMatteFrom } from "../../server/castingV2/maskGeometry";
import { differenceMatte, harvestGate, readRaster, type HarvestGateCriterion, type Mask, type Raster } from "../../server/castingV2/maskedComposite";
import { birefnetMatte, sam3 } from "./lib/segment.mts";

const OUT = "output/masked/shine";
mkdirSync(OUT, { recursive: true });

const CASES = [
  { name: "hair-down", master: "output/masked/specimens/wire-02.png", raw: "output/masked/fringe-fixture/hair-down-raw.png" },
  { name: "copper", master: "output/masked/specimens/wire-04.png", raw: "output/masked/anchoring-relative/chain-1.png" },
];

const luma = (r: Raster, p: number) => 0.2126*r.data[p*3] + 0.7152*r.data[p*3+1] + 0.0722*r.data[p*3+2];

for (const scenario of CASES) {
  console.log(`\n=== ${scenario.name} ===`);
  const masterBytes = readFileSync(scenario.master);
  const master: Raster = await readRaster(masterBytes);
  const patchBytes = await sharp(readFileSync(scenario.raw)).resize(master.width, master.height, {fit:"fill"}).png().toBuffer();
  const patch: Raster = await readRaster(patchBytes);

  const patchSubject = await birefnetMatte(patchBytes);
  const patchHair = await sam3(patchBytes, "hair");
  const harvest = await harvestMatteFrom({ content: patchHair.all, matte: patchSubject, taperPx: 8 });
  const { strandColour } = differenceMatte({ master, patch, confirmed: harvest, reachPx: 1 });
  const strandLuma = 0.2126*strandColour[0] + 0.7152*strandColour[1] + 0.0722*strandColour[2];

  /* The painter's own drift, from territory the harvest does not claim. */
  const far: number[] = [];
  for (let p = 0; p < harvest.data.length; p += 37) {
    if (harvest.data[p] > 0) continue;
    const at = p*3;
    far.push((Math.abs(patch.data[at]-master.data[at])+Math.abs(patch.data[at+1]-master.data[at+1])+Math.abs(patch.data[at+2]-master.data[at+2]))/3);
  }
  far.sort((a,b)=>a-b);
  const baselineDelta = far[Math.floor(far.length/2)] ?? 0;

  /* SHINE: confirmed hair, well above the strand's own mean luminance. */
  const shine: Mask = { data: Buffer.alloc(master.width*master.height, 0), width: master.width, height: master.height };
  let shinePixels = 0;
  for (let p = 0; p < harvest.data.length; p += 1) {
    if (harvest.data[p] < 200) continue;
    if (luma(patch, p) < strandLuma + 45) continue;
    shine.data[p] = 255; shinePixels += 1;
  }
  console.log(`  strand luma ${strandLuma.toFixed(0)}, painter baseline ${baselineDelta.toFixed(1)} levels`);
  console.log(`  SHINE population: ${shinePixels.toLocaleString()} px of confirmed hair at luma > ${(strandLuma+45).toFixed(0)}`);
  if (shinePixels < 500) { console.log("  too little shine here to probe — skipping"); continue; }

  for (const criterion of ["projection","novelty","either"] as HarvestGateCriterion[]) {
    const gated = harvestGate({ master, patch, alpha: harvest, strandColour, baselineDelta, criterion });
    let kept = 0, lost = 0, dimmed = 0, lostThatMattered = 0;
    for (let p = 0; p < shine.data.length; p += 1) {
      if (!shine.data[p]) continue;
      const before = harvest.data[p], after = gated.alpha.data[p];
      if (after === 0) {
        lost += 1;
        /*
          A PUNCH-OUT ONLY COSTS SOMETHING IF THE PIXEL WAS GOING TO CHANGE THE
          PICTURE. Where the patch already equals the master — unchanged hair the
          painter left alone — reverting to the master is a no-op, and counting
          it as damage would condemn the gate for doing nothing.
        */
        const at = p*3;
        const moved = (Math.abs(patch.data[at]-master.data[at])+Math.abs(patch.data[at+1]-master.data[at+1])+Math.abs(patch.data[at+2]-master.data[at+2]))/3;
        if (moved > 12) lostThatMattered += 1;
      } else if (after < before * 0.9) dimmed += 1; else kept += 1;
    }
    console.log(
      `  ${criterion.padEnd(11)} shine kept ${String(kept).padStart(6)}  dimmed ${String(dimmed).padStart(6)}  `
      + `punched ${String(lost).padStart(6)}  of which REAL LOSS ${String(lostThatMattered).padStart(5)} `
      + `(${(lostThatMattered/shinePixels*100).toFixed(1)}%)   reverted ${gated.revertedPixels.toLocaleString()}`,
    );
  }
}
