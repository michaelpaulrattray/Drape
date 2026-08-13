import { describe, expect, it } from "vitest";

import { repaintAsksFor, repaintCannotRemove, type EditProse } from "./repaintAsks";
import { assembleRecipe } from "./recipeAssembler";
import type { CastPronouns } from "./castPronouns";

/**
 * The translation between the two vocabularies — the delta's imperative lane and
 * the recipe's declarative one.
 *
 * Every refusal here is proven by DRIVING it, and the positive cases are put
 * through the REAL assembler rather than compared against a shape: what has to
 * be true is that these asks build a recipe, not that they match a fixture the
 * assembler never sees. (opus-146 §4's discipline, one module along.)
 */

/* The prose object stands in for `EDIT_PROSE` with the same signature and
   recognisably different text, so a test that passed by accidentally
   reproducing production prose cannot. */
const prose: EditProse = {
  eyeColour: (value) => `iris prose for ${value}`,
  eyeShape: (value) => `shape prose for ${value}`,
  hairStyle: (value) => `a ${value} (family)`,
  hairColour: (value) => `colour prose for ${value}`,
  hairTexture: (value) => `texture prose for ${value}`,
};

const her: CastPronouns = {
  subject: "she", object: "her", possessive: "her", plural: false,
};

const master = { key: "casting-v2/candidates/master.png" };

function recipeFrom(asks: ReturnType<typeof repaintAsksFor>) {
  if (!asks.ok) throw new Error(`expected asks, got ${asks.reason}`);
  return assembleRecipe({ master, pronouns: her, library: [], asks: asks.asks });
}

