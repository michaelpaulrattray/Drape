/**
 * Batch C — creation-time intake validation (§10, M22 units) including the
 * §5.2 eyelash creation boundary: validated NATURAL eyelash anatomy passes
 * (creation-only), cosmetic-lash language refuses, presentation language
 * refuses with routing, ink marks remain valid brief input (R6), and
 * creation references fail closed even past the router schema.
 */
import { describe, it, expect } from "vitest";
import { validateCreationIntent } from "./creationIntake";
import { REFUSAL_COPY } from "./refusalCopy";

describe("presentation language refuses honestly — no silent stripping (§10.2)", () => {
  it.each([
    ["userPrompt", { userPrompt: "a girl in a red dress for Prada" }],
    ["features", { features: "always wears sunglasses" }],
    ["userPrompt", { userPrompt: "moody portrait with heavy makeup" }],
    ["features", { features: "gold necklace and hoop earrings" }],
    ["hairStyleOverride", { hairStyleOverride: "slicked back under a beanie" }],
  ])("presentation in %s refuses with routing copy", (_channel, prefs) => {
    const r = validateCreationIntent(prefs);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("presentation");
      expect(r.message).toBe(REFUSAL_COPY.creationPresentation);
    }
  });
});

describe("the §5.2 eyelash creation boundary (M22)", () => {
  it("POSITIVE: natural eyelash anatomy passes and may persist through the brief path", () => {
    for (const brief of [
      "naturally long, dense lashes",
      "sparse straight lashes",
      "naturally curled lashes framing hooded eyes",
    ]) {
      expect(validateCreationIntent({ features: brief })).toEqual({ ok: true });
      expect(validateCreationIntent({ userPrompt: brief })).toEqual({ ok: true });
    }
  });

  it("NEGATIVE: cosmetic-lash creation language refuses before save and charge", () => {
    for (const brief of [
      "heavy mascara look",
      "false lashes",
      "lash extensions and a bold eye",
      "a subtle lash lift",
    ]) {
      const r = validateCreationIntent({ userPrompt: brief });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe("cosmetic_lash");
        expect(r.message).toBe(REFUSAL_COPY.creationCosmeticLash);
      }
    }
  });
});

describe("valid identity input stays valid (R6 creation reality)", () => {
  it("brief-time ink marks pass — the one advertised mark family", () => {
    expect(validateCreationIntent({ features: "a fine-line rose tattoo on the left shoulder" })).toEqual({ ok: true });
  });
  it("non-ink mark families are tolerated (not advertised, not refused) at creation", () => {
    expect(validateCreationIntent({ features: "light freckles, a faint brow scar" })).toEqual({ ok: true });
  });
  it("ordinary identity briefs pass untouched", () => {
    expect(
      validateCreationIntent({
        userPrompt: "mid-20s Nordic woman, sharp editorial bone structure, Prada energy",
        features: "gap teeth, strong asymmetry",
      }),
    ).toEqual({ ok: true });
    expect(validateCreationIntent({})).toEqual({ ok: true });
  });
});

