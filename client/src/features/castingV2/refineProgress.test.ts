import { describe, expect, it } from "vitest";

import { refineProgress } from "./refineProgress";
import { REFINE_STEPS, refineStepFraction } from "@shared/refineSteps";

/**
 * THE HONEST LOADER'S RULES, DRIVEN (#55).
 *
 * `refineWait.test.ts` beside this one reads the SOURCE for the laws that can
 * only be read there (no percentage in the file, no keyframe that grows a
 * width). These are the ones that can be DRIVEN, which is the stronger arm
 * wherever it is available: what the surface shows for each state the road can
 * actually be in.
 *
 * The one this exists for above all is the refusal. Every other progress bar in
 * the world draws zero when it knows nothing; his rule is that it draws
 * NOTHING, because a bar at zero is a claim that a render has been accepted and
 * has not started, and there are two real situations where neither is known.
 */
describe("the bar and the word say only what the road announced", () => {
  it("shows the first stage the moment the row is ours, before anything is sent", () => {
    /* `queued` is the row's own status and it means exactly one thing: claimed,
       not yet at the engine — which is the same visible stage as `preparing`. */
    expect(refineProgress({ stage: "queued", step: null }))
      .toEqual({ word: "sending", fraction: 0.25 });
  });

  it("names each of the four stages in his words, and no others", () => {
    expect(REFINE_STEPS.map((step) => refineProgress({ stage: "dispatched", step })?.word))
      .toEqual(["sending", "painting", "checking", "finishing"]);
  });

  it("moves the bar only as the road passes a real stage", () => {
    expect(REFINE_STEPS.map((step) => refineProgress({ stage: "dispatched", step })?.fraction))
      .toEqual([0.25, 0.5, 0.75, 1]);
  });

  /*
    THE REFUSAL, AND IT IS THE WHOLE CARD.

    A dispatched row the road has announced nothing about gets no bar and no
    word. It happens for real in two short windows — a render claimed by a build
    that predates the announcement, and the instant between the claim and the
    first announcement — and in both the only honest answer is silence. A bar at
    zero here would be an invented percentage wearing a shape.
  */
  it("draws nothing at all over a row the road has not announced", () => {
    expect(refineProgress({ stage: "dispatched", step: null })).toBe(null);
  });

  /*
    AND NOTHING OVER A ROW NOBODY IS RENDERING (fable-467). The lease has
    passed, the sweep owns the row and is refunding it; a progress bar over that
    is the "being drawn" lie with a graph in front of it.
  */
  it("draws nothing over a settling row, whatever step it last announced", () => {
    expect(refineProgress({ stage: "settling", step: "reading" })).toBe(null);
    expect(refineProgress({ stage: "settling", step: null })).toBe(null);
  });

  /*
    THE BAR RETREATS WHEN THE WORK DOES, and that is the design rather than a
    defect: a render that fails its verification buys one free re-render, so the
    road genuinely returns from `reading` to `rendering`. A high-water mark
    would be a number the road cannot justify, which is the thing this card
    forbids.
  */
  it("goes backwards when the road goes backwards", () => {
    expect(refineStepFraction("rendering")).toBeLessThan(refineStepFraction("reading"));
    expect(refineProgress({ stage: "dispatched", step: "rendering" })?.word).toBe("painting");
  });

  /*
    THE ARITHMETIC IS COUNTED, NOT WRITTEN DOWN. A fifth stage would move every
    figure above by editing one list; a table of fractions beside the list is
    the second copy working law 4 is about.
  */
  it("derives every fraction from the list of stages itself", () => {
    expect(REFINE_STEPS.map(refineStepFraction))
      .toEqual(REFINE_STEPS.map((_, index) => (index + 1) / REFINE_STEPS.length));
    expect(refineStepFraction(REFINE_STEPS[REFINE_STEPS.length - 1])).toBe(1);
  });
});
