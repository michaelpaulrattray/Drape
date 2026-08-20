/**
 * A CUT UNDER THE FLOOR IS ENLARGED, NOT ADMITTED — the floor court's verdict
 * (opus-903, ruled fable-1210 §1).
 *
 * # What was measured, and it is this road's first evidence for a number that
 * # had governed it since it was written
 *
 * `INK_DESIGN_MIN_EDGE = 256` refuses a design below 256 px on its shortest
 * side. Its whole justification was an asserted sentence in its own docblock —
 * *"a reference smaller than this cannot describe a tattoo — it can only
 * describe that there was one"* — and no frame had ever tested it.
 *
 * Six paid renders, one design, one placement, one variable: the pixel
 * dimensions of the reference the engine receives. `tattooed skin` on each
 * delivered frame, counted by the delivery mint rather than by eye:
 *
 * ```
 *   rung   reference     delivered ink        % of frame
 *   A      1200x1697     73,820 / 63,712 px   4.69 / 4.05
 *   B       183x259      17,615 / 15,688 px   1.12 / 1.00     <- S1's real arm edge
 *   C       732x1036     26,804 / 37,066 px   1.70 / 2.36     <- B, upscaled
 * ```
 *
 * **A and B do not overlap — A's smallest is 3.6× B's largest.** And at the
 * frames (`output/court-floor/frames/`, opened at full size): B's renders carry
 * a sparse strand with **no dinosaur in it**, while C's carry the skeleton
 * again — head, ribs, legs, the figure below. The asserted sentence was RIGHT,
 * and the rescue is real.
 *
 * # ⚠ NEVER A DIFFUSION UPSCALER, AND THE REASON IS NOT QUALITY
 *
 * `fal-ai/clarity-upscaler` and its family hallucinate plausible detail. On any
 * other subject that is a feature. **On a customer's own tattoo artwork it is a
 * fidelity violation wearing an upscaler's name** — it invents strokes they did
 * not draw, and this road would then be measuring *"does inventing detail
 * rescue a small reference"*, which is a road this product may not take
 * REGARDLESS of how the frame looks (fable-1209 §1, verbatim).
 *
 * `fal-ai/aura-sr` is a GAN: no prompt, no diffusion, no invention. `esrgan` is
 * the declared fallback, same class, and its use is logged rather than quiet.
 * **A sharp resize is not an option either** — the fidelity law names the
 * dedicated tool, and a lanczos in a fidelity court was forbidden by name.
 *
 * # ⚠ AND THE MODEL RETURNS THREE CHANNELS — THE SHAPE IS OURS
 * # (found opus-908 §1, the call opus-909 §1, ruled fable-1215 §1)
 *
 * `aura-sr` handed a real cut — 41.1% of it fully transparent — answered
 * `channels=3`, `hasAlpha=false`, 0.0% transparent. So what it gives back is
 * detail, never geometry: the cutout's alpha is re-attached from the picture
 * the caller handed in, scaled to whatever size came back. A segmenter and a
 * mask decided where this design stops and an upscaler has no standing to
 * revise it. The arithmetic is at the bottom of {@link upscaleToFloor}; the
 * arms are in the test file, including the transparent fixture the floor
 * court's opaque-only ladder did not have.
 *
 * # NO TARGET NUMBER IS INVENTED (fable-1210 §1b)
 *
 * There is exactly one constant on this road and it is still `INK_DESIGN_MIN_
 * EDGE`. 4× is the MODEL'S OWN RATIO, not a bar anybody chose: the loop asks
 * the upscaler for another pass only while the floor is unmet, and stops the
 * moment it is. A "target" would be a second constant with a story instead of a
 * court, which is what 256 already was.
 *
 * # WHAT IT SPENDS
 *
 * One call per pass on the SHARED COURTESY POOL (`FAL_CONCURRENCY`), like the
 * cutter's own reads — no new declared path, so `assertFalBudget`'s ceiling
 * arithmetic is untouched (fable-1210 §1a). It is bought only for a cut that
 * would otherwise be REFUSED, so it never costs anything on a picture the road
 * already handles.
 */
import sharp from "sharp";

import { runFalImageJob } from "../providers/falTransport";
import { createModuleLogger } from "../logging/logger";
import { INK_DESIGN_MIN_EDGE } from "./inkUploadDoor";

const log = createModuleLogger("castingV2/inkReferenceUpscale");

/** The faithful model. No prompt, no diffusion, no invented strokes. */
export const INK_UPSCALE_MODEL = "fal-ai/aura-sr";
/** Declared fallback, same class. Its use is LOGGED, never silent. */
export const INK_UPSCALE_FALLBACK = "fal-ai/esrgan";

/**
 * How many passes may be bought before the road gives up and refuses as it does
 * today.
 *
 * Not a target size — a spend bound. At the model's own 4× a single pass takes
 * the smallest cut this road can produce well past the floor; two is the honest
 * ceiling for a picture that arrives strange, and a third would be paying to
 * enlarge something that is not getting bigger.
 */
export const INK_UPSCALE_MAX_PASSES = 2;

export type InkUpscaleResult = {
  bytes: Buffer;
  width: number;
  height: number;
  /** Which endpoint answered, so the fallback is never invisible. */
  model: string;
  passes: number;
};

/**
 * Enlarge a cut until it clears the floor, or answer null and let the caller
 * refuse exactly as it does today.
 *
 * Null is the ONLY failure signal and it means *this cut is still too small* —
 * a refused call, an unanswered one, and an upscale that did not grow are the
 * same fact to the caller, which is that the picture cannot ride. The reasons
 * are separated in the log rather than in the return type, because a caller
 * that behaves differently per reason is a caller with three ways to be wrong.
 */
