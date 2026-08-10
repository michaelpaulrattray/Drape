/**
 * A DOOR FOR THIN KINDS — proposed as numbers, with controls, before any code
 * (fable-224/225).
 *
 * `notScorableByArea` says honestly that area cannot judge a hoop. It does not
 * give hoops a door. The candidate is **tolerance-dilated agreement**: forgive
 * the crop one pixel of boundary before measuring, so the sub-pixel noise is
 * spent BEFORE the number rather than swallowing it afterwards.
 *
 *   plain      coverage  = |crop ∩ region| / |region|
 *   tolerant   coverage₁ = |dilate(crop,1) ∩ region| / |region|
 *   symmetric  coverage₂ = |dilate(crop,1) ∩ dilate(region,1)| / |dilate(region,1)|
 *
 * # An instrument is worth having only if its SIGNAL beats its RESOLUTION
 *
 * Both are measured here, on the same shape, so the comparison is not a belief:
 *
 *   RESOLUTION   what one pixel of honest boundary disagreement costs. Modelled
 *                by eroding the real crop by one pixel — the exact difference
 *                the diagnosis found between the cut and the guard's read.
 *   SIGNAL       what a real loss costs. Modelled by AMPUTATING a contiguous
 *                third of the ring — the defect the door exists to catch, and
 *                the one the founder would call incomplete by eye.
 *
 * A door works iff signal ≫ resolution. The plain measure is run beside it as
 * the negative arm: it is expected to fail this test, and if it does not, the
 * whole premise of `notScorableByArea` is wrong and I want to know.
 *
 * # The labels are human-verifiable, which is the lesson this campaign paid for
 *
 * The positive is the real crop, which the bright ×16 frames show tracing the
 * visible metal. The negative is built by deleting an arc, and its picture is
 * written out so the deletion can be SEEN rather than trusted. Neither class is
 * labelled by what was asked for.
 *
 * Region reads are cached to disk on first run: four SAM3 calls once, free
 * thereafter. No credits, nothing written to any database.
 *
 *   FAL_KEY=… npx tsx scripts/bench-thin-kind-door-disposable.mts
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import sharp from "sharp";

import { fetchImageBytes } from "./lib/imageBytes.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { measureCoverage, shellFraction } from "../server/castingV2/referenceCompleteness";
import type { Mask } from "../server/castingV2/maskedComposite";

const OUT = path.resolve("output/thin-kind-door");
const CACHE = path.join(OUT, "cache");

const uri = process.env.DATABASE_URL!;
if (new URL(uri).port !== "52008") throw new Error("not the dev database (:52008)");
const bucket = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

type Shape = { data: Uint8Array; width: number; height: number };

const blank = (width: number, height: number): Shape =>
  ({ data: new Uint8Array(width * height), width, height });

/** One pixel of 8-connected growth. The tolerance, applied once. */
function dilate(shape: Shape): Shape {
  const out = blank(shape.width, shape.height);
  for (let y = 0; y < shape.height; y += 1) {
    for (let x = 0; x < shape.width; x += 1) {
      if (shape.data[y * shape.width + x]! === 0) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= shape.width || ny >= shape.height) continue;
          out.data[ny * shape.width + nx] = 255;
        }
      }
    }
  }
  return out;
}

/** One pixel of 8-connected shrink — the honest boundary disagreement. */
function erode(shape: Shape): Shape {
  const out = blank(shape.width, shape.height);
  for (let y = 0; y < shape.height; y += 1) {
    for (let x = 0; x < shape.width; x += 1) {
      if (shape.data[y * shape.width + x]! === 0) continue;
      let solid = true;
      for (let dy = -1; dy <= 1 && solid; dy += 1) {
        for (let dx = -1; dx <= 1 && solid; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= shape.width || ny >= shape.height) { solid = false; continue; }
          if (shape.data[ny * shape.width + nx]! === 0) solid = false;
        }
      }
      if (solid) out.data[y * shape.width + x] = 255;
    }
  }
  return out;
}

/**
 * Delete a contiguous angular third of a ring — the loss a person calls
 * incomplete. Cut by ANGLE about the shape's own centroid rather than by a
 * bounding-box slab, so the removed piece is an arc rather than a corner.
 */
