/**
 * DOES THE ENGINE HONOUR A MASK WE SUPPLY? (fable-114 addendum, fable-119 §3.)
 *
 * # The closed door nobody had tried
 *
 * The boundary family — the founder's shirt seam, the glasses ghost rim, the
 * under-eye step — all live at the edge of a region OUR compositor pastes. Every
 * proposal so far attacks that edge with a better feather. There is a completely
 * different attack: if the engine will blend natively inside a mask we hand it,
 * the seam never exists to be feathered.
 *
 * The program's standing answer was "engine masks are advisory only", measured
 * early and never re-measured. Reading the adapter settles why that verdict
 * cannot be trusted here: `createFalMaskedEditEngine` is named for OUR pipeline,
 * and the body it sends is `prompt`, `image_urls`, `image_size`, `num_images`,
 * `quality`, `output_format`. **There is no mask field in it. We have never sent
 * one.** Meanwhile `openai/gpt-image-2/edit` publishes `mask_url` — *"the URL of
 * the mask image to use for the generation. This indicates what part of the
 * image to edit."* (`fal-ai/nano-banana-pro/edit` publishes no mask at all, so
 * this probe is about the engine that paints face edits, not the identity one.)
 *
 * # What is measured, and why each half is needed
 *
 * 1. **Containment** — how much of the RAW returned frame differs from the input
 *    outside the mask. This is the "advisory or binding" question, and it is
 *    asked of the engine's own output BEFORE our compositor touches it, because
 *    our compositor would make any engine look obedient.
 * 2. **The boundary** — `compositeSeam` plus the coherence statistic, run on the
 *    raw returned frame against the input with the mask as `applied`. If the
 *    engine blends natively, the step at the mask edge should be small AND
 *    incoherent; a hard paste shows up as a coherent offset, which is exactly
 *    the founder-visible class.
 *
 * Both arms paint the same ask on the same master, so the difference is the mask
 * and nothing else. n=2 per arm by default (`--rounds`), and it says the n.
 *
 * # Polarity is measured, not assumed
 *
 * A mask can mean "edit here" or "keep here", and guessing wrong produces a
 * frame that looks like the engine ignored it. So the probe reports WHERE the
 * change landed rather than assuming, and a run whose change lands entirely
 * outside the white area is reported as INVERTED rather than as disobedience.
 *
 * # It spends the provider balance, never an account
 *
 *   FAL_KEY=… npx tsx scripts/calibration/engine-mask-probe.mts --spend [--rounds 2]
 *
 * Permitted under the stop-the-line by fable-119: a fixture paint charges fal,
 * not the founder's credits, and it is how a frozen line earns its thaw.
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { runFalImageJob } from "../../server/providers/falTransport.js";
import { FAL_GPT_IMAGE_2_EDIT } from "../../server/providers/falImages.js";
import { readRaster, writePng, type Mask, type Raster } from "../../server/castingV2/maskedComposite.js";
import { compositeSeam } from "../../server/castingV2/compositeIntegrity.js";
import { fixtureSpendAuthorized } from "../lib/stopline.mts";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const ROUNDS = Number(arg("rounds", "2"));
const OUT = arg("out", "output/engine-mask");
/* The founder's own master, already pulled for finding #4. Same face, same
   shirt, same seam neighbourhood the complaint came from. */
const MASTER = arg("master", "output/founder-finding-4/master.png");
/* A change nobody can miss, on a surface with texture — grey heather jersey is
   where his seam was, so the arms are measured on the material that produced
   the complaint. */
const ASK = "Change the colour of the t-shirt to deep navy blue. Change nothing else.";

const SPEND = fixtureSpendAuthorized("paint four fixture frames on fal");
const apiKey = process.env.FAL_KEY;
if (!apiKey) { console.error("FAL_KEY is required"); process.exit(1); }

const master = await readRaster(readFileSync(MASTER));
console.log(`master ${master.width}x${master.height}   ${MASTER}`);

