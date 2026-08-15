/**
 * IS THE ~25% THE DELIVERY MOVING, OR THE MASK? (fable-600 §2.)
 *
 * A's court scored two renders of an IDENTICAL recipe at 0.0% and 21.3% extent
 * drift on the same earring, and I wrote that up as a product fact: *"a carried
 * crop's delivered extent varies by ~25% between renders"*. Every one of those
 * extents is a SEGMENTER MASK's extent, and the same-pixels law says a re-read
 * moves on its own — so before that number becomes a floor anybody plans
 * against, the instrument gets a positive control.
 *
 * The control is the cheapest one there is: **read the same frame three times.**
 * A picture cannot change between reads, so whatever spread appears there is the
 * mask's own noise, and the drift between two frames means only as much as it
 * exceeds it.
 *
 *   within a frame     the same pixels, three reads → the instrument's floor
 *   between frames     the two POINT arms → what the court actually scored
 *
 * No renders, no credits: the frames are on disk from the court, and the whole
 * reading is ~12 segmenter calls (~$0.06 of house money).
 *
 *   npx tsx scripts/court-mask-vs-delivery-disposable.mts
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

import { catalogueSlots } from "../server/castingV2/referenceSlotCatalogue.js";

const IN = "output/court-carried-words";
const FRAMES = [
  { name: "born", file: `${IN}/born.png` },
  { name: "after-point", file: `${IN}/after-point.png` },
  { name: "after-point2", file: `${IN}/after-point2.png` },
];
const REPEATS = 3;

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) throw new Error("FAL_KEY is required — this reads regions");

const question = catalogueSlots()
  .find((definition) => definition.feature === "earring" && definition.question !== null)!.question as string;
const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");

type Mask = { data: Buffer; width: number; height: number };

/** On pixels as a share of the frame — the same statistic the constancy arm
 *  normalises, before it is divided by her face. */
function extentOf(mask: Mask): number {
  let on = 0;
  for (let at = 0; at < mask.width * mask.height; at += 1) if (mask.data[at]! > 127) on += 1;
  return on / (mask.width * mask.height);
}

const rows: Array<{ frame: string; side: string; reads: number[] }> = [];

for (const frame of FRAMES) {
  const bytes = readFileSync(frame.file);
  const perSide: Record<string, number[]> = { left: [], right: [] };
  for (let repeat = 0; repeat < REPEATS; repeat += 1) {
    /*
      A FRESH READER AND A FRESH BUFFER EVERY TIME. The reader memoises her
      midline on the buffer it was handed — deliberately, one face read per
      picture — so repeating through one reader would measure the cache rather
      than the segmenter.
    */
    const reader = createFalRegionReader({ apiKey: FAL_KEY }) as unknown as {
      regionSides(input: { image: Buffer; name: string; absentIsAnswer?: boolean }):
      Promise<{ left: Mask; right: Mask } | null>;
    };
    const sides = await reader.regionSides({
      image: Buffer.from(bytes),
      name: question,
      absentIsAnswer: true,
    });
    if (sides === null) {
      console.log(`${frame.name} repeat ${repeat + 1}: NO READ — the pair did not split`);
      continue;
    }
    perSide.left!.push(extentOf(sides.left));
    perSide.right!.push(extentOf(sides.right));
  }
  for (const side of ["left", "right"]) rows.push({ frame: frame.name, side, reads: perSide[side]! });
}

const spread = (reads: number[]): number => {
  if (reads.length < 2) return Number.NaN;
  const low = Math.min(...reads);
  const high = Math.max(...reads);
  /* Against the smallest reading, which is the same denominator the constancy
     arm's drift uses — |Δ| over the parent's own value. */
  return low === 0 ? Number.NaN : (high - low) / low;
};

console.log("");
console.log("WITHIN ONE FRAME — the same pixels, read three times. This is the instrument's floor.");
for (const row of rows) {
  console.log(`  ${row.frame.padEnd(13)} ${row.side.padEnd(6)}`
    + ` ${row.reads.map((value) => `${(value * 100).toFixed(4)}%`).join(" · ")}`
    + `   spread ${(spread(row.reads) * 100).toFixed(1)}%`);
}

console.log("");
console.log("BETWEEN THE TWO POINT ARMS — what the court scored, on the same statistic.");
for (const side of ["left", "right"]) {
  const one = rows.find((row) => row.frame === "after-point" && row.side === side)!;
  const two = rows.find((row) => row.frame === "after-point2" && row.side === side)!;
  const mean = (reads: number[]) => reads.reduce((sum, value) => sum + value, 0) / reads.length;
  const a = mean(one.reads);
  const b = mean(two.reads);
  console.log(`  ${side.padEnd(6)} ${(a * 100).toFixed(4)}% → ${(b * 100).toFixed(4)}%`
    + `   drift ${(Math.abs(a - b) / Math.min(a, b) * 100).toFixed(1)}% (means of three reads each)`);
}

writeFileSync(`${IN}/mask-noise.json`, `${JSON.stringify(rows, null, 2)}\n`);
process.exit(0);
