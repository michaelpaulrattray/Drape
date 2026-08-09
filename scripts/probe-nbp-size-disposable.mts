/**
 * DOES NANO BANANA PRO GIVE BACK THE SIZE IT WAS ASKED FOR?
 *
 * The engine arm the founder ordered died in `unionMasks` on all six rounds —
 * the harvest's masks disagreed about size, which happens when the painted
 * frame is not the master's shape. GPT Image 2 honours `image_size` (the
 * masked engine even refuses a non-multiple-of-16 before dispatch). Nobody has
 * ever asked NBP the same question through this path.
 *
 * One paint, and the numbers say it.
 */
import "dotenv/config";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

import { createFalMaskedEditEngine } from "../server/providers/falImages";

const master = readFileSync("output/marks-court/MASTER-run15.png");
const meta = await sharp(master).metadata();
const W = meta.width!;
const H = meta.height!;
console.log(`master ${W}x${H}`);

const engine = createFalMaskedEditEngine({
  apiKey: process.env.FAL_KEY!,
  model: "fal-ai/nano-banana-pro/edit",
});
console.log(`engine ${engine.id}`);

const painted = await engine.edit({
  prompt: readFileSync("output/marks-court/run15-step1-prompt.txt", "utf8").trim(),
  references: [{ bytes: master, contentType: "image/png" }],
  width: W,
  height: H,
});
writeFileSync("output/masked/nbp-probe.png", painted.bytes);
const back = await sharp(painted.bytes).metadata();
console.log(`asked for ${W}x${H}, got ${back.width}x${back.height} — `
  + `${back.width === W && back.height === H ? "HONOURED" : "*** IGNORED, and this is why the harvest threw ***"}`);
