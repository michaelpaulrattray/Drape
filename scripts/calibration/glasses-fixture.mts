/**
 * THE GLASSES FIXTURE — both scenarios, three engines, one harness.
 *
 * The first time anything in this workstream RENDERS. Everything before it
 * established that masks of the right shape can be obtained; this asks whether
 * an edit made inside one holds the guarantee the whole architecture rests on:
 *
 *   **where the feathered mask is fully zero, the output is byte-identical to
 *   the master.**
 *
 * That is arithmetic, not a reader (D-209). No vision model is asked whether
 * something outside the mask moved.
 *
 * # The two scenarios, and why they are not the same test
 *
 * (a) COMPOUND SAME-REGION EDIT — fox eyes, eye colour, brows and different
 *     glasses, batched into ONE mask and ONE pass. The founder's law is batch by
 *     REGION, never by count: the constraint is the AREA the model must
 *     reinterpret, so four demands on one region are one edit. The check is
 *     outside-region byte identity.
 *
 * (b) EYE EDITS THAT KEEP THE GLASSES — the harder one, and the reason D-211
 *     splits frames from lenses. The frames are **excluded from the mask**, so
 *     they are composited back verbatim BY CONSTRUCTION rather than by asking a
 *     model to leave them alone. The lens interiors regenerate, because those
 *     pixels hold the old eye seen through glass and can never be copied. Brows
 *     own a sub-mask (proximity is not region). Seam honesty is scored AT THE
 *     FRAME EDGES specifically, which is where this can only fail.
 *
 * # Riders in force
 *
 * FULL-FRAME CONTEXT WITH LOCAL HARVEST. The model is sent the whole frame and
 * returns a whole frame — it needs the face to know what it is editing. Our code
 * then takes ONLY in-mask pixels. Model-side masking is documented guidance, not
 * a boundary, so the boundary is ours.
 *
 * BOUNDARY CONTACT (`RIDER_boundary-contact.md`). Measured here, not assumed:
 * the check runs on PAINTED CONTENT — pixels where the composite differs from
 * the master INSIDE the mask — against the destination zone's HARD edge, never
 * the feather ramp. The rider says the tolerance is a number to be measured on
 * the fixture rather than guessed, so this reports contact across a spread of
 * tolerances and picks nothing.
 *
 * MASTER HYGIENE. The master is never resampled. The PATCH is resized to the
 * master's dimensions when an engine returns a different size — that is a
 * resample of material we are about to discard 97% of, and it is stated rather
 * than hidden.
 *
 *   npx tsx scripts/calibration/glasses-fixture.mts [--engines nbp,gpt2,flux]
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { coverage, subtractMask, unionMasks, type Mask } from "../../server/castingV2/maskGeometry";
import {
  compositeMasked,
  featherMask,
  outsideMaskUnchanged,
  readRaster,
  seamBand,
  writePng,
  type Raster,
} from "../../server/castingV2/maskedComposite";
import { boundaryContact } from "./lib/contact.mts";
import { composeRenderPrompt } from "../../server/castingV2/refineDelta";
import { runFalImageJob } from "../../server/providers/falTransport";
import { FAL_GPT_IMAGE_2_EDIT } from "../../server/providers/falImages";
import { DEFAULT_IDENTITY_EDIT_MODEL } from "../../server/providers/falQueue";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required");

const OUT = "output/masked/glasses-fixture";
mkdirSync(OUT, { recursive: true });

const MASTER_FILE = "output/masked/specimens/fresh-02.png";
const FEATHER = 3;

const enginesFlag = process.argv.indexOf("--engines");
const ENGINES = (enginesFlag >= 0 ? process.argv[enginesFlag + 1] : "nbp,gpt2").split(",");
/* Re-running one scenario should not re-buy the other two. */
const onlyFlag = process.argv.indexOf("--only");
const ONLY = onlyFlag >= 0 ? process.argv[onlyFlag + 1]!.split(",") : null;

/* ------------------------------------------------------------- segmentation */

