/**
 * THE DEGENERATE CASE FIRST, AND THEN EVERY REFUSAL DRIVEN DIRECTLY.
 *
 * fable-171's condition 1 on the compositor swap: *the degenerate case gets its
 * own fixture proof first* — a no-library cast with a words-only ask is the road
 * every NEW cast travels, so it is the most-travelled road, not the edge case.
 * It is the first test in this file for that reason.
 *
 * The refusals are driven straight at `assembleRecipe`, never through a model
 * that usually behaves (working law 3). A guard whose only test runs through an
 * LLM is an untested guard.
 */
import { describe, expect, it } from "vitest";

import { pronounsForSex } from "./castPronouns";
import { assembleRecipe, type LibraryEntry } from "./recipeAssembler";

const MASTER = { key: "casting-v2/candidates/master.png", sha: "16bb85180e9e" };
const SHE = pronounsForSex("female");

const lips = (over: Partial<LibraryEntry> = {}): LibraryEntry => ({
  slot: "lips", tier: "anatomy", noun: "lips", words: ["a soft nude lip gloss"], ...over,
});

describe("the degenerate case — a cast with no library and a words-only ask", () => {
  it("assembles to the master alone, plus the words", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [],
      asks: [{ slot: "lips", noun: "lips", words: "a soft nude lip gloss" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references).toHaveLength(1);
    expect(recipe.references[0]!.role).toEqual({ kind: "master" });
    expect(recipe.references[0]!.image).toBe(MASTER);
    expect(recipe.sentences).toEqual([recipe.references[0]!.sentence]);
    expect(recipe.carried).toEqual([]);
    expect(recipe.edited).toEqual(["lips"]);
    expect(recipe.wordStacks.get("lips")).toEqual(["a soft nude lip gloss"]);
  });

  it("takes the same code path as a furnished cast — there is no second path", () => {
    /* The degenerate recipe is what the general one produces when the library is
       empty. A fork for the common case is how a defect hides in the half nobody
       exercises, which is why fable-171 put all asks behind one flag. */
    const furnished = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [lips({ carry: { key: "mint/lips.png" } })],
      asks: [{ slot: "hair", noun: "hair", words: "gathered into a low bun" }],
    });
    const degenerate = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [], asks: [{ slot: "hair", noun: "hair", words: "gathered into a low bun" }],
    });
    expect(furnished.ok && degenerate.ok).toBe(true);
    if (!furnished.ok || !degenerate.ok) return;
    expect(furnished.references[0]).toEqual(degenerate.references[0]);
    expect(furnished.wordStacks.get("hair")).toEqual(degenerate.wordStacks.get("hair"));
  });
});

describe("D-244 line 2 — a feature's own crop never rides in its own edit", () => {
  it("REFUSES a recipe that edits a slot which also carries a minted crop", () => {
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [lips({ carry: { key: "mint/lips.png" } })],
      asks: [{ slot: "lips", words: "noticeably fuller lips" }],
    });

    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("carriesItsOwnEdit");
    expect(refusal.slot).toBe("lips");
  });

  it("regenerates the edited feature from the FULL stack, not the delta alone", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [lips()], /* gloss already accepted; no crop, so nothing to contaminate */
      asks: [{ slot: "lips", words: "noticeably fuller lips" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.wordStacks.get("lips")).toEqual([
      "a soft nude lip gloss",
      "noticeably fuller lips",
    ]);
  });

  it("carries every untouched slot's crop while the edited one regenerates", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [
        lips({ carry: { key: "mint/lips.png" } }),
        { slot: "earring@left", tier: "item", noun: "left earring", words: ["a gold hoop"], carry: { key: "mint/left.png" } },
      ],
      asks: [{ slot: "hair", noun: "hair", words: "gathered into a low bun" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.carried).toEqual(["lips", "earring@left"]);
    expect(recipe.edited).toEqual(["hair"]);
    expect(recipe.references.map((reference) => reference.role)).toEqual([
      { kind: "master" },
      { kind: "carry", slot: "lips" },
      { kind: "carry", slot: "earring@left" },
    ]);
  });
});

