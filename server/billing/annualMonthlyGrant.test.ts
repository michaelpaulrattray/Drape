/**
 * A YEARLY PLAN'S CREDITS ARRIVE MONTH BY MONTH (#2152, his ruling on #2159,
 * 2026-10-10: *"yearly credits apply month by month it on the new notion
 * card"*) — the months' arithmetic, the write that carries the paid year, the
 * worker's shortlist and lock, and the worker itself, driven.
 *
 * The database is a transaction double shaped like `planCreditsExpiry.test.ts`'s:
 * each UPDATE's `set` and WHERE (rendered by Drizzle's own MySQL dialect) and
 * each ledger insert are what is asserted (law 5), and the compare-and-set
 * loop runs for real. The rollover rule in every grant is the product's own
 * `calculateRolloverCredits`, so the cap read here is the cap that ships.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

type Row = Record<string, unknown> & { balance: number };

const rows: Row[] = [];
let rowReads = 0;

vi.mock("../db/credits", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getUserCredits: vi.fn().mockImplementation(async () => rows[Math.min(rowReads++, rows.length - 1)]),
}));

vi.mock("../db/planChangeSettlements", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  /* No plan change settled inside any month here; #1937's own arms drive it. */
  netAppliedPlanChangeSettlementsSince: vi.fn().mockResolvedValue(0),
}));

let updateAnswers: number[] = [];
const updateSets: Array<Record<string, unknown>> = [];
const updateWheres: string[] = [];
const insertedRows: Array<Record<string, unknown>> = [];
let selectAnswer: Array<Record<string, unknown>> = [];
const selectWheres: string[] = [];
const joinOns: unknown[] = [];
const txDouble = {
  select: () => {
    const where = async (condition: unknown) => {
      const { MySqlDialect } = await import("drizzle-orm/mysql-core");
      selectWheres.push(new MySqlDialect().sqlToQuery(condition as never).sql);
      return selectAnswer;
    };
    return {
      from: () => ({
        where,
        /* The shortlist joins `users` for suspension (#2152 repair 2). */
        innerJoin: (_table: unknown, on: unknown) => {
          joinOns.push(on);
          return { where };
        },
      }),
    };
  },
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
      insertedRows.push(row);
    },
  }),
};

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => txDouble),
  withTransaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(txDouble)),
}));

import {
  ANNUAL_GRANT_LIVE_STATUSES,
  ANNUAL_YEAR_NOT_CURRENT,
  clearAnnualYear,
  getAnnualGrantCandidates,
  getAnnualYearProgress,
  installAnnualMonthlyCredits,
  refreshMonthlyCredits,
  updateUserSubscription,
  type AnnualGrantCandidate,
} from "../db/billing";
import {
  MONTHS_IN_A_PAID_YEAR,
  annualMonthLedgerRef,
  annualMonthStartMs,
  annualMonthsBegun,
  grantedShareMonths,
} from "./annualCreditMonths";
import { grantAnnualMonth, runAnnualMonthlyGrantSweep, type AnnualMonthlyGrantDeps } from "./annualMonthlyGrant";
import { calculateRolloverCredits } from "../stripe/stripeService";
import { planCreditsExpiryFromPaidEnd } from "./planCreditsExpiry";
import { CANCELLED_PLAN_GRACE_DAYS } from "@shared/planCancelCopy";
import { PLAN_TIERS, type PlanTier } from "../../drizzle/schema";
import { SELF_SERVE_PLAN_ORDER } from "../stripe/stripeProducts";

const DAY_MS = 86_400_000;
const START = new Date("2026-11-01T00:00:00Z");
const END = new Date(START.getTime() + 365 * DAY_MS);
const SUB = "sub_yearly";

/* A paid rung whose carry-over is a percentage below 100, so the arms can tell
   the cap from the percentage — derived off the ladder, never typed. */
