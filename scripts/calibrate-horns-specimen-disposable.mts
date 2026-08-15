/**
 * THE HORNS SPECIMEN — the second, measured step the enrolment left owed.
 * (fable-566 §3, then §4's order: calibration before the court.)
 *
 * Horns now have a cutting region and a per-side slot, so the mint cuts them —
 * and every crop is refused `noSpecimen` and KEPT, because this kind has never
 * had a number for what a complete crop of it looks like. That refusal is the
 * road that produces one: cut, keep, LOOK, measure, calibrate.
 *
 * # What a specimen is here, exactly
 *
 * The guard re-reads the region on the crop's own frame — an INDEPENDENT second
 * read — and measures `|crop ∩ region| / |region|`. So a positive specimen is
 * not 100% by construction: two reads of one frame differ, and the number is
 * how much of the second read the first one's crop covers.
 *
 * ```
 * POSITIVE   a crop a person looked at and called complete — the whole horn,
 *            tip to hairline
 * NEGATIVE   one a person looked at and called incomplete — here, the horn with
 *            its top third cut off, which is what a mis-cut actually looks like
 * ```
 *
 * The label is the human verdict on the artifact; the number is the
 * instrument's reading of it. Both crops are written out to be LOOKED AT before
 * either number is used, because a specimen labelled by the ask that produced
 * it is the exact mistake this campaign has already paid for once.
 *
 * ~6 segmenter reads, about three cents. No generations.
 *
 *   npx tsx scripts/calibrate-horns-specimen-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { measureCoverage } from "../server/castingV2/referenceCompleteness";

const OUT = "output/horns-specimen";
mkdirSync(OUT, { recursive: true });
if (!process.env.FAL_KEY) throw new Error("FAL_KEY is required");
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

const FRAME = "output/horns-court/words-2.png";
const bytes = readFileSync(FRAME);
const meta = await sharp(bytes).metadata();
const width = meta.width!;
const height = meta.height!;

type Mask = { data: Buffer; width: number; height: number };

const at = async (mask: Mask): Promise<Mask> => (mask.width === width && mask.height === height
  ? mask
  : {
    data: await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
      .resize(width, height, { fit: "fill" }).toColourspace("b-w").raw().toBuffer(),
    width,
    height,
  });

const boxOf = (mask: Mask) => {
  let minX = mask.width, maxX = -1, minY = mask.height, maxY = -1;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x]! <= 127) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxY < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
};

/** The cut, as the mint makes it: the mask inside its own box. */
const cutOf = (mask: Mask, box: { x: number; y: number; width: number; height: number }) => {
  const data = Buffer.alloc(box.width * box.height);
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      data[y * box.width + x] = mask.data[(box.y + y) * mask.width + (box.x + x)]! > 127 ? 255 : 0;
    }
  }
  return { mask: { data, width: box.width, height: box.height }, box };
};

/** The same crop with its top third gone — what a mis-cut looks like. */
const beheaded = (cut: ReturnType<typeof cutOf>) => {
  const keepFrom = Math.floor(cut.box.height / 3);
  const data = Buffer.from(cut.mask.data);
  for (let y = 0; y < keepFrom; y += 1) {
    for (let x = 0; x < cut.box.width; x += 1) data[y * cut.box.width + x] = 0;
  }
  return { mask: { data, width: cut.box.width, height: cut.box.height }, box: cut.box };
};

async function paint(cut: ReturnType<typeof cutOf>, file: string) {
  const { data } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(cut.box.width * cut.box.height * 4);
  for (let y = 0; y < cut.box.height; y += 1) {
    for (let x = 0; x < cut.box.width; x += 1) {
      const from = ((cut.box.y + y) * width + (cut.box.x + x)) * 4;
      const to = (y * cut.box.width + x) * 4;
      const on = cut.mask.data[y * cut.box.width + x]! > 127;
      out[to] = on ? data[from]! : 255;
      out[to + 1] = on ? data[from + 1]! : 0;
      out[to + 2] = on ? data[from + 2]! : 255;
      out[to + 3] = 255;
    }
  }
  await sharp(out, { raw: { width: cut.box.width, height: cut.box.height, channels: 4 } })
    .png().toFile(file);
}

/* THE CUT'S OWN READ, then the guard's INDEPENDENT one. */
const sides = await reader.regionSides!({ image: bytes, name: "horns", absentIsAnswer: true });
if (!sides) throw new Error("the reader has no sides for horns");
const guard = await reader.regionSides!({ image: bytes, name: "horns", absentIsAnswer: true });
if (!guard) throw new Error("the guard read has no sides");

const rows: any[] = [];
for (const side of ["left", "right"] as const) {
  const cutMask = await at(sides[side] as Mask);
  const guardMask = await at(guard[side] as Mask);
  const box = boxOf(cutMask);
  if (!box) { console.log(`${side}: nothing cut`); continue; }
  const cut = cutOf(cutMask, box);
  const complete = measureCoverage(cut, guardMask);
  const partial = measureCoverage(beheaded(cut), guardMask);
  await paint(cut, `${OUT}/${side}-complete.png`);
  await paint(beheaded(cut), `${OUT}/${side}-incomplete.png`);
  console.log(`${side}: complete ${(complete.coverage * 100).toFixed(1)}% (spill ${(complete.spill * 100).toFixed(1)}%)`
    + ` · top-third-gone ${(partial.coverage * 100).toFixed(1)}%`);
  rows.push({ side, complete: complete.coverage, partial: partial.coverage, box });
}

writeFileSync(`${OUT}/readings.json`, `${JSON.stringify(rows, null, 2)}\n`);
console.log("");
console.log("LOOK AT BOTH PICTURES BEFORE EITHER NUMBER IS USED:");
console.log(`  ${OUT}/left-complete.png · ${OUT}/left-incomplete.png`);
console.log(`the bar would be the WORST complete reading: `
  + `${(Math.min(...rows.map((row) => row.complete)) * 100).toFixed(1)}%`);
process.exit(0);
