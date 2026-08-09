/**
 * THE CARRIED FIXTURE'S NOSE, AT 5x — master, painted, composed.
 *
 * The whole-face contact sheet cannot answer a question about freckles: they
 * are a few pixels across at that size, which is the finding this whole class
 * rests on. Same window on all three, nearest-neighbour.
 *
 *   npx tsx scripts/zoom-carried-fixture-disposable.mts <dir>
 */
import sharp from "sharp";

const DIR = process.argv[2] ?? "output/masked/freckles-carried";
const FILES = [`${DIR}/../../marks-court/MASTER-run15.png`, `${DIR}/painted.png`, `${DIR}/composed.png`];
const SCALE = 5;

const meta = await sharp(FILES[0]!).metadata();
const W = meta.width!;
const H = meta.height!;
/* Her nose and upper cheeks, in master geometry. */
const WINDOW = {
  left: Math.round(W * 0.34), top: Math.round(H * 0.36),
  width: Math.round(W * 0.32), height: Math.round(H * 0.12),
};

const tiles = await Promise.all(FILES.map(async (file) =>
  sharp(file).resize(W, H, { fit: "fill" }).extract(WINDOW)
    .resize({ width: WINDOW.width * SCALE, kernel: "nearest" }).png().toBuffer()));

const tileHeight = WINDOW.height * SCALE;
await sharp({
  create: {
    width: WINDOW.width * SCALE, height: (tileHeight + 6) * 3,
    channels: 3, background: { r: 255, g: 0, b: 0 },
  },
})
  .composite(tiles.map((input, index) => ({ input, left: 0, top: index * (tileHeight + 6) })))
  .png().toFile(`${DIR}/ZOOM-nose.png`);
console.log(`written ${DIR}/ZOOM-nose.png — master / painted / composed`);
