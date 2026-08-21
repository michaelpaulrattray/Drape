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
import {
  assembleRecipe,
  type CarriedInkDesign,
  type LibraryEntry,
  type RecipeSource,
} from "./recipeAssembler";
import {
  inkDeliveredCarrySentence, inkNotOnClothingClause, inkRealismClause,
} from "./inkRealism";
import { inkTakeSentence } from "./inkReferenceTake";

const MASTER = { key: "casting-v2/candidates/master.png", sha: "16bb85180e9e" };
const SHE = pronounsForSex("female");
const HE = pronounsForSex("male");

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
    /*
      BOTH HALVES, and this assertion was the regression's own pin.

      It used to read `expect(recipe.standing).toEqual([])` — directly under a
      comment saying the words "ride whether or not this render is about the
      hair". The test described fable-192 and asserted its opposite, so the day
      fable-598 made a carried crop skip its sentence, nothing went red.

      Measured on 2026-08-17 (opus-638): with the crop alone and no words, a
      delivered eye colour came back 0 times in 5, across three different
      presentations of the same crop; with the words present it came back 5 of
      5. The crop is the assist. The words are the carrier of record.
    */
    expect(recipe.references[1]!.sentence).toBe(
      "Reference 2 is the exact hair she has — the same hair, unchanged.",
    );
    expect(recipe.standing.map((standing) => standing.sentence)).toEqual([
      "Keep her hair exactly: worn down, a blunt fringe.",
    ]);
    /* And it is IN THE PROMPT, not merely in a field beside it. */
    expect(recipe.prompt).toContain("Reference 2 is the exact hair she has");
    expect(recipe.prompt).toContain("Keep her hair exactly: worn down, a blunt fringe.");
  });

  it("ITEM: a carried crop still says NOTHING — fable-598 kept, for its own reason", () => {
    /*
      The other direction, pinned so the anatomy fix cannot quietly widen into
      the rule it was carved out of. An item's crop carried outright, and a
      description beside it is a second author arguing with the picture: his two
      34 px crosses drifted worst on the side whose sentence sat furthest from
      its own crop.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [hoop], asks: [{ slot: "lips", noun: "lips", words: "fuller" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references.map((reference) => reference.role)).toEqual([
      { kind: "master" }, { kind: "carry", slot: "earring@left" },
    ]);
    expect(recipe.standing).toEqual([]);
    expect(recipe.prompt).not.toContain("Keep the left earring");
    expect(recipe.prompt).not.toContain("a wide gold hoop");
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
    /*
      The one tier whose crop carried outright.

      This used to pin the item's own description ON the reference — fable-194's
      format, on the reasoning that a description derived from the record
      strengthens it while a stack BESIDE it would be two instructions about one
      feature. **The second half stands and the first is superseded**
      (fable-598, from his own dispatched prompt): a description on the
      reference is also a second instruction, and when the describer gave one
      object two sentences the delivery followed the disagreement.

      So the reference names the slot and the claim. The crop is the
      description.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [hoop], asks: [{ slot: "hair", noun: "hair", words: "worn up" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references[1]!.role).toEqual({ kind: "carry", slot: "earring@left" });
    expect(recipe.references[1]!.sentence).toBe(
      "Reference 2 is the exact left earring she has — the same left earring, unchanged.",
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
    /* The ITEM says nothing beside its crop; the ANATOMY slot and the SURFACE
       both speak — in library order, which is the order the prompt reads. */
    expect(recipe.standing.map((standing) => standing.slot)).toEqual(["hair", "skin"]);
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
      " Reference 2 is the exact left earring she has — the same left earring, unchanged." +
      " Reference 3 is the exact hair she has — the same hair, unchanged." +
      /* THE ANATOMY SENTENCE, ON THE WIRE (fable-863 §3c). The measurement that
         put it back is in the assembler's own comment; this is the proof that
         the assembler EMITS it, in the prompt that actually goes out, rather
         than a bench appending it afterwards. */
      " Keep her hair exactly: worn down." +
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
    expect(recipe.prompt).toContain("the exact hair he has — the same hair, unchanged.");
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
    expect(recipe.prompt).toContain("Reference 2 is the exact hair she has — the same hair, unchanged.");
    /* A pure carry render still SAYS what it is carrying — the standing
       sentence is the last thing in the prompt when there is no ask. */
    expect(recipe.prompt.endsWith("Keep her hair exactly: worn down.")).toBe(true);
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
 * PUTTING IT BACK ON (fable-401) — the founder's own production failure, driven
 * at the assembler with the string that was actually dispatched.
 *
 * He removed her glasses, then asked for glasses again. Production v#182
 * (2026-08-13T09:03Z) sent this, verbatim, off the row's own `recipe.prompt`:
 *
 *   "Change only the glasses: no glasses — her face uncovered, no frames, no
 *    lenses and no rim shadow on her cheeks or brows, glasses."
 *
 * Two instructions about one feature, at war in one clause. The painter obeyed
 * the vacate twice, the verifier honestly saw no glasses, and 25 credits went
 * back — twice. The absence must stand down for the slot the ask re-fills, and
 * must keep standing for every slot the ask does not touch. Both halves below;
 * neither is a finding without the other.
 */
describe("an ask supersedes the vacancy it re-fills", () => {
  /* The production phrase, character for character (`accessoryKinds`'s
     `vacantPhrase` for the glasses kind) — a shortened paraphrase would let a
     substring assertion pass against a prompt that still says the real one. */
  const GONE_VERBATIM =
    "no glasses — her face uncovered, no frames, no lenses and no rim shadow on her cheeks or brows";
  const vacantGlasses: LibraryEntry = {
    slot: "glasses", tier: "item", noun: "glasses", vacant: true, words: [GONE_VERBATIM],
  };
  const hair: LibraryEntry = {
    slot: "hair", tier: "anatomy", noun: "hair",
    words: ["Dark brown, near-black hair, straight and center-parted"],
    carry: { key: "casting-v2/library/hair.png" },
  };

  it("REPRODUCES THE DEFECT'S INPUT and no longer says the absence", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [vacantGlasses, hair],
      asks: [{ slot: "glasses", noun: "glasses", words: "glasses" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    /* Asserted on the OUTGOING prompt — the wire is where the contradiction
       was, so the wire is where it has to be gone from. */
    expect(recipe.prompt).not.toContain(GONE_VERBATIM);
    expect(recipe.prompt).not.toContain("no glasses");
    expect(recipe.ask).toBe("Change only the glasses: glasses.");
    /* And the record agrees with the wire: the stack is the new answer alone. */
    expect(recipe.wordStacks.get("glasses")).toEqual(["glasses"]);
    expect(recipe.edited).toEqual(["glasses"]);
    expect(recipe.vacated).toEqual([]);
  });

  it("CONTROL — the same library and an UNRELATED ask still says the absence", () => {
    /*
      The half that must not break. A removal governs every later render on the
      branch: the master wears her glasses forever, so a recipe about her hair
      that goes quiet about them paints them back on (the one-frame removal,
      proved with pictures before the vacancy row existed). The stand-down is
      for the re-filled slot ONLY.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [vacantGlasses, hair, lips()],
      /* An ask on a slot whose crop is NOT in this fixture: editing `hair`
         here would refuse with `carriesItsOwnEdit`, because a feature's own
         crop never rides its own edit and this fixture hands hair one. The
         production caller strips it (`libraryWithoutEditedCrops`); the point
         of this control is the vacancy, so it edits somewhere else and lets
         the hair carry as it does on a real unrelated render. */
      asks: [{ slot: "lips", noun: "lips", words: "noticeably fuller" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain(GONE_VERBATIM);
    expect(recipe.standing.map((said) => said.slot)).toContain("glasses");
  });

  it("CONTROL — a NON-vacant slot's words still accumulate, so nothing else was loosened", () => {
    /* D-244 line 2: the stack is the whole state and a delta appends to it. The
       stand-down keys on `vacant`, and this proves it keys on nothing wider —
       an ordinary second ask on a described slot keeps what came before. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [lips()],
      asks: [{ slot: "lips", noun: "lips", words: "noticeably fuller" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.wordStacks.get("lips")).toEqual(["a soft nude lip gloss", "noticeably fuller"]);
  });

  it("CONTROL — a bare STRIKE against a vacancy still refuses, so the door is narrow", () => {
    /*
      The stand-down arms only when the ask SAYS something, and this drives the
      other branch of that condition: with no words the vacancy's own words are
      still the stack, so the strike lands on them and empties it. A slot that
      would regenerate from the master with nothing said is a revert wearing an
      edit's clothes — `emptyWordStack`, the refusal that was already there.
      Either way it refuses; what matters is that the stand-down did not quietly
      turn "take off what is already off" into a legal render.
    */
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [vacantGlasses],
      asks: [{ slot: "glasses", noun: "glasses", remove: [GONE_VERBATIM] }],
    });

    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("emptyWordStack");
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

/*
  A CLAUSE WITH NO SLOT BEHIND IT (fable-446).

  `expression` has no slot by decision (D-136), no zone to cut and nothing to
  carry, so it reaches exactly one place: the change sentence. The invariants
  that keep the library honest — edited, carried, vacated, the word stacks —
  must not be able to see it, and that is what these assert.
*/
describe("a presentation clause is said and filed nowhere", () => {
  it("rides the change sentence in her own words", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [], asks: [],
      presentation: [{ noun: "expression", words: "a soft, closed-mouth smile" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    /* The possessive comes from HERE, as it does for every anatomy clause —
       a caller that shipped "her expression" would be that decision made
       twice, and it would be wrong on the first male cast. */
    expect(recipe.ask).toBe("Change only her expression: a soft, closed-mouth smile.");
    expect(recipe.prompt).toContain("her expression: a soft, closed-mouth smile");
    /* And nothing is filed. No slot means no mint, no crop, no carry, and no
       row a follow could inherit a smile from. */
    expect(recipe.edited).toEqual([]);
    expect(recipe.carried).toEqual([]);
    expect(recipe.vacated).toEqual([]);
    expect(Array.from(recipe.wordStacks.keys())).toEqual([]);
  });

  it("rides in the SAME breath as the features that changed", () => {
    /* One small ask, not a paragraph (§3.0a) — the rule the vacate phrase
       already obeys. A second sentence about her face would be a second
       instruction, which this assembler refuses everywhere else. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "hair", noun: "hair", words: "a copper crop" }],
      presentation: [{ noun: "expression", words: "a wide, open smile" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.ask).toBe("Change only her hair: a copper crop; her expression: a wide, open smile.");
    expect(recipe.edited).toEqual(["hair"]);
  });

  it("REFUSES a clause with nothing to say rather than dropping it", () => {
    /* `Change only her expression: .` is a paid render told to change
       something into nothing, and a silent drop is the same render with no
       trace of what went missing — the dropped-ask class this road exists to
       close. */
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [], asks: [],
      presentation: [{ noun: "expression", words: "   " }],
    });

    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("presentationSaysNothing");
    expect(refusal.slot).toBeNull();
  });

  it("CONTROL — a recipe with no presentation clause is byte-identical to before", () => {
    const withOut = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "hair", noun: "hair", words: "a copper crop" }],
    });
    const empty = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "hair", noun: "hair", words: "a copper crop" }],
      presentation: [],
    });

    expect(withOut.ok && empty.ok).toBe(true);
    if (!withOut.ok || !empty.ok) return;
    expect(withOut.prompt).toBe(empty.prompt);
    expect(withOut.ask).toBe("Change only her hair: a copper crop.");
  });
});

