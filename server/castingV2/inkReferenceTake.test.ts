/**
 * THE TATTOO TAKE, PROVED WITHOUT THE MODEL — and the one arm that matters most
 * is the one where the model is WRONG.
 *
 * Every assertion here drives the real functions. The reader is handed replies a
 * model could plausibly produce, including the dishonest ones, because a
 * validation tested only against well-behaved output is untested (working law
 * 3) — and this reader's whole job is to be right when the reply is not.
 */
import { describe, expect, it } from "vitest";

import type { TextEngine } from "../providers/types";
import {
  inkReferenceNote,
  inkAskIntents,
  namesInkFromReference,
  inkTakeSentence,
  readInkReferenceTake,
  resolveInkReferenceTake,
} from "./inkReferenceTake";
import { pronounsForSex } from "./castPronouns";
import { readDelta } from "./refineDelta";

/** A transport that says exactly this, once. */
const saying = (text: string): TextEngine => ({
  complete: async () => ({ text }),
} as unknown as TextEngine);

const reply = (placement: string, side: string | null) => JSON.stringify({ placement, side });

describe("the placement is resolved, never believed", () => {
  it("takes a measured surface to the vocabulary's key, however she spelled it", () => {
    for (const said of ["upper arm", "Upper Arm", "upperArm", "  upper   arm "]) {
      const take = readInkReferenceTake(reply(said, null), `put it on her ${said}`);
      expect(take?.placement).toEqual({ kind: "measured", placement: "upperArm" });
    }
  });

  it("keeps her own word for a place the vocabulary has never measured", () => {
    const take = readInkReferenceTake(reply("sleeve", null), "use this design on my sleeve");
    expect(take?.placement).toEqual({ kind: "open", phrase: "sleeve" });
  });

  it("does not merge a meaning the customer drew a line under", () => {
    /* `full sleeve` and `sleeve` are different pieces of work, and the synonym
       judgement belongs to the human reading the tally. */
    const full = readInkReferenceTake(reply("full sleeve", null), "on my full sleeve");
    expect(full?.placement).toEqual({ kind: "open", phrase: "full sleeve" });
  });

  it("names no place at all as ABSENT, which is a question and not a refusal", () => {
    const take = readInkReferenceTake(reply("", null), "use this tattoo design");
    expect(take?.placement).toEqual({ kind: "absent" });
  });

  it("treats a sentence-length answer as TOO LONG rather than storing it", () => {
    const sentence = "the bit of my right arm where my son's name is written in script above the old one";
    const take = readInkReferenceTake(reply(sentence, null), `on ${sentence}`);
    expect(take?.placement.kind).toBe("tooLong");
  });
});

describe("a side comes from an explicit word of hers, or from nowhere", () => {
  it("takes the side she said", () => {
    const take = readInkReferenceTake(reply("sleeve", "left"), "use this design on my left sleeve");
    expect(take?.side).toBe("left");
  });

  /*
    THE KEEPER. The model is CONFIDENT and WRONG: it has worked out that a sleeve
    is an arm, that an arm is a pair, and picked one. That is the inference
    fable-1115 §3 outlawed, and no prompt sentence can be relied on to prevent
    it — so the code refuses a side whose word is not in her sentence.

    A wrong arm is a refund and an apology. An unstated side is a question.
  */
  it("REFUSES a side she never typed, however confidently it is reported", () => {
    for (const claimed of ["left", "right"]) {
      const take = readInkReferenceTake(reply("sleeve", claimed), "use this design on my sleeve");
      expect(take?.placement).toEqual({ kind: "open", phrase: "sleeve" });
      expect(take?.side, `a ${claimed} was invented for a sentence that named no side`).toBeNull();
    }
  });

  it("is not fooled by the word appearing inside another one", () => {
    /* "leftover" is not a side. The boundary is what makes containment a check
       rather than a substring search. */
    const take = readInkReferenceTake(reply("sleeve", "left"), "use the leftover space on my sleeve");
    expect(take?.side).toBeNull();
  });

  it("ignores a side outside the two a sentence can state", () => {
    for (const claimed of ["centre", "center", "middle", "both", "LEFT ARM"]) {
      const take = readInkReferenceTake(reply("sleeve", claimed), `on my ${claimed} sleeve`);
      expect(take?.side).toBeNull();
    }
  });

  it("takes the vocabulary's own answer for a surface that is ONE PLACE", () => {
    /* `neck` is not a pair, so it is `centre` whatever the sentence says — a
       vocabulary fact, derived from the entry rather than decided here. */
    const take = readInkReferenceTake(reply("neck", "left"), "put it on the left of her neck");
    expect(take?.placement).toEqual({ kind: "measured", placement: "neck" });
    expect(take?.side).toBe("centre");
  });

  it("lets a measured PAIR take her stated side", () => {
    const take = readInkReferenceTake(reply("upper arm", "right"), "on her right upper arm");
    expect(take?.placement).toEqual({ kind: "measured", placement: "upperArm" });
    expect(take?.side).toBe("right");
  });

  it("leaves a measured pair unsided when she said nothing", () => {
    const take = readInkReferenceTake(reply("upper arm", null), "on her upper arm");
    expect(take?.side).toBeNull();
  });
});

