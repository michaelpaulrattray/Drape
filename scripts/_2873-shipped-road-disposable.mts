/**
 * THE SHIPPED ROAD, ON THE REAL SPLIT — #2873's step 2 and 3 verified at the
 * code that will run rather than at the sweep's copy of the rule.
 *
 * ⚠ **THE SWEEP IS NOT THIS.** `_2873-dedupe-sweep-disposable.mts` carries its
 * own `dropNearDuplicates` — the court's plain loop with the two numbers freed —
 * because a sweep has to vary a threshold the module declares as a constant. The
 * module's own version is NOT that loop: it prunes pairs on two exact bounds and
 * reads IoU over a bounding-box overlap instead of the frame. **So the sweep
 * picked the number and this cell proves the shipped code agrees with the row
 * that was picked** — otherwise the chosen threshold is a fact about a harness.
 *
 * It takes no provider call at all: the raw split is on disk and the face boxes
 * are cached.
 *
 *     npx tsx scripts/_2873-shipped-road-disposable.mts
 */
import { readFileSync } from "node:fs";

import type { Mask } from "../server/castingV2/maskedComposite";
import type { PointerBox } from "../server/castingV2/maskedRefine";
import { SPLIT_SAME_THING_IOU, cleanSplit } from "../server/castingV2/referenceSplitCleanup";

const DIR = "C:/Users/Admin/drape-scratch/relay-14spot";
const GARMENT_LEVEL = 0.75;

/** What the sweep reported for the threshold the module now carries. */
const EXPECTED: Record<string, { pieces: number; hover: number[] }> = {
  worn: { pieces: 11, hover: [0.978, 0.653, 0, 0] },
  hanger: { pieces: 6, hover: [0.991, 0.994] },
  product: { pieces: 8, hover: [0.981, 0.954, 0.986] },
};

function load(path: string, width: number, height: number): Mask[] {
  const bytes = readFileSync(path);
  const size = width * height;
  if (bytes.length % size !== 0) throw new Error(`${path} is not a whole number of ${width}x${height} masks`);
  const out: Mask[] = [];
  for (let at = 0; at * size < bytes.length; at += 1) {
    const slice = bytes.subarray(at * size, (at + 1) * size);
    const data = Buffer.alloc(size);
    for (let p = 0; p < size; p += 1) data[p] = slice[p]! > 0 ? 255 : 0;
    out.push({ data, width, height });
  }
  let live = 0;
  for (const mask of out) for (const byte of mask.data) if (byte > 127) live += 1;
  if (live === 0) throw new Error(`${path}: every mask read as empty`);
  return out;
}

function live(mask: Mask): number {
  let n = 0;
  for (const byte of mask.data) if (byte > 127) n += 1;
  return n;
}

function iou(a: Mask, b: Mask): number {
  let both = 0;
  let either = 0;
  for (let p = 0; p < a.data.length; p += 1) {
    const x = a.data[p]! > 127;
    const y = b.data[p]! > 127;
    if (x && y) both += 1;
    if (x || y) either += 1;
  }
  return either === 0 ? 0 : both / either;
}

function poleOf(mask: Mask): number {
  const { width, height, data } = mask;
  const depth = new Float32Array(width * height);
  for (let at = 0; at < depth.length; at += 1) depth[at] = data[at]! > 127 ? 1e9 : 0;
  const near = (at: number, from: number, step: number): void => {
    const candidate = depth[from]! + step;
    if (candidate < depth[at]!) depth[at] = candidate;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = y * width + x;
      if (depth[at] === 0) continue;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) depth[at] = Math.min(depth[at]!, 1);
      if (x > 0) near(at, at - 1, 1);
      if (y > 0) near(at, at - width, 1);
      if (x > 0 && y > 0) near(at, at - width - 1, 1.414);
      if (x < width - 1 && y > 0) near(at, at - width + 1, 1.414);
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const at = y * width + x;
      if (depth[at] === 0) continue;
      if (x < width - 1) near(at, at + 1, 1);
      if (y < height - 1) near(at, at + width, 1);
      if (x < width - 1 && y < height - 1) near(at, at + width + 1, 1.414);
      if (x > 0 && y < height - 1) near(at, at + width - 1, 1.414);
    }
  }
  let best = -1;
  let bestAt = 0;
  for (let at = 0; at < depth.length; at += 1) {
    if (depth[at]! > best) {
      best = depth[at]!;
      bestAt = at;
    }
  }
  return bestAt;
}

