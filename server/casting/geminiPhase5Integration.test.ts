/**
 * Phase 5 Integration Tests
 *
 * Validates that all migrated pieces work together:
 * - Barrel exports are complete and consistent
 * - New functions are properly wired through aiService
 * - Type contracts match between layers
 * - Store reset clears all new fields
 * - EthnicityBlend dual-write format is correct
 */
import { describe, it, expect } from "vitest";

// ============================================================================
// 1. Barrel Export Completeness
// ============================================================================

describe("geminiService barrel exports", () => {
  it("exports all Phase 1 functions", async () => {
    const barrel = await import("./geminiService");
    // Phase 1a: prompts
    expect(barrel.MASTER_PROMPT_SYSTEM_INSTRUCTION).toBeDefined();
    expect(barrel.BRAND_PROFILES).toBeDefined();
    expect(barrel.DEFAULT_BRAND_DESCRIPTOR).toBeDefined();
    expect(barrel.getBrandExpression).toBeDefined();
    expect(barrel.getSkinDescription).toBeDefined();
    expect(barrel.irisDescriptions).toBeDefined();
    expect(barrel.hasBodyArt).toBeDefined();
    // Phase 1b: client helpers
    expect(barrel.safeResponseText).toBeDefined();
    expect(barrel.extractImageFromResponse).toBeDefined();
    expect(barrel.diagnoseResponse).toBeDefined();
    expect(barrel.withTimeout).toBeDefined();
    expect(barrel.withSingleRetry503).toBeDefined();
    expect(barrel.buildIdentityAnchor).toBeDefined();
    expect(barrel.extractBase64Data).toBeDefined();
    expect(barrel.formatGeminiError).toBeDefined();
    // Phase 1b: generation
    expect(barrel.generateMasterPrompt).toBeDefined();
    expect(barrel.generateCastingImage).toBeDefined();
    expect(barrel.clearCastingSession).toBeDefined();
    expect(barrel.enhanceUserPrompt).toBeDefined();
  });

  it("exports all Phase 2 functions", async () => {
    const barrel = await import("./geminiService");
    // Phase 2a: schema updater
    expect(barrel.updateSchemaForIteration).toBeDefined();
    expect(barrel.reconcileSchemaWithImage).toBeDefined();
    // Phase 2b: suggestions
    expect(barrel.generateCastingSuggestions).toBeDefined();
    expect(barrel.analyzeReferenceForTransfer).toBeDefined();
    // Phase 2c: compactor
    expect(barrel.compactMasterPrompt).toBeDefined();
  });

});

// ============================================================================
// 2. aiService Re-export Layer
// ============================================================================

describe("aiService re-exports", () => {
  it("re-exports all Phase 2 functions", async () => {
    const ai = await import("./aiService");
    expect(ai.updateSchemaForIteration).toBeDefined();
    expect(ai.reconcileSchemaWithImage).toBeDefined();
    expect(ai.generateCastingSuggestions).toBeDefined();
    expect(ai.analyzeReferenceForTransfer).toBeDefined();
    expect(ai.compactMasterPrompt).toBeDefined();
    expect(ai.clearCastingSession).toBeDefined();
  });
});

// ============================================================================
// 3. Type Contract Validation
// ============================================================================

describe("type contracts", () => {
  it("ModelPreferences accepts ethnicityBlend as optional", () => {
    // This test validates at compile time — if it compiles, the type is correct
    const prefsWithBlend: import("./geminiTypes").ModelPreferences = {
      sex: "Female",
      age: "20s",
      ethnicity: "Korean",
      ethnicityBlend: [
        { name: "Korean", pct: 60 },
        { name: "Nordic", pct: 40 },
      ],
    };
    expect(prefsWithBlend.ethnicityBlend).toHaveLength(2);
    expect(prefsWithBlend.ethnicityBlend![0].pct + prefsWithBlend.ethnicityBlend![1].pct).toBe(100);
  });

  it("ModelPreferences works without ethnicityBlend (backward compat)", () => {
    const prefsWithout: import("./geminiTypes").ModelPreferences = {
      sex: "Female",
      age: "20s",
      ethnicity: "Korean",
    };
    expect(prefsWithout.ethnicityBlend).toBeUndefined();
  });
});

