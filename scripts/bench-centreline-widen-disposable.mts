/**
 * WIDENING THE CENTRELINE BENCH (fable-226) — every real cutter output of an
 * earring this machine can reach, both failure modes, and a contact sheet so
 * the labels come from an eye.
 *
 * Specimens, all REAL output of the shipped cutter, none synthesized:
 *
 *   library rows #8/#9   the per-side crops of v#142's hoops (65.2% / 54.0%)
 *   segment rows 5/6     the WHOLE-FRAME earring cuts of v#141 and v#142 —
 *                        the same cutter, a different question, and a second
 *                        render
 *
 * Two negatives per specimen, because they are different diseases:
 *
 *   ARC        a contiguous 120° of the ring deleted — a piece plainly missing
 *   THIN       the ring drawn one pixel thinner all round
 *
 * **And the finding step 3 was going to produce anyway: on a three-pixel ring
 * the THIN negative and one pixel of honest reader disagreement are the SAME
 * OPERATION.** `erode(crop)` is both. No instrument can separate a defect from
 * noise when they are byte-identical, so a thin-kind door can catch a missing
 * segment and cannot catch thinning — and that limit belongs in the proposal,
 * not in a footnote after somebody trusts it.
 *
 * Region reads cached per frame. No credits, nothing written.
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import sharp from "sharp";

import { fetchImageBytes } from "./lib/imageBytes.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { shellFraction } from "../server/castingV2/referenceCompleteness";
import { openDatabase } from "./lib/dbConnection.mts";

const OUT = path.resolve("output/thin-kind-door");
const CACHE = path.join(OUT, "cache");
const uri = process.env.DATABASE_URL!;
if (new URL(uri).port !== "52008") throw new Error("not the dev database (:52008)");
const bucket = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

type Shape = { data: Uint8Array; width: number; height: number };
const blank = (w: number, h: number): Shape => ({ data: new Uint8Array(w * h), width: w, height: h });
const area = (s: Shape) => s.data.reduce((t, b) => t + (b > 0 ? 1 : 0), 0);

function dilate(s: Shape): Shape {
  const out = blank(s.width, s.height);
  for (let y = 0; y < s.height; y += 1) for (let x = 0; x < s.width; x += 1) {
    if (s.data[y * s.width + x]! === 0) continue;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height) continue;
      out.data[ny * s.width + nx] = 255;
    }
  }
  return out;
}
function erode(s: Shape): Shape {
  const out = blank(s.width, s.height);
  for (let y = 0; y < s.height; y += 1) for (let x = 0; x < s.width; x += 1) {
    if (s.data[y * s.width + x]! === 0) continue;
    let solid = true;
    for (let dy = -1; dy <= 1 && solid; dy += 1) for (let dx = -1; dx <= 1 && solid; dx += 1) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height || s.data[ny * s.width + nx]! === 0) solid = false;
    }
    if (solid) out.data[y * s.width + x] = 255;
  }
  return out;
}
function shift(s: Shape, dx: number, dy: number): Shape {
  const out = blank(s.width, s.height);
  for (let y = 0; y < s.height; y += 1) for (let x = 0; x < s.width; x += 1) {
    if (s.data[y * s.width + x]! === 0) continue;
    const nx = x + dx; const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height) continue;
    out.data[ny * s.width + nx] = 255;
  }
  return out;
}
function amputateArc(s: Shape, from: number, span: number): Shape {
  let sx = 0; let sy = 0; let n = 0;
  for (let y = 0; y < s.height; y += 1) for (let x = 0; x < s.width; x += 1) {
    if (s.data[y * s.width + x]! === 0) continue;
    sx += x; sy += y; n += 1;
  }
  if (n === 0) return s;
  const cx = sx / n; const cy = sy / n;
  const out = blank(s.width, s.height);
  for (let y = 0; y < s.height; y += 1) for (let x = 0; x < s.width; x += 1) {
    if (s.data[y * s.width + x]! === 0) continue;
    let angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    if ((angle - from + 360) % 360 < span) continue;
    out.data[y * s.width + x] = 255;
  }
  return out;
}
function thin(s: Shape): Shape {
  const { width, height } = s;
  const data = new Uint8Array(s.data);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : (data[y * width + x]! > 0 ? 1 : 0));
  let changed = true; let guard = 0;
  while (changed && guard < 100) {
    changed = false; guard += 1;
    for (const step of [0, 1]) {
      const doomed: number[] = [];
      for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
        if (at(x, y) === 0) continue;
        const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1),
          at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
        const neighbours = p.reduce((t, v) => t + v, 0);
        if (neighbours < 2 || neighbours > 6) continue;
        let transitions = 0;
        for (let i = 0; i < 8; i += 1) if (p[i] === 0 && p[(i + 1) % 8] === 1) transitions += 1;
        if (transitions !== 1) continue;
        const [n, e, s2, w] = [p[0]!, p[2]!, p[4]!, p[6]!];
        if (step === 0) { if (n * e * s2 !== 0 || e * s2 * w !== 0) continue; }
        else if (n * e * w !== 0 || n * s2 * w !== 0) continue;
        doomed.push(y * width + x);
      }
      if (doomed.length === 0) continue;
      changed = true;
      for (const index of doomed) data[index] = 0;
    }
  }
  return { data, width, height };
}
function coverage(a: Shape, b: Shape): number {
  let both = 0; let inB = 0;
  for (let i = 0; i < b.data.length; i += 1) {
    if (b.data[i]! === 0) continue;
    inB += 1;
    if (a.data[i]! > 0) both += 1;
  }
  return inB === 0 ? 0 : both / inB;
}

await mkdir(CACHE, { recursive: true });
const connection = await openDatabase({ uri, timezone: "Z" });
/*
  BOTH SIDES OF THE DOOR, because a bar needs crops that were kept as well as
  crops that were turned away — and the kept ones cost nothing extra: rows #2/#3
  and #6/#7 are per-side earring crops the library STORED on earlier renders,
  with the same cutter's mask at `maskKey`. `COALESCE` picks whichever column
  group the row actually filled; the geometry columns are the matching pair.
*/
const [library] = await connection.query<any[]>(`
  SELECT CONCAT('lib#', l.id) id, l.slot,
         COALESCE(l.refusedMaskKey, l.maskKey) mk,
         COALESCE(l.refusedBboxX, l.bboxX) bx, COALESCE(l.refusedBboxY, l.bboxY) by_,
         COALESCE(l.refusedBboxW, l.bboxW) bw, COALESCE(l.refusedBboxH, l.bboxH) bh,
         COALESCE(l.refusedFrameWidth, l.frameWidth) fw,
         COALESCE(l.refusedFrameHeight, l.frameHeight) fh,
         COALESCE(l.refusedReason, 'stored') door,
         v.imageKey frame, v.id vid
    FROM casting_reference_library l
    LEFT JOIN casting_candidate_variants v ON v.id = l.variantId
   WHERE (l.refusedContentKey IS NOT NULL OR l.storageKey IS NOT NULL)
     AND l.slot LIKE 'earring%'
   ORDER BY l.id`);
