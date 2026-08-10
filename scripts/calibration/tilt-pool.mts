/**
 * MEASURE THE BASELINE TILT OF EVERY SPECIMEN — the founder's confound, made
 * arithmetic.
 *
 * Every fox-eyes test this program has run — July's walk, this week's walk, the
 * bare-faced probe — ran on Asian faces carrying a high baseline canthal tilt.
 * The requested delta was therefore near zero, and "the engine changed nothing"
 * and "the engine rendered that ask correctly" are the same picture. Every prior
 * verdict is confounded by baseline and the class's capability is UNKNOWN.
 *
 * A capability probe needs a face whose corners are measurably LEVEL or
 * DOWNTURNED, so the ask carries a real delta. This picks that face by
 * arithmetic rather than by eye, using the instrument that passed its own tent
 * control at ~1.1deg (`tilt-instrument.mts`) — so a difference smaller than that
 * is not called.
 *
 *   npx tsx scripts/calibration/tilt-pool.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { UPSWEPT_ALREADY, cornersFromMask, readingFrom } from "../../server/castingV2/canthalTilt";

const OUT = "output/masked/tilt-pool";
mkdirSync(OUT, { recursive: true });
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

const pool: string[] = [];
for (const dir of ["output/masked/bare-faced", "output/masked/probe", "output/masked/specimens"]) {
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir)) {
    if (!/\.(png|jpg)$/i.test(file) || /CONTACT|LOOK|CROP/i.test(file)) continue;
    pool.push(`${dir}/${file}`);
  }
}
console.log(`${pool.length} specimens\n`);

const rows: { file: string; meanDeg: number; asym: number }[] = [];
for (const file of pool) {
  try {
    const bytes = readFileSync(file);
    const meta = await sharp(bytes).metadata();
    const eyes = await reader.region({ image: bytes, name: "eyes" });
    const { outers, inners } = cornersFromMask(eyes);
    const reading = readingFrom(outers, inners, meta.width!, meta.height!);
    rows.push({ file, meanDeg: reading.meanDeg, asym: reading.asymmetryDeg });
    console.log(`${reading.meanDeg.toFixed(1).padStart(6)}deg  asym ${reading.asymmetryDeg.toFixed(1).padStart(5)}  ${file}`);
  } catch (error) {
    console.log(`   ----  ${file}  (${String(error).slice(0, 55)})`);
  }
}

rows.sort((a, b) => a.meanDeg - b.meanDeg);
console.log(`\n=== sorted, flattest first (already-upswept threshold ${UPSWEPT_ALREADY}deg) ===`);
for (const row of rows) {
  const flag = row.meanDeg >= UPSWEPT_ALREADY ? "ALREADY UPSWEPT" : row.asym > 4 ? "(asymmetric — read with care)" : "usable delta";
  console.log(`${row.meanDeg.toFixed(1).padStart(6)}deg  ${flag.padEnd(30)} ${row.file}`);
}
const usable = rows.filter((row) => row.meanDeg < UPSWEPT_ALREADY && row.asym <= 4);
console.log(`\n${usable.length} of ${rows.length} specimens carry a real delta for an upswept ask.`);
if (usable.length === 0) console.log("NONE QUALIFY — the probe needs a face cast for the purpose.");
else console.log(`Flattest: ${usable[0].file} at ${usable[0].meanDeg.toFixed(1)}deg`);
writeFileSync(`${OUT}/results.json`, `${JSON.stringify(rows, null, 2)}\n`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
