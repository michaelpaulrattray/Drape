/**
 * SOFT vs HARD, ON A CUT WHOSE UNDERNEATH IS ACTUALLY EMPTY — round two
 * (granted fable-1217 §2, the interaction named in opus-909 §3).
 *
 *   npx tsx scripts/court-alpha-edge-round2-disposable.mts
 *
 * # Why it had to be re-bought rather than recomputed
 *
 * Round one recomposed the model's RGB with our alpha and the two shapes were
 * indistinguishable at 4x — but that model answer was produced from a cut whose
 * transparent area still held a photograph of a man's arm. With the colour
 * zeroed, the upscaler now sees BLACK beside the design's edge instead of skin,
 * so the fringe it paints there is a different fringe. A GAN's edge behaviour is
 * exactly what changes when what is beside the edge changes, which is why no
 * arithmetic on round one's bytes could answer this.
 *
 * # THE SUBJECT IS EXACT, NOT AN APPROXIMATION
 *
 * The fixed `cutOutPixels` writes `0,0,0,0` below threshold and leaves every
 * kept pixel alone, so zeroing the colour under round one's own cut produces
 * BYTE-FOR-BYTE what the shipped cutter would produce from the same picture and
 * the same mask. No segmenter is re-run and no mask is re-read — which also
 * means nothing here depends on a reader answering the same way twice.
 *
 * ONE `fal-ai/aura-sr` call, named before it is made, house money, sequential.
 *
 * # It grades nothing (law 9). It writes files and prints numbers.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import "dotenv/config";
import sharp from "sharp";

import { runFalImageJob } from "../server/providers/falTransport";

const REPO = resolve(import.meta.dirname, "..");
/* Its own directory: round one's files are the evidence for a finding already
   filed, and overwriting evidence is a mistake this shift has already made once. */
const OUT = resolve(REPO, "output/court-upscale-alpha-2");
const CUT = resolve(REPO, "output/court-region-floor/S1-upperArm-native-183x353.png");
const UPSCALER = "fal-ai/aura-sr";
const BOX = 200;
const ZOOM = 4;

const apiKey = process.env.FAL_KEY;
if (!apiKey) {
  console.error("REFUSING: FAL_KEY is not set — this court needs the real model and will not fake one.");
  process.exit(1);
}
await mkdir(OUT, { recursive: true });
const lines: string[] = [];
const say = (line: string) => { console.log(line); lines.push(line); };

// ------------------------------------------------ the person-free subject
const original = await readFile(CUT);
const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let zeroed = 0;
for (let at = 0; at < info.width * info.height; at += 1) {
  if (data[at * 4 + 3] !== 0) continue;
  if (data[at * 4] !== 0 || data[at * 4 + 1] !== 0 || data[at * 4 + 2] !== 0) zeroed += 1;
  data[at * 4] = 0; data[at * 4 + 1] = 0; data[at * 4 + 2] = 0;
}
const subject = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png().toBuffer();
await writeFile(resolve(OUT, "0-subject-person-free.png"), subject);
say(`SUBJECT  ${info.width}x${info.height}, ${zeroed} pixels' colour zeroed under a cleared alpha`);

// ------------------------------------------------------------ the paid call
say(`CALLING  ${UPSCALER} — one call, house money, named before it was made`);
const job = await runFalImageJob({
  apiKey,
  endpoint: UPSCALER,
  body: { image_url: `data:image/png;base64,${subject.toString("base64")}` },
  timeoutMs: 300_000,
  pollIntervalMs: 3_000,
}).catch((error: unknown) => {
  say(`STOPPED: ${error instanceof Error ? error.message : String(error)}`);
  return null;
});
if (job === null || job.bytes.byteLength === 0) {
  await writeFile(resolve(OUT, "court.log"), `${lines.join("\n")}\n`, "utf8");
  process.exit(1);
}
await writeFile(resolve(OUT, "1-model-raw.png"), job.bytes);
const grownMeta = await sharp(job.bytes).metadata();
const width = grownMeta.width ?? 0;
const height = grownMeta.height ?? 0;
say(`ANSWER   ${width}x${height}  channels=${grownMeta.channels}  hasAlpha=${grownMeta.hasAlpha}`);

// ------------------------------------------------------- the two recomposites
const softAlpha = await sharp(subject)
  .ensureAlpha().extractChannel(3).resize({ width, height, fit: "fill" }).raw().toBuffer();
const hardAlpha = Buffer.from(softAlpha);
for (let at = 0; at < hardAlpha.length; at += 1) hardAlpha[at] = hardAlpha[at] >= 128 ? 255 : 0;
const rgb = await sharp(job.bytes).removeAlpha().raw().toBuffer();

async function composite(alpha: Buffer, name: string): Promise<void> {
  const out = Buffer.alloc(width * height * 4);
  for (let at = 0; at < width * height; at += 1) {
    out[at * 4] = rgb[at * 3];
    out[at * 4 + 1] = rgb[at * 3 + 1];
    out[at * 4 + 2] = rgb[at * 3 + 2];
    out[at * 4 + 3] = alpha[at];
  }
  await writeFile(
    resolve(OUT, name),
    await sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer(),
  );
}
await composite(softAlpha, "2-recomposite-soft.png");
await composite(hardAlpha, "3-recomposite-hard.png");

// ------------------------------------------------------------------ the edge
let best = { left: 0, top: 0, score: -1 };
for (let top = 0; top + BOX <= height; top += 40) {
  for (let left = 0; left + BOX <= width; left += 40) {
    let score = 0;
    for (let y = top; y < top + BOX; y += 2) {
      for (let x = left; x < left + BOX - 1; x += 2) {
        if ((softAlpha[y * width + x] > 127) !== (softAlpha[y * width + x + 1] > 127)) score += 1;
      }
    }
    if (score > best.score) best = { left, top, score };
  }
}
say(`EDGE BOX ${best.left},${best.top} ${BOX}x${BOX} — ${best.score} opacity transitions`);

for (const [file, name] of [
  ["2-recomposite-soft.png", "edge-soft-on-magenta-4x.png"],
  ["3-recomposite-hard.png", "edge-hard-on-magenta-4x.png"],
] as const) {
  const cropped = await sharp(resolve(OUT, file))
    .extract({ left: best.left, top: best.top, width: BOX, height: BOX }).png().toBuffer();
  const over = await sharp({
    create: { width: BOX, height: BOX, channels: 4, background: { r: 255, g: 0, b: 255, alpha: 1 } },
  })
    .composite([{ input: cropped, blend: "over" }])
    .resize({ width: BOX * ZOOM, height: BOX * ZOOM, kernel: "nearest" })
    .png().toBuffer();
  await writeFile(resolve(OUT, name), over);
  say(name);
}

/* And the fringe itself, unmasked, so the thing being argued about is visible
   rather than inferred from the two repairs that hide it. */
await writeFile(
  resolve(OUT, "edge-model-raw-4x.png"),
  await sharp(resolve(OUT, "1-model-raw.png"))
    .extract({ left: best.left, top: best.top, width: BOX, height: BOX })
    .resize({ width: BOX * ZOOM, height: BOX * ZOOM, kernel: "nearest" })
    .png().toBuffer(),
);
say("edge-model-raw-4x.png");

await writeFile(resolve(OUT, "court.log"), `${lines.join("\n")}\n`, "utf8");
process.exit(0);
