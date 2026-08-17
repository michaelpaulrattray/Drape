/**
 * THE COMPLETENESS GUARD AT THE LIBRARY'S DOOR.
 *
 * The founder looked at a tile captioned *"her hairstyle"* and saw a **fringe**.
 * Nothing in the system was wrong in a way any check could see: the crop was
 * well-formed, it sat inside its own region, it stored and it loaded. It simply
 * contained 12.5% of the hair it claimed to be, and every render that carried it
 * afterwards carried a haircut nobody asked for.
 *
 * So a reference does not enter the library because it was produced. It enters
 * because a **second, independent read of its own region on its own frame**
 * confirms it contains its subject (§2.4, fable-164/173).
 *
 * # The four things this refuses, and why each is its own reason
 *
 *  - **`subjectAbsent`** (fable-181) — *a reference cut from a frame that lacks
 *    its subject is a fabrication, whatever the cutter's quality.* Caught live
 *    when a cell tried to cut per-ear earring crops from a master whose ears are
 *    bare. The region read finding nothing is the honest answer, and it must not
 *    be rounded into a small crop.
 *  - **`readDidNotSettle`** — the read failed rather than answered. D-235's
 *    asymmetry: an affirmative without a reading is not a pass, and this is the
 *    door where a failed reading would otherwise become a confident yes.
 *  - **`noSpecimen`** — this kind has no positive specimen, so it has no
 *    threshold. It REFUSES rather than borrowing hair's number. A provisional
 *    threshold is a number nobody measured, wearing the clothes of one that was.
 *  - **`underCaptured`** — the fringe itself. Refused loudly; never stored
 *    quietly.
 *  - **`disputedDelivery`** (fable-220 §3) — the ask WROTE this slot's facet and
 *    the render's own reader then said the change is not in the picture. Nothing
 *    is wrong with the crop as a crop; what is unsettled is whether the painter
 *    failed or the reader did. It may not enter the library — the previous
 *    version stays newest and stays good — and its pixels are the only artifact
 *    that can settle which of the two was wrong.
 *
 *  - **`brokenOutline`** (fable-228) — the shape was too nearly all edge for area
 *    to judge, so the LENGTH instrument judged it instead (§2.4c), and part of
 *    the region's own centreline is outside the crop. Its pixels are kept, and
 *    for the opposite reason to the three above: that bar rests on one positive,
 *    so the refusal itself is the thing that might be wrong.
 *
 * And one more that is about the KEY rather than the pixels: **`duplicateOfSlot`**
 * — a crop byte-identical to another slot's crop is two rows holding one fact
 * (D-242, one layer up). `marks` and `makeup` at `face skin` produced exactly
 * this in production, three times.
 *
 * # TWO INSTRUMENTS, AND THE DOOR CHOOSES BY MEASURING THE REGION
 *
 * Area (`|crop ∩ region| / |region|`) is the first and judges most kinds. It
 * cannot judge a hoop — two-thirds of a hoop is its own outline — and §2.4b's
 * standing law makes it say so instead of producing a number. Where it says so,
 * the LENGTH instrument (`referenceCentreline.ts`) takes the crop: how much of
 * the region's own centreline runs within a pixel of it. Which one adjudicated
 * travels on the verdict as {@link Adjudication}, because 97.6% means two
 * different things depending on the answer.
 *
 * # THE FIRST INSTRUMENT, AND WHAT LABELS ITS CONTROLS
 *
 * Coverage is `|crop ∩ region| / |region|`, measured against a fresh full read
 * of the region on the frame the crop claims to represent. The intersection is
 * in the numerator on purpose: a crop that spills outside its region is a
 * different defect and must not be allowed to inflate the number the guard
 * thresholds on.
 *
 * The controls are labelled by a **verified outcome**, never by the ask that
 * produced them — the campaign has one expensive lesson about exactly that, and
 * this is the door it would have walked through next:
 *
 *   identity control   a region scored as its own crop reads 100.0%   (14 of 14)
 *   negative           the founder's fringe — HE looked at it and called it a
 *                      fringe; the instrument then read 12.5%
 *   positive           the delivered-anchored cut of v#163 — the crop that was
 *                      looked at and found to contain the hair; read 94.6%
 *
 * The label in both cases is a human verdict on the artifact; the number is the
 * instrument's reading of it. That is what makes them controls rather than a
 * threshold fitted to its own assumption.
 */
import type { Mask } from "./maskedComposite";
import { CENTRELINE_BLIND_TO, measureCentreline } from "./referenceCentreline";
import type { Instance } from "./referenceSlots";
import type { SegmentBox } from "./segmentCuts";

/**
 * The specimens a kind's threshold is derived from, with their provenance.
 *
 * **One kind has both.** Every other kind refuses until somebody measures one,
 * which is fable-173's ruling and D-235's asymmetry as a default: no provisional
 * number, and the safe direction is to refuse a crop rather than to store one
 * that quietly forgets a feature.
 */
export type CompletenessSpecimens = {
  /** Coverage the instrument read on a crop a human verdict called complete. */
  positive: number;
  /** Coverage it read on one a human verdict called incomplete. */
  negative: number;
  /**
   * A RULED FLOOR, when the positive cannot be one (fable-589 §3).
   *
   * `positive` is a measurement and stays one. On kinds where the mint's cut IS
   * the region, a real mint reads 100.0 — and a bar AT 100 refuses 99.9 for
   * nothing, which is a threshold nobody can pass wearing a measurement's
   * clothes. So the bar is ruled, separately, with its anchors beside it, and
   * the measured numbers are not bent to produce it.
   *
   * PROVISIONAL means what it says: every reading logs, and the floor is
   * revisited when the population says something. A bar earns permanence from
   * data, never from the night it was set (D-236's posture).
   */
  provisionalFloor?: number;
  source: string;
};

