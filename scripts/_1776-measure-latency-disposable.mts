/**
 * DISPOSABLE — #1776: how long does the framing measurement actually take?
 *
 * The card proposes a bound of "about 20 s". Before accepting that number, this
 * measures the thing it would bound. The reason it matters in the dangerous
 * direction: `maskedRefine`'s own docblock records a bilateral region read at
 * **~23 s**, and a band may name three landmarks, read one after another — so a
 * 20 s bound could convert WORKING measurements into `cannotMeasure`, which
 * hands out free retries and silently drops the check the card exists to keep.
 *
 * Spends HOUSE money only — fal segmenter reads at ~1¢ each, no text calls, no
 * customer credits, no database writes, no storage writes.
 *
 *   npx tsx scripts/_1776-measure-latency-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";

import { castPackageView } from "../server/castingV2/castViewPackage";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { measureViewFraming } from "../server/castingV2/viewFramingGeometry";
import type { CastViewAngle } from "../shared/boardTypes";

const FAL = process.env.FAL_KEY;
if (!FAL) throw new Error("no FAL_KEY in .env");

/* The same production frames #1612's court used; they live in the MAIN tree. */
const DIR = "C:/Users/Admin/Drape/output/_1612-frames";
const reader = createFalRegionReader({ apiKey: FAL });

/* A close-up frame and a full-length frame, so the widest band is measured on a
   picture it actually fits. 306 is his chest-up close-up; 322 is #1611's. */
const ARMS: Array<{ angle: CastViewAngle; asset: string }> = [
  { angle: "closeUp", asset: "306" },
  { angle: "closeUp", asset: "322" },
  { angle: "frontClose", asset: "306" },
  { angle: "sideClose", asset: "345" },
];

console.log("angle        asset  landmarks  verdict        seconds");
const seconds: number[] = [];
for (const arm of ARMS) {
  const band = castPackageView(arm.angle).band;
  const image = readFileSync(path.join(DIR, `${arm.asset}.png`));
  const started = Date.now();
  const measurement = await measureViewFraming({ band, image, reader });
  const took = (Date.now() - started) / 1000;
  seconds.push(took);
  console.log(
    `${arm.angle.padEnd(12)} ${arm.asset.padEnd(6)} `
    + `${String(measurement.landmarksRead.length).padEnd(10)} `
    + `${measurement.verdict.padEnd(14)} ${took.toFixed(1)}`,
  );
}
const worst = Math.max(...seconds);
console.log(`\nworst observed ${worst.toFixed(1)}s over ${seconds.length} measurements`);
console.log(`twice the worst (the judge's own rule for its 75 s) = ${(worst * 2).toFixed(0)}s`);
process.exit(0);
