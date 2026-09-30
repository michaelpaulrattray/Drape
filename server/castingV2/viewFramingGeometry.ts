/**
 * THE FRAMING BAND, MEASURED — #1612 part 1, his ruling of 2026-09-30.
 *
 * His question, verbatim: *"dont you think having really strict checkers is
 * unreliable?"* — and on the two changes put to him, *"i agree with you"*.
 *
 * # What this replaces, and why a rewording could never have done it
 *
 * The framing question has been a sentence handed to a vision model beside two
 * photographs, and a model reading a two-part prose rule answers whichever half
 * is easiest. Four measurements on his own casts in one afternoon:
 *
 *   #1582  a three-eyed cast REFUSED for not having two eyes        stable
 *   #1594  a close-up refused for neck ink the crop cannot reach    25/25
 *   #1595  "cannot compare" on a correct close-up                   1 in 5
 *   #1611  a close-up with the whole neck and shoulders in frame
 *          PASSED, which its own spec calls too loose               50/50
 *
 * Over-refusing and under-refusing the same view in the same sitting. Three
 * careful rewordings of one framing spec were courted on #1582 and **each one
 * broke a correct picture**. So the variable is not strictness: *"are the
 * shoulders in frame"*, *"is the lower edge of the face inside the frame"* and
 * *"is the whole body head-to-feet in frame"* are **geometry**, and this product
 * already owns the dedicated tool that answers geometry. That is the fidelity
 * law pointed at the checker: a segmentation model instead of a reading.
 *
 * # The whole method, in one paragraph
 *
 * Each view DECLARES its band as landmark predicates (`castViewPackage.ts`,
 * beside the view's own spec — one view, one place). A predicate names a
 * landmark and an edge of the frame, and asks one of three things: does this
 * landmark stay CLEAR of that edge, is it CUT BY that edge, or is it ABSENT
 * from the picture altogether. Each named landmark is segmented once, its mask
 * is tested against the edge band below, and the rules are ANDed. Same frame,
 * same answer — which is the property a coin never had.
 *
 * # Why no landmark here is a countable human feature, and that is load-bearing
 *
 * #1582 is the lesson: a band stated in human anatomy refuses a being that does
 * not have it, and the three-eyed cast was refused by a sentence that counted
 * eyes. **Every landmark in this file is a silhouette or a region every cast
 * has by construction** — the whole subject, the face, the hair, the shoulders.
 * None of them is counted; each is only ever asked WHERE IT REACHES. A creature
 * with three eyes, no chin, branches for hair or a cowl over its head is read
 * by exactly the same rule as a human, because the rule never asks what it is
 * made of. The reference's own landmarks are what a band would need if it ever
 * did — and the moment a predicate wants one, it belongs with the reference's
 * face scan and not here.
 *
 * # What this file deliberately does NOT do
 *
 *  - **It does not judge identity.** The identity axis stays a reading, stays
 *    reference-relative, and stays fail-closed: a different person is the one
 *    failure that breaks the promise a signed cast makes (#1229 is untouched).
 *  - **It is not wired into the judge yet.** This slice builds the instrument
 *    and drives its controls; the slice that hands the framing axis over to it,
 *    deletes the prose framing question from the judge's post and changes what a
 *    framing verdict COSTS is a money surface and is its own change. Until then
 *    `spec.framing` is still the sentence the reader is asked, and this file is
 *    a second statement of the same band — **declared scaffolding, and the thing
 *    that resolves it is the deletion of that sentence, not a promise.**
 *  - **It does not cover every view.** Two of the seven bands have a half that
 *    is not geometry — a head's TURN and a profile's CONCEALMENT — and each says
 *    so in its own `readerRemainder`. A remainder that is written down is a
 *    scope line; one that is not is a silence, and this file would rather be
 *    short than quiet.
 */
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";

