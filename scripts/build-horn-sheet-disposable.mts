/**
 * THE HORNS THEMSELVES, PARENT BESIDE CHILD — the reading a number could not
 * give. (fable-566 §1.)
 *
 * The constancy bench normalises horn area and shape against her own face, and
 * on this specimen family it cannot see laterality: asked "horns", the segmenter
 * answers with ONE horn and not always the same one, so the placement axis flips
 * by most of a face-width and means nothing. The extent and aspect numbers
 * survive that; the eye is what settles the rest.
 *
 * Top third of each frame, three specimens, parent / words-carried /
 * crop-carried. No API calls, no spend — every frame was paid for in the
 * survival court.
 *
 *   npx tsx scripts/build-horn-sheet-disposable.mts
 */
import sharp from "sharp";
const IN = "output/horns-court", OUT = "output/horn-constancy";
const SPECS = ["words-2", "words-3", "words-4"];
const COLS = (s: string) => [`${IN}/${s}.png`, `${IN}/words-${s}.png`, `${IN}/crop-${s}.png`];
const W = 420, H = 300;
const tiles: sharp.OverlayOptions[] = [];
for (let r = 0; r < SPECS.length; r += 1) {
  const files = COLS(SPECS[r]!);
  for (let c = 0; c < files.length; c += 1) {
    const meta = await sharp(files[c]!).metadata();
    const crop = await sharp(files[c]!)
      .extract({ left: 0, top: 0, width: meta.width!, height: Math.round(meta.height! * 0.34) })
      .resize(W, H, { fit: "cover" }).png().toBuffer();
    tiles.push({ input: crop, left: 8 + c * (W + 8), top: 30 + r * (H + 8) });
  }
}
const labels = ["parent (horns born)", "chained · WORDS", "chained · CROP"]
  .map((t, i) => `<text x="${8 + i * (W + 8)}" y="20" font-family="Inter,Arial" font-size="16" fill="#111">${t}</text>`).join("");
tiles.push({ input: Buffer.from(`<svg width="${8 + 3 * (W + 8)}" height="30">${labels}</svg>`), left: 0, top: 0 });
await sharp({ create: { width: 8 + 3 * (W + 8), height: 30 + SPECS.length * (H + 8), channels: 3, background: { r: 245, g: 245, b: 245 } } })
  .composite(tiles).png().toFile(`${OUT}/horn-sheet.png`);
console.log(`${OUT}/horn-sheet.png`);

process.exit(0);
