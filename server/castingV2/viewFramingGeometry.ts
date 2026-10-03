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
 *  - ✅ ~~**It is not wired into the judge yet.** This slice builds the
 *    instrument and drives its controls; the slice that hands the framing axis
 *    over to it, deletes the prose framing question from the judge's post and
 *    changes what a framing verdict COSTS is a money surface and is its own
 *    change. Until then `spec.framing` is still the sentence the reader is
 *    asked, and this file is a second statement of the same band — **declared
 *    scaffolding, and the thing that resolves it is the deletion of that
 *    sentence, not a promise.**~~
 *
 *    ⚠ **THE SCAFFOLDING DECLARATION IS DISCHARGED — THE HAND-OVER LANDED
 *    2026-10-02 (PR #1775, squash `73b348186`), AND THIS BULLET WENT ON SAYING
 *    THE OPPOSITE FOR A DAY.** It is struck rather than deleted because the
 *    fidelity law's own rule is that a declared shortcut is resolved by the
 *    real source arriving, and the record of the declaration being KEPT is
 *    what makes the resolution checkable. All three acts it named are done:
 *    `measureViewFraming` is reached in production from `signEngine.ts`, which
 *    builds the Sign judge with `framingReader: createFalRegionReader(…)` and
 *    **refuses to exist without `FAL_KEY`** rather than falling back to a
 *    reading (invariant 7); `foldFramingAxis` (`viewConformance.ts`) makes the
 *    MEASUREMENT the authority, so an `outOfBand` reading fails the axis
 *    whatever the vision model thought and the reader is not consulted; and
 *    what a framing verdict costs changed with part 2 — a framing verdict that
 *    did not hold now DELIVERS the picture, charged and marked unchecked, with
 *    the free Try again, because only the identity axis refuses. Both acts are
 *    driven in `viewFramingHandover.test.ts` — the fold directly rather than
 *    through a model (working law 3), the wire on the outgoing bytes
 *    (invariant 5).
 *
 *    ⚠ **What is NOT discharged, and it is a stated shortfall rather than a
 *    silence:** the deletion of the prose framing question is SENTENCE-GRANULAR.
 *    Only a sentence the rules restate IN FULL leaves the post
 *    (`band.restatedInFull` — today the close-up's too-loose pair and nothing
 *    else); on the five views whose specs state a measured test and a reader's
 *    test inside one sentence, the reader is still shown a clause the
 *    measurement now answers, and each says so on its band
 *    (`band.readerAlsoAsked`). Cutting at the commas would post a sentence
 *    nobody wrote as the standard a paid view is held to, which #1582 measured
 *    three times. **So this file is no longer a second statement of the band —
 *    it is the authority — and the remaining cost of the overlap is a MARK and
 *    never a picture.**
 *  - **It does not cover every view.** Two of the seven bands have a half that
 *    is not geometry — a head's TURN and a profile's CONCEALMENT — and each says
 *    so in its own `readerRemainder`. A remainder that is written down is a
 *    scope line; one that is not is a silence, and this file would rather be
 *    short than quiet.
 *  - ⚠ **AND IT DID NOT COVER EVERY CLAUSE OF THE VIEWS IT DOES COVER —
 *    measured 2026-10-01, when the hand-over was picked up.** Four views stated a
 *    framing clause that neither a rule nor a remainder accounted for, and the
 *    worst of them was `closeUp`, the ONE view this file's own types called fully
 *    measured. Each was declared on its band as {@link ViewFramingBand.unrestated}
 *    and held there; the hand-over is paid off per view, and a view whose debt is
 *    not empty cannot hand its framing axis over without deleting a stated test.
 *    **The reason it went unseen is worth more than the list**: the guard pairing
 *    bands with sentences holds every RULE to citing a clause and every CITED
 *    clause to keeping its rule, and neither direction can see a clause no rule
 *    ever cited.
 *
 *    ⚠ **ALL FIVE ARE PAID — 2026-10-02.** Four went to a reader's remainder
 *    (#1717: two orientations, a direction and a feature count, none of which a
 *    box answers) and the fifth, `frontClose`'s *"a head-and-shoulders
 *    portrait"*, is restated by a `roomBelowAtMost face` rule whose bound was
 *    measured on 43 of his own production frames rather than chosen. **No band
 *    carries `unrestated` today**, so the hand-over's precondition is met on
 *    every view; ~~what it still is not, is done — `measureViewFraming` has no
 *    production caller, and the slice that gives it the framing axis is its own
 *    money change.~~
 *
 *    ⚠ **AND THAT CLOSING CLAUSE WAS THE SAME STALE FACT A SECOND TIME, read
 *    at the code 2026-10-03 (#1612).** `measureViewFraming` HAS a production
 *    caller — `signEngine.ts`, via the judge's `framingReader` — and the money
 *    change it calls "its own" is the one that shipped as PR #1775's own second
 *    half. **It is struck here and answered in full at the bullet above**; the
 *    duplicate is kept visible rather than quietly removed because the reason
 *    this went unnoticed for a day is that ONE docblock said it TWICE, so a
 *    reader who corrected the sentence they happened to land on would have left
 *    the other one standing. The sibling sweep is `grep` for the SENTENCE, not
 *    the card number: the capability atlas's `sign-views` road had already been
 *    re-driven and says the measurement is the authority, so this file was the
 *    last place in the tree still describing the instrument as unwired.
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
   * ⚠ **IT HAS TWO CONSUMERS NOW AND THEY ASK IT IN OPPOSITE DIRECTIONS — 2026-10-02.**
   * The close-up's 0.3 is a TOO-LOOSE bound (any more picture below the face and
   * it has stopped being a close-up); `frontClose`'s 3.7 is the same bound with
   * the same sign doing a different job — any more and a head-and-shoulders
   * Portrait has become a full length. One rule, two numbers, each measured on
   * its own population and each written beside the view that owns it. **Neither
   * is derivable from the other**, which is why the band declares the number
   * rather than this file holding a default.
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
   * Present on the views whose test is a head's TURN, a profile's CONCEALMENT,
   * a POSE or a feature COUNT. It is prose because it is a scope line rather
   * than a rule: it names the half of this view's framing that a reader still
   * answers, so that half is a stated remainder and not an accident.
   *
   * ⚠ **IT IS THE REMAINDER OF WHAT THE RULES ATTEMPTED, NOT THE COMPLEMENT
   * OF THE SPEC — and this sentence used to say the opposite.** It read *"a view
   * with no remainder key is fully measured"*, and on the day the hand-over was
   * picked up that was measured FALSE of the one view it describes: `closeUp`
   * has no remainder and its spec states an ORIENTATION (*"front-on"*) and a
   * feature PRESENCE test (*"The mouth, every eye the reference shows … are
   * entirely inside the frame"*) that no rule here restates. A view with no
   * remainder is a view whose rules left nothing over; whether its SPEC is
   * fully accounted for is {@link ViewFramingBand.unrestated}'s question, and
   * it is a different one.
   */
  readonly readerRemainder?: string;
  /**
   * ⚠ **THE SENTENCES OF THIS VIEW'S OWN `spec.framing` THAT THE RULES ABOVE
   * RESTATE IN FULL, AND WHICH THE JUDGE IS THEREFORE NO LONGER ASKED — the
   * hand-over, #1612, his ruling of 2026-09-30.**
   *
   * # Why this is a list of SENTENCES and not of clauses
   *
   * His ruling is that *"the prose framing spec stops being sent to the vision
   * model as a question"*. Measured at the seven live specs before a byte moved,
   * that is literally achievable on ONE of them: **six specs state a measured
   * test and a reader's test inside one sentence.** `backFull`'s whole framing
   * spec is *"the whole body seen from directly behind, head to feet inside the
   * frame, face not visible"* — a direction, a crop and a concealment, three
   * clauses and two commas.
   *
   * So there were two roads and only one of them is honest for a shift to take:
   *
   *  1. **Cut his sentences at the commas** and post the halves. That composes
   *     a sentence he never wrote — *"the whole body seen from directly behind,
   *     face not visible"* — and posts it as the standard a delivered picture is
   *     held to. **#1582 is the measurement that settles it**: three careful
   *     rewordings of ONE framing spec were courted on 2026-09-30 and *each one
   *     broke a correct picture*. Recomposing six is not a wiring, it is an
   *     editorial change to what he judges, and this card's own body forbids it
   *     (*"Not a rewording of the judge's sentences"*).
   *  2. **Remove only what is restated IN FULL, verbatim, at sentence
   *     granularity** — and declare the rest, with the reason, where the band
   *     is. That is this field.
   *
   * # What the hand-over therefore is, on every view
   *
   * **The measurement becomes the AUTHORITY on the framing axis** — an
   * `outOfBand` reading fails the axis whatever the reader thought, and an
   * `inBand` reading is what a pass now requires. That half lands on all seven
   * views and is the determinism his ruling is about: the same frame cannot
   * answer two ways any more.
   *
   * **And the reader stops seeing the sentences listed here.** Today that is
   * `closeUp`'s too-loose pair and nothing else — which is exactly the coin he
   * measured (#1611: a close-up with the whole neck and shoulders in frame
   * passed 50/50 against its own spec).
   *
   * ⚠ **THE NARROWING WAS DRIVEN BEFORE IT SHIPPED, because a shorter question
   * is a different question and a reading can change when its context does**
   * (`scripts/_1612-handover-court-disposable.mts`, 8 real judge calls on his
   * own production frames, 2026-10-02). His two correct close-ups — asset 306
   * and asset 345, the tusked face under a cowl — read `matches` on 3 of 3 each
   * against the narrowed question, so nothing correct started failing; and
   * #1611's own two frames now fail on the MEASUREMENT with the number in the
   * note (*"0.48 of a face's height of picture sits below it (at most 0.3)"*
   * and 0.56), where the old question answered them with a coin. The judge's
   * own notes on the narrowed question are substantive rather than hedged
   * (*"Tight front-on crop from forehead to chin with margin of neck skin
   * visible below"*), which is what says it is answering the half it was left
   * rather than guessing at a sentence that is no longer there.
   *
   * ⚠ **THE DECLARED SHORTFALL, because an undeclared one is the whole defect
   * class this card is about.** On the six views whose sentences are mixed, the
   * reader is still shown a clause the measurement now answers, so a reader that
   * over-refuses on framing can still fail the axis after the geometry passed.
   * Under part 2 of this card that costs a MARK and never a picture — the view
   * is delivered, charged, `Unchecked · Try again` at a price of zero — but it
   * is a wrong mark, and the fix is clause-granular sentences in his own words.
   * **That is his editorial call, with a worked example per view on the card.**
   *
   * # What a reader may rely on
   *
   * Every entry is a VERBATIM substring of the live `spec.framing`, ending at a
   * sentence boundary, and the question the judge is posted is what is left
   * after the entries are removed — so the posted text is always a subsequence
   * of his own sentences and a shift cannot reword the standard through this
   * field. `viewFramingBands.test.ts` holds all of it, including the tie this
   * repository would otherwise have no way to see: **a rule's cited clause must
   * fall inside a sentence listed here, or the rule is answering something the
   * judge is still being asked.**
   */
  readonly restatedInFull?: readonly string[];
  /**
   * ⚠ **WHICH MEASURED CLAUSE THIS VIEW STILL SHOWS THE READER, AND WHY IT
   * CANNOT LEAVE — required, by a guard, exactly when it is true.**
   *
   * A rule whose cited clause sits inside a sentence the judge is STILL posted
   * is a clause answered twice: once deterministically and once by a reading
   * that may disagree. That is a real cost (a correct picture can be marked
   * `Unchecked` by the reader after the geometry passed) and it is the whole
   * remainder of the hand-over, so it is declared per view rather than left to
   * be inferred from the absence of a {@link ViewFramingBand.restatedInFull}
   * entry.
   *
   * ⚠ **AN ABSENCE IS NOT A DECLARATION — that sentence is the lesson #1675
   * paid for.** Five clauses went unmeasured for a month because nothing in the
   * band or its guard could tell *"the spec says nothing more"* from *"nobody
   * wrote the rule"*. `viewFramingBands.test.ts` derives which views owe this
   * field from the citations themselves and reddens on a missing one, so the
   * field cannot drift into being decorative.
   */
  readonly readerAlsoAsked?: string;
  /**
   * ⚠ **THE CLAUSES OF THIS VIEW'S OWN `spec.framing` THAT NEITHER A RULE NOR
   * {@link ViewFramingBand.readerRemainder} ACCOUNTS FOR — the hand-over's debt,
   * declared per view because that is the unit it is paid off in.**
   *
   * # Why it exists, and it is a finding rather than a design
   *
   * The hand-over slice of #1612 deletes the prose framing question from the
   * judge's post and leaves the measurement as the framing axis's whole answer.
   * That is only safe where the band plus the remainder say everything the spec
   * says — and `viewFramingBands.test.ts` could not see the difference: it holds
   * every RULE to citing a clause, and every CITED clause to still having its
   * rule, and **neither direction can see a clause of the spec that no rule ever
   * cited.** A guard that can only fail one way is this repository's own
   * favourite defect class, and it was holding a money-path hand-over shut
   * without anybody being able to say so.
   *
   * So the gap is written down where the band is, at the only resolution that
   * matters: the clause, verbatim, in the view's own words. `viewFramingBands`
   * holds each entry to still being a substring of the live spec, so a reworded
   * spec cannot leave a stale debt behind, and holds the total to only ever
   * SHRINKING.
   *
   * # What paying it off means, and it is not writing a rule
   *
   * A debt is discharged one of three ways, and all three are honest:
   *
   *  1. a new RULE restates the clause as geometry (and cites it);
   *  2. the clause moves into `readerRemainder`, i.e. it is declared to be a
   *     reader's question forever — which is the right answer for a feature
   *     COUNT, because #1582 is what happens when a count is asked of a being
   *     that does not have the feature, and a count belongs with the
   *     reference's own face scan;
   *  3. the clause is deleted from the spec, which is a change to the standard a
   *     delivered picture is held to and therefore his.
   *
   * ⚠ **WHAT IT MUST NEVER BE IS SILENCE.** An empty list on a view whose spec
   * still states something unmeasured is the hand-over deleting a stated framing
   * test with no line of code saying so — on a surface where the consequence is
   * a picture marked checked that nobody checked.
   */
  readonly unrestated?: readonly string[];
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
  /* The measurement's own deadline, so an abandoned read gives its provider
     slot back instead of holding it to the transport's ~300 s (#1781). The
     reader decides what it can honour — `falRegionReader` declines on its
     shared reads and says so there. */
  signal?: AbortSignal,
): Promise<Mask> {
  if (landmark === "subject") return reader.subject({ image, signal });
  return reader.region({ image, name: landmark, absentIsAnswer, signal });
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
  /**
   * ABANDONING THIS MEASUREMENT ALSO CANCELS ITS READS — #1781.
   *
   * The caller's deadline (`withinFramingDeadline`) stops WAITING on this
   * promise; without the signal the reads it started keep running and keep one
   * of the reader's five `FAL_CONCURRENCY` slots each until the transport gives
   * up. Every region read in the product queues behind that pool, so a hung
   * measurement on one view is a face scan on another view waiting for it.
   *
   * Optional, and what it costs when absent is latency rather than
   * correctness — which is why the deadline itself is #1776's change and this
   * is a separate one.
   */
  signal?: AbortSignal;
}): Promise<FramingMeasurement> {
  const { band, image, reader, signal } = input;
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
    const asked = readLandmark(reader, image, landmark, false, signal);
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
