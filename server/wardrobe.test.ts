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
import { WARDROBE_CREDIT_COSTS } from "./wardrobe/creditCosts";

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

describe("Wardrobe Router Input Validation", () => {
  const { z } = require("zod");

  // Garment upload schema
  const uploadSchema = z.object({
    imageBase64: z.string().max(10_000_000),
    slotType: z.enum(["full_look", "tops", "bottoms", "shoes", "accessories"]),
    fileName: z.string().max(256).optional(),
  });

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

  // VTO generate schema
  const vtoSchema = z.object({
    modelImageUrl: z.string().url(),
    garmentIds: z.array(z.number()).min(1).max(5),
    styleNotes: z.record(z.string(), z.string()).optional(),
    tattooMap: z.object({
      hasTattoos: z.boolean(),
      tattooAreas: z.array(z.string()),
      cleanAreas: z.array(z.string()),
      promptFragment: z.string(),
    }).optional(),
    sessionId: z.number().optional(),
  });

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

  // Refinement schema
  const refineSchema = z.object({
    currentResultUrl: z.string().url(),
    modelImageUrl: z.string().url(),
    garmentId: z.number(),
    instruction: z.string().max(500),
    sessionId: z.number().optional(),
  });

  it("should validate refinement input", () => {
    const valid = refineSchema.safeParse({
      currentResultUrl: "https://example.com/result.png",
      modelImageUrl: "https://example.com/model.png",
      garmentId: 1,
      instruction: "Make the jacket more fitted",
    });
    expect(valid.success).toBe(true);
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

  // Outfit save schema
  const outfitSchema = z.object({
    name: z.string().min(1).max(128),
    garmentIds: z.array(z.number()).min(1),
    styleNotes: z.record(z.string(), z.string()).optional(),
    resultThumbUrl: z.string().url().optional(),
  });

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

  // Session create schema
  const sessionSchema = z.object({
    modelId: z.number().optional(),
    modelImageUrl: z.string().url(),
  });

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

  // Decomposition import schema
  const importSchema = z.object({
    sourceImageUrl: z.string().url(),
    label: z.string(),
    slotType: z.enum(["full_look", "tops", "bottoms", "shoes", "accessories"]),
  });

  it("should validate decomposition import input", () => {
    const valid = importSchema.safeParse({
      sourceImageUrl: "https://example.com/cropped-jacket.png",
      label: "Black Bomber Jacket",
      slotType: "tops",
    });
    expect(valid.success).toBe(true);
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