describe("D-244 line 3 — an introduced item regenerates from its FROZEN anchor", () => {
  const flash: LibraryEntry = {
    slot: "tattoo@forearm", tier: "item", noun: "forearm tattoo",
    words: ["a fine-line swallow"], anchor: { key: "library/flash-swallow.png" },
  };

  it("sends the anchor, not the current crop, when the item is edited", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{ ...flash }],
      asks: [{ slot: "tattoo@forearm", words: "larger" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references[1]!.role).toEqual({ kind: "anchor", slot: "tattoo@forearm" });
    expect(recipe.references[1]!.image.key).toBe("library/flash-swallow.png");
    expect(recipe.wordStacks.get("tattoo@forearm")).toEqual(["a fine-line swallow", "larger"]);
  });

  it("still refuses when that item ALSO holds a minted crop — the anchor does not excuse it", () => {
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{ ...flash, carry: { key: "mint/tattoo.png" } }],
      asks: [{ slot: "tattoo@forearm", words: "larger" }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("carriesItsOwnEdit");
  });

  it("edits one instance while the other is pixel-held", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [
        { slot: "earring@left", tier: "item", noun: "left earring", words: ["a gold hoop"], anchor: { key: "library/hoop.png" } },
        { slot: "earring@right", tier: "item", noun: "right earring", words: ["a gold hoop"], carry: { key: "mint/right.png" } },
      ],
      asks: [{ slot: "earring@left", words: "noticeably bigger" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references.map((reference) => reference.role)).toEqual([
      { kind: "master" },
      { kind: "anchor", slot: "earring@left" },
      { kind: "carry", slot: "earring@right" },
    ]);
    expect(recipe.edited).toEqual(["earring@left"]);
    expect(recipe.carried).toEqual(["earring@right"]);
  });
});

describe("D-244 line 5 — removal strikes the words", () => {
  it("regenerates from what survives, and the shape that was never struck survives", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [lips({ words: ["a soft nude lip gloss", "noticeably fuller lips"] })],
      asks: [{ slot: "lips", remove: ["a soft nude lip gloss"] }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.wordStacks.get("lips")).toEqual(["noticeably fuller lips"]);
  });

  it("REFUSES to strike a word the slot never held — a no-op dressed as a removal", () => {
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [lips()],
      asks: [{ slot: "lips", remove: ["a matte red lipstick"] }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("removeNotInStack");
  });

  it("REFUSES when striking would empty the stack of a feature with no anchor", () => {
    /* Nothing said and nothing introduced means regenerating her as she was
       born — a revert wearing an edit's clothes, and a different ask. */
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [lips()],
      asks: [{ slot: "lips", remove: ["a soft nude lip gloss"] }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("emptyWordStack");
  });

  it("allows an emptied stack when the slot has an anchor to regenerate from", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{
        slot: "makeup@eyes", tier: "surface", noun: "eye makeup",
        words: ["a smoked liner"], anchor: { key: "library/look.png" },
      }],
      asks: [{ slot: "makeup@eyes", remove: ["a smoked liner"] }],
    });
    expect(recipe.ok).toBe(true);
  });
});

describe("fable-174 — one slot, one reference, per render", () => {
  it("REFUSES two asks on the same anchored slot in one render", () => {
    const anchored: LibraryEntry = {
      slot: "lips", tier: "anatomy", noun: "lips", words: [], anchor: { key: "library/lip-shape.png" },
    };
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [anchored],
      asks: [
        { slot: "lips", noun: "lips", words: "fuller" },
        { slot: "lips", words: "glossier" },
      ],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("slotTwiceReferenced");
  });
});

