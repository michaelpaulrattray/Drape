/**
 * DOES A CARRIER HOLD THE REGION IT DEPICTS? — the reading that turns arm T's
 * negative into an explanation, bought on frames already rendered.
 *
 * # What arm T just said, and what it did not
 *
 * A tone sample cut from BELOW her chin beats words on 3 of 3 faces (R 3.14 /
 * 4.59 / 2.13 against W's 4.98 / 8.73 / 2.50), costs no identity (E inside the
 * bar on 3 of 3, where the face cut A′ managed 1 of 3) and pulls her face
 * nowhere. It still misses the effect bar: median R 3.14 against <= 1.66.
 *
 * So it half-works, and the interesting question is WHICH half.
 *
 * # The hypothesis, stated for killing
 *
 * **A crop holds the region it DEPICTS, not the property it is labelled with.**
 * If that is right, then on the same chained frames:
 *
 * ```
 *   T   (a crop of her NECK)   her below-chin skin holds · her face drifts
 *   A′  (a crop of her FACE)   her face holds            · her below-chin drifts
 *   W   (words)                both drift
 * ```
 *
 * It would explain the whole shape of the skin problem: what pins a tone is a
 * picture of the surface in the place it must appear, so a tone on her FACE
 * needs a face-region carrier — which is the road that costs identity and is
 * already closed. And it would predict the build carrier's success (a below-head
 * crop pinning a below-head fact) without being fitted to it.
 *
 * If instead T's own region drifts too, the sample holds nothing anywhere and
 * the road is simply dead — which is also a clean answer.
 *
 * # The instrument
 *
 * Same as everywhere: `meanLabIn` + CIE76. The below-chin region is the
 * segmenter's `skin` below the bottom of its `face` box, eroded 12px — the
 * pre-flight's own cut, whose artifact was opened and is her neck, chest and
 * arms with no shirt in it. The floor is each face's own floor frame (an
 * unrelated edit, no tone ever asked) read in the SAME region, so the below-chin
 * numbers are judged against a below-chin floor and never against the face's.
 *
 * ~30 segmenter reads, about fifteen cents of house money. NO generations.
 *
 *   npx tsx scripts/bench-region-it-depicts-disposable.mts
 */
import "dotenv/config";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "output/skin-carrier";
const LOG = `${OUT}/region-it-depicts.log`;
if (!existsSync(LOG)) writeFileSync(LOG, "");
function say(line = "") {
  console.log(line);
  appendFileSync(LOG, `${line}\n`);
}
if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");

const FACES = ["fair-short", "fair-long", "fair-dark"];
const MARGIN = 12;

const sharp = (await import("sharp")).default;
const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

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

async function meanLabIn(bytes: Buffer, mask: Mask): Promise<Lab | null> {
  const { data, info } = await sharp(bytes)
    .resize(mask.width, mask.height, { fit: "fill" }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let p = 0; p < mask.width * mask.height; p += 1) {
    if (mask.data[p]! <= 127) continue;
    const at = p * info.channels;
    r += data[at]!; g += data[at + 1]!; b += data[at + 2]!; n += 1;
  }
  return n === 0 ? null : rgbToLab(r / n, g / n, b / n);
}
async function regionOf(bytes: Buffer, name: string): Promise<Mask | null> {
  try { return await reader.region({ image: bytes, name }) as Mask; }
  catch (error) { say(`      [no read] ${name}: ${error instanceof Error ? error.message : String(error)}`); return null; }
}
function erode(allowed: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const horizontal = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = 1;
      for (let dx = -radius; dx <= radius && keep === 1; dx += 1) {
        const at = x + dx;
        if (at < 0 || at >= width || allowed[y * width + at] === 0) keep = 0;
      }
      horizontal[y * width + x] = keep;
    }
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = 1;
      for (let dy = -radius; dy <= radius && keep === 1; dy += 1) {
        const at = y + dy;
        if (at < 0 || at >= height || horizontal[at * width + x] === 0) keep = 0;
      }
      out[y * width + x] = keep;
    }
  }
  return out;
}
async function at(mask: Mask, width: number, height: number): Promise<Buffer> {
  if (mask.width === width && mask.height === height) return mask.data;
  return sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
    .resize(width, height, { fit: "fill" }).toColourspace("b-w").raw().toBuffer();
}

/** Her skin below the bottom of her own face box, on THIS frame. Each frame is
 *  cut by its own chin line — a carried box would measure a moved head. */
