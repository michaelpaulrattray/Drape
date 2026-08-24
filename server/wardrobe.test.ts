/**
 * Wardrobe Service Tests
 *
 * Tests for:
 * - Credit cost constants
 * - Utility functions (sanitizePrompt, diagnoseSafetyBlock)
 * - GarmentForVTO type mapping
 * - Wardrobe router Zod input validation
 */
import { describe, it, expect } from "vitest";
import type { ZodTypeAny } from "zod";
import { WARDROBE_CREDIT_COSTS } from "./wardrobe/creditCosts";
import { readIdentityVerdict } from "./wardrobe/identityCheck";
import { buildTattooMap } from "./wardrobe/tattooAnalysis";
import { buildOutfitContext, selectDescribableGarments } from "./wardrobe/garmentDescription";
import { useWardrobeStore } from "../client/src/features/wardrobe/stores/useWardrobeStore";
import { resolveVtoErrorCopy, shouldAutoRetryVto } from "../client/src/features/wardrobe/vtoErrorCopy";
import { wardrobeRouter } from "./routes/wardrobe";
import {
  wardrobeClassifyEditInput,
  wardrobeImportInput,
  wardrobeOutfitSaveInput,
  wardrobeRefineInput,
  wardrobeSessionCreateInput,
  wardrobeUploadInput,
  wardrobeVtoGenerateInput,
} from "./routes/wardrobeInput";

/**
 * The production schema itself, off the production procedure — the technique
 * `server/_core/invalidInputWire.test.ts` already uses.
 *
 * ⚠ **THIS EXISTS BECAUSE THE DOCBLOCK BELOW WAS NOT THE WHOLE STORY.**
 * `f1030bad` lifted the eight schemas the ROUTER declared inline to
 * `routes/wardrobeInput.ts` and reconnected seven arms to them. Five arms in
 * this file mirror procedures whose schema is declared **at the call site**
 * instead, so the lift could not reach them and they kept their copies — and
 * one had already drifted twice. Nothing is exported to serve a test here: the
 * arms read what the running router runs.
 */
function realWardrobeInput(procedurePath: string): ZodTypeAny {
  const procedures = (wardrobeRouter as unknown as {
    _def: { procedures: Record<string, { _def: { inputs: unknown[] } }> };
  })._def.procedures;
  const procedure = procedures[procedurePath];
  if (!procedure) {
    throw new Error(`no procedure "${procedurePath}" on wardrobeRouter`);
  }
  const inputs = procedure._def.inputs;
  if (inputs.length !== 1) {
    throw new Error(`expected one input schema on "${procedurePath}", got ${inputs.length}`);
  }
  return inputs[0] as ZodTypeAny;
}

// ── Credit Cost Tests ──────────────────────────────────────────────────────

describe("WARDROBE_CREDIT_COSTS", () => {
  it("should define all expected cost keys", () => {
    expect(WARDROBE_CREDIT_COSTS).toHaveProperty("garmentUpload");
    expect(WARDROBE_CREDIT_COSTS).toHaveProperty("garmentDigitize");
    expect(WARDROBE_CREDIT_COSTS).toHaveProperty("garmentAnalyze");
    expect(WARDROBE_CREDIT_COSTS).toHaveProperty("vtoGeneration");
    expect(WARDROBE_CREDIT_COSTS).toHaveProperty("vtoIncremental");
    expect(WARDROBE_CREDIT_COSTS).toHaveProperty("garmentRefinement");
    expect(WARDROBE_CREDIT_COSTS).toHaveProperty("outfitDecomposition");
  });

  it("should have positive integer costs", () => {
    Object.values(WARDROBE_CREDIT_COSTS).forEach((cost) => {
      expect(cost).toBeGreaterThan(0);
      expect(Number.isInteger(cost)).toBe(true);
    });
  });

  it("garmentUpload should be sum of detect + digitize + analyze", () => {
    expect(WARDROBE_CREDIT_COSTS.garmentUpload).toBe(
      WARDROBE_CREDIT_COSTS.garmentDetect + WARDROBE_CREDIT_COSTS.garmentDigitize + WARDROBE_CREDIT_COSTS.garmentAnalyze,
    );
  });

  it("vtoGeneration should cost more than incremental", () => {
    expect(WARDROBE_CREDIT_COSTS.vtoGeneration).toBeGreaterThanOrEqual(
      WARDROBE_CREDIT_COSTS.vtoIncremental,
    );
  });

  it("refinement should cost less than full VTO", () => {
    expect(WARDROBE_CREDIT_COSTS.garmentRefinement).toBeLessThanOrEqual(
      WARDROBE_CREDIT_COSTS.vtoGeneration,
    );
  });
});

// ── Utility Function Tests ─────────────────────────────────────────────────

