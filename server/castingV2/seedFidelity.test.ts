/**
 * THE FIDELITY CHECK (#230) — the control that pays for the rewrite.
 *
 * The founder replaced an append-only construction the court had measured as
 * fact-safe with a rewrite, on his own eye, and named the mitigation in the
 * same breath: *"Keep the raw seed internally for the fidelity check."* These
 * arms are that check, and they are written to fail in both directions —
 * a dropped fact must redden, and an ordinary editorial paragraph must not.
 *
 * The second half is the one that matters more here. A fidelity check that
 * refuses good rewrites does not merely annoy: every false refusal costs the
 * customer MAX and drops them silently back to their own words, which is the
 * feature quietly turning itself off. So each guard carries its NEGATIVE
 * control beside its positive one, and the phrases in them ("men's tailoring",
 * "a man's white shirt", "a boyish crop") are the ordinary fashion English
 * that a word-boundary written the obvious way would have refused.
 */
import { describe, expect, it } from "vitest";

import { ageClaimsIn, ageContradictionIn, droppedFactIn, saysSex, seedFactsOf } from "./seedFidelity";

const MID_30S = { band: "30s", phase: "mid" } as const;

describe("what the SEED said, read from the seed and never from the reader's inference", () => {
  it("a fact the customer wrote in words is checked; a fact the reader only inferred is not", () => {
    /* She wrote "woman" and "mid 30s" — both are hers, both are checked. */
    expect(seedFactsOf("goth woman mid 30s", { sex: "female", age: MID_30S }))
      .toEqual({ sex: "female", age: MID_30S });
    /*
      THE LOAD-BEARING ARM. The reader sets `sex` from a role noun and
      `ageBand` from an idiom, so a check anchored on the READER would demand
      that the rewrite restate a fact the customer never wrote — and every such
      refusal costs her MAX for nothing.
    */
    expect(seedFactsOf("a ballerina, weathered and grave", { sex: "female", age: { band: "50s", phase: null } }))
      .toEqual({ sex: null, age: null });
    /*
      One stated and one inferred: only the stated one is checked. The age is
      hers ("aged 52"); the sex the reader read out of "ballerina" is not, and
      "in her 50s" would have made it hers — which is the distinction.
    */
    expect(seedFactsOf("a ballerina, aged 52", { sex: "female", age: { band: "50s", phase: null } }))
      .toEqual({ sex: null, age: { band: "50s", phase: null } });
    expect(seedFactsOf("a ballerina in her 50s", { sex: "female", age: { band: "50s", phase: null } }))
      .toEqual({ sex: "female", age: { band: "50s", phase: null } });
  });

  it("nothing recorded means nothing checked — a brief that named neither is not policed into naming one", () => {
    expect(seedFactsOf("a cyber-goth", { sex: null, age: null })).toEqual({ sex: null, age: null });
    expect(droppedFactIn("Anything at all.", { sex: null, age: null })).toBeNull();
  });
});

describe("the sex a paragraph says", () => {
  it("any of the sex's own surface words keeps the fact — a paragraph that says only 'she' has kept it", () => {
    expect(saysSex("She reads severe, in blackened velvet.", "female")).toBe(true);
    expect(saysSex("A woman held to a hard editorial line.", "female")).toBe(true);
    expect(saysSex("A man, weathered, in a grey wool coat.", "male")).toBe(true);
    expect(saysSex("An androgynous, gender-neutral presence.", "nonbinary")).toBe(true);
  });

  it("the boundary does not run into a longer word or a possessive — the ordinary fashion English this would have refused", () => {
    /* "woman" is not "man", and both of these are sentences about a woman. */
    expect(saysSex("A woman in men's tailoring.", "male")).toBe(false);
    expect(saysSex("A woman in a man's white shirt.", "male")).toBe(false);
    expect(saysSex("She wears a boyish crop and menswear.", "male")).toBe(false);
    /* Positive control on the same shape: the bare word IS the word. */
    expect(saysSex("A man in a white shirt.", "male")).toBe(true);
  });
});

describe("the dropped fact, in the words a re-ask can quote", () => {
  it("a rewrite that stops saying who she is reddens, and names which fact", () => {
    const facts = { sex: "female", age: MID_30S } as const;
    expect(droppedFactIn("Pale cool-toned skin, black lace, patent and metal hardware.", facts))
      .toContain("sex");
    expect(droppedFactIn("A woman in blackened velvet, patent and metal hardware.", facts))
      .toContain("age");
    /* Both kept, in her own register rather than her own words: nothing to say. */
    expect(droppedFactIn("A goth woman in her mid 30s, pale and severe.", facts)).toBeNull();
  });

  it("an age kept in ANY readable wording passes — the check is a value, never a substring", () => {
    const facts = { sex: null, age: MID_30S } as const;
    for (const kept of [
      "in her mid-thirties, severe",
      "she is aged 34",
      "a thirty-something presence",
      "35 years old, self-possessed",
      "early 30s, if the styling reads at all",
    ]) expect(droppedFactIn(kept, facts), kept).toBeNull();
  });

  it("era styling is not an age claim, so a paragraph whose only decade is a genre has still dropped the age", () => {
    expect(ageClaimsIn("70s disco styling: sequins, lamé, mirrored texture.")).toEqual([]);
    expect(droppedFactIn("70s disco styling: sequins, lamé, mirrored texture.", { sex: null, age: MID_30S }))
      .toContain("age");
  });

  it("DROPPED and MOVED are different failures, and the contradiction check still answers its own question", () => {
    /* "A young woman" both moves the age and states no readable band — the two checks disagree on purpose. */
    expect(ageContradictionIn("A young woman in blackened velvet.", MID_30S)).toBe("young");
    expect(droppedFactIn("A young woman in blackened velvet.", { sex: "female", age: MID_30S })).toContain("age");
    /* `draftRefusal` runs the contradiction FIRST so the more precise sentence wins; asserted at the author. */
  });
});
