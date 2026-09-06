/**
 * THE EDIT-LAW CELL — does D-244 do what the founder said it would?
 *
 * D-244 (founder, 2026-08-10, via fable-182): *"this isn't Photoshop."* Words
 * change; crops carry. Every edit REGENERATES its feature from its ANCHOR (the
 * master, or an introduced item's frozen introduction reference) plus that
 * feature's FULL word stack. **A feature's own crop never rides in its own
 * edit.** Removal is striking the words. Every edit mints a new crop.
 *
 * The law is a claim about a RECIPE SHAPE, and it has never been driven. This
 * cell drives it, in the four shapes fable-182 §TEST ordered:
 *
 *   a  gloss → fuller → remove gloss   the founding case: remove must come back
 *                                      BARE **and** FULLER
 *   b  carry stability                 edit the hair; the untouched lips crop
 *                                      rides byte-identical and the delivered
 *                                      lips hold
 *   c  introduced-item edit            the hoop regenerated from its FROZEN
 *                                      INTRO anchor + words, not from its
 *                                      current crop
 *   d  instance edit                   one ear only; the other pixel-held
 *
 *   FAL_KEY=… npx tsx scripts/calibration/edit-law-cell.mts [--n 3] [--dry]
 *
 * # WHAT IT COSTS, DECLARED BEFORE IT IS SPENT
 *
 * 16 paints on GPT Image 2 at $0.099 measured = **$1.58**, plus region reads on
 * SAM 3. Every paint and every read is cached to disk, so a resumed run buys
 * only what was never bought. No campaign credit; nothing renders on any user's
 * account.
 *
 *   a0 max gloss      n=1   the gloss instrument's RANGE control, bought first
 *   a1 gloss          n=1   setup, GATED — if it does not deliver, the cell stops
 *   a2 fuller         n=1   setup, GATED
 *   a3 remove gloss   n=3   THE VERDICT of the founding case
 *   a4 matte + fuller n=1   ADDED after the first run — see below
 *   a5 wet + fuller   n=1   ADDED after the first run — see below
 *   b  carry          n=3   the promise the whole architecture was built for
 *   c  item edit      n=2
 *   d  instance edit  n=3   per-instance, and it feeds the left/right open row
 *
 * a4 and a5 are the two controls the FIRST run proved were missing: the gloss
 * instrument was calibrated on specimens that all shared the master's lip size,
 * and the arms then moved fullness by a quarter. They bracket a3 at a3's own
 * fullness. $0.20 to make a verdict valid rather than confounded.
 *
 * # ONE ENGINE, AND THE GAP IS DECLARED
 *
 * GPT Image 2 only. The law is about recipe shape, and holding the engine fixed
 * is what isolates it. **The law is therefore NOT tested on NBP-anatomical
 * routes** — a declared NOT-RUN, not a silent one. If the shape holds here it is
 * a property of the recipe, and a second arm can be added cheaply.
 *
 * # THE INSTRUMENTS GET THEIR CONTROLS FROM DISK, FOR NOTHING
 *
 * Two facts about the fixture make every lip control free:
 *
 *  - the MASTER's lips are BARE (gloss entered this lineage as an edit), and
 *  - `cell2g-*` and the accessory cell's ten GPT2 paints all carry the gloss
 *    crop as a reference and never ask about the lips.
 *
 * So the master is the gloss instrument's NEGATIVE specimen and that family is
 * its POSITIVE one, and the family's spread is the natural repaint amplitude
 * every "it changed" claim below must clear. All of it is already on disk. If
 * the two do not separate, the instrument is blind and this cell reports NOTHING
 * about gloss rather than a number about a reader.
 *
 * `--dry` buys no PAINTS. It does not suppress the reads the controls are made
 * of — a dry run that hides its own evidence reports a lie about the fixture as
 * a finding about the reader (shift 21, the hard way).
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

import {
  loadMaskFile, maskOf, ontoFaceOf, iouWithMapped, componentsOf, boxOf, type FaceMask,
} from "../lib/shapeOnFace.mts";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { parseStrictArgsOrRefuse } from "../lib/strictArgs.mts";
import { createFalMaskedEditEngine, FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE } from "../../server/providers/falImages";

const OUT = "output/edit-law";
const READS = `${OUT}/reads`;
const BENCH = "output/cprime";
const ACCESSORY = "output/accessory-cell";

/** The Unfussed candidate master — the anchor for every anatomy edit below. */
const MASTER_KEY = "casting-v2/candidates/5b9a6e1b-667c-4f03-abf9-c3eea4f249c5.png";
/** A delivered frame that WEARS the hoops. fable-181: a reference cut from a
 *  frame that lacks its subject is a fabrication. The master's ears are bare. */
const ITEM_SOURCE = `${BENCH}/cell2g-1.png`;
const ITEM_SOURCE_LABEL = "cell2g-1";

/** Repaints in this lineage where the LIPS were never asked about. The natural
 *  amplitude band, and the gloss instrument's positive specimens. */
const GLOSSY_BAND = [
  { label: "cell2g-1", frame: `${BENCH}/cell2g-1.png`, reads: `${BENCH}/reads` },
  { label: "cell2g-2", frame: `${BENCH}/cell2g-2.png`, reads: `${BENCH}/reads` },
  { label: "cell2g-3", frame: `${BENCH}/cell2g-3.png`, reads: `${BENCH}/reads` },
  ...[1, 2, 3, 4, 5].map((index) => ({
    label: `gpt2-crop-${index}`, frame: `${ACCESSORY}/gpt2-crop-${index}.png`, reads: `${ACCESSORY}/reads`,
  })),
  ...[1, 2, 3, 4, 5].map((index) => ({
    label: `gpt2-cutout-${index}`, frame: `${ACCESSORY}/gpt2-cutout-${index}.png`, reads: `${ACCESSORY}/reads`,
  })),
];

/**
 * THIS CELL'S WHOLE VOCABULARY, DECLARED SO A WORD OUTSIDE IT REFUSES (#345).
 *
 * `--dry-run` is not `--dry`, and the reader underneath this could not tell:
 * an unknown word was discarded in silence and the cell spent its fal edits
 * anyway. `--cn` is declared here too — it is read 900 lines below, and a
 * vocabulary split across a file is how one half stops being enforced.
 */
const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["n", "cn"],
  boolean: ["dry"],
});
const arg = (name: string, fallback: string): string => ARGS.value(name) ?? fallback;
const N = Number(arg("n", "3"));
const DRY = ARGS.flag("dry");

const apiKey = process.env.FAL_KEY;
if (!apiKey) { console.error("FAL_KEY is required"); process.exit(1); }

const reader = createFalRegionReader({ apiKey });
const engine = createFalMaskedEditEngine({ apiKey });
await mkdir(READS, { recursive: true });

const MIN_COMPONENT = 150;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex").slice(0, 12);

let regionReads = 0;
let paints = 0;
let reused = 0;
let spend = 0;

async function readRegion(label: string, bytes: Buffer, name: string, dir = READS): Promise<FaceMask | null> {
  const path = `${dir}/${label}--${name}.png`;
  const cached = await loadMaskFile(path);
  if (cached) return cached;
  if (await readFile(`${path}.no-read`).catch(() => null)) return null;
  const mask = await reader.region({ image: bytes, name, absentIsAnswer: true }).catch(() => null);
  regionReads += 1;
  if (!mask) { await writeFile(`${path}.no-read`, "the reader answered nothing\n"); return null; }
  await writeFile(path, await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  }).png().toBuffer());
  return maskOf({ data: Buffer.from(mask.data), info: { width: mask.width, height: mask.height } });
}

/* ------------------------------------------------------- the two lip readings */

