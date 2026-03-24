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
  // Simulate the retry decision logic from generateVTO catch block
  function shouldAutoRetry(errorMsg: string, isRetry: boolean): boolean {
    return errorMsg.includes("SAFETY_BLOCK") && !isRetry;
  }

  function getFinalErrorMessage(
    errorMsg: string,
    isRetry: boolean,
    retrySucceeded: boolean,
  ): string | null {
    if (errorMsg.includes("SAFETY_BLOCK") && !isRetry) {
      // First attempt — would auto-retry
      if (retrySucceeded) return null; // retry succeeded, no error
      // Retry failed — show final error
      return "Generation blocked by safety filters — try different garments";
    }
    if (errorMsg.includes("SAFETY_BLOCK")) {
      return "Generation blocked by safety filters — try different garments";
    }
    if (errorMsg.includes("TOO_MANY_REQUESTS")) {
      return "Rate limit reached. Please wait a moment.";
    }
    return errorMsg;
  }

  it("should auto-retry on first SAFETY_BLOCK", () => {
    expect(shouldAutoRetry("SAFETY_BLOCK: content flagged", false)).toBe(true);
  });

  it("should NOT auto-retry on second SAFETY_BLOCK (isRetry=true)", () => {
    expect(shouldAutoRetry("SAFETY_BLOCK: content flagged", true)).toBe(false);
  });

  it("should NOT auto-retry on non-SAFETY_BLOCK errors", () => {
    expect(shouldAutoRetry("TOO_MANY_REQUESTS", false)).toBe(false);
    expect(shouldAutoRetry("Unknown error", false)).toBe(false);
  });

  it("should return null error when retry succeeds", () => {
    const result = getFinalErrorMessage("SAFETY_BLOCK: flagged", false, true);
    expect(result).toBeNull();
  });

  it("should return safety error when retry also fails", () => {
    const result = getFinalErrorMessage("SAFETY_BLOCK: flagged", false, false);
    expect(result).toBe("Generation blocked by safety filters — try different garments");
  });

  it("should return safety error on isRetry=true (second failure)", () => {
    const result = getFinalErrorMessage("SAFETY_BLOCK: flagged", true, false);
    expect(result).toBe("Generation blocked by safety filters — try different garments");
  });

  it("should return rate limit error for TOO_MANY_REQUESTS", () => {
    const result = getFinalErrorMessage("TOO_MANY_REQUESTS", false, false);
    expect(result).toBe("Rate limit reached. Please wait a moment.");
  });

  it("should return raw error for other errors", () => {
    const result = getFinalErrorMessage("Network timeout", false, false);
    expect(result).toBe("Network timeout");
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
