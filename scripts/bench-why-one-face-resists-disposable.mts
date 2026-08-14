/**
 * WHY DOES ONE FACE RESIST EVERY ARM? (fable-555 §4 — approved regardless of
 * the founder's answer, reads before renders, quote before hypothesis.)
 *
 * fair-long drifts about double her sisters under every arm and under none:
 *
 * ```
 *                W      A′     T      S      floor
 *   fair-short   4.98   1.90   3.14   1.71   0.60
 *   fair-long    8.73   2.02   4.59   4.22   1.32   ← and the highest floor
 *   fair-dark    2.50   2.93   2.13   1.95   0.74
 * ```
 *
 * # The reading, before any hypothesis is named
 *
 * Every ΔE above compares the mean colour inside her skin mask on v1 with the
 * mean inside her skin mask on v2 — and those are TWO DIFFERENT SETS OF PIXELS.
 * If her mask moves between frames (long hair falling differently over a neck
 * and shoulders would do it), part of what is being called drift is a change in
 * WHICH pixels are averaged, not in what colour they are.
 *
 * So each pair is read twice:
 *
 * ```
 *   FULL     mean(v2 inside its own mask) vs mean(v1 inside its own mask)
 *   SHARED   both means taken inside mask(v1) ∩ mask(v2) — the same pixels
 * ```
 *
 * A face whose SHARED drift collapses while its FULL drift stays high is being
 * measured, not tanned. A face where the two agree drifted for real.
 *
 * The control is built in: three faces, two arms each, the same instrument. If
 * the gap appears on all three the reading says something about the metric; if
 * it appears only on fair-long it says something about her.
 *
 * And one more number, taken for the hypothesis that will follow either way:
 * how much of her skin sits WITHIN 12px OF HER HAIR — because the chain edit is
 * "copper red hair", and a face wearing more hair against more skin has more of
 * its skin next to the thing being repainted.
 *
 * ~18 segmenter reads, about nine cents. NO generations, nothing written.
 *
 *   npx tsx scripts/bench-why-one-face-resists-disposable.mts
 */
import "dotenv/config";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "output/skin-carrier";
const LOG = `${OUT}/why-one-face.log`;
if (!existsSync(LOG)) writeFileSync(LOG, "");
function say(line = "") {
  console.log(line);
  appendFileSync(LOG, `${line}\n`);
}
if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");

const FACES = ["fair-short", "fair-long", "fair-dark"];
const ARMS = [
  { name: "W", file: (face: string) => `${OUT}/${face}-rerun-v2-W.png` },
  { name: "S", file: (face: string) => `${OUT}/${face}-v2-S.png` },
];
/** The full-mask numbers already measured, quoted so the two columns sit side by side. */
const FULL: Record<string, Record<string, number>> = {
  "fair-short": { W: 4.98, S: 1.71 },
  "fair-long": { W: 8.73, S: 4.22 },
  "fair-dark": { W: 2.50, S: 1.95 },
};

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

async function meanLabIn(bytes: Buffer, mask: Buffer, width: number, height: number): Promise<Lab | null> {
  const { data, info } = await sharp(bytes)
    .resize(width, height, { fit: "fill" }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let p = 0; p < width * height; p += 1) {
    if (mask[p]! <= 127) continue;
    const at = p * info.channels;
    r += data[at]!; g += data[at + 1]!; b += data[at + 2]!; n += 1;
  }
  return n === 0 ? null : rgbToLab(r / n, g / n, b / n);
}
async function regionOf(bytes: Buffer, name: string): Promise<Mask | null> {
  try { return await reader.region({ image: bytes, name }) as Mask; }
  catch (error) { say(`      [no read] ${name}: ${error instanceof Error ? error.message : String(error)}`); return null; }
}
async function at(mask: Mask, width: number, height: number): Promise<Buffer> {
  if (mask.width === width && mask.height === height) return mask.data;
  return sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
    .resize(width, height, { fit: "fill" }).toColourspace("b-w").raw().toBuffer();
}
/** Every pixel within `r` (Chebyshev) of an on pixel — a dilation, for "next to". */
function dilate(mask: Buffer, width: number, height: number, radius: number): Uint8Array {
  const horizontal = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 0;
      for (let dx = -radius; dx <= radius && on === 0; dx += 1) {
        const px = x + dx;
        if (px >= 0 && px < width && mask[y * width + px]! > 127) on = 1;
      }
      horizontal[y * width + x] = on;
    }
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 0;
      for (let dy = -radius; dy <= radius && on === 0; dy += 1) {
        const py = y + dy;
        if (py >= 0 && py < height && horizontal[py * width + x] === 1) on = 1;
      }
      out[y * width + x] = on;
    }
  }
  return out;
}

