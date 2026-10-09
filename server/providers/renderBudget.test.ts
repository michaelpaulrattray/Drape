/**
 * THE SIGN'S PAID-RENDER CAP — the bound Cid's flat 650 rests on (#1968).
 *
 * Driven directly on `withRetry`, which is where the charging happens and the
 * only layer that sees each submission. The sibling money rule — a frame the
 * provider already finished is never re-asked — is `withRetryBilled.test.ts`;
 * the end-to-end arm that counts real submissions across all three loops of a
 * whole Sign is in `packageOrchestrator.test.ts`.
 *
 * ⚠ **THE PAIR THAT MAKES THIS AN INSTRUMENT RATHER THAN AN ASSERTION** is the
 * two error shapes driven through one unchanged loop: the deadline shape stops
 * at the budget, and the pre-submit shape runs its full retry allowance with
 * the budget untouched. A cap that fired on both would be a cap that had simply
 * broken the arrival retry, and the suite could not tell the difference.
 */
import { describe, expect, it } from "vitest";

import { withRetry } from "./providerQueue";
import { createRenderBudget, renderBudgetSpent, type RenderBudget } from "./renderBudget";
import {
  ProviderError,
  RETRYABLE_FAILURES,
  VIEW_ARRIVAL_TERMINAL,
  isRetryable,
  mayStillArrive,
  providerAlreadyBilled,
  providerMayHaveBilled,
} from "./types";

/**
 * The deadline exit's exact shape, read at `falTransport.ts`: it cancels, and
 * `completed` is true ONLY when fal answers 400 ALREADY_COMPLETED. The common
 * case is a cancel that succeeded or went unanswered — and that file's own note
 * says whether a cancel stops a job already IN_PROGRESS is unverified, so this
 * is the fault that may have been billed and cannot say so.
 */
const deadline = () =>
  new ProviderError("timeout", "fal.ai did not complete within the deadline", {
    providerRef: "req-deadline",
    completed: false,
  });

/** The pre-submit shape: the POST never landed, so no job and no bill. */
const unreachable = () => new ProviderError("transport", "fal.ai unreachable");

async function runWithBudget(
  error: () => unknown,
  budget: RenderBudget,
): Promise<{ attempts: number; thrown: unknown }> {
  let attempts = 0;
  let thrown: unknown;
  await withRetry(
    "test.sheet",
    async () => {
      attempts += 1;
      throw error();
    },
    { retries: 2, baseDelayMs: 0, budget },
  ).catch((caught: unknown) => {
    thrown = caught;
  });
  return { attempts, thrown };
}

describe("the render budget's arithmetic", () => {
  it("counts up to its limit and then has no room", () => {
    const budget = createRenderBudget(2);
    expect([budget.limit, budget.spent, budget.hasRoom()]).toEqual([2, 0, true]);
    budget.charge();
    expect([budget.spent, budget.hasRoom()]).toEqual([1, true]);
    budget.charge();
    expect([budget.spent, budget.hasRoom()]).toEqual([2, false]);
  });

  it("refuses a limit that is not a positive whole number", () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(() => createRenderBudget(bad)).toThrow(/positive integer/);
    }
  });
});

/**
 * ⚠ **THE DISCRIMINATOR, AND IT IS A DIFFERENT QUESTION FROM `completed`.**
 * `providerAlreadyBilled` answers *was this frame bought*; this answers *could
 * it have been*. The gap between them is the whole reason the cap was missing,
 * so both directions are driven and the deadline shape is checked against BOTH
 * predicates in one arm — that disagreement is the fact.
 */
describe("which attempts may have cost money", () => {
  it("THE GAP — the deadline shape is not already-billed, and may have billed", () => {
    const error = deadline();
    expect(providerAlreadyBilled(error)).toBe(false);
    expect(providerMayHaveBilled(error)).toBe(true);
  });

  it("a fault raised before the queue accepted the job is free", () => {
    expect(providerMayHaveBilled(unreachable())).toBe(false);
    /* The engines' own pre-dispatch refusals and the queue's, same shape. */
    expect(providerMayHaveBilled(new ProviderError("capability", "needs FAL_KEY"))).toBe(false);
    expect(providerMayHaveBilled(new ProviderError("capability", "cancelled before dispatch"))).toBe(false);
  });

  it("a finished frame, and anything that is not a ProviderError, is charged", () => {
    expect(providerMayHaveBilled(new ProviderError("transport", "download failed", {
      providerRef: "req-1",
      completed: true,
    }))).toBe(true);
    /* The sheet thunk carries the decode, the cut and the provenance check, and
       every fault in those is a frame that arrived and was paid for. */
    expect(providerMayHaveBilled(new Error("the cut found no seam"))).toBe(true);
  });
});

