import { describe, expect, it } from "vitest";

import { castingBriefCompiler } from "./briefCompiler";
import { EMPTY_STATED_HAIR, parseCastingIntent, tokensComeFromBrief } from "./castingIntent";
import { briefStatesCoverage, spokenHairParts } from "./cohortPhotorealHuman";
import { PARTIAL_DEFERENCE_ENABLED } from "./stylingResolution";
import type { TextEngine } from "../providers/types";

/**
 * D-79's re-ship, and the tests it was rolled back for not having.
 *
 * **The lesson this file exists to encode.** The first `partialDeference.test.ts`
 * was green while the feature was broken in production, because every test drove
 * the interpreter through a stub returning a hand-written intent that already
 * contained the phrase the bug removed. They proved the composer behaves given a
 * good intent, and never exercised the decomposition that produces one. *A test
 * that supplies the input the bug corrupts cannot see the bug.*
 *
 * So this file stubs the interpreter at its WORST rather than its best. The
 * question is never "does it work when the model cooperates" — it is "what
 * happens when the model does the exact thing it did last time".
 *
 * The property being proved is D-89's theorem: **the code-owned gate is the
 * authority on WHETHER a part was spoken, the interpreter only on WHAT** — so
 * the worst possible interpreter output degrades to today's suppression and can
 * never reproduce the D-79 contradiction, which requires authoring a part the
 * brief stated.
 */

function engine(intent: Record<string, unknown>): TextEngine {
  return {
    id: "stub",
    complete: async () => ({
      text: JSON.stringify({ cohort: "photoreal_human", ...intent }),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
    }),
  } as unknown as TextEngine;
}

async function sheet(briefText: string, intent: Record<string, unknown>, seed = "pd") {
  return (await castingBriefCompiler({
    briefText,
    candidateCount: 8,
    rollSeed: seed,
    engine: engine(intent),
  } as never)) as unknown as {
    candidates: Array<{ prompt: string; resolvedIdentity: { realized: { hairStyle: { name: string } | null } } }>;
  };
}

/** The hair sentence only — an authored cut elsewhere in the prompt is not one. */
function hairLine(prompt: string): string {
  // Not the FACIAL HAIR sentence, which contains " HAIR:" and is emitted
  // whenever the scalp line is suppressed.
  const match = /(^|[^A-Z])\sHAIR:/.exec(prompt);
  if (!match) return "";
  const start = match.index + match[1].length;
  const rest = prompt.slice(start + 1);
  const end = rest.search(/\n| EYE COLOUR:| FACIAL HAIR:| BROW CHARACTER:| SKIN CHARACTER:/);
  return end < 0 ? rest : rest.slice(0, end);
}

/* ------------------------------------------------------------- the gate */

describe("the gate owns WHETHER — and no model can reach it", () => {
  it("names the part each hair word speaks to", () => {
    /*
      A bare "hair" names no PART, so the gate attributes nothing — the
      interpreter's answer resolves it in `hairDeferenceFor`, and a silent
      interpreter falls back to whole-axis deference. Treating it as all-parts
      is what made the feature inert on every phrasing a founder actually types.
    */
    expect([...spokenHairParts("a woman with pastel pink hair")]).toEqual([]);
    expect([...spokenHairParts("a redhead in her 30s")]).toEqual(["colour"]);
    expect([...spokenHairParts("a woman with a bob")]).toEqual(["cutLength"]);
    expect([...spokenHairParts("a curly-haired man")]).toEqual(["texture"]);
    expect([...spokenHairParts("a teacher in her 40s")]).toEqual([]);
  });

  it("keeps the ambiguous-word claim rule — a brow is not hair", () => {
    // "bleached brows" surrenders its ambiguous word; the founder's sheet
    // twinned when it did not.
    expect([...spokenHairParts("a beauty creator in her late 20s, bleached brows")]).toEqual([]);
    // But a beard eight words away claims nothing — the silver fox keeps his.
    expect([...spokenHairParts("a silver fox in his 50s with a trimmed beard")]).toEqual(["colour"]);
  });

  it("treats coverage as total, and catches the words that used to slip", () => {
    for (const brief of [
      "runway model, early 20s, shaved head",
      "a buzzed marine",
      "a balding accountant",
      "a bald man in his 60s",
    ]) {
      expect(briefStatesCoverage(brief), brief).toBe(true);
      // Every part, not just its own — there is no cut on a bald man.
      expect([...spokenHairParts(brief)].sort(), brief).toEqual(["colour", "cutLength", "texture"]);
    }
  });
});

/* -------------------------------------------------- the closed source */

