/**
 * THE ACCESSORY FOLLOW-UP CELL — per-instance references, crop vs cutout,
 * both painters (fable-162, fable-165, fable-169; queued by fable-171 item 2).
 *
 * Three things are being asked at once, and they are separable in the table:
 *
 * 1. **Per-instance addressing** (fable-162). Each earring is its own reference
 *    crop, addressed to its own ear. The pair cell sent ONE hoop reference and
 *    a pair clause; this sends two, and measures each delivered hoop against
 *    ITS OWN reference rather than against "an earring".
 * 2. **Crop vs cutout** (fable-165, the founder's reduces-hallucination
 *    hypothesis). Same items, same recipe, two reference forms.
 * 3. **Pair delivery per engine, per arm** (fable-169) — his own tally gets its
 *    n, in its own column.
 *
 *   FAL_KEY=… npx tsx scripts/calibration/accessory-instance-cell.mts [--n 5] [--dry]
 *
 * # HAIR IS NOT RUN, AND THAT IS DECLARED RATHER THAN QUIET
 *
 * fable-165 §2 requires cutouts made with a real matting model. opus-129
 * measured that none exists for ITEMS: BiRefNet mattes the ear, not the earring
 * (IoU 0.034–0.039 against the region reader's own mask), and no trimap model
 * is published on this transport. The rule's own escape clause governs — crisp
 * -edged items only, hair NOT-RUN — so the cutout arm here uses SAM 3's binary
 * mask as alpha, which for a gold hoop is very nearly its true alpha anyway.
 * A blurred outline (`evf-sam`'s `blur_mask`) would be the fidelity law's named
 * substitution and is not used.
 *
 * # THE SIDE NAMING IS THE PICTURE'S, NOT HERS
 *
 * "Her left" and "the left of the photograph" are opposite sides, and this
 * program has already paid once for a laterality word a model answered its own
 * way. So both the prompt and the measurement speak in IMAGE sides — the ear
 * that appears on the left of the picture — which is the one description that
 * cannot be answered wrong by either party.
 *
 * # What it costs
 *
 * 4 arms × n paints: GPT Image 2 at $0.099 measured, Nano Banana Pro at $0.150
 * list. At n=5 that is 20 paints and **$2.49**, plus region reads. Every paint
 * and every read is cached to disk; a resumed run buys only what was never
 * bought. No campaign credit; nothing renders on any user's account.
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import {
  loadMaskFile, maskOf, ontoFaceOf, iouWithMapped, componentsOf, boxOf, type FaceMask,
} from "../lib/shapeOnFace.mts";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { createFalMaskedEditEngine, FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE } from "../../server/providers/falImages";
import { NANO_BANANA_PRO_USD_PER_IMAGE } from "../../server/providers/falQueue";
import { castingIdentityEngine } from "../../server/castingV2/signEngine";
import { parseStrictArgsOrRefuse } from "../lib/strictArgs.mts";

/*
  THE SOURCE FRAME IS A DELIVERED ONE, AND THAT IS THE ARCHITECTURE, NOT A
  SHORTCUT.

  The first draft cut the instance references out of the candidate master
  `5b9a6e1b…`, and the reader answered *"the segmenter found no earring to
  edit"* — because SHE IS NOT WEARING ANY. The hoops in this lineage were
  painted by the bench; the master's ears are bare. Cutting a reference from a
  frame that does not contain the thing is the fringe class in a new costume,
  and the fixture caught it before a single paint was bought.

  So the source is `cell2g-1` — a delivered GPT Image 2 frame that wears the
  pair, whose masks the bench already bought. Under D-241 that is exactly where
  an edit-carried reference comes from: the delivered frame is the product's
  memory of the feature. Reference 1 is that same frame, so the recipe is
  "reproduce HER, keep THESE earrings" with every reference cut from the picture
  being reproduced.
*/
const SOURCE = "output/cprime/cell2g-1.png";
const SOURCE_LABEL = "cell2g-1";
const OUT = "output/accessory-cell";
const READS = `${OUT}/reads`;
/* The bench's own cached reads, for the counter's control frames. */
const BENCH = "output/cprime";

/**
 * THIS CELL'S WHOLE VOCABULARY, DECLARED SO A WORD OUTSIDE IT REFUSES (#345).
 *
 * The reader here was `process.argv.indexOf("--" + name)` beside a bare
 * `includes("--dry")`, which cannot fail on a word it was never asked about.
 * The sharp case is the safest-sounding word an operator can type: **`--dry-run`
 * is not `--dry`**, so it was discarded in silence and this cell — which drives
 * a fal masked edit and a region read per instance — spent house money on a
 * line the operator believed was a rehearsal. That is #288's production
 * incident exactly, on a paid transport rather than a shift row.
 *
 * A refusal now prints the known vocabulary, so the operator reads `--dry` and
 * types it. Nothing is spent on the way to finding out.
 */
