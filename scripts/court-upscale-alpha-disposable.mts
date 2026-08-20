/**
 * THE ALPHA COURT — what a faithful upscaler does to a TRANSPARENT cut, and
 * what the two recomposites look like at the edge (ordered fable-1215 §1a/§1b,
 * from the finding in opus-908 §1).
 *
 *   npx tsx scripts/court-upscale-alpha-disposable.mts
 *
 * # The question, and why it needed a paid call rather than an argument
 *
 * `output/court-floor/C-upscaled.png` — aura-sr's own returned bytes from
 * opus-903's rung C — is THREE CHANNELS. Its input was four. So the model drops
 * alpha, which is proven and needs nothing more.
 *
 * What is NOT proven is what the model paints WHERE the transparency was. A cut
 * is a masked cutout: 41% of `S1-upperArm-native-183x353.png` is fully
 * transparent, and an alpha-blind decoder leaves those pixels at whatever the
 * PNG's own RGB holds under the zero alpha — usually black, sometimes the
 * design's own colour smeared. The upscaler then invents edge detail against
 * whatever it saw. **That fringe is the thing the recomposite has to survive**,
 * and guessing at it is exactly the reasoning law 1 forbids.
 *
 * # THE SUBJECT IS THE ROAD'S OWN OBJECT
 *
 * `S1-upperArm-native-183x353.png` is a real cut made by the shipped
 * `cutInkDesign`, 183 px on its shortest side — UNDER the 256 floor, so it is
 * precisely the picture `upscaleToFloor` exists to rescue. Not a fixture, not a
 * resize of an artwork: the opaque-only ladder is the trap this court must not
 * repeat (fable-1215 §1c).
 *
 * # WHAT IT SPENDS AND WHAT IT DOES NOT
 *
 * ONE call to `fal-ai/aura-sr`, named before it is made, house money, on the
 * shared courtesy pool — sequential, one in flight, so `assertFalBudget` is
 * untouched. No credits, no database, no flag, no render.
 *
 * # It grades nothing
 *
 * Law 9. It writes files and prints numbers. Whether the soft edge or the hard
 * one is right is decided at the pictures, by eyes, after this runs.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import "dotenv/config";
import sharp from "sharp";

import { runFalImageJob } from "../server/providers/falTransport";

const REPO = resolve(import.meta.dirname, "..");
const OUT = resolve(REPO, "output/court-upscale-alpha");
const CUT = resolve(REPO, "output/court-region-floor/S1-upperArm-native-183x353.png");

/** Named before it is called. The faithful model — GAN, no prompt, no invention. */
const UPSCALER = "fal-ai/aura-sr";

