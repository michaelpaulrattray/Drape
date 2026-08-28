/**
 * THE CONCEPT UPLOAD'S REFUSAL SENTENCES — the arms that close a gap the route
 * used to declare in a comment (#192).
 *
 * Working law 2: each of these has to be able to FAIL. The sabotage record for
 * this shift drives each one by editing the thing it claims to hold.
 */
import { describe, expect, it } from "vitest";

import { CONCEPT_DESCRIBE_COPY, conceptDescribeSentence } from "./conceptDescribeCopy";
import { NOT_A_BEING_MESSAGE } from "./briefCompiler";

/**
 * THE ONE BOUNDARY, TWO ENTRANCES. `no_being` and the roll road's
 * `not_a_being` are deliberately the same sentence about the same thing — a
 * customer who uploads a photograph of a car and a customer who types "a car"
 * are being told the identical fact. Until this arm the sameness was asserted
 * by a comment in `server/routes/castingV2.ts`, which its own text called out
 * as the shape this repository has been burned by.
 *
 * The assertion is the SHARED CLAUSE rather than the whole sentence, because
 * the two doors legitimately differ on what comes after it: the roll road says
 * what happened to the money, the upload door has taken none.
 */
const SHARED_BOUNDARY_CLAUSE = "people and creatures, not objects, vehicles or places";

describe("the concept upload's refusal copy", () => {
  it("says the same thing about the same boundary as the roll road's wall", () => {
    expect(NOT_A_BEING_MESSAGE).toContain(SHARED_BOUNDARY_CLAUSE);
    expect(CONCEPT_DESCRIBE_COPY.no_being).toContain(SHARED_BOUNDARY_CLAUSE);
  });

  it("carries a sentence for every refusal, and none of them is empty", () => {
    /*
      The exhaustiveness that matters is the TYPE's — `Record<ConceptDescribeRefusal, string>`
      refuses a missing member at compile time, which is why there is no
      hand-typed list of expected keys here. What a runtime arm can still add:
      that no entry is a placeholder, and that the accessor really reads the
      table rather than returning a constant.
    */
    for (const [reason, sentence] of Object.entries(CONCEPT_DESCRIBE_COPY)) {
      expect(sentence.trim().length, reason).toBeGreaterThan(20);
      expect(conceptDescribeSentence(reason as keyof typeof CONCEPT_DESCRIBE_COPY)).toBe(sentence);
    }
  });

  it("gives the two OUR-FAULT reasons the same words and the four kinds different ones", () => {
    /*
      `unreadable` and `no_transport` differ only in whose fault it was, which
      is our fact and not hers — she is asked to do the identical thing. Every
      OTHER pair must differ: the founder's own complaint that opened #204 was a
      creature upload meeting the sentence written for an empty picture, and a
      table that quietly collapsed two doors onto one sentence would reproduce
      it with nothing going red.
    */
    expect(CONCEPT_DESCRIBE_COPY.unreadable).toBe(CONCEPT_DESCRIBE_COPY.no_transport);
    const distinct = new Set(Object.values(CONCEPT_DESCRIBE_COPY));
    expect(distinct.size).toBe(Object.keys(CONCEPT_DESCRIBE_COPY).length - 1);
  });

  it("NEGATIVE CONTROL — no sentence sends her looking for a better photograph of OUR fault", () => {
    /*
      #185's ruling in one arm: `not_a_casting_note` is a fault in the read we
      produced, so its sentence must not imply her picture was the problem. The
      same holds for the two transport sentences, which say "just now".
    */
    for (const reason of ["not_a_casting_note", "unreadable", "no_transport"] as const) {
      expect(CONCEPT_DESCRIBE_COPY[reason], reason).not.toMatch(/clearer|better (shot|picture|photo)/i);
    }
    /* And the positive half: the door that IS about her picture says so. */
    expect(CONCEPT_DESCRIBE_COPY.not_about_the_person).toMatch(/clearer shot/);
  });
});
