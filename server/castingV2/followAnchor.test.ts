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

/*
  `realized` was MISSING from this fixture, and the suite never noticed because
  the typecheck excluded test files. So the follow tests below have been
  asserting inheritance against an anchor that carried no realized axes at all —
  meaning no test in this file has ever exercised realized-axis inheritance, the
  single most-changed thing about follows this week. The fixture is complete
  now, and `tsconfig.casting-tests.json` is what stops it drifting again.
*/
const BLONDE_WOMAN: FollowAnchor = {
  sex: "female",
  heritage: [{ heritage: "Nordic", pct: 100 }],
  ageBand: "20s",
  hair: { family: "long", colour: "blonde" },
  look: null,
  realized: {
    eyeShape: null,
    eyeColour: "pale blue",
    hairStyle: { name: "simple long hair", family: "long" },
    facialHair: null,
    hairTexture: "straight",
    hairModifiers: null,
    wornState: null,
    browStyle: "feathered",
    skinCharacter: "lightly freckled",
    beardGrey: null,
  },
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

  it("holds the followed look on most, and lets two or three drift", () => {
    /*
      Founder ruling, round 5: look is an anchor, not a lock. The first version
      carried it flat and the graded sheet read gaunt as a group — every
      candidate inheriting "angular and unslept". Most hold; a few move, so the
      sheet stays one casting without becoming one mood.
    */
    const anchored: FollowAnchor = { ...BLONDE_WOMAN, look: "severe minimal" };
    for (const seed of ["s1", "s2", "s3", "s4"]) {
      const looks = Array.from({ length: 8 }, (_, position) =>
        resolveCandidateIdentity(intentOf(), position, seed, anchored).look,
      );
      const held = looks.filter((look) => look === "severe minimal").length;
      const drifted = looks.length - held;
      expect(held, seed).toBeGreaterThanOrEqual(5);
      expect(drifted, seed).toBeGreaterThanOrEqual(2);
      expect(drifted, seed).toBeLessThanOrEqual(3);
      // Never unrelated: a drifted look is still a look, never null.
      for (const look of looks) expect(look).not.toBeNull();
    }
  });

  it("an explicitly stated look still locks flat across all eight", () => {
    // The archetype law is unchanged — anchoring is what the FOLLOW does, not
    // what a stated look does.
    const looks = Array.from({ length: 8 }, (_, position) =>
      resolveCandidateIdentity(intentOf({ look: "quiet luxury" }), position, "stated", {
        ...BLONDE_WOMAN,
        look: "severe minimal",
      }).look,
    );
    expect(looks).toEqual(Array(8).fill("quiet luxury"));
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

describe("a locked look still lets presence differentiate", () => {
  it("puts presence in the prompt when the look is pinned flat", async () => {
    /*
      The sameness bug. The rule was "one axis or the other, never both
      shouting" — right when the LOOK varies across the eight, because then the
      whisper is the difference. Wrong when the brief pins a look: all eight got
      an identical look block, presence was computed and never reached the
      prompt, and the only things left differing were heritage and hair. Inside
      a locked heritage that is almost nothing, which is why the founder's sheet
      came back as eight men with the same hair, the same eyes and no
      personality.
    */
    const compiled = await castingBriefCompiler({
      briefText: "a male fashion model, commanding glamour",
      candidateCount: 8,
      rollSeed: "locked-look",
      engine: {
        id: "test",
        complete: async () => ({
          text: JSON.stringify({
            cohort: "photoreal_human",
            role: "male fashion model",
            sex: "male",
            look: "commanding glamour",
            variationAxis: "look",
            reads: null,
          }),
          latencyMs: 1,
          provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
        }),
      } satisfies TextEngine,
    });

    for (const candidate of compiled.candidates) {
      expect(candidate.prompt).toContain("PRESENCE:");
    }
    // And the presences genuinely differ, or the fix is decorative.
    const presences = new Set(compiled.candidates.map((c) => c.resolvedIdentity.energy));
    expect(presences.size).toBeGreaterThanOrEqual(6);
  });

  it("still suppresses presence when the look is the varying axis", async () => {
    // Eight different houses' casting, each with its own whisper — stacking a
    // disposition line there would give the model two instructions for one face.
    const compiled = await castingBriefCompiler({
      briefText: "a male fashion model",
      candidateCount: 8,
      rollSeed: "varying-look",
      engine: {
        id: "test",
        complete: async () => ({
          text: JSON.stringify({
            cohort: "photoreal_human",
            role: "male fashion model",
            variationAxis: "look",
            reads: null,
          }),
          latencyMs: 1,
          provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
        }),
      } satisfies TextEngine,
    });
    const withPresence = compiled.candidates.filter((c) => c.prompt.includes("PRESENCE:"));
    expect(withPresence).toHaveLength(0);
    // The looks are what differ instead.
    expect(new Set(compiled.candidates.map((c) => c.resolvedIdentity.look)).size).toBeGreaterThan(5);
  });
});

describe("stated hair outranks authored hair", () => {
  /*
    Caught by the seed-verification clause, which is the only reason it was
    caught: "Runway model, early 20s, shaved head" came back with a full head of
    curls. The hair axis added for follow-inheritance was assigning a family at
    random and writing it into the SUBJECT block, contradicting the user's own
    sentence a few lines above it.

    The drop-a-stated-fact family again — this time authored by the fix for a
    different one. Every other axis in this file already defers to a stated
    fact; hair had simply never been asked, because until follow it was not a
    field at all.
  */
  async function promptFor(role: string, notes: string | null): Promise<string> {
    const compiled = await castingBriefCompiler({
      briefText: `${role} ${notes ?? ""}`.trim(),
      candidateCount: 1,
      rollSeed: `hair:${role}:${notes}`,
      engine: {
        id: "test",
        complete: async () => ({
          text: JSON.stringify({
            cohort: "photoreal_human",
            role,
            characterNotes: notes,
            reads: null,
          }),
          latencyMs: 1,
          provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
        }),
      } satisfies TextEngine,
    });
    return compiled.candidates[0].prompt;
  }

  it("writes no hair line when the brief already stated the hair", async () => {
    const prompt = await promptFor("runway model", "shaved head");
    expect(prompt).toContain("shaved head");
    // The authored line is what contradicted it. It must simply not be there.
    // Keyed on the authored hair line's own tail, not on "HAIR: " — the realized
    // FACIAL HAIR line contains that substring and would match by accident.
    expect(prompt).not.toContain("Cut and worn as that style is genuinely worn");
  });

  /*
    REWRITTEN FOR D-79's approved ruling, deliberately rather than deleted.

    "Greying at the temples" moved OUT of this list with the ruling: it states a
    process and names no cut, so authoring one is now the correct behaviour and
    the whole point of partial deference — the founder's own silver-temples
    brief is supposed to come back with eight distinct cuts.

    "Silver crew cut" stayed, and it caught a real gap while it did. The
    tokenizer splits "crew cut" into two words that are each innocent, so the
    gate saw a colour and no length, and partial deference would have authored a
    cut over the one the user asked for — the D-79 contradiction arriving
    through the gate rather than through the interpreter. `HAIR_PART_PHRASES`
    closes it.
  */
  it.each([
    ["silver crew cut"],
    ["long blonde hair"],
    ["bleached brows and a buzz cut"],
  ])("defers on %j — the brief named the cut itself", async (notes) => {
    expect(await promptFor("creator", notes)).not.toContain("Cut and worn as that style is genuinely worn");
  });

  it("authors a cut on 'greying at the temples' — that is the D-79 ruling", async () => {
    // Stating a process about the colour must no longer silence the cut. This
    // is the assertion that would have failed before the re-ship.
    expect(await promptFor("creator", "greying at the temples")).toContain(
      "Cut and worn as that style is genuinely worn",
    );
  });

  it("still authors hair when the brief says nothing about it", async () => {
    /*
      The follow inheritance depends on hair being authored, so deference must
      be narrow: silence still gets a hair, or eight candidates share one.

      Asserted mode-agnostically. This brief states a role, so under the
      styling-tier ruling it composes at BIAS resolution — silhouette rather
      than a named cut. What matters here is that a hair line exists at all,
      which is the property the follow depends on; which tier it speaks at is
      `stylingResolution.test.ts`'s subject.
    */
    /*
      Scoped to the extracted HAIR line, not the whole prompt. The bias BEARD
      prose ends on the same deferral clause, so a whole-prompt search would be
      satisfied by a facial-hair line while the hair line was silent — a pass on
      hash luck rather than on the property being tested.
    */
    const prompt = await promptFor("oncology nurse", "tired at the end of a shift");
    const cleaned = prompt.split("FACIAL HAIR:").join("FH:");
    const at = cleaned.indexOf(" HAIR: ");
    const hairLine = at < 0 ? "" : cleaned.slice(at, cleaned.indexOf(".", at) + 1);
    expect(hairLine, "no authored HAIR line at all").not.toBe("");
    const authored =
      hairLine.includes("Cut and worn as that style is genuinely worn") ||
      hairLine.includes("as this casting wears it") ||
      // The prescription line's closer sits after the full stop this slice ends
      // on, so a named cut is the other legitimate shape.
      hairLine.length > 12;
    expect(authored, "no authored hair line in either tier").toBe(true);
  });
});
