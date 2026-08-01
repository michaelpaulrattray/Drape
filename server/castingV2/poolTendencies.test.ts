import { describe, expect, it } from "vitest";

import { castingBriefCompiler } from "./briefCompiler";
import { parsePoolTendencies } from "./castingIntent";
import { NO_TENDENCIES } from "./poolTendencies";
import type { TextEngine } from "../providers/types";

/**
 * Category-implied tendencies, and the one property that separates them from a
 * fact: **they re-weight, they never lock.**
 *
 * Every test here is really the same question asked from a different side —
 * does the lean move the sheet, and does it leave the exception reachable? A
 * lean that cannot be escaped is a lock with better manners, and the ruling it
 * would break is the heritage-draw one: "cast fewer of X" is never the fix for
 * a taste problem.
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

type Sheet = {
  candidates: Array<{
    resolvedIdentity: {
      ageBand: string;
      sex: string;
      realized: { facialHair: string | null };
    };
  }>;
};

async function sheets(intent: Record<string, unknown>, count: number, tag: string) {
  const out: Sheet["candidates"] = [];
  for (let seed = 0; seed < count; seed += 1) {
    const compiled = (await castingBriefCompiler({
      briefText: "a person",
      candidateCount: 8,
      rollSeed: `${tag}-${seed}`,
      engine: engine(intent),
    } as never)) as unknown as Sheet;
    out.push(...compiled.candidates);
  }
  return out;
}

describe("the age lean", () => {
  it("centres the sheet without collapsing it", async () => {
    const leaned = await sheets(
      { role: "twitch streamer", poolTendencies: { ageLean: "20s" } },
      25,
      "age-leaned",
    );
    const plain = await sheets({ role: "twitch streamer" }, 25, "age-plain");

    const share = (rows: typeof leaned, band: string) =>
      rows.filter((row) => row.resolvedIdentity.ageBand === band).length / rows.length;

    // It moves, and it moves a lot — this is the defect being fixed.
    expect(share(leaned, "20s")).toBeGreaterThan(share(plain, "20s") + 0.2);

    /*
      AND THE EXCEPTION SURVIVES. An older streamer must stay reachable: a
      category with no room for the unusual is a stereotype, which is exactly
      what the heritage-draw ruling forbids in its own domain. Asserted as a
      real count over 200 candidates rather than as "greater than zero", so a
      lean tightened to a lock fails here.
    */
    const older = leaned.filter((row) =>
      ["40s", "50s", "60s", "70s+"].includes(row.resolvedIdentity.ageBand),
    );
    expect(older.length).toBeGreaterThan(4);
  });

  it("never beats a stated age", async () => {
    // The brief outranks the category, always. A tendency that could overrule a
    // stated fact would be a lock wearing a softer name.
    const rows = await sheets(
      { role: "twitch streamer", ageBand: "50s", poolTendencies: { ageLean: "20s" } },
      6,
      "age-stated",
    );
    for (const row of rows) expect(row.resolvedIdentity.ageBand).toBe("50s");
  });
});

describe("the facial-hair lean — three-valued, the lumberjack mirroring the idol", () => {
  const men = (rows: Awaited<ReturnType<typeof sheets>>) =>
    rows.filter((row) => row.resolvedIdentity.sex === "male");
  const cleanShare = (rows: Awaited<ReturnType<typeof sheets>>) => {
    const male = men(rows);
    return male.filter((row) => row.resolvedIdentity.realized.facialHair === "clean-shaven").length / male.length;
  };
  const beardShare = (rows: Awaited<ReturnType<typeof sheets>>) => {
    const male = men(rows);
    return (
      male.filter((row) =>
        ["short beard", "full beard", "heavy stubble"].includes(
          row.resolvedIdentity.realized.facialHair ?? "",
        ),
      ).length / male.length
    );
  };

  it("clean-leans to roughly seven of eight, and leaves the eighth reachable", async () => {
    const rows = await sheets(
      { role: "k-pop idol", sex: "male", ageBand: "20s", poolTendencies: { facialHairLean: "clean" } },
      25,
      "clean",
    );
    // The founder's bar.
    expect(cleanShare(rows)).toBeGreaterThan(0.8);
    // But not a lock — someone on the sheet still carries stubble.
    expect(cleanShare(rows)).toBeLessThan(1);
  });

  it("beard-leans the other way — the counter-case that stops a global clean bias", async () => {
    const rows = await sheets(
      { role: "lumberjack", sex: "male", ageBand: "40s", poolTendencies: { facialHairLean: "beard" } },
      25,
      "beard",
    );
    expect(beardShare(rows)).toBeGreaterThan(0.6);
    expect(cleanShare(rows)).toBeLessThan(0.15);
  });

  it("treats 'any' as a lean toward variety, not as silence", async () => {
    /*
      The third value exists because "either" is a real answer a category can
      give, and it has to be distinguishable from the category saying nothing.
      A two-valued field could only ever express half the ruling.
    */
    const any = await sheets(
      { role: "festival crowd", sex: "male", ageBand: "30s", poolTendencies: { facialHairLean: "any" } },
      25,
      "any",
    );
    const silent = await sheets({ role: "festival crowd", sex: "male", ageBand: "30s" }, 25, "silent");
    expect(beardShare(any)).toBeGreaterThan(beardShare(silent));
    // And it widens rather than flipping: clean is still well represented.
    expect(cleanShare(any)).toBeGreaterThan(0.1);
  });
});

describe("the parser", () => {
  it("drops anything outside the closed vocabularies", () => {
    expect(parsePoolTendencies({ ageLean: "middle-aged", facialHairLean: "stubbly" })).toEqual(
      NO_TENDENCIES,
    );
    expect(parsePoolTendencies("young")).toEqual(NO_TENDENCIES);
    expect(parsePoolTendencies(null)).toEqual(NO_TENDENCIES);
  });

  it("keeps values that are in them", () => {
    expect(parsePoolTendencies({ ageLean: "20s", facialHairLean: "clean" })).toEqual({
      ageLean: "20s",
      facialHairLean: "clean",
    });
  });
});
