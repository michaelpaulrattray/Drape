/**
 * THE TRIM'S ARITHMETIC, DRIVEN — including the arm the design calls its
 * signature: **the suite must go RED if the per-frame `R` is replaced by a house
 * constant** (`CASTING_FRAMING_TRIM_BUILD.md` §10, countersigned fable-1576).
 *
 * Every fixture below is a REAL frame from the framing court — arm M's own rows,
 * scaled to the render size — rather than a number invented to make a branch
 * fire. The tall-haired specimen is `basics-clause/pos6`, the frame whose crown
 * the common-`R` cut actually sliced by 61 px, opened at the artifact before it
 * was believed.
 */
import { describe, expect, it } from "vitest";

import { planFramingTrim, type TrimInput } from "./framingTrim";

/** The court's own constants. */
const TARGET = { headShare: 0.227, houseHeadroom: 0.35, clearance: 0.05 };
const FRAME = { width: 1536, height: 2304 };
const DELIVER = { width: 1024, height: 1536 };

/**
 * Build an input from the quantities the court measures in, so a fixture reads
 * like the row it came from rather than like a pixel box.
 */
function frameFrom(row: { share: number; headroom: number; gap: number | null }): TrimInput {
  const faceHeight = Math.round(row.share * FRAME.height);
  const faceTop = Math.round(row.headroom * faceHeight);
  return {
    frame: FRAME,
    deliver: DELIVER,
    face: { left: 560, top: faceTop, width: Math.round(faceHeight * 0.85), height: faceHeight },
    head: row.gap === null ? null : { left: 540, top: Math.round(faceTop - row.gap * faceHeight), width: 520, height: 700 },
    target: TARGET,
  };
}

/* Real rows, from `output/framing-court/armM/armM.json`. */
const ORDINARY = { share: 0.197, headroom: 0.501, gap: 0.269 };   /* basics-clause/pos0 */
const TALL_HAIR = { share: 0.167, headroom: 0.766, gap: 0.508 };  /* basics-clause/pos6 — the sliced crown */
const TIGHT = { share: 0.227, headroom: 0.352, gap: 0.191 };      /* suit-clause/pos4 — the binding frame */

