/**
 * THE CATALOGUE'S TESTS — the ones that would fail if somebody made the table
 * convenient.
 *
 * Three defects are worth more than the rest here, and each has its own case:
 * a question that carries a laterality word (the segmenter ignores it and the
 * guard's second read agrees with the cut about the wrong ear), a question
 * invented rather than taken from a table that owns one, and a slot quietly
 * given the nearest bigger region so that it can mint something.
 *
 * The totality case is the cheap one and it is the one that catches the future:
 * a facet added to the refine vocabulary with no home here is a feature the
 * panel silently cannot show.
 */
import { describe, expect, it } from "vitest";

import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import { regionNameOf } from "./maskedRefine";
import { assembleRecipe } from "./recipeAssembler";
import {
  catalogueSlots,
  slotDefinition,
  slotSpecFor,
  FACET_SLOTS,
  SLOT_CATALOGUE,
} from "./referenceSlotCatalogue";
import { allFacets } from "./refineFacets";

const SHE = { subject: "she", object: "her", possessive: "her", plural: false } as const;

describe("what a slot is", () => {
  it("answers the mint's four questions for a slot that has a question of its own", () => {
    expect(slotDefinition("hair")).toEqual({
      slot: "hair",
      feature: "hair",
      instance: null,
      tier: "anatomy",
      group: "hair",
      noun: "hair",
      question: "hair",
      guardKind: "hair",
      frame: "wholeFrame",
    });
  });

  it("names an instance on its own side, and never in the question", () => {
    const left = slotDefinition("earring@left");
    expect(left).toMatchObject({
      slot: "earring@left",
      feature: "earring",
      instance: "left",
      tier: "item",
      group: "accessories",
      noun: "left earring",
      question: "earring",
      guardKind: "earring",
      frame: "ownSide",
    });
  });

  it("REFUSES rather than defaulting: an unknown slot, a ledger key, a side on a single feature", () => {
    expect(slotDefinition("cheekbones")).toBeNull();
    expect(slotDefinition("makeup@face skin")).toBeNull();
    expect(slotDefinition("hair@left")).toBeNull();
    /* A bilateral feature has no whole-face row: `eye` alone would be a slot
       whose crop is whichever eye the segmenter named. */
    expect(slotDefinition("eye")).toBeNull();
    expect(slotDefinition("earring")).toBeNull();
  });
});

describe("no question is invented, and none carries a side", () => {
  it("takes every anatomy question from the region vocabulary that owns it", () => {
    for (const definition of catalogueSlots()) {
      if (definition.question === null) continue;
      const entry = SLOT_CATALOGUE.find((candidate) => candidate.feature === definition.feature)!;
      const owned = entry.facets.some((facet) => regionNameOf(facet) === definition.question)
        || LANDMARK_OF_ACCESSORY.some((accessory) => accessory.region === definition.question);
      expect(owned, `${definition.slot} asks "${definition.question}", which no table owns`).toBe(true);
    }
  });

  it("NEVER puts a laterality word in a question — SAM 3 returned the same hoop twice", () => {
    for (const definition of catalogueSlots()) {
      expect(definition.question ?? "").not.toMatch(/\b(left|right)\b/i);
    }
  });

  it("reads a bilateral slot on its own side, and a single one on the whole frame", () => {
    expect(slotDefinition("eye@left")!.frame).toBe("ownSide");
    expect(slotDefinition("brow@right")!.frame).toBe("ownSide");
    expect(slotDefinition("ear@left")!.frame).toBe("ownSide");
    expect(slotDefinition("earring@right")!.frame).toBe("ownSide");
    expect(slotDefinition("lips")!.frame).toBe("wholeFrame");
    expect(slotDefinition("glasses")!.frame).toBe("wholeFrame");
  });
});