const rows: any[] = [];
for (const face of FACES) {
  say(`\n${"-".repeat(78)}`);
  say(`FACE ${face}`);
  say("-".repeat(78));
  const v1Bytes = readFileSync(`${OUT}/${face}-v1.png`);
  const meta = await sharp(v1Bytes).metadata();
  const width = meta.width!, height = meta.height!;

  const v1Skin = await regionOf(v1Bytes, "face skin");
  const v1Hair = await regionOf(v1Bytes, "hair");
  if (!v1Skin) { say("  no skin read on v1 — skipped"); continue; }
  const v1SkinAt = await at(v1Skin, width, height);
  let v1Px = 0;
  for (let p = 0; p < width * height; p += 1) if (v1SkinAt[p]! > 127) v1Px += 1;

  /* How much of her skin sits within 12px of her hair — the same margin the
     cuts use, so "next to" means the same thing everywhere in this program. */
  let adjacent = 0;
  if (v1Hair) {
    const hairAt = await at(v1Hair, width, height);
    const near = dilate(hairAt, width, height, 12);
    for (let p = 0; p < width * height; p += 1) if (v1SkinAt[p]! > 127 && near[p] === 1) adjacent += 1;
  }
  say(`  her skin on v1: ${v1Px}px · of that, ${adjacent}px (${((adjacent / Math.max(1, v1Px)) * 100).toFixed(1)}%) sits within 12px of her hair`);

  const armRows: any[] = [];
  for (const arm of ARMS) {
    const file = arm.file(face);
    if (!existsSync(file)) { say(`  ${arm.name}: no frame`); continue; }
    const v2Bytes = readFileSync(file);
    const v2Skin = await regionOf(v2Bytes, "face skin");
    if (!v2Skin) { say(`  ${arm.name}: no skin read`); continue; }
    const v2SkinAt = await at(v2Skin, width, height);
    const shared = Buffer.alloc(width * height);
    let v2Px = 0, sharedPx = 0, unionPx = 0;
    for (let p = 0; p < width * height; p += 1) {
      const a = v1SkinAt[p]! > 127, b = v2SkinAt[p]! > 127;
      if (b) v2Px += 1;
      if (a || b) unionPx += 1;
      if (a && b) { shared[p] = 255; sharedPx += 1; }
    }
    const v1Full = await meanLabIn(v1Bytes, v1SkinAt, width, height);
    const v2Full = await meanLabIn(v2Bytes, v2SkinAt, width, height);
    const v1Shared = await meanLabIn(v1Bytes, shared, width, height);
    const v2Shared = await meanLabIn(v2Bytes, shared, width, height);
    if (!v1Full || !v2Full || !v1Shared || !v2Shared) { say(`  ${arm.name}: NO READ`); continue; }
    const full = deltaE(v2Full, v1Full);
    const sharedDrift = deltaE(v2Shared, v1Shared);
    const iou = sharedPx / Math.max(1, unionPx);
    say(`  ${arm.name}: mask v1 ${v1Px}px · v2 ${v2Px}px · shared ${sharedPx}px · IoU ${(iou * 100).toFixed(1)}%`);
    say(`     v1 ${fmt(v1Full)} → v2 ${fmt(v2Full)}   FULL   ${full.toFixed(2)} (quoted ${FULL[face]?.[arm.name]?.toFixed(2) ?? "—"})`);
    say(`     same pixels only                        SHARED ${sharedDrift.toFixed(2)}`);
    armRows.push({ arm: arm.name, full, sharedDrift, iou, v1Px, v2Px, sharedPx });
  }
  rows.push({ face, v1Px, adjacent, adjacentFraction: adjacent / Math.max(1, v1Px), arms: armRows });
  writeFileSync(`${OUT}/why-one-face.json`, JSON.stringify(rows, null, 2));
}

say(`\n${"=".repeat(78)}`);
say("IS THE DRIFT COLOUR, OR IS IT THE MASK MOVING?");
say("=".repeat(78));
say("face          arm   FULL    SHARED   difference   IoU     skin next to hair");
for (const row of rows) {
  for (const arm of row.arms) {
    say(`${row.face.padEnd(13)} ${arm.arm.padEnd(5)} ${arm.full.toFixed(2).padStart(5)}   ${arm.sharedDrift.toFixed(2).padStart(6)}`
      + `   ${(arm.full - arm.sharedDrift).toFixed(2).padStart(10)}   ${(arm.iou * 100).toFixed(1).padStart(5)}%   ${(row.adjacentFraction * 100).toFixed(1)}%`);
  }
}
writeFileSync(`${OUT}/why-one-face.json`, JSON.stringify(rows, null, 2));
process.exit(0);
