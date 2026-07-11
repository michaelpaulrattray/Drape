/**
 * promptParser unit tests — pure logic only (no network): sanitization, the
 * merge precedence chain (defaults < parser < per-field random < locked), and
 * the override-preferring reads in buildNewPromptContent. The live
 * gold-standard suite is promptParser.gold.test.ts.
 */
import { describe, it, expect } from "vitest";
import { sanitizeParsed, mergeParsedPreferences, resolveEngineChoices, type ParsedCastAttributes } from "./promptParser";
import { buildNewPromptContent } from "./geminiGeneration";
import { ETHNICITIES, CASTING_BRANDS } from "../../shared/castingOptions";

describe("R2 prerequisites", () => {
  it("ETHNICITIES includes Mediterranean (PARSER_PROMPT_V2 §6)", () => {
    expect(ETHNICITIES).toContain("Mediterranean");
    expect(ETHNICITIES).toHaveLength(10);
  });
});

describe("sanitizeParsed", () => {
  it("random intent returns only intent + userPrompt", () => {
    const out = sanitizeParsed({ intent: "random", gender: "Female", userPrompt: "x" }, "surprise me");
    expect(out.intent).toBe("random");
    expect(out.userPrompt).toBe("surprise me");
    expect(out.fields).toEqual({});
    expect(out.randomizeFields).toEqual([]);
  });

  it("strips nulls, empties, and unknown fields", () => {
    const out = sanitizeParsed(
      { intent: "parsed", gender: "Male", skinTone: null, hairColor: "", madeUpField: "x", userPrompt: "y" },
      "y",
    );
    expect(out.fields.gender).toBe("Male");
    expect(out.fields).not.toHaveProperty("skinTone");
    expect(out.fields).not.toHaveProperty("hairColor");
    expect(out.fields).not.toHaveProperty("madeUpField");
    expect(out.fields).not.toHaveProperty("userPrompt"); // carried separately
  });

  it("caps ethnicityBlend at 2 and clamps percentages", () => {
    const out = sanitizeParsed(
      {
        intent: "parsed",
        ethnicityBlend: [
          { name: "Nordic", pct: 150 },
          { name: "Slavic", pct: -5 },
          { name: "Latino", pct: 30 },
        ],
      },
      "p",
    );
    const blend = out.fields.ethnicityBlend as Array<{ name: string; pct: number }>;
    expect(blend).toHaveLength(2);
    expect(blend[0]).toEqual({ name: "Nordic", pct: 100 });
    expect(blend[1]).toEqual({ name: "Slavic", pct: 0 });
  });

  it("defaults castingVibe to balanced and clamps weights", () => {
    const noVibe = sanitizeParsed({ intent: "parsed" }, "p");
    expect(noVibe.fields.castingVibe).toEqual({ editorial: 0.33, commercial: 0.34, runway: 0.33 });

    const badVibe = sanitizeParsed(
      { intent: "parsed", castingVibe: { editorial: 4, commercial: -1, runway: "x" } },
      "p",
    );
    expect(badVibe.fields.castingVibe).toEqual({ editorial: 1, commercial: 0, runway: 0.33 });
  });

  it("coerces numeric age to string (schema requires strings)", () => {
    const out = sanitizeParsed({ intent: "parsed", age: 25 }, "p");
    expect(out.fields.age).toBe("25");
  });

  it("keeps only string entries in randomizeFields", () => {
    const out = sanitizeParsed({ intent: "parsed", randomizeFields: ["hairColor", 3, null] }, "p");
    expect(out.randomizeFields).toEqual(["hairColor"]);
  });

  it("tolerates garbage input", () => {
    expect(sanitizeParsed(null, "p").intent).toBe("parsed");
    expect(sanitizeParsed("nonsense", "p").fields.ethnicityBlend).toEqual([]);
  });
});

