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
      asks: [{ slot: "lips", noun: "lips", words: "give her a soft nude lip gloss" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references).toHaveLength(1);
    expect(recipe.references[0]!.role).toEqual({ kind: "master" });
    expect(recipe.references[0]!.image).toBe(MASTER);
    expect(recipe.sentences).toEqual([recipe.references[0]!.sentence]);
    expect(recipe.carried).toEqual([]);
    expect(recipe.edited).toEqual(["lips"]);
    expect(recipe.wordStacks.get("lips")).toEqual(["give her a soft nude lip gloss"]);
  });

  it("takes the same code path as a furnished cast — there is no second path", () => {
    /* The degenerate recipe is what the general one produces when the library is
       empty. A fork for the common case is how a defect hides in the half nobody
       exercises, which is why fable-171 put all asks behind one flag. */
    const furnished = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [lips({ carry: { key: "mint/lips.png" } })],
      asks: [{ slot: "hair", noun: "hair", words: "wear it in a low bun" }],
    });
    const degenerate = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [], asks: [{ slot: "hair", noun: "hair", words: "wear it in a low bun" }],
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
      asks: [{ slot: "lips", words: "make her lips noticeably fuller" }],
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
      asks: [{ slot: "lips", words: "make her lips noticeably fuller" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.wordStacks.get("lips")).toEqual([
      "a soft nude lip gloss",
      "make her lips noticeably fuller",
    ]);
  });

  it("carries every untouched slot's crop while the edited one regenerates", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [
        lips({ carry: { key: "mint/lips.png" } }),
        { slot: "earring@left", tier: "item", noun: "hoop on her left ear", words: ["a gold hoop"], carry: { key: "mint/left.png" } },
      ],
      asks: [{ slot: "hair", noun: "hair", words: "wear it gathered into a low bun" }],
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
      asks: [{ slot: "tattoo@forearm", words: "make it larger" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references[1]!.role).toEqual({ kind: "anchor", slot: "tattoo@forearm" });
    expect(recipe.references[1]!.image.key).toBe("library/flash-swallow.png");
    expect(recipe.wordStacks.get("tattoo@forearm")).toEqual(["a fine-line swallow", "make it larger"]);
  });

  it("still refuses when that item ALSO holds a minted crop — the anchor does not excuse it", () => {
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{ ...flash, carry: { key: "mint/tattoo.png" } }],
      asks: [{ slot: "tattoo@forearm", words: "make it larger" }],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("carriesItsOwnEdit");
  });

  it("edits one instance while the other is pixel-held", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [
        { slot: "earring@left", tier: "item", noun: "hoop on her left ear", words: ["a gold hoop"], anchor: { key: "library/hoop.png" } },
        { slot: "earring@right", tier: "item", noun: "hoop on her right ear", words: ["a gold hoop"], carry: { key: "mint/right.png" } },
      ],
      asks: [{ slot: "earring@left", words: "make that hoop noticeably bigger" }],
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
        { slot: "earring@left", tier: "item", noun: "hoop on her left ear", words: ["a gold hoop"], anchor: { key: "library/hoop.png" } },
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
    slot: "earring@left", tier: "item", noun: "hoop on her left ear",
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
    expect(recipe.standing.map((standing) => standing.slot)).toEqual(["hair"]);
    /* And the words point at the crop by the ordinal it actually occupies, so
       the two halves of the carry contract name the same thing. */
    expect(recipe.standing[0]!.sentence).toBe(
      "Keep her hair exactly as in reference 2: worn down, a blunt fringe.",
    );
  });

  it("SURFACE: the words ride and nothing else does — there is no crop to send", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [tan], asks: [{ slot: "hair", noun: "hair", words: "wear it up" }],
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
      asks: [{ slot: "hair", noun: "hair", words: "wear it up" }],
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

  it("ITEM: the crop carries and the item is NOT described again", () => {
    /* The one tier whose crop carried outright. Saying it twice would put a
       word stack and a reference in competition over the same feature. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [hoop], asks: [{ slot: "hair", noun: "hair", words: "wear it up" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references[1]!.role).toEqual({ kind: "carry", slot: "earring@left" });
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
      asks: [{ slot: "hair", words: "cut it to the collarbone" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.standing.map((standing) => standing.slot)).toEqual(["skin"]);
    expect(recipe.wordStacks.get("hair")).toEqual([
      "worn down", "a blunt fringe", "cut it to the collarbone",
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
    expect(recipe.standing.map((standing) => standing.slot)).toEqual(["hair", "skin"]);
    expect(recipe.carried).toEqual(["earring@left", "hair", "skin"]);
  });
});

describe("THE PROMPT IS THE WIRE — the sentences and the array are one artifact", () => {
  const hoop: LibraryEntry = {
    slot: "earring@left", tier: "item", noun: "wide gold hoop on her left ear",
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
      " Reference 2 is the exact wide gold hoop on her left ear she has —" +
      " the same wide gold hoop on her left ear, unchanged." +
      " Reference 3 is the exact hair she has — the same hair, unchanged." +
      " Keep her hair exactly as in reference 3: worn down." +
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
    expect(recipe.prompt).toContain("the exact hair he has");
    expect(recipe.prompt).toContain("Keep his hair exactly as in reference 2: cropped short.");
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
    expect(recipe.prompt.endsWith("Keep her hair exactly as in reference 2: worn down.")).toBe(true);
  });
});
