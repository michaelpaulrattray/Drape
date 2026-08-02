import { describe, expect, it } from "vitest";

import { castingBriefCompiler, deterministicBriefCompiler } from "./briefCompiler";
import {
  lockFactsOf,
  EMPTY_STATED_HAIR,
  NO_TENDENCIES,
  parseCastingIntent,
  stripQuotedSpans,
  validateLocks,
  type CastingIntent,
} from "./castingIntent";
import { COHORT_CONSTANT_MARKERS, composeCandidatePrompt, resolveCandidateIdentity } from "./cohortPhotorealHuman";
import { interpretBrief } from "./interpreter";
import type { TextEngine } from "../providers/types";

/** A text engine that returns exactly what a test wants the interpreter to say. */
function engineReturning(text: string): TextEngine {
  return {
    id: "test:interpreter",
    complete: async () => ({
      text,
      latencyMs: 12,
      provenance: { provider: "openrouter" as const, model: "test", servedModel: "test" },
    }),
  };
}

const BASE_INTENT: CastingIntent = {
  cohort: "photoreal_human",
  role: "a dad in his 30s",
  statedHair: EMPTY_STATED_HAIR,
  poolTendencies: NO_TENDENCIES,
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
  composedDirection: null,
};

describe("the precedence fix", () => {
  /*
    M3 §4.2, the defect this whole design exists for: the interpreter invented
    a plaid shirt and a mug captioned "World's Okayest Handyman", every
    candidate inherited both, and the mug's text overrode the framing block's
    "no text, no logos" rule. Interpreter output outranked an adapter-owned
    constraint.
  */
  const POISONED = JSON.stringify({
    cohort: "photoreal_human",
    role: 'a handyman holding a mug reading "World\'s Okayest Handyman"',
    characterNotes:
      "wearing a red plaid flannel shirt, standing in a cluttered garage, shot from a low angle with dramatic side lighting, holding a wrench, neon sign behind him",
    sex: "male",
    ageBand: "30s",
    // Fields the model was never offered. They must not survive.
    wardrobe: "plaid flannel",
    background: "cluttered garage",
    camera: "35mm, low angle",
    lighting: "dramatic rim light",
    props: ["mug", "wrench"],
  });

  it("drops every field that is not in the allowlist", async () => {
    const parsed = parseCastingIntent(POISONED);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // The intent is a closed type: there is nowhere for wardrobe, background,
    // camera, lighting or props to live, so they are gone rather than carried.
    expect(Object.keys(parsed.intent).sort()).toEqual([
      "ageBand",
      "agePhase",
      "archetype",
      "build",
      "characterNotes",
      "cohort",
      "composedDirection",
      "energy",
      "heritage",
      "look",
      // Soft category tendencies: they re-weight the draw, never lock it.
      "poolTendencies",
      "reads",
      "role",
      "sex",
      // D-79's re-ship: WHAT the brief said about each part of hair. The
      // interpreter never decides WHETHER — that is the code-owned gate.
      "statedHair",
      "variationAxis",
    ]);
  });

  it("strips the quoted caption before it can be rendered as letters", async () => {
    const parsed = parseCastingIntent(POISONED);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.role).not.toContain("World");
    expect(parsed.intent.role).not.toContain("Okayest");
  });

  it("keeps the framing constant intact and last in every compiled prompt", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "a handyman",
      candidateCount: 8,
      rollSeed: "seed-1",
      // Drive the interpreter's output directly rather than calling a model:
      // this feeds it the exact poisoned payload from M3 and checks what
      // survives composition.
      engine: engineReturning(POISONED),
    });

    for (const candidate of compiled.candidates) {
      for (const marker of COHORT_CONSTANT_MARKERS) {
        expect(candidate.prompt).toContain(marker);
      }
      // The authority paragraph is the actual guarantee: it is stated after
      // the character description and claims precedence over it. If anything
      // ever appends past it, this fails.
      const authorityAt = candidate.prompt.indexOf("AUTHORITY:");
      expect(authorityAt).toBeGreaterThan(-1);
      expect(candidate.prompt.slice(authorityAt)).toContain("always wins");
      expect(candidate.prompt.trim().endsWith("it always wins.")).toBe(true);

      /*
        The honest boundary, asserted rather than glossed over. "Cluttered
        garage" is free text describing a person who works with their hands,
        and no sanitizer separates that from a scene instruction without a
        blocklist that would also eat legitimate briefs. So it may still appear
        — and when it does, it appears BEFORE a paragraph that revokes it by
        name. Position is the guarantee; the scrub is only a reducer.
      */
      const leakAt = candidate.prompt.indexOf("garage");
      if (leakAt > -1) expect(leakAt).toBeLessThan(authorityAt);
    }
  });

  it("caps free text so a long description cannot bury the constant", () => {
    const parsed = parseCastingIntent(
      JSON.stringify({ role: "x".repeat(500), characterNotes: "y".repeat(900) }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.role!.length).toBeLessThanOrEqual(80);
    expect(parsed.intent.characterNotes!.length).toBeLessThanOrEqual(180);
  });

  it("scrubs quoted spans without eating ordinary prose", () => {
    expect(stripQuotedSpans('a mug reading "Hello"')).toBe("a mug reading");
    expect(stripQuotedSpans("a wiry cyclist in her 20s")).toBe("a wiry cyclist in her 20s");
  });
});

