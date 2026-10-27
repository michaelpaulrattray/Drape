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
import { READER_OUTAGE_MESSAGE } from "./briefRefusalCopy";

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

  it("gives the two OUTAGE reasons the same words, and does NOT give them to the transient one", () => {
    /*
      ⚠ THIS ARM USED TO PIN THE OPPOSITE PAIRING AND THAT WAS THE DEFECT
      (#2686). It read `expect(unreadable).toBe(no_transport)` on the reasoning
      that the two "differ only in whose fault it was ... she is asked to do the
      identical thing by both". She is not: a noisy read is worth retrying in a
      moment and a studio with no reader is not.

      The pair that genuinely shares a sentence is `no_transport` (no reader
      configured) and `reader_outage` (the reader refuses US) — both mean the
      studio cannot do this and neither is about the picture.

      Every OTHER pair must differ: the founder's own complaint that opened #204
      was a creature upload meeting the sentence written for an empty picture,
      and a table that quietly collapsed two doors onto one sentence would
      reproduce it with nothing going red.
    */
    expect(CONCEPT_DESCRIBE_COPY.no_transport).toBe(CONCEPT_DESCRIBE_COPY.reader_outage);
    expect(CONCEPT_DESCRIBE_COPY.unreadable).not.toBe(CONCEPT_DESCRIBE_COPY.no_transport);
    const distinct = new Set(Object.values(CONCEPT_DESCRIBE_COPY));
    expect(distinct.size).toBe(Object.keys(CONCEPT_DESCRIBE_COPY).length - 1);
  });

  it("tells the customer to try LATER on an outage and IN A MOMENT only when that is true", () => {
    /*
      The whole of #2686 in two assertions. On production from 03:09Z on
      2026-10-27 the text account key was disabled, every call answered 401, and
      the upload door said "Try again in a moment" to every attempt — advice no
      retry could satisfy.
    */
    expect(CONCEPT_DESCRIBE_COPY.reader_outage).toMatch(/try again later/i);
    expect(CONCEPT_DESCRIBE_COPY.reader_outage).not.toMatch(/in a moment/i);
    /* The positive control: the genuinely transient reason keeps its advice,
       so this is a split and not a blanket reword. */
    expect(CONCEPT_DESCRIBE_COPY.unreadable).toMatch(/in a moment/i);
  });

  it("names THE STUDIO as the actor on an outage, as the roll road's wall does for the same fact", () => {
    /*
      THE ONE FACT, TWO ENTRANCES — the `no_being` arm's discipline applied to
      the other sameness this table carries. A customer whose brief cannot be
      read and a customer whose picture cannot be read are being told the same
      thing about whose problem it is.

      The assertion is the ATTRIBUTION and not the whole sentence, deliberately:
      the roll road adds what happened to the money because a roll costs
      credits, and this entrance is house money on every call so it has none to
      report.
    */
    expect(READER_OUTAGE_MESSAGE).toContain("The studio");
    expect(CONCEPT_DESCRIBE_COPY.reader_outage).toContain("The studio");
  });

  it("the outage sentence invents no charge and names no engine", () => {
    /*
      Two laws in one arm. A concept read is HOUSE MONEY on every call
      (`routes/castingV2.ts`, above its rate limit), so the roll road's
      "you have not been charged" would be telling her about money that was
      never at stake. And the disappearing-technology law's one hard line
      (clause 5) is that no engine or vendor name sits on a path someone must
      walk to reach their picture.
    */
    expect(CONCEPT_DESCRIBE_COPY.reader_outage).not.toMatch(/charge|credit|refund|billed/i);
    for (const sentence of Object.values(CONCEPT_DESCRIBE_COPY)) {
      expect(sentence).not.toMatch(/openrouter|gemini|nano banana|sunburst|gpt|fal-ai|anthropic|openai/i);
    }
  });

  it("NEGATIVE CONTROL — no sentence sends her looking for a better photograph of OUR fault", () => {
    /*
      #185's ruling in one arm: `not_a_casting_note` is a fault in the read we
      produced, so its sentence must not imply her picture was the problem. The
      same holds for `ran_long`, which is the same family split off it (#1067 —
      prose that overran is ours exactly as an inventory is), and for the two
      transport sentences, which say "just now".
    */
    for (const reason of ["not_a_casting_note", "ran_long", "unreadable", "no_transport", "reader_outage"] as const) {
      expect(CONCEPT_DESCRIBE_COPY[reason], reason).not.toMatch(/clearer|better (shot|picture|photo)/i);
    }
    /* And the positive half: the door that IS about her picture says so. */
    expect(CONCEPT_DESCRIBE_COPY.not_about_the_person).toMatch(/clearer shot/);
  });
});
