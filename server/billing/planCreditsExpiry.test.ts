/**
 * A CANCELLED PLAN'S CREDITS EXPIRE 30 DAYS PAST THE PAID PERIOD, AND TOP-UPS
 * NEVER DO (#2152) — the write and the sweep, driven.
 *
 * `expirePlanCredits` is the real function, run against a transaction double
 * shaped like `server/purchasedCreditsRenewal.test.ts`'s: each attempt's UPDATE
 * is answered with an `affectedRows` this file chooses, so the compare-and-set
 * loop itself is exercised rather than described. What reaches the UPDATE's
 * `set` and the ledger insert is what is asserted (law 5).
 *
 * The stamp that makes an account due is driven in
 * `server/stripe/cancelledPlanCreditsStamp.test.ts`; the clearing of a stamp by
 * a return to a paid plan is section 4 here.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

type Row = {
  balance: number;
  purchasedBalance?: number | null;
  planTier: string;
  planCreditsExpireAt: Date | null;
};

const rows: Row[] = [];
let rowReads = 0;

vi.mock("../db/credits", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getUserCredits: vi.fn().mockImplementation(async () => rows[Math.min(rowReads++, rows.length - 1)]),
}));

let updateAnswers: number[] = [];
const updateSets: Array<Record<string, unknown>> = [];
/** Each UPDATE's WHERE, rendered by Drizzle's own MySQL dialect — so the
 *  conditions the compare-and-set rests on are read, not assumed. */
const updateWheres: string[] = [];
const insertedRows: Array<Record<string, unknown>> = [];
let insertThrows: Error | null = null;

let selectAnswer: Array<Record<string, unknown>> = [];
const selectWheres: string[] = [];
const txDouble = {
  select: () => ({
    from: () => ({
      where: async (condition: unknown) => {
        const { MySqlDialect } = await import("drizzle-orm/mysql-core");
        selectWheres.push(new MySqlDialect().sqlToQuery(condition as never).sql);
        return selectAnswer;
      },
    }),
  }),
  update: () => ({
    set: (values: Record<string, unknown>) => ({
      where: async (condition: unknown) => {
        updateSets.push(values);
        const { MySqlDialect } = await import("drizzle-orm/mysql-core");
        updateWheres.push(new MySqlDialect().sqlToQuery(condition as never).sql);
        return [{ affectedRows: updateAnswers.shift() ?? 1 }];
      },
    }),
  }),
  insert: () => ({
    values: async (row: Record<string, unknown>) => {
      if (insertThrows) throw insertThrows;
      insertedRows.push(row);
    },
  }),
};

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => txDouble),
  withTransaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(txDouble)),
}));

import {
  expirePlanCredits,
  getPlanCreditsExpiryCandidates,
  planCreditsExpiryLedgerRef,
  updateUserSubscription,
} from "../db/billing";
import { planCreditsExpiryFrom, runPlanCreditsExpirySweep } from "./planCreditsExpiry";
import { PLAN_CREDITS_GRACE_DAYS } from "@shared/planCancelCopy";

const DAY_MS = 86_400_000;
const NOW = new Date("2026-11-20T12:00:00Z");
const DUE = new Date("2026-11-19T00:00:00Z");

beforeEach(() => {
  rows.length = 0;
  rowReads = 0;
  updateAnswers = [];
  updateSets.length = 0;
  updateWheres.length = 0;
  insertedRows.length = 0;
  insertThrows = null;
});