/**
 * WHAT A BAND MAY NAME — and the list is TWO, because two are what has been
 * measured to answer.
 *
 * Every entry is something a cast HAS by construction rather than by anatomy
 * (see the header). Adding one is a real decision: it costs a segmenter call on
 * every view that names it, and it is a new way for a band to become untrue of
 * a being nobody has cast yet.
 *
 * `subject` is the whole silhouette and is read with the matting model, which
 * has an opinion about exactly one thing and is the right tool for a
 * head-to-feet question. `face` is a named region and goes to the segmenter.
 *
 * ⚠ **`shoulders` WAS THE THIRD AND IT IS GONE, KILLED BY ITS OWN FIRST DRIVE —
 * and this is the whole reason law 2 exists.** *"the neck and shoulders are in
 * frame"* is the close-up spec's own too-loose test, so `absent shoulders` was
 * the obvious rule, it passed nine unit arms, and on his six real close-ups
 * through the real segmenter it was **ANTI-CORRELATED WITH THE TRUTH**:
 *
 *     asset  what a person sees          `region("shoulders")` answered
 *     322    neck and both shoulders     NOTHING
 *     371    neck and both shoulders     NOTHING
 *     326    neck and a shoulder strap   NOTHING
 *     306    no shoulders at all         SHOULDERS
 *     314    a collar, no shoulders      SHOULDERS
 *
 * Wrong on five of five, and wrong in BOTH directions. `falRegionReader`'s own
 * docblock had already written down why — a non-empty answer means the feature
 * *or the nearest thing in the picture that looks like the word*, and it fails
 * upward (#246). Shipped on the unit suite alone, this rule would have refused
 * correct close-ups and passed loose ones: **the exact defect #1612 is about,
 * re-created in geometry.** The too-loose test is measured off the face instead
 * — see `roomBelowAtMost`.
 */
export const FRAMING_LANDMARKS = ["subject", "face"] as const;
export type FramingLandmark = (typeof FRAMING_LANDMARKS)[number];

export type FrameEdge = "top" | "bottom" | "left" | "right";

/**
 * ONE PREDICATE OF A BAND.
 *
 * ⚠ `clearOf` and `cutBy` are EXACT COMPLEMENTS of one another and share one
 * band width, which is not tidiness — it is the only way to guarantee no frame
 * can answer neither. An earlier shape gave contact a thinner band than
 * clearance, and a silhouette that stopped ten pixels short of the top edge
 * then satisfied no rule at all: not cut, not clear, and no honest verdict
 * available. One threshold, two names, and `cutBy === !clearOf` by
 * construction.
 */
export type FramingRule =
  /** This landmark stays clear of that edge — there is visible margin between them. */
  | { readonly must: "clearOf"; readonly landmark: FramingLandmark; readonly edge: FrameEdge }
  /** This landmark runs off that edge — the frame cuts it. */
  | { readonly must: "cutBy"; readonly landmark: FramingLandmark; readonly edge: FrameEdge }
  /**
   * AT MOST THIS MUCH PICTURE HANGS BELOW THE LANDMARK, IN THE LANDMARK'S OWN
   * HEIGHTS — the close-up's too-loose bound, and the one rule here that is a
   * quantity rather than a contact.
   *
   * ⚠ **The docblock over `closeUp` says a band should be landmark predicates
   * rather than proportions, and this does not contradict it — read what that
   * sentence is about.** Its own words: *"A judge reliably answers 'is the chin
   * inside the frame'; it answers 'does the face fill 80% of the height'
   * badly."* It is a rule about what a READER can be asked. A ratio between two
   * measured boxes is not asked of anybody: it is arithmetic, it is the same
   * every time, and it is exactly what the fidelity law says to reach for when
   * a proportion is genuinely the question.
   *
   * And it IS the question here. *"The neck and shoulders are in frame"* is
   * *"there is a lot of picture below the face"* said in anatomy, and the
   * anatomy is what made it unanswerable — asking a segmenter for shoulders
   * failed on five of five of his frames (see {@link FRAMING_LANDMARKS}). Room
   * below the face is the same fact with no body part in it, which is why it
   * works on a creature with tusks and a cowl.
   *
   * Scale-free by construction: both terms are read off the same frame in the
   * same pixels, so re-framing cannot move the ratio on its own.
   */
  | {
      readonly must: "roomBelowAtMost";
      readonly landmark: FramingLandmark;
      readonly inItsOwnHeights: number;
    };

export type ViewFramingBand = {
  readonly rules: readonly FramingRule[];
  /**
   * WHAT THIS VIEW'S FRAMING ALSO ASKS THAT GEOMETRY DOES NOT ANSWER HERE.
   *
   * Present on the two views whose test is a head's TURN or a profile's
   * CONCEALMENT. It is prose because it is a scope line rather than a rule: it
   * names the half of this view's framing that a reader still answers, so that
   * half is a stated remainder and not an accident. A view with no remainder
   * key is fully measured.
   */
  readonly readerRemainder?: string;
};

/**
 * HOW CLOSE IS TOUCHING — one constant, both directions.
 *
 * A proportion of the edge's own dimension, so it means the same thing on a
 * 1696×2528 view and a 2352×3504 one. 1% of 2528 is 25 pixels: a margin a
 * person can see, which is what *"a margin of skin visible BELOW that lower
 * edge"* is asking for, and far more than a mask's own edge noise.
 *
 * The floor exists for a frame small enough that 1% rounds to nothing; no
 * production view is anywhere near it, and a constant that silently becomes
 * zero is the kind that passes everything.
 */
