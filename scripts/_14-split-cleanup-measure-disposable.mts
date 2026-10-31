/**
 * HIS OWED CLEAN-UP, MEASURED ON THE COURT'S FIXTURES — #14 slice 3a.
 *
 * **His obligation, verbatim** (build design §0): *"Whoever builds slice 3 owes
 * that clean-up as part of the split, measured on the court's fixtures."*
 *
 * This is that measurement, and it costs **nothing**: the spotlight court
 * (2026-10-30, `relay-agent-14spot`) saved every split piece and every true cut
 * to disk, so the clean-up is replayed against the REAL SAM 3 output of the
 * three real fixtures with no provider call of any kind.
 *
 * ⚠ **REPLAYING THE SAVED SPLIT IS BETTER EVIDENCE THAN A FRESH ONE, not a
 * cheaper substitute.** A fresh split would mix two changes — the clean-up, and
 * whatever the provider happened to answer this minute — and the court already
 * measured that the provider moves run to run (one call took 52.3 s where the
 * others took 4–7 s). Replaying the saved masks isolates the only thing under
 * test here, which is the geometry.
 *
 * The fixtures are a photograph of a person and two generated pictures on the
 * relay's machine. They are never committed and never posted; this script reads
 * them where they sit and prints numbers.
 *
 *     npx tsx scripts/_14-split-cleanup-measure-disposable.mts
 */
import { readFileSync } from "node:fs";

import type { Mask } from "../server/castingV2/maskedComposite";
import type { PointerBox } from "../server/castingV2/maskedRefine";
import { SPLIT_FACE_COVER_SHARE, cleanSplit } from "../server/castingV2/referenceSplitCleanup";
import { TAKE_FACE_NOUN } from "../server/castingV2/referenceTake";

const DIR = "C:/Users/Admin/drape-scratch/relay-14spot";

/**
 * THE FACE BOXES, FROM THE PRODUCTION ROAD'S OWN DETECTOR AND ITS OWN NOUN.
 *
 * One `detect` call per fixture — the same endpoint and the same `TAKE_FACE_NOUN`
 * the take road buys (`falRegionReader.ts`'s `DETECT`), so the number this cell
 * reports is the number production will see. House money, cents, and the
 * no-face fixtures are bought too ON PURPOSE: a rule that is inert where there
 * is no person is a control, and skipping those calls would leave it untested.
 */
async function faceBoxes(path: string, width: number, height: number): Promise<PointerBox[]> {
  const env = Object.fromEntries(
    readFileSync("C:/Users/Admin/drape-shift-ref-split-14/.env", "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at), line.slice(at + 1).replace(/^["']|["']$/g, "")];
      }),
  ) as Record<string, string>;
  const key = env.FAL_KEY;
  if (!key) throw new Error("no FAL_KEY in the worktree's .env");
  const image = `data:image/png;base64,${readFileSync(path).toString("base64")}`;
  const answer = await fetch("https://fal.run/fal-ai/moondream3-preview/detect", {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: image, prompt: TAKE_FACE_NOUN }),
  });
  if (!answer.ok) throw new Error(`detect ${answer.status}: ${(await answer.text()).slice(0, 300)}`);
  const json = (await answer.json()) as { objects?: unknown[] };
  const boxes: PointerBox[] = [];
  for (const object of json.objects ?? []) {
    const o = object as Record<string, unknown>;
    const left = Number(o.x_min);
    const top = Number(o.y_min);
    const right = Number(o.x_max);
    const bottom = Number(o.y_max);
    if (![left, top, right, bottom].every((one) => Number.isFinite(one))) continue;
    const x = Math.round(Math.min(Math.max(Math.min(left, right), 0), 1) * width);
    const y = Math.round(Math.min(Math.max(Math.min(top, bottom), 0), 1) * height);
    const x2 = Math.round(Math.min(Math.max(Math.max(left, right), 0), 1) * width);
    const y2 = Math.round(Math.min(Math.max(Math.max(top, bottom), 0), 1) * height);
    if (x2 <= x || y2 <= y) continue;
    boxes.push({ x, y, width: x2 - x, height: y2 - y });
  }
  return boxes;
}

/** How much of the face boxes this piece holds — §6's whole-person test. */
function faceCover(mask: Mask, faces: readonly PointerBox[]): number {
  const area = faces.reduce((sum, box) => sum + box.width * box.height, 0);
  if (area === 0) return 0;
  let held = 0;
  for (const box of faces) {
    for (let y = box.y; y < box.y + box.height; y += 1) {
      for (let x = box.x; x < box.x + box.width; x += 1) {
        if (mask.data[y * mask.width + x]! > 127) held += 1;
      }
    }
  }
  return held / area;
}

/** A piece counts as the thing when it overlaps the true cut this far (the court's bar). */
const GARMENT_LEVEL = 0.75;

type Fixture = { id: string; width: number; height: number; truth: string[] };

/**
 * ⚠ THE SAVED MASKS ARE 0/1 AND THIS PIPELINE THRESHOLDS AT `> 127`.
 *
 * The court's `maskBits` wrote one byte per pixel holding 0 or 1. Fed straight
 * in, EVERY pixel reads as background and the clean-up would honestly report
 * that it changed nothing — a silent all-zero result that looks like a clean
 * no-op. Scaled to 0/255 on the way in, with the count asserted below so the
 * conversion cannot fail quietly.
 */
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

