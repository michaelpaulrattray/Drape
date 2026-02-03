import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM and image generation services
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          fullPrompt: "Professional fashion model headshot. A confident female model with medium brown hair...",
          technicalSchema: {
            gender: "female",
            age: "18-25",
            ethnicity: "Caucasian",
            bodyType: "slim",
            height: "average",
            hair: { color: "brown", length: "medium", style: "wavy" },
            skin: { tone: "medium", texture: "smooth" },
            eyes: { color: "brown", shape: "almond" },
            face: { structure: "oval", features: "balanced" },
            aesthetic: { brand: "editorial", mood: "confident", lighting: "soft studio", background: "neutral gray" }
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

    expect(result).toHaveProperty("fullPrompt");
    expect(result).toHaveProperty("technicalSchema");
    expect(result).toHaveProperty("agencyId");
    expect(result.fullPrompt).toBeTruthy();
    expect(result.agencyId).toMatch(/^MOD-\d{2}-[A-Z0-9]{6}$/);
  });

  it("should include technical schema with all sections", async () => {
    const result = await generateMasterPrompt(validPreferences);

    expect(result.technicalSchema).toHaveProperty("gender");
    expect(result.technicalSchema).toHaveProperty("age");
    expect(result.technicalSchema).toHaveProperty("ethnicity");
    expect(result.technicalSchema).toHaveProperty("hair");
    expect(result.technicalSchema).toHaveProperty("skin");
    expect(result.technicalSchema).toHaveProperty("eyes");
    expect(result.technicalSchema).toHaveProperty("face");
    expect(result.technicalSchema).toHaveProperty("aesthetic");
  });

  it("should generate unique agency IDs", async () => {
    const result1 = await generateMasterPrompt(validPreferences);
    const result2 = await generateMasterPrompt(validPreferences);

    expect(result1.agencyId).not.toBe(result2.agencyId);
  });
});

describe("AI Service - Casting Image Generation", () => {
  const mockMasterPrompt = {
    fullPrompt: "Professional fashion model headshot...",
    technicalSchema: {
      gender: "female",
      age: "18-25",
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
    expect(result.pointsCost).toBe(10);
  });
});

describe("AI Service - Full Body Generation", () => {
  const mockMasterPrompt = {
    fullPrompt: "Professional fashion model...",
    technicalSchema: {
      gender: "female",
      age: "18-25",
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
    const result = await generateFullBody(mockMasterPrompt);

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeTruthy();
    expect(result.pointsCost).toBe(POINT_COSTS.fullBody);
  });

  it("should accept optional headshot reference", async () => {
    const result = await generateFullBody(mockMasterPrompt, "https://example.com/headshot.jpg");

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeTruthy();
  });

  it("should return correct point cost for full body", async () => {
    const result = await generateFullBody(mockMasterPrompt);
    expect(result.pointsCost).toBe(8);
  });
});

describe("AI Service - Multi-View Generation", () => {
  const mockMasterPrompt = {
    fullPrompt: "Professional fashion model...",
    technicalSchema: {
      gender: "female",
      age: "18-25",
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
  });

  it("should return correct point cost for multi-view", async () => {
    const result = await generateRemainingViews(mockMasterPrompt, "side");
    expect(result.pointsCost).toBe(15);
  });
});

describe("AI Service - Model Iteration", () => {
  const mockMasterPrompt = {
    fullPrompt: "Professional fashion model...",
    technicalSchema: {
      gender: "female",
      age: "18-25",
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

  it("should iterate on existing model with feedback", async () => {
    const result = await iterateModel(
      mockMasterPrompt,
      "https://example.com/current.jpg",
      "Make the lighting more dramatic"
    );

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBeTruthy();
    expect(result.pointsCost).toBe(POINT_COSTS.iteration);
  });

  it("should return correct point cost for iteration", async () => {
    const result = await iterateModel(
      mockMasterPrompt,
      "https://example.com/current.jpg",
      "Add more contrast"
    );
    expect(result.pointsCost).toBe(5);
  });
});

describe("AI Service - Point Costs", () => {
  it("should have correct point costs defined", () => {
    expect(POINT_COSTS.masterPrompt).toBe(2);
    expect(POINT_COSTS.castingImage).toBe(10);
    expect(POINT_COSTS.fullBody).toBe(8);
    expect(POINT_COSTS.multiView).toBe(15);
    expect(POINT_COSTS.upscale2K).toBe(3);
    expect(POINT_COSTS.upscale4K).toBe(5);
    expect(POINT_COSTS.iteration).toBe(5);
  });

  it("should have total initial generation cost of 12 points", () => {
    const totalInitialCost = POINT_COSTS.masterPrompt + POINT_COSTS.castingImage;
    expect(totalInitialCost).toBe(12);
  });
});
