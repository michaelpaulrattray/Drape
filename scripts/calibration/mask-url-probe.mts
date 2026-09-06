/**
 * DOES `mask_url` BOUND THE REPAINT? (fable-173, "probe GO")
 *
 * The published OpenAPI schema for `openai/gpt-image-2/edit` carries a field we
 * have never sent:
 *
 *     mask_url : string | null
 *       "The URL of the mask image to use for the generation.
 *        This indicates what part of the image to edit."
 *
 * fal's schema does NOT say which side of the mask is the editable side, and a
 * convention imported from memory is exactly the class this program keeps
 * paying for. So this asks the engine, in both polarities, with the unmasked
 * repaint sitting beside them as the control.
 *
 * Fable's framing, which is the question this answers: **does GPT2 bound the
 * repaint to the masked region while blending internally at the boundary** —
 * the engine doing natively what our paste compositor did crudely?
 *
 *   FAL_KEY=… npx tsx scripts/calibration/mask-url-probe.mts [--dry]
 *
 * # Cost
 *
 * 3 GPT Image 2 paints at $0.099 measured = **$0.297**, plus one SAM 3 read to
 * place the box. Every paint is cached to disk; a resumed run buys only what
 * was never bought. No campaign credit, no render on any user's account.
 *
 * # The control is INSIDE the sitting, not remembered from the bench
 *
 * Arm `none` sends no mask at all — the call we make in production today. Its
 * changed-pixel spread is what "unbounded" looks like on this frame, this
 * prompt, this hour. Comparing the masked arms against a number from another
 * day would be comparing across two draws.
 *
 * # What each arm is
 *
 *   none          no mask_url          the control: how far does an unbounded repaint reach?
 *   white-edits   RGB, box WHITE       "white marks the editable region"
 *   alpha-edits   RGBA, box ALPHA 0    "transparency marks the editable region"
 *
 * Both polarities are sent because exactly one of them can be right, and a
 * single arm that came back bounded would not tell us WHICH rule produced it.
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { fetchImageBytes } from "../lib/imageBytes.mts";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { FAL_GPT_IMAGE_2_EDIT, FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE } from "../../server/providers/falImages";
import { parseStrictArgsOrRefuse } from "../lib/strictArgs.mts";

const BASE = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";
const MASTER = "casting-v2/candidates/5b9a6e1b-667c-4f03-abf9-c3eea4f249c5.png";
const OUT = "output/maskurl";
/**
 * THIS SCRIPT'S WHOLE VOCABULARY, DECLARED SO A WORD OUTSIDE IT REFUSES (#345).
 *
 * THE `--dry` TRAP, THIRD INSTANCE ON A PAID SCRIPT: `--dry-run` is not
 * `--dry`, and the reader could not tell — so the safest-sounding word an
 * operator can type was discarded and this probe bought its edits.
 */
const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: [],
  boolean: ["dry"],
});
const DRY = ARGS.flag("dry");

const apiKey = process.env.FAL_KEY;
if (!apiKey) { console.error("FAL_KEY is required"); process.exit(1); }

const sharp = (await import("sharp")).default;
await mkdir(OUT, { recursive: true });

const master = (await fetchImageBytes(`${BASE}/${MASTER}`)).bytes;
const meta = await sharp(master).metadata();
const width = meta.width!;
const height = meta.height!;
console.log(`master ${width}x${height}`);

/* ------------------------------------------------------------------ the box */

/**
 * Where her eyes are, from the product's own reader — not a guessed rectangle.
 *
 * A box rather than the eye mask itself, because this probe is about the
 * TRANSPORT's rule, and a shape with a clear inside and outside makes "did the
 * change stay inside" a question with an unambiguous answer.
 */
