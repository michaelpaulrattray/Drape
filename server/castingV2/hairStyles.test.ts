import { describe, expect, it } from "vitest";

import { applySheetTaste, realizeAxes } from "./realizedAxes";
import { composeCandidatePrompt, resolveCandidateIdentity } from "./cohortPhotorealHuman";
import { castingBriefCompiler, deterministicBriefCompiler } from "./briefCompiler";
import type { TextEngine } from "../providers/types";
import { ARCHETYPES, type CastingIntent, type HeritageComponent } from "./castingIntent";
import {
  DEFAULT_HAIR_COLOURS,
  FINISH_RENDER,
  HAIR_COLOUR_WEIGHTS,
  adjacentShade,
  statedFinish,
} from "./hairStyles";

/**
 * Items 6 and 7: the hairstyle vocabulary and the skin finish.
 *
 * Both are the same defect as the prior-collapse batch, one level down. Hair
 * was "realized" — but over six silhouettes, so eight candidates could all be
 * "mid-length brown" and arrive as one haircut. Finish was deferred to a field
 * that no longer existed, so nothing decided it and every sheet got the same
 * generic studio skin.
 */

function heritage(name: string): HeritageComponent[] {
  return [{ heritage: name as HeritageComponent["heritage"], pct: 100 }];
}

function sheet(options: {
  heritage: string;
  sex?: "male" | "female" | "nonbinary";
  ageBand?: "teens" | "20s" | "30s" | "40s" | "50s" | "60s" | "70s+";
  seed?: string;
}) {
  return Array.from({ length: 8 }, (_, position) =>
    realizeAxes({
      heritage: heritage(options.heritage),
      ageBand: options.ageBand ?? "30s",
      sex: options.sex ?? "female",
      position,
      rollSeed: options.seed ?? "styles",
    }),
  );
}

const SEEDS = ["a", "b", "c", "d", "e", "f", "g", "h"];