describe("the interpreter owns WHAT — inside a closed source", () => {
  it("accepts only words the user actually typed", () => {
    const brief = "a woman with pastel pink hair";
    expect(tokensComeFromBrief("pastel pink", brief)).toBe(true);
    // A paraphrase the user never typed is not theirs to put in the prompt.
    expect(tokensComeFromBrief("bubblegum", brief)).toBe(false);
    expect(tokensComeFromBrief("pastel magenta", brief)).toBe(false);
    // Stopwords ride along; content words may not.
    expect(tokensComeFromBrief("a pastel pink", brief)).toBe(true);
  });

  it("drops a hallucinated, garment-bearing, numeric or branded value", () => {
    const brief = "a woman with pastel pink hair";
    const parsed = parseCastingIntent(
      {
        cohort: "photoreal_human",
        statedHair: { colour: "electric teal", cutLength: "a 3 inch bob", texture: "wearing a hat" },
      },
      brief,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.statedHair).toEqual(EMPTY_STATED_HAIR);
  });

  it("keeps a value the brief genuinely contains", () => {
    const parsed = parseCastingIntent(
      { cohort: "photoreal_human", statedHair: { colour: "pastel pink", greying: true } },
      "a woman with pastel pink hair",
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.statedHair.colour).toBe("pastel pink");
    expect(parsed.intent.statedHair.greying).toBe(true);
  });
});

/* ------------------------------------------------ the adversarial stubs */

describe("the interpreter at its WORST never contradicts the brief", () => {
  /*
    THE D-79 REPRODUCTION. The model was told to classify hair into a structured
    field and responded by treating that field as the place hair now lived —
    dropping the words from `role` and `characterNotes` entirely, and on the
    redhead brief taking the role down with them. These stubs are that behaviour,
    plus the worse versions of it, run against the real compiler.
  */
  const adversaries: Array<[string, Record<string, unknown>]> = [
    ["says nothing at all about hair", { role: null, characterNotes: null }],
    ["returns an all-null statedHair", { statedHair: EMPTY_STATED_HAIR }],
    ["omits statedHair entirely", {}],
    ["returns junk in statedHair", { statedHair: { colour: 42, cutLength: [], texture: {} } }],
    ["returns statedHair as a string", { statedHair: "pink" }],
    ["hallucinates a colour the brief never named", { statedHair: { colour: "jet black" } }],
  ];

  for (const [name, intent] of adversaries) {
    it(`does not author a stated part when the interpreter ${name}`, async () => {
      const compiled = await sheet("a woman with pastel pink hair", intent, `adv-${name}`);

      for (const candidate of compiled.candidates) {
        const line = hairLine(candidate.prompt);
        /*
          THE PROPERTY. The brief stated a colour, so no colour may be authored
          into the hair sentence — whatever the interpreter did or failed to do.
          A contradiction requires authoring a part the brief settled, and the
          gate makes that unreachable.
        */
        for (const authored of ["brown", "blonde", "auburn", "black", "chestnut", "copper", "ash"]) {
          expect(line, `${name}: authored ${authored}`).not.toContain(authored);
        }
      }
    });
  }

  it("never lets an unsaid part leak in from a hallucinated field", async () => {
    // The brief speaks only to colour. A model inventing a cut must not have it
    // rendered as though the user had asked for one.
    const compiled = await sheet(
      "a woman with pastel pink hair",
      { statedHair: { colour: "pastel pink", cutLength: "a shaved head" } },
      "adv-leak",
    );
    for (const candidate of compiled.candidates) {
      expect(hairLine(candidate.prompt)).not.toContain("shaved");
    }
  });
});

/* ------------------------------------------------------- the kill switch */

describe("the kill switch", () => {
  it("is OFF until the founder rules on D-89's conditions amendment", () => {
    /*
      Pinned deliberately. D-79 was shipped and rolled back the same day, and
      condition 4 requires the five founder briefs verified live before this
      turns on. A test that fails the day someone flips it is the point: the
      flip should be a decision, not a diff nobody noticed.
    */
    expect(PARTIAL_DEFERENCE_ENABLED).toBe(false);
  });

  it("composes exactly today's behaviour while off — the whole axis defers", async () => {
    const compiled = await sheet(
      "a photographer in his 50s with salt and pepper hair",
      { role: "photographer", sex: "male", ageBand: "50s", statedHair: { greying: true } },
      "off-behaviour",
    );
    // Nothing authored, because the brief spoke about hair at all.
    for (const candidate of compiled.candidates) {
      expect(hairLine(candidate.prompt)).toBe("");
    }
  });
});
