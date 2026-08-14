/**
 * CAN A TONE BE CARRIED BY A SAMPLE TAKEN BELOW HER CHIN? — the pre-flight,
 * bought on frames that are already on disk.
 *
 * # Why this question, and why it is not the closed one
 *
 * Skin closed as a carrier (fable-423 §1) on a FACE cut: 1 of 3 survived and
 * the identity cost was real, which the same ruling explained — *a carrier's
 * identity cost scales with how much of her facial GEOMETRY it contains*. The
 * build carrier proved the other half of that sentence: a below-head crop
 * contains no face, and it keeps 92–109% of a delivered build where words keep
 * nothing.
 *
 * So the untried cut is the one below her chin: her own skin, no facial
 * geometry, ridden as a PROPERTY sample ("her skin tone, sampled from her neck
 * and shoulders") and never as an EXTENT claim (fable-409 §1, which is what the
 * catalogue's `skin` note refuses and rightly).
 *
 * # Two readings decide whether a render bench is worth buying, and both are
 * # taken on the tan court's own frames
 *
 * A render bench is ~20 generations. These two are ~17 segmenter calls on
 * pictures already paid for, and either one can kill the road for a dollar.
 *
 * ```
 * B1  IS THERE ANYTHING TO SAMPLE?   below-chin skin, eroded 12px (the skin
 *     bench's own correction: SAM's masks are tight, so the shadow around a
 *     feature survives as "skin"). BAR: >= 10,000px — a hundred-square — on at
 *     least 5 of the 7 frames. Under that, a portrait has no sample to give and
 *     the road is dead for the framing this product actually casts.
 *
 * B2  DOES THE TAN EVEN REACH IT?    dE(belowChin(tan), belowChin(master)),
 *     against the tan court's own floor F = 0.93. BAR: >= 2.79 (3F) on at least
 *     2 of 3 tans. This is the arm that can kill the idea outright: if the ask
 *     tans her FACE only, then a below-chin sample carries her ORIGINAL tone and
 *     riding it would erase the tan she paid for rather than hold it.
 *
 * B3  DOES IT SAY THE SAME COLOUR SHE DOES?   O = dE(faceSkin, belowChin) on
 *     each frame. Reported raw rather than barred, because it is a correction
 *     term and not a verdict: a neck sits under a jaw's shadow, so some offset
 *     is expected and only its SIZE decides whether the sample can wear the
 *     label. Read against the tan's own signal (dE 17.5) for scale.
 * ```
 *
 * # The instrument gets its own control
 *
 * "skin" may be a word the segmenter answers with a FACE. On the master only,
 * four phrasings are measured for below-chin area — if none of them answers
 * below the chin, B1 has failed for an instrument reason rather than a product
 * one, and those are different findings.
 *
 * Metric: `meanLabIn` + CIE76, lifted from the skin-carrier bench so every
 * number here is comparable to the ones that closed the face cut (law 4).
 *
 * House money: ~17 segmenter calls, about nine cents. No generations, no user
 * credits, no writes.
 *
 *   npx tsx scripts/bench-tone-below-chin-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";

const IN = "output/tan-court";
const OUT = "output/tone-below-chin";
mkdirSync(OUT, { recursive: true });
if (!process.env.FAL_KEY) throw new Error("FAL_KEY is required");

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };

/** The tan court's own numbers, so this bench borrows its scale rather than inventing one. */
const FLOOR = 0.93;          // two renders of one face, no tone ever asked
const TAN_SIGNAL = 17.51;    // the tan ask, measured on the face
const B2_BAR = 3 * FLOOR;

const FRAMES = [
  { name: "master", file: `${IN}/master.png`, kind: "master" as const },
  { name: "tan-1", file: `${IN}/tan-1.png`, kind: "tan" as const },
  { name: "tan-2", file: `${IN}/tan-2.png`, kind: "tan" as const },
  { name: "tan-3", file: `${IN}/tan-3.png`, kind: "tan" as const },
  { name: "chain-1", file: `${IN}/chain-tan-1.png`, kind: "chain" as const },
  { name: "chain-2", file: `${IN}/chain-tan-2.png`, kind: "chain" as const },
  { name: "chain-3", file: `${IN}/chain-tan-3.png`, kind: "chain" as const },
];

const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });
let calls = 0;

type Lab = { L: number; a: number; b: number };
type Mask = { data: Buffer; width: number; height: number };

