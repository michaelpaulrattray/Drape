/**
 * `briefLength.ts` — the two bounds and the one rule (#131 slice D).
 */
import { describe, expect, it } from "vitest";

import { BRIEF_TEXT_MAX, BRIEF_TEXT_MAX_AUTHOR_ROAD, briefTooLongOffTheRoad } from "./briefLength";

describe("the brief bounds", () => {
  it("the unflagged bound is the one the entrance always had, and the road's bound holds a 400-word prompt", () => {
    expect(BRIEF_TEXT_MAX).toBe(2000);
    // The court's longest authored prompt was 2,758 characters (run2, arm C brief ii).
    expect(BRIEF_TEXT_MAX_AUTHOR_ROAD).toBeGreaterThanOrEqual(2758);
  });

  it("refuses only off the road, and only past the bound", () => {
    const atBound = "x".repeat(BRIEF_TEXT_MAX);
    const over = "x".repeat(BRIEF_TEXT_MAX + 1);
    expect(briefTooLongOffTheRoad(atBound, false)).toBe(false);
    expect(briefTooLongOffTheRoad(over, false)).toBe(true);
    expect(briefTooLongOffTheRoad(over, true)).toBe(false);
  });
});
