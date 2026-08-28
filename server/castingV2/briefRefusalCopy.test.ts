/**
 * THE ROLL ENTRANCE'S REFUSAL VOCABULARY (#206).
 *
 * Two jobs. First, the customer sentences are PINNED AT THEIR BYTES — #206 is
 * maintenance, so a sentence changing is a product change wearing a refactor's
 * clothes. `unsupported_cohort`'s was pinned by nothing at all before this
 * commit: it was an inline literal written out TWICE, verbatim, at two raise
 * sites, so either copy could have been reworded and nothing would have gone
 * red (working law 4 — a mirrored list mid-drift).
 *
 * Second, the STRUCTURAL property the capability atlas rests on: this module is
 * imported by the generator, and the Atlas's charter is that it never runs app
 * code. The union is declared here and `briefCompiler.ts` takes the type from
 * here, never the other way round — a direction a convention alone would not
 * hold, since `import type` is erased and dropping the word `type` would be
 * invisible.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BRIEF_TOO_SHORT_MESSAGE } from "@shared/briefLength";

import { ROLL_REFUSAL_COPY, LIKENESS_MESSAGE, NOT_A_BEING_MESSAGE, READER_OUTAGE_MESSAGE, UNSUPPORTED_COHORT_MESSAGE } from "./briefRefusalCopy";

const HERE = __dirname;

describe("the roll entrance's five walls each have a sentence", () => {
  it("the table is exactly the five, and every member resolves", () => {
    expect(Object.keys(ROLL_REFUSAL_COPY).sort()).toEqual([
      "likeness", "not_a_being", "reader_outage", "uninterpretable", "unsupported_cohort",
    ]);
    for (const [code, sentence] of Object.entries(ROLL_REFUSAL_COPY)) {
      expect(sentence.length, code).toBeGreaterThan(20);
    }
  });

  it("⚠ FOUR of the five say 'you have not been charged' — and the fifth is the odd one out", () => {
    /*
      All five are free by construction: `rollService` compiles BEFORE it
      claims, so there is no operation and no ledger entry to unwind. Four of
      them SAY so.

      ⚠ `uninterpretable` does not, and this arm was written expecting it to.
      Its sentence is `BRIEF_TOO_SHORT_MESSAGE` — *"That brief is too short to
      cast from. Describe the person in a sentence."* — shared with the client,
      where it is also shown beside a box the customer has not yet spent
      anything from. So the omission is defensible and it is NOT a bug being
      papered over: it is an inconsistency in the roll entrance's voice, found
      by writing the arm, recorded here rather than "fixed" silently, because
      changing a customer sentence is his eye and is outside #206's bound
      (maintenance: zero customer-visible change).

      The arm is written to go RED if the asymmetry ever changes in either
      direction, so whoever changes it has to come back and read this.
    */
    const silent = Object.entries(ROLL_REFUSAL_COPY)
      .filter(([, sentence]) => !/not been charged/i.test(sentence))
      .map(([code]) => code);
    expect(silent).toEqual(["uninterpretable"]);
  });

  it("⚠ pins the bytes of the sentence that had NO pin — and both raise sites read it", () => {
    /*
      `unsupported_cohort` was two inline copies of one sentence. This is the
      arm that would have caught one of them drifting, and the arm below is the
      one that catches a THIRD copy being written.
    */
    expect(UNSUPPORTED_COHORT_MESSAGE).toBe(
      "Casting makes photographic people, and only ones who are nobody in particular — not a named person, not a character from a game or film, and not anime or illustration yet. Describe the kind of face you want and we'll cast that. You have not been charged.",
    );
    expect(ROLL_REFUSAL_COPY.unsupported_cohort).toBe(UNSUPPORTED_COHORT_MESSAGE);

    const compiler = readFileSync(join(HERE, "briefCompiler.ts"), "utf8");
    /* Both throws now name the constant, and the literal appears nowhere. */
    const named = [...compiler.matchAll(/UNSUPPORTED_COHORT_MESSAGE/g)].length;
    expect(named).toBeGreaterThanOrEqual(3); // the import + two raise sites
    expect(compiler).not.toContain("Casting makes photographic people, and only ones who are nobody in particular");
  });

  it("pins the two founder-kept subject walls at their bytes", () => {
    /*
      `likeness` and `not_a_being` are the Prompt Author ruling's two walls
      (§6 rule 5, and "someone asking for an object should be refused like a
      car"). They are the most-quoted sentences on this road and the ones a
      tidy-up is most likely to "improve".
    */
    expect(LIKENESS_MESSAGE).toBe(
      "Casting makes people and creatures who are nobody in particular — not a named person, and not a "
      + "character from a game, film or show. Describe the kind of face you want and we'll cast that. "
      + "You have not been charged.",
    );
    expect(NOT_A_BEING_MESSAGE).toBe(
      "This is a casting studio — it casts people and creatures, not objects, vehicles or places. "
      + "Describe who you want in the frame and we'll cast them. You have not been charged.",
    );
    expect(READER_OUTAGE_MESSAGE).toMatch(/couldn't read your brief just now/);
    expect(ROLL_REFUSAL_COPY.likeness).toBe(LIKENESS_MESSAGE);
    expect(ROLL_REFUSAL_COPY.not_a_being).toBe(NOT_A_BEING_MESSAGE);
    expect(ROLL_REFUSAL_COPY.reader_outage).toBe(READER_OUTAGE_MESSAGE);
    /* DERIVED, not copied: the floor's sentence is shared with the client. */
    expect(ROLL_REFUSAL_COPY.uninterpretable).toBe(BRIEF_TOO_SHORT_MESSAGE);
  });
});

