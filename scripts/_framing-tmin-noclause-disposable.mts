/**
 * T_MIN AT THE NO-CLAUSE POPULATION — the figure the framing RETARGET needs.
 *
 * `T = 22.7%` was chosen as `T_min` across the court's CLAUSE cells. The
 * founder's retarget takes the margin clause OUT, so the house constant has to
 * be re-chosen at the geometry of the cells that never had one.
 *
 * ⚠ NO NEW FRAMES AND NO SPEND. The control cells were rendered and measured
 * during the court and their per-frame face boxes are on disk
 * (`output/_armM-reread.log`). This reads them and divides.
 *
 * It imports `tMinOf` rather than re-deriving it — two implementations of a
 * court's headline number is working law 4 with the stakes turned up, which is
 * the same sentence `_framing-tmin-disposable.mts` carries for the same reason.
 */
import { readFileSync } from "node:fs";

import { type FramingFrame, identityHolds, tMinOf } from "./lib/framingTmin.mts";

const SOURCE = "output/_armM-reread.log";
const FRAME_H = 2304;

const CELL = /^════\s+(\S+)\s+════/;
const ROW = /^\s+(pos\d)\s+\d+x(\d+)\s+face \d+x(\d+) at \d+,(\d+)/;

const frames: FramingFrame[] = [];
let cell = "";
for (const line of readFileSync(SOURCE, "utf8").split(/\r?\n/)) {
  const header = CELL.exec(line);
  if (header) { cell = header[1]!; continue; }
  const match = ROW.exec(line);
  if (!match || cell === "") continue;
  const [, pos, frameH, faceH, faceTop] = match;
  const H = Number(frameH) || FRAME_H;
  const face = Number(faceH);
  const top = Number(faceTop);
  frames.push({ group: cell, pos: pos!, share: face / H, headroom: top / face, below: (H - top - face) / face });
}

if (frames.length === 0) throw new Error(`${SOURCE}: no frame rows matched — has the log's format moved?`);

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;
const cells = [...new Set(frames.map((f) => f.group))];

console.log(`T_MIN AT THE NO-CLAUSE POPULATION — ${frames.length} frames from ${SOURCE}`);
console.log(`cells found: ${cells.join(" · ")}`);
console.log();

for (const group of cells) {
  const mine = frames.filter((f) => f.group === group);
  const read = tMinOf(mine, { at: 0.316 });
  console.log(`${group.padEnd(16)} n=${read.n}`);
  console.log(`  share     median ${pct(read.shareMedian)}  min ${pct(read.shareMin)}  max ${pct(read.shareMax)}  spread ${(read.shareSpread * 100).toFixed(1)}pt`);
  console.log(`  band      T_min ${pct(read.tMin)}  T_max ${pct(read.tMax)}  ->  ${read.commonFeasible ? "FEASIBLE" : "⚠ EMPTY — no single T serves this cell"}`);
  console.log(`  at T=31.6%  ${read.trimsAtT}/${read.n} trim`);
  console.log(`  identity  ${JSON.stringify(identityHolds(mine))}`);
  console.log();
}

/* The control cells together — a house constant meets both sheets. */
const controls = frames.filter((f) => f.group.includes("control"));
if (controls.length > 0) {
  const read = tMinOf(controls, { at: 0.316 });
  console.log(`ALL CONTROL CELLS TOGETHER  n=${read.n}`);
  console.log(`  share     median ${pct(read.shareMedian)}  min ${pct(read.shareMin)}  max ${pct(read.shareMax)}  spread ${(read.shareSpread * 100).toFixed(1)}pt`);
  console.log(`  band      T_min ${pct(read.tMin)}  T_max ${pct(read.tMax)}  ->  ${read.commonFeasible ? "FEASIBLE" : "⚠ EMPTY — no single T serves the population"}`);
  console.log(`  at T=31.6%  ${read.trimsAtT}/${read.n} trim  ·  the settled constant`);
}

process.exit(0);
