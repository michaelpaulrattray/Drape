/**
 * HOW BIG IS THE SPOTLIGHT'S HIT-TEST MAP — #14 slice 3a-2, measured before it
 * is believed.
 *
 * §0 of the build design says hover "is then a hit-test in the browser and
 * costs nothing", which means the browser must hold the geometry of up to
 * `SPLIT_MAX_MASKS` (32) pieces of one photograph. A `Mask` here is one byte
 * per pixel at the frame's own size, so 32 of them on a 768x1024 frame is
 * 25 MB of Buffer — obviously not a wire shape. The question this answers is
 * which representation IS one, with a number rather than a preference.
 *
 * ⚠ **IT COSTS NOTHING AND THAT IS WHY IT RUNS FIRST.** The spotlight court
 * saved its split masks to disk, so every number below is taken on the REAL
 * SAM 3 output of the three real fixtures (worn, hanger, product) with no
 * provider call. A fresh split would have mixed the encoding question with
 * whatever the provider answered this minute.
 *
 * ⚠ **THE PIECE COUNTS HERE ARE AN UPPER BOUND, DELIBERATELY.** `cleanSplit`
 * is run with NO face boxes, so no piece is dropped by §6's face rule and no
 * pixel is removed by the subtraction. That makes the map as busy as it can
 * be — more pieces, more runs, more bytes — which is the right direction for a
 * size question. Faces only ever shrink it.
 *
 *   npx tsx scripts/_14-spotlight-map-size-disposable.mts
 */

import { readFileSync, statSync } from "node:fs";
import sharp from "sharp";
import { cleanSplit } from "../server/castingV2/referenceSplitCleanup";
import type { Mask } from "../server/castingV2/maskedComposite";

const DIR = "C:/Users/Admin/drape-scratch/relay-14spot";

/* The court wrote one byte per pixel holding 0 or 1, and this pipeline
   thresholds at `> 127` — fed straight in, every pixel reads as background and
   the clean-up honestly reports that it changed nothing. Scaled on the way in,
   with the live count asserted below so the conversion cannot fail quietly. */
function load(path: string, width: number, height: number): Mask[] {
  const bytes = readFileSync(path);
  const size = width * height;
  if (bytes.length % size !== 0) {
    throw new Error(`${path} is ${bytes.length} bytes, not a whole number of ${width}x${height} masks`);
  }
  const out: Mask[] = [];
  for (let at = 0; at * size < bytes.length; at += 1) {
    const slice = bytes.subarray(at * size, (at + 1) * size);
    const data = Buffer.alloc(size);
    for (let p = 0; p < size; p += 1) data[p] = slice[p]! > 0 ? 255 : 0;
    out.push({ data, width, height });
  }
  return out;
}

function live(mask: Mask): number {
  let n = 0;
  for (const byte of mask.data) if (byte > 127) n += 1;
  return n;
}

/* ---- THE CANDIDATE UNDER TEST: one byte per pixel, 0 is nothing ----

   Kept in this cell rather than imported, because which encoding ships is
   exactly what this run decides. The module gets the winner. */
function indexMapOf(pieces: readonly Mask[]): { indices: Buffer; width: number; height: number } {
  if (pieces.length === 0) throw new Error("no pieces");
  const { width, height } = pieces[0]!;
  const size = width * height;
  const indices = Buffer.alloc(size);
  pieces.forEach((piece, at) => {
    const id = at + 1;
    for (let p = 0; p < size; p += 1) {
      if (piece.data[p]! <= 127) continue;
      /* THE DISJOINTNESS ASSERTION. `cleanSplit`'s arbitration gives every
         contested pixel to exactly one winner, so a second claim here is a
         broken invariant upstream and never something to resolve silently. */
      if (indices[p] !== 0) {
        throw new Error(`pixel ${p} is claimed by piece ${indices[p]} and piece ${id} — the split is not disjoint`);
      }
      indices[p] = id;
    }
  });
  return { indices, width, height };
}

/* Run-length over the index map: one byte value + uint32 length per run.
   Exact by construction, and no image decoder sits between the server's bytes
   and the browser's hit-test. */