function amputateArc(shape: Shape, fromDegrees: number, spanDegrees: number): Shape {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < shape.height; y += 1) {
    for (let x = 0; x < shape.width; x += 1) {
      if (shape.data[y * shape.width + x]! === 0) continue;
      sumX += x; sumY += y; count += 1;
    }
  }
  if (count === 0) return shape;
  const cx = sumX / count;
  const cy = sumY / count;
  const out = blank(shape.width, shape.height);
  for (let y = 0; y < shape.height; y += 1) {
    for (let x = 0; x < shape.width; x += 1) {
      if (shape.data[y * shape.width + x]! === 0) continue;
      let angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      const delta = (angle - fromDegrees + 360) % 360;
      if (delta < spanDegrees) continue; /* amputated */
      out.data[y * shape.width + x] = 255;
    }
  }
  return out;
}

/**
 * A ONE-PIXEL REGISTRATION SHIFT — the honest model of two readers disagreeing
 * about where an edge runs.
 *
 * Symmetric erosion is the OTHER model and it is a worst case: on a ring three
 * pixels thick, eroding all round removes two-thirds, which is far more than one
 * reader being a pixel fatter on the inside. Both are reported, because a
 * resolution measured only by its harshest model condemns instruments that might
 * work.
 */
function shift(shape: Shape, dx: number, dy: number): Shape {
  const out = blank(shape.width, shape.height);
  for (let y = 0; y < shape.height; y += 1) {
    for (let x = 0; x < shape.width; x += 1) {
      if (shape.data[y * shape.width + x]! === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= shape.width || ny >= shape.height) continue;
      out.data[ny * shape.width + nx] = 255;
    }
  }
  return out;
}

/**
 * ZHANG–SUEN THINNING — the shape's centreline, one pixel wide.
 *
 * The reason to reach for it: a ring's AREA is its boundary, but its CENTRELINE
 * is its length. A one-pixel disagreement about where the metal stops barely
 * moves the centreline; a missing third of the hoop removes a third of it. That
 * is the invariant an area measure does not have, and the whole question is
 * whether it survives contact with a 25-pixel hoop.
 */
function thin(shape: Shape): Shape {
  const { width, height } = shape;
  const data = new Uint8Array(shape.data);
  const at = (x: number, y: number) => (
    x < 0 || y < 0 || x >= width || y >= height ? 0 : (data[y * width + x]! > 0 ? 1 : 0)
  );
  let changed = true;
  let guard = 0;
  while (changed && guard < 100) {
    changed = false;
    guard += 1;
    for (const step of [0, 1]) {
      const doomed: number[] = [];
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (at(x, y) === 0) continue;
          const p = [
            at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1),
            at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1),
          ];
          const neighbours = p.reduce((total, value) => total + value, 0);
          if (neighbours < 2 || neighbours > 6) continue;
          let transitions = 0;
          for (let index = 0; index < 8; index += 1) {
            if (p[index] === 0 && p[(index + 1) % 8] === 1) transitions += 1;
          }
          if (transitions !== 1) continue;
          const [n, ne, e, se, s, sw, w, nw] = p as number[];
          if (step === 0) {
            if (n! * e! * s! !== 0) continue;
            if (e! * s! * w! !== 0) continue;
          } else {
            if (n! * e! * w! !== 0) continue;
            if (n! * s! * w! !== 0) continue;
          }
          void ne; void se; void sw; void nw;
          doomed.push(y * width + x);
        }
      }
      if (doomed.length === 0) continue;
      changed = true;
      for (const index of doomed) data[index] = 0;
    }
  }
  return { data, width, height };
}

const toMask = (shape: Shape): Mask =>
  ({ data: Buffer.from(shape.data), width: shape.width, height: shape.height });

const area = (shape: Shape) => shape.data.reduce((total, byte) => total + (byte > 0 ? 1 : 0), 0);

/** `|a ∩ b| / |b|`, both full-frame. The guard's arithmetic, generalized. */
function coverage(a: Shape, b: Shape): number {
  let both = 0;
  let inB = 0;
  for (let index = 0; index < b.data.length; index += 1) {
    if (b.data[index]! === 0) continue;
    inB += 1;
    if (a.data[index]! > 0) both += 1;
  }
  return inB === 0 ? 0 : both / inB;
}

