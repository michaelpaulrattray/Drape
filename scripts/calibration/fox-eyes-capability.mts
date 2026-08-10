/**
 * CAN ANY ENGINE RESTRUCTURE EYE GEOMETRY? — the probe every previous fox-eyes
 * test was unable to be, and the founder said why.
 *
 * # What was wrong with all of it
 *
 * Every fox-eyes test this program has run — July's walk, this week's walk, my
 * own bare-faced probe — ran on faces with a HIGH BASELINE CANTHAL TILT. The ask
 * was for a property those faces already had, so the requested delta was near
 * zero and "the engine changed nothing" and "the engine rendered that correctly"
 * are the same picture. Measured after the fact: my bare arm was 7.71deg and my
 * spectacled arm 7.2deg, both above the already-upswept threshold. The class's
 * capability was never actually tested.
 *
 * So this runs on a face selected by ARITHMETIC — `tilt-pool.mts` measured the
 * whole specimen pool and this takes the flattest — and it scores with the
 * geometric instrument that passed its own tent-warp control at ~1.1deg
 * (`tilt-instrument.mts`), never with a reader's opinion.
 *
 * # Two hypotheses, one factorial
 *
 * VOCABULARY. "Fox eyes" in training data is the MAKEUP TREND — liner and lift
 * on an unchanged eye — which is exactly the behaviour D-237 photographed. The
 * engine may be succeeding at the wrong definition. So each engine gets the
 * product's current trend-named prose AND a purely anatomical description that
 * never says the words, and the two are compared.
 *
 * ENGINE. FLUX was in this probe and is now BANNED (see `BANNED_ENGINES`): given
 * a caged chance at the one thing it was reputed to do, it decorated rather than
 * restructured, finishing 0-for-4. The reputation was styling mistaken for
 * anatomy. Two engines remain.
 *
 * # The bar, stated before the numbers arrive
 *
 * The instrument resolves ~1.1deg. A render is a genuine restructure only if the
 * tilt moves by more than that, in the asked-for direction. Anything smaller is
 * inside the noise and must not be called — which is the rule that would have
 * stopped the original verdict being written.
 *
 *   npx tsx scripts/calibration/fox-eyes-capability.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { runFalImageJob } from "../../server/providers/falTransport";
import { FAL_GPT_IMAGE_2_EDIT } from "../../server/providers/falImages";
import { DEFAULT_IDENTITY_EDIT_MODEL } from "../../server/providers/falQueue";
import { EYE_SHAPE_RENDER } from "../../server/castingV2/realizedAxes";
import { cornersFromMask, readingFrom } from "../../server/castingV2/canthalTilt";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required");

const OUT = "output/masked/fox-eyes-capability";
mkdirSync(OUT, { recursive: true });

/** The flattest face in the pool: -0.8deg, so the ask carries a real delta. */
const SPECIMEN = process.argv[2] ?? "output/masked/bare-faced/cand-11.png";
/** Below the instrument's own resolution, nothing may be called. */
const RESOLUTION_DEG = 1.1;

const master = readFileSync(SPECIMEN);
const meta = await sharp(master).metadata();
const W = meta.width!, H = meta.height!;
const masterUri = `data:image/png;base64,${master.toString("base64")}`;

const reader = createFalRegionReader({ apiKey });

async function tiltOfImage(bytes: Buffer): Promise<{ meanDeg: number; asymmetryDeg: number } | null> {
  try {
    const eyes = await reader.region({ image: bytes, name: "eyes" });
    const { outers, inners } = cornersFromMask(eyes);
    const reading = readingFrom(outers, inners, W, H);
    return { meanDeg: reading.meanDeg, asymmetryDeg: reading.asymmetryDeg };
  } catch (error) {
    console.log(`      (unreadable: ${String(error).slice(0, 60)})`);
    return null;
  }
}

const PROSE: Record<string, string> = {
  /* What the product sends today. Taken from the composer, not retyped. */
  trend: "Edit this photograph of this exact person, changing ONLY what is listed below. "
    + `Change the eye shape to fox eyes — ${EYE_SHAPE_RENDER["fox eyes"]}.`,
  /*
    THE SAME GEOMETRY WITH THE TREND WORD REMOVED. No "fox", no "cat eye", no
    "almond" — nothing a training set associates with a makeup look. Pure
    anatomy, described the way you would describe it to someone rebuilding the
    bone: where the corners sit relative to one another, and what that does to
    the shape of the opening.
  */
  anatomical: "Edit this photograph of this exact person, changing ONLY what is listed below. "
    + "Reposition the outer corner of each eye so it sits clearly HIGHER than the inner corner "
    + "of that same eye — raise the lateral corners upward toward the temples, and let the lower "
    + "lash line rise to meet them, so each eye opening becomes longer and narrower and slants "
    + "upward from the nose. This is the underlying position of the eyelid corners and the shape "
    + "of the eye opening itself. Do not add or change any makeup, eyeliner, eyeshadow or lashes. "
    + "Keep her identity, bone structure, skin, hair, expression, pose, clothing and background "
    + "exactly as they are.",
};

