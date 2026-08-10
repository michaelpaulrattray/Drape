/**
 * C′ — DOES A REFERENCE MAKE THE ITEM THE SAME, OR ONLY SIMILAR?
 *
 * Ordered by fable-153/154/156 on the founder's own declaration: *"NBP will
 * reliably copy any hairstyle or reference image onto the original."* He
 * believes reference-conditioned repaint from the PRISTINE MASTER — never a
 * chain, one generation deep forever — is the architecture, and calls
 * pixel-perfect pasting "an impossible ask". fable-155 named the divergence and
 * put the blend build on hold behind this answer.
 *
 * So this measures the one thing everything hangs on, at the resolution a
 * customer flicks between versions at.
 *
 *   FAL_KEY=… npx tsx scripts/calibration/cprime-bench.mts [--n 5] [--dry]
 *
 * `--dry` runs the controls and spends NOTHING — no NBP call is made. Use it to
 * prove the instrument before the cells, which is the order fable-153 requires.
 *
 * # The fixture, and why this one
 *
 * The Unfussed lineage, candidate `f9e9cb81` (ratified, fable-156): we hold her
 * master, four delivered frames, and three real segment crops. The replay face
 * stays untouched for its own walk.
 *
 * # The two items, and why the second is glasses rather than hair
 *
 * fable-153 asks for "earring-vs-earring and hair-vs-hair". The earring is
 * here: a gold hoop, delivered on v#156, small and high-frequency, which is the
 * hardest thing for a reference to reproduce. The second item is her GLASSES
 * rather than her hair, and that is a departure with a reason: this face's only
 * hair segment is the incidental `hairWorn` row §3a now forbids, cut from a
 * freckles ask — so it is a crop of hair nobody edited, and "did the hair stay
 * the same" over it is a question about the master, not about a delivered edit.
 * Her glasses are a real born-worn item with fine wire temples, and they are
 * the item the founder personally saw ghosting on block 4. Hair is reported too
 * where it costs nothing, marked for what it is.
 *
 * # What is measured, and what it CANNOT be
 *
 * Byte-identity is not on the table for C′ by construction — a full repaint
 * re-synthesizes every pixel — so measuring it would be scoring the
 * architecture against a definition it rejects. The honest measures are the
 * ones a customer's eye uses:
 *
 *   position drift   the item's centroid, in pixels, between two paints
 *   shape agreement  IoU of the item's own mask between two paints
 *   tonal delta      mean |Δluma| inside the agreed ground
 *
 * # Every cell carries its own n, and a NO-READ is a NO-READ
 *
 * A region read that comes back empty is reported as a read that failed, never
 * folded into a mean as a zero. An arm is invalid unless every specimen read.
 *
 * # A PAINT ALREADY PAID FOR IS NEVER PAID FOR TWICE
 *
 * The first run of this bench was cut off mid-cell-2 with seven paints on disk.
 * Every `paint` first looks for its own PNG in `output/cprime` and reuses it,
 * announced as `reused` — so a resumed run costs only the paints that were
 * never made. The run's report prints new calls and reused frames separately,
 * because "14 calls" and "14 calls of which 7 were free" are different facts.
 *
 * # The GPT IMAGE 2 ARM (fable-159)
 *
 * The founder observed C′ is engine-agnostic. Engine choice is ROUTING, not
 * architecture. Its image-input cap was read from fal's own OpenAPI schema on
 * 2026-08-10 — `GptImage2EditInput.image_urls.maxItems: 16`, "A maximum of 16
 * images are allowed" — which covers this fixture's five slots, so the arm
 * qualifies and runs at n=3 on the SAME references.
 *
 * It renders at ITS OWN native size: `image_size` takes exact pixels, so it is
 * given the master's own 1024x1536. NBP takes a resolution TIER and answers
 * with whatever it likes. That size difference is declared here and in the
 * report rather than hidden, and block 6's 848x1264 tear is not repeated.
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { fetchImageBytes } from "../lib/imageBytes.mts";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { castingIdentityEngine } from "../../server/castingV2/signEngine";
import { createFalMaskedEditEngine, FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE } from "../../server/providers/falImages";
import { NANO_BANANA_PRO_USD_PER_IMAGE } from "../../server/providers/falQueue";
import type { Mask } from "../../server/castingV2/maskedComposite";

const BASE = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";
const OUT = "output/cprime";

/* Rows pulled 2026-08-10 by `pull-unfussed-fixture-disposable.mts`, pasted so
   the bench depends on no live database. */