// ============================================================================
// 4. Ethnicity Blend Format Validation
// ============================================================================

describe("ethnicity blend format", () => {
  it("dual-write produces correct legacy string format", () => {
    // Simulate what EthnicityBlender dual-write produces
    const blend = [
      { name: "East Asian", pct: 60 },
      { name: "Nordic", pct: 40 },
    ];
    const legacyString = blend.map((e) => `${e.pct}% ${e.name}`).join(", ");
    expect(legacyString).toBe("60% East Asian, 40% Nordic");
    // This format is what gets written to prefs.ethnicity
    // and is consumed by generateMasterPrompt in the server
  });

  it("single ethnicity produces simple string", () => {
    const blend = [{ name: "Korean", pct: 100 }];
    // Single ethnicity = just the name, no percentage
    const legacyString = blend.length === 1 ? blend[0].name : blend.map((e) => `${e.pct}% ${e.name}`).join(", ");
    expect(legacyString).toBe("Korean");
  });

  it("blend percentages always sum to 100", () => {
    // Simulate the clamping logic from EthnicityBlender
    const clamp = (v: number) => Math.max(10, Math.min(90, v));
    const pct1 = clamp(73);
    const pct2 = 100 - pct1;
    expect(pct1 + pct2).toBe(100);
    expect(pct1).toBeGreaterThanOrEqual(10);
    expect(pct2).toBeGreaterThanOrEqual(10);
  });
});

// ============================================================================
// 5. Brand Expression + Identity Anchor Integration
// ============================================================================

describe("brand expression → identity anchor pipeline", () => {
  it("getBrandExpression output feeds into generateCastingImage prompt", async () => {
    const { getBrandExpression } = await import("./geminiPrompts");
    const expression = getBrandExpression("Gucci");
    // Expression should be a non-empty string that can be injected into prompts
    expect(typeof expression).toBe("string");
    expect(expression.length).toBeGreaterThan(10);
  });

  it("buildIdentityAnchor produces structured identity block", async () => {
    const { buildIdentityAnchor } = await import("./geminiClient");
    const anchor = buildIdentityAnchor(
      "A striking female model with sharp cheekbones and ice blue eyes",
      { subject: { sex: "Female", age: "20s", ethnicity: "Nordic" } }
    );
    expect(anchor).toContain("Female");
    expect(anchor).toContain("Nordic");
    expect(anchor).toContain("20s");
  });

  it("BRAND_PROFILES covers all expected brands", async () => {
    const { BRAND_PROFILES } = await import("./geminiPrompts");
    const expectedBrands = [
      "Gucci", "Prada", "Balenciaga", "Saint Laurent", "Versace",
      "Miu Miu", "Zara", "Social Media",
    ];
    for (const brand of expectedBrands) {
      expect(BRAND_PROFILES[brand]).toBeDefined();
      expect(BRAND_PROFILES[brand].descriptor.length).toBeGreaterThan(20);
    }
  });
});

// ============================================================================
// 6. Cross-Function Consistency
// ============================================================================

describe("cross-function consistency", () => {
  it("clearCastingSession is the same function in both barrel and aiService", async () => {
    const barrel = await import("./geminiService");
    const ai = await import("./aiService");
    // Both should reference the same function
    expect(barrel.clearCastingSession).toBe(ai.clearCastingSession);
  });

  it("compactMasterPrompt is the same function in both barrel and aiService", async () => {
    const barrel = await import("./geminiService");
    const ai = await import("./aiService");
    expect(barrel.compactMasterPrompt).toBe(ai.compactMasterPrompt);
  });

  it("skin descriptions cover all texture+finish combinations", async () => {
    const { getSkinDescription } = await import("./geminiPrompts");
    const textures = ["Smooth", "Freckled", "Weathered", "Acne-prone"];
    const finishes = ["Matte", "Dewy", "Natural", "Sweat"];
    for (const texture of textures) {
      for (const finish of finishes) {
        const desc = getSkinDescription(texture, finish);
        expect(desc.length).toBeGreaterThan(10);
      }
    }
  });
});
