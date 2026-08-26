/**
 * `briefLength.ts` — the two bounds and the one rule, keyed on the ROAD (#131
 * slice D; review of PR #137, findings 1 and 2).
 */
import { describe, expect, it } from "vitest";

import {
  BRIEF_TEXT_MAX,
  BRIEF_TEXT_MAX_AUTHOR_ROAD,
  BRIEF_TOO_LONG_AUTHOR_ROAD_MESSAGE,
  BRIEF_TOO_LONG_MESSAGE,
  briefTooLong,
} from "./briefLength";

describe("the brief bounds", () => {
  it("the house bound is the one the entrance always had, and the road's bound holds a 400-word prompt", () => {
    expect(BRIEF_TEXT_MAX).toBe(2000);
    // The court's longest authored prompt was 2,758 characters (run2, arm C brief ii).
    expect(BRIEF_TEXT_MAX_AUTHOR_ROAD).toBeGreaterThanOrEqual(2758);
  });

  it("refuses per road, only past that road's bound, each with its own sentence", () => {
    const at2000 = "x".repeat(BRIEF_TEXT_MAX);
    const over2000 = "x".repeat(BRIEF_TEXT_MAX + 1);
    const at4000 = "x".repeat(BRIEF_TEXT_MAX_AUTHOR_ROAD);
    const over4000 = "x".repeat(BRIEF_TEXT_MAX_AUTHOR_ROAD + 1);
    expect(briefTooLong(at2000, false)).toBeNull();
    expect(briefTooLong(over2000, false)).toBe(BRIEF_TOO_LONG_MESSAGE);
    expect(briefTooLong(over2000, true)).toBeNull();
    expect(briefTooLong(at4000, true)).toBeNull();
    expect(briefTooLong(over4000, true)).toBe(BRIEF_TOO_LONG_AUTHOR_ROAD_MESSAGE);
  });
});