describe("wardrobe/utils", () => {
  // Import dynamically to avoid side effects from gemini client
  it("sanitizeDescription should pass through normal text", async () => {
    const { sanitizeDescription } = await import("./wardrobe/utils");

    expect(sanitizeDescription("a normal description")).toBe("a normal description");
  });

  it("sanitizeDescription should replace safety terms", async () => {
    const { sanitizeDescription } = await import("./wardrobe/utils");

    // Should return a string (may have replacements applied)
    const result = sanitizeDescription("test input with content");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("diagnoseResponse should detect no-candidate responses", async () => {
    const { diagnoseResponse } = await import("./wardrobe/utils");

    // No candidates = NO_CANDIDATES finish reason
    const blocked = diagnoseResponse({ candidates: [] });
    expect(blocked.finishReason).toBe("NO_CANDIDATES");
    expect(blocked.imageBase64).toBeNull();
  });

  it("diagnoseResponse should detect safety-blocked responses", async () => {
    const { diagnoseResponse } = await import("./wardrobe/utils");

    const safetyBlocked = diagnoseResponse({
      candidates: [{ finishReason: "SAFETY", content: { parts: [] } }],
    });
    expect(safetyBlocked.isSafetyBlock).toBe(true);
    expect(safetyBlocked.finishReason).toBe("SAFETY");
  });

  it("diagnoseResponse should detect prompt-level blocks", async () => {
    const { diagnoseResponse } = await import("./wardrobe/utils");

    const promptBlocked = diagnoseResponse({
      promptFeedback: { blockReason: "SAFETY" },
    });
    expect(promptBlocked.isSafetyBlock).toBe(true);
    expect(promptBlocked.blockReason).toBe("SAFETY");
  });

  it("diagnoseResponse should extract text from successful responses", async () => {
    const { diagnoseResponse } = await import("./wardrobe/utils");

    const success = diagnoseResponse({
      candidates: [{
        finishReason: "STOP",
        content: { parts: [{ text: "hello" }] },
      }],
    });
    expect(success.rawText).toBe("hello");
    expect(success.isSafetyBlock).toBe(false);
  });
});

// ── GarmentForVTO Type Tests ───────────────────────────────────────────────

describe("GarmentForVTO interface", () => {
  it("should accept valid garment objects with required fields", () => {
    const garment = {
      id: "1",
      type: "tops",
      imageUrl: "https://example.com/garment.png",
    };

    expect(garment.id).toBe("1");
    expect(garment.type).toBe("tops");
    expect(garment.imageUrl).toBeDefined();
  });

  it("should accept optional fields", () => {
    const garment = {
      id: "2",
      type: "bottoms",
      imageUrl: "https://example.com/pants.png",
      shortName: "Black Jeans",
      description: "Slim fit black denim",
      tags: ["casual", "denim"],
      isolatedPreviewUrl: "https://example.com/pants-isolated.png",
      sourceImageUrl: "https://example.com/pants-source.png",
      styleNote: "Wear cuffed",
    };

    expect(garment.shortName).toBe("Black Jeans");
    expect(garment.tags).toHaveLength(2);
    expect(garment.styleNote).toBe("Wear cuffed");
  });
});

// ── Zod Input Validation Tests ─────────────────────────────────────────────

/*
  ⚠ THESE ARMS USED TO VALIDATE AGAINST THEIR OWN TRANSCRIPTION OF THE SCHEMAS.

  Seven of them were declared inline here — `const uploadSchema = z.object({…})`
  — and every assertion below was made against that copy. **A test that
  re-declares its subject is not testing the subject.** It agrees with whoever
  typed it, and it stays green for exactly as long as the real schema drifts.

  It had drifted, on FOUR of the seven, and all four in the direction that
  matters:

    refine, generate, sessions.create   the real schemas are `.strict()` and the
                                        copies were not — so these arms would
                                        have ACCEPTED an unknown field the
                                        product refuses (invariant 4), which is
                                        the opposite verdict from the one they
                                        claim to give
    garments.import                     `cropUrl` was absent from the copy
                                        entirely, so three arms said nothing
                                        about the field carrying the cut

  The schemas now live in `server/routes/wardrobeInput.ts` and the router uses
  those same objects, so there is one of each. Found by §10 row 3f's sweep,
  countersigned fable-1619.
*/
describe("Wardrobe Router Input Validation", () => {
  const uploadSchema = wardrobeUploadInput;

  it("should validate garment upload input", () => {
    const valid = uploadSchema.safeParse({
      imageBase64: "data:image/png;base64,iVBOR...",
      slotType: "tops",
    });
    expect(valid.success).toBe(true);
  });

  it("should reject invalid slot types", () => {
    const invalid = uploadSchema.safeParse({
      imageBase64: "data:image/png;base64,iVBOR...",
      slotType: "hats",
    });
    expect(invalid.success).toBe(false);
  });

  it("should reject oversized base64 strings", () => {
    const invalid = uploadSchema.safeParse({
      imageBase64: "x".repeat(10_000_001),
      slotType: "tops",
    });
    expect(invalid.success).toBe(false);
  });

  const vtoSchema = wardrobeVtoGenerateInput;

  it("should validate VTO generate input", () => {
    const valid = vtoSchema.safeParse({
      modelImageUrl: "https://example.com/model.png",
      garmentIds: [1, 2],
    });
    expect(valid.success).toBe(true);
  });

  it("should reject empty garment arrays", () => {
    const invalid = vtoSchema.safeParse({
      modelImageUrl: "https://example.com/model.png",
      garmentIds: [],
    });
    expect(invalid.success).toBe(false);
  });

  it("should reject more than 5 garments", () => {
    const invalid = vtoSchema.safeParse({
      modelImageUrl: "https://example.com/model.png",
      garmentIds: [1, 2, 3, 4, 5, 6],
    });
    expect(invalid.success).toBe(false);
  });

  it("should validate tattoo map input", () => {
    const valid = vtoSchema.safeParse({
      modelImageUrl: "https://example.com/model.png",
      garmentIds: [1],
      tattooMap: {
        hasTattoos: true,
        tattooAreas: ["left arm", "chest"],
        cleanAreas: ["right arm"],
        promptFragment: "Preserve visible tattoos on left arm and chest",
      },
    });
    expect(valid.success).toBe(true);
  });

  const refineSchema = wardrobeRefineInput;

  it("should validate refinement input (basic)", () => {
    const valid = refineSchema.safeParse({
      currentResultUrl: "https://example.com/result.png",
      modelImageUrl: "https://example.com/model.png",
      garmentId: 1,
      instruction: "Make the jacket more fitted",
    });
    expect(valid.success).toBe(true);
  });

  it("should validate refinement input with allGarmentIds and tattooMap", () => {
    const valid = refineSchema.safeParse({
      currentResultUrl: "https://example.com/result.png",
      modelImageUrl: "https://example.com/model.png",
      garmentId: 1,
      instruction: "Roll the sleeves up",
      allGarmentIds: [1, 2, 3],
      tattooMap: {
        hasTattoos: true,
        tattooAreas: ["left_arm", "right_arm"],
        cleanAreas: ["chest", "back"],
        promptFragment: "Preserve visible tattoos on both arms.",
      },
    });
    expect(valid.success).toBe(true);
  });

  it("should accept refinement without optional context fields", () => {
    const valid = refineSchema.safeParse({
      currentResultUrl: "https://example.com/result.png",
      modelImageUrl: "https://example.com/model.png",
      garmentId: 5,
      instruction: "Unbutton the jacket",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.allGarmentIds).toBeUndefined();
      expect(valid.data.tattooMap).toBeUndefined();
    }
  });

  it("should reject overly long refinement instructions", () => {
    const invalid = refineSchema.safeParse({
      currentResultUrl: "https://example.com/result.png",
      modelImageUrl: "https://example.com/model.png",
      garmentId: 1,
      instruction: "x".repeat(501),
    });
    expect(invalid.success).toBe(false);
  });

  /*
   * ⚠ THIS ARM USED TO RE-TYPE THE FILTER, commented "Simulates the
   * server-side logic that builds outfitContext" — the FOURTH hand-written
   * copy of one product rule. The other three were `routes/wardrobe.ts` and
   * `vtoGeneration.ts` twice, each with its own
   * `!description.startsWith("Analyzing")`. All four now derive from
   * `wardrobe/garmentDescription.ts`, and this drives it. Filed under 3g's A.
   */
  it("should build outfit context string from garment descriptions", () => {
    const garments = [
      { description: "Black leather bomber jacket", status: "ready" },
      { description: "White cotton t-shirt", status: "ready" },
      { description: "Analyzing...", status: "ready" },
      { description: null, status: "ready" },
      { description: "Dark denim jeans", status: "processing" },
    ];
    const validGarments = selectDescribableGarments(garments);
    expect(validGarments).toHaveLength(2);
    expect(buildOutfitContext(validGarments)).toBe(
      "Black leather bomber jacket, White cotton t-shirt",
    );
  });

  it("FROM THE DIFF — a null entry is dropped, which is what the ownership filter leaves behind", () => {
    // `routes/wardrobe.ts` maps another user's garment to `null` BEFORE this
    // runs (invariant 3, at `ctx.user.id`). The copy's fixture had no nulls,
    // so nothing said what happens to them. They are dropped.
    expect(
      selectDescribableGarments([
        null,
        { description: "Wool overcoat", status: "ready" },
        null,
      ]),
    ).toEqual([{ description: "Wool overcoat", status: "ready" }]);
  });

  it("FROM THE DIFF — no describable garment yields NO context rather than an empty sentence", () => {
    expect(buildOutfitContext([])).toBeUndefined();
  });

  it("should extract tattoo prompt fragment from tattooMap", () => {
    const tattooMap = {
      hasTattoos: true,
      tattooAreas: ["left_arm"],
      cleanAreas: ["chest"],
      promptFragment: "Preserve visible tattoos on left arm.",
    };
    const tattooPromptFragment = tattooMap.promptFragment;
    expect(tattooPromptFragment).toBe("Preserve visible tattoos on left arm.");
  });

  const outfitSchema = wardrobeOutfitSaveInput;

  it("should validate outfit save input", () => {
    const valid = outfitSchema.safeParse({
      name: "Summer Casual",
      garmentIds: [1, 2, 3],
    });
    expect(valid.success).toBe(true);
  });

  it("should reject empty outfit names", () => {
    const invalid = outfitSchema.safeParse({
      name: "",
      garmentIds: [1],
    });
    expect(invalid.success).toBe(false);
  });

  it("should reject outfits with no garments", () => {
    const invalid = outfitSchema.safeParse({
      name: "Empty Outfit",
      garmentIds: [],
    });
    expect(invalid.success).toBe(false);
  });

  const sessionSchema = wardrobeSessionCreateInput;

  it("should validate session create input", () => {
    const valid = sessionSchema.safeParse({
      modelImageUrl: "https://example.com/model.png",
    });
    expect(valid.success).toBe(true);
  });

  it("should accept session with modelId", () => {
    const valid = sessionSchema.safeParse({
      modelId: 42,
      modelImageUrl: "https://example.com/model.png",
    });
    expect(valid.success).toBe(true);
  });

  it("should reject session without modelImageUrl", () => {
    const invalid = sessionSchema.safeParse({
      modelId: 42,
    });
    expect(invalid.success).toBe(false);
  });

  const importSchema = wardrobeImportInput;

  it("should validate decomposition import input", () => {
    const valid = importSchema.safeParse({
      sourceImageUrl: "https://example.com/cropped-jacket.png",
      label: "Black Bomber Jacket",
      slotType: "tops",
    });
    expect(valid.success).toBe(true);
  });

  /*
    ⚠ THE FOUR PROPERTIES THE COPY MADE UNTESTABLE.

    Reconnecting the arms above to the real schemas was necessary and is not
    sufficient: every one of them passed before the reconnection and after it,
    because none of them ever asserted the things that had actually drifted. A
    silent difference stays silent until something asks about it.

    So these are the assertions the transcription was hiding — written from the
    diff between the copy and the source rather than from imagination.
  */
  it("⚠ THE DRIFT ITSELF: three of these schemas are .strict() and the copy was not", () => {
    /*
      Invariant 4 on the wardrobe's paid surfaces: an unknown field is REJECTED,
      never silently dropped. The old copies had no `.strict()`, so an arm
      asserting this would have failed against the transcription while passing
      against the product — which is to say nobody could have written it.
    */
    expect(refineSchema.safeParse({
      currentResultUrl: "https://example.com/a.png",
      modelImageUrl: "https://example.com/b.png",
      garmentId: 1,
      instruction: "roll the sleeves",
      unknownField: "should be refused",
    }).success).toBe(false);

    expect(vtoSchema.safeParse({
      modelImageUrl: "https://example.com/model.png",
      garmentIds: [1],
      unknownField: "should be refused",
    }).success).toBe(false);

    expect(sessionSchema.safeParse({
      modelImageUrl: "https://example.com/model.png",
      unknownField: "should be refused",
    }).success).toBe(false);
  });

  it("⚠ THE DRIFT ITSELF: import carries cropUrl, which the copy did not have at all", () => {
    /*
      The field that carries the cut. Three arms validated this schema and none
      of them could say a word about it, because the copy they validated
      against did not contain it — the quietest way for a test to be wrong.
    */
    const withCrop = importSchema.safeParse({
      sourceImageUrl: "https://example.com/source.png",
      cropUrl: "https://example.com/crop.png",
      label: "Black Bomber Jacket",
      slotType: "tops",
    });
    expect(withCrop.success).toBe(true);
    expect(withCrop.success && withCrop.data.cropUrl).toBe("https://example.com/crop.png");

    /* Optional, and a URL when present — not merely "any string". */
    expect(importSchema.safeParse({
      sourceImageUrl: "https://example.com/source.png",
      cropUrl: "not-a-url",
      label: "Black Bomber Jacket",
      slotType: "tops",
    }).success).toBe(false);
  });
});

// ── Slot Type Enum Tests ───────────────────────────────────────────────────

describe("Slot Types", () => {
  const validSlots = ["full_look", "tops", "bottoms", "shoes", "accessories"];

  it("should have exactly 5 slot types", () => {
    expect(validSlots).toHaveLength(5);
  });

  it("full_look should be a valid slot for complete outfits", () => {
    expect(validSlots).toContain("full_look");
  });

  it("all slot types should be lowercase snake_case", () => {
    validSlots.forEach((slot) => {
      expect(slot).toMatch(/^[a-z_]+$/);
    });
  });
});

// ── Tattoo Analysis Tests ─────────────────────────────────────────────────

describe("Tattoo Analysis", () => {
  const { z } = require("zod");

  /*
   * ⚠ THIS BLOCK USED TO TEST A PRIVATE `parseTattooResponse` DECLARED RIGHT
   * HERE — a hand transcription of `server/wardrobe/tattooAnalysis.ts`. It is
   * gone; every arm below drives the real `buildTattooMap`.
   *
   * The specimen is worth meeting, because it is the mirror class's worst
   * form and it is NOT drift. The copy's has-tattoos `promptFragment` was
   * 189 source characters against the product's 604 — rendered on a
   * one-tattoo/one-clean input, **121 characters against 528, so 407 of what
   * the product actually sends (77%) was absent**. What was missing was not
   * decoration: both constraining paragraphs, `Areas covered by clothing…`
   * and `Do NOT add tattoos to any CLEAN area…`.
   *
   * Copy and original entered the tree in the SAME commit — `60eb0b4e`,
   * 2026-03-24, whose message reads *"Exact SOT prompt and parsing logic
   * ported to server architecture … 7 new tests, all 1,302 tests passing."*
   * **It was born short, not drifted**, twelve `promptFragment` assertions
   * were pointed at it, and the suite was green about it for five months
   * while being the only description of that prompt anywhere.
   *
   * The arms marked FROM THE DIFF below are the ones that could not be
   * written against the copy — they assert the 407 characters it never had.
   */

  it("should detect tattoos and build correct prompt fragment", () => {
    const result = buildTattooMap({
      face: "CLEAN",
      neck: "CLEAN",
      chest: "TATTOO",
      left_upper_arm: "TATTOO",
      left_forearm: "TATTOO",
      right_hand: "CLEAN",
    });
    expect(result.hasTattoos).toBe(true);
    expect(result.tattooAreas).toEqual(["chest", "left upper arm", "left forearm"]);
    expect(result.cleanAreas).toEqual(["face", "neck", "right hand"]);
    expect(result.promptFragment).toContain("Tattoos exist ONLY on:");
    expect(result.promptFragment).toContain("chest, left upper arm, left forearm");
  });

  it("should return clean prompt fragment when no tattoos found", () => {
    const result = buildTattooMap({
      face: "CLEAN",
      neck: "CLEAN",
      chest: "CLEAN",
      left_upper_arm: "CLEAN",
    });
    expect(result.hasTattoos).toBe(false);
    expect(result.tattooAreas).toEqual([]);
    expect(result.cleanAreas).toEqual(["face", "neck", "chest", "left upper arm"]);
    expect(result.promptFragment).toContain("NO visible tattoos");
    expect(result.promptFragment).toContain("Do not hallucinate");
  });

  it("should exclude HIDDEN areas from both arrays", () => {
    const result = buildTattooMap({
      face: "CLEAN",
      chest: "TATTOO",
      left_thigh: "HIDDEN",
      right_thigh: "HIDDEN",
      left_lower_leg: "HIDDEN",
    });
    expect(result.tattooAreas).toEqual(["chest"]);
    expect(result.cleanAreas).toEqual(["face"]);
    expect(result.tattooAreas).not.toContain("left thigh");
    expect(result.cleanAreas).not.toContain("left thigh");
  });

  it("should convert underscores to spaces in area names", () => {
    const result = buildTattooMap({
      left_upper_arm: "TATTOO",
      right_forearm: "CLEAN",
      left_lower_leg: "HIDDEN",
    });
    expect(result.tattooAreas).toEqual(["left upper arm"]);
    expect(result.cleanAreas).toEqual(["right forearm"]);
  });

  it("should handle empty areas object", () => {
    const result = buildTattooMap({});
    expect(result.hasTattoos).toBe(false);
    expect(result.tattooAreas).toEqual([]);
    expect(result.cleanAreas).toEqual([]);
    expect(result.promptFragment).toContain("NO visible tattoos");
  });

  /*
   * ⚠ A `TattooMap type should have correct shape` arm stood here. It
   * declared an object literal and asserted the literal had the four
   * properties typed on the lines above — `expect(map).toHaveProperty(…)`
   * over `const map = { … }`. Its subject was the object initialiser, not
   * Drape, and it could not fail on any change to this product. Deleted
   * rather than repointed: `buildTattooMap`'s return type is `TattooMap` and
   * the compiler makes that claim already, which is the reader that the arm
   * was standing in for.
   */

  // ── FROM THE DIFF ─────────────────────────────────────────────────────
  // The two arms below could not be written while this block tested a copy:
  // against the 189-character transcription they would have FAILED, and a
  // failing assertion in a green file reads as the author's own mistake.
  // They assert the 407 rendered characters the copy never carried.

  it("FROM THE DIFF — tells the engine what to do with skin a garment change EXPOSES", () => {
    const result = buildTattooMap({ chest: "TATTOO", face: "CLEAN" });
    // The whole point of the map: hidden skin is not a claim either way, and
    // a garment change that reveals it defaults to CLEAN unless the ink is
    // visibly continuous across the clothing line.
    expect(result.promptFragment).toContain("Areas covered by clothing are unknown");
    expect(result.promptFragment).toContain("default to CLEAN skin");
    expect(result.promptFragment).toContain(
      "the tattoo visibly extends to the edge of the clothing line in Image 1",
    );
  });

  it("FROM THE DIFF — forbids the three hallucinations by name, not just in spirit", () => {
    const result = buildTattooMap({ left_forearm: "TATTOO", right_hand: "CLEAN" });
    expect(result.promptFragment).toContain("Do NOT add tattoos to any CLEAN area");
    expect(result.promptFragment).toContain("Do NOT extend arm tattoos to hands");
    expect(result.promptFragment).toContain(
      "Do NOT add chest or stomach tattoos unless they are confirmed in the map above",
    );
  });

  it("FROM THE DIFF — the constraints ride on EVERY has-tattoos fragment, not one shape of input", () => {
    // The born-short copy was correct about the first three lines and silent
    // about the rest, so an arm that only checks the opening would have
    // passed against it. This one pins the whole fragment's size.
    for (const areas of [
      { chest: "TATTOO" },
      { chest: "TATTOO", face: "CLEAN", left_thigh: "HIDDEN" },
      { left_forearm: "TATTOO", right_forearm: "TATTOO", neck: "CLEAN", right_hand: "CLEAN" },
    ]) {
      const fragment = buildTattooMap(areas).promptFragment;
      expect(fragment).toContain("Areas covered by clothing are unknown");
      expect(fragment).toContain("Do NOT add tattoos to any CLEAN area");
      // 407 characters of constraint + the opening lines. The copy rendered
      // 121 on the first of these; anything near that is the mirror back.
      expect(fragment.length).toBeGreaterThan(400);
    }
  });

  // Validate the tRPC endpoint input schema
  it("should validate analyzeTattoos input schema", () => {
    const schema = realWardrobeInput("model.analyzeTattoos");
    const valid = schema.safeParse({ imageUrl: "https://example.com/model.png" });
    expect(valid.success).toBe(true);
    const invalid = schema.safeParse({ imageUrl: "not-a-url" });
    expect(invalid.success).toBe(false);
    const missing = schema.safeParse({});
    expect(missing.success).toBe(false);
  });
});

// ── Quality Check Tests ───────────────────────────────────────────────────

describe("Quality Check", () => {
  const { z } = require("zod");

  const SEVERE_ISSUES = ["MIRROR_SELFIE", "MULTIPLE_PEOPLE", "FACE_OBSCURED"];
  const MODERATE_ISSUES = [
    "LOW_RESOLUTION",
    "HEAVY_ANGLE",
    "CLUTTERED_BG",
    "SCREENSHOT",
    "PARTIAL_BODY",
  ];

  function classifyQuality(issues: string[]): "good" | "fair" | "poor" {
    if (issues.some((i) => SEVERE_ISSUES.includes(i))) return "poor";
    if (issues.some((i) => MODERATE_ISSUES.includes(i))) return "fair";
    return "good";
  }

  it("should classify severe issues as poor quality", () => {
    expect(classifyQuality(["MIRROR_SELFIE"])).toBe("poor");
    expect(classifyQuality(["MULTIPLE_PEOPLE"])).toBe("poor");
    expect(classifyQuality(["FACE_OBSCURED"])).toBe("poor");
  });

  it("should classify moderate issues as fair quality", () => {
    expect(classifyQuality(["LOW_RESOLUTION"])).toBe("fair");
    expect(classifyQuality(["HEAVY_ANGLE"])).toBe("fair");
    expect(classifyQuality(["CLUTTERED_BG"])).toBe("fair");
    expect(classifyQuality(["SCREENSHOT"])).toBe("fair");
    expect(classifyQuality(["PARTIAL_BODY"])).toBe("fair");
  });

  it("should classify no issues as good quality", () => {
    expect(classifyQuality([])).toBe("good");
  });

  it("severe should override moderate when both present", () => {
    expect(classifyQuality(["LOW_RESOLUTION", "MIRROR_SELFIE"])).toBe("poor");
    expect(classifyQuality(["HEAVY_ANGLE", "FACE_OBSCURED", "CLUTTERED_BG"])).toBe("poor");
  });

  it("should handle multiple moderate issues as fair", () => {
    expect(classifyQuality(["LOW_RESOLUTION", "HEAVY_ANGLE", "CLUTTERED_BG"])).toBe("fair");
  });

  it("ImageQualityResult type should have correct shape", () => {
    const result = {
      quality: "fair" as const,
      issues: ["LOW_RESOLUTION", "HEAVY_ANGLE"],
    };
    expect(result).toHaveProperty("quality");
    expect(result).toHaveProperty("issues");
    expect(["good", "fair", "poor"]).toContain(result.quality);
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it("should validate checkQuality input schema", () => {
    const schema = realWardrobeInput("model.checkQuality");
    const valid = schema.safeParse({ imageUrl: "https://example.com/model.png" });
    expect(valid.success).toBe(true);
    const invalid = schema.safeParse({ imageUrl: "not-a-url" });
    expect(invalid.success).toBe(false);
    const missing = schema.safeParse({});
    expect(missing.success).toBe(false);
  });
});

// ── Detect Result Garments Tests ──────────────────────────────────────────

describe("Detect Result Garments", () => {
  const { z } = require("zod");

  it("should validate detectResultGarments input schema", () => {
    const schema = realWardrobeInput("vto.detectResultGarments");
    const valid = schema.safeParse({ resultUrl: "https://example.com/result.png" });
    expect(valid.success).toBe(true);
    const invalid = schema.safeParse({ resultUrl: "not-a-url" });
    expect(invalid.success).toBe(false);
    const missing = schema.safeParse({});
    expect(missing.success).toBe(false);
  });

  it("should reject empty string as resultUrl", () => {
    const schema = realWardrobeInput("vto.detectResultGarments");
    const result = schema.safeParse({ resultUrl: "" });
    expect(result.success).toBe(false);
  });
});

// ── Full Look Radio Selection Tests ───────────────────────────────────────

describe("Full Look Radio Selection", () => {
  /*
   * ⚠ A PRIVATE `toggleGarmentSelection` USED TO BE DECLARED HERE, commented
   * "Simulate the store's toggleGarmentSelection logic" — a transcription of
   * the real Zustand action. Every arm below tested the copy, so the radio
   * rule that governs which garments a customer has selected could have been
   * changed in the store with this file green.
   *
   * The copy was faithful when it was read (2026-08-25). It was also never
   * necessary: `session-reset.test.ts` has driven the real wardrobe store from
   * a server test since it was written. Every arm now drives the REAL action
   * and reads the REAL `selectedGarmentIds`. Filed under 3g's A.
   */
  function toggleOn(selected: number[], id: number, slotType?: string, fullLookIds?: number[]): Set<number> {
    useWardrobeStore.setState({ selectedGarmentIds: new Set(selected) });
    useWardrobeStore.getState().toggleGarmentSelection(id, slotType as never, fullLookIds);
    return useWardrobeStore.getState().selectedGarmentIds;
  }

  it("should deselect other full_look garments when selecting a new one", () => {
    const selected = toggleOn([10], 20, "full_look", [10, 20, 30]);
    expect(selected.has(20)).toBe(true);
    expect(selected.has(10)).toBe(false);
    expect(selected.size).toBe(1);
  });

  it("should not deselect non-full_look garments when selecting full_look", () => {
    const selected = toggleOn([10, 100, 200], 20, "full_look", [10, 20]);
    expect(selected.has(20)).toBe(true);
    expect(selected.has(10)).toBe(false);
    expect(selected.has(100)).toBe(true);
    expect(selected.has(200)).toBe(true);
  });

  it("should toggle off a full_look garment when clicking it again", () => {
    const selected = toggleOn([10], 10, "full_look", [10, 20]);
    expect(selected.has(10)).toBe(false);
    expect(selected.size).toBe(0);
  });

  it("should not affect other slots when selecting non-full_look", () => {
    const selected = toggleOn([10, 50], 60, "tops");
    expect(selected.has(10)).toBe(true);
    expect(selected.has(50)).toBe(true);
    expect(selected.has(60)).toBe(true);
  });

  it("should work when fullLookIdsToDeselect is undefined (non-full_look slot)", () => {
    const selected = toggleOn([10], 20, "tops", undefined);
    expect(selected.has(10)).toBe(true);
    expect(selected.has(20)).toBe(true);
  });

  it("should handle selecting first full_look with no prior selection", () => {
    const selected = toggleOn([], 10, "full_look", [10, 20, 30]);
    expect(selected.has(10)).toBe(true);
    expect(selected.size).toBe(1);
  });
});

// ── Overlay Scan Wiring Logic Tests ───────────────────────────────────────

describe("Overlay Scan Wiring Logic", () => {
  // Simulate the scanResultOverlay stale-check pattern
  function shouldUpdateOverlay(genIdAtCall: number, currentGenId: number): boolean {
    return genIdAtCall === currentGenId;
  }

  it("should allow overlay update when genId matches current", () => {
    expect(shouldUpdateOverlay(5, 5)).toBe(true);
  });

  it("should reject overlay update when genId is stale", () => {
    expect(shouldUpdateOverlay(5, 6)).toBe(false);
  });

  // Simulate undo/redo cache-or-scan logic
  function resolveOverlayOnNavigation(
    overlayCache: Map<number, string[]>,
    historyIndex: number,
    historyUrl: string | undefined,
  ): { source: "cache" | "scan" | "none"; items?: string[] } {
    const cached = overlayCache.get(historyIndex);
    if (cached) return { source: "cache", items: cached };
    if (historyUrl) return { source: "scan" };
    return { source: "none" };
  }

  it("should restore from cache when overlay is cached for index", () => {
    const cache = new Map<number, string[]>();
    cache.set(2, ["shirt", "pants"]);
    const result = resolveOverlayOnNavigation(cache, 2, "https://example.com/result.png");
    expect(result.source).toBe("cache");
    expect(result.items).toEqual(["shirt", "pants"]);
  });

  it("should trigger scan when no cache exists but URL is available", () => {
    const cache = new Map<number, string[]>();
    const result = resolveOverlayOnNavigation(cache, 2, "https://example.com/result.png");
    expect(result.source).toBe("scan");
  });

  it("should do nothing when no cache and no URL", () => {
    const cache = new Map<number, string[]>();
    const result = resolveOverlayOnNavigation(cache, 5, undefined);
    expect(result.source).toBe("none");
  });

  it("should use correct index after undo (index decrements)", () => {
    const cache = new Map<number, string[]>();
    cache.set(0, ["jacket"]);
    cache.set(1, ["jacket", "skirt"]);
    // Simulate undo from index 1 to index 0
    const result = resolveOverlayOnNavigation(cache, 0, "https://example.com/r0.png");
    expect(result.source).toBe("cache");
    expect(result.items).toEqual(["jacket"]);
  });
});

// ── SAFETY_BLOCK Auto-Retry Logic Tests ───────────────────────────────────

describe("SAFETY_BLOCK Auto-Retry Logic", () => {
  /*
   * ⚠ A PRIVATE `shouldAutoRetry` AND `getFinalErrorMessage` USED TO BE
   * DECLARED HERE, commented "Simulate the retry decision logic from
   * generateVTO catch block", and eight arms asserted the copy — two of them
   * hand-typing the customer-facing sentences.
   *
   * ⚠ AND THE COPY WAS INCOMPLETE IN A WAY NO ARM COULD SHOW: the hook sets
   * an inline message AND a toast, and they are DIFFERENT sentences. The copy
   * modelled only the inline one, so "Safety filter triggered — try different
   * garments" and "Too many requests — please wait" had never been described
   * anywhere in the suite. Both are asserted now.
   *
   * `shouldAutoRetryVto` and `resolveVtoErrorCopy` are named exports of
   * `client/src/features/wardrobe/vtoErrorCopy.ts` with the hook as their
   * first reader. Filed under 3g's A. Working law 4: derive, never mirror.
   */

  it("should auto-retry on first SAFETY_BLOCK", () => {
    expect(shouldAutoRetryVto("SAFETY_BLOCK: content flagged", false)).toBe(true);
  });

  it("should NOT auto-retry on second SAFETY_BLOCK (isRetry=true)", () => {
    expect(shouldAutoRetryVto("SAFETY_BLOCK: content flagged", true)).toBe(false);
  });

  it("should NOT auto-retry on non-SAFETY_BLOCK errors", () => {
    expect(shouldAutoRetryVto("TOO_MANY_REQUESTS", false)).toBe(false);
    expect(shouldAutoRetryVto("Unknown error", false)).toBe(false);
  });

  it("should return safety error for SAFETY_BLOCK", () => {
    expect(resolveVtoErrorCopy("SAFETY_BLOCK: flagged").inline).toBe(
      "Generation blocked by safety filters — try different garments",
    );
  });

  it("should return rate limit error for TOO_MANY_REQUESTS", () => {
    expect(resolveVtoErrorCopy("TOO_MANY_REQUESTS").inline).toBe(
      "Rate limit reached. Please wait a moment.",
    );
  });

  it("should return raw error for other errors", () => {
    expect(resolveVtoErrorCopy("Network timeout").inline).toBe("Network timeout");
  });

  it("FROM THE DIFF — the TOAST is a different sentence from the inline one, on every branch", () => {
    for (const msg of ["SAFETY_BLOCK: flagged", "TOO_MANY_REQUESTS", "Network timeout"]) {
      const copy = resolveVtoErrorCopy(msg);
      expect(copy.toast).not.toBe(copy.inline);
      expect(copy.toast.length).toBeGreaterThan(0);
    }
  });

  it("FROM THE DIFF — the toast sentences themselves, which nothing had ever described", () => {
    expect(resolveVtoErrorCopy("SAFETY_BLOCK: flagged").toast).toBe(
      "Safety filter triggered — try different garments",
    );
    expect(resolveVtoErrorCopy("TOO_MANY_REQUESTS").toast).toBe("Too many requests — please wait");
    expect(resolveVtoErrorCopy("Network timeout").toast).toBe("VTO generation failed");
  });
});

// ── useModelSetup Decision Logic Tests ────────────────────────────────────

describe("useModelSetup Decision Logic", () => {
  // Simulate the hook's decision logic for what to do on model URL change
  interface ModelSetupActions {
    clearHistory: boolean;
    clearTattooMap: boolean;
    runTattooAnalysis: boolean;
    runQualityCheck: boolean;
  }

  function getModelSetupActions(
    newUrl: string | null,
    prevUrl: string | null,
  ): ModelSetupActions | null {
    // Skip if URL hasn't changed
    if (newUrl === prevUrl) return null;

    const actions: ModelSetupActions = {
      clearHistory: true,
      clearTattooMap: true,
      runTattooAnalysis: false,
      runQualityCheck: false,
    };

    if (newUrl) {
      actions.runTattooAnalysis = true;
      actions.runQualityCheck = true;
    }

    return actions;
  }

  it("should skip all actions when URL has not changed", () => {
    const result = getModelSetupActions(
      "https://example.com/model.jpg",
      "https://example.com/model.jpg",
    );
    expect(result).toBeNull();
  });

  it("should clear history and run analyses when URL changes to a new model", () => {
    const result = getModelSetupActions(
      "https://example.com/model2.jpg",
      "https://example.com/model1.jpg",
    );
    expect(result).toEqual({
      clearHistory: true,
      clearTattooMap: true,
      runTattooAnalysis: true,
      runQualityCheck: true,
    });
  });

  it("should clear history and run analyses when URL set from null", () => {
    const result = getModelSetupActions("https://example.com/model.jpg", null);
    expect(result).toEqual({
      clearHistory: true,
      clearTattooMap: true,
      runTattooAnalysis: true,
      runQualityCheck: true,
    });
  });

  it("should clear history but NOT run analyses when URL set to null", () => {
    const result = getModelSetupActions(null, "https://example.com/model.jpg");
    expect(result).toEqual({
      clearHistory: true,
      clearTattooMap: true,
      runTattooAnalysis: false,
      runQualityCheck: false,
    });
  });

  it("should skip when both are null (no change)", () => {
    const result = getModelSetupActions(null, null);
    expect(result).toBeNull();
  });

  // Simulate quality check toast decision
  function shouldShowQualityWarning(quality: "good" | "fair" | "poor"): boolean {
    return quality === "poor";
  }

  it("should show warning toast for poor quality", () => {
    expect(shouldShowQualityWarning("poor")).toBe(true);
  });

  it("should NOT show warning toast for fair quality", () => {
    expect(shouldShowQualityWarning("fair")).toBe(false);
  });

  it("should NOT show warning toast for good quality", () => {
    expect(shouldShowQualityWarning("good")).toBe(false);
  });
});

// ── GarmentOverlay Logic Tests ────────────────────────────────────────────

describe("GarmentOverlay Logic", () => {
  // Replicate the LAYER_Z constant from GarmentOverlay
  const LAYER_Z: Record<string, number> = {
    tops: 1,
    bottoms: 2,
    shoes: 3,
    full_look: 4,
    accessories: 5,
  };

  interface DetectedItem {
    id: string;
    label: string;
    category: string;
    box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  }

  // Replicate the hit detection logic
  function getHitsAt(
    items: DetectedItem[],
    x: number,
    y: number,
  ): DetectedItem[] {
    const hits: DetectedItem[] = [];
    for (const item of items) {
      const [ymin, xmin, ymax, xmax] = item.box_2d;
      if (x >= xmin && x <= xmax && y >= ymin && y <= ymax) {
        hits.push(item);
      }
    }
    hits.sort(
      (a, b) => (LAYER_Z[b.category] || 0) - (LAYER_Z[a.category] || 0),
    );
    return hits;
  }

  const sampleItems: DetectedItem[] = [
    { id: "1", label: "White T-Shirt", category: "tops", box_2d: [0.1, 0.2, 0.5, 0.8] },
    { id: "2", label: "Blue Jeans", category: "bottoms", box_2d: [0.4, 0.2, 0.9, 0.8] },
    { id: "3", label: "Sneakers", category: "shoes", box_2d: [0.85, 0.3, 1.0, 0.7] },
  ];

  it("should return empty array when clicking outside all boxes", () => {
    expect(getHitsAt(sampleItems, 0.05, 0.05)).toEqual([]);
  });

  it("should detect a single garment when clicking inside its box only", () => {
    // Click in the top area where only the t-shirt exists
    const hits = getHitsAt(sampleItems, 0.5, 0.2);
    expect(hits).toHaveLength(1);
    expect(hits[0].label).toBe("White T-Shirt");
  });

  it("should detect overlapping garments and sort by z-order (outermost first)", () => {
    // Click in the overlap zone between tops and bottoms (y=0.45, x=0.5)
    const hits = getHitsAt(sampleItems, 0.5, 0.45);
    expect(hits).toHaveLength(2);
    // Bottoms (z=2) should come before tops (z=1) — outermost first
    expect(hits[0].category).toBe("bottoms");
    expect(hits[1].category).toBe("tops");
  });

  it("should detect shoes at the bottom of the image", () => {
    const hits = getHitsAt(sampleItems, 0.5, 0.9);
    expect(hits).toHaveLength(2); // shoes + bottoms overlap
    expect(hits[0].category).toBe("shoes"); // z=3 > z=2
    expect(hits[1].category).toBe("bottoms");
  });

  it("should handle items with unknown categories (z=0)", () => {
    const itemsWithUnknown: DetectedItem[] = [
      ...sampleItems,
      { id: "4", label: "Hat", category: "unknown", box_2d: [0.0, 0.3, 0.15, 0.7] },
    ];
    const hits = getHitsAt(itemsWithUnknown, 0.5, 0.1);
    // Both t-shirt and hat overlap here
    expect(hits).toHaveLength(2);
    // Tops (z=1) should come before unknown (z=0)
    expect(hits[0].category).toBe("tops");
    expect(hits[1].category).toBe("unknown");
  });

  // Test word-overlap scoring for garment matching (DrapeStudio handleStyleNote logic)
  interface Garment {
    id: number;
    shortName: string | null;
    description: string | null;
    slotType: string;
  }

  function findBestMatch(
    garments: Garment[],
    selectedIds: number[],
    overlayLabel: string,
    overlayCategory: string,
  ): number | undefined {
    const categoryGarments = garments.filter(
      (g) => selectedIds.includes(g.id) && g.slotType === overlayCategory,
    );
    if (categoryGarments.length === 0) return selectedIds[0];
    let bestMatch = categoryGarments[0];
    if (categoryGarments.length > 1) {
      const overlayWords = overlayLabel.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      let bestScore = -1;
      for (const g of categoryGarments) {
        const haystack = `${g.shortName || ''} ${g.description || ''}`.toLowerCase();
        const score = overlayWords.filter((w) => haystack.includes(w)).length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = g;
        }
      }
    }
    return bestMatch.id;
  }

  it("should match by word overlap when overlay label differs from shortName", () => {
    const garments: Garment[] = [
      { id: 1, shortName: "Black Bomber", description: "black leather bomber jacket", slotType: "tops" },
      { id: 2, shortName: "White Tee", description: "plain white cotton t-shirt", slotType: "tops" },
    ];
    // Overlay detects "black leather bomber jacket" — should match id=1
    expect(findBestMatch(garments, [1, 2], "black leather bomber jacket", "tops")).toBe(1);
  });

  it("should match partial words across shortName and description", () => {
    const garments: Garment[] = [
      { id: 1, shortName: "Black Bomber", description: "leather jacket", slotType: "tops" },
      { id: 2, shortName: "White Tee", description: "cotton t-shirt", slotType: "tops" },
    ];
    // "white cotton tee" — 'white' in shortName, 'cotton' in description
    expect(findBestMatch(garments, [1, 2], "white cotton tee", "tops")).toBe(2);
  });

  it("should filter by category before scoring", () => {
    const garments: Garment[] = [
      { id: 1, shortName: "Black Jeans", description: "slim fit black jeans", slotType: "bottoms" },
      { id: 2, shortName: "Black Bomber", description: "black leather jacket", slotType: "tops" },
    ];
    // Overlay says category=bottoms, label="black slim jeans" — should only consider id=1
    expect(findBestMatch(garments, [1, 2], "black slim jeans", "bottoms")).toBe(1);
  });

  it("should fall back to first selected when no category matches", () => {
    const garments: Garment[] = [
      { id: 1, shortName: "White Tee", description: "cotton tee", slotType: "tops" },
    ];
    // Category "shoes" has no matches — falls back to first selected
    expect(findBestMatch(garments, [1], "sneakers", "shoes")).toBe(1);
  });

  it("should return single category garment without scoring", () => {
    const garments: Garment[] = [
      { id: 5, shortName: "Red Dress", description: "long red evening dress", slotType: "full_look" },
    ];
    expect(findBestMatch(garments, [5], "completely different label", "full_look")).toBe(5);
  });

  it("should ignore short words (<=2 chars) during scoring", () => {
    const garments: Garment[] = [
      { id: 1, shortName: "A B Jacket", description: "an ok jacket", slotType: "tops" },
      { id: 2, shortName: "Denim Vest", description: "blue denim vest", slotType: "tops" },
    ];
    // "a b" are <=2 chars, filtered out. "denim" matches id=2
    expect(findBestMatch(garments, [1, 2], "a b denim", "tops")).toBe(2);
  });
});

// ── DecompositionDrawer Logic Tests ─────────────────────────────────────────

describe("DecompositionDrawer — selection & import logic", () => {
  const CATEGORY_COLORS: Record<string, string> = {
    tops: "#555048",
    bottoms: "#777168",
    shoes: "#6B7B8B",
    accessories: "#C4A35A",
    full_look: "#7BA3C4",
  };

  it("should map all 5 slot categories to colors", () => {
    expect(CATEGORY_COLORS.tops).toBe("#555048");
    expect(CATEGORY_COLORS.bottoms).toBe("#777168");
    expect(CATEGORY_COLORS.shoes).toBe("#6B7B8B");
    expect(CATEGORY_COLORS.accessories).toBe("#C4A35A");
    expect(CATEGORY_COLORS.full_look).toBe("#7BA3C4");
  });

  it("should toggle selection correctly", () => {
    const ids = new Set(["item-1", "item-2", "item-3"]);
    // Deselect item-2
    const next = new Set(ids);
    next.delete("item-2");
    expect(next.has("item-1")).toBe(true);
    expect(next.has("item-2")).toBe(false);
    expect(next.has("item-3")).toBe(true);
    // Re-select item-2
    next.add("item-2");
    expect(next.has("item-2")).toBe(true);
  });

  it("should update label for a specific item", () => {
    const items = [
      { id: "a", label: "Blue Shirt", category: "tops" },
      { id: "b", label: "Black Pants", category: "bottoms" },
    ];
    const updated = items.map((item) =>
      item.id === "a" ? { ...item, label: "Navy Shirt" } : item,
    );
    expect(updated[0].label).toBe("Navy Shirt");
    expect(updated[1].label).toBe("Black Pants");
  });

  it("should filter selected items for import", () => {
    const items = [
      { id: "a", label: "Shirt", category: "tops" },
      { id: "b", label: "Pants", category: "bottoms" },
      { id: "c", label: "Shoes", category: "shoes" },
    ];
    const selectedIds = new Set(["a", "c"]);
    const selected = items.filter((i) => selectedIds.has(i.id));
    expect(selected).toHaveLength(2);
    expect(selected.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("should truncate long labels at 20 chars with ellipsis", () => {
    const label = "Black Leather Bomber Jacket With Gold Trim";
    const truncated = label.length > 22 ? label.slice(0, 20) + "\u2026" : label;
    expect(truncated).toBe("Black Leather Bomber\u2026");
    expect(truncated.length).toBe(21);
  });

  it("should not truncate short labels", () => {
    const label = "Blue Shirt";
    const truncated = label.length > 22 ? label.slice(0, 20) + "\u2026" : label;
    expect(truncated).toBe("Blue Shirt");
  });

  it("should compute pill center position from box_2d", () => {
    const box_2d: [number, number, number, number] = [0.2, 0.1, 0.6, 0.5];
    const [ymin, xmin, ymax, xmax] = box_2d;
    const centerX = ((xmin + xmax) / 2) * 100;
    const centerY = ((ymin + ymax) / 2) * 100;
    expect(centerX).toBe(30);
    expect(centerY).toBe(40);
  });
});

// ── LayersPanel Refinement Logic Tests ──────────────────────────────────────

describe("LayersPanel — refinement chip and input logic", () => {
  it("should filter suggested actions as chip labels", () => {
    const suggestedActions = ["Roll sleeves", "Unbutton", "Tuck in", "Add belt"];
    expect(suggestedActions).toHaveLength(4);
    expect(suggestedActions.every((a) => typeof a === "string" && a.length > 0)).toBe(true);
  });

  it("should pass garmentId and chip text to onRefine", () => {
    const calls: Array<{ garmentId: number; instruction: string }> = [];
    const onRefine = (garmentId: number, instruction: string) => {
      calls.push({ garmentId, instruction });
    };
    // Simulate chip click
    onRefine(42, "Roll sleeves");
    onRefine(42, "Unbutton");
    expect(calls).toEqual([
      { garmentId: 42, instruction: "Roll sleeves" },
      { garmentId: 42, instruction: "Unbutton" },
    ]);
  });

  it("should pass garmentId and custom text to onRefine", () => {
    const calls: Array<{ garmentId: number; instruction: string }> = [];
    const onRefine = (garmentId: number, instruction: string) => {
      calls.push({ garmentId, instruction });
    };
    // Simulate custom input submit
    const customText = "Make it more relaxed";
    onRefine(99, customText.trim());
    expect(calls).toEqual([{ garmentId: 99, instruction: "Make it more relaxed" }]);
  });

  it("should not call onRefine with empty custom text", () => {
    const calls: Array<{ garmentId: number; instruction: string }> = [];
    const onRefine = (garmentId: number, instruction: string) => {
      calls.push({ garmentId, instruction });
    };
    const customText = "   ";
    if (customText.trim()) {
      onRefine(1, customText.trim());
    }
    expect(calls).toHaveLength(0);
  });

  it("should extract suggestedActions from garment safely", () => {
    const garmentWithActions = { id: 1, suggestedActions: ["Roll sleeves", "Tuck in"] };
    const garmentWithout = { id: 2 };
    const actions1: string[] = (garmentWithActions as Record<string, unknown>).suggestedActions as string[] ?? [];
    const actions2: string[] = (garmentWithout as Record<string, unknown>).suggestedActions as string[] ?? [];
    expect(actions1).toEqual(["Roll sleeves", "Tuck in"]);
    expect(actions2).toEqual([]);
  });

  it("should only show refinement when hasResult and onRefine are provided", () => {
    const shouldShow = (hasResult: boolean, onRefine: unknown) => hasResult && !!onRefine;
    expect(shouldShow(true, () => {})).toBe(true);
    expect(shouldShow(false, () => {})).toBe(false);
    expect(shouldShow(true, undefined)).toBe(false);
    expect(shouldShow(false, undefined)).toBe(false);
  });
});

// ── Edit Classifier ─────────────────────────────────────────────────────────

describe("Edit Classifier", () => {
  it("classifies LARGE responses as 'large'", () => {
    const parse = (text: string): "small" | "large" =>
      text.trim().toUpperCase().includes("LARGE") ? "large" : "small";

    expect(parse("LARGE")).toBe("large");
    expect(parse("  large  ")).toBe("large");
    expect(parse("LARGE\n")).toBe("large");
  });

  it("classifies SMALL responses as 'small'", () => {
    const parse = (text: string): "small" | "large" =>
      text.trim().toUpperCase().includes("LARGE") ? "large" : "small";

    expect(parse("SMALL")).toBe("small");
    expect(parse("  small  ")).toBe("small");
    expect(parse("SMALL\n")).toBe("small");
  });

  it("defaults to 'small' for empty or unexpected responses", () => {
    const parse = (text: string): "small" | "large" =>
      text.trim().toUpperCase().includes("LARGE") ? "large" : "small";

    expect(parse("")).toBe("small");
    expect(parse("MEDIUM")).toBe("small");
    expect(parse("maybe")).toBe("small");
    expect(parse("I think it's a big change")).toBe("small");
  });

  it("detects LARGE even when embedded in other text", () => {
    const parse = (text: string): "small" | "large" =>
      text.trim().toUpperCase().includes("LARGE") ? "large" : "small";

    expect(parse("This is a LARGE edit")).toBe("large");
    expect(parse("LARGE - structural change")).toBe("large");
  });

  it("builds correct classifier prompt with instruction", () => {
    const buildPrompt = (instruction: string) =>
      `You are classifying a clothing edit instruction for a virtual try-on system.\nINSTRUCTION: "${instruction}"`;

    const prompt = buildPrompt("roll up the sleeves");
    expect(prompt).toContain('INSTRUCTION: "roll up the sleeves"');
    expect(prompt).toContain("classifying a clothing edit instruction");
  });

  it("validates classifyEdit input schema", () => {
    /* The real schema, not a transcription of it — see the block above. */
    const schema = wardrobeClassifyEditInput;

    expect(schema.safeParse({ instruction: "roll sleeves" }).success).toBe(true);
    expect(schema.safeParse({ instruction: "" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ instruction: "a".repeat(501) }).success).toBe(false);
  });

  it("routes small edits to refinement and large edits to regeneration", () => {
    const routeEdit = (editSize: "small" | "large") =>
      editSize === "large" ? "regenerate" : "refine";

    expect(routeEdit("small")).toBe("refine");
    expect(routeEdit("large")).toBe("regenerate");
  });
});

// ── Identity Check ──────────────────────────────────────────────────────────

describe("Identity Check", () => {
  /*
    ⚠ THESE ARMS USED TO RE-TYPE THE PARSE — THREE OF THEM, THREE DIFFERENT WAYS.

    `identityCheck.ts` held two lines inline:

        const text = (response.text ?? "YES").trim().toUpperCase();
        return text.includes("YES");

    and the three arms below transcribed them as `text.trim()…` (no default at
    all, twice) and `(text || "YES").trim()…` (`||`, not `??`). The third was
    named "defaults to true for empty responses" and its one load-bearing
    assertion was `parse("") === true` — **which the product does not do**, and
    it was the only place the behaviour was described anywhere.

    They now drive `readIdentityVerdict`, the product's own parse. The empty
    case is asserted as it BEHAVES, and why that is documented rather than
    decided is on the export's own docblock.
  */
  it("parses YES responses as match (true)", () => {
    expect(readIdentityVerdict("YES")).toBe(true);
    expect(readIdentityVerdict("  yes  ")).toBe(true);
    expect(readIdentityVerdict("YES\n")).toBe(true);
    expect(readIdentityVerdict("YES, they are the same person")).toBe(true);
  });

  it("parses NO responses as no match (false)", () => {
    expect(readIdentityVerdict("NO")).toBe(false);
    expect(readIdentityVerdict("  no  ")).toBe(false);
    expect(readIdentityVerdict("NO, the identity has drifted")).toBe(false);
  });

  it("defaults to a match only when the reader said NOTHING — an EMPTY reply is a drift", () => {
    /* `??` catches null/undefined and NOT `""`. The absent reply defaults to
       "YES"; the empty STRING holds no "YES" and reports a drift. The old arm
       claimed the opposite by writing `||` where the product has `??`. */
    expect(readIdentityVerdict(undefined)).toBe(true);
    expect(readIdentityVerdict("")).toBe(false);
    expect(readIdentityVerdict("   ")).toBe(false);
    expect(readIdentityVerdict("YES")).toBe(true);
  });

  it("validates checkIdentity input schema", () => {
    const schema = realWardrobeInput("vto.checkIdentity");

    expect(schema.safeParse({
      modelImageUrl: "https://example.com/model.png",
      resultImageUrl: "https://example.com/result.png",
    }).success).toBe(true);

    expect(schema.safeParse({
      modelImageUrl: "not-a-url",
      resultImageUrl: "https://example.com/result.png",
    }).success).toBe(false);

    expect(schema.safeParse({
      modelImageUrl: "https://example.com/model.png",
    }).success).toBe(false);
  });

  /*
    ⚠ WRITTEN FROM THE DIFF between the deleted copy and the real schema — the
    only place that information existed, and neither assertion below could have
    been written against the copy without failing (fable-1618/1619's banked
    rule: a transcription does not get caught being wrong, it makes the catching
    assertion unwritable).

    Proven at the wire before the repair: `unknown field  real=false copy=true`.
  */
  it("REFUSES an unknown field — the copy accepted one, which is invariant 4 backwards", () => {
    const schema = realWardrobeInput("vto.checkIdentity");

    expect(schema.safeParse({
      modelImageUrl: "https://example.com/model.png",
      resultImageUrl: "https://example.com/result.png",
      unexpected: "field",
    }).success).toBe(false);
  });

  it("carries the OPTIONAL sessionId the copy had never heard of", () => {
    const schema = realWardrobeInput("vto.checkIdentity");
    const base = {
      modelImageUrl: "https://example.com/model.png",
      resultImageUrl: "https://example.com/result.png",
    };

    /* The second drift was HIDDEN BY THE FIRST: `sessionId` parsed clean
       against the copy only because the copy was open to everything. */
    expect(schema.safeParse({ ...base, sessionId: 7 }).success).toBe(true);
    expect(schema.safeParse({ ...base, sessionId: "seven" }).success).toBe(false);
  });

  it("identity retry flag prevents infinite loops", () => {
    let identityRetryRef = false;

    // First refinement: identity check runs
    const shouldCheck1 = !identityRetryRef;
    expect(shouldCheck1).toBe(true);

    // Identity drift detected — set flag and regenerate
    identityRetryRef = true;

    // Second refinement (auto-retry): identity check skipped
    const shouldCheck2 = !identityRetryRef;
    expect(shouldCheck2).toBe(false);

    // After regeneration completes, flag resets
    identityRetryRef = false;
    const shouldCheck3 = !identityRetryRef;
    expect(shouldCheck3).toBe(true);
  });

  it("routes identity drift to full regeneration", () => {
    const handleIdentityResult = (match: boolean, isRetry: boolean) => {
      if (!match && !isRetry) return "regenerate";
      if (!match && isRetry) return "accept"; // already retried
      return "keep";
    };

    expect(handleIdentityResult(true, false)).toBe("keep");
    expect(handleIdentityResult(false, false)).toBe("regenerate");
    expect(handleIdentityResult(false, true)).toBe("accept");
    expect(handleIdentityResult(true, true)).toBe("keep");
  });
});

// ── Style Refresh (dirty detection + snapshot) ──────────────────

describe("Style Refresh — dirty detection", () => {
  it("detects dirty styles when current note differs from snapshot", () => {
    const lastGenNotes: Record<string, string> = { "1": "tuck in", "2": "roll sleeves" };
    const currentNotes: Record<string, string> = { "1": "tuck in", "2": "cuff hem" };
    const selectedIds = [1, 2];

    const dirty = selectedIds.filter((id) => {
      const key = String(id);
      const lastNote = lastGenNotes[key];
      const currentNote = currentNotes[key] || "";
      return lastNote !== undefined && lastNote !== currentNote;
    });

    expect(dirty).toEqual([2]);
  });

  it("returns no dirty when notes match snapshot", () => {
    const lastGenNotes: Record<string, string> = { "1": "tuck in", "2": "roll sleeves" };
    const currentNotes: Record<string, string> = { "1": "tuck in", "2": "roll sleeves" };
    const selectedIds = [1, 2];

    const dirty = selectedIds.filter((id) => {
      const key = String(id);
      return lastGenNotes[key] !== undefined && lastGenNotes[key] !== (currentNotes[key] || "");
    });

    expect(dirty).toEqual([]);
  });

  it("ignores garments not in snapshot (newly added)", () => {
    const lastGenNotes: Record<string, string> = { "1": "tuck in" };
    const currentNotes: Record<string, string> = { "1": "tuck in", "3": "new note" };
    const selectedIds = [1, 3];

    const dirty = selectedIds.filter((id) => {
      const key = String(id);
      return lastGenNotes[key] !== undefined && lastGenNotes[key] !== (currentNotes[key] || "");
    });

    expect(dirty).toEqual([]);
  });

  it("treats empty current note as dirty if snapshot had text", () => {
    const lastGenNotes: Record<string, string> = { "1": "tuck in" };
    const currentNotes: Record<string, string> = { "1": "" };
    const selectedIds = [1];

    const dirty = selectedIds.filter((id) => {
      const key = String(id);
      return lastGenNotes[key] !== undefined && lastGenNotes[key] !== (currentNotes[key] || "");
    });

    expect(dirty).toEqual([1]);
  });

  it("snapshots style notes correctly from selected garments", () => {
    const selectedIds = [1, 2, 3];
    const styleNotes: Record<string, string> = { "1": "tuck in", "3": "roll sleeves" };

    const snap: Record<string, string> = {};
    for (const id of selectedIds) snap[String(id)] = styleNotes[String(id)] || "";

    expect(snap).toEqual({ "1": "tuck in", "2": "", "3": "roll sleeves" });
  });
});

// ── Session Deduplication Logic Tests ────────────────────────────────────

describe("session deduplication by modelId", () => {
  /**
   * Pure-function replica of the deduplication logic in getRecentUserSessions.
   * We test the algorithm in isolation without needing a DB connection.
   */
  function deduplicateSessions(
    rows: Array<{ id: number; modelId: number | null; updatedAt: Date }>,
    limit: number,
  ) {
    const seenModelIds = new Set<number>();
    return rows
      .filter((row) => {
        if (row.modelId == null) return true;
        if (seenModelIds.has(row.modelId)) return false;
        seenModelIds.add(row.modelId);
        return true;
      })
      .slice(0, limit);
  }

  it("keeps only the latest session per modelId", () => {
    const rows = [
      { id: 4, modelId: 1, updatedAt: new Date("2026-01-04") },
      { id: 3, modelId: 1, updatedAt: new Date("2026-01-03") },
      { id: 2, modelId: 2, updatedAt: new Date("2026-01-02") },
      { id: 1, modelId: 2, updatedAt: new Date("2026-01-01") },
    ];
    const result = deduplicateSessions(rows, 4);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual([4, 2]);
  });

  it("treats null modelId sessions as unique (uploaded models)", () => {
    const rows = [
      { id: 5, modelId: null, updatedAt: new Date("2026-01-05") },
      { id: 4, modelId: null, updatedAt: new Date("2026-01-04") },
      { id: 3, modelId: 1, updatedAt: new Date("2026-01-03") },
    ];
    const result = deduplicateSessions(rows, 4);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.id)).toEqual([5, 4, 3]);
  });

  it("respects the limit after deduplication", () => {
    const rows = [
      { id: 6, modelId: 1, updatedAt: new Date("2026-01-06") },
      { id: 5, modelId: 2, updatedAt: new Date("2026-01-05") },
      { id: 4, modelId: 3, updatedAt: new Date("2026-01-04") },
      { id: 3, modelId: 4, updatedAt: new Date("2026-01-03") },
      { id: 2, modelId: 5, updatedAt: new Date("2026-01-02") },
    ];
    const result = deduplicateSessions(rows, 3);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.id)).toEqual([6, 5, 4]);
  });

  it("handles mixed cast and uploaded models", () => {
    const rows = [
      { id: 5, modelId: 1, updatedAt: new Date("2026-01-05") },
      { id: 4, modelId: null, updatedAt: new Date("2026-01-04") },
      { id: 3, modelId: 1, updatedAt: new Date("2026-01-03") }, // duplicate of model 1
      { id: 2, modelId: 2, updatedAt: new Date("2026-01-02") },
    ];
    const result = deduplicateSessions(rows, 4);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.id)).toEqual([5, 4, 2]);
  });

  it("returns empty array for empty input", () => {
    const result = deduplicateSessions([], 4);
    expect(result).toHaveLength(0);
  });
});
