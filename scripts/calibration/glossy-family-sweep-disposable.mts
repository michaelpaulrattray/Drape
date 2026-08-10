/**
 * THE GLOSSY-FAMILY SWEEP — fable-189 item 3, working law 7.
 *
 * opus-135 unmasked thirteen frames that had been treated as a positive-gloss
 * population: each was SENT a gloss crop, and they sit 0.39pp above the bare
 * master, "which is what did-not-carry looks like". Every past reading built on
 * that family inherits the correction, so the sweep is owed.
 *
 * The sweep starts by re-examining the correction itself, because the frame it
 * was measured against was the ONE unpainted specimen in the program. A paint
 * is not a photograph: repainting alone can move a specular measure. The right
 * comparison is against frames that were PAINTED from the same master by the
 * same engine and never received a lips reference at all — and five of those
 * have been sitting on disk since the ear scenarios.
 *
 *   npx tsx scripts/calibration/glossy-family-sweep-disposable.mts
 *
 * Costs nothing new: every frame and every region mask below is already cached.
 *
 * # THE GROUPS, AND WHAT SEPARATES THEM
 *
 *   BARE        the master itself. Unpainted. n=1.
 *   NEVER-SENT  painted from that master, gpt2, sent earring anchors only —
 *               no lips crop, no lips words. The bisect's own null joins this
 *               group when it lands.
 *   CROP-SENT   cell2g — painted from that master, gpt2, five references
 *               INCLUDING the gloss crop, lips never mentioned in words.
 *   CROP-HEIR   the ten accessory frames. NOT painted from the master: their
 *               source is `output/cprime/cell2g-1.png`, a delivered frame. They
 *               are a generation FURTHER out and inherit whatever cell2g-1's
 *               lips already were. They are not evidence about the crop; they
 *               are evidence about what the crop's descendant looks like.
 *   WORD-ASKED  gloss asked in words, the only frames anyone claims are glossy.
 *
 * CROP-SENT vs NEVER-SENT is the comparison that matters, and it is NOT clean:
 * they differ in the ask (eye colour vs earrings) and in reference count as
 * well as in the gloss crop. Stated here so no reader has to find it.
 */
import { readFile } from "node:fs/promises";

import sharp from "sharp";

import { loadMaskFile, maskOf, type FaceMask } from "../lib/shapeOnFace.mts";

const SPECULAR_ABOVE = 50;

async function readCached(framePath: string, readsDir: string, label: string): Promise<
  { specular: number; fullness: number } | null
> {
  const bytes = await readFile(framePath).catch(() => null);
  if (!bytes) return null;
  const lips = await loadMaskFile(`${readsDir}/${label}--lips.png`);
  const face = await loadMaskFile(`${readsDir}/${label}--face.png`);
  if (!lips || !face) return null;
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== lips.width) return null;
  const luminance: number[] = [];
  for (let index = 0; index < lips.data.length; index += 1) {
    if (lips.data[index] === 0) continue;
    luminance.push(0.2126 * data[index * 3]! + 0.7152 * data[index * 3 + 1]! + 0.0722 * data[index * 3 + 2]!);
  }
  if (luminance.length === 0) return null;
  const median = [...luminance].sort((a, b) => a - b)[Math.floor(luminance.length / 2)]!;
  return {
    specular: luminance.filter((value) => value > median + SPECULAR_ABOVE).length / luminance.length,
    fullness: (lips as FaceMask).pixels / (face as FaceMask).pixels,
  };
}

const EDIT_LAW = "output/edit-law";
const CPRIME = "output/cprime";
const ACCESSORY = "output/accessory-cell";
const BISECT = "output/count-bisect";

type Entry = { label: string; frame: string; reads: string; note: string };

