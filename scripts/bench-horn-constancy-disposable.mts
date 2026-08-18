/**
 * ARE THEY THE SAME HORNS? — the axis the survival court never judged.
 * (fable-566 §1, on frames already on disk.)
 *
 * The founder: *"horns should be carried by reference as well — it's a feature,
 * otherwise they would change on every refinement."*
 *
 * The survival court measured two things and crowned words on a tie: **presence**
 * (horns still there, 3/3 both arms) and **identity** (still the same woman, 3/3
 * both arms). It never asked whether they are the same HORNS — curve, extent,
 * placement — which is the unowned-axis-collapse class: an axis nobody pins
 * re-rolls every render, and a court that cannot see it crowns the cheaper arm.
 *
 * # What is measured, and why it is normalised
 *
 * Her head does not sit in the same pixels between renders, so raw horn area
 * would measure a moved head. Every reading is taken against her own face on
 * the SAME frame:
 *
 * ```
 * EXTENT     horn area / face area
 * SHAPE      horn box aspect (w/h) — a curl and a spike differ here
 * PLACE      horn centroid − face centroid, in face-widths
 * ```
 *
 * Parent (the frame that delivered the horns) against its own chained frame,
 * under each arm. **The bar, written before the first call**: if the founder is
 * right, the CROP arm holds all three nearer than the WORDS arm on at least 2 of
 * 3 specimens. If words holds them just as well, the ruling still stands — a
 * feature must be pinned by construction rather than by luck — and this files as
 * context rather than as proof.
 *
 * ~18 segmenter reads, about nine cents of house money. NO generations: every
 * frame here was rendered and paid for in the survival court.
 *
 *   npx tsx scripts/bench-horn-constancy-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";

const IN = "output/horns-court";
const OUT = "output/horn-constancy";
mkdirSync(OUT, { recursive: true });
if (!process.env.FAL_KEY) throw new Error("FAL_KEY is required");

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };

const SPECIMENS = ["words-2", "words-3", "words-4"] as const;
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });
let calls = 0;

type Mask = { data: Buffer; width: number; height: number };

async function regionOf(bytes: Buffer, name: string): Promise<Mask | null> {
  try {
    const mask = await reader.region({ image: bytes, name, absentIsAnswer: true }) as Mask;
    calls += 1;
    return mask;
  } catch (error) {
    calls += 1;
    say(`      [no read] ${name}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function shapeOf(mask: Mask) {
  let minX = mask.width, maxX = -1, minY = mask.height, maxY = -1, on = 0, sumX = 0, sumY = 0;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x]! <= 127) continue;
      on += 1; sumX += x; sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (on === 0) return null;
  return {
    area: on,
    box: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    centre: { x: sumX / on, y: sumY / on },
  };
}

/** Everything about the horns, expressed in her own face's units. */
async function readFrame(file: string, label: string) {
  const bytes = readFileSync(file);
  const horns = await regionOf(bytes, "horns");
  const face = await regionOf(bytes, "face");
  const h = horns ? shapeOf(horns) : null;
  const f = face ? shapeOf(face) : null;
  if (!h || !f) {
    say(`  ${label.padEnd(22)} horns ${h ? "read" : "NOT READ"} · face ${f ? "read" : "NOT READ"}`);
    return null;
  }
  const reading = {
    extent: h.area / f.area,
    aspect: h.box.width / h.box.height,
    placeX: (h.centre.x - f.centre.x) / f.box.width,
    placeY: (h.centre.y - f.centre.y) / f.box.height,
  };
  say(`  ${label.padEnd(22)} extent ${(reading.extent * 100).toFixed(1)}% of her face`
    + ` · aspect ${reading.aspect.toFixed(2)} · place (${reading.placeX.toFixed(3)}, ${reading.placeY.toFixed(3)})`);
  return reading;
}

const rows: any[] = [];
for (const specimen of SPECIMENS) {
  say("");
  say("-".repeat(78));
  say(`SPECIMEN ${specimen}`);
  const parent = await readFrame(`${IN}/${specimen}.png`, "parent (horns born)");
  const words = await readFrame(`${IN}/words-${specimen}.png`, "chained · WORDS arm");
  const crop = await readFrame(`${IN}/crop-${specimen}.png`, "chained · CROP arm");
  if (!parent) { say("  the parent does not read — this specimen is skipped"); continue; }
  const drift = (child: typeof parent | null) => child === null ? null : {
    extent: Math.abs(child.extent - parent.extent) / parent.extent,
    aspect: Math.abs(child.aspect - parent.aspect) / parent.aspect,
    place: Math.hypot(child.placeX - parent.placeX, child.placeY - parent.placeY),
  };
  const wordsDrift = drift(words);
  const cropDrift = drift(crop);
  say(`  drift from the parent   WORDS extent ${wordsDrift ? `${(wordsDrift.extent * 100).toFixed(0)}%` : "—"}`
    + ` aspect ${wordsDrift ? `${(wordsDrift.aspect * 100).toFixed(0)}%` : "—"}`
    + ` place ${wordsDrift ? wordsDrift.place.toFixed(3) : "—"}`);
  say(`                          CROP  extent ${cropDrift ? `${(cropDrift.extent * 100).toFixed(0)}%` : "—"}`
    + ` aspect ${cropDrift ? `${(cropDrift.aspect * 100).toFixed(0)}%` : "—"}`
    + ` place ${cropDrift ? cropDrift.place.toFixed(3) : "—"}`);
  rows.push({ specimen, parent, words, crop, wordsDrift, cropDrift });
}

say("");
say("=".repeat(78));
say("IS IT THE SAME HORN? — drift from its own parent, three ways");
say("specimen     arm     extent    aspect    place");
for (const row of rows) {
  for (const arm of ["words", "crop"] as const) {
    const d = arm === "words" ? row.wordsDrift : row.cropDrift;
    say(`${row.specimen.padEnd(12)} ${arm.padEnd(7)} `
      + `${d ? `${(d.extent * 100).toFixed(0)}%`.padStart(6) : "     —"}    `
      + `${d ? `${(d.aspect * 100).toFixed(0)}%`.padStart(6) : "     —"}    `
      + `${d ? d.place.toFixed(3) : "—"}`);
  }
}
const nearer = rows.filter((row) => row.wordsDrift && row.cropDrift
  && row.cropDrift.extent < row.wordsDrift.extent
  && row.cropDrift.aspect < row.wordsDrift.aspect).length;
say("");
say(`the CROP arm holds extent AND aspect nearer on ${nearer}/${rows.length} specimens (the bar was 2 of 3)`);
say(`SPEND: ${calls} segmenter reads ≈ $${(calls * 0.005).toFixed(2)} of house money · no generations`);

writeFileSync(`${OUT}/constancy.txt`, `${lines.join("\n")}\n`);
writeFileSync(`${OUT}/constancy.json`, `${JSON.stringify(rows, null, 2)}\n`);
process.exit(0);
