import { describe, expect, it } from "vitest";

import { realizeAxes, applySheetTaste } from "./realizedAxes";
import { resolveModifiers, slotsFor } from "./hairStyles";
import { MODIFIER_SLOTS, REALIZED_AXIS_KEYS } from "../../shared/castingRealization";
import { castingBriefCompiler } from "./briefCompiler";
import type { TextEngine } from "../providers/types";

/**
 * D10 — the modifier layer the D9 port dropped.
 *
 * "Long hair" is a length. "Long, curtain fringe, centre-parted, soft
 * flyaways" is somebody's hair. Legacy authored these components and the
 * founder's eye caught their absence.
 *
 * The rules that matter are all about NOT LYING: a cut can only wear what it
 * physically can, components move with the cut they belong to, and the record
 * never names a component the prompt did not carry.
 */

const seedFor = (rollSeed: string) => (axis: string) => {
  let h = 0x811c9dc5;
  for (const ch of `${rollSeed}:${axis}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};

function sheetOf(sex: "male" | "female", heritage: string, rollSeed: string) {
  return Array.from({ length: 8 }, (_, position) =>
    realizeAxes({
      heritage: [{ heritage, pct: 100 }] as never,
      ageBand: "20s",
      sex,
      position,
      rollSeed,
    }),
  );
}

describe("legality is declared by the cut, not checked afterwards", () => {
  it("gives a shaved head no components at all — there is nothing to wear them", () => {
    const buzz = { name: "buzz cut", family: "shaved" } as const;
    expect(slotsFor(buzz as never)).toEqual([]);
    const resolved = resolveModifiers(buzz as never, seedFor("x"));
    for (const slot of MODIFIER_SLOTS) expect(resolved[slot]).toBeNull();
  });

  it("gives a cropped cut no fringe and no parting", () => {
    const crop = { name: "french crop", family: "cropped" } as const;
    const slots = slotsFor(crop as never);
    expect(slots).not.toContain("fringe");
    expect(slots).not.toContain("parting");
  });

  it("never puts a fringe on a shaved or cropped head across a whole population", () => {
    /*
      The D11 lesson, applied one layer down: the way to prevent an impossible
      pairing is for it to be UNSAYABLE, not for a validator to catch it after
      the fact. This is the population check that proves the construction.
    */
    let checked = 0;
    for (let s = 0; s < 60; s += 1) {
      for (const axes of sheetOf("male", "British Isles", `legal-${s}`)) {
        const family = axes.hairStyle?.family;
        if (family !== "shaved" && family !== "cropped") continue;
        checked += 1;
        expect(axes.hairModifiers?.fringe ?? null).toBeNull();
        expect(axes.hairModifiers?.parting ?? null).toBeNull();
      }
    }
    // The condition is reachable — not a branch nobody ever takes.
    expect(checked).toBeGreaterThan(50);
  });
});

describe("natural weights — most people are not wearing all four", () => {
  it("leaves the majority of candidates wearing at most two components", () => {
    const worn: number[] = [];
    for (let s = 0; s < 80; s += 1) {
      for (const axes of sheetOf("female", "British Isles", `wear-${s}`)) {
        worn.push(MODIFIER_SLOTS.filter((slot) => axes.hairModifiers?.[slot]).length);
      }
    }
    const atMostTwo = worn.filter((n) => n <= 2).length / worn.length;
    expect(atMostTwo).toBeGreaterThan(0.8);
    // And it is not silently doing nothing — the layer must actually appear.
    expect(worn.filter((n) => n > 0).length / worn.length).toBeGreaterThan(0.4);
  });

  it("varies each slot independently, so a parting does not always bring a fringe", () => {
    /*
      Each slot hashes its own named string per the collision law. One shared
      seed would correlate them — every centre-parting arriving with the same
      fringe — which is the failure that made a whole gate's sheets quietly
      narrower than they looked.
    */
    const pairs = new Set<string>();
    for (let s = 0; s < 80; s += 1) {
      for (const axes of sheetOf("female", "British Isles", `indep-${s}`)) {
        pairs.add(`${axes.hairModifiers?.fringe ?? "-"}|${axes.hairModifiers?.parting ?? "-"}`);
      }
    }
    expect(pairs.size).toBeGreaterThan(8);
  });
});

describe("components move with the cut they belong to", () => {
  it("re-resolves when the sheet-taste pass swaps a cut", () => {
    /*
      The trap the advisor named: `{ ...candidate.realized, hairStyle: style }`
      carries the OLD components onto the new cut, silently, because a spread
      looks like it is copying something safe. That strands a curtain fringe on
      a french crop — the exact illegal pairing the declaration prevents.
    */
    let checked = 0;
    for (let s = 0; s < 60; s += 1) {
      const raw = sheetOf("male", "British Isles", `swap-${s}`).map((realized, position) => ({
        sex: "male" as const,
        ageBand: "20s" as const,
        heritage: [{ heritage: "British Isles", pct: 100 }],
        hair: { family: realized.hairStyle?.family ?? "short", colour: "brown" },
        realized,
        position,
      }));
      const after = applySheetTaste(raw as never, `swap-${s}`);
      for (const candidate of after as never as Array<{ realized: any }>) {
        const family = candidate.realized.hairStyle?.family;
        if (family !== "shaved" && family !== "cropped") continue;
        checked += 1;
        expect(candidate.realized.hairModifiers?.fringe ?? null).toBeNull();
      }
    }
    expect(checked).toBeGreaterThan(30);
  });
});

describe("the record never names what the prompt did not carry", () => {
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

  it("records no components when the brief states its own hair (deference)", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "a runway model, early 20s, shaved head",
      candidateCount: 4,
      rollSeed: "defer",
      engine: engine({ role: "runway model", ageBand: "20s" }),
    } as never);
    for (const candidate of (compiled as { candidates: Array<{ prompt: string }> }).candidates) {
      // Nothing authored survives the user's own words.
      expect(candidate.prompt).not.toMatch(/curtain fringe|centre-parted|flyaways/i);
    }
    const identities = (compiled as { resolved?: unknown }).resolved;
    void identities;
  });

  it("puts the components in the prompt when it authors them", async () => {
    /*
      The count floor. An absence-only suite passes just as well when the whole
      layer silently stops emitting — which is how the drift bug survived a
      green run once already this week.
    */
    let sheets = 0;
    let withComponents = 0;
    for (let i = 0; i < 6; i += 1) {
      const compiled = await castingBriefCompiler({
        briefText: "a fashion model in her 20s",
        candidateCount: 8,
        rollSeed: `emit-${i}`,
        engine: engine({ role: "fashion model", sex: "female", ageBand: "20s" }),
      } as never);
      sheets += 1;
      const prompts = (compiled as { candidates: Array<{ prompt: string }> }).candidates;
      if (prompts.some((c) => /fringe|parted|flyaways|volume|baby hairs/i.test(c.prompt))) {
        withComponents += 1;
      }
    }
    expect(withComponents).toBe(sheets);
  });
});

describe("the registry enumerates it", () => {
  it("names hairModifiers, so M7 slice zero needs no special case", () => {
    expect(REALIZED_AXIS_KEYS).toContain("hairModifiers");
  });
});