const GROUPS: { id: string; title: string; why: string; entries: Entry[] }[] = [
  {
    id: "BARE",
    title: "BARE — the master itself, never painted",
    why: "the single specimen the whole correction was measured against",
    entries: [{ label: "master", frame: `${EDIT_LAW}/master.png`, reads: `${EDIT_LAW}/reads`, note: "unpainted" }],
  },
  {
    id: "NEVER-SENT",
    title: "NEVER-SENT — painted from that master, no lips crop, no lips words",
    why: "what a REPAINT of her own lips reads, with nothing asked of them",
    entries: [
      ...["c-bigger-1", "c-bigger-2"].map((label) => ({
        label, frame: `${EDIT_LAW}/${label}.png`, reads: `${EDIT_LAW}/reads`, note: "earring anchors, bigger hoops",
      })),
      ...["d-oneear-1", "d-oneear-2", "d-oneear-3"].map((label) => ({
        label, frame: `${EDIT_LAW}/${label}.png`, reads: `${EDIT_LAW}/reads`, note: "earring anchors, one ear",
      })),
      ...[1, 2, 3].map((index) => ({
        label: `null-no-crop-${index}`, frame: `${BISECT}/null-no-crop-${index}.png`, reads: `${BISECT}/reads`,
        note: "the bisect's own null — 1 reference, eye colour",
      })),
    ],
  },
  {
    id: "CROP-SENT",
    title: "CROP-SENT — the gloss crop in the stack, gloss never asked in words",
    why: "THE FRAMES THE CORRECTION IS ABOUT. Same master, same engine, one generation.",
    entries: [1, 2, 3].map((index) => ({
      label: `cell2g-${index}`, frame: `${CPRIME}/cell2g-${index}.png`, reads: `${CPRIME}/reads`,
      note: "5 references incl. gloss crop, ask: eye colour",
    })),
  },
  {
    id: "CROP-HEIR",
    title: "CROP-HEIR — painted FROM cell2g-1, not from the master",
    why: "a generation further out; inherits cell2g-1's lips rather than testing the crop",
    entries: [
      ...[1, 2, 3, 4, 5].map((index) => ({
        label: `gpt2-crop-${index}`, frame: `${ACCESSORY}/gpt2-crop-${index}.png`, reads: `${ACCESSORY}/reads`,
        note: "accessory cell, crop form",
      })),
      ...[1, 2, 3, 4, 5].map((index) => ({
        label: `gpt2-cutout-${index}`, frame: `${ACCESSORY}/gpt2-cutout-${index}.png`, reads: `${ACCESSORY}/reads`,
        note: "accessory cell, cutout form",
      })),
    ],
  },
  {
    id: "WORD-ASKED",
    title: "WORD-ASKED — gloss asked for in words",
    why: "the only frames anybody has ever had grounds to call glossy",
    entries: [
      { label: "a0-maxgloss", frame: `${EDIT_LAW}/a0-maxgloss.png`, reads: `${EDIT_LAW}/reads`, note: "heavy wet high-shine" },
      { label: "a1-gloss", frame: `${EDIT_LAW}/a1-gloss.png`, reads: `${EDIT_LAW}/reads`, note: "soft nude gloss" },
      { label: "a5-wet-fuller", frame: `${EDIT_LAW}/a5-wet-fuller.png`, reads: `${EDIT_LAW}/reads`, note: "heavy wet, fuller" },
      { label: "a4-matte-fuller", frame: `${EDIT_LAW}/a4-matte-fuller.png`, reads: `${EDIT_LAW}/reads`, note: "completely matte — the floor control" },
    ],
  },
];

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
const spread = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { lo: sorted[0]!, hi: sorted[sorted.length - 1]!, n: sorted.length };
};

const measured: Record<string, { specular: number; fullness: number }[]> = {};
const missing: string[] = [];

for (const group of GROUPS) {
  console.log(`\n${"=".repeat(88)}`);
  console.log(`${group.id} — ${group.title.split(" — ")[1] ?? group.title}`);
  console.log(`  ${group.why}`);
  console.log("=".repeat(88));
  measured[group.id] = [];
  for (const entry of group.entries) {
    const reading = await readCached(entry.frame, entry.reads, entry.label);
    if (!reading) { missing.push(entry.label); console.log(`  ${entry.label.padEnd(22)}  NO CACHED READ — ${entry.note}`); continue; }
    measured[group.id]!.push(reading);
    console.log(`  ${entry.label.padEnd(22)}shine ${pct(reading.specular).padStart(7)}   fullness ${pct(reading.fullness).padStart(7)}   ${entry.note}`);
  }
}

console.log(`\n${"=".repeat(88)}`);
console.log("THE BANDS, SIDE BY SIDE");
console.log("=".repeat(88));
for (const group of GROUPS) {
  const readings = measured[group.id] ?? [];
  if (readings.length === 0) { console.log(`  ${group.id.padEnd(12)}  no readings — NOT-RUN, not zero`); continue; }
  const shine = spread(readings.map((reading) => reading.specular));
  const full = spread(readings.map((reading) => reading.fullness));
  console.log(
    `  ${group.id.padEnd(12)}n=${String(shine.n).padStart(2)}   shine ${`${pct(shine.lo)}–${pct(shine.hi)}`.padStart(15)}`
    + `   fullness ${`${pct(full.lo)}–${pct(full.hi)}`.padStart(15)}`,
  );
}

const neverSent = measured["NEVER-SENT"] ?? [];
const cropSent = measured["CROP-SENT"] ?? [];

console.log(`\n${"=".repeat(88)}`);
console.log("WHAT THE CORRECTION SHOULD SAY");
console.log("=".repeat(88));

if (neverSent.length === 0 || cropSent.length === 0) {
  console.log("  One of the two groups has no readings. NOT-RUN — no verdict is available.");
  process.exit(0);
}