function runsOf(indices: Buffer): Buffer {
  const runs: number[][] = [];
  let value = indices[0]!;
  let length = 1;
  for (let p = 1; p < indices.length; p += 1) {
    if (indices[p] === value) {
      length += 1;
      continue;
    }
    runs.push([value, length]);
    value = indices[p]!;
    length = 1;
  }
  runs.push([value, length]);
  const out = Buffer.alloc(runs.length * 5);
  runs.forEach(([v, n], at) => {
    out[at * 5] = v!;
    out.writeUInt32LE(n!, at * 5 + 1);
  });
  return out;
}

const fixtures = ["worn", "hanger", "product"].map((id) => {
  const r = JSON.parse(readFileSync(`${DIR}/out/result-${id}.json`, "utf8")) as { W: number; H: number };
  return { id, width: r.W, height: r.H };
});

console.log("=== THE SPOTLIGHT HIT-TEST MAP, SIZED ON THE COURT'S OWN SPLIT OUTPUT ===");
console.log("(cleanSplit with NO faces — an upper bound on pieces, runs and bytes)\n");

for (const fx of fixtures) {
  const path = `${DIR}/out/${fx.id}-B.bin`;
  const raw = load(path, fx.width, fx.height);
  const rawLive = raw.reduce((sum, mask) => sum + live(mask), 0);
  if (rawLive === 0) throw new Error(`${fx.id}: every saved piece read as empty — the 0/1 conversion failed`);

  const cleaned = cleanSplit(raw, []);
  const map = indexMapOf(cleaned.pieces);
  const runs = runsOf(map.indices);
  const png = await sharp(map.indices, { raw: { width: map.width, height: map.height, channels: 1 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  let lit = 0;
  for (const byte of map.indices) if (byte !== 0) lit += 1;

  const frameBytes = statSync(fx.id === "worn" ? `${DIR}/fixtures/ref-worn.jpg` : `${DIR}/fixtures/ref-${fx.id}.png`).size;

  console.log(`--- ${fx.id} · ${fx.width}x${fx.height} (${(fx.width * fx.height / 1000).toFixed(0)}k px)`);
  console.log(`    pieces saved by the court: ${raw.length}  ->  after cleanSplit: ${cleaned.pieces.length}`);
  console.log(`    dropped: ${JSON.stringify(cleaned.dropped)}`);
  console.log(`    contested ${cleaned.contestedPixels} px, reassigned ${cleaned.reassignedPixels} px`);
  console.log(`    map covers ${((lit / map.indices.length) * 100).toFixed(1)}% of the frame, max id ${cleaned.pieces.length}`);
  console.log(`    RAW index map:  ${(map.indices.length / 1024).toFixed(0)} KB  (one byte per pixel, never sent)`);
  console.log(`    PNG (greyscale, level 9): ${(png.length / 1024).toFixed(1)} KB   base64 ${(png.length * 1.3334 / 1024).toFixed(1)} KB`);
  console.log(`    RLE (value+uint32):       ${(runs.length / 1024).toFixed(1)} KB   base64 ${(runs.length * 1.3334 / 1024).toFixed(1)} KB   runs ${runs.length / 5}`);
  console.log(`    for scale, the photograph itself is ${(frameBytes / 1024).toFixed(0)} KB\n`);
}

/* ---- THE ASSERTION'S OWN POSITIVE CONTROL ----

   A size measurement that never saw the guard fire is a measurement that does
   not know whether the guard can fire. Two deliberately overlapping masks must
   throw; if this prints NOT, the disjointness claim above is decoration. */
const w = 4;
const h = 4;
const fill = (on: (p: number) => boolean): Mask => {
  const data = Buffer.alloc(w * h);
  for (let p = 0; p < w * h; p += 1) data[p] = on(p) ? 255 : 0;
  return { data, width: w, height: h };
};
let threw = false;
try {
  indexMapOf([fill((p) => p < 8), fill((p) => p >= 4)]);
} catch {
  threw = true;
}
console.log(`=== control: two overlapping pieces ${threw ? "THREW, as they must" : "DID NOT THROW — the assertion is decoration"}`);

process.exit(0);
