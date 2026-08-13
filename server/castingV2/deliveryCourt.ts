/**
 * WHERE A CALIBRATED RULER SETTLES A DELIVERY DISPUTE (fable-429 §3).
 *
 * The founder asked for a narrower build. The render delivered one — the
 * narrowing is visible to an eye at full size, the render verifier passed it,
 * and `buildSpan` read the shoulders 10.9% narrower, at ninety times the body
 * bench's own floor. The caption reader looked at the same frame and wrote *"no
 * visible slimming edit"*, which disputed the delivery, which refused the crop,
 * which is why a paid build has been vanishing on the next edit since the day it
 * was possible to buy one.
 *
 * So this is the one narrow thing fable-429 granted, and the principle is its
 * own sentence: **where a calibrated ruler exists, a geometric fact is the
 * ruler's to judge — the reader keeps every question the ruler cannot answer.**
 *
 * # The four conditions, and where each one lives
 *
 *  1. **A court on record, cited by the catalogue.** Not "buildSpan adjudicates
 *     build" — the entry below carries the specimens, their count, the negative
 *     control and the source, because an instrument's NAME is not its
 *     calibration. {@link DELIVERY_COURTS}.
 *  2. **The reader's verdict is recorded beside the instrument's.** An
 *     adjudication never erases the dispute; it carries it
 *     ({@link DeliveryAdjudication.reader}). The disagreement is a distribution
 *     worth having — a reader failing twice on true geometry is a finding in
 *     progress, and it cannot be one if the losing verdict is dropped.
 *  3. **Facet-narrow forever.** A court covers the facets its instrument
 *     MEASURES and no others: `buildSpan` reads a shoulder span over a head
 *     height, so it may speak for `shoulders`, `arms` and `build`, and it may
 *     not speak for `bust` or `waist` — a waist can change without moving the
 *     widest row of the silhouette. No family inheritance: a second instrument
 *     earns its own court before it adjudicates anything.
 *  4. **Money is untouched.** D-235's asymmetry and D-246's rules are
 *     unchanged. This decides ONE thing — whether a crop may enter the library
 *     — and it can never reach a refund, a charge or a delivery verdict. The
 *     render was delivered and charged long before anything here runs.
 *
 * # The asymmetry is preserved, and it is the whole safety of this
 *
 * The instrument can only ever settle the dispute TOWARD delivery. Where its
 * reading does not clear the bar, nothing changes: the reader's refusal stands,
 * the crop is kept for a human exactly as it is today, and the library does not
 * move. A ruler that did not see a change has not proven there was none — that
 * is D-235 in the direction it matters, and it is why {@link DeliveryVerdict}
 * has no "the instrument agrees the ask failed" branch to be tempted by.
 */
import type { BuildSpan } from "./maskGeometry";

export type DeliveryCourt = {
  /** The instrument, by the name of the function that reads it. */
  instrument: string;
  /**
   * The facets this ruler may speak for — the ones it MEASURES.
   *
   * `bust` and `waist` are deliberately absent from `build`'s court: they are
   * the same catalogue row and a different measurement. A court that inherited
   * its slot's whole facet list would be adjudicating a waist by the width of a
   * shoulder, which is the wrong-boundary class wearing a calibration.
   */
  facets: readonly string[];
  /**
   * THE BAR: the smallest change, as a fraction of the anchor's reading, that
   * the instrument read on a render a human verdict called DELIVERED.
   *
   * The worst positive, exactly as `thresholdFor` takes the worst complete
   * crop — not a midpoint, which is a number nobody measured.
   */
  positive: number;
  /**
   * And the largest it read on a render whose ask never named this facet —
   * the wobble. The bench's floor arm: an unrelated FACE edit, no body ask
   * ever, measured on the same three faces.
   */
  negative: number;
  /** The instrument's own noise: the same file read twice. */
  identity: number;
  /** How many positives the bar rests on. Three is not many; three unstated is
   *  the problem. */
  positives: number;
  /**
   * WHAT THE ANCHOR HAS TO BE for the court to apply.
   *
   * The specimens are all `master → v1` on faces with no prior body edit, so
   * the court says nothing about a second body ask on a branch that already
   * carries a delivered build: there the anchor-to-delivered delta contains the
   * EARLIER purchase, and a ruler handed it would confirm a delivery this
   * render may never have made. Stated as a field rather than as a comment
   * because {@link adjudicateDelivery} refuses on it.
   */
  anchor: string;
  source: string;
};

/**
 * ONE COURT, and the list is meant to grow one measured instrument at a time.
 *
 * Keyed by the library SLOT whose crop the dispute is about, because that is
 * what the door is deciding — {@link DeliveryCourt.facets} is what keeps it
 * facet-narrow inside the slot.
 */