export const COMPLETENESS_SPECIMENS: Readonly<Record<string, CompletenessSpecimens>> = {
  hair: {
    positive: 0.946,
    negative: 0.125,
    /* Both specimens named by the row that holds them, checked against
       production while reading the founder pack back: the positive is
       `casting_segments` #13 (v#163, `hairWorn@hair`, 364×467) and the negative
       is #9 (v#153, 354×187). This string previously read "against row 13, the
       founder's fringe", which attached the fringe to the POSITIVE's row — the
       numbers were always right and the docblock above was always unambiguous,
       but the one adopted bar in the system should not carry a label that names
       the wrong artifact. */
    source: "D-243 store audit: the delivered-anchored cut of v#163 (casting_segments #13) "
      + "against the founder's fringe on v#153 (#9)",
  },
  /*
    HORNS — the kind that made the ruled floor necessary (fable-589 §3).

    Its anchors, every one of them a reading somebody took:

      identity control     100.0%   a crop scored as itself, both sides
      REAL MINTS           100.0%   ×4 — the founder's own two horns and two
                                    earrings, filed and refused-kept on his
                                    production renders of 2026-08-15
      the known mis-cut     83.7%   the same crop with its top third gone,
                                    looked at and called incomplete

    So everything real passes today and the mis-cut class refuses with eleven
    points of margin. The floor is 95% because the positive cannot be the bar
    here: the mint's cut IS the region for this kind, so a real crop reads
    100.0 and a bar at 100 would refuse 99.9 for nothing.

    And the cost of being wrong is asymmetric in our favour: `noSpecimen` and
    `underCaptured` both KEEP the crop, so an over-tight floor costs a kept
    picture and a retry, never a lost feature.
  */
  horns: {
    positive: 1,
    negative: 0.837,
    provisionalFloor: 0.95,
    source: "fable-589 §3, on four real mints (his horns@left/right and "
      + "earring@left/right, 2026-08-15), the identity control at 100.0%, and the "
      + "looked-at mis-cut at 83.7% (V2_HORNS_SPECIMEN_CALIBRATION.md)",
  },
  /*
    EYES — PULLED and RESTORED on the same day, 2026-08-17, and the round trip
    is the entry's real provenance (fable-853 §3b, then fable-863 §4).

    ────────────────────────────────────────────────────────────────────────
    THE SHORT VERSION. The bar shipped, and the carry it unblocked was measured
    the same night: a minted eye crop DELIVERED NOTHING. It was pulled inside
    the hour. The cause turned out not to be the crop, the crop's size or the
    way we pack it — it was that a slot sending a crop had stopped saying its
    words, so the bar came back once that was fixed.

    THE MEASUREMENT, on the founder's own two casts, one variable at a time.
    Every figure is his delivered eye colour coming back on a repaint that
    anchors on a master which disagrees with it — 3× panels, looked at:

      crop carried, NO words        35×24 padded (as shipped)      0 of 4
                                    35×24 clean, its own image     0 of 2
                                    35×24 scaled to 512 px         0 of 2
                                    56×33 padded (his own pick)    0 of 2
      words, no crop                                               3 of 3
      crop AND words                bench-appended sentence        2 of 2
                                    THE REAL ASSEMBLER, as shipped 3 of 3

    Three presentations of the same pixels changed nothing; the sentence
    changed everything. The founder's own outside-the-app exhibit is the same
    shape — his prompt named what the crop was FOR ("@Image 1 is her left eye
    colour"), which is a crop-plus-words render on another engine, and it
    delivered.

    So the defect was `recipeAssembler.ts` skipping the standing sentence for
    ANY slot holding a reference — fable-598's item rule (POINT, DON'T
    DESCRIBE, earned on two 34 px crosses that argued with their own captions)
    silently overriding fable-192's anatomy rule (the crop is an assist; the
    words are the carrier of record). Anatomy says its words again; items still
    point in silence; both directions are pinned by tests that can fail, in the
    assembler's suite and at the wire in the caller's.

    THE ENTRY ITSELF is unchanged from the day it shipped, because nothing
    about the completeness question was ever wrong:

      HIS FOUR POSITIVES   100.00%  crops 3/4/5/6 of the specimen sheet
                                    (library rows 53/61/62/63 on cast
                                    f51386fc, 56-59 x 30-33 px), measured by
                                    the area instrument at mint time
      re-measured          100.0%   two of them cut and scored again through a
                                    fresh INDEPENDENT pair of region reads on
                                    their own frame (v#74359d57)
      the mis-cut           72.8%   the same crop with its OUTER third gone,
                                    looked at, and unmistakably a part of an
                                    eye rather than an eye (72.0% the other
                                    side; the HIGHER is taken, because the
                                    negative nearest to passing is the one a
                                    floor has to clear)

    The floor is 95% for horns' reason: the mint's cut IS the region here, so a
    real crop reads 100.0 and a bar AT 100 refuses 99.9 for nothing. Margin
    22.2 points.

    WHAT IT STILL DOES NOT DO: it cannot see RESOLUTION, and it no longer needs
    to. The two crops he called "more pixelated" (29×24, 35×24) both measure
    100.00% here, and the ≥45 px sharpness floor drafted to refuse them is
    DEAD (fable-863 §2) — it was aimed at the crop when the defect was the
    missing sentence, and it would have punished customers for our plumbing.
    The padding is exonerated too, and stays exactly as measured for hair.

    IF THIS EVER FAILS AGAIN, the first thing to check is not this table: it is
    whether the recipe still SAYS the slot's words beside the crop. The bench
    is `scripts/eye-presentation-matrix-disposable.mts`, and its four
    presentations are the regression court.
  */
  eyes: {
    positive: 1,
    negative: 0.728,
    provisionalFloor: 0.95,
    source: "fable-843 §1 (his verdict on crops 3/4/5/6) with the measured "
      + "negative from fable-850 §4: `calibrate-eyes-specimen-disposable.mts` on "
      + "production v#74359d57, two independent region reads, complete 100.0% "
      + "both sides against outer-third-gone 72.8%/72.0%, both looked at; "
      + "pulled and restored 2026-08-17 (fable-853 §3b / fable-863 §4) — the "
      + "carrier fix in recipeAssembler.ts is what makes it safe",
  },
};

/**
 * The bar for a kind: **the coverage of the one crop we have proven complete.**
 *
 * Not the midpoint of the two specimens. A midpoint is a number nobody
 * measured, and the two errors are not symmetric — a refused crop costs a
 * retry, an accepted fringe costs a feature the product then carries forward
 * as if it were hers. When more positive specimens exist the bar becomes the
 * worst of them, which is a widening backed by measurement rather than a
 * softening backed by inconvenience.
 */
