/**
 * THE FOUNDER'S EVIDENCE PACK — specimens and controls as side-by-sides.
 *
 * Nothing touches the product path before these are looked at. Three exhibits,
 * each answering one question a table of percentages cannot:
 *
 *   FACE-WALL      the 24 bespectacled faces this workstream now owns, across
 *                  the full frame-weight range — chunky opaque rims through fine
 *                  low-contrast wire
 *   CONTROLS       the eyeglasses question asked of two segmenters, on a face
 *                  wearing them and a face wearing none. This is the exhibit: one
 *                  model returns nothing, the other returns her eyes.
 *   HAIR           a binary region and a subject matte composed into a hair mask
 *                  with a real edge, and the point where growth starts eating the
 *                  forehead
 *
 *   npx tsx scripts/calibration/masked-evidence-pack.mts
 */
import sharp from "sharp";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";

const OUT = "docs/specs/masked-editing/shop/evidence";
mkdirSync(OUT, { recursive: true });

/** Read a mask from wherever it lives — alpha for cut-outs, luma otherwise (D-210). */
async function maskBytes(file: string, width: number, height: number): Promise<Buffer> {
  const bytes = readFileSync(file);
  const meta = await sharp(bytes).metadata();
  const pipeline = meta.hasAlpha ? sharp(bytes).extractChannel(3) : sharp(bytes).toColourspace("b-w");
  const out = await pipeline.resize(width, height, { fit: "fill" }).toColourspace("b-w").raw()
    .toBuffer({ resolveWithObject: true });
  /* Assert the stride rather than trusting it — sharp promotes raw 1-channel
     buffers to 3 through resize, silently, and it has cost this session three
     separate hours. */
  if (out.data.length !== width * height) {
    throw new Error(`stride wrong: ${out.data.length} for ${width}x${height} (channels=${out.info.channels})`);
  }
  return out.data;
}

async function tinted(specimen: string, mask: string | null, width: number, height: number): Promise<Buffer> {
  const base = await sharp(readFileSync(specimen)).resize(width, height, { fit: "fill" }).removeAlpha().toBuffer();
  if (!mask) return sharp(base).jpeg({ quality: 92 }).toBuffer();
  const m = await maskBytes(mask, width, height);
  const tint = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    tint[index * 4] = 255;
    tint[index * 4 + 1] = 30;
    tint[index * 4 + 2] = 30;
    tint[index * 4 + 3] = Math.round(m[index] * 0.62);
  }
  return sharp(base).composite([{ input: tint, raw: { width, height, channels: 4 } }]).jpeg({ quality: 92 }).toBuffer();
}

async function grid(cells: Buffer[], cols: number, cellWidth: number, cellHeight: number, file: string) {
  const rows = Math.ceil(cells.length / cols);
  await sharp({ create: { width: cellWidth * cols, height: cellHeight * rows, channels: 3, background: "#0A0A0A" } })
    .composite(cells.map((input, index) => ({
      input,
      left: (index % cols) * cellWidth,
      top: Math.floor(index / cols) * cellHeight,
    })))
    .jpeg({ quality: 92 })
    .toFile(file);
  console.log(`  ${file}`);
}

/* ------------------------------------------------------- exhibit 1: the wall */
const SPECIMENS = "output/masked/specimens";
const W = 260;
const H = 390;
const faces: Buffer[] = [];
for (const tag of ["fresh", "chunky", "wire"]) {
  for (const file of readdirSync(SPECIMENS).filter((f) => f.startsWith(tag) && f.endsWith(".png")).sort()) {
    faces.push(await sharp(readFileSync(`${SPECIMENS}/${file}`)).resize(W, H, { fit: "fill" }).jpeg({ quality: 92 }).toBuffer());
  }
}
console.log(`face wall — ${faces.length} bespectacled specimens`);
await grid(faces, 8, W, H, `${OUT}/EXHIBIT-1-face-wall.jpg`);

/* --------------------------------------------- exhibit 2: the control pairs */
const SHOP = "output/masked/segmentation-shop-2";
const BARE = "output/quality-unit/specimens/built-base.png";
const BESPECTACLED = `${SPECIMENS}/fresh-02.png`;
const CW = 340;
const CH = 510;
console.log("controls — the eyeglasses question, asked both ways");
await grid(
  [
    /* Top row: SAM 3. Asked of a face wearing frames, then a face wearing none. */
    await tinted(BESPECTACLED, `${SHOP}/sam-3-eyeglasses.png`, CW, CH),
    /* No mask file exists for the negative — the model returned an empty set.
       The bare face is shown UNTINTED, which is the honest picture of nothing. */
    await tinted(BARE, null, CW, CH),
    /* Bottom row: EVF-SAM, same two questions. */
    await tinted(BESPECTACLED, `${SHOP}/evf-sam-eyeglasses-RE-MEASURED-on-the-fixed-reader-.png`, CW, CH),
    await tinted(BARE, `${SHOP}/evf-sam-eyeglasses-NEGATIVE-CONTROL-RE-MEASURED-.png`, CW, CH),
  ],
  2, CW, CH, `${OUT}/EXHIBIT-2-eyeglasses-controls.jpg`,
);
console.log("    row 1 = SAM 3 (found them / returned NOTHING)");
console.log("    row 2 = EVF-SAM (found them / returned HER EYES)");

/* -------------------------------------------------- exhibit 3: the hair row */
const HAIR = "output/masked/hair-composition";
console.log("hair — region, matte, and the composition of the two");
await grid(
  [
    await tinted(BESPECTACLED, `${HAIR}/region-binary-.png`, CW, CH),
    await tinted(BESPECTACLED, `${HAIR}/matte-subject-.png`, CW, CH),
    await tinted(BESPECTACLED, `${HAIR}/grown-r-4.png`, CW, CH),
    await tinted(BESPECTACLED, `${HAIR}/grown-r-16.png`, CW, CH),
  ],
  4, CW, CH, `${OUT}/EXHIBIT-3-hair-composition.jpg`,
);
console.log("    SAM 3 region (no edge) | BiRefNet matte (whole subject) | composed r=4 | r=16 (bleeding onto the forehead)");

/* --------------------------------------------- exhibit 4: frames vs lenses */
const SPLIT = "output/masked/glasses-split";
console.log("glasses — the split D-211 needs, asked for rather than derived");
await grid(
  [
    await tinted(BESPECTACLED, `${SPLIT}/chunky-union.png`, CW, CH),
    await tinted(BESPECTACLED, `${SPLIT}/chunky-lenses.png`, CW, CH),
    await tinted(BESPECTACLED, `${SPLIT}/chunky-frames.png`, CW, CH),
    await tinted(`${SPECIMENS}/wire-04.png`, `${SPLIT}/wire-union.png`, CW, CH),
    await tinted(`${SPECIMENS}/wire-04.png`, `${SPLIT}/wire-lenses.png`, CW, CH),
    await tinted(`${SPECIMENS}/wire-04.png`, `${SPLIT}/wire-frames.png`, CW, CH),
  ],
  3, CW, CH, `${OUT}/EXHIBIT-4-frames-vs-lenses.jpg`,
);
console.log("    per row: everything SAM 3 calls eyeglasses | lenses alone | frames = union − lenses");
console.log("    row 1 chunky rims, row 2 fine wire");

console.log(`\nevidence pack written to ${OUT}`);
