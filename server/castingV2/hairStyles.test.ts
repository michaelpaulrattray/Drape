import { describe, expect, it } from "vitest";

import { realizeAxes } from "./realizedAxes";
import { composeCandidatePrompt, resolveCandidateIdentity } from "./cohortPhotorealHuman";
import { ARCHETYPES, type CastingIntent, type HeritageComponent } from "./castingIntent";
import { FINISH_RENDER, statedFinish } from "./hairStyles";

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
  it("reaches at least five distinct styles across eight candidates", () => {
    // The founder's acceptance bar for item 6, asserted directly.
    for (const seed of SEEDS) {
      for (const sex of ["male", "female"] as const) {
        const names = new Set(sheet({ heritage: "British Isles", sex, seed }).map((a) => a.hairStyle.name));
        expect(names.size, `${sex}/${seed}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("never puts two statement cuts on one sheet", () => {
    /*
      The taste ruling, as a rule rather than a probability. The weights alone
      left about one sheet in ten with two, which is not "at most one" — the
      demotion in pickStyle is what makes this hold every time.
    */
    const sheets = Array.from({ length: 200 }, (_, i) =>
      sheet({ heritage: "Western European", sex: i % 2 ? "male" : "female", seed: `taste${i}` }),
    );
    const counts = sheets.map((eight) => eight.filter((a) => a.hairStyle.statement).length);
    expect(Math.max(...counts)).toBeLessThanOrEqual(1);
    // Rare-but-POSSIBLE. A statement cut that never occurs is not restraint.
    expect(counts.some((n) => n === 1)).toBe(true);
    // And still rare: most sheets carry none at all.
    expect(counts.filter((n) => n === 0).length / counts.length).toBeGreaterThan(0.4);
  });

  it("gets rarer with age — a wolf cut at seventy reads as costume", () => {
    const rate = (ageBand: "20s" | "70s+") => {
      const eight = Array.from({ length: 30 }, (_, i) => sheet({ heritage: "Nordic", ageBand, seed: `age${i}` }));
      const all = eight.flat();
      return all.filter((a) => a.hairStyle.statement).length / all.length;
    };
    expect(rate("70s+")).toBeLessThan(rate("20s"));
  });

  it("draws on coiled-hair traditions where heritage supports them", () => {
    const names = new Set(
      Array.from({ length: 10 }, (_, i) => sheet({ heritage: "West African", seed: `wa${i}` }))
        .flat()
        .map((a) => a.hairStyle.name),
    );
    for (const expected of ["braids", "locs", "afro", "twist-out"]) {
      expect(names.has(expected), expected).toBe(true);
    }
  });

  it("never offers those traditions to a heritage they do not belong to", () => {
    const names = new Set(
      Array.from({ length: 10 }, (_, i) => sheet({ heritage: "East Asian", seed: `ea${i}` }))
        .flat()
        .map((a) => a.hairStyle.name),
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
      if (axes.hairStyle.texture) expect(axes.hairTexture).toBe(axes.hairStyle.texture);
    }
  });

  it("varies independently of the other axes", () => {
    // The shifted-hash collision, re-asserted for the new axis.
    const eight = sheet({ heritage: "Mediterranean", sex: "male" });
    const pairs = new Set(eight.map((a) => `${a.hairStyle.name}|${a.eyeColour}`));
    expect(pairs.size).toBeGreaterThanOrEqual(new Set(eight.map((a) => a.hairStyle.name)).size);
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