describe("mergeParsedPreferences — the precedence chain", () => {
  const parsed = (fields: Record<string, unknown>, randomizeFields: string[] = []): ParsedCastAttributes => ({
    intent: "parsed",
    userPrompt: "prompt",
    randomizeFields,
    fields,
  });

  it("parser fields land; userPrompt is always the original", () => {
    const out = mergeParsedPreferences(parsed({ gender: "Female", age: "25" }), {}, "the original");
    expect(out.gender).toBe("Female");
    expect(out.age).toBe("25");
    expect(out.userPrompt).toBe("the original");
  });

  it("locked values beat parser output", () => {
    const out = mergeParsedPreferences(parsed({ gender: "Female", hairColor: "Auburn" }), { hairColor: "Platinum" }, "p");
    expect(out.hairColor).toBe("Platinum");
    expect(out.gender).toBe("Female");
  });

  it("randomizeFields fill from the randomizer, and locked still wins over random", () => {
    const out = mergeParsedPreferences(
      parsed({ gender: "Female" }, ["hairColor", "eyeColor"]),
      { eyeColor: "Hazel" },
      "p",
    );
    expect(out.hairColor).toBeTruthy(); // randomized — value varies
    expect(out.eyeColor).toBe("Hazel"); // locked beats randomization
  });

  it("random intent fills everything from the randomizer; locked still wins", () => {
    const out = mergeParsedPreferences(
      { intent: "random", userPrompt: "surprise me", randomizeFields: [], fields: {} },
      { gender: "Non-Binary" },
      "surprise me",
    );
    expect(out.gender).toBe("Non-Binary");
    expect(out.castingBrand).toBeTruthy();
    expect(out.ethnicityBlend?.length).toBeGreaterThan(0);
    expect(out.userPrompt).toBe("surprise me");
  });

  it("derives the legacy ethnicity string from the blend", () => {
    const out = mergeParsedPreferences(
      parsed({ ethnicityBlend: [{ name: "Mediterranean", pct: 100 }] }),
      {},
      "p",
    );
    expect(out.ethnicity).toBe("Mediterranean");
  });

  it("empty locked values do not clobber parser output", () => {
    const out = mergeParsedPreferences(parsed({ gender: "Male" }), { gender: "", skinTone: null as never }, "p");
    expect(out.gender).toBe("Male");
    expect(out.skinTone).toBeUndefined();
  });

  it("does NOT inject a brand — prefill must leave brand open (D-41)", () => {
    const out = mergeParsedPreferences(parsed({ gender: "Female" }), {}, "p");
    expect(out.castingBrand).toBeUndefined();
  });
});

describe("resolveEngineChoices — fire-time brand resolution (D-41)", () => {
  it("absent brand resolves to a random pick from the eight", () => {
    const out = resolveEngineChoices({ gender: "Female" });
    expect(CASTING_BRANDS).toContain(out.castingBrand as (typeof CASTING_BRANDS)[number]);
  });

  it("a chosen brand is never overwritten", () => {
    const out = resolveEngineChoices({ castingBrand: "Prada" });
    expect(out.castingBrand).toBe("Prada");
  });

  it("a brand override suppresses the random pick", () => {
    const out = resolveEngineChoices({ castingBrandOverride: "Tom Ford 2003" });
    expect(out.castingBrand).toBeUndefined();
    expect(out.castingBrandOverride).toBe("Tom Ford 2003");
  });
});

describe("mergeAttributeChanges — cross-field invalidation + dual-write (R3, audit D1/B4)", async () => {
  const { mergeAttributeChanges } = await import("../lib/boardOps");

  it("gender change clears gendered styling unless the change set replaces it", () => {
    const out = mergeAttributeChanges(
      { gender: "Female", hairStyle: "Bob", hairFade: "", facialHair: "" },
      { gender: "Male" },
    );
    expect(out.gender).toBe("Male");
    expect(out.hairStyle).toBe("");
    expect(out.facialHair).toBe("");

    const withReplacement = mergeAttributeChanges(
      { gender: "Female", hairStyle: "Bob" },
      { gender: "Male", hairStyle: "Undercut" },
    );
    expect(withReplacement.hairStyle).toBe("Undercut");
  });

  it("hair-style change resets its sub-selectors", () => {
    const out = mergeAttributeChanges(
      { hairStyle: "Bob", hairLength: "Short", hairFringe: "Blunt Bangs", hairVolume: "Voluminous" },
      { hairStyle: "Long Layers" },
    );
    expect(out.hairStyle).toBe("Long Layers");
    expect(out.hairLength).toBe("");
    expect(out.hairFringe).toBe("");
    expect(out.hairVolume).toBe("");
  });

  it("unchanged gender/style leave everything intact", () => {
    const out = mergeAttributeChanges(
      { gender: "Female", hairStyle: "Bob", hairLength: "Short" },
      { skinTone: "Tan / Bronze" },
    );
    expect(out.hairLength).toBe("Short");
    expect(out.skinTone).toBe("Tan / Bronze");
  });

  it("ethnicity dual-write keeps blend and legacy string in sync (both directions)", () => {
    const fromBlend = mergeAttributeChanges({}, { ethnicityBlend: [{ name: "Nordic", pct: 60 }, { name: "Latino", pct: 40 }] });
    expect(fromBlend.ethnicity).toBe("Nordic, Latino");

    const fromString = mergeAttributeChanges({}, { ethnicity: "Mediterranean" });
    expect(fromString.ethnicityBlend).toEqual([{ name: "Mediterranean", pct: 100 }]);

    const fromStringPair = mergeAttributeChanges({}, { ethnicity: "Nordic, Slavic" });
    expect(fromStringPair.ethnicityBlend).toEqual([
      { name: "Nordic", pct: 50 },
      { name: "Slavic", pct: 50 },
    ]);
  });
});