/**
 * SAYING THE SIDE BOTH WAYS — dark behind `CASTING_SIDE_PHRASING`.
 *
 * A court of twelve renders put a per-side eye edit on the named eye 6/6 when
 * the side was her LEFT (the image's right) and 3/6 when it was her RIGHT (the
 * image's left), the misses all landing on the image's right half whatever the
 * recipe named. That reads as a positional bias rather than a naming confusion,
 * so the experiment is to say the side both ways and let the anatomy and the
 * half of the picture agree.
 *
 * Off — which is every environment until its own court runs — not one character
 * of the sentence moves.
 */
describe("where that side is in the picture", () => {
  /* The flag is the CALLER's, not this function's — `placeSides` arrives the
     same way `pronouns` does, so the arms set it rather than an environment. */

  it("says nothing extra while it is dark", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [],
      asks: [{ slot: "eye@right", noun: "right eye", words: "fiery red" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.ask).toBe("Change only her right eye: fiery red.");
  });

  it("ARMED — names her side and the half of the picture it lives on", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, placeSides: true,
      library: [],
      asks: [{ slot: "eye@right", noun: "right eye", words: "fiery red" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.ask).toBe(
      "Change only her right eye (on the left of the picture as you look at it): fiery red.",
    );
  });

  it("ARMED — and the mirrored half, because her left is the viewer's right", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, placeSides: true,
      library: [],
      asks: [{ slot: "eye@left", noun: "left eye", words: "fiery red" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.ask).toBe(
      "Change only her left eye (on the right of the picture as you look at it): fiery red.",
    );
  });

  it("ARMED — a feature with one instance is left alone", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, placeSides: true,
      library: [],
      asks: [{ slot: "hair", noun: "hair", words: "copper" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.ask).toBe("Change only her hair: copper.");
  });
});

/**
 * A DISTRIBUTED OPEN KIND RIDES AS TWO PICTURES AND IS SPOKEN OF ONCE
 * (the D1 wire; ruled fable-1002 §2/§3 on the measurement in opus-737 §3).
 *
 * # What was measured before this existed
 *
 * The wire files a distributed kind — wings — as two library rows, one per
 * side, because one crop cannot honestly hold two things on opposite sides of a
 * body. Driven straight through this assembler, that produced:
 *
 *   Reference 2 is the exact wings she has — the same wings, unchanged.
 *   Reference 3 is the exact wings she has — the same wings, unchanged.
 *   Keep her wings exactly: a black feathered wing.
 *   Keep her wings exactly: a black feathered wing.
 *
 * Two pictures each declaring itself THE wings, and the keep-sentence twice,
 * saying "a black feathered wing" — singular — about her wings. The earring
 * precedent does not save it: `earring@left` carries the noun *left earring*
 * from the catalogue, so its two sentences disambiguate. An open kind's noun is
 * the CUSTOMER'S word, identical on both rows, and no singular may be derived
 * from it.
 *
 * # The rule, and what it deliberately does not say
 *
 * The kind is named ONCE (working law 8, and the surface stays in the stylist's
 * ontology), both crops are attached, and the clause says they are two views of
 * one thing rather than two things. It says nothing about WHICH picture is which
 * side: a per-side claim in prose is the image-half-not-anatomy trap, the paint
 * has a measured bias toward the image's right, and on a CARRY the label is all
 * risk and no information — what the engine needs is that these are halves of
 * one feature.
 */
