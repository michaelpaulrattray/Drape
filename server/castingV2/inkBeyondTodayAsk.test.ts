import { describe, expect, it } from "vitest";
import type { CastPronouns } from "./castPronouns";

/* One Cast, one set of words for her — the sentences under test name a
   person, and §5e made that the Cast's own fact rather than a constant. */
const HER: CastPronouns = { subject: "she", object: "her", possessive: "her", plural: false };

import { asksInkBeyondToday } from "./inkBeyondTodayAsk";
import { cannotSaySentence } from "./cannotSayCopy";

/**
 * The predicate that decides which of two honest sentences a placeless ink ask
 * reads (ordered fable-1233 §2).
 *
 * It is driven directly rather than through the service, because what it is
 * being asked is whether a rule on HER SENTENCE holds — and a rule on a
 * sentence is provable without a model, a database or a render.
 */
describe("an ink ask this road cannot state yet is told, never asked", () => {
  /*
    THE SPECIMEN IS HIS, VERBATIM, TYPO AND ALL.

    "tattos" is how he actually typed it, and it is the reason this predicate
    reads "inspired by" and not plurality: a plural test keyed on spelling would
    have missed the very ask that ordered this fix.
  */
  it("catches the founder's own ask, spelled the way he spelled it", () => {
    expect(asksInkBeyondToday("add tattos to him inspired by the attached design")).toBe(true);
  });

  it("catches the phrase however it is cased or padded", () => {
    expect(asksInkBeyondToday("Tattoos INSPIRED BY this sheet please")).toBe(true);
    expect(asksInkBeyondToday("do something in the style of these")).toBe(true);
    expect(asksInkBeyondToday("give her ink inspired from this")).toBe(true);
  });

  /*
    THE NEGATIVE CONTROL, and it is the ordinary ask this door must not steal.

    An ask that simply omitted the placement is the sibling sentence's
    population — it asks WHERE, and that is the right question for it. If this
    predicate ever claimed these, a customer who only forgot to say "her neck"
    would be told the product cannot do the thing it can do.
  */
  it("does NOT claim an ordinary ask that merely left the place out", () => {
    expect(asksInkBeyondToday("give him a small geometric dinosaur skeleton tattoo")).toBe(false);
    expect(asksInkBeyondToday("use this tattoo design on her")).toBe(false);
    expect(asksInkBeyondToday("add tattoos to him")).toBe(false);
  });

  it("answers false rather than throwing when there is no sentence at all", () => {
    expect(asksInkBeyondToday(null)).toBe(false);
    expect(asksInkBeyondToday(undefined)).toBe(false);
    expect(asksInkBeyondToday("")).toBe(false);
  });

  /*
    AND THE TWO SENTENCES ARE DIFFERENT SENTENCES.

    Not a paraphrase check — the point of the order is that one of them ASKS a
    question and the other does not. So the question is asserted absent from the
    told sentence, and present in the one it replaces.
  */
  it("replaces a question with a capability, and the question does not survive", () => {
    const bare = { words: null, facet: "ink", scopeNoun: null, moneySafe: true, pronouns: HER };
    const asked = cannotSaySentence("unplacedInk", bare);
    const told = cannotSaySentence("inkBeyondToday", bare);

    expect(asked).toContain("I need to know where it goes");
    expect(told).not.toContain("I need to know where it goes");

    // What she CAN have leads, so the reply is a road rather than a wall.
    expect(told).toContain("copy one design exactly");
    expect(told).toContain("her neck, an upper arm or her upper chest");
    // And the limit is named without pretending it is her fault.
    expect(told).toContain("isn't ready yet");
    // Nothing is charged at this door — it sits above the claim.
    expect(told).toContain("Nothing was charged.");
  });
});
