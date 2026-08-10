/**
 * WHAT DOES OUR OWN COMPOSITOR'S SEAM ACTUALLY MEASURE? — before any threshold.
 *
 * The frame-integrity check must be sized on the specimen rather than on a
 * number somebody liked. This measures the signature on run-6's four production
 * renders: one torn (`01-freckles`) and two clean ones from the same face and
 * the same chain (`02-lipgloss`, `03-earrings`), plus the master against itself
 * as a null.
 *
 * # The signal
 *
 * Outside the applied mask the composite is byte-identical to the master, so
 * for any pair of neighbouring pixels straddling the mask boundary the OUTSIDE
 * value is the same in both images. The step across that boundary therefore
 * changes only because of what was delivered inside it:
 *
 *   excess = |delivered_in − delivered_out| − |master_in − master_out|
 *
 * A surface edit moves a few levels, so its excess is small. A tear replaces
 * one material with another across the boundary — background over hair — so its
 * excess is enormous. The question this fixture answers is how far apart those
 * two really are, and whether a run-length requirement is needed to separate
 * them.
 *
 *   npx tsx scripts/calibration/composite-seam.mts
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

import { compositeSeam } from "../../server/castingV2/compositeIntegrity";

const DIR = "output/run6-audit";

type Frame = { data: Buffer; width: number; height: number };

async function raster(path: string): Promise<Frame> {
  const image = sharp(await readFile(path)).removeAlpha().raw();
  const { data, info } = await image.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const luma = (frame: Frame, pixel: number) => {
  const at = pixel * 3;
  return (frame.data[at]! * 299 + frame.data[at + 1]! * 587 + frame.data[at + 2]! * 114) / 1000;
};

/**
 * The applied region, derived rather than stored: production keeps no mask, and
 * `outsideMaskUnchanged` guarantees the composite equals the master everywhere
 * outside it. So "differs from the master" IS the applied region.
 */
function appliedOf(master: Frame, delivered: Frame): Uint8Array {
  const applied = new Uint8Array(master.width * master.height);
  for (let pixel = 0; pixel < applied.length; pixel += 1) {
    const at = pixel * 3;
    if (master.data[at] !== delivered.data[at]
      || master.data[at + 1] !== delivered.data[at + 1]
      || master.data[at + 2] !== delivered.data[at + 2]) applied[pixel] = 1;
  }
  return applied;
}

function excesses(master: Frame, delivered: Frame): number[] {
  const { width, height } = master;
  const applied = appliedOf(master, delivered);
  const out: number[] = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = y * width + x;
      if (!applied[pixel]) continue;
      for (const neighbour of [pixel - 1, pixel + 1, pixel - width, pixel + width]) {
        if (applied[neighbour]) continue;
        /* Straddles the boundary: inside vs outside. */
        const deliveredStep = Math.abs(luma(delivered, pixel) - luma(delivered, neighbour));
        const masterStep = Math.abs(luma(master, pixel) - luma(master, neighbour));
        out.push(deliveredStep - masterStep);
      }
    }
  }
  return out;
}

function describe(label: string, values: number[]): void {
  if (values.length === 0) {
    console.log(`  ${label.padEnd(16)} no boundary at all`);
    return;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]!.toFixed(1);
  const over = (t: number) => values.filter((v) => v > t).length;
  console.log(
    `  ${label.padEnd(16)}${String(values.length).padStart(9)}`
    + `${at(0.5).padStart(9)}${at(0.9).padStart(9)}${at(0.99).padStart(9)}${at(1).padStart(9)}`
    + `${String(over(20)).padStart(9)}${String(over(40)).padStart(9)}${String(over(80)).padStart(9)}`,
  );
}

const master = await raster(`${DIR}/00-master.png`);
console.log(`master ${master.width}x${master.height}\n`);
console.log("excess step across the applied-mask boundary, in luma levels");
console.log(
  `  ${"frame".padEnd(16)}${"boundary".padStart(9)}${"p50".padStart(9)}${"p90".padStart(9)}`
  + `${"p99".padStart(9)}${"max".padStart(9)}${">20".padStart(9)}${">40".padStart(9)}${">80".padStart(9)}`,
);

for (const name of ["01-freckles", "02-lipgloss", "03-earrings"]) {
  describe(name, excesses(master, await raster(`${DIR}/${name}.png`)));
}
/* The null: a frame against itself has no applied region and must produce
   nothing at all. An instrument that reports a seam here is measuring noise. */
describe("master vs self", excesses(master, master));

console.log(
  "\n01-freckles is the TORN one. 02 and 03 are clean, from the same face and"
  + "\nthe same chain, so the gap between them is the whole discriminating power"
  + "\navailable — and a threshold has to sit inside it.",
);

/*
  AND THE SHIPPED CHECK'S OWN VERDICT ON THE SAME FRAMES.

  The table above sizes the threshold; this is the instrument reading the
  specimen. A detector calibrated on a table and never pointed at the artifact
  is the class of control this program keeps finding inert.
*/
function verdictFor(delivered: Frame) {
  const applied = appliedOf(master, delivered);
  return compositeSeam({
    master,
    composite: delivered,
    applied: {
      data: Buffer.from(applied.map((value) => (value ? 255 : 0))),
      width: master.width,
      height: master.height,
    },
  });
}

/*
  AND IT IS A CONTROL, not a printout (Fable, fable-016).

  The synthetic controls in `compositeIntegrity.test.ts` prove the arithmetic.
  This proves the shipped thresholds still fire on THE ACTUAL DEFECT and still
  stay silent on two real renders that were fine — the specimen the numbers were
  cut against. A calibration that only ever prints is the class of control this
  program keeps finding inert, so this one exits non-zero when it is wrong.
*/
console.log("\nthe shipped check, on these frames");
const EXPECTED: Record<string, boolean> = {
  "01-freckles": true,
  "02-lipgloss": false,
  "03-earrings": false,
};
let wrong = 0;
for (const [name, shouldBeTorn] of Object.entries(EXPECTED)) {
  const verdict = verdictFor(await raster(`${DIR}/${name}.png`));
  const ok = verdict.torn === shouldBeTorn;
  if (!ok) wrong += 1;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${name.padEnd(16)}${verdict.torn ? "TORN " : "clean"}  ${verdict.detail}`,
  );
}

/*
  THE RESIDUE'S OWNER (Fable's condition).

  The three fixes took run-6's tear down 92% and 63% and left roughly 1,200 px
  per band. Either the check can still SEE that residue — in which case it is
  inside this instrument's jurisdiction and stays managed here — or it honestly
  cannot, and the residue's disposition becomes a visual question for the
  stylist's eye on the next walk. Printed either way, so it belongs to someone.
*/
const REPLAYED = "output/masked/torn-replay/replayed.png";
if (existsSync(REPLAYED)) {
  const verdict = verdictFor(await raster(REPLAYED));
  console.log(
    `\n  post-fix replay: ${verdict.torn ? "STILL TORN — the residue is this instrument's" : "below the bar"}`
    + `\n  ${verdict.detail}`,
  );
  console.log(
    verdict.tornPixels > 0
      ? "  the check can still SEE the residue, so it stays inside its jurisdiction."
      : "  the check cannot see the residue: its disposition is a VISUAL question,\n"
        + "  and the next walk's renders get looked at with that band in mind (law 8).",
  );
} else {
  console.log(`\n  no ${REPLAYED} — run scripts/calibration/torn-frame-replay.mts for the residue verdict`);
}

if (wrong > 0) {
  console.error(`\n${wrong} frame(s) read the wrong way — the thresholds no longer fit the specimen.`);
  process.exitCode = 1;
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
