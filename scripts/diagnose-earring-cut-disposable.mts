/**
 * WHY THE HOOP'S CROP IS MISSING AN ARC — three candidates, and the instrument
 * has to be able to tell them apart before any of them is named.
 *
 * The finding (opus-163, ratified fable-220): on the founder's own paid dev
 * render the earring crops read **65.2%** (left) and **54.0%** (right) against
 * the guard's independent read, and the pictures agree — crescents of metal
 * with an arc missing. Fable named it *a cutter question, not a bar question:
 * the delivered-anchored cut loses the thin extremities of a ring.*
 *
 * That is a hypothesis with three candidate mechanisms, and they are not
 * distinguishable from the row:
 *
 *   (a) APPLIED clipped it     the cut is `applied ∩ (delivered ∪ master)`, and
 *                              a hoop hanging past the region the paint was
 *                              allowed into would be truncated by `applied`.
 *   (b) THE REGION was thin    the harvest's own read of the hoop found less of
 *                              it than the guard's later read did.
 *   (c) THE READER disagrees   two calls, same frame, same question, different
 *                              masks. SAM3 is stochastic; nobody has measured
 *                              how stochastic on a 25×32 px hoop.
 *
 * **(c) is not a mechanism, it is a NOISE FLOOR, and it has to be bought
 * first.** If two reads of the same hoop differ by a third, then 65.2% is a
 * number about the reader and the cutter has not been shown to lose anything at
 * all. This campaign has already withdrawn one verdict for exactly this
 * (the specular measure, whose noise exceeded the range it was asked to divide)
 * and the rule from it is [[measure-the-delta-before-the-verdict]].
 *
 * So this script does the cheap decisive thing and nothing else:
 *
 *   1. reads the two refused rows out of the DEV database (free)
 *   2. downloads the delivered frame and the two stored crop masks (free)
 *   3. re-reads `earring` per side on that frame **three times** (three vision
 *      calls — provider dollars, no credits, no render bought)
 *   4. scores the STORED crop against each read, and each read against the
 *      others, and writes the difference pictures
 *
 * Then the numbers say which candidate is live:
 *
 *   read-to-read agreement HIGH and crop coverage LOW    → the cut really does
 *                                                          lose ground: (a)/(b)
 *   read-to-read agreement as LOW as the coverage        → (c). The finding is
 *                                                          the instrument's.
 *
 * And the difference pictures say WHERE, which is the only thing that separates
 * (a) from (b): a straight edge is `applied`; a ragged thin arc is the region.
 *
 *   FAL_KEY=… npx tsx scripts/diagnose-earring-cut-disposable.mts
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import sharp from "sharp";

import { fetchImageBytes } from "./lib/imageBytes.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import type { Mask } from "../server/castingV2/maskedComposite";

const OUT = path.resolve("output/earring-cut-diagnosis");
const READS = 3;

/* THE DEV WORLD, DELIBERATELY, and the port is printed rather than assumed:
   `.env` is 52008 and production is 23768 behind the same hostname and the same
   database name. These rows are dev's. */
const uri = process.env.DATABASE_URL!;
const port = new URL(uri).port;
if (port !== "52008") {
  throw new Error(`DATABASE_URL is port ${port}; these rows are the DEV database's (52008). Refusing to guess.`);
}
const bucket = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
if (!bucket) throw new Error("R2_PUBLIC_URL is required — the frames and crops are in the dev bucket");

type Row = {
  id: number;
  slot: string;
  refusedCoverage: number;
  refusedBboxX: number; refusedBboxY: number; refusedBboxW: number; refusedBboxH: number;
  refusedFrameWidth: number; refusedFrameHeight: number;
  refusedContentKey: string; refusedMaskKey: string;
  variantKey: string | null;
};

/** A full-frame mask with the stored crop-local mask placed back at its box. */
function placeOnFrame(cropMask: Buffer, row: Row): Mask {
  const data = Buffer.alloc(row.refusedFrameWidth * row.refusedFrameHeight, 0);
  for (let y = 0; y < row.refusedBboxH; y += 1) {
    for (let x = 0; x < row.refusedBboxW; x += 1) {
      if (cropMask[y * row.refusedBboxW + x]! === 0) continue;
      data[(row.refusedBboxY + y) * row.refusedFrameWidth + (row.refusedBboxX + x)] = 255;
    }
  }
  return { data, width: row.refusedFrameWidth, height: row.refusedFrameHeight };
}

function count(mask: Mask): number {
  let lit = 0;
  for (const byte of mask.data) if (byte > 0) lit += 1;
  return lit;
}

/** `|a ∩ b| / |b|` — how much of B is inside A. The guard's own arithmetic. */
function coverageOf(a: Mask, b: Mask): number {
  let intersect = 0;
  let bPixels = 0;
  for (let index = 0; index < b.data.length; index += 1) {
    const inB = b.data[index]! > 0;
    if (!inB) continue;
    bPixels += 1;
    if (a.data[index]! > 0) intersect += 1;
  }
  return bPixels === 0 ? 0 : intersect / bPixels;
}

/** Intersection over union — the read-to-read agreement number. */
function iou(a: Mask, b: Mask): number {
  let both = 0;
  let either = 0;
  for (let index = 0; index < a.data.length; index += 1) {
    const inA = a.data[index]! > 0;
    const inB = b.data[index]! > 0;
    if (inA && inB) both += 1;
    if (inA || inB) either += 1;
  }
  return either === 0 ? 0 : both / either;
}