async function toMask(bytes: Buffer): Promise<Mask> {
  const meta = await sharp(bytes).metadata();
  const pipeline = meta.hasAlpha ? sharp(bytes).extractChannel(3) : sharp(bytes).toColourspace("b-w");
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (data.length !== info.width * info.height) {
    throw new Error(`mask not single-channel: ${data.length} for ${info.width}x${info.height}`);
  }
  return { data, width: info.width, height: info.height };
}

const masterBytes = readFileSync(MASTER_FILE);
const masterUri = `data:image/png;base64,${masterBytes.toString("base64")}`;

async function segment(prompt: string, imageUri: string = masterUri): Promise<Mask> {
  const response = await fetch("https://fal.run/fal-ai/sam-3/image", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
      "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 3600 }),
    },
    body: JSON.stringify({ image_url: imageUri, prompt, include_scores: true, output_format: "png" }),
  });
  if (!response.ok) throw new Error(`${prompt}: ${(await response.text()).slice(0, 160)}`);
  const json = await response.json() as any;
  /* An empty set is a RESULT. For a fixture region it is a hard stop — we do not
     proceed to spend on a render whose destination zone does not exist. */
  if (!Array.isArray(json.masks) || json.masks.length === 0) {
    throw new Error(`"${prompt}" returned an empty mask set — no destination zone, refusing to render`);
  }
  const url = json.masks[0]?.url ?? json.masks[0];
  const bytes = url.startsWith("data:")
    ? Buffer.from(url.split(",")[1], "base64")
    : Buffer.from(await (await fetch(url)).arrayBuffer());
  return toMask(bytes);
}

/**
 * IS IT STILL THERE? — asked of a frame we just made, not of the master.
 *
 * An empty mask set is the segmenter's way of saying "nothing like that here",
 * which for this question is the ANSWER rather than an error. Anything at or
 * below the eyewear band is a confident speck rather than a pair of glasses.
 */
async function stillPresent(bytes: Buffer, name: string): Promise<number> {
  try {
    const seen = await segment(name, `data:image/png;base64,${bytes.toString("base64")}`);
    return coverage(seen);
  } catch {
    return 0;
  }
}

/* --------------------------------------------------------- boundary contact */

/* The rider now lives in one place — see `lib/contact.mts`. It was written
   three times, and the second copy said so in its own comment. */

/* -------------------------------------------------------------- the engines */

type EngineRun = { bytes: Buffer; ms: number; resized: boolean };

async function render(engine: string, prompt: string): Promise<EngineRun> {
  const started = Date.now();
  const config: Record<string, { endpoint: string; body: Record<string, unknown> }> = {
    nbp: {
      endpoint: DEFAULT_IDENTITY_EDIT_MODEL,
      body: { prompt, image_urls: [masterUri], num_images: 1, resolution: "2K", aspect_ratio: "2:3", output_format: "png" },
    },
    gpt2: {
      endpoint: FAL_GPT_IMAGE_2_EDIT,
      body: { prompt, image_urls: [masterUri], num_images: 1, quality: "medium", output_format: "png" },
    },
    flux: {
      endpoint: "fal-ai/flux-2-pro/edit",
      body: { prompt, image_urls: [masterUri], output_format: "png", image_size: "portrait_4_3" },
    },
  };
  const { endpoint, body } = config[engine];
  const job = await runFalImageJob({ apiKey: apiKey!, endpoint, body, timeoutMs: 300_000, pollIntervalMs: 1_500 });
  const meta = await sharp(job.bytes).metadata();
  const resized = meta.width !== master.width || meta.height !== master.height;
  /* The PATCH is resized, never the master. Stated because it is a lossy step
     inside a workstream whose whole promise is that there are none. */
  const bytes = resized
    ? await sharp(job.bytes).resize(master.width, master.height, { fit: "fill" }).png().toBuffer()
    : job.bytes;
  return { bytes, ms: Date.now() - started, resized };
}

/* ------------------------------------------------------------------ the run */

