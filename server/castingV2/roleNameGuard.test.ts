import { describe, expect, it } from "vitest";

import { namesUnknownProperNoun } from "./properNouns";
import { promoteStatedRole } from "./heritagePromotion";
import { castingBriefCompiler } from "./briefCompiler";
import type { CastingIntent } from "./castingIntent";
import type { TextEngine } from "../providers/types";

/**
 * A name never becomes a casting category.
 *
 * Gate 21 the first time was a fashion-house list, because a house name in
 * `role` was how it presented. The second occurrence was a DIRECTOR, put there
 * by our own repair, and no list was ever going to hold it: measured live on "a
 * Wes Anderson casting, mid 30s", the interpreter returned `role: null` six
 * times out of six, and `promoteStatedRole` then promoted the whole brief into
 * `CASTING CATEGORY (ABSOLUTE)` on every candidate of the roll.
 */

const BASE = {
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
  variationAxis: "look",
  look: null,
  reads: null,
  composedDirection: null,
} as unknown as CastingIntent;

describe("the listless proper-noun test", () => {
  it("catches a name our vocabularies do not claim", () => {
    expect(namesUnknownProperNoun("a Wes Anderson casting, mid 30s", { mode: "phrase" })).toBe(true);
  });

  it("catches a LEADING name, which the brief-side variant is allowed to miss", () => {
    // The advisor's catch. A role is not a sentence: "Zendaya lookalike" leads
    // with the name, so the sentence-initial exemption would wave it through.
    expect(namesUnknownProperNoun("Zendaya lookalike", { mode: "sentence" })).toBe(false);
    expect(namesUnknownProperNoun("Zendaya lookalike", { mode: "phrase" })).toBe(true);
  });

  it("leaves real categories alone — including the ones carrying ages", () => {
    for (const role of [
      "high-fashion editorial model",
      "skincare founder",
      "a dad in his 30s",
      "runway model, early 20s",
      "beauty creator",
      "heavy metal bogan",
      "wiry cyclist",
    ]) {
      expect(namesUnknownProperNoun(role, { mode: "phrase" })).toBe(false);
    }
  });

  it("does not read a LEADING ARTICLE as a name", () => {
    /*
      Caught by the suite, not by review. "An East Asian model" is a founder's
      own golden, and reading its capitalized article as an unknown name nulled
      the category — reopening the exact category-drop bug the repair exists to
      close. An over-reaching guard is not the safe direction here; it is the
      original defect wearing the fix's clothes.
    */
    expect(namesUnknownProperNoun("An East Asian model", { mode: "phrase" })).toBe(false);
    expect(namesUnknownProperNoun("The wiry cyclist", { mode: "phrase" })).toBe(false);
    // And the article must not become a hiding place.
    expect(namesUnknownProperNoun("A Wes Anderson casting", { mode: "phrase" })).toBe(true);
  });

  it("does not read our own vocabulary words as names", () => {
    // "A Mediterranean man" states a heritage we model; capitalized, but ours.
    expect(namesUnknownProperNoun("Mediterranean male model", { mode: "phrase" })).toBe(false);
  });
});

describe("the repair declines rather than promoting a name", () => {
  it("refuses the brief that put a director in the category block", () => {
    const out = promoteStatedRole(BASE, "a Wes Anderson casting, mid 30s");
    expect(out.role).toBeNull();
  });

  it("still promotes a category carrying a HOUSE, because the scrub handles that", () => {
    /*
      The other over-reach the suite caught. A brand is not a name the guard has
      to refuse — `scrubBrands` removes it and keeps the sentence, which is gate
      21's actual promise. Declining on the raw words instead killed the
      category on every brand brief, Margiela included, which is the pinned
      anti-regression.
    */
    const out = promoteStatedRole(BASE, "a Margiela runway face, early 20s");
    expect(out.role).toBe("a Margiela runway face, early 20s");
  });

  it("still promotes the category it was built for", () => {
    // The negative control. If this goes null the guard has eaten the repair,
    // and the category-drop bug it exists to fix is back.
    const out = promoteStatedRole(BASE, "female mid 20's high-fashion editorial model");
    expect(out.role).toBe("female mid 20's high-fashion editorial model");
  });
});

/** An interpreter that writes a name into `role` — what the guard is for. */
function engineReturning(intent: Record<string, unknown>): TextEngine {
  return {
    id: "stub",
    complete: async () => ({
      text: JSON.stringify(intent),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
    }),
  } as unknown as TextEngine;
}

describe("the guard is invoked on the real compile path", () => {
  /*
    Invariant 7: a control that is not invoked does not exist. The repair
    declining is not enough on its own — the interpreter is a language model,
    and it wrote "Versace" into `role` unprompted once already.
  */
  it("nulls a name the INTERPRETER wrote, which no repair would have caught", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "a moody portrait, mid 30s",
      candidateCount: 2,
      rollSeed: "guard-1",
      engine: engineReturning({
        cohort: "photoreal_human",
        role: "Wes Anderson casting",
        variationAxis: "disposition",
      }),
    } as never);
    const intent = (compiled.compiledBrief as { intent: CastingIntent }).intent;
    expect(intent.role).toBeNull();
  });

  it("keeps a legitimate category the interpreter wrote", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "a skincare founder in his 40s",
      candidateCount: 2,
      rollSeed: "guard-2",
      engine: engineReturning({
        cohort: "photoreal_human",
        role: "skincare founder",
        variationAxis: "disposition",
      }),
    } as never);
    const intent = (compiled.compiledBrief as { intent: CastingIntent }).intent;
    expect(intent.role).toBe("skincare founder");
  });

  it("keeps the name out of every candidate's prompt, which is the actual promise", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "a moody portrait, mid 30s",
      candidateCount: 4,
      rollSeed: "guard-3",
      engine: engineReturning({
        cohort: "photoreal_human",
        role: "Wes Anderson casting",
        variationAxis: "disposition",
      }),
    } as never);
    const candidates = (compiled as { candidates: Array<{ prompt: string }> }).candidates;
    expect(candidates.length).toBe(4);
    for (const candidate of candidates) {
      expect(candidate.prompt).not.toMatch(/Anderson/i);
    }
  });
});
