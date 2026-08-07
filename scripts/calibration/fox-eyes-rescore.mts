/**
 * RE-SCORE THE CAPABILITY PROBE PER SIDE — because three arms came back
 * "unreadable" and an unreadable arm is not a failed one.
 *
 * SAM 3 returned both eyes as a SINGLE region on three of six renders, so the
 * component split refused. The refusal was right; the consequence was that the
 * factorial had a hole exactly where the engine-versus-vocabulary attribution
 * lives. Asking each side by name removes the question entirely.
 *
 * Free: the renders are already on disk, so this is segmentation only.
 *
 *   npx tsx scripts/calibration/fox-eyes-rescore.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { cornersFromEyeMasks, readingFrom } from "../../server/castingV2/canthalTilt";

const OUT = "output/masked/fox-eyes-capability";
const SPECIMEN = "output/masked/bare-faced/cand-11.png";
const RESOLUTION_DEG = 1.1;
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

const master = readFileSync(SPECIMEN);
const meta = await sharp(master).metadata();
const W = meta.width!, H = meta.height!;

async function tilt(bytes: Buffer) {
  const [right, left] = await Promise.all([
    reader.region({ image: bytes, name: "right eye" }),
    reader.region({ image: bytes, name: "left eye" }),
  ]);
  const { outers, inners } = cornersFromEyeMasks(right, left);
  return readingFrom(outers, inners, W, H);
}

const baseline = await tilt(master);
console.log(`BASELINE ${baseline.meanDeg.toFixed(2)}deg (asym ${baseline.asymmetryDeg.toFixed(2)})`);
console.log(`instrument resolves ~${RESOLUTION_DEG}deg\n`);

const rows: any[] = [];
for (const engine of ["gpt2", "nbp", "flux"]) {
  for (const prose of ["trend", "anatomical"]) {
    const file = `${OUT}/${engine}-${prose}.png`;
    if (!existsSync(file)) { console.log(`${engine}/${prose}  MISSING`); continue; }
    try {
      const reading = await tilt(readFileSync(file));
      const delta = reading.meanDeg - baseline.meanDeg;
      const verdict = delta > RESOLUTION_DEG ? `RESTRUCTURED +${delta.toFixed(2)}`
        : delta < -RESOLUTION_DEG ? `WRONG WAY ${delta.toFixed(2)}`
          : `no change (${delta >= 0 ? "+" : ""}${delta.toFixed(2)})`;
      rows.push({ engine, prose, tilt: reading.meanDeg, delta, asym: reading.asymmetryDeg });
      console.log(`${engine.padEnd(5)} ${prose.padEnd(11)} ${reading.meanDeg.toFixed(2)}deg  ${verdict}  (asym ${reading.asymmetryDeg.toFixed(1)})`);
    } catch (error) {
      console.log(`${engine.padEnd(5)} ${prose.padEnd(11)} UNREADABLE — ${String(error).slice(0, 60)}`);
    }
  }
}

writeFileSync(`${OUT}/rescore.json`, `${JSON.stringify({ baseline, rows }, null, 2)}\n`);

/* The whole point of the factorial: does the WORD matter, holding the engine? */
console.log("\n=== vocabulary effect, per engine (anatomical minus trend) ===");
for (const engine of ["gpt2", "nbp", "flux"]) {
  const trend = rows.find((row) => row.engine === engine && row.prose === "trend");
  const anat = rows.find((row) => row.engine === engine && row.prose === "anatomical");
  if (!trend || !anat) { console.log(`${engine.padEnd(5)} incomplete`); continue; }
  console.log(`${engine.padEnd(5)} ${(anat.delta - trend.delta >= 0 ? "+" : "")}${(anat.delta - trend.delta).toFixed(2)}deg`);
}
