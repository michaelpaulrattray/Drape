/**
 * WHAT EACH FRAME ACTUALLY PAINTED ON HER NOSE — the master subtracted out.
 *
 * Two instruments now disagree with my own eye. The density counter puts frames
 * 03 and 04 within 3% of her bare floor; the production reader says ABSENT on
 * both, five times out of five, at every lens including the 2× crop — while
 * saying PRESENT five out of five on 01 and 05 and ABSENT five out of five on
 * her master. I looked at the four cheek bands at 8× and read freckles in all
 * of them, which is exactly the declaration this bench overturned once already
 * (run-12's frame 04).
 *
 * So the artifact is made to answer without a threshold and without a model.
 * Every render is a base-anchored composite of ONE master at ONE pose (D-86),
 * so |frame − master| is not an approximation of what changed — it IS what
 * changed. Amplified, on the same window for every frame.
 *
 * A frame that painted freckles shows them as bright specks. A frame that did
 * not shows the compositing noise and nothing else.
 *
 *   npx tsx scripts/diff-run15-frames-disposable.mts
 */
import sharp from "sharp";

const MASTER = "output/marks-court/MASTER-run15.png";
const WALK = "output/walk/2026-08-08T19-59-45-742Z";
const FRAMES = [
  { name: "01 freckles", file: `${WALK}/01-delivered.png` },
  { name: "03 gloss", file: `${WALK}/03-delivered.png` },
  { name: "04 hoops", file: `${WALK}/04-delivered.png` },
  { name: "05 removal", file: `${WALK}/05-delivered.png` },
];

/* Her nose and cheeks, in master coordinates — the band the counter used,
   read straight off `output/marks-court/PATCH-00.png`'s placement. */
const WINDOW = { left: 300, top: 620, width: 430, height: 170 };
const SCALE = 3;
/* Enough to make a two-level difference visible; not enough to saturate the
   composite's own blend band into a solid wall. */
const AMPLIFY = 12;

const master = await sharp(MASTER).extract(WINDOW).greyscale().raw()
  .toBuffer({ resolveWithObject: true });

const tiles: Buffer[] = [];
console.log("frame          mean |Δ|   px over 8 levels");
console.log("-".repeat(48));
for (const frame of FRAMES) {
  const other = await sharp(frame.file).extract(WINDOW).greyscale().raw()
    .toBuffer({ resolveWithObject: true });
  const diff = Buffer.alloc(master.data.length);
  let total = 0;
  let loud = 0;
  for (let pixel = 0; pixel < diff.length; pixel += 1) {
    const delta = Math.abs(master.data[pixel]! - other.data[pixel]!);
    total += delta;
    if (delta >= 8) loud += 1;
    diff[pixel] = Math.min(255, delta * AMPLIFY);
  }
  console.log(`${frame.name.padEnd(14)} ${(total / diff.length).toFixed(2).padStart(8)}`
    + `   ${String(loud).padStart(8)}`);
  tiles.push(await sharp(diff, { raw: { width: WINDOW.width, height: WINDOW.height, channels: 1 } })
    .resize({ width: WINDOW.width * SCALE, kernel: "nearest" }).png().toBuffer());
}

const tileHeight = WINDOW.height * SCALE;
await sharp({
  create: {
    width: WINDOW.width * SCALE,
    height: (tileHeight + 6) * tiles.length,
    channels: 3,
    background: { r: 255, g: 0, b: 0 },
  },
})
  .composite(tiles.map((input, index) => ({ input, left: 0, top: index * (tileHeight + 6) })))
  .png()
  .toFile("output/marks-court/DIFF-run15.png");

console.log(`\nwritten output/marks-court/DIFF-run15.png — top to bottom: ${FRAMES.map((f) => f.name).join(" / ")}`);
