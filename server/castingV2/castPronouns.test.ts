import { describe, expect, it } from "vitest";

import { castPronouns } from "./castPronouns";

/**
 * How the product refers to a Cast.
 *
 * Founder finding, on his own roster: the room called Jericho "she". The
 * Siblings card told him to open the sheet *she* came from — a small thing that
 * reads as the product not having looked at the person it is describing.
 *
 * All three conjugations are asserted for all three cases, because the bug this
 * replaces was not "the wrong word" but "one word, everywhere" — and a fix that
 * got `subject` right while leaving `possessive` hardcoded would read as fixed
 * on the surface the founder happened to check.
 */
describe("pronouns come from the record", () => {
  it("conjugates a male Cast", () => {
    const pronouns = castPronouns({ subject: { sex: "male" } });
    expect(pronouns).toEqual({
      subject: "he", object: "him", possessive: "his", plural: false,
    });
  });

  it("conjugates a female Cast", () => {
    const pronouns = castPronouns({ subject: { sex: "female" } });
    expect(pronouns).toEqual({
      subject: "she", object: "her", possessive: "her", plural: false,
    });
  });

  it("conjugates a nonbinary Cast as they", () => {
    const pronouns = castPronouns({ subject: { sex: "nonbinary" } });
    expect(pronouns).toEqual({
      subject: "they", object: "them", possessive: "their", plural: true,
    });
  });

  it("falls back to they when the record does not say", () => {
    /*
      Correct English for a person whose pronouns you do not know, and the only
      honest answer for a Cast signed before the sex axis existed. Guessing from
      a name or a face is not on the table.
    */
    for (const schema of [null, undefined, {}, { subject: {} }, { subject: { sex: null } }]) {
      expect(castPronouns(schema).subject).toBe("they");
    }
  });

  it("survives a schema written in another era", () => {
    /*
      `technicalSchema` is an unstructured JSON column written across several
      eras. A room that failed to render because a pronoun could not be decided
      would be a worse bug than the one this fixes, so anything unreadable
      resolves rather than throws.
    */
    for (const schema of ["a string", 42, [], { subject: "male" }, { subject: { sex: 7 } }]) {
      expect(() => castPronouns(schema)).not.toThrow();
      expect(castPronouns(schema).subject).toBe("they");
    }
  });

  it("reads a sex however it was cased", () => {
    expect(castPronouns({ subject: { sex: "Male" } }).subject).toBe("he");
    expect(castPronouns({ subject: { sex: "FEMALE" } }).subject).toBe("she");
  });

  it("carries plural agreement rather than leaving it to each caller", () => {
    // "they is signed" is the sentence that ships when three call sites each
    // remember the rule separately.
    expect(castPronouns({ subject: { sex: "male" } }).plural).toBe(false);
    expect(castPronouns(null).plural).toBe(true);
  });
});

describe("the identity documents stay behind", () => {
  it("projects words, never the schema they came from", async () => {
    /*
      The sex lives in `technicalSchema`, one third of the recipe for
      reproducing a Cast, which never leaves the owning account (founder ruling,
      2026-07-25). Pronouns are not identity documents; the record they were
      derived from is.
    */
    const fs = await import("node:fs/promises");
    const projection = await fs.readFile(
      new URL("./castProjection.ts", import.meta.url), "utf8");
    expect(projection).toContain("castPronouns(input.model.technicalSchema)");
    // The schema itself is still absent from the projection's output.
    const output = projection.slice(0, projection.indexOf("export function projectSignedCast"));
    expect(output).not.toContain("technicalSchema:");
  });
});
