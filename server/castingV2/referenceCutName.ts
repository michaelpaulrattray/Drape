/**
 * WHAT IS THIS PIECE? — naming the tapped cut (#14 slice 3a's last read).
 *
 * The spotlight's shape is *split once to light, cut on every tap, then NAME
 * that cut* — and the naming is not a nicety. A SAM 3 point returns whatever
 * part is under the finger: the spotlight court's belt tap came back with the
 * belt's KEEPER alone, and the reader named it *"leather strap"*, which is
 * accurate for what was cut and wrong for "belt". **So the chip carries the
 * cut's own name rather than an assumed one, and the customer sees that name
 * before any money moves** — which is how §1's law-9 property survives the move
 * from markers to a spotlight: the noun arrives at tap time instead of attach
 * time, and it is still shown before the spend.
 *
 * # THE PROMPT IS THE COURT'S, COPIED AND NOT PARAPHRASED
 *
 * Measured in the spotlight court (2026-10-30) at **8 of 8 on every tap cut
 * that held the whole thing**, 7 of 7 on the split's garment-level pieces, and
 * 8 of 9 over all tap cuts — the one miss being the keeper above. 1.5–4.1 s and
 * 0.05–0.23¢ a call.
 *
 * ⚠ **A PARAPHRASE OF {@link CUT_NAME_PROMPT} INVALIDATES THAT MEASUREMENT.**
 * It is the house rule already written on `faceDiscovery.ts`'s own prompt, and
 * it binds here for the same reason: the number above is a fact about these
 * words. The examples in it (hat, glove, wristwatch) are deliberately NOT
 * things in any fixture, so they cannot be read as a list to choose from —
 * which is his 2026-10-28 word, *"nothing should be confined to a set list"*.
 *
 * # WHAT IT REFUSES, AND WHY A REFUSAL COSTS THE CUSTOMER NOTHING
 *
 * A name is kept only if it passes {@link isBareNoun} — the same contract every
 * other name on this road obeys, because a name here becomes a chip and later a
 * prompt. Anything else answers `null`, and `null` means *the chip shows no
 * name*, never a failure: the cut is still the customer's to use, and the words
 * road is untouched. A provider's bad minute must never make a tap look broken.
 */
import { isBareNoun } from "./faceDiscovery";
import type { Mask } from "./maskedComposite";
import type { TextEngine } from "../providers/types";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/referenceCutName");

/**
 * THE GREY EVERYTHING-ELSE BECOMES.
 *
 * Mid grey, so neither a dark nor a light garment is the only thing with
 * contrast against it. The court's own backdrop.
 */
export const CUT_NAME_BACKDROP = { r: 128, g: 128, b: 128 };

/** ⚠ COPIED FROM THE COURT, NOT PARAPHRASED — see the header. */
export const CUT_NAME_PROMPT =
  "This image is ONE piece cut out of a photograph; everything else was removed "
  + "and replaced with flat grey. What is the piece? Answer with a bare noun "
  + "phrase of one to three words (for example: hat, glove, wristwatch). Answer "
  + "with the name only.";

/** How long one naming read may take. 4.1 s was the court's slowest; this is ~4x it. */
export const CUT_NAME_TIMEOUT_MS = 16_000;

/**
 * THE PIECE ON FLAT GREY, PERSON-FREE IN THE BYTES.
 *
 * ⚠ **The pixels outside the cut are REPLACED, never covered.** That is the
 * `cutOutPixels` lesson (fable-1216 §1) and it is load-bearing here rather than
 * stylistic: what leaves this function goes to a third-party text provider, so
 * a mask laid over a photograph would be sending the whole photograph. Only the
 * cut's own pixels survive the composite.
 *
 * ⚠ **The frame is NOT cropped to the cut, and that is faithfulness rather than
 * laziness.** The court's measurement was taken on the piece in its own frame;
 * cropping would change the scale cues the reader sees, and cropping is
 * unmeasured. A slice that wants to crop measures it first.
 */
export async function pieceOnGrey(input: {
  frame: Buffer;
  mask: Mask;
}): Promise<{ bytes: Buffer; contentType: string }> {
  const sharp = (await import("sharp")).default;
  const { mask } = input;
  const raw = await sharp(input.frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = raw.info;
  if (width !== mask.width || height !== mask.height) {
    throw new Error(
      `the cut is ${mask.width}x${mask.height} but the picture is ${width}x${height} — refusing rather than resampling`,
    );
  }
  if (channels !== 4) throw new Error(`expected RGBA, got ${channels} channels`);
  const out = Buffer.from(raw.data);
  for (let at = 0; at < width * height; at += 1) {
    if (mask.data[at]! > 127) continue;
    out[at * 4] = CUT_NAME_BACKDROP.r;
    out[at * 4 + 1] = CUT_NAME_BACKDROP.g;
    out[at * 4 + 2] = CUT_NAME_BACKDROP.b;
    out[at * 4 + 3] = 255;
  }
  const bytes = await sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { bytes, contentType: "image/png" };
}

/**
 * NAME THE CUT, OR ANSWER `null` AND COST NOBODY ANYTHING.
 *
 * One text call. `null` for a refusal, an unparseable answer, a name that is
 * not a bare noun, or a provider that fell over — the fail-open property this
 * whole road holds.
 */
export async function nameTheCut(input: {
  frame: Buffer;
  mask: Mask;
  engine: TextEngine;
}): Promise<string | null> {
  let piece: { bytes: Buffer; contentType: string };
  try {
    piece = await pieceOnGrey({ frame: input.frame, mask: input.mask });
  } catch (cause) {
    log.warn({ cause: String(cause) }, "the cut could not be put on grey");
    return null;
  }
  try {
    const answer = await input.engine.complete({
      system: CUT_NAME_PROMPT,
      user: "What is this piece?",
      images: [piece],
      about: "reference.cutName",
      timeoutMs: CUT_NAME_TIMEOUT_MS,
      retries: 0,
    });
    const raw = typeof answer?.text === "string" ? answer.text : "";
    /* One line, no quotes, no trailing stop — the provider obeys the "name
       only" instruction loosely and this is the whole of the tidying. The
       BARENESS test is what actually decides, and it is not re-implemented
       here. */
    const name = raw.trim().split(/\r?\n/)[0]?.replace(/^["'`]+|["'`.!]+$/g, "").trim() ?? "";
    if (name.length === 0) return null;
    if (!isBareNoun(name)) {
      log.warn({ length: name.length }, "the cut's name was not a bare noun — no name is shown");
      return null;
    }
    return name;
  } catch (cause) {
    log.warn({ cause: String(cause) }, "the cut could not be named");
    return null;
  }
}
