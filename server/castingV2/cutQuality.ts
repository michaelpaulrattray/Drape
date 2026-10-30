/**
 * THE CLEAN-AND-REFUSE PIPELINE — #2565 §4, with its bar MEASURED.
 *
 * His approved shape, verbatim from the card: *"The mask is cleaned before use
 * (gaps closed, the sharp area widened a few px, feather outside only) … A cut
 * with holes or broken edges is **not used**, and that edit rides on words."*
 *
 * Two jobs, and they are deliberately separate exports rather than one call
 * that does both: **judge** a cut, and **clean** a cut. The judgement decides
 * whether a cut is used at all; the cleaning prepares one that is.
 *
 * # ⚠ THE ORDER IS LOAD-BEARING: JUDGE THE RAW CUT, THEN CLEAN IT
 *
 * The bar below was measured on **raw segmenter output**. Widening a mask
 * raises its fill, so a pipeline that cleaned first and judged after would be
 * comparing a cleaned cut against a number taken on raw ones — the bar would
 * silently loosen by however many pixels the widening added. `cleanCut` judges
 * first and cleans only what it is going to use, and `judgeCut` is exported on
 * its own so a caller that needs the verdict and not a cleaned mask (the panel
 * road) never pays for one.
 *
 * # ⚠ THE FLOOR IS A PER-CALLER DECISION, AND THE PANEL ROAD DOES NOT TAKE IT
 *
 * **#2831, the relay's decision of 2026-10-30: the face panel stops refusing on
 * fill; the take road keeps its floor.** Every caller states which road it is
 * by passing `fillFloor` — a number to refuse below, or
 * {@link FILL_MEASURED_NOT_REFUSED} to measure the fill and never refuse on it.
 * It is **required**, with no default, which is the whole of "put the split
 * where it can't be lost": a new caller cannot inherit either road silently,
 * and the comparison itself still happens in exactly one place.
 *
 * **Why the two roads differ, and it is not inconsistency.** On the take road a
 * cut is never shown to anyone, a refusal costs nothing (the edit rides on
 * words) and a partial cut costs a paid render. On the panel every row's cut is
 * outlined on hover, so a partial or wrong cut is visible before anyone refines
 * on it — while **a missing row is invisible**, which is the failure he reported
 * three times in one week (#2800, #2810, #2817).
 *
 * # THE BAR, AND WHERE ITS NUMBER COMES FROM
 *
 * Measured 2026-10-29 (`foreman-20261029-1806`; the record is on #2565 and the
 * cell is `scripts/_2565-cut-quality-bar-disposable.mts`): 32 segmenter reads,
 * 8 asks across 3 real pictures, $0.70 of house money read at fal's own books.
 *
 * ⚠ ~~**Correct cuts fill 42.3 – 73.5% of the rectangle they were asked for.**~~
 * **THAT POPULATION IS FALSIFIED AND THE SENTENCE IS STRUCK — #2831, measured
 * 2026-10-30 (`foreman-20261030-0847`, `output/_2565-thin/ledger.json`, read at
 * the rows here rather than taken from the card).** A **correct** cut of a long
 * curved tail, looked at and right, fills **17.00%** — under this floor, so it
 * got no row and nothing was said. The same run **kept** a cut that is the
 * wrong object entirely: asked for *"the armour plating on the chest"* the
 * segmenter cut **the sword in the character's hand**, and that passed at
 * **21.64%**. A right answer scored lower than a wrong one, **so fill does not
 * order correctness**, which is the one thing a refusal has to do. Two further
 * readings, both on the card: anything worn *around* something cuts as a ring
 * whose box is the whole thing it encircles, so **a band must be 7% of its own
 * span to clear 0.2**; and the same box on the same picture moved **3.27
 * points** between two runs, which is wider than the margin the correct chain
 * cleared the floor by (0.7).
 *
 * **The known-bad fills 8.3%** and that half stands: #2736's own specimen,
 * asked for *"the clothing and harness straps worn on the body"* the segmenter
 * returns **only the straps**, silently, with a plausible-looking cut.
 * `CUT_FILL_FLOOR` stays at 20% **for the road that owns that specimen** — the
 * take road — and the gap it was set in is now known to be about 8 points wide
 * (17.0% down to 8.3%) against a measurement that wobbles 3.3 of them.
 *
 * ⚠ **IT IS A FLOOR ON ONE KNOWN-BAD SPECIMEN, NOT A CALIBRATION, AND IT SAYS
 * SO HERE RATHER THAN IN A REPORT NOBODY RE-READS.** **Every judgement reports
 * its fill whichever road asked for it**, and both callers log it, so the
 * population grows by itself instead of by somebody deciding to go and measure
 * again — which is how the two rows above were found.
 *
 * ⚠ **A fill bar does not refuse small things, which was the falsification arm
 * and it fired on the third attempt.** A bar on "how much of its box did it
 * fill" is only honest if a correct cut of a *small* item clears it, and the
 * callers of this pipeline include rows for an earring and a septum ring
 * (#2781, #2789). Measured on #2787's own fixture: a correct hoop earring reads
 * **49.6%** and a correct nose stud **67.1%** — both far above the floor. The
 * first two attempts never fired at all (asked for *"the boots"*, the detector
 * returned no box), which is why the arm is named here rather than just its
 * result: a falsification that did not run is not a falsification.
 *
 * ⚠ **AND THAT ARM WAS LOOKING IN THE WRONG DIRECTION, WHICH IS WHY IT PASSED
 * — #2831.** A fill bar does not refuse a *small* thing, and that is true. What
 * it refuses is a **THIN LONG** thing: a stud is a disc in a box its own size,
 * while a tail, a chain or a band worn around something is a sliver inside the
 * whole territory it sweeps. The falsifying specimen was never going to be an
 * earring, and the arm that would have caught it is the one above that names a
 * ring's own arithmetic. **A falsification arm is only as good as its guess
 * about which way the instrument fails.**
 *
 * # ⚠ TWO THINGS §4's OWN SENTENCE GETS WRONG, BOTH MEASURED
 *
 * **1 · "Holes" is the wrong half of it, and the numbers run backwards.** The
 * known-bad has **0.77%** hole share; the good jacket has **1.16%** — more. On
 * real cuts holes are rare and small on everything (0, 2, 3, 7, 7, 12, 16 of
 * them), which is anti-aliasing and fabric texture rather than torn cloth. **A
 * bare *has holes → refuse* passes the sliver and refuses the jacket.** So
 * holes are CLOSED here — which is §4's own other instruction — and are never
 * the refusal.
 *
 * **2 · "Broken edges" is the signal, and the measure is fill of the asked
 * box.** The two rival measures are both worse: largest-piece share separates
 * only 1.55×, and raggedness separates 4.6× but conflates a small clean thing
 * (1.28) with a big complex garment (10.73), so it has no single line.
 * ⚠ **Fill is also the only one of the three that is STABLE run to run** —
 * asked the same box twice the segmenter returned the same fill to the decimal
 * (42.3% / 42.3%) while its piece count moved 71 → 66 and its hole count
 * 7 → 3. **A bar on a count would flap; a bar on fill does not.**
 *
 * # THE ENGINE'S OWN SCORE IS NOT THE BAR, AND THAT IS CLAUSE 4 ANSWERED
 *
 * The disappearing-technology law's clause 4 — read what the engine already
 * gives you before reaching for a better one — was asked properly here rather
 * than assumed. Every `regionInBox` call already buys `include_scores: true`.
 * **The known-bad IS the lowest score of all eight arms (0.8046)**, so the
 * signal is real and correctly ordered. It still cannot be the bar: **a correct
 * nose stud sits at 0.8125, 0.0077 above it.** The reason is structural rather
 * than bad luck, which is why more sampling will not rescue it — SAM's score is
 * an IoU-prediction head about a mask's own coherence inside its box, and
 * *"only the straps"* **is** a coherent object. It answers *is this a clean
 * object*, never *is this the thing that was asked for*. A corroborating
 * reading, not a gate. (`falRegionReader.ts` carries the same finding from the
 * other half of the road: the cut's prompt goes out empty, so the segmenter is
 * never told which noun the rectangle came from, and two nouns whose
 * rectangles agree get the same answer to the last bit.)
 *
 * # THE PREDICATE IS `> 0`, AND IT IS THE PRODUCT'S OWN
 *
 * A pixel is claimed when its byte is above zero — the same predicate
 * `boundsOf` draws its box round and `pointerCut`'s `claimedPixels` counts
 * with. A second predicate here would be working law 4 in the one place it
 * would be worst: the box a row is drawn at and the fill that row was judged
 * on would stop being about the same pixels.
 *
 * ⚠ **AND THE BYTES COME OFF THE ALPHA CHANNEL, WHICH COST THE COURT A FULL
 * RE-TAKE.** SAM 3 returns its mask as an **RGBA** png whose **alpha** carries
 * the shape; its RGB is a coloured overlay. `falRegionReader`'s `toMask` has
 * always had this right (`hasAlpha ? extractChannel(3) : …`) and the court's
 * first cell took luminance unconditionally — hole area overstated by up to
 * **400×** and piece counts by 2.6×. Nothing in this module decodes a png, so
 * it cannot repeat that mistake; it is recorded because the next hand to write
 * a cell that reads these masks can.
 */
