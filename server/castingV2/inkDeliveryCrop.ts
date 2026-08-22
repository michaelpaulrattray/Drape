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
 *
 * # ⚠ 2026-08-21 — THE WORD CHANGED, AND SO DID THE SHAPE OF THE CUT
 * # (found opus-944, courted opus-945, ruled fable-1273 §2 / fable-1284 §2)
 *
 * Everything above is about the ARITHMETIC and still stands. What was wrong was
 * the QUESTION, and it was wrong in a way no amount of careful cutting could
 * fix. This road asked `tattooed skin` of the whole delivered frame. On a chest
 * piece made of SEVEN SEPARATE MARKS — "19", "70", crossed daggers, two
 * swallows, two roses — that came back with **one swallow**, and that one
 * swallow was the crop every later carry rode:
 *
 * ```
 *   A  "tattooed skin"   13,554 px   210x243   1 of 7 marks   <- what we asked
 *   B  "upper chest"    221,363 px   674x419   7 of 7 marks   <- the slot's own
 * ```
 *
 * Same frame, same reader, same minute; one variable. The control reproduced
 * three times — the stored row and two live calls, agreeing within 9 px — so
 * the reader was answering its question correctly and stably. **`tattooed skin`
 * has one answer on a scattered piece and it is one patch.** The upload door
 * learned this first (`CASTING_INK_REGION_CROP_SCOPE`, where the same word
 * returned 10,779 px of a thirty-piece body); this is that finding arriving on
 * the delivery road.
 *
 * So: the mint asks the SLOT'S OWN `readerWord`, and what is stored is **a
 * RECTANGLE of the surface, with no alpha at all.**
 *
 * # WHY THE ALPHA WENT, since the header above spends four paragraphs on it
 *
 * Not because a masked cutout was wrong — because the only word that can
 * produce that alpha is the word this court just convicted. Keeping it would
 * rebuild the disease inside the fix. And a rectangle is what this reference
 * always wanted to be: `inkDeliveredCarrySentence` already tells the engine
 * *"Keep his own skin: its pores, its texture, its lighting"*, so the
 * surrounding skin is the FACT being carried, not contamination in it. The
 * zero-RGB rule that governs the other road does not reach here — those bytes
 * are a stranger's photograph, and these are our own render of his own cast.
 *
 * **The `cutDidNotCut` guard did not die with the alpha.** It moved to where
 * the bytes now are: the mint extracts the rectangle and then COUNTS THE
 * PRODUCED BYTES, exactly as before. A guard that stopped being reachable when
 * the road under it moved is the failure working law 7's second half names, and
 * this one was pointed at a real defect that has landed twice.
 */
import { extentOf, type CropBox } from "./inkReferenceCrop";
import { INK_REGION } from "./inkReferenceCrop";
import {
  inkPlacementEntry,
  isInkPlacement,
} from "../../shared/inkPlacementVocabulary";
import { INK_SLOT_PREFIX, inkPlacementOfSlot, type Instance } from "./referenceSlots";
import type { Mask } from "./maskedComposite";

/**
 * HOW FAR PAST THE SURFACE THE CROP REACHES — a fraction of the region's own
 * extent, so it scales with the piece instead of with the frame.
 *
 * # Why a pad at all, and why a FIXED one
 *
 * `upper chest` is a SURFACE and a tattoo on it can run off the bottom. On the
 * court's frame it does: the roses' leaf tips hang below the region, and at the
 * frames you can see them un-tinted under the mask (opus-945 §3).
 *
 * ```
 *   the ink's own bbox    688x440 at (180,900)
 *   the region's bbox     674x419 at (185,885)
 *   ink outside it        8.3% / 8.0% at two thresholds
 *   worst single side     36 px at the bottom — 8.6% of the region's height
 * ```
 *
 * The obvious instrument — walk the ink contiguous with in-region ink and
 * expand to hold it — **cannot be built from what we have**, and that is worth
 * writing down rather than rediscovering: the only ink word available is
 * `tattooed skin`, whose mask on this very specimen holds NO ROSES AT ALL, so a
 * contiguity walk over it finds nothing crossing the boundary on the one frame
 * that motivates the step. The darkness threshold that measured the 8% is a
 * court scorer reading a grey median, not a production instrument.
 *
 * So this is the boring asymmetric answer, and the asymmetry is the argument:
 * **over-inclusion costs skin the carry sentence already claims; under-inclusion
 * is the disease this whole fix is about, at a twentieth of the scale.** 15% is
 * ~1.75x the worst measured shortfall.
 *
 * ⚠ **PROVENANCE: n = 1.** One placement, one frame, one piece. It is a
 * generous guess disciplined by a single measurement, not a courted number, and
 * it should be re-read the first time a padded crop looks wrong. The named risk
 * is the NECK, where a generous pad reaches toward the jaw — the regression arm
 * for that is in the test file rather than in this paragraph.
 */
export const INK_DELIVERY_REGION_PAD = 0.15;