describe("withRetry charges the budget", () => {
  it("THE CAP — repeated deadlines stop at the budget, not at the retry allowance", async () => {
    const budget = createRenderBudget(2);
    const { attempts, thrown } = await runWithBudget(deadline, budget);
    /* `retries: 2` allows three attempts; the budget allows two. */
    expect(attempts).toBe(2);
    expect(budget.spent).toBe(2);
    expect(thrown).toBeInstanceOf(ProviderError);
    expect((thrown as ProviderError).message).toMatch(/render budget is spent/);
  });

  it("THE CONTROL — a pre-submit fault runs the full allowance and spends nothing", async () => {
    const budget = createRenderBudget(2);
    const { attempts, thrown } = await runWithBudget(unreachable, budget);
    /*
      ⚠ This is the arm that proves the cap discriminates rather than merely
      shortening the loop. Cid's own note asks for it: a transport failure that
      returned no frame is not billed, so the rescue it buys must survive.
    */
    expect(attempts).toBe(3);
    expect(budget.spent).toBe(0);
    expect((thrown as ProviderError).failureClass).toBe("transport");
  });

  it("a delivered frame is charged, and the next call has one render left", async () => {
    const budget = createRenderBudget(2);
    await withRetry("test.sheet", async () => "bytes", { budget });
    expect([budget.spent, budget.hasRoom()]).toEqual([1, true]);
    await withRetry("test.sheet", async () => "bytes", { budget });
    expect([budget.spent, budget.hasRoom()]).toEqual([2, false]);
  });

  it("a spent budget refuses BEFORE it submits", async () => {
    const budget = createRenderBudget(1);
    budget.charge();
    let attempts = 0;
    await expect(
      withRetry("test.sheet", async () => {
        attempts += 1;
        return "bytes";
      }, { budget }),
    ).rejects.toThrow(/render budget is spent/);
    /* Nothing was asked of the provider, so nothing more was charged. */
    expect([attempts, budget.spent]).toEqual([0, 1]);
  });

  it("THE CONTROL — with no budget, nothing is counted and the loop is unchanged", async () => {
    let attempts = 0;
    await withRetry(
      "test.sheet",
      async () => {
        attempts += 1;
        throw deadline();
      },
      { retries: 2, baseDelayMs: 0 },
    ).catch(() => undefined);
    /* Rolls, refines and plates pass no budget and must behave exactly as before. */
    expect(attempts).toBe(3);
  });
});

/**
 * ⚠ **DERIVED FROM THE REAL SETS, NEVER RESTATED — because a budget stop that
 * any loop above it could retry would be no budget at all.** The refusal's
 * class is read out of `RETRYABLE_FAILURES` and `VIEW_ARRIVAL_TERMINAL`
 * themselves, so moving `capability` into either one reddens here rather than
 * silently un-capping the price.
 */
describe("the budget refusal is terminal for every loop above it", () => {
  const refusal = renderBudgetSpent("test.sheet", createRenderBudget(2));

  it("is not retryable, so withRetry stops", () => {
    expect(isRetryable(refusal.failureClass)).toBe(false);
    expect(RETRYABLE_FAILURES.has(refusal.failureClass)).toBe(false);
  });

  it("is arrival-terminal, so neither arrival loop re-asks", () => {
    expect(VIEW_ARRIVAL_TERMINAL.has(refusal.failureClass)).toBe(true);
    expect(mayStillArrive(refusal.failureClass)).toBe(false);
  });

  it("is not charged to the budget, because no submission happened", () => {
    expect(providerMayHaveBilled(refusal)).toBe(false);
  });

  it("names what it spent, so a log says which cap was reached", () => {
    const budget = createRenderBudget(2);
    budget.charge();
    budget.charge();
    expect(renderBudgetSpent("fal.signSheet", budget).message)
      .toBe("fal.signSheet: this render budget is spent — 2 of 2 paid renders used");
  });
});
