/**
 * THE COURT ITSELF — driven directly, before anything is allowed to cite it.
 *
 * This is the instrument that decides whether a calibrated ruler may overrule a
 * vision reader about a paid delivery, so it gets what every instrument in this
 * program gets before its verdicts count: a positive, a negative, and a case for
 * each way it must decline. Working law 2 — a checker that cannot fail proves
 * nothing, and this one is asked to fail in six distinct ways.
 */
import { describe, expect, it } from "vitest";

import {
  DELIVERY_COURTS, adjudicateDelivery, courtCovers, courtSeparationFor, deliveryCourtFor,
} from "./deliveryCourt";
import type { BuildSpan } from "./maskGeometry";

const court = DELIVERY_COURTS.build!;

/** A reading, with the ratio the only thing any case here varies. */
function span(ratio: number, clipped = false): BuildSpan {
  return { ratio, spanPx: Math.round(ratio * 400), headPx: 400, atRow: 0.7, clipped };
}

function adjudicate(options: {
  anchor?: BuildSpan | null;
  delivered?: BuildSpan | null;
  facets?: readonly string[];
  prior?: boolean;
} = {}) {
  return adjudicateDelivery({
    court,
    facets: options.facets ?? ["shoulders", "arms"],
    anchor: options.anchor === undefined ? span(2.286) : options.anchor,
    delivered: options.delivered === undefined ? span(2.037) : options.delivered,
    anchorCarriesPriorDelivery: options.prior ?? false,
  });
}

describe("the court on record", () => {
  it("carries its specimens, their count and its negative control — not just an instrument's name", () => {
    /* fable-429 §3 condition 1: the catalogue field CITES THE COURT. A cite is
       what a later reader grades the bar with; an instrument's name is what a
       later reader has to take on trust. */
    expect(court.instrument).toBe("buildSpan");
    expect(court.positives).toBe(3);
    expect(court.identity).toBe(0);
    expect(court.source).toContain("bench-body-carrier");
    expect(court.source).toContain("negative control 0.00%");
  });

  it("puts its bar above its own wobble by a margin it does not have to restate", () => {
    /* Derived, never stored beside the specimens: a second number shadowing
       `positive / negative` is a copy, and a copy of a bar drifts from it. */
    expect(court.positive).toBeGreaterThan(court.negative);
    expect(courtSeparationFor("build")).toBeCloseTo(court.positive / court.negative, 6);
    expect(courtSeparationFor("build")!).toBeGreaterThan(5);
    /* And the bar is the WORST delivered signal the bench read (face-6's
       7.76%), not the midpoint of anything. A midpoint is a number nobody
       measured. */
    expect(court.positive).toBeCloseTo(0.0776, 6);
    expect(court.negative).toBeCloseTo(0.0105, 6);
  });

  it("holds ONE court, and no kind inherits another's", () => {
    /* Condition 3: each instrument earns its own court before it adjudicates
       anything. A family that could inherit is a family that will. */
    expect(Object.keys(DELIVERY_COURTS)).toEqual(["build"]);
    expect(deliveryCourtFor("hair")).toBeNull();
    expect(deliveryCourtFor("earring@left")).toBeNull();
    expect(deliveryCourtFor("skin")).toBeNull();
  });

  it("speaks for the facets the ruler MEASURES and refuses the rest of its own row", () => {
    /*
      `build` is one catalogue row holding five facets; `buildSpan` reads the
      widest row of a silhouette. A waist can change without moving it at all,
      so a waist dispute is not this ruler's to settle even though it lands in
      this ruler's slot. The wrong-boundary class, caught at the one place it
      would enter wearing a calibration.
    */
    expect(courtCovers(court, ["shoulders"])).toBe(true);
    expect(courtCovers(court, ["shoulders", "arms", "build"])).toBe(true);
    expect(courtCovers(court, ["waist"])).toBe(false);
    expect(courtCovers(court, ["bust"])).toBe(false);
    /* EVERY, not any: half an answer here would store a crop on the strength
       of a facet nobody argued about. */
    expect(courtCovers(court, ["shoulders", "waist"])).toBe(false);
    /* And a dispute with no facets named is a dispute this ruler was never
       told the shape of. */
    expect(courtCovers(court, [])).toBe(false);
  });
});

