/**
 * THE BAD SAMPLE WE OWN IS THE POSITIVE CONTROL — run-6's torn render, replayed
 * through the fixed adapter.
 *
 * # Why this can be done at all without the painted frame
 *
 * Production stores only the composite. But `outsideMaskUnchanged` guarantees
 * the composite is byte-identical to the master OUTSIDE the applied mask, and
 * inside it the composite IS the painter's content (blended). So the delivered
 * torn PNG is an exact reconstruction of the painted frame precisely where the
 * harvest claimed something, and equal to the master everywhere else.
 *
 * Feeding that back in as the "painted" frame therefore reproduces the tear's
 * claim and nothing else. **Stated limitation:** it cannot reproduce drift the
 * harvest did NOT claim, because that drift is not in the file. This replay is
 * conservative — it can only under-claim — which is the right direction for
 * proving a claim has stopped happening.
 *
 * # What it measures
 *
 *   before   pixels in the torn band that DIFFER from the master in the
 *            delivered render. By construction those were claimed and
 *            composited: that is the tear, counted from the artifact.
 *   after    pixels in the same band claimed by `applied` on the replay.
 *
 * A fix that works takes `after` to zero without taking the freckles with it,
 * so the skin band is reported beside it as the negative control.
 *
 *   npx tsx scripts/calibration/torn-frame-replay.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { harvestRefinement } from "../../server/castingV2/maskedRefine";
import { facetOfSubject } from "../../server/castingV2/refineFacets";

const OUT = "output/masked/torn-replay";
mkdirSync(OUT, { recursive: true });

const MASTER = "output/run6-audit/00-master.png";
const TORN = "output/run6-audit/01-freckles.png";
for (const path of [MASTER, TORN]) {
  if (!existsSync(path)) throw new Error(`missing ${path} — run scripts/investigate-run6-disposable.mts first`);
}
const master = readFileSync(MASTER);
const torn = readFileSync(TORN);
const meta = await sharp(master).metadata();
const W = meta.width!;
const H = meta.height!;

/**
 * The two torn bands, in the master's own coordinates, read off the crops in
 * `output/run6-audit/`. Declared here rather than derived from the difference,
 * so the measurement window cannot follow the answer around — the mistake
 * `freckles-layers.mts` made by counting only face-skin pixels, which is
 * exactly the window this defect lives outside of.
 */
const BANDS = [
  { name: "left notch", left: 300, top: 620, width: 110, height: 240 },
  { name: "right phantom", left: 610, top: 650, width: 120, height: 150 },
  { name: "her cheeks (negative control — the freckles must survive)", left: 380, top: 480, width: 260, height: 140 },
];

const raw = async (bytes: Buffer) =>
  sharp(bytes).removeAlpha().raw().toBuffer();
const A = await raw(master);
const B = await raw(torn);

/**
 * PIXELS THAT ACTUALLY CHANGED, master versus a delivered frame.
 *
 * Both columns must be measured this way. The first version of this fixture
 * counted `applied` for the "after" column, and `applied` is the region the
 * composite was PERMITTED to change — the zone plus its blend band — not the
 * region it did change. Comparing a delivery against a permission reported
 * 9,024 changed pixels on a cheek band that had 6,245, which is impossible and
 * is what gave it away. Same family as every other boundary error in this
 * workstream: the two things being compared were not the same quantity.
 */
function differing(band: typeof BANDS[number], before: Buffer, after: Buffer): number {
  let count = 0;
  for (let y = band.top; y < band.top + band.height; y += 1) {
    for (let x = band.left; x < band.left + band.width; x += 1) {
      const at = (y * W + x) * 3;
      const delta = (Math.abs(before[at]! - after[at]!) + Math.abs(before[at + 1]! - after[at + 1]!)
        + Math.abs(before[at + 2]! - after[at + 2]!)) / 3;
      if (delta > 4) count += 1;
    }
  }
  return count;
}

const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });
const composed = await harvestRefinement({
  master: { bytes: master, contentType: "image/png" },
  /* The delivered torn frame, standing in for the paint it was cut from. */
  painted: { bytes: torn, contentType: "image/png" },
  facets: [facetOfSubject("marks")],
  reader,
  userId: 1,
  described: "visibly textured, freckles",
  explain: true,
});
writeFileSync(`${OUT}/replayed.png`, composed.bytes);
const R = await raw(composed.bytes);
const applied = composed.explain!.applied;

/** The permission, reported beside the delivery so the two are never confused. */
function permitted(band: typeof BANDS[number]): number {
  let count = 0;
  for (let y = band.top; y < band.top + band.height; y += 1) {
    for (let x = band.left; x < band.left + band.width; x += 1) {
      if (applied.data[y * W + x]! > 0) count += 1;
    }
  }
  return count;
}

console.log(`\nrun-6 variant 198005a3 replayed through the current adapter (${W}x${H})\n`);
console.log(
  `  ${"band".padEnd(46)}${"px".padStart(9)}${"BEFORE".padStart(9)}${"AFTER".padStart(9)}${"permitted".padStart(11)}`,
);
for (const band of BANDS) {
  const area = band.width * band.height;
  console.log(
    `  ${band.name.padEnd(46)}${area.toLocaleString().padStart(9)}`
    + `${differing(band, A, B).toLocaleString().padStart(9)}`
    + `${differing(band, A, R).toLocaleString().padStart(9)}`
    + `${permitted(band).toLocaleString().padStart(11)}`,
  );
}
/*
  AND WHICH MASK IS DOING IT, per band — because "still there" is a shrug and
  "the vacancy path claims it" is a fix.
*/
/* `keyof typeof composed.explain` narrows to `never` through the optional, so
   the masks are read as their own record rather than through the parent. */
const explained = composed.explain as unknown as
  Record<string, { data: Buffer; width: number; height: number }>;
const names = Object.keys(explained);
console.log(`\n  which mask claims each band\n  ${"band".padEnd(46)}${names.map((n) => n.slice(0, 8).padStart(10)).join("")}`);
for (const band of BANDS) {
  const counts = names.map((name) => {
    const mask = explained[name]!;
    let count = 0;
    for (let y = band.top; y < band.top + band.height; y += 1) {
      for (let x = band.left; x < band.left + band.width; x += 1) {
        if (mask.data[y * W + x]! > 0) count += 1;
      }
    }
    return count.toLocaleString().padStart(10);
  });
  console.log(`  ${band.name.padEnd(46)}${counts.join("")}`);
}

console.log(
  "\nBEFORE = pixels production's delivered render changed from the master."
  + "\nAFTER  = pixels this replay's delivered render changes from the master."
  + "\nBoth are DELIVERIES. `permitted` is the zone, shown only so it is never"
  + "\nmistaken for one again."
  + "\nThe two tear bands must go to zero; her cheeks must not.",
);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