/**
 * WHAT TO ASK, AND WHICH SIDE TO ASK IT OF — one parse, three answers.
 *
 * ⚠ **This used to be `deliveryRegionWord` alone, and its own comment named the
 * defect it became** (found by the founder's eyes on his live cybersigilism
 * render, measured fable-1386 §2, designed opus-1037, countersigned fable-1391).
 * It said:
 *
 * > *"`ink:upperArm@left` — the side is an instance of the surface and the
 * > segmenter is asked about the surface. Laterality is not this question."*
 *
 * That sentence is TRUE OF THE QUESTION and was false of the ANSWER. Both sides
 * of a pair asked the identical word of the identical whole frame, so the mint
 * filed back whichever arm the segmenter felt like naming. On his frame that was
 * the BARE one: the crop that is the tattoo's own document going forward was a
 * picture of blank skin, and a transform would have carried it as the source.
 * A matched pair — nobody has worn one yet — would have had one crop filed twice.
 *
 * So the word and the side now come out of ONE parse, for the same reason the
 * word and the row already did: two derivations of one slot are two chances to
 * describe different things.
 *
 * `declaredTwoSided` is **the vocabulary's own measured field and never this
 * module's opinion** — `InkPlacementEntry.sides`. The reader's closed bilateral
 * list is five face words (`ear · earring · eyebrows · eyes · horns`) and
 * `upper arm` is not among them, so without this flag `regionSides` answers
 * `null` and the fix would be inert. It is the same shape as the open lane's
 * D1 wire: a classification that an instrument already made, arriving at the
 * reader, rather than a caller's guess.
 */
export type InkDeliveryRegionAsk = {
  /**
   * The slot's own `readerWord` — *the word a segmenter is asked, measured to
   * cut this surface* — and `tattooed skin` only where the vocabulary has no
   * entry, which is the OPEN lane: a customer's own word for a surface nobody
   * has measured has no reader word to offer, so that lane keeps exactly the
   * behaviour it has today rather than being handed a word we invented for it.
   */
  readonly word: string;
  /** Her own side, or `null` for a surface there is one of. */
  readonly side: Instance | null;
  /** Whether the reader must be TOLD this surface has two sides. */
  readonly declaredTwoSided: boolean;
};

export function deliveryRegionAsk(slot: string): InkDeliveryRegionAsk {
  /* `inkPlacementOfSlot` is the one owner of this key's shape — parsing the
     `@` again here is the parallel copy that drifts (law 4). It answers `null`
     for a key that is not an ink slot at all, and for one whose side is not an
     instance; both fall to the open lane's behaviour, which is what a slot this
     module cannot read has always got. */
  const parsed = inkPlacementOfSlot(slot.startsWith(INK_SLOT_PREFIX) ? slot : `${INK_SLOT_PREFIX}${slot}`);
  const placement = parsed?.placement ?? slot;
  if (!isInkPlacement(placement)) return { word: INK_REGION, side: null, declaredTwoSided: false };
  const entry = inkPlacementEntry(placement);
  return {
    word: entry.readerWord,
    /* A side on a `sides: "one"` surface is a key nobody should have built; the
       ask drops it rather than asking a one-of-it surface to be halved. */
    side: entry.sides === "perSide" ? parsed?.side ?? null : null,
    declaredTwoSided: entry.sides === "perSide",
  };
}

/**
 * The region's extent, opened up by {@link INK_DELIVERY_REGION_PAD} and clamped
 * to the frame it came from.
 *
 * Clamping rather than refusing: a piece high on a chest legitimately reaches
 * the top of a tight frame, and a crop that stops at the edge of the picture is
 * the honest answer there.
 */
export function padRegionBox(
  box: CropBox,
  frame: { width: number; height: number },
  pad: number = INK_DELIVERY_REGION_PAD,
): CropBox {
  const growX = Math.round(box.width * pad);
  const growY = Math.round(box.height * pad);
  const left = Math.max(0, box.left - growX);
  const top = Math.max(0, box.top - growY);
  return {
    left,
    top,
    width: Math.min(frame.width, box.left + box.width + growX) - left,
    height: Math.min(frame.height, box.top + box.height + growY) - top,
  };
}

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
  /**
   * The RECTANGLE to extract from the delivered frame — the region's own extent
   * opened up by {@link INK_DELIVERY_REGION_PAD}.
   *
   * ⚠ No `rgba` beside it any more, and its absence is the change: there is no
   * alpha to write, so there is no second copy of the frame to hand back. The
   * caller extracts this box out of the bytes it already has.
   */
  readonly box: CropBox;
  /** How many pixels the region held. A COUNT, never a coverage. */
  readonly maskPixels: number;
  /**
   * How many pixels the extracted rectangle will hold, which for an opaque
   * rectangle is its area.
   *
   * Still CHECKED against the produced bytes rather than trusted — the mint
   * counts what sharp actually gave it and raises `cutDidNotCut` on a
   * disagreement, which is where that guard lives now.
   */
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
}): InkDeliveryCutResult {
  const { width, height, mask } = input;
  const { pixels: maskPixels, box } = extentOf(mask);
  if (box === null) return { ok: false, refusal: "noInk", maskPixels };
  if (maskPixels >= width * height) {
    return { ok: false, refusal: "wholeFrame", maskPixels };
  }
  /*
    NO EDGE FLOOR — see the header. `INK_DESIGN_MIN_EDGE` is the UPLOAD door's
    bar and it refused two of the three frames this build was measured on,
    including the court's cleanest. It is needed even less now: a SURFACE's
    extent clears that bar by construction on every placement in the vocabulary.
  */
  const padded = padRegionBox(box, { width, height });
  /*
    A PAD THAT SWALLOWED THE PICTURE IS THE PICTURE, and the `wholeFrame`
    refusal above cannot see it: that one asks about the MASK, and this is about
    what the pad did to it. Reachable rather than theoretical — a region filling
    most of a tight frame pads out to all of it — and the answer is the same as
    it has always been, which is that a crop of the entire man carries nothing.
  */
  if (padded.width >= width && padded.height >= height) {
    return { ok: false, refusal: "wholeFrame", maskPixels };
  }
  return {
    ok: true,
    cut: { box: padded, maskPixels, keptPixels: padded.width * padded.height },
  };
}