/**
 * GLOSS, as specular fraction — pixels well above the lips' own median
 * luminance, as a share of the lips, measured through the lips' own mask so a
 * brighter photograph cannot read as a shinier mouth.
 *
 * # THE THRESHOLD WAS CHOSEN ON CONTROLS, AND THE WHOLE SWEEP IS PUBLISHED
 *
 * `+35` was pre-registered as the primary before any number was seen.
 * `scripts/calibration/lips-threshold-sweep-disposable.mts` then swept
 * +20/+35/+50/+65/+80 across ONE bare specimen (the master) and THIRTEEN glossy
 * ones — control specimens only, with no arm in existence to fit to. Only two
 * thresholds separate the bare frame from every glossy frame:
 *
 *      +20   bare 12.94%   glossy 11.53–13.06%   OVERLAPS — blind
 *      +35   bare  4.40%   glossy  4.92– 6.01%   separates, gap 0.52pp
 *      +50   bare  1.75%   glossy  2.13– 2.75%   separates, gap 0.39pp
 *      +65   bare  0.71%   glossy  0.32– 1.37%   OVERLAPS — blind
 *      +80   bare  0.00%   glossy  0.00– 0.25%   floor — blind
 *
 * So BOTH surviving thresholds are carried and **a verdict requires them to
 * agree**; where they disagree the reading is UNDECIDED. Keeping the
 * pre-registered one and demanding a second independent threshold agree is
 * stricter than picking the sweep's winner, which would be fitting the
 * instrument to the answer it was wanted to give.
 *
 * # AND THE SEPARATION IS THIN — WHICH MATTERS MOST FOR THE VERDICT WE NEED
 *
 * Half a percentage point, on one negative specimen. That is enough to say
 * "gloss is present" (a reading at or above the glossy family's floor) and
 * NOT enough to say "gloss is absent" from a number alone. Scenario a3's
 * question is exactly the absence one, so the cell buys a **maximum-gloss
 * positive control** — one deliberate wet-shine paint — to find out whether
 * this scale has any dynamic range at all. If it does not, the gloss half of
 * scenario a is reported as UNMEASURABLE ON THIS INSTRUMENT rather than
 * answered by a number that cannot carry the weight.
 *
 * # AND THEN THE RANGE CONTROL DEMOTED THE PRE-REGISTERED THRESHOLD
 *
 * The max-gloss paint arrived and settled it. Three specimens whose truth is
 * known before they are read — the bare master, the thirteen ordinary-gloss
 * family frames, and one deliberate wet high-shine paint:
 *
 *      +35   bare 4.40%   family 4.92–6.01%   MAX GLOSS 5.69%  ← inside the family
 *      +50   bare 1.75%   family 2.13–2.75%   MAX GLOSS 3.60%  ← clear of both
 *
 * **+35 is blind at the top.** A deliberately extreme gloss is
 * indistinguishable from routine nude gloss on it, which means it cannot order
 * the one thing an instrument must order: more of the quantity it claims to
 * measure. Physically it reads as sheen saturating; a true wet highlight is far
 * brighter than median+35, so counting everything above that floor drowns it.
 *
 * **+50 orders all three known specimens monotonically, with a gap at each
 * boundary.** So +50 becomes the PRIMARY and +35 is reported but **no longer
 * used to decide** — requiring agreement from a measure proven blind at the top
 * would poison the verdict rather than double-check it.
 *
 * This choice was made on CONTROL specimens alone, with a1/a2/a3 unread — that
 * is what calibration is. Both columns stay in every table so the demotion is
 * visible rather than tidied away.
 */
const SPECULAR_ABOVE = 50;
const SPECULAR_SECOND = 35;

type Lips = {
  specular: number; specular2: number; p95: number;
  fullness: number; height: number; mask: FaceMask;
};

async function readLips(label: string, framePath: string, readsDir: string): Promise<Lips | null> {
  const bytes = await readFile(framePath).catch(() => null);
  if (!bytes) return null;
  const [lips, face] = await Promise.all([
    readRegion(label, bytes, "lips", readsDir),
    readRegion(label, bytes, "face", readsDir),
  ]);
  if (!lips || !face) return null;
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== lips.width || info.height !== lips.height) return null;
  const luminance: number[] = [];
  for (let index = 0; index < lips.data.length; index += 1) {
    if (lips.data[index] === 0) continue;
    luminance.push(
      0.2126 * data[index * 3]! + 0.7152 * data[index * 3 + 1]! + 0.0722 * data[index * 3 + 2]!,
    );
  }
  if (luminance.length === 0) return null;
  const sorted = [...luminance].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  const box = boxOf(lips, 0);
  const faceBox = boxOf(face, 0);
  return {
    specular: luminance.filter((value) => value > median + SPECULAR_ABOVE).length / luminance.length,
    specular2: luminance.filter((value) => value > median + SPECULAR_SECOND).length / luminance.length,
    p95: median === 0 ? NaN : p95 / median,
    fullness: lips.pixels / face.pixels,
    height: box.h / faceBox.h,
    mask: lips,
  };
}

/* ----------------------------------------------------------------- the fixture */

/* The PRODUCTION public bucket, named explicitly rather than read from
   `R2_PUBLIC_URL` — the local `.env` points at the dev bucket, where this
   candidate does not exist, and a 404 on the anchor is not worth debugging
   twice. Read-only, free, and the same base every other bench in this
   directory uses. */
const publicBase = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";

async function master(): Promise<Buffer> {
  const path = `${OUT}/master.png`;
  const cached = await readFile(path).catch(() => null);
  if (cached) return cached;
  const response = await fetch(`${publicBase}/${MASTER_KEY}`);
  if (!response.ok) { console.error(`the master did not fetch: ${response.status}`); process.exit(1); }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(path, bytes);
  return bytes;
}

const masterBytes = await master();
const masterMeta = await sharp(masterBytes).metadata();
const width = masterMeta.width!;
const height = masterMeta.height!;
console.log(`master ${width}x${height} — ${MASTER_KEY.split("/").pop()}  sha ${sha(masterBytes)}\n`);

/* -------------------------------------------------------------- the controls */

console.log("=".repeat(90));
console.log("THE CONTROLS, BEFORE ANY ARM'S NUMBER COUNTS");
console.log("=".repeat(90));

let controlHeld = true;

/* 1 — the shape instrument on its own subject. Must be 1.000. */
const masterFace = await readRegion("master", masterBytes, "face");
const masterLipsMask = masterFace ? await readRegion("master", masterBytes, "lips") : null;
if (!masterFace || !masterLipsMask) {
  console.error("  the master's own face or lips did not read — this cell has no anchor. STOP.");
  process.exit(1);
}
const self = iouWithMapped(masterLipsMask, ontoFaceOf(masterLipsMask, masterFace, masterFace, masterLipsMask));
console.log(`  shape    the master's lips remapped onto its OWN face      IoU ${self.toFixed(3)}`);
if (self < 0.999) controlHeld = false;

/* 2 — the lip instruments, negative specimen against positive family. */
const masterLips = await readLips("master", `${OUT}/master.png`, READS);
if (!masterLips) { console.error("  the master's lips did not measure. STOP."); process.exit(1); }

const band: { label: string; lips: Lips }[] = [];
for (const entry of GLOSSY_BAND) {
  const lips = await readLips(entry.label, entry.frame, entry.reads);
  if (lips) band.push({ label: entry.label, lips });
}
const spread = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { lo: sorted[0]!, hi: sorted[sorted.length - 1]!, mid: sorted[Math.floor(sorted.length / 2)]!, n: sorted.length };
};
const bandSpecular = spread(band.map((entry) => entry.lips.specular));
const bandSpecular2 = spread(band.map((entry) => entry.lips.specular2));
const bandFullness = spread(band.map((entry) => entry.lips.fullness));

