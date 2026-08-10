/**
 * HOW THICK IS THE RING, IN PIXELS — because that number decides whether area
 * coverage can score this kind at all.
 *
 * Coverage is |crop ∩ region| / |region|. For a solid blob the denominator is
 * mostly interior and a one-pixel boundary disagreement costs a few percent.
 * For a RING the denominator IS the boundary: a shape t pixels thick loses
 * roughly 1/t of its area for every pixel of disagreement. Measured here rather
 * than estimated from area ÷ perimeter, because a perimeter estimate of a
 * crescent is a guess wearing arithmetic.
 *
 * Free: one R2 read per row, no model, no database write.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import sharp from "sharp";
import { fetchImageBytes } from "./lib/imageBytes.mts";

type Shape = { w: number; h: number; data: Uint8Array };

/** Chebyshev distance transform, two passes. Exact for this metric. */
function shellFractionOf(shape: Shape): { area: number; thickest: number; shell: number } {
  const { w, h, data } = shape;
  const BIG = 1 << 20;
  const dist = new Int32Array(w * h);
  for (let index = 0; index < w * h; index += 1) dist[index] = data[index]! > 0 ? BIG : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : dist[y * w + x]!);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    if (dist[y * w + x] === 0) continue;
    dist[y * w + x] = Math.min(dist[y * w + x]!, at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1, at(x + 1, y - 1) + 1);
  }
  for (let y = h - 1; y >= 0; y -= 1) for (let x = w - 1; x >= 0; x -= 1) {
    if (dist[y * w + x] === 0) continue;
    dist[y * w + x] = Math.min(dist[y * w + x]!, at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1, at(x - 1, y + 1) + 1);
  }
  let area = 0;
  let thickest = 0;
  let shell = 0;
  for (const depth of dist) {
    if (depth === 0) continue;
    area += 1;
    if (depth > thickest) thickest = depth;
    if (depth === 1) shell += 1;
  }
  return { area, thickest, shell };
}

/*
  THE CONTROLS, BEFORE THE FINDING (working law 2). The whole conclusion below
  rests on one number — what fraction of a shape a single pixel of erosion
  removes — so the measure gets a shape whose answer is known from geometry at
  both ends before it is allowed to say anything about a hoop.
*/
{
  const disc: Shape = { w: 41, h: 41, data: new Uint8Array(41 * 41) };
  for (let y = 0; y < 41; y += 1) for (let x = 0; x < 41; x += 1) {
    if ((x - 20) ** 2 + (y - 20) ** 2 <= 20 * 20) disc.data[y * 41 + x] = 255;
  }
  const solid = shellFractionOf(disc);
  /* A disc of radius 20: the shell is one ring of ~2πr out of ~πr², so ~2/r =
     10%, and the thickest place is the full diameter. */
  console.log(`CONTROL solid disc r=20   area ${solid.area}  thickest ${solid.thickest * 2 - 1} px`
    + `  shell ${((solid.shell / solid.area) * 100).toFixed(1)}%   (geometry says ~10%)`);
  if (solid.shell / solid.area > 0.2) throw new Error("the shell measure calls a solid disc mostly boundary — it is wrong");

  const line: Shape = { w: 41, h: 41, data: new Uint8Array(41 * 41) };
  for (let x = 4; x < 37; x += 1) line.data[20 * 41 + x] = 255;
  const thin = shellFractionOf(line);
  /* A one-pixel line is ALL boundary: erode it by a pixel and nothing is left. */
  console.log(`CONTROL 1px line          area ${thin.area}  thickest ${thin.thickest * 2 - 1} px`
    + `  shell ${((thin.shell / thin.area) * 100).toFixed(1)}%   (geometry says 100%)`);
  if (thin.shell !== thin.area) throw new Error("the shell measure does not call a 1px line entirely boundary — it is wrong");
  console.log("");
}

const uri = process.env.DATABASE_URL!;
if (new URL(uri).port !== "52008") throw new Error("not the dev database");
const bucket = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
const c = await mysql.createConnection({ uri, timezone: "Z" });
const [rows] = await c.query<any[]>(
  "SELECT slot, refusedMaskKey k, refusedBboxW w, refusedBboxH h FROM casting_reference_library"
  + " WHERE refusedContentKey IS NOT NULL ORDER BY id");
await c.end();

for (const r of rows) {
  const raw = await sharp((await fetchImageBytes(`${bucket}/${r.k}`)).bytes).greyscale().raw().toBuffer();
  const { area, thickest, shell } = shellFractionOf({ w: r.w, h: r.h, data: new Uint8Array(raw) });
  console.log(`${r.slot.padEnd(14)} box ${r.w}x${r.h}  area ${String(area).padStart(4)} px`
    + `  thickest ${thickest * 2 - 1} px`
    + `  depth-1 shell ${String(shell).padStart(4)} px = ${((shell / area) * 100).toFixed(1)}% of the area`);
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
