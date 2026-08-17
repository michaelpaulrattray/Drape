/**
 * WHERE A THING IS ANCHORED, AND WHICH FRAMINGS SHOW THAT PLACE — P2's derived
 * half, driven with no model in the loop (`shared/bodyAnchorRegions.ts`).
 *
 * Two of these are the bounds fable-897 §3 attached to the anchor-region ruling
 * and they are the reason this file exists rather than a nicety:
 *
 *  a. **the vocabulary is CLOSED** — a reader may not invent anatomy, so a region
 *     outside the eight is refused rather than folded into the nearest member;
 *  b. **the table is TOTAL over every framing** — a view added to
 *     `CAST_VIEW_ANGLES` must not silently inherit somebody else's answer. The
 *     type already refuses it; this asserts it in case the type is ever widened,
 *     which is the tripwire `castingFrame.ts` has for rolls and the view package
 *     did not have for itself.
 *
 * The third group is the whole point of the ruling: the SAME region answers
 * differently in different framings, which is what a per-kind boolean could not
 * do.
 */
import { describe, expect, it } from "vitest";

import {
  ANCHOR_FRAMINGS,
  BODY_ANCHOR_REGIONS,
  anchorPresentsIn,
  framingsWithout,
  isBodyAnchorRegion,
  type AnchorFraming,
} from "../../shared/bodyAnchorRegions";
import { CAST_VIEW_ANGLES } from "../../shared/boardTypes";

describe("the anchor-region vocabulary", () => {
  it("is closed — the eight places and nothing else", () => {
    expect([...BODY_ANCHOR_REGIONS]).toEqual([
      "head", "neck", "torso", "arms", "hands", "belowWaist", "feet", "wholeBody",
    ]);
  });

  it("refuses a region nobody designed", () => {
    /* Bound (a). The reader's own door: a model answering `elbows`, `wings` or a
       sentence gets a refusal, not the nearest member — folding it in would put
       an invented place into a column the framing table has no row for. */
    expect(isBodyAnchorRegion("head")).toBe(true);
    expect(isBodyAnchorRegion("elbows")).toBe(false);
    expect(isBodyAnchorRegion("HEAD")).toBe(false);
    expect(isBodyAnchorRegion("on her back")).toBe(false);
    expect(isBodyAnchorRegion("")).toBe(false);
  });
});

describe("which framings show a place", () => {
  it("covers every framing the product can produce, master included", () => {
    /* Bound (b), the tripwire. A view added to CAST_VIEW_ANGLES without a row
       here fails to compile — and fails this too, so a widened type cannot make
       it silent. */
    expect(ANCHOR_FRAMINGS).toContain("master");
    for (const angle of CAST_VIEW_ANGLES) expect(ANCHOR_FRAMINGS).toContain(angle);
    expect(ANCHOR_FRAMINGS).toHaveLength(CAST_VIEW_ANGLES.length + 1);
    /* And every framing answers every region — a `false` from a missing row and
       a `false` somebody decided are the same value, so totality is asserted
       rather than inferred from the absence of a crash. */
    for (const framing of ANCHOR_FRAMINGS) {
      for (const region of BODY_ANCHOR_REGIONS) {
        expect(typeof anchorPresentsIn(region, framing)).toBe("boolean");
      }
    }
  });

  it("answers the SAME region differently across framings — the whole ruling", () => {
    /* `belowWaist` is the specimen the finding was made on: a tail is out of shot
       on the road that paints it and in shot on the views a Cast is signed into.
       A per-kind boolean would have had to pick one of these. */
    expect(anchorPresentsIn("belowWaist", "master")).toBe(false);
    expect(anchorPresentsIn("belowWaist", "frontFull")).toBe(true);
    expect(anchorPresentsIn("belowWaist", "backFull")).toBe(true);
  });

  it("puts the hands outside the waist-up master — the design's own control", () => {
    /* `nails` on a waist-up framing is fable-868's class (c) example, and it is
       the reason the property existed at all. */
    expect(anchorPresentsIn("hands", "master")).toBe(false);
    expect(anchorPresentsIn("hands", "frontFull")).toBe(true);
  });

  it("shows the torso in every framing but the close-up", () => {
    /* Wings anchor at the shoulder blades, so they present in a head-and-shoulders
       portrait — a partly-in-shot region presents. A close-up is eyebrows-to-chin
       and shows none of it. */
    expect(anchorPresentsIn("torso", "closeUp")).toBe(false);
    for (const framing of ["master", "frontClose", "threeQuarter", "sideClose", "frontFull"] as const) {
      expect(anchorPresentsIn("torso", framing)).toBe(true);
    }
  });

  it("shows the head in every framing there is", () => {
    for (const framing of ANCHOR_FRAMINGS) expect(anchorPresentsIn("head", framing)).toBe(true);
  });

  it("names the framings a place is missing from, rather than counting them", () => {
    /* The list is what lets the copy say WHERE an ask will show instead of
       hedging. `feet` is absent from the master and from all four portraits. */
    expect(framingsWithout("feet")).toEqual<AnchorFraming[]>([
      "master", "closeUp", "frontClose", "threeQuarter", "sideClose",
    ]);
    /* And the negative control on the same function: a region in every framing
       has an empty list, so an empty answer means "everywhere" rather than "the
       table is blank". */
    expect(framingsWithout("head")).toEqual([]);
    expect(framingsWithout("wholeBody")).toEqual([]);
  });
});
