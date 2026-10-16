import { describe, expect, it } from "vitest";
import type { CastPronouns } from "./castPronouns";

/* One Cast, one set of words for her — the sentences under test name a
   person, and §5e made that the Cast's own fact rather than a constant. */
const HER: CastPronouns = { subject: "she", object: "her", possessive: "her", plural: false };

import { CANNOT_SAY_COPY, cannotSaySentence, type CannotSayReason } from "./cannotSayCopy";
import {
  INK_PLACEMENTS,
  inkPlacementBareNoun,
  type InkPlacement,
} from "../../shared/inkPlacementVocabulary";
import { sidesForInkPlacement } from "../../shared/inkReleasedPlacements";
import { RECOVERED_REFINE_SENTENCE } from "./refineRecovery";

/**
 * EVERY DOOR THAT KNOWS WHY IT REFUSED HAS A SENTENCE (fable-471 §1).
 *
 * The founder read *"That refinement didn't come through. Your credits have
 * been returned."* over an ask the road had understood precisely — it had
 * filed his cauliflower ear as a MARK and he had pointed at an ear. The class
 * existed; the copy existed for one facet.
 *
 * The totality case below is the one that keeps this true: a reason added to
 * the road without a sentence fails here rather than reaching a customer as
 * the generic line.
 */

const REASONS: readonly CannotSayReason[] = [
  "removal",
  "departure",
  "notASlot",
  "unnamedObject",
  "unplacedInk",
  "inkBeyondToday",
  "noInkToChange",
  "inkOneChangeAtATime",
  /* `inkRemovalNotYet` was here and is DELETED (fable-1322 §1): it said taking
     a tattoo off was not something the product could do yet, and the removal
     road had quietly started doing it. Its edit-filed call site now ROUTES to
     that road rather than apologising. */
  "whichInkToChange",
  /* THE PICTURE WE PROMISED TO KEEP AND DID NOT — census card C4a. The fifth
     of the pre-claim ink door's own sentences. */
  "inkNotKept",
  "uncatalogued",
  /* #1072: the three internal-record branches split off `uncatalogued`, which
     keeps only the one fault its sentence was ever true of. */
  "askNotCarried",
  "noWords",
  "perSideRemoval",
  "sideNamedWithoutScope",
  "nothingAsked",
];

/**
 * NOWHERE SHOWING, as the fixture's own shape (#2580).
 *
 * Every other field here is the "nothing known" value, and the empty list is
 * this field's — so the totality loop below drives the three ink sentences at
 * their hardest population rather than their easiest. The populations with
 * places in them are driven by name further down, and by the real derivation in
 * `inkWordsRoad.test.ts`.
 */
const bare = {
  words: null, facet: null, scopeNoun: null, moneySafe: true, pronouns: HER,
  inkPlaces: [] as readonly InkPlacement[],
};

/** What the HOUSE crew tee leaves showing — the default cast in this product. */
const HOUSE_PLACES: readonly InkPlacement[] = ["neck", "upperArm"];
/** What a Basics cast leaves showing — all three measured surfaces. */
const ALL_PLACES: readonly InkPlacement[] = ["neck", "upperArm", "upperChest"];

describe("the registry answers for every reason the road can refuse with", () => {
  it("has an entry for each, and the list here is the road's own", () => {
    /*
      Both directions. A reason in the type with no entry is a customer reading
      the generic line; an entry for a reason the road cannot produce is copy
      nobody will ever see, kept alive by a test.
    */
    expect(Object.keys(CANNOT_SAY_COPY).sort()).toEqual([...REASONS].sort());
  });

  it("never says nothing, and never says the generic line", () => {
    /*
      ⚠ AT BOTH INK POPULATIONS (#2580). Three of these sentences now compose a
      list of placements and three have a separate branch for the empty one, so
      a loop over one population leaves half the copy in this registry undriven
      — including the branch a customer meets when every place is covered.
    */
    for (const [reason, places] of REASONS.flatMap((reason) =>
      [[reason, [] as readonly InkPlacement[]], [reason, ALL_PLACES]] as const)) {
      const said = cannotSaySentence(reason, { ...bare, inkPlaces: places });
      expect(said.length, `${reason} says nothing`).toBeGreaterThan(20);
      /*
        THE MALFUNCTION SENTENCE BY NAME, NOT BY SPELLING.

        This read `.not.toContain("didn't come through")` — a literal copied
        from the sweep's sentence. That sentence was rewritten on 2026-08-17
        and the literal would have gone on passing over a string nothing
        writes, which is a guard that cannot fail. It now imports the constant,
        so a future edit to the copy moves this assertion with it.
      */
      expect(said, `${reason} falls back to the malfunction sentence`)
        .not.toContain(RECOVERED_REFINE_SENTENCE);
      /* Every one of them ends the money question, because that is the first
         thing a person asks when a paid surface refuses. */
      expect(said, `${reason} leaves the money unsaid`).toMatch(/Nothing was charged\.|credits have been returned\./);
    }
  });

  it("says what happened to the money, and only what is true", () => {
    /* The caller owns the fact; this table owns the sentence. A refusal that
       could not record its refund must never claim she was not charged. */
    expect(cannotSaySentence("noWords", { ...bare, moneySafe: true })).toContain("Nothing was charged.");
    expect(cannotSaySentence("noWords", { ...bare, moneySafe: false }))
      .toContain("Your credits have been returned.");
  });
});