const PLAN = (() => {
  const found = SELF_SERVE_PLAN_ORDER.find(
    (tier) => PLAN_TIERS[tier].price > 0 && PLAN_TIERS[tier].rolloverPercent > 0 && PLAN_TIERS[tier].rolloverPercent < 100,
  );
  if (!found) throw new Error("no paid rung carries a partial rollover — this suite cannot tell the cap from the percentage");
  return found as PlanTier;
})();
const MONTH = PLAN_TIERS[PLAN].monthlyCredits;

const year = (over: Partial<AnnualGrantCandidate> = {}): AnnualGrantCandidate => ({
  userId: 7,
  planTier: PLAN,
  subscriptionId: SUB,
  periodStart: START,
  periodEnd: END,
  monthlyCredits: MONTH,
  ...over,
});

/** A live yearly row for this year, with whatever balance the arm needs. */
const liveRow = (balance: number, over: Record<string, unknown> = {}): Row => ({
  balance,
  purchasedBalance: 0,
  planTier: PLAN,
  stripeSubscriptionId: SUB,
  billingInterval: "year",
  subscriptionStatus: "active",
  annualGrantSubscriptionId: SUB,
  annualGrantPeriodStart: START,
  annualGrantPeriodEnd: END,
  annualGrantMonthlyCredits: MONTH,
  ...over,
});

beforeEach(() => {
  rows.length = 0;
  rowReads = 0;
  updateAnswers = [];
  updateSets.length = 0;
  updateWheres.length = 0;
  insertedRows.length = 0;
  selectAnswer = [];
  selectWheres.length = 0;
  joinOns.length = 0;
});