const [segments] = await connection.query<any[]>(`
  SELECT CONCAT('seg#', s.id) id, CONCAT(s.region, '@whole') slot, s.maskKey mk, s.bboxX bx, s.bboxY by_,
         s.bboxW bw, s.bboxH bh, s.frameWidth fw, s.frameHeight fh, v.imageKey frame, v.id vid
    FROM casting_segments s
    LEFT JOIN casting_candidate_variants v ON v.id = s.variantId
   WHERE s.region = 'earring' AND s.maskKey IS NOT NULL`);
await connection.end();

async function regionFor(row: any): Promise<Shape> {
  const [question, side] = row.slot.split("@");
  const key = `${row.vid}-${question}-${side}`;
  const cached = path.join(CACHE, `${key}.png`);
  if (existsSync(cached)) {
    const raw = await sharp(await readFile(cached)).greyscale().raw().toBuffer();
    return { data: new Uint8Array(raw), width: row.fw, height: row.fh };
  }
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error(`FAL_KEY needed for the first read of ${key}`);
  const reader = createFalRegionReader({ apiKey });
  const image = (await fetchImageBytes(`${bucket}/${row.frame}`)).bytes;
  const mask = side === "whole"
    ? await reader.region({ image, name: question, absentIsAnswer: true })
    : (await reader.regionSides?.({ image, name: question, absentIsAnswer: true }))?.[side as "left" | "right"] ?? null;
  if (!mask) throw new Error(`${key}: the read did not settle`);
  await writeFile(cached, await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  }).png().toBuffer());
  return { data: new Uint8Array(mask.data), width: mask.width, height: mask.height };
}

