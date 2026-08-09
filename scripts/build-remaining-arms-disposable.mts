/**
 * TWO SETUPS THE SHIFT STILL OWES.
 *
 * 1. `cheekbones` — the last SURFACE member the masked path can actually
 *    reach. `skinTone` and `skinCharacter` are both `allSkin`, which
 *    `maskedRefine.ts:776` refuses outright and says why, so the caption
 *    rule's live surface is marks (measured) plus this one.
 *
 * 2. A master at **848x1264** for the engine comparison. Nano Banana Pro
 *    ignores `image_size` and hands back its own tier — measured, one paint:
 *    asked 1024x1536, got 848x1264, which is the exact number
 *    `refineService.ts:1833` documents as "an engine's own cap, and nothing
 *    the composite can use". So the harvest threw on all six rounds.
 *
 *    Rather than upscale a paint — which would resample the very
 *    high-frequency, low-amplitude signal being measured — both engines are
 *    measured at ONE size that NBP will actually return. 848 and 1264 are
 *    both multiples of 16, so the masked engine's own pre-dispatch check is
 *    satisfied.
 */
import "dotenv/config";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

import { composeRenderPrompt } from "../server/castingV2/refineDelta";
import { EDIT_PROSE } from "../server/castingV2/refineService";

/* ---- 1. the cheekbones arms ---- */
const ASK = "higher, more defined cheekbones";
const CAPTION = "Higher, more sculpted cheekbones with a clear soft shadow beneath them";
const without = composeRenderPrompt({ free: { cheekbones: ASK } }, EDIT_PROSE, {});
const withCaption = without.full.replace(ASK, `${ASK} — rendered exactly as this: ${CAPTION}`);
if (withCaption === without.full) throw new Error("the ask was not found in the composed prompt");

writeFileSync("output/marks-court/cheek-caption-prompt.txt", withCaption);
writeFileSync("output/marks-court/cheek-nocaption-prompt.txt", without.full);
console.log(withCaption.replace(` — rendered exactly as this: ${CAPTION}`, "") === without.full
  ? "cheekbones: the two prompts differ by the caption interpolation and NOTHING else"
  : "cheekbones: *** NOT A CONTROLLED ARM ***");

/* ---- 2. the matched-size master ---- */
const master = readFileSync("output/marks-court/MASTER-run15.png");
const resized = await sharp(master).resize(848, 1264, { fit: "fill" }).png().toBuffer();
writeFileSync("output/marks-court/MASTER-run15-848.png", resized);
const meta = await sharp(resized).metadata();
console.log(`matched master: ${meta.width}x${meta.height} — both multiples of 16: `
  + `${meta.width! % 16 === 0 && meta.height! % 16 === 0}`);
