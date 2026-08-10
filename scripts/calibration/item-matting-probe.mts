/**
 * CAN A MATTING MODEL CUT OUT AN ITEM, OR ONLY A PERSON? (fable-165 §2)
 *
 * The crop-vs-cutout arm needs cutouts made with a real matting model — the
 * fidelity law names the binary-outline substitute by name. We already call
 * one: `falRegionReader.subject()` posts to `fal-ai/birefnet/v2` with
 * `model: "Matting"`. But it calls it with `mask_only: true`, which skips
 * foreground refinement, and BiRefNet's job is a SALIENT SUBJECT against a
 * BACKGROUND — on a full frame that is the person.
 *
 * Whether it can isolate an EARRING against an EAR — an item whose background
 * is skin — is the question this settles before the arm is designed around it.
 *
 *   FAL_KEY=… npx tsx scripts/calibration/item-matting-probe.mts [--dry]
 *
 * # What it costs
 *
 * 5 BiRefNet calls and up to 4 SAM 3 reads, all cached to disk. No paint, no
 * credit, no render. `--dry` runs the arithmetic over whatever is cached and
 * buys nothing.
 *
 * # The controls, before the finding
 *
 * POSITIVE  a whole portrait frame, where the answer is known — the matte must
 *           be the PERSON: a large, centre-weighted alpha well short of the
 *           whole canvas. If this fails, the call or my alpha extraction is
 *           wrong and nothing below means anything.
 * NEGATIVE  the discriminating one, and it is built into the measure rather
 *           than run separately: on an ear crop, "it mattes the item" and "it
 *           mattes everything" are separated by alpha COVERAGE of the crop.
 *           A matte covering nearly the whole crop is the model answering
 *           "the ear is the subject" — which is a real answer, not a failure,
 *           and it is the one that would make the cutout arm dishonest.
 *
 * Ground truth for the item is SAM 3's own `earring` mask on the same crop —
 * the reader the product already trusts to say where an earring is.
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import type { Mask } from "../../server/castingV2/maskedComposite";

const OUT = "output/matting";
const SRC = "output/cprime";
const DRY = process.argv.includes("--dry");

const apiKey = process.env.FAL_KEY;
if (!apiKey) { console.error("FAL_KEY is required"); process.exit(1); }

const sharp = (await import("sharp")).default;
const reader = createFalRegionReader({ apiKey });
await mkdir(OUT, { recursive: true });

let birefnetCalls = 0;
let samCalls = 0;

/**
 * BiRefNet, asked for the REFINED FOREGROUND rather than the mask.
 *
 * Posted directly rather than through `falRegionReader`, because that module's
 * `subject()` deliberately asks for `mask_only: true` — a mask has no soft
 * alpha, and soft alpha is the entire subject of this probe. Same endpoint,
 * same key, same one-hour object lifecycle.
 */
async function matte(label: string, bytes: Buffer): Promise<Buffer | null> {
  const cached = await readFile(`${OUT}/${label}-matte.png`).catch(() => null);
  if (cached) return cached;
  if (DRY) return null;
  const response = await fetch("https://fal.run/fal-ai/birefnet/v2", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
      "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 3600 }),
    },
    body: JSON.stringify({
      image_url: `data:image/png;base64,${bytes.toString("base64")}`,
      model: "Matting",
      refine_foreground: true,
      mask_only: false,
      output_format: "png",
      operating_resolution: "2048x2048",
    }),
  });
  if (!response.ok) {
    console.log(`  ${label}  BiRefNet ${response.status}: ${(await response.text()).slice(0, 160)}`);
    return null;
  }
  birefnetCalls += 1;
  const json: any = await response.json();
  const url = json?.image?.url;
  if (!url) { console.log(`  ${label}  BiRefNet returned no image`); return null; }
  const png = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(`${OUT}/${label}-matte.png`, png);
  return png;
}

/** The alpha channel of a matte, as a mask, plus how soft it actually is. */
async function alphaOf(png: Buffer): Promise<{ mask: Mask; softShare: number; covered: number }> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  const mask: Mask = { data: Buffer.alloc(pixels), width: info.width, height: info.height };
  let covered = 0;
  let soft = 0;
  for (let index = 0; index < pixels; index += 1) {
    const alpha = data[index * info.channels + (info.channels - 1)]!;
    if (alpha > 127) { mask.data[index] = 255; covered += 1; }
    /* The fidelity law's own test: a binary outline has NO intermediate alpha. */
    if (alpha > 8 && alpha < 247) soft += 1;
  }
  return { mask, softShare: soft / pixels, covered };
}

async function samEarring(label: string, bytes: Buffer): Promise<Mask | null> {
  const cachedPath = `${OUT}/${label}-sam-earring.png`;
  const cached = await readFile(cachedPath).catch(() => null);
  if (cached) {
    const { data, info } = await sharp(cached).greyscale().raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  }
  if (DRY) return null;
  const mask = await reader.region({ image: bytes, name: "earring", absentIsAnswer: true }).catch(() => null);
  samCalls += 1;
  if (!mask) return null;
  await writeFile(cachedPath, await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  }).png().toBuffer());
  return mask;
}