describe("the sentences the founder ruled are unchanged", () => {
  it("keeps the makeup wording, with her own words in front of it", () => {
    expect(cannotSaySentence("notASlot", { ...bare, facet: "makeup", words: "lip gloss" }))
      .toBe("Lip gloss is makeup, and makeup isn't something I can place yet — it's coming. "
        + "Nothing was charged.");
  });

  it("says the class when there are no words to quote", () => {
    expect(cannotSaySentence("notASlot", { ...bare, facet: "makeup" }))
      .toBe("That's makeup, and makeup isn't something I can place yet — it's coming. "
        + "Nothing was charged.");
  });

  it("names the side she typed and offers the box, without promising to charge", () => {
    /*
      Typed prose does not scope, so an unscoped side sentence used to fan out
      to both instances WITH the side word inside the value — "change his left
      eye: her right eye fiery red", dispatched and paid (fable-604 §3a). This
      is the door, and its sentence has to hand back the thing she can do.
    */
    expect(cannotSaySentence("sideNamedWithoutScope", {
      ...bare, facet: "eye.colour", words: "her right eye fiery red",
    })).toBe('"Her right eye fiery red" names one side of a pair, and pointing at it is how I can work '
      + "on just that one — tap it on her picture and say it there. Said in a sentence I would have to "
      + "change both, which isn't what you asked for. Nothing was charged.");
  });

  it("keeps OUR fault off her cast — #1072's whole point, pinned as a relationship", () => {
    /*
      ⚠ THE ARM THAT ENCODES THE CARD, and without it the split is cosmetic.

      Every other assertion in this file would pass an `askNotCarried` entry
      that said *"that's a part of her I can't work on yet"* word for word: it
      is over twenty characters, it is not the malfunction line, and it ends the
      money question. The defect was never the reason's NAME — it was that a
      customer reads a claim about her cast's body when what failed was our
      bookkeeping, stops asking for that feature, and never reports it.

      So this pins the two sentences AGAINST EACH OTHER rather than pinning a
      literal. The capability-limit claim belongs to exactly one of them, and
      the arm fails whichever way that stops being true — the limit sentence
      losing its claim, or our-fault sentence acquiring one.
    */
    const ourFault = cannotSaySentence("askNotCarried", bare);
    const realLimit = cannotSaySentence("uncatalogued", bare);

    expect(realLimit, "the capability limit stopped claiming to be one")
      .toContain("can't work on");
    expect(ourFault, "our own bookkeeping is telling her a part of her cast is unsupported")
      .not.toContain("can't work on");
    /* And it must not name her, her words or her cast as the thing at fault —
       the one positive claim the sentence is FOR. */
    expect(ourFault, "our-fault sentence does not clear her ask of blame")
      .toContain("wasn't anything about what you asked for");
    expect(ourFault, "the two sentences have converged").not.toBe(realLimit);
  });

  it("keeps the one-of-a-pair wording, which names what she CAN do", () => {
    expect(cannotSaySentence("perSideRemoval", bare))
      .toBe("Taking just one of a pair off isn't something I can do yet — ask for both and "
        + "they'll come off together. Nothing was charged.");
  });
});

