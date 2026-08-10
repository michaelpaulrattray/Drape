/**
 * WHICH TERM OF THE CUT DROPPED THE ARC — settled by set arithmetic, with a
 * control that can fail.
 *
 * Stage 1 (`diagnose-earring-cut-disposable.mts`) killed the noise-floor
 * candidate: three reads of each hoop came back **byte-identical** (IoU 100.0%,
 * 273/273 and 274/274 px) and reproduced the stored coverages to the decimal.
 * The reader is deterministic on these frames, so today's read of the delivered
 * frame IS the read the harvest made on the day, and the 65.2%/54.0% are real.
 *
 * The cut is
 *
 *   crop = applied ∩ ( region(delivered) ∪ region(master) )
 *
 * and `applied` is the one term that is not stored anywhere. But it does not
 * need to be: every term is a SET, so the missing pixels can be attributed by
 * elimination.
 *
 *   delivered \ crop , inside (delivered ∪ master)   → `applied` excluded them.
 *                                                      There is no other term
 *                                                      that could have.
 *   crop \ (delivered ∪ master)                      → **MUST BE EMPTY.** This
 *                                                      is the control: the cut
 *                                                      cannot own ground
 *                                                      neither read granted. If
 *                                                      it is not empty, my model
 *                                                      of the cut is wrong and
 *                                                      every attribution above
 *                                                      it means nothing.
 *
 * That control is the point of the script. A diagnosis by elimination is only
 * as good as the model doing the eliminating, and this one can be caught.
 *
 * Costs FOUR SAM3 reads (the master, per side; the delivered reads are stage
 * 1's, re-bought because they are cheap and determinism has been shown). No
 * credits, no render, nothing written to any database.
 *
 *   FAL_KEY=… npx tsx scripts/diagnose-earring-cut-2-disposable.mts
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
const PAD = 14;
const ZOOM = 12;

const uri = process.env.DATABASE_URL!;
const port = new URL(uri).port;
if (port !== "52008") throw new Error(`DATABASE_URL is port ${port}; these rows are DEV's (52008)`);
const bucket = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
const apiKey = process.env.FAL_KEY;
if (!bucket || !apiKey) throw new Error("R2_PUBLIC_URL and FAL_KEY are both required");

type Row = {
  id: number; slot: string;
  refusedBboxX: number; refusedBboxY: number; refusedBboxW: number; refusedBboxH: number;
  refusedFrameWidth: number; refusedFrameHeight: number;
  refusedMaskKey: string; variantKey: string | null; masterKey: string | null;
};

const empty = (width: number, height: number): Mask =>
  ({ data: Buffer.alloc(width * height, 0), width, height });

function placeOnFrame(cropMask: Buffer, row: Row): Mask {
  const mask = empty(row.refusedFrameWidth, row.refusedFrameHeight);
  for (let y = 0; y < row.refusedBboxH; y += 1) {
    for (let x = 0; x < row.refusedBboxW; x += 1) {
      if (cropMask[y * row.refusedBboxW + x]! === 0) continue;
      mask.data[(row.refusedBboxY + y) * row.refusedFrameWidth + (row.refusedBboxX + x)] = 255;
    }
  }
  return mask;
}

const lit = (mask: Mask | null) => {
  if (!mask) return 0;
  let total = 0;
  for (const byte of mask.data) if (byte > 0) total += 1;
  return total;
};

/** How many pixels satisfy the predicate over the frame. */
function countWhere(size: number, predicate: (index: number) => boolean): number {
  let total = 0;
  for (let index = 0; index < size; index += 1) if (predicate(index)) total += 1;
  return total;
}

await mkdir(OUT, { recursive: true });
const connection = await mysql.createConnection({ uri, timezone: "Z" });
const [rows] = await connection.query<any[]>(`
  SELECT l.id, l.slot,
         l.refusedBboxX, l.refusedBboxY, l.refusedBboxW, l.refusedBboxH,
         l.refusedFrameWidth, l.refusedFrameHeight, l.refusedMaskKey,
         v.imageKey AS variantKey, c.imageKey AS masterKey
    FROM casting_reference_library l
    LEFT JOIN casting_candidate_variants v ON v.id = l.variantId
    LEFT JOIN casting_candidates c ON c.id = l.candidateId
   WHERE l.refusedContentKey IS NOT NULL
   ORDER BY l.id`);
await connection.end();

const reader = createFalRegionReader({ apiKey });
let controlFailures = 0;

