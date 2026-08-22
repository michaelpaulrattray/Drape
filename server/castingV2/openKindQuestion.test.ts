import { describe, expect, it } from "vitest";

import {
  openKindAsk,
  openKindRungOfRow,
  openKindSiteQuestion,
  openKindWordsQuestion,
} from "./openKindQuestion";

/**
 * WHAT WORD TO ASK FOR A THING NOBODY HAS CATALOGUED.
 *
 * The measurement is in the module's header and it is not repeatable here — it
 * is a real reader on two real production frames. What these arms hold is the
 * part that IS code: which string is built, that a site she never typed can
 * never become one, and that the rung a row came off can be read back off the
 * row rather than stored twice.
 *
 * The specimens are the two open kinds production has ever held, with their
 * stored words verbatim.
 */
const ORB = ["a glowing red vertical slit orb embedded in the centre of her forehead"];
const TAIL = ["A tapered, curved tail with dark hexagonal scale texture, rising from behind the shoulders"];

describe("the string an open kind is asked by", () => {
  it("is HER OWN WORDS, whole and untrimmed — the measured key", () => {
    /* Measured before it was designed: her whole sentence and a hand-trimmed
       noun phrase returned the same box within a pixel on one specimen and
       identically on the other. So there is no trimmer, and no trimmer to get
       wrong. */
    expect(openKindWordsQuestion(ORB))
      .toBe("a glowing red vertical slit orb embedded in the centre of her forehead");
  });

  it("joins the whole stack, oldest first — a refinement is not a description", () => {
    /* "make it brighter" describes nothing on its own; the stack is what the
       row means by the feature. */
    expect(openKindWordsQuestion(["a small halo", "make it brighter"]))
      .toBe("a small halo, make it brighter");
  });

  it("is NULL when she has said nothing — there is no phrase to invent", () => {
    expect(openKindWordsQuestion([])).toBeNull();
    expect(openKindWordsQuestion(["", "   "])).toBeNull();
    expect(openKindAsk({ words: [] })).toBeNull();
  });

  it("reports which rung it came from", () => {
    expect(openKindAsk({ words: ORB })).toMatchObject({ rung: "words" });
    expect(openKindAsk({ words: [], proposedSite: "forehead" })).toBeNull();
  });
});

describe("the site rung admits only a word she typed", () => {
  it("takes a site that appears in her own sentence", () => {
    expect(openKindSiteQuestion(ORB, "forehead")).toBe("forehead");
    expect(openKindSiteQuestion(TAIL, "shoulders")).toBe("shoulders");
  });

  it("⚠ REFUSES a site she never said — a guess about her body files NOTHING", () => {
    /*
      The load-bearing arm (fable-1402). This road's failure mode is a rectangle
      drawn over the wrong pixels, and the panel treats a rectangle as a promise
      that clicking there edits that thing. A reader proposing `chest` for a
      forehead orb must produce no question at all, so the slot files words as it
      does today rather than a wrong box.
    */
    expect(openKindSiteQuestion(ORB, "chest")).toBeNull();
    expect(openKindSiteQuestion(ORB, "upper arm")).toBeNull();
    expect(openKindSiteQuestion(TAIL, "forehead")).toBeNull();
  });

  it("matches on WORD BOUNDARIES — a site inside a longer word is not a site", () => {
    /* `ear` admitted by `beard` is the substring trap this repo has paid for in
       three other vocabularies. */
    expect(openKindSiteQuestion(["a thick beard"], "ear")).toBeNull();
    expect(openKindSiteQuestion(["behind her ear"], "ear")).toBe("ear");
  });

  it("survives a reader that answers nothing, or punctuation", () => {
    expect(openKindSiteQuestion(ORB, null)).toBeNull();
    expect(openKindSiteQuestion(ORB, undefined)).toBeNull();
    expect(openKindSiteQuestion(ORB, "  ")).toBeNull();
    /* A regex metacharacter in a proposed site must not throw or match wildly. */
    expect(openKindSiteQuestion(ORB, "fore.head")).toBeNull();
    expect(() => openKindSiteQuestion(ORB, "(")).not.toThrow();
  });

  it("falls to the site only when there are no words at all", () => {
    /* Order is the ladder: her description of the THING beats the place it sits
       on, because a thing-crop is what the panel wants and a place-crop is
       wider than the thing. */
    const both = openKindAsk({ words: ORB, proposedSite: "forehead" });
    expect(both).toMatchObject({ rung: "words" });
    expect(both!.question).toContain("slit orb");
  });
});

describe("which rung a row came off, read back off the row", () => {
  /*
    Derived rather than stored: a second column saying what the row can already
    say is the parallel copy working law 4 forbids, and this is the reading that
    keeps the derivation beside the thing that produces it.
  */
  it("no crop is no rung — that row files words, as today", () => {
    expect(openKindRungOfRow({ words: ORB, guardKind: null, hasCrop: false })).toBe("none");
    /* And a guardKind on a row with no crop still means no crop: the question
       was asked and answered nothing. */
    expect(openKindRungOfRow({ words: ORB, guardKind: "orb", hasCrop: false })).toBe("none");
  });

  it("a crop cut under her own joined words is rung ONE", () => {
    expect(openKindRungOfRow({
      words: ORB,
      guardKind: openKindWordsQuestion(ORB),
      hasCrop: true,
    })).toBe("words");
  });

  it("a crop cut under anything else is rung TWO", () => {
    expect(openKindRungOfRow({ words: ORB, guardKind: "forehead", hasCrop: true })).toBe("site");
  });

  it("⚠ AND THE TWO PRODUCTION ROWS READ AS `none`, which is the defect", () => {
    /*
      The whole population, as it stands: an orb and a tail, both words-only,
      both with no guard reading at all. This arm is what turns green the day
      either of them is re-rendered under the new question — and it is the honest
      record that today the ladder's answer for every open kind ever minted is
      "no crop was cut".
    */
    for (const words of [ORB, TAIL]) {
      expect(openKindRungOfRow({ words, guardKind: null, hasCrop: false })).toBe("none");
    }
  });
});
