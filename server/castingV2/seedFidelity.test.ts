/**
 * THE AGE AND SEX VOCABULARY — the closed-surface-form readers the Re-imagine
 * locked-trio checks are built on (#535; `droppedFactIn`/`seedFactsOf` retired
 * with the MAX author — their successors are `lockedTrioOf`/`reimagineRefusal`
 * in `reimagine.ts`, tested there).
 *
 * These arms are written to fail in both directions — a real claim must be
 * read, and ordinary editorial English must not. The second half matters
 * more: every false positive downstream costs a customer their press for
 * nothing, so each guard carries its NEGATIVE control beside its positive one,
 * and the phrases in them ("men's tailoring", "a man's white shirt", "a
 * boyish crop") are the ordinary fashion English a word-boundary written the
 * obvious way would have refused.
 */
import { describe, expect, it } from "vitest";

import { ageClaimsIn, ageContradictionIn, saysSex } from "./seedFidelity";

const MID_30S = { band: "30s", phase: "mid" } as const;

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

describe("the age a paragraph claims", () => {
  it("an age claimed in ANY readable wording is read — the reader is a value, never a substring", () => {
    for (const kept of [
      "in her mid-thirties, severe",
      "she is aged 34",
      "a thirty-something presence",
      "35 years old, self-possessed",
      "early 30s, if the styling reads at all",
    ]) {
      /* One wording can match two claim shapes ("mid-thirties" is possessive
         AND bare); the reading is the set of bands, and it is 30s alone. */
      const claims = ageClaimsIn(kept);
      expect(claims.length, kept).toBeGreaterThan(0);
      expect(new Set(claims), kept).toEqual(new Set(["30s"]));
    }
  });

  it("era styling is not an age claim", () => {
    expect(ageClaimsIn("70s disco styling: sequins, lamé, mirrored texture.")).toEqual([]);
    /* The possessive shape still reads a real elder age. */
    expect(ageClaimsIn("a man in his late 70s")).toEqual(["70s+"]);
  });

  it("a moved age is named in the words a re-ask can quote", () => {
    expect(ageContradictionIn("A young woman in blackened velvet.", MID_30S)).toBe("young");
    expect(ageContradictionIn("The styling reads youthful and soft.", MID_30S)).toBe("youthful");
    expect(ageContradictionIn("in her early 20s, luminous", MID_30S)).toBeTruthy();
    /* Kept in another wording is not moved. */
    expect(ageContradictionIn("Severe editorial styling; she reads in her mid-thirties.", MID_30S)).toBeNull();
    expect(ageContradictionIn("an 80s-inspired matte grade over 90s minimalism", MID_30S)).toBeNull();
  });
});
