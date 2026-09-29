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

  /*
    SIX ARMS STOOD HERE — the whole of this file's prompt-reading half, every one
    of them asserted against the HAIR line lifted out of a composed prompt by
    `hairLineOf`. The founder ruling underneath them — styling realization is
    subordinate to creative context, biology is not — is a rule about what the
    RESOLVER may prescribe, and the arms that read the resolved identity's tiers
    survive.

    ⚠ **DELETED WITH THE HOUSE ROAD — #1490 act 1, and FOLDED INTO #1125 rather
    than re-pointed.** Every one of these arms asserted that a resolved and
    persisted value left a FOOTPRINT IN THE PER-SLICE COMPOSED PROMPT. The author
    road composes no per-slice prompt: one authored prompt paints all eight and
    the dice records are marked `unsent` (#176), so there is no per-tier sentence
    to look for and nothing for the arm to be right or wrong about.

    ⚠ **THIS IS A FLOOR DROP AND IT IS SAID OUT LOUD.** The class these arms
    guard is the UNOWNED-AXIS COLLAPSE — an axis nobody owns is decided by
    whichever prior is loudest, identically on every tile — and it was caught
    FIVE separate times by the founder's own eye. It is not abandoned: #1125
    (`debt`, `rung:N3`) is exactly this loss, filed by the #180 ghost audit
    BEFORE these arms fell over, and its ruling is that the question — did the
    delivered picture carry what she asked for — is #30's, asked of a FRAME
    rather than of a prompt string.

    What survives in this file is everything that reads the PARSE or the
    RESOLVER directly, which is the half that still decides a real record.
  */

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


  it("keeps at least four distinct silhouettes — the founder's bar", async () => {
    for (let roll = 0; roll < 60; roll += 1) {
      const compiled = await biasSheet("a 30 year old heavy metal bogan", `bogan-silhouette-${roll}`);
      const families = new Set(
        compiled.candidates.map((c) => c.resolvedIdentity.realized.hairStyle!.family),
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

/*
  ⚠ TWO DESCRIBES STOOD HERE AND ARE NOW GONE ENTIRELY — #1490 act 1:
  *"biology authors identically in every mode"* (two arms) and *"the context-free
  path is untouched"* (two arms). Every one of their four arms read the composed
  HAIR, EYE COLOUR, BROW CHARACTER or SKIN CHARACTER sentence, so all four went
  with the house road for the reason recorded above, and the groups emptied.

  ⚠ **AN EMPTY `describe` IS NOT A HARMLESS LEFTOVER — vitest fails the SUITE
  LOAD on it** (*"No test found in suite"*), and a suite that fails to load still
  prints `Tests N passed`. So the wrappers are removed rather than left standing
  as evidence of what used to be here, and this comment is that evidence instead.

  The distinction those two groups drew is still true of the product and is now
  stated rather than asserted: BIOLOGY (eye colour, brow character, skin
  character) never degrades under creative context, while STYLING (the cut) does
  — that is the founder ruling at the top of this file. On the author road
  neither is composed per slice at all, which is why no arm can express the
  difference here any more; #1125 carries the loss and #30 owns the question.
*/