export function thresholdFor(kind: string): number | null {
  const specimens = COMPLETENESS_SPECIMENS[kind];
  if (!specimens) return null;
  /* A ruled floor wins over the measurement it was ruled from — see
     `provisionalFloor`, and note that it is never higher than the positive:
     a "floor" above the one crop we have proven complete would refuse the
     specimen itself. */
  return specimens.provisionalFloor ?? specimens.positive;
}

/**
 * THE SECOND FAMILY — for kinds whose bar was measured with the LENGTH
 * instrument (`referenceCentreline.ts`, §2.4c, ruled in fable-228).
 *
 * A separate table rather than a `measure` field on the first, because the two
 * are not alternatives a kind chooses between: **which one adjudicates is
 * MEASURED at the door, per crop, from the region's own shape** (see
 * {@link guardReference}). A kind may honestly own a bar in both — a stud
 * earring is area-scorable and a hoop is not, and they arrive under one kind
 * name — and the day one does, the row must say which instrument judged it.
 * `referenceCompleteness.test.ts` holds that tripwire: no kind may appear in
 * both tables while the library row carries no instrument column.
 *
 * ## The caveats ride WITH the number — all three, everywhere it is quoted
 *
 * fable-228 adopted 97.6% on `n(positive) = 1`, which is hair's shape with a
 * quarter of hair's margin (23.6 points against 82.1). So the fields below are
 * not decoration:
 *
 *  - `positives` — the count, stated, so a reader grades the bar instead of
 *    trusting it. One.
 *  - `resolutionPts` — 16.7, against a gap of 23.6 that is DERIVED from the two
 *    specimens rather than restated beside them ({@link centrelineMarginFor}).
 *    1.4×: the instrument passes §2.4b's law that the area measure failed, and it
 *    passes it *marginally*, under the erosion model that is also this door's own
 *    blind spot ({@link CENTRELINE_BLIND_TO}).
 *  - `specimenEvent` — the escalation clause, and it is the reason a refusal
 *    here KEEPS ITS CROP: a one-positive bar can only earn more positives if the
 *    crops it turns away can be looked at. A bar this thin has to be falsifiable
 *    by the thing it refuses.
 */
export type CentrelineSpecimens = {
  /** Centreline coverage read on a crop a human verdict called complete. */
  positive: number;
  /** And on one a human verdict called incomplete. */
  negative: number;
  /** How many positives the bar rests on. One is not a scandal; one unstated is. */
  positives: number;
  /** The instrument's worst-case resolution, in points, on the positive —
   *  measured under symmetric erosion, which is the unfair model AND the exact
   *  model of the defect this door cannot see. */
  resolutionPts: number;
  specimenEvent: string;
  source: string;
};

export const CENTRELINE_SPECIMENS: Readonly<Record<string, CentrelineSpecimens>> = {
  earring: {
    positive: 0.976,
    negative: 0.740,
    positives: 1,
    resolutionPts: 16.7,
    specimenEvent:
      "the first crop an eye calls COMPLETE that this bar refuses re-opens the family with that crop as its second positive; it is an escalation, never a silent failure",
    source:
      "fable-228, from opus-170/171: lib#8 v#142 left (complete, one continuous crescent) against lib#9 v#142 right (incomplete, a crescent plus a detached fragment); v#144's pair read 38.1 and 20.0, both incomplete, no interleaving",
  },
};

/**
 * How many times its own worst-case resolution the bar's gap is — §2.4b's law
 * turned on the instrument that answers §2.4b.
 *
 * Derived from the two specimens rather than stored beside them: a second number
 * shadowing `positive − negative` is a copy, and a copy of a bar drifts from the
 * bar. Below 1 the family is not usable at all — the instrument would be
 * adjudicating inside its own noise, which is the exact failure that took area
 * off hoops. `earring` is 23.6 / 16.7 = 1.4, which is thin and is stated as thin.
 */
export function centrelineMarginFor(kind: string): number | null {
  const family = CENTRELINE_SPECIMENS[kind];
  if (!family) return null;
  return ((family.positive - family.negative) * 100) / family.resolutionPts;
}

/**
 * THE INSTRUMENT'S OWN RESOLUTION — what one pixel of boundary is worth, as a
 * fraction of the thing being measured.
 *
 * A Chebyshev distance transform, two passes, exact for this metric. The
 * returned fraction is the share of a mask's area that sits one pixel from its
 * own edge: erode the shape by a single pixel and that is what disappears.
 *
 *   a solid disc, r=20     12.4%   —  a boundary disagreement costs a few points
 *   a one-pixel line      100.0%   —  a boundary disagreement costs everything
 *   the founder's hoop     66.7%   —  two-thirds of it IS its own outline
 *
 * Those first two are the controls, driven in the test file before this
 * function is allowed to say anything about a hoop; the third is the reading
 * that made it necessary.
 */
export function shellFraction(mask: Mask): number {
  const { width, height, data } = mask;
  const BIG = 1 << 20;
  const distance = new Int32Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    distance[index] = data[index]! > 0 ? BIG : 0;
  }
  const at = (x: number, y: number) => (
    x < 0 || y < 0 || x >= width || y >= height ? 0 : distance[y * width + x]!
  );
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (distance[y * width + x] === 0) continue;
      distance[y * width + x] = Math.min(
        distance[y * width + x]!,
        at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1, at(x + 1, y - 1) + 1,
      );
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      if (distance[y * width + x] === 0) continue;
      distance[y * width + x] = Math.min(
        distance[y * width + x]!,
        at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1, at(x - 1, y + 1) + 1,
      );
    }
  }
  let area = 0;
  let shell = 0;
  for (let index = 0; index < distance.length; index += 1) {
    const depth = distance[index]!;
    if (depth === 0) continue;
    area += 1;
    if (depth === 1) shell += 1;
  }
  return area === 0 ? 0 : shell / area;
}