describe("a slot with no question of its own is words-only, and says why", () => {
  it("refuses to hand her jaw the face's region", () => {
    const jaw = slotDefinition("jaw")!;
    expect(jaw.question).toBeNull();
    expect(jaw.guardKind).toBeNull();
    expect(jaw.wordsOnly).toContain("face skin");
    expect(jaw.wordsOnly).toContain("broader");
  });

  it("refuses to file a face crop as her skin, which is the other direction", () => {
    const skin = slotDefinition("skin")!;
    expect(skin.question).toBeNull();
    expect(skin.wordsOnly).toContain("narrower");
  });

  it("carries a question and a guard kind together, or neither", () => {
    for (const definition of catalogueSlots()) {
      expect(definition.question === null).toBe(definition.guardKind === null);
      expect(definition.question === null).toBe(definition.wordsOnly !== undefined);
    }
  });

  it("gives the same name to the guard kind and the question, so no crop is judged by another kind's number", () => {
    for (const definition of catalogueSlots()) {
      expect(definition.guardKind).toBe(definition.question);
    }
  });
});

describe("a pair carries the word it is spoken as", () => {
  it("writes the plural down rather than adding an s to it", () => {
    expect(slotDefinition("eye@left")!.pairNoun).toBe("eyes");
    expect(slotDefinition("ear@right")!.pairNoun).toBe("ears");
    /* The case a rule gets wrong: "lashes" pluralized reads "lasheses". */
    expect(slotDefinition("lashes@left")!.pairNoun).toBe("lashes");
    expect(slotDefinition("earring@left")!.pairNoun).toBe("earrings");
  });

  it("gives one to every per-side slot and to no single one", () => {
    for (const definition of catalogueSlots()) {
      expect(
        definition.pairNoun !== undefined,
        `${definition.slot} is ${definition.instance === null ? "single" : "per side"}`,
      ).toBe(definition.instance !== null);
    }
  });
});

describe("the tier boundary, as the rulings left it", () => {
  it("has NO surface-tier slot — a surface worn on anatomy is the anatomy slot's stack", () => {
    expect(catalogueSlots().filter((definition) => definition.tier === "surface")).toEqual([]);
    expect(FACET_SLOTS.makeup).toMatchObject({ notASlot: expect.stringContaining("fable-201") });
  });

  it("files everything she wears as an item and everything she is as anatomy", () => {
    const tierOf = (slot: string) => slotDefinition(slot)!.tier;
    expect(tierOf("earring@left")).toBe("item");
    expect(tierOf("glasses")).toBe("item");
    expect(tierOf("nose-stud")).toBe("item");
    expect(tierOf("lips")).toBe("anatomy");
    expect(tierOf("skin")).toBe("anatomy");
    expect(tierOf("hair")).toBe("anatomy");
  });
});

describe("the accessory slots are derived from the placement table, not restated", () => {
  it("has one slot family per kind the product can place, and pairs come in twos", () => {
    for (const accessory of LANDMARK_OF_ACCESSORY) {
      const feature = accessory.region.replace(/ /g, "-");
      const sides = catalogueSlots().filter((definition) => definition.feature === feature);
      expect(sides.map((definition) => definition.slot).sort())
        .toEqual(accessory.pair ? [`${feature}@left`, `${feature}@right`] : [feature]);
      for (const side of sides) expect(side.question).toBe(accessory.region);
    }
  });

  it("keeps the key free of spaces, because a key with one is not a slot", () => {
    expect(slotDefinition("nose stud")).toBeNull();
    expect(slotDefinition("nose-stud")).toMatchObject({ noun: "nose stud", question: "nose stud" });
  });
});

describe("every facet has a home, or a stated reason for not having one", () => {
  it("is total over the refine vocabulary", () => {
    for (const facet of allFacets()) {
      const assignment = FACET_SLOTS[facet];
      expect(assignment, `facet "${facet}" has no entry in FACET_SLOTS`).toBeDefined();
    }
  });

  it("points every assigned facet at a slot the catalogue actually has", () => {
    for (const facet of allFacets()) {
      const assignment = FACET_SLOTS[facet]!;
      if ("feature" in assignment) {
        expect(
          SLOT_CATALOGUE.some((entry) => entry.feature === assignment.feature),
          `facet "${facet}" points at "${assignment.feature}", which is not in the catalogue`,
        ).toBe(true);
      }
    }
  });

  it("gives every catalogued slot at least one facet whose words land in it", () => {
    for (const entry of SLOT_CATALOGUE) {
      expect(entry.facets.length, `${entry.feature} holds nobody's words`).toBeGreaterThan(0);
    }
  });

  it("keeps ink and expression OUT, each with the reason rather than by omission", () => {
    expect(FACET_SLOTS.ink).toMatchObject({ notASlot: expect.stringContaining("OWED") });
    expect(FACET_SLOTS.expression).toMatchObject({ notASlot: expect.stringContaining("D-136") });
  });
});

