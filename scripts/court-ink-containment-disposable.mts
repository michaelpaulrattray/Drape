/**
 * THE CONTAINMENT SITTING — does the plate stay where the placement says?
 * (fable-955 §3's open question; ordered fable-970 §2a after the wrap court.)
 *
 * The wrap court bought the wrap and lost the boundary: told the sheet holds
 * three views of one arm, the engine ran the serpent from shoulder past the
 * elbow, where the one-view prompt had kept it on the upper arm. Both are the
 * same design and the same engine; the only thing that moved was the words.
 *
 * So this is a WORDS court, and it produces frames rather than a verdict —
 * **the coverage question is his taste, not an engineering fact.** He is handed
 * the same design plated three ways and asked which one a customer should get.
 *
 * # THE THREE ARMS
 *
 *   A  as shipped — `inkPlatePrompt` exactly as the product sends it today.
 *   B  + a BOUNDARY sentence: the surface's own extent, named, with the
 *      neighbouring surfaces named as out of bounds.
 *   C  + boundary AND scale: the same sentence, plus permission to size the
 *      design down to fit rather than run past the line to keep its size.
 *
 * C exists because B has an obvious failure mode: an engine told "stay between
 * shoulder and elbow" with a design too tall for that zone can either shrink it
 * or ignore the instruction, and which one it does is exactly the sort of thing
 * this program has been wrong about from an armchair.
 *
 * # WHY IT DOES NOT GO THROUGH THE UPLOAD ROAD
 *
 * The road is already proven end to end (the wrap court drove it, rows and
 * all). The axis HERE is the prompt, so the variants are built here and handed
 * straight to the engine adapter — no row is written, nothing is stored, and
 * the shipped prompt is not edited for an experiment it has not won yet. Arm A
 * is the product's real sentence, imported rather than retyped, so the control
 * cannot drift from the thing it is controlling.
 *
 * # WHAT IT SPENDS
 *
 * Three plate mints on the ruled engine: ~$0.45 of house money, no credits, no
 * rows, no objects.
 *
 *   npx tsx scripts/court-ink-containment-disposable.mts --design <path.png>
 */
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { inkPlatePrompt } from "../server/castingV2/inkPlateDoor.js";
import { platesByIdentityEngine } from "../server/castingV2/inkPlateEngines.js";
import { inkTemplateFor, loadInkTemplate } from "../server/castingV2/inkTemplates.js";
import { createFalIdentityEngine } from "../server/providers/falQueue.js";
import { ProviderQueue } from "../server/providers/providerQueue.js";

const OUT = "output/containment-court";
mkdirSync(OUT, { recursive: true });

function arg(flag: string, fallback?: string): string {
  const at = process.argv.indexOf(flag);
  const value = at >= 0 ? process.argv[at + 1] : undefined;
  if (!value) {
    if (fallback !== undefined) return fallback;
    throw new Error(`${flag} is required`);
  }
  return value;
}

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) throw new Error("FAL_KEY is required — this court drives the real engine");

const designPath = arg("--design");
const PLACEMENT = "upperArm" as const;
const SIDE = "left" as const;

/* `inkTemplateFor` gained a REFUSAL arm on 2026-08-19 (`noFormForBuild`) and
   now returns a choice rather than a blank. This court is fixed at
   upperArm/left, which is one bare limb and serves every build, so the refusal
   is unreachable here — but it is unwrapped rather than asserted away, because
   a court that would crash on a shape the product can produce is not a court.

   It is resolved HERE, above the prompt, because `inkPlatePrompt` no longer
   derives the blank from the placement: the prompt and the posted picture must
   be the same blank or the words describe a different limb from the one on the
   wire. */
const choice = inkTemplateFor({ placement: PLACEMENT, side: SIDE, build: null });
if (!choice.ok) throw new Error(`no blank for ${PLACEMENT}/${SIDE}: ${choice.reason}`);
const template = choice.template;

/* Arm A is the product's own sentence, imported. A retyped control is a control
   of something else. */
const shipped = inkPlatePrompt({ placement: PLACEMENT, side: SIDE, template });

/*
  THE BOUNDARY, in the surface's own anatomy rather than in pixels. The engine
  is looking at a limb, not at a canvas, so "between the shoulder and the elbow"
  is a sentence it can act on and "the top third of the frame" is not.
*/
const BOUNDARY = [
  "",
  "WHERE IT STOPS:",
  "- The upper arm is the part between the shoulder and the elbow. The design",
  "  must stay entirely within it, in every view.",
  "- Nothing on the forearm, nothing below the elbow, nothing on the shoulder",
  "  cap and nothing onto the chest or back.",
].join("\n");

const SCALE = [
  "- If the design is too large for that zone, SCALE IT DOWN to fit. Do not",
  "  extend it past the elbow to keep its size, and do not crop it.",
].join("\n");

const ARMS = [
  { key: "a-as-shipped", prompt: shipped },
  { key: "b-boundary", prompt: `${shipped}\n${BOUNDARY}` },
  { key: "c-boundary-and-scale", prompt: `${shipped}\n${BOUNDARY}\n${SCALE}` },
];

const loaded = await loadInkTemplate(template);
if (!loaded) throw new Error(`the template is not on disk: ${template.file}`);
if (loaded.digest !== template.digest) {
  throw new Error("the template's bytes have moved — a court on a sheet nobody approved is worthless");
}

const designBytes = await readFile(designPath);
const engine = platesByIdentityEngine(
  createFalIdentityEngine({
    apiKey: FAL_KEY,
    queue: new ProviderQueue({ name: "court-containment", concurrency: 1, maxQueueDepth: 4 }),
  }),
  { resolution: "2K" },
);

console.log(`design    ${designPath}`);
console.log(`template  ${template.file} ${template.width}x${template.height} (${template.views.join(", ")})`);
console.log(`engine    ${engine.id}\n`);

for (const arm of ARMS) {
  const started = Date.now();
  const result = await engine.mint({
    prompt: arm.prompt,
    template: { bytes: loaded.bytes, contentType: template.mime },
    design: { bytes: designBytes, contentType: "image/png" },
    templateWidth: template.width,
    templateHeight: template.height,
  });
  const file = path.join(OUT, `plate-${arm.key}.png`);
  await writeFile(file, result.bytes);
  await writeFile(path.join(OUT, `prompt-${arm.key}.txt`), arm.prompt);
  console.log(
    `${arm.key.padEnd(22)} ${Math.round((Date.now() - started) / 1000)}s · `
    + `${result.width}x${result.height} · ${path.resolve(file)}`,
  );
}

console.log("\nHis eye decides. Same design, same engine, same sheet — only the words moved.");
process.exit(0);
