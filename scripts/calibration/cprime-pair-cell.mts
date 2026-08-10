/**
 * THE PAIR CELL — the one hole the C′ bench declared and did not close.
 *
 * The bench's reference clause said *"the exact gold hoop earring she is
 * wearing — the same hoop, on the same ear"*. Singular, to a fixture wearing a
 * matching pair. Two GPT Image 2 paints of three delivered the pair anyway and
 * the third delivered one hoop, which the reader then reported as 300 px of
 * drift on an item that never moved.
 *
 * That is law 8's ontology — earrings come in matching pairs — meeting a prompt
 * that spoke in the singular. So opus-125 filed no accessory claim and no
 * accessory tolerance, and this cell is what closes it.
 *
 *   FAL_KEY=… npx tsx scripts/calibration/cprime-pair-cell.mts [--n 5] [--dry]
 *
 * # The clause is DERIVED, not written here
 *
 * `pairClauseFor("gold hoop earring")` is what the PRODUCT emits for this
 * object — `", one on each ear, a matching pair"` — read from the same table
 * the mask-cutter and the placement corridor read. Authoring a nicer sentence
 * here would test a prompt the product will never send.
 *
 * # The counter is controlled against frames whose answer is already known
 *
 * Before this cell's paints are counted, the counter runs over the THREE
 * BENCH PAINTS ALREADY ON DISK, where the answer was established by cropping
 * both ears and looking: pair, pair, single. If it cannot reproduce 2, 2, 1 it
 * is not an instrument and this cell reports nothing.
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { fetchImageBytes } from "../lib/imageBytes.mts";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { createFalMaskedEditEngine, FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE } from "../../server/providers/falImages";
import { NANO_BANANA_PRO_USD_PER_IMAGE } from "../../server/providers/falQueue";
import { castingIdentityEngine } from "../../server/castingV2/signEngine";
import { pairClauseFor } from "../../server/castingV2/accessoryKinds";
import type { Mask } from "../../server/castingV2/maskedComposite";

const BASE = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";
const OUT = "output/cprime";
const READS = `${OUT}/reads`;

const MASTER = "casting-v2/candidates/5b9a6e1b-667c-4f03-abf9-c3eea4f249c5.png";
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
const engine = createFalMaskedEditEngine({ apiKey });
await mkdir(READS, { recursive: true });

type Frame = { label: string; bytes: Buffer; width: number; height: number };

async function frameOf(label: string, bytes: Buffer): Promise<Frame> {
  const meta = await sharp(bytes).metadata();
  return { label, bytes, width: meta.width ?? 0, height: meta.height ?? 0 };
}
const fromR2 = async (key: string, label: string): Promise<Frame> =>
  frameOf(label, (await fetchImageBytes(`${BASE}/${key}`)).bytes);

/* ------------------------------------------------- reads, paid for once */

let regionReads = 0;
const readKey = (label: string, name: string) => `${READS}/${label}--${name.replace(/[^a-z0-9]+/gi, "_")}`;

async function readRegion(frame: Frame, name: string): Promise<Mask | null> {
  const key = readKey(frame.label, name);
  const cached = await readFile(`${key}.png`).catch(() => null);
  if (cached) {
    const { data, info } = await sharp(cached).greyscale().raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  }
  if (await readFile(`${key}.no-read`).catch(() => null)) return null;
  const mask = await reader.region({ image: frame.bytes, name, absentIsAnswer: true }).catch(() => null);
  regionReads += 1;
  if (!mask) { await writeFile(`${key}.no-read`, "the reader answered nothing\n"); return null; }
  await writeFile(`${key}.png`, await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  }).png().toBuffer());
  return mask;
}

/* --------------------------------------------------------- the counter */

/**
 * How many hoops, and on which side of her.
 *
 * The size floor exists because SAM 3 leaves specks, and a speck counted as a
 * hoop would turn a single into a pair — the exact direction of error this cell
 * is trying to detect. Every component's size is printed, so the floor is
 * visible rather than trusted.
 */
const MIN_COMPONENT = 150;

type Hoops = { sides: ("left" | "right")[]; sizes: number[]; kept: number };

