import { describe, expect, it } from "vitest";

import { HAIR_PARTS, type HairPart } from "../../shared/castingRealization";

/*
  D-79's per-part mask, in the two shapes these tests need. The old
  `hairAuthored: false` said "the brief settled hair, author none of it"; the
  mask says the same thing per part, which is what lets a brief settle a colour
  and still get eight different cuts.
*/
const NO_HAIR_PARTS: ReadonlySet<HairPart> = new Set();
const ALL_HAIR_PARTS: ReadonlySet<HairPart> = new Set(HAIR_PARTS);

import { castingBriefCompiler } from "./briefCompiler";
import { applySheetTaste } from "./realizedAxes";
import { resolveCandidateIdentity } from "./cohortPhotorealHuman";
import { sameNeighbourhood, colourBucket } from "./heritageNeighbourhoods";
import type { CastingIntent } from "./castingIntent";
import type { TextEngine } from "../providers/types";

/**
 * A READER THAT PINS NOTHING — the open-brief condition, since #1490 act 2.
 *
 * ⚠ The arm below used `deterministicBriefCompiler`, and what it needed was not
 * "no network" but "nothing pinned": that seam asked no reader, so its intent came
 * from `fallbackIntent` — the brief as the `role`, every other axis null. A reader
 * answering with a sex, an age and a heritage would narrow the palette and the arm
 * would pass for the wrong reason. This reproduces the condition through the live
 * compiler instead.
 */
function openReader(brief: string): TextEngine {
  return {
    id: "test:open-brief",
    complete: async () => ({
      text: JSON.stringify({
        cohort: "photoreal_human",
        role: brief,
        sex: null,
        ageBand: null,
        agePhase: null,
        heritage: [],
        energy: null,
        variationAxis: null,
        reads: null,
      }),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "test", servedModel: "test" },
    }),
  };
}

/** The live compiler on an open brief — the seam's replacement, one line. */
function compileOpen(input: { briefText: string; candidateCount: number; rollSeed: string }) {
  return castingBriefCompiler({ ...input, engine: openReader(input.briefText) } as never);
}

/**
 * Guards that assert what reaches the COMPOSED PROMPT.
 *
 * Every test here exists because the review found the suite could not see a
 * defect it should have caught. The common shape: a rule was proven at its own
 * unit boundary and never at the boundary that matters, so deleting the rule's
 * CALL SITE left the suite green. Invariant 7 in one sentence — a control that
 * is not invoked does not exist, and a test that cannot tell is not a test.
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

describe("the brand scrub, at the compile path", () => {
  /*
    The scrub had unit tests and no compile-path test, so deleting its call
    site in the compiler left the whole suite green — the exact failure the
    Versace incident cost five candidates for.
  */
  it("keeps every house name out of all eight prompts", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "a young male Mediterranean model inspired by versace editorial",
      candidateCount: 8,
      rollSeed: "scrub-path",
      engine: engineReturning({
        // The interpreter disobeying its instruction, which is the case the
        // scrub exists for.
        role: "male fashion model, Versace editorial style",
        characterNotes: "the Miu Miu girl, Balenciaga bones",
      }),
    });
    for (const candidate of compiled.candidates) {
      const prompt = candidate.prompt.toLowerCase();
      for (const brand of ["versace", "miu miu", "balenciaga"]) {
        expect(prompt, `${brand} reached the prompt`).not.toContain(brand);
      }
    }
  });

  /*
    THREE ARMS STOOD HERE — `FACIAL HAIR:` emitted for a male sheet in both
    resolutions, `EYE COLOUR:` on every candidate because biology never degrades,
    and the sentence surviving around a removed name. Each names a house block by
    its label, and no such label is composed on the author road.

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
});

describe("the realized lines are present, not merely absent", () => {
  /*
    These were absence-only assertions — "the prompt does not contain X" — which
    pass just as happily when the line was never emitted at all. The bias beard
    test was passing on ZERO facial-hair lines. A floor on the count is what
    turns it back into a test.
  */
  async function sheetOf(brief: string, wire: Record<string, unknown>, rollSeed: string) {
    return castingBriefCompiler({ briefText: brief, candidateCount: 8, rollSeed, engine: engineReturning(wire) });
  }


  it("realizes a skin character often enough to be doing something", async () => {
    /*
      ⚠ **THIS ARM COUNTED A PROMPT LINE UNTIL #1490 ACT 2 AND NOW COUNTS THE
      RECORD, WHICH IS WHERE THE FACT LIVES.** It compiled ten sheets and counted
      candidates whose prompt contained `SKIN CHARACTER:`. That line was composed
      by the house road only, and the author road never sent it — so after act 2
      there is nothing to count in a prompt.

      The value itself is alive and is read downstream: `realized.skinCharacter`
      is written per candidate and travels into the facet values and a follow's
      inheritance. So the floor is asserted on the record.

      The FORM of the assertion is deliberately unchanged, because it is the
      honest one: most skin is "plain" and realizes nothing — that is the
      seasoning-not-costume weighting — so the floor is across several sheets
      rather than within one.
    */
    let realized = 0;
    for (let roll = 0; roll < 10; roll += 1) {
      const compiled = await compileOpen({
        briefText: "an oncology nurse",
        candidateCount: 8,
        rollSeed: `skin-${roll}`,
      });
      realized += compiled.candidates.filter(
        (candidate) => candidate.resolvedIdentity.realized.skinCharacter != null,
      ).length;
    }
    expect(realized, "no skin character realized on 80 candidates").toBeGreaterThan(10);
  });

});