describe("a distributed open kind is two pictures and one sentence", () => {
  const wingRows = (left: string, right: string): LibraryEntry[] => ([
    {
      slot: "open:wings@left" as never, tier: "anatomy", noun: "wings",
      words: [left], carry: { key: "lib/wings-left.png" },
    },
    {
      slot: "open:wings@right" as never, tier: "anatomy", noun: "wings",
      words: [right], carry: { key: "lib/wings-right.png" },
    },
  ]);

  const recipeFor = (rows: LibraryEntry[]) => assembleRecipe({
    master: MASTER, pronouns: SHE,
    library: rows,
    asks: [{ slot: "hair", noun: "hair", words: "coloured copper" }],
  });

  it("names the kind ONCE across both references, and attaches both crops", () => {
    const recipe = recipeFor(wingRows("a black feathered wing", "a black feathered wing"));

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    /* BOTH pictures are on the wire — the point of filing per side at all. */
    expect(recipe.references.map((reference) => reference.role)).toEqual([
      { kind: "master" },
      { kind: "carry", slot: "open:wings@left" },
      { kind: "carry", slot: "open:wings@right" },
    ]);
    /* ONE naming clause, holding both ordinals. */
    expect(recipe.prompt).toContain(
      "References 2 and 3 are the exact wings she has, one picture of each side — the same wings, unchanged.",
    );
    /* And never the old form, which claimed each picture was the whole thing. */
    expect(recipe.prompt).not.toContain("Reference 2 is the exact wings");
    expect(recipe.prompt).not.toContain("Reference 3 is the exact wings");
  });

  it("says the keep-sentence ONCE, and DEDUPES identical words", () => {
    const recipe = recipeFor(wingRows("a black feathered wing", "a black feathered wing"));

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    /* The stylist's own word for a pair that agrees — earrings come in matching
       pairs, and this is that sentence for a kind nobody catalogued. */
    expect(recipe.prompt).toContain(
      "Keep her wings exactly: a black feathered wing, matching on both sides.",
    );
    expect(recipe.prompt.match(/Keep her wings exactly/g)).toHaveLength(1);
  });

  it("JOINS differing words without ever saying which side is which", () => {
    /*
      A mismatched pair is a FEATURE in the founder's own words, not a defect to
      reconcile — so the two readings are both said. What must not appear is a
      laterality word: the rows' side labels come from a mask, and a mask's side
      is not a fact the prose may assert.
    */
    const recipe = recipeFor(wingRows("a black feathered wing", "a silver-tipped wing"));

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain(
      "Keep her wings exactly: one side a black feathered wing, the other a silver-tipped wing.",
    );
    expect(recipe.prompt.match(/Keep her wings exactly/g)).toHaveLength(1);
    expect(recipe.prompt).not.toContain("her left");
    expect(recipe.prompt).not.toContain("her right");
  });

  it("leaves a SIDELESS open kind exactly as it was", () => {
    /*
      The inertness control. A single or co-located kind files one row under the
      sideless key and must read byte-for-byte as it did before this collapse
      existed — otherwise the fix is a change to every open kind wearing a
      distributed kind's clothes.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{
        slot: "open:halo" as never, tier: "anatomy", noun: "halo",
        words: ["a thin gold halo"], carry: { key: "lib/halo.png" },
      }],
      asks: [{ slot: "hair", noun: "hair", words: "coloured copper" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain("Reference 2 is the exact halo she has — the same halo, unchanged.");
    expect(recipe.prompt).toContain("Keep her halo exactly: a thin gold halo.");
  });

  it("still speaks once when only ONE side carries a crop", () => {
    /*
      The gate refuses a crop unless both sides answer, so a lone per-side ROW
      here is a library that holds one from an earlier render. It must not
      produce the plural clause — "References 2 and 3" naming one picture would
      be a sentence about a reference that does not exist.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{
        slot: "open:wings@left" as never, tier: "anatomy", noun: "wings",
        words: ["a black feathered wing"], carry: { key: "lib/wings-left.png" },
      }],
      asks: [{ slot: "hair", noun: "hair", words: "coloured copper" }],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain("Reference 2 is the exact wings she has — the same wings, unchanged.");
    expect(recipe.prompt.match(/Keep her wings exactly/g)).toHaveLength(1);
    expect(recipe.prompt).not.toContain("References 2 and 3");
  });
});

describe("the fourth role — a picture the CUSTOMER supplied (fable-1096)", () => {
  const CARRIER = { key: "casting-v2/reference-carrier/aa.png", sha: "c0ffee" };
  /* The scope is REQUIRED on a source (fable-1108 §2): a picture that says
     nothing about what it claims must not compile, so every fixture carries
     one. This is the style take's own sentence. */
  const SCOPE = "Take her hair from the reference: the cut. Do not take the colour from the reference — keep her own.";
  const source = {
    slot: "hair" as const, image: CARRIER, pictures: "hairOnRedactedForm" as const, scope: SCOPE,
  };

  it("rides with its ask, on an anatomy slot that has no anchor", () => {
    /*
      The whole point of the role: hair is anatomy, D-244 line 3 gives anatomy
      no anchor, and the anchor branch ends in `continue` — so a source placed
      after it would never ride with the one feature it was cut for.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "hair", noun: "hair", words: "a mid-length wavy cut" }],
      sources: [source],
    });

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references).toHaveLength(2);
    expect(recipe.references[1]!.role).toEqual({ kind: "source", slot: "hair" });
    expect(recipe.references[1]!.image).toBe(CARRIER);
    /* Anatomy still regenerates from the master: nothing became an anchor. */
    expect(recipe.references.some((one) => one.role.kind === "anchor")).toBe(false);
    expect(recipe.edited).toEqual(["hair"]);
  });

  /*
    THE SECOND MEMBER OF THE VOCABULARY (ruled fable-1137 §2d).

    A tattoo design cut out of the picture a customer supplied. Two things are
    asserted and the second is the one that matters: the sentence is HONEST
    about what the engine is looking at, and the member's NAME is the fence —
    `inkDesignOnTransparency` says what the object is, so a future
    `inkFromPhoto` would have to be written by a hand that could see it reading
    as the violation it would be.
  */
  it("describes an ink design as the artwork alone, on transparency", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "hair", noun: "hair", words: "a mid-length wavy cut" }],
      sources: [{
        slot: "hair" as const,
        image: CARRIER,
        pictures: "inkDesignOnTransparency" as const,
        /* The design was cut. `null` is a different answer and is refused one
           door up — see the `sourceNotExamined` arms below. */
        cutRoute: "cut" as const,
        scope: SCOPE,
      }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    const sentence = recipe.references[1]!.sentence;
    expect(sentence).toContain("Reference 2 is the tattoo design supplied for this edit");
    expect(sentence).toContain("the artwork alone on a transparent background");
    /* The grey form's own lesson, transplanted: naming the part that is NOT the
       instruction is what made the instruction land. */
    expect(sentence).toContain("NOT part of the instruction");
    /* AND IT SAYS NOTHING ABOUT THE PICTURE IT CAME FROM having a person in
       it, because it does not have one — the cutter counted. A sentence that
       mentioned a photograph would be describing an object the engine is not
       being shown. */
    expect(sentence).not.toContain("photograph");
    expect(recipe.sentences[1]).toBe(sentence);
    expect(recipe.prompt).toContain(sentence);

    /*
      AND IT SAYS WHAT A TATTOO IS ON SKIN — the clause this lane never had
      (fable-1179 §2a, landed per fable-1184 §3b). Everything asserted above
      describes the PICTURE; without this the only instruction about the RESULT
      is "reproduce that artwork", and reproduction of a drawing is a drawing —
      which is the frame he ruled a FAIL.
    */
    expect(sentence).toContain(inkRealismClause(SHE));
    expect(sentence).toContain(inkNotOnClothingClause(SHE));
  });

  it("says a HEALED tattoo in the CAST'S pronoun — a man is not called her", () => {
    /*
      The frame that bought this whole pass is a MAN with a tattoo on HIS neck,
      and the sign views' own version of this sentence hard-codes "her". Carrying
      that spelling into the lane that painted his failed frame would be making a
      known wart worse in the exact place it was found, so the clause takes the
      Cast's pronouns — and this arm is what stops a later edit from inlining a
      convenient "her" back into it.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: HE, library: [],
      asks: [{ slot: "hair", noun: "hair", words: "a mid-length wavy cut" }],
      sources: [{
        slot: "hair" as const,
        image: CARRIER,
        pictures: "inkDesignOnTransparency" as const,
        cutRoute: "cut" as const,
        scope: SCOPE,
      }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    const sentence = recipe.references[1]!.sentence;
    expect(sentence).toContain("HEALED tattoo");
    expect(sentence).toContain("Keep his own skin");
    expect(sentence).toContain("ink on his skin");
    expect(sentence).not.toContain("her skin");
  });

  it("gives the two members DIFFERENT sentences, not one with a noun swapped", () => {
    /*
      The negative control on the arm above. If a future edit collapsed the
      switch into one sentence with the noun interpolated, both members would
      still "describe honestly" and neither would be true — the grey-form
      clause on a transparent cutout is a lie about what is in the frame.
    */
    const of = (source: RecipeSource) => {
      const recipe = assembleRecipe({
        master: MASTER, pronouns: SHE, library: [],
        asks: [{ slot: "hair", noun: "hair", words: "a mid-length wavy cut" }],
        sources: [source],
      });
      expect(recipe.ok).toBe(true);
      return recipe.ok ? recipe.references[1]!.sentence : "";
    };
    const base = { slot: "hair" as const, image: CARRIER, scope: SCOPE };
    const hair = of({ ...base, pictures: "hairOnRedactedForm" });
    const ink = of({ ...base, pictures: "inkDesignOnTransparency", cutRoute: "cut" });
    expect(hair).not.toBe(ink);
    expect(hair).toContain("plain grey form");
    expect(ink).not.toContain("plain grey form");
    expect(ink).toContain("transparent background");
    expect(hair).not.toContain("transparent background");
  });

  it("is DESCRIBED HONESTLY, in the wording the scale court measured", () => {
    /*
      Not manners. The length arrived 2/2 with the grey form described and
      excluded from the instruction, and stayed short 2/2 on a plain cutout
      carrying the same length words — so the description is part of what
      worked, and a sentence calling this "only hair" would be lying to the
      engine about its own reference.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "hair", noun: "hair", words: "a mid-length wavy cut" }],
      sources: [source],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    const sentence = recipe.references[1]!.sentence;
    expect(sentence).toContain("Reference 2");
    expect(sentence).toContain("plain grey form");
    expect(sentence).toContain("NOT part of the instruction");
    expect(sentence).toContain("how long");
    /* The cast's pronouns, never the specimen's: "her hair", "on her". */
    expect(sentence).toContain("her hair");
    /* And the prompt the caller sends carries it, in the ordinal it occupies. */
    expect(recipe.sentences[1]).toBe(sentence);
    expect(recipe.prompt).toContain(sentence);
  });

  /*
    THE SCOPE RIDES WITH THE PICTURE — the half that was missing.

    A crop cannot scope itself: a picture of a haircut is a picture of a haircut
    in some colour whether anybody asked for the colour or not. The description
    says what the picture IS; this says what it may GIVE her, and the recipe is
    the only place the engine hears either.
  */
  it("SPLICES WHAT THE PICTURE MAY GIVE HER, after the description that delivered", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "hair", noun: "hair", words: "a mid-length wavy cut" }],
      sources: [source],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    const sentence = recipe.references[1]!.sentence;
    /* Order matters and is asserted: the proven scale wording first, the scope
       appended to it — one sentence, not a replacement. */
    expect(sentence).toContain("Match that length and that shape");
    expect(sentence.indexOf("Match that length")).toBeLessThan(sentence.indexOf(SCOPE));
    expect(sentence.endsWith(SCOPE)).toBe(true);
    /* And it reaches the prompt the caller actually sends. */
    expect(recipe.prompt).toContain(SCOPE);
  });

  it("names the cast's own pronouns on a male cast", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: pronounsForSex("male"), library: [],
      asks: [{ slot: "hair", noun: "hair", words: "a mid-length wavy cut" }],
      /*
        THE SCOPE'S PRONOUNS ARE THE COMPOSER'S, NOT THIS MODULE'S — so a male
        cast's fixture carries a male cast's sentence, which is what
        `hairTakeSentence` hands the service. This arm caught the shared fixture
        the day the scope was wired: a `her`-worded scope spliced in front of a
        male face reddened it, which is the whole reason it was written.
      */
      sources: [{ ...source, scope: "Take his hair from the reference: the cut. Do not take the colour from the reference — keep his own." }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references[1]!.sentence).toContain("his hair");
    expect(recipe.references[1]!.sentence).not.toContain("her ");
  });

  it("REFUSES a picture attached to a slot this render says nothing about", () => {
    /* A reference no sentence accounts for is one the painter may read as
       anything — and dropping it silently is the confession class one layer too
       late to say anything about. */
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "lips", noun: "lips", words: "a soft nude lip gloss" }],
      sources: [source],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("sourceNotAsked");
    expect(refusal.slot).toBe("hair");
  });

  it("REFUSES a slot given both a source and an anchor — one slot, one reference", () => {
    const refusal = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [{
        slot: "hair", tier: "anatomy", noun: "hair", words: ["a mid-length wavy cut"],
        anchor: { key: "mint/hair-anchor.png" },
      }],
      asks: [{ slot: "hair", words: "a mid-length wavy cut" }],
      sources: [source],
    });
    expect(refusal.ok).toBe(false);
    if (refusal.ok) return;
    expect(refusal.reason).toBe("slotTwiceReferenced");
  });

  it("changes NOTHING when no source is passed — the road every render travels", () => {
    /* Additive by construction: the absent case must be byte-identical to what
       this assembler produced before the role existed. */
    const withNone = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "hair", noun: "hair", words: "a mid-length wavy cut" }],
    });
    const withEmpty = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "hair", noun: "hair", words: "a mid-length wavy cut" }],
      sources: [],
    });
    expect(withNone.ok && withEmpty.ok).toBe(true);
    if (!withNone.ok || !withEmpty.ok) return;
    expect(withEmpty.prompt).toBe(withNone.prompt);
    expect(withEmpty.references).toEqual(withNone.references);
  });

  it("carries a source AND a carried crop in one render, in send order", () => {
    /* The source belongs to the edited slot; an untouched slot still carries
       its own minted crop, and the ordinals in the sentences must be the
       ordinals in the array that goes out. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: SHE,
      library: [lips({ carry: { key: "mint/lips.png" } })],
      asks: [{ slot: "hair", noun: "hair", words: "a mid-length wavy cut" }],
      sources: [source],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references.map((one) => one.role.kind)).toEqual(["master", "source", "carry"]);
    expect(recipe.references[2]!.sentence).toContain("Reference 3");
    expect(recipe.carried).toEqual(["lips"]);
  });
});

/*
  A DESIGN NOBODY HAS LOOKED AT NEVER RIDES TO A RENDER (ruled fable-1137 §4).

  `cutRoute` has three answers and the third is the one this exists for: `cut`,
  `rideWhole`, and `null` — NOBODY LOOKED, because `CASTING_INK_CUT_SCOPE` was
  off for that account when the row was written. On this road unexamined means
  possibly a photograph of a person, which is the exposure the cutter exists to
  close, and every row stored before the flag flips holds unexamined bytes.

  So the hole is not hypothetical: it is the exact set of rows the flag's
  off-period created, and `null` is every row's state today.
*/
describe("an ink design rides only after somebody has looked at it", () => {
  const CARRIER = { key: "casting-v2/reference-carrier/ink.png", sha: "c0ffee" };
  const SCOPE = inkTakeSentence(SHE);
  const inkSource = (cutRoute: "cut" | "rideWhole" | null): RecipeSource => ({
    slot: "hair",
    image: CARRIER,
    pictures: "inkDesignOnTransparency",
    cutRoute,
    scope: SCOPE,
  });

  const withSource = (cutRoute: "cut" | "rideWhole" | null) => assembleRecipe({
    master: MASTER, pronouns: SHE, library: [],
    asks: [{ slot: "hair", noun: "hair", words: "a mid-length wavy cut" }],
    sources: [inkSource(cutRoute)],
  });

  it("REFUSES a planted null — the state every row is in today", () => {
    const result = withSource(null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("sourceNotExamined");
    expect(result.slot).toBe("hair");
    /* Named, never silent. A skip would paint the ask without the design and
       charge for it, which is the confession class one door along. */
    expect(result.detail).toContain("has not been through the cutter");
  });

  it("takes BOTH real answers — the refusal is about nobody looking", () => {
    /*
      The negative control, and it is the half that would be missing if this
      were written as "ink needs the flag on". `rideWhole` means the cutter DID
      look and the picture was already the design; refusing it would turn a
      finished examination into a wall.
    */
    for (const route of ["cut", "rideWhole"] as const) {
      const result = withSource(route);
      expect(result.ok, route).toBe(true);
    }
  });

  it("says nothing about a hair source, which has no such column", () => {
    /* The other arm of the same control: a refusal that fired on every source
       would pass the first test and take the hair road down with it. */
    const result = assembleRecipe({
      master: MASTER, pronouns: SHE, library: [],
      asks: [{ slot: "hair", noun: "hair", words: "a mid-length wavy cut" }],
      sources: [{ slot: "hair", image: CARRIER, pictures: "hairOnRedactedForm", scope: SCOPE }],
    });
    expect(result.ok).toBe(true);
  });
});

/*
  WHAT THE DESIGN PICTURE MAY GIVE HER — shape (e), at the WIRE.

  The hair road's discipline transplanted, and the failing case is the one named
  when the shape was countersigned: a composed outgoing prompt that describes
  her SKIN from the reference. A crop cannot scope itself — even after the
  cutter, artwork carries the tone of the skin it was photographed on at its own
  edges, and a `rideWhole` design was never cut at all.

  Asserted on `recipe.prompt` rather than on the sentence in isolation, because
  the contract is about what gets SENT (working law 5).
*/
describe("the sentence riding with a design claims the artwork and nothing of her", () => {
  const CARRIER = { key: "casting-v2/reference-carrier/ink.png", sha: "c0ffee" };
  const promptWith = (pronouns: typeof SHE) => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns, library: [],
      asks: [{ slot: "hair", noun: "hair", words: "a mid-length wavy cut" }],
      sources: [{
        slot: "hair",
        image: CARRIER,
        pictures: "inkDesignOnTransparency",
        cutRoute: "cut",
        scope: inkTakeSentence(pronouns),
      }],
    });
    expect(recipe.ok).toBe(true);
    return recipe.ok ? recipe.prompt : "";
  };

  it("claims the artwork, in the outgoing prompt", () => {
    const prompt = promptWith(SHE);
    expect(prompt).toContain("Take the tattoo design from the reference");
    expect(prompt).toContain("its shapes, its lines and its colours");
  });

  it("disclaims her skin, in the outgoing prompt — the failing case", () => {
    const prompt = promptWith(SHE);
    expect(prompt).toContain("Do not take skin, skin tone, body shape, pose or lighting");
    expect(prompt).toContain("keep her own");
  });

  it("says it in front of HIS face too", () => {
    /* `castPronouns` exists because this product once called a male
       candidate's eyes "hers" on his own sheet. */
    const prompt = promptWith(pronounsForSex("male"));
    expect(prompt).toContain("keep his own");
    expect(prompt).not.toContain("keep her own");
  });

  it("names no side — that phrase has one owner and it is not this one", () => {
    /* `sidePhrasing.imageHalfClause` writes "which side as you look at it",
       reached through the slot's own instance. A second speller here is the
       drift that phrase exists to prevent, and the thing that would drift is
       the difference between her left and the picture's left. */
    const sentence = inkTakeSentence(SHE);
    expect(sentence).not.toContain("left");
    expect(sentence).not.toContain("right");
    expect(sentence).not.toContain("as you look at it");
  });
});

