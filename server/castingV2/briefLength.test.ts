/**
 * `briefLength.ts` — one bound and one rule (#131 slice D; review of PR #137,
 * findings 1 and 2; narrowed to one road by #1204).
 *
 * ⚠ **THESE ARMS ARE WHY THE OLD BOUND LOOKED ALIVE.** They drove
 * `briefTooLong(text, false)` directly, so the house road's refusal was proven
 * to work every single run — on a road that, from 2026-09-24, no account could
 * be on. **A guard that drives a predicate directly cannot tell you whether
 * anything still satisfies it**, and that is the path-three class in one
 * sentence. The arms below take the road predicate out with the bound, so what
 * is asserted is what the product can actually reach.
 */
import { describe, expect, it } from "vitest";

import {
  BRIEF_TEXT_MAX_AUTHOR_ROAD,
  BRIEF_TOO_LONG_AUTHOR_ROAD_MESSAGE,
  briefTooLong,
} from "./briefLength";

describe("the brief bound", () => {
  it("holds a 400-word authored prompt, which is the reason it is this size", () => {
    // The court's longest authored prompt was 2,758 characters (run2, arm C brief ii).
    expect(BRIEF_TEXT_MAX_AUTHOR_ROAD).toBeGreaterThanOrEqual(2758);
    expect(BRIEF_TEXT_MAX_AUTHOR_ROAD).toBe(4000);
  });

  it("refuses only past the bound, with its own sentence, and says nothing was charged", () => {
    const atBound = "x".repeat(BRIEF_TEXT_MAX_AUTHOR_ROAD);
    const overBound = "x".repeat(BRIEF_TEXT_MAX_AUTHOR_ROAD + 1);
    expect(briefTooLong(atBound)).toBeNull();
    expect(briefTooLong(overBound)).toBe(BRIEF_TOO_LONG_AUTHOR_ROAD_MESSAGE);
    // The refusal is free, and the sentence is the only place that promises it.
    expect(BRIEF_TOO_LONG_AUTHOR_ROAD_MESSAGE).toContain("not been charged");
  });

  /*
    THE BOUND THE REFUSAL NAMES IS THE BOUND IT ENFORCES.

    An announced cap is a brief (memory `announced-cap-is-a-brief`) and a
    sentence quoting a different number from the one in force is how a customer
    learns the product has two opinions. The old pair drifted this way by
    construction — two numbers, two sentences — and one of each has now gone.
  */
  it("names the number it actually enforces", () => {
    expect(BRIEF_TOO_LONG_AUTHOR_ROAD_MESSAGE).toContain(
      BRIEF_TEXT_MAX_AUTHOR_ROAD.toLocaleString("en-US"),
    );
  });

  /*
    ⚠ THE ABSENCE ARM (#1204). The house bound is retired, not renamed, and a
    module that re-exported it would put the unreachable road back without a
    single test going red — which is exactly how it survived the switch sitting.
  */
  it("exports no second bound and no second refusal sentence", async () => {
    const shared = await import("../../shared/briefLength");
    const server = await import("./briefLength");
    expect(Object.keys(shared)).not.toContain("BRIEF_TEXT_MAX");
    expect(Object.keys(server)).not.toContain("BRIEF_TEXT_MAX");
    expect(Object.keys(server)).not.toContain("BRIEF_TOO_LONG_MESSAGE");
    // Positive control: the reader can see the names that ARE there.
    expect(Object.keys(server)).toContain("BRIEF_TEXT_MAX_AUTHOR_ROAD");
    expect(Object.keys(shared)).toContain("BRIEF_TEXT_MIN");
  });
});
