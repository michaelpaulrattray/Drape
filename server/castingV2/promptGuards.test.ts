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

import { castingBriefCompiler, deterministicBriefCompiler } from "./briefCompiler";
import { applySheetTaste } from "./realizedAxes";
import { resolveCandidateIdentity } from "./cohortPhotorealHuman";
import { sameNeighbourhood, colourBucket } from "./heritageNeighbourhoods";
import type { CastingIntent } from "./castingIntent";
import type { TextEngine } from "../providers/types";

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

  it("keeps the sentence around the removed name", async () => {
    // "Versace editorial style" becomes "editorial style", not a hole.
    const compiled = await castingBriefCompiler({
      briefText: "an editorial model",
      candidateCount: 8,
      rollSeed: "scrub-keeps",
      engine: engineReturning({ role: "male fashion model, Versace editorial style" }),
    });
    expect(compiled.candidates[0].prompt).toContain("editorial style");
  });
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

  it("emits FACIAL HAIR for a male sheet, in both resolutions", async () => {
    for (const [label, wire] of [
      ["prescribe", { role: null, archetype: null, look: null, variationAxis: null, sex: "male" }],
      ["bias", { role: "a heavy metal bogan", sex: "male" }],
    ] as const) {
      const compiled = await sheetOf("a man in his 30s", wire as Record<string, unknown>, `fh-${label}`);
      const lines = compiled.candidates
        .map((c) => c.prompt.match(/FACIAL HAIR: [^.]*\./)?.[0])
        .filter((line): line is string => Boolean(line));
      expect(lines.length, `${label}: no FACIAL HAIR lines at all`).toBeGreaterThanOrEqual(6);
    }
  });

  it("emits SKIN CHARACTER often enough to be doing something", async () => {
    /*
      Most skin is deliberately "plain" and emits nothing — that is the
      seasoning-not-costume weighting. So the floor is across several sheets
      rather than within one, which is the honest form of the assertion.
    */
    let lines = 0;
    for (let roll = 0; roll < 10; roll += 1) {
      const compiled = await deterministicBriefCompiler({
        briefText: "an oncology nurse",
        candidateCount: 8,
        rollSeed: `skin-${roll}`,
      });
      lines += compiled.candidates.filter((c) => c.prompt.includes("SKIN CHARACTER:")).length;
    }
    expect(lines, "no SKIN CHARACTER line on 80 candidates").toBeGreaterThan(10);
  });

  it("emits EYE COLOUR on every candidate, because biology never degrades", async () => {
    const compiled = await sheetOf("a heavy metal bogan", { role: "a heavy metal bogan" }, "eyes-bias");
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt).toContain("EYE COLOUR:");
    }
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