async function belowChinLab(bytes: Buffer, label: string): Promise<{ lab: Lab | null; px: number }> {
  const meta = await sharp(bytes).metadata();
  const width = meta.width!, height = meta.height!;
  const skin = await regionOf(bytes, "skin");
  const face = await regionOf(bytes, "face");
  if (!skin || !face) { say(`      ${label}: NO READ`); return { lab: null, px: 0 }; }
  const skinAt = await at(skin, width, height);
  const faceAt = await at(face, width, height);
  let chin = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) if (faceAt[y * width + x]! > 127 && y > chin) chin = y;
  }
  if (chin < 0) { say(`      ${label}: no face bottom`); return { lab: null, px: 0 }; }
  const allowed = new Uint8Array(width * height);
  for (let y = chin + 1; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      if (skinAt[p]! > 127) allowed[p] = 1;
    }
  }
  const pulled = erode(allowed, width, height, MARGIN);
  let px = 0;
  const mask = Buffer.alloc(width * height);
  for (let p = 0; p < pulled.length; p += 1) if (pulled[p] === 1) { mask[p] = 255; px += 1; }
  if (px === 0) { say(`      ${label}: nothing survives the erosion`); return { lab: null, px: 0 }; }
  const lab = await meanLabIn(bytes, { data: mask, width, height });
  say(`      ${label}: below-chin ${lab ? fmt(lab) : "NO READ"} (${px}px, chin y=${chin})`);
  return { lab, px };
}

const rows: any[] = [];
for (const face of FACES) {
  say(`\n${"-".repeat(78)}`);
  say(`FACE ${face}`);
  say("-".repeat(78));
  const frames = {
    master: `${OUT}/${face}-master.png`,
    floor: `${OUT}/${face}-floor.png`,
    v1: `${OUT}/${face}-v1.png`,
    W: `${OUT}/${face}-rerun-v2-W.png`,
    Aprime: `${OUT}/${face}-rerun-v2-Aprime.png`,
    T: `${OUT}/${face}-v2-T.png`,
  };
  const read: Record<string, Lab | null> = {};
  for (const [label, file] of Object.entries(frames)) {
    if (!existsSync(file)) { say(`      ${label}: no such frame — ${file}`); read[label] = null; continue; }
    read[label] = (await belowChinLab(readFileSync(file), label)).lab;
  }
  if (!read.master || !read.floor || !read.v1) { say("  not enough reads on this face"); continue; }
  const Fbelow = deltaE(read.floor, read.master);
  const Sbelow = deltaE(read.v1, read.master);
  say(`    F(below) ${Fbelow.toFixed(2)} · S(below) ${Sbelow.toFixed(2)}`);
  const drift: Record<string, number | null> = {};
  for (const arm of ["W", "Aprime", "T"]) {
    drift[arm] = read[arm] ? deltaE(read[arm]!, read.v1) : null;
  }
  say(`    below-chin drift from v1:  W ${drift.W?.toFixed(2) ?? "—"} · A′ ${drift.Aprime?.toFixed(2) ?? "—"} · T ${drift.T?.toFixed(2) ?? "—"}  (floor ${Fbelow.toFixed(2)})`);
  rows.push({ face, Fbelow, Sbelow, drift });
  writeFileSync(`${OUT}/region-it-depicts.json`, JSON.stringify(rows, null, 2));
}

/* The face numbers are the ones already measured, quoted rather than re-read. */
const FACE_DRIFT: Record<string, Record<string, number>> = {
  "fair-short": { W: 4.98, Aprime: 1.90, T: 3.14 },
  "fair-long": { W: 8.73, Aprime: 2.02, T: 4.59 },
  "fair-dark": { W: 2.50, Aprime: 2.93, T: 2.13 },
};

say(`\n${"=".repeat(78)}`);
say("WHERE EACH CARRIER HELD — drift from v1, by REGION");
say("=".repeat(78));
say("face          arm     her FACE   her BELOW-CHIN   below-chin floor");
for (const row of rows) {
  for (const arm of ["W", "Aprime", "T"]) {
    say(`${row.face.padEnd(13)} ${arm.padEnd(7)} ${(FACE_DRIFT[row.face]?.[arm]?.toFixed(2) ?? "—").padStart(7)}    `
      + `${(row.drift[arm]?.toFixed(2) ?? "—").padStart(9)}        ${row.Fbelow.toFixed(2)}`);
  }
}
say("");
say("THE HYPOTHESIS: a crop holds the region it DEPICTS.");
let held = 0, total = 0;
for (const row of rows) {
  const t = row.drift.T, a = row.drift.Aprime;
  if (t === null || a === undefined || a === null) continue;
  total += 1;
  const tHoldsItsOwn = t < a;
  if (tHoldsItsOwn) held += 1;
  say(`  ${row.face.padEnd(13)} T's own region drifted ${t.toFixed(2)} vs A′'s ${a.toFixed(2)} there → ${tHoldsItsOwn ? "T holds its own region better" : "it does NOT"}`);
}
say(`  → ${held}/${total}`);
writeFileSync(`${OUT}/region-it-depicts.json`, JSON.stringify(rows, null, 2));
process.exit(0);
