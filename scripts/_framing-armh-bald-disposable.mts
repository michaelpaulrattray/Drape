/**
 * ARM H's LAST CELL — which word survives a subject with NO HAIR?
 *
 * `head` and `hair` both return the top of the hair on eight haired frames.
 * The cut runs on EVERY frame of every sheet, so the word it uses has to answer
 * on a bald subject too — and this product has a bald-acceptance court on
 * record, so bald casts are a real population rather than a hypothetical.
 *
 * The structural argument is obvious (a bald man has no hair to outline) and
 * that is exactly why it gets measured: an obvious inference about a segmenter
 * is still an inference. Four reads, ~$0.02, on frames already on disk.
 *
 *   npx tsx scripts/_framing-armh-bald-disposable.mts
 */

import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");

const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
const { extentOf } = await import("../server/castingV2/inkReferenceCrop.js");

const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });
const FRAMES = ["output/bald-acceptance/frames/pos0.png", "output/bald-acceptance/frames/pos2.png"];

const lines: string[] = [];
const say = (text = "") => { console.log(text); lines.push(text); };

say("ARM H, bald cell — does the landmark word survive a subject with no hair?");
say();

const rows: Array<{ file: string; word: string; box: unknown; pixels: number }> = [];
for (const file of FRAMES) {
  const bytes = readFileSync(file);
  for (const word of ["head", "hair"] as const) {
    const mask = await reader.region({ image: bytes, name: word, absentIsAnswer: true });
    const { box, pixels } = extentOf(mask);
    rows.push({ file, word, box, pixels });
    say(`  ${file.split("/").pop()}  ${word.padEnd(5)} ${box === null ? "ABSENT — no box at all" : `box ${box.width}x${box.height} at ${box.left},${box.top}  ${pixels}px`}`);
  }
}

writeFileSync("output/framing-court/armH-bald.json", JSON.stringify(rows, null, 2), "utf8");
writeFileSync("output/framing-court/armH-bald.log", lines.join("\n"), "utf8");
say();
say("4 reads made. No render, no credit.");

/* And the last statement ends the process. */
process.exit(0);