const master: Raster = await readRaster(masterBytes);
console.log(`master ${master.width}x${master.height}  ${MASTER_FILE}\n`);

console.log("segmenting the destination zones…");
const eyeglasses = await segment("eyeglasses");
const lenses = await segment("eyeglass lenses");
const eyes = await segment("eyes");
const brows = await segment("eyebrows");
const frames = subtractMask(eyeglasses, lenses);
console.log(`  eyeglasses ${(coverage(eyeglasses) * 100).toFixed(2)}%  lenses ${(coverage(lenses) * 100).toFixed(2)}%`
  + `  frames ${(coverage(frames) * 100).toFixed(2)}%  eyes ${(coverage(eyes) * 100).toFixed(2)}%`
  + `  brows ${(coverage(brows) * 100).toFixed(2)}%`);

const SCENARIOS = [
  {
    key: "a-compound",
    /* ONE mask: everything the four demands touch. Batched by REGION. */
    mask: unionMasks(eyeglasses, eyes, brows),
    prompt:
      "Change only the eyes, eyebrows and eyeglasses of the woman in this photograph. "
      + "Give her upswept fox-eye shaping, green irises, thicker straighter eyebrows, "
      + "and a different pair of glasses with a bolder rectangular frame. "
      + "Keep her identity, bone structure, skin, hair, expression, pose, lighting, "
      + "clothing and the background exactly as they are.",
  },
  {
    key: "b-keep-glasses",
    /*
      Lenses and brows regenerate; the FRAMES ARE SUBTRACTED LAST, which is what
      makes "composited back verbatim" structural instead of a request. D-211:
      an exclusion that subtracts last cannot be talked open by a prompt.
    */
    mask: subtractMask(unionMasks(lenses, brows), frames),
    prompt:
      "Change only the eyes and eyebrows of the woman in this photograph, seen through "
      + "her glasses. Give her upswept fox-eye shaping, green irises, and thicker "
      + "straighter eyebrows. Keep her glasses exactly as they are — same frames, same "
      + "position. Keep her identity, bone structure, skin, hair, expression, pose, "
      + "lighting, clothing and the background exactly as they are.",
  },
  {
    /*
      (c) THE REMOVAL — the scenario this fixture never had, and the one that had
      never worked (D-238).

      Base-worn glasses: they came off the roll's brief, no instruction ever
      added them, so there is no step to prune. Until now the prompt never asked
      for them to go — `departed` reached the mask-cutter and the verification
      net and never the painter, while the preservation tail told it that
      anything worn in the reference stays worn. Three paints, zero removals, and
      the painter obeyed us precisely every time.

      **The prompt is not written here.** It is composed by the production path
      from a composed delta, so what this fixture proves is what the product
      actually sends. A hand-written removal prompt would prove that SOME
      sentence removes glasses, which was never in doubt and is not the question.

      The mask is the master's own eyeglasses — for a removal the object is on
      the master, and the vacancy left behind is its whole footprint.
    */
    key: "c-remove-glasses",
    mask: eyeglasses,
    prompt: composeRenderPrompt(
      { absent: { statedAccessories: ["glasses"] } },
      /* No guaranteed axis is written, so no prose function is ever called —
         these exist to satisfy the signature, not to shape the string. */
      {
        eyeColour: (v: string) => v, eyeShape: (v: string) => v, hairStyle: (v: string) => v,
        hairColour: (v: string) => v, hairTexture: (v: string) => v,
      } as never,
      "",
    ).full,
    /* THE COURT (suspect-the-adapter-first). Both frames are asked the same
       question, and the pair of answers names the culprit rather than leaving
       "it still has glasses" to be argued about:

         raw HAS them        → the painter never removed. Our sentence failed.
         raw clean, comp HAS → the compositor put them back. Our mask failed.
         both clean          → delivered.

       The raw frame is saved either way, which is what keeps this decidable
       tomorrow instead of only tonight. */
    verifyAbsent: "eyeglasses",
  },
];

