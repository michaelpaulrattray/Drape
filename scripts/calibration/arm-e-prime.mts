/**
 * ARM (e′) — THE DOSE-RESPONSE PROBE.
 *
 * The founder ran the identity pull-back ten times outside the program and it
 * LANDS on GPT Image 2 where it refuses on Nano Banana Pro (D-200, amended). So
 * arm (e)'s death was one provider's behaviour, not a law, and the question
 * reopens — but not as the same question.
 *
 * WHAT THIS MEASURES, and only this: does the pull-back's power depend on how
 * far the chain has already drifted? Arm (e) was tried once, at maximum drift,
 * and failed. If recovery is strong at step 1 and gone by step 4 that is a
 * usable ceiling; if it is flat, depth does not matter and the design is
 * simpler. Nobody knows which, and one data point cannot say.
 *
 * WHAT THIS IS NOT: arm (e′) proper. That is TWO passes — this minimal restore,
 * then the verification net (D-185) reading the result and reasserting every
 * miss as an ordinary scoped edit. Pass two is not built here, because pass one
 * has to be worth having first, and because the specimens go to the founder
 * before anything system-side moves.
 *
 * THE PROMPT IS MINIMAL ON PURPOSE. The founder's Batch B enumerated everything
 * to preserve: 5/5 corrected the eyes and the earrings VANISHED. Enumerating
 * everything makes the model re-decide everything (D-196's shape again). Batch A
 * was minimal and went 6/6. This is Batch A's shape.
 *
 * SCORING obeys D-203 — three separate scores, and identity is read against a
 * floor rather than in the absolute:
 *
 *   identity   the drifted step scored against the base BEFORE the restore is
 *              the floor; the restored frame scored the same way is the
 *              measurement. Recovery is the difference, and only GEOMETRY
 *              counts (jaw, face length, nose, lips, eye spacing) — tone and
 *              freckling move under any contrast change and are advisory.
 *   styling    the facets the chain actually instructed, cumulative per step,
 *              present or absent. A restore that loses the bob is not a restore.
 *   fidelity   Laplacian ratio to base. Weak by D-197 and reported as weak.
 *
 *   npx tsx scripts/calibration/arm-e-prime.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

import { runFalImageJob } from "../../server/providers/falTransport";
import { FAL_GPT_IMAGE_2_EDIT } from "../../server/providers/falImages";
import { interpreterEngine } from "../../server/castingV2/interpreter";

const DIR = "output/quality-unit/specimens";
const OUT = "output/quality-unit/arm-e-prime";
const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required — this probe spends real money");
const reader = interpreterEngine();
if (!reader) throw new Error("no reader configured");

/** Cumulative, from the chain's verbatim instructions (D-199, corrected). */
const FACETS = [
  { step: 1, facet: "a blunt bob haircut" },
  { step: 2, facet: "seafoam green eyes" },
  { step: 3, facet: "small gold hoop earrings" },
  { step: 4, facet: "copper hair colour" },
];

/** Geometry a contrast filter cannot move. D-203: score these, advise the rest. */
const GEOMETRY = ["jaw width", "face length/shape", "nose shape", "lip fullness", "eye spacing"];

/**
 * Batch A's shape: two roles named, nothing enumerated.
 *
 * Identity goes first because it is the thing being rescued, and the order is
 * recorded here so a re-run is a re-run rather than a new experiment.
 */
const RESTORE = [
  "Image 1 is the reference for WHO this person is: her face, bone structure, skin and",
  "features.",
  "",
  "Image 2 is the reference for EVERYTHING ELSE: hair, clothing, jewellery, expression,",
  "pose, lighting, framing and background.",
  "",
  "Produce image 2's photograph with image 1's face.",
].join("\n");

async function laplacian(bytes: Buffer): Promise<number> {
  const { data, info } = await sharp(bytes)
    .resize(768, null, { fit: "inside" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < info.height - 1; y += 1) {
    for (let x = 1; x < info.width - 1; x += 1) {
      const i = y * info.width + x;
      const lap = -4 * data[i] + data[i - 1] + data[i + 1]
        + data[i - info.width] + data[i + info.width];
      sum += lap;
      sumSq += lap * lap;
      n += 1;
    }
  }
  return Math.sqrt(sumSq / n - (sum / n) ** 2);
}

async function readJson(system: string, user: string, images: Buffer[]): Promise<any> {
  const reply = await reader!.complete({
    system,
    user,
    images: images.map((bytes) => ({ bytes, contentType: "image/png" as const })),
    json: true,
    temperature: 0,
    maxOutputTokens: 900,
  });
  return JSON.parse(reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""));
}