describe("⚠ the structural property the capability atlas rests on", () => {
  it("this module imports exactly one thing, and that one thing is a leaf", () => {
    /*
      The generator imports this table. If this module reached `briefCompiler.ts`
      — which is where the union lived until #206 — the generator would pull in
      the interpreter and the whole provider layer, and the Atlas's charter is
      that it never runs app code. `conceptDescribeCopy.ts` states the same rule
      after review of #207 and holds it by importing NOTHING; this module cannot,
      because `BRIEF_TOO_SHORT_MESSAGE` is shared with the client and copying it
      would be a second place stating one sentence.

      So the property is asserted on BOTH halves: this file's import list, and
      that the leaf is still a leaf. A `satisfies`-style convention would not
      catch either.
    */
    const specifiersOf = (file: string) =>
      [...readFileSync(file, "utf8").matchAll(/^\s*import\s[^;]*?from\s+"([^"]+)"/gm)].map((m) => m[1]!);

    expect(specifiersOf(join(HERE, "briefRefusalCopy.ts"))).toEqual(["@shared/briefLength"]);
    expect(specifiersOf(join(HERE, "..", "..", "shared", "briefLength.ts"))).toEqual([]);
  });

  it("the union is DERIVED from the table, so a member cannot exist without a sentence", () => {
    /*
      Asserted at the source rather than at the type, because the type is
      erased: a future edit could re-declare `BriefRefusalCode` as a hand-typed
      union beside the table and TypeScript would be perfectly happy while the
      atlas's population silently stopped matching the product's.
    */
    const copy = readFileSync(join(HERE, "briefRefusalCopy.ts"), "utf8");
    expect(copy).toContain("export type BriefRefusalCode = keyof typeof ROLL_REFUSAL_COPY;");
    /* And briefCompiler takes it from here rather than declaring its own. */
    const compiler = readFileSync(join(HERE, "briefCompiler.ts"), "utf8");
    expect(compiler).not.toMatch(/export type BriefRefusalCode\s*=\s*\n?\s*\/\*\*/);
    expect(compiler).toMatch(/from "\.\/briefRefusalCopy"/);
  });

  it("⚠ the wardrobe door's ids are NOT here, and the criterion says why", () => {
    /*
      #206 filed `wardrobeDoor.ts`'s eight ids as a sibling of this defect.
      Read at the bytes they are not doors: a refused pick becomes `null`, the
      reason goes to a LOG COUNTER, and the house line is used — the customer
      is never told anything, so there is no sentence.

      This arm is the verdict made mechanical. It goes red if anyone ever gives
      the wardrobe door a customer sentence, which is exactly when it SHOULD be
      re-decided rather than assumed to still be internal.
    */
    const door = readFileSync(join(HERE, "wardrobeDoor.ts"), "utf8");
    const intent = readFileSync(join(HERE, "castingIntent.ts"), "utf8");
    expect(Object.keys(ROLL_REFUSAL_COPY)).not.toContain("headwear");
    /* No copy table, and the refusal path returns null rather than speaking. */
    expect(door).not.toMatch(/_COPY\s*=/);
    expect(intent).toContain("counter: WARDROBE_PICK_REFUSED");
  });
});
