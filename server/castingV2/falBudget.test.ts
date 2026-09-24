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
    /*
      ⚠ DRIVEN, NOT INHERITED (#1158 slice 4d). This arm used to read the
      defaults and assert 20, which proved the inclusive limit only for as long
      as the declared paths happened to add up to exactly the ceiling. The plate
      mint's retirement took the sum to 19 and the arm would have gone red
      having lost its SUBJECT rather than found a defect. So the equality is
      now CONFIGURED — one path raised until the sum meets the ceiling — and the
      property survives any future re-cut of who owns which slot.
    */
    process.env.FAL_ACCOUNT_CEILING = "20";
    const headroom = 20 - FAL_ALLOWANCES.reduce((sum, one) => sum + one.fallback, 0);
    expect(headroom, "the declared defaults already exceed the ceiling — assertFalBudget should be refusing").toBeGreaterThanOrEqual(0);
    process.env.FAL_CONCURRENCY = String(falAllowanceOf("FAL_CONCURRENCY") + headroom);

    const budget = assertFalBudget();
    expect(budget.total).toBe(20);
    expect(budget.total).toBe(budget.ceiling);
    expect(() => assertFalBudget()).not.toThrow();
  });

  it("leaves ONE slot unowned since the plate mint retired, and the courtesy pool did not take it back", () => {
    /*
      THE RE-CUT, PINNED (2026-08-18) AND THEN HALF-UNDONE (2026-09-24, #1158
      slice 4d). The fifth path could not be declared out of thin air — the four
      before it spent 20 of 20 — so the courtesy pool went 6 to 5 and not one
      paid path moved. When the plate mint retired, the 1 it had been given was
      NOT handed back: that would raise a live path's concurrency, which is his
      own rule's "capability change wearing a cleanup's clothes".

      ⚠ So the account now runs at 19 of 20 ON PURPOSE, and the two assertions
      that matter are the LOW one (region reads are still 5 — the edit this arm
      exists to catch is a later reader "closing the gap" by putting it back to
      6) and the ABSENCE one below (the row is really gone, not merely zeroed).

      A future path that quietly takes its slot from `roll images` would still
      satisfy the sum check above and would still boot. These are the assertions
      that would redden instead.
    */
    const budget = assertFalBudget();
    expect(budget.total).toBe(19);
    expect(budget.ceiling).toBe(20);
    expect(falAllowanceOf("ROLL_IMAGE_CONCURRENCY")).toBe(8);
    expect(falAllowanceOf("SIGN_VIEW_CONCURRENCY")).toBe(3);
    expect(falAllowanceOf("REFINE_EDIT_CONCURRENCY")).toBe(3);
    expect(
      falAllowanceOf("FAL_CONCURRENCY"),
      "region reads went back up — that is a capability change and wants its own card, not a cleanup",
    ).toBe(5);

    /* ⚠ The positive control on the removal itself: an undeclared allowance
       THROWS, so this cannot pass because the name merely reads as absent from
       a list nobody consults. */
    expect(FAL_ALLOWANCES.map((one) => one.env)).not.toContain("INK_PLATE_CONCURRENCY");
    expect(() => falAllowanceOf("INK_PLATE_CONCURRENCY")).toThrow(/not a declared fal allowance/);
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