const boxPath = `${OUT}/box.json`;
let box: { x: number; y: number; w: number; h: number };
const cachedBox = await readFile(boxPath, "utf8").catch(() => null);
if (cachedBox) {
  box = JSON.parse(cachedBox);
} else {
  const reader = createFalRegionReader({ apiKey });
  const eyes = await reader.region({ image: master, name: "eyes" });
  let minX = Infinity; let minY = Infinity; let maxX = -1; let maxY = -1;
  for (let index = 0; index < eyes.data.length; index += 1) {
    if (eyes.data[index]! === 0) continue;
    const x = index % eyes.width;
    const y = Math.floor(index / eyes.width);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  /* A margin, because an eye-colour change legitimately touches the lashes and
     the lid edge; a box drawn to the iris would score honest work as leakage. */
  const margin = 24;
  box = {
    x: Math.max(0, minX - margin),
    y: Math.max(0, minY - margin),
    w: Math.min(width, maxX + margin) - Math.max(0, minX - margin),
    h: Math.min(height, maxY + margin) - Math.max(0, minY - margin),
  };
  await writeFile(boxPath, JSON.stringify(box));
}
console.log(`the eye box  ${box.w}x${box.h} at ${box.x},${box.y}  — ${((box.w * box.h) / (width * height) * 100).toFixed(2)}% of the frame\n`);

/* ------------------------------------------------------------------ the masks */

const solid = (value: number) => Buffer.alloc(width * height, value);

/** RGB: the box white, everything else black. */
async function whiteBoxMask(): Promise<Buffer> {
  const plane = solid(0);
  for (let y = box.y; y < box.y + box.h; y += 1) {
    for (let x = box.x; x < box.x + box.w; x += 1) plane[y * width + x] = 255;
  }
  return sharp(plane, { raw: { width, height, channels: 1 } }).png().toBuffer();
}

/**
 * Four-channel sRGB, the box fully transparent — the canonical shape.
 *
 * Added after the two-channel `b-w`+alpha arm came back as a DIFFERENT PERSON:
 * a greyscale-plus-alpha PNG is an unusual encoding, and a conclusion about a
 * transport should not rest on a shape nobody sends. This is the ordinary RGBA
 * mask, and it is the one that decides whether the alpha convention is
 * supported at all.
 */
async function rgbaBoxMask(): Promise<Buffer> {
  const alpha = solid(255);
  for (let y = box.y; y < box.y + box.h; y += 1) {
    for (let x = box.x; x < box.x + box.w; x += 1) alpha[y * width + x] = 0;
  }
  const rgb = Buffer.alloc(width * height * 3, 0);
  return sharp(rgb, { raw: { width, height, channels: 3 } })
    .ensureAlpha()
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}

/** Two-channel greyscale + alpha: opaque everywhere, the box transparent. */
async function alphaBoxMask(): Promise<Buffer> {
  const alpha = solid(255);
  for (let y = box.y; y < box.y + box.h; y += 1) {
    for (let x = box.x; x < box.x + box.w; x += 1) alpha[y * width + x] = 0;
  }
  return sharp(solid(255), { raw: { width, height, channels: 1 } })
    .toColourspace("b-w")
    .ensureAlpha()
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}

/* ------------------------------------------------------------------ the paints */

const PROMPT = "Reference 1 is the photograph of this person — reproduce her exactly:"
  + " same face, same pose, same lighting, same framing, same background."
  + " Change only her eye colour to bright green.";

async function paint(label: string, maskBytes: Buffer | null): Promise<Buffer | null> {
  const cached = await readFile(`${OUT}/${label}.png`).catch(() => null);
  if (cached) { console.log(`  ${label}  reused from disk`); return cached; }
  if (DRY) { console.log(`  ${label}  --dry, not painted`); return null; }
  const body: Record<string, unknown> = {
    prompt: PROMPT,
    image_urls: [`data:image/png;base64,${master.toString("base64")}`],
    image_size: { width, height },
    num_images: 1,
    quality: "high",
    output_format: "png",
  };
  if (maskBytes) body.mask_url = `data:image/png;base64,${maskBytes.toString("base64")}`;

  const response = await fetch(`https://fal.run/${FAL_GPT_IMAGE_2_EDIT}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
      "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 3600 }),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    /* A REFUSAL IS A READING. If the endpoint rejects a mask shape, that is the
       answer to "what does it accept", and it is recorded rather than retried
       into silence. */
    const text = (await response.text()).slice(0, 400);
    console.log(`  ${label}  REFUSED ${response.status}: ${text}`);
    await writeFile(`${OUT}/${label}.refused.txt`, `${response.status}\n${text}\n`);
    return null;
  }
  const json: any = await response.json();
  const url = json?.images?.[0]?.url;
  if (!url) { console.log(`  ${label}  no image in the response`); return null; }
  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(`${OUT}/${label}.png`, bytes);
  console.log(`  ${label}  painted`);
  return bytes;
}

console.log("PAINTING (the control first, so an early failure costs the least informative arm)");
const arms: { label: string; mask: Buffer | null }[] = [
  { label: "none", mask: null },
  { label: "white-edits", mask: await whiteBoxMask() },
  { label: "alpha-edits", mask: await alphaBoxMask() },
  { label: "rgba-edits", mask: await rgbaBoxMask() },
];
await writeFile(`${OUT}/mask-white.png`, arms[1]!.mask!);
await writeFile(`${OUT}/mask-alpha.png`, arms[2]!.mask!);
await writeFile(`${OUT}/mask-rgba.png`, arms[3]!.mask!);

const painted: { label: string; bytes: Buffer | null }[] = [];
let bought = 0;
for (const arm of arms) {
  const before = await readFile(`${OUT}/${arm.label}.png`).catch(() => null);
  const bytes = await paint(arm.label, arm.mask);
  if (bytes && !before) bought += 1;
  painted.push({ label: arm.label, bytes });
}

/* ------------------------------------------------------------------ the measure */

const NOISE = 8;
const masterRaw = await sharp(master).removeAlpha().raw().toBuffer({ resolveWithObject: true });

console.log(`\n${"=".repeat(88)}`);
console.log("WHERE DID EACH ARM CHANGE THE PICTURE?");
console.log("=".repeat(88));
console.log("  arm".padEnd(16) + "size".padEnd(12) + "changed".padStart(10) + "  in box".padStart(10)
  + "  outside".padStart(10) + "  share in box");

const rows: any[] = [];
for (const arm of painted) {
  if (!arm.bytes) { console.log(`  ${arm.label.padEnd(14)}NO PAINT`); continue; }
  const raw = await sharp(arm.bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (raw.info.width !== width || raw.info.height !== height) {
    console.log(`  ${arm.label.padEnd(14)}${raw.info.width}x${raw.info.height} — a different canvas, not comparable pixelwise`);
    rows.push({ label: arm.label, size: `${raw.info.width}x${raw.info.height}`, comparable: false });
    continue;
  }
  let changed = 0; let inBox = 0;
  for (let index = 0; index < width * height; index += 1) {
    const at = index * 3;
    const delta = Math.max(
      Math.abs(raw.data[at]! - masterRaw.data[at]!),
      Math.abs(raw.data[at + 1]! - masterRaw.data[at + 1]!),
      Math.abs(raw.data[at + 2]! - masterRaw.data[at + 2]!),
    );
    if (delta <= NOISE) continue;
    changed += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h) inBox += 1;
  }
  const share = changed === 0 ? 0 : inBox / changed;
  rows.push({ label: arm.label, size: `${width}x${height}`, changed, inBox, outside: changed - inBox, share, comparable: true });
  console.log(
    `  ${arm.label.padEnd(14)}${`${width}x${height}`.padEnd(12)}`
    + changed.toLocaleString().padStart(10)
    + inBox.toLocaleString().padStart(10)
    + (changed - inBox).toLocaleString().padStart(10)
    + `      ${(share * 100).toFixed(1)}%`,
  );
}

console.log(`\nthe box is ${((box.w * box.h) / (width * height) * 100).toFixed(2)}% of the frame — an unbounded repaint`);
console.log("that changed pixels uniformly would put about that share of its changes inside it.\n");
console.log("HOW TO READ THIS, written before the paints returned:");
console.log("  an arm whose changes are ~entirely IN BOX      → that polarity bounds the repaint");
console.log("  an arm whose changes match the `none` control  → mask_url was accepted and ignored");
console.log("  an arm REFUSED                                 → that mask shape is not accepted, which");
console.log("                                                   is itself the schema answer we came for");

await writeFile(`${OUT}/probe.json`, JSON.stringify({ box, rows, bought, usd: bought * FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE }, null, 2));
console.log(`\n${bought} new paints · $${(bought * FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE).toFixed(3)} · 0 credits`);
process.exit(0);
