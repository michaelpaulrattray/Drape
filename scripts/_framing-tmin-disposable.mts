/**
 * DISPOSABLE — `T_min`, THE LOOSEST COMMON FRAME A SHEET CAN BE CUT TO.
 *
 * Arithmetic over face boxes a paid arm already bought
 * (`output/framing-court/arm0.log`). **No render, no read, no credit, no
 * network call of any kind** — it opens one text file and divides.
 *
 * It exists because `docs/specs/CASTING_FRAMING_CONSISTENCY_COURT.md` quotes
 * its numbers, and a design that quotes a figure nobody can re-derive is a
 * figure that gets copied forward once and never checked again.
 *
 * # What it computes, and why it is the court's headline
 *
 * A frame can only be cropped IN. So for a common head share `T` and a common
 * headroom `R`, a frame is REACHABLE only if all three hold:
 *
 *   share    <= T                the head is not already bigger than the target
 *   headroom >= R                there is room above the head to place it
 *   below    >= 1/T - R - 1      there is torso below the chin to fill the frame
 *
 * `T_min` is the smallest `T` every frame of a sheet can reach. It is a
 * property of the RAW frames and the cut cannot move it — which is the whole
 * reason the court's bar is written on it, after a predecessor's bar turned out
 * to be the transformation restating its own definition.
 *
 * # It also proves the two "estimators" are not two
 *
 *   below = 1/share - headroom - 1
 *
 * holds identically, so `belowChin` is DERIVED from head size and head
 * placement rather than being independent evidence beside them. The check runs
 * on every frame and the count is printed, because a stated identity nobody
 * evaluates is an assumption wearing a proof's clothes.
 *
 *   npx tsx scripts/_framing-tmin-disposable.mts
 */

import { readFileSync } from "node:fs";

const SOURCE = "output/framing-court/arm0.log";

type Frame = {
  group: string;
  pos: string;
  share: number;
  headroom: number;
  below: number;
};

const ROW = /^(SUIT|BASICS)\s+(pos\d)\.png\s+frame \d+x(\d+)\s+faceBox \d+x(\d+) at \d+,(\d+)/;

const frames: Frame[] = [];
for (const line of readFileSync(SOURCE, "utf8").split(/\r?\n/)) {
  const match = ROW.exec(line);
  if (!match) continue;
  const [, group, pos, frameH, faceH, faceTop] = match;
  const H = Number(frameH);
  const face = Number(faceH);
  const top = Number(faceTop);
  frames.push({
    group: group!,
    pos: pos!,
    share: face / H,
    headroom: top / face,
    below: (H - top - face) / face,
  });
}

/*
  A reader that comes up empty THROWS rather than printing a clean nothing: an
  arm0 log whose format has moved would otherwise report "no frames" as calmly
  as it reports a finding.
*/
if (frames.length === 0) throw new Error(`${SOURCE}: no frame rows matched — has the log's format moved?`);

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

console.log(`T_MIN — the loosest common frame, over ${frames.length} frames from ${SOURCE}`);
console.log();

const groups = [...new Set(frames.map((frame) => frame.group))];
for (const group of [...groups, "BOTH"]) {
  const mine = group === "BOTH" ? frames : frames.filter((frame) => frame.group === group);

  /* R can be no larger than the tightest headroom on the sheet, or that frame
     cannot take the common headroom without cropping above its own top edge. */
  const usableR = Math.floor(Math.min(...mine.map((frame) => frame.headroom)) * 100) / 100;
  const perFrame = mine.map((frame) => Math.max(frame.share, 1 / (frame.below + usableR + 1)));
  const tMin = Math.max(...perFrame);
  const binding = mine[perFrame.indexOf(tMin)]!;

  const shares = mine.map((frame) => frame.share);
  console.log(`${group.padEnd(7)} n=${mine.length}`);
  console.log(`  share     median ${pct(median(shares))}  min ${pct(Math.min(...shares))}  max ${pct(Math.max(...shares))}`
    + `  spread ${((Math.max(...shares) - Math.min(...shares)) * 100).toFixed(1)}pt`);
  console.log(`  headroom  median ${median(mine.map((frame) => frame.headroom)).toFixed(2)}`
    + `  usable R ${usableR.toFixed(2)}`);
  console.log(`  below     median ${median(mine.map((frame) => frame.below)).toFixed(2)}  (DERIVED, see the identity below)`);
  console.log(`  T_min     ${pct(tMin)}  at R=${usableR.toFixed(2)}  ·  binding frame ${binding.group}/${binding.pos}`);
  console.log();
}

const broken = frames.filter((frame) => Math.abs((1 / frame.share - frame.headroom - 1) - frame.below) > 1e-9);
console.log(`identity  below = 1/share - headroom - 1  holds on ${frames.length - broken.length}/${frames.length} frames`);

/* And the last statement ends the process. */
process.exit(broken.length === 0 ? 0 : 1);