export const EDGE_BAND_FRACTION = 0.01;
export const EDGE_BAND_FLOOR_PX = 4;

/**
 * HOW LITTLE IS NOTHING.
 *
 * The reader's own `absentIsAnswer` already returns an empty mask for *this is
 * nowhere in the picture*, so this floor is not the primary answer — it is the
 * allowance for a handful of stray lit pixels, which a segmenter does produce.
 * A quarter of one percent of the frame's area is ~10,700 pixels on a
 * 1696×2528 view: far below a shoulder, far above noise.
 */
export const ABSENCE_FLOOR_FRACTION = 0.0025;

/**
 * THE TWO CAPABILITIES A MEASUREMENT NEEDS, DERIVED FROM THE READER THE PRODUCT
 * ALREADY HAS rather than declared again beside it (working law 4). The
 * production `RegionReader` satisfies this by being it; a test double satisfies
 * it with two functions and no transport.
 */
export type FramingReader = Pick<RegionReader, "region" | "subject">;

export type FramingRuleReading = {
  readonly rule: FramingRule;
  /**
   * `true` when the rule is satisfied, `false` when it is not, `null` when it
   * could not be answered — three states, because *"it is not framed that way"*
   * and *"nothing could be read"* are different facts and only one of them is
   * about the picture.
   */
  readonly held: boolean | null;
  /** One short sentence, for the record and for a support reading. Internal. */
  readonly note: string;
};

export type FramingVerdict = "inBand" | "outOfBand" | "cannotMeasure";

export type FramingMeasurement = {
  readonly verdict: FramingVerdict;
  readonly readings: readonly FramingRuleReading[];
  /** Which landmarks were actually segmented, in the order they were asked. */
  readonly landmarksRead: readonly FramingLandmark[];
  /** How the verdict was reached, so it is never read as an absolute. */
  readonly method: string;
};

export function edgeBandPx(width: number, height: number, edge: FrameEdge): number {
  const along = edge === "top" || edge === "bottom" ? height : width;
  return Math.max(EDGE_BAND_FLOOR_PX, Math.round(along * EDGE_BAND_FRACTION));
}

/** Lit pixels in the mask, counted once. */
export function litPixels(mask: Mask): number {
  let lit = 0;
  for (let index = 0; index < mask.data.length; index += 1) {
    if (mask.data[index]! > 127) lit += 1;
  }
  return lit;
}

/**
 * DOES THIS MASK REACH THAT EDGE?
 *
 * The one primitive both `clearOf` and `cutBy` are written in terms of. It
 * counts a lit pixel inside the edge's band rather than measuring a bounding
 * box, so a shape that reaches the edge in one place and not another — a strand
 * of hair off the top, a foot at the bottom — answers the way a person looking
 * at the picture would.
 */
export function reachesEdge(mask: Mask, edge: FrameEdge): boolean {
  const { width, height, data } = mask;
  if (width <= 0 || height <= 0) return false;
  const band = edgeBandPx(width, height, edge);
  const rowFrom = edge === "top" ? 0 : edge === "bottom" ? Math.max(0, height - band) : 0;
  const rowTo = edge === "top" ? Math.min(height, band) : height;
  const columnFrom = edge === "left" ? 0 : edge === "right" ? Math.max(0, width - band) : 0;
  const columnTo = edge === "left" ? Math.min(width, band) : width;
  for (let row = rowFrom; row < rowTo; row += 1) {
    for (let column = columnFrom; column < columnTo; column += 1) {
      if (data[row * width + column]! > 127) return true;
    }
  }
  return false;
}

/** Is there enough of this landmark in the picture to call it present? */
export function isPresent(mask: Mask): boolean {
  const area = mask.width * mask.height;
  if (area <= 0) return false;
  return litPixels(mask) > area * ABSENCE_FLOOR_FRACTION;
}

/**
 * HOW MUCH PICTURE HANGS BELOW THIS LANDMARK, IN THE LANDMARK'S OWN HEIGHTS.
 *
 * Both terms come off the same mask in the same frame, so the answer does not
 * move when the render size does. `null` when there is nothing lit to measure.
 */
export function roomBelow(mask: Mask): number | null {
  let top = mask.height;
  let bottom = -1;
  for (let row = 0; row < mask.height; row += 1) {
    for (let column = 0; column < mask.width; column += 1) {
      if (mask.data[row * mask.width + column]! <= 127) continue;
      if (row < top) top = row;
      bottom = row;
      break;
    }
  }
  if (bottom < 0) return null;
  const ownHeight = bottom - top + 1;
  if (ownHeight <= 0) return null;
  return (mask.height - 1 - bottom) / ownHeight;
}