describe("unreadable is its own answer, and never a guess", () => {
  it.each([
    ["not JSON at all", "sure — I'd put it on her sleeve"],
    ["JSON that is not an object", "[\"sleeve\"]"],
    ["an object with no placement field", "{\"side\":\"left\"}"],
    ["a placement that is not a string", "{\"placement\":42,\"side\":null}"],
  ])("returns null for %s", (_label, raw) => {
    expect(readInkReferenceTake(raw, "use this design on my sleeve")).toBeNull();
  });

  it("survives the fences a model puts round JSON", () => {
    const fenced = "```json\n{\"placement\":\"sleeve\",\"side\":null}\n```";
    expect(readInkReferenceTake(fenced, "on my sleeve")?.placement).toEqual({
      kind: "open", phrase: "sleeve",
    });
  });

  it("is null with no transport at all, rather than a placement nobody read", async () => {
    expect(await resolveInkReferenceTake({ instruction: "on my sleeve", engine: null })).toBeNull();
  });

  it("is null when the transport throws", async () => {
    const engine = { complete: async () => { throw new Error("down"); } } as unknown as TextEngine;
    expect(await resolveInkReferenceTake({ instruction: "on my sleeve", engine })).toBeNull();
  });

  it("drives the whole road through the real function with an engine of its own", async () => {
    const take = await resolveInkReferenceTake({
      instruction: "use this tattoo design on my left sleeve",
      engine: saying(reply("sleeve", "left")),
    });
    expect(take).toEqual({ placement: { kind: "open", phrase: "sleeve" }, side: "left" });
  });
});

describe("is this delta a tattoo ask", () => {
  it("says yes to the ink subject", () => {
    expect(namesInkFromReference(readDelta({ free: { ink: "the design in the picture" } }))).toBe(true);
  });

  /*
    AND THE MARKS ARM, which is the star's own scar (D-158): "a small star behind
    her ear" carries no word "tattoo" and files as a MARK. A predicate that only
    asked about `ink` would let a reference-documented star fall past this branch
    and be rendered from words.
  */
  it("says yes to a MARK that names a design", () => {
    expect(namesInkFromReference(readDelta({ free: { marks: ["a small star behind her ear"] } })))
      .toBe(true);
  });

  it("says no to a mark that is something skin does", () => {
    expect(namesInkFromReference(readDelta({ free: { marks: ["a few freckles"] } }))).toBe(false);
  });

  it("says no to a delta with nothing filed, and to nothing at all", () => {
    expect(namesInkFromReference(readDelta({ hairColour: "copper" }))).toBe(false);
    expect(namesInkFromReference(null)).toBe(false);
    expect(namesInkFromReference(undefined)).toBe(false);
  });
});

describe("what the picture is being taken FOR", () => {
  /*
    ORDERED fable-1151 §1. A design row records `intents`, and on this road the
    declaration is HER SENTENCE rather than a field: the attach door is reached
    before she has typed anything, so there is no ask yet for an intent to
    authorise.

    The condition binding that ruling is that the value is DERIVED from the same
    predicate that enters the branch — so an ask that is not a tattoo ask cannot
    produce a row claiming it was. A constant `["tattoo"]` at the call site
    would be true today and would go on being written the day the branch's
    condition moved, which is what these arms are pointed at.
  */
  it("declares the tattoo when the ask names a design", () => {
    expect(inkAskIntents(readDelta({ free: { ink: "the design in the picture" } })))
      .toEqual(["tattoo"]);
    /* And through the MARKS half of the predicate too, not just the ink one. */
    expect(inkAskIntents(readDelta({ free: { marks: ["a small star behind her ear"] } })))
      .toEqual(["tattoo"]);
  });

  it("declares NOTHING for an ask that is not about a design", () => {
    /* The arm that catches a hard-coded constant: a hair ask, a freckle mark
       and an empty delta must all come back with nothing to declare. */
    expect(inkAskIntents(readDelta({ hairColour: "copper" }))).toEqual([]);
    expect(inkAskIntents(readDelta({ free: { marks: ["a few freckles"] } }))).toEqual([]);
    expect(inkAskIntents(null)).toEqual([]);
    expect(inkAskIntents(undefined)).toEqual([]);
  });
});

