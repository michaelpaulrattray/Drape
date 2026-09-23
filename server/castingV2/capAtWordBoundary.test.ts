import { describe, expect, it } from "vitest";

import { capAtWordBoundary, capForEcho } from "./capAtWordBoundary";

/**
 * The cut that must not land inside a word.
 *
 * Both halves are driven here rather than through their callers, because the
 * defect this closes (#1122) was a RULE with two implementations: the
 * word-boundary cap existed at 80 in `heritagePromotion` and the projection
 * re-cut the same string at 60 with a bare slice. Pinning the rule where it is
 * declared is what stops a third caller writing its own.
 */
describe("capAtWordBoundary", () => {
  it("returns a short string untouched, byte for byte", () => {
    expect(capAtWordBoundary("a fashion model, mid 20s", 60)).toBe("a fashion model, mid 20s");
  });

  it("cuts at the last space, never inside the word that crosses the bound", () => {
    const capped = capAtWordBoundary(
      "a beauty campaign casting, luminous skin, wide-set eyes, cropped platinum hair",
      60,
    );
    expect(capped).toBe("a beauty campaign casting, luminous skin, wide-set eyes,");
    expect(capped.length).toBeLessThanOrEqual(60);
  });

  it("falls back to the hard slice when there is no space to cut at", () => {
    // A single unbroken token has no word boundary to find, and returning
    // nothing would be worse than returning it clipped.
    expect(capAtWordBoundary("x".repeat(200), 60)).toBe("x".repeat(60));
  });
});

describe("capForEcho", () => {
  it("drops the separator the cut left dangling, so the sentence closes cleanly", () => {
    // The echo appends the rest of its sentence and a full stop, so a value
    // ending in a comma renders "wide-set eyes,." — a second visible defect
    // underneath the first.
    expect(
      capForEcho("a beauty campaign casting, luminous skin, wide-set eyes, cropped platinum hair", 60),
    ).toBe("a beauty campaign casting, luminous skin, wide-set eyes");
  });

  it("strips NOTHING from a value it did not truncate", () => {
    // The scoping that keeps every non-defect value identical to what ships
    // today: a short category the user really did end with a dash is theirs.
    expect(capForEcho("a model —", 60)).toBe("a model —");
    expect(capForEcho("a dad in his 30s.", 60)).toBe("a dad in his 30s.");
  });

  it("never returns empty when the cut leaves only punctuation", () => {
    const value = `${",".repeat(59)} tail`;
    expect(capForEcho(value, 60).length).toBeGreaterThan(0);
  });
});