describe("the interpreter's outcomes", () => {
  it("refuses an uncastable cohort rather than approximating it", async () => {
    const outcome = await interpretBrief({
      briefText: "an anime swordswoman",
      engine: engineReturning(JSON.stringify({ cohort: "other", role: "anime swordswoman" })),
    });
    expect(outcome).toEqual({ ok: false, reason: "unsupported_cohort" });
  });

  it("falls back rather than failing when the reply is unreadable", async () => {
    const outcome = await interpretBrief({
      briefText: "a dad",
      engine: engineReturning("I'm sorry, I can't help with that."),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("unavailable");
  });

  it("records how long the text stage took", async () => {
    const outcome = await interpretBrief({
      briefText: "a dad in his 30s",
      engine: engineReturning(JSON.stringify({ cohort: "photoreal_human", role: "a dad", ageBand: "30s" })),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // M3 condition 4 was "not measured". It is measured now.
    expect(outcome.latencyMs).toBe(12);
  });
});

describe("locks", () => {
  /*
    The permanent regression fixture, named by the plan. M3's tight-3 brief —
    "a wiry cyclist in her 20s" — came back MALE in 7 of 8 Kimi treatments, a
    stated fact broken on the sheet the customer would have seen. Path B does
    not ship until this passes for every treatment; under Path A it proves the
    adapter composes from the locks rather than around them.
  */
  const CYCLIST: CastingIntent = {
    ...BASE_INTENT,
    role: "a wiry cyclist",
    sex: "female",
    ageBand: "20s",
    build: "slight",
  };

  it("holds 'her' across all eight candidates", () => {
    const locks = lockFactsOf(CYCLIST);
    expect(locks.sex).toBe("female");

    for (let position = 0; position < 8; position += 1) {
      const resolved = resolveCandidateIdentity(CYCLIST, position, "cyclist-seed");
      expect(validateLocks(locks, resolved)).toEqual([]);
      expect(resolved.sex).toBe("female");
      expect(resolved.ageBand).toBe("20s");
    }
  });

  it("names what broke when something does break", () => {
    const locks = lockFactsOf(CYCLIST);
    /*
      A complete identity, because a partial one is how this drifted: the
      typecheck excluded test files, so the fixture quietly stopped matching
      `ResolvedIdentity` and nothing said so. `tsconfig.casting-tests.json` is
      what catches it now.
    */
    const violations = validateLocks(locks, {
      sex: "male",
      ageBand: "40s",
      agePhase: "mid",
      heritage: [],
      build: "slight",
      energy: "dry",
      hair: { family: "short", colour: "dark brown" },
      look: null,
      realized: {
        eyeColour: "brown",
        hairStyle: { name: "plain short cut", family: "short" },
        facialHair: "clean-shaven",
        hairTexture: "straight",
        hairModifiers: null,
        wornState: null,
        browStyle: "full",
        skinCharacter: "plain",
      beardGrey: null,
      },
    });
    expect(violations.map((violation) => violation.field).sort()).toEqual(["ageBand", "sex"]);
    expect(violations.find((violation) => violation.field === "sex")).toMatchObject({
      expected: "female",
      got: "male",
    });
  });

  it("locks only what the brief said, and varies the rest", () => {
    // An open brief pins nothing, so every axis is free to differ — which is
    // the answer to "the eight candidates read as one man photographed eight
    // times".
    expect(lockFactsOf(BASE_INTENT)).toEqual({});

    const sheet = Array.from({ length: 8 }, (_, position) =>
      resolveCandidateIdentity(BASE_INTENT, position, "open-seed"),
    );
    expect(new Set(sheet.map((resolved) => resolved.energy)).size).toBe(8);
    expect(new Set(sheet.map((resolved) => resolved.sex)).size).toBeGreaterThan(1);
    expect(
      new Set(sheet.map((resolved) => resolved.heritage.map((entry) => entry.heritage).join("+"))).size,
    ).toBeGreaterThan(3);
  });

  it("never infers non-binary — it only appears when the brief says so", () => {
    const sheet = Array.from({ length: 40 }, (_, position) =>
      resolveCandidateIdentity(BASE_INTENT, position, "nb-seed"),
    );
    expect(sheet.some((resolved) => resolved.sex === "nonbinary")).toBe(false);
  });
});

describe("compilation", () => {
  it("is stable for one seed and different for the next", async () => {
    const first = await deterministicBriefCompiler({
      briefText: "a chef",
      candidateCount: 8,
      rollSeed: "request-a",
    });
    const replay = await deterministicBriefCompiler({
      briefText: "a chef",
      candidateCount: 8,
      rollSeed: "request-a",
    });
    const second = await deterministicBriefCompiler({
      briefText: "a chef",
      candidateCount: 8,
      rollSeed: "request-b",
    });

    // A replay recompiles identically; rolling again casts new people.
    expect(replay.candidates.map((spec) => spec.prompt)).toEqual(
      first.candidates.map((spec) => spec.prompt),
    );
    expect(second.candidates.map((spec) => spec.prompt)).not.toEqual(
      first.candidates.map((spec) => spec.prompt),
    );
  });

  it("refuses a brief too short to cast from, for free", async () => {
    await expect(
      deterministicBriefCompiler({ briefText: "hi", candidateCount: 8, rollSeed: "s" }),
    ).rejects.toMatchObject({ code: "uninterpretable" });
  });

  it("stops pinning a fact whose chip was removed", async () => {
    const pinned: CastingIntent = { ...BASE_INTENT, ageBand: "30s" };
    expect(lockFactsOf(pinned).ageBand).toBe("30s");

    // Removing the chip is the only edit a chip can make, and it applies to
    // the next roll — rolls already cast are immutable.
    const sheet = Array.from({ length: 8 }, (_, position) =>
      resolveCandidateIdentity({ ...pinned, ageBand: null }, position, "unlock-seed"),
    );
    expect(new Set(sheet.map((resolved) => resolved.ageBand)).size).toBeGreaterThan(1);
  });

  it("keeps the user's own archetype words in every prompt", () => {
    const prompt = composeCandidatePrompt({
      intent: { ...BASE_INTENT, role: "punk drummer" },
      resolved: resolveCandidateIdentity(BASE_INTENT, 0, "seed"),
      archetype: "quiet luxury",
      seed: 0,
    });
    // C6's fidelity gate: a named social archetype may never be quietly
    // replaced by a generic fashion type.
    expect(prompt).toContain("punk drummer");
  });
});
