import { describe, it, expect } from "vitest";

/**
 * Tests for the Debug Utility's random-preferences generator.
 *
 * ⚠ THIS FILE USED TO RE-TYPE BOTH THE GENERATOR AND ITS VOCABULARIES, under
 * a heading that said so: "Helper function that mirrors the one in
 * CastingStudio.tsx" and "Constants that mirror CastingStudio.tsx". Every arm
 * tested the copy. It is 3g's sharpest specimen because it drifted in THREE
 * different ways at once, and the suite was green about all three:
 *
 *  1. THE SOURCE IT NAMES DOES NOT EXIST. `CastingStudio.tsx` has been
 *     deleted; the generator lives in `@shared/castingOptions` and reaches
 *     the client through `features/casting/castingHelpers.tsx`. The comment
 *     sent every later reader to a file that was not there.
 *
 *  2. THE COPY GENERATED 9 FIELDS. THE PRODUCT GENERATES 28. Absent from the
 *     copy, and therefore from every arm below: skinTone, skinTexture,
 *     skinFinish, eyeColor, eyeShape, eyebrowStyle, hairColor, hairFringe,
 *     hairParting, hairVolume, hairTuck, hairFade, facialHair, features,
 *     cheekbones, cheeks, jawline, lipShape, noseShape, userPrompt — twenty
 *     of them. The copy also carried an `ethnicity` produced by a plain pick,
 *     where the product derives it from an `ethnicityBlend` that is a 60/40
 *     two-way blend about 30% of the time.
 *
 *  3. THE VOCABULARIES DRIFTED, AND BOTH LISTS WERE THE SAME LENGTH — which
 *     is why no count could have caught it. The product's `ETHNICITIES` and
 *     the copy's both held TEN entries; the product offers `Mediterranean`
 *     and the copy did not, the copy offered `Mixed` and the product does
 *     not. An arm asserting the generator's output was in the copy's list was
 *     asserting membership of a list no customer has ever been shown.
 *
 * Everything below now drives `generateRandomPreferences` from
 * `@shared/castingOptions` and checks membership against that module's own
 * exported vocabularies. Nothing about the casting options is declared here.
 * Filed under 3g's A. Working law 4: derive, never mirror.
 */
import {
  BODY_TYPE_VALUES,
  CASTING_BRANDS,
  CORE_FACE_SHAPES,
  ETHNICITIES,
  HAIR_FAMILIES_FEMALE,
  HAIR_FAMILIES_MALE,
  HAIR_LENGTHS,
  HAIR_TEXTURES,
  generateRandomPreferences,
} from "@shared/castingOptions";

/** One draw, typed loosely because the product's own return is a bag. */
function draw(): Record<string, unknown> {
  return generateRandomPreferences();
}

describe("Debug Utility - Random Preferences Generator", () => {
  it("should generate valid gender values", () => {
    for (let i = 0; i < 20; i++) expect(["Male", "Female"]).toContain(draw().gender);
  });

  it("should generate valid age range (18-37)", () => {
    for (let i = 0; i < 20; i++) {
      const age = parseInt(String(draw().age));
      expect(age).toBeGreaterThanOrEqual(18);
      expect(age).toBeLessThanOrEqual(37);
    }
  });

  it("should generate valid brand values", () => {
    // ⚠ A FOURTH DRIFT, found by repointing this very arm: the copy's
    // `BRAND_OPTIONS` was an array of `{ value, desc }` objects and the
    // product's `CASTING_BRANDS` is a flat array of strings. The shape had
    // moved, not just the members — so the arm was mapping `.value` over
    // objects that no longer exist anywhere in Drape.
    for (let i = 0; i < 20; i++) expect(CASTING_BRANDS).toContain(draw().castingBrand);
  });

  it("should generate vibe values that sum to 1", () => {
    for (let i = 0; i < 20; i++) {
      const vibe = draw().castingVibe as { editorial: number; commercial: number; runway: number };
      expect(vibe.editorial + vibe.commercial + vibe.runway).toBeCloseTo(1, 5);
    }
  });

  it("should generate valid body type values", () => {
    for (let i = 0; i < 20; i++) expect(BODY_TYPE_VALUES).toContain(draw().bodyType);
  });

  it("should generate valid face shape values", () => {
    for (let i = 0; i < 20; i++) expect(CORE_FACE_SHAPES).toContain(draw().faceShape);
  });

  it("should generate gender-appropriate hair styles", () => {
    for (let i = 0; i < 20; i++) {
      const prefs = draw();
      const validStyles = prefs.gender === "Male" ? HAIR_FAMILIES_MALE : HAIR_FAMILIES_FEMALE;
      expect(validStyles).toContain(prefs.hairStyle);
    }
  });

  it("should generate valid hair length values", () => {
    for (let i = 0; i < 20; i++) expect(HAIR_LENGTHS).toContain(draw().hairLength);
  });

  it("should generate valid hair texture values", () => {
    for (let i = 0; i < 20; i++) expect(HAIR_TEXTURES).toContain(draw().hairTexture);
  });

  /*
   * FROM THE DIFF — these three could not be written against the copy. The
   * first two assert a shape the copy did not produce at all; the third
   * asserts membership of the product's OWN list, which is the arm the
   * same-length vocabulary drift walked straight past.
   */

  it("FROM THE DIFF — ethnicity comes from a BLEND whose percentages total 100", () => {
    let sawBlend = false;
    for (let i = 0; i < 60; i++) {
      const prefs = draw();
      const blend = prefs.ethnicityBlend as Array<{ name: string; pct: number }>;
      expect(Array.isArray(blend)).toBe(true);
      expect(blend.length).toBeGreaterThanOrEqual(1);
      expect(blend.reduce((t, e) => t + e.pct, 0)).toBe(100);
      // The derived legacy string is the blend's names, in order.
      expect(prefs.ethnicity).toBe(blend.map((e) => e.name).join(", "));
      if (blend.length > 1) sawBlend = true;
    }
    // ~30% of draws blend, so 60 draws missing it entirely would be a change
    // in the product rather than bad luck (p < 1e-9).
    expect(sawBlend).toBe(true);
  });

  it("FROM THE DIFF — every name in the blend is a vocabulary the product offers", () => {
    for (let i = 0; i < 40; i++) {
      const blend = draw().ethnicityBlend as Array<{ name: string; pct: number }>;
      for (const entry of blend) expect(ETHNICITIES).toContain(entry.name);
    }
  });

  it("FROM THE DIFF — the draw fills the whole face, not the nine fields a copy remembered", () => {
    const prefs = draw();
    // The twenty the mirror had never heard of. Named individually rather than
    // counted: a count agrees with any list of the same length, which is
    // exactly how this file's ethnicity vocabulary drifted unnoticed.
    for (const field of [
      "skinTone", "skinTexture", "skinFinish", "eyeColor", "eyeShape",
      "eyebrowStyle", "hairColor", "hairFringe", "hairParting", "hairVolume",
      "hairTuck", "hairFade", "facialHair", "features", "cheekbones",
      "cheeks", "jawline", "lipShape", "noseShape", "userPrompt",
    ]) {
      expect(prefs).toHaveProperty(field);
    }
  });
});

describe("Debug Utility - Required Fields Coverage", () => {
  it("should generate all required fields for form validation", () => {
    const requiredFields = ["gender", "age", "ethnicity", "bodyType", "hairStyle"];
    for (let i = 0; i < 10; i++) {
      const prefs = draw();
      for (const field of requiredFields) {
        expect(prefs).toHaveProperty(field);
        expect(prefs[field]).toBeTruthy();
      }
    }
  });
});