import { boundsOf } from "./segmentCuts";
import { dilateMask } from "./maskGeometry";
import type { Mask } from "./maskedComposite";
import sharp from "sharp";

/** A pixel is claimed above zero — `boundsOf`'s predicate, not a second one. */
const CLAIMED = (byte: number | undefined): boolean => (byte ?? 0) > 0;

/**
 * THE REFUSAL BAR — fill of the asked rectangle, below which a cut is not used.
 *
 * 20%. Measured population and reasoning in this module's header: the known-bad
 * 8.3%, and the lowest **correct** cut yet measured 17.0%. A FLOOR on one
 * known-bad specimen rather than a calibration.
 *
 * ⚠ **IT IS THE TAKE ROAD'S POSITION AND NOT THE PRODUCT'S** (#2831). The road
 * that owns the known-bad specimen passes it; the face panel passes
 * {@link FILL_MEASURED_NOT_REFUSED} instead. Importing this constant is not the
 * same as being on the road it was measured for.
 */
export const CUT_FILL_FLOOR = 0.2;

/**
 * THE PANEL ROAD'S POSITION — measure the fill, log it, never refuse on it.
 *
 * A named constant rather than a bare `null` so that *which roads do not refuse
 * on fill* is one grep rather than a reading of three call sites, and so the
 * sentence a reviewer needs is at the call instead of in this file (#2831).
 */
