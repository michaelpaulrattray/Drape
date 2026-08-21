import { describe, expect, it } from "vitest";

import { CANNOT_SAY_COPY, cannotSaySentence, type CannotSayReason } from "./cannotSayCopy";
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
  "uncatalogued",
  "noWords",
  "perSideRemoval",
  "sideNamedWithoutScope",
  "nothingAsked",
];

const bare = { words: null, facet: null, scopeNoun: null, moneySafe: true };

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
    for (const reason of REASONS) {
      const said = cannotSaySentence(reason, bare);
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

  it("keeps the unscoped `none` sentence exactly as it was", () => {
    /* The control kept after the positive passes: the founder-facing sentence
       for a face with no ink at all is untouched by the scoped branch. */
    expect(cannotSaySentence("noInkToChange", { ...bare, facet: "ink" }))
      .toBe("I can put a tattoo on her — her neck, an upper arm, her upper chest. "
        + "She hasn't got one yet, though, so there's nothing there to change or take off. "
        + "Nothing was charged.");
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
