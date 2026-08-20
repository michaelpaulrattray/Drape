/**
 * THE DELIVERED TATTOO'S GEOMETRY — clause (a)'s pure half (design report
 * opus-886 §3, measured opus-887 §2, countersigned fable-1193 §3 / fable-1194
 * §2). `inkDeliveryMint.ts` is the half that spends money and writes rows.
 *
 * The split is `inkReferenceCrop` / `inkReferenceCutter`'s, and that road's
 * pieces are IMPORTED rather than restated: `extentOf` and `cutOutPixels` are
 * the same arithmetic on a different picture, and a second copy of them is the
 * second list that drifts (working law 4). Its FLOOR is deliberately not
 * imported — see below, because that mistake cost a frame.
 *
 * # WHAT THIS IS FOR, in the one sentence that survived three renders
 *
 * A carried tattoo used to ride as the customer's ARTWORK — 1200x1697 of design
 * on transparency, no body in it — under the sentence *"keep it exactly as it
 * is, in the same place and at the same size"*, on a render anchored to the
 * MASTER, which is a photograph with no tattoo on it anywhere. **There is no
 * size in that picture and no size in that frame.** Three renders, three
 * shirts; three clauses were said to that lane and none of them moved it.
 *
 * The delivered frame is the one picture that HOLDS the answer, so it becomes
 * the carrier.
 *
 * # ⚠ THE CUT IS THE FILLED REGION, NOT THE INK'S STROKES (ruled fable-1194 §2b)
 *
 * `tattooed skin` returns a filled region — the inked patch of him, not the
 * linework — and that is RIGHT rather than a compromise to be improved later.
 * What the region carries that strokes would not:
 *
 *   his own skin      the tone the ink sits in, which is the fact the fresh
 *                     lane's reference cannot supply and must disclaim
 *   the scale         how big the design is ON HIM, which is the number three
 *                     sentences failed to state
 *   the boundary      on `486` the COLLAR'S OWN EDGE is cut out of the bottom
 *                     of the crop. The edge is IN the picture
 *
 * A stroke matte would carry none of those, which is the state that already
 * fails. **Do not "improve" this into a stroke cutout.**
 *
 * # AND NO FRACTION CEILING IS CLAIMED HERE
 *
 * The three delivered frames measured 1.74%, 3.28% and 0.17% of their frames,
 * and every mask was opened at full size: the ink and not the man, at both
 * scales. It would be easy to write a ceiling from those numbers — *refuse a
 * mask over N%* — and it would be a bar nobody courted, on a population of
 * three. The only refusal here is the one that needs no calibration at all: a
 * mask covering the WHOLE frame is not a tattoo, it is the picture.
 *
 *
 * # ⚠ THE UPLOAD DOOR'S FLOOR IS NOT THIS ROAD'S FLOOR, and it took a paid
 * # frame to find out
 *
 * The first version of this file imported `cropClearsMinimumEdge` — the
 * shortest edge clears `INK_DESIGN_MIN_EDGE` (256 px) — and cited law 4 for it:
 * one number, one owner, no second bar to drift. **It was the wrong number to
 * derive from, and it refused a real tattoo on the very first frame it met**
 * (variant `492`, live, `tooSmall` at 26,867 mask pixels).
 *
 * The two populations are not the same thing wearing one name:
 *
 * ```
 *   the upload door   A PICTURE A CUSTOMER SUPPLIES, which an engine will draw
 *                     a tattoo FROM. Below 256 px there is not enough artwork
 *                     to reproduce, and the floor is a quality bar.
 *   this road         A STATEMENT OF EXTENT. The crop is as big as the tattoo
 *                     IS on her, and a small tattoo is small BY DEFINITION —
 *                     its size is the fact being carried, not a defect in it.
 * ```
 *
 * The measurement was already on the record and predates this build, which is
 * what makes correcting the bar legitimate rather than optional stopping from
 * the court's own data (opus-887 §2, boxes read before a line was written):
 *
 * ```
 *   variant   box        shortest edge   the 256 px floor
 *   484       201x194        194         REFUSED
 *   486       281x268        268         passed
 *   491        97x98          98         REFUSED   ← the court's cleanest frame
 * ```
 *
 * **Two of three, and the one it called too small is the frame the founder is
 * being shown as the best tattoo this court has produced.** A floor that turns
 * away the good answer is not a floor.
 *
 * So there is no edge floor here. The refusals left are the ones that need no
 * calibration: nothing found, the whole picture, and our own cut failing. If a
 * floor is ever wanted it needs its own measurement on THIS population — what
 * a crop is too small to CARRY, which nobody has asked yet.
 *
 * `same-pixels-or-measuring-the-mask` and the floor scar both apply: a
 * percentage hid a whole object once already on this road (`tattoo` read 0.0%
 * and cut out to one complete star), so this file counts PIXELS.
 */
import { cutOutPixels, extentOf, type CropBox } from "./inkReferenceCrop";
import type { Mask } from "./maskedComposite";

export type InkDeliveryCutRefusal =
  /** The reader found no inked skin on the delivered frame. */
  | "noInk"
  /** The region is the entire picture — that is the man, not his tattoo. */
  | "wholeFrame"