console.log(
  `\n  gloss    master (BARE, the negative)              +${SPECULAR_ABOVE} ${(masterLips.specular * 100).toFixed(2)}%`
  + `   +${SPECULAR_SECOND} ${(masterLips.specular2 * 100).toFixed(2)}%   p95/median ${masterLips.p95.toFixed(3)}`,
);
console.log(
  `  gloss    the glossy family (positive, n=${bandSpecular.n})      +${SPECULAR_ABOVE} `
  + `${(bandSpecular.lo * 100).toFixed(2)}–${(bandSpecular.hi * 100).toFixed(2)}%`
  + `   +${SPECULAR_SECOND} ${(bandSpecular2.lo * 100).toFixed(2)}–${(bandSpecular2.hi * 100).toFixed(2)}%`,
);
const glossSeparates = bandSpecular.lo > masterLips.specular;
console.log(`           ${glossSeparates
  ? `SEPARATES at +${SPECULAR_ABOVE} — every glossy frame reads above the bare master.`
  : "DOES NOT SEPARATE — the gloss instrument is BLIND on this fixture and reports nothing."}`);
console.log(
  `           gap ${((bandSpecular.lo - masterLips.specular) * 100).toFixed(2)}pp at +${SPECULAR_ABOVE}, on ONE negative specimen — enough to call gloss`
  + "\n           PRESENT, and not enough on its own to call it ABSENT, which is the verdict a3 needs."
  + "\n           The max-gloss control below is what says whether the scale has range at the top.",
);

/**
 * THE THREE-WAY RULE, fixed on control specimens before any arm is read.
 *
 * PRESENT   at or above the glossy family's floor
 * BARE      at or below the bare master's own reading
 * UNDECIDED between them
 *
 * ⚠ BOTH EDGES OF THIS RULE ARE WITHDRAWN in the nude region (2026-08-10, shift
 * 23). PRESENT is anchored on "the glossy family's floor" — a family labelled
 * positive because a gloss crop was SENT to it, never because gloss was
 * measured coming back. BARE is anchored on ONE unpainted specimen, and a paint
 * is not a photograph. Bought afterwards: three paints of a single identical
 * prompt spread 0.67pp on this measure, wider than the whole natural-to-nude
 * range it is being asked to divide; and read backwards it puts gloss-STRUCK
 * frames above the gloss-ASKED frame, failing its own positive control by sign.
 *
 * So in the nude region every verdict this rule produces should be read as
 * UNDECIDED whatever it prints. It keeps its range only at the extremes, where
 * the specimens are outcome-verified: a maximal wet ask (3.60%) and a matte
 * control (0.26%). The FULLNESS instrument beside it is unaffected — its noise
 * floor is 0.10pp and its margins clear it.
 *
 * Left in place rather than re-anchored because re-anchoring wants a positive
 * class labelled by delivered pixels, and that class does not exist yet.
 * glossy-family-sweep-disposable.mts holds the reading.
 *
 * **Decided on the PRIMARY threshold alone.** The secondary is printed in every
 * table and deliberately does not vote: the range control proved +35 blind at
 * the top (a maximal gloss lands inside the ordinary family), and requiring
 * agreement from a measure that cannot order its own quantity would poison the
 * verdict rather than double-check it.
 *
 * An UNDECIDED reading is reported as undecided and never rounded into a
 * verdict — D-235's asymmetry, applied to an instrument whose negative half is
 * the weak one.
 */
type Gloss = "PRESENT" | "BARE" | "UNDECIDED";
const glossOf = (lips: Lips): Gloss => {
  if (lips.specular >= bandSpecular.lo) return "PRESENT";
  if (lips.specular <= masterLips.specular) return "BARE";
  return "UNDECIDED";
};

console.log(
  `\n  fullness master                                    ${(masterLips.fullness * 100).toFixed(2)}% of face`
  + `   lip height ${(masterLips.height * 100).toFixed(2)}% of face`,
);
console.log(
  `  fullness the unedited family (n=${bandFullness.n})              `
  + `${(bandFullness.lo * 100).toFixed(2)}–${(bandFullness.hi * 100).toFixed(2)}%  median ${(bandFullness.mid * 100).toFixed(2)}%`,
);
console.log(
  "           the band is REPAINT NOISE on a feature nobody asked about: any \"it changed\"\n"
  + "           claim below has to clear it, and any \"it held\" claim has to sit inside it.",
);

/*
  3 — THE SHAPE BANDS. An IoU means nothing without the floor the reader itself
  produces on a feature nobody touched.

  A lip outline is soft-edged, so two honest repaints of the SAME lips do not
  score 1.000 against each other. Scoring a carried feature against a bar
  borrowed from a hard-edged one is the wrong-boundary class, and it has already
  appeared four times in this program. So both bands are measured here, from
  masks already on disk, before any carried number is judged.
*/
const masterHair = await readRegion("master", masterBytes, "hair");
const lipsIouBand: number[] = [];
const hairIouBand: number[] = [];
for (const entry of GLOSSY_BAND) {
  const face = await loadMaskFile(`${entry.reads}/${entry.label}--face.png`);
  if (!face) continue;
  const theirLips = await loadMaskFile(`${entry.reads}/${entry.label}--lips.png`);
  if (theirLips) lipsIouBand.push(iouWithMapped(masterLipsMask, ontoFaceOf(theirLips, face, masterFace, masterLipsMask)));
  const theirHair = await loadMaskFile(`${entry.reads}/${entry.label}--hair.png`);
  if (theirHair && masterHair) hairIouBand.push(iouWithMapped(masterHair, ontoFaceOf(theirHair, face, masterFace, masterHair)));
}
const lipsFloor = lipsIouBand.length === 0 ? null : spread(lipsIouBand);
const hairFloor = hairIouBand.length === 0 ? null : spread(hairIouBand);
console.log(
  `\n  shape    UNEDITED LIPS, repaint against the master (n=${lipsIouBand.length})   `
  + (lipsFloor ? `IoU ${lipsFloor.lo.toFixed(3)}–${lipsFloor.hi.toFixed(3)}  median ${lipsFloor.mid.toFixed(3)}` : "NO BAND"),
);
console.log(
  `  shape    UNEDITED HAIR, repaint against the master (n=${hairIouBand.length})   `
  + (hairFloor ? `IoU ${hairFloor.lo.toFixed(3)}–${hairFloor.hi.toFixed(3)}  median ${hairFloor.mid.toFixed(3)}` : "NO BAND"),
);
console.log("           a carried lip that lands inside its own band HELD; a hair that lands below");
console.log("           its band CHANGED. Neither is judged against a bar borrowed from another kind.");

/* 4 — the hoops, and their own repaint band. */
const itemBytes = await readFile(ITEM_SOURCE);
const itemFace = await readRegion(ITEM_SOURCE_LABEL, itemBytes, "face", `${BENCH}/reads`);
const itemEarrings = await readRegion(ITEM_SOURCE_LABEL, itemBytes, "earring", `${BENCH}/reads`);
if (!itemFace || !itemEarrings) {
  console.error("  the item source frame's face or earrings did not read. STOP.");
  process.exit(1);
}
const itemSplit = componentsOf(itemEarrings, MIN_COMPONENT);
if (itemSplit.kept.length !== 2) {
  console.error(`  the item source shows ${itemSplit.kept.length} hoops, not two — scenarios c and d have no premise. STOP.`);
  process.exit(1);
}
const instances = itemSplit.kept
  .map((mask) => ({ mask, side: mask.cx < itemFace.cx ? "img-left" : "img-right" }))
  .sort((a, b) => a.mask.cx - b.mask.cx);

/** Hoop size in the FACE's own units, so a moved or rescaled head is not a bigger hoop. */
const hoopSize = (hoop: FaceMask, face: FaceMask) => hoop.pixels / face.pixels;
const introSize: Record<string, number> = {};
for (const instance of instances) introSize[instance.side] = hoopSize(instance.mask, itemFace);