const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["n"],
  boolean: ["dry"],
});
const N = Number(ARGS.value("n") ?? "5");
const DRY = ARGS.flag("dry");

const apiKey = process.env.FAL_KEY;
if (!apiKey) { console.error("FAL_KEY is required"); process.exit(1); }

const sharp = (await import("sharp")).default;
const reader = createFalRegionReader({ apiKey });
const engine = createFalMaskedEditEngine({ apiKey });
const identity = castingIdentityEngine();
await mkdir(READS, { recursive: true });

/** A speck is not an earring. Every size is printed, so the floor is visible. */
const MIN_COMPONENT = 150;

let regionReads = 0;
let paints = 0;
let reused = 0;
let spend = 0;

/**
 * A region read, cached.
 *
 * `--dry` does NOT suppress these: a dry run's job is to prove the controls
 * before any paint is bought, and the controls are made of reads. Suppressing
 * them made the first dry run report "the master did not read" on a cold cache,
 * which is a lie about the fixture dressed as a finding about the reader.
 */
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

/* ------------------------------------------------------------- the master */

const masterBytes = await readFile(SOURCE);
const masterMeta = await sharp(masterBytes).metadata();
const width = masterMeta.width!;
const height = masterMeta.height!;
console.log(`source frame ${SOURCE} — ${width}x${height}\n`);

/* The bench's own masks for this frame: already bought, not re-bought. */
const masterFace = await readRegion(SOURCE_LABEL, masterBytes, "face", `${BENCH}/reads`);
const masterEarrings = await readRegion(SOURCE_LABEL, masterBytes, "earring", `${BENCH}/reads`);
if (!masterFace || !masterEarrings) {
  console.error("the source frame's own face or earrings did not read — this cell has no references. STOP.");
  process.exit(1);
}

const masterSplit = componentsOf(masterEarrings, MIN_COMPONENT);
console.log(`HER EARRINGS ON THE SOURCE FRAME — components ${masterSplit.sizes.join(", ")} (floor ${MIN_COMPONENT})`);
if (masterSplit.kept.length !== 2) {
  console.error(`the source frame does not show TWO earrings (${masterSplit.kept.length} kept) — the premise of a`);
  console.error("per-instance cell is gone on this fixture. STOP rather than address one hoop twice.");
  process.exit(1);
}

/* Sided by the picture, not by her — see the header. */
const instances = masterSplit.kept
  .map((mask) => ({ mask, side: mask.cx < masterFace.cx ? "img-left" : "img-right" }))
  .sort((a, b) => a.mask.cx - b.mask.cx);
if (instances[0]!.side === instances[1]!.side) {
  console.error("both hoops fell on the same side of her face centroid — the sider is wrong. STOP.");
  process.exit(1);
}
for (const instance of instances) {
  console.log(`  ${instance.side.padEnd(10)} ${instance.mask.pixels.toLocaleString().padStart(6)} px at x=${instance.mask.cx.toFixed(0)}`);
}

/* ------------------------------------------------- the two reference forms */

const MARGIN = 40;

async function referencesFor(form: "crop" | "cutout"): Promise<Buffer[]> {
  const built: Buffer[] = [];
  for (const instance of instances) {
    const box = boxOf(instance.mask, MARGIN);
    const path = `${OUT}/ref-${form}-${instance.side}.png`;
    const cached = await readFile(path).catch(() => null);
    if (cached) { built.push(cached); continue; }
    const crop = sharp(masterBytes).extract({ left: box.x, top: box.y, width: box.w, height: box.h });
    let bytes: Buffer;
    if (form === "crop") {
      bytes = await crop.png().toBuffer();
    } else {
      /* The instance's own mask, cropped to the same box, used as alpha. A hard
         edge, declared: see the header. */
      const alpha = Buffer.alloc(box.w * box.h);
      for (let y = 0; y < box.h; y += 1) {
        for (let x = 0; x < box.w; x += 1) {
          alpha[y * box.w + x] = instance.mask.data[(box.y + y) * width + (box.x + x)]! > 0 ? 255 : 0;
        }
      }
      bytes = await crop
        .ensureAlpha()
        .joinChannel(alpha, { raw: { width: box.w, height: box.h, channels: 1 } })
        .png()
        .toBuffer();
    }
    await writeFile(path, bytes);
    built.push(bytes);
  }
  return built;
}

const cropRefs = await referencesFor("crop");
const cutoutRefs = await referencesFor("cutout");
console.log(`\nreferences built: ${cropRefs.length} crops, ${cutoutRefs.length} cutouts (margin ${MARGIN} px)`);

/* ------------------------------------------------------------- the counter */