/*
  THE ZONE: a rectangle over her left shoulder and sleeve.

  Deliberately geometric. The question is whether the ENGINE respects a
  boundary, and a segmenter's outline would put the answer at the mercy of a
  second stochastic component — the instrument would then be measuring two
  things and able to blame either.
*/
const ZONE = {
  x0: Math.round(master.width * 0.06),
  x1: Math.round(master.width * 0.42),
  y0: Math.round(master.height * 0.54),
  y1: Math.round(master.height * 0.86),
};
const zone: Mask = { data: Buffer.alloc(master.width * master.height, 0), width: master.width, height: master.height };
for (let y = ZONE.y0; y < ZONE.y1; y += 1) {
  for (let x = ZONE.x0; x < ZONE.x1; x += 1) zone.data[y * master.width + x] = 255;
}
const zonePixels = zone.data.reduce((total, value) => total + (value ? 1 : 0), 0);
console.log(`zone   ${ZONE.x0},${ZONE.y0} → ${ZONE.x1},${ZONE.y1}   ${zonePixels.toLocaleString()} px`
  + `  (${((zonePixels / (master.width * master.height)) * 100).toFixed(1)}% of the frame)\n`);

if (!SPEND) {
  console.log(`DRY RUN — would paint ${ROUNDS} frames per arm, 2 arms, on ${FAL_GPT_IMAGE_2_EDIT}.`);
  console.log("Pass --spend to actually paint. Nothing was charged.");
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });

const masterPng = readFileSync(MASTER);

/*
  TWO MASK CONVENTIONS, BECAUSE RUN 1 PROVED THE QUESTION IS REAL.

  `white` — an opaque RGB mask, white where the edit belongs. The plain reading
  of fal's one-line description.
  `alpha` — an RGBA mask whose editable area is TRANSPARENT, which is the
  convention OpenAI's own edit endpoint documents.

  Run 1 sent `white` and the engine returned the frame with a solid black block
  where the mask was. That is neither "honoured" nor "ignored" — it is the
  wrong format, answered literally, and it has to be told apart from both.

  **The mask that was actually sent is written next to the frames it produced**
  (`zone-<mode>.png`), because run 2 of this probe was launched with
  `--maskMode alpha`, silently used the white mask anyway — the patch adding
  this option had failed to apply — and produced four frames I nearly reported
  as "both conventions blank it". A run that cannot show which mask it sent is
  a run whose conclusion rests on the operator's memory.
*/
const MASK_MODE = arg("maskMode", "alpha");
if (MASK_MODE !== "white" && MASK_MODE !== "alpha") {
  console.error(`--maskMode must be "white" or "alpha" — got "${MASK_MODE}"`);
  process.exit(1);
}
const maskPng = MASK_MODE === "white"
  ? await writePng({
    data: Buffer.from(Uint8Array.from({ length: master.width * master.height * 3 }, (_, index) =>
      zone.data[Math.floor(index / 3)] ? 255 : 0)),
    width: master.width,
    height: master.height,
  })
  : await (async () => {
    const sharp = (await import("sharp")).default;
    const rgba = Buffer.alloc(master.width * master.height * 4);
    for (let pixel = 0; pixel < master.width * master.height; pixel += 1) {
      const at = pixel * 4;
      /* Opaque black everywhere, with a TRANSPARENT hole where the edit may go. */
      rgba[at + 3] = zone.data[pixel] ? 0 : 255;
    }
    return sharp(rgba, { raw: { width: master.width, height: master.height, channels: 4 } })
      .png()
      .toBuffer();
  })();
console.log(`mask   ${MASK_MODE === "white" ? "opaque RGB, WHITE = edit here" : "RGBA, TRANSPARENT = edit here"}\n`);
writeFileSync(`${OUT}/zone-${MASK_MODE}.png`, maskPng);

const dataUri = (bytes: Buffer) => `data:image/png;base64,${bytes.toString("base64")}`;

