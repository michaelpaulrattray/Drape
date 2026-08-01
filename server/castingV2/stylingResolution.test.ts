import { describe, expect, it } from "vitest";

import {
  BIAS_DEFERRAL_CLAUSE,
  FLAVOURED_ARCHETYPES,
  FLAVOURED_LOOKS,
  hasCreativeContext,
  stylingResolutionFor,
} from "./stylingResolution";
import { castingBriefCompiler, deterministicBriefCompiler } from "./briefCompiler";
import { ARCHETYPE_KEYS, type CastingIntent } from "./castingIntent";
import type { TextEngine } from "../providers/types";

/**
 * Styling realization is subordinate to creative context; biology is not.
 *
 * Founder ruling after a Fable review. A prescribed cut competes with the
 * category the user asked for and wins, being the more specific instruction —
 * "a 30 year old heavy metal bogan" plus "a brown straight french crop" is a
 * sheet arguing with itself. So under context the styling axes degrade to
 * silhouette-and-length pressure phrased subordinate to the casting.
 *
 * Precedence: stated > category > styling-bias > prior.
 */

function engineReturning(wire: Record<string, unknown>): TextEngine {
  return {
    id: "test",
    complete: async () => ({
      text: JSON.stringify({ cohort: "photoreal_human", ...wire }),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
    }),
  } as unknown as TextEngine;
}

/**
 * The authored hair line only.
 *
 * Never search the whole prompt for a style name: the framing block already
 * says "including afros, curls, volume, updos, buns", so "afro" is present on
 * every prompt ever composed and a whole-prompt assertion proves nothing.
 */
function hairLineOf(prompt: string): string {
  const cleaned = prompt.split("FACIAL HAIR:").join("FH:");
  const at = cleaned.indexOf(" HAIR: ");
  if (at < 0) return "";
  return cleaned.slice(at, cleaned.indexOf(".", at) + 1);
}

/** A genuinely context-free intent: no role, no stated direction. */
function contextFreeEngine(): TextEngine {
  return engineReturning({ role: null, archetype: null, look: null, variationAxis: null });
}

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

describe("which directions claim the styling axes", () => {
  it("derives the flavoured set from the shelves' own prose", () => {
    /*
      Computed, not curated, for the same reason heritage neighbourhoods are: a
      hand-kept list rots the moment somebody edits an entry, and it states a
      judgment about the shelf that the shelf should carry itself.

      Pinned so the founder ratifies the OUTCOME. An edit that changes which
      directions claim grooming fails here and asks for a ruling.
    */
    expect(Array.from(FLAVOURED_ARCHETYPES).sort()).toEqual(["quiet luxury", "street cast"]);
    expect(Array.from(FLAVOURED_LOOKS).sort()).toEqual(["quiet luxury", "raw street-cast"]);
  });

  it("does not count a prohibition as a claim", () => {
    /*
      "Everyday real" says *do not render as a model with dressed-down styling*
      — the shelf refusing a styling idea, not owning one. Scanning the whole
      entry put it in the flavoured set, which is wrong.
    */
    expect(FLAVOURED_ARCHETYPES.has("everyday real")).toBe(false);
  });

  it("leaves most directions neutral, so most briefs keep full realization", () => {
    const neutral = ARCHETYPE_KEYS.filter((key) => !FLAVOURED_ARCHETYPES.has(key));
    expect(neutral.length).toBeGreaterThan(FLAVOURED_ARCHETYPES.size);
  });
});

describe("what counts as creative context", () => {
  it("counts a stated role", () => {
    expect(hasCreativeContext(intentOf({ role: "heavy metal bogan" }))).toBe(true);
  });

  it("counts a stated flavoured direction and ignores a neutral one", () => {
    expect(hasCreativeContext(intentOf({ archetype: "street cast" }))).toBe(true);
    expect(hasCreativeContext(intentOf({ archetype: "clean commercial" }))).toBe(false);
  });

  it("reads the STATED intent, never the resolved archetype", async () => {
    /*
      The trap this avoids: `resolveArchetype` always returns a direction, so
      reading the resolved value would put every context-free brief into bias
      mode whenever the roll happened to draw a flavoured one. The restraint
      doctrine gives the right signal for free — non-null means the brief said
      it.
    */
    const compiled = await castingBriefCompiler({
      briefText: "someone in their 30s",
      candidateCount: 8,
      rollSeed: "resolved-archetype",
      engine: contextFreeEngine(),
    });
    // Whatever direction the roll drew, a context-free brief keeps named cuts.
    for (const candidate of compiled.candidates) {
      expect(hairLineOf(candidate.prompt)).toContain(candidate.resolvedIdentity.realized.hairStyle.name);
    }
  });

  it("treats the interpreter-outage fallback as context, because it is the user's own sentence", async () => {
    /*
      `fallbackIntent` sets `role` to the brief text itself, so the fallback
      path is always in bias mode. That is the right reading rather than an
      accident: the whole sentence IS the creative context, and prescribing a
      cut over it would contradict whatever the user wrote.
    */
    const compiled = await deterministicBriefCompiler({
      briefText: "a 30 year old heavy metal bogan",
      candidateCount: 8,
      rollSeed: "fallback-bias",
    });
    for (const candidate of compiled.candidates) {
      expect(hairLineOf(candidate.prompt)).toContain(BIAS_DEFERRAL_CLAUSE);
    }
  });

  it("puts stated hair above everything", () => {
    expect(
      stylingResolutionFor({ intent: intentOf({ role: "bogan" }), briefStatesHair: true }),
    ).toBe("stated");
    expect(
      stylingResolutionFor({ intent: intentOf({ role: "bogan" }), briefStatesHair: false }),
    ).toBe("bias");
    expect(stylingResolutionFor({ intent: intentOf({}), briefStatesHair: false })).toBe("prescribe");
  });
});