const hoopBandValues: number[] = [];
for (const entry of GLOSSY_BAND) {
  const earrings = await loadMaskFile(`${entry.reads}/${entry.label}--earring.png`);
  const face = await loadMaskFile(`${entry.reads}/${entry.label}--face.png`);
  if (!earrings || !face) continue;
  for (const component of componentsOf(earrings, MIN_COMPONENT).kept) {
    const side = component.cx < face.cx ? "img-left" : "img-right";
    const own = introSize[side];
    if (own === undefined) continue;
    hoopBandValues.push(hoopSize(component, face) / own);
  }
}
const hoopBand = hoopBandValues.length === 0 ? null : spread(hoopBandValues);
console.log(
  `\n  hoops    intro anchor  img-left ${(introSize["img-left"]! * 100).toFixed(3)}%  `
  + `img-right ${(introSize["img-right"]! * 100).toFixed(3)}% of face`,
);
console.log(hoopBand
  ? `  hoops    repaint band, unedited (n=${hoopBand.n})            ×${hoopBand.lo.toFixed(2)}–${hoopBand.hi.toFixed(2)}  median ×${hoopBand.mid.toFixed(2)}`
  : "  hoops    NO BAND — no cached hoop reads. \"bigger\" would have no floor to clear.");
if (!hoopBand) controlHeld = false;

console.log(`\n  ${controlHeld
  ? "The instruments reproduce what is already known. The arms below count."
  : "AN INSTRUMENT FAILED ITS OWN CONTROL — this cell reports NOTHING."}`);
if (!controlHeld) process.exit(1);

/* -------------------------------------------------------- the recipe assembler */

/**
 * A RECIPE IS BUILT HERE, AND THE LAW IS ENFORCED ON IT BEFORE IT IS PAID FOR.
 *
 * Every reference carries its ROLE. D-244 line 2 says a feature's own carry
 * crop never rides in its own edit, so the builder refuses to paint any recipe
 * that hands one over. This is working law 3 driven directly rather than
 * through a model that usually behaves: the refusal is a `process.exit`, not a
 * prompt sentence hoping to be obeyed.
 */
type Role =
  | { kind: "master" }
  | { kind: "anchor"; feature: string }   /* an introduced item's FROZEN intro reference */
  | { kind: "carry"; feature: string };   /* a minted crop of a feature this render does not touch */

type Reference = { role: Role; bytes: Buffer; note: string };
type Recipe = { label: string; edits: string[]; prompt: string; references: Reference[] };

const IDENTITY = [
  "Reference 1 is the photograph of this person — reproduce her exactly: same face, same pose,",
  "same lighting, same framing, same background.",
].join(" ");

function assemble(label: string, edits: string[], sentences: string[], references: Reference[]): Recipe {
  for (const reference of references) {
    if (reference.role.kind === "carry" && edits.includes(reference.role.feature)) {
      console.error(`\nRECIPE REFUSED — "${label}" edits ${reference.role.feature} and also carries its own crop.`);
      console.error("D-244 line 2: a feature's own crop never rides in its own edit. Nothing was painted.");
      process.exit(1);
    }
  }
  const slots = references.filter((reference) => reference.role.kind !== "master").map((reference) => {
    const role = reference.role as Exclude<Role, { kind: "master" }>;
    return `${role.kind}:${role.feature}`;
  });
  if (new Set(slots).size !== slots.length) {
    console.error(`\nRECIPE REFUSED — "${label}" gives one feature slot two references (fable-174).`);
    process.exit(1);
  }
  return { label, edits, prompt: [IDENTITY, ...sentences].join(" "), references };
}

async function paint(recipe: Recipe): Promise<Buffer | null> {
  const path = `${OUT}/${recipe.label}.png`;
  const cached = await readFile(path).catch(() => null);
  if (cached) { reused += 1; return cached; }
  if (DRY) return null;
  const bytes = await engine.edit({
    prompt: recipe.prompt,
    references: recipe.references.map((reference) => ({ bytes: reference.bytes, contentType: "image/png" })),
    width,
    height,
  }).then((result) => result.bytes).catch((error) => {
    console.log(`    FAILED: ${(error as Error).message.slice(0, 140)}`);
    return null;
  });
  if (!bytes) return null;
  paints += 1;
  spend += FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE;
  await writeFile(path, bytes);
  return bytes;
}

/** A crop of a feature, cut from the frame that delivered it — the mint. */
async function mint(feature: string, frameBytes: Buffer, mask: FaceMask, margin = 40): Promise<Buffer> {
  const path = `${OUT}/mint-${feature}.png`;
  const cached = await readFile(path).catch(() => null);
  if (cached) return cached;
  const box = boxOf(mask, margin);
  const bytes = await sharp(frameBytes).extract({ left: box.x, top: box.y, width: box.w, height: box.h }).png().toBuffer();
  await writeFile(path, bytes);
  return bytes;
}

const ledger: any[] = [];
const record = (recipe: Recipe, delivered: boolean) => {
  ledger.push({
    label: recipe.label,
    edits: recipe.edits,
    prompt: recipe.prompt,
    references: recipe.references.map((reference) => ({ role: reference.role, sha: sha(reference.bytes), note: reference.note })),
    delivered,
  });
};

/* ------------------------------------------------------------------ scenario a */

console.log(`\n${"=".repeat(90)}`);
console.log("a — GLOSS → FULLER → REMOVE GLOSS.  The founding case: remove must come back BARE and FULLER.");
console.log("=".repeat(90));
console.log("Every step anchors on the MASTER and carries the FULL word stack. No step is painted");
console.log("from the step before it — that is the whole of D-244 line 2.\n");

const WORDS_GLOSS = "Change her lips: give her a soft nude lip gloss.";
const WORDS_FULLER = "Change her lips: make her lips noticeably fuller.";
const WORDS_BOTH = "Change her lips: make her lips noticeably fuller, and give her a soft nude lip gloss.";

type Reading = { label: string; lips: Lips | null };

/** Every lip reading, by label — the founder tile pack captions itself from this
 *  rather than re-deriving the same numbers a second time (working law 4). */
const lipReadings: Record<string, { specular: number; specular2: number; fullness: number; height: number }> = {};

async function runLipStep(label: string, sentences: string[], count: number): Promise<Reading[]> {
  const readings: Reading[] = [];
  for (let index = 1; index <= count; index += 1) {
    const stepLabel = count === 1 ? label : `${label}-${index}`;
    const recipe = assemble(stepLabel, ["lips"], sentences, [
      { role: { kind: "master" }, bytes: masterBytes, note: "the pristine master — the anatomy anchor" },
    ]);
    const bytes = await paint(recipe);
    record(recipe, bytes !== null);
    if (!bytes) { readings.push({ label: stepLabel, lips: null }); continue; }
    const lips = await readLips(stepLabel, `${OUT}/${stepLabel}.png`, READS);
    readings.push({ label: stepLabel, lips });
    if (lips) {
      lipReadings[stepLabel] = {
        specular: lips.specular, specular2: lips.specular2, fullness: lips.fullness, height: lips.height,
      };
    }
    console.log(
      `  ${stepLabel.padEnd(14)}`
      + (lips
        ? `+${SPECULAR_ABOVE} ${(lips.specular * 100).toFixed(2)}%  +${SPECULAR_SECOND} ${(lips.specular2 * 100).toFixed(2)}%  `
        + `${glossOf(lips).padEnd(10)}fullness ${(lips.fullness * 100).toFixed(2)}%  `
        + `lip height ${(lips.height * 100).toFixed(2)}%`
        : "NO-READ"),
    );
  }
  return readings;
}

