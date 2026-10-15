/**
 * #801 — THE OTHER HALF OF HIS WORD: "everything has to work with the image
 * analyzer which finds and boxs features right."
 *
 * Runs the product's own face scan (`scanFace`, the same reader the panel
 * uses) over the master and over named frames of the chains, and prints what
 * it found, what it boxed and what it could not read. The question is not
 * whether the reader is good; it is whether its rows FOLLOW AN EDIT — an added
 * feature appears, a removed one goes, a changed one keeps its box — and
 * whether it still reads a creature.
 *
 * Spend: a scan is 20-some segmenter calls, about a dime (`faceScanUsd`).
 * Named frames only, never the whole grid.
 *
 *   npx tsx scripts/_801-reader-disposable.mts fisherman master,A-4,A-6
 */
process.env.CASTING_V2_SCOPE = "all";
process.env.CASTING_FACE_SCAN_SCOPE = "all";
process.env.CASTING_SCAN_TABLE_SCOPE = "all";

import "dotenv/config";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import sharpLib from "sharp";

import { assertOneWorld } from "./lib/worldGuard.mts";
import { faceScanUsd } from "./lib/falSpend.mts";
import { scanFace } from "../server/castingV2/faceScan";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";

assertOneWorld(["DATABASE_URL"]);
if (!process.env.FAL_KEY) throw new Error("FAL_KEY is required");

const fixture = process.argv[2] ?? "fisherman";
const names = (process.argv[3] ?? "master").split(",").filter(Boolean);
const OUT = "output/801/reader";
mkdirSync(OUT, { recursive: true });

console.log(`a scan costs about $${faceScanUsd().total.low.toFixed(3)}–${faceScanUsd().total.high.toFixed(3)};`
  + ` ${names.length} scans on ${fixture}`);

const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY });
/* MERGED, never overwritten: a second run of one frame used to erase the
   other four readings this file was the only record of (law 1 — the artifact
   is the fact, and a report that cites a reading nothing holds is prose). */
const out: Record<string, unknown> = existsSync(`${OUT}/${fixture}.json`)
  ? JSON.parse(readFileSync(`${OUT}/${fixture}.json`, "utf8"))
  : {};

for (const name of names) {
  const path = `output/801/frames/${fixture}/${name}.png`;
  if (!existsSync(path)) { console.log(`absent ${path}`); continue; }
  const bytes = readFileSync(path);
  const meta = await sharpLib(bytes).metadata();
  const started = Date.now();
  const scan = await scanFace({
    frame: { bytes, width: meta.width!, height: meta.height! },
    reader,
    /* No describer: the words read is a separate paid call and this court is
       about the BOXES — what the analyzer finds and where. */
    describe: null,
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  const boxes = [...scan.boxes.entries()].map(([slot, box]) => ({
    slot, x: box.x, y: box.y, w: box.width, h: box.height,
  }));
  out[name] = {
    asked: scan.asked,
    found: scan.found,
    seconds: Number(seconds),
    boxes,
    empty: scan.empty,
    failed: scan.failed,
  };
  console.log(`\n${name}: asked ${scan.asked}, found ${scan.found}, ${seconds}s`);
  console.log(`  boxed: ${boxes.map((b) => b.slot).sort().join(", ") || "(none)"}`);
  if (scan.empty.length) console.log(`  empty: ${scan.empty.join(" | ")}`);
  if (scan.failed.length) console.log(`  failed: ${scan.failed.map((f) => `${f.question}: ${f.why}`).join(" | ")}`);
}

writeFileSync(`${OUT}/${fixture}.json`, JSON.stringify(out, null, 1));
console.log(`\n${OUT}/${fixture}.json`);
process.exit(0);
