import { describe, expect, it, vi } from "vitest";

import { interpretBrief, interpreterParseStats } from "./interpreter";
import type { TextEngine } from "../providers/types";
// The module logger is a pino child of this one, so the spy catches it.
import { rootLogger } from "../logging/logger";

/**
 * A reply cut off at the ceiling is TRANSPORT, not a verdict.
 *
 * The gravest class in this subsystem wearing a transport costume. A truncated
 * reply is a JSON fragment; a fragment fails the whole parse; the compiler then
 * falls back and casts the sheet as though the brief had said nothing — losing
 * the sex, the age, the heritage the user actually typed. Silently, and
 * indistinguishably from a genuine "the model returned nonsense".
 *
 * It has now happened at three ceilings — 500, 1200, 1800 — each time found by
 * somebody tripping over it. Raising the ceiling again would not close the
 * class; every new field walks the reply back toward whatever the ceiling is.
 * What closes it is knowing whether we hit it.
 */

function engine(replies: { text: string; truncated?: boolean }[]): {
  engine: TextEngine;
  calls: () => number;
} {
  let call = 0;
  const impl = {
    id: "truncating",
    complete: vi.fn(async () => {
      const reply = replies[Math.min(call, replies.length - 1)];
      call += 1;
      return {
        text: reply.text,
        truncated: reply.truncated,
        latencyMs: 1,
        provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
      };
    }),
  } as unknown as TextEngine;
  return { engine: impl, calls: () => call };
}

const GOOD = JSON.stringify({ cohort: "photoreal_human", role: "runway model", sex: "female", ageBand: "20s" });
/** What a cut-off reply actually looks like: valid JSON up to the knife. */
const CUT_OFF = '{"cohort":"photoreal_human","role":"runway model","sex":"fem';

describe("a truncated reply is retried, not swallowed", () => {
  it("retries and keeps the locks the brief stated", async () => {
    const { engine: e, calls } = engine([
      { text: CUT_OFF, truncated: true },
      { text: GOOD },
    ]);
    const outcome = await interpretBrief({ briefText: "a runway model in her 20s", engine: e });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(calls()).toBe(2);
    // The whole point: sex and age survive instead of falling back to nothing.
    expect(outcome.intent.sex).toBe("female");
    expect(outcome.intent.ageBand).toBe("20s");
  });

  it("falls back honestly when the retry is also cut off", async () => {
    const { engine: e } = engine([
      { text: CUT_OFF, truncated: true },
      { text: CUT_OFF, truncated: true },
    ]);
    const outcome = await interpretBrief({ briefText: "a runway model in her 20s", engine: e });
    // Still degrades rather than throwing — a paid roll is never failed here.
    expect(outcome.ok).toBe(false);
  });

  it("does not retry a malformed reply that was NOT cut off", async () => {
    /*
      The distinction that makes this worth having. Nonsense from the model is
      the model failing and retrying it is superstition; a fragment is the
      transport failing and retrying it is correct.
    */
    const { engine: e, calls } = engine([{ text: "not json at all", truncated: false }]);
    const outcome = await interpretBrief({ briefText: "a runway model", engine: e });
    expect(outcome.ok).toBe(false);
    expect(calls()).toBe(1);
  });
});

describe("parse failures are observable", () => {
  it("counts attempts and failures rather than losing them", async () => {
    const before = interpreterParseStats();
    const { engine: e } = engine([{ text: "not json at all" }]);
    await interpretBrief({ briefText: "a runway model", engine: e });
    const after = interpreterParseStats();
    expect(after.attempts).toBeGreaterThan(before.attempts);
    expect(after.failures).toBeGreaterThan(before.failures);
  });

  it("raises a real alarm once the rate crosses, rather than only counting", async () => {
    /*
      Invariant 7: a control that is not invoked does not exist. The counter is
      worthless if nothing ever shouts — the whole point is that the NEXT time
      the ceiling is walked into, something says so before a founder does.
    */
    const errors: string[] = [];
    const spy = vi
      .spyOn(rootLogger, "error")
      .mockImplementation(((_obj: unknown, msg?: string) => {
        errors.push(msg ?? "");
      }) as never);
    try {
      const { engine: e } = engine([{ text: "not json at all" }]);
      // Past the window's minimum sample count, at a 100% failure rate.
      for (let i = 0; i < 25; i += 1) {
        await interpretBrief({ briefText: "a runway model", engine: e });
      }
    } finally {
      spy.mockRestore();
    }
    expect(errors.some((m) => m.includes("PARSE FAILURES ABOVE THRESHOLD"))).toBe(true);
  });

  it("counts truncations separately, because they name their own fix", async () => {
    const before = interpreterParseStats();
    const { engine: e } = engine([
      { text: CUT_OFF, truncated: true },
      { text: GOOD },
    ]);
    await interpretBrief({ briefText: "a runway model", engine: e });
    expect(interpreterParseStats().truncations).toBeGreaterThan(before.truncations);
  });
});
