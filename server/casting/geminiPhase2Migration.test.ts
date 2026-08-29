/**
 * Phase 2 Migration Tests — EXPORT AVAILABILITY, and that is the whole of it.
 *
 * ⚠ THIS DOCBLOCK CLAIMED BEHAVIOUR COVERAGE THIS FILE HAS NEVER HAD, AND TWO
 * LIVE DEFECTS SAT UNDER THE CLAIM. It read:
 *
 *     - geminiSchemaUpdater.ts — safeParseJsonObject behavior, export availability
 *     - geminiSuggestions.ts   — safeParseJsonArray behavior, export availability
 *
 * Both parsers are module-private and neither had a single behaviour arm
 * anywhere in the repository. Driven 2026-08-25, `safeParseJsonObject` let a
 * bare JSON string, a bare number and an array each REPLACE a cast's
 * `technicalSchema`, against this module's own documented DR-15 fail-safe.
 * **It is not that nobody wrote the tests — the file said someone had**, and
 * a label is what a reader greps.
 *
 * The arms here are honest and worth keeping: a broken barrel re-export or a
 * procedure dropped from the router really does redden them. They prove
 * IMPORTS. Behaviour lives in the files named below.
 *
 * Covers:
 *   - geminiSchemaUpdater.ts    — export availability
 *     (behaviour: `geminiSchemaUpdater.test.ts`)
 *   - geminiSuggestions.ts      — export availability
 *     (behaviour: `geminiSuggestions.test.ts`)
 *   - geminiPromptCompactor.ts  — export availability
 *   - aiService.ts              — re-exports for all Phase 2 functions
 *   - castingRefinement.ts      — new tRPC procedures exist on the router
 */

import { describe, it, expect } from "vitest";

import { allowColdImports } from "../testing/suiteClocks";

/* This file's tests are dominated by cold module loading, not by logic —
   see `suiteClocks.ts` for the flake this ends and why the raise is
   here rather than global (fable-233 §5). */
allowColdImports();

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
// SCHEMA UPDATER — export availability only.
// safeParseJsonObject's behaviour is driven in `geminiSchemaUpdater.test.ts`;
// this header used to claim it and the arm below only ever proved an import.
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
// SUGGESTIONS — export availability only.
// safeParseJsonArray's behaviour is driven in `geminiSuggestions.test.ts`;
// this header used to claim it and the arm below only ever proved an import.
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
// PROMPT COMPACTOR — export availability only. The arm below proves an
// import; "unit tests" is what this header used to say, which is the same
// false-label shape as the two sections above it.
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

  it("keeps supported procedures and permanently closes the retired raw-URL upscale door", async () => {
    const { castingRefinementRouter } = await import(
      "../routes/generation/castingRefinement"
    );
    const procedures = castingRefinementRouter._def.procedures;
    expect(procedures).toHaveProperty("iterate");
    expect(procedures).not.toHaveProperty("upscale");
    expect(procedures).toHaveProperty("enhance");
    expect(procedures).toHaveProperty("proxyImage");
  });
});
