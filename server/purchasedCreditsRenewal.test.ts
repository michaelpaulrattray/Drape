/**
 * A RENEWAL NEVER TAKES BACK CREDITS THE CUSTOMER BOUGHT (#1604, P1-5).
 *
 * `refreshMonthlyCredits` SETS the balance at every renewal:
 * `grant + floor(rolloverPercent × balance)`. Applied to the whole balance,
 * that takes the plan's forfeiture rule — a rule about a plan's own monthly
 * allowance — and points it at credits somebody paid cash for: on Starter's
 * 50% a customer holding 25,000 bought credits keeps 12,500 of them through
 * one renewal and 6,250 through the next.
 *
 * These arms drive the real function through the same transaction double
 * `server/creditRefreshRace.test.ts` uses — the compare-and-set loop itself,
 * not a sleep-and-hope reproduction — and read the numbers that reach the
 * UPDATE and the ledger row.
 *
 * ⚠ THE TWO CONTROLS THAT MATTER MOST ARE THE ONES THAT MUST NOT MOVE: the
 * identity rule (the interval-switch road) and every row with no purchased
 * credits on it must come out of this change with the arithmetic they had.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

type Row = { balance: number; purchasedBalance?: number | null };

const rows: Row[] = [];
let rowReads = 0;

vi.mock("./db/credits", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getUserCredits: vi.fn().mockImplementation(async () => rows[Math.min(rowReads++, rows.length - 1)]),
}));

/** Each entry answers one attempt's UPDATE with its affectedRows. */
let updateAnswers: number[] = [];
const updateSets: Array<Record<string, unknown>> = [];
const insertedRows: Array<Record<string, unknown>> = [];

const txDouble = {
  update: () => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        updateSets.push(values);
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

vi.mock("./db/connection", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  withTransaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(txDouble)),
}));

import { refreshMonthlyCredits } from "./db/billing";
import { planAllowanceRemaining, purchasedCreditsRemaining } from "./db/credits";
import { calculateRolloverCredits } from "./stripe/stripeService";
import { PLAN_TIERS } from "../drizzle/schema";

/** Starter's rule, quoted from `PLAN_TIERS.starter.rolloverPercent`. */
const half = (balance: number) => Math.floor(balance * 0.5);
/** The interval-switch road's rule — `webhooks.ts` passes exactly this. */
const identity = (balance: number) => balance;

beforeEach(() => {
  rows.length = 0;
  rowReads = 0;
  updateAnswers = [];
  updateSets.length = 0;
  insertedRows.length = 0;
});

describe("purchasedCreditsRemaining — purchased credits are the LAST to go", () => {
  it("is the lesser of the column and the live balance", () => {
    expect(purchasedCreditsRemaining({ balance: 35_000, purchasedBalance: 25_000 })).toBe(25_000);
    expect(purchasedCreditsRemaining({ balance: 5_000, purchasedBalance: 25_000 })).toBe(5_000);
    expect(purchasedCreditsRemaining({ balance: 0, purchasedBalance: 25_000 })).toBe(0);
  });

  it("the plan's part is what is left over, and the two always sum to the balance", () => {
    for (const row of [
      { balance: 35_000, purchasedBalance: 25_000 },
      { balance: 5_000, purchasedBalance: 25_000 },
      { balance: 13_500, purchasedBalance: 0 },
      { balance: 0, purchasedBalance: 0 },
    ]) {
      expect(purchasedCreditsRemaining(row) + planAllowanceRemaining(row)).toBe(row.balance);
    }
  });

  it("⚠ answers ZERO rather than inventing protection when the column is absent", () => {
    /*
      Both columns are NOT NULL DEFAULT 0, so a live row cannot reach here
      without the field — a partial projection or a test double can. Zero is
      the only direction that cannot protect credits nobody bought.
    */
    expect(purchasedCreditsRemaining({ balance: 9_000 })).toBe(0);
    expect(purchasedCreditsRemaining({ balance: 9_000, purchasedBalance: null })).toBe(0);
    expect(purchasedCreditsRemaining({ balance: 9_000, purchasedBalance: NaN })).toBe(0);
    expect(purchasedCreditsRemaining({ balance: 9_000, purchasedBalance: -400 })).toBe(0);
    expect(planAllowanceRemaining({ balance: 9_000 })).toBe(9_000);
  });

  it("a non-finite balance cannot produce a negative plan part", () => {
    expect(purchasedCreditsRemaining({ balance: NaN, purchasedBalance: 500 })).toBe(0);
    expect(planAllowanceRemaining({ balance: NaN, purchasedBalance: 500 })).toBe(0);
    expect(planAllowanceRemaining({ balance: -100, purchasedBalance: 500 })).toBe(0);
  });
});