describe("1 · the months of a paid year", () => {
  it("month k begins at a twelfth of the PAID PERIOD, in whole seconds", () => {
    expect(annualMonthStartMs(START.getTime(), END.getTime(), 0)).toBe(START.getTime());
    const k6 = annualMonthStartMs(START.getTime(), END.getTime(), 6);
    expect(k6).toBe(Math.floor((START.getTime() + (END.getTime() - START.getTime()) / 2) / 1000) * 1000);
    expect(k6 % 1000).toBe(0);
  });

  it("one month has begun on the day it is paid, twelve in its last month, none before it", () => {
    const s = START.getTime();
    const e = END.getTime();
    expect(annualMonthsBegun(s, e, s - 1)).toBe(0);
    expect(annualMonthsBegun(s, e, s)).toBe(1);
    expect(annualMonthsBegun(s, e, annualMonthStartMs(s, e, 1) - 1)).toBe(1);
    expect(annualMonthsBegun(s, e, annualMonthStartMs(s, e, 1))).toBe(2);
    expect(annualMonthsBegun(s, e, e - 1)).toBe(MONTHS_IN_A_PAID_YEAR);
  });

  it("⚠ the key is the SAME across a change of clock — a clock-dependent key would double-grant every pass", () => {
    /* The relay's finding on head 18315b5f1: the old stability arm computed
       both keys in one millisecond, so a key with `Date.now()` in it passed.
       The two readings here are a day apart on the clock. */
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-12-01T00:00:00Z"));
      const first = annualMonthLedgerRef(SUB, START.getTime(), 3);
      vi.setSystemTime(new Date("2026-12-02T00:00:01Z"));
      const second = annualMonthLedgerRef(SUB, START.getTime(), 3);
      expect(second).toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it("each month's ledger key is unique per (subscription, year, month) and stable", () => {
    const a = annualMonthLedgerRef(SUB, START.getTime(), 3);
    expect(a).toBe(annualMonthLedgerRef(SUB, START.getTime(), 3));
    expect(a).not.toBe(annualMonthLedgerRef(SUB, START.getTime(), 4));
    expect(a).not.toBe(annualMonthLedgerRef(SUB, END.getTime(), 3));
    expect(a).not.toBe(annualMonthLedgerRef("sub_other", START.getTime(), 3));
    expect(a.length).toBeLessThanOrEqual(64);
  });

  it("the share granted whole is EXACTLY the old figure — the identity every monthly plan rides", () => {
    for (const [remaining, total] of [[17, 30], [0, 31], [365, 365], [100, 365]] as const) {
      expect(grantedShareMonths(1, null, remaining, total)).toBe(1 * (remaining / total));
      expect(grantedShareMonths(12, null, remaining, total)).toBe(12 * (remaining / total));
      expect(grantedShareMonths(12, 12, remaining, total)).toBe(12 * (remaining / total));
    }
  });

  it("granted month by month, only what was handed over and not yet used counts", () => {
    // Half-way through month 4 (3.5 months elapsed), 4 months granted: half a month is unused.
    const total = 360;
    const remaining = total - 105;
    expect(grantedShareMonths(12, 4, remaining, total)).toBeCloseTo(0.5, 10);
    // A worker running late (3 granted, 3.5 used) owes nothing back — never negative.
    expect(grantedShareMonths(12, 3, remaining, total)).toBe(0);
  });
});

describe("2 · the write that carries the paid year", () => {
  it("an annual invoice's grant writes the year IN THE SAME UPDATE as its first month", async () => {
    rows.push(liveRow(0, { annualGrantSubscriptionId: null, annualGrantPeriodStart: null }));
    const result = await refreshMonthlyCredits(
      7, MONTH, (b) => calculateRolloverCredits(b, PLAN, MONTH), "stripe-invoice:in_1", undefined, null,
      { annualYear: { subscriptionId: SUB, invoiceId: "in_1", periodStart: START, periodEnd: END, monthlyCredits: MONTH } },
    );
    expect(result.success).toBe(true);
    expect(updateSets).toHaveLength(1);
    expect(updateSets[0]).toMatchObject({
      balance: MONTH,
      annualGrantSubscriptionId: SUB,
      annualGrantInvoiceId: "in_1",
      annualGrantPeriodStart: START,
      annualGrantPeriodEnd: END,
      annualGrantMonthlyCredits: MONTH,
    });
  });

  it("a monthly invoice CLEARS the year — no months still to come", async () => {
    rows.push(liveRow(0));
    await refreshMonthlyCredits(7, MONTH, (b) => b, "stripe-invoice:in_m", undefined, null, { annualYear: null });
    expect(updateSets[0]).toMatchObject({
      annualGrantSubscriptionId: null,
      annualGrantPeriodStart: null,
      annualGrantPeriodEnd: null,
      annualGrantMonthlyCredits: null,
    });
  });

  it("NEGATIVE CONTROL: a grant that names no year leaves the columns alone", async () => {
    rows.push(liveRow(0));
    await refreshMonthlyCredits(7, MONTH, (b) => b, "stripe-invoice:in_x");
    expect(Object.keys(updateSets[0])).not.toContain("annualGrantPeriodStart");
    expect(updateWheres[0]).not.toMatch(/annualGrant/);
  });

  it("⚠ the worker's lock is in the WHERE of the write — the same six facts the row is read for", async () => {
    rows.push(liveRow(0));
    const result = await refreshMonthlyCredits(
      7, MONTH, (b) => b, annualMonthLedgerRef(SUB, START.getTime(), 1), "m2", null,
      { onlyWhileYear: { subscriptionId: SUB, periodStart: START, monthlyCredits: MONTH } },
    );
    expect(result.success).toBe(true);
    const where = updateWheres[0];
    expect(where).toMatch(/`annualGrantSubscriptionId` = \?/);
    expect(where).toMatch(/`annualGrantPeriodStart` = \?/);
    expect(where).toMatch(/`stripeSubscriptionId` = \?/);
    expect(where).toMatch(/`planTier` <> \?/);
    expect(where).toMatch(/`billingInterval` = \?/);
    expect(where).toMatch(/`subscriptionStatus` in \(/);
    expect(where).toMatch(/`annualGrantMonthlyCredits` = \?/);
  });

  it("⚠ an upgrade raising the month between the worker's read and its write: the stale size never lands", async () => {
    rows.push(liveRow(5_000, { annualGrantMonthlyCredits: MONTH * 2 }));
    const result = await refreshMonthlyCredits(
      7, MONTH, (b) => b, annualMonthLedgerRef(SUB, START.getTime(), 2), "m3", null,
      { onlyWhileYear: { subscriptionId: SUB, periodStart: START, monthlyCredits: MONTH } },
    );
    expect(result.error).toBe(ANNUAL_YEAR_NOT_CURRENT);
    expect(updateSets).toHaveLength(0);
  });

  it("⚠ an upgrade's month installs only on the OWNER's row AND the year it was bought for, in the write's own WHERE", async () => {
    await installAnnualMonthlyCredits(7, MONTH * 2, START);
    expect(updateSets[0]).toEqual({ annualGrantMonthlyCredits: MONTH * 2 });
    expect(updateWheres[0]).toMatch(/`points`\.`userId` = \?/);
    expect(updateWheres[0]).toMatch(/`annualGrantPeriodStart` = \?/);
  });

  for (const [what, over] of [
    ["the plan was cancelled (moved to Free)", { planTier: "free", subscriptionStatus: "canceled" }],
    ["the status is canceled", { subscriptionStatus: "canceled" }],
    ["it switched to monthly billing", { billingInterval: "month" }],
    ["the next year's invoice already started a new year", { annualGrantPeriodStart: END }],
    ["the year's columns were cleared", { annualGrantSubscriptionId: null, annualGrantPeriodStart: null }],
    ["a different subscription is on the row now", { stripeSubscriptionId: "sub_new" }],
  ] as const) {
    it(`⚠ no month lands once ${what} — no write at all`, async () => {
      rows.push(liveRow(5_000, over as Record<string, unknown>));
      const result = await refreshMonthlyCredits(
        7, MONTH, (b) => b, annualMonthLedgerRef(SUB, START.getTime(), 2), "m3", null,
        { onlyWhileYear: { subscriptionId: SUB, periodStart: START, monthlyCredits: MONTH } },
      );
      expect(result).toEqual({ success: false, error: ANNUAL_YEAR_NOT_CURRENT });
      expect(updateSets).toHaveLength(0);
      expect(insertedRows).toHaveLength(0);
    });
  }

  it("a cancellation landing between the read and the write: the write misses, the re-read refuses", async () => {
    rows.push(liveRow(5_000), liveRow(5_000, { planTier: "free", subscriptionStatus: "canceled" }));
    updateAnswers = [0];
    const result = await refreshMonthlyCredits(
      7, MONTH, (b) => b, annualMonthLedgerRef(SUB, START.getTime(), 2), "m3", null,
      { onlyWhileYear: { subscriptionId: SUB, periodStart: START, monthlyCredits: MONTH } },
    );
    expect(result.error).toBe(ANNUAL_YEAR_NOT_CURRENT);
    expect(insertedRows).toHaveLength(0);
  });

  it("a move to Free clears the year in the same write (the second lock)", async () => {
    await updateUserSubscription(7, { planTier: "free", subscriptionStatus: "canceled" });
    expect(updateSets[0]).toMatchObject({
      annualGrantSubscriptionId: null,
      annualGrantPeriodStart: null,
      annualGrantPeriodEnd: null,
      annualGrantMonthlyCredits: null,
    });
  });

  it("NEGATIVE CONTROL: a move to a paid tier leaves the year alone", async () => {
    await updateUserSubscription(7, { planTier: PLAN });
    expect(Object.keys(updateSets[0])).not.toContain("annualGrantPeriodStart");
  });
});

describe("3 · how the worker finds due grants", () => {
  it("its shortlist asks for a live yearly year still in flight, and nothing else", async () => {
    await getAnnualGrantCandidates(START);
    const where = selectWheres[0];
    expect(where).toMatch(/`annualGrantSubscriptionId` is not null/);
    expect(where).toMatch(/`annualGrantPeriodStart` is not null/);
    expect(where).toMatch(/`annualGrantMonthlyCredits` is not null/);
    expect(where).toMatch(/`annualGrantPeriodEnd` > \?/);
    expect(where).toMatch(/`stripeSubscriptionId` = `points`\.`annualGrantSubscriptionId`/);
    expect(where).toMatch(/`planTier` <> \?/);
    expect(where).toMatch(/`billingInterval` = \?/);
    expect(where).toMatch(/`subscriptionStatus` in \(/);
  });

  it("⚠ a SUSPENDED account receives no months — the shortlist joins users and asks for none (#2152 repair 2)", async () => {
    await getAnnualGrantCandidates(START);
    expect(joinOns).toHaveLength(1);
    expect(selectWheres[0]).toMatch(/`users`\.`suspendedAt` is null/);
  });

  it("an `unpaid` subscription keeps its PAID year's months — a failed upgrade's dunning cannot stop them (#2152 repair 1)", () => {
    expect(ANNUAL_GRANT_LIVE_STATUSES).toContain("unpaid");
    expect(ANNUAL_GRANT_LIVE_STATUSES).not.toContain("canceled");
  });

  it("a lost dispute clears the year scoped to the OWNER and the INVOICE that opened it, in the write", async () => {
    expect(await clearAnnualYear(7, "in_year_open")).toBe(true);
    expect(updateSets[0]).toEqual({
      annualGrantSubscriptionId: null,
      annualGrantInvoiceId: null,
      annualGrantPeriodStart: null,
      annualGrantPeriodEnd: null,
      annualGrantMonthlyCredits: null,
    });
    expect(updateWheres[0]).toMatch(/`points`\.`userId` = \?/);
    expect(updateWheres[0]).toMatch(/`annualGrantInvoiceId` = \?/);
  });

  it("a year opened by a DIFFERENT invoice matches nothing — answered false, not cleared", async () => {
    updateAnswers = [0];
    expect(await clearAnnualYear(7, "in_last_year")).toBe(false);
  });

  it("a final payment failure's deadline runs from the END OF THE PAID PERIOD plus the grace days (#2152 repair 3)", () => {
    const paidEnd = Math.floor(START.getTime() / 1000);
    const now = new Date(START.getTime() + 20 * DAY_MS); // dunning ran three weeks
    expect(planCreditsExpiryFromPaidEnd(paidEnd, now)).toEqual(
      new Date((paidEnd + CANCELLED_PLAN_GRACE_DAYS * 86_400) * 1000),
    );
    expect(planCreditsExpiryFromPaidEnd(null, now)).toEqual(
      new Date(now.getTime() + CANCELLED_PLAN_GRACE_DAYS * DAY_MS),
    );
  });

  it("how many months have landed is read off the LEDGER, month 1 being the invoice's own", async () => {
    rows.push(liveRow(0));
    selectAnswer = [
      { referenceId: annualMonthLedgerRef(SUB, START.getTime(), 1) },
      { referenceId: annualMonthLedgerRef(SUB, START.getTime(), 2) },
    ];
    const progress = await getAnnualYearProgress(7);
    expect(progress).toMatchObject({ subscriptionId: SUB, monthsGranted: 3 });
    expect(selectWheres[0]).toMatch(/`referenceId` in \(/);
  });

  it("no year on the row is null — the period was granted whole", async () => {
    rows.push(liveRow(0, { annualGrantSubscriptionId: null, annualGrantPeriodStart: null, annualGrantPeriodEnd: null }));
    expect(await getAnnualYearProgress(7)).toBeNull();
  });
});

describe("4 · the worker", () => {
  const at = (k: number, plusMs = 0) => new Date(annualMonthStartMs(START.getTime(), END.getTime(), k) + plusMs);

  function harness(now: Date, landed: Set<string> = new Set(), grantImpl?: AnnualMonthlyGrantDeps["grant"]) {
    const grants: Array<Parameters<AnnualMonthlyGrantDeps["grant"]>> = [];
    const deps: AnnualMonthlyGrantDeps = {
      now: () => now,
      candidates: async () => [year()],
      alreadyGranted: async (_userId, ref) => landed.has(ref),
      grant: (async (...args: Parameters<AnnualMonthlyGrantDeps["grant"]>) => {
        grants.push(args);
        if (grantImpl) return grantImpl(...args);
        landed.add(args[3]);
        return { success: true, newBalance: 1 };
      }) as AnnualMonthlyGrantDeps["grant"],
    };
    return { deps, grants };
  }

  it("NEGATIVE CONTROL: inside month 1 nothing is due — the invoice granted it", async () => {
    const { deps, grants } = harness(at(1, -1));
    const sweep = await runAnnualMonthlyGrantSweep(deps);
    expect(grants).toHaveLength(0);
    expect(sweep.outcomes).toEqual({});
  });

  it("at month 2's boundary, month 2 is granted — one month, its own key, locked to its year", async () => {
    const { deps, grants } = harness(at(1));
    await runAnnualMonthlyGrantSweep(deps);
    expect(grants).toHaveLength(1);
    const [userId, amount, , ref, description, windowStart, options] = grants[0];
    expect(userId).toBe(7);
    expect(amount).toBe(MONTH);
    expect(ref).toBe(annualMonthLedgerRef(SUB, START.getTime(), 1));
    expect(description).toContain("month 2 of 12");
    expect(windowStart).toEqual(at(1));
    expect(options).toEqual({ onlyWhileYear: { subscriptionId: SUB, periodStart: START, monthlyCredits: MONTH } });
  });

  it("⚠ the rule at each monthly grant is the monthly plan's: the percentage, capped at ONE month", async () => {
    const { deps, grants } = harness(at(1));
    await runAnnualMonthlyGrantSweep(deps);
    const rule = grants[0][2];
    const under = Math.floor(MONTH / 2);
    expect(rule(under)).toBe(calculateRolloverCredits(under, PLAN, MONTH));
    expect(rule(under)).toBeLessThan(under); // the percentage, not identity
    expect(rule(MONTH * 50)).toBe(MONTH); // "no separate yearly cap"
  });

  it("a server down for three boundaries grants the missing months oldest first, each once", async () => {
    const landed = new Set<string>();
    const { deps, grants } = harness(at(3, 1), landed);
    await runAnnualMonthlyGrantSweep(deps);
    expect(grants.map((g) => g[3])).toEqual([1, 2, 3].map((k) => annualMonthLedgerRef(SUB, START.getTime(), k)));
    // A second pass in the same month grants nothing more.
    grants.length = 0;
    await runAnnualMonthlyGrantSweep(deps);
    expect(grants).toHaveLength(0);
  });

  it("never past the paid year: after its end no thirteenth month is asked for", async () => {
    const { deps, grants } = harness(new Date(END.getTime() + 40 * DAY_MS));
    await runAnnualMonthlyGrantSweep(deps);
    expect(grants.map((g) => g[3])).toEqual(
      Array.from({ length: 11 }, (_, i) => annualMonthLedgerRef(SUB, START.getTime(), i + 1)),
    );
  });

  it("a year that ended under it (cancelled, switched) stops the pass for that account", async () => {
    const { deps, grants } = harness(at(3, 1), new Set(), async () => ({ success: false, error: ANNUAL_YEAR_NOT_CURRENT }));
    const sweep = await runAnnualMonthlyGrantSweep(deps);
    expect(grants).toHaveLength(1);
    expect(sweep.outcomes).toEqual({ "year-over": 1 });
  });

  it("a failed month holds the months behind it for the next pass", async () => {
    const { deps, grants } = harness(at(3, 1), new Set(), async () => ({ success: false, error: "db down" }));
    const sweep = await runAnnualMonthlyGrantSweep(deps);
    expect(grants).toHaveLength(1);
    expect(sweep.outcomes).toEqual({ failed: 1 });
  });

  it("⚠ DRIVEN THROUGH THE REAL WRITE: a huge bank lands as this month plus ONE month carried", async () => {
    rows.push(liveRow(MONTH * 20));
    const outcome = await grantAnnualMonth(year(), 1, { grant: refreshMonthlyCredits });
    expect(outcome.outcome).toBe("granted");
    expect(updateSets[0]).toMatchObject({ balance: MONTH + MONTH, rolloverCredits: MONTH });
    expect(insertedRows[0]).toMatchObject({
      userId: 7,
      amount: MONTH,
      type: "subscription",
      referenceId: annualMonthLedgerRef(SUB, START.getTime(), 1),
    });
    expect(updateWheres[0]).toMatch(/`annualGrantPeriodStart` = \?/);
  });
});
