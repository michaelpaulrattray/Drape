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
  COMPLETENESS_SPECIMENS,
  GUARD_REFUSAL_REASONS,
  guardReference,
  measureCoverage,
  mintGuardedReference,
  refusalKeepsItsCrop,
  REFUSALS_THAT_KEEP_THEIR_CROP,
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

  it("only the two human-settled refusals keep their pixels", () => {
    /* The list the write helper enforces, pinned where it is defined. A seventh
       reason arriving without this test changing is the silent version of
       widening the gallery the guard exists to keep empty. */
    expect([...REFUSALS_THAT_KEEP_THEIR_CROP].sort())
      .toEqual(["disputedDelivery", "noSpecimen"]);
    for (const reason of GUARD_REFUSAL_REASONS) {
      expect(refusalKeepsItsCrop(reason), reason)
        .toBe(reason === "noSpecimen" || reason === "disputedDelivery");
    }
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
