/**
 * HOW FAR DOES HER MIDLINE MOVE ACROSS A CHAIN? (the free half of the
 * slot-count note's §5.)
 *
 * A bilateral region costs three calls and the face read — her own vertical
 * axis — is most of the time. Nothing in the render path holds a face mask to
 * donate, so the only way to stop paying it is to reuse the axis across a
 * candidate's frames, and that is an approximation. This measures what the
 * approximation would cost, on frames already on disk: a repaint reproduces the
 * same pose and framing by construction, so the claim is that her axis barely
 * moves — and a claim is not a number.
 *
 *   npx tsx scripts/measure-midline-drift-disposable.mts
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";

const IN = "output/court-carried-words";
const FRAMES = readdirSync(IN).filter((name) => name.endsWith(".png") && !name.includes("earrings"));
const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) throw new Error("FAL_KEY is required");

const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
type Mask = { data: Buffer; width: number; height: number };
const reader = createFalRegionReader({ apiKey: FAL_KEY }) as unknown as {
  region(input: { image: Buffer; name: string; absentIsAnswer?: boolean }): Promise<Mask>;
};

const axes: Array<{ frame: string; axis: number; width: number }> = [];
for (const frame of FRAMES) {
  const mask = await reader.region({ image: readFileSync(`${IN}/${frame}`), name: "face", absentIsAnswer: true });
  let total = 0;
  let weighted = 0;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x]! <= 127) continue;
      total += 1;
      weighted += x;
    }
  }
  if (total === 0) { console.log(`${frame}: her face does not read`); continue; }
  const axis = weighted / total;
  axes.push({ frame, axis, width: mask.width });
  console.log(`${frame.padEnd(22)} midline ${axis.toFixed(1)} of ${mask.width}px`);
}

/*
  GROUPED BY CANDIDATE, because the question is about ONE person's frames. The
  first cut of this printed a single spread over both — the fixture's five
  frames and two of the founder's — and 8.4px of it was two different women
  standing in slightly different places.
*/
const candidateOf = (frame: string) => (frame.startsWith("baseline") ? "the founder's cast" : "the fixture");
const groups = new Map<string, typeof axes>();
for (const one of axes) {
  const held = groups.get(candidateOf(one.frame)) ?? [];
  held.push(one);
  groups.set(candidateOf(one.frame), held);
}
console.log("");
for (const [candidate, frames] of Array.from(groups.entries())) {
  const low = Math.min(...frames.map((one) => one.axis));
  const high = Math.max(...frames.map((one) => one.axis));
  const width = frames[0]!.width;
  console.log(`${candidate}: ${frames.length} frames · midline moves ${(high - low).toFixed(1)}px`
    + ` — ${((high - low) / width * 100).toFixed(3)}% of the frame's width`);
}
console.log("");
console.log("The cut this axis makes is a half-frame split, so what it costs is a feature");
console.log("sitting inside that band being handed to the wrong half.");
process.exit(0);
