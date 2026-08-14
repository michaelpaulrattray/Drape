/**
 * THE SHIPPED SCAN, RUN ON THE FOUNDER'S OWN BESPECTACLED FRAME (fable-547 §3).
 *
 * The discriminating bench killed the first hypothesis: asked "eyes", the
 * segmenter answers on BOTH of his bespectacled frames (0.0942% and 0.1182%)
 * and on both bare-eyed controls. Label competition at the eye/glasses boundary
 * is not why his panel had no Eyes row.
 *
 * So the cause is downstream of the question, and this drives the SHIPPED scan
 * on his frame to find out where — reading its own instrumentation rather than
 * reasoning about it: what it asked, what came back per SIDE, whether the empty
 * anatomy re-ask fired, and what `whyFailed` says.
 *
 * ~14 segmenter calls, about seven cents of house money. Nothing written.
 *
 *   npx tsx scripts/drive-scan-on-specimen-disposable.mts
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { scanFace } from "../server/castingV2/faceScan";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is required");

const FILE = process.env.FRAME ?? "output/eyes-glasses/spec-1603.png";
const bytes = readFileSync(FILE);
const meta = await sharp(bytes).metadata();

/* One reader per frame, exactly as the service builds it. */
const reader = createFalRegionReader({ apiKey });

/* Every side answer, recorded as the scan asks for it — the field the eyes
   court needed and did not have, taken here at the source. */
const perSide: any[] = [];
const wrapped = {
  ...reader,
  region: async (input: any) => {
    const mask = await reader.region(input);
    return mask;
  },
  regionSides: async (input: any) => {
    const sides = await reader.regionSides!(input);
    if (sides === null) {
      perSide.push({ name: input.name, sides: null });
      return sides;
    }
    const on = (mask: any) => {
      let count = 0;
      for (let at = 0; at < mask.data.length; at += 1) if (mask.data[at] !== 0) count += 1;
      return Number(((count / (mask.width * mask.height)) * 100).toFixed(4));
    };
    perSide.push({ name: input.name, left: on(sides.left), right: on(sides.right) });
    return sides;
  },
} as never;

console.log(`scanning ${FILE} (${meta.width}×${meta.height})`);
const scan = await scanFace({
  frame: { bytes, width: meta.width!, height: meta.height! },
  reader: wrapped,
  describe: null,
});

console.log("");
console.log("asked   ", scan.asked);
console.log("found   ", scan.found, "→", Array.from(scan.boxes.keys()).join(", "));
console.log("empty   ", scan.empty.join(", ") || "(none)");
console.log("failed  ", scan.failed.map((one) => `${one.question}: ${one.why}`).join(" | ") || "(none)");
console.log("");
console.log("PER SIDE, as the scan asked:");
for (const row of perSide) {
  console.log(`  ${String(row.name).padEnd(12)} left ${row.left ?? "—"}%  right ${row.right ?? "—"}%`);
}

writeFileSync("output/eyes-glasses/scan.json", `${JSON.stringify({
  file: FILE,
  asked: scan.asked,
  found: scan.found,
  slots: Array.from(scan.boxes.keys()),
  empty: scan.empty,
  failed: scan.failed,
  perSide,
}, null, 2)}\n`);
process.exit(0);