const verdicts: string[] = [];
const inBand = (value: number, of: ReturnType<typeof spread>) => value >= of.lo && value <= of.hi;

/*
  THE RANGE CONTROL, BOUGHT BEFORE THE ARM IT PROTECTS.

  One deliberate wet-shine paint, with known ground truth by construction: if a
  maximal gloss ask does not read clear of the family's floor, this scale has no
  dynamic range, and every gloss verdict below is withdrawn before it is made.
*/
const a0 = await runLipStep("a0-maxgloss", [
  "Change her lips: give her a heavy wet high-shine lip gloss with strong specular highlights.",
], 1);
const maxGloss = a0[0]?.lips ?? null;
let glossUsable = false;
if (maxGloss) {
  glossUsable = glossOf(maxGloss) === "PRESENT" && maxGloss.specular > bandSpecular.hi;
  console.log(
    `\n  RANGE CONTROL — a maximal gloss reads +${SPECULAR_ABOVE} ${(maxGloss.specular * 100).toFixed(2)}% against`
    + ` a bare ${(masterLips.specular * 100).toFixed(2)}% and a family topping out at ${(bandSpecular.hi * 100).toFixed(2)}%.`,
  );
  console.log(`  ${glossUsable
    ? "The scale HAS RANGE. Gloss verdicts below stand on it."
    : "THE SCALE HAS NO RANGE — every gloss verdict below is WITHDRAWN and reported as UNMEASURABLE."}\n`);
} else if (!DRY) {
  console.log("\n  RANGE CONTROL NOT PAINTED — the gloss half of scenario a cannot be adjudicated.\n");
}

const a1 = await runLipStep("a1-gloss", [WORDS_GLOSS], 1);
const a2 = await runLipStep("a2-fuller", [WORDS_BOTH], 1);
const a3 = await runLipStep("a3-remove", [WORDS_FULLER], N);

/*
  THE CONTROLS THE FIRST RUN PROVED WERE MISSING.

  The gloss instrument was proven on specimens whose lips are all the same size
  — the master and the family sit between 4.27% and 4.42% of the face. Then the
  arms moved fullness by a quarter (a2 and a3 read 5.4–5.7%), and the readings
  stopped ordering by gloss:

      a1  gloss asked, normal fullness   +50 2.39%
      a2  gloss asked, FULLER            +50 2.28%
      a3  gloss STRUCK, FULLER           +50 1.95% / 2.44% / 2.98%

  The frame that asked for gloss is not the glossiest. A plumper lip carries a
  broader highlight by geometry alone, so on a fuller mouth this measure is
  reading VOLUME and calling it shine. The control set never spanned the arm's
  own conditions, which is the whole of why it could not see that.

  So two more controls, both with their truth fixed by construction and both at
  the ARM'S fullness rather than the master's: a deliberately matte fuller lip
  and a deliberately wet fuller lip. a3 is then judged between two brackets that
  share its geometry instead of against a master two sizes smaller.
*/
const a4 = await runLipStep("a4-matte-fuller", [
  "Change her lips: make her lips noticeably fuller, completely matte with no shine at all.",
], 1);
const a5 = await runLipStep("a5-wet-fuller", [
  "Change her lips: make her lips noticeably fuller, with a heavy wet high-shine gloss.",
], 1);

const matteFuller = a4[0]?.lips ?? null;
const wetFuller = a5[0]?.lips ?? null;
const bracketed = matteFuller !== null && wetFuller !== null
  && wetFuller.specular > matteFuller.specular;
if (matteFuller && wetFuller) {
  console.log(
    `\n  MATCHED-FULLNESS BRACKET — matte ${(matteFuller.specular * 100).toFixed(2)}%`
    + ` · wet ${(wetFuller.specular * 100).toFixed(2)}%   at fullness`
    + ` ${(matteFuller.fullness * 100).toFixed(2)}% / ${(wetFuller.fullness * 100).toFixed(2)}%`,
  );
  console.log(`  ${bracketed
    ? "The bracket ORDERS at the arm's own fullness. a3's gloss verdict is read against it."
    : "THE BRACKET DOES NOT ORDER — matte reads at or above wet, so this measure cannot see gloss"}`);
  if (!bracketed) {
    console.log("  on a fuller mouth at all. The gloss half of scenario a is UNANSWERED, and it is the");
    console.log("  instrument that failed, not the law. Reported as unanswered rather than as a verdict.");
  }
}

/**
 * The gloss verdict at the arm's own fullness. Falls back to the master-anchored
 * rule only for frames whose fullness sits inside the unedited band, where that
 * rule was actually proven.
 */
const glossAtFullness = (lips: Lips): string => {
  if (inBand(lips.fullness, bandFullness)) {
    return glossUsable ? glossOf(lips) : "UNMEASURABLE (no proven range at this fullness)";
  }
  if (!bracketed || !matteFuller || !wetFuller) {
    return "UNANSWERED (no ordering bracket at this fullness)";
  }
  if (lips.specular <= matteFuller.specular) return "BARE";
  if (lips.specular >= wetFuller.specular) return "PRESENT";
  return "UNDECIDED";
};

const glossVerdict = glossAtFullness;

if (!DRY) {
  const gloss1 = a1[0]?.lips;
  const full2 = a2[0]?.lips;
  if (gloss1) {
    verdicts.push(
      `a1  gloss asked from the bare master → ${glossVerdict(gloss1)}`
      + `  (+${SPECULAR_ABOVE} ${(gloss1.specular * 100).toFixed(2)}% vs bare ${(masterLips.specular * 100).toFixed(2)}%)`,
    );
  }
  if (full2) {
    const fuller = full2.fullness > bandFullness.hi;
    verdicts.push(
      `a2  fuller + gloss, both from the master → fullness ${(full2.fullness * 100).toFixed(2)}%`
      + ` vs the unedited band's top ${(bandFullness.hi * 100).toFixed(2)}%: ${fuller ? "FULLER DELIVERED" : "NOT FULLER"}`
      + `, gloss ${glossVerdict(full2)}`,
    );
  }
  for (const reading of a3) {
    if (!reading.lips) { verdicts.push(`a3  ${reading.label}: NO-READ`); continue; }
    const gloss = glossVerdict(reading.lips);
    const stillFuller = reading.lips.fullness > bandFullness.hi;
    const held = gloss === "BARE" && stillFuller;
    verdicts.push(
      `a3  ${reading.label}: gloss ${gloss}, fuller ${stillFuller ? "YES" : "NO"}`
      + ` (fullness ${(reading.lips.fullness * 100).toFixed(2)}%)  →  `
      + (held ? "THE LAW HELD — bare AND fuller"
        : gloss === "UNDECIDED" || gloss.startsWith("UNMEASURABLE")
          ? "NO VERDICT on the gloss half; the fullness half is above"
          : "THE LAW DID NOT HOLD"),
    );
  }
}

/* ------------------------------------------------------------------ scenario b */

console.log(`\n${"=".repeat(90)}`);
console.log("b — CARRY STABILITY.  Edit the hair; the untouched lips crop rides byte-identical.");
console.log("=".repeat(90));

const a2Bytes = await readFile(`${OUT}/a2-fuller.png`).catch(() => null);
const a2Lips = a2Bytes ? await readRegion("a2-fuller", a2Bytes, "lips") : null;
const a2Face = a2Bytes ? await readRegion("a2-fuller", a2Bytes, "face") : null;