describe("the female stated-hair limit, pinned rather than described", () => {
  /*
    Recorded as a named limit in a comment, which nothing enforces. If a future
    change silently improved OR worsened it, the comment would stay confidently
    wrong. The number is measured, so the test states the number.
  */
  it("cannot separate a sheet of women whose hair the brief stated", () => {
    const intent = { heritage: [], sex: "female", ageBand: "20s", reads: [] } as unknown as CastingIntent;
    let twins = 0;
    for (let roll = 0; roll < 100; roll += 1) {
      const raw = Array.from({ length: 8 }, (_, position) =>
        resolveCandidateIdentity(intent, position, `limit-${roll}`),
      );
      const sheet = applySheetTaste(raw, `limit-${roll}`, { authoredParts: NO_HAIR_PARTS });
      for (let i = 0; i < sheet.length; i += 1) {
        for (let j = i + 1; j < sheet.length; j += 1) {
          const hi = sheet[i].heritage[0]?.heritage ?? "";
          const hj = sheet[j].heritage[0]?.heritage ?? "";
          if (!sameNeighbourhood(hi, hj)) continue;
          if (sheet[i].realized.hairStyle?.family !== sheet[j].realized.hairStyle?.family) continue;
          const a = sheet[i].hair;
          const b = sheet[j].hair;
          if (a && b && colourBucket(a.colour) === colourBucket(b.colour)) twins += 1;
        }
      }
    }
    /*
      The limit, as a number. Women have no facial-hair axis, so when the hair
      rules stand down there is nothing left to separate a neighbourhood pair.
      Closing it needs a second visible axis that survives hair deference.
    */
    expect(twins, "the limit closed — update the docs and this test").toBeGreaterThan(50);
  });

  it("and separates the same sheet easily when the rules do run", () => {
    // The control. Without it the assertion above could pass on a broken pass.
    const intent = { heritage: [], sex: "female", ageBand: "20s", reads: [] } as unknown as CastingIntent;
    let twins = 0;
    for (let roll = 0; roll < 100; roll += 1) {
      const raw = Array.from({ length: 8 }, (_, position) =>
        resolveCandidateIdentity(intent, position, `limit-${roll}`),
      );
      const sheet = applySheetTaste(raw, `limit-${roll}`, { authoredParts: ALL_HAIR_PARTS });
      for (let i = 0; i < sheet.length; i += 1) {
        for (let j = i + 1; j < sheet.length; j += 1) {
          const hi = sheet[i].heritage[0]?.heritage ?? "";
          const hj = sheet[j].heritage[0]?.heritage ?? "";
          if (!sameNeighbourhood(hi, hj)) continue;
          if (sheet[i].realized.hairStyle?.family !== sheet[j].realized.hairStyle?.family) continue;
          const a = sheet[i].hair;
          const b = sheet[j].hair;
          if (a && b && colourBucket(a.colour) === colourBucket(b.colour)) twins += 1;
        }
      }
    }
    expect(twins).toBeLessThan(10);
  });
});

describe("the category repair, at its worst case", () => {
  it("leaves role null when the interpreter gives no repair signal", async () => {
    /*
      The suite's own name over-claimed: every case fed the repair a trigger.
      This is the shape where it must NOT fire — a category-less brief with a
      disposition axis — so "the category survives" stops meaning "we always
      backfill".
    */
    const compiled = await castingBriefCompiler({
      briefText: "someone quietly confident with kind eyes",
      candidateCount: 8,
      rollSeed: "worst-case",
      engine: engineReturning({ role: null, archetype: null, variationAxis: "disposition" }),
    });
    const intent = (compiled.compiledBrief as { intent?: { role?: string | null } }).intent ?? {};
    expect(intent.role ?? null).toBeNull();
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt).not.toContain("CASTING CATEGORY");
    }
  });

  it("does not fire on a vibe brief that merely drew an archetype", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "someone quietly confident with kind eyes",
      candidateCount: 8,
      rollSeed: "vibe-archetype",
      engine: engineReturning({ role: null, archetype: "raw editorial", variationAxis: "disposition" }),
    });
    const intent = (compiled.compiledBrief as { intent?: { role?: string | null } }).intent ?? {};
    expect(intent.role ?? null).toBeNull();
  });
});
