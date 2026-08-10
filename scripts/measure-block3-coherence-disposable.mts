/**
 * HIS EYE SAID "LIKE IT'S BEEN PASTED". WHAT DOES THE STATISTIC SAY?
 *
 * Ordered by fable-150/152 after the founder went through the judgment pack.
 * On block 3 he preferred the ANCHORED finals and saw seam lines on OURS. The
 * algebra says a disjoint chain composes identically either way, so a real
 * difference is either paint draw or a defect in our arm — and either answer
 * goes back to him with a number beside his eye.
 *
 *   npx tsx scripts/measure-block3-coherence-disposable.mts
 *
 * Free: four PNGs already on disk, no engine, no database, no credits.
 *
 * # The boundary set, and why all four arms get the identical rule
 *
 * `applied` is not stored for these frames. It does not need to be: bench B's
 * own report asserts the composite is byte-identical to the master outside the
 * applied ground on 6/6 versions, so **any pixel that differs at all is inside
 * it**, exactly. No threshold, no bias — a threshold would place the boundary
 * where the change happens to be small, which is the one place a seam is
 * quietest.
 *
 * Each final frame is measured against the SAME master with the SAME rule. That
 * is the comparison the founder actually made: three finished pictures, side by
 * side, at his viewing distance.
 *
 * # The instrument is proved before its verdict counts
 *
 * Three controls, all driven here (working law 2 — and the coherence statistic
 * has exactly ONE prior specimen, which is not a calibration):
 *
 *   NEGATIVE   the master against itself — nothing composited, nothing read
 *   POSITIVE   a synthetic +6-luma offset painted inside a region: a dead
 *              consistent step the eye would integrate, and the statistic must
 *              read it as high coherence
 *   SCALE      the founder's own traced seam, 1.118, and an ordinary clean
 *              boundary, 0.020 — the two rows in `scripts/lib/seamRows.mts`
 */
import { readFile } from "node:fs/promises";

import { compositeSeam } from "../server/castingV2/compositeIntegrity";
import { CLEAN_BOUNDARY_COHERENCE, FOUNDER_SEAM_COHERENCE } from "./lib/seamRows.mts";
import type { Mask, Raster } from "../server/castingV2/maskedComposite";

const MASTER = "output/marks-court/MASTER-run15.png";
const ARMS = [
  { label: "OURS — bench B", file: "output/bench-b/v6-ears.png", note: "each step painted from her original" },
  { label: "ANCHORED chain 1", file: "output/composite-anchored/chain1-v6-ears.png", note: "the proposal" },
  { label: "ANCHORED chain 2", file: "output/composite-anchored/chain2-v6-ears.png", note: "the proposal, second run" },
  { label: "PHOTOCOPY control", file: "output/bench-b/control-v6.png", note: "for scale — he called this terrible" },
] as const;

const sharp = (await import("sharp")).default;