describe("1 · the expiry takes the PLAN's credits and leaves every top-up", () => {
  it("50,000 on the balance, 20,000 of them bought: 30,000 expire, 20,000 stay", async () => {
    rows.push({ balance: 50_000, purchasedBalance: 20_000, planTier: "free", planCreditsExpireAt: DUE });
    const result = await expirePlanCredits(7, DUE, NOW);
    expect(result).toEqual({ outcome: "expired", creditsRemoved: 30_000, newBalance: 20_000 });
    expect(updateSets).toHaveLength(1);
    expect(updateSets[0]).toMatchObject({ balance: 20_000, purchasedBalance: 20_000, planCreditsExpireAt: null });
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      userId: 7,
      amount: -30_000,
      balanceAfter: 20_000,
      referenceId: planCreditsExpiryLedgerRef(7, DUE),
      toolKind: null,
    });
  });

  it("an account holding ONLY top-ups loses nothing and writes no ledger line", async () => {
    rows.push({ balance: 20_000, purchasedBalance: 20_000, planTier: "free", planCreditsExpireAt: DUE });
    const result = await expirePlanCredits(7, DUE, NOW);
    expect(result).toEqual({ outcome: "nothing-to-expire" });
    expect(updateSets[0]).toMatchObject({ balance: 20_000, planCreditsExpireAt: null });
    expect(insertedRows).toHaveLength(0);
  });

  it("a top-up partly spent: only what is left of it is kept (purchased credits go last)", async () => {
    rows.push({ balance: 8_000, purchasedBalance: 20_000, planTier: "free", planCreditsExpireAt: DUE });
    const result = await expirePlanCredits(7, DUE, NOW);
    // All 8,000 are purchased (min of the two), so nothing is the plan's.
    expect(result).toEqual({ outcome: "nothing-to-expire" });
    expect(updateSets[0]).toMatchObject({ balance: 8_000 });
  });
});

describe("2 · it refuses every account that is not due", () => {
  it("before the deadline: no write", async () => {
    const later = new Date(NOW.getTime() + DAY_MS);
    rows.push({ balance: 50_000, purchasedBalance: 0, planTier: "free", planCreditsExpireAt: later });
    expect(await expirePlanCredits(7, later, NOW)).toEqual({ outcome: "not-due" });
    expect(updateSets).toHaveLength(0);
  });

  it("a customer who came back to a paid plan: no write", async () => {
    rows.push({ balance: 50_000, purchasedBalance: 0, planTier: "pro", planCreditsExpireAt: DUE });
    expect(await expirePlanCredits(7, DUE, NOW)).toEqual({ outcome: "not-due" });
    expect(updateSets).toHaveLength(0);
  });

  it("a stamp already cleared (or moved) by someone else: no write", async () => {
    rows.push({ balance: 50_000, purchasedBalance: 0, planTier: "free", planCreditsExpireAt: null });
    expect(await expirePlanCredits(7, DUE, NOW)).toEqual({ outcome: "already-expired" });
    expect(updateSets).toHaveLength(0);
  });
});

describe("3 · idempotent re-runs and races", () => {
  it("⚠ the write is conditioned on the balance, the STAMP and Free — read off the rendered WHERE", async () => {
    rows.push({ balance: 50_000, purchasedBalance: 0, planTier: "free", planCreditsExpireAt: DUE });
    await expirePlanCredits(7, DUE, NOW);
    const where = updateWheres[0];
    expect(where).toContain("`points`.`userId` = ?");
    expect(where).toContain("`points`.`balance` = ?");
    expect(where).toContain("`points`.`planCreditsExpireAt` = ?");
    expect(where).toContain("`points`.`planTier` = ?");
  });

  it("a second sweeper that loses the compare-and-set re-reads, finds the stamp gone, and writes nothing", async () => {
    rows.push(
      { balance: 50_000, purchasedBalance: 0, planTier: "free", planCreditsExpireAt: DUE },
      { balance: 0, purchasedBalance: 0, planTier: "free", planCreditsExpireAt: null },
    );
    updateAnswers = [0];
    expect(await expirePlanCredits(7, DUE, NOW)).toEqual({ outcome: "already-expired" });
    expect(insertedRows).toHaveLength(0);
  });

  it("a spend landing mid-expiry: the write misses, re-reads, and expires the NEW plan part", async () => {
    rows.push(
      { balance: 50_000, purchasedBalance: 10_000, planTier: "free", planCreditsExpireAt: DUE },
      { balance: 45_000, purchasedBalance: 10_000, planTier: "free", planCreditsExpireAt: DUE },
    );
    updateAnswers = [0, 1];
    const result = await expirePlanCredits(7, DUE, NOW);
    expect(result).toEqual({ outcome: "expired", creditsRemoved: 35_000, newBalance: 10_000 });
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].amount).toBe(-35_000);
  });

  it("the ledger already holds this deadline's line: answered already-expired, and the stamp is cleared", async () => {
    rows.push({ balance: 50_000, purchasedBalance: 0, planTier: "free", planCreditsExpireAt: DUE });
    insertThrows = Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY", errno: 1062 });
    expect(await expirePlanCredits(7, DUE, NOW)).toEqual({ outcome: "already-expired" });
    expect(updateSets.at(-1)).toEqual({ planCreditsExpireAt: null });
  });

  it("the reference is unique per (account, deadline) and stable across runs", () => {
    expect(planCreditsExpiryLedgerRef(7, DUE)).toBe(planCreditsExpiryLedgerRef(7, new Date(DUE)));
    expect(planCreditsExpiryLedgerRef(7, DUE)).not.toBe(planCreditsExpiryLedgerRef(8, DUE));
    expect(planCreditsExpiryLedgerRef(7, DUE)).not.toBe(
      planCreditsExpiryLedgerRef(7, new Date(DUE.getTime() + 1000)),
    );
  });
});

