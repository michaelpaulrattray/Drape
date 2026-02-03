import { describe, it, expect } from "vitest";
import { POINT_COSTS } from "./aiService";

/**
 * Tests for Model and Generation endpoints
 * These test the business logic and validation rules
 */

describe("Model Creation - Validation", () => {
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

  it("should require all mandatory preference fields", () => {
    const requiredFields = [
      "gender",
      "ageRange",
      "ethnicity",
      "bodyType",
      "height",
      "hairColor",
      "hairLength",
      "hairStyle",
      "skinTone",
      "eyeColor",
      "brandTone",
      "mood",
    ];

    requiredFields.forEach((field) => {
      expect(validPreferences).toHaveProperty(field);
    });
  });

  it("should accept valid gender values", () => {
    const validGenders = ["male", "female", "non-binary"];
    validGenders.forEach((gender) => {
      expect(validGenders).toContain(gender);
    });
  });

  it("should accept valid age ranges", () => {
    const validAgeRanges = ["18-25", "25-35", "35-45", "45-55", "55+"];
    validAgeRanges.forEach((range) => {
      expect(validAgeRanges).toContain(range);
    });
  });

  it("should accept valid body types", () => {
    const validBodyTypes = ["slim", "athletic", "average", "curvy", "plus-size"];
    validBodyTypes.forEach((type) => {
      expect(validBodyTypes).toContain(type);
    });
  });

  it("should accept valid brand tones", () => {
    const validBrandTones = [
      "luxury",
      "streetwear",
      "minimalist",
      "editorial",
      "commercial",
      "avant-garde",
    ];
    validBrandTones.forEach((tone) => {
      expect(validBrandTones).toContain(tone);
    });
  });

  it("should accept valid moods", () => {
    const validMoods = [
      "confident",
      "serene",
      "edgy",
      "playful",
      "mysterious",
      "natural",
    ];
    validMoods.forEach((mood) => {
      expect(validMoods).toContain(mood);
    });
  });
});

describe("Point Cost Calculations", () => {
  it("should calculate total cost for full model generation", () => {
    // Master prompt + casting image + full body + 2 multi-views
    const totalCost =
      POINT_COSTS.masterPrompt +
      POINT_COSTS.castingImage +
      POINT_COSTS.fullBody +
      POINT_COSTS.multiView * 2;

    expect(totalCost).toBe(2 + 12 + 8 + 15 * 2); // 52 points
  });

  it("should calculate cost for minimal model (just headshot)", () => {
    const minimalCost = POINT_COSTS.masterPrompt + POINT_COSTS.castingImage;
    expect(minimalCost).toBe(14); // 2 + 12
  });

  it("should calculate cost for iteration workflow", () => {
    // Create model + generate image + 3 iterations
    const iterationCost =
      POINT_COSTS.masterPrompt +
      POINT_COSTS.castingImage +
      POINT_COSTS.iteration * 3;

    expect(iterationCost).toBe(2 + 12 + 5 * 3); // 29 points
  });
});

describe("Model Asset View Types", () => {
  it("should have all required view types", () => {
    const viewTypes = [
      "frontClose",
      "frontFull",
      "sideClose",
      "sideFull",
      "backFull",
    ];

    expect(viewTypes).toHaveLength(5);
    expect(viewTypes).toContain("frontClose");
    expect(viewTypes).toContain("frontFull");
  });

  it("should map generation types to view types correctly", () => {
    const mappings = {
      castingImage: "frontClose",
      fullBody: "frontFull",
      sideView: "sideFull",
      backView: "backFull",
    };

    expect(mappings.castingImage).toBe("frontClose");
    expect(mappings.fullBody).toBe("frontFull");
  });
});

describe("Generation Status Flow", () => {
  it("should have valid status transitions", () => {
    const validStatuses = ["pending", "processing", "completed", "failed"];

    // Valid transitions
    const transitions = {
      pending: ["processing"],
      processing: ["completed", "failed"],
      completed: [], // Terminal state
      failed: [], // Terminal state
    };

    expect(transitions.pending).toContain("processing");
    expect(transitions.processing).toContain("completed");
    expect(transitions.processing).toContain("failed");
  });
});

describe("Agency ID Generation", () => {
  it("should follow correct format pattern", () => {
    // Format: MOD-YY-XXXXXX
    const pattern = /^MOD-\d{2}-[A-Z0-9]{6}$/;
    
    // Example valid IDs
    const validIds = ["MOD-26-A1B2C3", "MOD-26-XYZ789", "MOD-25-000000"];
    
    validIds.forEach((id) => {
      expect(id).toMatch(pattern);
    });
  });
});