const IDENTITY = [
  "You are shown two photographs. Compare them FEATURE BY FEATURE and judge whether each",
  "feature MATCHES. Ignore hair, makeup, jewellery, clothing and expression entirely.",
  "",
  "Judge exactly these: jaw width, face length/shape, nose shape, lip fullness, eye spacing,",
  "skin freckling, skin tone.",
  "",
  "Do not be charitable. If a feature reads differently, say it does not match.",
  "",
  'Reply with JSON: {"features":[{"name":"...","matches":true|false}]} and nothing else.',
].join("\n");

/** Three readings, because D-199 established the reader disagrees with itself. */
async function identityMisses(left: Buffer, right: Buffer): Promise<string[]> {
  const runs: string[][] = [];
  for (let index = 0; index < 3; index += 1) {
    const parsed = await readJson(IDENTITY, "First image, then second image.", [left, right]);
    runs.push(
      (parsed?.features ?? [])
        .filter((feature: any) => feature?.matches === false)
        .map((feature: any) => String(feature?.name).toLowerCase()),
    );
  }
  // Majority of three: one reader's bad day does not become a finding.
  const names = [...new Set(runs.flat())];
  return names.filter((name) => runs.filter((run) => run.includes(name)).length >= 2);
}

function geometryMisses(misses: string[]): string[] {
  return misses.filter((miss) => GEOMETRY.some((feature) => miss.includes(feature.split("/")[0])));
}

async function stylingHeld(image: Buffer, facets: string[]) {
  const parsed = await readJson(
    [
      "You are shown one photograph. For each listed feature, say whether the photograph",
      "clearly shows it.",
      "",
      'Reply with JSON: {"checks":[{"feature":"...","present":true|false}]} and nothing else.',
    ].join("\n"),
    facets.map((facet, index) => `${index + 1}. ${facet}`).join("\n"),
    [image],
  );
  const checks: Record<string, boolean> = {};
  for (const check of parsed?.checks ?? []) checks[String(check?.feature)] = check?.present === true;
  const held = Object.values(checks).filter(Boolean).length;
  return { held, of: facets.length, checks };
}

const base = readFileSync(`${DIR}/built-base.png`);
const baseSharp = await laplacian(base);

const rows: unknown[] = [];
const tiles: Buffer[] = [base];

for (const { step } of FACETS) {
  const drifted = readFileSync(`${DIR}/built-step${step}.png`);
  const facets = FACETS.filter((entry) => entry.step <= step).map((entry) => entry.facet);

  // The floor: how much identity this step had already lost before any restore.
  const before = await identityMisses(base, drifted);

  const job = await runFalImageJob({
    apiKey,
    endpoint: FAL_GPT_IMAGE_2_EDIT,
    body: {
      prompt: RESTORE,
      image_urls: [base, drifted].map(
        (bytes) => `data:image/png;base64,${bytes.toString("base64")}`,
      ),
      num_images: 1,
      quality: "medium",
      output_format: "png",
    },
    timeoutMs: 300_000,
    pollIntervalMs: 1_500,
  });
  writeFileSync(`${OUT}/step${step}-restored.png`, job.bytes);
  tiles.push(drifted, job.bytes);

  const after = await identityMisses(base, job.bytes);
  const styling = await stylingHeld(job.bytes, facets);
  const sharpness = await laplacian(job.bytes);

  const row = {
    step,
    identityBefore: before,
    identityAfter: after,
    geometryBefore: geometryMisses(before),
    geometryAfter: geometryMisses(after),
    stylingHeld: `${styling.held}/${styling.of}`,
    stylingChecks: styling.checks,
    sharpnessRatio: sharpness / baseSharp,
    providerRef: job.requestId,
  };
  rows.push(row);
  console.log(
    `  step ${step}: geometry lost ${row.geometryBefore.length} -> ${row.geometryAfter.length}`
    + `   styling ${row.stylingHeld}   sharp ${(row.sharpnessRatio * 100).toFixed(0)}%`,
  );
  if (row.geometryAfter.length) console.log(`          still off: ${row.geometryAfter.join(", ")}`);
}

writeFileSync(`${OUT}/results.json`, JSON.stringify({ prompt: RESTORE, rows }, null, 2));

// base | drift1 | restored1 | drift2 | restored2 | … — the founder reads pictures.
const width = 380;
const resized = await Promise.all(tiles.map((bytes) => sharp(bytes).resize(width).toBuffer()));
const height = (await sharp(resized[0]).metadata()).height ?? 570;
await sharp({
  create: { width: width * resized.length, height, channels: 3, background: { r: 11, g: 11, b: 12 } },
})
  .composite(resized.map((input, index) => ({ input, left: width * index, top: 0 })))
  .png()
  .toFile(`${OUT}/sheet.png`);

console.log(`\nspecimens in ${OUT} — sheet.png is base | drift | restored, per step`);