export const FILL_MEASURED_NOT_REFUSED = null;

/**
 * HOW FAR THE SHARP AREA IS WIDENED, AND HOW FAR THE RAMP RUNS OUTSIDE IT.
 *
 * ⚠ **THESE TWO ARE NOT MEASURED AND THE DIFFERENCE MATTERS.** The refusal bar
 * above has a population behind it; these are his approved words — *"the sharp
 * area widened a few px, feather outside only"* — turned into numbers, and
 * *"a few"* is the whole specification there is. They are safe to be
 * approximately right in a way the bar is not: a wrong widening softens an edge
 * by a pixel or two, where a wrong bar drops a customer's feature or carries a
 * broken one forward. **What closes them is his eye on real panels** (#2565 §8
 * step 4), which is the same gate the flag flip waits on. Declared here so
 * nobody reads them as calibrated.
 */
export const CUT_WIDEN_PX = 2;
export const CUT_FEATHER_PX = 2;

/** Why a cut was or was not used — one word, for the log and for the row. */
export type CutRefusal = "used" | "no-pixels" | "no-box-area" | "no-overlap" | "below-fill-floor";

/** What a cut was judged to be, carrying every number the judgement used. */
export type CutVerdict = {
  /** Whether this cut may be used at all. `false` means the edit rides on words. */
  readonly use: boolean;
  /** Claimed pixels inside the asked box over that box's area. `null` when there is no area to fill. */
  readonly fill: number | null;
  /** Claimed pixels anywhere in the mask. */
  readonly claimed: number;
  /** Claimed pixels inside the asked rectangle. */
  readonly insideBox: number;
  readonly why: CutRefusal;
  /**
   * HOW MANY SEPARATE PIECES THE CUT CAME BACK IN — MEASURED, REFUSING
   * NOTHING (#2841).
   *
   * ⚠ **The fill number cannot see this at all, which is the finding.** A cut
   * of a leather jacket's collar came back as **29 disconnected scraps** whose
   * largest piece was 43.5% of it — the collar band across the back of the neck
   * simply missing — and `judgeCut` called it `used`, because 29 scraps adding
   * up to 24.6% of a rectangle are indistinguishable from one clean shape at
   * 24.6%. The customer gets a few specks of a collar where they asked for the
   * collar. Measured 2026-10-30 on a real cut, `output/_14court/kinds/
   * ref-hanger-cut-collar.jpg`, looked at rather than described.
   *
   * ⚠ **AND NOTHING REFUSES ON EITHER NUMBER, DELIBERATELY — the card's own
   * recommendation and #2831's lesson.** A legitimately scattered subject
   * exists: a lace-up panel, a fringe, a chain, freckles. #2831 measured what
   * happens when a bar is invented without a population — a correct tail at
   * 17% beside a wrong sword cut at 22% — so the honest order is to grow the
   * population first and decide after. These two numbers go in the log beside
   * the fill, on every judgement, for free, and they decide nothing.
   *
   * `pieces` is `0` exactly when nothing was claimed; `largestPieceShare` is
   * `null` then, and is otherwise the biggest piece over every claimed pixel —
   * so **1 is one clean shape** and a small number is a shattered one.
   */
  readonly pieces: number;
  readonly largestPieceShare: number | null;
};

