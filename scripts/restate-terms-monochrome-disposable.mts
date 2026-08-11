/**
 * RESTATE A DELIVERED SET-DIFF EXHIBIT IN THE MONOCHROME GRAMMAR — losslessly,
 * and provably so.
 *
 * fable-233 §4 ruled the pack's zoom pairs monochrome. The obvious way to obey
 * is to re-run the builder, and it is the wrong way: a re-run buys four fresh
 * vision reads, and if the reader moves by one pixel the picture silently stops
 * matching the prose the founder has already read beside it. The `--frame` pin
 * exists because that failure is not hypothetical.
 *
 * So this repaints the DELIVERED bytes instead. Every pixel of the exhibit is
 * either the dimmed frame or one of four flat marker colours composited at full
 * alpha, so set membership is exactly recoverable — and the recovery is not
 * assumed, it is PROVED per file before anything is written:
 *
 *   1. re-dim the delivered frame with the builder's own `modulate` and check
 *      its global maximum channel is far below 255, so no photograph pixel can
 *      impersonate a marker;
 *   2. partition the exhibit: every pixel must be EITHER byte-identical to the
 *      re-dimmed frame OR exactly one marker colour. A single pixel that is
 *      neither means the model of how this exhibit was built is wrong, and the
 *      restatement refuses rather than producing a confident picture.
 *
 * Only then is the class map repainted through `lib/termsPalette.mts` — the same
 * function the builder now draws with, so "only the palette moved" is a fact.
 *
 *   npx tsx scripts/restate-terms-monochrome-disposable.mts --row 8 --row 9 \
 *     [--out output/earring-cut-diagnosis/restated]
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import sharp from "sharp";

import { fetchImageBytes } from "./lib/imageBytes.mts";
import {
  paintTerm, magnifyExhibit, LOST_GREY, TERM_LEGEND, DIMMED_FRAME_CEILING, type TermClass,
} from "./lib/termsPalette.mts";
import { openDatabase } from "./lib/dbConnection.mts";

/* The palette the delivered exhibit was drawn in. Archaeology, not grammar —
   it lives here rather than in the palette module because it describes one
   artifact that already exists, and nothing should ever draw in it again. */
const LEGACY: Array<[TermClass, [number, number, number]]> = [
  ["controlFailure", [255, 214, 0]],
  ["kept", [255, 255, 255]],
  ["lostDelivered", [255, 45, 85]],
  ["lostMasterOnly", [0, 160, 255]],
];

/* The builder's own constants — the crop window must be re-derived, not guessed,
   or the restated ×12 is a different picture at the same name. */
const PAD = 14;
const ZOOM = 12;
const DIM = 0.35;

const flag = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};
const rowIds = process.argv.reduce<number[]>((ids, token, index) => (
  token === "--row" ? [...ids, Number(process.argv[index + 1])] : ids), []);
if (rowIds.length === 0) throw new Error("--row <id> is required — a restatement without a pinned subject is the defect it exists to avoid");
const OUT = path.resolve(flag("out") ?? "output/earring-cut-diagnosis/restated");
const SOURCE = path.resolve(flag("source") ?? "output/earring-cut-diagnosis");

const uri = process.env.DATABASE_URL!;
if (new URL(uri).port !== "52008") throw new Error("not the dev database");
const bucket = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

await mkdir(OUT, { recursive: true });
const connection = await openDatabase({ uri, timezone: "Z" });
const [rows] = await connection.query<any[]>(`
  SELECT l.id, l.slot,
         l.refusedBboxX, l.refusedBboxY, l.refusedBboxW, l.refusedBboxH,
         l.refusedFrameWidth, l.refusedFrameHeight, v.imageKey AS variantKey
    FROM casting_reference_library l
    LEFT JOIN casting_candidate_variants v ON v.id = l.variantId
   WHERE l.id IN (${rowIds.map(() => "?").join(",")}) ORDER BY l.id`, rowIds);
