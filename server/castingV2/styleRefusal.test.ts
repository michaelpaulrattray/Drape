import { describe, expect, it } from "vitest";

import { castingBriefCompiler } from "./briefCompiler";
import { parseCastingIntent } from "./castingIntent";
import type { TextEngine } from "../providers/types";

/**
 * A stated visual style is never silently dropped.
 *
 * The defect this pins: "young anime character" produced a full photoreal roll
 * and charged 160 credits for output that ignored a stated fact. The model had
 * correctly answered `cohort: "other"` — but it also sent `"reads": null`, the
 * wire schema declared that field `.optional()` rather than `.nullable()`, and
 * a bare `.optional()` rejects null. The whole reply failed validation, the
 * caller read that as "interpreter unavailable", and the fallback cast the
 * brief as a photoreal human.
 *
 * Two independent guards, tested separately, because either alone would have
 * let it through:
 *   1. The schema tolerates null everywhere, so a correct refusal is never
 *      discarded on a technicality.
 *   2. The fallback screens the brief itself, so an interpreter outage cannot
 *      become a photoreal charge for a styled brief.
 */

function engineReturning(text: string): TextEngine {
  return {
    id: "test:interpreter",
    complete: async () => ({
      text,
      latencyMs: 5,
      provenance: { provider: "openrouter" as const, model: "test", servedModel: "test" },
    }),
  };
}

/** An engine that always fails — the outage the fallback is written for. */
const deadEngine: TextEngine = {
  id: "test:dead",
  complete: async () => {
    throw new Error("transport is down");
  },
};

const STYLED_BRIEFS = [
  "young anime character",
  "anime girl",
  "an anime swordswoman with silver hair",
  "a cartoon character",
  "cel-shaded cybernetic bounty hunter",
  "manga protagonist, spiky hair",
  "illustrated portrait of a woman",
  "a painterly character study",
  "comic book hero, square jaw",
  "3D render of a young man",
  "a chibi mascot",
  "Pixar-style dad",
];

describe("a null in the reply never discards it", () => {
  it("parses a refusal whose optional fields came back null", () => {
    // The exact shape that was thrown away: correct cohort, null everywhere else.
    const parsed = parseCastingIntent(
      JSON.stringify({
        cohort: "other",
        role: null,
        characterNotes: null,
        sex: null,
        ageBand: null,
        agePhase: null,
        heritage: null,
        build: null,
        energy: null,
        archetype: null,
        variationAxis: null,
        look: null,
        reads: null,
      }),
    );
    expect(parsed).toEqual({ ok: false, reason: "unsupported_cohort" });
  });

  it("still parses a photoreal reply whose arrays came back null", () => {
    const parsed = parseCastingIntent(
      JSON.stringify({ cohort: "photoreal_human", role: "a dad", heritage: null, reads: null }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.heritage).toEqual([]);
    expect(parsed.intent.reads).toEqual([]);
  });
});

describe("stated style refuses, across phrasings", () => {
  it.each(STYLED_BRIEFS)("refuses %j when the interpreter identifies it", async (brief) => {
    const compile = castingBriefCompiler({
      briefText: brief,
      candidateCount: 8,
      rollSeed: "style",
      engine: engineReturning(JSON.stringify({ cohort: "other", reads: null })),
    });
    await expect(compile).rejects.toMatchObject({ code: "unsupported_cohort" });
  });

  it.each(STYLED_BRIEFS)(
    "refuses %j even when the interpreter is down entirely",
    async (brief) => {
      /*
        The guard that matters most. Without it, every one of these becomes a
        photoreal roll the user pays for — which is the shape of the original
        defect, since a schema failure and an outage are the same outcome to
        the caller.
      */
      const compile = castingBriefCompiler({
        briefText: brief,
        candidateCount: 8,
        rollSeed: "style",
        engine: deadEngine,
      });
      await expect(compile).rejects.toMatchObject({ code: "unsupported_cohort" });
    },
  );

  it("still casts an ordinary brief when the interpreter is down", async () => {
    // The fallback must stay open for everything else: an outage should never
    // cost someone a roll they could have had.
    const compiled = await castingBriefCompiler({
      briefText: "a retired boxer with a broken nose",
      candidateCount: 8,
      rollSeed: "style",
      engine: deadEngine,
    });
    expect(compiled.candidates).toHaveLength(8);
  });
});