/**
 * THE GAP THIS READING'S BAR WOULD HAVE TO DIVIDE — and it is measured, never
 * chosen.
 *
 * With specimens the gap is the distance the instrument was SHOWN able to
 * separate: hair's 94.6% complete against its 12.5% fringe, 82.1 points.
 *
 * With none, the reading itself is what would be adopted as the bar, and the
 * least a bar must do is tell its own crop apart from a complete one. So the
 * gap is this crop's shortfall — `1 − coverage`. Nothing is picked.
 *
 * **The first version of this used half the range as the fallback and it was
 * wrong in the most instructive way: measured against the founder's own hoops it
 * did not fire.** Their regions read 41.8% and 49.3% one-pixel edge — enormous,
 * and both under a half. The constant was doing all the work and doing it badly;
 * the shortfall is 34.8 and 46.0 points, and against those the same resolutions
 * are decisive. A rule that does not fire on the specimen that produced it is a
 * checker that cannot fail, wearing a derivation.
 */
export function adjudicatedGapFor(kind: string, coverage: number): number {
  const specimens = COMPLETENESS_SPECIMENS[kind];
  return specimens ? specimens.positive - specimens.negative : 1 - coverage;
}

export type CoverageReading = {
  /** `|crop ∩ region| / |region|` — how much of the subject the crop contains. */
  coverage: number;
  /** `|crop \ region| / |crop|` — how much of the crop is not the subject. */
  spill: number;
  regionPixels: number;
  cropPixels: number;
};

/**
 * Score a crop's mask against a full-frame region read.
 *
 * The crop's mask is in its own box's coordinates; the region is the whole
 * frame. Walking the box and offsetting into the frame is the arithmetic, and
 * it is the arithmetic the identity control exists to check: a bbox error would
 * drive coverage down and spill up together.
 */
export function measureCoverage(
  crop: { mask: Mask; box: SegmentBox },
  region: Mask,
): CoverageReading {
  let intersect = 0;
  let cropPixels = 0;
  for (let y = 0; y < crop.box.height; y += 1) {
    for (let x = 0; x < crop.box.width; x += 1) {
      if (crop.mask.data[y * crop.mask.width + x] === 0) continue;
      cropPixels += 1;
      const frameX = crop.box.x + x;
      const frameY = crop.box.y + y;
      if (frameX < 0 || frameY < 0 || frameX >= region.width || frameY >= region.height) continue;
      if (region.data[frameY * region.width + frameX]! > 0) intersect += 1;
    }
  }
  let regionPixels = 0;
  for (let index = 0; index < region.width * region.height; index += 1) {
    if (region.data[index]! > 0) regionPixels += 1;
  }
  return {
    coverage: regionPixels === 0 ? 0 : intersect / regionPixels,
    spill: cropPixels === 0 ? 0 : (cropPixels - intersect) / cropPixels,
    regionPixels,
    cropPixels,
  };
}

/**
 * WHICH INSTRUMENT PRODUCED THE VERDICT — and it is one field, not a convention.
 *
 * Two measures live at this door and they answer different questions of the same
 * two masks: `area` is `|crop ∩ region| / |region|`, `centreline` is
 * `|dilate(crop,1) ∩ thin(region)| / |thin(region)|`. A row recording 97.6%
 * without saying which of them read it is the display default doing two jobs —
 * the class this campaign keeps paying for — so the number, its bar and its
 * instrument travel together in {@link Adjudication} and are persisted from it
 * without a conditional at the write.
 */
/*
  A THIRD, AND IT IS NOT A MEASURE OF THE SAME KIND.

  `area` and `centreline` both score a crop against an independent READ of its
  region, and both can be wrong about a boundary. `derived-geometry` scores a
  composed region against the masks that composed it: the crop is complete iff
  its box holds every pixel the derivation kept, counted, never sampled. It
  reaches 1.0 or it refuses, and its bar is 1.0, because there is nothing here
  for a threshold to divide. It is named rather than folded into `area` so a row
  reading 100% says which of three instruments read it — the display-default
  class this campaign keeps paying for.
*/
export type GuardInstrument = "area" | "centreline" | "derived-geometry";

export type Adjudication = {
  instrument: GuardInstrument;
  /** The reading that decided — in the deciding instrument's own units. */
  coverage: number;
  /** The bar it was measured against, from that instrument's specimen family. */
  threshold: number;
};

export type GuardPass = {
  ok: true;
  kind: string;
  /** The AREA reading, always taken and always real — `spill` in particular is
   *  instrument-independent and is what says a crop strayed outside its region. */
  reading: CoverageReading;
  /** What actually decided. Persist from here; never re-derive it. */
  judged: Adjudication;
  /**
   * ACCEPTED AT THE CEILING BY POLICY, not passed by a bar (fable-306).
   *
   * A crop reading exactly 1.0 covers every pixel of an independent second read
   * of its own region, so there is no shortfall left for any threshold to
   * divide. The first build of this routed such a crop to the centreline family
   * and reported `instrument: centreline, threshold 0.976` — and that check
   * CANNOT FAIL at the ceiling (`thin(region) ⊆ region ⊆ crop`, driven in the
   * test), so the row would have worn a measured bar's name over an affirmative
   * with no possible negative.
   *
   * The true sentence is the policy: **accepted because a second read agreed
   * with the crop on every pixel, on a kind whose completeness family is
   * measured.** The flag is what keeps these rows out of any later count of
   * bar-measured specimens — they are not evidence about where a bar should sit.
   */
  ceilingAccepted?: true;
};

/**
 * EVERY WAY THE DOOR SAYS NO — one entry per refusal, carrying everything true
 * about it (fable-486 (f)).
 *
 * # Why this is one table now
 *
 * It was three hand-kept lists — the reasons, the ones whose pixels are kept,
 * and the one whose row is evidence rather than a version — and their own
 * comments called the overlap a trap. Three lists mean three places to edit
 * when a refusal is added and three chances to add it to two of them: the
 * classic shape this program keeps paying for, in miniature.
 *
 * So each refusal states its own properties, and the lists below are DERIVED.
 * A new reason cannot be filed without answering both questions, because the
 * type will not let it.
 *
 * # The two properties, and they are genuinely different questions
 *
 * `keepsCrop` — is this a refusal that exists to be settled by a human looking
 * at the picture? Then the pixels are kept for that person. The other four
 * refuse a picture that must not be adopted, and keeping those would build a
 * gallery of exactly the crops the guard exists to keep out.
 *
 * `evidenceOnly` — is this row a QUESTION parked beside the pixels that answer
 * it, rather than an account of what the feature is? Only `disputedDelivery`
 * is: the render that raised it delivered no verified account of the feature at
 * all, so the fold must skip it and leave the slot's previous version newest.
 * `noSpecimen` IS a version — that render earned its slot, the words moved on,
 * and a crop nobody could certify is honestly reported as words with no
 * picture. They coincide on one reason today and are not one property.
 */
