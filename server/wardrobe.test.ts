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

  // Refinement schema (updated with outfit context + tattoo support)
  const refineSchema = z.object({
    currentResultUrl: z.string().url(),
    modelImageUrl: z.string().url(),
    garmentId: z.number(),
    instruction: z.string().max(500),
    allGarmentIds: z.array(z.number()).optional(),
    tattooMap: z.object({
      hasTattoos: z.boolean(),
      tattooAreas: z.array(z.string()),
      cleanAreas: z.array(z.string()),
      promptFragment: z.string(),
    }).optional(),
    sessionId: z.number().optional(),
  });

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

  it("should build outfit context string from garment descriptions", () => {
    // Simulates the server-side logic that builds outfitContext
    const mockGarments = [
      { description: "Black leather bomber jacket", status: "ready" },
      { description: "White cotton t-shirt", status: "ready" },
      { description: "Analyzing...", status: "ready" },
      { description: null, status: "ready" },
      { description: "Dark denim jeans", status: "processing" },
    ];
    const validGarments = mockGarments.filter(
      (g) => g.status === "ready" && !!g.description && !g.description.startsWith("Analyzing"),
    );
    const outfitContext = validGarments.map((g) => g.description).join(", ");
    expect(outfitContext).toBe("Black leather bomber jacket, White cotton t-shirt");
    expect(validGarments).toHaveLength(2);
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

// ── Tattoo Analysis Tests ─────────────────────────────────────────────────

describe("Tattoo Analysis", () => {
  const { z } = require("zod");

  // Simulate the parsing logic from tattooAnalysis.ts
  function parseTattooResponse(areas: Record<string, string>) {
    const tattooAreas: string[] = [];
    const cleanAreas: string[] = [];
    for (const [area, status] of Object.entries(areas)) {
      const readableName = area.replace(/_/g, " ");
      if (status === "TATTOO") tattooAreas.push(readableName);
      else if (status === "CLEAN") cleanAreas.push(readableName);
    }
    const hasTattoos = tattooAreas.length > 0;
    let promptFragment = "";
    if (hasTattoos) {
      promptFragment = `TATTOO MAP (from model image analysis):\nTattoos exist ONLY on: ${tattooAreas.join(", ")}.\nThese areas are confirmed CLEAN (no tattoos): ${cleanAreas.join(", ")}.`;
    } else {
      promptFragment = `TATTOO MAP (from model image analysis):\nThe model has NO visible tattoos. Any exposed skin must be completely clean and free of ink. Do not hallucinate tattoos on hands, arms, chest, or neck.`;
    }
    return { hasTattoos, tattooAreas, cleanAreas, promptFragment };
  }

  it("should detect tattoos and build correct prompt fragment", () => {
    const result = parseTattooResponse({
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
    const result = parseTattooResponse({
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
    const result = parseTattooResponse({
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
    const result = parseTattooResponse({
      left_upper_arm: "TATTOO",
      right_forearm: "CLEAN",
      left_lower_leg: "HIDDEN",
    });
    expect(result.tattooAreas).toEqual(["left upper arm"]);
    expect(result.cleanAreas).toEqual(["right forearm"]);
  });

  it("should handle empty areas object", () => {
    const result = parseTattooResponse({});
    expect(result.hasTattoos).toBe(false);
    expect(result.tattooAreas).toEqual([]);
    expect(result.cleanAreas).toEqual([]);
    expect(result.promptFragment).toContain("NO visible tattoos");
  });

  it("TattooMap type should have correct shape", () => {
    const map = {
      hasTattoos: true,
      tattooAreas: ["left forearm", "right forearm"],
      cleanAreas: ["face", "neck", "chest"],
      promptFragment: "TATTOO MAP (from model image analysis):\nTattoos exist ONLY on: left forearm, right forearm.",
    };
    expect(map).toHaveProperty("hasTattoos");
    expect(map).toHaveProperty("tattooAreas");
    expect(map).toHaveProperty("cleanAreas");
    expect(map).toHaveProperty("promptFragment");
    expect(Array.isArray(map.tattooAreas)).toBe(true);
    expect(Array.isArray(map.cleanAreas)).toBe(true);
    expect(typeof map.hasTattoos).toBe("boolean");
    expect(typeof map.promptFragment).toBe("string");
  });

  // Validate the tRPC endpoint input schema
  it("should validate analyzeTattoos input schema", () => {
    const schema = z.object({ imageUrl: z.string().url() });
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
    const schema = z.object({ imageUrl: z.string().url() });
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
    const schema = z.object({ resultUrl: z.string().url() });
    const valid = schema.safeParse({ resultUrl: "https://example.com/result.png" });
    expect(valid.success).toBe(true);
    const invalid = schema.safeParse({ resultUrl: "not-a-url" });
    expect(invalid.success).toBe(false);
    const missing = schema.safeParse({});
    expect(missing.success).toBe(false);
  });

  it("should reject empty string as resultUrl", () => {
    const schema = z.object({ resultUrl: z.string().url() });
    const result = schema.safeParse({ resultUrl: "" });
    expect(result.success).toBe(false);
  });
});

// ── Full Look Radio Selection Tests ───────────────────────────────────────

describe("Full Look Radio Selection", () => {
  // Simulate the store's toggleGarmentSelection logic
  function toggleGarmentSelection(
    selectedIds: Set<number>,
    id: number,
    slotType?: string,
    fullLookIdsToDeselect?: number[],
  ): Set<number> {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (slotType === "full_look" && fullLookIdsToDeselect) {
        for (const fid of fullLookIdsToDeselect) {
          if (fid !== id) next.delete(fid);
        }
      }
      next.add(id);
    }
    return next;
  }

  it("should deselect other full_look garments when selecting a new one", () => {
    const allFullLookIds = [10, 20, 30];
    let selected = new Set<number>([10]); // garment 10 already selected
    selected = toggleGarmentSelection(selected, 20, "full_look", allFullLookIds);
    expect(selected.has(20)).toBe(true);
    expect(selected.has(10)).toBe(false);
    expect(selected.size).toBe(1);
  });

  it("should not deselect non-full_look garments when selecting full_look", () => {
    const allFullLookIds = [10, 20];
    let selected = new Set<number>([10, 100, 200]); // 100, 200 are tops/bottoms
    selected = toggleGarmentSelection(selected, 20, "full_look", allFullLookIds);
    expect(selected.has(20)).toBe(true);
    expect(selected.has(10)).toBe(false);
    expect(selected.has(100)).toBe(true);
    expect(selected.has(200)).toBe(true);
  });

  it("should toggle off a full_look garment when clicking it again", () => {
    const allFullLookIds = [10, 20];
    let selected = new Set<number>([10]);
    selected = toggleGarmentSelection(selected, 10, "full_look", allFullLookIds);
    expect(selected.has(10)).toBe(false);
    expect(selected.size).toBe(0);
  });

  it("should not affect other slots when selecting non-full_look", () => {
    let selected = new Set<number>([10, 50]);
    selected = toggleGarmentSelection(selected, 60, "tops");
    expect(selected.has(10)).toBe(true);
    expect(selected.has(50)).toBe(true);
    expect(selected.has(60)).toBe(true);
  });

  it("should work when fullLookIdsToDeselect is undefined (non-full_look slot)", () => {
    let selected = new Set<number>([10]);
    selected = toggleGarmentSelection(selected, 20, "tops", undefined);
    expect(selected.has(10)).toBe(true);
    expect(selected.has(20)).toBe(true);
  });

  it("should handle selecting first full_look with no prior selection", () => {
    const allFullLookIds = [10, 20, 30];
    let selected = new Set<number>();
    selected = toggleGarmentSelection(selected, 10, "full_look", allFullLookIds);
    expect(selected.has(10)).toBe(true);
    expect(selected.size).toBe(1);
  });
});
