/**
 * THE ROLL ENTRANCE'S REFUSAL VOCABULARY (#206).
 *
 * Two jobs. First, the customer sentences are PINNED AT THEIR BYTES — #206 is
 * maintenance, so a sentence changing is a product change wearing a refactor's
 * clothes. `unsupported_cohort`'s was pinned by nothing at all before that
 * commit: it was an inline literal written out TWICE, verbatim, at two raise
 * sites, so either copy could have been reworded and nothing would have gone
 * red (working law 4 — a mirrored list mid-drift).
 *
 * ⚠ **THAT WALL IS RETIRED — #1495, with the two-valued cohort question that
 * was its only source — so the table is FOUR, and the arm that pinned its bytes
 * now pins its ABSENCE instead.** The inversion is deliberate: once a sentence
 * has no raise site, a byte pin keeps dead copy looking alive, while the real
 * risk is the same one #206 found — somebody re-typing it inline at a new site.
 * The five-wall arithmetic in the paragraphs below is #206's reading and is
 * left as the record of what it found.
 *
 * Second, the STRUCTURAL property the capability atlas rests on: this module is
 * imported by the generator, and the Atlas's charter is that it never runs app
 * code. The union is declared here and `briefCompiler.ts` takes the type from
 * here, never the other way round — a direction a convention alone would not
 * hold, since `import type` is erased and dropping the word `type` would be
 * invisible.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BRIEF_TOO_SHORT_MESSAGE } from "@shared/briefLength";

import { ROLL_REFUSAL_COPY, LIKENESS_MESSAGE, NOT_A_BEING_MESSAGE, READER_OUTAGE_MESSAGE } from "./briefRefusalCopy";

const HERE = __dirname;

describe("the roll entrance's four walls each have a sentence", () => {
  it("the table is exactly the four, and every member resolves", () => {
    expect(Object.keys(ROLL_REFUSAL_COPY).sort()).toEqual([
      "likeness", "not_a_being", "reader_outage", "uninterpretable",
    ]);
    for (const [code, sentence] of Object.entries(ROLL_REFUSAL_COPY)) {
      expect(sentence.length, code).toBeGreaterThan(20);
    }
  });

  it("⚠ THREE of the four say 'you have not been charged' — and the fourth is the odd one out", () => {
    /*
      All four are free by construction: `rollService` compiles BEFORE it
      claims, so there is no operation and no ledger entry to unwind. Three of
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

  it("⚠ THE RETIRED WALL'S SENTENCE IS GONE, AND CANNOT COME BACK AS A LITERAL", () => {
    /*
      ⚠ THIS ARM PINNED `unsupported_cohort`'s BYTES UNTIL #1495. The wall is
      retired with the two-valued cohort question that was its only source, so
      a byte pin on its sentence now pins a sentence nothing can say — and a
      pin on dead copy is how dead copy keeps a live reputation.

      What replaces it points the other way and is the arm the retirement
      actually needs. Deleting a customer sentence is easy; the failure this
      guards is somebody LATER re-typing it inline at a new raise site, which
      is precisely the defect #206 found here in the first place (the same
      sentence written out twice, pinned by nothing). So: the words appear
      nowhere under `server/castingV2`, and no member of the table answers to
      the retired name.

      ⚠ It reads the SOURCE rather than the table, because a re-typed literal
      would not be a table member — which is the whole shape of the thing it is
      watching for. Read over the directory, not over one file, because the
      sentence had two homes when it was alive.
    */
    expect(Object.keys(ROLL_REFUSAL_COPY)).not.toContain("unsupported_cohort");

    const WORDS = "Casting makes photographic people, and only ones who are nobody in particular";
    const carrying = readdirSync(HERE)
      .filter((name) => name.endsWith(".ts"))
      .filter((name) => readFileSync(join(HERE, name), "utf8").includes(WORDS));
    /*
      This file is the one place the sentence is allowed to appear, because
      naming it is what makes the arm readable — and a guard that cannot quote
      its own subject is a guard nobody can check.
    */
    expect(carrying).toEqual(["briefRefusalCopy.test.ts"]);

    const compiler = readFileSync(join(HERE, "briefCompiler.ts"), "utf8");
    expect(compiler).not.toContain("UNSUPPORTED_COHORT_MESSAGE");
    expect(compiler).not.toContain('new BriefRefusal(\n      "unsupported_cohort"');
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