export async function upscaleToFloor(input: {
  bytes: Buffer;
  width: number;
  height: number;
  apiKey: string;
  about: Record<string, unknown>;
  /** Injected so the suite drives this directly rather than through a model. */
  run?: typeof runFalImageJob;
}): Promise<InkUpscaleResult | null> {
  const run = input.run ?? runFalImageJob;
  let bytes = input.bytes;
  let width = input.width;
  let height = input.height;
  let model = INK_UPSCALE_MODEL;
  let passes = 0;

  while (Math.min(width, height) < INK_DESIGN_MIN_EDGE && passes < INK_UPSCALE_MAX_PASSES) {
    const attempt = async (endpoint: string): Promise<Buffer | null> => {
      try {
        const job = await run({
          apiKey: input.apiKey,
          endpoint,
          /* Sent as a data URI, so no object is created on anybody's CDN — the
             same posture every image job in this codebase takes. */
          body: { image_url: `data:image/png;base64,${bytes.toString("base64")}` },
          timeoutMs: 300_000,
          pollIntervalMs: 3_000,
        });
        return job.bytes.byteLength > 0 ? job.bytes : null;
      } catch (error) {
        log.warn(
          { ...input.about, endpoint, err: error instanceof Error ? error.message : String(error) },
          "[inkReferenceUpscale] the upscaler refused — the cut stays the size it is",
        );
        return null;
      }
    };

    let grown = await attempt(model);
    if (grown === null && model === INK_UPSCALE_MODEL) {
      model = INK_UPSCALE_FALLBACK;
      log.warn(
        { ...input.about, from: INK_UPSCALE_MODEL, to: INK_UPSCALE_FALLBACK },
        "[inkReferenceUpscale] falling back to the declared second model — said rather than quiet",
      );
      grown = await attempt(model);
    }
    if (grown === null) return null;

    const meta = await sharp(grown).metadata();
    const grownWidth = meta.width ?? 0;
    const grownHeight = meta.height ?? 0;
    /*
      A PASS THAT DID NOT GROW IS A PASS THAT WILL NEVER GROW, and buying a
      second one is paying twice for the same answer. `<=` rather than `<`: an
      upscaler that returns the picture unchanged is the shape a "successful"
      no-op takes.
    */
    if (Math.min(grownWidth, grownHeight) <= Math.min(width, height)) {
      log.warn(
        { ...input.about, was: `${width}x${height}`, came: `${grownWidth}x${grownHeight}`, model },
        "[inkReferenceUpscale] the upscaler answered no larger than it was asked — refusing rather than paying again",
      );
      return null;
    }
    bytes = grown;
    width = grownWidth;
    height = grownHeight;
    passes += 1;
  }

  if (Math.min(width, height) < INK_DESIGN_MIN_EDGE) {
    log.info(
      { ...input.about, size: `${width}x${height}`, floor: INK_DESIGN_MIN_EDGE, passes },
      "[inkReferenceUpscale] still under the floor after every pass this road will buy — refusing as before",
    );
    return null;
  }
  /*
    ---- AND THE SHAPE IS OURS, NOT THE MODEL'S (ruled fable-1215 §1) ----

    Measured, not assumed: `fal-ai/aura-sr` answers THREE CHANNELS. Handed a
    real cut — `S1-upperArm-native-183x353.png`, 41.1% of it fully transparent —
    it returned 732x1412 with `hasAlpha=false` and not one transparent pixel
    (opus-908 §1, the call itself opus-909 §1). The first ladder could not have
    seen this: all three of its rungs were the design ARTWORK, opaque, 0.0%
    transparent — one property shared by every fixture in a family is how a
    court measures everything except the thing that matters.

    So the enlarged cut is assembled rather than accepted: the model contributes
    RGB DETAIL, and the cutout's shape comes from the alpha WE measured and cut.
    That is the fidelity law pointed at geometry — a segmenter and a mask
    decided where this design stops, and an upscaler has no standing to have an
    opinion about it.

    # It makes the fallback question moot by construction

    `esrgan` has never been called on this road and nobody knows what it does
    with a fourth channel. It does not matter: whatever RGB any model in this
    class returns, OUR alpha rides. A behaviour that cannot differ between two
    endpoints needs no measurement of the second.

    # Why the ORIGINAL's alpha and not the previous pass's

    One derivation, from the picture the caller handed in, applied once at the
    end. Re-attaching between passes would mean the second pass's input carried
    an alpha the model ignores anyway, and would make the final shape a
    resample of a resample instead of a single scaling of the thing we cut.
  */
  const alpha = await sharp(input.bytes)
    .ensureAlpha()
    .extractChannel(3)
    /* `fill`, because the model's answer is the same aspect scaled and the
       alpha must land on the same pixels the RGB did. */
    .resize({ width, height, fit: "fill" })
    .raw()
    .toBuffer();
  const rgb = await sharp(bytes).removeAlpha().raw().toBuffer();
  const composed = Buffer.alloc(width * height * 4);
  for (let at = 0; at < width * height; at += 1) {
    composed[at * 4] = rgb[at * 3];
    composed[at * 4 + 1] = rgb[at * 3 + 1];
    composed[at * 4 + 2] = rgb[at * 3 + 2];
    composed[at * 4 + 3] = alpha[at];
  }
  const withOurShape = await sharp(composed, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
  return { bytes: withOurShape, width, height, model, passes };
}
