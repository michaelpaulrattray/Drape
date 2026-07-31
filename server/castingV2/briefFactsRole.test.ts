import { describe, expect, it } from "vitest";

import { readBriefFacts } from "./rollProjection";
import { castingBriefCompiler } from "./briefCompiler";
import type { TextEngine } from "../providers/types";

/**
 * The casting category must reach the echo.
 *
 * Founder's round-6 finding: "a runway model early 20s" echoed with no mention
 * of the category. The interpreter was innocent — it captured
 * `role: "runway model"` on that brief and on every phrasing tried live. The
 * break was here, in the projection: the echo's facts were read from
 * `lockContract`, which is the VALIDATOR's input and has no role field, because
 * the validator compares enum values and a category is free text.
 *
 * So the loudest lock on the sheet — the one the prompt carries as "CASTING
 * CATEGORY (ABSOLUTE)" — was the one fact the sentence could not see. This
 * pins the seam.
 */

function engineReturning(role: string | null): TextEngine {
  return {
    id: "test:interpreter",
    complete: async () => ({
      text: JSON.stringify({ cohort: "photoreal_human", role, variationAxis: "look", reads: null }),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
    }),
  };
}

const PHRASINGS = ["a runway model", "runway model", "catwalk model", "high-fashion model"];

describe("readBriefFacts surfaces the category", () => {
  it.each(PHRASINGS)("compiling %j puts the category where the echo can see it", async (phrase) => {
    const compiled = await castingBriefCompiler({
      briefText: `${phrase} early 20s`,
      candidateCount: 8,
      rollSeed: `role:${phrase}`,
      engine: engineReturning(phrase.replace(/^an? /, "")),
    });
    const facts = readBriefFacts(compiled.lockContract, compiled.compiledBrief);
    expect(facts.role).toBe(phrase.replace(/^an? /, ""));
  });

  it("is null when the brief named no category, rather than inventing one", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "someone in their 30s",
      candidateCount: 8,
      rollSeed: "no-role",
      engine: engineReturning(null),
    });
    expect(readBriefFacts(compiled.lockContract, compiled.compiledBrief).role).toBeNull();
  });

  it("bounds and flattens the category, because it is the one free-text field here", () => {
    // Everything else in this projection is enum-checked. This one cannot be,
    // so it is capped and stripped instead of trusted.
    const facts = readBriefFacts(
      {},
      { intent: { role: `  a very\n\tlong   category ${"x".repeat(200)}  ` } },
    );
    expect(facts.role!.length).toBeLessThanOrEqual(60);
    expect(facts.role).not.toMatch(/[\n\t]/);
    expect(facts.role!.startsWith("a very long category")).toBe(true);
  });
});