describe("the renewal", () => {
  it("⚠ THE CARD'S ROW — 25,000 bought + 10,000 of the allowance renews to grant + rollover(allowance) + 25,000", async () => {
    rows.push({ balance: 35_000, purchasedBalance: 25_000 });
    updateAnswers = [1];

    const result = await refreshMonthlyCredits(7, 75_000, half, "stripe-invoice:in_p15_1");

    expect(result.success).toBe(true);
    /* The rollover is 50% of the ALLOWANCE's 10,000, never of the 35,000. */
    expect(result.newBalance).toBe(75_000 + 5_000 + 25_000);
    expect(updateSets[0].rolloverCredits).toBe(5_000);
    /* Never less: the whole bought amount survives. */
    expect(updateSets[0].purchasedBalance).toBe(25_000);
    expect(insertedRows[0].balanceAfter).toBe(105_000);
  });

  it("the defect it replaces would have taken 12,500 of those bought credits", async () => {
    /*
      A positive control on the claim rather than on the code: the old road
      was `grant + computeRollover(balance)`, and this is that number. It must
      be LESS than what the arm above produces, by exactly half the bought
      amount — otherwise the arm above is not measuring anything.
    */
    const oldRoad = 75_000 + half(35_000);
    expect(oldRoad).toBe(92_500);
    expect(105_000 - oldRoad).toBe(12_500);
  });

  it("the grant on the ledger row is still the GRANT, not the protected balance", async () => {
    rows.push({ balance: 35_000, purchasedBalance: 25_000 });
    updateAnswers = [1];
    await refreshMonthlyCredits(7, 75_000, half, "stripe-invoice:in_p15_2");
    expect(insertedRows[0].amount).toBe(75_000);
    expect(insertedRows[0].type).toBe("subscription");
  });

  it("⚠ the upper bound is SETTLED against a balance the customer spent down, and persisted", async () => {
    /*
      They bought 25,000, then spent all but 4,000 of everything. The bound
      must come down with the balance or the next cycle protects credits that
      are gone — and it must be WRITTEN, because the column is what the next
      renewal reads.
    */
    rows.push({ balance: 4_000, purchasedBalance: 25_000 });
    updateAnswers = [1];

    const result = await refreshMonthlyCredits(7, 75_000, half, "stripe-invoice:in_p15_3");

    expect(result.newBalance).toBe(75_000 + 0 + 4_000);
    expect(updateSets[0].rolloverCredits).toBe(0);
    expect(updateSets[0].purchasedBalance).toBe(4_000);
  });

  it("⚠ THE IDENTITY ROAD IS UNCHANGED — an interval switch still carries the whole balance through", async () => {
    /*
      `webhooks.ts` passes `(balance) => balance` on `subscription_update`.
      Identity over the plan part plus the purchased part whole IS identity
      over the balance, and this arm is the arithmetic proof rather than the
      intention.
    */
    rows.push({ balance: 35_000, purchasedBalance: 25_000 });
    updateAnswers = [1];

    const result = await refreshMonthlyCredits(7, 75_000, identity, "stripe-invoice:in_p15_4");

    expect(result.newBalance).toBe(75_000 + 35_000);
  });

  it("⚠ THE CARRIED BALANCE IS NOT QUANTISED — #1604 slice 2's exclusion, driven", async () => {
    /*
      Slice 2 rounds every rollover and proration share DOWN to a multiple of 5
      so no granted credit is invisible on screen. This row is the case that
      must NOT be rounded: on an interval switch `webhooks.ts` passes
      `(balance) => balance`, and the balance is money the customer already
      holds, not a share being computed for them.

      34,999 is deliberately not a multiple of 5. Quantising the carry — which
      is exactly what moving the quantiser to `refreshMonthlyCredits`'s
      chokepoint would do, and it is the tempting simplification — would hand
      back 34,995 and take four credits off a paying customer for nothing.

      So this arm reddens if a later change "tidies" the three call sites into
      one. That is its whole job.
    */
    rows.push({ balance: 34_999, purchasedBalance: 0 });
    updateAnswers = [1];

    const result = await refreshMonthlyCredits(7, 75_000, identity, "stripe-invoice:in_p15_4b");

    expect(result.newBalance).toBe(75_000 + 34_999);
    expect(updateSets[0].rolloverCredits).toBe(34_999);
  });

  it("⚠ A ROW WITH NO PURCHASED CREDITS IS UNTOUCHED — every live account today", async () => {
    /*
      The top-up product was removed in February and no road into
      `addTopupCredits` exists, so every row in production holds 0 here. This
      is the arm that says the change is inert for all of them.
    */
    rows.push({ balance: 9_600, purchasedBalance: 0 });
    updateAnswers = [1];

    const result = await refreshMonthlyCredits(7, 5_000, half, "stripe-invoice:in_p15_5");

    expect(result.newBalance).toBe(5_000 + 4_800);
    expect(updateSets[0].purchasedBalance).toBe(0);
  });

  it("⚠ the split is recomputed from the MOVED row when a write lands mid-refresh", async () => {
    /*
      The #664 race, now carrying a second number. Attempt 1 is conditioned on
      35,000 and misses; attempt 2 re-reads a row where a spend took the
      balance to 20,000 — so 20,000 is protected, the allowance is 0, and the
      protection cannot be computed from the stale read.
    */
    rows.push(
      { balance: 35_000, purchasedBalance: 25_000 },
      { balance: 20_000, purchasedBalance: 25_000 },
    );
    updateAnswers = [0, 1];

    const result = await refreshMonthlyCredits(7, 75_000, half, "stripe-invoice:in_p15_6");

    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(75_000 + 0 + 20_000);
    expect(updateSets).toHaveLength(2);
    expect(updateSets[1].purchasedBalance).toBe(20_000);
    expect(insertedRows).toHaveLength(1);
  });

  it("three misses still fail LOUD with purchased credits on the row", async () => {
    rows.push(
      { balance: 35_000, purchasedBalance: 25_000 },
      { balance: 34_000, purchasedBalance: 25_000 },
      { balance: 33_000, purchasedBalance: 25_000 },
      { balance: 32_000, purchasedBalance: 25_000 },
    );
    updateAnswers = [0, 0, 0];

    const result = await refreshMonthlyCredits(7, 75_000, half, "stripe-invoice:in_p15_7");

    expect(result.success).toBe(false);
    expect(result.error).toContain("retry");
    expect(insertedRows).toHaveLength(0);
  });

  it("the caller's rule only ever sees the plan's part", async () => {
    rows.push({ balance: 35_000, purchasedBalance: 25_000 });
    updateAnswers = [1];
    const seen: number[] = [];

    await refreshMonthlyCredits(
      7,
      75_000,
      (b) => {
        seen.push(b);
        return half(b);
      },
      "stripe-invoice:in_p15_8",
    );

    expect(seen).toEqual([10_000]);
  });

  it("a rule that answers negative cannot pull the balance below the protected amount", async () => {
    rows.push({ balance: 35_000, purchasedBalance: 25_000 });
    updateAnswers = [1];
    const result = await refreshMonthlyCredits(7, 75_000, () => -50_000, "stripe-invoice:in_p15_9");
    expect(result.newBalance).toBe(75_000 + 0 + 25_000);
  });

  it("⚠ TOP-UPS NEVER COUNT TOWARD THE ONE-MONTH CAP (#2152) — the real rule, a full bank, and bought credits beside it", async () => {
    /* A Pro Plus customer with three months of unspent plan credits AND 25,000
       bought ones. The real rollover rule caps the PLAN's part at one month;
       the bought credits are added back whole, outside the cap. */
    const month = PLAN_TIERS.studio.monthlyCredits;
    rows.push({ balance: 3 * month + 25_000, purchasedBalance: 25_000 });
    updateAnswers = [1];
    const result = await refreshMonthlyCredits(
      7,
      month,
      (b) => calculateRolloverCredits(b, "studio", month),
      "stripe-invoice:in_2152_cap",
    );
    expect(result.newBalance).toBe(month + month + 25_000);
    expect(updateSets[0]).toMatchObject({ rolloverCredits: month, purchasedBalance: 25_000 });
  });
});
