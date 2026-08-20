/**
 * THE HALO, COUNTED — free, no call.
 *
 * Round two's model answer carries a bright speckled rim along the design's
 * boundary that round one's did not, and the only thing that changed between
 * them is what sat under the alpha (a photograph, then black). This counts it
 * instead of describing it: pixels INSIDE the kept mask whose luminance exceeds
 * anything the original cut held there.
 *
 * Same design, same mask, same model, one variable — so the two counts are
 * comparable and the difference is the finding rather than the adjective.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const REPO = resolve(import.meta.dirname, "..");
const CUT = resolve(REPO, "output/court-region-floor/S1-upperArm-native-183x353.png");

async function rgba(file: string) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/* The brightest thing the CUSTOMER'S OWN cut contains, inside the mask — the
   bar the enlargement is judged against, taken from her picture and not chosen. */
const source = await rgba(CUT);
let brightest = 0;
for (let at = 0; at < source.width * source.height; at += 1) {
  if (source.data[at * 4 + 3] === 0) continue;
  brightest = Math.max(brightest, luma(source.data[at * 4], source.data[at * 4 + 1], source.data[at * 4 + 2]));
}
console.log(`the original cut's brightest kept pixel: luma ${brightest.toFixed(1)}\n`);

for (const [label, dir] of [
  ["round 1  (a photograph under the alpha)", "output/court-upscale-alpha"],
  ["round 2  (black under the alpha)", "output/court-upscale-alpha-2"],
] as const) {
  const composed = await rgba(resolve(REPO, dir, "2-recomposite-soft.png"));
  let kept = 0;
  let over = 0;
  for (let at = 0; at < composed.width * composed.height; at += 1) {
    if (composed.data[at * 4 + 3] === 0) continue;
    kept += 1;
    if (luma(composed.data[at * 4], composed.data[at * 4 + 1], composed.data[at * 4 + 2]) > brightest) over += 1;
  }
  console.log(`${label}`);
  console.log(`   kept pixels ${kept}, brighter than anything in her cut: ${over}`
    + ` (${((over / kept) * 100).toFixed(2)}%)`);

  /* And a picture of exactly those pixels, so the number is not the only claim. */
  const paint = Buffer.alloc(composed.width * composed.height * 4);
  for (let at = 0; at < composed.width * composed.height; at += 1) {
    const bright = composed.data[at * 4 + 3] !== 0
      && luma(composed.data[at * 4], composed.data[at * 4 + 1], composed.data[at * 4 + 2]) > brightest;
    paint[at * 4] = bright ? 255 : 0;
    paint[at * 4 + 1] = 0;
    paint[at * 4 + 2] = bright ? 255 : 0;
    paint[at * 4 + 3] = bright ? 255 : 40;
  }
  await writeFile(
    resolve(REPO, dir, "halo-map.png"),
    await sharp(paint, { raw: { width: composed.width, height: composed.height, channels: 4 } }).png().toBuffer(),
  );
  console.log(`   -> ${dir}/halo-map.png\n`);
}

process.exit(0);