const apiKey = process.env.FAL_KEY;
if (!apiKey) {
  console.error("REFUSING: FAL_KEY is not set — this court needs the real model and will not fake one.");
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
const lines: string[] = [];
const say = (line: string) => { console.log(line); lines.push(line); };

type Rgba = { data: Buffer; width: number; height: number };
async function rgbaOf(bytes: Buffer): Promise<Rgba> {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Fully-transparent pixel count, and the mean RGB underneath them. */
function underTheAlpha(one: Rgba): { transparent: number; total: number; meanUnder: [number, number, number] } {
  let transparent = 0;
  let r = 0; let g = 0; let b = 0;
  for (let i = 0; i < one.data.length; i += 4) {
    if (one.data[i + 3] !== 0) continue;
    transparent += 1;
    r += one.data[i]; g += one.data[i + 1]; b += one.data[i + 2];
  }
  const mean: [number, number, number] = transparent === 0
    ? [0, 0, 0]
    : [Math.round(r / transparent), Math.round(g / transparent), Math.round(b / transparent)];
  return { transparent, total: one.width * one.height, meanUnder: mean };
}

// ---------------------------------------------------------------- the subject
const cutBytes = await readFile(CUT);
const cutMeta = await sharp(cutBytes).metadata();
const cut = await rgbaOf(cutBytes);
const before = underTheAlpha(cut);
say(`SUBJECT  ${CUT.slice(REPO.length + 1)}`);
say(`         ${cutMeta.width}x${cutMeta.height}  channels=${cutMeta.channels}  hasAlpha=${cutMeta.hasAlpha}`);
say(`         fully transparent ${before.transparent}/${before.total}`
  + ` (${((before.transparent / before.total) * 100).toFixed(1)}%),`
  + ` mean RGB under the transparency = ${before.meanUnder.join(",")}`);
say("");

// ------------------------------------------------------------ the paid call
say(`CALLING  ${UPSCALER} — one call, house money, named before it was made`);
const job = await runFalImageJob({
  apiKey,
  endpoint: UPSCALER,
  /* Data URI: no object created on anybody's CDN, the posture every image job
     in this codebase takes. */
  body: { image_url: `data:image/png;base64,${cutBytes.toString("base64")}` },
  timeoutMs: 300_000,
  pollIntervalMs: 3_000,
}).catch((error: unknown) => {
  say(`STOPPED: the upscaler refused — ${error instanceof Error ? error.message : String(error)}`);
  return null;
});
if (job === null || job.bytes.byteLength === 0) {
  await writeFile(resolve(OUT, "court.log"), `${lines.join("\n")}\n`, "utf8");
  process.exit(1);
}

const grownMeta = await sharp(job.bytes).metadata();
await writeFile(resolve(OUT, "1-model-raw.png"), job.bytes);
const grown = await rgbaOf(job.bytes);
const after = underTheAlpha(grown);
say(`ANSWER   ${grownMeta.width}x${grownMeta.height}  format=${grownMeta.format}  channels=${grownMeta.channels}`
  + `  hasAlpha=${grownMeta.hasAlpha}  ${job.bytes.byteLength} B`);
say(`         fully transparent in the ANSWER: ${after.transparent}/${after.total}`
  + ` (${((after.transparent / after.total) * 100).toFixed(1)}%)`);

/*
  WHAT IT PAINTED WHERE THE TRANSPARENCY WAS — the whole reason this call was
  bought. The original alpha is scaled to the answer's own size and used as a
  STENCIL to sample the answer, so the number describes the same region of the
  same picture rather than two different ones.
*/
const stencilSoft = await sharp(Buffer.from(cut.data), {
  raw: { width: cut.width, height: cut.height, channels: 4 },
})
  .extractChannel(3)
  .resize({ width: grown.width, height: grown.height, fit: "fill" })
  .raw()
  .toBuffer();

let sampled = 0; let sr = 0; let sg = 0; let sb = 0;
for (let p = 0; p < stencilSoft.length; p += 1) {
  if (stencilSoft[p] !== 0) continue;
  sampled += 1;
  sr += grown.data[p * 4]; sg += grown.data[p * 4 + 1]; sb += grown.data[p * 4 + 2];
}
say(`         under the ORIGINAL cutout's transparent area, the answer's mean RGB is `
  + (sampled === 0 ? "n/a" : `${Math.round(sr / sampled)},${Math.round(sg / sampled)},${Math.round(sb / sampled)}`)
  + ` over ${sampled} px`);
say("");

// -------------------------------------------------- the two recomposites
/*
  BOTH SHAPES OF THE RULED FIX, so the choice is made at the pictures.

  SOFT: the alpha is resized with the same interpolation any enlargement uses,
  so the cutout's boundary arrives as a gradient — which is what an enlarged
  edge physically is.

  HARD: the same resized alpha thresholded back to 0/255, which reinstates a
  binary outline at the new size. Cheap to build, and the fidelity law's own
  concern is whether it reinvents a jagged boundary the cut never had.
*/
const rgbOnly = await sharp(job.bytes).removeAlpha().raw().toBuffer();
const hard = Buffer.from(stencilSoft);
for (let p = 0; p < hard.length; p += 1) hard[p] = hard[p] >= 128 ? 255 : 0;

async function composite(alpha: Buffer, name: string): Promise<void> {
  const out = Buffer.alloc(grown.width * grown.height * 4);
  for (let p = 0; p < grown.width * grown.height; p += 1) {
    out[p * 4] = rgbOnly[p * 3];
    out[p * 4 + 1] = rgbOnly[p * 3 + 1];
    out[p * 4 + 2] = rgbOnly[p * 3 + 2];
    out[p * 4 + 3] = alpha[p];
  }
  const png = await sharp(out, { raw: { width: grown.width, height: grown.height, channels: 4 } })
    .png()
    .toBuffer();
  await writeFile(resolve(OUT, name), png);
  const back = await rgbaOf(png);
  const read = underTheAlpha(back);
  const meta = await sharp(png).metadata();
  say(`${name}  ${meta.width}x${meta.height}  channels=${meta.channels}  hasAlpha=${meta.hasAlpha}`
    + `  fully transparent ${((read.transparent / read.total) * 100).toFixed(1)}%`);
}

await composite(stencilSoft, "2-recomposite-soft.png");
await composite(hard, "3-recomposite-hard.png");

/*
  AND THE EDGE, MAGNIFIED, because that is where the two differ and a
  full-frame look cannot show it. Same box, same 3x, from all three pictures —
  a band across the middle of the cut where the design meets the cut boundary.
*/
const boxW = Math.min(320, grown.width);
const boxH = Math.min(320, grown.height);
const left = Math.max(0, Math.round(grown.width / 2 - boxW / 2));
const top = Math.max(0, Math.round(grown.height / 2 - boxH / 2));
for (const [file, name] of [
  ["1-model-raw.png", "edge-1-model-raw-3x.png"],
  ["2-recomposite-soft.png", "edge-2-soft-3x.png"],
  ["3-recomposite-hard.png", "edge-3-hard-3x.png"],
] as const) {
  const magnified = await sharp(resolve(OUT, file))
    .extract({ left, top, width: boxW, height: boxH })
    .resize({ width: boxW * 3, height: boxH * 3, kernel: "nearest" })
    .png()
    .toBuffer();
  await writeFile(resolve(OUT, name), magnified);
}
say("");
say(`EDGE CROPS  same box (${left},${top} ${boxW}x${boxH}) at 3x nearest, all three pictures.`);
say("EVERY FILE HERE IS FOR EYES BEFORE IT IS FOR A RULING.");

await writeFile(resolve(OUT, "court.log"), `${lines.join("\n")}\n`, "utf8");
process.exit(0);
