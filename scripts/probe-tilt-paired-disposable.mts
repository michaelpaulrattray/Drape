/**
 * THE PAIRED CONTROL: THE SAME FACE, WITH AND WITHOUT HER GLASSES.
 *
 * opus-056 §3 raised a worry the population data could not settle — every
 * bespectacled reading (-0.3° to 4.8°) sat below every bare one (5.7° to
 * 10.3°), which is either an honest difference between two sets of people or
 * the frames biasing the instrument downward. Different faces cannot tell those
 * apart.
 *
 * Run-15 produced the control for free. Step 5 removed her glasses and no step
 * ever edited her eyes — fox eyes was REFUSED and refunded — so frame 05 is the
 * same woman, same eyes, frames off.
 *
 *   with glasses (her master)   2.0°
 *   without (frame 05)          ?
 *
 * A jump toward the bare population means the frames bias the reading, and the
 * gate is being handed a confident wrong number rather than an honest silence.
 * A number near 2° means she is simply flat-eyed and the population explanation
 * wins.
 *
 *   FAL_KEY=… npx tsx scripts/probe-tilt-paired-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { readCanthalTilt } from "../server/castingV2/eyeShapeRouting";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";

const falKey = process.env.FAL_KEY;
if (!falKey) throw new Error("FAL_KEY required");
const reader = createFalRegionReader({ apiKey: falKey });

const W = "output/walk/2026-08-08T19-59-45-742Z";
const specimens: [string, string][] = [
  ["WITH glasses    (her master)", "output/sheet-verify/02-154fb36b.png"],
  ["WITH glasses    (frame 04, hoops on)", `${W}/04-delivered.png`],
  ["WITHOUT glasses (frame 05, removal)", `${W}/05-delivered.png`],
];

for (const [label, file] of specimens) {
  const bytes = readFileSync(file);
  /* Three reads each, because a single reading cannot show its own spread and
     the whole question is whether one number can be trusted. */
  const readings = [];
  for (let i = 0; i < 3; i += 1) {
    const tilt = await readCanthalTilt({ image: bytes, reader });
    readings.push(tilt ? tilt.meanDeg : null);
  }
  const got = readings.filter((r): r is number => r !== null);
  console.log(`${label}`);
  console.log(`   ${readings.map((r) => (r === null ? "NO-READ" : `${r.toFixed(1)}°`)).join("   ")}`
    + `${got.length > 1 ? `   spread ${(Math.max(...got) - Math.min(...got)).toFixed(1)}°` : ""}`);
}

console.log("\nSame woman, same eyes — fox eyes was refused, so nothing ever edited them.");

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
