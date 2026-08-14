/**
 * WHY HER EYES ROW IS MISSING ON A BESPECTACLED FACE (founder specimen,
 * fable-547).
 *
 * A single face, no burst, every other row read and described — so the 429
 * class that was fixed and proven is not this. The hypothesis, stated for
 * killing: **label competition at the eye/glasses boundary** — the lips/teeth
 * lesson one feature over. On a face in heavy frames, "eyes" may answer nothing,
 * or answer the LENSES, because the glasses own that part of the picture.
 *
 * # What is measured, and why WHERE matters as much as HOW MUCH
 *
 * A coverage percentage cannot tell an iris from a lens: a mask that lands on
 * the frames is a confident wrong answer with a healthy number. So every
 * reading records the mask's box and its centre as a fraction of the face's own
 * span, beside the number — silhouette-is-not-material, applied to a boundary
 * rather than to an outline.
 *
 * # The bar, written before the first call
 *
 * ```
 * INCUMBENT   "eyes" on bespectacled frames vs bare-eyed ones. If it answers
 *             both, the hypothesis is dead and the cause is elsewhere.
 * CANDIDATES  measured beside it on the same frames, same reader, same call
 *             shape. A rephrasing wins only by finding eyes on EVERY frame
 *             including the bespectacled ones; a tie keeps the incumbent
 *             (the lips precedent).
 * ```
 *
 * House money: one segmenter call per frame per phrasing, about a cent each.
 * No user credits, no renders, nothing written anywhere.
 *
 *   npx tsx scripts/bench-eyes-glasses-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { binaryCoverage } from "../server/castingV2/maskGeometry";

const OUT = "output/eyes-glasses";
mkdirSync(OUT, { recursive: true });
const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is required");

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };

/** The incumbent first, so its column is the one every candidate is read against. */
const PHRASINGS = ["eyes", "her eyes", "the eyes behind the glasses", "eyeball"];

const FRAMES: { name: string; file: string; glasses: boolean }[] = [
  { name: "spec-1603", file: `${OUT}/spec-1603.png`, glasses: true },
  { name: "spec-1595", file: `${OUT}/spec-1595.png`, glasses: true },
  { name: "bare-1625", file: "output/horns-court/master.png", glasses: false },
  { name: "bare-beard", file: "output/beard-court/candidate.png", glasses: false },
];

const reader = createFalRegionReader({ apiKey });
let calls = 0;

/** Where a mask lands, as a fraction of the frame — a number that can tell an
 *  iris from a pair of frames when read beside the face's own proportions. */
function landing(mask: { data: Buffer; width: number; height: number }) {
  let minX = mask.width, maxX = -1, minY = mask.height, maxY = -1, on = 0;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x]! === 0) continue;
      on += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (on === 0) return null;
  return {
    box: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    topFraction: Number((minY / mask.height).toFixed(3)),
    heightFraction: Number(((maxY - minY + 1) / mask.height).toFixed(3)),
    widthFraction: Number(((maxX - minX + 1) / mask.width).toFixed(3)),
  };
}

const results: any[] = [];
for (const frame of FRAMES) {
  const bytes = readFileSync(frame.file);
  const meta = await sharp(bytes).metadata();
  say("");
  say("=".repeat(78));
  say(`${frame.name}  (${frame.glasses ? "GLASSES" : "bare-eyed"})  ${meta.width}×${meta.height}`);
  say("-".repeat(78));
  for (const phrasing of PHRASINGS) {
    let reading: any = { phrasing, frame: frame.name, glasses: frame.glasses };
    try {
      const mask = await reader.region({ image: bytes, name: phrasing, absentIsAnswer: true });
      calls += 1;
      const coverage = binaryCoverage(mask);
      const where = landing(mask as never);
      reading = { ...reading, coverage: Number((coverage * 100).toFixed(4)), where };
      say(`  ${phrasing.padEnd(28)} ${(coverage * 100).toFixed(4)}%`
        + (where
          ? `  box ${where.box.width}×${where.box.height} at y=${where.box.y}`
            + ` · top ${(where.topFraction * 100).toFixed(1)}% of frame · tall ${(where.heightFraction * 100).toFixed(1)}%`
          : "  (nothing)"));
    } catch (error) {
      reading = { ...reading, error: error instanceof Error ? error.message : String(error) };
      say(`  ${phrasing.padEnd(28)} FAILED — ${reading.error}`.slice(0, 110));
    }
    results.push(reading);
  }
}

say("");
say("=".repeat(78));
say("FINDS-WHEN-PRESENT, per phrasing (every frame here has eyes)");
for (const phrasing of PHRASINGS) {
  const mine = results.filter((row) => row.phrasing === phrasing);
  const found = mine.filter((row) => (row.coverage ?? 0) > 0);
  const onGlasses = mine.filter((row) => row.glasses && (row.coverage ?? 0) > 0);
  say(`  ${phrasing.padEnd(28)} ${found.length}/${mine.length} overall · ${onGlasses.length}/${mine.filter((r) => r.glasses).length} bespectacled`);
}
say("=".repeat(78));
say(`SPEND: ${calls} segmenter calls ≈ $${(calls * 0.005).toFixed(2)} of house money`);

writeFileSync(`${OUT}/bench.txt`, `${lines.join("\n")}\n`);
writeFileSync(`${OUT}/bench.json`, `${JSON.stringify(results, null, 2)}\n`);
process.exit(0);
