/**
 * REPLICATE THE ONE ARM THAT LANDED, AND FILL THE ATTRIBUTION HOLE.
 *
 * The factorial found exactly one restructure — NBP with anatomical prose,
 * +4.84deg on a face measured flat at -0.76deg — and it is n=1, which is the
 * error D-237 had to correct about its own figures. Worse, `nbp/trend` came back
 * unmeasurable (the segmenter could not find an eye on that particular frame,
 * though the render itself is a perfectly ordinary photograph), so the cell that
 * separates ENGINE from VOCABULARY is the missing one.
 *
 * So this runs NBP only, both proses, several times each. It answers two
 * questions with one spend:
 *
 *   does the anatomical arm land AGAIN, or was one render lucky?
 *   does the trend arm land too — in which case the engine was the lever and
 *   the words were never the problem?
 *
 *   npx tsx scripts/calibration/fox-eyes-replicate.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { runFalImageJob } from "../../server/providers/falTransport";
import { DEFAULT_IDENTITY_EDIT_MODEL } from "../../server/providers/falQueue";
import { EYE_SHAPE_RENDER } from "../../server/castingV2/realizedAxes";
import { cornersFromEyeMasks, cornersFromMask, readingFrom } from "../../server/castingV2/canthalTilt";

const apiKey = process.env.FAL_KEY!;
const OUT = "output/masked/fox-eyes-replicate";
mkdirSync(OUT, { recursive: true });
const SPECIMEN = "output/masked/bare-faced/cand-11.png";
const REPEATS = Number(process.env.REPEATS ?? 3);
const RESOLUTION_DEG = 1.1;

const master = readFileSync(SPECIMEN);
const meta = await sharp(master).metadata();
const W = meta.width!, H = meta.height!;
const masterUri = `data:image/png;base64,${master.toString("base64")}`;
const reader = createFalRegionReader({ apiKey });

/**
 * Two ways to reach the same two eyes, tried in a FIXED order and applied
 * identically to every arm including the baseline — so the ladder cannot select
 * for a flattering answer. Which rung answered is reported.
 */
async function tilt(bytes: Buffer): Promise<{ meanDeg: number; asym: number; via: string } | null> {
  try {
    const [right, left] = await Promise.all([
      reader.region({ image: bytes, name: "right eye" }),
      reader.region({ image: bytes, name: "left eye" }),
    ]);
    const { outers, inners } = cornersFromEyeMasks(right, left);
    const reading = readingFrom(outers, inners, W, H);
    return { meanDeg: reading.meanDeg, asym: reading.asymmetryDeg, via: "per-side" };
  } catch { /* fall through */ }
  try {
    const eyes = await reader.region({ image: bytes, name: "eyes" });
    const { outers, inners } = cornersFromMask(eyes);
    const reading = readingFrom(outers, inners, W, H);
    return { meanDeg: reading.meanDeg, asym: reading.asymmetryDeg, via: "union-split" };
  } catch (error) {
    console.log(`      (unmeasurable: ${String(error).slice(0, 55)})`);
    return null;
  }
}

const PROSE: Record<string, string> = {
  trend: "Edit this photograph of this exact person, changing ONLY what is listed below. "
    + `Change the eye shape to fox eyes — ${EYE_SHAPE_RENDER["fox eyes"]}.`,
  anatomical: "Edit this photograph of this exact person, changing ONLY what is listed below. "
    + "Reposition the outer corner of each eye so it sits clearly HIGHER than the inner corner "
    + "of that same eye — raise the lateral corners upward toward the temples, and let the lower "
    + "lash line rise to meet them, so each eye opening becomes longer and narrower and slants "
    + "upward from the nose. This is the underlying position of the eyelid corners and the shape "
    + "of the eye opening itself. Do not add or change any makeup, eyeliner, eyeshadow or lashes. "
    + "Keep her identity, bone structure, skin, hair, expression, pose, clothing and background "
    + "exactly as they are.",
};

