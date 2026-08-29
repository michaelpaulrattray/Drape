/**
 * `shared/imagination.ts` — the meter's two positions and the copy under them.
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_IMAGINATION, IMAGINATION_LINES, IMAGINATION_NAMES, IMAGINATIONS } from "../../shared/imagination";

describe("the imagination meter", () => {
  it("has his two positions with LOW as the default, and a name and a line for each", () => {
    expect(IMAGINATIONS).toEqual(["low", "max"]);
    expect(DEFAULT_IMAGINATION).toBe("low");
    for (const imagination of IMAGINATIONS) {
      expect(IMAGINATION_NAMES[imagination].length).toBeGreaterThan(0);
      expect(IMAGINATION_LINES[imagination].length).toBeGreaterThan(20);
    }
  });

  it("the lines are honest about today: no style picker, no promise the author does not keep", () => {
    for (const line of Object.values(IMAGINATION_LINES)) {
      expect(line.toLowerCase()).not.toMatch(/(^|[^a-z])style(s|\s|$)/);
      expect(line.toLowerCase()).not.toContain("sternum");
    }
    expect(IMAGINATION_LINES.max).toContain("never an exact face");
    /*
      #230 — the copy must describe the road the product takes. MAX rewrites
      the seed into one brief; a line promising the author "adds" something
      beside her words describes the shape the founder refused.
    */
    expect(IMAGINATION_LINES.max).toContain("rewritten");
    expect(IMAGINATION_LINES.max.toLowerCase()).not.toContain("the author adds");
    expect(IMAGINATION_LINES.low).toContain("nothing invented");
  });
});