const MASTER = "casting-v2/candidates/5b9a6e1b-667c-4f03-abf9-c3eea4f249c5.png";
const V156 = "casting-v2/variants/734e3bcb-6f09-4dc9-b34f-d211526de74d.png"; /* gold hoop earrings */
const V157 = "casting-v2/variants/0137361d-a854-4e94-86c8-ad0fb7689e7a.png"; /* remove her glasses */
const CROP_MARKS = "casting-v2/segments/ab9ef497-77c7-4871-a99f-f386383b2985-content.png";
const CROP_HAIR = "casting-v2/segments/3649a9bc-782c-4265-8a09-9fd7f0ee542b-content.png";
const CROP_GLOSS = "casting-v2/segments/68e45d40-df00-46be-b80d-9427a9985937-content.png";

const arg = (name: string, fallback: string): string => {
  const at = process.argv.indexOf(`--${name}`);
  return at > -1 ? (process.argv[at + 1] ?? fallback) : fallback;
};
const N = Number(arg("n", "5"));
const DRY = process.argv.includes("--dry");

const apiKey = process.env.FAL_KEY;
if (!apiKey) { console.error("FAL_KEY is required"); process.exit(1); }

const sharp = (await import("sharp")).default;
const reader = createFalRegionReader({ apiKey });
let nbpCalls = 0;

type Frame = { label: string; bytes: Buffer; data: Buffer; width: number; height: number };

async function frameOf(label: string, bytes: Buffer): Promise<Frame> {
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { label, bytes, data, width: info.width, height: info.height };
}
const fromR2 = async (key: string, label: string): Promise<Frame> =>
  frameOf(label, (await fetchImageBytes(`${BASE}/${key}`)).bytes);

/* ------------------------------------------------------ the measurements */

type Located = { mask: Mask; pixels: number; cx: number; cy: number } | null;

/*
  A REGION READ IS PAID FOR ONCE.

  The paints are cached, so a re-run costs only reads — and this bench was
  re-run to add the head-motion control. Every mask lands in `reads/` as a
  1-channel PNG, and a NO-READ lands as its own marker file, because a NO-READ
  that is not cached gets re-paid and may come back different, which would
  silently turn a declared NO-READ into a reading.
*/
const READS = `${OUT}/reads`;
await mkdir(READS, { recursive: true });
const readKey = (frame: Frame, name: string) =>
  `${READS}/${frame.label}--${name.replace(/[^a-z0-9]+/gi, "_")}`;

let regionReads = 0;

async function readRegion(frame: Frame, name: string): Promise<Mask | null> {
  const key = readKey(frame, name);
  const cachedMask = await readFile(`${key}.png`).catch(() => null);
  if (cachedMask) {
    const { data, info } = await sharp(cachedMask).greyscale().raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  }
  const cachedMiss = await readFile(`${key}.no-read`).catch(() => null);
  if (cachedMiss) return null;

  const mask = await reader.region({ image: frame.bytes, name, absentIsAnswer: true }).catch(() => null);
  regionReads += 1;
  if (!mask) {
    await writeFile(`${key}.no-read`, "the reader answered nothing for this region\n");
    return null;
  }
  await writeFile(
    `${key}.png`,
    await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } }).png().toBuffer(),
  );
  return mask;
}