const baseline = await tilt(master);
if (!baseline) throw new Error("the specimen is unmeasurable");
console.log(`specimen ${SPECIMEN}`);
console.log(`BASELINE ${baseline.meanDeg.toFixed(2)}deg (via ${baseline.via}), resolution ~${RESOLUTION_DEG}deg\n`);

const rows: any[] = [];
for (const [proseName, prompt] of Object.entries(PROSE)) {
  for (let run = 1; run <= REPEATS; run += 1) {
    const began = Date.now();
    let bytes: Buffer;
    try {
      const job = await runFalImageJob({
        apiKey,
        endpoint: DEFAULT_IDENTITY_EDIT_MODEL,
        body: { prompt, image_urls: [masterUri], num_images: 1, resolution: "2K", aspect_ratio: "2:3", output_format: "png" },
        timeoutMs: 300_000, pollIntervalMs: 1_500,
      });
      const m = await sharp(job.bytes).metadata();
      bytes = m.width === W && m.height === H ? job.bytes : await sharp(job.bytes).resize(W, H, { fit: "fill" }).png().toBuffer();
      writeFileSync(`${OUT}/nbp-${proseName}-${run}.png`, bytes);
    } catch (error) {
      console.log(`nbp/${proseName} run ${run}  RENDER FAILED ${String(error).slice(0, 70)}`);
      continue;
    }
    const reading = await tilt(bytes);
    const delta = reading ? reading.meanDeg - baseline.meanDeg : null;
    rows.push({ prose: proseName, run, tilt: reading?.meanDeg ?? null, delta, via: reading?.via ?? null });
    console.log(
      `nbp/${proseName.padEnd(11)} run ${run}  `
      + (reading
        ? `${reading.meanDeg.toFixed(2)}deg  ${delta! > RESOLUTION_DEG ? `RESTRUCTURED +${delta!.toFixed(2)}` : delta! < -RESOLUTION_DEG ? `WRONG WAY ${delta!.toFixed(2)}` : `no change (${delta! >= 0 ? "+" : ""}${delta!.toFixed(2)})`}  via ${reading.via}`
        : "UNMEASURABLE")
      + `  ${((Date.now() - began) / 1000).toFixed(0)}s`,
    );
  }
}

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ specimen: SPECIMEN, baseline, rows }, null, 2)}\n`);

console.log("\n=== per arm ===");
for (const prose of ["trend", "anatomical"]) {
  const mine = rows.filter((row) => row.prose === prose && row.delta !== null);
  if (mine.length === 0) { console.log(`${prose.padEnd(11)} no measurable runs`); continue; }
  const deltas = mine.map((row) => row.delta as number);
  const landed = deltas.filter((delta) => delta > RESOLUTION_DEG).length;
  console.log(
    `${prose.padEnd(11)} ${landed}/${mine.length} restructured  `
    + `deltas ${deltas.map((delta) => `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`).join(", ")}`,
  );
}

/* The founder's eye adjudicates whether any of it is worth shipping. */
const measured = rows.filter((row) => row.tilt !== null);
if (measured.length > 0) {
  const box = { left: 0, top: Math.round(H * 0.17), width: W, height: Math.round(H * 0.13) };
  const files = [master, ...measured.map((row) => readFileSync(`${OUT}/nbp-${row.prose}-${row.run}.png`))];
  const crops = await Promise.all(files.map((b) => sharp(b).resize(W, H, { fit: "fill" }).extract(box).png().toBuffer()));
  await sharp({ create: { width: box.width, height: (box.height + 10) * crops.length, channels: 3, background: "#0A0A0A" } })
    .composite(crops.map((input, i) => ({ input, left: 0, top: i * (box.height + 10) })))
    .png().toFile(`${OUT}/EYES-REPLICATE.png`);
  console.log(`\nEYES-REPLICATE.png rows: master / ${measured.map((row) => `${row.prose}-${row.run}`).join(" / ")}`);
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
