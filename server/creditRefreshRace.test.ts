/**
 * THE REFRESH CANNOT ERASE A CONCURRENT WRITE (#664 review round 2, finding 1).
 *
 * `refreshMonthlyCredits` used to SET the balance absolutely from a rollover
 * its caller computed off an earlier read — so a write landing in between
 * (the plan-change unwind; equally, an ordinary spend during a renewal) was
 * silently erased, and the erased unwind reopened the credit-minting loop.
 *
 * Now the rollover is computed from the balance the UPDATE is conditioned on
 * (`WHERE balance = <that read>`), a miss re-reads and retries, and three
 * misses fail loud so the Stripe event is redelivered. These arms drive the
 * loop directly with a transaction double whose UPDATE reports configurable
 * affectedRows — the race itself, not a sleep-and-hope reproduction.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const balances: number[] = [];
let balanceReads = 0;

vi.mock("./db/credits", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getUserCredits: vi.fn().mockImplementation(async () => ({
    balance: balances[Math.min(balanceReads++, balances.length - 1)],
  })),
}));

/** Each entry answers one attempt's UPDATE with its affectedRows. */
let updateAnswers: number[] = [];
const updateWheres: unknown[] = [];
const insertedRows: Array<Record<string, unknown>> = [];
const updateSets: Array<Record<string, unknown>> = [];

const txDouble = {
  update: () => ({
    set: (values: Record<string, unknown>) => ({
      where: async (condition: unknown) => {
        updateSets.push(values);
        updateWheres.push(condition);
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

beforeEach(() => {
  balances.length = 0;
  balanceReads = 0;
  updateAnswers = [];
  updateWheres.length = 0;
  updateSets.length = 0;
  insertedRows.length = 0;
});

describe("the compare-and-set refresh", () => {
  it("computes the rollover from the balance it writes against, and writes once when nothing races", async () => {
    balances.push(9_600);
    updateAnswers = [1];
    const result = await refreshMonthlyCredits(7, 5_000, (b) => b, "stripe-invoice:in_cas_1");
    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(5_000 + 9_600);
    expect(updateSets).toHaveLength(1);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].balanceAfter).toBe(14_600);
  });

  it("⚠ a write landing mid-refresh makes the UPDATE miss — the retry recomputes from the MOVED balance instead of erasing the move", async () => {
    /*
      The review's scenario: the webhook read 9,600; the plan-change unwind
      deducted down to 26 before the SET landed. The old code wrote
      grant + 9,600 and the unwind was gone. Now: attempt 1 misses (0 rows),
      attempt 2 reads 26 and the rollover is computed from 26.
    */
    balances.push(9_600, 26);
    updateAnswers = [0, 1];
    const result = await refreshMonthlyCredits(7, 5_000, (b) => b, "stripe-invoice:in_cas_2");
    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(5_000 + 26);
    /* Two attempts, two reads, and no ledger row for the missed write. */
    expect(updateSets).toHaveLength(2);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].balanceAfter).toBe(5_026);
  });

  it("⚠ three misses fail LOUD — a redelivered event beats a silently wrong balance", async () => {
    balances.push(100, 200, 300, 400);
    updateAnswers = [0, 0, 0];
    const result = await refreshMonthlyCredits(7, 5_000, (b) => b, "stripe-invoice:in_cas_3");
    expect(result.success).toBe(false);
    expect(result.error).toContain("retry");
    expect(insertedRows).toHaveLength(0);
  });

  it("the rollover rule is the caller's — a percentage rule sees the same conditioned balance", async () => {
    balances.push(1_000);
    updateAnswers = [1];
    const seen: number[] = [];
    const result = await refreshMonthlyCredits(
      7,
      5_000,
      (b) => {
        seen.push(b);
        return Math.floor(b * 0.2);
      },
      "stripe-invoice:in_cas_4",
    );
    expect(result.success).toBe(true);
    expect(seen).toEqual([1_000]);
    expect(result.newBalance).toBe(5_000 + 200);
  });
});