export const GUARD_REFUSALS = {
  subjectAbsent: {
    keepsCrop: false,
    evidenceOnly: false,
    why: "a crop of where the thing would have been",
  },
  readDidNotSettle: {
    keepsCrop: false,
    evidenceOnly: false,
    why: "it scored nothing at all",
  },
  noSpecimen: {
    keepsCrop: true,
    evidenceOnly: false,
    why: "the kind has no measured positive, so the guard cannot say what complete "
      + "looks like here — the crop is the only thing that can teach it",
  },
  underCaptured: {
    keepsCrop: false,
    evidenceOnly: false,
    why: "measured against a real bar and refused correctly",
  },
  duplicateOfSlot: {
    keepsCrop: false,
    evidenceOnly: false,
    why: "its bytes are already at another slot",
  },
  disputedDelivery: {
    keepsCrop: true,
    evidenceOnly: true,
    why: "the ask wrote this facet and the reader said it did not land — the crop is "
      + "the only thing that can say which of the two was wrong, and the row is that "
      + "question rather than an account of the feature",
  },
  notScorableByArea: {
    keepsCrop: true,
    evidenceOnly: false,
    why: "the shape is mostly its own outline, so coverage cannot divide anything on it "
      + "— only an eye can say whether this crop is the whole of the metal",
  },
  mouthOpen: {
    keepsCrop: false,
    evidenceOnly: false,
    why: "the frame she was delivered on is smiling, so a crop of her lips holds her "
      + "TEETH — and every later render would be handed that as what her lips are, "
      + "smuggling an expression into an identity reference (fable-493). The row files "
      + "its words and the crop waits for the next closed-mouth render",
  },
  /*
    THE OPEN LANE'S TWO, AND THEY ARE DIFFERENT FAILURES (OPEN_LANE_DESIGN_NOTE
    §4, step 3).

    A kind nobody catalogued has no specimen family, so nothing here can say
    what complete looks like. What CAN be asked is whether the reader is a
    reader for this kind at all: the same question, of a frame that does not
    hold the thing. Decline there and the crop is a picture of something;
    answer there and it is a small confident region of forehead that would ride
    every later render as a permanent instruction to paint nothing, in a place,
    forever.

    Neither keeps its pixels, and that is deliberate rather than incidental. A
    kept crop is one a human may adopt as a specimen — and both of these are
    crops nobody can say contain their subject, which is the same ground
    `subjectAbsent` is refused on. `noSpecimen` keeps its pixels because the
    crop is the only thing that can TEACH the bar; here there is no bar being
    taught, and a gallery of maybe-nothing is the one thing §4 exists to
    prevent.
  */
  absenceUnproven: {
    keepsCrop: false,
    evidenceOnly: false,
    why: "the same reader answered this question on a frame that does not hold the thing, "
      + "so an answer on the delivered frame is not evidence — an affirmative from an "
      + "instrument never seen to decline is not evidence either",
  },
  absenceUnread: {
    keepsCrop: false,
    evidenceOnly: false,
    why: "the control could not be RUN — no before-picture, or no reader to ask it of. A "
      + "no-read is evidence of nothing, and the one door where that would otherwise "
      + "become a confident yes is this one",
  },
  brokenOutline: {
    keepsCrop: true,
    evidenceOnly: false,
    why: "the length instrument judged it and found part of the centreline outside the "
      + "crop — but that bar stands on one positive with a 1.4x margin, and a bar that "
      + "thin has to be falsifiable by the thing it turns away. This is the one refusal "
      + "kept because the REFUSAL may be wrong rather than because the crop is "
      + "unjudgeable; when the bar earns more positives it joins `underCaptured`",
  },
} as const satisfies Record<string, { keepsCrop: boolean; evidenceOnly: boolean; why: string }>;

/**
 * The reasons themselves, derived — the library row RECORDS this string
 * (migration 0029), and a stored value whose legal set lives only in a type
 * annotation is a column nobody can validate at the write.
 */
export const GUARD_REFUSAL_REASONS = Object.keys(GUARD_REFUSALS) as Array<keyof typeof GUARD_REFUSALS>;

export type GuardRefusalReason = keyof typeof GUARD_REFUSALS;

/** The refusals whose PIXELS are kept (fable-214 option (ii), fable-220 §3). */
export const REFUSALS_THAT_KEEP_THEIR_CROP: readonly GuardRefusalReason[] =
  GUARD_REFUSAL_REASONS.filter((reason) => GUARD_REFUSALS[reason].keepsCrop);

export function refusalKeepsItsCrop(reason: GuardRefusalReason): boolean {
  return GUARD_REFUSALS[reason].keepsCrop;
}

/**
 * THE REFUSAL WHOSE ROW IS EVIDENCE AND NOT A VERSION (`referenceLibrary`'s fold).
 *
 * Derived, and asserted singular: the fold reads ONE reason, and a second one
 * appearing here without that fold learning about it would quietly stop a crop
 * riding into every prompt.
 */
const EVIDENCE_ONLY = GUARD_REFUSAL_REASONS.filter((reason) => GUARD_REFUSALS[reason].evidenceOnly);
export const REFUSAL_THAT_IS_EVIDENCE_ONLY: GuardRefusalReason = EVIDENCE_ONLY[0]!;

export type GuardRefusal = {
  ok: false;
  reason: GuardRefusalReason;
  kind: string;
  detail: string;
  /** Present when a reading happened — a refusal nobody can diagnose is a
   *  refusal somebody will disable. */
  reading?: CoverageReading;
  /** Present when an instrument reached a verdict — so a refused row records the
   *  number in the units of the measure that refused it, not in the other one's. */
  judged?: Adjudication;
};