/*
   ⚠ AND THERE IS NO `tooSmall`. IT WAS HERE, IT REFUSED A REAL TATTOO ON THE
   FIRST FRAME IT MET, AND IT IS GONE — see the header.
*/
  /**
   * ⚠ THE CUT DID NOT CUT, read off the OUTPUT rather than off the mask.
   *
   * `composite({ blend: "dest-in" })` with a raw greyscale alpha returns the
   * WHOLE FRAME, silently, while every number beside it stays correct — twice
   * on this road now, and the second time it produced an uncut photograph of a
   * man that a design decision was nearly taken from.
   *
   * So the kept count is COUNTED IN THE PRODUCED BYTES and compared against the
   * mask that was supposed to produce them. Counting the mask twice would be a
   * checker that cannot fail (working law 2); counting the output is a checker
   * that goes off the day somebody replaces the loop with a clever call.
   */
  | "cutDidNotCut";

export type InkDeliveryCut = {
  /** Where the tattoo sat on the frame it was delivered in. */
  readonly box: CropBox;
  /** The frame as RGBA with the alpha written — the caller extracts to `box`. */
  readonly rgba: Buffer;
  /** How many pixels the region held. A COUNT, never a coverage. */
  readonly maskPixels: number;
  /** How many pixels the produced bytes actually keep. See `cutDidNotCut`. */
  readonly keptPixels: number;
};

export type InkDeliveryCutResult =
  | { ok: true; cut: InkDeliveryCut }
  | { ok: false; refusal: InkDeliveryCutRefusal; maskPixels: number };

/**
 * HOW MANY PIXELS THESE BYTES ACTUALLY KEEP — the independent count.
 *
 * Deliberately not derived from the mask. The whole point is that it is a
 * reading of the thing produced, so a cut that quietly kept everything reports
 * everything.
 *
 * `> 127` matches `cutOutPixels`' own threshold, so the two agree about what
 * "kept" means without either being computed from the other.
 */
export function countKeptPixels(input: {
  rgba: Buffer;
  width: number;
  height: number;
}): number {
  const { rgba, width, height } = input;
  if (rgba.length !== width * height * 4) {
    throw new Error(`picture is ${rgba.length} bytes for ${width}x${height} RGBA — refusing rather than indexing into it`);
  }
  let kept = 0;
  for (let at = 0; at < width * height; at += 1) {
    if (rgba[at * 4 + 3]! > 127) kept += 1;
  }
  return kept;
}

/**
 * CUT THE DELIVERED TATTOO OUT OF THE FRAME THAT DELIVERED IT, or say why not.
 *
 * Returns a refusal rather than throwing for one refusal only — a space
 * mismatch throws, because a mask that is not in its picture's space is OUR
 * error and never a fact about the render (`maskedRefine`'s house rule, and
 * `cutOutPixels` throws for the same reason one call along).
 *
 * Every other outcome is a fact about the frame, and every one of them costs
 * the customer nothing: this runs after a delivered, paid render, and the worst
 * available answer is that the next carry rides the artwork the way it does
 * today.
 */
export function cutDeliveredInk(input: {
  /** The delivered frame as RGBA, one row after another. */
  rgba: Buffer;
  width: number;
  height: number;
  /** `tattooed skin`, read on that same frame. */
  mask: Mask;
  /**
   * WHO WRITES THE ALPHA — a declared seam, and it exists for exactly one
   * reason: to make `cutDidNotCut` REACHABLE.
   *
   * A guard whose branch nothing can drive is a guard nobody has tested (law
   * 3), and this one is not hypothetical — it has fired twice on this road, as
   * `composite({ blend: "dest-in" })` with a raw greyscale alpha returning the
   * whole photograph while every number beside it stayed correct. The double
   * that drives it MODELS THAT FAILURE (it returns the frame unchanged) rather
   * than inventing a tidier one.
   *
   * Absent in production, where it is {@link cutOutPixels} and nothing else.
   */
  cut?: typeof cutOutPixels;
}): InkDeliveryCutResult {
  const { rgba, width, height, mask } = input;
  const { pixels: maskPixels, box } = extentOf(mask);
  if (box === null) return { ok: false, refusal: "noInk", maskPixels };
  if (maskPixels >= width * height) {
    return { ok: false, refusal: "wholeFrame", maskPixels };
  }
  /*
    NO EDGE FLOOR — see the header. `INK_DESIGN_MIN_EDGE` is the UPLOAD door's
    bar and it refused two of the three frames this build was measured on,
    including the court's cleanest.
  */

  const cut = (input.cut ?? cutOutPixels)({ rgba, width, height, mask });
  const keptPixels = countKeptPixels({ rgba: cut, width, height });
  /*
    THE ARM, ON THE PRODUCED BYTES. `>=` rather than `===` so a cut that kept
    the frame reports it whatever rounding a future threshold introduces, and
    the two counts are compared as well: a cut keeping a DIFFERENT number of
    pixels from the mask it was cut with is the same class of quiet failure
    arriving from the other direction.
  */
  if (keptPixels >= width * height || keptPixels !== maskPixels) {
    return { ok: false, refusal: "cutDidNotCut", maskPixels };
  }
  return { ok: true, cut: { box, rgba: cut, maskPixels, keptPixels } };
}