describe("the ordinals and the sentences are built in one pass", () => {
  it("names each reference by the position it actually occupies", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [
        { slot: "earring@left", tier: "item", noun: "left earring", words: ["a gold hoop"], anchor: { key: "library/hoop.png" } },
        { slot: "lips", tier: "anatomy", noun: "lips", words: ["gloss"], carry: { key: "mint/lips.png" } },
        { slot: "hair", tier: "anatomy", noun: "hair", words: ["worn down"], carry: { key: "mint/hair.png" } },
      ],
      asks: [{ slot: "earring@left", words: "bigger" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    recipe.references.forEach((reference, index) => {
      /* "Reference N is …" must name this reference's own send position — the
         master's identity clause included. A sentence and an array that
         disagree is the two-lists defect, and it is invisible in every output
         except the picture. */
      expect(reference.sentence).toMatch(new RegExp(`^Reference ${index + 1} is `));
    });
    expect(recipe.sentences).toHaveLength(recipe.references.length);
  });
});

describe("the carry contract, per tier (fable-192 — measured, not precautionary)", () => {
  const hair = (over: Partial<LibraryEntry> = {}): LibraryEntry => ({
    slot: "hair", tier: "anatomy", noun: "hair",
    words: ["worn down", "a blunt fringe"], carry: { key: "mint/hair.png" }, ...over,
  });
  const tan: LibraryEntry = {
    slot: "skin", tier: "surface", noun: "skin", words: ["an even golden tan"],
  };
  const hoop: LibraryEntry = {
    slot: "earring@left", tier: "item", noun: "left earring",
    words: ["a wide gold hoop"], carry: { key: "mint/left.png" },
  };

  it("ANATOMY: the crop rides AND the words ride, on a render that touches neither", () => {
    /* The crop is worth about a third of its own value against a master that
       disagrees with it, so it is an assist. The words are the carrier of
       record, and they ride whether or not this render is about the hair. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [hair()], asks: [{ slot: "lips", noun: "lips", words: "fuller" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references.map((reference) => reference.role)).toEqual([
      { kind: "master" }, { kind: "carry", slot: "hair" },
    ]);
    /* And the words ride ON that reference — the founder's confirmed format,
       named then described — so the two halves of the carry contract are one
       sentence about one thing rather than two instructions. */
    expect(recipe.standing).toEqual([]); /* the words rode on the reference */
    expect(recipe.references[1]!.sentence).toBe(
      "Reference 2 is the exact hair she has — worn down, a blunt fringe, unchanged.",
    );
  });

  it("SURFACE: the words ride and nothing else does — there is no crop to send", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [tan], asks: [{ slot: "hair", noun: "hair", words: "worn up" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references).toHaveLength(1); /* the master alone */
    expect(recipe.standing.map((standing) => standing.sentence)).toEqual([
      "Keep her skin exactly: an even golden tan.", /* no ordinal — nothing rides */
    ]);
    /* Carried by words is still carried: it is a promise, so it is verified. */
    expect(recipe.carried).toEqual(["skin"]);
  });

  it("SURFACE: REFUSES a slot that holds a minted crop at all", () => {
    /* Not "does not send it" — refuses. A surface crop is a slot built against
       the tier boundary, and the tier has no working instrument that could
       catch what such a crop delivered. */
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{ ...tan, carry: { key: "mint/skin.png" } }],
      asks: [{ slot: "hair", noun: "hair", words: "worn up" }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("surfaceCarriesCrop");
    expect(refusal.slot).toBe("skin");
  });

  it("SURFACE: refuses that crop even on the render that EDITS the surface", () => {
    /* The defect is that the crop exists, not that this render would have sent
       it — so the refusal cannot be dodged by editing the slot. */
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{ ...tan, carry: { key: "mint/skin.png" } }],
      asks: [{ slot: "skin", words: "a deeper tan" }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("surfaceCarriesCrop");
  });

  it("ITEM: the crop carries, and its words ride ON the reference, never beside it", () => {
    /* The one tier whose crop carried outright. A description DERIVED from the
       item's own record strengthens the reference (fable-194's format); a word
       stack living beside it would be two instructions about one feature, which
       is the thing that would drift. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [hoop], asks: [{ slot: "hair", noun: "hair", words: "worn up" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references[1]!.role).toEqual({ kind: "carry", slot: "earring@left" });
    expect(recipe.references[1]!.sentence).toBe(
      "Reference 2 is the exact left earring she has — a wide gold hoop, unchanged.",
    );
    expect(recipe.standing).toEqual([]);
    expect(recipe.carried).toEqual(["earring@left"]);
  });

  it("the EDITED feature is never also standing — words change or crops carry, never both", () => {
    /* D-244 line 1. The edited slot's full stack is in wordStacks, where it
       regenerates the feature; a standing sentence for the same slot would be
       the render describing the thing it is in the middle of changing. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [hair({ carry: undefined }), tan],
      asks: [{ slot: "hair", words: "cut to the collarbone" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.standing.map((standing) => standing.slot)).toEqual(["skin"]);
    expect(recipe.wordStacks.get("hair")).toEqual([
      "worn down", "a blunt fringe", "cut to the collarbone",
    ]);
    expect(recipe.carried).not.toContain("hair");
  });

  it("all three tiers in one recipe, in library order", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [hoop, hair(), tan],
      asks: [{ slot: "lips", noun: "lips", words: "a soft nude lip" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references.map((reference) => reference.role)).toEqual([
      { kind: "master" },
      { kind: "carry", slot: "earring@left" },
      { kind: "carry", slot: "hair" },
    ]);
    /* Only the surface stands alone: the hair said its words on reference 3. */
    expect(recipe.standing.map((standing) => standing.slot)).toEqual(["skin"]);
    expect(recipe.carried).toEqual(["earring@left", "hair", "skin"]);
  });
});

describe("THE PROMPT IS THE WIRE — the sentences and the array are one artifact", () => {
  const hoop: LibraryEntry = {
    slot: "earring@left", tier: "item", noun: "left earring",
    words: ["a wide gold hoop"], carry: { key: "mint/left.png" },
  };
  const hair: LibraryEntry = {
    slot: "hair", tier: "anatomy", noun: "hair",
    words: ["worn down"], carry: { key: "mint/hair.png" },
  };
  const tan: LibraryEntry = {
    slot: "skin", tier: "surface", noun: "skin", words: ["an even golden tan"],
  };

  it("the degenerate case sends the master, the identity clause and one small ask", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "lips", noun: "lips", words: "a soft nude lip gloss" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toBe(
      "Reference 1 is the photograph of this person — reproduce her exactly:" +
      " same face, same pose, same lighting, same framing, same background." +
      " Change only her lips: a soft nude lip gloss.",
    );
  });

  it("names every reference for what it is, in the form that carried", () => {
    /* The bisect stripped the carrying recipe to two references and it still
       carried, so naming form and ask size are what survived. They are emitted
       here rather than left to each caller's prose. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [hoop, hair, tan],
      asks: [{ slot: "lips", noun: "lips", words: "noticeably fuller" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toBe(
      "Reference 1 is the photograph of this person — reproduce her exactly:" +
      " same face, same pose, same lighting, same framing, same background." +
      " Reference 2 is the exact left earring she has — a wide gold hoop, unchanged." +
      " Reference 3 is the exact hair she has — worn down, unchanged." +
      " Keep her skin exactly: an even golden tan." +
      " Change only her lips: noticeably fuller.",
    );
  });

  it("every ordinal the PROMPT names resolves to the image at that position", () => {
    /*
      The claim "reference 3 is her hair" is only true of the array that
      actually goes out, and nothing downstream may reorder the references
      without rebuilding the sentences. Asserted on the text, against the list —
      a contract about what is sent is proven on the thing being sent.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [hoop, hair],
      asks: [{ slot: "lips", noun: "lips", words: "noticeably fuller" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;

    const named = [...recipe.prompt.matchAll(/Reference (\d+) is the exact ([^—]+?) (?:she|he|they) ha[sve]/g)];
    expect(named).toHaveLength(2);
    for (const [, ordinal, noun] of named) {
      const reference = recipe.references[Number(ordinal) - 1];
      expect(reference).toBeDefined();
      const slot = "slot" in reference!.role ? reference!.role.slot : "master";
      expect([hoop, hair].find((entry) => entry.slot === slot)!.noun).toBe(noun);
    }
    expect(recipe.references.map((reference) => reference.image.key)).toEqual([
      MASTER.key, "mint/left.png", "mint/hair.png",
    ]);
  });

  it("the pronoun tracks the CAST, never the specimen the form was measured on", () => {
    /* The naming form was measured on a woman. `segmentsOnFace` shipped "hers"
       onto a male candidate's face once already; the form carried, the pronoun
       never was part of it. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: pronounsForSex("male"),
      library: [{ ...hair, noun: "hair", words: ["cropped short"] }],
      asks: [{ slot: "lips", noun: "lips", words: "a chapped, natural lip" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain("reproduce him exactly");
    expect(recipe.prompt).toContain("the exact hair he has — cropped short, unchanged.");
    expect(recipe.prompt).toContain("Change only his lips:");
  });

  it("REFUSES a noun that arrives with its own determiner", () => {
    /* "her the lips" and "the exact the wide gold hoop" are the same defect as
       "her a mullet", which was live in real data. The template supplies the
       determiner, so the noun may not. */
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{ ...hair, noun: "the hair" }],
      asks: [{ slot: "lips", noun: "lips", words: "fuller" }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("nounNotBare");
    expect(refusal.slot).toBe("hair");
  });

  it("REFUSES an ask on a slot nothing can name", () => {
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "lips", words: "fuller" }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("slotNotNamed");
  });

  it("states the edited feature's WHOLE stack in the ask, not the delta alone", () => {
    /* D-244 line 2 regenerates from the full stack. An ask naming only the
       delta would ask the painter to add fullness to lips it has just been told
       nothing else about. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{ slot: "lips", tier: "anatomy", noun: "lips", words: ["a soft nude lip gloss"] }],
      asks: [{ slot: "lips", words: "noticeably fuller" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.ask).toBe("Change only her lips: a soft nude lip gloss, noticeably fuller.");
  });

  it("a pure carry render — nothing asked — sends the references and no ask at all", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [hair], asks: [],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.ask).toBe("");
    expect(recipe.prompt.endsWith("Reference 2 is the exact hair she has — worn down, unchanged.")).toBe(true);
  });
});

describe("the declarative-state contract with our own interpreter (fable-195)", () => {
  /*
    Ruled after opus-140 raised it: the stack is "everything ever said about
    this feature" and it is re-said IN FULL on every edit, so imperatives cannot
    accumulate — "make it bigger, make it bigger" says nothing a painter can
    act on, while "a wide gold hoop, noticeably bigger" describes a state.

    This is a contract between our own modules, checked at the boundary the
    interpreter's output crosses. It is not a detector judging a picture, so it
    does not collide with D-246.
  */
  it("REFUSES an ask that arrives as an instruction rather than a state", () => {
    for (const imperative of [
      "make her lips fuller",
      "add a gold hoop",
      "remove the gloss",
      "give her freckles",
      "change her eye colour to green",
      "wear it up",
    ]) {
      const refusal = assembleRecipe({
        master: MASTER, pronouns: SHE, library: [],
        asks: [{ slot: "lips", noun: "lips", words: imperative }],
      });
      expect(refusal.ok, imperative).toBe(false);
      if (refusal.ok) return;
      expect(refusal.reason).toBe("wordsNotDeclarative");
    }
  });

  it("REFUSES a stored stack that holds one, wherever it came from", () => {
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [lips({ words: ["a soft nude lip gloss", "make them fuller"] })],
      asks: [{ slot: "hair", noun: "hair", words: "gathered into a low bun" }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("wordsNotDeclarative");
    expect(refusal.slot).toBe("lips");
  });

  it("passes the state phrases the interpreter owes", () => {
    /* And the marker stays short on purpose: a longer list starts refusing
       legitimate participles, which would push the interpreter toward stilted
       language to satisfy a spelling check. */
    for (const declarative of [
      "noticeably fuller lips",
      "a wide gold hoop",
      "worn down, centre-parted",
      "painted a deep red",
      "set in a low bun",
      "cut to the collarbone",
      "taken up into a chignon",
    ]) {
      const recipe = assembleRecipe({
        master: MASTER, pronouns: SHE, library: [],
        asks: [{ slot: "lips", noun: "lips", words: declarative }],
      });
      expect(recipe.ok, declarative).toBe(true);
    }
  });
});

describe("a surface's UPLOADED reference is an anchor, and anchors are legal (fable-195)", () => {
  const uploadedLook: LibraryEntry = {
    slot: "makeup@eyes", tier: "surface", noun: "eye makeup",
    words: ["a smoked liner"], anchor: { key: "library/look-she-uploaded.png" },
  };

  it("rides on the surface's own edit — the founder's stored makeup reference", () => {
    /* "That image will need to be stored as the makeup reference." It is a
       FROZEN INTRODUCTION reference, not a minted carry crop, and the refusal
       below must not catch it. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [uploadedLook],
      asks: [{ slot: "makeup@eyes", words: "a softer, browner smoke" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references[1]!.role).toEqual({ kind: "anchor", slot: "makeup@eyes" });
    expect(recipe.references[1]!.image.key).toBe("library/look-she-uploaded.png");
  });

  it("and on a render that touches something else, its words stand alone", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [uploadedLook],
      asks: [{ slot: "hair", noun: "hair", words: "gathered into a low bun" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references).toHaveLength(1); /* the anchor rides its own edit only */
    expect(recipe.standing.map((standing) => standing.sentence)).toEqual([
      "Keep her eye makeup exactly: a smoked liner.",
    ]);
  });

  it("but a MINTED carry crop for that same slot is still refused", () => {
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{ ...uploadedLook, carry: { key: "mint/makeup.png" } }],
      asks: [{ slot: "hair", noun: "hair", words: "gathered into a low bun" }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("surfaceCarriesCrop");
  });
});

/**
 * A VACATED SLOT — the recipe's half of chunk 3 (`LIBRARY_REMOVAL_DESIGN.md` §3).
 *
 * Driven straight at the assembler, never through the removal arithmetic that
 * produces the ask: the whole point of the shape is that a slot can be taken
 * off, and the guard for it must be exercisable without a model or a chain.
 *
 * The founder's own step 5 is the specimen — "remove her glasses", refused and
 * refunded on the shift-59 walk in 33.2 seconds.
 */
describe("a slot declared vacant", () => {
  /*
    NO  on the vacated slot's own entry, and that is the production
    shape rather than a convenience:  strips the
    crop of every edited slot before the recipe is assembled, and a vacate is an
    edit. The control at the foot of this block drives what happens when it is
    not stripped.
  */
  /*
    NO `carry` on the vacated slot's own entry, and that is the PRODUCTION shape
    rather than a convenience: `libraryWithoutEditedCrops` strips the crop of
    every edited slot before the recipe is assembled, and a vacate is an edit.
    The last control in this block drives what happens when it is not stripped.
  */
  const glasses: LibraryEntry = {
    slot: "glasses", tier: "item", noun: "glasses",
    words: ["thin gold wire frames"],
  };
  const GONE = "no glasses — her face uncovered, no frames, no lenses and no rim shadow";

  it("SAYS THE ABSENCE at the wire, because silence would repaint them", () => {
    /*
      The master is reference 1 and her glasses are IN it. A recipe that merely
      drops the words and the crop is a recipe that says nothing about her
      glasses to a painter looking at a photograph of her wearing them.
      Asserted on the OUTGOING prompt, not on a constant near it.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [glasses],
      asks: [{ slot: "glasses", noun: "glasses", vacate: { says: GONE } }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain(GONE);
    expect(recipe.ask).toContain(GONE);
    expect(recipe.vacated).toEqual(["glasses"]);
    expect(recipe.edited).toEqual(["glasses"]);
  });

  it("carries NO crop for its own slot, and no anchor either", () => {
    /* Sending the crop would hand the painter a picture of the thing it is
       being asked to take off. A vacate is in `editedSet`, so the carry loop
       skips it — pinned here against the new shape. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{ ...glasses, anchor: { key: "library/the-frames-she-uploaded.png" } }],
      asks: [{ slot: "glasses", noun: "glasses", vacate: { says: GONE } }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references).toHaveLength(1);
    expect(recipe.references[0]!.role).toEqual({ kind: "master" });
    expect(recipe.carried).toEqual([]);
    /* Present and empty, never absent — the record and the panel read this. */
    expect(recipe.wordStacks.get("glasses")).toEqual([]);
  });

  it("does not silence the OTHER slots — everything else still carries", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [glasses, lips({ carry: { key: "mint/lips.png" } })],
      asks: [{ slot: "glasses", noun: "glasses", vacate: { says: GONE } }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.carried).toEqual(["lips"]);
    expect(recipe.vacated).toEqual(["glasses"]);
  });

  it("CONTROL — a vacate with words is refused, not merged", () => {
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [glasses],
      asks: [{ slot: "glasses", noun: "glasses", words: "thin gold wire frames", vacate: { says: GONE } }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("vacateAlsoAsks");
  });

  it("CONTROL — a vacate that says nothing is refused, because silence is the defect", () => {
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [glasses],
      asks: [{ slot: "glasses", noun: "glasses", vacate: { says: "   " } }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("vacateSaysNothing");
  });

  it("CONTROL — an EMPTY ordinary ask still refuses, so the new door opened nothing else", () => {
    /* `emptyWordStack` is right about every other caller: a slot regenerating
       from the master with nothing said is a revert wearing an edit's clothes.
       A vacate is the one legitimate empty stack, and it is legitimate because
       it speaks. */
    const refusal = assembleRecipe({
      /* Nothing said before and nothing said now — the shape `emptyWordStack`
         was written for. (With a library entry the stack is not empty at all;
         the entry's own words survive, which is a different case and a legal
         one.) */
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "glasses", noun: "glasses", words: "" }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("emptyWordStack");
  });

  it("CONTROL — a vacate handed its own crop is still refused by D-244 line 2", () => {
    /*
      The one structural guard that must NOT relax for a vacate. Reaching it
      means a caller assembled a recipe that hands a feature its own crop while
      taking that feature off — the picture of the thing, sent to the render
      that removes it. It is unreachable in production because the caller
      strips edited slots' crops, and it is driven here because "unreachable"
      is what the last corner said about itself before it cost a walk.
    */
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{ ...glasses, carry: { key: "mint/glasses.png" } }],
      asks: [{ slot: "glasses", noun: "glasses", vacate: { says: GONE } }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("carriesItsOwnEdit");
  });
});

/**
 * A PAIR THAT IS WHOLLY EMPTY SPEAKS AS A PAIR (fable-332).
 *
 * The library is keyed per side, so "take her earrings off" leaves two
 * vacancies. Each row records its own lobe — it must, because a per-side row
 * may not file a claim about both sides — but the PROMPT should say what a
 * stylist says, once, in the wording the removal bench actually measured.
 */
describe("two empty lobes are one sentence", () => {
  const vacantLobe = (side: "left" | "right"): LibraryEntry => ({
    slot: `earring@${side}`, tier: "item", noun: `${side} earring`, vacant: true,
    words: [`no earring on her ${side} ear — that earlobe bare, nothing hanging from it`],
  });
  const PAIR = "no earrings — both earlobes bare, nothing hanging from either ear";
  const hair = { slot: "hair", tier: "anatomy", noun: "hair", words: ["a copper crop"] } as LibraryEntry;

  it("says the PAIR phrase once when both lobes are empty", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [vacantLobe("left"), vacantLobe("right"), hair],
      asks: [{ slot: "hair", noun: "hair", words: "a copper crop" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain(PAIR);
    /* Once — the whole point. Two instructions about one fact is what this
       assembler refuses everywhere else. */
    expect(recipe.prompt.split(PAIR)).toHaveLength(2);
    /* And neither lobe's own sentence rides beside it. */
    expect(recipe.prompt).not.toContain("her left ear");
    expect(recipe.prompt).not.toContain("her right ear");
    expect(recipe.standing.map((entry) => entry.sentence)).toEqual([`${PAIR}.`]);
  });

  it("CONTROL — ONE empty lobe still speaks for itself, and never for the pair", () => {
    /*
      The fixture that makes the arm above mean something: change only the
      number of empty lobes and the sentence changes with it. This state is not
      reachable from any ask the product offers today — deliberately, since the
      mirror bench found "her right ear" clearing BOTH ears five times in six —
      but the assembler must not invent a claim about a lobe still wearing one.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [vacantLobe("left"), hair],
      asks: [{ slot: "hair", noun: "hair", words: "a copper crop" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain("no earring on her left ear");
    expect(recipe.prompt).not.toContain(PAIR);
  });

  it("CONTROL — an empty pair of a kind with no pair phrase keeps its own words", () => {
    /* The fall-through, driven: a slot whose kind the accessory table cannot
       name has no pair sentence to collapse into, and going silent about an
       empty site is the one-frame removal all over again. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [
        { slot: "cufflink@left", tier: "item", noun: "left cufflink", vacant: true, words: ["that cuff bare"] },
        { slot: "cufflink@right", tier: "item", noun: "right cufflink", vacant: true, words: ["that cuff bare too"] },
        hair,
      ],
      asks: [{ slot: "hair", noun: "hair", words: "a copper crop" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain("that cuff bare");
    expect(recipe.prompt).toContain("that cuff bare too");
  });

  it("says a vacate ONCE in the change clause, however many slots the kind vacates", () => {
    /*
      The duplication as it shipped: a pair vacates two slots and each ask
      carries the kind's phrase, so the change clause said it twice —
      "Change only no earrings — …; no earrings — …". Read off the outgoing
      prompt, which is where the claim is about.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [
        { slot: "earring@left", noun: "left earring", vacate: { says: PAIR } },
        { slot: "earring@right", noun: "right earring", vacate: { says: PAIR } },
      ],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt.split(PAIR)).toHaveLength(2);
    expect(recipe.ask).toBe(`Change only ${PAIR}.`);
    /* Both slots are still VACATED — the sentence was deduplicated, not the
       fact. The library must retire and record both lobes. */
    expect(recipe.vacated).toEqual(["earring@left", "earring@right"]);
  });
});