export type GuardVerdict = GuardPass | GuardRefusal;

export type GuardInput = {
  /** The specimen family whose threshold applies — `hair`, `lips`, `earring`. */
  kind: string;
  /** The proposed crop, as cut. */
  crop: { mask: Mask; box: SegmentBox };
  /** Digest of the crop's bytes, for the duplicate check. */
  digest: string;
  /**
   * A SECOND, INDEPENDENT full read of this crop's region on the frame the crop
   * claims to represent.
   *
   * The guard performs it through {@link mintGuardedReference}'s injected reader
   * rather than accepting one from the caller, because a guard handed its
   * subject's own read is the checker that cannot fail (fable-173). `null` means
   * the read did not settle, which is not the same as finding nothing.
   */
  guardRead: Mask | null;
  /** Digests already in the library, by slot. Two rows may not hold one fact. */
  mintedDigests?: ReadonlyMap<string, string>;
  /**
   * THIS ASK WROTE THE FACET AND THE RENDER'S OWN READER DISPUTED IT.
   *
   * Not a property of the crop — a property of the render behind it. It arrives
   * here rather than being applied to the verdict afterwards so that the whole
   * precedence lives in one function: the three refusals ABOVE it are about
   * whether this is a real, unique picture of the subject at all, and they win,
   * because a crop of nothing settles nothing. Everything BELOW it is a
   * completeness judgement, and no completeness number can decide a question
   * about delivery.
   */
  disputed?: boolean;
  /**
   * THE CEILING IS THE WHOLE BAR FOR THIS CROP — the open lane's one input
   * (OPEN_LANE_DESIGN_NOTE §4, step 3).
   *
   * Set by a caller that has ALREADY run the absence control and had the
   * reader decline on a frame without the thing. It widens exactly one clause
   * — the ceiling exemption — and it widens it by a policy the caller can
   * justify rather than by a name this module would have to recognise. Below
   * the ceiling it changes nothing: a sub-1.0 reading on a kind with no family
   * still refuses `noSpecimen`, keeps its pixels, and waits for the specimen
   * only a human can supply.
   *
   * It is an assertion about a CONTROL HAVING RUN, so it is deliberately not
   * derivable here: this module cannot see the before-picture and must not
   * infer that somebody looked at one.
   */
  ceilingIsTheBar?: true;
};

/**
 * WHICH SLOT ALREADY HOLDS THESE EXACT BYTES — one rule, two doors.
 *
 * `marks` and `makeup` at `face skin` produced byte-identical crops on three
 * separate production renders, and two rows holding one fact is D-242 one layer
 * up. The check is trivial and that is precisely why it needs to live in one
 * place: the geometric door (a composed region, judged by arithmetic) and the
 * measured door (a segmented region, judged by a specimen) reach entirely
 * different verdicts and must reach the SAME one here. A second copy of five
 * lines is still law 4's copy.
 */
export function duplicateSlotFor(
  digest: string,
  mintedDigests?: ReadonlyMap<string, string>,
): string | null {
  const held = Array.from(mintedDigests?.entries() ?? []).find(([, other]) => other === digest);
  return held ? held[0] : null;
}

