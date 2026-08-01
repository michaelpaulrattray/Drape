import { describe, expect, it } from "vitest";

import {
  VARIANCE_FLOOR,
  VISIBLE_AXES,
  countVisibleVariance,
  liveAxisCount,
  planVariance,
} from "./varianceBudget";
import { REALIZED_AXIS_KEYS } from "../../shared/castingRealization";
import { castingBriefCompiler } from "./briefCompiler";
import type { TextEngine } from "../providers/types";

/**
 * A paid sheet where the pick doesn't matter carries no information.
 *
 * THE SHEET THAT FORCED IT: a follow of a blonde candidate under "a females 23
 * high fashion editorial casting for Versace" came back an eight-way tie. Four
 * rules, each individually correct — the follow anchored sex, heritage and
 * colour; the captured direction locked the look flat; the stated age locked
 * the band; the category put hair at silhouette tier — and their INTERSECTION
 * left no axis alive that separates two tiles at arm's length.
 *
 * Nothing was broken. The sheet was simply worthless, and it cost the same as
 * a good one. That is the class this measures.
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

/** The exact stack: follow + stated age + captured direction + category. */
async function versaceFollow(rollSeed: string) {
  return castingBriefCompiler({
    briefText: "a females 23 high fashion editorial casting for versace",
    candidateCount: 8,
    rollSeed,
    followIdentity: {
      sex: "female",
      ageBand: "20s",
      agePhase: "early",
      heritage: [{ heritage: "Nordic", pct: 100 }],
      energy: "cool",
      hair: { family: "long", colour: "blonde" },
      look: "severe minimal",
      realized: {
        eyeColour: "blue",
        hairStyle: { name: "simple long hair", family: "long" },
        facialHair: null,
        hairTexture: "straight",
        hairModifiers: null,
        wornState: "loose",
        browStyle: "feathered",
        skinCharacter: "plain",
      },
    },
    engine: engine({
      role: "high fashion editorial model",
      sex: "female",
      ageBand: "20s",
      look: "severe minimal",
      composedDirection: { thesis: "Severe, architectural faces.", avoid: "Soft polish." },
    }),
  } as never);
}

describe("the budget counts what a viewer can actually tell apart", () => {
  it("does not count an axis carrying one value across all eight", () => {
    const flat = Array.from({ length: 8 }, () => ({
      heritage: [{ heritage: "Nordic", pct: 100 }],
      agePhase: "early",
      look: "severe minimal",
      energy: "cool",
      realized: {
        hairStyle: { name: "simple long hair", family: "long" },
        hairTexture: "straight",
        wornState: "loose",
        facialHair: null,
        eyeColour: "blue",
        skinCharacter: "plain",
      },
    })) as never[];
    expect(liveAxisCount(flat)).toBe(0);
    const counts = countVisibleVariance(flat);
    for (const axis of VISIBLE_AXES) expect(counts[axis]).toBe(1);
  });

  it("counts an axis the moment it carries two", () => {
    const two = Array.from({ length: 8 }, (_, i) => ({
      heritage: [{ heritage: "Nordic", pct: 100 }],
      agePhase: "early",
      look: "severe minimal",
      energy: "cool",
      realized: {
        hairStyle: { name: "simple long hair", family: "long" },
        hairTexture: "straight",
        wornState: i < 4 ? "loose" : "worn up",
        facialHair: null,
        eyeColour: "blue",
        skinCharacter: "plain",
      },
    })) as never[];
    expect(liveAxisCount(two)).toBe(1);
  });
});

describe("the release never touches a stated lock", () => {
  it("offers no headroom it has not earned", () => {
    // A sheet with everything stated can spend only the presence rung, which
    // nobody states — so it confesses rather than quietly varying a fact.
    const plan = planVariance([] as never, 1);
    expect(plan.release.length).toBeLessThanOrEqual(1);
    expect(plan.confess).toBe(true);
  });

  it("stops confessing once the floor is met", () => {
    const varied = Array.from({ length: 8 }, (_, i) => ({
      heritage: [{ heritage: i % 2 ? "Nordic" : "Slavic", pct: 100 }],
      agePhase: i % 3 ? "early" : "late",
      look: "severe minimal",
      energy: i % 2 ? "cool" : "warm",
      realized: {
        hairStyle: { name: "simple long hair", family: "long" },
        hairTexture: "straight",
        wornState: "loose",
        facialHair: null,
        eyeColour: "blue",
        skinCharacter: "plain",
      },
    })) as never[];
    expect(liveAxisCount(varied)).toBeGreaterThanOrEqual(VARIANCE_FLOOR);
    expect(planVariance(varied, 5).confess).toBe(false);
    expect(planVariance(varied, 5).release).toEqual([]);
  });
});

describe("the Versace stack, reproduced", () => {
  it("clears the floor where it used to tie", async () => {
    /*
      The regression this exists for. Before worn state, texture-at-bias and
      the budget, this exact combination produced eight faces a founder could
      not choose between — and the pass bar the founder set is a sheet where
      choosing one tile over another is defensible.
    */
    let cleared = 0;
    for (let i = 0; i < 8; i += 1) {
      const compiled = (await versaceFollow(`versace-${i}`)) as unknown as {
        candidates: Array<{ resolvedIdentity: unknown }>;
        variance: { live: number };
      };
      if (compiled.variance.live >= VARIANCE_FLOOR) cleared += 1;
    }
    expect(cleared).toBe(8);
  });

  it("no longer sends eight identical hair lines, which is what the tie looked like", async () => {
    /*
      Asserted on the composed HAIR line rather than on any single axis, because
      the tie was a property of the SHEET as the founder saw it: eight faces
      described identically. Worn state is usually what breaks it here — a
      ponytail against loose hair reads at arm's length where an eye colour does
      not — but the bar is the sentence, not the mechanism that varied it.
    */
    const compiled = (await versaceFollow("versace-worn")) as unknown as {
      candidates: Array<{ prompt: string }>;
    };
    const lines = new Set(
      compiled.candidates.map((c) => c.prompt.match(/ HAIR: [^.]*\./)?.[0] ?? ""),
    );
    expect(lines.size).toBeGreaterThan(1);
  });
});

describe("registry-shaped, so M7 slice zero owns it structurally", () => {
  it("counts every realized axis that is visible, and names the ones it skips", () => {
    /*
      The completeness check that stops a new axis being silently uncounted —
      which is exactly how an unowned axis collapses in the first place. When a
      realized axis is added, it either joins VISIBLE_AXES or is named here as
      deliberately invisible.
    */
    const invisible = new Set(["hairModifiers", "browStyle"]);
    for (const key of REALIZED_AXIS_KEYS) {
      const counted =
        (VISIBLE_AXES as readonly string[]).includes(key)
        || (key === "hairStyle" && (VISIBLE_AXES as readonly string[]).includes("cut"))
        || (key === "hairTexture" && (VISIBLE_AXES as readonly string[]).includes("texture"))
        || invisible.has(key);
      expect(counted, `realized axis "${key}" is neither counted nor declared invisible`).toBe(true);
    }
  });
});
