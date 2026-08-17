/**
 * THE INSTRUMENT BEFORE ITS VERDICTS, THEN THE VERDICTS.
 *
 * Working law 2, and this guard is the one place in the swap where a checker
 * that cannot fail would be invisible: it would pass everything, the library
 * would fill with well-formed crops, and the first person to notice would be the
 * founder looking at a tile captioned "her hairstyle" that is a fringe. Again.
 *
 * So the identity control and both specimens are driven here, at the coverage
 * arithmetic, before a single refusal is tested — and the fringe's own ratio is
 * reproduced from the production row rather than typed in as a belief.
 */
import { describe, expect, it } from "vitest";

import type { Mask } from "./maskedComposite";
import { measureCentreline } from "./referenceCentreline";
import {
  adjudicatedGapFor,
  centrelineMarginFor,
  CENTRELINE_SPECIMENS,
  COMPLETENESS_SPECIMENS,
  GUARD_REFUSAL_REASONS,
  GUARD_REFUSALS,
  guardReference,
  measureCoverage,
  mintGuardedReference,
  refusalKeepsItsCrop,
  REFUSALS_THAT_KEEP_THEIR_CROP,
  shellFraction,
  thresholdFor,
} from "./referenceCompleteness";
import type { SegmentBox } from "./segmentCuts";

/** A frame-sized region: a filled rectangle of `pixels` set bytes. */
function region(width: number, height: number, filled: SegmentBox): Mask {
  const data = Buffer.alloc(width * height, 0);
  for (let y = filled.y; y < filled.y + filled.height; y += 1) {
    for (let x = filled.x; x < filled.x + filled.width; x += 1) data[y * width + x] = 255;
  }
  return { data, width, height };
}

/** A crop mask in its own box's coordinates, fully set. */
function crop(box: SegmentBox): { mask: Mask; box: SegmentBox } {
  return { mask: { data: Buffer.alloc(box.width * box.height, 255), ...box }, box };
}

const FRAME = { width: 100, height: 100 };
const HAIR: SegmentBox = { x: 10, y: 10, width: 40, height: 40 }; /* 1,600 px */

describe("the instrument — controls first", () => {
  it("IDENTITY CONTROL: a region scored as its own crop reads 100%", () => {
    /* The one that matters. A bbox arithmetic error drives coverage down and
       spill up together, and the production audit found neither on 14 of 14
       rows — so the crops land inside their regions and are simply small. */
    const reading = measureCoverage(crop(HAIR), region(FRAME.width, FRAME.height, HAIR));
    expect(reading.coverage).toBe(1);
    expect(reading.spill).toBe(0);
    expect(reading.regionPixels).toBe(1_600);
  });

  it("NEGATIVE: the founder's fringe reads 12.5% of the hair it claims to be", () => {
    /* Row 13 of the production store: 27,910 stored against a 217,794 px hair
       region. The proportions are reproduced here, not the raw counts. */
    const fringe = crop({ x: 10, y: 10, width: 40, height: 5 }); /* 200 of 1,600 */
    const reading = measureCoverage(fringe, region(FRAME.width, FRAME.height, HAIR));
    expect(reading.coverage).toBeCloseTo(0.125, 5);
    expect(reading.coverage).toBeCloseTo(COMPLETENESS_SPECIMENS.hair!.negative, 3);
  });

  it("SPILL is measured separately, so it can never inflate coverage", () => {
    /* A crop half inside its region and half outside covers half the region and
       is half spill. If spill counted toward coverage, a crop of her shoulder
       would pass as a crop of her hair. */
    const straddling = crop({ x: 30, y: 10, width: 40, height: 40 });
    const reading = measureCoverage(straddling, region(FRAME.width, FRAME.height, HAIR));
    expect(reading.coverage).toBeCloseTo(0.5, 5);
    expect(reading.spill).toBeCloseTo(0.5, 5);
  });

  it("the bar is the coverage of the crop proven complete, not a midpoint", () => {
    expect(thresholdFor("hair")).toBe(COMPLETENESS_SPECIMENS.hair!.positive);
    expect(thresholdFor("lips")).toBeNull();
    expect(thresholdFor("earring")).toBeNull();
  });
});

