import { describe, expect, it } from "vitest";

import { castingBriefCompiler } from "./briefCompiler";
import type { TextEngine } from "../providers/types";

/**
 * A hand-made adjustment outranks the interpreter's re-reading.
 *
 * Founder ruling, 2026-08-01, ratified as law and named as legacy's H8 override
 * mechanism reborn. The failure it prevents is the quiet one: a roll re-reads
 * the brief every time, so a user who adjusts age to 40s and rolls again would
 * have the interpreter derive "early 20s" from the unchanged brief and hand it
 * straight back. Nothing would refuse; the adjustment would simply evaporate.
 *
 * These tests drive an interpreter that always returns the ORIGINAL reading,
 * because that is the real condition — the brief text does not change when the
 * user adjusts a fact, so the interpreter keeps answering the same way, and the
 * override has to win against a live, confident, correct-about-the-brief
 * answer rather than against an absent one.
 */

/** Always reads the brief the same way: female, early 20s, East Asian. */
const stubbornInterpreter: TextEngine = {
  id: "test:stubborn",
  complete: async () => ({
    text: JSON.stringify({
      cohort: "photoreal_human",
      role: "runway model",
      sex: "female",
      ageBand: "20s",
      agePhase: "early",
      heritage: [{ heritage: "East Asian", pct: 100 }],
      energy: "dry",
      variationAxis: "look",
      reads: null,
    }),
    latencyMs: 5,
    provenance: { provider: "openrouter" as const, model: "test", servedModel: "test" },
  }),
};

const BRIEF = "Female runway model, early 20s, East Asian, dry";

function compile(extra: Parameters<typeof castingBriefCompiler>[0] extends infer T ? Partial<T> : never) {
  return castingBriefCompiler({
    briefText: BRIEF,
    candidateCount: 8,
    rollSeed: "override-test",
    engine: stubbornInterpreter,
    ...extra,
  } as Parameters<typeof castingBriefCompiler>[0]);
}

describe("a hand adjustment beats the interpreter", () => {
  it("without an override, the interpreter's reading stands", async () => {
    const compiled = await compile({});
    expect(compiled.lockContract).toMatchObject({ ageBand: "20s", agePhase: "early" });
  });

  it("an overridden age replaces the interpreter's, on a brief that still says 20s", async () => {
    const compiled = await compile({ overrides: { ageBand: "40s" } });
    expect(compiled.lockContract).toMatchObject({ ageBand: "40s" });
  });

  it("every candidate is composed at the overridden value, not just the contract", async () => {
    // The contract agreeing while the prompts disagree would be the worst
    // possible outcome: the echo would say 40s and the sheet would show 20s.
    const compiled = await compile({ overrides: { ageBand: "50s" } });
    expect(compiled.candidates).toHaveLength(8);
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt).toMatch(/fifties|50–5|5[0-9]–5[0-9]/);
      expect(candidate.prompt).not.toMatch(/twenties/);
    }
  });

  it("overrides a fact the interpreter is confident about — sex", async () => {
    const compiled = await compile({ overrides: { sex: "male" } });
    expect(compiled.lockContract).toMatchObject({ sex: "male" });
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt).toContain("male");
    }
  });

  it("replaces a heritage rather than blending with the interpreter's", async () => {
    const compiled = await compile({ overrides: { heritage: "Nordic" } });
    expect(compiled.lockContract).toMatchObject({ heritage: [{ heritage: "Nordic", pct: 100 }] });
    for (const candidate of compiled.candidates) {
      /*
        Scoped to the SUBJECT line on purpose. "East Asian" also appears in the
        cohort constant's heritage-lock example ("a platinum-blonde East Asian
        person still has East Asian bone structure"), so asserting against the
        whole prompt tests the constant rather than the override.
      */
      const subject = candidate.prompt.split("\n").find((line) => line.startsWith("SUBJECT:"));
      expect(subject).toBeDefined();
      expect(subject).toContain("Nordic");
      expect(subject).not.toContain("East Asian");
    }
  });

  it("beats an unlock of the same field in the same roll", async () => {
    /*
      "Let age vary" followed by "no, make it 40s" resolves to 40s. Position is
      what decides this — overrides run after unlocks — and the reading is the
      right one: the later instruction is the one the user meant.
    */
    const compiled = await compile({ unlock: ["ageBand"], overrides: { ageBand: "40s" } });
    expect(compiled.lockContract).toMatchObject({ ageBand: "40s" });
  });

  it("an unlock alone still unpins, so overrides did not break it", async () => {
    const compiled = await compile({ unlock: ["ageBand"] });
    expect(compiled.lockContract).not.toHaveProperty("ageBand");
  });

  it("leaves untouched facts exactly as the interpreter read them", async () => {
    // An override is a scalpel. If setting age also cleared heritage, the user
    // would lose facts they never touched.
    const compiled = await compile({ overrides: { ageBand: "40s" } });
    expect(compiled.lockContract).toMatchObject({
      sex: "female",
      heritage: [{ heritage: "East Asian", pct: 100 }],
      energy: "dry",
    });
  });

  it("an empty override object changes nothing", async () => {
    const compiled = await compile({ overrides: {} });
    expect(compiled.lockContract).toMatchObject({ ageBand: "20s", agePhase: "early" });
  });
});