async function raster(file: string): Promise<Raster> {
  const { data, info } = await sharp(await readFile(file)).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Every pixel that differs at all. Exact, for the reason in the header. */
function changedAgainst(master: Raster, frame: Raster): { mask: Mask; pixels: number } {
  const mask: Mask = { data: Buffer.alloc(master.width * master.height), width: master.width, height: master.height };
  let pixels = 0;
  for (let index = 0; index < master.width * master.height; index += 1) {
    const at = index * 3;
    if (
      master.data[at] === frame.data[at]
      && master.data[at + 1] === frame.data[at + 1]
      && master.data[at + 2] === frame.data[at + 2]
    ) continue;
    mask.data[index] = 255;
    pixels += 1;
  }
  return { mask, pixels };
}

const master = await raster(MASTER);
console.log(`master  ${MASTER}  ${master.width}x${master.height}\n`);

/* ---------------------------------------------------- the three controls */

console.log("THE INSTRUMENT, BEFORE ITS VERDICT");

const selfSame = changedAgainst(master, master);
const negative = compositeSeam({ master, composite: master, applied: selfSame.mask });
console.log(
  `  NEGATIVE  the master against itself         boundary ${negative.boundaryPixels} px  `
  + `coherence ${negative.coherence.toFixed(3)}   ${negative.boundaryPixels === 0 ? "reads nothing, as it must" : "SHOULD BE ZERO — STOP"}`,
);

/* A dead-consistent offset inside a square, which is the defect in its purest
   form: no texture, no amplitude worth a tear bar, one direction everywhere. */
const OFFSET = 6;
const box = { x: 300, y: 400, w: 200, h: 200 };
const painted: Raster = { data: Buffer.from(master.data), width: master.width, height: master.height };
const synthetic: Mask = { data: Buffer.alloc(master.width * master.height), width: master.width, height: master.height };
for (let y = box.y; y < box.y + box.h; y += 1) {
  for (let x = box.x; x < box.x + box.w; x += 1) {
    const index = y * master.width + x;
    synthetic.data[index] = 255;
    for (let channel = 0; channel < 3; channel += 1) {
      painted.data[index * 3 + channel] = Math.min(255, painted.data[index * 3 + channel]! + OFFSET);
    }
  }
}
const positive = compositeSeam({ master, composite: painted, applied: synthetic });
console.log(
  `  POSITIVE  a synthetic +${OFFSET} luma patch          boundary ${positive.boundaryPixels} px  `
  + `coherence ${positive.coherence.toFixed(3)}   ${positive.coherence > 1 ? "the instrument CAN see a blend seam" : "IT CANNOT — every number below is worthless"}`,
);
console.log(
  `  SCALE     his own traced seam ${FOUNDER_SEAM_COHERENCE.toFixed(3)} · an ordinary clean boundary ${CLEAN_BOUNDARY_COHERENCE.toFixed(3)}\n`,
);

/* ------------------------------------------------------------- the arms */

console.log("BLOCK 3'S FINALS — the three pictures he compared, plus the control");
console.log("arm                    changed px    boundary px   |mean| ± sd        coherence   torn");
const results: Array<{ label: string; coherence: number; torn: boolean }> = [];
for (const arm of ARMS) {
  const frame = await raster(arm.file);
  if (frame.width !== master.width || frame.height !== master.height) {
    console.log(`${arm.label.padEnd(22)}  DIFFERENT SIZE from the master — not comparable`);
    continue;
  }
  const { mask, pixels } = changedAgainst(master, frame);
  const seam = compositeSeam({ master, composite: frame, applied: mask });
  results.push({ label: arm.label, coherence: seam.coherence, torn: seam.torn });
  console.log(
    `${arm.label.padEnd(22)}  ${String(pixels).padStart(10)}  ${String(seam.boundaryPixels).padStart(12)}   `
    + `${seam.signedMean.toFixed(2).padStart(6)} ± ${seam.signedSpread.toFixed(2).padStart(5)}    `
    + `${seam.coherence.toFixed(3).padStart(8)}   ${seam.torn ? "YES" : "no"}`,
  );
}

/* ----------------------------------------------------------- the answer */

const ours = results.find((row) => row.label.startsWith("OURS"));
const anchored = results.filter((row) => row.label.startsWith("ANCHORED"));
console.log("\nHIS QUESTION — does OURS carry hotter boundaries than BOTH anchored runs?");
if (!ours || anchored.length < 2) {
  console.log("  NOT ANSWERABLE — an arm is missing. A partial read is not a verdict.");
} else {
  const hotter = anchored.every((row) => ours.coherence > row.coherence);
  const cooler = anchored.every((row) => ours.coherence < row.coherence);
  const spread = Math.max(...anchored.map((row) => row.coherence)) - Math.min(...anchored.map((row) => row.coherence));
  console.log(`  ours ${ours.coherence.toFixed(3)}   anchored ${anchored.map((row) => row.coherence.toFixed(3)).join(" and ")}`);
  console.log(`  the two anchored runs differ from EACH OTHER by ${spread.toFixed(3)} — that is this measurement's own draw`);
  console.log(
    hotter
      ? `  YES — and it clears the run-to-run spread ${Math.abs(ours.coherence - Math.max(...anchored.map((r) => r.coherence))) > spread ? "comfortably" : "only just, which is not a finding"}`
      : cooler
        ? "  NO — ours reads COOLER than both. His eye and this statistic disagree, and both go to him."
        : "  MIXED — ours sits between the two anchored runs, which is draw rather than difference.",
  );
}

/* ------------------------------------------- WHICH paste is hot, per arm */

/**
 * The six edits are on disjoint regions, so a connected component of `applied`
 * IS an edit's own ground. Splitting the boundary by component turns "our arm
 * runs hotter" into "THIS paste runs hotter", which is the difference between a
 * verdict and a work item — and it is the first thing the blend/feather build
 * needs to know.
 *
 * Free arithmetic on masks already in memory. Components under 200 px are
 * dropped as speckle and the dropped COUNT is printed, because a silent filter
 * reads as coverage.
 */
function components(mask: Mask): Mask[] {
  const { width, height } = mask;
  const seen = new Uint8Array(width * height);
  const found: Mask[] = [];
  let speckle = 0;
  for (let start = 0; start < width * height; start += 1) {
    if (mask.data[start] === 0 || seen[start]) continue;
    const stack = [start];
    const members: number[] = [];
    seen[start] = 1;
    while (stack.length > 0) {
      const pixel = stack.pop()!;
      members.push(pixel);
      const x = pixel % width;
      const y = (pixel - x) / width;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const neighbour = ny * width + nx;
        if (seen[neighbour] || mask.data[neighbour] === 0) continue;
        seen[neighbour] = 1;
        stack.push(neighbour);
      }
    }
    if (members.length < 200) { speckle += 1; continue; }
    const piece: Mask = { data: Buffer.alloc(width * height), width, height };
    for (const pixel of members) piece.data[pixel] = 255;
    found.push(piece);
  }
  if (speckle > 0) console.log(`  (${speckle} components under 200 px dropped as speckle)`);
  return found.sort((a, b) => {
    const count = (mask_: Mask) => mask_.data.reduce((total, value) => total + (value > 0 ? 1 : 0), 0);
    return count(b) - count(a);
  });
}

console.log("\nWHERE IT LIVES — each paste's own boundary, largest grounds first");
for (const arm of ARMS.slice(0, 3)) {
  const frame = await raster(arm.file);
  if (frame.width !== master.width) continue;
  const { mask } = changedAgainst(master, frame);
  console.log(`\n  ${arm.label}`);
  const pieces = components(mask).slice(0, 6);
  for (const piece of pieces) {
    const seam = compositeSeam({ master, composite: frame, applied: piece });
    const centre = (() => {
      let sumX = 0; let sumY = 0; let n = 0;
      for (let index = 0; index < piece.data.length; index += 1) {
        if (piece.data[index] === 0) continue;
        sumX += index % master.width; sumY += Math.floor(index / master.width); n += 1;
      }
      return n === 0 ? "—" : `${Math.round(sumX / n)},${Math.round(sumY / n)}`;
    })();
    console.log(
      `    at ${centre.padEnd(10)} boundary ${String(seam.boundaryPixels).padStart(6)} px   `
      + `${seam.signedMean.toFixed(2).padStart(6)} ± ${seam.signedSpread.toFixed(2).padStart(5)}   coherence ${seam.coherence.toFixed(3)}`,
    );
  }
}

process.exit(0);