if (!a2Bytes || !a2Lips || !a2Face) {
  console.log("  a2 has not been painted (or did not read), so there is no minted lips crop to carry.");
  console.log("  Scenario b is NOT-RUN. Stated as owed, not reported as absent.");
} else {
  const lipsCrop = await mint("lips", a2Bytes, a2Lips);
  const mintSha = sha(lipsCrop);
  console.log(`  minted lips crop from a2-fuller — sha ${mintSha}`);
  const carriedShas = new Set<string>();
  for (let index = 1; index <= N; index += 1) {
    const label = `b-carry-${index}`;
    const recipe = assemble(label, ["hair"], [
      "Reference 2 is her lips exactly as they are now — keep them exactly as they are.",
      "Change her hair: wear it gathered back into a low bun.",
    ], [
      { role: { kind: "master" }, bytes: masterBytes, note: "the pristine master" },
      { role: { kind: "carry", feature: "lips" }, bytes: lipsCrop, note: "minted from a2-fuller" },
    ]);
    carriedShas.add(sha(recipe.references[1]!.bytes));
    const bytes = await paint(recipe);
    record(recipe, bytes !== null);
    if (!bytes) { console.log(`  ${label.padEnd(12)}NOT PAINTED`); continue; }
    const lips = await readLips(label, `${OUT}/${label}.png`, READS);
    const face = await readRegion(label, bytes, "face");
    const hair = await readRegion(label, bytes, "hair");
    const masterHair = await readRegion("master", masterBytes, "hair");
    let lipsIou: number | null = null;
    if (lips && face) lipsIou = iouWithMapped(a2Lips, ontoFaceOf(lips.mask, face, a2Face, a2Lips));
    let hairIou: number | null = null;
    if (hair && face && masterHair) hairIou = iouWithMapped(masterHair, ontoFaceOf(hair, face, masterFace, masterHair));
    /* The carried lips are judged against the LIPS band, the edited hair against
       the HAIR band — each kind against its own reader's floor. */
    const lipsHeld = lipsIou !== null && lipsFloor !== null && lipsIou >= lipsFloor.lo;
    const hairChanged = hairIou !== null && hairFloor !== null && hairIou < hairFloor.lo;
    console.log(
      `  ${label.padEnd(12)}lips-on-face IoU ${lipsIou === null ? "  —  " : lipsIou.toFixed(3)}`
      + ` ${lipsIou === null ? "" : (lipsHeld ? "HELD  " : "BELOW ")}`
      + `  lips fullness ${lips ? (lips.fullness * 100).toFixed(2) + "%" : "—"}`
      + `   hair-vs-master IoU ${hairIou === null ? "  —  " : hairIou.toFixed(3)}`
      + ` ${hairIou === null ? "" : (hairChanged ? "CHANGED" : "unchanged")}`,
    );
    if (lipsIou !== null) {
      verdicts.push(
        `b   ${label}: carried lips IoU ${lipsIou.toFixed(3)} against`
        + `${lipsFloor ? ` an unedited-lips repaint floor of ${lipsFloor.lo.toFixed(3)}` : " no band"}`
        + ` — ${lipsHeld ? "HELD" : "BELOW THE FLOOR"}`
        + `${hairIou === null ? "" : `; hair ${hairIou.toFixed(3)} vs a floor of ${hairFloor ? hairFloor.lo.toFixed(3) : "—"} — ${hairChanged ? "the edit LANDED" : "hair did not move"}`}`,
      );
    }
  }
  verdicts.push(
    `b   the carried crop rode ${carriedShas.size === 1 ? "BYTE-IDENTICAL" : "WITH DIFFERENT BYTES"} across all ${N} recipes`
    + ` (sha ${[...carriedShas].join(", ")})`,
  );
}

/* --------------------------------------------------- scenario b′, the adapter arm */

/*
  SUSPECT THE ADAPTER FIRST.

  b's carried lips came back at the MASTER's size — the reference was sent,
  byte-identical, and ignored. Before that is reported as the architecture
  failing, the obvious other suspect is MY OWN PROMPT: the identity clause says
  *"reproduce her exactly: same face, same pose"*, and her face in reference 1
  has the master's thin lips. So the recipe contains an instruction to reproduce
  exactly the thing the carried crop is there to override, and the two are in
  the same sentence-stack fighting each other.

  This arm changes one thing: the identity clause is SCOPED to exclude whatever
  the other references carry. Same crop, same ask, same engine, same n. If the
  lips hold here, the defect was the wording and D-241's shape survives; if they
  revert here too, the master genuinely outranks a reference and the swap has a
  real problem to take to the founder.
*/
console.log(`\n${"=".repeat(90)}`);
console.log("b′ — THE SAME CARRY, WITH THE IDENTITY CLAUSE SCOPED. One word changed, nothing else.");
console.log("=".repeat(90));

const SCOPED_IDENTITY = [
  "Reference 1 is the photograph of this person — reproduce her exactly: same face, same pose,",
  "same lighting, same framing, same background — EXCEPT for the features that the other",
  "references show, which override reference 1 wherever they disagree with it.",
].join(" ");

if (!a2Bytes || !a2Lips || !a2Face) {
  console.log("  no minted lips crop, so b′ is NOT-RUN alongside b.");
} else {
  const lipsCrop = await mint("lips", a2Bytes, a2Lips);
  for (let index = 1; index <= N; index += 1) {
    const label = `bp-scoped-${index}`;
    const recipe = assemble(label, ["hair"], [
      "Reference 2 is her lips exactly as they are now — keep them exactly as they are, including their fullness.",
      "Change her hair: wear it gathered back into a low bun.",
    ], [
      { role: { kind: "master" }, bytes: masterBytes, note: "the pristine master" },
      { role: { kind: "carry", feature: "lips" }, bytes: lipsCrop, note: "minted from a2-fuller" },
    ]);
    /* The only difference from b: the identity clause. Swapped at the wire. */
    recipe.prompt = recipe.prompt.replace(IDENTITY, SCOPED_IDENTITY);
    if (!recipe.prompt.startsWith(SCOPED_IDENTITY)) {
      console.error("  the scoped clause did not replace the identity clause — b′ would be a repeat of b. STOP.");
      process.exit(1);
    }
    const bytes = await paint(recipe);
    record(recipe, bytes !== null);
    if (!bytes) { console.log(`  ${label.padEnd(14)}NOT PAINTED`); continue; }
    const lips = await readLips(label, `${OUT}/${label}.png`, READS);
    const face = await readRegion(label, bytes, "face");
    const hair = await readRegion(label, bytes, "hair");
    let lipsIou: number | null = null;
    if (lips && face) lipsIou = iouWithMapped(a2Lips, ontoFaceOf(lips.mask, face, a2Face, a2Lips));
    let hairIou: number | null = null;
    if (hair && face && masterHair) hairIou = iouWithMapped(masterHair, ontoFaceOf(hair, face, masterFace, masterHair));
    const held = lipsIou !== null && lipsFloor !== null && lipsIou >= lipsFloor.lo;
    const keptFull = lips ? lips.fullness > bandFullness.hi : false;
    console.log(
      `  ${label.padEnd(14)}lips IoU ${lipsIou === null ? "  —  " : lipsIou.toFixed(3)} ${held ? "HELD " : "BELOW"}`
      + `   fullness ${lips ? (lips.fullness * 100).toFixed(2) + "%" : "—"} ${keptFull ? "KEPT FULLER" : "back to baseline"}`
      + `   hair ${hairIou === null ? "  —  " : hairIou.toFixed(3)}`,
    );
    verdicts.push(
      `b'  ${label}: scoped identity clause — lips IoU ${lipsIou === null ? "—" : lipsIou.toFixed(3)}`
      + ` vs floor ${lipsFloor ? lipsFloor.lo.toFixed(3) : "—"}, fullness ${lips ? (lips.fullness * 100).toFixed(2) : "—"}%`
      + ` — ${keptFull ? "THE FULLNESS SURVIVED" : "still reverted to the master's lips"}`,
    );
  }
}

/* ------------------------------------- b″ and b‴, the two remaining cheap suspects */