/** Where an item is in a frame, or null — which is a NO-READ, not a zero. */
async function locate(frame: Frame, name: string): Promise<Located> {
  const mask = await readRegion(frame, name);
  if (!mask) return null;
  let pixels = 0; let sumX = 0; let sumY = 0;
  for (let index = 0; index < mask.data.length; index += 1) {
    if (mask.data[index]! === 0) continue;
    pixels += 1;
    sumX += index % mask.width;
    sumY += Math.floor(index / mask.width);
  }
  if (pixels === 0) return null;
  return { mask, pixels, cx: sumX / pixels, cy: sumY / pixels };
}

type Pairing = { drift: number; anchored: number | null; iou: number; tonal: number | null; overlap: number };

type Side = { located: Located; frame: Frame; face?: Located };

/**
 * Two locations of one item, compared the ways a customer's eye would — and
 * then a fourth way the eye cannot.
 *
 * # THE HEAD MOVES TOO, AND THAT WOULD HAVE BEEN READ AS THE ITEM MOVING
 *
 * Under C′ every paint re-synthesizes the WHOLE frame, so between two paints
 * the head itself sits somewhere slightly different. Raw centroid drift cannot
 * tell "the reference failed to hold the earring" from "the earring is exactly
 * where it should be on a head that shifted" — and the first is a verdict on
 * the architecture while the second is a verdict on framing.
 *
 * So every pair is also measured in the FACE's own frame: the item's offset
 * from the face centroid, divided by that paint's own face scale, differenced,
 * and put back into pixels at the mean scale. Head translation and head size
 * both cancel. `anchored` is null when either face read failed — an unanchored
 * comparison is not an anchored one with no correction.
 */
function comparePair(a: Side, b: Side): Pairing | null {
  if (!a.located || !b.located) return null;
  if (a.frame.width !== b.frame.width || a.frame.height !== b.frame.height) return null;
  const drift = Math.hypot(a.located.cx - b.located.cx, a.located.cy - b.located.cy);

  let anchored: number | null = null;
  if (a.face && b.face) {
    /* sqrt(area) is the face's own scale: it tracks a head that is nearer or
       further without needing a second landmark to measure between. */
    const scaleA = Math.sqrt(a.face.pixels);
    const scaleB = Math.sqrt(b.face.pixels);
    if (scaleA > 0 && scaleB > 0) {
      const offsetAx = (a.located.cx - a.face.cx) / scaleA;
      const offsetAy = (a.located.cy - a.face.cy) / scaleA;
      const offsetBx = (b.located.cx - b.face.cx) / scaleB;
      const offsetBy = (b.located.cy - b.face.cy) / scaleB;
      anchored = Math.hypot(offsetAx - offsetBx, offsetAy - offsetBy) * ((scaleA + scaleB) / 2);
    }
  }
  let both = 0; let either = 0; let tonalTotal = 0;
  for (let index = 0; index < a.located.mask.data.length; index += 1) {
    const inA = a.located.mask.data[index]! > 0;
    const inB = b.located.mask.data[index]! > 0;
    if (!inA && !inB) continue;
    either += 1;
    if (!inA || !inB) continue;
    both += 1;
    const at = index * 3;
    const luma = (frame: Frame) => (
      frame.data[at]! * 299 + frame.data[at + 1]! * 587 + frame.data[at + 2]! * 114
    ) / 1000;
    tonalTotal += Math.abs(luma(a.frame) - luma(b.frame));
  }
  /*
    A TONAL DELTA OVER ZERO SHARED PIXELS IS NOT ZERO — IT IS UNMEASURED.

    Caught on this bench's own positive control: the side-swap has IoU 0.000, so
    nothing overlaps, and the first version printed "tonal 0.00" beside it — a
    number that reads as "identical tone" about two hoops on opposite ears. The
    silent-zero class, in the instrument written to catch silent zeros.
  */
  return { drift, anchored, iou: either === 0 ? 0 : both / either, tonal: both === 0 ? null : tonalTotal / both, overlap: both };
}

const stat = (values: number[]) => ({
  n: values.length,
  mean: values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length,
  worst: values.length === 0 ? 0 : Math.max(...values),
  best: values.length === 0 ? 0 : Math.min(...values),
});

/* ----------------------------------------------------------- the assets */