async function paint(withMask: boolean, round: number): Promise<Raster | null> {
  const body: Record<string, unknown> = {
    prompt: ASK,
    image_urls: [dataUri(masterPng)],
    image_size: { width: master.width, height: master.height },
    num_images: 1,
    quality: "high",
    output_format: "png",
  };
  if (withMask) body.mask_url = dataUri(maskPng);
  try {
    const job = await runFalImageJob({
      apiKey: apiKey!,
      endpoint: FAL_GPT_IMAGE_2_EDIT,
      body,
      timeoutMs: 300_000,
      pollIntervalMs: 1_500,
    });
    const name = `${withMask ? "masked" : "plain"}-${round}`;
    writeFileSync(`${OUT}/${name}.png`, job.bytes);
    return await readRaster(job.bytes);
  } catch (error) {
    console.log(`  ${withMask ? "MASKED" : "PLAIN "} round ${round}: FAILED — `
      + `${error instanceof Error ? error.message.slice(0, 160) : String(error)}`);
    return null;
  }
}

const NOISE = 8;

/**
 * DID THE ENGINE HAND BACK A HOLE RATHER THAN A PAINTING?
 *
 * By arithmetic a blanked block is 100% change inside with a large coherent
 * step — the same signature a hard paste produces, which is the thing this
 * probe exists to detect. So the shape is named rather than scored.
 *
 * **It took two wrong statistics to get here, and both failed quietly.**
 *
 *   variance < 2 levels     the blanked frames measure sd 7.9 and 10.9 — the
 *                           block does not line up exactly with the zone, so
 *                           its edges carry real photograph. Silent.
 *   modal EXACT colour      only 30% of the block is any one exact value; the
 *                           blank is dithered. Silent.
 *
 * Both let the probe print *"ADVISORY — the mask is decoration"* about a frame
 * with a hole in it: a wrong verdict from the instrument, on the very run it
 * was written for. The third is measured rather than guessed — the share of the
 * region within ±4 levels of its own median colour, over every frame this probe
 * has bought:
 *
 *     blanked frames      99.1  99.1  98.6  98.7   %
 *     painted shirts      38.4  42.3                %
 *     her master          18.8                      %
 *     her hair-down       0.0                       %
 *
 * The bar is 90%: fifty-six points clear of the nearest photograph, and eight
 * below the nearest blank.
 */
const BLANK_TOLERANCE = 4;
const BLANK_SHARE = 0.9;

function looksBlanked(delivered: Raster): boolean {
  const channels: number[][] = [[], [], []];
  for (let pixel = 0; pixel < master.width * master.height; pixel += 1) {
    if (!zone.data[pixel]) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      channels[channel]!.push(delivered.data[pixel * 3 + channel]!);
    }
  }
  if (channels[0]!.length === 0) return false;
  const median = channels.map((values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)]!;
  });
  let near = 0;
  for (let index = 0; index < channels[0]!.length; index += 1) {
    if (channels.every((values, channel) => Math.abs(values[index]! - median[channel]!) <= BLANK_TOLERANCE)) {
      near += 1;
    }
  }
  return near / channels[0]!.length > BLANK_SHARE;
}

function measure(delivered: Raster): {
  inside: number; outside: number; insideShare: number; outsideShare: number;
  blanked: boolean;
  seam: ReturnType<typeof compositeSeam>;
} {
  let inside = 0;
  let outside = 0;
  let insideTotal = 0;
  let outsideTotal = 0;
  for (let pixel = 0; pixel < master.width * master.height; pixel += 1) {
    const at = pixel * 3;
    const changed = Math.max(
      Math.abs(delivered.data[at]! - master.data[at]!),
      Math.abs(delivered.data[at + 1]! - master.data[at + 1]!),
      Math.abs(delivered.data[at + 2]! - master.data[at + 2]!),
    ) > NOISE;
    if (zone.data[pixel]) { insideTotal += 1; if (changed) inside += 1; }
    else { outsideTotal += 1; if (changed) outside += 1; }
  }
  return {
    inside,
    outside,
    insideShare: inside / insideTotal,
    outsideShare: outside / outsideTotal,
    blanked: looksBlanked(delivered),
    seam: compositeSeam({ master, composite: delivered, applied: zone }),
  };
}

type Row = { arm: string; round: number; result: ReturnType<typeof measure> | null };
const rows: Row[] = [];

