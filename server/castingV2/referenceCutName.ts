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
import { boundForJudge } from "./judgeFrame";
import type { Mask } from "./maskedComposite";
import type { TextEngine } from "../providers/types";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/referenceCutName");

/**
 * THE GREY EVERYTHING-ELSE BECOMES.
 *
 * Mid grey, so neither a dark nor a light garment is the only thing with
 * contrast against it. ~~The court's own backdrop.~~
 *
 * ⚠ **IT IS NOT THE COURT'S BACKDROP — read at the harness, 2026-10-31 (#2875,
 * found by #2873's class sweep).** `relay-14spot/name.mjs`'s `cutFor` paints
 * `150, 150, 150`. Nothing here is CHANGED on that reading, because the
 * difference between two mid greys is not a thing to guess at on a text
 * provider's behalf — the measurement is #2875's, and it has two other
 * differences to settle in the same act. What is corrected is the sentence,
 * which told a reader this value carried the court's authority.
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
 * ⚠ ~~**The frame is NOT cropped to the cut, and that is faithfulness rather than
 * laziness.** The court's measurement was taken on the piece in its own frame;
 * cropping would change the scale cues the reader sees, and cropping is
 * unmeasured. A slice that wants to crop measures it first.~~
 *
 * ⚠ **THE FRAME IS STILL NOT CROPPED, AND THE SENTENCE ABOVE HAD THE COURT
 * BACKWARDS — read at the harness, 2026-10-31 (#2875, found by #2873's class
 * sweep).** `relay-14spot/name.mjs`'s `cutFor` crops to the mask's bounding box
 * padded by `max(w, h) * 0.08 + 4` px and enlarges the result to a 384-px longer
 * side when it is under, so **the 8-of-8 naming figure was measured on a tight
 * crop** — and it is the UNCROPPED frame that is unmeasured. The reasoning is
 * sound and runs the other way round: cropping does change the scale cues, and
 * the whole-frame road is the one changing them against the measurement.
 * `boundForJudge` shrinks only above a 2576-px side, so a flat-lay goes to the
 * reader at full size with a belt in a field of grey. **Nothing is changed here
 * on that reading** — which road names better is a measurement and it is #2875's,
 * with the pad, the floor and the grey settled in one act. What is corrected is
 * the claim about the court.
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
  /*
    ⚠ BOUNDED BEFORE IT IS POSTED (#1413's class, and the guard that caught
    this one is `readerFrameBound.test.ts`).

    A customer's attachment is accepted at up to 8 MB by the attach door, and
    this piece keeps the attachment's own dimensions on purpose — the frame is
    deliberately NOT cropped to the cut, because the court's measurement was
    taken on the piece in its own frame. So without the bound, naming one tap
    posts a multi-megabyte photograph of a person to a text provider, once per
    tap. `boundForJudge` never enlarges and never throws, so a small picture
    goes as it is.
  */
  const bound = await boundForJudge(piece);
  try {
    const answer = await input.engine.complete({
      system: CUT_NAME_PROMPT,
      user: "What is this piece?",
      images: [bound.image],
      about: "reference.cutName",
      timeoutMs: CUT_NAME_TIMEOUT_MS,
      retries: 0,
    });
    /*
      ⚠ A REPLY CUT OFF AT THE CEILING IS NOT A SHORTER NAME (#1272's class).

      This read's answer is prose rather than JSON, which makes the failure
      QUIETER here than anywhere else that signal is read: a truncated name
      does not fail a parse, it comes back as `leather jack` — a plausible bare
      noun that would pass `isBareNoun`, reach the chip, and tell the customer
      their jacket is something else. So the flag is read before the text is,
      and a cut-off reply shows NO name, which is the honest answer and costs
      nothing.
    */
    if (answer?.truncated === true) {
      log.warn({}, "the cut's name came back cut off at the ceiling — no name is shown");
      return null;
    }
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
