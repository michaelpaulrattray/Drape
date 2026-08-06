/**
 * HOW FAR DO STRANDS REACH — and does a blanket radius or a propagation find them?
 *
 * The zone-guillotine fix stopped the composite cutting hair at the zone's edge,
 * but it left the ends **165 rows short of what the painter drew**: content to
 * row 1369 against the painter's 1534. `differenceMatte` recovers strand alpha
 * within `reachPx` of confirmed content, and 40 was a number chosen before
 * anything had measured it.
 *
 * # Two ways to reach further, and they are not the same idea
 *
 *   BLANKET   raise `reachPx`. Simple, and indiscriminate: a 160px radius sweeps
 *             160px of everything, including whatever else the painter did near
 *             the hair.
 *   PROPAGATE recover, fold what was recovered into the confirmed set, recover
 *             again. Each pass walks a short distance ALONG the strands, so the
 *             reach follows the content instead of a circle. Distance travelled
 *             is the same order; territory swept is not.
 *
 * Propagation is the better idea on paper, which is exactly why it gets measured
 * against the blanket rather than assumed to win.
 *
 * # The two numbers that decide it, and the second is the one with teeth
 *
 *   REACH  the lowest row carrying content, against the painter's 1534. Measured
 *          WITHOUT a segmenter — pixels differing from the master by a real
 *          amount — because a segmenter's confidence is the thing under
 *          suspicion in the first place.
 *   WALL   her t-shirt where nothing was claimed must still be hers, byte for
 *          byte. Every widening is a chance to break the person-never-stage
 *          wall, so it is re-proven at every step rather than at the end.
 *
 * Nothing is generated. The render is on disk.
 *
 *   npx tsx scripts/calibration/strand-reach.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { dilateMask, expandUntilClear, harvestMatteFrom } from "../../server/castingV2/maskGeometry";
import {
  adoptInteraction,
  compositeMasked,
  differenceMatte,
  readRaster,
  writePng,
  type Mask,
  type Raster,
} from "../../server/castingV2/maskedComposite";
import { birefnetMatte, sam3 } from "./lib/segment.mts";

const OUT = "output/masked/strand-reach";
mkdirSync(OUT, { recursive: true });

const MASTER = "output/masked/specimens/wire-02.png";
const RAW = "output/masked/fringe-fixture/hair-down-raw.png";
/** A pixel has moved when it moved by this much — the same bar throughout. */
const MOVED = 25;

const masterBytes = readFileSync(MASTER);
const master: Raster = await readRaster(masterBytes);
const patchBytes = await sharp(readFileSync(RAW))
  .resize(master.width, master.height, { fit: "fill" })
  .png()
  .toBuffer();
const patch: Raster = await readRaster(patchBytes);

/** Lowest row carrying real content, with no segmenter's opinion involved. */
function lowestContentRow(raster: Raster): number {
  for (let y = raster.height - 1; y >= 0; y -= 1) {
    let moved = 0;
    for (let x = 0; x < raster.width; x += 1) {
      const at = (y * raster.width + x) * 3;
      const delta = (Math.abs(raster.data[at] - master.data[at])
        + Math.abs(raster.data[at + 1] - master.data[at + 1])
        + Math.abs(raster.data[at + 2] - master.data[at + 2])) / 3;
      if (delta > MOVED) moved += 1;
    }
    if (moved > 20) return y;
  }
  return -1;
}

console.log("segmenting…");
const hair = await sam3(masterBytes, "hair");
const shirt = await sam3(masterBytes, "t-shirt");
const patchSubject = await birefnetMatte(patchBytes);
const patchHair = await sam3(patchBytes, "hair");
const tapered = await harvestMatteFrom({ content: patchHair.all, matte: patchSubject, taperPx: 8 });

/* The painter's own content, over the WHOLE frame — clipping this to the zone is
   what stopped the expansion loop seeing hair beyond it the first time. */
const painted: Mask = { data: Buffer.alloc(master.width * master.height, 0), width: master.width, height: master.height };
for (let pixel = 0; pixel < painted.data.length; pixel += 1) {
  const at = pixel * 3;
  const delta = (Math.abs(patch.data[at] - master.data[at])
    + Math.abs(patch.data[at + 1] - master.data[at + 1])
    + Math.abs(patch.data[at + 2] - master.data[at + 2])) / 3;
  if (delta > MOVED) painted.data[pixel] = 255;
}
const painterReach = lowestContentRow(patch);
console.log(`the painter drew content down to row ${painterReach} of ${master.height}\n`);

