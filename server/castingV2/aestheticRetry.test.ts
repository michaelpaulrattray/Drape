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

  it("does not retry a brief that names nothing specific at all", async () => {
    /*
      No proper noun, no listed token, honest nulls. This is the case the
      repair must never touch, and it is what keeps a listless detector from
      becoming "retry everything".
    */
    for (const brief of [
      "someone quietly confident with kind eyes",
      "a tired oncology nurse at the end of a shift",
      "a wiry cyclist in her 20s",
    ]) {
      const { engine, calls } = engineSequence([NOTHING_LANDED]);
      const outcome = await interpretBrief({ briefText: brief, engine });
      expect(outcome.ok, brief).toBe(true);
      expect(calls(), brief).toBe(1);
    }
  });

  it("does not retry when the brief only names facts we already model", async () => {
    // "Mediterranean" is a heritage we capture, not a reference we missed.
    const { engine, calls } = engineSequence([NOTHING_LANDED]);
    const outcome = await interpretBrief({ briefText: "a Mediterranean man in his 70s", engine });
    expect(outcome.ok).toBe(true);
    expect(calls()).toBe(1);
  });
});

describe("the detector is listless, and general references are repaired too", () => {
  /*
    Founder amendment: the trigger generalises from the brand list to a
    proper-noun SHAPE — capitalized, not sentence-initial, absent from our
    vocabularies. That upgrades the Wes Anderson class from a named limit to
    the same promise tier as fashion, without a film or culture list existing
    anywhere.

    False positives are acceptable here by design: the only cost is one cheap
    re-interpretation. That looseness is safe in a DETECTOR and would be a
    defect in a guard — the asymmetry is the point.
  */
  it("repairs a general reference, the former named limit", async () => {
    const { engine, calls } = engineSequence([NOTHING_LANDED, LANDED]);
    const outcome = await interpretBrief({ briefText: "a Wes Anderson casting, mid 30s", engine });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(calls()).toBe(2);
    expect(outcome.intent.composedDirection).not.toBeNull();
  });

  it("still repairs a lowercase house, which a proper-noun test alone would miss", async () => {
    // "miu miu" is typed lowercase, so the shape test cannot see it — which is
    // why the listed tokens still contribute to the detector.
    const { engine, calls } = engineSequence([NOTHING_LANDED, LANDED]);
    const outcome = await interpretBrief({
      briefText: "female mid 20s fashion model casting for miu miu",
      engine,
    });
    expect(outcome.ok).toBe(true);
    expect(calls()).toBe(2);
  });

  it("ignores the sentence-initial capital every brief starts with", async () => {
    const { engine, calls } = engineSequence([NOTHING_LANDED]);
    const outcome = await interpretBrief({ briefText: "Someone with kind eyes", engine });
    expect(outcome.ok).toBe(true);
    expect(calls()).toBe(1);
  });
});
