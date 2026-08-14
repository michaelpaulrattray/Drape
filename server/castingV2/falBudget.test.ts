/**
 * THE BUDGET, AND THE TWO WAYS A SHARED CEILING GOES WRONG (fable-511).
 *
 * Four paths spend one twenty-request account allowance. The condition set for
 * this work was explicit: one gate OR a mechanized sum-invariant, with the
 * starvation question answered in the design and **one arm driven each way** —
 * a paid roll may not be starved by scans, and a scan burst may not be starved
 * forever by rolls.
 *
 * The shape chosen is the sum-invariant, and the reason is that it answers
 * starvation BY CONSTRUCTION: every path's slots are its own, so neither can
 * take the other's, and what remains to prove is that they fit. Both arms below
 * drive that property rather than assert it — each path's limiter is saturated
 * and the other is shown still able to run.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  FAL_ALLOWANCES,
  FalBudgetError,
  assertFalBudget,
  falAccountCeiling,
  falAllowanceOf,
} from "./falBudget";
import { falConcurrencyLimit, throughFalGate } from "./falConcurrency";
import { ProviderQueue } from "../providers/providerQueue";

const VARS = ["FAL_ACCOUNT_CEILING", ...FAL_ALLOWANCES.map((allowance) => allowance.env)];
afterEach(() => { for (const key of VARS) delete process.env[key]; });

describe("the arithmetic", () => {
  it("fits, on the defaults nobody has touched", () => {
    const budget = assertFalBudget();
    expect(budget.total).toBeLessThanOrEqual(budget.ceiling);
    expect(budget.ceiling).toBe(20);
    /* The line is the point: a budget check whose arithmetic nobody can see is
       a comment with an exception. */
    expect(budget.line).toContain("of 20");
    for (const allowance of FAL_ALLOWANCES) expect(budget.line).toContain(allowance.name);
  });

  it("REFUSES a configuration that would exceed the account's ceiling", () => {
    /* One bumped variable is all it takes, and until this check the failure was
       a customer's panel coming back empty with no error anywhere. */
    process.env.ROLL_IMAGE_CONCURRENCY = "16";
    expect(() => assertFalBudget()).toThrow(FalBudgetError);
    expect(() => assertFalBudget()).toThrow(/over the account's ceiling/);
  });

  it("REFUSES a path with no slots at all", () => {
    /* Starvation arriving by configuration instead of by scheduling — the
       exact failure the separate-allowances shape exists to prevent. */
    process.env.FAL_CONCURRENCY = "0";
    expect(() => assertFalBudget()).toThrow(/no slots at all/);
  });

  it("allows the sum to EQUAL the ceiling — the provider's limit is inclusive", () => {
    process.env.FAL_ACCOUNT_CEILING = "20";
    const budget = assertFalBudget();
    expect(budget.total).toBe(20);
    expect(() => assertFalBudget()).not.toThrow();
  });

  it("reads every allowance from the table, and refuses one that is not in it", () => {
    process.env.SIGN_VIEW_CONCURRENCY = "5";
    expect(falAllowanceOf("SIGN_VIEW_CONCURRENCY")).toBe(5);
    /* An unlisted caller is the silent overspend this table exists to stop. */
    expect(() => falAllowanceOf("SOME_OTHER_QUEUE")).toThrow(/not a declared fal allowance/);
  });

  it("keeps the ceiling readable and overridable, in case the account's changes", () => {
    process.env.FAL_ACCOUNT_CEILING = "40";
    expect(falAccountCeiling()).toBe(40);
  });
});

describe("neither path can starve the other", () => {
  it("a PAID roll is not starved by a burst of courtesy reads", async () => {
    /*
      The region gate is saturated and every slot is held. A roll's own queue is
      a different allowance, so its dispatch admits immediately — which is the
      whole reason the sum shape was chosen over one shared queue.
    */
    process.env.FAL_CONCURRENCY = "2";
    const release: Array<() => void> = [];
    const held = Array.from({ length: 4 }, () => throughFalGate(
      () => new Promise<string>((resolve) => release.push(() => resolve("read"))),
    ));
    /* Both slots taken and two more queued behind them. */
    await new Promise((resolve) => setImmediate(resolve));
    expect(release).toHaveLength(2);

    const rolls = new ProviderQueue({ name: "test-roll", concurrency: 2, maxQueueDepth: 8 });
    const ran = await rolls.run("a face", async () => "a face");
    expect(ran).toBe("a face");

    /* Drained rather than "released once": each release lets a queued call take
       the slot and register its own, so a single pass leaves half of them
       running and this test hanging. */
    for (let drain = 0; drain < 8 && release.length > 0; drain += 1) {
      release.shift()!();
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(await Promise.all(held)).toHaveLength(4);
  });

  it("a courtesy read is not starved forever by paid work", async () => {
    /* The mirror, and it is the arm that would fail under a single shared
       queue with paid priority: the roll queue is full and a scan still runs. */
    const rolls = new ProviderQueue({ name: "test-roll-2", concurrency: 1, maxQueueDepth: 8 });
    let releaseRoll: (() => void) | null = null;
    const rolling = rolls.run("a face", () => new Promise<string>((resolve) => {
      releaseRoll = () => resolve("a face");
    }));
    await new Promise((resolve) => setImmediate(resolve));

    process.env.FAL_CONCURRENCY = "2";
    expect(falConcurrencyLimit()).toBe(2);
    expect(await throughFalGate(async () => "a read")).toBe("a read");

    releaseRoll!();
    expect(await rolling).toBe("a face");
  });
});