/**
 * The difference picture: the frame dimmed, the crop's mask in white, what a
 * read found and the crop does not hold in RED.
 *
 * A straight red edge is `applied`. A ragged red arc following the hoop is the
 * region read. Nobody can tell those two apart from a percentage.
 */
async function differencePicture(
  frame: Buffer,
  crop: Mask,
  read: Mask,
  width: number,
  height: number,
): Promise<Buffer> {
  const overlay = Buffer.alloc(width * height * 4, 0);
  for (let index = 0; index < width * height; index += 1) {
    const inCrop = crop.data[index]! > 0;
    const inRead = read.data[index]! > 0;
    if (!inCrop && !inRead) continue;
    if (inCrop) {
      overlay[index * 4] = 255; overlay[index * 4 + 1] = 255; overlay[index * 4 + 2] = 255;
    } else {
      overlay[index * 4] = 255; overlay[index * 4 + 1] = 45; overlay[index * 4 + 2] = 85;
    }
    overlay[index * 4 + 3] = 255;
  }
  return sharp(frame)
    .modulate({ brightness: 0.35 })
    .composite([{ input: overlay, raw: { width, height, channels: 4 } }])
    .png()
    .toBuffer();
}

await mkdir(OUT, { recursive: true });
const connection = await mysql.createConnection({ uri, timezone: "Z" });
const [rows] = await connection.query<any[]>(`
  SELECT l.id, l.slot, l.refusedCoverage,
         l.refusedBboxX, l.refusedBboxY, l.refusedBboxW, l.refusedBboxH,
         l.refusedFrameWidth, l.refusedFrameHeight,
         l.refusedContentKey, l.refusedMaskKey,
         v.imageKey AS variantKey
    FROM casting_reference_library l
    LEFT JOIN casting_candidate_variants v ON v.id = l.variantId
   WHERE l.refusedContentKey IS NOT NULL
   ORDER BY l.id`);
await connection.end();

console.log(`dev database :${port} — ${rows.length} refused rows with pixels\n`);
if (rows.length === 0) throw new Error("no refused crops in the dev library — nothing to diagnose");

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is required — the noise floor is bought from the same reader the guard uses");
const reader = createFalRegionReader({ apiKey });

for (const row of rows as Row[]) {
  if (!row.variantKey) {
    console.log(`${row.slot}: no variant frame key — skipped`);
    continue;
  }
  const side = row.slot.includes("@") ? row.slot.split("@")[1]! as "left" | "right" : null;
  const question = row.slot.split("@")[0]!;

  const frame = await fetchImageBytes(`${bucket}/${row.variantKey}`);
  const meta = await sharp(frame.bytes).metadata();
  if (meta.width !== row.refusedFrameWidth || meta.height !== row.refusedFrameHeight) {
    console.log(`${row.slot}: FRAME MISMATCH ${meta.width}x${meta.height} vs row ${row.refusedFrameWidth}x${row.refusedFrameHeight} — skipped`);
    continue;
  }

  const storedMaskBytes = await fetchImageBytes(`${bucket}/${row.refusedMaskKey}`);
  const raw = await sharp(storedMaskBytes.bytes).greyscale().raw().toBuffer();
  const crop = placeOnFrame(raw, row);

  /* THE THREE READS. Same frame, same question, same side — the only thing
     varying is the call. */
  const reads: Mask[] = [];
  for (let attempt = 0; attempt < READS; attempt += 1) {
    const answer = side
      ? (await reader.regionSides?.({ image: frame.bytes, name: question, absentIsAnswer: true }))?.[side] ?? null
      : await reader.region({ image: frame.bytes, name: question, absentIsAnswer: true });
    if (!answer) {
      console.log(`${row.slot}: read ${attempt + 1} did not settle`);
      continue;
    }
    reads.push(answer);
  }
  if (reads.length === 0) {
    console.log(`${row.slot}: no read settled — nothing measured, and that is a NO-READ rather than a zero`);
    continue;
  }

  console.log(`\n=== ${row.slot}  (row #${row.id}, stored coverage ${(row.refusedCoverage / 100).toFixed(1)}%)`);
  console.log(`    crop holds ${count(crop)} px in a ${row.refusedBboxW}x${row.refusedBboxH} box`);
  for (const [index, read] of reads.entries()) {
    console.log(
      `    read ${index + 1}: region ${String(count(read)).padStart(6)} px`
      + `   crop covers ${(coverageOf(crop, read) * 100).toFixed(1)}%`
      + `   crop spills ${((1 - coverageOf(read, crop)) * 100).toFixed(1)}%`,
    );
  }
  /* THE NOISE FLOOR. Every pair of reads, so a single lucky agreement cannot
     stand in for the spread. */
  for (let a = 0; a < reads.length; a += 1) {
    for (let b = a + 1; b < reads.length; b += 1) {
      console.log(`    read ${a + 1} vs read ${b + 1}: IoU ${(iou(reads[a]!, reads[b]!) * 100).toFixed(1)}%`
        + `   sizes ${count(reads[a]!)} / ${count(reads[b]!)}`);
    }
  }

  const stem = path.join(OUT, `${row.slot.replace(/[^a-z0-9]+/gi, "-")}`);
  for (const [index, read] of reads.entries()) {
    await writeFile(
      `${stem}-read${index + 1}-diff.png`,
      await differencePicture(frame.bytes, crop, read, meta.width!, meta.height!),
    );
  }
  console.log(`    difference pictures: ${stem}-read*-diff.png  (white = the crop, red = read-but-not-cropped)`);
}
