/**
 * WHAT ONE FACE SCAN ACTUALLY COSTS — counted through `scanFace` itself, not
 * derived from the plan.
 *
 * The design note (`AUTO_SCAN_PANEL_DESIGN.md`) has carried a question count as
 * if it were a call count since horns and earrings joined the plan, and shift
 * 91's first correction of it was ALSO derived by hand — 7 + (5 x 2) + 1 — and
 * missed the composed region entirely (`build` costs a head read and a subject
 * matte and asks no question at all). A number about an instrument is the
 * easiest thing in a report to compute instead of measure.
 *
 * So this counts. A fake reader records every call the real scan makes; nothing
 * reaches a provider, nothing is charged, and the count is the scan's own
 * behaviour rather than anybody's arithmetic.
 *
 *   npx tsx scripts/count-scan-reads-disposable.mts
 */
import { scanFace, scanPlan, composedPlan } from "../server/castingV2/faceScan";
import type { Mask } from "../server/castingV2/maskedComposite";

const WIDTH = 1000;
const HEIGHT = 1500;
const USD_PER_READ = 0.005;

const filled = (): Mask => {
  const data = Buffer.alloc(WIDTH * HEIGHT, 0);
  /* A believable rectangle: an all-zero answer would exercise the absent path
     everywhere and could hide a follow-up read the found path makes. */
  for (let y = 400; y < 700; y += 1) data.fill(255, y * WIDTH + 300, y * WIDTH + 600);
  return { data, width: WIDTH, height: HEIGHT };
};

const calls: string[] = [];
const reader = {
  async region({ name }: { name: string }) { calls.push(`region:${name}`); return filled(); },
  async regionSides({ name }: { name: string }) {
    /* THE COST OF A BILATERAL QUESTION IS TWO CALLS, and it is charged inside
       the reader — `bilateralHalves` crops the frame at the midline and asks
       `askRegion` once per half. A fake that pushed one entry here would print
       a cheaper scan than the product runs. */
    calls.push(`side:${name}:left`, `side:${name}:right`);
    return { left: filled(), right: filled() };
  },
  async subject() { calls.push("subject:matte"); return filled(); },
  async landmark() { calls.push("landmark"); return null; },
};

const result = await scanFace({
  frame: { bytes: Buffer.from("not really a picture"), width: WIDTH, height: HEIGHT },
  reader: reader as never,
  /* NOT counted, and named rather than dropped: production passes
     `defaultDescriber()`, so a real scan also makes ONE words read — a
     different transport at a different price, which is why it does not belong
     inside a segmenter-read total. */
  describe: null,
});

const questions = scanPlan();
const bilateral = questions.filter((region) => region.slots.some((slot) => slot.instance !== null));
console.log(`plan          ${questions.length} questions, ${bilateral.length} of them bilateral`);
console.log(`composed      ${composedPlan().length} slot(s) with no question at all`);
console.log("");
for (const call of calls) console.log(`  ${call}`);
console.log("");
const sides = calls.filter((call) => call.startsWith("side:")).length;
/*
  AND ONE CALL THIS FAKE CANNOT SEE, ADDED HERE RATHER THAN LEFT OUT.

  The real `regionSides` splits the frame at her midline, and finding the
  midline is itself an `askRegion(image, "face")` — inside `bilateralHalves`,
  below this fake, and cached per picture so the five bilateral questions share
  one. A fake reader that answers `regionSides` directly never pays it, so a
  count taken here alone is one call light. Named, not silently dropped.
*/
const axis = sides > 0 ? 1 : 0;
const total = calls.length + axis;
console.log(`counted       ${calls.length} through the scan`);
console.log(`+ axis        ${axis} — one shared midline read the fake cannot see (inside the real regionSides)`);
console.log(`READS         ${total}`);
console.log(`AT $${USD_PER_READ}      $${(total * USD_PER_READ).toFixed(3)} per version looked at`);
console.log("");
console.log('NOTE: "face" is asked TWICE per picture — once as the below-head head read');
console.log("      (region:face above) and once for the midline. Same prompt, same frame,");
console.log('      two calls, because one keeps the first component and the other keeps all.');
console.log("");
console.log(`(the scan filed ${result.regions?.length ?? 0} regions from that run — `
  + "a sanity line, not the measurement)");
process.exit(0);