async function countHoops(frame: Frame): Promise<Hoops | null> {
  const [earrings, face] = await Promise.all([readRegion(frame, "earring"), readRegion(frame, "face")]);
  if (!earrings || !face) return null;

  /* Her own midline, not the image's — a portrait is not guaranteed centred. */
  let facePixels = 0; let faceSumX = 0;
  for (let index = 0; index < face.data.length; index += 1) {
    if (face.data[index] === 0) continue;
    facePixels += 1;
    faceSumX += index % face.width;
  }
  if (facePixels === 0) return null;
  const midline = faceSumX / facePixels;

  const seen = new Uint8Array(earrings.data.length);
  const sizes: number[] = [];
  const sides: ("left" | "right")[] = [];
  for (let start = 0; start < earrings.data.length; start += 1) {
    if (earrings.data[start] === 0 || seen[start] === 1) continue;
    const stack = [start];
    seen[start] = 1;
    let pixels = 0; let sumX = 0;
    while (stack.length > 0) {
      const at = stack.pop()!;
      const x = at % earrings.width;
      const y = Math.floor(at / earrings.width);
      pixels += 1; sumX += x;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= earrings.width || ny >= earrings.height) continue;
        const next = ny * earrings.width + nx;
        if (earrings.data[next] === 0 || seen[next] === 1) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    sizes.push(pixels);
    if (pixels >= MIN_COMPONENT) sides.push(sumX / pixels < midline ? "left" : "right");
  }
  sizes.sort((a, b) => b - a);
  return { sides, sizes, kept: sides.length };
}

const verdictOf = (hoops: Hoops): string => {
  const left = hoops.sides.filter((side) => side === "left").length;
  const right = hoops.sides.filter((side) => side === "right").length;
  if (left > 0 && right > 0) return "PAIR";
  if (left + right === 0) return "NONE";
  return "SINGLE";
};

/* ------------------------------------------------------- the control */

console.log("THE COUNTER, AGAINST FRAMES WHOSE ANSWER IS ALREADY KNOWN");
console.log("  (established by cropping both ears and looking: pair, pair, single)\n");

const EXPECTED = ["PAIR", "PAIR", "SINGLE"];
let controlHeld = true;
for (let index = 0; index < 3; index += 1) {
  const label = `cell2g-${index + 1}`;
  const bytes = await readFile(`${OUT}/${label}.png`).catch(() => null);
  if (!bytes) { console.log(`  ${label}  NOT ON DISK — the control cannot run`); controlHeld = false; continue; }
  const hoops = await countHoops(await frameOf(label, bytes));
  if (!hoops) { console.log(`  ${label}  NO-READ`); controlHeld = false; continue; }
  const verdict = verdictOf(hoops);
  const agrees = verdict === EXPECTED[index];
  if (!agrees) controlHeld = false;
  console.log(
    `  ${label}  ${verdict.padEnd(7)} expected ${EXPECTED[index]!.padEnd(7)} ${agrees ? "agrees" : "DISAGREES"}`
    + `   components ${hoops.sizes.slice(0, 4).join(", ")}${hoops.sizes.length > 4 ? ", …" : ""}  (floor ${MIN_COMPONENT} px, ${hoops.kept} kept)`,
  );
}
console.log(`\n  ${controlHeld ? "The counter reproduces what the eye read. Its verdicts below count." : "THE COUNTER DOES NOT REPRODUCE THE EYE — this cell reports NOTHING."}`);
if (!controlHeld) process.exit(1);

if (DRY) {
  console.log(`\n--dry: the control ran and nothing was painted. 0 paints, ${regionReads} region reads.`);
  process.exit(0);
}

/* -------------------------------------------------------- the cell */

const [master, cropMarks, cropHair, cropGloss] = await Promise.all([
  fromR2(MASTER, "master"),
  fromR2(CROP_MARKS, "crop:freckles"),
  fromR2(CROP_HAIR, "crop:hair"),
  fromR2(CROP_GLOSS, "crop:gloss"),
]);
const cropHoop = await readFile(`${OUT}/reference-earring.png`);

/* The clause the PRODUCT emits for this object, not one written here. */
const PAIR_CLAUSE = pairClauseFor("gold hoop earring");
if (PAIR_CLAUSE === "") {
  console.error("the product emits no pair clause for a gold hoop — the premise of this cell is gone. STOP.");
  process.exit(1);
}
console.log(`\nTHE CLAUSE UNDER TEST, from pairClauseFor("gold hoop earring"):\n  "${PAIR_CLAUSE.replace(/^, /, "")}"`);