type Verdict = "PAIR" | "SINGLE" | "NONE" | "NO-READ";

async function countInstances(label: string, bytes: Buffer, dir = READS): Promise<{
  verdict: Verdict;
  sizes: number[];
  bySide: Map<string, FaceMask>;
  face: FaceMask | null;
}> {
  const [earrings, face] = await Promise.all([
    readRegion(label, bytes, "earring", dir),
    readRegion(label, bytes, "face", dir),
  ]);
  if (!earrings || !face) return { verdict: "NO-READ", sizes: [], bySide: new Map(), face };
  const split = componentsOf(earrings, MIN_COMPONENT);
  const bySide = new Map<string, FaceMask>();
  for (const component of split.kept) {
    const side = component.cx < face.cx ? "img-left" : "img-right";
    /* If two components land on one side, the larger is the hoop and the other
       is kept out of the pair verdict rather than counted as a second ear. */
    const held = bySide.get(side);
    if (!held || component.pixels > held.pixels) bySide.set(side, component);
  }
  const verdict: Verdict = bySide.size >= 2 ? "PAIR" : bySide.size === 1 ? "SINGLE" : "NONE";
  return { verdict, sizes: split.sizes, bySide, face };
}

/* ---------------------------------------------------------- the controls */

console.log(`\n${"=".repeat(88)}`);
console.log("THE CONTROLS, BEFORE ANY ARM'S NUMBER COUNTS");
console.log("=".repeat(88));

/* 1 — the counter, against frames whose answer was established by eye. */
const EXPECTED: Verdict[] = ["PAIR", "PAIR", "SINGLE"];
let controlHeld = true;
for (let index = 0; index < 3; index += 1) {
  const label = `cell2g-${index + 1}`;
  const bytes = await readFile(`${BENCH}/${label}.png`).catch(() => null);
  if (!bytes) { console.log(`  counter  ${label}  NOT ON DISK`); controlHeld = false; continue; }
  /* The bench's own cached masks for these frames — already bought, not re-bought. */
  const counted = await countInstances(label, bytes, `${BENCH}/reads`);
  const agrees = counted.verdict === EXPECTED[index];
  if (!agrees) controlHeld = false;
  console.log(
    `  counter  ${label}  ${counted.verdict.padEnd(7)} expected ${EXPECTED[index]!.padEnd(7)}`
    + `${agrees ? "agrees" : "DISAGREES"}   components ${counted.sizes.slice(0, 4).join(", ") || "none"}`,
  );
}

/* 2 — the shape instrument on its own subject. Must be 1.000. */
const self = iouWithMapped(
  instances[0]!.mask,
  ontoFaceOf(instances[0]!.mask, masterFace, masterFace, instances[0]!.mask),
);
console.log(`  shape    an instance remapped onto its OWN face   IoU ${self.toFixed(3)}`);
if (self < 0.999) controlHeld = false;

console.log(`\n  ${controlHeld
  ? "Both instruments reproduce what is already known. The arms below count."
  : "AN INSTRUMENT FAILED ITS OWN CONTROL — this cell reports NOTHING."}`);
if (!controlHeld) process.exit(1);

if (DRY) {
  console.log(`\n--dry: controls only. 0 paints, ${regionReads} region reads.`);
  process.exit(0);
}

/* ------------------------------------------------------------- the prompt */

const PROMPT = [
  "Reference 1 is the photograph of this person — reproduce her exactly: same face, same pose,",
  "same lighting, same framing, same background.",
  "Reference 2 is the exact gold hoop earring she is wearing on the ear that appears on the LEFT",
  "side of the photograph — keep that earring exactly as it is.",
  "Reference 3 is the exact gold hoop earring she is wearing on the ear that appears on the RIGHT",
  "side of the photograph — keep that earring exactly as it is.",
  "Change only her eye colour to green.",
].join(" ");
console.log(`\nTHE RECIPE — master + two instance references, and one ask:\n  "${PROMPT}"\n`);

const ARMS: { id: string; engine: "gpt2" | "nbp"; form: "crop" | "cutout"; usd: number }[] = [
  { id: "gpt2-crop", engine: "gpt2", form: "crop", usd: FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE },
  { id: "gpt2-cutout", engine: "gpt2", form: "cutout", usd: FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE },
  { id: "nbp-crop", engine: "nbp", form: "crop", usd: NANO_BANANA_PRO_USD_PER_IMAGE["1K"] },
  { id: "nbp-cutout", engine: "nbp", form: "cutout", usd: NANO_BANANA_PRO_USD_PER_IMAGE["1K"] },
];

