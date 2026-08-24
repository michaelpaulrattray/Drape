/**
 * ASK TWICE BEFORE YOU WALL — the cohort wall's double check
 * (`docs/specs/CASTING_V2_COHORT_WALL_DOUBLE_CHECK_DESIGN.md`, ordered
 * fable-1588 from a live founder walling, built fable-1602 ruling 2 after its
 * own court closed).
 *
 * # WHY THIS SUITE EXISTS AND WHAT IT CANNOT DO
 *
 * The COURT measured the real classifier: 3 of 6 first reads walled his brief,
 * 3 of 3 refusals passed on an immediate second read, and a named character
 * refused both reads twice. **That is a stochastic rate and it cannot be
 * asserted in a unit suite** — an arm that tried would be a flake with a
 * docblock.
 *
 * What CAN be held here is the control flow, driven at the real
 * `interpretBrief` with a stub transport, one behaviour per arm:
 *
 *   1. a first refusal followed by a clean read PROCEEDS, with the second
 *      read's intent — the rescue;
 *   2. two refusals WALL. Fail-closed, unchanged, and this is the arm that
 *      protects the wall rather than the customer;
 *   3. exactly ONE extra read, never a loop;
 *   4. the second ask is the SAME ask — same system prompt, same brief. A
 *      softened re-ask would be arguing the model out of a correct refusal;
 *   5. a brief that passes first time buys NO second call at all — the retry
 *      costs nothing on the road every ordinary brief travels.
 */
import { describe, expect, it, vi } from "vitest";

import type { TextEngine } from "../providers/types";

import { interpretBrief } from "./interpreter";

const REFUSAL = JSON.stringify({ cohort: "other" });
const CAST = JSON.stringify({
  cohort: "photoreal_human",
  role: "a cybernetic augmented man",
  characterNotes: "Bald, pale porcelain skin",
  heritage: [],
  statedAccessories: [],
});

/**
 * A transport that answers a fixed sequence and remembers every request.
 *
 * The LAST reply repeats, deliberately: an arm about "exactly one extra read"
 * must be able to keep refusing forever, so that a loop would be visible as a
 * call count rather than as a hang.
 */
function engineSaying(replies: string[]): TextEngine {
  let call = 0;
  return {
    id: "sequence",
    complete: vi.fn(async () => {
      const text = replies[Math.min(call, replies.length - 1)]!;
      call += 1;
      return {
        text,
        latencyMs: 1,
        provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
      };
    }),
  } as unknown as TextEngine;
}

const callsOf = (engine: TextEngine) =>
  (engine.complete as unknown as { mock: { calls: unknown[][] } }).mock.calls;

describe("a first refusal that a second read overturns", () => {
  it("PROCEEDS, with the second read's intent", async () => {
    const engine = engineSaying([REFUSAL, CAST]);
    const outcome = await interpretBrief({ briefText: "a cybernetic augmented man", engine });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.intent.role).toBe("a cybernetic augmented man");
    expect(callsOf(engine)).toHaveLength(2);
  });
});

describe("two refusals", () => {
  it("WALL — fail-closed, exactly as before", async () => {
    const engine = engineSaying([REFUSAL, REFUSAL]);
    const outcome = await interpretBrief({ briefText: "Master Chief from Halo", engine });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("unsupported_cohort");
  });

  /*
    ⚠ THE ARM THAT PROTECTS THE WALL RATHER THAN THE CUSTOMER, and it is the
    half a build like this is most likely to skip. The court drove the real
    classifier on a named character and got 2 of 2 refusals on BOTH reads; this
    holds the control flow to the same answer, so a future edit that turns the
    retry into a second chance for everybody reddens here.
  */
  it("and never buys a THIRD read, however many times it is refused", async () => {
    const engine = engineSaying([REFUSAL]);
    const outcome = await interpretBrief({ briefText: "Spider-Man look-alike", engine });
    expect(outcome.ok).toBe(false);
    /* One retry. Not two, not a loop — a stochastic failure repeated without
       bound is how a bad day at the provider becomes an unbounded spend. */
    expect(callsOf(engine)).toHaveLength(2);
  });
});

describe("the second ask is the SAME ask", () => {
  /*
    ⚠ The tempting version nudges the second read — *"are you sure?"* — and that
    is not a second opinion, it is arguing the model out of a refusal. Its value
    is precisely that it is an identical re-sample: the court measured the two
    reads landing differently on the same bytes, which is what makes the draw
    independent.
  */
  it("byte-identical system prompt and brief on both reads", async () => {
    const engine = engineSaying([REFUSAL, CAST]);
    await interpretBrief({ briefText: "a cybernetic augmented man", engine });
    const calls = callsOf(engine);
    expect(calls).toHaveLength(2);
    const first = calls[0]![0] as { system: string; user: string; temperature?: number };
    const second = calls[1]![0] as { system: string; user: string; temperature?: number };
    expect(second.system).toBe(first.system);
    expect(second.user).toBe(first.user);
    expect(second.temperature).toBe(first.temperature);
  });
});

describe("the road every ordinary brief travels", () => {
  it("a brief that casts first time buys NO second read", async () => {
    const engine = engineSaying([CAST]);
    const outcome = await interpretBrief({ briefText: "a dad in his 30s", engine });
    expect(outcome.ok).toBe(true);
    expect(callsOf(engine)).toHaveLength(1);
  });

  it("and an UNREADABLE reply is not a wall, so it does not buy one either", async () => {
    /*
      The retry is scoped to the JUDGEMENT and not to every parse failure.
      `unreadable` already has its own answer — the caller's fallback — and
      retrying it here would be a second policy for one condition.
    */
    const engine = engineSaying(["this is not json at all"]);
    const outcome = await interpretBrief({ briefText: "a dad in his 30s", engine });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("unavailable");
    expect(callsOf(engine)).toHaveLength(1);
  });
});