type Box = { x: number; y: number; width: number; height: number };

/**
 * Claimed pixels, in total and inside one rectangle, in one pass.
 *
 * The pair is the interesting reading rather than either number alone: a cut
 * whose claimed pixels all sit inside its asked box is the normal case — it was
 * true of all seven real cuts the bar was measured on — and one where they do
 * not is a cut reaching outside the question. Fill counts only the pixels
 * inside the box, so a cut that sprawls past its rectangle cannot earn credit
 * for territory the rectangle never asked about.
 */
function claimedPixels(mask: Mask, box: Box): { claimed: number; insideBox: number } {
  let claimed = 0;
  let insideBox = 0;
  const right = Math.min(box.x + box.width, mask.width);
  const bottom = Math.min(box.y + box.height, mask.height);
  for (let y = 0; y < mask.height; y += 1) {
    const row = y * mask.width;
    const inRows = y >= box.y && y < bottom;
    for (let x = 0; x < mask.width; x += 1) {
      if (!CLAIMED(mask.data[row + x])) continue;
      claimed += 1;
      if (inRows && x >= box.x && x < right) insideBox += 1;
    }
  }
  return { claimed, insideBox };
}

/**
 * HOW MANY SEPARATE PIECES A MASK IS IN, AND HOW BIG ITS LARGEST ONE IS
 * (#2841) — measured, never refused on. See {@link CutVerdict.pieces}.
 *
 * **Four connectivity, for `closeHoles`'s own stated reason**: eight walks
 * diagonal noise through a one-pixel gap, so two scraps touching at a corner
 * would count as one shape where the eye sees two. The two readers therefore
 * agree about what "connected" means, which is the only way their numbers can
 * be read side by side in one log line.
 *
 * The typed stack with its own cursor is `closeHoles`'s idiom rather than a new
 * one: a full-frame garment mask runs to ~865k pixels and this is the same hot
 * loop. Nothing is mutated — the visited array is this function's own.
 */