let faults = 0;
let garment = 0;
let things = 0;

for (const id of ["worn", "hanger", "product"]) {
  const r = JSON.parse(readFileSync(`${DIR}/out/result-${id}.json`, "utf8")) as {
    W: number;
    H: number;
    truth: string[];
  };
  const raw = load(`${DIR}/out/${id}-RAW.bin`, r.W, r.H);
  const truth = load(`${DIR}/out/${id}-truth.bin`, r.W, r.H);
  const faces = JSON.parse(readFileSync(`${DIR}/out/${id}-faces.json`, "utf8")) as PointerBox[];

  const started = Date.now();
  const cleaned = cleanSplit(raw, faces);
  const ms = Date.now() - started;

  /* ⚠ THE DISJOINTNESS THE PLACEMENT ARGUMENT RESTS ON, CHECKED ON THE REAL
     SPLIT and not only on the suite's synthetic shapes: if any two surviving
     pieces shared a pixel, a near-duplicate rule placed AFTER the arbitration
     could fire, and the module's docblock says it could not. */
  let shared = 0;
  for (let a = 0; a < cleaned.pieces.length; a += 1) {
    for (let b = a + 1; b < cleaned.pieces.length; b += 1) {
      for (let p = 0; p < cleaned.pieces[a]!.data.length; p += 1) {
        if (cleaned.pieces[a]!.data[p]! > 127 && cleaned.pieces[b]!.data[p]! > 127) shared += 1;
      }
    }
  }

  console.log(
    `\n=== ${id} (${r.W}x${r.H}) — ${raw.length} raw -> ${cleaned.pieces.length} pieces, ${ms} ms ===\n` +
      `    duplicates dropped ${cleaned.duplicatesDropped} · person pieces ${cleaned.personPiecesDropped} · ` +
      `fragments ${cleaned.fragmentsDropped} · holes ${cleaned.holesFilled} · ` +
      `contested ${cleaned.contestedPixels} px -> reassigned ${cleaned.reassignedPixels} px\n` +
      `    pixels shared by any two surviving pieces: ${shared} (must be 0)`,
  );
  if (shared !== 0) {
    faults += 1;
    console.log(`    ⚠ FAULT: the surviving pieces are NOT disjoint`);
  }

  const expected = EXPECTED[id]!;
  if (cleaned.pieces.length !== expected.pieces) {
    faults += 1;
    console.log(
      `    ⚠ FAULT: the sweep's threshold-${SPLIT_SAME_THING_IOU} row says ${expected.pieces} pieces,` +
        ` the shipped road gives ${cleaned.pieces.length}`,
    );
  }

  r.truth.forEach((name, k) => {
    const thing = truth[k]!;
    const at = poleOf(thing);
    const containing = cleaned.pieces
      .filter((piece) => piece.data[at]! > 127)
      .map((piece) => ({ piece, pixels: live(piece) }))
      .sort((a, b) => a.pixels - b.pixels);
    const hover = containing.length === 0 ? 0 : iou(containing[0]!.piece, thing);
    things += 1;
    if (hover >= GARMENT_LEVEL) garment += 1;
    const want = expected.hover[k]!;
    const agrees = Math.abs(hover - want) < 0.002;
    if (!agrees) faults += 1;
    console.log(
      `    ${hover >= GARMENT_LEVEL ? "LIGHTS " : "       "} ${name.padEnd(14)} hover ${hover.toFixed(3)}` +
        `   sweep said ${want.toFixed(3)}  ${agrees ? "agrees" : "⚠ DISAGREES"}`,
    );
  });
}

console.log(
  `\n=== the shipped road, on the real split: ${garment} of ${things} things light as themselves ===\n` +
    `=== faults: ${faults} ===`,
);
console.log("Spend: nothing. The raw split and the face boxes are both on disk.");

process.exit(faults === 0 ? 0 : 1);