/*
  A DELIVERED TATTOO SURVIVES THE NEXT EDIT — the ink carry (clause (a), ruled
  fable-1165 §2a and fable-1166 §1).

  The hole this closes was read off the WIRE, not reasoned about (opus-864 §1):
  step one painted a chest piece and step two — *"give him green eyes"* — went
  out carrying the master and a hair crop. No ink reference, no ink clause. Ink
  never enters the library (fable-1137 §3), so nothing in the recipe put the
  design back, and the tattoo the customer had paid for was gone one edit later.

  Driven straight at the assembler with planted designs, never through the
  service that usually behaves (working law 3).
*/
describe("a design she already has rides the renders that are not about it", () => {
  const DESIGN = { key: "casting-v2/ink/design.png", sha: "962fe3fda823" };
  type ArtworkCarry = Extract<CarriedInkDesign, { picture: "designArtwork" }>;
  const carriedInk = (over: Partial<ArtworkCarry> = {}): CarriedInkDesign => ({
    slot: "ink:upperChest",
    image: DESIGN,
    picture: "designArtwork",
    cutRoute: "rideWhole",
    noun: "upper chest tattoo",
    ...over,
  });
  /* The ordinary second edit: an unrelated ask, nothing about ink in the
     sentence, and no picture attached. The shape of every carry failure. */
  const secondEdit = (over: Partial<Parameters<typeof assembleRecipe>[0]> = {}) => assembleRecipe({
    master: MASTER, pronouns: pronounsForSex("male"), library: [],
    asks: [{ slot: "eye@left", noun: "left eye", words: "green" }],
    carriedInk: [carriedInk()],
    ...over,
  });

  it("sends the design as a reference on a render that never mentions ink", () => {
    const recipe = secondEdit();
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references.map((one) => one.role.kind)).toEqual(["master", "carry"]);
    expect(recipe.references[1]!.image).toBe(DESIGN);
    expect(recipe.references[1]!.role).toEqual({ kind: "carry", slot: "ink:upperChest" });
  });

  it("counts it as CARRIED, so the verification has a question about it", () => {
    /* `carried` is the column the verification reads — every slot this render
       PROMISES to hold. A picture riding uncounted would be delivered
       unverified on exactly the fact the carry exists to keep. */
    const recipe = secondEdit();
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.carried).toEqual(["ink:upperChest"]);
    expect(recipe.edited).toEqual(["eye@left"]);
  });

  it("says what the picture IS and that it is already there — at the wire", () => {
    /*
      Asserted on `recipe.prompt` rather than on the sentence beside it, because
      the contract is about what gets SENT (working law 5).

      Two halves and both are load-bearing: the transparent background is the
      grey form's own lesson on a different picture (describing what is NOT the
      instruction is part of what made the instruction land), and "already has"
      is the whole difference between a carry and an edit — a tattoo the recipe
      merely names is one the engine may redraw somewhere else at some other
      size.
    */
    const recipe = secondEdit();
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain("the exact upper chest tattoo he already has");
    expect(recipe.prompt).toContain("artwork alone on a transparent background");
    expect(recipe.prompt).toContain("NOT part of the instruction");
    expect(recipe.prompt).toContain("keep it exactly as it is, in the same place and at the same size");
    /*
      AND THE THIRD HALF, which this sentence went without until 2026-08-20:
      "keep it exactly" is about the DESIGN and never about the material. Said
      alone it is the decal instruction, and a CARRIED tattoo re-drawn as
      reproduced artwork is the same defect as a fresh one — the carry frame
      passed his eye, but it passed it holding a tattoo drawn by the same lane
      that failed the other one.
    */
    expect(recipe.prompt).toContain(inkRealismClause(HE));
    expect(recipe.prompt).toContain(inkNotOnClothingClause(HE));
  });

  it("says it in front of HER face too", () => {
    /* One product, two pronouns. `segmentsOnFace` shipped "hers" onto a male
       candidate before pronouns were passed rather than guessed. */
    const recipe = secondEdit({ pronouns: SHE });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain("She already has this tattoo");
    expect(recipe.prompt).not.toContain("He already has");
  });

  it("takes its ordinal from the array that actually goes out", () => {
    /* The reference the sentence names must be the reference at that index.
       A carry riding behind a library crop moves, and a hardcoded ordinal is
       how "reference 2 is her hair" comes to point at a tattoo. */
    const recipe = secondEdit({ library: [lips({ carry: { key: "mint/lips.png" } })] });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references.map((one) => one.role.kind)).toEqual(["master", "carry", "carry"]);
    expect(recipe.references[2]!.role).toEqual({ kind: "carry", slot: "ink:upperChest" });
    expect(recipe.references[2]!.sentence).toContain("Reference 3");
    expect(recipe.carried).toEqual(["lips", "ink:upperChest"]);
  });

  it("carries nothing when nothing is applied — every render before today", () => {
    /* The negative control. An arm that only ever ran with a design planted
       could not tell this feature from one that fires on every render. */
    const recipe = secondEdit({ carriedInk: [] });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references).toHaveLength(1);
    expect(recipe.carried).toEqual([]);
    expect(recipe.prompt).not.toContain("tattoo");
  });

  it("REFUSES a design nobody has looked at — the carry is a render too", () => {
    /*
      fable-1137 §4 on the other road. `null` is the recorded fact that
      `CASTING_INK_CUT_SCOPE` was off when those bytes were stored, so what sits
      at the key is the picture the customer uploaded rather than the design cut
      out of it — possibly a photograph of a person. A fence that held on the
      source road and not this one would be the same exposure with a carry's
      alibi.
    */
    const recipe = secondEdit({ carriedInk: [carriedInk({ cutRoute: null })] });
    expect(recipe.ok).toBe(false);
    if (recipe.ok) return;
    expect(recipe.reason).toBe("sourceNotExamined");
    expect(recipe.slot).toBe("ink:upperChest");
    expect(recipe.detail).toContain("has not been through the cutter");
  });

  it("takes BOTH real answers — the refusal is about nobody looking", () => {
    /* The negative control for the arm above: `rideWhole` means the cutter DID
       look and the picture was already the design. */
    for (const route of ["cut", "rideWhole"] as const) {
      const recipe = secondEdit({ carriedInk: [carriedInk({ cutRoute: route })] });
      expect(recipe.ok, route).toBe(true);
    }
  });

  it("REFUSES to carry the design into its own edit", () => {
    /*
      D-244 line 2 on this road, and it is not theoretical: a render that edits
      the tattoo is handed the design as a SOURCE with the ask's own words.
      Carrying it as well would send one picture twice with two sentences —
      "keep it exactly as it is" beside "change it to this" — dispatched at full
      price.
    */
    const recipe = secondEdit({
      asks: [{ slot: "ink:upperChest", noun: "upper chest tattoo", words: "a fine-line dinosaur skeleton" }],
    });
    expect(recipe.ok).toBe(false);
    if (recipe.ok) return;
    expect(recipe.reason).toBe("carriesItsOwnEdit");
    expect(recipe.slot).toBe("ink:upperChest");
  });

  it("REFUSES a carry whose slot is not an ink slot", () => {
    /* `FeatureSlot` is a string, so `hair` type-checks. The sentence says
       "tattoo design"; saying that about a hair crop is the scale court's lie
       with the roles swapped. */
    const recipe = secondEdit({ carriedInk: [carriedInk({ slot: "hair" })] });
    expect(recipe.ok).toBe(false);
    if (recipe.ok) return;
    expect(recipe.reason).toBe("inkCarryNotInkSlot");
    expect(recipe.slot).toBe("hair");
  });

  it("REFUSES a noun that brought its own determiner", () => {
    /* Every template here supplies the determiner, and a possessive REPLACES an
       article rather than queueing behind it — "her a mullet" was live in real
       data. The library rows are checked for this and so is a design. */
    const recipe = secondEdit({ carriedInk: [carriedInk({ noun: "the upper chest tattoo" })] });
    expect(recipe.ok).toBe(false);
    if (recipe.ok) return;
    expect(recipe.reason).toBe("nounNotBare");
  });

  it("REFUSES two references for one design slot", () => {
    const recipe = secondEdit({ carriedInk: [carriedInk(), carriedInk()] });
    expect(recipe.ok).toBe(false);
    if (recipe.ok) return;
    expect(recipe.reason).toBe("slotTwiceReferenced");
  });

  it("carries two designs at two placements", () => {
    /* A Cast may hold eight. Two applied at different places is one render
       carrying two pictures, and each says its own place. */
    const recipe = secondEdit({
      carriedInk: [
        carriedInk(),
        carriedInk({ slot: "ink:upperArm@left", noun: "left upper arm tattoo" }),
      ],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.carried).toEqual(["ink:upperChest", "ink:upperArm@left"]);
    expect(recipe.prompt).toContain("the exact upper chest tattoo he already has");
    expect(recipe.prompt).toContain("the exact left upper arm tattoo he already has");
  });
});

