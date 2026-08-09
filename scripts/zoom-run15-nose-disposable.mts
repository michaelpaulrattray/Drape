/**
 * THE NOSE BRIDGE AT 8x — master against the two frames the reader called clear.
 *
 * The counter puts frames 03 and 04 within 3% of her bare floor, which would
 * mean the freckles are not in them. The 4x stack says otherwise. A 3% margin
 * on a band whose floor is 77 specks of her own pore texture is not a number
 * that can settle it, so the artifact decides — at the resolution the claim
 * needs, with her own bare skin in the same picture.
 *
 *   npx tsx scripts/zoom-run15-nose-disposable.mts
 */
import sharp from "sharp";

const SCALE = 8;
/* The centre of the band, where her nose bridge sits — the same box on every
   tile, because a comparison whose window moves is not a comparison. */
const WINDOW = { left: 100, top: 8, width: 100, height: 60 };
const TILES = ["00", "01", "03", "04", "05"];

const parts = await Promise.all(TILES.map(async (name) =>
  sharp(`output/marks-court/PATCH-${name}.png`)
    .extract(WINDOW)
    .resize({ width: WINDOW.width * SCALE, kernel: "nearest" })
    .png()
    .toBuffer()));

const tileHeight = WINDOW.height * SCALE;
await sharp({
  create: {
    width: WINDOW.width * SCALE,
    height: (tileHeight + 6) * TILES.length,
    channels: 3,
    background: { r: 255, g: 0, b: 0 },
  },
})
  .composite(parts.map((input, index) => ({ input, left: 0, top: index * (tileHeight + 6) })))
  .png()
  .toFile("output/marks-court/ZOOM-run15-nose.png");

console.log(`written output/marks-court/ZOOM-run15-nose.png — top to bottom: ${TILES.join(" / ")}`);