await mkdir(CACHE, { recursive: true });
const connection = await mysql.createConnection({ uri, timezone: "Z" });
const [rows] = await connection.query<any[]>(`
  SELECT l.slot, l.refusedMaskKey mk, l.refusedBboxX bx, l.refusedBboxY by_, l.refusedBboxW bw,
         l.refusedBboxH bh, l.refusedFrameWidth fw, l.refusedFrameHeight fh, v.imageKey frame
    FROM casting_reference_library l
    LEFT JOIN casting_candidate_variants v ON v.id = l.variantId
   WHERE l.refusedContentKey IS NOT NULL ORDER BY l.id`);
await connection.end();

async function regionFor(row: any): Promise<Shape> {
  const cached = path.join(CACHE, `${row.slot.replace(/[^a-z0-9]+/gi, "-")}-region.png`);
  if (existsSync(cached)) {
    const raw = await sharp(await readFile(cached)).greyscale().raw().toBuffer();
    return { data: new Uint8Array(raw), width: row.fw, height: row.fh };
  }
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("FAL_KEY needed for the first run — the reads are cached afterwards");
  const reader = createFalRegionReader({ apiKey });
  const [question, side] = row.slot.split("@");
  const image = (await fetchImageBytes(`${bucket}/${row.frame}`)).bytes;
  const mask = side
    ? (await reader.regionSides?.({ image, name: question, absentIsAnswer: true }))?.[side as "left" | "right"] ?? null
    : await reader.region({ image, name: question, absentIsAnswer: true });
  if (!mask) throw new Error(`${row.slot}: the read did not settle`);
  await writeFile(cached, await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  }).png().toBuffer());
  return { data: new Uint8Array(mask.data), width: mask.width, height: mask.height };
}

/* ------------------------------------------------------------ the controls */

console.log("CONTROLS — shapes whose answers come from geometry\n");
{
  const disc = blank(81, 81);
  for (let y = 0; y < 81; y += 1) {
    for (let x = 0; x < 81; x += 1) {
      if ((x - 40) ** 2 + (y - 40) ** 2 <= 1600) disc.data[y * 81 + x] = 255;
    }
  }
  const line = blank(81, 81);
  for (let x = 8; x < 73; x += 1) line.data[40 * 81 + x] = 255;

  for (const [name, shape] of [["solid disc r=40", disc], ["one-pixel line", line]] as const) {
    const eroded = erode(shape);
    const plainResolution = coverage(shape, shape) - coverage(eroded, shape);
    const tolerantResolution = coverage(dilate(shape), shape) - coverage(dilate(eroded), shape);
    const skeleton = thin(shape);
    console.log(`  ${name.padEnd(16)} area ${String(area(shape)).padStart(5)}`
      + `   edge ${(shellFraction(toMask(shape)) * 100).toFixed(1)}%`
      + `   centreline ${String(area(skeleton)).padStart(4)} px`
      + `   one pixel costs: plain ${(plainResolution * 100).toFixed(1)} pts`
      + `   tolerant ${(tolerantResolution * 100).toFixed(1)} pts`);
  }
  /* THE THINNER'S OWN CONTROL: a one-pixel line is already its own centreline,
     so thinning must return it unchanged. A thinner that eats it would make
     every centreline number below meaningless. */
  const lineSkeleton = thin(line);
  console.log(`\n  CONTROL  thinning a one-pixel line returns ${area(lineSkeleton)} of its 65 px`
    + `   ${area(lineSkeleton) === area(line) ? "— unchanged, as it must be" : "— WRONG, the thinner eats its own fixed point"}`);
  console.log("  A tolerance that does not shrink the one-pixel cost is not a tolerance.\n");
}

/* --------------------------------------------------------------- the hoops */

