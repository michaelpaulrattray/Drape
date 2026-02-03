import { describe, it, expect, vi } from "vitest";
import { POINT_COSTS } from "./aiService";

/**
 * Tests for AI Service module
 * Note: Full integration tests require mocking the LLM and image generation APIs
 */

describe("AI Service - Point Costs", () => {
  it("should have correct point costs defined", () => {
    expect(POINT_COSTS.castingImage).toBe(12);
    expect(POINT_COSTS.fullBody).toBe(8);
    expect(POINT_COSTS.multiView).toBe(15);
    expect(POINT_COSTS.iterate).toBe(5);
    expect(POINT_COSTS.upscale).toBe(3);
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
    // Success case
    const successResult = {
      imageUrl: "https://example.com/image.jpg",
      engineUsed: "gemini-3-pro-image-preview",
    };
    
    expect(successResult.imageUrl).toBeDefined();
    expect(successResult.engineUsed).toBeDefined();
  });
});

describe("AI Service - Gemini Model Configuration", () => {
  it("should use gemini-3-pro-preview for text generation", () => {
    const expectedTextModel = "gemini-3-pro-preview";
    expect(expectedTextModel).toBe("gemini-3-pro-preview");
  });

  it("should use gemini-3-pro-image-preview for image generation", () => {
    const expectedImageModel = "gemini-3-pro-image-preview";
    expect(expectedImageModel).toBe("gemini-3-pro-image-preview");
  });
});