async function paint(arm: typeof ARMS[number]): Promise<Buffer> {
  const refs = [{ bytes: masterBytes, contentType: "image/png" }].concat(
    (arm.form === "crop" ? cropRefs : cutoutRefs).map((bytes) => ({ bytes, contentType: "image/png" })),
  );
  if (arm.engine === "gpt2") {
    return (await engine.edit({ prompt: PROMPT, references: refs, width, height })).bytes;
  }
  return (await identity.editWithReferences({ prompt: PROMPT, references: refs, resolution: "1K" })).bytes;
}

/* ---------------------------------------------------------------- the run */

type Row = {
  label: string;
  verdict: Verdict;
  sizes: number[];
  shape: Record<string, number | null>;
};

const byArm: Record<string, Row[]> = {};

for (const arm of ARMS) {
  console.log(`\n${arm.id}  —  n=${N}`);
  const rows: Row[] = [];
  for (let index = 0; index < N; index += 1) {
    const label = `${arm.id}-${index + 1}`;
    let bytes = await readFile(`${OUT}/${label}.png`).catch(() => null);
    if (bytes) { reused += 1; } else {
      process.stdout.write(`  painting ${index + 1}/${N}… `);
      bytes = await paint(arm).catch((error) => {
        console.log(`FAILED: ${(error as Error).message.slice(0, 120)}`);
        return null;
      });
      if (!bytes) { rows.push({ label, verdict: "NO-READ", sizes: [], shape: {} }); continue; }
      paints += 1; spend += arm.usd;
      await writeFile(`${OUT}/${label}.png`, bytes);
    }
    const counted = await countInstances(label, bytes);
    const shape: Record<string, number | null> = {};
    for (const instance of instances) {
      const delivered = counted.bySide.get(instance.side);
      if (!delivered || !counted.face) { shape[instance.side] = null; continue; }
      /*
        PER INSTANCE, AGAINST ITS OWN REFERENCE — fable-162's whole point.
        Mapped through each frame's own face so a moved head cannot be scored
        as a moved earring (the head-motion anchor, opus-125).
      */
      shape[instance.side] = iouWithMapped(
        instance.mask,
        ontoFaceOf(delivered, counted.face, masterFace, instance.mask),
      );
    }
    rows.push({ label, verdict: counted.verdict, sizes: counted.sizes, shape });
    console.log(
      `  ${label.padEnd(16)}${counted.verdict.padEnd(7)}`
      + instances.map((instance) => {
        const value = shape[instance.side];
        return `${instance.side} ${value === null ? " —   " : value.toFixed(3)}`;
      }).join("  ")
      + `   components ${counted.sizes.slice(0, 3).join(", ") || "none"}`,
    );
  }
  byArm[arm.id] = rows;
}

/* ------------------------------------------------------------- the table */

console.log(`\n${"=".repeat(88)}`);
console.log("THE CELL");
console.log("=".repeat(88));
console.log("  arm".padEnd(16) + "pairs".padStart(8) + "singles".padStart(9) + "none".padStart(6)
  + "  shape worst".padStart(14) + "  shape median".padStart(15) + "  n scored");

const summary: any[] = [];
for (const arm of ARMS) {
  const rows = byArm[arm.id] ?? [];
  const read = rows.filter((row) => row.verdict !== "NO-READ");
  const pairs = read.filter((row) => row.verdict === "PAIR").length;
  const singles = read.filter((row) => row.verdict === "SINGLE").length;
  const none = read.filter((row) => row.verdict === "NONE").length;
  const scores = rows
    .flatMap((row) => Object.values(row.shape))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const worst = scores[0] ?? null;
  const median = scores.length === 0 ? null : scores[Math.floor(scores.length / 2)]!;
  summary.push({ arm: arm.id, pairs, singles, none, read: read.length, worst, median, scored: scores.length });
  console.log(
    `  ${arm.id.padEnd(14)}`
    + `${pairs}/${read.length}`.padStart(8)
    + String(singles).padStart(9)
    + String(none).padStart(6)
    + (worst === null ? "—" : worst.toFixed(3)).padStart(14)
    + (median === null ? "—" : median.toFixed(3)).padStart(15)
    + String(scores.length).padStart(10),
  );
}

console.log("\nPAIR DELIVERY, the founder's tally with its n (fable-169) — per engine, per arm.");
console.log("SHAPE is per instance against ITS OWN reference crop, in the face's own frame.");
console.log("Hair is NOT-RUN in the cutout arm and that is a declared gap, not a null result.");

console.log(`\n${paints} new paints · ${reused} reused · ${regionReads} region reads · spend $${spend.toFixed(3)} · 0 credits`);
await writeFile(`${OUT}/cell.json`, JSON.stringify({
  n: N, prompt: PROMPT, instances: instances.map((i) => ({ side: i.side, pixels: i.mask.pixels })),
  byArm, summary, paints, reused, regionReads, spend,
}, null, 2));
process.exit(0);