await mkdir(OUT, { recursive: true });
console.log("fetching the fixture out of production R2 (free)…");
const [master, v156, v157, cropMarks, cropHair, cropGloss] = await Promise.all([
  fromR2(MASTER, "master"),
  fromR2(V156, "v156-hoops"),
  fromR2(V157, "v157-noglasses"),
  fromR2(CROP_MARKS, "crop:freckles"),
  fromR2(CROP_HAIR, "crop:hair"),
  fromR2(CROP_GLOSS, "crop:lip gloss"),
]);
console.log(`  master ${master.width}x${master.height} · v156 ${v156.width}x${v156.height} · v157 ${v157.width}x${v157.height}`);
console.log(`  crops: freckles ${cropMarks.width}x${cropMarks.height} · hair ${cropHair.width}x${cropHair.height} · gloss ${cropGloss.width}x${cropGloss.height}\n`);

/*
  THE EARRING REFERENCE, cut from the frame that delivered it.

  No segment row exists for it — `statedAccessories: ZERO` is the production
  census, which is what the corridor fix and the silhouette build are for — so
  its crop is taken from v#156 at the extent the reader finds, which is the same
  question the store would have asked.
*/
console.log("locating the hoop on v#156, to cut its reference crop…");
const hoopOn156 = await locate(v156, "earring");
if (!hoopOn156) { console.error("NO-READ on the earring in v#156 — the bench has no reference. STOP."); process.exit(1); }
const hoopBox = (() => {
  let minX = v156.width; let minY = v156.height; let maxX = -1; let maxY = -1;
  for (let index = 0; index < hoopOn156.mask.data.length; index += 1) {
    if (hoopOn156.mask.data[index]! === 0) continue;
    const x = index % v156.width; const y = Math.floor(index / v156.width);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const pad = 24;
  const left = Math.max(0, minX - pad); const top = Math.max(0, minY - pad);
  return {
    left, top,
    width: Math.min(v156.width - left, maxX - minX + 1 + pad * 2),
    height: Math.min(v156.height - top, maxY - minY + 1 + pad * 2),
  };
})();
const cropHoopBytes = await sharp(v156.bytes).extract(hoopBox).png().toBuffer();
await writeFile(`${OUT}/reference-earring.png`, cropHoopBytes);
console.log(`  hoop at ${Math.round(hoopOn156.cx)},${Math.round(hoopOn156.cy)} · reference crop ${hoopBox.width}x${hoopBox.height}\n`);

/* --------------------------------------------- the instrument's controls */

console.log("THE INSTRUMENT, BEFORE ANY CELL RUNS");

const identical = comparePair({ located: hoopOn156, frame: v156 }, { located: hoopOn156, frame: v156 });
console.log(
  /* `tonal` is nullable by design — a delta over no shared ground is unmeasured,
     not zero — so even the control that cannot hit it says so rather than
     printing a 0 the type system had to be silenced to allow. */
  `  KNOWN-IDENTICAL  v#156's hoop against itself      drift ${identical!.drift.toFixed(2)} px · IoU ${identical!.iou.toFixed(3)} · tonal ${identical!.tonal === null ? "— (NO-READ: no shared ground)" : identical!.tonal.toFixed(2)}`
  + `   ${identical!.drift < 0.01 && identical!.iou > 0.999 && (identical!.tonal ?? 1) < 0.01 ? "reads identical, as it must" : "DOES NOT READ IDENTICAL — STOP"}`,
);

const hoopOn157 = await locate(v157, "earring");
const moved = comparePair({ located: hoopOn156, frame: v156 }, { located: hoopOn157, frame: v157 });
if (!moved) {
  console.log("  KNOWN-MOVED      NO-READ on v#157's hoop — the positive control did not run. Its cells are unproven.");
} else {
  console.log(
    `  KNOWN-MOVED      v#156 → v#157, the recorded side-swap   drift ${moved.drift.toFixed(1)} px · IoU ${moved.iou.toFixed(3)} · tonal ${moved.tonal === null ? "— (nothing overlaps: the hoops share no ground at all)" : moved.tonal.toFixed(2)}`
    + `   ${moved.drift > 20 || moved.iou < 0.5 ? "the instrument CAN see an item move" : "IT CANNOT — every cell below is worthless"}`,
  );
}

/*
  THE THIRD CONTROL — for the anchor itself, which is a NEW instrument.

  The head-relative measure gets its own positive control before it is allowed
  to correct anything: the whole frame is shifted a known 40 px right and 40 px
  down, so the earring and the head move together by construction. A correct
  anchor reads that as the head moving and the earring holding — raw drift
  ~56.6 px, anchored drift ~0. If the anchored number tracks the raw one, the
  correction does nothing and every "ON THE FACE" figure below is decoration.
*/
const SHIFT = 40;
const shiftedBytes = await sharp({
  create: { width: v156.width, height: v156.height, channels: 3, background: { r: 0, g: 0, b: 0 } },
})
  .composite([{ input: v156.bytes, left: SHIFT, top: SHIFT }])
  .png()
  .toBuffer();
const shifted = await frameOf("control-shifted-40px", shiftedBytes);
const faceOn156 = await locate(v156, "face");
const faceOnShifted = await locate(shifted, "face");
const hoopOnShifted = await locate(shifted, "earring");
const shiftPair = comparePair(
  { located: hoopOn156, frame: v156, face: faceOn156 },
  { located: hoopOnShifted, frame: shifted, face: faceOnShifted },
);
const expectedShift = Math.hypot(SHIFT, SHIFT);
if (!shiftPair) {
  console.log("  KNOWN-SHIFTED    NO-READ on the shifted frame — the ANCHOR is unproven, and every anchored figure below is unbacked.");
} else {
  console.log(
    `  KNOWN-SHIFTED    the whole frame moved ${SHIFT},${SHIFT} px   raw drift ${shiftPair.drift.toFixed(1)} px (expected ${expectedShift.toFixed(1)})`
    + ` · ON THE FACE ${shiftPair.anchored === null ? "— (no face read: unproven)" : `${shiftPair.anchored.toFixed(1)} px`}`
    + `   ${shiftPair.anchored !== null && shiftPair.anchored < expectedShift / 4
      ? "the anchor CANCELS head motion, as it must"
      : "THE ANCHOR DOES NOT CANCEL HEAD MOTION — every anchored figure below is decoration"}`,
  );
}

if (DRY) {
  console.log(`\n--dry: the controls ran and nothing was painted. 0 NBP calls, ${regionReads} region reads.`);
  process.exit(0);
}

/* ------------------------------------------------------------ the cells */

/**
 * C′'s prompt shape, in the founder's own terms: the pristine master plus a
 * cropped reference per delivered item, each named as an exact thing rather
 * than as a description. Nothing here chains — every paint starts here.
 */
const REFERENCE_CLAUSE = [
  "Reference 1 is the photograph of this person — reproduce her exactly: same face, same pose,",
  "same lighting, same framing, same background.",
  "Reference 2 is the exact freckles across her cheeks and nose.",
  "Reference 3 is the exact hairstyle.",
  "Reference 4 is the exact nude lip gloss.",
  "Reference 5 is the exact gold hoop earring she is wearing — the same hoop, on the same ear.",
  "She is wearing her glasses, exactly as in reference 1.",
].join(" ");

const references = [
  { bytes: master.bytes, contentType: "image/png" },
  { bytes: cropMarks.bytes, contentType: "image/png" },
  { bytes: cropHair.bytes, contentType: "image/png" },
  { bytes: cropGloss.bytes, contentType: "image/png" },
  { bytes: cropHoopBytes, contentType: "image/png" },
];

const engine = castingIdentityEngine();
const gpt2 = createFalMaskedEditEngine({ apiKey });

let gpt2Calls = 0;
let reused = 0;

/** A paint already on disk is a paint already paid for. */
async function onDisk(label: string): Promise<Frame | null> {
  const bytes = await readFile(`${OUT}/${label}.png`).catch(() => null);
  if (!bytes) return null;
  reused += 1;
  return frameOf(label, bytes);
}

async function paint(prompt: string, label: string, aspectRatio?: "2:3"): Promise<Frame> {
  const already = await onDisk(label);
  if (already) return already;
  const result = await engine.editWithReferences({
    prompt, references, resolution: "1K", ...(aspectRatio ? { aspectRatio } : {}),
  });
  nbpCalls += 1;
  await writeFile(`${OUT}/${label}.png`, result.bytes);
  return frameOf(label, result.bytes);
}

/** The same recipe through the other painter, at the master's exact pixels. */
async function paintGpt2(prompt: string, label: string): Promise<Frame> {
  const already = await onDisk(label);
  if (already) return already;
  const result = await gpt2.edit({
    prompt,
    references,
    width: master.width,
    height: master.height,
  });
  gpt2Calls += 1;
  await writeFile(`${OUT}/${label}.png`, result.bytes);
  return frameOf(label, result.bytes);
}

/** Every frame this run held, by label — so the report can quote geometry. */
const painted = new Map<string, Frame>();

type CellReport = {
  cell: string;
  n: number;
  paints: string[];
  size: string;
  head?: { pairs: number; drift: ReturnType<typeof stat> };
  items: Record<string, {
    pairs: number; noRead: number;
    drift: ReturnType<typeof stat>; anchored: ReturnType<typeof stat>;
    iou: ReturnType<typeof stat>; tonal: ReturnType<typeof stat>;
  }>;
};

async function runCell(
  cell: string,
  prompt: string,
  label: string,
  options: { n?: number; painter?: (prompt: string, label: string) => Promise<Frame> } = {},
): Promise<CellReport> {
  const n = options.n ?? N;
  const painter = options.painter ?? paint;
  console.log(`\nCELL ${cell} — ${label}, n=${n}`);
  const paints: Frame[] = [];
  for (let index = 0; index < n; index += 1) {
    const before = reused;
    process.stdout.write(`  painting ${index + 1}/${n}… `);
    const frame = await painter(prompt, `cell${cell}-${index + 1}`);
    console.log(`${frame.width}x${frame.height}${reused > before ? "  (reused — already paid for)" : ""}`);
    paints.push(frame);
  }

  for (const frame of paints) painted.set(frame.label, frame);

  const report: CellReport = {
    cell, n, paints: paints.map((frame) => frame.label),
    size: paints[0] ? `${paints[0].width}x${paints[0].height}` : "—",
    items: {},
  };

  /* The head's own position, read once per paint and shared by every item. */
  const faces = await Promise.all(paints.map((frame) => locate(frame, "face")));
  const faceNoRead = faces.filter((face) => face === null).length;
  if (faceNoRead > 0) console.log(`    (face NO-READ on ${faceNoRead} of ${n} paints — those pairs report raw drift only)`);

  /*
    THE HEAD'S OWN DRIFT, printed before any item's — because if the head moves
    as far as the earring, the earring never moved at all.
  */
  const headDrift: number[] = [];
  for (let a = 0; a < faces.length; a += 1) {
    for (let b = a + 1; b < faces.length; b += 1) {
      if (!faces[a] || !faces[b]) continue;
      headDrift.push(Math.hypot(faces[a]!.cx - faces[b]!.cx, faces[a]!.cy - faces[b]!.cy));
    }
  }
  report.head = { pairs: headDrift.length, drift: stat(headDrift) };
  console.log(
    `    ${"THE HEAD".padEnd(9)} ${headDrift.length} pairs`
    + `   drift mean ${stat(headDrift).mean.toFixed(1)} worst ${stat(headDrift).worst.toFixed(1)} px`
    + `   — the control: every item's raw drift below is measured against a head that moved this much`,
  );

  for (const item of ["earring", "glasses", "hair"]) {
    const located: Side[] = await Promise.all(paints.map(async (frame, index) => ({
      frame, located: await locate(frame, item), face: faces[index],
    })));
    const noRead = located.filter((entry) => entry.located === null).length;
    const drift: number[] = []; const anchoredDrift: number[] = []; const iou: number[] = []; const tonal: number[] = [];
    let pairs = 0;
    for (let a = 0; a < located.length; a += 1) {
      for (let b = a + 1; b < located.length; b += 1) {
        const pairing = comparePair(located[a]!, located[b]!);
        if (!pairing) continue;
        pairs += 1;
        drift.push(pairing.drift); iou.push(pairing.iou);
        if (pairing.anchored !== null) anchoredDrift.push(pairing.anchored);
        if (pairing.tonal !== null) tonal.push(pairing.tonal);
      }
    }
    report.items[item] = {
      pairs, noRead, drift: stat(drift), anchored: stat(anchoredDrift), iou: stat(iou), tonal: stat(tonal),
    };
    console.log(
      `    ${item.padEnd(9)} ${pairs} pairs${noRead > 0 ? `, ${noRead} NO-READ of ${n}` : ""}`
      + `   drift mean ${stat(drift).mean.toFixed(1)} worst ${stat(drift).worst.toFixed(1)} px`
      + `   ON THE FACE ${anchoredDrift.length === 0 ? "— (no anchored pair)" : `mean ${stat(anchoredDrift).mean.toFixed(1)} worst ${stat(anchoredDrift).worst.toFixed(1)} px over ${anchoredDrift.length}/${pairs}`}`
      + `   IoU mean ${stat(iou).mean.toFixed(3)} worst ${stat(iou).best.toFixed(3)}`
      + `   tonal mean ${tonal.length === 0 ? "— (no overlapping ground on any pair)" : `${stat(tonal).mean.toFixed(2)} over ${tonal.length}/${pairs} pairs`}`,
    );
  }
  return report;
}

const cell1 = await runCell("1", REFERENCE_CLAUSE, "repeat-paint stability, NO new ask");
const cell2 = await runCell(
  "2",
  /*
    THE UNRELATED ASK IS NOT fable-153'S LITERAL ONE, AND HERE IS WHY.

    It ordered "add subtle freckles across her nose" — but on THIS fixture the
    freckles are one of the references, so that ask would test whether a
    reference survives being re-asked for, which is a different question and a
    kinder one. Her eye colour is referenced by nothing, changes no item's
    geography, and is trivially checkable.
  */
  `${REFERENCE_CLAUSE} Change only her eye colour to green.`,
  "unrelated-edit stability — eyes to green",
);

/* ------------------------------- cell 2's GPT IMAGE 2 arm (fable-159) */

/*
  ENGINE CHOICE IS ROUTING, NOT ARCHITECTURE.

  Cap read from fal's own OpenAPI on 2026-08-10, not from memory:
  `GptImage2EditInput.image_urls` carries `maxItems: 16`. Five slots fit, so
  the arm qualifies. Same references, same ask, ITS native size.
*/
const cell2Gpt2 = await runCell(
  "2g",
  `${REFERENCE_CLAUSE} Change only her eye colour to green.`,
  `the SAME recipe through GPT Image 2, at ${master.width}x${master.height} — its exact-pixel size`,
  { n: 3, painter: paintGpt2 },
);

/* -------------------------------------------------- the framing probe */

/*
  DOES THE PAINTER GIVE BACK THE MASTER'S OWN GEOMETRY?

  Load-bearing for hybrid-D, which byte-restores unasked ground from the
  master: ground that has been resampled can never byte-match. The cells above
  asked NBP for a resolution TIER and no aspect, and it answered a 1024x1536
  master at 928x1136 — a different SHAPE, not merely a smaller one. One paint,
  with the aspect pinned, says whether that is the tier or the missing
  argument. GPT Image 2 needs no probe: it is told exact pixels, and the arm
  above either returns them or does not.
*/
const framingProbe = await paint(
  REFERENCE_CLAUSE,
  "framing-probe-aspect-pinned",
  "2:3",
).catch(() => null);
const geometryOf = (label: string) => {
  const frame = painted.get(label);
  return frame ? `${frame.width}x${frame.height}` : "—";
};
console.log("\nFRAMING PROBE — can the painter return the master's own geometry?");
console.log(`  master                       ${master.width}x${master.height}`);
console.log(`  NBP, 1K, no aspect argument  ${geometryOf("cell1-1")}`);
console.log(`  NBP, 1K, aspect pinned 2:3   ${framingProbe ? `${framingProbe.width}x${framingProbe.height}` : "NO-READ (the probe paint failed)"}`);
console.log(`  GPT Image 2, exact pixels    ${geometryOf("cell2g-1")}`);
const framing = {
  master: `${master.width}x${master.height}`,
  nbpDefault: geometryOf("cell1-1"),
  nbpAspectPinned: framingProbe ? `${framingProbe.width}x${framingProbe.height}` : null,
  gpt2Exact: geometryOf("cell2g-1"),
};

/* ------------------------------------------------- cell 3, the control */

console.log("\nCELL 3 — OUR CURRENT PIPELINE, on existing rows (no spend)");
console.log("  v#156 → v#157, the two consecutive delivered frames of this same face:");
if (moved) {
  console.log(
    `    earring   drift ${moved.drift.toFixed(1)} px · IoU ${moved.iou.toFixed(3)} · tonal ${moved.tonal === null ? "— (no shared ground)" : moved.tonal.toFixed(2)}`,
  );
  console.log("    This is the recorded side-swap — our pipeline re-rolls an accessory from words on");
  console.log("    every later render, which is the defect the silhouette build exists to end.");
} else {
  console.log("    NO-READ on v#157's hoop — reported as a NO-READ, not as a zero.");
}

/* ------------------------------- headroom and cost, both engines named */

/*
  THE REFERENCE-SLOT BUDGET (fable-158): a heavily-edited cast needs one slot
  per reference-tier item plus the master itself. Counted here from the recipe
  this bench actually sent, so the number is a reading and not an estimate.
*/
console.log("\nREFERENCE-SLOT HEADROOM");
console.log(`  this fixture's recipe used     ${references.length} slots (master + ${references.length - 1} item references)`);
console.log("  GPT Image 2 edit               16   READ from fal's OpenAPI: image_urls.maxItems");
console.log("  Nano Banana Pro edit           14   our code's documented ceiling (falQueue.ts:59).");
console.log("                                      fal's OpenAPI declares NO maxItems for this endpoint —");
console.log("                                      so 14 is a docs-derived figure, not a schema-derived one.");

const usd = (value: number) => `$${value.toFixed(3)}`;
console.log("\nCOST PER RENDER, both painters");
console.log(`  Nano Banana Pro 1K   ${usd(NANO_BANANA_PRO_USD_PER_IMAGE["1K"])}   list price (falQueue.ts)`);
console.log(`  GPT Image 2          ${usd(FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE)}   MEASURED off the account balance, 2026-07-30`);

const summary = {
  fixture: "f9e9cb81 Unfussed",
  n: N,
  calls: { nbpNew: nbpCalls, gpt2New: gpt2Calls, reusedFromDisk: reused },
  spendUsd: {
    nbp: nbpCalls * NANO_BANANA_PRO_USD_PER_IMAGE["1K"],
    gpt2: gpt2Calls * FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE,
  },
  slots: { used: references.length, gpt2Cap: 16, nbpCap: 14, nbpCapSource: "docs, not schema" },
  framing,
  cell1, cell2, cell2Gpt2,
  control: moved,
};
await writeFile(`${OUT}/cprime-bench.json`, JSON.stringify(summary, null, 2));
console.log(`\nCALLS THIS RUN: ${nbpCalls} NBP + ${gpt2Calls} GPT Image 2 = ${nbpCalls + gpt2Calls} new`);
console.log(`  and ${reused} frames reused from disk, already paid for by the interrupted first run.`);
console.log(`  this run's provider spend: ${usd(nbpCalls * NANO_BANANA_PRO_USD_PER_IMAGE["1K"] + gpt2Calls * FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE)}`);
console.log(`frames and numbers in ${OUT}/`);

process.exit(0);