await connection.end();
if (rows.length !== rowIds.length) throw new Error(`asked for ${rowIds.length} row(s), found ${rows.length}`);

for (const row of rows) {
  const slug = row.slot.replace(/[^a-z0-9]+/gi, "-");
  const legacyPath = path.join(SOURCE, `terms-${slug}.png`);
  const width = row.refusedFrameWidth;
  const height = row.refusedFrameHeight;

  const legacy = await sharp(legacyPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (legacy.info.width !== width || legacy.info.height !== height) {
    throw new Error(`${legacyPath} is ${legacy.info.width}x${legacy.info.height}, row #${row.id} says ${width}x${height}`);
  }

  /* CONTROL 1 — the frame cannot impersonate a marker. */
  const dimmed = await sharp((await fetchImageBytes(`${bucket}/${row.variantKey}`)).bytes)
    .modulate({ brightness: DIM }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let frameCeiling = 0;
  for (let byte = 0; byte < dimmed.data.length; byte += 4) {
    frameCeiling = Math.max(frameCeiling, dimmed.data[byte]!, dimmed.data[byte + 1]!, dimmed.data[byte + 2]!);
  }
  if (frameCeiling > DIMMED_FRAME_CEILING) {
    throw new Error(`row #${row.id}: the dimmed frame reaches ${frameCeiling}, above the pinned ceiling `
      + `${DIMMED_FRAME_CEILING} — the greys were chosen against that number, so they must be re-argued, not reused`);
  }

  /* CONTROL 2 — partition the exhibit. Nothing may be left over. */
  const terms = new Array<TermClass | null>(width * height).fill(null);
  const counts: Record<string, number> = { kept: 0, lostDelivered: 0, lostMasterOnly: 0, controlFailure: 0 };
  let unexplained = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const at = pixel * 4;
    const r = legacy.data[at]!, g = legacy.data[at + 1]!, b = legacy.data[at + 2]!;
    const marker = LEGACY.find(([, [mr, mg, mb]]) => r === mr && g === mg && b === mb);
    if (marker) { terms[pixel] = marker[0]; counts[marker[0]]! += 1; continue; }
    if (r === dimmed.data[at] && g === dimmed.data[at + 1] && b === dimmed.data[at + 2]) continue;
    unexplained += 1;
  }
  console.log(`\nrow #${row.id} ${row.slot} — ${path.basename(legacyPath)}`);
  console.log(`  dimmed frame's brightest channel   ${frameCeiling}  (ceiling ${DIMMED_FRAME_CEILING}, markers all carry a 255)`);
  for (const [term, n] of Object.entries(counts)) console.log(`  ${term.padEnd(16)} ${String(n).padStart(6)} px`);
  console.log(`  unexplained                        ${unexplained} px  ← must be 0`);
  if (unexplained > 0) {
    throw new Error(`row #${row.id}: ${unexplained} pixel(s) are neither the dimmed frame nor a marker — `
      + `the model of how this exhibit was built is wrong, so the restatement is withdrawn`);
  }
  if (counts.lostMasterOnly! > 0) {
    /* The new grammar draws this set HATCHED, and a hatch shows the frame
       through half its pixels — pixels this exhibit painted over and never
       recorded. Nothing can recover them, so a restatement that met one would
       have to invent them. It does not; it stops. */
    throw new Error(`row #${row.id}: ${counts.lostMasterOnly} master-only pixel(s) — the hatched mark needs the `
      + `frame underneath them and this exhibit painted over it. Re-run the builder for this row instead.`);
  }

  /* Repaint. The frame's own bytes are carried through untouched, so the
     background of the restated exhibit is the background the founder saw. */
  const restated = Buffer.from(legacy.data);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const term = terms[pixel];
    if (!term) continue;
    const at = pixel * 4;
    const colour = paintTerm(term, pixel % width, Math.floor(pixel / width));
    if (!colour) { /* show-through: restore the frame */
      restated[at] = dimmed.data[at]!; restated[at + 1] = dimmed.data[at + 1]!; restated[at + 2] = dimmed.data[at + 2]!;
      continue;
    }
    restated[at] = colour[0]; restated[at + 1] = colour[1]; restated[at + 2] = colour[2];
  }

  const composed = await sharp(restated, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const box = {
    left: Math.max(0, row.refusedBboxX - PAD),
    top: Math.max(0, row.refusedBboxY - PAD),
    width: 0,
    height: 0,
  };
  box.width = Math.min(width - box.left, row.refusedBboxW + PAD * 2);
  box.height = Math.min(height - box.top, row.refusedBboxH + PAD * 2);
  const stem = path.join(OUT, `terms-${slug}-row${row.id}`);
  const magnified = await magnifyExhibit({
    composed, box, zoom: ZOOM, sharp,
    termAt: (x, y) => terms[y * width + x] ?? null,
  });
  await writeFile(`${stem}.png`, composed);
  await writeFile(`${stem}-x${ZOOM}.png`, magnified);

  /*
    NO MARK MAY IMPERSONATE ANOTHER — asserted on the magnified raster, which is
    the surface these sets are actually read on.

    This is the property the first cut of the palette broke, and it broke it
    invisibly: a source-scale checker gave nine isolated control pixels a single
    flat WHITE block each, so the exhibit carried 187 white source pixels where
    178 were `kept` — nine alarms wearing a reading's mark. Counting tones would
    have caught that one instance; what is checked instead is the thing that
    matters, block by block. A control block must contain BOTH extremes, so it
    can never be read as a flat tone; a reading's block must be flat.
  */
  const check = await sharp(magnified).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const blockOf = (x: number, y: number) => {
    const tones = new Set<string>();
    for (let dy = 0; dy < ZOOM; dy += 1) {
      for (let dx = 0; dx < ZOOM; dx += 1) {
        const at = (((y - box.top) * ZOOM + dy) * check.info.width + ((x - box.left) * ZOOM + dx)) * 4;
        tones.add(`${check.data[at]},${check.data[at + 1]},${check.data[at + 2]}`);
      }
    }
    return tones;
  };
  const seen: Record<string, number> = { kept: 0, lostDelivered: 0, controlFailure: 0 };
  for (let y = box.top; y < box.top + box.height; y += 1) {
    for (let x = box.left; x < box.left + box.width; x += 1) {
      const term = terms[y * width + x];
      if (!term) continue;
      seen[term] = (seen[term] ?? 0) + 1;
      const tones = blockOf(x, y);
      const flat = (rgb: string) => tones.size === 1 && tones.has(rgb);
      if (term === "kept" && !flat("255,255,255")) throw new Error(`row #${row.id}: a kept block at ${x},${y} is not flat white`);
      if (term === "lostDelivered" && !flat(`${LOST_GREY},${LOST_GREY},${LOST_GREY}`)) {
        throw new Error(`row #${row.id}: a lost block at ${x},${y} is not flat mid-grey`);
      }
      if (term === "controlFailure" && !(tones.has("255,255,255") && tones.has("0,0,0"))) {
        throw new Error(`row #${row.id}: the control block at ${x},${y} carries ${[...tones].join(" / ")} — `
          + `it must carry BOTH extremes or it reads as a flat tone, which is how an alarm becomes a reading`);
      }
    }
  }
  console.log(`  ×${ZOOM} blocks verified — kept ${seen.kept} flat white, lostDelivered ${seen.lostDelivered} flat grey, `
    + `controlFailure ${seen.controlFailure} checkered (each carrying both extremes)`);
  console.log(`  → ${stem}-x${ZOOM}.png   ${box.width * ZOOM}x${box.height * ZOOM}`);
}

console.log("\nlegend");
for (const [term, sentence] of Object.entries(TERM_LEGEND)) console.log(`  ${term.padEnd(15)} ${sentence}`);
process.exit(0);
