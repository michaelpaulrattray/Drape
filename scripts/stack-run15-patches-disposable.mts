/**
 * THE FIVE CHEEK BANDS, STACKED AND ENLARGED — so the look and the count see
 * the same pixels.
 *
 * The counter says run-15's frames 01, 03 and 04 sit within 9% of her bare
 * floor while 05 sits 45% above it. A number that small is exactly where a
 * declared truth has been wrong before, in both directions, so it gets looked
 * at — at the resolution the claim needs, on the same population the count
 * used, with her own bare master in the stack as the negative control.
 *
 * Nearest-neighbour: a smooth upscale would hand the eye plausible pigment.
 *
 *   npx tsx scripts/stack-run15-patches-disposable.mts
 */
import sharp from "sharp";

const SCALE = 4;
const LABELS = ["00 master", "01 freckles", "03 gloss", "04 hoops", "05 removal"];
const FILES = ["00", "01", "03", "04", "05"].map((n) => `output/marks-court/PATCH-${n}.png`);

const tiles = await Promise.all(FILES.map(async (file) => {
  const image = sharp(file);
  const meta = await image.metadata();
  return {
    bytes: await image.resize({ width: meta.width! * SCALE, kernel: "nearest" }).png().toBuffer(),
    width: meta.width! * SCALE,
    height: meta.height! * SCALE,
  };
}));

const width = Math.max(...tiles.map((tile) => tile.width));
const height = tiles.reduce((sum, tile) => sum + tile.height + 8, 0);
let top = 0;
const composites = tiles.map((tile) => {
  const entry = { input: tile.bytes, left: 0, top };
  top += tile.height + 8;
  return entry;
});

await sharp({ create: { width, height, channels: 3, background: { r: 20, g: 20, b: 20 } } })
  .composite(composites)
  .png()
  .toFile("output/marks-court/STACK-run15.png");

console.log(`written output/marks-court/STACK-run15.png — ${width}x${height}, top to bottom: ${LABELS.join(" / ")}`);