/*
  TWO MORE SUSPECTS BEFORE THE ARCHITECTURE IS BLAMED.

  b and b′ both reverted, so it is not the identity clause's wording. Two other
  explanations cost one paint each to test, and both are about the reference
  rather than the recipe:

    b″  LEGIBILITY — the crop is a 40px-margin rectangle a few hundred pixels
        across. A small picture may read as decoration where a large, detailed
        one reads as an instruction. Same pixels, upscaled 3×.
    b‴  POSITION — the master is always reference 1. Engines weight the first
        image; the carried crop may simply be losing to its slot rather than to
        its content. Same pixels, sent FIRST, with the sentences renumbered to
        match (a sentence naming the wrong ordinal is the two-lists defect).

  If either holds the fullness, the swap's shape survives and the fix is in the
  reference, not the architecture. If neither does, the finding stands on three
  independent arms and it is the founder's fork.
*/
if (a2Bytes && a2Lips && a2Face) {
  const lipsCrop = await mint("lips", a2Bytes, a2Lips);

  const bigCrop = await (async () => {
    const path = `${OUT}/mint-lips-3x.png`;
    const cached = await readFile(path).catch(() => null);
    if (cached) return cached;
    const meta = await sharp(lipsCrop).metadata();
    const bytes = await sharp(lipsCrop)
      .resize({ width: meta.width! * 3, height: meta.height! * 3, kernel: "lanczos3" })
      .png().toBuffer();
    await writeFile(path, bytes);
    return bytes;
  })();

  const ARMS: {
    id: string; title: string; references: Reference[]; sentences: string[];
  }[] = [
    {
      id: "bq-legible", title: "b″ — the SAME crop, upscaled 3× so it cannot be missed",
      references: [
        { role: { kind: "master" }, bytes: masterBytes, note: "the pristine master" },
        { role: { kind: "carry", feature: "lips" }, bytes: bigCrop, note: "a2's lips crop at 3×" },
      ],
      sentences: [
        "Reference 2 is her lips exactly as they are now — keep them exactly as they are, including their fullness.",
        "Change her hair: wear it gathered back into a low bun.",
      ],
    },
    {
      id: "br-first", title: "b‴ — the carried crop sent FIRST, the master second",
      references: [
        { role: { kind: "carry", feature: "lips" }, bytes: lipsCrop, note: "a2's lips crop, in slot 1" },
        { role: { kind: "master" }, bytes: masterBytes, note: "the pristine master, in slot 2" },
      ],
      sentences: [
        "Reference 1 is her lips exactly as they are now — keep them exactly as they are, including their fullness.",
        "Reference 2 is the photograph of this person — reproduce her exactly: same face, same pose, same lighting,",
        "same framing, same background, except for her lips, which are as reference 1 shows them.",
        "Change her hair: wear it gathered back into a low bun.",
      ],
    },
  ];

  for (const arm of ARMS) {
    console.log(`\n${"=".repeat(90)}`);
    console.log(arm.title);
    console.log("=".repeat(90));
    for (let index = 1; index <= N; index += 1) {
      const label = `${arm.id}-${index}`;
      const recipe = assemble(label, ["hair"], arm.sentences, arm.references);
      /* b‴ writes its own reference-1 sentence, so the shared identity clause
         must not also be prepended — two reference-1 sentences would be the
         ordinal defect this cell exists to avoid. */
      if (arm.id === "br-first") recipe.prompt = arm.sentences.join(" ");
      const bytes = await paint(recipe);
      record(recipe, bytes !== null);
      if (!bytes) { console.log(`  ${label.padEnd(14)}NOT PAINTED`); continue; }
      const lips = await readLips(label, `${OUT}/${label}.png`, READS);
      const face = await readRegion(label, bytes, "face");
      let lipsIou: number | null = null;
      if (lips && face) lipsIou = iouWithMapped(a2Lips, ontoFaceOf(lips.mask, face, a2Face, a2Lips));
      const keptFull = lips ? lips.fullness > bandFullness.hi : false;
      console.log(
        `  ${label.padEnd(14)}lips IoU ${lipsIou === null ? "  —  " : lipsIou.toFixed(3)}`
        + `   fullness ${lips ? (lips.fullness * 100).toFixed(2) + "%" : "—"}`
        + `   ${keptFull ? "KEPT FULLER" : "back to the master's lips"}`,
      );
      verdicts.push(
        `${arm.id === "bq-legible" ? "b\"" : "b'''"}  ${label}: fullness ${lips ? (lips.fullness * 100).toFixed(2) : "—"}%`
        + ` vs the unedited band's top ${(bandFullness.hi * 100).toFixed(2)}%`
        + ` — ${keptFull ? "THE FULLNESS SURVIVED" : "reverted"}`
        + `${lipsIou === null ? "" : `, IoU ${lipsIou.toFixed(3)} vs floor ${lipsFloor ? lipsFloor.lo.toFixed(3) : "—"}`}`,
      );
    }
  }
}

/* ------------------------------------------------------------------ scenario c */

console.log(`\n${"=".repeat(90)}`);
console.log("c — INTRODUCED-ITEM EDIT.  The hoop regenerates from its FROZEN INTRO anchor + words.");
console.log("=".repeat(90));
console.log("The anchor is the hoop as it was introduced, cut from a frame that WEARS it (fable-181).");
console.log("The master's own ears are bare, so it could never have been the item's anchor.\n");

async function introCrop(side: string): Promise<Buffer> {
  const instance = instances.find((entry) => entry.side === side)!;
  const path = `${OUT}/anchor-earring-${side}.png`;
  const cached = await readFile(path).catch(() => null);
  if (cached) return cached;
  const box = boxOf(instance.mask, 40);
  const bytes = await sharp(itemBytes).extract({ left: box.x, top: box.y, width: box.w, height: box.h }).png().toBuffer();
  await writeFile(path, bytes);
  return bytes;
}

const anchorLeft = await introCrop("img-left");
const anchorRight = await introCrop("img-right");
console.log(`  intro anchors — img-left sha ${sha(anchorLeft)} · img-right sha ${sha(anchorRight)}\n`);

async function measureHoops(label: string, bytes: Buffer): Promise<Record<string, { size: number; ratio: number; mask: FaceMask }>> {
  const [earrings, face] = await Promise.all([
    readRegion(label, bytes, "earring"),
    readRegion(label, bytes, "face"),
  ]);
  const out: Record<string, { size: number; ratio: number; mask: FaceMask }> = {};
  if (!earrings || !face) return out;
  for (const component of componentsOf(earrings, MIN_COMPONENT).kept) {
    const side = component.cx < face.cx ? "img-left" : "img-right";
    const size = hoopSize(component, face);
    const held = out[side];
    if (held && held.size > size) continue;
    out[side] = { size, ratio: size / introSize[side]!, mask: component };
  }
  return out;
}

const C_COUNT = Number(arg("cn", "2"));
for (let index = 1; index <= C_COUNT; index += 1) {
  const label = `c-bigger-${index}`;
  const recipe = assemble(label, ["earring@img-left", "earring@img-right"], [
    "Reference 2 is the exact gold hoop earring she wears on the ear that appears on the LEFT of the photograph.",
    "Reference 3 is the exact gold hoop earring she wears on the ear that appears on the RIGHT of the photograph.",
    "She is wearing that pair of gold hoop earrings, one on each ear.",
    "Change the earrings: make both hoops noticeably bigger.",
  ], [
    { role: { kind: "master" }, bytes: masterBytes, note: "the pristine master" },
    { role: { kind: "anchor", feature: "earring@img-left" }, bytes: anchorLeft, note: "frozen intro reference, cut from cell2g-1" },
    { role: { kind: "anchor", feature: "earring@img-right" }, bytes: anchorRight, note: "frozen intro reference, cut from cell2g-1" },
  ]);
  const bytes = await paint(recipe);
  record(recipe, bytes !== null);
  if (!bytes) { console.log(`  ${label.padEnd(14)}NOT PAINTED`); continue; }
  const hoops = await measureHoops(label, bytes);
  const line = instances.map((instance) => {
    const found = hoops[instance.side];
    return `${instance.side} ${found ? `×${found.ratio.toFixed(2)}` : "absent"}`;
  }).join("  ");
  console.log(`  ${label.padEnd(14)}${line}`);
  for (const instance of instances) {
    const found = hoops[instance.side];
    if (!found) { verdicts.push(`c   ${label} ${instance.side}: NO HOOP FOUND`); continue; }
    const bigger = hoopBand ? found.ratio > hoopBand.hi : false;
    verdicts.push(
      `c   ${label} ${instance.side}: ×${found.ratio.toFixed(2)} against the intro anchor`
      + `${hoopBand ? ` (repaint band tops out at ×${hoopBand.hi.toFixed(2)})` : ""} — ${bigger ? "BIGGER" : "NOT BIGGER"}`,
    );
  }
}

