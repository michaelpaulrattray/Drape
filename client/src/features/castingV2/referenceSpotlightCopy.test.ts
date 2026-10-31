import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import * as copy from "./referenceSpotlightCopy";

/**
 * THE SPOTLIGHT'S WORDS, AUDITED AS ASSERTIONS — the UI milestone contract's
 * mechanizable half (founder, 2026-08-01) and the disappearing-technology law's
 * third question: *where does the technology show?*
 */

const DESIGN = join(
  import.meta.dirname,
  "..", "..", "..", "..",
  "docs", "specs", "REFERENCE_SELECTOR_BUILD_DESIGN_2026-10-28.md",
);

/** The design as one line of prose — it is wrapped at 80 columns, and a sentence crosses lines. */
function designText(): string {
  return readFileSync(DESIGN, "utf8").replace(/\s+/g, " ");
}

/** Every customer-visible string this module holds, including both forms of the let-go label. */
function everyString(): string[] {
  return [
    copy.SPOTLIGHT_READING,
    copy.SPOTLIGHT_NOTHING_THERE,
    copy.SPOTLIGHT_NOT_A_FACE,
    copy.SPOTLIGHT_TAKING_LABEL,
    copy.SPOTLIGHT_STAGE_LABEL,
    copy.SPOTLIGHT_UNNAMED_LABEL,
    copy.letGoLabel("jacket"),
    copy.letGoLabel(null),
  ];
}

describe("the spotlight's words", () => {
  it("say the reading in the design's own words (§3 item 1)", () => {
    const design = designText();
    expect(design).toContain(`**"${copy.SPOTLIGHT_READING}"**`);
  });

  it("keep the design's refusal sentence, with only the place moved for a tap", () => {
    const design = designText();
    const original = "We couldn't find anything in this picture to take. You can still describe what you want in words.";
    expect(design).toContain(original);
    expect(copy.SPOTLIGHT_NOTHING_THERE).toBe(original.replace("in this picture", "there"));
  });

  it("never name the machinery — no engine, no split, no pieces, no percentage", () => {
    const machinery = /\b(split|segment\w*|mask\w*|model|engine|sam|fal|piece map|hit-?test|pixel\w*|ai)\b|%/i;
    for (const line of everyString()) expect(line, line).not.toMatch(machinery);
  });

  it("never gender anyone", () => {
    for (const line of everyString()) expect(line, line).not.toMatch(/\b(she|he|her|him|his|hers)\b/i);
  });

  it("say what to do whenever they say no", () => {
    for (const refusal of [copy.SPOTLIGHT_NOTHING_THERE, copy.SPOTLIGHT_NOT_A_FACE]) {
      expect(refusal).toMatch(/describe what you want in words/);
    }
  });

  it("name what is let go when it has a name, and guess nothing when it does not", () => {
    expect(copy.letGoLabel("leather jacket")).toBe("Let go of the leather jacket");
    /* Measured: the reader answered "Leather jacket" on the real road. */
    expect(copy.letGoLabel("Leather jacket")).toBe("Let go of the leather jacket");
    expect(copy.letGoLabel(null)).toBe("Let go of this");
  });
});