describe("4 · a return to a paid plan cancels the pending expiry", () => {
  it("any move to a paid tier clears the stamp in the same write", async () => {
    await updateUserSubscription(7, { planTier: "pro", subscriptionStatus: "active" });
    expect(updateSets.at(-1)).toMatchObject({ planTier: "pro", planCreditsExpireAt: null });
  });

  it("NEGATIVE CONTROL: the downgrade to Free keeps the stamp it is given", async () => {
    await updateUserSubscription(7, { planTier: "free", planCreditsExpireAt: DUE });
    expect(updateSets.at(-1)).toMatchObject({ planTier: "free", planCreditsExpireAt: DUE });
  });

  it("a write that names no tier leaves the stamp alone", async () => {
    await updateUserSubscription(7, { subscriptionStatus: "past_due" });
    expect(updateSets.at(-1)).not.toHaveProperty("planCreditsExpireAt");
  });
});

describe("5 · the deadline", () => {
  it(`is the stated period end plus ${PLAN_CREDITS_GRACE_DAYS} days`, () => {
    const endSec = Math.floor(NOW.getTime() / 1000) - 3600;
    const at = planCreditsExpiryFrom({ items: { data: [{ current_period_end: endSec }] }, ended_at: endSec }, NOW);
    expect(at.getTime()).toBe((endSec * 1000) + PLAN_CREDITS_GRACE_DAYS * DAY_MS);
  });

  it("never runs from a fabricated period — no period and no ended_at means from now", () => {
    const at = planCreditsExpiryFrom({}, NOW);
    expect(at.getTime()).toBe(Math.floor((NOW.getTime() + PLAN_CREDITS_GRACE_DAYS * DAY_MS) / 1000) * 1000);
  });
});

describe("6 · the sweep", () => {
  it("its shortlist asks for a passed deadline on a Free account, and nothing else", async () => {
    selectAnswer = [{ userId: 3, planCreditsExpireAt: DUE }];
    expect(await getPlanCreditsExpiryCandidates(NOW)).toEqual([{ userId: 3, planCreditsExpireAt: DUE }]);
    const where = selectWheres.at(-1) ?? "";
    expect(where).toContain("`points`.`planCreditsExpireAt` is not null");
    expect(where).toContain("`points`.`planCreditsExpireAt` < ?");
    expect(where).toContain("`points`.`planTier` = ?");
  });

  it("expires every due candidate and counts each outcome", async () => {
    const expire = vi
      .fn()
      .mockResolvedValueOnce({ outcome: "expired", creditsRemoved: 30_000, newBalance: 0 })
      .mockResolvedValueOnce({ outcome: "already-expired" })
      .mockResolvedValueOnce({ outcome: "failed", error: "db" });
    const result = await runPlanCreditsExpirySweep({
      now: () => NOW,
      candidates: async () => [
        { userId: 1, planCreditsExpireAt: DUE },
        { userId: 2, planCreditsExpireAt: DUE },
        { userId: 3, planCreditsExpireAt: DUE },
      ],
      expire,
    });
    expect(expire).toHaveBeenCalledTimes(3);
    expect(expire).toHaveBeenCalledWith(1, DUE, NOW);
    expect(result).toEqual({
      considered: 3,
      outcomes: { expired: 1, "already-expired": 1, failed: 1 },
      creditsRemoved: 30_000,
    });
  });

  it("a quiet sweep touches nothing", async () => {
    const expire = vi.fn();
    const result = await runPlanCreditsExpirySweep({ now: () => NOW, candidates: async () => [], expire });
    expect(expire).not.toHaveBeenCalled();
    expect(result.considered).toBe(0);
  });
});