const count = (mask: Mask) => {
  let total = 0;
  for (let index = 0; index < mask.data.length; index += 1) if (mask.data[index]! > 0) total += 1;
  return total;
};

function iou(a: Mask, b: Mask): number | null {
  if (a.width !== b.width || a.height !== b.height) return null;
  let intersection = 0;
  let union = 0;
  for (let index = 0; index < a.data.length; index += 1) {
    const inA = a.data[index]! > 0;
    const inB = b.data[index]! > 0;
    if (inA && inB) intersection += 1;
    if (inA || inB) union += 1;
  }
  return union === 0 ? null : intersection / union;
}

/* --------------------------------------------------------- the positive control */

console.log("POSITIVE CONTROL — a whole portrait, where the answer is known");

const wholeFrame = await readFile(`${SRC}/cell2g-1.png`).catch(() => null);
if (!wholeFrame) { console.error("cell2g-1.png is not on disk — the control cannot run. STOP."); process.exit(1); }
const wholeMatte = await matte("control-whole-frame", wholeFrame);
if (!wholeMatte) {
  console.log("  the control produced no matte" + (DRY ? " (nothing cached; --dry buys nothing)" : ""));
  if (!DRY) process.exit(1);
} else {
  const alpha = await alphaOf(wholeMatte);
  const share = alpha.covered / (alpha.mask.width * alpha.mask.height);
  console.log(`  the person   ${(share * 100).toFixed(1)}% of the frame   soft edge ${(alpha.softShare * 100).toFixed(2)}% of pixels`);
  if (share < 0.05 || share > 0.95) {
    console.log("  that is not a person against a background. The call or the alpha read is wrong. STOP.");
    process.exit(1);
  }
  console.log("  a plausible subject matte, with a soft edge. The item readings below count.\n");
}

/* -------------------------------------------------------------- the specimens */

const SPECIMENS = [
  { label: "ear-1-L", file: `${SRC}/EARS-cell2g-1-L.png`, what: "her left ear, 360x340 crop" },
  { label: "ear-1-R", file: `${SRC}/EARS-cell2g-1-R.png`, what: "her right ear, 360x340 crop" },
  { label: "ear-2-L", file: `${SRC}/EARS-cell2g-2-L.png`, what: "her left ear, second paint" },
  { label: "hoop-tight", file: `${SRC}/reference-earring.png`, what: "the hoop alone, 84x103 — the existing reference crop" },
];

console.log("THE ITEM QUESTION — does the matte find the HOOP or the EAR?");
console.log("  coverage  what share of the crop the matte claims");
console.log("  IoU       against SAM 3's own `earring` mask on the same crop");
console.log("  soft      share of pixels with intermediate alpha — a binary outline reads 0.00%\n");

const rows: any[] = [];
for (const specimen of SPECIMENS) {
  const bytes = await readFile(specimen.file).catch(() => null);
  if (!bytes) { console.log(`  ${specimen.label.padEnd(12)} NOT ON DISK`); continue; }
  const png = await matte(specimen.label, bytes);
  if (!png) { console.log(`  ${specimen.label.padEnd(12)} no matte${DRY ? " (nothing cached)" : ""}`); continue; }
  const alpha = await alphaOf(png);
  const coverage = alpha.covered / (alpha.mask.width * alpha.mask.height);
  const sam = await samEarring(specimen.label, bytes);
  const overlap = sam ? iou(alpha.mask, sam) : null;
  const samPixels = sam ? count(sam) : null;
  rows.push({ ...specimen, coverage, soft: alpha.softShare, iou: overlap, samPixels, mattePixels: alpha.covered });
  console.log(
    `  ${specimen.label.padEnd(12)}`
    + `coverage ${(coverage * 100).toFixed(1).padStart(5)}%`
    + `   IoU ${overlap === null ? "  NO-READ" : overlap.toFixed(3).padStart(8)}`
    + `   soft ${(alpha.softShare * 100).toFixed(2).padStart(5)}%`
    + `   matte ${alpha.covered} px`
    + `  sam ${samPixels === null ? "—" : `${samPixels} px`}`
    + `   ${specimen.what}`,
  );
}

console.log(`\n${birefnetCalls} BiRefNet calls · ${samCalls} SAM 3 reads · 0 paints · 0 credits`);
await writeFile(`${OUT}/probe.json`, JSON.stringify({ rows, birefnetCalls, samCalls }, null, 2));

console.log("\nHOW TO READ THIS, written before the numbers arrived:");
console.log("  IoU high (>0.5) and coverage low   → it mattes the ITEM. The cutout arm is real.");
console.log("  coverage high (>0.6) and IoU low   → it mattes the EAR. BiRefNet is the wrong tool");
console.log("                                       for item cutouts and the arm needs the SAM 3");
console.log("                                       mask as the alpha source — which the fidelity");
console.log("                                       law calls a binary outline, so hair would be");
console.log("                                       NOT-RUN and crisp items would ship declared.");
console.log("  soft ≈ 0.00% anywhere              → nothing soft was returned at all.");

process.exit(0);