for (const withMask of [false, true]) {
  for (let round = 1; round <= ROUNDS; round += 1) {
    const delivered = await paint(withMask, round);
    rows.push({
      arm: withMask ? "masked" : "plain",
      round,
      result: delivered ? measure(delivered) : null,
    });
    if (delivered) {
      const r = rows.at(-1)!.result!;
      console.log(`  ${withMask ? "MASKED" : "PLAIN "} round ${round}: `
        + `changed inside ${(r.insideShare * 100).toFixed(1)}%  outside ${(r.outsideShare * 100).toFixed(2)}%  `
        + `seam torn=${r.seam.torn} worst=${r.seam.worstExcess.toFixed(1)} coherence=${r.seam.coherence.toFixed(3)}`);
    }
  }
}

console.log(`\nn=${ROUNDS} per arm, one master, one ask, one zone.\n`);
console.log("arm     round   inside%   outside%   torn   worstExcess   signedMean   coherence");
for (const row of rows) {
  if (!row.result) { console.log(`${row.arm.padEnd(7)} ${row.round}       — failed —`); continue; }
  const r = row.result;
  console.log(
    `${row.arm.padEnd(7)} ${row.round}       ${(r.insideShare * 100).toFixed(1).padStart(5)}   `
    + `${(r.outsideShare * 100).toFixed(2).padStart(7)}   ${String(r.seam.torn).padEnd(5)}  `
    + `${r.seam.worstExcess.toFixed(1).padStart(9)}   ${r.seam.signedMean.toFixed(2).padStart(9)}   `
    + `${r.seam.coherence.toFixed(3).padStart(8)}`,
  );
}

const masked = rows.filter((row) => row.arm === "masked" && row.result).map((row) => row.result!);
const plain = rows.filter((row) => row.arm === "plain" && row.result).map((row) => row.result!);
const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / (values.length || 1);

console.log("\nREADING");
if (masked.some((row) => row.blanked)) {
  /*
    The outcome run 1 produced, named rather than scored. A blanked block reads
    as 100% change with a large coherent step — arithmetically identical to a
    hard paste — so scoring it would be a verdict about a frame nobody looked at.
  */
  console.log("  THE MASKED FRAME CAME BACK BLANK inside the mask — a solid block, not a painting.");
  console.log(`  That is a MASK FORMAT answer, not a containment answer: this run used "${MASK_MODE}".`);
  console.log("  Try the other convention (--maskMode white|alpha) before concluding anything");
  console.log("  about whether the engine honours a mask. No verdict is printed, deliberately.");
} else if (masked.length === 0) {
  console.log("  the masked arm produced no frames — the endpoint rejected `mask_url` or the job failed.");
} else {
  const outsideMasked = mean(masked.map((r) => r.outsideShare));
  const outsidePlain = mean(plain.map((r) => r.outsideShare));
  console.log(`  change OUTSIDE the zone   masked ${(outsideMasked * 100).toFixed(2)}%  `
    + `plain ${(outsidePlain * 100).toFixed(2)}%`);
  const insideMasked = mean(masked.map((r) => r.insideShare));
  if (insideMasked < 0.02 && outsideMasked > 0.10) {
    console.log("  POLARITY: INVERTED — the change landed outside the white area, so white means KEEP.");
  } else if (outsideMasked < 0.02 && outsidePlain > 0.05) {
    console.log("  CONTAINED — the engine kept its hands off everything outside the mask we supplied.");
  } else if (outsideMasked >= outsidePlain * 0.8) {
    console.log("  ADVISORY — the masked arm strays as much as the unmasked one; the mask is decoration.");
  } else {
    console.log("  PARTIAL — the mask moved the engine without binding it. Numbers above, no verdict.");
  }
  console.log(`  boundary coherence        masked ${mean(masked.map((r) => r.seam.coherence)).toFixed(3)}  `
    + `plain ${mean(plain.map((r) => r.seam.coherence)).toFixed(3)}`);
  console.log("  (a NATIVE blend should show a small, INCOHERENT step at the zone edge;");
  console.log("   a hard paste shows a consistent offset — the founder-visible class.)");
}
console.log(`\nframes in ${OUT}/ — look at them before believing any of this.`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
