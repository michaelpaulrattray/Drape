import { describe, expect, it, vi } from "vitest";

import { interpretBrief } from "./interpreter";
import type { TextEngine } from "../providers/types";

/**
 * The aesthetic-reference retry.
 *
 * Founder ruling: the residual miss rate is not acceptable on its own, so a
 * listed fashion token in the brief plus all three aesthetic channels null is
 * treated as a demonstrable miss and re-sampled once.
 *
 * Narrow, provable, and it can never fire on a true null — the role-repair
 * pattern. A brand token in the sentence is proof the user named a reference,
 * so "nothing landed" cannot be honest silence.
 */

function engineSequence(replies: Record<string, unknown>[]): { engine: TextEngine; calls: () => number } {
  let call = 0;
  const engine = {
    id: "sequence",
    complete: vi.fn(async () => {
      const reply = replies[Math.min(call, replies.length - 1)];
      call += 1;
      return {
        text: JSON.stringify({ cohort: "photoreal_human", ...reply }),
        latencyMs: 1,
        provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
      };
    }),
  } as unknown as TextEngine;
  return { engine, calls: () => call };
}

const NOTHING_LANDED = { role: "campaign model", archetype: null, look: null, composedDirection: null };
const LANDED = {
  role: "campaign model",
  archetype: null,
  look: null,
  composedDirection: { thesis: "Quirky, awkward, unconventional features worn with ease.", avoid: "Not glossy." },
};

describe("when a fashion reference lands nowhere", () => {
  it("re-samples once and takes the better answer", async () => {
    const { engine, calls } = engineSequence([NOTHING_LANDED, LANDED]);
    const outcome = await interpretBrief({ briefText: "a miu miu campaign model", engine });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(calls()).toBe(2);
    expect(outcome.intent.composedDirection).not.toBeNull();
  });

  it("re-samples ONCE, never in a loop", async () => {
    // A bad day at the provider must not become unbounded spend.
    const { engine, calls } = engineSequence([NOTHING_LANDED, NOTHING_LANDED, LANDED]);
    const outcome = await interpretBrief({ briefText: "a miu miu campaign model", engine });
    expect(outcome.ok).toBe(true);
    expect(calls()).toBe(2);
  });

  it("keeps the first answer when the retry is no better", async () => {
    const { engine } = engineSequence([NOTHING_LANDED, NOTHING_LANDED]);
    const outcome = await interpretBrief({ briefText: "a miu miu campaign model", engine });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // Degrades to today's behaviour rather than failing the roll.
    expect(outcome.intent.role).toBe("campaign model");
  });
});

describe("it never fires on a true null", () => {
  it("does not retry a brief with no fashion reference in it", async () => {
    const { engine, calls } = engineSequence([NOTHING_LANDED]);
    const outcome = await interpretBrief({ briefText: "an oncology nurse in her 40s", engine });
    expect(outcome.ok).toBe(true);
    expect(calls()).toBe(1);
  });

  it("does not retry when the aesthetic already landed", async () => {
    for (const landedSomewhere of [
      { ...NOTHING_LANDED, look: "severe minimal" },
      { ...NOTHING_LANDED, archetype: "raw editorial" },
      LANDED,
    ]) {
      const { engine, calls } = engineSequence([landedSomewhere]);
      const outcome = await interpretBrief({ briefText: "a Margiela runway face", engine });
      expect(outcome.ok).toBe(true);
      expect(calls()).toBe(1);
    }
  });

  it("does not retry a non-fashion reference — the named limit", async () => {
    /*
      "A Wes Anderson casting" gets no retry, because the token list is the only
      detector and it is deliberately fashion-only: extending it toward every
      trademark in the world would start eating ordinary words. General
      references capture stochastically, and Path B is where that closes.
    */
    const { engine, calls } = engineSequence([NOTHING_LANDED]);
    const outcome = await interpretBrief({ briefText: "a Wes Anderson casting, mid 30s", engine });
    expect(outcome.ok).toBe(true);
    expect(calls()).toBe(1);
  });
});