/* The older per-side cache from the first bench used a different key; reuse it
   so those two reads are not bought twice. */
for (const row of library as any[]) {
  const legacy = path.join(CACHE, `${row.slot.replace(/[^a-z0-9]+/gi, "-")}-region.png`);
  const wanted = path.join(CACHE, `${row.vid}-${row.slot.split("@")[0]}-${row.slot.split("@")[1]}.png`);
  if (existsSync(legacy) && !existsSync(wanted)) await writeFile(wanted, await readFile(legacy));
}

console.log("specimen        crop  region  spine |  centreline reads | 1px eroded  1px shifted | ARC gone  THIN\n");
const sheet: Array<{ label: string; png: Buffer }> = [];

for (const row of [...library, ...segments] as any[]) {
  if (!row.frame) continue;
  const region = await regionFor(row);
  const cropRaw = await sharp((await fetchImageBytes(`${bucket}/${row.mk}`)).bytes).greyscale().raw().toBuffer();
  const crop = blank(row.fw, row.fh);
  for (let y = 0; y < row.bh; y += 1) for (let x = 0; x < row.bw; x += 1) {
    if (cropRaw[y * row.bw + x]! === 0) continue;
    crop.data[(row.by_ + y) * row.fw + (row.bx + x)] = 255;
  }

  const spine = thin(region);
  const read = (c: Shape) => coverage(dilate(c), spine);
  const asIs = read(crop);
  const arc = read(amputateArc(crop, 200, 120));
  const thinned = read(erode(crop));
  const shifted = read(shift(crop, 1, 0));

  console.log(`${String(`${row.id} ${row.slot} ${row.door ?? ""}`).padEnd(42)}`
    + `${String(area(crop)).padStart(5)} ${String(area(region)).padStart(6)} ${String(area(spine)).padStart(5)} | `
    + `${(asIs * 100).toFixed(1).padStart(6)}%          | `
    + `${((asIs - thinned) * 100).toFixed(1).padStart(6)}     ${((asIs - shifted) * 100).toFixed(1).padStart(6)}  | `
    + `${((asIs - arc) * 100).toFixed(1).padStart(6)}  ${((asIs - thinned) * 100).toFixed(1).padStart(6)}`
    + `   edge ${(shellFraction({ data: Buffer.from(region.data), width: region.width, height: region.height }) * 100).toFixed(0)}%`);

  /* THE CONTACT SHEET — one bright, magnified cutout per specimen, so the
     labels come from an eye and not from this table. */
  const frame = (await fetchImageBytes(`${bucket}/${row.frame}`)).bytes;
  const rgba = Buffer.alloc(row.fw * row.fh * 4, 0);
  const raw = await sharp(frame).removeAlpha().raw().toBuffer();
  for (let i = 0; i < row.fw * row.fh; i += 1) {
    if (crop.data[i]! === 0) continue;
    rgba[i * 4] = raw[i * 3]!; rgba[i * 4 + 1] = raw[i * 3 + 1]!; rgba[i * 4 + 2] = raw[i * 3 + 2]!;
    rgba[i * 4 + 3] = 255;
  }
  const PAD = 10;
  const left = Math.max(0, row.bx - PAD);
  const top = Math.max(0, row.by_ - PAD);
  const width = Math.min(row.fw - left, row.bw + PAD * 2);
  const height = Math.min(row.fh - top, row.bh + PAD * 2);
  const zoom = Math.max(2, Math.min(14, Math.floor(700 / width)));
  sheet.push({
    label: `${row.id} ${row.slot}`,
    png: await sharp(rgba, { raw: { width: row.fw, height: row.fh, channels: 4 } })
      .extract({ left, top, width, height })
      .modulate({ brightness: 2.2 })
      .resize({ width: width * zoom, height: height * zoom, kernel: "nearest" })
      .flatten({ background: "#101010" })
      .png().toBuffer(),
  });
}

for (const { label, png } of sheet) {
  const name = `sheet-${label.replace(/[^a-z0-9]+/gi, "-")}.png`;
  await writeFile(path.join(OUT, name), png);
  console.log(`  ${name}`);
}
console.log("\nLOOK AT THE SHEET. Complete or not is an eye's call, not this table's.");

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