/* ------------------------------------------------------------------ scenario d */

console.log(`\n${"=".repeat(90)}`);
console.log("d — INSTANCE EDIT.  One ear only; the other is pixel-held.");
console.log("=".repeat(90));
console.log("The LEFT hoop is the edited feature — anchored on its FROZEN INTRO reference plus words.");
console.log("The RIGHT hoop is untouched — it rides the crop c RE-MINTED after delivering a bigger");
console.log("pair. So the anchor and the carry are genuinely different pixels (fable-185): the held");
console.log("check verifies against the CURRENT truth a real timeline would carry, and the role test");
console.log("no longer shares bytes with itself.\n");

/*
  d's carry reference is minted from c's DELIVERY, not from the intro frame.

  Under D-244 line 4 the delivered result is re-cropped and THAT crop is the
  feature's carry reference. c delivered a bigger pair, so by the time d runs the
  right ear's carried truth is c's hoop — not the small one it was introduced
  with. Sending the intro crop here would be carrying a picture the timeline has
  already moved past.
*/
const cSource = await readFile(`${OUT}/c-bigger-1.png`).catch(() => null);
const cHoops = cSource ? await measureHoops("c-bigger-1", cSource) : {};
const cRight = cHoops["img-right"] ?? null;

if (!cSource || !cRight) {
  console.log("  c-bigger-1 has not delivered a right hoop, so there is no RE-MINTED carry crop to");
  console.log("  send. Scenario d is NOT-RUN rather than run against the pre-c state — a held check");
  console.log("  against a superseded crop would measure the wrong promise.");
} else {
  const carryRight = await (async () => {
    const path = `${OUT}/mint-earring-img-right.png`;
    const cached = await readFile(path).catch(() => null);
    if (cached) return cached;
    const box = boxOf(cRight.mask, 40);
    const bytes = await sharp(cSource).extract({ left: box.x, top: box.y, width: box.w, height: box.h }).png().toBuffer();
    await writeFile(path, bytes);
    return bytes;
  })();
  console.log(
    `  anchor  img-left  sha ${sha(anchorLeft)}  (frozen intro, ×1.00 by definition)\n`
    + `  carry   img-right sha ${sha(carryRight)}  (re-minted from c-bigger-1 at ×${cRight.ratio.toFixed(2)})`,
  );
  if (sha(carryRight) === sha(anchorRight)) {
    console.log("  the two are the SAME BYTES — the role test would share bytes with itself. Declared.");
  }
  console.log("");

  for (let index = 1; index <= N; index += 1) {
    const label = `d-oneear-${index}`;
    const recipe = assemble(label, ["earring@img-left"], [
      "Reference 2 is the exact gold hoop earring she wears on the ear that appears on the LEFT of the photograph.",
      "Reference 3 is the exact gold hoop earring she wears on the ear that appears on the RIGHT of the photograph —",
      "keep that one exactly as it is.",
      "She is wearing a gold hoop earring on each ear.",
      "Change only the earring on the ear that appears on the LEFT of the photograph: make that hoop noticeably bigger.",
    ], [
      { role: { kind: "master" }, bytes: masterBytes, note: "the pristine master" },
      { role: { kind: "anchor", feature: "earring@img-left" }, bytes: anchorLeft, note: "frozen intro reference — the EDITED instance" },
      { role: { kind: "carry", feature: "earring@img-right" }, bytes: carryRight, note: "re-minted from c-bigger-1 — the HELD instance" },
    ]);
    const bytes = await paint(recipe);
    record(recipe, bytes !== null);
    if (!bytes) { console.log(`  ${label.padEnd(14)}NOT PAINTED`); continue; }
    const hoops = await measureHoops(label, bytes);
    const face = await readRegion(label, bytes, "face");
    const left = hoops["img-left"];
    const right = hoops["img-right"];
    /* The held instance is scored against WHAT IT CARRIES — c's re-minted hoop —
       in each frame's own face, so a moved head is not a moved earring. */
    let heldIou: number | null = null;
    if (right && face && cSource) {
      const cFace = await readRegion("c-bigger-1", cSource, "face");
      if (cFace) heldIou = iouWithMapped(cRight.mask, ontoFaceOf(right.mask, face, cFace, cRight.mask));
    }
    const heldRatio = right ? right.size / cRight.size : null;
    console.log(
      `  ${label.padEnd(14)}left ${left ? `×${left.ratio.toFixed(2)}` : "absent"} vs intro`
      + `   right ${heldRatio === null ? "absent" : `×${heldRatio.toFixed(2)}`} vs c's mint`
      + `   right-held IoU ${heldIou === null ? "  —  " : heldIou.toFixed(3)}`,
    );
    const grew = left && hoopBand ? left.ratio > hoopBand.hi : false;
    const held = heldRatio !== null && hoopBand ? inBand(heldRatio, hoopBand) : false;
    verdicts.push(
      `d   ${label}: edited LEFT ${left ? `×${left.ratio.toFixed(2)}` : "absent"} vs its frozen intro — ${grew ? "BIGGER" : "not bigger"};`
      + ` held RIGHT ${heldRatio === null ? "absent" : `×${heldRatio.toFixed(2)}`} vs c's re-minted crop`
      + ` ${held ? "INSIDE the repaint band" : "OUTSIDE the band"}`
      + `${heldIou === null ? "" : `, on-face IoU ${heldIou.toFixed(3)} against 0.85 ratified`}`,
    );
  }
}

/* ------------------------------------------------------------------- the table */

console.log(`\n${"=".repeat(90)}`);
console.log("THE CELL");
console.log("=".repeat(90));
for (const verdict of verdicts) console.log(`  ${verdict}`);
if (verdicts.length === 0) console.log("  nothing painted — no verdicts. Controls above stand on their own.");

console.log(
  `\n${paints} new paints · ${reused} reused · ${regionReads} region reads · spend $${spend.toFixed(3)} · 0 credits`,
);
console.log("GPT Image 2 only. NBP-anatomical routes are a DECLARED NOT-RUN, not a silent one.");

await writeFile(`${OUT}/cell.json`, JSON.stringify({
  n: N,
  master: { key: MASTER_KEY, sha: sha(masterBytes), width, height },
  controls: {
    shapeIdentity: self,
    glossSeparates,
    masterLips: { specular: masterLips.specular, p95: masterLips.p95, fullness: masterLips.fullness, height: masterLips.height },
    bandSpecular, bandFullness, hoopBand, introSize,
  },
  thresholds: { primary: SPECULAR_ABOVE, secondary: SPECULAR_SECOND },
  lipReadings,
  recipes: ledger,
  verdicts,
  paints, reused, regionReads, spend,
}, null, 2));
console.log(`\nledger + controls written to ${OUT}/cell.json`);
process.exit(0);
