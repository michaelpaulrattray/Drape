import { describe, expect, it } from "vitest";

import { castingBriefCompiler, deterministicBriefCompiler } from "./briefCompiler";
import { openHairAxes, briefStatesCoverage } from "./cohortPhotorealHuman";
import { parseCastingIntent } from "./castingIntent";
import { SHADE_LADDER } from "./hairStyles";
import { colourBucket } from "./heritageNeighbourhoods";
import type { TextEngine } from "../providers/types";

/**
 * Partial deference (founder ruling, 2026-08-01).
 *
 * The doctrine is unchanged at its root — null means the brief did not say —
 * but the unit of "said" is the FACT, not the axis. "Silver at the temples"
 * states a colour fact; cut, length and texture stay open and get authored.
 *
 * What made this necessary was measured, not argued: a paid sheet on that exact
 * brief came back as eight men with the same haircut, while the persisted
 * identities claimed mid-length, cropped, short and long. The whole hair axis
 * had been silenced by one word.
 */

/** Drives the interpreter's exact output, including output built to misbehave. */
function engineReturning(payload: Record<string, unknown>): TextEngine {
  return {
    id: "test",
    complete: async () => ({
      text: JSON.stringify({ cohort: "photoreal_human", role: "skincare founder", ...payload }),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/**
 * The authored hair line, or null.
 *
 * Never a bare " HAIR: " search — the cohort constant carries "FACIAL HAIR:",
 * which contains that substring, and an assertion matching the wrong line is an
 * assertion that proves nothing. This has caught me three times.
 */
function authoredHairLine(prompt: string): string | null {
  const cleaned = prompt.split("FACIAL HAIR:").join("FH:");
  const at = cleaned.indexOf(" HAIR: ");
  if (at < 0) return null;
  return cleaned.slice(at, cleaned.indexOf(".", at) + 1);
}

const FOUNDER_BRIEF = "A skincare founder in his 40s, silver at the temples";

async function sheetFor(brief: string, payload: Record<string, unknown>, rollSeed: string) {
  return castingBriefCompiler({
    briefText: brief,
    candidateCount: 8,
    rollSeed,
    engine: engineReturning(payload),
  });
}

describe("the founder's acceptance test", () => {
  it("gives eight silver-templed men eight different haircuts", async () => {
    /*
      The bar, stated as the floor rather than as a vibe. Five distinct named
      cuts is `DISTINCT_FLOOR`; the sheet routinely does better, and asserting
      the floor is what keeps this honest if the vocabulary narrows.
    */
    for (let roll = 0; roll < 60; roll += 1) {
      const compiled = await sheetFor(
        FOUNDER_BRIEF,
        { greyOverlay: true, hairSpoken: [] },
        `silver-${roll}`,
      );
      const cuts = new Set(
        compiled.candidates.map((candidate) => candidate.resolvedIdentity.realized.hairStyle?.name),
      );
      expect(cuts.size, `roll ${roll}`).toBeGreaterThanOrEqual(5);
      // And the authored cut actually reaches the prompt, which is the half
      // that was missing: the record used to vary while the image did not.
      for (const candidate of compiled.candidates) {
        expect(candidate.prompt).toContain(candidate.resolvedIdentity.realized.hairStyle!.name);
      }
    }
  });

  it("keeps the authored base colour compatible with silver temples", async () => {
    /*
      Compatibility is the new contradiction test. Grey at the temples of a
      blonde head is invisible, and a prompt that says both asks for something
      impossible — so the base is restricted to shades silver reads against,
      and code decides that, never the interpreter.
    */
    const seen = new Set<string>();
    for (let roll = 0; roll < 60; roll += 1) {
      const compiled = await sheetFor(FOUNDER_BRIEF, { greyOverlay: true, hairSpoken: [] }, `compat-${roll}`);
      for (const candidate of compiled.candidates) {
        const colour = candidate.resolvedIdentity.hair?.colour;
        if (colour) seen.add(colour);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
    for (const colour of seen) {
      expect(colourBucket(colour as never), colour).toBe("dark");
    }
  });

  it("never overwrites the stated silver with an age-driven grey", async () => {
    // The user's own words own the greying. Replacing the base with "grey"
    // would restate their fact in a coarser form and lose the temples.
    for (let roll = 0; roll < 40; roll += 1) {
      const compiled = await sheetFor(FOUNDER_BRIEF, { greyOverlay: true, hairSpoken: [] }, `nogrey-${roll}`);
      for (const candidate of compiled.candidates) {
        expect(["grey", "white"]).not.toContain(candidate.resolvedIdentity.hair?.colour);
      }
    }
  });
});

describe("the sacred regression: coverage stays all-or-nothing", () => {
  it.each(["a man with a shaved head", "a bald man in his 50s", "a buzzed marine", "a balding accountant"])(
    "authors no hair at all for %j",
    async (brief) => {
      // However the interpreter decomposed it — even claiming nothing was
      // spoken — a coverage word suppresses the axis whole. There is no cut
      // on a bald man, and authoring one is the founding bug of the doctrine.
      const compiled = await sheetFor(brief, { greyOverlay: false, hairSpoken: [] }, `cover-${brief}`);
      for (const candidate of compiled.candidates) {
        expect(authoredHairLine(candidate.prompt)).toBeNull();
        expect(candidate.resolvedIdentity.realized.hairStyle).toBeNull();
      }
    },
  );

  it("ignores an interpreter that says the cut is open on a shaved brief", async () => {
    const compiled = await sheetFor(
      "a man with a shaved head",
      { greyOverlay: false, hairSpoken: ["colour"] },
      "adversarial-shaved",
    );
    for (const candidate of compiled.candidates) {
      expect(authoredHairLine(candidate.prompt)).toBeNull();
    }
  });

  it("recognises the coverage words a tokenizer would otherwise miss", () => {
    expect(briefStatesCoverage("a buzzed marine")).toBe(true);
    expect(briefStatesCoverage("a balding accountant")).toBe(true);
    expect(briefStatesCoverage("a man with a receding hairline")).toBe(true);
    expect(briefStatesCoverage("a woman with long red hair")).toBe(false);
  });
});

describe("the keyword gate is one-way", () => {
  /*
    Keywords may force MORE deference, never less. The interpreter refines
    within a brief that mentions hair; it can neither unlock a brief that does
    not mention hair nor claim hair was spoken when no hair word exists.
  */
  it("falls back to full deference when hair is mentioned but nothing decomposed", () => {
    const open = openHairAxes({ spoken: [], greyOverlay: false, stated: "a woman with lovely hair" });
    expect(open).toEqual({ cutLength: false, texture: false, colour: false });
  });

  it("authors everything when the brief never mentions hair", () => {
    const open = openHairAxes({ spoken: [], greyOverlay: false, stated: "an oncology nurse" });
    expect(open).toEqual({ cutLength: true, texture: true, colour: true });
  });

  it("ignores a claim that hair was spoken when no hair word exists", () => {
    const open = openHairAxes({ spoken: ["colour"], greyOverlay: false, stated: "an oncology nurse" });
    expect(open).toEqual({ cutLength: true, texture: true, colour: true });
  });

  it("opens only what the brief left alone", () => {
    expect(openHairAxes({ spoken: ["colour"], greyOverlay: false, stated: "a blonde woman" })).toEqual({
      cutLength: true,
      texture: true,
      colour: false,
    });
    expect(openHairAxes({ spoken: ["cutLength"], greyOverlay: false, stated: "a woman with a bob" })).toEqual({
      cutLength: false,
      texture: true,
      colour: true,
    });
  });
});

describe("authored lines complement, never restate", () => {
  it("says no colour word when the brief named the colour", async () => {
    const compiled = await sheetFor(
      "a blonde woman in her 30s",
      { greyOverlay: false, hairSpoken: ["colour"] },
      "blonde",
    );
    for (const candidate of compiled.candidates) {
      const line = candidate.prompt.match(/ HAIR: [^.]*\./)?.[0] ?? "";
      expect(line).not.toBe("");
      for (const shade of SHADE_LADDER) {
        expect(line, `${shade} in "${line}"`).not.toContain(shade);
      }
    }
  });

  it("names no cut and drops the closer when the brief named the cut", async () => {
    const compiled = await sheetFor(
      "a woman with a sharp bob",
      { greyOverlay: false, hairSpoken: ["cutLength"] },
      "bob",
    );
    for (const candidate of compiled.candidates) {
      expect(candidate.prompt).not.toContain("Cut and worn as that style is genuinely worn");
      // The dangling closer is the failure mode: "that style" pointing at a
      // style the sentence no longer names.
      expect(candidate.prompt).not.toContain("that style");
    }
  });

  it("picks no texture-bearing cut when the brief named the texture", async () => {
    // Muting the grain word is not enough — "curly crop" restates it in the
    // cut's own name.
    for (let roll = 0; roll < 40; roll += 1) {
      const compiled = await sheetFor(
        "a woman with straight hair",
        { greyOverlay: false, hairSpoken: ["texture"] },
        `straight-${roll}`,
      );
      for (const candidate of compiled.candidates) {
        expect(candidate.resolvedIdentity.realized.hairStyle?.texture ?? null).toBeNull();
      }
    }
  });
});

describe("the record matches the prompt that was sent", () => {
  it("nulls the sub-axes deference suppressed", async () => {
    /*
      Before this, a fully deferred brief still persisted a fabricated cut and
      texture no image ever rendered — which is exactly how the founder's
      sameness report was first misdiagnosed as a resolver problem when the
      resolver had been overruled.
    */
    const compiled = await sheetFor("a man with a shaved head", { hairSpoken: [] }, "record");
    for (const candidate of compiled.candidates) {
      expect(candidate.resolvedIdentity.realized.hairStyle).toBeNull();
      expect(candidate.resolvedIdentity.realized.hairTexture).toBeNull();
      expect(candidate.resolvedIdentity.hair).toBeNull();
    }
  });

  it("keeps the record whole when nothing was suppressed", async () => {
    const compiled = await sheetFor("an oncology nurse", { hairSpoken: [] }, "whole");
    for (const candidate of compiled.candidates) {
      expect(candidate.resolvedIdentity.realized.hairStyle).not.toBeNull();
      expect(candidate.resolvedIdentity.hair).not.toBeNull();
    }
  });
});

describe("the wire contract survives a hostile interpreter", () => {
  it("drops junk from hairSpoken rather than failing a paid roll", () => {
    const parsed = parseCastingIntent(
      JSON.stringify({
        cohort: "photoreal_human",
        hairSpoken: ["colour", "SHAVED", 42, null, { a: 1 }, "cutLength", "colour"],
        greyOverlay: "yes please",
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.hairSpoken.sort()).toEqual(["colour", "cutLength"]);
    // Anything but a literal true is false — a string is not a claim.
    expect(parsed.intent.greyOverlay).toBe(false);
  });

  it("treats a missing field as nothing decomposed", () => {
    const parsed = parseCastingIntent(JSON.stringify({ cohort: "photoreal_human" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.hairSpoken).toEqual([]);
    expect(parsed.intent.greyOverlay).toBe(false);
  });
});

describe("the deterministic compiler, which has no interpreter", () => {
  it("defers fully on any hair mention", async () => {
    const compiled = await deterministicBriefCompiler({
      briefText: FOUNDER_BRIEF,
      candidateCount: 8,
      rollSeed: "fallback",
    });
    for (const candidate of compiled.candidates) {
      expect(authoredHairLine(candidate.prompt)).toBeNull();
    }
  });

  it("authors freely when the brief says nothing about hair", async () => {
    const compiled = await deterministicBriefCompiler({
      briefText: "an oncology nurse at the end of a shift",
      candidateCount: 8,
      rollSeed: "fallback-open",
    });
    const cuts = new Set(compiled.candidates.map((c) => c.resolvedIdentity.realized.hairStyle?.name));
    expect(cuts.size).toBeGreaterThanOrEqual(5);
  });
});
