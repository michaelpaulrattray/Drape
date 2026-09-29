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

  /*
    TWO ARMS STOOD HERE, and the first one's own title names why it goes: it
    asserted the override reached every COMPOSED candidate "not just the
    contract". The contract half is the live half and survives — a hand-made
    adjustment still outranks the interpreter's re-reading on the intent and in
    the lock contract, which is H8's actual promise. On the author road an
    override rewrites the BRIEF ITSELF (#164), and
    `creativeRegisterScope.test.ts` drives that at the prompt.

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

  it("overrides a fact the interpreter is confident about — sex", async () => {
    const compiled = await compile({ overrides: { sex: "male" } });
    expect(compiled.lockContract).toMatchObject({ sex: "male" });
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt).toContain("male");
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