/** How many of this piece's pixels fall inside a DIFFERENT thing's true cut. */
function leakInto(piece: Mask, other: Mask): number {
  let n = 0;
  for (let p = 0; p < piece.data.length; p += 1) {
    if (piece.data[p]! > 127 && other.data[p]! > 127) n += 1;
  }
  return n;
}

function bestFor(pieces: readonly Mask[], thing: Mask): { at: number; iou: number } {
  let at = -1;
  let best = 0;
  pieces.forEach((piece, index) => {
    const score = iou(piece, thing);
    if (score > best) {
      best = score;
      at = index;
    }
  });
  return { at, iou: best };
}

const fixtures: Fixture[] = ["worn", "hanger", "product"].map((id) => {
  const r = JSON.parse(readFileSync(`${DIR}/out/result-${id}.json`, "utf8")) as {
    W: number;
    H: number;
    truth: string[];
  };
  return { id, width: r.W, height: r.H, truth: r.truth };
});

let garmentBefore = 0;
let garmentAfter = 0;
let thingsTotal = 0;

for (const fx of fixtures) {
  const raw = load(`${DIR}/out/${fx.id}-B.bin`, fx.width, fx.height);
  const truth = load(`${DIR}/out/${fx.id}-truth.bin`, fx.width, fx.height);
  const rawLive = raw.reduce((sum, mask) => sum + live(mask), 0);
  if (rawLive === 0) throw new Error(`${fx.id}: every saved piece read as empty — the 0/1 conversion failed`);

  const photo = fx.id === "worn" ? `${DIR}/fixtures/ref-worn.jpg` : `${DIR}/fixtures/ref-${fx.id}.png`;
  const faces = await faceBoxes(photo, fx.width, fx.height);
  console.log(`\n--- ${fx.id}: ${faces.length} face box(es) ${JSON.stringify(faces)}`);
  if (faces.length > 0) {
    const covers = raw
      .map((mask, at) => ({ at, cover: faceCover(mask, faces) }))
      .filter(({ cover }) => cover > 0)
      .sort((a, b) => b.cover - a.cover);
    console.log(
      `    face-box coverage per raw piece (bar ${SPLIT_FACE_COVER_SHARE}): ` +
        covers.map(({ at, cover }) => `#${at} ${(cover * 100).toFixed(1)}%`).join(", "),
    );
  }

  const t0 = Date.now();
  const cleaned = cleanSplit(raw, faces);
  const ms = Date.now() - t0;

  console.log(`\n=== ${fx.id} (${fx.width}x${fx.height}) — ${raw.length} pieces in, ${cleaned.pieces.length} out, ${ms} ms ===`);
  console.log(
    `    fragments dropped ${cleaned.fragmentsDropped} (${cleaned.fragmentPixels} px) · ` +
      `holes filled ${cleaned.holesFilled} (${cleaned.holePixels} px) · ` +
      `contested ${cleaned.contestedPixels} px, reassigned ${cleaned.reassignedPixels} px · ` +
      `person pieces dropped ${cleaned.personPiecesDropped}, face px removed ${cleaned.facePixelsRemoved}`,
  );
  if (cleaned.dropped.length > 0) console.log(`    dropped: ${JSON.stringify(cleaned.dropped)}`);

  fx.truth.forEach((name, k) => {
    const thing = truth[k]!;
    const before = bestFor(raw, thing);
    const after = bestFor(cleaned.pieces, thing);
    thingsTotal += 1;
    if (before.iou >= GARMENT_LEVEL) garmentBefore += 1;
    if (after.iou >= GARMENT_LEVEL) garmentAfter += 1;
    const mark = after.iou >= GARMENT_LEVEL ? "GARMENT" : "       ";
    console.log(
      `    ${mark}  ${name.padEnd(14)} best IoU ${before.iou.toFixed(3)} -> ${after.iou.toFixed(3)}` +
        `   (piece ${before.at} -> ${after.at})`,
    );
    /* HIS QUESTION AT THE FRAME: does the winning piece still carry pixels that
       belong to a DIFFERENT thing? That is "why did the jacket light part of
       the scarf". */
    fx.truth.forEach((otherName, j) => {
      if (j === k) return;
      const other = truth[j]!;
      const leakBefore = before.at === -1 ? 0 : leakInto(raw[before.at]!, other);
      const leakAfter = after.at === -1 ? 0 : leakInto(cleaned.pieces[after.at]!, other);
      if (leakBefore === 0 && leakAfter === 0) return;
      const share = (n: number): string => `${((n / live(other)) * 100).toFixed(1)}%`;
      console.log(
        `              leak onto ${otherName}: ${leakBefore} px (${share(leakBefore)}) -> ${leakAfter} px (${share(leakAfter)})`,
      );
    });
  });
}

console.log(
  `\n=== GARMENT-LEVEL (IoU >= ${GARMENT_LEVEL}) over ${thingsTotal} things: ${garmentBefore} before -> ${garmentAfter} after ===`,
);
console.log("Spend: nothing. No provider call; the court's saved masks were replayed.");

process.exit(0);