describe("the hairstyle axis carries named cuts", () => {
  it("draws widely enough for the sheet to have something to work with", () => {
    // The raw draw's job. The FLOOR is a sheet property, asserted below.
    for (const seed of SEEDS) {
      for (const sex of ["male", "female"] as const) {
        const names = new Set(sheet({ heritage: "British Isles", sex, seed }).map((a) => a.hairStyle!.name));
        expect(names.size, `${sex}/${seed}`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("keeps statement cuts rare in the raw draw", () => {
    // The weights' job. The per-sheet CAP is a different rule, asserted below
    // through the compiler — which is the only place that can see a sheet.
    const all = SEEDS.flatMap((seed) => sheet({ heritage: "Western European", seed }));
    const rate = all.filter((a) => a.hairStyle!.statement).length / all.length;
    expect(rate).toBeLessThan(0.15);
    expect(rate).toBeGreaterThan(0); // rare-but-POSSIBLE; never is not restraint
  });

  it("gets rarer with age — a wolf cut at seventy reads as costume", () => {
    const rate = (ageBand: "20s" | "70s+") => {
      const eight = Array.from({ length: 30 }, (_, i) => sheet({ heritage: "Nordic", ageBand, seed: `age${i}` }));
      const all = eight.flat();
      return all.filter((a) => a.hairStyle!.statement).length / all.length;
    };
    expect(rate("70s+")).toBeLessThan(rate("20s"));
  });

  it("draws on coiled-hair traditions where heritage supports them", () => {
    const names = new Set(
      Array.from({ length: 10 }, (_, i) => sheet({ heritage: "West African", seed: `wa${i}` }))
        .flat()
        .map((a) => a.hairStyle!.name),
    );
    for (const expected of ["braids", "locs", "afro", "twist-out"]) {
      expect(names.has(expected), expected).toBe(true);
    }
  });

  it("never offers those traditions to a heritage they do not belong to", () => {
    const names = new Set(
      Array.from({ length: 10 }, (_, i) => sheet({ heritage: "East Asian", seed: `ea${i}` }))
        .flat()
        .map((a) => a.hairStyle!.name),
    );
    for (const absent of ["locs", "afro", "twist-out"]) {
      expect(names.has(absent), absent).toBe(false);
    }
  });

  it("never pairs a style with a texture that contradicts it", () => {
    /*
      D11's legality matrix, done by construction. A style that dictates its
      own texture overrides the axis, so "straight locs" cannot be expressed —
      not because a rule rejects it, but because nothing can produce it.
    */
    const all = SEEDS.flatMap((seed) => [
      ...sheet({ heritage: "West African", seed }),
      ...sheet({ heritage: "Latino", sex: "male", seed }),
    ]);
    for (const axes of all) {
      if (axes.hairStyle!.texture) expect(axes.hairTexture).toBe(axes.hairStyle!.texture);
    }
  });

  it("varies independently of the other axes", () => {
    // The shifted-hash collision, re-asserted for the new axis.
    const eight = sheet({ heritage: "Mediterranean", sex: "male" });
    const pairs = new Set(eight.map((a) => `${a.hairStyle!.name}|${a.eyeColour}`));
    expect(pairs.size).toBeGreaterThanOrEqual(new Set(eight.map((a) => a.hairStyle!.name)).size);
  });
});

describe("hair colour at colourist resolution", () => {
  it("never hands a heritage a colour that fights its bone structure", () => {
    const intent = { heritage: heritage("West African"), reads: [] } as unknown as CastingIntent;
    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      seen.add(resolveCandidateIdentity(intent, i % 8, `wa${i}`).hair?.colour ?? "");
    }
    for (const banned of ["blonde", "golden blonde", "ash blonde", "platinum blonde", "red", "copper", "strawberry blonde"]) {
      expect(seen.has(banned), banned).toBe(false);
    }
  });

  it("reaches the new shades on the heritages that carry them", () => {
    const intent = { heritage: heritage("Nordic"), reads: [] } as unknown as CastingIntent;
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      seen.add(resolveCandidateIdentity(intent, i % 8, `no${i}`).hair?.colour ?? "");
    }
    expect(seen.has("platinum blonde") || seen.has("ash blonde")).toBe(true);
    expect(seen.has("strawberry blonde") || seen.has("copper")).toBe(true);
  });
});

describe("the skin finish", () => {
  function promptWith(options: { archetype: keyof typeof ARCHETYPES; brief: string }) {
    const intent = {
      cohort: "photoreal_human",
      role: null,
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
    } as unknown as CastingIntent;
    return composeCandidatePrompt({
      briefText: options.brief,
      intent,
      resolved: resolveCandidateIdentity(intent, 0, "finish"),
      archetype: options.archetype,
      seed: 1,
    });
  }

  it("injects the engineered prose, not the bare word", () => {
    // A9's craft is the expansion. "matte" alone renders as nothing specific.
    const prompt = promptWith({ archetype: "raw editorial", brief: "an oncology nurse" });
    expect(prompt).toContain("SKIN FINISH:");
    expect(prompt).toContain(FINISH_RENDER.matte);
  });

  it("lets the archetype decide when the brief says nothing", () => {
    expect(promptWith({ archetype: "clean commercial", brief: "a teacher" })).toContain(FINISH_RENDER.dewy);
    expect(promptWith({ archetype: "screen presence", brief: "a teacher" })).toContain(FINISH_RENDER.luminous);
  });

  it("lets a stated finish outrank the archetype", () => {
    const prompt = promptWith({ archetype: "clean commercial", brief: "a teacher with matte unpowdered skin" });
    expect(prompt).toContain(FINISH_RENDER.matte);
    expect(prompt).not.toContain(FINISH_RENDER.dewy);
  });

  it("reads a finish out of ordinary phrasing", () => {
    expect(statedFinish("a sweaty boxer between rounds")).toBe("oily");
    expect(statedFinish("a weathered fisherman")).toBe("weathered");
    expect(statedFinish("dewy glass skin")).toBe("dewy");
  });

  it("refuses to guess when the brief points two ways at once", () => {
    // Same restraint as the interpreter's: ambiguity is not a licence to pick.
    expect(statedFinish("matte but dewy somehow")).toBeNull();
  });

  it("says nothing about a finish the brief never raised", () => {
    expect(statedFinish("a runway model in her early 20s")).toBeNull();
  });

  it("gives every archetype a finish, so no sheet falls back to nothing", () => {
    for (const [name, entry] of Object.entries(ARCHETYPES)) {
      expect(FINISH_RENDER[entry.finish], name).toBeTruthy();
    }
  });
});

describe("the sheet-level taste rules", () => {
  /*
    Asserted through the COMPILER, on the real resolve path, because that is
    where the rules now live and because the first implementation passed a
    fixed-heritage unit test at 200/200 while leaking on 2.3% of real sheets.
    A sheet property tested against a synthetic sheet proves nothing about
    sheets.

    Everything here is deterministic in (brief, rollSeed), so these are exact
    assertions over hundreds of seeds, not tolerances.
  */
  /*
    A CONTEXT-FREE intent, deliberately.

    These bars are about the named-cut vocabulary, which only reaches the prompt
    when the brief carries no creative context (founder ruling, 2026-08-01:
    styling is subordinate to context). `deterministicBriefCompiler` sets `role`
    to the brief text itself, so it now composes at bias resolution and these
    assertions would be measuring the wrong tier. Stating the intent explicitly
    keeps each test testing what it was written to test.
  */
  async function sheetsOf(brief: string, count = 300) {
    const engine = {
      id: "context-free",
      complete: async () => ({
        text: JSON.stringify({ cohort: "photoreal_human", role: null, archetype: null, look: null }),
        latencyMs: 1,
        provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
      }),
    } as unknown as TextEngine;
    return Promise.all(
      Array.from({ length: count }, (_, roll) =>
        castingBriefCompiler({ briefText: brief, candidateCount: 8, rollSeed: `bars-${brief}-${roll}`, engine }),
      ),
    );
  }

  const BRIEFS = [
    "a model",
    "a male model",
    "a west african woman in her 40s",
    "a nordic man",
    "an oncology nurse at the end of a shift",
  ];

  it.each(BRIEFS)("never puts two statement cuts on one sheet — %j", async (brief) => {
    for (const compiled of await sheetsOf(brief)) {
      const statements = compiled.candidates.filter(
        (candidate) => candidate.resolvedIdentity.realized.hairStyle!.statement,
      ).length;
      expect(statements).toBeLessThanOrEqual(1);
    }
  });

  it.each(BRIEFS)("reaches five distinct cuts on every sheet — %j", async (brief) => {
    // The founder's acceptance bar for item 6. Distinct means by NAME.
    for (const compiled of await sheetsOf(brief)) {
      const names = new Set(
        compiled.candidates.map((candidate) => candidate.resolvedIdentity.realized.hairStyle!.name),
      );
      expect(names.size).toBeGreaterThanOrEqual(5);
    }
  });

  it("still lets a sheet repeat a cut — the floor is a floor, not a ban", async () => {
    /*
      Two women on a real street both have long hair, and the street ruling
      governs who any one person is. If every sheet came back with eight
      different cuts the pass would have replaced the weights rather than
      bounded them.
    */
    const repeats = (await sheetsOf("a model", 100)).filter((compiled) => {
      const names = compiled.candidates.map((c) => c.resolvedIdentity.realized.hairStyle!.name);
      return new Set(names).size < names.length;
    });
    expect(repeats.length).toBeGreaterThan(50);
  });

  it("never strands a texture on a cut that was swapped under it", async () => {
    // The swap has to recompute texture, or a demoted set of locs leaves
    // "coiled" attached to a bob — the illegal pairing legality-in-the-entry
    // exists to make unsayable.
    for (const compiled of await sheetsOf("a model", 200)) {
      for (const candidate of compiled.candidates) {
        const { hairStyle, hairTexture } = candidate.resolvedIdentity.realized;
        if (hairStyle?.texture) expect(hairTexture).toBe(hairStyle.texture);
      }
    }
  });

  it("describes in the prompt exactly the person it persists", async () => {
    /*
      The pass runs BEFORE composition. Adjusting a record afterwards would
      leave a stored identity that contradicts the image the customer was sent,
      and nothing downstream would ever notice.
    */
    for (const compiled of await sheetsOf("a model", 100)) {
      for (const candidate of compiled.candidates) {
        expect(candidate.prompt).toContain(candidate.resolvedIdentity.realized.hairStyle!.name);
      }
    }
  });

  it("leaves a follow alone — eight inherited cuts is the follow working", async () => {
    const parent = resolveCandidateIdentity(
      { heritage: [], reads: [] } as unknown as CastingIntent,
      0,
      "parent-roll",
    );
    const compiled = await castingBriefCompiler({
      briefText: "someone like her",
      candidateCount: 8,
      rollSeed: "follow-roll",
      followIdentity: parent,
      engine: {
        id: "test",
        complete: async () => ({
          text: JSON.stringify({ cohort: "photoreal_human", role: "model", characterNotes: null, reads: null }),
          latencyMs: 1,
          provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
        }),
      } satisfies TextEngine,
    });
    const names = new Set(compiled.candidates.map((c) => c.resolvedIdentity.realized.hairStyle!.name));
    expect(names.size).toBe(1);
    expect([...names][0]).toBe(parent.realized.hairStyle!.name);
  });

  it("says nothing about hair at all when the brief already decided it", async () => {
    const compiled = await deterministicBriefCompiler({
      briefText: "a woman with a shaved head",
      candidateCount: 8,
      rollSeed: "stated-hair",
    });
    for (const candidate of compiled.candidates) {
      // Keyed on the hair line's own closing clause, not on "HAIR:" — the
      // constant's "FACIAL HAIR:" contains that substring, and an assertion
      // that matches the wrong line is an assertion that proves nothing.
      expect(candidate.prompt).not.toContain("Cut and worn as that style is genuinely worn");
    }
  });
});

describe("the colour pair-breaker", () => {
  /*
    Founder ruling, 2026-08-01: colour gets a pair-breaker, NOT a distinctness
    floor. A floor would fight realism to satisfy a metric, because palette
    width is heritage-dependent — a Mediterranean or East Asian brief
    legitimately produces a mostly dark-haired sheet. What actually went wrong
    on the graded sheet was narrower: two candidates read as TWINS because they
    shared both colour and silhouette.

    **What is guaranteed, precisely.** Every collision the palette can break is
    broken. A collision the palette CANNOT break stands, separated by its cut —
    and that case is real rather than theoretical: an all-female East Asian
    sheet has three style families and two colours, so six distinct
    (colour, family) pairs exist for eight slots. Asserting "never collides"
    would be asserting something arithmetic cannot deliver, so these tests
    assert the two halves separately: no BREAKABLE collision survives, and no
    re-pick ever leaves the candidate's own heritage palette.
  */
  function lockedSheet(heritageName: string, sex: "male" | "female", rollSeed: string) {
    const intent = { heritage: heritage(heritageName), sex, reads: [] } as unknown as CastingIntent;
    return applySheetTaste(
      Array.from({ length: 8 }, (_, position) => resolveCandidateIdentity(intent, position, rollSeed)),
      rollSeed,
    );
  }

  function collisions(candidates: ReturnType<typeof lockedSheet>) {
    const seen = new Set<string>();
    const clashes: string[] = [];
    for (const candidate of candidates) {
      const colour = candidate.hair?.colour;
      if (!colour || colour === "grey" || colour === "white") continue;
      const key = `${colour}|${candidate.realized.hairStyle!.family}`;
      if (seen.has(key)) clashes.push(key);
      seen.add(key);
    }
    return clashes;
  }

  it.each(["a model", "a male model", "a woman in her 20s"])(
    "leaves no breakable collision on an open brief — %j",
    async (brief) => {
      for (let roll = 0; roll < 150; roll += 1) {
        const compiled = await deterministicBriefCompiler({
          briefText: brief,
          candidateCount: 8,
          rollSeed: `pair-${brief}-${roll}`,
        });
        const seen = new Set<string>();
        for (const candidate of compiled.candidates) {
          const { hair, heritage: components, realized } = candidate.resolvedIdentity;
          const colour = hair?.colour;
          if (!colour || colour === "grey" || colour === "white") continue;
          const family = realized.hairStyle?.family;
          if (!family) continue;
          const key = `${colour}|${family}`;
          if (seen.has(key)) {
            /*
              A survivor is acceptable only if nothing in this candidate's own
              palette could have replaced it. Checking that — rather than
              tolerating a failure rate — is what stops this being a test that
              passes because the rule quietly stopped working.
            */
            const primary = components[0]?.heritage ?? "";
            const palette = HAIR_COLOUR_WEIGHTS[primary] ?? DEFAULT_HAIR_COLOURS;
            const escape = adjacentShade(colour, palette, 0, (shade) => !seen.has(`${shade}|${family}`));
            expect(escape, `${brief} roll ${roll}: ${key} was breakable`).toBeNull();
          }
          seen.add(key);
        }
      }
    },
  );

  it("breaks every collision outright where the palette is wide", () => {
    // Nordic and the British Isles carry nine or ten shades, so the space is
    // never exhausted and the rule holds absolutely.
    for (const heritageName of ["Nordic", "British Isles", "Western European"]) {
      for (let roll = 0; roll < 80; roll += 1) {
        const candidates = lockedSheet(heritageName, roll % 2 ? "male" : "female", `wide-${heritageName}-${roll}`);
        expect(collisions(candidates), `${heritageName}/${roll}`).toEqual([]);
      }
    }
  });

  it("leaves a dark-haired sheet dark — the cuts carry it, not invented colour", () => {
    /*
      The reason this is a pair-breaker rather than a floor. Eight black-haired
      East Asian candidates are correct; what makes the sheet castable is that
      the cuts differ, which the style rules already guarantee.
    */
    const colours = new Set<string>();
    for (let roll = 0; roll < 60; roll += 1) {
      for (const candidate of lockedSheet("East Asian", "female", `dark-${roll}`)) {
        if (candidate.hair) colours.add(candidate.hair.colour);
      }
    }
    for (const colour of colours) {
      expect(["black", "dark brown", "grey", "white"]).toContain(colour);
    }
  });

  it("re-picks inside the candidate's own heritage palette, never outside it", () => {
    // A pair-breaker that reached for any colour would be a heritage-washing
    // vector wearing a taste rule's clothes.
    const colours = new Set<string>();
    for (let roll = 0; roll < 60; roll += 1) {
      for (const candidate of lockedSheet("West African", roll % 2 ? "male" : "female", `wash-${roll}`)) {
        if (candidate.hair) colours.add(candidate.hair.colour);
      }
    }
    for (const banned of ["blonde", "golden blonde", "ash blonde", "platinum blonde", "red", "copper", "strawberry blonde", "auburn", "chestnut"]) {
      expect(colours.has(banned), banned).toBe(false);
    }
  });

  it("never shifts a grey or white head", () => {
    /*
      Greying is age, not a palette draw. Shifting one would quietly edit how
      old the person reads — so the ladder has no rung for them, and a twinned
      pair of grey heads is separated by its cut instead.
    */
    const intent = {
      heritage: heritage("British Isles"),
      sex: "female",
      ageBand: "60s",
      reads: [],
    } as unknown as CastingIntent;
    for (let roll = 0; roll < 80; roll += 1) {
      const raw = Array.from({ length: 8 }, (_, position) =>
        resolveCandidateIdentity(intent, position, `grey-${roll}`),
      );
      const tasted = applySheetTaste(raw, `grey-${roll}`);
      raw.forEach((before, index) => {
        if (before.hair?.colour === "grey" || before.hair?.colour === "white") {
          expect(tasted[index].hair?.colour).toBe(before.hair?.colour);
        }
      });
    }
  });

  it("actually moves a colour when it has to", () => {
    // The rule has to be observable doing its job, or it could be a no-op that
    // passes every "no collision" assertion by never colliding in the first
    // place.
    let moved = 0;
    for (let roll = 0; roll < 200; roll += 1) {
      const intent = { heritage: heritage("British Isles"), sex: "female", reads: [] } as unknown as CastingIntent;
      const raw = Array.from({ length: 8 }, (_, position) =>
        resolveCandidateIdentity(intent, position, `move-${roll}`),
      );
      const tasted = applySheetTaste(raw, `move-${roll}`);
      moved += raw.filter((before, index) => before.hair?.colour !== tasted[index].hair?.colour).length;
    }
    expect(moved).toBeGreaterThan(0);
  });

  it("carries the shifted colour into the prompt, not just the record", async () => {
    for (let roll = 0; roll < 60; roll += 1) {
      const compiled = await deterministicBriefCompiler({
        briefText: "a model",
        candidateCount: 8,
        rollSeed: `prompt-${roll}`,
      });
      for (const candidate of compiled.candidates) {
        const colour = candidate.resolvedIdentity.hair?.colour;
        if (colour) expect(candidate.prompt).toContain(colour);
      }
    }
  });
});
