/**
 * DID THE PAINTER FRECKLE HER WHEN THE FACT WAS CARRIED? — put to the reader
 * that already has a working negative control on this exact woman.
 *
 * The court read her bare master ABSENT 25 times out of 25 across five lenses,
 * and her step-1 frame PRESENT 25 out of 25. So on this face the reader is a
 * calibrated instrument, and it can be asked about the fixture's two frames:
 * the paint produced from run-15's own step-3 prompt, and the composite our
 * adapter made of it.
 *
 *   painted PRESENT, composed ABSENT  → the adapter ate it
 *   both ABSENT                       → the painter never drew it
 *   both PRESENT                      → neither, and the production frame's
 *                                       absence is about that render, not this shape
 *
 *   npx tsx scripts/read-carried-fixture-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { verifyRender } from "../server/castingV2/renderVerification";

const CASES = [
  { name: "her master (negative control)", file: "output/marks-court/MASTER-run15.png" },
  { name: "step-1 frame (positive control)", file: "output/walk/2026-08-08T19-59-45-742Z/01-delivered.png" },
  { name: "FIXTURE painted (carried prompt)", file: "output/masked/freckles-carried/painted.png" },
  { name: "FIXTURE composed (carried prompt)", file: "output/masked/freckles-carried/composed.png" },
  { name: "FIXTURE painted (step-1 prompt)", file: "output/masked/freckles-written15/painted.png" },
  { name: "FIXTURE composed (step-1 prompt)", file: "output/masked/freckles-written15/composed.png" },
  { name: "FIXTURE painted (carried, no caption)", file: "output/masked/freckles-nocaption/painted.png" },
  { name: "FIXTURE painted (carried, NO makeup ask)", file: "output/masked/freckles-alone/painted.png" },
  { name: "FIXTURE composed (carried, NO makeup ask)", file: "output/masked/freckles-alone/composed.png" },
  { name: "FIXTURE painted (carried, no bare-face line)", file: "output/masked/freckles-nobare/painted.png" },
  { name: "FIXTURE composed (carried, no bare-face line)", file: "output/masked/freckles-nobare/composed.png" },
];
const REPEAT = 5;

for (const entry of CASES) {
  const bytes = readFileSync(entry.file);
  let present = 0;
  const saws = new Set<string>();
  for (let reading = 0; reading < REPEAT; reading += 1) {
    const verdict = await verifyRender({
      bytes,
      contentType: "image/png",
      facts: [{ facet: "marks", asked: "freckles", binding: false }],
    });
    const check = verdict.checks[0];
    if (check?.verified) present += 1;
    saws.add(String(check?.saw ?? "(none)"));
  }
  console.log(`${entry.name.padEnd(34)} present ${present}/${REPEAT}`);
  for (const saw of saws) console.log(`    ${saw.slice(0, 88)}`);
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