const never = spread(neverSent.map((reading) => reading.specular));
const crop = spread(cropSent.map((reading) => reading.specular));
const bare = (measured["BARE"] ?? [])[0]?.specular ?? null;

/*
  THE NOISE FLOOR, and it is the whole answer.

  `null-no-crop-1/2/3` are three paints of ONE prompt with ONE reference —
  identical inputs, nothing varying but the engine's own draw. Whatever they
  spread across is the smallest difference this measure can resolve. A gap
  between two groups that is narrower than that is not a reading, however
  cleanly the extremes happen to sort.
*/
const identical = (measured["NEVER-SENT"] ?? []).slice(5).map((reading) => reading.specular);
const noise = identical.length >= 2 ? spread(identical) : null;

console.log(`\n  a REPAINT that was asked nothing about her lips   ${pct(never.lo)}–${pct(never.hi)}   n=${never.n}`);
console.log(`  the same, but SENT the gloss crop                 ${pct(crop.lo)}–${pct(crop.hi)}   n=${crop.n}`);
if (bare !== null) console.log(`  the unpainted master, for scale                  ${pct(bare)}`);

if (!noise) {
  console.log("\n  NO NOISE FLOOR — the identical-input control has not been painted, so no gap below");
  console.log("  can be called a separation. NOT-RUN rather than a verdict.");
} else {
  const floor = noise.hi - noise.lo;
  const gap = crop.lo - never.hi;
  console.log(`\n  THE NOISE FLOOR — ${noise.n} paints of ONE identical prompt, one reference, nothing varying`);
  console.log(`    ${pct(noise.lo)}–${pct(noise.hi)}   spread ${pct(floor)}`);
  console.log(`  THE GAP being asked about — crop-sent floor minus never-sent ceiling: ${pct(gap)}`);
  if (gap > floor) {
    console.log(`\n  ${pct(gap)} EXCEEDS the ${pct(floor)} the engine moves on its own. The crop moved shine.`);
  } else {
    console.log(`\n  ${pct(gap)} IS INSIDE the ${pct(floor)} the engine moves on its own. NOTHING IS EARNED HERE —`);
    console.log("  not \"the crop carried\", and not \"the crop did not carry\". The instrument cannot");
    console.log("  resolve a difference this size, so both the old correction and my own first read");
    console.log("  of it are withdrawn.");
  }
}

/*
  AND THE RETROSPECTIVE POSITIVE CONTROL, which is the harder thing to say.

  a2 asked for gloss AND fullness. a3 asked for fullness with the gloss words
  STRUCK. If this measure ordered gloss, a2 would sit above a3. It does not have
  to be a large margin — it has to be the right SIGN.
*/
console.log(`\n${"=".repeat(88)}`);
console.log("THE POSITIVE CONTROL, READ BACKWARDS");
console.log("=".repeat(88));
const cell = JSON.parse(await readFile("output/edit-law/cell.json", "utf8"));
const lipReadings = cell.lipReadings as Record<string, { specular: number; fullness: number }>;
const a2 = lipReadings["a2-fuller"];
const a3s = [1, 2, 3].map((index) => lipReadings[`a3-remove-${index}`]).filter(Boolean) as { specular: number; fullness: number }[];
if (a2 && a3s.length > 0) {
  const a3band = spread(a3s.map((reading) => reading.specular));
  const a3mean = a3s.reduce((total, reading) => total + reading.specular, 0) / a3s.length;
  console.log(`  a2  gloss ASKED FOR, fuller   ${pct(a2.specular).padStart(7)}   at ${pct(a2.fullness)} fullness`);
  console.log(`  a3  gloss STRUCK, fuller      ${`${pct(a3band.lo)}–${pct(a3band.hi)}`.padStart(15)}   mean ${pct(a3mean)}   n=${a3band.n}`);
  console.log(a3mean > a2.specular
    ? "\n  THE FRAMES WITH GLOSS REMOVED READ HIGHER THAN THE FRAME WITH GLOSS ASKED FOR.\n"
      + "  The sign is wrong. In this fullness region the measure does not order its own\n"
      + "  quantity, and a measure that cannot order its quantity cannot adjudicate the\n"
      + "  founding case in EITHER direction — not 0 of 3, and not 2 of 3.\n"
      + "  It has range only at the extremes: a maximal wet ask and a matte control."
    : "\n  The sign is right: gloss-asked sits above gloss-struck. The measure orders its\n"
      + "  own quantity here, and the founding case's verdict rests on something real.");
}

if (missing.length > 0) {
  console.log(`\n  NOT READ (cache absent), named rather than silently dropped: ${missing.join(", ")}`);
}
process.exit(0);
