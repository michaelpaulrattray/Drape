import { describe, expect, it } from "vitest";

import {
  chainWithout,
  composeChain,
  fingerprintDelta,
  matchSteps,
  readChain,
  readRemovalSubject,
  sameChain,
  type ChainStep,
} from "./refineRemoval";

const step = (instruction: string, delta: ChainStep["delta"]): ChainStep => ({ instruction, delta });

/**
 * TYPED REMOVAL RESOLVES AGAINST THE RECIPE (D-163).
 *
 * The model classifies intent and hands back the user's own words. Everything
 * here is mechanical, because three phrasing-list failures in one week made
 * "the code owns the vocabulary" a law: a list of surface forms is a guard that
 * only ever proves the implementation matches itself.
 */
describe("matching the steps a removal takes out", () => {
  const chain = [
    step("give her a mullet", { hairStyle: "a mullet" }),
    step("a smokey eye", { makeup: "a smokey eye" }),
    step("small gold hoops", { free: { statedAccessories: "small gold hoops" } }),
    step("glossy nude lip gloss", { makeup: "glossy nude lip gloss" }),
  ];

  it("takes the WHOLE subject when they name the subject", () => {
    /* "Remove the makeup" — both makeup steps, because they named the lot. */
    expect(matchSteps(chain, { subject: "makeup", match: null })).toEqual([1, 3]);
  });

  it("takes ONE step when they name one thing", () => {
    expect(matchSteps(chain, { subject: "makeup", match: "smokey eye" })).toEqual([1]);
  });

  it("matches across the lane boundary, by facet", () => {
    /* The accessories step is free-lane; the subject name is the free one. */
    expect(matchSteps(chain, { subject: "statedAccessories", match: "hoops" })).toEqual([2]);
  });

  /*
    RULE 3's TRIGGER. Words that match no step ARE "no matching step", so this
    returns nothing and the caller falls through to an ordinary content edit.
    Taking every makeup step because they named one that is not there would
    destroy something they never asked to remove.
  */
  it("takes NOTHING when the words match no step", () => {
    expect(matchSteps(chain, { subject: "makeup", match: "winged liner" })).toEqual([]);
  });

  it("takes nothing when the subject has no steps at all", () => {
    expect(matchSteps(chain, { subject: "brows", match: null })).toEqual([]);
  });

  /*
    MATCHED AGAINST THE FILED VALUES TOO, not only the sentence.

    "Make it greener" stores a sentence that never contains the word the delta
    holds. Matching the sentence alone would miss it; matching the value alone
    would miss the cases where the user's phrasing is the only place their word
    appears. Both, always.
  */
  it("matches a word that only appears in the filed value", () => {
    const relative = [step("make it greener", { eyeColour: "green" })];
    expect(matchSteps(relative, { subject: "eyeColour", match: "green" })).toEqual([0]);
  });

  /* And tolerant of ordinary word endings, for the reason source containment
     learned three times over — "hoops" must find "hoop". */
  it("is tolerant of word endings", () => {
    expect(matchSteps(chain, { subject: "statedAccessories", match: "gold hoop" })).toEqual([2]);
  });

  it("leaves the surviving chain in order", () => {
    const left = chainWithout(chain, [1, 3]);
    expect(left.map((entry) => entry.instruction))
      .toEqual(["give her a mullet", "small gold hoops"]);
    expect(composeChain(left)).toEqual({
      hairStyle: "a mullet",
      free: { statedAccessories: "small gold hoops" },
    });
  });
});

describe("the subject a removal names is code-owned", () => {
  it("accepts a free subject and a guaranteed axis", () => {
    expect(readRemovalSubject("statedAccessories")).toBe("statedAccessories");
    expect(readRemovalSubject("hairColour")).toBe("hairColour");
  });

  /* D-89's gate: a model-authored subject cannot become a matching key. */
  it("refuses anything it invented", () => {
    expect(readRemovalSubject("earrings")).toBeNull();
    expect(readRemovalSubject(42)).toBeNull();
    expect(readRemovalSubject(null)).toBeNull();
  });
});

/**
 * A CHAIN IS ONLY USABLE WHEN THE TWO LISTS AGREE.
 *
 * `stepDeltas` arrived after the table shipped. A row without it, or one whose
 * lists disagree, has lost the correspondence that makes index i mean anything —
 * and reconstructing the missing steps by diffing ancestors is right most of the
 * time and silently drops an earlier edit the rest.
 */
describe("reading a variant's chain", () => {
  it("pairs the sentences with their own deltas", () => {
    const chain = readChain(["a mullet"], [{ hairStyle: "a mullet" }]);
    expect(chain).toEqual([{ instruction: "a mullet", delta: { hairStyle: "a mullet" } }]);
  });

  it("refuses a pre-column row rather than approximating it", () => {
    expect(readChain(["a mullet"], [])).toBeNull();
  });

  it("refuses a row whose lists disagree", () => {
    expect(readChain(["a", "b"], [{ makeup: "x" }])).toBeNull();
  });
});

/**
 * RULE 4 IS A MONEY RULE, so its comparison is the money-critical part.
 *
 * If the recipe they described already exists as a picture they get that
 * picture and pay nothing — so a comparison that says "different" when they are
 * the same charges 25 credits for a phrasing.
 */
describe("deciding whether a chain already exists", () => {
  it("ignores the order keys happen to have been written in", () => {
    const a = { hairStyle: "a mullet", free: { brows: "thick" } };
    const b = { free: { brows: "thick" }, hairStyle: "a mullet" };
    expect(fingerprintDelta(a)).toBe(fingerprintDelta(b));
    /* And JSON.stringify — the obvious wrong tool — does not. */
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("calls two chains the same only when BOTH halves agree", () => {
    const chain = { instructions: ["a", "b"], delta: { makeup: "a smokey eye" } };
    expect(sameChain(chain, { instructions: ["a", "b"], delta: { makeup: "a smokey eye" } }))
      .toBe(true);
    /* Same sentences, different resolved values — a relative step ("greener
       still") that landed somewhere else. The same words, a different face. */
    expect(sameChain(chain, { instructions: ["a", "b"], delta: { makeup: "winged liner" } }))
      .toBe(false);
    /* Same values, different histories — a record that would lie about how it
       got here. */
    expect(sameChain(chain, { instructions: ["a", "c"], delta: { makeup: "a smokey eye" } }))
      .toBe(false);
    expect(sameChain(chain, { instructions: ["a"], delta: { makeup: "a smokey eye" } }))
      .toBe(false);
  });
});