describe("EVERY channel is validated — not a shortlist (review finding 5)", () => {
  it.each([
    ["jawline", { jawline: "jawline hidden under a scarf" }, "presentation content"],
    ["skinFinish", { skinFinish: "dewy makeup with highlighter" }, "presentation content"],
    ["hairLength", { hairLength: "long, tucked under a beanie" }, "presentation content"],
    ["eyeShape", { eyeShape: "like the attached reference, with sunglasses" }, "presentation content"],
    ["arbitraryCanvasAttribute", { arbitraryCanvasAttribute: "gold hoop earrings" }, "presentation via unknown key"],
  ])("forbidden text inside %s refuses", (_channel, prefs) => {
    const r = validateCreationIntent(prefs as Record<string, unknown>);
    expect(r.ok).toBe(false);
  });

  it("relational-reference wording refuses in any channel — creation has no reference (§10.3/§8.6)", () => {
    const r = validateCreationIntent({ eyeShape: "like the attached reference" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("relational_reference");
  });

  it("stable closed scalars: off-list gender and a non-numeric age refuse; empty stays engine's choice", () => {
    expect(validateCreationIntent({ gender: "Robot" }).ok).toBe(false);
    expect(validateCreationIntent({ gender: "" }).ok).toBe(true);
    expect(validateCreationIntent({ age: "ancient" }).ok).toBe(false);
    expect(validateCreationIntent({ age: "23" }).ok).toBe(true);
    expect(validateCreationIntent({ ethnicityBlend: [{ name: "Klingon", pct: 100 }] }).ok).toBe(false);
  });

  it("fork-safety: PROSE descriptors written by earlier authorized edits stay castable", () => {
    // A fork of a text-edited model carries normalized prose — forbidden
    // CONTENT refuses; honest identity prose does not.
    expect(
      validateCreationIntent({ jawline: "broad angular jaw, squared", hairStyleOverride: "chin-length layered wolf cut" }),
    ).toEqual({ ok: true });
  });

  it("brand-direction channels stay exempt (aesthetic direction, not subject wardrobe)", () => {
    expect(
      validateCreationIntent({ castingBrandOverride: "Margiela deconstructed tailoring, archival jackets" }),
    ).toEqual({ ok: true });
  });
});

describe("non-string CONTAINERS cannot smuggle content (final correction 3)", () => {
  it("arrays and nested objects on any prose key refuse before anything runs", () => {
    for (const prefs of [
      { jawline: ["sharp", "red dress"] },
      { skinFinish: { sneaky: "heavy makeup" } },
      { features: [{ text: "gold hoop earrings" }] },
      { hairLength: 42 },
      { gender: true },
    ]) {
      const r = validateCreationIntent(prefs as Record<string, unknown>);
      expect(r.ok, JSON.stringify(prefs)).toBe(false);
      if (!r.ok) expect(r.code).toBe("invalid_value");
    }
  });

  it("malformed ethnicityBlend CONTAINER types refuse (object/string never bypass the array check)", () => {
    for (const blend of [{ name: "Nordic", pct: 100 }, "Nordic", 42]) {
      const r = validateCreationIntent({ ethnicityBlend: blend });
      expect(r.ok, JSON.stringify(blend)).toBe(false);
    }
  });

  it("malformed castingVibe shapes refuse; the exact shape passes", () => {
    expect(validateCreationIntent({ castingVibe: { editorial: "high" } }).ok).toBe(false);
    expect(validateCreationIntent({ castingVibe: [1, 2, 3] }).ok).toBe(false);
    expect(validateCreationIntent({ castingVibe: { editorial: 1, commercial: 0, runway: 0, extra: 9 } }).ok).toBe(false);
    expect(validateCreationIntent({ castingVibe: { editorial: 0.5, commercial: 0.3, runway: 0.2 } })).toEqual({ ok: true });
  });

  it("valid shapes still pass whole: blend + vibe + numeric age + strings", () => {
    expect(
      validateCreationIntent({
        gender: "Female",
        age: 24,
        castingVibe: { editorial: 1, commercial: 0, runway: 0 },
        ethnicityBlend: [{ name: "Nordic", pct: 100 }],
        jawline: "Sharp / Chiseled",
      }),
    ).toEqual({ ok: true });
  });
});

describe("creation references fail closed even past the router schema (§10.3)", () => {
  it("a helper path carrying referenceImage refuses before any save", () => {
    const r = validateCreationIntent({ referenceImage: "data:image/png;base64,AAAA" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("creation_reference");
      expect(r.message).toBe(REFUSAL_COPY.creationReference);
    }
  });
  it("an empty reference string does not trip the guard", () => {
    expect(validateCreationIntent({ referenceImage: "" })).toEqual({ ok: true });
  });
});