describe("what she is told", () => {
  const note = (placement: string, side: string | null, instruction: string) =>
    inkReferenceNote(readInkReferenceTake(reply(placement, side), instruction));

  it("names her own word for the place, and the side when she gave one", () => {
    expect(note("sleeve", "left", "use this on my left sleeve"))
      .toContain("for her left sleeve");
  });

  it("names the vocabulary's noun for a measured surface", () => {
    expect(note("upper arm", "right", "on her right upper arm")).toContain("for her right upper arm");
    expect(note("neck", null, "on her neck")).toContain("for her neck");
  });

  it("names no side when she named none — never an invented arm", () => {
    const said = note("sleeve", null, "use this on my sleeve");
    expect(said).toContain("for her sleeve");
    expect(said).not.toMatch(/\b(left|right)\b/);
  });

  it("says the picture landed even when the place did not", () => {
    const said = note("", null, "use this tattoo design");
    expect(said).toContain("I've got the design from your picture");
    expect(said).not.toContain("for her");
  });

  it("says so plainly when the sentence could not be read at all", () => {
    expect(inkReferenceNote(null)).toContain("couldn't tell where on her you meant");
  });

  /*
    THE TWO HALVES THE COPY MUST ALWAYS CARRY. The first is what makes today's
    wall wrong for this customer — she HAS supplied a design document. The second
    is the free-outcome rule: an answer that does not say it is free reads as a
    silent 25 credits.
  */
  it("always says what cannot happen yet, and that nothing was charged", () => {
    const every = [
      inkReferenceNote(null),
      note("sleeve", "left", "on my left sleeve"),
      note("neck", null, "on her neck"),
      note("", null, "use this design"),
    ];
    for (const said of every) {
      expect(said).toContain("Nothing was charged.");
      expect(said).toMatch(/can't put it on her yet/);
      /* And never the sentence the old wall says to somebody holding one. */
      expect(said).not.toContain("needs a design document");
    }
  });
});

/*
  WHAT THE PICTURE MAY GIVE HER — shape (e), the hair road's discipline moved
  onto a design.

  `RecipeSource.scope` is required because a crop cannot scope itself: a picture
  of a haircut is a picture of a haircut in SOME colour whether anybody asked or
  not, and the words are the only scoping instrument there is. Ink's hazard is
  not a colour, it is THE SURFACE UNDER THE ARTWORK — even after the cutter, a
  design carries the tone and grain of the skin it was photographed on at its
  own edges, and a `rideWhole` design was never cut at all.
*/
describe("the sentence that rides with a design", () => {
  const SHE = pronounsForSex("female");

  it("claims the artwork and names what of it is claimed", () => {
    const said = inkTakeSentence(SHE);
    expect(said).toContain("Take the tattoo design from the reference");
    expect(said).toContain("its shapes, its lines and its colours");
  });

  it("disclaims her body — the failing case this sentence exists for", () => {
    const said = inkTakeSentence(SHE);
    for (const held of ["skin", "skin tone", "body shape", "pose", "lighting"]) {
      expect(said, held).toContain(held);
    }
    expect(said).toContain("Do not take");
  });

  it("says KEEP HER OWN, never keep hers", () => {
    /*
      The hair sentence's own hard-won wording, and the reason transfers word
      for word: `CastPronouns` has no independent possessive (his · hers ·
      theirs), so the clause is worded to need only the one it has. *Keep
      theirs* would have forced a fourth word into that type for one sentence.
    */
    expect(inkTakeSentence(SHE)).toContain("keep her own");
    expect(inkTakeSentence(pronounsForSex("male"))).toContain("keep his own");
    for (const sex of ["female", "male"] as const) {
      expect(inkTakeSentence(pronounsForSex(sex)), sex).not.toContain("keep hers");
      expect(inkTakeSentence(pronounsForSex(sex)), sex).not.toContain("keep theirs");
    }
  });

  it("does not name a side, because that phrase already has an owner", () => {
    /* `sidePhrasing.imageHalfClause` writes the picture half, reached through
       the slot's own instance in the assembler. A second speller here is the
       drift the phrase exists to prevent — and what would drift is the
       difference between her left and the picture's left. */
    const said = inkTakeSentence(SHE);
    expect(said).not.toMatch(/\bleft\b|\bright\b/);
    expect(said).not.toContain("as you look at it");
  });
});