/*
  THE LANE WITH NO PICTURE IS TOLD WHAT A TATTOO IS TOO (ordered fable-1180 §1,
  countersigned fable-1190 §1).

  fable-1184 §3b landed the realism language in the repaint recipe's ink
  SENTENCES — fresh and carry — and both of those are reference lanes. A
  words-only ink ask reaches neither: it goes through `askSentence`, and the
  whole of what it told the painter was *"Change only his neck tattoo: a small
  geometric skeleton design."*

  That was read at the WIRE before it was fixed, in both trees, and the two
  prompts were identical digest for digest — which is why the court's own
  words-only arm was struck as a null arm before a credit was spent on it.

  Every assertion here is on `recipe.prompt` rather than on a sentence in
  isolation: the contract is about what gets SENT (working law 5).
*/
describe("a words-only ink ask is told what a tattoo is on skin", () => {
  const wordsOnly = (pronouns = HE, over: Partial<Parameters<typeof assembleRecipe>[0]> = {}) =>
    assembleRecipe({
      master: MASTER, pronouns, library: [],
      asks: [{ slot: "ink:neck", noun: "neck tattoo", words: "a small geometric skeleton design" }],
      ...over,
    });

  it("carries the realism clause and the clothing rule, in the CAST'S pronoun", () => {
    const recipe = wordsOnly();
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain(inkRealismClause(HE));
    expect(recipe.prompt).toContain(inkNotOnClothingClause(HE));
    /* A man is not called her — the same wart named in `283a0f37`, one lane on. */
    expect(recipe.prompt).toContain("Keep his own skin");
    expect(recipe.prompt).not.toContain("her skin");
  });

  /*
    AND WHAT THE STYLE SHE NAMED LOOKS LIKE — at the wire (fable-1313 §2).

    His specimen is the reason: a cybersigilism neck tattoo rendered as circuit
    traces, because the engine reads the word the way the word looks. Asserted
    on `recipe.prompt` rather than on the clause beside it, because a glossary
    that composes correctly and never reaches the request is the inert-control
    shape this program keeps paying for.
  */
  it("carries the STYLE clause, and its refusal, when she names a style", () => {
    const recipe = wordsOnly(HE, {
      asks: [{ slot: "ink:neck", noun: "neck tattoo", words: "a cybersigilism piece" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain("ultra-fine spiky ornamental linework");
    expect(recipe.prompt).toContain("NOT circuitry");
    /* Beside the realism clauses, never instead of them. */
    expect(recipe.prompt).toContain(inkRealismClause(HE));
  });

  it("is INERT for an ink ask that names no style — byte for byte", () => {
    /*
      The control that lets this be consulted on every ink road: an ask with no
      style word must compose exactly the prompt it composed before the glossary
      existed. Driven as a DIFFERENCE between two asks rather than as an
      absence, so it cannot pass by the clause never working at all.
    */
    const plain = wordsOnly(HE, {
      asks: [{ slot: "ink:neck", noun: "neck tattoo", words: "a small swallow" }],
    });
    const styled = wordsOnly(HE, {
      asks: [{ slot: "ink:neck", noun: "neck tattoo", words: "a small cybersigilism swallow" }],
    });
    expect(plain.ok && styled.ok).toBe(true);
    if (!plain.ok || !styled.ok) return;
    expect(plain.prompt).not.toContain("The style named is");
    expect(styled.prompt).toContain("The style named is");
    /* The ONLY difference is the style clause — everything else is untouched. */
    expect(styled.prompt.replace(/The style named is [^]*?technology or machinery\. /, ""))
      .toBe(plain.prompt.replace("a small swallow", "a small cybersigilism swallow"));
  });

  it("says it AFTER the ask, so \"it\" has the tattoo as its antecedent", () => {
    const recipe = wordsOnly();
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    /* Not a formatting preference. In front of the ask, "Draw IT as a HEALED
       tattoo" points at nothing the prompt has named yet. */
    expect(recipe.prompt.indexOf("Change only")).toBeLessThan(recipe.prompt.indexOf("HEALED tattoo"));
  });

  it("is NOT folded into the \"Change only\" clause — the small-ask rule holds", () => {
    const recipe = wordsOnly();
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    /* §3.0a: the ask clause is one phrase per feature. A caller cannot paste a
       paragraph into a frame it does not own, and neither can this. */
    expect(recipe.ask).toBe("Change only his neck tattoo: a small geometric skeleton design.");
  });

  it("SAYS NOTHING on an ask that is not about ink — the negative control", () => {
    /*
      The half that would be missing if this were written as "append the clause".
      A sentence that lands on every render is a different change from the one
      that was asked for, and it would be invisible in the arm above.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: HE, library: [],
      asks: [{ slot: "hair", noun: "hair", words: "a mid-length wavy cut" }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).not.toContain("HEALED tattoo");
    expect(recipe.prompt).not.toContain("never printed, embroidered");
  });

  it("says it ONCE for two ink asks (fable-332)", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: HE, library: [],
      asks: [
        { slot: "ink:neck", noun: "neck tattoo", words: "a small geometric skeleton design" },
        { slot: "ink:upperChest", noun: "upper chest tattoo", words: "a compass rose" },
      ],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt.split("HEALED tattoo")).toHaveLength(2);
    expect(recipe.prompt.split("never printed, embroidered")).toHaveLength(2);
  });

  it("does NOT say it a second time when the ask HAS a design — the exactness", () => {
    /*
      THE ARM THAT MADE THE CONDITION "no source" RATHER THAN "an ink ask".

      `refineService` takes an ink source's slot FROM THE ASK LIST, so on the
      reference lane there is always an ink ask — and its reference sentence
      already carries both clauses. Appended again here it would be the same
      instruction twice in one prompt, which is what this assembler refuses
      everywhere else.
    */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: HE, library: [],
      asks: [{ slot: "ink:neck", noun: "neck tattoo", words: "a small geometric skeleton design" }],
      sources: [{
        slot: "ink:neck",
        image: { key: "casting-v2/reference-carrier/ink.png", sha: "c0ffee" },
        pictures: "inkDesignOnTransparency",
        cutRoute: "cut",
        scope: inkTakeSentence(HE),
      }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain(inkRealismClause(HE));
    expect(recipe.prompt.split("HEALED tattoo")).toHaveLength(2);
    expect(recipe.prompt.split("never printed, embroidered")).toHaveLength(2);
  });

  it("says nothing on a REMOVAL — there is no tattoo being drawn", () => {
    /* Telling the painter how to draw ink in the same breath as taking some off
       is an instruction about nothing. */
    const recipe = assembleRecipe({
      master: MASTER, pronouns: HE, library: [],
      asks: [{ slot: "ink:neck", noun: "neck tattoo", vacate: { says: "no tattoo on his neck — bare skin" } }],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).not.toContain("HEALED tattoo");
  });
});

/*
  THE TATTOO AS IT LANDED ON HER — clause (a), ruled fable-1193 §3 and
  countersigned fable-1194 §2.

  # What this replaces, and the measurement is why

  A `describe` block stood here for the BOUNDARY CLAUSE (`8f0515d2`) — the carry
  lane's edge said as a place, *"Its edge is where his clothing begins"*. It was
  courted on the carry pair and it did not work: `490` had it on the wire in
  full and drew the design a third of the way down a white T-shirt, exactly as
  `485` (no realism language) and `487` (the clothing prohibition in full) had.
  Three clauses, three shirts.

  So the clause is REVERTED and this is its replacement — not a fourth sentence
  but the same instruction pointed at a picture that finally contains the size:
  a crop of the frame that delivered the tattoo, which holds his own skin, the
  ink at its delivered scale, and the collar's own edge at the bottom of it.

  # The negative controls are the important half

  Two of them, and each guards a different way for this to go quietly wrong:
  the delivered sentence must NOT carry the fresh lane's skin disclaimer (the
  picture's skin is the FACT, not the hazard), and the reverted clause must be
  gone from every lane.
*/
describe("the carry rides the tattoo as it landed, not the artwork", () => {
  const DESIGN = { key: "casting-v2/ink/design.png", sha: "962fe3fda823" };
  const DELIVERED = { key: "casting-v2/ink-delivery/crop.png", sha: "5b1c04ffe210" };

  const carrying = (design: CarriedInkDesign) => assembleRecipe({
    master: MASTER, pronouns: HE, library: [],
    asks: [{ slot: "eye@left", noun: "left eye", words: "green" }],
    carriedInk: [design],
  });

  it("says whose skin the picture shows, and what the edge in it means", () => {
    const recipe = carrying({
      slot: "ink:upperChest", image: DELIVERED, picture: "deliveredCrop",
      noun: "upper chest tattoo",
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain(inkDeliveredCarrySentence(2, "upper chest tattoo", HE));
    /* The two facts the artwork could never supply. */
    expect(recipe.prompt).toContain("HIS OWN skin");
    expect(recipe.prompt).toContain("whatever edge you can see in it is the real edge");
    /* And it is still ink in skin rather than a reproduced drawing. */
    expect(recipe.prompt).toContain(inkRealismClause(HE));
    expect(recipe.prompt).toContain(inkNotOnClothingClause(HE));
  });

  it("NEGATIVE CONTROL: it does not carry the fresh lane's skin disclaimer", () => {
    /*
      fable-1194 §2a, as an arm rather than a note. `inkTakeSentence` tells the
      painter *"Do not take skin, skin tone, body shape, pose or lighting from
      the reference — keep his own"*, which is right about somebody else's
      artwork and FALSE about a crop of his own frame: the skin in that picture
      IS his own, and it is the reason the crop was minted. The two sentences
      may never share an instance, and this is what says so.
    */
    const recipe = carrying({
      slot: "ink:upperChest", image: DELIVERED, picture: "deliveredCrop",
      noun: "upper chest tattoo",
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).not.toContain("Do not take skin, skin tone, body shape, pose or lighting");
    /* Nor the artwork lane's own description, which would be a lie about these
       bytes: there is a body in this picture and it is hers. */
    expect(recipe.prompt).not.toContain("the artwork alone on a transparent background");
  });

  it("NEGATIVE CONTROL: the reverted boundary clause is gone from every lane", () => {
    const delivered = carrying({
      slot: "ink:upperChest", image: DELIVERED, picture: "deliveredCrop",
      noun: "upper chest tattoo",
    });
    const artwork = carrying({
      slot: "ink:upperChest", image: DESIGN, picture: "designArtwork",
      cutRoute: "rideWhole", noun: "upper chest tattoo",
    });
    const fresh = assembleRecipe({
      master: MASTER, pronouns: HE, library: [],
      asks: [{ slot: "ink:neck", noun: "neck tattoo", words: "a small geometric skeleton design" }],
    });
    for (const recipe of [delivered, artwork, fresh]) {
      expect(recipe.ok).toBe(true);
      if (!recipe.ok) return;
      expect(recipe.prompt).not.toContain("Its edge is where");
      expect(recipe.prompt).not.toContain("Do not enlarge, extend or complete the design");
    }
  });

  it("falls back to the artwork when no crop was ever kept", () => {
    /*
      Every Cast that predates 0049, and every delivery whose mint answered
      `no-cut`. The carry still happens — the tattoo does not vanish — it simply
      rides the road it drove yesterday, which is what makes the mint's failure
      survivable rather than a lost feature.
    */
    const recipe = carrying({
      slot: "ink:upperChest", image: DESIGN, picture: "designArtwork",
      cutRoute: "rideWhole", noun: "upper chest tattoo",
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.prompt).toContain("the artwork alone on a transparent background");
    expect(recipe.prompt).not.toContain("HIS OWN skin");
  });

  it("a delivered crop needs no cut route, and the artwork still does", () => {
    /*
      The fence is not weakened, it is pointed at the right object. A delivered
      crop is a cut of OUR render and carries none of her upload's bytes; an
      unexamined ARTWORK is still refused, on the carry road as on the source
      road, because nobody has looked at what is in that picture.
    */
    const delivered = carrying({
      slot: "ink:upperChest", image: DELIVERED, picture: "deliveredCrop",
      noun: "upper chest tattoo",
    });
    expect(delivered.ok).toBe(true);

    const unexamined = carrying({
      slot: "ink:upperChest", image: DESIGN, picture: "designArtwork",
      cutRoute: null, noun: "upper chest tattoo",
    });
    expect(unexamined.ok).toBe(false);
    if (unexamined.ok) return;
    expect(unexamined.reason).toBe("sourceNotExamined");
  });

  it("says it once per carried design, beside that design's own picture", () => {
    const recipe = assembleRecipe({
      master: MASTER, pronouns: HE, library: [],
      asks: [{ slot: "eye@left", noun: "left eye", words: "green" }],
      carriedInk: [
        {
          slot: "ink:upperChest", image: DELIVERED, picture: "deliveredCrop",
          noun: "upper chest tattoo",
        },
        { slot: "ink:neck", image: DELIVERED, picture: "deliveredCrop", noun: "neck tattoo" },
      ],
    });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    /* Two designs, two delivered sentences — each is a different picture of a
       different place on him, so neither may be said for both. */
    expect(recipe.prompt.split("whatever edge you can see in it")).toHaveLength(3);
    expect(recipe.references).toHaveLength(3);
  });
});