for (const row of rows as Row[]) {
  if (!row.variantKey || !row.masterKey) continue;
  const side = row.slot.split("@")[1] as "left" | "right" | undefined;
  const question = row.slot.split("@")[0]!;
  const size = row.refusedFrameWidth * row.refusedFrameHeight;

  const delivered = await fetchImageBytes(`${bucket}/${row.variantKey}`);
  const master = await fetchImageBytes(`${bucket}/${row.masterKey}`);
  const masterMeta = await sharp(master.bytes).metadata();

  const crop = placeOnFrame(
    await sharp((await fetchImageBytes(`${bucket}/${row.refusedMaskKey}`)).bytes).greyscale().raw().toBuffer(),
    row,
  );

  const readSide = async (image: Buffer): Promise<Mask | null> => (side
    ? (await reader.regionSides?.({ image, name: question, absentIsAnswer: true }))?.[side] ?? null
    : reader.region({ image, name: question, absentIsAnswer: true }));

  const deliveredRead = await readSide(delivered.bytes);
  /* THE MASTER IS ONLY COMPARABLE IF IT IS THE SAME SIZE. A read off a frame of
     another size cannot be unioned pixel-for-pixel, and doing it anyway is the
     wrong-boundary class with a plausible number at the end of it. */
  const sameFrame = masterMeta.width === row.refusedFrameWidth && masterMeta.height === row.refusedFrameHeight;
  const masterRead = sameFrame ? await readSide(master.bytes) : null;

  const inCrop = (index: number) => crop.data[index]! > 0;
  const inDelivered = (index: number) => (deliveredRead?.data[index] ?? 0) > 0;
  const inMaster = (index: number) => (masterRead?.data[index] ?? 0) > 0;
  const inGround = (index: number) => inDelivered(index) || inMaster(index);

  console.log(`\n=== ${row.slot}  (row #${row.id})`);
  console.log(`    master frame ${masterMeta.width}x${masterMeta.height}`
    + `${sameFrame ? "" : "  — DIFFERENT SIZE, master term omitted and said so"}`);
  console.log(`    crop            ${String(lit(crop)).padStart(5)} px`);
  console.log(`    read(delivered) ${String(lit(deliveredRead)).padStart(5)} px`);
  console.log(`    read(master)    ${String(lit(masterRead)).padStart(5)} px${masterRead ? "" : "   (no read)"}`);

  const lostFromGround = countWhere(size, (index) => inGround(index) && !inCrop(index));
  const lostFromDelivered = countWhere(size, (index) => inDelivered(index) && !inCrop(index));
  const outsideGround = countWhere(size, (index) => inCrop(index) && !inGround(index));

  console.log(`    ground \\ crop   ${String(lostFromGround).padStart(5)} px   ← only \`applied\` can have removed these`);
  console.log(`    delivered \\ crop${String(lostFromDelivered).padStart(5)} px`);
  console.log(`    CONTROL crop \\ ground ${String(outsideGround).padStart(5)} px   ← must be 0`);
  if (outsideGround > 0) {
    controlFailures += 1;
    console.log("    *** CONTROL FAILED — the crop owns ground neither read granted, so the");
    console.log("    *** model above is wrong and its attribution means nothing.");
  }

  /* FOUR COLOURS, because three sets over one hoop cannot be read in two. */
  const overlay = Buffer.alloc(size * 4, 0);
  for (let index = 0; index < size; index += 1) {
    let colour: [number, number, number] | null = null;
    if (inCrop(index) && !inGround(index)) colour = [255, 214, 0];      /* control: must not appear */
    else if (inCrop(index)) colour = [255, 255, 255];                    /* kept */
    else if (inDelivered(index)) colour = [255, 45, 85];                 /* lost, and it was THERE */
    else if (inMaster(index)) colour = [0, 160, 255];                    /* lost, master-only ground */
    if (!colour) continue;
    overlay[index * 4] = colour[0];
    overlay[index * 4 + 1] = colour[1];
    overlay[index * 4 + 2] = colour[2];
    overlay[index * 4 + 3] = 255;
  }
  const composed = await sharp(delivered.bytes)
    .modulate({ brightness: 0.35 })
    .composite([{ input: overlay, raw: { width: row.refusedFrameWidth, height: row.refusedFrameHeight, channels: 4 } }])
    .png()
    .toBuffer();

  const left = Math.max(0, row.refusedBboxX - PAD);
  const top = Math.max(0, row.refusedBboxY - PAD);
  const width = Math.min(row.refusedFrameWidth - left, row.refusedBboxW + PAD * 2);
  const height = Math.min(row.refusedFrameHeight - top, row.refusedBboxH + PAD * 2);
  const stem = path.join(OUT, `terms-${row.slot.replace(/[^a-z0-9]+/gi, "-")}`);
  await writeFile(`${stem}.png`, composed);
  await writeFile(
    `${stem}-x${ZOOM}.png`,
    await sharp(composed)
      .extract({ left, top, width, height })
      .resize({ width: width * ZOOM, height: height * ZOOM, kernel: "nearest" })
      .png()
      .toBuffer(),
  );
  console.log(`    ${stem}-x${ZOOM}.png   white=kept  red=lost(delivered)  blue=lost(master only)  yellow=CONTROL`);
}

console.log(controlFailures === 0
  ? "\ncontrol held on every row: no crop owns ground neither read granted."
  : `\n${controlFailures} CONTROL FAILURE(S) — the attribution above is withdrawn.`);
