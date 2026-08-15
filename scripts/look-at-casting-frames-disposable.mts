/**
 * LOOK AT THE FRAMES — the free half of the placement question.
 *
 * `bench-placement-vocabulary-disposable.mts` asks a segmenter what it can find.
 * This asks nothing of anybody: it downloads real masters and draws them, so the
 * GROUND TRUTH the bench is judged against is an artifact rather than a memory
 * (working law 1). It made the segmenter half cheap, because it answered the
 * question one layer earlier — there is no forearm in a casting frame — and no
 * number of reads would have found that.
 *
 * Four sheets, into `output/placement-vocabulary/`:
 *
 *   frames-sheet.png   16 recent masters, 4x4. The uniformity is the finding:
 *                      every one chest-up, every one in the roll prompt's tee.
 *   bottom-strip.png   the bottom 45% of four frames at full pixels — where the
 *                      crop line falls relative to the sleeve.
 *   corners.png        the bottom corners at full resolution, which is the
 *                      resolution the claim "this is upper arm, not forearm"
 *                      actually needs. No elbow crease, no taper.
 *   arm-overlay.png    the bench's own saved masks drawn back onto the frames —
 *                      cyan "upper arm", magenta "forearm", landing on opposite
 *                      sides of one body. Run the bench first; this reads the
 *                      PNGs it wrote rather than paying for them again.
 *
 * Costs nothing but bandwidth: no segmenter call, no credits, no writes.
 *
 *   npx tsx scripts/look-at-casting-frames-disposable.mts
 */
import "dotenv/config";
import { existsSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import mysql from "mysql2/promise";

const OUT = "output/placement-vocabulary";
mkdirSync(OUT, { recursive: true });
const sharp = (await import("sharp")).default;
const BUCKET = process.env.R2_PUBLIC_URL;
if (!BUCKET) throw new Error("no R2_PUBLIC_URL");

/** The four the bench used, named for their neckline — the axis that matters. */
const FOUR = [
  { name: "A-man-crew", key: "casting-v2/candidates/9b846249-5043-41ea-85d4-1e1508eb008e.png" },
  { name: "B-scoop", key: "casting-v2/candidates/3b7b716a-8ed8-4386-803e-db8c9ffc5c3a.png" },
  { name: "C-crew", key: "casting-v2/candidates/0f3b609e-08a8-4d0c-8fed-722c26a07af3.png" },
  { name: "D-crew", key: "casting-v2/candidates/fce4b507-83a2-495f-80cd-9de7acc5641a.png" },
];

const fetchFrame = async (key: string): Promise<Buffer> => {
  const response = await fetch(`${BUCKET}/${key}`);
  if (!response.ok) throw new Error(`${key}: the frame store answered ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};

/**
 * Sharp applies `resize` BEFORE `composite` in one pipeline, so a full-size
 * overlay onto a shrunk base fails with "must have same dimensions or smaller".
 * Composited first, resized in a second call — the order is load-bearing.
 */
const tile = async (bytes: Buffer, width: number): Promise<Buffer> =>
  sharp(bytes).resize(width, null).png().toBuffer();

async function sheetOf(cells: Buffer[], cols: number, cellW: number, cellH: number, path: string) {
  const rows = Math.ceil(cells.length / cols);
  const composed = await sharp({
    create: { width: cols * cellW, height: rows * cellH, channels: 3, background: "#151515" },
  })
    .composite(cells.map((input, i) => ({
      input, left: (i % cols) * cellW, top: Math.floor(i / cols) * cellH,
    })))
    .png()
    .toBuffer();
  writeFileSync(path, composed);
  console.log(`  -> ${path}`);
}

/* 1. THE CONTACT SHEET — the population, not a chosen specimen. */
console.log("frames-sheet: the 16 most recent masters");
const connection = await mysql.createConnection(process.env.DATABASE_URL!);
const [rows] = await connection.execute(
  "SELECT imageKey, MAX(createdAt) AS t FROM casting_candidates" +
  " WHERE imageKey LIKE 'casting-v2/candidates/%' GROUP BY imageKey ORDER BY t DESC LIMIT 16",
);
await connection.end();
const cells: Buffer[] = [];
for (const row of rows as Array<{ imageKey: string }>) {
  const bytes = await fetchFrame(row.imageKey);
  cells.push(await sharp(bytes).resize(220, 330, { fit: "contain" }).png().toBuffer());
}
await sheetOf(cells, 4, 220, 330, `${OUT}/frames-sheet.png`);

/* 2. THE BOTTOM 45% AT FULL PIXELS — where the crop line falls. */
console.log("bottom-strip: the bottom 45% of the bench's four");
const strip: Buffer[] = [];
for (const frame of FOUR) {
  const bytes = await fetchFrame(frame.key);
  const meta = await sharp(bytes).metadata();
  const top = Math.round(meta.height! * 0.55);
  strip.push(await tile(
    await sharp(bytes).extract({ left: 0, top, width: meta.width!, height: meta.height! - top }).png().toBuffer(),
    400,
  ));
}
await sheetOf(strip, 4, 400, 280, `${OUT}/bottom-strip.png`);

/* 3. THE CORNERS AT FULL RESOLUTION — the claim needs this resolution. */
console.log("corners: the bottom corners of A and D, full pixels");
const corners: Buffer[] = [];
for (const frame of [FOUR[0], FOUR[3]]) {
  const bytes = await fetchFrame(frame.key);
  const meta = await sharp(bytes).metadata();
  const w = meta.width!, h = meta.height!;
  const cw = Math.round(w * 0.34), ch = Math.round(h * 0.3);
  for (const left of [0, w - cw]) {
    corners.push(await tile(
      await sharp(bytes).extract({ left, top: h - ch, width: cw, height: ch }).png().toBuffer(),
      340,
    ));
  }
}
await sheetOf(corners, 4, 340, 460, `${OUT}/corners.png`);

/* 4. THE BENCH'S OWN MASKS, DRAWN BACK ON. Reads the PNGs the bench saved. */
console.log("arm-overlay: cyan 'upper arm', magenta 'forearm'");
const tinted = async (path: string, w: number, h: number, rgb: [number, number, number]) => {
  const grey = await sharp(path).resize(w, h, { fit: "fill" }).greyscale().raw().toBuffer();
  const px = Buffer.alloc(w * h * 4, 0);
  for (let i = 0; i < w * h; i += 1) {
    if (grey[i] === 0) continue;
    px[i * 4] = rgb[0]; px[i * 4 + 1] = rgb[1]; px[i * 4 + 2] = rgb[2]; px[i * 4 + 3] = 190;
  }
  return sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
};
const overlays: Buffer[] = [];
for (const frame of [FOUR[0], FOUR[2], FOUR[3]]) {
  const bytes = await fetchFrame(frame.key);
  const meta = await sharp(bytes).metadata();
  const w = meta.width!, h = meta.height!;
  const layers: Array<{ input: Buffer }> = [];
  for (const [word, rgb] of [["upper-arm", [0, 220, 255]], ["forearm", [255, 0, 200]]] as const) {
    const path = `${OUT}/${frame.name}-${word}.png`;
    if (!existsSync(path)) {
      console.log(`  ${frame.name}: no ${word} mask on disk — run the bench first`);
      continue;
    }
    layers.push({ input: await tinted(path, w, h, rgb as [number, number, number]) });
  }
  const base = await sharp(bytes).modulate({ brightness: 0.75 }).png().toBuffer();
  overlays.push(await tile(await sharp(base).composite(layers).png().toBuffer(), 380));
}
await sheetOf(overlays, 3, 380, 570, `${OUT}/arm-overlay.png`);