describe("the door — what enters the library and what does not", () => {
  const hairRegion = region(FRAME.width, FRAME.height, HAIR);

  it("PASSES a crop at the proven-complete coverage", () => {
    const verdict = guardReference({
      kind: "hair", crop: crop(HAIR), digest: "aa", guardRead: hairRegion,
    });
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.judged).toEqual({ instrument: "area", coverage: 1, threshold: 0.946 });
  });

  it("REFUSES the fringe, loudly and with the number attached", () => {
    const verdict = guardReference({
      kind: "hair",
      crop: crop({ x: 10, y: 10, width: 40, height: 5 }),
      digest: "bb",
      guardRead: hairRegion,
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("underCaptured");
    expect(verdict.reading!.coverage).toBeCloseTo(0.125, 5);
    expect(verdict.detail).toContain("12.5%");
  });

  it("REFUSES every kind that has no positive specimen — it does not borrow hair's", () => {
    /* A perfect crop of a perfect region, refused, because nobody has measured
       what complete looks like for lips. The reading rides along, so the
       refusal is also how the specimen gets made. */
    const verdict = guardReference({
      kind: "lips", crop: crop(HAIR), digest: "cc", guardRead: hairRegion,
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("noSpecimen");
    expect(verdict.reading!.coverage).toBe(1);
  });

  it("REFUSES a frame that does not wear the thing (fable-181)", () => {
    /* The bare-eared master. A cutter given nothing produces a crop of nothing
       with a perfectly well-formed bounding box. */
    const verdict = guardReference({
      kind: "hair", crop: crop(HAIR), digest: "dd",
      guardRead: region(FRAME.width, FRAME.height, { x: 0, y: 0, width: 0, height: 0 }),
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("subjectAbsent");
  });

  it("REFUSES when the read did not settle — a failed reading is not a yes", () => {
    const verdict = guardReference({
      kind: "hair", crop: crop(HAIR), digest: "ee", guardRead: null,
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("readDidNotSettle");
    expect(verdict.reading).toBeUndefined(); /* nothing was read, so nothing is reported */
  });

  it("REFUSES a crop byte-identical to another slot's", () => {
    /* Three variants in production produced byte-identical crops under two
       facet names, because `marks` and `makeup` share the face-skin region.
       Two rows holding one fact means removing one removes the other. */
    const verdict = guardReference({
      kind: "hair", crop: crop(HAIR), digest: "ff", guardRead: hairRegion,
      mintedDigests: new Map([["skin", "ff"]]),
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("duplicateOfSlot");
    expect(verdict.detail).toContain("skin");
  });
});

describe("a DISPUTED delivery — the refusal that is not about the crop (fable-220 §3)", () => {
  const hairRegion = region(FRAME.width, FRAME.height, HAIR);

  it("NO DISPUTED CROP EVER PASSES — every arrangement that otherwise would", () => {
    /*
      The one that has to be exhaustive rather than illustrative, because the
      mint's own refusal to store a disputed crop is unreachable by construction
      and this is what makes the construction true. Each row below passes or is
      softly refused when nobody disputes it; every one of them is
      `disputedDelivery` when somebody does.
    */
    const arrangements = [
      { what: "a kind with a specimen, at the bar", kind: "hair", crop: crop(HAIR), undisputed: true as const },
      {
        what: "a kind with a specimen, under the bar",
        kind: "hair",
        crop: crop({ x: 10, y: 10, width: 40, height: 5 }),
        undisputed: "underCaptured" as const,
      },
      { what: "a kind with no specimen at all", kind: "lips", crop: crop(HAIR), undisputed: "noSpecimen" as const },
    ];
    for (const arrangement of arrangements) {
      const shared = { kind: arrangement.kind, crop: arrangement.crop, digest: "aa", guardRead: hairRegion };
      const without = guardReference(shared);
      expect(without.ok, arrangement.what).toBe(arrangement.undisputed === true);
      if (!without.ok) expect(without.reason, arrangement.what).toBe(arrangement.undisputed);

      const disputedVerdict = guardReference({ ...shared, disputed: true });
      expect(disputedVerdict.ok, arrangement.what).toBe(false);
      if (disputedVerdict.ok) continue;
      expect(disputedVerdict.reason, arrangement.what).toBe("disputedDelivery");
      /* The number rides along — it is what the adoption sitting reads beside
         the picture, and a refusal nobody can diagnose is one somebody disables. */
      expect(disputedVerdict.reading, arrangement.what).toBeDefined();
    }
  });

  it("names the kind and the number it read, so the row can be argued with", () => {
    const verdict = guardReference({
      kind: "lips", crop: crop({ x: 10, y: 10, width: 40, height: 20 }), digest: "aa",
      guardRead: hairRegion, disputed: true,
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.kind).toBe("lips");
    expect(verdict.reading!.coverage).toBeCloseTo(0.5, 5);
    expect(verdict.detail).toContain("50.0%");
    expect(verdict.detail).toContain("disputed");
  });

  it("THE THREE STRUCTURAL REFUSALS WIN — a dispute never displaces them", () => {
    /*
      Precedence, driven rather than asserted in a comment. A crop of a frame
      that does not wear the thing is a fabrication whether or not delivery is
      disputed; a read that did not settle scored nothing to argue about; and a
      crop whose bytes already sit at another slot needs no second copy. In all
      three there is nothing a human could look at that would settle anything,
      which is exactly why the mint writes no row for them.
    */
    const absent = guardReference({
      kind: "hair", crop: crop(HAIR), digest: "aa", disputed: true,
      guardRead: region(FRAME.width, FRAME.height, { x: 0, y: 0, width: 0, height: 0 }),
    });
    expect(absent.ok).toBe(false);
    if (!absent.ok) expect(absent.reason).toBe("subjectAbsent");

    const unread = guardReference({
      kind: "hair", crop: crop(HAIR), digest: "aa", guardRead: null, disputed: true,
    });
    expect(unread.ok).toBe(false);
    if (!unread.ok) expect(unread.reason).toBe("readDidNotSettle");

    const duplicate = guardReference({
      kind: "hair", crop: crop(HAIR), digest: "ff", guardRead: hairRegion, disputed: true,
      mintedDigests: new Map([["skin", "ff"]]),
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.reason).toBe("duplicateOfSlot");
  });

  it("carries the dispute through the reader-taking entry point", async () => {
    const verdict = await mintGuardedReference(
      {
        kind: "hair", question: "hair", frame: Buffer.from("the delivered frame"),
        crop: crop(HAIR), digest: "aa", disputed: true,
      },
      async () => hairRegion,
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("disputedDelivery");
  });

  it("states both properties for every reason, so a new one cannot ship half-filed", () => {
    /*
      THE FOLD'S OWN CONTROL (fable-486 (f)). Three hand-kept lists became one
      table, and this is what makes that a consolidation rather than a rename:
      every reason answers both questions, and the derived lists are read from
      the answers rather than from a second copy of them.
    */
    for (const reason of GUARD_REFUSAL_REASONS) {
      const entry = GUARD_REFUSALS[reason];
      expect(typeof entry.keepsCrop, reason).toBe("boolean");
      expect(typeof entry.evidenceOnly, reason).toBe("boolean");
      /* And a reason with no stated reason is how a list becomes folklore. */
      expect(entry.why.length, reason).toBeGreaterThan(20);
    }
    /* Exactly one row is evidence rather than a version, and the fold reads
       ONE — a second would quietly stop a crop riding into every prompt. */
    expect(GUARD_REFUSAL_REASONS.filter((reason) => GUARD_REFUSALS[reason].evidenceOnly))
      .toEqual(["disputedDelivery"]);
  });

  it("only the human-settled refusals keep their pixels", () => {
    /* The list the write helper enforces, pinned where it is defined. A new
       reason arriving without this test changing is the silent version of
       widening the gallery the guard exists to keep empty. */
    const kept = ["brokenOutline", "disputedDelivery", "noSpecimen", "notScorableByArea"];
    expect([...REFUSALS_THAT_KEEP_THEIR_CROP].sort()).toEqual(kept);
    for (const reason of GUARD_REFUSAL_REASONS) {
      expect(refusalKeepsItsCrop(reason), reason).toBe(kept.includes(reason));
    }
  });
});

/**
 * THE INSTRUMENT'S OWN RESOLUTION — fable-224's standing law, and the measure
 * it rests on gets both controls before it judges anything.
 *
 * *A verdict inside its own resolution is not a verdict.* Coverage on a hoop
 * cannot separate a good crop from a bad one, because two-thirds of a hoop is
 * its own outline and one pixel of boundary is worth more than the whole scale.
 */
describe("what one pixel of boundary is worth", () => {
  it("CONTROLS: a solid disc is barely edge, a one-pixel line is nothing else", () => {
    /* The two shapes whose answers come from geometry rather than from this
       function. Without them the measure could return a constant and every
       verdict below would still look right. */
    const disc = { data: Buffer.alloc(41 * 41, 0), width: 41, height: 41 };
    for (let y = 0; y < 41; y += 1) {
      for (let x = 0; x < 41; x += 1) {
        if ((x - 20) ** 2 + (y - 20) ** 2 <= 400) disc.data[y * 41 + x] = 255;
      }
    }
    expect(shellFraction(disc)).toBeCloseTo(0.124, 2);

    const line = { data: Buffer.alloc(41 * 41, 0), width: 41, height: 41 };
    for (let x = 4; x < 37; x += 1) line.data[20 * 41 + x] = 255;
    expect(shellFraction(line)).toBe(1);

    /* And nothing at all is not a division by zero. */
    expect(shellFraction({ data: Buffer.alloc(16, 0), width: 4, height: 4 })).toBe(0);
  });

  it("REFUSES TO SCORE a hoop whose shortfall is smaller than one pixel of its edge", () => {
    /*
      A ring of the founder's own proportions — outer radius 12, three pixels
      thick — with a crop that holds the lower two-thirds of it. His own hoops
      measured 41.8% and 49.3% edge against shortfalls of 34.8 and 46.0 points.
    */
    const hoop = { data: Buffer.alloc(41 * 41, 0), width: 41, height: 41 };
    for (let y = 0; y < 41; y += 1) {
      for (let x = 0; x < 41; x += 1) {
        const radius = Math.hypot(x - 20, y - 20);
        if (radius <= 12 && radius >= 9) hoop.data[y * 41 + x] = 255;
      }
    }
    const resolution = shellFraction(hoop);
    expect(resolution).toBeGreaterThan(0.4);

    /*
      The crop takes the bottom of the ring only, so the shortfall is real and
      smaller than the resolution — which is exactly the founder's case.

      **The kind is `lips` and no longer `earring`, and the reason is the whole of
      §2.4c.** This rule has not changed: area still declines to score a shape
      that is nearly all edge, and that is what is asserted here. What changed is
      what happens NEXT for a kind that has a length specimen — `earring` now
      continues to the centreline instrument instead of stopping, which is the
      block below. A thin kind with no such specimen still stops here, and that is
      the arm this test guards.
    */
    const verdict = guardReference({
      kind: "lips", crop: crop({ x: 8, y: 20, width: 25, height: 13 }), digest: "aa", guardRead: hoop,
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(1 - verdict.reading!.coverage).toBeLessThan(resolution);
    /* NOT `noSpecimen`. The difference is the whole ruling: `noSpecimen` says
       "measure one and we will have a bar", and on this shape no measurement of
       one would ever produce a usable bar. */
    expect(verdict.reason).toBe("notScorableByArea");
    expect(verdict.detail).toContain("one-pixel edge");
    expect(refusalKeepsItsCrop(verdict.reason)).toBe(true);
  });

  /** A ring, the shape the whole ceiling corner is about. */
  const ringRegion = (): Mask => {
    const hoop = { data: Buffer.alloc(41 * 41, 0), width: 41, height: 41 };
    for (let y = 0; y < 41; y += 1) {
      for (let x = 0; x < 41; x += 1) {
        const radius = Math.hypot(x - 20, y - 20);
        if (radius <= 12 && radius >= 9) hoop.data[y * 41 + x] = 255;
      }
    }
    return hoop;
  };

  it("THE CEILING CORNER: a perfect hoop is ACCEPTED, and the row says it was policy", () => {
    /*
      The corner that cost the first repaint-road walk its earrings (fable-305,
      as revised by fable-306). This test asserted `noSpecimen` here for a year —
      pinning the defect, because the crop that reads 100% of its own region is
      the BEST crop the instrument can see and it was the one refusal the library
      could not overturn.

      It is accepted now, and the verdict says WHY in the only terms that are
      true: the area instrument read it, the bar it cleared is the ceiling
      itself, and `ceilingAccepted` marks it so no later count of bar-measured
      specimens can quietly include a crop no bar ever divided.
    */
    const verdict = guardReference({
      kind: "earring", crop: crop({ x: 8, y: 8, width: 25, height: 25 }), digest: "aa", guardRead: ringRegion(),
    });
    expect(verdict.reading!.coverage).toBe(1);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.ceilingAccepted).toBe(true);
    expect(verdict.judged).toEqual({ instrument: "area", coverage: 1, threshold: 1 });
    /* And explicitly NOT the length family's bar: a check that cannot fail here
       must not wear a measured bar's name (the test below is why). */
    expect(verdict.judged.threshold).not.toBe(CENTRELINE_SPECIMENS.earring!.positive);
  });

  it("THE CEILING IMPLIES THE BAR — which is why the bar is not cited", () => {
    /*
      The arithmetic behind the policy, driven rather than asserted in prose.

      Coverage is `|crop ∩ region| / |region|`, so a reading of exactly 1.0 means
      every region pixel is inside the crop. The centreline is thinned FROM that
      same region, so its spine is a subset of those pixels and is covered before
      the dilation is even applied. A ceiling crop therefore passes the length
      bar unconditionally — which is exactly why the verdict above does not claim
      the length bar decided anything. An affirmative with no possible negative,
      reported under a measured bar's name, is the shape this program kills
      wherever it finds it.
    */
    for (const shape of [ringRegion(), region(41, 41, { x: 10, y: 10, width: 20, height: 20 })]) {
      const whole = crop({ x: 0, y: 0, width: 41, height: 41 });
      expect(measureCoverage(whole, shape).coverage).toBe(1);
      expect(measureCentreline(whole, shape).coverage).toBe(1);
    }
  });

  it("AND A KIND WITH NO LENGTH BAR STILL REFUSES AT THE CEILING", () => {
    /* The scope, driven: the clause routes, it does not open the ceiling to
       every kind. `lips` owns no centreline family, so a perfect lip crop is
       still `noSpecimen` — the refusal that says "measure one and we will have
       a bar" rather than inventing one. */
    expect(CENTRELINE_SPECIMENS.lips).toBeUndefined();
    const verdict = guardReference({
      kind: "lips", crop: crop({ x: 8, y: 8, width: 25, height: 25 }), digest: "aa", guardRead: ringRegion(),
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reading!.coverage).toBe(1);
    expect(verdict.reason).toBe("noSpecimen");
  });

  it("HAIR IS UNTOUCHED — a measured gap of 82.1 points against a few of edge", () => {
    /*
      The regression that matters. The bar the whole library rests on was
      measured on this instrument, so a rule that quietly stopped scoring hair
      would take the one working kind down with the broken one. The gap is the
      SPECIMENS' distance (94.6 − 12.5), never the reading's distance from the
      bar — the second would open a dead band around every threshold and refuse
      good crops for being near it.
    */
    expect(adjudicatedGapFor("hair", 0.5)).toBeCloseTo(0.821, 3);
    /* A kind with no specimens is judged against its own shortfall — nothing
       is chosen, and the reading is what would become the bar. */
    expect(adjudicatedGapFor("earring", 0.652)).toBeCloseTo(0.348, 3);

    const hairRegion = region(FRAME.width, FRAME.height, HAIR);
    expect(shellFraction(hairRegion)).toBeLessThan(0.821);

    const passing = guardReference({
      kind: "hair", crop: crop(HAIR), digest: "aa", guardRead: hairRegion,
    });
    expect(passing.ok).toBe(true);

    /* And the fringe still fails as `underCaptured` — measured against a real
       bar and refused correctly, its pixels NOT kept. */
    const fringe = guardReference({
      kind: "hair", crop: crop({ x: 10, y: 10, width: 40, height: 5 }), digest: "bb", guardRead: hairRegion,
    });
    expect(fringe.ok).toBe(false);
    if (fringe.ok) return;
    expect(fringe.reason).toBe("underCaptured");
    expect(refusalKeepsItsCrop(fringe.reason)).toBe(false);
  });

  it("the structural three and a dispute still come FIRST", () => {
    /* Precedence, on the thinnest possible shape: an instrument that does not
       apply is still not a reason to file a crop of nothing, or to re-file bytes
       another slot already holds, or to bury a delivery dispute under a
       measurement complaint. */
    const line = { data: Buffer.alloc(41 * 41, 0), width: 41, height: 41 };
    for (let x = 4; x < 37; x += 1) line.data[20 * 41 + x] = 255;
    const thinCrop = crop({ x: 4, y: 20, width: 33, height: 1 });

    const duplicate = guardReference({
      kind: "earring", crop: thinCrop, digest: "ff", guardRead: line,
      mintedDigests: new Map([["skin", "ff"]]),
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.reason).toBe("duplicateOfSlot");

    const disputed = guardReference({
      kind: "earring", crop: thinCrop, digest: "aa", guardRead: line, disputed: true,
    });
    expect(disputed.ok).toBe(false);
    if (!disputed.ok) expect(disputed.reason).toBe("disputedDelivery");
  });
});

/**
 * THE SECOND DOOR — §2.4c, fable-228. The length instrument, at the guard.
 *
 * `referenceCentreline.test.ts` controls the instrument itself. This is about
 * the DOOR: which crops reach it, which do not, what a refusal from it means,
 * and the one property that keeps it honest — **nothing routes here by name.**
 */
describe("the length instrument at the door — reached by measurement, never by name", () => {
  const CENTRE = 50;
  const at = (x: number, y: number) => Math.hypot(x - CENTRE, y - CENTRE);
  const angleAt = (x: number, y: number) => {
    const degrees = (Math.atan2(y - CENTRE, x - CENTRE) * 180) / Math.PI;
    return degrees < 0 ? degrees + 360 : degrees;
  };

  /** A frame-sized mask from a predicate. */
  function shaped(fill: (x: number, y: number) => boolean): Mask {
    const data = Buffer.alloc(FRAME.width * FRAME.height, 0);
    for (let y = 0; y < FRAME.height; y += 1) {
      for (let x = 0; x < FRAME.width; x += 1) if (fill(x, y)) data[y * FRAME.width + x] = 255;
    }
    return { data, width: FRAME.width, height: FRAME.height };
  }
  /** The same, as a crop whose box is the whole frame. */
  const cropOf = (fill: (x: number, y: number) => boolean) => ({
    mask: shaped(fill),
    box: { x: 0, y: 0, width: FRAME.width, height: FRAME.height },
  });

  /* A hoop: a three-pixel band, the founder's own proportions. */
  const ring = (x: number, y: number) => at(x, y) >= 9.5 && at(x, y) <= 12.5;
  const hoop = shaped(ring);
  /* A stud: the same earring kind, a solid shape. */
  const stud = shaped((x, y) => at(x, y) <= 12.5);

  it("PASSES a hoop the area instrument had just refused to score", () => {
    /*
      The crop holds the inner two of the ring's three pixels — under 1.0 by area,
      so §2.4b's ceiling exemption does not apply and the area measure declares
      itself inapplicable. The length instrument then finds the whole of the
      region's centreline within a pixel of the crop, and the crop enters.

      This is the shift the whole diff exists for: before it, this crop got
      `notScorableByArea` and a number nobody could adopt.
    */
    const verdict = guardReference({
      kind: "earring", digest: "aa", guardRead: hoop,
      crop: cropOf((x, y) => at(x, y) >= 9.5 && at(x, y) <= 11.5),
    });
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.judged.instrument).toBe("centreline");
    expect(verdict.judged.threshold).toBe(0.976);
    expect(verdict.judged.coverage).toBeGreaterThanOrEqual(0.976);
    /* And the area reading is still on the verdict, still true, and no longer
       pretending to be the verdict. */
    expect(verdict.reading.coverage).toBeLessThan(1);
  });

  it("REFUSES a hoop with an arc missing — as `brokenOutline`, and KEEPS ITS PIXELS", () => {
    const verdict = guardReference({
      kind: "earring", digest: "aa", guardRead: hoop,
      crop: cropOf((x, y) => ring(x, y) && !(angleAt(x, y) >= 200 && angleAt(x, y) < 320)),
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("brokenOutline");
    expect(verdict.judged!.instrument).toBe("centreline");
    expect(verdict.judged!.coverage).toBeLessThan(0.976);
    /*
      THE SPECIMEN-EVENT CLAUSE IS WHY THE PIXELS STAY. This bar rests on one
      positive with a 1.4× margin; the first crop an eye calls complete that it
      refuses re-opens the family. A refusal that might itself be wrong has to be
      falsifiable by the thing it refused, and only an eye can do that.
    */
    expect(refusalKeepsItsCrop(verdict.reason)).toBe(true);
    /* The refusal states its own weakness on the same line as its number: how
       many positives it rests on, and what it cannot see. */
    expect(verdict.detail).toContain("n=1");
    expect(verdict.detail).toContain("thinning");
  });

  it("A STUD NEVER REACHES IT — though the length measure would have waved the crop through", () => {
    /*
      THE CONTROL THAT MATTERS MOST, and it is the silhouette-for-material
      confusion caught before it can happen.

      A sliver through the middle of a solid earring runs along the whole of that
      earring's skeleton while holding a seventh of its metal. Judged by length it
      is perfect. It is not judged by length, because the routing is a measurement
      of the REGION: a stud is a blob, its shell fraction is small, the area
      instrument is comfortably applicable, and the crop takes the area path and
      refuses for want of a stud specimen.

      Same `kind` string, same door, different instrument — decided by the shape
      in front of it and not by the word "earring".
    */
    const sliver = cropOf((x, y) => at(x, y) <= 12.5 && Math.abs(y - CENTRE) <= 1);
    /* Not "high" — PERFECT. The length instrument would have scored this crop
       1.000 and the door would have adopted it as a reference to a whole
       earring. Asserted exactly, because a loose bound here would let the
       control weaken without anybody noticing. */
    expect(measureCentreline(sliver, stud).coverage).toBe(1);

    const verdict = guardReference({ kind: "earring", digest: "aa", guardRead: stud, crop: sliver });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("noSpecimen");
    expect(verdict.judged).toBeUndefined();
    expect(verdict.reading!.coverage).toBeLessThan(0.2);
  });

  it("A KIND WITH NO LENGTH FAMILY still refuses with `notScorableByArea`", () => {
    /* fable-228 kept it: a thin kind with no centreline specimen has no bar on
       either instrument, and the honest answer is still that this shape cannot be
       scored — not a borrowed number from the one kind that has been measured. */
    const verdict = guardReference({
      kind: "lips", digest: "aa", guardRead: hoop,
      crop: cropOf((x, y) => at(x, y) >= 9.5 && at(x, y) <= 11.5),
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("notScorableByArea");
    expect(verdict.judged).toBeUndefined();
  });

  it("HAIR STILL GOES THROUGH THE AREA PATH — a second instrument is not a re-route", () => {
    const hairRegion = region(FRAME.width, FRAME.height, HAIR);
    const verdict = guardReference({
      kind: "hair", crop: crop(HAIR), digest: "aa", guardRead: hairRegion,
    });
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.judged.instrument).toBe("area");
    expect(CENTRELINE_SPECIMENS.hair).toBeUndefined();
  });

  it("the bar carries its caveats IN THE CODE, and its margin is derived", () => {
    /*
      fable-228 adopted 97.6% with three riders, and a rider that lives only in a
      mailbox message is a rider somebody quotes the number without. So: the
      positive count is a field, the escalation clause is a field, and the margin
      is COMPUTED from the two specimens rather than stored beside them — a copy
      of `positive − negative` would drift from it the day a second positive lands.
    */
    const family = CENTRELINE_SPECIMENS.earring!;
    expect(family.positive).toBe(0.976);
    expect(family.negative).toBe(0.740);
    expect(family.positives).toBe(1);
    expect(family.specimenEvent).toContain("COMPLETE");
    /* 23.6 points against a 16.7-point worst-case resolution. Over 1, so the
       instrument passes the law the area measure failed — and barely. */
    expect(centrelineMarginFor("earring")).toBeCloseTo(1.41, 2);
    expect(centrelineMarginFor("hair")).toBeNull();
  });

  it("TRIPWIRE: no kind may own a bar on BOTH instruments while the row cannot say which read it", () => {
    /*
      The library row records `guardKind`, `guardCoverage` and `guardThreshold`,
      and NOT the instrument — adding that column is a migration, which is
      founder-gated, and it is not owed while a kind's name determines its
      instrument unambiguously. Today it does: `hair` is area-only, `earring` is
      centreline-only.

      The day a kind honestly owns both — a measured stud specimen alongside the
      hoop bar — two rows reading 97.6% would mean different things and nothing
      on either row would say which. That is the display-default-doing-two-jobs
      class, and this test is the tripwire that makes it impossible to create
      quietly: the column lands first, or the second family does not.
    */
    const both = Object.keys(CENTRELINE_SPECIMENS).filter((kind) => kind in COMPLETENESS_SPECIMENS);
    expect(both).toEqual([]);
  });
});

describe("the guard takes its OWN read — a checker handed its subject's read cannot fail", () => {
  it("calls the reader itself, on the frame the crop claims to represent", async () => {
    const asked: { frame: string; question: string }[] = [];
    const verdict = await mintGuardedReference(
      {
        kind: "hair", question: "hair", frame: Buffer.from("the delivered frame"),
        crop: crop(HAIR), digest: "aa",
      },
      async ({ frame, question }) => {
        asked.push({ frame: frame.toString(), question });
        return region(FRAME.width, FRAME.height, HAIR);
      },
    );
    expect(verdict.ok).toBe(true);
    expect(asked).toEqual([{ frame: "the delivered frame", question: "hair" }]);
  });

  it("treats a reader that throws as a reading that did not happen", async () => {
    /* Not as a no, and not as a yes. The sweep that handed a reader HTML error
       pages and read back "no glasses on any of them" is the reason this
       distinction is a branch rather than a comment. */
    const verdict = await mintGuardedReference(
      {
        kind: "hair", question: "hair", frame: Buffer.from("x"),
        crop: crop(HAIR), digest: "aa",
      },
      async () => { throw new Error("fal returned an HTML error page"); },
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("readDidNotSettle");
  });
});

/**
 * THE RULED FLOOR — horns, and the shape fable-589 §3 created.
 *
 * `positive` is a measurement and stays one; the BAR is ruled, because on a
 * kind whose cut is the region a real mint reads 100.0 and a bar at 100 refuses
 * 99.9 for nothing. These drive the ruling rather than restating it.
 */
describe("a ruled floor, where the positive cannot be the bar", () => {
  it("takes the floor for horns and the measurement for hair", () => {
    expect(thresholdFor("horns")).toBe(0.95);
    expect(thresholdFor("hair")).toBe(COMPLETENESS_SPECIMENS.hair!.positive);
  });

  it("keeps the measured positive honest beside it", () => {
    /* The reading is what four real mints and the identity control said. It is
       not bent to produce the bar — that is the whole point of the split. */
    expect(COMPLETENESS_SPECIMENS.horns!.positive).toBe(1);
    expect(COMPLETENESS_SPECIMENS.horns!.negative).toBeCloseTo(0.837, 3);
  });

  it("passes what is real and refuses the mis-cut, with the margin stated", () => {
    const floor = thresholdFor("horns")!;
    /* Everything measured on a real mint. */
    expect(1).toBeGreaterThanOrEqual(floor);
    /* The looked-at mis-cut, and eleven points of daylight under the bar. */
    expect(COMPLETENESS_SPECIMENS.horns!.negative).toBeLessThan(floor);
    expect(floor - COMPLETENESS_SPECIMENS.horns!.negative).toBeGreaterThan(0.11);
  });

  /*
    EYES — an ABSENCE test, and it can fail.

    The bar shipped on 2026-08-17 and was pulled the same day (fable-853 §3b):
    the carry it unblocked was measured on ten frames across two casts and it
    LOSES the feature — 0/3 at 35 px and 0/2 at 56 px, against words holding it
    3/3 and 2/2. The 56 px crop is one of the four the founder himself called
    complete, so the drafted >=45 px resolution floor would not have saved the
    class either.

    This is not "eyes were never calibrated". It is a kind whose calibration was
    bought, shipped and then withdrawn on evidence, so the test that guards it
    has to be able to FAIL — an absence nothing asserts is indistinguishable
    from an absence nobody noticed (D-248's shape, the same week).
  */
  it("has NO eyes entry — the bar was measured and withdrawn, and stays out", () => {
    expect(COMPLETENESS_SPECIMENS.eyes).toBeUndefined();
    /* And the consequence, at the function the mint actually calls: an eye crop
       has no bar to clear, so it is refused `noSpecimen`, keeps its pixels, and
       the slot rides on words. */
    expect(thresholdFor("eyes")).toBeNull();
  });

  it("keeps the kinds whose carry IS measured — the pull is about eyes, not the table", () => {
    /* A withdrawal that quietly emptied the table would pass the test above and
       break every carrier this product has proven. */
    expect(thresholdFor("horns")).toBe(0.95);
    expect(Object.keys(COMPLETENESS_SPECIMENS).length).toBeGreaterThan(0);
  });

  it("never rules a floor ABOVE the crop it was ruled from", () => {
    /* A floor over the positive would refuse the specimen itself — the shape of
       a bar that cannot be passed, which is what this whole split exists to
       prevent. Swept over every kind, so a future entry cannot reintroduce it. */
    for (const [kind, specimens] of Object.entries(COMPLETENESS_SPECIMENS)) {
      if (specimens.provisionalFloor === undefined) continue;
      expect(specimens.provisionalFloor, `${kind}'s floor is above its own positive`)
        .toBeLessThanOrEqual(specimens.positive);
      expect(specimens.provisionalFloor, `${kind}'s floor is under its own negative`)
        .toBeGreaterThan(specimens.negative);
    }
  });
});