describe("his own ask, in the sentence it should have had", () => {
  it("names the part she pointed at when the reading landed somewhere else", () => {
    /*
      "her left ear — has cauliflower ear" → filed as a mark → marks have no
      slot inside an ear. The difference between a malfunction and a misreading
      is naming the part she pointed at, and offering the way through.
    */
    const said = cannotSaySentence("notASlot", {
      ...bare,
      facet: "marks",
      scopeNoun: "her left ear",
    });
    expect(said).toContain("her left ear");
    expect(said).toContain("Nothing was charged.");
    expect(said).not.toContain("makeup");
  });

  it("does not claim a scope it was not given", () => {
    /* The control: the same reason with no scope says the plain thing rather
       than inventing a part of her. */
    const said = cannotSaySentence("notASlot", { ...bare, facet: "marks", words: "a scar" });
    expect(said).toBe("A scar isn't something I can place yet. Nothing was charged.");
  });

  /*
    AND THE SAME DISCIPLINE ON THE TRANSFORM ROAD'S `none` (built with the ink
    scope door, 2026-08-21).

    The unscoped sentence is about the FACE — *"she hasn't got one yet"* — and a
    scoped ask is not about the face. Said to somebody who tapped a tattoo card,
    it denies the picture they are looking at, which is what `inkRemovalNotYet`
    was ruled into existence to stop (fable-1287 §3). The scoped branch narrows
    to the place, where it is true whether this is her only tattoo or her
    fourth.
  */
  it("speaks about the place she pointed at when a scope names ink she has not got", () => {
    const said = cannotSaySentence("noInkToChange", {
      ...bare, facet: "ink", scopeNoun: "his left upper arm tattoo",
    });
    expect(said).toContain("his left upper arm tattoo");
    expect(said, "it must not deny tattoos she may well have elsewhere")
      .not.toContain("hasn't got one yet");
    expect(said, "a refusal with no next move is the line this file's header names")
      .toContain("say where to put a new one");
    expect(said).toContain("Nothing was charged.");
  });

  it("keeps the unscoped `none` sentence, with the places the cast's outfit allows", () => {
    /*
      The control kept after the positive passes: the founder-facing sentence
      for a face with no ink at all is untouched by the scoped branch.

      ⚠ **Its three surfaces were FROZEN PROSE until #2580** and this pin read
      *"her neck, an upper arm, her upper chest"* whatever the cast was wearing.
      The house crew tee covers the chest, so the default cast in this product
      was offered a place `gate_ink_uncarried` refuses one ask later. The list
      arrives on the context now; the rest of the sentence is unchanged, which
      is what this pin is still here to say.
    */
    expect(cannotSaySentence("noInkToChange", { ...bare, facet: "ink", inkPlaces: ALL_PLACES }))
      .toBe("I can put a tattoo on her neck, an upper arm or her upper chest. "
        + "She hasn't got one yet, though, so there's nothing there to change or take off. "
        + "Nothing was charged.");
  });
});

/**
 * THE THREE INK SENTENCES NAME ONLY PLACES THIS CAST'S OUTFIT LEAVES SHOWING
 * (#2580 — `gate_ink_document`'s class, three doors over).
 *
 * All three named *"her neck, an upper arm, her upper chest"* as frozen prose,
 * derived from NEITHER question: not what this account's words road serves, and
 * not what the cast is wearing. The house crew tee covers the chest
 * (`HOUSE_COVERAGE`), so this was not an edge case — **it was the default cast
 * in the product**, offered a surface `gate_ink_uncarried` refuses one ask
 * later, with nothing charged at either step and a sentence that was otherwise
 * good.
 *
 * ⚠ **These are copy-layer arms and they are deliberately only half the claim.**
 * They prove the sentences say what they are handed. That the thing they are
 * handed is the OUTFIT's answer and not the ask's is proven where the real
 * derivation runs, in `inkWordsRoad.test.ts` — one ask, three outfits, three
 * sentences — because a suite that types its own list passes while the two
 * readers disagree, which is the whole defect.
 */
