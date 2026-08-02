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

describe("the heritage lean", () => {
  it("gives the category its pool AND a real tail", async () => {
    const rows = await sheets(
      { role: "k-pop idol", poolTendencies: { heritageLean: "East Asian" } },
      20,
      "heritage",
    );
    const east = rows.filter((row) =>
      (row.resolvedIdentity as never as { heritage: { heritage: string }[] }).heritage.some(
        (component) => component.heritage === "East Asian",
      ),
    ).length;
    const share = east / rows.length;
    // The founder's bar: majority East Asian.
    expect(share).toBeGreaterThan(0.55);
    /*
      AND THE TAIL IS REAL. Thai and Chinese idols exist; a sheet with no room
      for them is a stereotype rather than a casting. This is the assertion that
      fails if the lean is ever tightened into a lock.
    */
    expect(share).toBeLessThan(0.85);
  });
});

describe("lean strength — how hard a pool's edges are", () => {
  it("takes seven of eight at 'defines', and still leaves the eighth", async () => {
    /*
      The k-pop verification. At `centres` the tail draws wider than a
      hard-edged pool's truth — a 45-year-old blond European is not this
      industry's honest outlier the way a 58-year-old streamer is. At `defines`
      the lean takes seven, and the eighth survives BECAUSE non-Korean idols
      exist: that one tile is the entire difference between a lean and a lock.
    */
    const rows = await sheets(
      { role: "k-pop idol", poolTendencies: { heritageLean: "East Asian", leanStrength: "defines" } },
      20,
      "defines",
    );
    const share =
      rows.filter((row) =>
        (row.resolvedIdentity as never as { heritage: { heritage: string }[] }).heritage.some(
          (component) => component.heritage === "East Asian",
        ),
      ).length / rows.length;
    expect(share).toBeGreaterThan(0.85);
    expect(share).toBeLessThan(1);
  });

  it("tightens the age band without closing it", async () => {
    const rows = await sheets(
      { role: "k-pop idol", poolTendencies: { ageLean: "20s", leanStrength: "defines" } },
      20,
      "defines-age",
    );
    const inBand = rows.filter((row) => row.resolvedIdentity.ageBand === "20s").length / rows.length;
    expect(inBand).toBeGreaterThan(0.85);
    // No 40+ tiles absent a stated age — the founder's raised bar.
    const old = rows.filter((row) =>
      ["40s", "50s", "60s", "70s+"].includes(row.resolvedIdentity.ageBand),
    );
    expect(old.length / rows.length).toBeLessThan(0.03);
  });

  it("leaves 'centres' as it was — the softer reading stays the default", async () => {
    const rows = await sheets(
      { role: "twitch streamer", poolTendencies: { ageLean: "20s", leanStrength: "centres" } },
      20,
      "centres",
    );
    const older = rows.filter((row) =>
      ["40s", "50s", "60s", "70s+"].includes(row.resolvedIdentity.ageBand),
    );
    // The grandpa streamer survives, because that outlier is honest.
    expect(older.length).toBeGreaterThan(3);
  });
});

describe("the styling lean — the last category-blind axis", () => {
  it("pushes a pool's absent silhouettes down without making them impossible", async () => {
    /*
      K-pop sheets kept drawing buzz cuts and shaved heads at ordinary street
      weight — twice across two rolls — because grooming, age and heritage all
      had a channel and the family draw did not.

      Floor, not removal: the difference between a lean and a lock is that the
      tile stays reachable, exactly as the age far-bands do at `defines`.
    */
    const leaned = await sheets(
      { role: "k-pop idol", sex: "male", poolTendencies: { avoidFamilies: ["shaved", "cropped"] } },
      25,
      "avoid",
    );
    const plain = await sheets({ role: "k-pop idol", sex: "male" }, 25, "avoid-plain");
    const shavedShare = (rows: typeof leaned) =>
      rows.filter((row) =>
        ["shaved", "cropped"].includes(
          (row.resolvedIdentity as never as { realized: { hairStyle: { family: string } | null } })
            .realized.hairStyle?.family ?? "",
        ),
      ).length / rows.length;

    /*
      The bar is the ARITHMETIC, not a round number I liked. Six avoided entries
      held at a floor of one, against roughly sixty parts of everything else,
      lands near nine percent — under one tile per sheet, which is what "idols
      do not have buzz cuts" honestly means.

      Both halves asserted: it must drop hard from the unleaned draw, AND it must
      not reach zero, because the reachable tile is the difference between a lean
      and a lock.
    */
    expect(shavedShare(leaned)).toBeLessThan(shavedShare(plain) / 3);
    expect(shavedShare(leaned)).toBeLessThan(0.12);
    expect(shavedShare(leaned)).toBeGreaterThan(0);
  });

  it("never beats a stated cut — deference outranks every tendency", async () => {
    /*
      "A k-pop idol with a shaved head" renders as written, and the pool's
      opinion about shaved heads is never consulted.

      Note the brief TEXT carries the words, not just the structured field: the
      code-owned gate is the authority on whether a cut was stated (D-89), so a
      test that only stubbed `statedHair` would be testing the interpreter's
      claim rather than the gate's answer.
    */
    const compiled = (await castingBriefCompiler({
      briefText: "a k-pop idol with a shaved head",
      candidateCount: 8,
      rollSeed: "avoid-stated",
      engine: engine({
        role: "k-pop idol",
        sex: "male",
        statedHair: { cutLength: "shaved head" },
        poolTendencies: { avoidFamilies: ["shaved", "cropped"] },
      }),
    } as never)) as unknown as { candidates: Array<{ resolvedIdentity: { realized: { hairStyle: unknown } } }> };

    // Coverage suppresses the authored cut entirely rather than substituting one
    // the pool prefers — the user's own words carry it to the image.
    for (const candidate of compiled.candidates) {
      expect(candidate.resolvedIdentity.realized.hairStyle).toBeNull();
    }
  });
});

describe("the parser", () => {
  it("drops anything outside the closed vocabularies", () => {
    expect(parsePoolTendencies({ ageLean: "middle-aged", facialHairLean: "stubbly" })).toEqual(
      NO_TENDENCIES,
    );
    expect(parsePoolTendencies("young")).toEqual(NO_TENDENCIES);
    // Families are closed too: an invented silhouette name is dropped.
    expect(parsePoolTendencies({ avoidFamilies: ["mohawk", "spiky"] }).avoidFamilies).toEqual([]);
    expect(parsePoolTendencies(null)).toEqual(NO_TENDENCIES);
  });

  it("keeps values that are in them", () => {
    expect(
      parsePoolTendencies({ ageLean: "20s", facialHairLean: "clean", heritageLean: "East Asian" }),
    ).toEqual({
      ageLean: "20s",
      facialHairLean: "clean",
      heritageLean: "East Asian",
      leanStrength: null,
      avoidFamilies: [],
    });
  });

  it("drops a heritage lean we have no vocabulary for, rather than approximating", () => {
    /*
      A lean toward "Southeast Asian" is exactly the honest k-pop tail we cannot
      express yet — the F6 heritage workstream owns it. Dropping it leaves the
      general cycle, which is WIDER than the truth rather than narrower: the
      safe direction, and better than snapping it onto a neighbouring row that
      would quietly cast the wrong people.
    */
    expect(parsePoolTendencies({ heritageLean: "Southeast Asian" }).heritageLean).toBeNull();
  });
});
