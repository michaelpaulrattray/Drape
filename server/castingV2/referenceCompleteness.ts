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
  source: string;
};

export const COMPLETENESS_SPECIMENS: Readonly<Record<string, CompletenessSpecimens>> = {
  hair: {
    positive: 0.946,
    negative: 0.125,
    source: "D-243 store audit: the delivered-anchored cut of v#163 against row 13, the founder's fringe",
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
  return specimens ? specimens.positive : null;
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
export type GuardInstrument = "area" | "centreline";

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
};

/**
 * Every way the door says no, in one list.
 *
 * Named rather than inlined because the library row now RECORDS the reason
 * (migration 0029), and a stored string whose legal values live only inside a
 * type annotation is a column nobody can validate at the write.
 */
export const GUARD_REFUSAL_REASONS = [
  "subjectAbsent",
  "readDidNotSettle",
  "noSpecimen",
  "underCaptured",
  "duplicateOfSlot",
  "disputedDelivery",
  "notScorableByArea",
  "brokenOutline",
] as const;

export type GuardRefusalReason = typeof GUARD_REFUSAL_REASONS[number];

/**
 * The refusals whose PIXELS are kept (fable-214 option (ii), fable-220 §3).
 *
 * Both are refusals that exist **in order to be settled by a human looking at
 * the picture**, and neither is a judgement that the crop is bad:
 *
 *   `noSpecimen`         the kind has no measured positive, so the guard cannot
 *                        say what complete looks like here. The crop is the only
 *                        thing that can teach it.
 *   `disputedDelivery`   the ask wrote this facet and the reader said it did not
 *                        land. The crop is the only thing that can say which of
 *                        the two was wrong.
 *   `notScorableByArea`  the shape is mostly its own outline, so coverage cannot
 *                        divide anything on it. Only an eye can say whether this
 *                        crop is the whole of the metal.
 *   `brokenOutline`      the length instrument DID judge it and found part of the
 *                        region's centreline outside the crop — but that bar
 *                        stands on one positive with a 1.4× margin, and its own
 *                        specimen-event clause (§2.4c) says the first crop an eye
 *                        calls complete that it refuses re-opens the family. A
 *                        bar that thin has to be falsifiable by the thing it
 *                        turns away, and it can only be falsified by an eye on
 *                        the picture. This is the one refusal kept because the
 *                        REFUSAL may be wrong, rather than because the crop is
 *                        unjudgeable — and when the bar earns more positives, it
 *                        should move to the discarding side and join
 *                        `underCaptured`.
 *
 * The other four refuse a picture that must not be adopted: `subjectAbsent` is a
 * crop of where the thing would have been, `duplicateOfSlot` already has its
 * bytes at another slot, `underCaptured` was measured against a real bar and
 * refused correctly, and `readDidNotSettle` scored nothing at all. Keeping any
 * of those would build a gallery of exactly the crops the guard exists to keep
 * out, and put it in front of the one person able to adopt them.
 */
export const REFUSALS_THAT_KEEP_THEIR_CROP: readonly GuardRefusalReason[] = [
  "noSpecimen",
  "disputedDelivery",
  "notScorableByArea",
  "brokenOutline",
];

export function refusalKeepsItsCrop(reason: GuardRefusalReason): boolean {
  return REFUSALS_THAT_KEEP_THEIR_CROP.includes(reason);
}

/**
 * THE REFUSAL WHOSE ROW IS EVIDENCE AND NOT A VERSION (`referenceLibrary`'s fold).
 *
 * Every other row this table holds is an account of what a feature IS, and the
 * newest one per (slot, role) is the branch's answer. A `disputedDelivery` row
 * is not that. It is a question — *did the ask land?* — parked beside the
 * pixels that answer it, and the render that raised it delivered no verified
 * account of the feature at all.
 *
 * So the fold skips it, and the consequence is the point: **the slot's previous
 * version stays newest and stays good.** Without this the row would be the
 * newest carry row, it carries no `storageKey`, and the crop that was riding
 * into every prompt would silently stop — a disputed ask quietly changing what
 * the painter sees on the NEXT paid render. That is delivery, and fable-220 §3
 * ruled delivery untouched: only the pixels gain an afterlife.
 *
 * Named separately from {@link REFUSALS_THAT_KEEP_THEIR_CROP} because it is a
 * different property that happens to coincide on one reason today. `noSpecimen`
 * IS a version — that render earned its slot, the words moved on, and a crop
 * nobody could certify is honestly reported as a slot with words and no picture.
 */
export const REFUSAL_THAT_IS_EVIDENCE_ONLY: GuardRefusalReason = "disputedDelivery";

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
};

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

  const duplicate = Array.from(input.mintedDigests?.entries() ?? [])
    .find(([, digest]) => digest === input.digest);
  if (duplicate) {
    return {
      ok: false, reason: "duplicateOfSlot", kind: input.kind, reading,
      detail: `this crop is byte-identical to ${duplicate[0]}'s, and two slots may not hold one fact`,
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

      ONE DEGENERATE CORNER, deliberate and left alone: a crop whose AREA reading
      is exactly 1.0 takes §2.4b's ceiling exemption above and never reaches here,
      so on a hoop it refuses with `noSpecimen` where the length instrument would
      have passed it at 100%. It requires two independent vision reads to agree on
      every pixel of a hoop, so it is a synthetic case rather than a reachable
      one; the exemption is fable-224's standing law and is not moved to tidy a
      corner. `noSpecimen` keeps its crop, so nothing is lost when it happens.
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
  });
}
