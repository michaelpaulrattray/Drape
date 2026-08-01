import { describe, expect, it } from "vitest";

import { castingBriefCompiler } from "./briefCompiler";
import { realizeAxes } from "./realizedAxes";
import type { TextEngine } from "../providers/types";

/**
 * THE UNOWNED-AXIS COLLAPSE, instances four and five.
 *
 * The law, now well enough evidenced to state flatly: **an axis nobody owns is
 * not free — it is decided by whichever prior is loudest, identically on every
 * tile.** Naming it is what makes it vary.
 *
 *   - **Worn state** was owned by nobody in prescribe mode, so open sheets came
 *     back all-down; and in bias mode the prose said "how it is worn off the
 *     face, as this casting wears it", handing it to the CATEGORY prior — so a
 *     Versace follow came back with eight identical pulled-back heads the
 *     parent did not have. Same axis, two priors, both unanimous.
 *   - **Texture** was resolved and PERSISTED at bias tier and never rendered.
 *     The editorial prior leans wavy and curly, so the founder had never seen a
 *     straight-haired model on a category sheet — while straight carries the
 *     largest weight in most heritage palettes. That one was also a record that
 *     lied: a row saying "straight" beside a prompt that never said it.
 *
 * Both are silhouette-level, which is why they are legal at bias tier where a
 * named cut is not: how hair grows and whether it is up are not styling
 * instructions competing with the casting the user asked for.
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

/** A brief with creative context — the tier where both defects lived. */
async function biasSheet(rollSeed: string) {
  const compiled = await castingBriefCompiler({
    briefText: "a female high fashion editorial casting, 23",
    candidateCount: 8,
    rollSeed,
    engine: engine({
      role: "high fashion editorial model",
      sex: "female",
      ageBand: "20s",
      look: "severe minimal",
      composedDirection: { thesis: "Severe, architectural faces.", avoid: "Soft commercial polish." },
    }),
  } as never);
  return (compiled as { candidates: Array<{ prompt: string }> }).candidates;
}

describe("worn state varies instead of collapsing", () => {
  it("does not send eight identical worn states on a bias sheet", async () => {
    /*
      The Versace sheet, reproduced as a test. Count floor, not absence: a
      suite that only checked "no 'as this casting wears it'" would pass
      happily when the whole axis stopped emitting.
    */
    let sheetsWithVariety = 0;
    for (let i = 0; i < 6; i += 1) {
      const prompts = await biasSheet(`worn-${i}`);
      const states = new Set(
        prompts.map((c) => (c.prompt.match(/Worn ([a-z- ]+)\./)?.[1] ?? "loose").trim()),
      );
      if (states.size > 1) sheetsWithVariety += 1;
    }
    expect(sheetsWithVariety).toBe(6);
  });

  it("puts hair UP on open sheets, which never happened before", async () => {
    /*
      The other end of the same defect. Nothing authored the axis in prescribe
      mode either, so the image prior answered it — and its favourite answer is
      "down", eight times, on every sheet ever cast.
    */
    let up = 0;
    let total = 0;
    for (let s = 0; s < 40; s += 1) {
      for (let p = 0; p < 8; p += 1) {
        const axes = realizeAxes({
          heritage: [{ heritage: "British Isles", pct: 100 }] as never,
          ageBand: "20s",
          sex: "female",
          position: p,
          rollSeed: `open-${s}`,
        });
        total += 1;
        if (axes.wornState && axes.wornState !== "loose") up += 1;
      }
    }
    const rate = up / total;
    // Ordinary, not rare — and not the majority either. A street has both.
    expect(rate).toBeGreaterThan(0.25);
    expect(rate).toBeLessThan(0.7);
  });

  it("never says a worn state a silhouette cannot take", () => {
    for (let s = 0; s < 60; s += 1) {
      for (let p = 0; p < 8; p += 1) {
        const axes = realizeAxes({
          heritage: [{ heritage: "British Isles", pct: 100 }] as never,
          ageBand: "30s",
          sex: "male",
          position: p,
          rollSeed: `legal-${s}`,
        });
        const family = axes.hairStyle?.family;
        if (family === "shaved" || family === "cropped") {
          expect(axes.wornState).toBeNull();
        }
      }
    }
  });

  it("never contradicts a cut whose own name says how it is worn", async () => {
    // "a bun, worn loose" must be unsayable, not merely unlikely.
    for (let s = 0; s < 40; s += 1) {
      for (let p = 0; p < 8; p += 1) {
        const axes = realizeAxes({
          heritage: [{ heritage: "British Isles", pct: 100 }] as never,
          ageBand: "20s",
          sex: "female",
          position: p,
          rollSeed: `contra-${s}`,
        });
        if (axes.hairStyle?.worn) expect(axes.wornState).toBe(axes.hairStyle.worn);
      }
    }
  });
});

describe("texture reaches the prompt at bias tier", () => {
  it("says the texture it recorded, rather than persisting a value it never sent", async () => {
    const prompts = await biasSheet("texture-1");
    for (const candidate of prompts) {
      expect(candidate.prompt).toMatch(/Naturally (straight|wavy|curly|coiled)\./);
    }
  });

  it("sends straight hair, which the editorial prior never did on its own", async () => {
    /*
      The founder's actual observation: never a straight-haired model on a
      category sheet, though straight carries the largest weight in most
      heritage palettes. If this goes to zero the axis has stopped rendering.
    */
    let straight = 0;
    let total = 0;
    for (let i = 0; i < 6; i += 1) {
      for (const candidate of await biasSheet(`straight-${i}`)) {
        total += 1;
        if (/Naturally straight\./.test(candidate.prompt)) straight += 1;
      }
    }
    expect(straight / total).toBeGreaterThan(0.2);
  });

  it("still says nothing about hair when the brief stated its own", async () => {
    // Deference is unchanged by any of this — the user's words silence it all.
    const compiled = await castingBriefCompiler({
      briefText: "a female editorial casting, 23, shaved head",
      candidateCount: 4,
      rollSeed: "defer-bias",
      engine: engine({
        role: "editorial model",
        sex: "female",
        ageBand: "20s",
        composedDirection: { thesis: "Severe faces.", avoid: "Soft polish." },
      }),
    } as never);
    for (const candidate of (compiled as { candidates: Array<{ prompt: string }> }).candidates) {
      expect(candidate.prompt).not.toMatch(/Naturally (straight|wavy|curly|coiled)/);
      expect(candidate.prompt).not.toMatch(/Worn (up|tied back|half-up|in a ponytail)/);
    }
  });
});