export function guardReference(input: GuardInput): GuardVerdict {
  if (input.guardRead === null) {
    return {
      ok: false, reason: "readDidNotSettle", kind: input.kind,
      detail: `the guard's read of ${input.kind} did not settle, so nothing here is evidence either way`,
    };
  }

  const reading = measureCoverage(input.crop, input.guardRead);

  if (reading.regionPixels === 0) {
    /*
      fable-181. The frame does not wear the thing, so any crop of it is a
      picture of where the thing would have been — which is a fabrication with a
      well-formed bounding box.
    */
    return {
      ok: false, reason: "subjectAbsent", kind: input.kind, reading,
      detail: `the frame carries no ${input.kind}, so a crop of it would be a reference to nothing`,
    };
  }

  const duplicate = duplicateSlotFor(input.digest, input.mintedDigests);
  if (duplicate) {
    return {
      ok: false, reason: "duplicateOfSlot", kind: input.kind, reading,
      detail: `this crop is byte-identical to ${duplicate}'s, and two slots may not hold one fact`,
    };
  }

  /*
    AND HERE, BEFORE ANY THRESHOLD IS CONSULTED (fable-220 §3).

    A disputed crop is refused however well it measures, because the question it
    fails is not a question about the crop. The ask wrote this facet; the render's
    own reader looked at the delivered frame and said the change is not there. Two
    things follow, and they are the whole design:

      the library does not move    an unverified delivery may not become what the
                                   next render KNOWS this feature is. The previous
                                   version stays newest and stays good — D-235's
                                   asymmetry, which the `earned` gate has always
                                   applied one layer up by filing nothing at all.
      the pixels stay              because "the reader was wrong" and "the painter
                                   was wrong" are indistinguishable from the row,
                                   and identical from every instrument we have.
                                   The crop is the artifact that separates them,
                                   and a human is the instrument.

    D-246 disarmed subtle-quality detectors as gates on money. This is the same
    class one layer down, gating PIXELS: billing and delivery are untouched
    (D-187/D-246 — the ask stayed delivered and charged), and all that changes is
    that a disputed facet's crop now has an afterlife for human eyes.
  */
  if (input.disputed) {
    return {
      ok: false, reason: "disputedDelivery", kind: input.kind, reading,
      detail: `this render's reader disputed that the ask landed on ${input.kind}; the crop reads ${(reading.coverage * 100).toFixed(1)}% and is kept for a human rather than adopted`,
    };
  }

  /*
    AND HERE THE INSTRUMENT IS ASKED WHETHER IT APPLIES AT ALL — fable-224's
    standing law: **a verdict inside its own resolution is not a verdict.**

    Coverage is `|crop ∩ region| / |region|`, so one pixel of disagreement about
    where the subject's edge runs moves the number by the REGION's own shell
    fraction. The denominator is what decides that, which is why the region is
    measured here and not the crop — though on the specimens that produced this
    rule the two are within a point of each other, both being the same hoop.

    It is ONE comparison, against the gap this reading's bar would have to
    divide (`adjudicatedGapFor`) — measured in both arms, never chosen.

    ONE EXEMPTION, and it is not a fudge: **a reading at the ceiling is always
    scorable.** A crop holding 100% of an independent read of its own region is
    as complete as this instrument can ever certify; there is no shortfall for
    the uncertainty to swallow, so there is nothing for it to be uncertain about.
    Without that clause every perfect crop would be refused for having a gap of
    zero, which is the degenerate reading of the rule rather than the rule.

    Measured on the founder's own hoops, which is what this exists for:

      earring@left    region 41.8% edge   shortfall 34.8 pts   → not scorable
      earring@right   region 49.3% edge   shortfall 46.0 pts   → not scorable
      hair (v#163)    a solid blob        gap 82.1 pts measured → scores fine

    Costs nothing: two passes over a mask the guard already holds, no vision
    call. And the number is recomputable from the stored mask at any time, which
    is why it needs no column of its own.
  */
  const resolution = shellFraction(input.guardRead);
  const gap = adjudicatedGapFor(input.kind, reading.coverage);

  /*
    ================== AT THE CEILING, THE LENGTH BAR JUDGES ==================
    (fable-305, from the five-ask proof's four refusals — 2026-08-12.)

    The clause below reads `coverage < 1` because §2.4b's ceiling exemption has
    already answered the not-scorable question for a perfect reading. But that
    same `< 1` also carried a crop AT the ceiling straight past the centreline
    instrument and into the area path, where `earring` has no specimen — so a
    hoop crop holding 100% of its own region was refused `noSpecimen`, while a
    hoop crop holding 97% could be judged and passed.

    **The better the cut, the more certainly the library refused to carry it.**

    The corner was written down where it happens and dismissed as "a synthetic
    case rather than a reachable one". It is not: **the first real walk on the
    repaint road landed in it 4 times out of 4** (dev cand 358, v#147 and v#148,
    both earring slots, every reading exactly 1.0000, every crop a whole hoop
    with its cross drop intact) — and because a repaint carries features by
    CROP, those four refusals are why that walk's recipes sent the master alone
    and why two later steps refused for a missing pair. A dismissal survived a
    year because nobody wrote its test.

    So the ceiling gets its own clause, and it is stated as the POLICY it is
    rather than dressed as a second measurement (fable-306).

    The first build of this routed a ceiling reading to the centreline family, on
    the argument that the crop "still has to prove its spine runs within a pixel
    of itself". It does not: `thin(region) ⊆ region ⊆ crop` when coverage is 1,
    so the length bar passes before its dilation is applied. A verdict reporting
    `instrument: centreline, threshold 0.976` about a check that cannot fail
    would be an affirmative with no possible negative wearing a measured bar's
    name — the class this campaign exists to kill. So:

      - it ACCEPTS, and says so. `ceilingAccepted` marks the row, so a later
        count of bar-measured specimens cannot silently include crops no bar
        ever divided.
      - it invents no number. The bar it reports is the ceiling itself — 1.0
        against a reading of 1.0 — which is the comparison that actually
        happened.
      - **the SCOPE is the whole difference from accepting everything**: only a
        kind whose completeness family is MEASURED is accepted here. A kind with
        no specimen anywhere still refuses `noSpecimen` at 100%, driven, because
        for that kind we cannot yet say what complete means at all.
      - the sliver trap stays dead by arithmetic rather than by care: a thin
        sliver through a disc scores high by LENGTH and cannot read 1.0 by AREA,
        so it can never arrive here.
  */
  /*
    AND THE OPEN LANE ARRIVES AT THE SAME CLAUSE FROM THE OTHER SIDE
    (OPEN_LANE_DESIGN_NOTE §4 / OPEN_LANE_CARRY_DESIGN §5, ruled fable-766 §2).

    The scope bullet above says a kind with no specimen anywhere refuses at
    100% "because for that kind we cannot yet say what complete means at all."
    That is right about the FAMILY and it over-reaches by one case, and the
    case is the whole open lane: at a reading of exactly 1.0 the crop holds
    every pixel of an independent second read of its own region, so there is no
    shortfall left for any bar to divide — a family would tell us nothing we do
    not already know. What a family WOULD still catch is the other failure, the
    one where both reads are answering about nothing; and that failure has its
    own instrument now, in front of this one, which is what `ceilingIsTheBar`
    says has already run.

    So the caller asserts the control, never the kind: no name is special here,
    and a kind that acquires a family later simply stops needing the flag.
  */
  if (reading.coverage >= 1 && (CENTRELINE_SPECIMENS[input.kind] || input.ceilingIsTheBar)) {
    return {
      ok: true,
      kind: input.kind,
      reading,
      /* The area instrument is what read it, and the bar it cleared is the
         ceiling. Reporting the centreline's 0.976 here would attribute the pass
         to a family that did not decide it. */
      judged: { instrument: "area", coverage: reading.coverage, threshold: 1 },
      ceilingAccepted: true,
    };
  }

  if (reading.coverage < 1 && resolution >= gap) {
    /*
      AND HERE THE SECOND INSTRUMENT GETS ITS TURN — §2.4c, ruled in fable-228.

      **The routing is a MEASUREMENT, not a name.** fable-228 scoped the earring
      bar to "ring-like only — studs and solid earrings stay with the area
      instrument, which works on them", and the way that is enforced is that this
      branch is only reached when the area instrument has just declared itself
      inapplicable ON THIS REGION: the region is so nearly all edge that one pixel
      of boundary outweighs the whole gap a bar here would divide. A stud's region
      is a blob, its shell fraction is small, and it never arrives — it takes the
      area path and refuses with `noSpecimen` until somebody measures a stud.

      That matters more than it looks. The length measure's failure mode is
      exactly the silhouette-for-material confusion: a thin sliver through the
      middle of a solid disc runs along the whole of that disc's skeleton and
      holds a tenth of its material, so a centreline bar applied to a blob would
      wave through a crop that keeps the centre and loses the thing. The shell
      fraction is what keeps blobs out, and it is measured on the region the guard
      already holds, per crop, at no cost.

      THE CORNER THIS USED TO CALL SYNTHETIC — closed above, 2026-08-12.

      A crop whose AREA reading is exactly 1.0 takes §2.4b's ceiling exemption
      and cannot satisfy `coverage < 1`, so it never reached here and refused
      with `noSpecimen` where the length instrument would have judged it. This
      comment said that required "two independent vision reads to agree on every
      pixel of a hoop", called it "a synthetic case rather than a reachable one",
      and left it. Two vision reads agreeing on every pixel of a 19×66 hoop is
      not the coincidence it sounds like — both reads are asked about the same
      small, high-contrast object, and agreement is the ordinary outcome.

      **It is the corner every mint on the repaint road lands in.** The first
      real walk of that road hit it 4 times out of 4, and because a repaint
      carries features by crop rather than by paste, those refusals cost that
      walk its earrings and two later steps their delivery. The clause above now
      ACCEPTS a ceiling reading on a kind with a measured family, marked
      `ceilingAccepted` (fable-305, revised by fable-306), and the corner has the
      test it never had. `noSpecimen` keeping its crop is what made the finding
      cheap to prove — the pixels were still there to look at.
    */
    const family = CENTRELINE_SPECIMENS[input.kind];
    if (!family) {
      return {
        ok: false, reason: "notScorableByArea", kind: input.kind, reading,
        detail: `${(resolution * 100).toFixed(1)}% of this ${input.kind} region is one-pixel edge, so a single pixel of boundary is worth more than the ${(gap * 100).toFixed(1)} points a bar here would have to divide; ${(reading.coverage * 100).toFixed(1)}% is not a verdict on this shape`,
      };
    }
    const length = measureCentreline(input.crop, input.guardRead);
    const judged: Adjudication = {
      instrument: "centreline", coverage: length.coverage, threshold: family.positive,
    };
    if (length.coverage < family.positive) {
      /*
        Refused, and the PIXELS ARE KEPT — the specimen-event clause is the
        reason, and it is the opposite of `underCaptured`'s. Hair's bar refuses
        against 82.1 points and 14 audited rows; this one refuses against 23.6
        points and a single positive. So the detail names its own weakness — the
        count it rests on and the defect it is blind to — on the same line as the
        number, and the crop survives for the eye that can overturn it.
      */
      return {
        ok: false, reason: "brokenOutline", kind: input.kind, reading, judged,
        detail: `${(length.coverage * 100).toFixed(1)}% of this ${input.kind}'s own centreline runs within a pixel of the crop, under the ${(family.positive * 100).toFixed(1)}% of the one crop proven complete (n=${family.positives}, ${length.spinePixels} px of spine); this bar is blind to ${CENTRELINE_BLIND_TO}, so an eye that calls this crop complete overturns it`,
      };
    }
    return { ok: true, kind: input.kind, reading, judged };
  }

  const threshold = thresholdFor(input.kind);
  if (threshold === null) {
    /*
      No positive specimen for this kind. The guard cannot say what complete
      looks like here, and borrowing hair's number would be a measurement about
      hair adjudicating a lip. So it refuses — visibly, with the reading
      attached, so the refusal is also the thing that produces the specimen.
    */
    return {
      ok: false, reason: "noSpecimen", kind: input.kind, reading,
      detail: `${input.kind} has no completeness specimen yet; it read ${(reading.coverage * 100).toFixed(1)}% and no number here is earned`,
    };
  }

  if (reading.coverage < threshold) {
    return {
      ok: false, reason: "underCaptured", kind: input.kind, reading,
      detail: `${input.kind} crop covers ${(reading.coverage * 100).toFixed(1)}% of its own region, under the ${(threshold * 100).toFixed(1)}% proven complete`,
    };
  }

  return {
    ok: true, kind: input.kind, reading,
    judged: { instrument: "area", coverage: reading.coverage, threshold },
  };
}