describe("the ink sentences carry the cast's own places, never a frozen three", () => {
  const INK_SENTENCES = ["unplacedInk", "inkBeyondToday", "noInkToChange"] as const;

  const said = (reason: CannotSayReason, places: readonly InkPlacement[]) =>
    cannotSaySentence(reason, { ...bare, facet: "ink", inkPlaces: places });

  it("the default cast is not offered the chest its own tee covers", () => {
    /* Verbatim, because these are the bytes a customer reads, and because the
       chest being absent is the fix. */
    expect(said("unplacedInk", HOUSE_PLACES)).toBe(
      "I can put a tattoo on her, but I need to know where it goes — her neck or an upper "
      + "arm. Say where and I'll do it. Nothing was charged.");
    expect(said("inkBeyondToday", HOUSE_PLACES)).toBe(
      "Right now I can copy one design exactly, onto her neck or an upper arm — tell me "
      + "which design and where, and I'll do it. Taking a whole sheet and working from the "
      + "feel of it, across her, is being built and isn't ready yet — it's coming. "
      + "Nothing was charged.");
    expect(said("noInkToChange", HOUSE_PLACES)).toBe(
      "I can put a tattoo on her neck or an upper arm. She hasn't got one yet, though, so "
      + "there's nothing there to change or take off. Nothing was charged.");
  });

  it("⚠ CONTROL — a bare cast keeps the chest, so none of them merely SHRANK", () => {
    /*
      Census 4(c)'s own lesson, and #2562's: an arm that only watches the chest
      disappear is satisfied by a sentence that has stopped naming places at
      all. Each of the three has to MOVE with its argument.
    */
    for (const reason of INK_SENTENCES) {
      expect(said(reason, ALL_PLACES), `${reason} ignores its argument`)
        .not.toBe(said(reason, HOUSE_PLACES));
      expect(said(reason, ALL_PLACES), `${reason} drops a place it was handed`)
        .toContain("upper chest");
    }
  });

  it("⚠ CONTROL — no sentence in the registry names a place it was not handed", () => {
    /*
      THE CLASS, not the three instances — and this is the arm that would have
      caught all three of them without anybody sweeping for prose.

      Every reason, at an EMPTY list: no sentence anywhere in this table may
      contain any surface the vocabulary holds, because none of them was given
      one. A fourth frozen list added to this file reddens here on the day it is
      written, whichever entry it lands in.
    */
    for (const reason of REASONS) {
      const sentence = said(reason, []);
      for (const key of INK_PLACEMENTS) {
        expect(sentence, `${reason} names ${key} off its own prose`)
          .not.toContain(inkPlacementBareNoun(key));
      }
    }
    /* The positive control, on the same loop: handed the list, the three DO
       name them — so the arm above cannot pass by reading nothing. */
    for (const reason of INK_SENTENCES) {
      for (const key of ALL_PLACES) {
        expect(said(reason, ALL_PLACES), `${reason} lost ${key}`)
          .toContain(inkPlacementBareNoun(key));
      }
    }
  });

  it("nowhere showing is a real answer, and each door has its own sentence for it", () => {
    /*
      An outfit that covers every served surface leaves the list empty, and the
      old shape would have read *"I need to know where it goes — . Say where and
      I'll do it."* Verbatim because it is new copy.

      ⚠ **None of the three claims to have READ the outfit.** An empty list
      means every served surface is covered OR unreadable, and those are
      different facts. These three say what is true of both.

      ⚠ **AND THE FOURTH DOOR DID ASSERT THE FIRST — FIXED #2601.**
      `gate_ink_document`'s own empty sentence said *"this outfit covers every
      place that works"*. This block called that *"true today, because no
      writer of an unreadable line exists yet"*, and the measurement runs the
      other way: over every resolution shape the type can express, **`covered`
      alone cannot empty that list at all** — the one `covered` answer in
      either table is the house chest, and the house table leaves the neck and
      the upper arm `bare`, so any line the reader recognises leaves at least
      two surfaces showing. The reason is therefore ALWAYS the unreadable one,
      and that sentence was wrong whenever it was shown rather than wrong only
      once a writer existed. All four doors carry one phrase now; the reasons
      are driven in `inkWordsRoad.test.ts`.
    */
    expect(said("unplacedInk", [])).toBe(
      "I can put a tattoo on her, but there's nowhere showing to put one right now. "
      + "Change what she's wearing and tell me where. Nothing was charged.");
    expect(said("inkBeyondToday", [])).toBe(
      "Right now I can copy one design exactly onto one place — but there's nowhere showing "
      + "on her to put it. Change what she's wearing and point me at one design. Taking a "
      + "whole sheet and working from the feel of it, across her, is being built and isn't "
      + "ready yet — it's coming. Nothing was charged.");
    expect(said("noInkToChange", [])).toBe(
      "She hasn't got a tattoo yet, so there's nothing there to change or take off — and "
      + "there's nowhere showing to put one on either. Change what she's wearing and I'll "
      + "put one on. Nothing was charged.");
  });

  it("⚠ the article is the PAIRING TABLE'S answer, not a word somebody liked", () => {
    /*
      *"an upper arm"* against *"her neck"* is anatomy: a person has two upper
      arms and one neck, so the indefinite article on the middle one was never a
      slip in the prose this replaces. `sidesForInkPlacement` already owns which
      surfaces come in pairs, and `placesClause` asks it — so this arm reads the
      same owner rather than retyping which is which, and a fourth measured
      surface is spoken about correctly on its first day.
    */
    for (const key of INK_PLACEMENTS) {
      const noun = inkPlacementBareNoun(key);
      const sentence = said("noInkToChange", [key]);
      if (sidesForInkPlacement(key).length > 1) {
        expect(sentence, `${key} comes in a pair and must not be possessed`)
          .toContain(`an ${noun}`);
        expect(sentence, `${key} comes in a pair`).not.toContain(`her ${noun}`);
      } else {
        expect(sentence, `${key} is one of, and is hers`).toContain(`her ${noun}`);
        expect(sentence, `${key} is one of`).not.toContain(`an ${noun}`);
      }
    }
  });

  it("the three doors name the SAME places on the same cast", () => {
    /*
      `noInkToChange`'s own docblock says it hands over *"the same places
      `unplacedInk` does, because that IS the next move from here and the two
      doors must not describe different products"* — a promise two copies of one
      frozen sentence were keeping by accident. The claim is the SET, on every
      population, rather than three strings.
    */
    for (const places of [HOUSE_PLACES, ALL_PLACES, ["neck"] as const]) {
      const named = INK_SENTENCES.map((reason) => INK_PLACEMENTS
        .filter((key) => said(reason, places).includes(inkPlacementBareNoun(key))));
      expect(new Set(named.map((list) => list.join(","))).size, `${places.join("+")} splits the doors`)
        .toBe(1);
      expect(named[0]).toEqual([...places]);
    }
  });
});

