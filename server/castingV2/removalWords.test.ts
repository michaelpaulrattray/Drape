/**
 * A REMOVAL HAS TO SAY SO (D-189) — proved without the model, because the model
 * is the thing being second-guessed.
 *
 * The trial's sentence is the first case: "small gold hoop earrings" is
 * somebody naming a thing they want, and it was answered with "there's nothing
 * to take off".
 */
import { describe, expect, it } from "vitest";

import {
  AMBIGUOUS_WORDS_FOR_CORPUS,
  readsAsNegation,
  removalEvidence,
} from "./removalWords";

/**
 * AND THE WORD THAT COST 25 CREDITS (fable-473/481).
 *
 * "Her glasses — gentle monster style glasses CLEAR rims" read as a removal
 * because "clear" was evidence. Every case below is a sentence a stylist types.
 */
describe("a word that also describes a look is not evidence on its own", () => {
  it("calls the founder's own sentence ambiguous, not stated", () => {
    expect(removalEvidence("her glasses — gentle monster style glasses clear rims"))
      .toBe("ambiguous");
  });

  it("calls a bare noun phrase what it always was", () => {
    /* THE TRIAL'S SENTENCE, then the four other bare phrases the coarse
       question held alone — somebody naming a thing they WANT. */
    expect(removalEvidence("small gold hoop earrings")).toBe("none");
    expect(removalEvidence("a warm open smile")).toBe("none");
    expect(removalEvidence("copper hair")).toBe("none");
    expect(removalEvidence("seafoam green eyes")).toBe("none");
    expect(removalEvidence("a small scar on her cheek")).toBe("none");
  });

  /*
    THE SIX THAT `namesRemoval` HELD ALONE. The coarse question was one bit —
    `removalEvidence(x) !== "none"` — so its corpus could not tell `stated` from
    `ambiguous`, and six phrasings the product has met lived only in its test.
    They are carried here under the verdict the live reader ACTUALLY returns,
    read off it rather than assumed: two of the six are `ambiguous`, which the
    one-bit question was structurally unable to say.
  */
  it("carries the coarse question's own corpus, each under its real verdict", () => {
    expect(removalEvidence("remove earrings")).toBe("stated");
    expect(removalEvidence("no more freckles")).toBe("stated");
    expect(removalEvidence("undo the fringe")).toBe("stated");
    expect(removalEvidence("go back")).toBe("stated");
    /* `no` and `drop` also describe a look ("a no-makeup makeup look", "a
       dropped shoulder"), so the re-read runs and the code decides. */
    expect(removalEvidence("no earrings")).toBe("ambiguous");
    expect(removalEvidence("drop the lipstick")).toBe("ambiguous");
  });

  it("is case and punctuation blind", () => {
    expect(removalEvidence("REMOVE THE EARRINGS!")).toBe("stated");
    expect(removalEvidence("Take them off, please.")).toBe("stated");
  });

  it("still hears a plain removal, in every phrasing the product has met", () => {
    for (const phrase of [
      "remove the earrings",
      "take the hoops off",
      "take her earrings off",
      "get rid of the glasses",
      "lose the glasses",
      "without the necklace",
      "erase the tattoo",
      "undo",
      "revert",
      "nevermind",
    ]) {
      expect(removalEvidence(phrase), `"${phrase}" must be STATED`).toBe("stated");
    }
  });

  /*
    THE CLASS, LISTED. Each of these is a real ask whose only removal word is
    describing something. They must all be ambiguous — never stated — or the
    backstop is off for that sentence exactly as it was for his.
  */
  it("reads every look-describing word as ambiguous", () => {
    const looks: Record<string, string> = {
      clear: "clear rimmed glasses",
      back: "her hair swept back",
      out: "her hair grown out",
      drop: "drop earrings",
      dropped: "dropped shoulder line",
      away: "her hair swept away from her face",
      gone: "the grey almost gone from her roots",
      less: "less shine on her forehead",
      no: "a no-makeup makeup look",
      not: "not quite so much contrast",
      none: "none of the shine, matte skin",
    };
    /* Derived from the module's own list, so a word added later without a
       sentence here fails rather than passing unread. */
    for (const word of AMBIGUOUS_WORDS_FOR_CORPUS) {
      const sentence = looks[word];
      expect(sentence, `${word} needs a stylist's sentence in this test`).toBeTruthy();
      expect(removalEvidence(sentence!), `"${sentence}" must be AMBIGUOUS`).toBe("ambiguous");
    }
  });
});

describe("a positive lane can still hold a negation", () => {
  /*
    The mirrored mistake: the edit re-read of "take her earrings off" files
    `statedAccessories: ["no earrings"]`, which ANSWERS the facet while saying
    the thing is gone. Reading that as "a thing to have" would cancel a real
    removal.
  */
  it("reads the re-read's own words as a departure", () => {
    expect(readsAsNegation("no earrings", "earrings")).toBe(true);
    expect(readsAsNegation("no glasses", "glasses")).toBe(true);
    expect(readsAsNegation("without the necklace", "necklace")).toBe(true);
    expect(readsAsNegation("none of the earrings", "earrings")).toBe(true);
  });

  it("does not mistake a look that begins with a negator", () => {
    /* The negative control, and a real ask: "a no-makeup makeup look" names
       something to have. */
    expect(readsAsNegation("a no-makeup makeup look", "makeup")).toBe(false);
    expect(readsAsNegation("gentle monster style glasses clear rims", "glasses")).toBe(false);
    expect(readsAsNegation("thin wire glasses", "glasses")).toBe(false);
  });
});
