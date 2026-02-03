import { describe, it, expect, vi } from "vitest";

// Mock the LLM and image generation services
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          natural_description: "Professional fashion model headshot. A confident female model with medium brown hair...",
          technical_schema: {
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
        })
      }
    }]
  })
}));

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({
    url: "https://storage.example.com/generated-image.jpg"
  })
}));

// Import after mocks
import {
  generateMasterPrompt,
  generateCastingImage,
  generateFullBody,
  generateRemainingViews,
  iterateModel,
  POINT_COSTS,
  ModelPreferences
} from "./aiService";

describe("AI Service - Master Prompt Generation", () => {
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

  it("should generate a master prompt with all required fields", async () => {
    const result = await generateMasterPrompt(validPreferences);

    expect(result).toHaveProperty("naturalDescription");
    expect(result).toHaveProperty("technicalSchema");
    expect(result).toHaveProperty("agencyId");
    expect(result.naturalDescription).toBeTruthy();
    expect(result.agencyId).toMatch(/^MOD-\d{2}-[A-Z0-9]{6}$/);
  });

  it("should include technical schema with subject section", async () => {
    const result = await generateMasterPrompt(validPreferences);

    expect(result.technicalSchema).toHaveProperty("subject");
    expect(result.technicalSchema.subject).toHaveProperty("sex");
    expect(result.technicalSchema.subject).toHaveProperty("age");
  });

  it("should generate unique agency IDs", async () => {
    const result1 = await generateMasterPrompt(validPreferences);
    const result2 = await generateMasterPrompt(validPreferences);

    expect(result1.agencyId).not.toBe(result2.agencyId);
  });
});

describe("AI Service - Casting Image Generation", () => {
  const mockMasterPrompt = {
    naturalDescription: "Professional fashion model headshot...",
    technicalSchema: {
      subject: { sex: "female", age: "18-25" },
      ethnicity: "Caucasian",
      bodyType: "slim",
      height: "average",
      hair: { color: "brown", length: "medium", style: "wavy" },
      skin: { tone: "medium", texture: "smooth" },
      eyes: { color: "brown", shape: "almond" },
      face: { structure: "oval", features: "balanced" },
      aesthetic: { brand: "editorial", mood: "confident", lighting: "soft studio", background: "neutral gray" }
    },
    agencyId: "MOD-25-ABC123"
  };

  it("should generate a casting image successfully", async () => {
    const result = await generateCastingImage(mockMasterPrompt);

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeTruthy();
    expect(result.pointsCost).toBe(POINT_COSTS.castingImage);
  });

  it("should return correct point cost for casting image", async () => {
    const result = await generateCastingImage(mockMasterPrompt);
    expect(result.pointsCost).toBe(12);
  });
});

describe("AI Service - Full Body Generation", () => {
  const mockMasterPrompt = {
    naturalDescription: "Professional fashion model...",
    technicalSchema: {
      subject: { sex: "female", age: "18-25" },
      ethnicity: "Caucasian",
      bodyType: "slim",
      height: "average",
      hair: { color: "brown", length: "medium", style: "wavy" },
      skin: { tone: "medium", texture: "smooth" },
      eyes: { color: "brown", shape: "almond" },
      face: { structure: "oval", features: "balanced" },
      aesthetic: { brand: "editorial", mood: "confident", lighting: "soft studio", background: "neutral gray" }
    },
    agencyId: "MOD-25-ABC123"
  };

  it("should generate full body image successfully", async () => {
    const result = await generateFullBody(mockMasterPrompt, "", "female");

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeTruthy();
    expect(result.pointsCost).toBe(POINT_COSTS.fullBody);
  });

  it("should accept optional headshot reference", async () => {
    const result = await generateFullBody(mockMasterPrompt, "https://example.com/headshot.jpg", "female");

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeTruthy();
  });

  it("should return correct point cost for full body", async () => {
    const result = await generateFullBody(mockMasterPrompt, "", "female");
    expect(result.pointsCost).toBe(8);
  });
});

describe("AI Service - Multi-View Generation", () => {
  const mockMasterPrompt = {
    naturalDescription: "Professional fashion model...",
    technicalSchema: {
      subject: { sex: "female", age: "18-25" },
      ethnicity: "Caucasian",
      bodyType: "slim",
      height: "average",
      hair: { color: "brown", length: "medium", style: "wavy" },
      skin: { tone: "medium", texture: "smooth" },
      eyes: { color: "brown", shape: "almond" },
      face: { structure: "oval", features: "balanced" },
      aesthetic: { brand: "editorial", mood: "confident", lighting: "soft studio", background: "neutral gray" }
    },
    agencyId: "MOD-25-ABC123"
  };

  it("should generate side view successfully", async () => {
    const result = await generateRemainingViews(mockMasterPrompt, "side");

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeTruthy();
    expect(result.pointsCost).toBe(POINT_COSTS.multiView);
  });

  it("should generate back view successfully", async () => {
    const result = await generateRemainingViews(mockMasterPrompt, "back");

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeTruthy();
    expect(result.pointsCost).toBe(POINT_COSTS.multiView);
  });

  it("should accept optional reference URL", async () => {
    const result = await generateRemainingViews(mockMasterPrompt, "side", "https://example.com/front.jpg");

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeTruthy();
  });

  it("should return correct point cost for multi-view", async () => {
    const result = await generateRemainingViews(mockMasterPrompt, "side");
    expect(result.pointsCost).toBe(15);
  });
});

describe("AI Service - Iteration", () => {
  const mockMasterPrompt = {
    naturalDescription: "Professional fashion model...",
    technicalSchema: {
      subject: { sex: "female", age: "18-25" },
      ethnicity: "Caucasian",
      bodyType: "slim",
      height: "average",
      hair: { color: "brown", length: "medium", style: "wavy" },
      skin: { tone: "medium", texture: "smooth" },
      eyes: { color: "brown", shape: "almond" },
      face: { structure: "oval", features: "balanced" },
      aesthetic: { brand: "editorial", mood: "confident", lighting: "soft studio", background: "neutral gray" }
    },
    agencyId: "MOD-25-ABC123"
  };

  it("should iterate on an existing image", async () => {
    const result = await iterateModel(
      mockMasterPrompt,
      "https://example.com/original.jpg",
      "Make the lighting more dramatic"
    );

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeTruthy();
    expect(result.pointsCost).toBe(POINT_COSTS.iteration);
  });

  it("should accept mask image for surgical edits", async () => {
    const result = await iterateModel(
      mockMasterPrompt,
      "https://example.com/original.jpg",
      "Change eye color to blue",
      "base64encodedmaskimage"
    );

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeTruthy();
  });

  it("should return correct point cost for iteration", async () => {
    const result = await iterateModel(
      mockMasterPrompt,
      "https://example.com/original.jpg",
      "Adjust the hair style"
    );
    expect(result.pointsCost).toBe(5);
  });
});

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

  it("should have total initial generation cost of 14 points", () => {
    const totalInitialCost = POINT_COSTS.masterPrompt + POINT_COSTS.castingImage;
    expect(totalInitialCost).toBe(14);
  });
});
