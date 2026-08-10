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
import {
  adjudicatedGapFor,
  COMPLETENESS_SPECIMENS,
  GUARD_REFUSAL_REASONS,
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
    expect(verdict.threshold).toBe(0.946);
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

  it("only the human-settled refusals keep their pixels", () => {
    /* The list the write helper enforces, pinned where it is defined. A new
       reason arriving without this test changing is the silent version of
       widening the gallery the guard exists to keep empty. */
    const kept = ["disputedDelivery", "noSpecimen", "notScorableByArea"];
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

    /* The crop takes the bottom of the ring only, so the shortfall is real and
       smaller than the resolution — which is exactly the founder's case. */
    const verdict = guardReference({
      kind: "earring", crop: crop({ x: 8, y: 20, width: 25, height: 13 }), digest: "aa", guardRead: hoop,
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

  it("a reading at the CEILING is always scorable — there is no shortfall to be unsure about", () => {
    /* The degenerate arm, driven so it stays deliberate: a crop holding all of
       an independent read of its own region is as complete as this instrument
       can certify, and refusing it for having a zero gap would be reading the
       rule instead of applying it. */
    const hoop = { data: Buffer.alloc(41 * 41, 0), width: 41, height: 41 };
    for (let y = 0; y < 41; y += 1) {
      for (let x = 0; x < 41; x += 1) {
        const radius = Math.hypot(x - 20, y - 20);
        if (radius <= 12 && radius >= 9) hoop.data[y * 41 + x] = 255;
      }
    }
    const verdict = guardReference({
      kind: "earring", crop: crop({ x: 8, y: 8, width: 25, height: 25 }), digest: "aa", guardRead: hoop,
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
