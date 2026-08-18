/**
 * THE EYES SPECIMEN — the measured negative his four accepted crops do not have.
 *
 * Ordered fable-850 §4 (authorized house money), unchanged by fable-851 §3.
 *
 * The founder settled the POSITIVE by eye on 2026-08-17: crops 3/4/5/6 of the
 * specimen sheet are a complete picture of an eye (fable-843 §1). All four
 * already carry a measurement — `refusedCoverage` 10000 bp = **100.00%** — taken
 * by the area instrument at mint time, so the positive costs nothing to know.
 *
 * **What the family lacks is a negative**, and without one the bar has no known
 * noise floor: horns has its 83.7% mis-cut and that is where its eleven points
 * of margin come from. So this does for eyes exactly what
 * `calibrate-horns-specimen-disposable.mts` did for horns — takes a crop the
 * founder called complete, removes a third of it, and re-measures it through
 * the SAME independent region read.
 *
 * The mis-cut direction is chosen for what an eye actually loses: the OUTER
 * third along the crop's long axis, which is the corner every upswept ask is
 * about. A vertically-beheaded eye is not a failure mode this product produces.
 *
 * COST: real segmenter calls on a real frame, quoted to the cent in the report.
 * No render, no credit.
 *
 *   npx tsx scripts/calibrate-eyes-specimen-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { measureCoverage } from "../server/castingV2/referenceCompleteness";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mjs";
import { assertOneWorld } from "./lib/worldGuard.mjs";

const OUT = "output/eyes-specimen";
mkdirSync(OUT, { recursive: true });
if (!process.env.FAL_KEY) throw new Error("FAL_KEY is required");

/** The frame one of his accepted crops was cut from — v#74359d57, whose
 *  eye@right (59×31) is sheet crop 6 and whose eye@left (56×33) is crop 5. */
const VARIANT = process.env.VARIANT ?? "74359d57";
/**
 * THE PRODUCTION BUCKET, NAMED — and deliberately NOT `process.env.R2_PUBLIC_URL`.
 *
 * These crops are his, in production. `railway run --service MySQL` injects the
 * DATABASE variables only, so `R2_PUBLIC_URL` would still resolve from the local
 * `.env` — the DEV bucket — and this script would fetch a 404 or, worse, a
 * different world's frame under a production row's key. That is a recorded trap
 * (`railway-run-injects-db-only`), so the bucket is named rather than inherited.
 */
const BUCKET = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const url = resolveDatabaseUrl();
if (!url) throw new Error("no database URL");
const db = await openDatabase(url);
const [row] = await (async () => {
  const [rows] = await db.query<any[]>(
    "SELECT publicId, imageKey FROM casting_candidate_variants WHERE publicId LIKE ? LIMIT 1",
    [`${VARIANT}%`],
  );
  return rows as any[];
})();
await db.end();
if (!row?.imageKey) throw new Error(`no variant matching ${VARIANT} in ${worldOf(url)}`);
console.log(`world  ${worldOf(url)}`);
console.log(`frame  ${row.publicId} · ${row.imageKey}`);

const response = await fetch(`${BUCKET}/${row.imageKey}`);
if (!response.ok) throw new Error(`frame fetch failed: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const meta = await sharp(bytes).metadata();
const width = meta.width!;
const height = meta.height!;
console.log(`       ${width}×${height}, ${bytes.length} bytes`);

const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

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

const cutOf = (mask: Mask, box: { x: number; y: number; width: number; height: number }) => {
  const data = Buffer.alloc(box.width * box.height);
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      data[y * box.width + x] = mask.data[(box.y + y) * mask.width + (box.x + x)]! > 127 ? 255 : 0;
    }
  }
  return { mask: { data, width: box.width, height: box.height }, box };
};

/** The same crop with its OUTER third gone — an eye's own mis-cut, along the
 *  long axis, taking the corner every upswept ask is about. */
const cornerless = (cut: ReturnType<typeof cutOf>, side: "left" | "right") => {
  const third = Math.floor(cut.box.width / 3);
  const data = Buffer.from(cut.mask.data);
  /* Her LEFT eye sits on the image's right, so its outer corner is the crop's
     RIGHT edge, and vice versa. The side decides which third goes. */
  const fromX = side === "left" ? cut.box.width - third : 0;
  for (let y = 0; y < cut.box.height; y += 1) {
    for (let x = fromX; x < fromX + third; x += 1) data[y * cut.box.width + x] = 0;
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
    .resize({ width: cut.box.width * 6, kernel: "nearest" })
    .png().toFile(file);
}

/* THE CUT'S OWN READ, then the guard's INDEPENDENT one — two reads, because a
   crop scored against the mask it was cut from is a tautology. */
const NOUN = process.env.NOUN ?? "eye";
const sides = await reader.regionSides!({ image: bytes, name: NOUN, absentIsAnswer: true });
console.log(`  read "${NOUN}" → ${sides === null ? "NULL (the reader answered nothing)" : `left ${sides.left ? "mask" : "null"} · right ${sides.right ? "mask" : "null"}`}`);
if (!sides) throw new Error(`the reader has no sides for ${NOUN}`);
/*
  THE SAME NOUN ON BOTH READS, and the first run of this script proved why it
  has to be said out loud: `name: "eye"` returns NULL from this reader while
  `name: "eyes"` answers. The slot catalogue's `noun` is `eye` with
  `pairNoun: "eyes"`, so a caller reaching for the singular gets nothing — and a
  guard read that silently answers nothing would have made the negative
  unmeasurable while looking like a code bug. Both reads take NOUN.
*/
const guard = await reader.regionSides!({ image: bytes, name: NOUN, absentIsAnswer: true });
console.log(`  guard "${NOUN}" → ${guard === null ? "NULL" : `left ${guard.left ? "mask" : "null"} · right ${guard.right ? "mask" : "null"}`}`);
if (!guard) throw new Error(`the guard read has no sides for ${NOUN}`);

const rows: any[] = [];
for (const side of ["left", "right"] as const) {
  const cutSide = sides[side] as Mask | null;
  const guardSide = guard[side] as Mask | null;
  if (!cutSide || !guardSide) { console.log(`${side}: no mask`); continue; }
  const cutMask = await at(cutSide);
  const guardMask = await at(guardSide);
  const box = boxOf(cutMask);
  if (!box) { console.log(`${side}: nothing cut`); continue; }
  const cut = cutOf(cutMask, box);
  const complete = measureCoverage(cut, guardMask);
  const partial = measureCoverage(cornerless(cut, side), guardMask);
  await paint(cut, `${OUT}/${side}-complete.png`);
  await paint(cornerless(cut, side), `${OUT}/${side}-incomplete.png`);
  console.log(`${side}: ${box.width}×${box.height} · complete ${(complete.coverage * 100).toFixed(1)}%`
    + ` (spill ${(complete.spill * 100).toFixed(1)}%) · outer-third-gone ${(partial.coverage * 100).toFixed(1)}%`);
  rows.push({ side, box, complete: complete.coverage, partial: partial.coverage });
}

writeFileSync(`${OUT}/readings.json`, `${JSON.stringify(rows, null, 2)}\n`);
console.log("");
console.log(`LOOK AT BOTH PICTURES BEFORE EITHER NUMBER IS USED — ${OUT}/`);
process.exit(0);
