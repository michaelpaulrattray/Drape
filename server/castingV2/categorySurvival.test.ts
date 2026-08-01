import { describe, expect, it } from "vitest";

import { promoteStatedRole } from "./heritagePromotion";
import { castingBriefCompiler } from "./briefCompiler";
import { GOLDEN_BRIEFS } from "./goldenBriefs";
import type { CastingIntent } from "./castingIntent";
import type { TextEngine } from "../providers/types";

/**
 * The category must reach the sheet.
 *
 * Founder incident: "female mid 20's high-fashion editorial model" persisted
 * `role: null` with `archetype: "raw editorial"` — the category routed into the
 * closed direction vocabulary and the user's own words dropped. `role` is the
 * only field that produces the CASTING CATEGORY block, so the sheet came back
 * as generic women and gate B5's category-owns-physique rule never fired.
 *
 * The interpreter instruction that caused it has been rewritten — it called
 * `role` "the archetype in the user's own words" while a separate `archetype`
 * field held an enum, and told the model to drop a phrase that "is not specific
 * enough", which a fashion category reads as. But a prompt is a probability.
 * These tests cover the DETERMINISTIC half: the repair, which does not care
 * what the model returned.
 *
 * The live half is `scripts/drive-golden-briefs.mts`. It is a driver rather
 * than a test because it spends money — and it exists because the previous
 * regression hid behind stubs that supplied the very fact the bug removed.
 */

function intentOf(partial: Partial<CastingIntent>): CastingIntent {
  return {
    cohort: "photoreal_human",
    role: null,
    characterNotes: null,
    sex: null,
    ageBand: null,
    agePhase: null,
    heritage: [],
    build: null,
    energy: null,
    archetype: null,
    variationAxis: null,
    look: null,
    reads: [],
    ...partial,
  } as CastingIntent;
}

describe("the deterministic category repair", () => {
  it("restores the category when the interpreter recognised a casting context and dropped it", () => {
    // The exact production shape: a direction was set, the category was not.
    const repaired = promoteStatedRole(
      intentOf({ archetype: "raw editorial", variationAxis: "look" }),
      "female mid 20's high-fashion editorial model",
    );
    expect(repaired.role).toBe("female mid 20's high-fashion editorial model");
  });

  it("fires on the look axis alone, without an archetype", () => {
    const repaired = promoteStatedRole(intentOf({ variationAxis: "look" }), "An East Asian model");
    expect(repaired.role).toBe("An East Asian model");
  });

  it("never overrides a role the interpreter did capture", () => {
    // A backstop that could contradict the interpreter would be a second
    // opinion, not a backstop — the same rule the heritage repair follows.
    const repaired = promoteStatedRole(
      intentOf({ role: "punk drummer", archetype: "street cast" }),
      "a punk drummer in a basement venue",
    );
    expect(repaired.role).toBe("punk drummer");
  });

  it("leaves a genuinely category-less brief alone", () => {
    /*
      This is the half that keeps the rule honest. A null role is what lets
      build vary, so backfilling every null would quietly stop physique varying
      on exactly the briefs that have no category to own it (gate B5).
    */
    const repaired = promoteStatedRole(intentOf({}), "someone with kind eyes");
    expect(repaired.role).toBeNull();
  });
});

describe("every golden brief with a category keeps it", () => {
  /*
    Driven through the real compiler with the interpreter's WORST plausible
    answer — it recognised a casting context and returned no category at all.
    If the repair regresses, every one of these fails.
  */
  function droppingEngine(): TextEngine {
    return {
      id: "drops-the-category",
      complete: async () => ({
        text: JSON.stringify({
          cohort: "photoreal_human",
          role: null,
          characterNotes: null,
          archetype: "raw editorial",
          variationAxis: "look",
        }),
        latencyMs: 1,
        provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
      }),
    } as unknown as TextEngine;
  }

  const categoryBriefs = GOLDEN_BRIEFS.filter((golden) => golden.category);

  it.each(categoryBriefs.map((g) => g.brief))(
    "keeps the category in all eight prompts — %j",
    async (brief) => {
      const compiled = await castingBriefCompiler({
        briefText: brief,
        candidateCount: 8,
        rollSeed: `category-${brief}`,
        engine: droppingEngine(),
      });
      const intent = (compiled.compiledBrief as { intent?: { role?: string | null } }).intent ?? {};
      expect(intent.role, "role was dropped and not repaired").toBeTruthy();
      for (const candidate of compiled.candidates) {
        expect(candidate.prompt).toContain("CASTING CATEGORY");
        expect(candidate.prompt).toContain(intent.role!);
      }
    },
  );

  it("keeps the counter-case null, so the assertion cannot be satisfied by backfilling everything", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "a redhead in her 30s",
      candidateCount: 8,
      rollSeed: "counter",
      engine: {
        id: "no-context",
        complete: async () => ({
          text: JSON.stringify({ cohort: "photoreal_human", role: null, archetype: null, variationAxis: null }),
          latencyMs: 1,
          provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
        }),
      } as unknown as TextEngine,
    });
    const intent = (compiled.compiledBrief as { intent?: { role?: string | null } }).intent ?? {};
    expect(intent.role ?? null).toBeNull();
  });
});
