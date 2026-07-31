import { describe, expect, it } from "vitest";

import { SYSTEM_PROMPT_FOR_TESTS } from "./interpreter";

const PROMPT = SYSTEM_PROMPT_FOR_TESTS();

/**
 * A fuzzy age is still a stated age (catalog H12).
 *
 * "a young male Mediterranean model inspired by versace editorial" captured sex
 * and heritage, dropped "young", and ran a sheet of 40s–60s faces. The fifth
 * instance of the same failure: a fact the brief plainly states, discarded
 * because it was not stated precisely.
 *
 * The mapping itself lives in the interpreter's prompt, and the interpreter is a
 * language model — so this cannot assert the mapping's OUTPUT offline without
 * either calling a paid API or stubbing the very thing under test. What it can
 * do, and what actually protects the fix, is prove the table is still there and
 * still says both halves. Verified live at the time of the fix: young→20s,
 * teenage→teens, middle-aged→40s, older→60s, elderly→70s+, each with the phase
 * left null.
 */

const IDIOMS: Array<[string, string]> = [
  ["young", "20s"],
  ["teenage", "teens"],
  ["middle-aged", "40s"],
  ["older", "60s"],
  ["elderly", "70s+"],
  ["twenty-something", "20s"],
  ["thirty-something", "30s"],
];

describe("the age-idiom table survives in the prompt", () => {
  it.each(IDIOMS)("maps %s to %s", (idiom, band) => {
    const table = PROMPT.slice(
      PROMPT.indexOf("A FUZZY AGE IS STILL A STATED AGE"),
    ).slice(0, 1200);
    expect(table).toContain(idiom);
    expect(table).toContain(band);
  });

  it("states the other half — the band is the fact, the phase is the latitude", () => {
    // Without this the fix overshoots the way the restraint doctrine did:
    // "young" would become "early 20s", inventing precision nobody wrote.
    expect(PROMPT).toContain("agePhase NULL");
    expect(PROMPT).toMatch(/only when the brief truly says nothing about age/i);
  });

  it("forbids brand names in the two fields that reach the image engine", () => {
    expect(PROMPT).toMatch(/NEVER write a fashion house, magazine or brand name/);
  });
});