/**
 * THE ASK, PER LANDMARK — and `absentIsAnswer: false` is the reader's own
 * asymmetry used the way its docblock asks for it to be used.
 *
 * No rule here can be answered by a landmark that is not there: *"is the face
 * clear of the bottom"* has no honest answer on a picture with no face found,
 * so the question failed and the measurement says so rather than passing.
 */
async function readLandmark(
  reader: FramingReader,
  image: Buffer,
  landmark: FramingLandmark,
  absentIsAnswer: boolean,
): Promise<Mask> {
  if (landmark === "subject") return reader.subject({ image });
  return reader.region({ image, name: landmark, absentIsAnswer });
}

/**
 * MEASURE ONE FRAME AGAINST ONE VIEW'S BAND.
 *
 * Every landmark the band names is read ONCE, however many rules use it — a
 * segmenter call is about a cent and a close-up's band names three.
 *
 * A reader that throws is not a verdict: the transport failed, and this returns
 * `cannotMeasure` naming it rather than inventing an answer. That is the same
 * distinction `viewConformance` draws between *"it said differs"* and *"we
 * never got a verdict"*, and support needs to be able to tell them apart here
 * too.
 */
export async function measureViewFraming(input: {
  band: ViewFramingBand;
  image: Buffer;
  reader: FramingReader;
}): Promise<FramingMeasurement> {
  const { band, image, reader } = input;
  const landmarksRead: FramingLandmark[] = [];
  const masks = new Map<FramingLandmark, Promise<Mask>>();
  /*
    EVERY RULE HERE NEEDS THE LANDMARK TO BE FOUND, so every read is the strict
    question: an empty answer is a FAILED QUESTION and never a pass.

    That is not a simplification, it is what killed the one rule that wanted the
    other answer. `absent shoulders` was the only predicate that treated silence
    as information, and silence from this segmenter turned out to mean the
    opposite of what it looks like on five of his six close-ups
    (see {@link FRAMING_LANDMARKS}). No band asks a landmark to be missing any
    more, and a future one that wants to must first show that the word it uses
    goes quiet for the right reason.
  */
  const maskFor = (landmark: FramingLandmark): Promise<Mask> => {
    const held = masks.get(landmark);
    if (held) return held;
    landmarksRead.push(landmark);
    const asked = readLandmark(reader, image, landmark, false);
    masks.set(landmark, asked);
    return asked;
  };

  const readings: FramingRuleReading[] = [];
  for (const rule of band.rules) {
    let mask: Mask;
    try {
      mask = await maskFor(rule.landmark);
    } catch (error) {
      readings.push({
        rule,
        held: null,
        note: `could not read the ${rule.landmark}: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    if (!isPresent(mask)) {
      readings.push({
        rule,
        held: null,
        note: `no ${rule.landmark} was found, so where it sits in the frame cannot be read`,
      });
      continue;
    }
    if (rule.must === "roomBelowAtMost") {
      const room = roomBelow(mask);
      if (room === null) {
        readings.push({ rule, held: null, note: `the ${rule.landmark} has no measurable extent` });
        continue;
      }
      readings.push({
        rule,
        held: room <= rule.inItsOwnHeights,
        note:
          `${room.toFixed(2)} of a ${rule.landmark}'s height of picture sits below it `
          + `(at most ${rule.inItsOwnHeights})`,
      });
      continue;
    }
    const reaches = reachesEdge(mask, rule.edge);
    readings.push({
      rule,
      held: rule.must === "clearOf" ? !reaches : reaches,
      note: reaches
        ? `the ${rule.landmark} reaches the ${rule.edge} of the frame`
        : `the ${rule.landmark} stays clear of the ${rule.edge} of the frame`,
    });
  }

  /*
    THE FOLD, AND ITS ORDER IS THE WHOLE VERDICT.

    A rule that could not be ANSWERED outranks a rule that failed: a picture we
    could not read is not a picture we read and disliked. Part 2 of this card
    treats the two the same way only in what it COSTS — both deliver — and the
    record still has to be able to tell them apart.

    An empty band (a view with no measurable rule at all) folds to `inBand`,
    which is correct and is why `readerRemainder` exists beside it: nothing was
    asked here, so nothing here failed, and the half that is still a reading
    says so in its own words rather than hiding inside a pass.
  */
  const verdict: FramingVerdict = readings.some((reading) => reading.held === null)
    ? "cannotMeasure"
    : readings.every((reading) => reading.held)
      ? "inBand"
      : "outOfBand";

  return {
    verdict,
    readings,
    landmarksRead,
    method: `geometry:${band.rules.length} rule(s) over ${landmarksRead.length} landmark(s)`,
  };
}