export function piecesOf(mask: Mask): { count: number; largest: number; claimed: number } {
  const { width, height, data } = mask;
  const size = width * height;
  const seen = new Uint8Array(size);
  const stack = new Int32Array(size);
  let count = 0;
  let largest = 0;
  let claimed = 0;
  for (let start = 0; start < size; start += 1) {
    if (seen[start] || !CLAIMED(data[start])) continue;
    count += 1;
    let top = 0;
    seen[start] = 1;
    stack[top] = start;
    top += 1;
    let pixels = 0;
    while (top > 0) {
      top -= 1;
      const p = stack[top]!;
      pixels += 1;
      const x = p % width;
      /*
        THE FOUR NEIGHBOURS, WRITTEN OUT RATHER THAN THROUGH A CLOSURE, AND THE
        NUMBER IS WHY — this is the only place in this file that trades its
        shape for speed, so it says what it bought.

        Measured warm, 20 runs, on a 1024×1536 mask carrying a million claimed
        pixels — the full-frame garment cut `closeHoles` names: a `push` closure
        declared inside the loop costs **175.5 ms** a cut and this costs
        **5.4 ms**. A face scan makes 21–27 cuts, so the closure would have put
        about **four seconds** on every face read, for a measurement that
        deliberately refuses nothing. Re-measured after reverting and
        re-applying, both ways, because a 32× reading is the kind that is a
        cold JIT rather than a fact.
      */
      if (x > 0) {
        const q = p - 1;
        if (!seen[q] && CLAIMED(data[q])) { seen[q] = 1; stack[top] = q; top += 1; }
      }
      if (x < width - 1) {
        const q = p + 1;
        if (!seen[q] && CLAIMED(data[q])) { seen[q] = 1; stack[top] = q; top += 1; }
      }
      if (p >= width) {
        const q = p - width;
        if (!seen[q] && CLAIMED(data[q])) { seen[q] = 1; stack[top] = q; top += 1; }
      }
      if (p + width < size) {
        const q = p + width;
        if (!seen[q] && CLAIMED(data[q])) { seen[q] = 1; stack[top] = q; top += 1; }
      }
    }
    claimed += pixels;
    if (pixels > largest) largest = pixels;
  }
  return { count, largest, claimed };
}

/**
 * JUDGE ONE CUT — the refusal half, on the RAW mask.
 *
 * Four refusals, in the order they can be answered most cheaply. **The first
 * three are yes/no facts with nothing to tune and every caller takes them;
 * only the last is a number, and only the caller that asked for it takes
 * that** (#2831, and this module's header carries why).
 *
 * `fillFloor` is REQUIRED and has no default: a number refuses below it,
 * {@link FILL_MEASURED_NOT_REFUSED} measures the fill and returns it without
 * ever refusing on it. A caller that must think about which road it is on
 * cannot end up on the wrong one by writing nothing.
 */