function rgbToLab(r8: number, g8: number, b8: number): Lab {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(r8), g = lin(g8), b = lin(b8);
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const Y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  const Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

const deltaE = (p: Lab, q: Lab) =>
  Math.sqrt((p.L - q.L) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2);

const fmt = (lab: Lab) => `L${lab.L.toFixed(1)} a${lab.a.toFixed(1)} b${lab.b.toFixed(1)}`;

/** Mean colour inside a mask. The IMAGE is resized to the mask, never the mask. */
async function meanLabIn(bytes: Buffer, mask: Mask): Promise<Lab | null> {
  const { data, info } = await sharp(bytes)
    .resize(mask.width, mask.height, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let p = 0; p < mask.width * mask.height; p += 1) {
    if (mask.data[p]! <= 127) continue;
    const at = p * info.channels;
    r += data[at]!; g += data[at + 1]!; b += data[at + 2]!;
    n += 1;
  }
  return n === 0 ? null : rgbToLab(r / n, g / n, b / n);
}

/** Chebyshev erosion, two separable passes. A pixel survives only if every
 *  pixel within `r` of it is on — which is what pushes the cut back off a
 *  feature's shadow (skin bench, correction 2). */
function erode(mask: Mask, r: number): Mask {
  const { width, height } = mask;
  const rows = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 1;
      for (let dx = -r; dx <= r && on; dx += 1) {
        const at = x + dx;
        if (at < 0 || at >= width || mask.data[y * width + at]! <= 127) on = 0;
      }
      rows[y * width + x] = on ? 255 : 0;
    }
  }
  const out = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 1;
      for (let dy = -r; dy <= r && on; dy += 1) {
        const at = y + dy;
        if (at < 0 || at >= height || rows[at * width + x]! <= 127) on = 0;
      }
      out[y * width + x] = on ? 255 : 0;
    }
  }
  return { data: out, width, height };
}

function countOn(mask: Mask) {
  let n = 0;
  for (let p = 0; p < mask.data.length; p += 1) if (mask.data[p]! > 127) n += 1;
  return n;
}

function boxOf(mask: Mask) {
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
  return maxY < 0 ? null : { minX, maxX, minY, maxY };
}

/** Everything of `mask` strictly below `y`, and everything at or above it. */
function splitAt(mask: Mask, y: number): { below: Mask; above: Mask } {
  const below = Buffer.alloc(mask.data.length);
  const above = Buffer.alloc(mask.data.length);
  for (let row = 0; row < mask.height; row += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      const at = row * mask.width + x;
      if (mask.data[at]! <= 127) continue;
      if (row > y) below[at] = 255; else above[at] = 255;
    }
  }
  return {
    below: { data: below, width: mask.width, height: mask.height },
    above: { data: above, width: mask.width, height: mask.height },
  };
}