describe("one step's delta becomes the recipe's asks", () => {
  it("says a free-lane ask as the user's own state, on the slot that owns it", () => {
    const result = repaintAsksFor({ delta: { free: { hairWorn: "hair down" } }, prose });

    expect(result).toEqual({
      ok: true,
      asks: [{ slot: "hair", noun: "hair", words: "hair down" }],
    });
  });

  it("THE DEGENERATE CASE: no library, words only — the master alone plus words", () => {
    /* fable-171 condition 1, and the road every new cast travels. It is the
       first fixture here for exactly that reason. */
    const recipe = recipeFrom(repaintAsksFor({
      delta: { free: { hairWorn: "hair down" } }, prose,
    }));

    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.references).toHaveLength(1);
    expect(recipe.references[0]!.role).toEqual({ kind: "master" });
    expect(recipe.references[0]!.image).toBe(master);
    expect(recipe.ask).toBe("Change only her hair: hair down.");
    expect(recipe.prompt).toContain("Reference 1 is the photograph of this person");
    expect(recipe.prompt).toContain("Change only her hair: hair down.");
  });

  it("says a guaranteed value through the SAME prose the prompt is composed with", () => {
    const result = repaintAsksFor({ delta: { hairColour: "copper" }, prose });

    expect(result).toEqual({
      ok: true,
      asks: [{ slot: "hair", noun: "hair", words: "coloured colour prose for copper" }],
    });
  });

  it("gives one slot ONE ask when a step writes two of its facets", () => {
    /* A cut and a colour in one breath are one visible thing. Two asks for one
       slot would be two instructions about one feature, and the assembler
       refuses a slot twice referenced anyway (fable-174). */
    const result = repaintAsksFor({
      delta: { hairStyle: "mullet", hairColour: "copper" }, prose,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks).toHaveLength(1);
    expect(result.asks[0]!.slot).toBe("hair");
    expect(result.asks[0]!.words)
      .toBe("cut into a mullet (family), coloured colour prose for copper");
  });

  it("gives a bilateral feature one ask per instance", () => {
    /* Stored as instances, spoken as pairs (fable-167). "Her eyes" is one
       sentence to the user and two slots to the recipe. */
    const result = repaintAsksFor({ delta: { eyeColour: "green" }, prose });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["eye@left", "eye@right"]);
    expect(result.asks.map((ask) => ask.noun)).toEqual(["left eye", "right eye"]);
    for (const ask of result.asks) expect(ask.words).toBe("green — iris prose for green");
  });

  it("narrows to ONE instance when she pointed at one, with the same words", () => {
    /*
      The founder's question — "how would i edit just the left or right eye?" —
      and the answer the per-eye court bought: 31 of 32 single-side paints
      landed on exactly the asked eye, zero on the wrong one, zero on both
      (opus-342). What the court changed was the SLOT LIST and nothing else, so
      this asserts both halves: one ask, and the identical sentence.
    */
    const both = repaintAsksFor({ delta: { eyeColour: "green" }, prose });
    const one = repaintAsksFor({ delta: { eyeColour: "green" }, prose, scope: "eye@left" });

    expect(one.ok).toBe(true);
    if (!one.ok || !both.ok) return;
    expect(one.asks.map((ask) => ask.slot)).toEqual(["eye@left"]);
    /* `eye@right` is not mentioned AT ALL — that absence is the feature. */
    expect(JSON.stringify(one.asks)).not.toContain("eye@right");
    /* Same wording as the unscoped ask: the narrowing may not become a second
       vocabulary, or the court measured a sentence this build does not send. */
    expect(one.asks[0]!.words).toBe(both.asks[0]!.words);
  });

  it("REFUSES rather than quietly painting the whole face when the scope names nothing this ask writes", () => {
    /*
      The door (fable-444 §3). A scope that falls through to a whole-face render
      is a both-eyes charge for a one-eye ask, and the picture would look like a
      correct render of a different question — which is exactly how this
      program's worst defects have looked.
    */
    const result = repaintAsksFor({ delta: { eyeColour: "green" }, prose, scope: "lips" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("notASlot");
    expect(result.facet).toBe("eye.colour");
  });

  it("leaves an unscoped ask exactly as it was", () => {
    /* The inert half: every render before the panel sends a scope. */
    const result = repaintAsksFor({ delta: { eyeColour: "green" }, prose, scope: undefined });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["eye@left", "eye@right"]);
  });

  it("takes an accessory's slot from the described OBJECT, never from the facet", () => {
    const result = repaintAsksFor({
      delta: { free: { statedAccessories: ["small gold hoops"] } },
      prose,
      accessoryKind: "earring",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["earring@left", "earring@right"]);
    for (const ask of result.asks) expect(ask.words).toBe("small gold hoops");
  });

  it("keeps a plural subject's whole set as the state", () => {
    /* A plural value is the COMPLETE current answer rather than an increment,
       so the state phrase is the whole list. */
    const result = repaintAsksFor({
      delta: { free: { marks: ["a scar on her cheek", "freckles across her nose"] } },
      prose,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks).toEqual([{
      slot: "skin",
      noun: "skin",
      words: "a scar on her cheek, freckles across her nose",
    }]);
  });
});

/**
 * A DEPARTURE IS A SLOT GOING VACANT (chunk 3, `LIBRARY_REMOVAL_DESIGN.md`).
 *
 * This described a refusal until today, and the refusal's reason was true of
 * the recipe as it then was: a departure has no state phrase to regenerate a
 * FEATURE from. There is one about the SITE, it lives in the placement table,
 * and the slot simply stops carrying.
 *
 * The specimen is the founder's own step 5 — *"remove her glasses"* — which
 * refused in 33.2 s and refunded on the shift-59 walk.
 */
describe("a departure vacates the slot and says so", () => {
  it("turns her own glasses leaving into a vacate ask that names the bare site", () => {
    const result = repaintAsksFor({
      delta: { free: { statedAccessories: [] }, absent: { statedAccessories: ["glasses"] } },
      prose,
      accessoryKind: "glasses",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks).toHaveLength(1);
    expect(result.asks[0]!.slot).toBe("glasses");
    /* The sentence comes from the catalogue, so it names the SITE rather than
       telling the reader what to conclude — and it carries no words. */
    expect(result.asks[0]!.vacate?.says).toContain("no glasses");
    expect(result.asks[0]!.vacate?.says).toContain("uncovered");
    expect(result.asks[0]!.words).toBeUndefined();
  });

  it("vacates BOTH lobes when a pair leaves, because a pair is two slots", () => {
    const result = repaintAsksFor({
      delta: { free: { statedAccessories: [] }, absent: { statedAccessories: ["gold hoop earrings"] } },
      prose,
      accessoryKind: "earring",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["earring@left", "earring@right"]);
    for (const ask of result.asks) expect(ask.vacate?.says).toContain("bare");
  });

  it("CONTROL — a departure of something the table cannot name still refuses", () => {
    /* The honest answer, and the same one the mint gives. An absence sentence
       improvised at the call site is the free-floating prose fable-195 ruled
       against, and the price of getting it wrong is a paid render that says
       something untrue about her face. */
    const result = repaintAsksFor({
      delta: { free: { statedAccessories: [] }, absent: { statedAccessories: ["her tiara"] } },
      prose,
      accessoryKind: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unnamedObject");
    expect(result.detail).toContain("tiara");
  });

  it("CONTROL — survivors are still stated, so a partial removal is not a vacate", () => {
    /* "Take the hoops off" against hoops AND glasses leaves the glasses on her,
       and the surviving item has to keep being said or the next render drops
       it. The empty-value skip above is narrow for exactly this reason. */
    const result = repaintAsksFor({
      delta: {
        free: { statedAccessories: ["thin wire glasses"] },
        absent: { statedAccessories: ["gold hoop earrings"] },
      },
      prose,
      accessoryKind: "glasses",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asks.map((ask) => ask.slot)).toEqual(["earring@left", "earring@right", "glasses"]);
    expect(result.asks.at(-1)!.words).toBe("thin wire glasses");
    expect(result.asks.at(-1)!.vacate).toBeUndefined();
  });
});

describe("what it refuses rather than paints", () => {

  it("refuses an ask whose facet has no slot, rather than dropping it", () => {
    /* THE DEFECT CLASS THIS EXISTS TO CLOSE. A dropped ask is a paid picture
       whose instruction never reached the painter — the hairWorn gate's own
       shape, arriving through the recipe instead of through the reader. */
    for (const [delta, facet] of [
      [{ makeup: "a red lip" }, "makeup"],
      [{ free: { expression: "a soft smile" } }, "expression"],
      [{ free: { ink: "a small swallow on her wrist" } }, "ink"],
    ] as const) {
      const result = repaintAsksFor({ delta, prose });
      expect(result.ok, facet).toBe(false);
      if (result.ok) continue;
      expect(result.reason, facet).toBe("notASlot");
      expect(result.facet, facet).toBe(facet);
    }
  });

  it("tells an unnamed worn object apart from a decided absence", () => {
    /* Same input facet, two different honest answers, and they must not wear
       each other's label: one is owed work on the placement table, the other is
       a ruling. */
    const result = repaintAsksFor({
      delta: { free: { statedAccessories: ["a lapel pin"] } },
      prose,
      accessoryKind: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unnamedObject");
    expect(result.facet).toBe("statedAccessories");
  });

  it("refuses a written facet with nothing to say about it", () => {
    const result = repaintAsksFor({ delta: { free: { lips: "  " } }, prose });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("noWords");
  });

  it("refuses a delta that writes nothing — an empty ask list is a charge for nothing", () => {
    /* The assembler would accept it: no asks is a legitimate pure-carry recipe,
       and it would paint, land and bill. This caller is the only layer that
       knows somebody typed a sentence and paid for it. */
    const result = repaintAsksFor({ delta: {}, prose });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("nothingAsked");

    /* The positive control on that claim: the assembler really does say yes. */
    const permissive = assembleRecipe({ master, pronouns: her, library: [], asks: [] });
    expect(permissive.ok).toBe(true);
  });

  it("names the removal it cannot yet express", () => {
    const refusal = repaintCannotRemove();
    expect(refusal.ok).toBe(false);
    expect(refusal.reason).toBe("removal");
    expect(refusal.detail).toContain("D-244");
  });
});

describe("the asks the assembler is actually handed", () => {
  it("builds a recipe rather than tripping the declarative-state contract", () => {
    /*
      Driven through the REAL assembler for opus-146 §4's reason: what has to be
      true is that these words BUILD A RECIPE, not that they match a pattern a
      copy of the assembler's regex would also match. `wordsNotDeclarative` is
      the specific thing at risk — every phrase here is composed by this module,
      and an imperative opener anywhere in it would refuse a paid render.
    */
    for (const delta of [
      { free: { hairWorn: "hair down" } },
      { hairColour: "copper" as const },
      { hairStyle: "mullet" },
      { eyeShape: "hooded" as const },
      { free: { statedAccessories: ["small gold hoops"] } },
      { free: { brows: "fuller, softly arched" } },
    ]) {
      const recipe = recipeFrom(repaintAsksFor({ delta, prose, accessoryKind: "earring" }));
      expect(recipe.ok, JSON.stringify(delta)).toBe(true);
      if (!recipe.ok) continue;
      expect(recipe.ask, JSON.stringify(delta)).toMatch(/^Change only /);
    }
  });

  it("carries a slot the library has never held, because the ask names it", () => {
    /* `slotNotNamed` is the assembler's refusal for a slot with no library entry
       and no noun on the ask. Supplying the catalogue's noun on every ask is what
       makes a first-ever edit of a feature expressible at all. */
    const asks = repaintAsksFor({ delta: { free: { nose: "a slightly narrower bridge" } }, prose });
    expect(asks.ok).toBe(true);
    if (!asks.ok) return;
    expect(asks.asks[0]!.noun).toBe("nose");

    const recipe = assembleRecipe({ master, pronouns: her, library: [], asks: asks.asks });
    expect(recipe.ok).toBe(true);
    if (!recipe.ok) return;
    expect(recipe.ask).toBe("Change only her nose: a slightly narrower bridge.");
  });
});