export function judgeCut(input: { mask: Mask; box: Box; fillFloor: number | null }): CutVerdict {
  const { mask, box, fillFloor } = input;
  const { claimed, insideBox } = claimedPixels(mask, box);
  if (claimed === 0) {
    /* Nothing to break into pieces, and nothing to walk for it. */
    return { use: false, fill: null, claimed, insideBox, why: "no-pixels", pieces: 0, largestPieceShare: null };
  }
  const area = box.width * box.height;
  if (area <= 0) {
    /* There is no question to have answered a fifth of. Refused rather than
       divided by zero, and refused rather than waved through: a caller handing
       this an empty rectangle has a defect of its own, and passing it would
       hide that defect behind a drawn row. */
    return { use: false, fill: null, claimed, insideBox, why: "no-box-area", pieces: 0, largestPieceShare: null };
  }
  const fill = insideBox / area;
  if (insideBox === 0) {
    /*
      THE SEGMENTER ANSWERED ABOUT SOMETHING ELSEWHERE — the rectangle WAS the
      question and not one pixel of the answer is inside it.

      ⚠ **THIS REFUSAL IS HERE BECAUSE TAKING THE FLOOR OFF A ROAD WOULD
      OTHERWISE OPEN A HOLE IN IT** (#2831). A nil overlap is a nil fill, so
      while every caller refused below 20% this case was swallowed by the floor
      and never needed naming. `pointerCut` has always had its own box-against-
      box check before it judges; `sideByDetector` has not, and would have begun
      keeping cuts that miss their rectangle entirely the moment the floor came
      off. It is a yes/no about two rectangles with no tolerance to tune, so it
      belongs beside the other two and not beside the number.

      ⚠ **On the take road this moves a `why` WORD and no decision**: such a cut
      read `below-fill-floor` before and reads `no-overlap` now, which is the
      better diagnosis of the same refusal.
    */
    return { use: false, fill, claimed, insideBox, why: "no-overlap", pieces: 0, largestPieceShare: null };
  }
  /*
    THE FRAGMENTATION READING, TAKEN AFTER THE THREE CHEAP REFUSALS AND BEFORE
    THE ONE NUMBER (#2841).

    After them, so a mask with nothing in it and one that missed its rectangle
    entirely pay for no walk at all — both are already answered and neither has
    a shape worth describing. BEFORE the fill bar, so a cut REFUSED on fill
    still carries its two numbers into the log: the population this is being
    grown for is every cut the road makes, and the refused ones are exactly
    where a later bar would have to be able to tell a fringe from a shattering.
  */
  const broken = piecesOf(mask);
  const pieces = broken.count;
  const largestPieceShare = broken.claimed === 0 ? null : broken.largest / broken.claimed;
  if (fillFloor !== null && fill < fillFloor) {
    return { use: false, fill, claimed, insideBox, why: "below-fill-floor", pieces, largestPieceShare };
  }
  return { use: true, fill, claimed, insideBox, why: "used", pieces, largestPieceShare };
}

/**
 * ENCLOSED BACKGROUND — §4's "holes", found and then filled.
 *
 * A flood fill through the BACKGROUND from every frame-border pixel, four
 * connectivity. Background the fill cannot reach is enclosed by the shape,
 * which is what a hole is. **Four rather than eight**, for `attachedTo`'s
 * reason: eight walks diagonal noise through a one-pixel gap, and a hole that
 * leaks to the outside through a single diagonal pixel is still a hole to the
 * eye.
 *
 * Returned with its pixels AND its count, because one big hole and forty specks
 * are different defects — a torn middle against an anti-aliasing stipple — and
 * a caller that logged only an area could not tell them apart afterwards.
 *
 * The caller's mask is never mutated: the fill lands in a copy.
 */
export function closeHoles(mask: Mask): {
  mask: Mask;
  holePixels: number;
  holeCount: number;
  largestHole: number;
} {
  const { width, height, data } = mask;
  const size = width * height;
  const outside = new Uint8Array(size);
  /* A typed stack with its own cursor rather than a JS array: a full-frame
     garment mask runs to ~865k pixels and this is the pipeline's hot loop. */
  const stack = new Int32Array(size);
  let top = 0;
  const push = (p: number): void => {
    if (p < 0 || p >= size) return;
    if (outside[p] || CLAIMED(data[p])) return;
    outside[p] = 1;
    stack[top] = p;
    top += 1;
  };
  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (top > 0) {
    top -= 1;
    const p = stack[top]!;
    const x = p % width;
    if (x > 0) push(p - 1);
    if (x < width - 1) push(p + 1);
    push(p - width);
    push(p + width);
  }
  /* What is left is background the outside never reached — a hole. Walked once
     more so each hole's own size is known, and filled on the way through. */
  const filled = Buffer.from(data);
  const seen = new Uint8Array(size);
  const walk = new Int32Array(size);
  let holePixels = 0;
  let holeCount = 0;
  let largestHole = 0;
  const enclosed = (p: number): boolean => !outside[p] && !CLAIMED(data[p]);
  for (let start = 0; start < size; start += 1) {
    if (seen[start] || !enclosed(start)) continue;
    holeCount += 1;
    let hole = 0;
    let cursor = 0;
    walk[cursor] = start;
    cursor += 1;
    seen[start] = 1;
    while (cursor > 0) {
      cursor -= 1;
      const q = walk[cursor]!;
      hole += 1;
      filled[q] = 255;
      const x = q % width;
      const neighbours = [
        x > 0 ? q - 1 : -1,
        x < width - 1 ? q + 1 : -1,
        q - width,
        q + width,
      ];
      for (const n of neighbours) {
        if (n < 0 || n >= size) continue;
        if (seen[n] || !enclosed(n)) continue;
        seen[n] = 1;
        walk[cursor] = n;
        cursor += 1;
      }
    }
    holePixels += hole;
    if (hole > largestHole) largestHole = hole;
  }
  return { mask: { data: filled, width, height }, holePixels, holeCount, largestHole };
}