describe("buildNewPromptContent — honest engine-choice directives (D-41)", () => {
  it("absent gender and age become ENGINE'S CHOICE directives, not silent defaults", () => {
    const out = buildNewPromptContent({}, "skin");
    expect(out).toContain("Gender: ENGINE'S CHOICE — cast whoever best serves the brand direction");
    expect(out).toContain("Age: ENGINE'S CHOICE — pick an age that suits the brand direction and vibe");
    expect(out).not.toContain("Gender: Female");
    expect(out).not.toContain("Age: 23");
  });

  it("stated gender and age pass through verbatim", () => {
    const out = buildNewPromptContent({ gender: "Male", age: "41" }, "skin");
    expect(out).toContain("Gender: Male");
    expect(out).toContain("Age: 41");
    expect(out).not.toContain("ENGINE'S CHOICE — cast whoever");
  });
});

describe("buildNewPromptContent — override-preferring reads (PARSER_PROMPT_V2 §4)", () => {
  const base = { gender: "Female", age: "25" };

  it("prefers hairStyleOverride and hairColorOverride in the HAIR block", () => {
    const out = buildNewPromptContent(
      {
        ...base,
        hairStyle: "Shag / Wolf",
        hairStyleOverride: "shag wolf with curtain bangs",
        hairColor: "Ash Blonde",
        hairColorOverride: "ash blonde with dark roots",
      },
      "skin",
    );
    expect(out).toContain("Style: shag wolf with curtain bangs");
    expect(out).toContain("Color: ash blonde with dark roots");
    expect(out).not.toContain("Style: Shag / Wolf");
  });

  it("falls back to the enum when no override", () => {
    const out = buildNewPromptContent({ ...base, hairStyle: "Bob", hairColor: "Copper" }, "skin");
    expect(out).toContain("Style: Bob");
    expect(out).toContain("Color: Copper");
  });

  it("eyeColorOverride replaces the enum iris line", () => {
    const out = buildNewPromptContent(
      { ...base, eyeColor: "Sky", eyeColorOverride: "pale blue with a green ring" },
      "skin",
    );
    expect(out).toContain("Eye Color: pale blue with a green ring");
    expect(out).not.toContain("Eye Color: Sky");
  });

  it("facialHairOverride wins for male casts", () => {
    const out = buildNewPromptContent(
      { gender: "Male", facialHair: "Full Beard", facialHairOverride: "handlebar moustache with a goatee" },
      "skin",
    );
    expect(out).toContain("Facial Hair: handlebar moustache with a goatee");
  });

  it("skinTextureOverride lands as an explicit feature", () => {
    const out = buildNewPromptContent(
      { ...base, skinTextureOverride: "freckles only across the bridge of her nose" },
      "skin",
    );
    expect(out).toContain("Skin Texture Detail: freckles only across the bridge of her nose");
  });

  it("castingBrandOverride rides along as brand context", () => {
    const out = buildNewPromptContent(
      { ...base, castingBrandOverride: "Tom Ford 2003 vibe — moody luxury" },
      "skin",
    );
    expect(out).toContain("ADDITIONAL BRAND CONTEXT");
    expect(out).toContain("Tom Ford 2003 vibe — moody luxury");
  });
});
