/**
 * V21 — one view-naming vocabulary (Batch A-safe).
 *
 * The single-view generator once spoke era-0 wire names ('side'/'walk'/
 * 'back') translated from canonical angles by a private map in mintPackage —
 * a third vocabulary nobody needed. The generator now takes canonical
 * angles directly; these tests pin the prompt map to exactly the four
 * single-view angles and their intended framings.
 */
import { describe, it, expect } from "vitest";
import { SINGLE_VIEW_PROMPTS, type SingleViewAngle } from "./geminiViews";
import { CANONICAL_VIEW_ANGLES } from "../../shared/boardTypes";

const WARDROBE = "Attire: Minimalist black activewear.";
const singleViewAngles = CANONICAL_VIEW_ANGLES.filter(
  (a): a is SingleViewAngle => a !== "frontClose" && a !== "frontFull",
);

describe("SINGLE_VIEW_PROMPTS — canonical keys, no wire names", () => {
  it("covers exactly the four single-view canonical angles", () => {
    expect(Object.keys(SINGLE_VIEW_PROMPTS).sort()).toEqual([...singleViewAngles].sort());
    // The retired vocabulary must not creep back in as keys
    for (const wire of ["side", "walk", "back"]) {
      expect(wire in SINGLE_VIEW_PROMPTS).toBe(false);
    }
  });

  it("every angle produces a non-empty prompt carrying the wardrobe constraint", () => {
    for (const angle of singleViewAngles) {
      const prompt = SINGLE_VIEW_PROMPTS[angle](WARDROBE);
      expect(prompt.length).toBeGreaterThan(20);
      expect(prompt).toContain(WARDROBE);
    }
  });

  it("each angle keeps its intended framing and explicit frame-relative direction", () => {
    expect(SINGLE_VIEW_PROMPTS.sideClose(WARDROBE)).toContain("SIDE PROFILE PORTRAIT");
    expect(SINGLE_VIEW_PROMPTS.sideFull(WARDROBE)).toContain("FULL BODY SIDE PROFILE");
    expect(SINGLE_VIEW_PROMPTS.sideFull(WARDROBE)).toContain("Walking motion");
    expect(SINGLE_VIEW_PROMPTS.backFull(WARDROBE)).toContain("FULL BODY FROM BEHIND");
    expect(SINGLE_VIEW_PROMPTS.threeQuarter(WARDROBE)).toContain("THREE-QUARTER PORTRAIT");
    expect(SINGLE_VIEW_PROMPTS.threeQuarter(WARDROBE)).toContain("45-degree");
    expect(SINGLE_VIEW_PROMPTS.sideClose(WARDROBE)).toContain("RIGHT EDGE OF THE OUTPUT FRAME");
    expect(SINGLE_VIEW_PROMPTS.threeQuarter(WARDROBE)).toContain("RIGHT EDGE OF THE OUTPUT FRAME");
  });

  it("prompts are distinct per angle — no two views share a framing", () => {
    const prompts = singleViewAngles.map((a) => SINGLE_VIEW_PROMPTS[a](WARDROBE));
    expect(new Set(prompts).size).toBe(prompts.length);
  });
});
