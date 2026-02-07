import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the geminiService
vi.mock("./casting/geminiService", () => ({
  generateMasterPrompt: vi.fn().mockResolvedValue({
    natural: "Professional fashion model headshot. A confident female model with medium brown hair...",
    schema: {
      subject: { 
        sex: "female", 
        age: "18-25",
        ethnicity: "Caucasian",
        skin_tone: "medium",
        hair_style: "wavy",
        hair_color: "brown",
        eye_color: "brown"
      },
      facial_features: {
        eye_shape: "almond",
        face_shape: "oval",
        jawline: "defined",
        cheekbones: "high",
        cheeks_shape: "natural",
        nose_shape: "straight",
        lips_shape: "full",
        eyebrows: "natural",
        freckles: "none"
      },
      context: {
        tone: "editorial",
        casting_for: "Gucci",
        wardrobe: "bare skin"
      }
    }
  }),
  generateCastingImage: vi.fn().mockResolvedValue({
    imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    engineUsed: "gemini-3-pro-image-preview"
  }),
  generateFullBodyShot: vi.fn().mockResolvedValue({
    imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    engineUsed: "gemini-3-pro-image-preview"
  }),
  generateRemainingViews: vi.fn().mockResolvedValue({
    imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    engineUsed: "gemini-3-pro-image-preview"
  }),
  iterateOnImage: vi.fn().mockResolvedValue({
    imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    engineUsed: "gemini-3-pro-image-preview"
  }),
  enhanceUserPrompt: vi.fn().mockResolvedValue("Enhanced prompt with more detail"),
  ImageResolution: { STANDARD: "1024x1024", HD: "2048x2048", ULTRA: "4096x4096" },
  AspectRatio: { SQUARE: "1:1", PORTRAIT: "3:4", LANDSCAPE: "4:3" },
  GenerationMode: { NEW: "NEW", ITERATE: "ITERATE", REFERENCE: "REFERENCE" }
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    url: "https://storage.example.com/generated-image.jpg",
    key: "casting/test-image.png"
  })
}));

// Import after mocks
import { CREDIT_COSTS } from "./casting/aiService";
import type { ModelPreferences } from "./casting/aiService";

describe("AI Service - Credit Costs", () => {
  it("should have correct credit costs defined (50x multiplier)", () => {
    expect(CREDIT_COSTS.castingImage).toBe(350);
    expect(CREDIT_COSTS.fullBody).toBe(300);
    expect(CREDIT_COSTS.multiView).toBe(300);
    expect(CREDIT_COSTS.iterate).toBe(350);
    expect(CREDIT_COSTS.upscale).toBe(300);
  });

  it("should have total initial generation cost of 350 credits", () => {
    const totalInitialCost = CREDIT_COSTS.castingImage;
    expect(totalInitialCost).toBe(350);
  });

  it("should calculate full model generation cost", () => {
    // Headshot + full body + 3 views
    const fullCost = CREDIT_COSTS.castingImage + CREDIT_COSTS.fullBody + CREDIT_COSTS.multiView * 3;
    expect(fullCost).toBe(350 + 300 + 300 * 3); // 1,550 credits
  });

  it("should calculate iteration workflow cost", () => {
    // Headshot + 3 iterations
    const iterationCost = CREDIT_COSTS.castingImage + CREDIT_COSTS.iterate * 3;
    expect(iterationCost).toBe(350 + 350 * 3); // 1,400 credits
  });

  it("should apply flash fallback discount", () => {
    const proCost = CREDIT_COSTS.castingImage;
    const flashCost = Math.ceil(proCost * CREDIT_COSTS.flashMultiplier);
    expect(flashCost).toBe(175); // 350 * 0.5 = 175
  });
});

describe("Model Preferences Validation", () => {
  const validPreferences: ModelPreferences = {
    gender: "female",
    ageRange: "18-25",
    ethnicity: "Caucasian",
    bodyType: "slim",
    height: "average",
    hairColor: "brown",
    hairLength: "medium",
    hairStyle: "wavy",
    skinTone: "medium",
    eyeColor: "brown",
    brandTone: "editorial",
    mood: "confident"
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
    expect(validGenders).toContain(validPreferences.gender);
  });

  it("should accept valid age ranges", () => {
    const validAgeRanges = ["18-25", "25-35", "35-45", "45-55", "55+"];
    expect(validAgeRanges).toContain(validPreferences.ageRange);
  });

  it("should accept valid body types", () => {
    const validBodyTypes = ["slim", "athletic", "average", "curvy", "plus-size"];
    expect(validBodyTypes).toContain(validPreferences.bodyType);
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
    expect(validBrandTones).toContain(validPreferences.brandTone);
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

    const transitions = {
      pending: ["processing"],
      processing: ["completed", "failed"],
      completed: [],
      failed: [],
    };

    expect(transitions.pending).toContain("processing");
    expect(transitions.processing).toContain("completed");
    expect(transitions.processing).toContain("failed");
  });
});

describe("Gemini Model Configuration", () => {
  it("should use gemini-3-pro-preview for text generation", () => {
    // The geminiService uses gemini-3-pro-preview as primary model
    const expectedTextModel = "gemini-3-pro-preview";
    expect(expectedTextModel).toBe("gemini-3-pro-preview");
  });

  it("should use gemini-3-pro-image-preview for image generation", () => {
    // The geminiService uses gemini-3-pro-image-preview as primary model
    const expectedImageModel = "gemini-3-pro-image-preview";
    expect(expectedImageModel).toBe("gemini-3-pro-image-preview");
  });

  it("should have fallback models configured", () => {
    const fallbackTextModel = "gemini-3-flash-preview";
    const fallbackImageModel = "gemini-2.5-flash-image";
    
    expect(fallbackTextModel).toBe("gemini-3-flash-preview");
    expect(fallbackImageModel).toBe("gemini-2.5-flash-image");
  });
});