async function regionOf(bytes: Buffer, name: string): Promise<Mask | null> {
  try {
    const mask = await reader.region({ image: bytes, name }) as Mask;
    calls += 1;
    return mask;
  } catch (error) {
    calls += 1;
    say(`      [no read] ${name}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** The sample, painted so it can be LOOKED at rather than only counted. */
async function cutOut(bytes: Buffer, mask: Mask, file: string) {
  const box = boxOf(mask);
  if (!box) return;
  /* The alpha is written per pixel rather than composited: sharp validates a
     composite against the INPUT's size, not the resized one, and the mask is
     the segmenter's size. */
  const { data } = await sharp(bytes)
    .resize(mask.width, mask.height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let p = 0; p < mask.width * mask.height; p += 1) {
    data[p * 4 + 3] = mask.data[p]! > 127 ? 255 : 0;
  }
  const painted = await sharp(data, { raw: { width: mask.width, height: mask.height, channels: 4 } })
    .extract({ left: box.minX, top: box.minY, width: box.maxX - box.minX + 1, height: box.maxY - box.minY + 1 })
    .png()
    .toBuffer();
  writeFileSync(file, painted);
}

/* ============================================================================
   THE INSTRUMENT CONTROL — does "skin" answer below the chin at all?
   ========================================================================== */

const masterBytes = readFileSync(FRAMES[0]!.file);
const faceMaster = await regionOf(masterBytes, "face");
if (!faceMaster) throw new Error("no face read on the master — the bench cannot place a chin line");
const chinMaster = boxOf(faceMaster)!.maxY;

say("=".repeat(78));
say("INSTRUMENT CONTROL — which phrasing answers BELOW the chin? (master only)");
say(`  chin line at y=${chinMaster} of ${faceMaster.height}`);
const PHRASINGS = ["skin", "her skin", "bare skin", "neck"];
const phrasingRows: any[] = [];
for (const phrasing of PHRASINGS) {
  const mask = await regionOf(masterBytes, phrasing);
  if (!mask) { phrasingRows.push({ phrasing, below: 0, total: 0 }); continue; }
  const { below } = splitAt(mask, chinMaster);
  const eroded = erode(below, 12);
  const row = { phrasing, total: countOn(mask), below: countOn(below), eroded: countOn(eroded) };
  phrasingRows.push(row);
  say(`  ${phrasing.padEnd(12)} total ${String(row.total).padStart(7)}px · below chin ${String(row.below).padStart(7)}px · eroded ${String(row.eroded).padStart(6)}px`);
}
const best = [...phrasingRows].sort((a, b) => (b.eroded ?? 0) - (a.eroded ?? 0))[0]!;
say(`  → carrying "${best.phrasing}" into the frames (largest below-chin area after erosion)`);
const SKIN_WORD = best.phrasing as string;

/* ============================================================================
   THE SEVEN FRAMES
   ========================================================================== */

const results: any[] = [];
for (const frame of FRAMES) {
  const bytes = readFileSync(frame.file);
  say("");
  say("-".repeat(78));
  say(`${frame.name}  (${frame.kind})`);
  const face = frame.name === "master" ? faceMaster : await regionOf(bytes, "face");
  const skin = await regionOf(bytes, SKIN_WORD);
  if (!face || !skin) { results.push({ ...frame, read: false }); say("  NO READ"); continue; }
  const chin = boxOf(face)!.maxY;
  const { below, above } = splitAt(skin, chin);
  const belowCut = erode(below, 12);
  const aboveCut = erode(above, 12);
  const belowPx = countOn(belowCut);
  const abovePx = countOn(aboveCut);
  const belowLab = belowPx > 0 ? await meanLabIn(bytes, belowCut) : null;
  const aboveLab = abovePx > 0 ? await meanLabIn(bytes, aboveCut) : null;
  await cutOut(bytes, belowCut, `${OUT}/${frame.name}-belowchin.png`);
  const offset = belowLab && aboveLab ? deltaE(aboveLab, belowLab) : null;
  say(`  chin y=${chin} · below-chin skin ${belowPx}px (${((belowPx / (skin.width * skin.height)) * 100).toFixed(2)}% of frame) · face skin ${abovePx}px`);
  say(`  face  ${aboveLab ? fmt(aboveLab) : "—"}`);
  say(`  below ${belowLab ? fmt(belowLab) : "—"}`);
  say(`  offset O = ${offset === null ? "—" : offset.toFixed(2)}  (the tan's own signal is ${TAN_SIGNAL})`);
  results.push({ ...frame, read: true, chin, belowPx, abovePx, belowLab, aboveLab, offset });
}

/* ============================================================================
   THE THREE READINGS
   ========================================================================== */

const by = (name: string) => results.find((row) => row.name === name);
const master = by("master");

say("");
say("=".repeat(78));
say("B1 — IS THERE ANYTHING TO SAMPLE?   bar: >= 10,000px eroded, on >= 5 of 7");
let enough = 0;
for (const row of results) {
  const ok = (row.belowPx ?? 0) >= 10_000;
  if (ok) enough += 1;
  say(`  ${String(row.name).padEnd(10)} ${String(row.belowPx ?? 0).padStart(7)}px  ${ok ? "yes" : "NO"}`);
}
say(`  → ${enough}/7 frames carry a sample — B1 ${enough >= 5 ? "PASS" : "FAIL"}`);

say("");
say("B2 — DOES THE TAN REACH BELOW THE CHIN?   bar: dE >= " + B2_BAR.toFixed(2) + " on >= 2 of 3");
let reached = 0;
for (const name of ["tan-1", "tan-2", "tan-3"]) {
  const row = by(name);
  if (!row?.belowLab || !master?.belowLab) { say(`  ${name.padEnd(10)} unreadable`); continue; }
  const moved = deltaE(row.belowLab, master.belowLab);
  const face = row.aboveLab && master.aboveLab ? deltaE(row.aboveLab, master.aboveLab) : null;
  const ok = moved >= B2_BAR;
  if (ok) reached += 1;
  say(`  ${name.padEnd(10)} below-chin moved ${moved.toFixed(2)}  ·  her face moved ${face === null ? "—" : face.toFixed(2)}  ${ok ? "yes" : "NO"}`);
}
say(`  → ${reached}/3 — B2 ${reached >= 2 ? "PASS" : "FAIL"}`);

say("");
say("B3 — DOES THE SAMPLE SAY THE COLOUR SHE IS?   raw, for the record");
for (const row of results) {
  say(`  ${String(row.name).padEnd(10)} O = ${row.offset === null || row.offset === undefined ? "—" : row.offset.toFixed(2)}`);
}

say("");
say("AND WHAT THE CHAIN DID TO IT — the drift this carrier would have to beat");
for (let at = 1; at <= 3; at += 1) {
  const tan = by(`tan-${at}`), chain = by(`chain-${at}`);
  if (!tan?.belowLab || !chain?.belowLab) continue;
  const belowDrift = deltaE(chain.belowLab, tan.belowLab);
  const faceDrift = tan.aboveLab && chain.aboveLab ? deltaE(chain.aboveLab, tan.aboveLab) : null;
  say(`  pair ${at}   below-chin drifted ${belowDrift.toFixed(2)}  ·  her face drifted ${faceDrift === null ? "—" : faceDrift.toFixed(2)}`);
}

say("");
say("=".repeat(78));
say(`SPEND: ${calls} segmenter calls ~ $${(calls * 0.005).toFixed(2)} of house money · no generations`);

writeFileSync(`${OUT}/preflight.txt`, `${lines.join("\n")}\n`);
writeFileSync(`${OUT}/preflight.json`, `${JSON.stringify({ word: SKIN_WORD, phrasingRows, results }, null, 2)}\n`);
process.exit(0);