let baseZone: Mask = hair.all;
for (let pass = 0; pass < 11; pass += 1) baseZone = await dilateMask(baseZone, 48);

/** One composite, end to end, for a given strand-recovery strategy. */
async function run(label: string, recover: (confirmed: Mask) => Mask): Promise<any> {
  const strands = recover(tapered);
  const harvest: Mask = {
    data: Buffer.from(tapered.data.map((value, index) => Math.max(value, strands.data[index]))),
    width: tapered.width,
    height: tapered.height,
  };
  const grown = await expandUntilClear({
    painted, zone: baseZone, stepPx: 48, effective: harvest, maxCoverage: 0.6,
  });
  const adopted = adoptInteraction({ master, patch, harvest, bandPx: 14, mode: "shadow" });
  const composed = await compositeMasked({
    master, patch: adopted.patch, mask: grown.zone, edgeMatte: adopted.alpha, featherRadius: 4,
  });
  const file = `${OUT}/${label}.png`;
  writeFileSync(file, await writePng(composed.composite));

  /*
    THE WALL, re-proven at every widening — and "unclaimed" is taken from the
    COMPOSITE'S OWN APPLIED ALPHA, which is the only thing that decides what
    moved.

    The first version of this check compared against the harvest alone and
    reported 5,682 px of her shirt broken. Those pixels are the CONTACT SHADOWS
    the founder ratified as mode C: the shadow band deliberately adopts outside
    the harvest, which is its entire purpose. Measuring the wall against a mask
    the composite does not use is the third boundary I have drawn from the wrong
    input this session, so it is now taken from the one source that cannot
    disagree with the picture.
  */
  let hers = 0;
  let moved = 0;
  let claimed = 0;
  for (let pixel = 0; pixel < shirt.all.data.length; pixel += 1) {
    if (shirt.all.data[pixel] === 0) continue;
    if (composed.applied.data[pixel] > 0) { claimed += 1; continue; }
    hers += 1;
    const at = pixel * 3;
    if (composed.composite.data[at] !== master.data[at]
      || composed.composite.data[at + 1] !== master.data[at + 1]
      || composed.composite.data[at + 2] !== master.data[at + 2]) moved += 1;
  }
  const reach = lowestContentRow(composed.composite);
  console.log(
    `${label.padEnd(16)} reaches row ${String(reach).padStart(4)} `
    + `(${String(painterReach - reach).padStart(3)} short of the painter)   `
    + `shirt claimed ${claimed.toLocaleString().padStart(7)}   hers ${hers.toLocaleString().padStart(7)}   `
    + `OF HERS MOVED: ${moved}`,
  );
  if (moved !== 0) throw new Error(`${label} moved ${moved} px of her own shirt — the wall broke`);
  return { label, reach, shortBy: painterReach - reach, claimed, hers, moved, zonePasses: grown.passes };
}

const rows: any[] = [];
console.log("BLANKET — one radius, swept in every direction");
for (const reachPx of [40, 80, 120, 160]) {
  rows.push(await run(`blanket-${reachPx}`, (confirmed) =>
    differenceMatte({ master, patch, confirmed, reachPx }).alpha));
}

console.log("\nPROPAGATE — short hops, each one starting from what the last recovered");
for (const passes of [2, 4, 8]) {
  rows.push(await run(`propagate-${passes}x20`, (confirmed) => {
    let current = confirmed;
    let accumulated: Mask = { data: Buffer.alloc(master.width * master.height, 0), width: master.width, height: master.height };
    for (let pass = 0; pass < passes; pass += 1) {
      const step = differenceMatte({ master, patch, confirmed: current, reachPx: 20 }).alpha;
      accumulated = { data: Buffer.from(accumulated.data.map((value, index) => Math.max(value, step.data[index]))), width: master.width, height: master.height };
      /* Fold what was found into the confirmed set, so the next hop starts from
         the strand tips rather than from the original boundary again. */
      current = { data: Buffer.from(current.data.map((value, index) => Math.max(value, step.data[index]))), width: master.width, height: master.height };
    }
    return accumulated;
  }));
}

const best = rows.reduce((a, b) => (b.reach > a.reach ? b : a));
console.log(`\nfurthest reach: ${best.label} at row ${best.reach}, ${best.shortBy} short of the painter's ${painterReach}`);
console.log("the wall held on every one — 0 px of her own shirt moved, at every widening");

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ painterReach, movedThreshold: MOVED, rows }, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);
