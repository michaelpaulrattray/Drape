/**
 * WHICH SKIN DID THE MASK LOSE? — the picture behind the shared-pixel reading.
 *
 * `bench-why-one-face-resists` found fair-long's skin mask agreeing with itself
 * only 71% between v1 and v2 while her sisters agreed 98-99%. A number cannot
 * say WHERE, so this paints every pixel the mask held on v1 and dropped on v2
 * onto her own frame and reports which sixth of the frame they lived in.
 *
 * ~2 segmenter reads. Nothing written but the picture.
 *
 *   npx tsx scripts/show-lost-skin-disposable.mts
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
const OUT = "output/skin-carrier";
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });
const face = "fair-long";
const v1 = readFileSync(`${OUT}/${face}-v1.png`);
const v2 = readFileSync(`${OUT}/${face}-v2-S.png`);
const meta = await sharp(v1).metadata();
const W = meta.width!, H = meta.height!;
const at = async (m: any) => (m.width === W && m.height === H) ? m.data
  : sharp(m.data, { raw: { width: m.width, height: m.height, channels: 1 } }).resize(W, H, { fit: "fill" }).toColourspace("b-w").raw().toBuffer();
const a = await at(await reader.region({ image: v1, name: "face skin" }) as any);
const b = await at(await reader.region({ image: v2, name: "face skin" }) as any);
const { data } = await sharp(v1).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const out = Buffer.from(data);
let lost = 0, minY = H, maxY = -1, minX = W, maxX = -1;
const rowCount = new Array(H).fill(0);
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  const p = y * W + x;
  if (a[p]! > 127 && b[p]! <= 127) {
    lost += 1; rowCount[y] += 1;
    out[p*3] = 255; out[p*3+1] = 0; out[p*3+2] = 255;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
  }
}
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).resize(560).png().toFile(`${OUT}/${face}-lost-skin.png`);
const bands = [0,1,2,3,4,5].map(i => {
  const lo = Math.floor(H*i/6), hi = Math.floor(H*(i+1)/6);
  return rowCount.slice(lo, hi).reduce((s,n)=>s+n,0);
});
console.log(`lost ${lost}px · box x ${minX}..${maxX}, y ${minY}..${maxY} of ${H}`);
console.log(`by sixth of the frame (top→bottom): ${bands.join(", ")}`);

process.exit(0);