export const DELIVERY_COURTS: Readonly<Record<string, DeliveryCourt>> = {
  build: {
    instrument: "buildSpan",
    facets: ["shoulders", "arms", "build"],
    /* face-6, the smallest of the three signals. face-8 read 10.45% and face-2
       14.31%; the bar is the worst of them. */
    positive: 0.0776,
    /* face-2, the largest of the three floors. face-8 read 0.12% and face-6
       0.23% — which is why the same reading is 90x the floor on one face and
       13.7x on another, and why the bar is a signal rather than a multiple. */
    negative: 0.0105,
    identity: 0,
    positives: 3,
    anchor: "the frame this render was painted from, on a branch whose library holds no build crop yet — every specimen is master → first body edit",
    source: "bench-body-carrier (opus-326, ratified fable-422 §2): three production masters, "
      + "floor = an unrelated FACE edit with no body ask (0.12 / 0.23 / 1.05%), "
      + "signal = the body ask (10.45 / 7.76 / 14.31%), S/F 90.1 / 33.8 / 13.7, "
      + "negative control 0.00% on the same file read twice, direction correct on 3 of 3. "
      + "Live confirmation: dev #365 (shift 77) read 10.9% on a narrowing an eye confirmed at full size "
      + "and two vision readers denied",
  },
};

export function deliveryCourtFor(slot: string): DeliveryCourt | null {
  return DELIVERY_COURTS[slot] ?? null;
}

/**
 * How many times the wobble the bar is — derived, never stored beside it.
 *
 * A second number shadowing `positive / negative` is a copy, and a copy of a
 * bar drifts from the bar (law 4). `build` is 7.4: the smallest delivery this
 * instrument was shown is seven times the largest motion it read when nothing
 * was asked of the facet at all.
 */
export function courtSeparationFor(slot: string): number | null {
  const court = DELIVERY_COURTS[slot];
  return court && court.negative > 0 ? court.positive / court.negative : null;
}

/**
 * Whether every facet the reader disputed is one this court MEASURES.
 *
 * Every, not any: a slot disputed on `waist` and `shoulders` together is a
 * dispute this ruler can only half answer, and half an answer here would store
 * a crop on the strength of a facet nobody argued about.
 */
export function courtCovers(court: DeliveryCourt, facets: readonly string[]): boolean {
  return facets.length > 0 && facets.every((facet) => court.facets.includes(facet));
}

/** Why an instrument declined to adjudicate — never "it did not deliver". */
export type DeliveryDeclined =
  | "noCourt"
  | "facetOutsideCourt"
  | "anchorCarriesPriorDelivery"
  | "noReading"
  | "clipped"
  | "belowBar";

export type DeliveryVerdict =
  | {
    settled: true;
    /** The change the ruler read, as a fraction of the anchor's reading. */
    change: number;
    anchorRatio: number;
    deliveredRatio: number;
  }
  | { settled: false; declined: DeliveryDeclined; change?: number };

/**
 * WHAT THE ROW AND THE LOG BOTH CARRY — both verdicts, never one.
 *
 * `reader: "disputed"` is not decoration and it is not derivable later: this
 * type only ever exists because a reader said no, and dropping that would leave
 * a stored crop looking like an ordinary pass.
 */
export type DeliveryAdjudication = {
  slot: string;
  instrument: string;
  facets: readonly string[];
  reader: "disputed";
  verdict: DeliveryVerdict;
  /** The court's own bar, quoted onto the record with the reading it judged. */
  bar: number;
  source: string;
};

export function adjudicateDelivery(input: {
  court: DeliveryCourt;
  facets: readonly string[];
  anchor: BuildSpan | null;
  delivered: BuildSpan | null;
  anchorCarriesPriorDelivery: boolean;
}): DeliveryVerdict {
  if (!courtCovers(input.court, input.facets)) {
    return { settled: false, declined: "facetOutsideCourt" };
  }
  if (input.anchorCarriesPriorDelivery) {
    return { settled: false, declined: "anchorCarriesPriorDelivery" };
  }
  if (!input.anchor || !input.delivered || input.anchor.ratio <= 0) {
    /* A read that did not settle is not a reading, and a reading is the only
       thing that can overrule anybody (D-235). */
    return { settled: false, declined: "noReading" };
  }
  /* A silhouette touching both frame edges saturates the span at the frame
     width, so the same number arrives for every build there is. `buildSpan`
     reports that rather than hiding it, and a saturated reading may not
     adjudicate: the change could be any size behind the clip. */
  if (input.anchor.clipped || input.delivered.clipped) {
    return { settled: false, declined: "clipped" };
  }
  const change = (input.delivered.ratio - input.anchor.ratio) / input.anchor.ratio;
  /*
    THE MAGNITUDE, NOT THE DIRECTION.

    The bench asked for a narrowing on all three faces and got one on all three,
    so the direction arm is real — but the ask's direction is not available at
    this door, and inventing it from the slot's words would be a second parse of
    the instruction disagreeing with the first. The floor arm bounds spurious
    motion in BOTH directions (an unrelated face edit moved the ratio at most
    1.05%), so a change past the bar is a change no unrelated edit has been seen
    to produce, on a slot whose facets this ask wrote. That is the claim, and it
    is narrower than "the ask landed as asked".
  */
  if (Math.abs(change) < input.court.positive) {
    return { settled: false, declined: "belowBar", change };
  }
  return {
    settled: true,
    change,
    anchorRatio: input.anchor.ratio,
    deliveredRatio: input.delivered.ratio,
  };
}
