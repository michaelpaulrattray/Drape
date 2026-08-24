/**
 * DISPOSABLE — DOES THE CUT'S OWN HEADROOM BUDGET CLEAR THE HEAD?
 *
 * Arithmetic over two files paid arms already bought — `arm0.log`'s FACE boxes
 * and `armH.json`'s HEAD boxes. **No render, no read, no credit, no network
 * call of any kind.**
 *
 * # Why it exists
 *
 * Arm H disqualified `hair` and made `head` the cut's landmark
 * (`CASTING_FRAMING_CONSISTENCY_COURT.md` §8a). But `T_min` — the court's
 * headline — is computed on FACE boxes: `share = faceH/H`,
 * `headroom = faceTop/faceH`, and the usable common headroom `R` is the
 * tightest headroom on the sheet. Nothing had asked the question that swap
 * raises:
 *
 *   at R, does the crop's top edge sit ABOVE the top of the head?
 *
 * The crop top is `faceTop - R*faceH`. The head top is `faceTop - gap*faceH`,
 * where `gap` is the head-above-face distance in face-heights. So the head is
 * contained exactly when **R > gap**, and the clearance is `R - gap` — in
 * face-heights, which is the unit both quantities are already in.
 *
 * ⚠ **It reports the BINDING frame separately**, because the frame that
 * constrains `R` most is not necessarily the frame whose hair sits highest, and
 * a mean clearance over a sheet says nothing about the one frame that clips.
 *
 * # What it cannot say, stated on its own face
 *
 * `gap` is known on 4 frames of 15 — the SUIT cell arm H read. The HAIR cell's
 * frames carry head boxes but no face box, and they are CUT frames from the
 * failed court, so a gap measured on them is a lower bound on the raw gap
 * (§8b: the cut may have clipped the hair already, and the raw is gone). This
 * script therefore refuses to average across cells and prints the coverage
 * fraction beside every verdict.
 *
 *   npx tsx scripts/_framing-headroom-budget-disposable.mts
 */

import { readFileSync } from "node:fs";

const ARM0 = "output/framing-court/arm0.log";
const ARMH = "output/framing-court/armH.json";

const ROW = /^(SUIT|BASICS)\s+(pos\d)\.png\s+frame \d+x(\d+)\s+faceBox \d+x(\d+) at \d+,(\d+)/;

type Frame = { group: string; pos: string; share: number; headroom: number; faceTop: number; faceH: number };
const frames: Frame[] = [];
for (const line of readFileSync(ARM0, "utf8").split(/\r?\n/)) {
  const match = ROW.exec(line);
  if (!match) continue;
  const [, group, pos, frameH, faceH, faceTop] = match;
  const H = Number(frameH);
  const face = Number(faceH);
  const top = Number(faceTop);
  frames.push({ group: group!, pos: pos!, share: face / H, headroom: top / face, faceTop: top, faceH: face });
}
if (frames.length === 0) throw new Error(`${ARM0}: no frame rows matched — has the log's format moved?`);

/* Arm H's head boxes, joined on (cell, id). Only the SUIT cell carries a face
   box, and its faceTop/faceHeight are READ FROM arm0.log by arm H's own script
   — so the join below is a join on the same numbers, not two beliefs about
   them, and the assertion proves it rather than assuming it. */
const armH = JSON.parse(readFileSync(ARMH, "utf8")) as {
  reads: Array<{ cell: string; id: string; word: string; box: { top: number } | null; faceTop: number | null; faceHeight: number | null }>;
};
const heads = armH.reads.filter((read) => read.word === "head" && read.cell === "SUIT" && read.box !== null);
if (heads.length === 0) throw new Error(`${ARMH}: no SUIT "head" reads — has arm H's shape moved?`);

const gaps = new Map<string, number>();
for (const read of heads) {
  const frame = frames.find((f) => f.group === "SUIT" && f.pos === read.id);
  if (!frame) throw new Error(`arm H read ${read.id} has no arm0 row — the two arms disagree about the population`);
  if (read.faceTop !== frame.faceTop || read.faceHeight !== frame.faceH) {
    throw new Error(`${read.id}: arm H says face ${read.faceHeight}@${read.faceTop}, arm0 says ${frame.faceH}@${frame.faceTop}`);
  }
  gaps.set(`SUIT/${read.id}`, (frame.faceTop - read.box!.top) / frame.faceH);
}

console.log("HEADROOM BUDGET — does the cut's own R clear the top of the head?");
console.log(`  face boxes ${ARM0}  ·  head boxes ${ARMH}  ·  no network call`);
console.log();

const groups = [...new Set(frames.map((frame) => frame.group))];
for (const group of [...groups, "BOTH"]) {
  const mine = group === "BOTH" ? frames : frames.filter((frame) => frame.group === group);
  const usableR = Math.floor(Math.min(...mine.map((frame) => frame.headroom)) * 100) / 100;
  const binding = mine.reduce((a, b) => (a.headroom <= b.headroom ? a : b));
  const known = mine
    .map((frame) => ({ frame, gap: gaps.get(`${frame.group}/${frame.pos}`) }))
    .filter((row): row is { frame: Frame; gap: number } => row.gap !== undefined);

  console.log(`${group.padEnd(7)} n=${mine.length}  usable R ${usableR.toFixed(2)}  binding frame ${binding.group}/${binding.pos} (headroom ${binding.headroom.toFixed(3)})`);
  if (known.length === 0) {
    console.log("    gap UNKNOWN on every frame of this cell — nothing to say, and it is not said");
    console.log();
    continue;
  }
  const worst = known.reduce((a, b) => (a.gap >= b.gap ? a : b));
  for (const row of known) {
    const clearance = usableR - row.gap;
    const px = clearance * row.frame.faceH;
    console.log(`    ${row.frame.pos}  gap ${row.gap.toFixed(3)}  clearance ${clearance >= 0 ? "+" : ""}${clearance.toFixed(3)} face-heights (${px >= 0 ? "+" : ""}${px.toFixed(0)} px at this frame's face height)  ${clearance > 0 ? "CLEARS" : "⚠ CLIPS"}`);
  }
  const bindingGap = gaps.get(`${binding.group}/${binding.pos}`);
  console.log(`    widest gap  ${worst.frame.pos} at ${worst.gap.toFixed(3)}  ·  clearance ${(usableR - worst.gap).toFixed(3)}`);
  console.log(bindingGap === undefined
    ? "    ⚠ THE BINDING FRAME'S GAP IS UNMEASURED — the one frame R is set by is the one this cannot check"
    : `    the binding frame's own gap is ${bindingGap.toFixed(3)} → clearance ${(usableR - bindingGap).toFixed(3)}`);
  console.log(`    coverage ${known.length}/${mine.length} frames carry a measured gap`);
  console.log();
}

console.log("VERDICT IS A FLOOR, NOT A CERTIFICATE. The measured cell is eight close-cropped");
console.log("and greying suit heads. The population the hair clause exists for — an afro, an");
console.log("updo, volume — has no raw frame with both boxes on it anywhere on disk, so the");
console.log("court's own arms must read `head` beside `face` on the frames they render.");

/* And the last statement ends the process. */
process.exit(0);
