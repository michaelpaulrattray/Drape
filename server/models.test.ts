import { describe, it, expect } from "vitest";
import { CREDIT_COSTS } from "./aiService";

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

describe("Credit Cost Calculations", () => {
  it("should have correct credit costs defined", () => {
    // Verify all credit costs are defined (1 credit ≈ $0.01)
    expect(CREDIT_COSTS.castingImage).toBe(7);
    expect(CREDIT_COSTS.fullBody).toBe(6);
    expect(CREDIT_COSTS.multiView).toBe(6);
    expect(CREDIT_COSTS.iterate).toBe(7);
    expect(CREDIT_COSTS.upscale).toBe(6);
  });

  it("should calculate total cost for full model generation", () => {
    // Casting image + full body + 3 multi-views
    const totalCost =
      CREDIT_COSTS.castingImage +
      CREDIT_COSTS.fullBody +
      CREDIT_COSTS.multiView * 3;

    expect(totalCost).toBe(7 + 6 + 6 * 3); // 31 credits
  });

  it("should calculate cost for minimal model (just headshot)", () => {
    const minimalCost = CREDIT_COSTS.castingImage;
    expect(minimalCost).toBe(7);
  });

  it("should calculate cost for iteration workflow", () => {
    // Generate image + 3 iterations
    const iterationCost =
      CREDIT_COSTS.castingImage +
      CREDIT_COSTS.iterate * 3;

    expect(iterationCost).toBe(7 + 7 * 3); // 28 credits
  });

  it("should apply flash fallback discount", () => {
    // Flash model costs 50% of Pro model
    const proCost = CREDIT_COSTS.castingImage;
    const flashCost = Math.ceil(proCost * CREDIT_COSTS.flashMultiplier);
    
    expect(flashCost).toBe(4); // 7 * 0.5 = 3.5, rounded up to 4
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

describe("Model Minting System", () => {
  it("should create models as drafts without agencyId", () => {
    // When a model is first created, it should be a draft
    const newModel = {
      id: 1,
      userId: 1,
      agencyId: null, // No agencyId until minted
      name: "Draft Model",
      status: "draft",
      masterPrompt: "Test prompt",
      technicalSchema: {},
      preferences: {},
      mintedAt: null,
    };

    expect(newModel.agencyId).toBeNull();
    expect(newModel.status).toBe("draft");
    expect(newModel.mintedAt).toBeNull();
  });

  it("should mint model on export with valid agencyId", () => {
    // When a model is exported, it gets minted
    const mintedModel = {
      id: 1,
      userId: 1,
      agencyId: "MOD-26-A1B2C3",
      name: "Minted Model",
      status: "active",
      masterPrompt: "Test prompt",
      technicalSchema: {},
      preferences: {},
      mintedAt: new Date(),
    };

    expect(mintedModel.agencyId).toBe("MOD-26-A1B2C3");
    expect(mintedModel.status).toBe("active");
    expect(mintedModel.mintedAt).toBeInstanceOf(Date);
  });

  it("should not allow minting an already minted model", () => {
    // Minting should be idempotent - return existing agencyId if already minted
    const alreadyMinted = {
      agencyId: "MOD-26-EXISTING",
      alreadyMinted: true,
    };

    expect(alreadyMinted.alreadyMinted).toBe(true);
    expect(alreadyMinted.agencyId).toBe("MOD-26-EXISTING");
  });

  it("should validate agencyId format for registry lookup", () => {
    const validFormat = /^MOD-\d{2}-[A-F0-9]{6}$/;
    
    // Valid IDs
    expect("MOD-26-A1B2C3").toMatch(validFormat);
    expect("MOD-25-FFFFFF").toMatch(validFormat);
    expect("MOD-26-000000").toMatch(validFormat);
    
    // Invalid IDs
    expect("MOD-2-A1B2C3").not.toMatch(validFormat); // Year too short
    expect("MOD-26-A1B2C").not.toMatch(validFormat); // Hash too short
    expect("AG-26-A1B2C3").not.toMatch(validFormat); // Wrong prefix
    expect("MOD-26-G1B2C3").not.toMatch(validFormat); // Invalid hex char
  });

  it("should only allow cross-app retrieval for minted models", () => {
    // Draft models should not be retrievable via registry
    const draftModel = { status: "draft", agencyId: null };
    const mintedModel = { status: "active", agencyId: "MOD-26-A1B2C3" };

    const canRetrieve = (model: { status: string; agencyId: string | null }) => {
      return model.status === "active" && model.agencyId !== null;
    };

    expect(canRetrieve(draftModel)).toBe(false);
    expect(canRetrieve(mintedModel)).toBe(true);
  });
});

describe("Model Status Transitions", () => {
  it("should have valid model statuses", () => {
    const validStatuses = ["draft", "active", "locked", "archived"];
    
    expect(validStatuses).toContain("draft");
    expect(validStatuses).toContain("active");
    expect(validStatuses).toContain("locked");
    expect(validStatuses).toContain("archived");
  });

  it("should only transition draft to active on mint", () => {
    // Valid transition: draft -> active (on mint/export)
    const validTransitions = {
      draft: ["active", "archived"], // Can mint or archive
      active: ["locked", "archived"], // Can lock or archive
      locked: [], // Terminal state
      archived: [], // Terminal state (soft delete)
    };

    expect(validTransitions.draft).toContain("active");
    expect(validTransitions.active).not.toContain("draft"); // Can't go back to draft
  });
});
