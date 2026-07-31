import { describe, expect, it } from "vitest";

import { castingBriefCompiler } from "./briefCompiler";
import { resolveCandidateIdentity, type FollowAnchor } from "./cohortPhotorealHuman";
import type { CastingIntent, ResolvedIdentity } from "./castingIntent";
import type { TextEngine } from "../providers/types";

/**
 * Follow means "more faces like this one".
 *
 * The founder's report: they followed a blonde ethereal woman and the next roll
 * held four men. Two causes stacked, and both are pinned here.
 *
 *   1. `readResolvedIdentity` demanded a string `build`, which is deliberately
 *      null on any brief that names a casting category — so the parent identity
 *      was discarded wholesale and nothing was inherited at all. That one lives
 *      in `rollService`; the shape of the bug is covered by the "role-carrying
 *      parent" case below.
 *   2. Even with an identity, the old `followFrom` copied the parent's heritage
 *      into the INTENT, making it a lock. Eight identical heritages is the
 *      opposite failure — clones instead of cousins.
 *
 * So the tests come in two halves: sex holds absolutely, and everything else
 * stays in the neighborhood while still varying.
 */

function intentOf(partial: Partial<CastingIntent> = {}): CastingIntent {
  return {
    cohort: "photoreal_human",
    role: "runway model",
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

const BLONDE_WOMAN: FollowAnchor = {
  sex: "female",
  heritage: [{ heritage: "Nordic", pct: 100 }],
  ageBand: "20s",
  hair: { family: "long", colour: "blonde" },
  look: null,
};

function eight(intent: CastingIntent, anchor: FollowAnchor | null): ResolvedIdentity[] {
  return Array.from({ length: 8 }, (_, position) =>
    resolveCandidateIdentity(intent, position, "follow-seed", anchor),
  );
}

describe("sex holds absolutely", () => {
  it("every candidate of a follow is the followed candidate's sex", () => {
    // The founder's defect, stated as an assertion: no men on this sheet.
    const resolved = eight(intentOf(), BLONDE_WOMAN);
    expect(resolved.map((r) => r.sex)).toEqual(Array(8).fill("female"));
  });

  it("without an anchor the same brief alternates sex, so the test is not vacuous", () => {
    const resolved = eight(intentOf(), null);
    expect(new Set(resolved.map((r) => r.sex)).size).toBeGreaterThan(1);
  });

  it("an explicit brief fact still outranks the anchor", () => {
    // The ratified precedence chain is unchanged: follow a woman, type "man",
    // the brief wins. Only the adapter is forbidden from varying it.
    const resolved = eight(intentOf({ sex: "male" }), BLONDE_WOMAN);
    expect(resolved.map((r) => r.sex)).toEqual(Array(8).fill("male"));
  });
});

describe("cousins, not clones, and never unrelated", () => {
  it("every candidate keeps the parent's primary heritage", () => {
    const resolved = eight(intentOf(), BLONDE_WOMAN);
    for (const candidate of resolved) {
      expect(candidate.heritage[0].heritage).toBe("Nordic");
    }
  });

  it("but the blend still varies, so they are not eight copies", () => {
    const resolved = eight(intentOf(), BLONDE_WOMAN);
    const shapes = new Set(resolved.map((r) => r.heritage.map((c) => c.heritage).join("+")));
    expect(shapes.size).toBeGreaterThan(1);
  });

  it("carries hair family and colour — the trait that could not be followed before", () => {
    const resolved = eight(intentOf(), BLONDE_WOMAN);
    for (const candidate of resolved) {
      expect(candidate.hair).toEqual({ family: "long", colour: "blonde" });
    }
  });

  it("carries the age band while letting the phase move", () => {
    const resolved = eight(intentOf(), BLONDE_WOMAN);
    expect(resolved.map((r) => r.ageBand)).toEqual(Array(8).fill("20s"));
    expect(new Set(resolved.map((r) => r.agePhase)).size).toBeGreaterThan(1);
  });

  it("keeps presence varying, because faces still need to differ", () => {
    const resolved = eight(intentOf(), BLONDE_WOMAN);
    expect(new Set(resolved.map((r) => r.energy)).size).toBeGreaterThan(1);
  });
});

describe("hair is authored, not left to the image model", () => {
  it("an ordinary roll gives eight candidates real hair", () => {
    const resolved = eight(intentOf(), null);
    for (const candidate of resolved) expect(candidate.hair).not.toBeNull();
  });

  it("colour is conditioned on heritage rather than sampled blind", () => {
    /*
      The trap in authoring hair at all: an unconditioned pick hands a West
      African candidate blonde hair a third of the time, which fights the
      restored IDENTITY_INTEGRITY block head-on.
    */
    const resolved = Array.from({ length: 24 }, (_, position) =>
      resolveCandidateIdentity(
        intentOf({ heritage: [{ heritage: "West African", pct: 100 }], ageBand: "20s" }),
        position,
        "hair-seed",
      ),
    );
    const colours = new Set(resolved.map((r) => r.hair?.colour));
    expect(colours.has("blonde")).toBe(false);
    expect(colours.has("red")).toBe(false);
  });

  it("grey arrives with age and never before it", () => {
    const young = Array.from({ length: 24 }, (_, position) =>
      resolveCandidateIdentity(intentOf({ ageBand: "20s" }), position, "grey-seed"),
    );
    expect(young.some((r) => r.hair?.colour === "grey" || r.hair?.colour === "white")).toBe(false);

    const old = Array.from({ length: 24 }, (_, position) =>
      resolveCandidateIdentity(intentOf({ ageBand: "70s+" }), position, "grey-seed"),
    );
    expect(old.some((r) => r.hair?.colour === "grey" || r.hair?.colour === "white")).toBe(true);
  });

  it("reaches the prompt, so the record does not lie about it", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "a retired boxer with a broken nose",
      candidateCount: 8,
      rollSeed: "hair-prompt",
      engine: {
        id: "test",
        complete: async () => ({
          text: JSON.stringify({ cohort: "photoreal_human", role: "retired boxer", reads: null }),
          latencyMs: 1,
          provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
        }),
      } satisfies TextEngine,
    });
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt).toMatch(/HAIR: /);
    }
  });
});

