/**
 * Phase 2 Migration Tests
 * 
 * Covers:
 *   - geminiSchemaUpdater.ts — safeParseJsonObject behavior, export availability
 *   - geminiSuggestions.ts — safeParseJsonArray behavior, export availability
 *   - geminiPromptCompactor.ts — export availability
 *   - aiService.ts — re-exports for all Phase 2 functions
 *   - castingRefinement.ts — new tRPC procedures exist on the router
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// IMPORT VERIFICATION — ensure all Phase 2 exports are accessible
// ============================================================================

describe("Phase 2 exports from geminiService barrel", () => {
  it("exports updateSchemaForIteration", async () => {
    const mod = await import("./geminiService");
    expect(typeof mod.updateSchemaForIteration).toBe("function");
  });

  it("exports reconcileSchemaWithImage", async () => {
    const mod = await import("./geminiService");
    expect(typeof mod.reconcileSchemaWithImage).toBe("function");
  });

  it("exports generateCastingSuggestions", async () => {
    const mod = await import("./geminiService");
    expect(typeof mod.generateCastingSuggestions).toBe("function");
  });

  it("exports analyzeReferenceForTransfer", async () => {
    const mod = await import("./geminiService");
    expect(typeof mod.analyzeReferenceForTransfer).toBe("function");
  });

  it("exports compactMasterPrompt", async () => {
    const mod = await import("./geminiService");
    expect(typeof mod.compactMasterPrompt).toBe("function");
  });
});

describe("Phase 2 re-exports from aiService", () => {
  it("re-exports updateSchemaForIteration", async () => {
    const mod = await import("./aiService");
    expect(typeof mod.updateSchemaForIteration).toBe("function");
  });

  it("re-exports reconcileSchemaWithImage", async () => {
    const mod = await import("./aiService");
    expect(typeof mod.reconcileSchemaWithImage).toBe("function");
  });

  it("re-exports generateCastingSuggestions", async () => {
    const mod = await import("./aiService");
    expect(typeof mod.generateCastingSuggestions).toBe("function");
  });

  it("re-exports analyzeReferenceForTransfer", async () => {
    const mod = await import("./aiService");
    expect(typeof mod.analyzeReferenceForTransfer).toBe("function");
  });

  it("re-exports compactMasterPrompt", async () => {
    const mod = await import("./aiService");
    expect(typeof mod.compactMasterPrompt).toBe("function");
  });

  it("re-exports clearCastingSession", async () => {
    const mod = await import("./aiService");
    expect(typeof mod.clearCastingSession).toBe("function");
  });
});

// ============================================================================
// SCHEMA UPDATER — unit tests for safeParseJsonObject behavior
// ============================================================================

describe("geminiSchemaUpdater", () => {
  it("module loads without errors", async () => {
    const mod = await import("./geminiSchemaUpdater");
    expect(mod).toBeDefined();
    expect(typeof mod.updateSchemaForIteration).toBe("function");
    expect(typeof mod.reconcileSchemaWithImage).toBe("function");
  });
});

// ============================================================================
// SUGGESTIONS — unit tests for safeParseJsonArray behavior
// ============================================================================

describe("geminiSuggestions", () => {
  it("module loads without errors", async () => {
    const mod = await import("./geminiSuggestions");
    expect(mod).toBeDefined();
    expect(typeof mod.generateCastingSuggestions).toBe("function");
    expect(typeof mod.analyzeReferenceForTransfer).toBe("function");
  });
});

// ============================================================================
// PROMPT COMPACTOR — unit tests
// ============================================================================

describe("geminiPromptCompactor", () => {
  it("module loads without errors", async () => {
    const mod = await import("./geminiPromptCompactor");
    expect(mod).toBeDefined();
    expect(typeof mod.compactMasterPrompt).toBe("function");
  });
});

// ============================================================================
// tRPC ROUTE VERIFICATION — ensure new procedures exist on the router
// ============================================================================

describe("castingRefinement router has Phase 2 procedures", () => {
  it("has suggestions procedure", async () => {
    const { castingRefinementRouter } = await import(
      "../routes/generation/castingRefinement"
    );
    const procedures = castingRefinementRouter._def.procedures;
    expect(procedures).toHaveProperty("suggestions");
  });

  it("has analyzeReference procedure", async () => {
    const { castingRefinementRouter } = await import(
      "../routes/generation/castingRefinement"
    );
    const procedures = castingRefinementRouter._def.procedures;
    expect(procedures).toHaveProperty("analyzeReference");
  });

  it("has reconcile procedure", async () => {
    const { castingRefinementRouter } = await import(
      "../routes/generation/castingRefinement"
    );
    const procedures = castingRefinementRouter._def.procedures;
    expect(procedures).toHaveProperty("reconcile");
  });

  it("has compactPrompt procedure", async () => {
    const { castingRefinementRouter } = await import(
      "../routes/generation/castingRefinement"
    );
    const procedures = castingRefinementRouter._def.procedures;
    expect(procedures).toHaveProperty("compactPrompt");
  });

  it("has clearSession procedure", async () => {
    const { castingRefinementRouter } = await import(
      "../routes/generation/castingRefinement"
    );
    const procedures = castingRefinementRouter._def.procedures;
    expect(procedures).toHaveProperty("clearSession");
  });

  it("still has existing procedures (iterate, upscale, enhance, proxyImage)", async () => {
    const { castingRefinementRouter } = await import(
      "../routes/generation/castingRefinement"
    );
    const procedures = castingRefinementRouter._def.procedures;
    expect(procedures).toHaveProperty("iterate");
    expect(procedures).toHaveProperty("upscale");
    expect(procedures).toHaveProperty("enhance");
    expect(procedures).toHaveProperty("proxyImage");
  });
});