/**
 * Reads a region on a frame. `null` when the reading did not settle.
 *
 * `side` narrows the question to one instance of a bilateral region, and it is
 * not decoration: a crop of `earring@left` scored against a read of BOTH hoops
 * measures about half of a region it fully contains, and the guard would file
 * that number as the kind's first specimen. A reader that cannot scope to a
 * side must return `null` when asked for one — `readDidNotSettle` is the honest
 * outcome, and it is the one refusal that records no number at all.
 */
export type RegionReader = (
  input: { frame: Buffer; question: string; side?: Instance },
) => Promise<Mask | null>;

export type MintInput = {
  kind: string;
  /** The segmentation question that names this kind's region. */
  question: string;
  /** Which instance of it, for a slot that is one of a pair. */
  side?: Instance;
  /** The frame the crop claims to represent — the one the guard reads. */
  frame: Buffer;
  crop: { mask: Mask; box: SegmentBox };
  digest: string;
  mintedDigests?: ReadonlyMap<string, string>;
  /** This ask wrote the facet and the render's reader disputed the delivery. */
  disputed?: boolean;
  /** The absence control has run and the reader declined — see
   *  {@link GuardInput.ceilingIsTheBar}. */
  ceilingIsTheBar?: true;
};

/**
 * Mint a reference, or refuse it — with the guard's read taken HERE.
 *
 * The independence is structural rather than promised: the caller supplies a
 * reader, not a read, so it cannot hand the guard the same mask that cut the
 * crop. **It costs one vision call per reference minted**, and that is the
 * declared price of the fringe never entering the library again.
 */
export async function mintGuardedReference(
  input: MintInput,
  read: RegionReader,
): Promise<GuardVerdict> {
  let guardRead: Mask | null = null;
  try {
    guardRead = await read({ frame: input.frame, question: input.question, side: input.side });
  } catch {
    guardRead = null; /* a throw is a reading that did not happen, not a no */
  }
  return guardReference({
    kind: input.kind,
    crop: input.crop,
    digest: input.digest,
    guardRead,
    mintedDigests: input.mintedDigests,
    disputed: input.disputed,
    ...(input.ceilingIsTheBar ? { ceilingIsTheBar: input.ceilingIsTheBar } : {}),
  });
}