const rows: any[] = [];
for (const scenario of SCENARIOS.filter((s) => !ONLY || ONLY.includes(s.key))) {
  console.log(`\n### ${scenario.key} — mask coverage ${(coverage(scenario.mask) * 100).toFixed(2)}%`);
  writeFileSync(
    `${OUT}/${scenario.key}-mask.png`,
    await sharp(scenario.mask.data, { raw: { width: scenario.mask.width, height: scenario.mask.height, channels: 1 } }).png().toBuffer(),
  );
  for (const engine of ENGINES) {
    let run: EngineRun;
    try {
      run = await render(engine, scenario.prompt);
    } catch (error) {
      console.log(`  ${engine.padEnd(5)} RENDER FAILED — ${(error as Error).message.slice(0, 140)}`);
      rows.push({ scenario: scenario.key, engine, ok: false, detail: (error as Error).message.slice(0, 200) });
      continue;
    }
    const patch = await readRaster(run.bytes);
    const { composite, applied } = await compositeMasked({
      master, patch, mask: scenario.mask, featherRadius: FEATHER,
    });
    const outside = outsideMaskUnchanged(master, composite, applied);
    const seam = seamBand(master, composite, applied);
    const contact = boundaryContact(master, composite, scenario.mask, [0, 1, 2, 4, 8]);

    const compositeBytes = await writePng(composite);
    writeFileSync(`${OUT}/${scenario.key}-${engine}-raw.png`, run.bytes);
    writeFileSync(`${OUT}/${scenario.key}-${engine}-composite.png`, compositeBytes);

    /* THE COURT, when the scenario asks for an absence. Both frames, one
       question, and the verdict is derived from the pair. */
    let verdict: Record<string, unknown> | null = null;
    if ((scenario as { verifyAbsent?: string }).verifyAbsent) {
      const name = (scenario as { verifyAbsent: string }).verifyAbsent;
      const inRaw = await stillPresent(run.bytes, name);
      const inComposite = await stillPresent(compositeBytes, name);
      /* The same band the service uses to decide a thing is really there rather
         than a confident speck. */
      const BAND = 0.004;
      const acquits = inRaw >= BAND
        ? "PAINTER NEVER REMOVED — our sentence failed"
        : inComposite >= BAND
          ? "COMPOSITOR PUT THEM BACK — our mask failed"
          : "REMOVED — painter and composite both clean";
      verdict = { name, inRaw, inComposite, band: BAND, acquits };
      console.log(
        `  ${engine.padEnd(5)} ${name}: raw ${(inRaw * 100).toFixed(3)}%  `
        + `composite ${(inComposite * 100).toFixed(3)}%  → ${acquits}`,
      );
    }

    console.log(
      `  ${engine.padEnd(5)} outside ${outside.identical ? "BYTE-IDENTICAL" : `CHANGED ${outside.changedPixels}`}`
      + `  seam mean ${seam.meanDelta.toFixed(1)} max ${seam.maxDelta}`
      + `  painted ${contact.paintedPixels}`
      + `  contact@2 ${(contact.contact.find((c) => c.tolerance === 2)!.paintedShareOfRing * 100).toFixed(1)}%`
      + `  ${run.resized ? "[patch resized] " : ""}${Math.round(run.ms / 1000)}s`,
    );
    rows.push({
      scenario: scenario.key,
      engine,
      ok: true,
      patchResized: run.resized,
      maskCoverage: coverage(scenario.mask),
      outsideIdentical: outside.identical,
      changedPixels: outside.changedPixels,
      bandPixels: outside.bandPixels,
      seamMeanDelta: seam.meanDelta,
      seamMaxDelta: seam.maxDelta,
      seamPixels: seam.pixels,
      paintedPixels: contact.paintedPixels,
      boundaryContact: contact.contact,
      ms: run.ms,
      ...(verdict ? { absence: verdict } : {}),
    });
  }
}

writeFileSync(
  `${OUT}/results.json`,
  `${JSON.stringify({ master: MASTER_FILE, featherRadius: FEATHER, rows }, null, 2)}\n`,
);
console.log(`\nwritten to ${OUT}`);