describe("what the ruler settles", () => {
  it("settles a change past the bar, and reports the reading it settled on", () => {
    /* The live case: the founder's own walk read her shoulders 10.9% narrower
       on a frame two vision readers said was unchanged. */
    const verdict = adjudicate();
    expect(verdict.settled).toBe(true);
    if (!verdict.settled) throw new Error("unreachable");
    expect(verdict.change).toBeCloseTo((2.037 - 2.286) / 2.286, 6);
    expect(Math.abs(verdict.change)).toBeGreaterThan(court.positive);
    expect(verdict.anchorRatio).toBe(2.286);
    expect(verdict.deliveredRatio).toBe(2.037);
  });

  it("settles a broadening as readily as a narrowing, because the floor bounds both", () => {
    /* The direction of the ask is not available at this door and is not
       invented here. What the court measured is that an edit which never named
       this facet moved the ratio at most 1.05%, in whatever direction. */
    const verdict = adjudicate({ delivered: span(2.6) });
    expect(verdict.settled).toBe(true);
  });
});

describe("what the ruler declines — six ways, and each one leaves the reader's refusal standing", () => {
  it("declines a reading below the bar, and never confirms the reader instead", () => {
    /*
      D-235's asymmetry, in the direction that matters. A ruler that did not see
      a change has not proven there was none, so there is no "the instrument
      agrees the ask failed" verdict for anything downstream to act on — only a
      decline, which changes nothing.
    */
    const verdict = adjudicate({ delivered: span(2.286 * 0.96) });
    expect(verdict.settled).toBe(false);
    if (verdict.settled) throw new Error("unreachable");
    expect(verdict.declined).toBe("belowBar");
    /* The number it read is still on the record: a decline with no reading is
       indistinguishable from a decline with no instrument. */
    expect(verdict.change).toBeCloseTo(-0.04, 6);
  });

  it("declines a change one hair under the bar and settles one hair over it", () => {
    /* The bar is a real edge rather than a direction of travel — driven from
       both sides so a later widening of it cannot pass unnoticed. */
    const under = adjudicate({ delivered: span(2.286 * (1 - court.positive * 0.99)) });
    const over = adjudicate({ delivered: span(2.286 * (1 - court.positive * 1.01)) });
    expect(under.settled).toBe(false);
    expect(over.settled).toBe(true);
  });

  it("declines a facet outside its court", () => {
    const verdict = adjudicate({ facets: ["waist"] });
    expect(verdict.settled).toBe(false);
    if (verdict.settled) throw new Error("unreachable");
    expect(verdict.declined).toBe("facetOutsideCourt");
  });

  it("declines when the anchor already carries a delivery of this slot", () => {
    /*
      Every specimen is `master → first body edit`. On a branch that already
      holds a build crop, the anchor-to-delivered delta contains the EARLIER
      purchase, so a ruler handed it would confirm a delivery this render may
      never have made. The court says what its anchor has to be; this is the
      line that enforces it.
    */
    const verdict = adjudicate({ prior: true });
    expect(verdict.settled).toBe(false);
    if (verdict.settled) throw new Error("unreachable");
    expect(verdict.declined).toBe("anchorCarriesPriorDelivery");
  });

  it("declines a read that did not settle, on either end", () => {
    expect(adjudicate({ anchor: null })).toMatchObject({ declined: "noReading" });
    expect(adjudicate({ delivered: null })).toMatchObject({ declined: "noReading" });
    /* And a zero anchor is a division, not a reading. */
    expect(adjudicate({ anchor: span(0) })).toMatchObject({ declined: "noReading" });
  });

  it("declines a SATURATED reading, however large the change looks", () => {
    /*
      A silhouette touching both frame edges reads the frame's own width for
      every build there is, so the change behind the clip could be any size.
      Reported rather than dropped, and refused rather than believed.
    */
    expect(adjudicate({ anchor: span(2.286, true) })).toMatchObject({ declined: "clipped" });
    expect(adjudicate({ delivered: span(2.037, true) })).toMatchObject({ declined: "clipped" });
  });

  it("checks the facets BEFORE it looks at any number", () => {
    /* A waist dispute with a colossal shoulder change is still not this
       ruler's to settle — the precedence is not an ordering that happens to
       hold, it is the condition. */
    const verdict = adjudicate({ facets: ["waist"], delivered: span(1.0) });
    expect(verdict).toMatchObject({ declined: "facetOutsideCourt" });
  });
});