const PROMPT = [
  "Reference 1 is the photograph of this person — reproduce her exactly: same face, same pose,",
  "same lighting, same framing, same background.",
  "Reference 2 is the exact freckles across her cheeks and nose.",
  "Reference 3 is the exact hairstyle.",
  "Reference 4 is the exact nude lip gloss.",
  `Reference 5 is the exact gold hoop earring she is wearing${PAIR_CLAUSE}.`,
  "She is wearing her glasses, exactly as in reference 1.",
  "Change only her eye colour to green.",
].join(" ");

const references = [master, cropMarks, cropHair, cropGloss]
  .map((frame) => ({ bytes: frame.bytes, contentType: "image/png" }))
  .concat([{ bytes: cropHoop, contentType: "image/png" }]);

/*
  BOTH PAINTERS (fable-161 order 1).

  The clause is the variable under test, so it has to be tried on each engine
  the program might route this job class to — otherwise "the clause works" would
  be a claim about one painter wearing the name of a rule.
*/
const identity = castingIdentityEngine();

const ARMS: { id: string; label: string; usd: number; paint: () => Promise<Buffer> }[] = [
  {
    id: "pair",
    label: `GPT Image 2, ${master.width}x${master.height}`,
    usd: FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE,
    paint: async () => (await engine.edit({
      prompt: PROMPT, references, width: master.width, height: master.height,
    })).bytes,
  },
  {
    id: "pairnbp",
    label: "Nano Banana Pro, 1K (its own choice of size, per the bench)",
    usd: NANO_BANANA_PRO_USD_PER_IMAGE["1K"],
    paint: async () => (await identity.editWithReferences({
      prompt: PROMPT, references, resolution: "1K",
    })).bytes,
  },
];

let paints = 0;
let reused = 0;
let spend = 0;
const byArm: Record<string, { pairs: number; read: number; results: { label: string; verdict: string; sizes: number[] }[] }> = {};

for (const arm of ARMS) {
  console.log(`\nPAIR CELL — ${arm.label}, n=${N}`);
  const results: { label: string; verdict: string; sizes: number[] }[] = [];
  for (let index = 0; index < N; index += 1) {
    const label = `${arm.id}-${index + 1}`;
    let bytes = await readFile(`${OUT}/${label}.png`).catch(() => null);
    let fresh = false;
    if (bytes) { reused += 1; } else {
      process.stdout.write(`  painting ${index + 1}/${N}… `);
      bytes = await arm.paint();
      paints += 1; spend += arm.usd; fresh = true;
      await writeFile(`${OUT}/${label}.png`, bytes);
    }
    const frame = await frameOf(label, bytes);
    const hoops = await countHoops(frame);
    if (!hoops) {
      console.log(`  ${label}  NO-READ — reported as a NO-READ, not as a zero`);
      results.push({ label, verdict: "NO-READ", sizes: [] });
      continue;
    }
    const verdict = verdictOf(hoops);
    results.push({ label, verdict, sizes: hoops.sizes });
    console.log(`  ${label}  ${verdict.padEnd(7)}${fresh ? "" : " (reused)"}  components ${hoops.sizes.slice(0, 4).join(", ") || "none"}`);
  }
  const pairs = results.filter((row) => row.verdict === "PAIR").length;
  const read = results.filter((row) => row.verdict !== "NO-READ").length;
  byArm[arm.id] = { pairs, read, results };
  console.log(
    `  PAIRS DELIVERED: ${pairs} of ${read} that read`
    + `${read < N ? ` (${N - read} NO-READ, excluded from the denominator)` : ""}`,
  );
}

console.log("\nBASELINE, the SINGULAR clause, from the bench: 2 of 3 on GPT Image 2.");
console.log("  (and that baseline was read by eye — the reader itself could not see a pair until this shift's fix)");
console.log(`\n${paints} new paints · ${reused} reused · ${regionReads} region reads · spend $${spend.toFixed(3)}`);

await writeFile(`${OUT}/pair-cell.json`, JSON.stringify({ clause: PAIR_CLAUSE, n: N, byArm, paints, spend }, null, 2));
process.exit(0);