describe("bias mode composes with the category instead of contradicting it", () => {
  async function biasSheet(brief: string, rollSeed: string) {
    return castingBriefCompiler({
      briefText: brief,
      candidateCount: 8,
      rollSeed,
      engine: engineReturning({ role: brief, variationAxis: null }),
    });
  }

  it("never names a cut", async () => {
    /*
      Against the HAIR line, not the whole prompt. The framing block already
      says "including afros, curls, volume, updos, buns", so a whole-prompt
      search collides with the constant and asserts nothing.
    */
    for (let roll = 0; roll < 40; roll += 1) {
      const compiled = await biasSheet("a 30 year old heavy metal bogan", `bogan-${roll}`);
      for (const candidate of compiled.candidates) {
        const line = hairLineOf(candidate.prompt);
        expect(line).not.toBe("");
        expect(line).not.toContain(candidate.resolvedIdentity.realized.hairStyle.name);
      }
    }
  });

  it("names a renderable silhouette and defers only its character", async () => {
    /*
      The correction after the first bogan sheet: a line that defers everything
      renders as the model's own default. The silhouette is concrete; what the
      casting owns is whether it reads sharp or grown out.
    */
    const compiled = await biasSheet("a 30 year old heavy metal bogan", "bogan-prose");
    for (const candidate of compiled.candidates) {
      const line = hairLineOf(candidate.prompt);
      expect(line).toContain(BIAS_DEFERRAL_CLAUSE);
      // Something a camera can act on, not only a deferral.
      expect(line.replace(BIAS_DEFERRAL_CLAUSE, "").length).toBeGreaterThan(60);
    }
  });

  it("makes no comparative claim the prompt cannot keep", async () => {
    /*
      "Worn longer than the others" is unkeepable: the image model renders one
      candidate and never sees the other seven. The bias is absolute, phrased
      against the casting's own envelope.
    */
    const compiled = await biasSheet("a 30 year old heavy metal bogan", "bogan-absolute");
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt).not.toContain("than the others");
      expect(candidate.prompt).not.toContain("than most");
    }
  });

  it("still carries colour, which is not a styling axis", async () => {
    // It is the only separator a sheet of women has under the twin rule.
    const compiled = await biasSheet("a 30 year old heavy metal bogan", "bogan-colour");
    for (const candidate of compiled.candidates) {
      const colour = candidate.resolvedIdentity.hair?.colour;
      if (colour) expect(candidate.prompt).toContain(colour);
    }
  });

  it("keeps at least four distinct silhouettes — the founder's bar", async () => {
    for (let roll = 0; roll < 60; roll += 1) {
      const compiled = await biasSheet("a 30 year old heavy metal bogan", `bogan-silhouette-${roll}`);
      const families = new Set(
        compiled.candidates.map((c) => c.resolvedIdentity.realized.hairStyle.family),
      );
      expect(families.size, `roll ${roll}`).toBeGreaterThanOrEqual(4);
    }
  });

  it("degrades facial hair to whether, not which", async () => {
    const compiled = await biasSheet("a 30 year old heavy metal bogan", "bogan-beard");
    const lines = compiled.candidates
      .map((c) => c.prompt.match(/FACIAL HAIR: [^.]*\./)?.[0] ?? "")
      .filter(Boolean);
    for (const line of lines) {
      // The six-value enum must not survive into the prompt.
      for (const value of ["light stubble", "heavy stubble", "short beard", "full beard", "moustache"]) {
        expect(line, line).not.toContain(value);
      }
    }
  });
});

describe("biology authors identically in every mode", () => {
  it("keeps eye colour, brow character and skin character under context", async () => {
    /*
      No creative direction implies them, so a named cast direction and a
      realized eye colour can never disagree — which is exactly why they do not
      degrade.
    */
    const compiled = await castingBriefCompiler({
      briefText: "a 30 year old heavy metal bogan",
      candidateCount: 8,
      rollSeed: "bogan-biology",
      engine: engineReturning({ role: "a 30 year old heavy metal bogan" }),
    });
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt).toContain("EYE COLOUR:");
      expect(candidate.prompt).toContain("BROW CHARACTER:");
    }
  });
});

describe("the context-free path is untouched", () => {
  it("still prescribes a named cut and its closing sentence", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "someone in their 30s",
      candidateCount: 8,
      rollSeed: "neutral-path",
      engine: contextFreeEngine(),
    });
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt).toContain("Cut and worn as that style is genuinely worn");
      expect(hairLineOf(candidate.prompt)).toContain(candidate.resolvedIdentity.realized.hairStyle.name);
      expect(candidate.prompt).not.toContain(BIAS_DEFERRAL_CLAUSE);
    }
  });
});