describe("the framing trim", () => {
  it("trims an ordinary frame to the common head size", () => {
    const input = frameFrom(ORDINARY);
    const plan = planFramingTrim(input);
    expect(plan.trim).toBe(true);
    if (!plan.trim) return;
    /* The delivered head share IS the target — that is the whole point, and it
       is checked here rather than asserted in prose. */
    const faceHeight = Math.round(ORDINARY.share * FRAME.height);
    expect(faceHeight / plan.crop.height).toBeCloseTo(TARGET.headShare, 3);
    expect(plan.ownHeadroom).toBe(false);
    /* Within a pixel: `headroom` reports what the integer crop DELIVERED, so
       it sits a fraction of a pixel either side of the house floor. */
    expect(Math.abs(plan.headroom - TARGET.houseHeadroom) * input.face!.height).toBeLessThanOrEqual(1);
  });

  it("gives the tall-haired frame MORE headroom than the house floor, and clears her hair", () => {
    const input = frameFrom(TALL_HAIR);
    const plan = planFramingTrim(input);
    expect(plan.trim).toBe(true);
    if (!plan.trim) return;
    expect(plan.ownHeadroom).toBe(true);
    /*
      Her hair needs ~0.508 and the house offers 0.35, so she takes ~0.558.
      Asserted against the gap THE FIXTURE'S OWN BOXES encode rather than the
      row's nominal figure: the boxes are integers, so the reconstruction is a
      thousandth off, and a test that pins the nominal number is testing my
      rounding rather than the planner.
    */
    const gapHere = (input.face!.top - input.head!.top) / input.face!.height;
    expect(Math.abs(plan.headroom - (gapHere + TARGET.clearance)) * input.face!.height).toBeLessThanOrEqual(1);
    /* AND THE CROP LINE IS ABOVE THE TOP OF HER HEAD — the founder's condition,
       in pixels rather than in a promise. */
    expect(plan.crop.top).toBeLessThan(input.head!.top);
  });

  it("keeps every head the same SIZE while the headroom floats", () => {
    const plans = [ORDINARY, TALL_HAIR, TIGHT].map((row) => ({ row, plan: planFramingTrim(frameFrom(row)) }));
    const shares = plans.map(({ row, plan }) => {
      expect(plan.trim).toBe(true);
      if (!plan.trim) return 0;
      return Math.round(row.share * FRAME.height) / plan.crop.height;
    });
    for (const share of shares) expect(share).toBeCloseTo(TARGET.headShare, 3);
    /* ...and the headrooms are NOT all the same, which is the design. */
    const headrooms = plans.map(({ plan }) => (plan.trim ? plan.headroom : -1));
    expect(new Set(headrooms).size).toBeGreaterThan(1);
  });

  /*
    ⚠ THE NEGATIVE CONTROL, and it is the reason this file exists.

    Replace the per-frame headroom with the house constant — the "common R" this
    design exists to refuse — and the tall-haired frame's crop line lands BELOW
    the top of her head. That is the 61 px of sliced crown, reproduced in
    arithmetic. If this arm ever stops failing, the per-frame rule has been
    quietly removed and every sheet with volume in its hair pays for it.
  */
  it("SABOTAGE: a common R slices the tall-haired frame — the defect this design refuses", () => {
    const input = frameFrom(TALL_HAIR);
    const faceHeight = input.face!.height;
    const commonRTop = Math.round(input.face!.top - TARGET.houseHeadroom * faceHeight);
    expect(commonRTop).toBeGreaterThan(input.head!.top);

    const sliced = commonRTop - input.head!.top;
    expect(sliced).toBeGreaterThan(0);

    /* And the real planner does NOT do that, on the same frame. */
    const plan = planFramingTrim(input);
    expect(plan.trim).toBe(true);
    if (!plan.trim) return;
    expect(plan.crop.top).toBeLessThan(input.head!.top);
    expect(plan.crop.top).toBeLessThan(commonRTop);
  });

  describe("every branch ends in a delivered frame, and each names itself", () => {
    it("no face read → no-face", () => {
      const plan = planFramingTrim({ ...frameFrom(ORDINARY), face: null });
      expect(plan).toEqual({ trim: false, why: "no-face" });
    });

    it("no head read → no-head, because a guessed gap is a sliced crown", () => {
      const plan = planFramingTrim({ ...frameFrom(ORDINARY), head: null });
      expect(plan).toEqual({ trim: false, why: "no-head" });
    });

    it("a head already bigger than the target → share-above-target", () => {
      const plan = planFramingTrim(frameFrom({ share: 0.281, headroom: 0.58, gap: 0.321 }));
      expect(plan).toEqual({ trim: false, why: "share-above-target" });
    });

    it("a frame that cannot hold its own hair → cannot-clear-hair", () => {
      /* gap 0.60 + 0.05 clearance against 0.40 of headroom: the crop line would
         start above the frame's own top edge. */
      const plan = planFramingTrim(frameFrom({ share: 0.19, headroom: 0.40, gap: 0.60 }));
      expect(plan).toEqual({ trim: false, why: "cannot-clear-hair" });
    });

    it("a crop shorter than the delivered frame → would-upscale, so no pixel is invented", () => {
      /* A tiny face at a loose target gives a crop under 1536 tall. */
      const plan = planFramingTrim({
        ...frameFrom({ share: 0.10, headroom: 0.60, gap: 0.20 }),
        target: { ...TARGET, headShare: 0.60 },
      });
      expect(plan).toEqual({ trim: false, why: "would-upscale" });
    });

    it("and the ordinary frame is NOT refused by any of them", () => {
      expect(planFramingTrim(frameFrom(ORDINARY)).trim).toBe(true);
    });
  });

  it("centres the crop on the FACE, not on the frame", () => {
    const input = frameFrom(ORDINARY);
    /* Push the face well off-centre and the crop must follow it. */
    const offset = { ...input, face: { ...input.face!, left: 900 } };
    const centred = planFramingTrim(input);
    const shifted = planFramingTrim(offset);
    expect(centred.trim && shifted.trim).toBe(true);
    if (!centred.trim || !shifted.trim) return;
    expect(shifted.crop.left).toBeGreaterThan(centred.crop.left);
  });

  it("never plans a crop that leaves the frame", () => {
    for (const row of [ORDINARY, TALL_HAIR, TIGHT]) {
      const plan = planFramingTrim(frameFrom(row));
      if (!plan.trim) continue;
      expect(plan.crop.left).toBeGreaterThanOrEqual(0);
      expect(plan.crop.top).toBeGreaterThanOrEqual(0);
      expect(plan.crop.left + plan.crop.width).toBeLessThanOrEqual(FRAME.width);
      expect(plan.crop.top + plan.crop.height).toBeLessThanOrEqual(FRAME.height);
    }
  });

  it("is pure — the same input plans the same crop twice", () => {
    const input = frameFrom(TALL_HAIR);
    expect(planFramingTrim(input)).toEqual(planFramingTrim(input));
  });
});
