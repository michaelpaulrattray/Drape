import { describe, expect, it } from "vitest";

import { accessoryEntry, accessoryKindOf } from "./accessoryKinds";

/**
 * WHICH ACCESSORY AN INSTRUCTION NAMES — carried here from `maskedRefine.test.ts`.
 *
 * These arms used to reach this table through the masked-edit harvest and the
 * landmark helper beside it, and both were deleted with the paste road (#2859,
 * his word *"delete dead code"*). What the arms actually pinned was this
 * table's own reading of the customer's words — `accessoryEntry`'s longest
 * match — and that still has live readers (`pointerCut.ts`, `pairClauseFor`,
 * `accessoryKindOf`). No other suite drove it, so the arms moved to the table
 * they were always about rather than dying with the road they went through.
 */
describe("an accessory is read by WHAT IT IS, not by which slot it landed in", () => {
  /* One row per object type, so no single case is the only witness — the
     harvest's literal `"earring"` fallback was true for the only case anyone
     had driven, which is how a glasses edit came to harvest at her earlobes. */
  const OBJECTS = [
    { described: "small gold hoops", region: "earring", landmark: "earlobe" },
    { described: "thin wire glasses", region: "glasses", landmark: "eye" },
    { described: "round tortoiseshell glasses", region: "glasses", landmark: "eye" },
    { described: "a small nose stud", region: "nose stud", landmark: "nose" },
  ];

  for (const object of OBJECTS) {
    it(`files "${object.described}" as ${object.region}, anchored at the ${object.landmark}`, () => {
      expect(accessoryKindOf(object.described)).toBe(object.region);
      expect(accessoryEntry(object.described)?.landmark).toBe(object.landmark);
    });
  }

  it("answers nothing for a thing nobody has a row for, rather than guessing one", () => {
    expect(accessoryEntry("an anklet")).toBeNull();
    expect(accessoryEntry(undefined)).toBeNull();
    expect(accessoryKindOf("a silver anklet")).toBeNull();
  });

  it("takes the LONGEST match, so a list's order cannot decide anatomy", () => {
    /* "a small nose stud" contains both "stud" and "nose stud". A first-match
       scan put it on her earlobe — an answer that depended on array order is a
       defect waiting for somebody to tidy the array. */
    expect(accessoryKindOf("a small nose stud")).toBe("nose stud");
    expect(accessoryEntry("a small nose stud")?.landmark).toBe("nose");
    /* The control: the shorter word alone still means an earring. */
    expect(accessoryKindOf("a small stud")).toBe("earring");
    expect(accessoryEntry("a small stud")?.landmark).toBe("earlobe");
  });
});
