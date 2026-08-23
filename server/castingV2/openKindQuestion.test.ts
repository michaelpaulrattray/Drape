import { describe, expect, it } from "vitest";

import {
  askWordsForSlot,
  openKindAsk,
  GUARD_KIND_MAX,
  openKindRungOfRow,
  openKindSiteQuestion,
  openKindWordsQuestion,
  storedGuardKind,
} from "./openKindQuestion";
import { priorWordsBySlot, type StoredReference } from "./referenceLibrary";

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
    /* ⚠ `storedGuardKind` rather than the bare joined words, and this arm went
       RED when the cap landed — correctly. ORB is 70 characters and the column
       is 48, so `guardKind: openKindWordsQuestion(ORB)` describes a row MySQL
       has never been able to hold: the fixture was modelling an impossible row
       and would have gone on passing while the real insert died (fable-1441).
       The row is built the way the writer builds it now. */
    expect(openKindRungOfRow({
      words: ORB,
      guardKind: storedGuardKind(openKindWordsQuestion(ORB)),
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

/*
  ⚠ THE ASKING STACK — n=3 arriving from the founder's own render
  (fable-1419 §1(a)).

  He ran "make her orb glow slightly brighter" on cand 1653 minutes after a
  shift parked. v218 delivered a visibly brighter orb and filed a row with NO
  CROP, so his panel still has no orb and no box — the second render running.

  The mint had asked the segmenter `slot.words`, which is THIS RENDER's words,
  and this render's words were the EDIT's phrase. Measured on v218's own
  delivered frame, four cells, one variable:

      "orb glowing slightly brighter"                 0 px   ← what it asked
      "a glowing red vertical slit orb embedded…"  1,402 px  44x41, on the orb
      the two JOINED                               1,402 px  IDENTICAL box
      "orb"                            CONTROL        0 px   reader unchanged

  `openKindWordsQuestion`'s docblock had already said this: *"a later refinement
  ('make it brighter') is not a description of the thing on its own."* The
  ladder was obeying a contract its caller was not.
*/
describe("what an open kind is ASKED about", () => {
  const RICH = "a glowing red vertical slit orb embedded in the centre of her forehead";
  const EDIT = "orb glowing slightly brighter";

  it("asks her WHOLE STACK, not the edit that arrived last", () => {
    expect(askWordsForSlot({
      slot: "open:orb", words: [EDIT], prior: new Map([["open:orb", [RICH]]]),
    })).toEqual([RICH, EDIT]);
  });

  it("keeps her order — the description first, the amendment after", () => {
    /* The measurement was taken on a string that reads as a description. The
       amendment qualifies it; leading with the amendment is what returned 0. */
    const asked = askWordsForSlot({
      slot: "open:orb", words: [EDIT], prior: new Map([["open:orb", [RICH]]]),
    });
    expect(asked[0]).toBe(RICH);
  });

  it("says each sentence once, however many rows repeat it", () => {
    /* A stack that repeats a clause asks the segmenter the same words twice for
       nothing — and on this road every character is a paid question's key. */
    expect(askWordsForSlot({
      slot: "open:orb", words: [RICH], prior: new Map([["open:orb", [RICH, RICH]]]),
    })).toEqual([RICH]);
  });

  it("⚠ IS TODAY'S BEHAVIOUR when no prior words are handed in", () => {
    /* The field is optional so a caller that does not pass it — every test, and
       any road that has no lineage — gets exactly what it got before. */
    expect(askWordsForSlot({ slot: "open:orb", words: [EDIT] })).toEqual([EDIT]);
    expect(askWordsForSlot({
      slot: "open:orb", words: [EDIT], prior: new Map(),
    })).toEqual([EDIT]);
  });

  it("does not mix one slot's words into another's", () => {
    expect(askWordsForSlot({
      slot: "open:orb", words: [EDIT], prior: new Map([["open:tail", ["a long scaled tail"]]]),
    })).toEqual([EDIT]);
  });
});

/*
  AND THE FOLD THAT PRODUCES THEM, over the rows a lineage actually holds.
*/
describe("the stack a branch holds per slot", () => {
  const row = (over: { slot: string; version: number; words: string[] }): StoredReference => ({
    id: over.version, publicId: `p${over.version}`, candidateId: 1, variantId: over.version,
    role: "carry", slot: over.slot, tier: "anatomy", noun: "orb", words: over.words,
    storageKey: null, maskKey: null, digest: null, geometry: null, guard: null,
    refusal: null, version: over.version, retiredAt: null, createdAt: new Date(),
  });

  it("reads in VERSION order, whatever order the rows arrive in", () => {
    const said = priorWordsBySlot([
      row({ slot: "open:orb", version: 2, words: ["orb glowing slightly brighter"] }),
      row({ slot: "open:orb", version: 1, words: ["a glowing red vertical slit orb"] }),
    ]);
    expect(said.get("open:orb")).toEqual([
      "a glowing red vertical slit orb",
      "orb glowing slightly brighter",
    ]);
  });

  it("⚠ NEVER THROWS on a row whose words are not an array", () => {
    /* This fold runs on the PAID refine path. A throw here takes the whole mint
       with it and loses every crop the render earned — and the rows crossed a
       database boundary to get here. Caught by the suite on a fixture that
       carried no words at all, before it shipped. */
    const malformed = [
      { ...row({ slot: "open:orb", version: 1, words: [] }), words: undefined as never },
      row({ slot: "open:orb", version: 2, words: ["a glowing red orb"] }),
    ];
    expect(() => priorWordsBySlot(malformed)).not.toThrow();
    expect(priorWordsBySlot(malformed).get("open:orb")).toEqual(["a glowing red orb"]);
  });

  it("holds nothing for a slot whose rows say nothing", () => {
    expect(priorWordsBySlot([row({ slot: "open:orb", version: 1, words: [] })]).size).toBe(0);
    expect(priorWordsBySlot([]).size).toBe(0);
  });
});

describe("⚠ the joined stack is capped at the column it is stored in", () => {
  /*
    THE FOUNDER'S ORB MINTED NOTHING TWICE BECAUSE OF THIS (fable-1441, found at
    the live log). The rung-1 record makes `guardKind` carry the joined word
    stack; the read worked perfectly and the INSERT died —

      DrizzleQueryError: Data too long for column 'guardKind' at row 1

    — taking the whole mint's transaction with it, so the render filed no crop
    AND no words row. `varchar(48)`, a 97-character sentence.

    ⚠ AND THE DEV DRIVE THAT PROVED THIS ROAD MISSED IT BY FIXTURE FAMILY: the
    talons stack is 36 characters and fits, the orb's is 97 and does not. Every
    specimen the road had ever been driven on shared the property that killed it
    — `fixture-family-shares-a-property`, at a column width. These arms exist
    because the always-on suite cannot see a column, so the LENGTH has to be the
    thing under test rather than a happy accident of the phrase chosen.
  */
  const LONG = [
    "a glowing red vertical slit orb embedded in the centre of her forehead",
    "glowing slightly brighter",
  ];

  it("⚠ CONTROL — the real specimen really is longer than the column", () => {
    /* Without this the arms below pass on a phrase that never overflowed, which
       is the bug's own shape repeated inside its own test. */
    const joined = openKindWordsQuestion(LONG)!;
    expect(joined.length).toBeGreaterThan(GUARD_KIND_MAX);
    expect(joined).toContain("glowing slightly brighter");
  });

  it("stores a prefix the column can hold, and never more", () => {
    const joined = openKindWordsQuestion(LONG)!;
    const stored = storedGuardKind(joined);
    expect(stored.length).toBe(GUARD_KIND_MAX);
    expect(joined.startsWith(stored)).toBe(true);
  });

  it("leaves anything that already fits completely alone", () => {
    /* NEGATIVE CONTROL: the twelve rows in production are 18 characters at the
       longest, and none of them may move. */
    expect(storedGuardKind("forehead")).toBe("forehead");
    expect(storedGuardKind(null)).toBeNull();
  });

  it("⚠ still reads a LONG rung-1 row as `words`, not as `site`", () => {
    /* The half a careless cap gets wrong. `openKindRungOfRow` compares the
       stored value against the joined words; truncate only the STORE and every
       rich phrase — the exact population the ladder was built for — silently
       reclassifies as rung 2. Both sides truncate. */
    const stored = storedGuardKind(openKindWordsQuestion(LONG)!);
    expect(openKindRungOfRow({ words: LONG, guardKind: stored, hasCrop: true })).toBe("words");
  });

  it("and a genuine site row is still `site` even when the stack is long", () => {
    expect(openKindRungOfRow({ words: LONG, guardKind: "forehead", hasCrop: true })).toBe("site");
  });
});