/**
 * FEATHER OUTSIDE ONLY — the ramp runs outward and the sharp area stays sharp.
 *
 * ⚠ **`featherMask` CANNOT DO THIS, AND THAT IS WHY THIS EXISTS.** It is a
 * plain Gaussian over the whole mask, so it softens BOTH sides of the edge and
 * eats a radius of the interior — which is the smudge at the sharp/blur edge
 * **his own eye caught** on arm G-seg2, and which §4's *"feather outside only"*
 * is the instruction about. Neither function is wrong; they answer different
 * asks, and a compositor that wants a symmetric ramp should still reach for
 * `featherMask`.
 *
 * The rule is one line: **where the original claimed a pixel the result is
 * fully opaque; everywhere else it is the blurred value.** So the interior is
 * byte-identical to a solid mask and only the skirt outside the shape ramps
 * off. `cutQuality.test.ts` holds that interior identity directly rather than
 * trusting the arithmetic to have stayed this way.
 */
export async function featherOutside(mask: Mask, radius: number): Promise<Mask> {
  if (radius <= 0) return mask;
  const { data, info } = await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  })
    .blur(radius)
    /* ONE CHANNEL OUT, EXPLICITLY — sharp promotes a one-channel raw input to
       truecolour on the way out, and a loop walking one byte per pixel then
       runs three times too far and compares against `undefined`, which is
       false every time. `maskedComposite` carries this note for the same
       reason; it is repeated rather than cited because the trap is at the call
       and not in the other file. */
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== mask.width || info.height !== mask.height) {
    throw new Error("featherOutside: the blur changed the raster's shape");
  }
  const out = Buffer.allocUnsafe(mask.data.length);
  for (let p = 0; p < mask.data.length; p += 1) {
    out[p] = CLAIMED(mask.data[p]) ? 255 : (data[p] ?? 0);
  }
  return { data: out, width: mask.width, height: mask.height };
}

/** A judged, cleaned cut. `mask` is `null` exactly when `verdict.use` is false. */
export type CleanedCut = {
  readonly verdict: CutVerdict;
  readonly mask: Mask | null;
  /** The box the cleaned mask occupies — recomputed, because widening moves it. */
  readonly bounds: Box | null;
  readonly holePixels: number;
  readonly holeCount: number;
};

/**
 * THE PIPELINE — judge the raw cut, then clean the one being kept.
 *
 * §4's order exactly: gaps closed, the sharp area widened a few px, feather
 * outside only. The judgement comes first for the reason in this module's
 * header, and **a refused cut is never cleaned**: there is nothing to prepare,
 * and doing the work anyway would put a widened mask's numbers in the log
 * beside a verdict taken on the raw one.
 */
export async function cleanCut(input: {
  mask: Mask;
  box: Box;
  /** Which road is asking — see {@link judgeCut}. Required, and for the same reason. */
  fillFloor: number | null;
  widenBy?: number;
  featherBy?: number;
}): Promise<CleanedCut> {
  const verdict = judgeCut({ mask: input.mask, box: input.box, fillFloor: input.fillFloor });
  if (!verdict.use) {
    return { verdict, mask: null, bounds: null, holePixels: 0, holeCount: 0 };
  }
  const closed = closeHoles(input.mask);
  const widened = await dilateMask(closed.mask, input.widenBy ?? CUT_WIDEN_PX);
  const feathered = await featherOutside(widened, input.featherBy ?? CUT_FEATHER_PX);
  return {
    verdict,
    mask: feathered,
    bounds: boundsOf(feathered),
    holePixels: closed.holePixels,
    holeCount: closed.holeCount,
  };
}