for (const row of rows) {
  const region = await regionFor(row);
  const cropRaw = await sharp((await fetchImageBytes(`${bucket}/${row.mk}`)).bytes).greyscale().raw().toBuffer();
  const crop = blank(row.fw, row.fh);
  for (let y = 0; y < row.bh; y += 1) {
    for (let x = 0; x < row.bw; x += 1) {
      if (cropRaw[y * row.bw + x]! === 0) continue;
      crop.data[(row.by_ + y) * row.fw + (row.bx + x)] = 255;
    }
  }

  /* The two counterfactuals. One is a pixel of honest disagreement; the other
     is a third of the ring gone, which is what the eye calls incomplete. */
  const nudged = erode(crop);
  const amputated = amputateArc(crop, 200, 120);

  const shifted = shift(crop, 1, 0);
  /* THE CENTRELINE ARM: how much of the region's own centreline runs within a
     pixel of the crop. Length, not area — the invariant a ring has and its
     boundary does not. */
  const spine = thin(region);
  const arms = [
    { name: "plain", of: (c: Shape) => coverage(c, region) },
    { name: "tolerant", of: (c: Shape) => coverage(dilate(c), region) },
    { name: "symmetric", of: (c: Shape) => coverage(dilate(c), dilate(region)) },
    { name: "centreline", of: (c: Shape) => coverage(dilate(c), spine) },
  ];

  console.log(`=== ${row.slot}   crop ${area(crop)} px · region ${area(region)} px`
    + ` · centreline ${area(spine)} px`
    + ` · amputated ${area(amputated)} px (${((1 - area(amputated) / area(crop)) * 100).toFixed(0)}% of the crop removed)`);
  for (const arm of arms) {
    const asIs = arm.of(crop);
    const erodedCost = asIs - arm.of(nudged);
    const shiftCost = asIs - arm.of(shifted);
    const signal = asIs - arm.of(amputated);
    const worst = Math.max(erodedCost, shiftCost);
    console.log(`    ${arm.name.padEnd(11)} reads ${(asIs * 100).toFixed(1).padStart(5)}%`
      + `   one pixel costs ${(erodedCost * 100).toFixed(1).padStart(5)} (eroded) /`
      + ` ${(shiftCost * 100).toFixed(1).padStart(5)} (shifted) pts`
      + `   a missing third costs ${(signal * 100).toFixed(1).padStart(5)} pts`
      + `   signal/worst ${worst <= 0 ? "  ∞" : (signal / worst).toFixed(1).padStart(3)}`);
  }

  /* THE AMPUTATION IS WRITTEN OUT so the negative can be SEEN. A class labelled
     by what a script did to it is still a claim until somebody looks. */
  const overlay = Buffer.alloc(row.fw * row.fh * 4, 0);
  for (let index = 0; index < row.fw * row.fh; index += 1) {
    const kept = amputated.data[index]! > 0;
    const cut = !kept && crop.data[index]! > 0;
    if (!kept && !cut) continue;
    overlay[index * 4] = 255;
    overlay[index * 4 + 1] = kept ? 255 : 45;
    overlay[index * 4 + 2] = kept ? 255 : 85;
    overlay[index * 4 + 3] = 255;
  }
  const frame = (await fetchImageBytes(`${bucket}/${row.frame}`)).bytes;
  const PAD = 14;
  const left = Math.max(0, row.bx - PAD);
  const top = Math.max(0, row.by_ - PAD);
  const width = Math.min(row.fw - left, row.bw + PAD * 2);
  const height = Math.min(row.fh - top, row.bh + PAD * 2);
  /* Two passes, because sharp applies `extract` BEFORE `composite` in one
     pipeline and the full-frame overlay then fails to fit the cropped base. */
  const composed = await sharp(frame).modulate({ brightness: 0.35 })
    .composite([{ input: overlay, raw: { width: row.fw, height: row.fh, channels: 4 } }])
    .png().toBuffer();
  await writeFile(
    path.join(OUT, `amputated-${row.slot.replace(/[^a-z0-9]+/gi, "-")}-x12.png`),
    await sharp(composed)
      .extract({ left, top, width, height })
      .resize({ width: width * 12, height: height * 12, kernel: "nearest" })
      .png().toBuffer(),
  );
}
console.log(`\nnegatives written to ${OUT} — white kept, red amputated. LOOK AT THEM.`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