const ENGINES: Record<string, { endpoint: string; body: (prompt: string) => Record<string, unknown> }> = {
  gpt2: {
    endpoint: FAL_GPT_IMAGE_2_EDIT,
    body: (prompt) => ({ prompt, image_urls: [masterUri], num_images: 1, quality: "high", output_format: "png", image_size: { width: W, height: H } }),
  },
  nbp: {
    endpoint: DEFAULT_IDENTITY_EDIT_MODEL,
    body: (prompt) => ({ prompt, image_urls: [masterUri], num_images: 1, resolution: "2K", aspect_ratio: "2:3", output_format: "png" }),
  },
};

const baseline = await tiltOfImage(master);
if (!baseline) throw new Error("the specimen itself is unreadable — pick another");
console.log(`specimen ${SPECIMEN}  ${W}x${H}`);
console.log(`BASELINE tilt ${baseline.meanDeg.toFixed(2)}deg (asymmetry ${baseline.asymmetryDeg.toFixed(2)})`);
console.log(`instrument resolves ~${RESOLUTION_DEG}deg — smaller moves are not called\n`);

type Row = { engine: string; prose: string; tilt: number | null; delta: number | null; seconds: number };
const rows: Row[] = [];

for (const [engineName, engine] of Object.entries(ENGINES)) {
  for (const [proseName, prompt] of Object.entries(PROSE)) {
    const began = Date.now();
    let bytes: Buffer | null = null;
    try {
      const job = await runFalImageJob({
        apiKey, endpoint: engine.endpoint, body: engine.body(prompt),
        timeoutMs: 300_000, pollIntervalMs: 1_500,
      });
      /* The PATCH may be resized for measurement; the master never is. */
      const rendered = await sharp(job.bytes).metadata();
      bytes = rendered.width === W && rendered.height === H
        ? job.bytes
        : await sharp(job.bytes).resize(W, H, { fit: "fill" }).png().toBuffer();
      writeFileSync(`${OUT}/${engineName}-${proseName}.png`, bytes);
    } catch (error) {
      console.log(`${engineName}/${proseName}  RENDER FAILED — ${String(error).slice(0, 90)}`);
      rows.push({ engine: engineName, prose: proseName, tilt: null, delta: null, seconds: (Date.now() - began) / 1000 });
      continue;
    }
    const reading = await tiltOfImage(bytes);
    const delta = reading ? reading.meanDeg - baseline.meanDeg : null;
    rows.push({
      engine: engineName, prose: proseName,
      tilt: reading?.meanDeg ?? null, delta,
      seconds: (Date.now() - began) / 1000,
    });
    const verdict = delta === null ? "unreadable"
      : delta > RESOLUTION_DEG ? `RESTRUCTURED +${delta.toFixed(2)}deg`
        : delta < -RESOLUTION_DEG ? `WRONG WAY ${delta.toFixed(2)}deg`
          : `no change (${delta >= 0 ? "+" : ""}${delta.toFixed(2)}deg, inside noise)`;
    console.log(
      `${engineName.padEnd(5)} ${proseName.padEnd(11)} tilt ${(reading?.meanDeg ?? NaN).toFixed(2)}deg  ${verdict}`
      + `  ${((Date.now() - began) / 1000).toFixed(0)}s`,
    );
  }
}

/* THE FOUNDER'S EYE ADJUDICATES. A subtle compliance the instrument calls real
   may still not be worth shipping, and only a person can say so — so every arm
   goes on one sheet at 100% over the eyes, master first. */
const eyesMask = await reader.region({ image: master, name: "eyes" });
const { outers } = cornersFromMask(eyesMask);
const midY = (outers[0].y + outers[1].y) / 2;
const box = {
  left: 0,
  top: Math.max(0, Math.round(midY * H - H * 0.06)),
  width: W,
  height: Math.min(H, Math.round(H * 0.13)),
};
const labels = ["master", ...rows.filter((row) => row.tilt !== null).map((row) => `${row.engine}-${row.prose}`)];
const files = [master, ...rows.filter((row) => row.tilt !== null).map((row) => readFileSync(`${OUT}/${row.engine}-${row.prose}.png`))];
const crops = await Promise.all(files.map((bytes) =>
  sharp(bytes).resize(W, H, { fit: "fill" }).extract(box).png().toBuffer()));
await sharp({ create: { width: box.width, height: (box.height + 10) * crops.length, channels: 3, background: "#0A0A0A" } })
  .composite(crops.map((input, index) => ({ input, left: 0, top: index * (box.height + 10) })))
  .png()
  .toFile(`${OUT}/EYES-ALL.png`);

console.log(`\nEYES-ALL.png rows, top to bottom: ${labels.join(" / ")}`);
writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ specimen: SPECIMEN, baseline, resolutionDeg: RESOLUTION_DEG, rows }, null, 2)}\n`);

const landed = rows.filter((row) => row.delta !== null && row.delta > RESOLUTION_DEG);
console.log(landed.length > 0
  ? `\n${landed.length} arm(s) restructured: ${landed.map((row) => `${row.engine}/${row.prose} +${row.delta!.toFixed(1)}deg`).join(", ")}`
  : `\nNO ARM restructured beyond the instrument's resolution on a face with a real delta to give.`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