/**
 * A CONFESSION MAY NOT NAME A FEATURE IT DID NOT TAKE FROM THE PARSE
 * (fable-490 §1b).
 *
 * The founder's vitiligo take carried "Made the eyes as you described" — on a
 * SKIN ask, on a face whose eyes nobody had mentioned. The copy was written for
 * the green-eyes case and hardcoded its facet, so every later take asserted the
 * same one. A confession that names the wrong feature is worse than a generic
 * one: it is specific and wrong, in the founder's own product voice.
 */
describe("the likeness confession names what it filed, and nothing else", () => {
  it("names the subject the parse actually wrote", async () => {
    const { likenessSetAsideNote } = await import("./cannotSayCopy");
    expect(likenessSetAsideNote({ subjects: ["SKIN"] }))
      .toBe("Made the change to skin as you described. Refining can't copy a real person's "
        + "features, so that part of the comparison was set aside.");
  });

  it("names both when an ask wrote two", async () => {
    const { likenessSetAsideNote } = await import("./cannotSayCopy");
    expect(likenessSetAsideNote({ subjects: ["EYE COLOUR", "HAIR CUT"] }))
      .toContain("eye colour and hair cut");
  });

  it("claims NO feature when the parse filed nothing nameable", async () => {
    /* The control, and the defect exactly: with nothing to name, the sentence
       says nothing rather than the last feature somebody hardcoded. */
    const { likenessSetAsideNote } = await import("./cannotSayCopy");
    const said = likenessSetAsideNote({ subjects: [] });
    expect(said).toBe("Made that as you described. Refining can't copy a real person's "
      + "features, so that part of the comparison was set aside.");
    expect(said).not.toContain("eyes");
  });

  it("never asserts the eyes about an ask that did not write them", async () => {
    /* The founder's own take, as the rule rather than as one case. */
    const { likenessSetAsideNote } = await import("./cannotSayCopy");
    for (const subjects of [["SKIN"], ["BUILD"], ["MARKS"], []]) {
      expect(likenessSetAsideNote({ subjects }), subjects.join(",")).not.toContain("eyes");
    }
  });
});
