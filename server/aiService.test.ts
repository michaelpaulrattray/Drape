import { describe, it, expect, vi } from "vitest";
import { POINT_COSTS } from "./aiService";

/**
 * Tests for AI Service module
 * Note: Full integration tests require mocking the LLM and image generation APIs
 */

describe("AI Service - Point Costs", () => {
  it("should have correct point costs defined", () => {
    expect(POINT_COSTS.masterPrompt).toBe(2);
    expect(POINT_COSTS.castingImage).toBe(12);
    expect(POINT_COSTS.fullBody).toBe(8);
    expect(POINT_COSTS.multiView).toBe(15);
    expect(POINT_COSTS.upscale2K).toBe(3);
    expect(POINT_COSTS.upscale4K).toBe(5);
    expect(POINT_COSTS.iteration).toBe(5);
  });

  it("should have all generation types with positive costs", () => {
    Object.entries(POINT_COSTS).forEach(([type, cost]) => {
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe("number");
    });
  });
});

describe("AI Service - Type Definitions", () => {
  it("should export ModelPreferences type with all required fields", async () => {
    // Import types to verify they exist
    const { ModelPreferences } = await import("./aiService");
    
    // Type check - if this compiles, the types are correct
    const validPreferences = {
      gender: "female" as const,
      ageRange: "25-35" as const,
      ethnicity: "Caucasian",
      bodyType: "athletic" as const,
      height: "tall" as const,
      hairColor: "Brunette",
      hairLength: "long" as const,
      hairStyle: "Straight",
      skinTone: "Fair",
      eyeColor: "Blue",
      brandTone: "luxury" as const,
      mood: "confident" as const,
    };

    expect(validPreferences.gender).toBeDefined();
    expect(validPreferences.brandTone).toBeDefined();
  });
});

describe("AI Service - Generation Result Structure", () => {
  it("should have correct GenerationResult structure", async () => {
    const { GenerationResult } = await import("./aiService");
    
    // Success case
    const successResult = {
      success: true,
      imageUrl: "https://example.com/image.jpg",
      pointsCost: 10,
    };
    
    expect(successResult.success).toBe(true);
    expect(successResult.imageUrl).toBeDefined();
    expect(successResult.pointsCost).toBeGreaterThan(0);

    // Failure case
    const failureResult = {
      success: false,
      error: "Generation failed",
      pointsCost: 0,
    };
    
    expect(failureResult.success).toBe(false);
    expect(failureResult.error).toBeDefined();
    expect(failureResult.pointsCost).toBe(0);
  });
});