describe("the anchor never becomes a lock the user did not write", () => {
  it("inherited traits stay out of the lock contract", async () => {
    /*
      The structural trap. A non-null intent field means "the brief said it",
      and that convention feeds validateLocks and the brief echo's sentence. An
      anchored heritage smuggled in there would be a lock the user never wrote,
      a violation the moment a cousin legitimately varies, and a sentence
      claiming they pinned something they never mentioned.
    */
    const compiled = await castingBriefCompiler({
      briefText: "runway model",
      candidateCount: 8,
      rollSeed: "anchor-lock",
      followIdentity: {
        sex: "female",
        ageBand: "20s",
        agePhase: "mid",
        heritage: [{ heritage: "Nordic", pct: 100 }],
        build: null,
        hair: { family: "long", colour: "blonde" },
        energy: "warm",
        look: null,
      } as ResolvedIdentity,
      engine: {
        id: "test",
        complete: async () => ({
          text: JSON.stringify({ cohort: "photoreal_human", role: "runway model", reads: null }),
          latencyMs: 1,
          provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
        }),
      } satisfies TextEngine,
    });

    // Sex is the one inherited fact that IS a lock, by the founder's ruling.
    expect(compiled.lockContract).toMatchObject({ sex: "female" });
    // Everything else inherited must be absent from the contract.
    expect(compiled.lockContract).not.toHaveProperty("heritage");
    expect(compiled.lockContract).not.toHaveProperty("ageBand");
  });
});

describe("the variation generator actually varies", () => {
  /*
    Found by grading a real follow-run, not by reading code. Every axis used to
    derive its value from one hash shifted by a different amount, and the shifts
    collide with the weight totals: FNV-1a advances by its prime per position, so
    `(seed >>> 5) % 100` returns the SAME bucket for consecutive candidates.
    Hair family came back 1 distinct value across eight faces, and `ageBand` had
    been quietly doing the same (2 of 7) since before hair existed.

    A sheet whose entire job is eight different people cannot take its difference
    from a generator that repeats — so the spread is asserted, not assumed.
  */
  const openIntent = intentOf({ role: null });

  function spread(get: (r: ResolvedIdentity) => string | null, seeds = ["a", "b", "c", "d", "e"]) {
    return seeds.map((seed) => new Set(eightWith(openIntent, seed).map(get)).size);
  }

  function eightWith(intent: CastingIntent, seed: string): ResolvedIdentity[] {
    return Array.from({ length: 8 }, (_, position) =>
      resolveCandidateIdentity(intent, position, seed, null),
    );
  }

  it("age spans most of the band vocabulary across eight candidates", () => {
    for (const distinct of spread((r) => r.ageBand)) expect(distinct).toBeGreaterThanOrEqual(4);
  });

  it("build is not the same body eight times", () => {
    for (const distinct of spread((r) => r.build)) expect(distinct).toBeGreaterThanOrEqual(3);
  });

  it("hair family varies — the axis that came back 1-of-8", () => {
    for (const distinct of spread((r) => r.hair?.family ?? null)) {
      expect(distinct).toBeGreaterThanOrEqual(3);
    }
  });

  it("hair colour varies", () => {
    for (const distinct of spread((r) => r.hair?.colour ?? null)) {
      expect(distinct).toBeGreaterThanOrEqual(3);
    }
  });
});