describe("the catalogue's nouns are the ones the recipe assembler can speak", () => {
  it("builds a recipe naming every catalogued slot, with no bare-noun refusal", () => {
    /*
      AT THE WIRE, not against a copy of the rule. The assembler owns the
      determiner grammar and it refuses `nounNotBare`; asserting a regex here
      would prove the regex, not the nouns. Every slot is put through the real
      assembler with one word in its stack.
    */
    const recipe = assembleRecipe({
      master: { key: "master.png" },
      pronouns: SHE,
      library: catalogueSlots().map((definition) => ({
        slot: definition.slot,
        tier: definition.tier,
        noun: definition.noun,
        words: ["as she is"],
      })),
      asks: [],
    });
    expect(recipe.ok, "ok" in recipe && recipe.ok === false ? `${recipe.reason}: ${recipe.detail}` : "").toBe(true);
  });

  it("speaks a worn thing with an article and a part of her with the possessive", () => {
    const recipe = assembleRecipe({
      master: { key: "master.png" },
      pronouns: SHE,
      library: [
        { slot: "lips", tier: "anatomy", noun: slotDefinition("lips")!.noun, words: ["full"] },
        {
          slot: "earring@left",
          tier: "item",
          noun: slotDefinition("earring@left")!.noun,
          words: ["a gold hoop"],
          anchor: { key: "hoop.png" },
        },
      ],
      asks: [
        { slot: "lips", words: "a deeper cupid's bow" },
        { slot: "earring@left", words: "noticeably bigger" },
      ],
    });
    if (!recipe.ok) throw new Error(`${recipe.reason}: ${recipe.detail}`);
    expect(recipe.ask).toContain("her lips");
    expect(recipe.ask).toContain("the left earring");
  });
});

describe("what the mint is handed", () => {
  it("composes a spec the mint can cut, with the words the caller supplied", () => {
    expect(slotSpecFor("hair", ["a blunt bob", "copper"])).toEqual({
      slot: "hair",
      tier: "anatomy",
      noun: "hair",
      words: ["a blunt bob", "copper"],
      question: "hair",
      guardKind: "hair",
      frame: "wholeFrame",
    });
  });

  /*
    THE FRAME TRAVELS WITH THE SPEC, and it is the mint's whole defence against
    cutting one of a pair from a union of both.

    `toEqual` above is exhaustive on purpose: a field the catalogue knows and
    forgets to pass is a decision made here and lost on the way, which is how a
    per-side slot would arrive at the mint looking like any other.
  */
  it("carries a per-side slot's own-side frame through to the mint's spec", () => {
    expect(slotSpecFor("earring@left", ["dangly gold crosses"])).toEqual({
      slot: "earring@left",
      tier: "item",
      noun: "left earring",
      words: ["dangly gold crosses"],
      question: "earring",
      guardKind: "earring",
      frame: "ownSide",
    });
  });

  it("hands a words-only slot its nulls rather than the nearest region", () => {
    expect(slotSpecFor("teeth", ["straight and white"])).toMatchObject({
      slot: "teeth",
      question: null,
      guardKind: null,
      words: ["straight and white"],
    });
  });

  it("returns null for a slot it has never heard of, instead of composing a guess", () => {
    expect(slotSpecFor("hat", ["a wide brim"])).toBeNull();
    expect(slotSpecFor("makeup@lips", ["nude gloss"])).toBeNull();
  });
});
