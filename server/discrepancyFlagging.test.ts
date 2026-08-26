/**
 * Tests for the credit discrepancy flagging logic.
 *
 * These tests verify the pure computation that determines which users
 * have discrepancies above a given threshold, without hitting the DB.
 *
 * ⚠ THE RULE THESE ARMS TEST CHANGED ON 2026-08-26 (#119), after the scan
 * froze the founder's own account for 22 hours on a number that was two
 * rulings out of date. Read the header of `server/db/discrepancyQueries.ts`
 * for the whole reading; the two facts every fixture below is built on are:
 *
 *   expectedCost = unlinkedCost + operationCost   (a charge is explained by
 *                                                  the record that recorded it)
 *   discrepancy  = grossDeductions − expectedCost
 *
 * So REFUNDS no longer move the discrepancy (they move `netCost` only), and a
 * FAILED row is not a discrepancy — failures refund only catastrophically by
 * founder ruling, so an unrefunded failure is the ruled outcome and is
 * reported as `unrefundedFailureCost` rather than flagged.
 */

import { describe, it, expect } from "vitest";

/*
 * ⚠ SIXTY LINES OF `discrepancyQueries.ts` USED TO BE RE-TYPED HERE, under a
 * heading that said so: "Mirror the core computation logic from
 * discrepancyQueries.ts". Every arm below tested that copy — the netCost
 * subtraction, the `Math.max(0, …)` floor on refunds, the `>=` threshold and
 * the abs-descending sort — so the CREDIT DISCREPANCY ARITHMETIC could have
 * been changed in the product with this file green about it.
 *
 * The copy was faithful when it was read (2026-08-25) and that is luck rather
 * than a property: a mirror is not caught being wrong, it makes the catching
 * assertion unwritable. `computeFlaggedDiscrepancies` and
 * `attachUserInfoToFlagged` are now named exports of the production module
 * with `getUsersWithDiscrepancies` as their first reader, and the arms drive
 * those. Filed under 3g's A. Working law 4: derive, never mirror.
 *
 * The formula change of #119 is exactly why that matters: fifteen arms below
 * went RED on it, which is the whole point of not owning a copy.
 */
import {
  attachUserInfoToFlagged,
  computeDiscrepancy,
  computeFlaggedDiscrepancies,
  type DiscrepancyCreditAgg,
  type DiscrepancyGenAgg,
  type DiscrepancyOperationAgg,
  type FlaggedUserDiscrepancy,
} from "./db/discrepancyQueries";

type CreditAgg = DiscrepancyCreditAgg;
type GenAgg = DiscrepancyGenAgg;
type OpAgg = DiscrepancyOperationAgg;

/** The production trio, composed the way `getUsersWithDiscrepancies` composes them. */
function computeDiscrepancies(
  creditAgg: CreditAgg[],
  genAgg: GenAgg[],
  operationAgg: OpAgg[],
  userInfo: Array<{ id: number; name: string | null; email: string | null }>,
  threshold: number,
): { users: FlaggedUserDiscrepancy[]; scannedCount: number } {
  const { flagged, scannedCount } = computeFlaggedDiscrepancies(
    creditAgg,
    genAgg,
    operationAgg,
    threshold,
  );
  return { users: attachUserInfoToFlagged(flagged, userInfo), scannedCount };
}

// ── Tests ──

describe("Credit Discrepancy Flagging", () => {
  const users = [
    { id: 1, name: "Alice", email: "alice@test.com" },
    { id: 2, name: "Bob", email: "bob@test.com" },
    { id: 3, name: "Charlie", email: "charlie@test.com" },
    { id: 4, name: null, email: null },
  ];

  it("should flag users with discrepancy above threshold", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 500, totalRefunds: 0 },
      { userId: 2, grossDeductions: 200, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 400, pendingCost: 0, failedCost: 0, unlinkedCost: 400, totalGenerations: 10, failedGenerations: 0 },
      { userId: 2, completedCost: 200, pendingCost: 0, failedCost: 0, unlinkedCost: 200, totalGenerations: 5, failedGenerations: 0 },
    ];
    const ops: OpAgg[] = [];

    const result = computeDiscrepancies(credits, gens, ops, users, 50);

    // User 1: 500 charged, 400 recorded → +100. User 2: 200 against 200 → 0.
    expect(result.users).toHaveLength(1);
    expect(result.users[0].userId).toBe(1);
    expect(result.users[0].discrepancy).toBe(100);
    expect(result.users[0].expectedCost).toBe(400);
    expect(result.scannedCount).toBe(2);
  });

  it("should return empty when no discrepancies exceed threshold", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 100, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, failedCost: 0, unlinkedCost: 100, totalGenerations: 5, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, [], users, 50);

    expect(result.users).toHaveLength(0);
    expect(result.scannedCount).toBe(1);
  });

  it("refunds change netCost but NOT the discrepancy", () => {
    // This arm used to be "should account for refunds when computing net cost",
    // and it asserted that a 200-credit refund closed a 200-credit gap. It no
    // longer does: a refund is written by the product or by staff, and a
    // correction of DELIVERED work is unbounded by anything a record holds, so
    // a refund-side term was a false-positive generator (#119 header).
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 500, totalRefunds: 200 },
    ];

    // (i) records explain the whole charge → no discrepancy, netCost still moves.
    const aligned = computeDiscrepancies(
      credits,
      [{ userId: 1, completedCost: 500, pendingCost: 0, failedCost: 0, unlinkedCost: 500, totalGenerations: 10, failedGenerations: 2 }],
      [],
      users,
      1,
    );
    expect(aligned.users).toHaveLength(0);
    const alignedReading = computeDiscrepancy({
      grossDeductions: 500, totalRefunds: 200, completedCost: 500, pendingCost: 0,
      failedCost: 0, unlinkedCost: 500, operationCost: 0,
    });
    expect(alignedReading.netCost).toBe(300);
    expect(alignedReading.discrepancy).toBe(0);

    // (ii) 300 recorded against 500 charged. The OLD formula read
    //      (500 − 200) − 300 = 0 and said nothing. The rule reads +200.
    const gap = computeDiscrepancies(
      credits,
      [{ userId: 1, completedCost: 300, pendingCost: 0, failedCost: 0, unlinkedCost: 300, totalGenerations: 10, failedGenerations: 2 }],
      [],
      users,
      50,
    );
    expect(gap.users).toHaveLength(1);
    expect(gap.users[0].discrepancy).toBe(200);
    expect(gap.users[0].netCost).toBe(300);
  });

  it("pending cost is reported, and counts as a record only through unlinkedCost", () => {
    // Previously "should account for pending costs", where `pendingCost` was a
    // term of the formula. It is not one now — a pending row's cost reaches the
    // record side the same way any other row's does, by being unlinked (or by
    // belonging to an operation). `pendingCost` is carried for the reader.
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 500, totalRefunds: 0 },
    ];

    const counted = computeDiscrepancies(
      credits,
      [{ userId: 1, completedCost: 400, pendingCost: 100, failedCost: 0, unlinkedCost: 500, totalGenerations: 12, failedGenerations: 0 }],
      [],
      users,
      1,
    );
    expect(counted.users).toHaveLength(0);

    // The same rows with the pending one still unrecorded: 500 charged, 400 recorded.
    const notYetRecorded = computeDiscrepancies(
      credits,
      [{ userId: 1, completedCost: 400, pendingCost: 100, failedCost: 0, unlinkedCost: 400, totalGenerations: 12, failedGenerations: 0 }],
      [],
      users,
      50,
    );
    expect(notYetRecorded.users).toHaveLength(1);
    expect(notYetRecorded.users[0].discrepancy).toBe(100);
    expect(notYetRecorded.users[0].pendingCost).toBe(100);
  });

  it("should sort results by absolute discrepancy descending", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 200, totalRefunds: 0 },
      { userId: 2, grossDeductions: 500, totalRefunds: 0 },
      { userId: 3, grossDeductions: 350, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, failedCost: 0, unlinkedCost: 100, totalGenerations: 5, failedGenerations: 0 },
      { userId: 2, completedCost: 200, pendingCost: 0, failedCost: 0, unlinkedCost: 200, totalGenerations: 10, failedGenerations: 0 },
      { userId: 3, completedCost: 200, pendingCost: 0, failedCost: 0, unlinkedCost: 200, totalGenerations: 8, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, [], users, 50);

    expect(result.users).toHaveLength(3);
    expect(result.users[0].userId).toBe(2); // 300 discrepancy
    expect(result.users[1].userId).toBe(3); // 150 discrepancy
    expect(result.users[2].userId).toBe(1); // 100 discrepancy
  });

  it("should handle users with only credit transactions (no records at all)", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 100, totalRefunds: 0 },
    ];

    const result = computeDiscrepancies(credits, [], [], users, 50);

    expect(result.users).toHaveLength(1);
    expect(result.users[0].discrepancy).toBe(100);
    expect(result.users[0].expectedCost).toBe(0);
    expect(result.users[0].totalGenerations).toBe(0);
  });

  it("should handle users with only generations (no credit transactions)", () => {
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, failedCost: 0, unlinkedCost: 100, totalGenerations: 5, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies([], gens, [], users, 50);

    // 0 charged, 100 recorded → -100
    expect(result.users).toHaveLength(1);
    expect(result.users[0].discrepancy).toBe(-100);
  });

  it("should flag negative discrepancies (more recorded cost than deductions)", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 50, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 200, pendingCost: 0, failedCost: 0, unlinkedCost: 200, totalGenerations: 10, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, [], users, 50);

    expect(result.users).toHaveLength(1);
    expect(result.users[0].discrepancy).toBe(-150);
  });

  it("should respect different threshold values", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 130, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, failedCost: 0, unlinkedCost: 100, totalGenerations: 5, failedGenerations: 0 },
    ];

    // Discrepancy = 30
    expect(computeDiscrepancies(credits, gens, [], users, 25).users).toHaveLength(1);
    expect(computeDiscrepancies(credits, gens, [], users, 30).users).toHaveLength(1);
    expect(computeDiscrepancies(credits, gens, [], users, 31).users).toHaveLength(0);
    expect(computeDiscrepancies(credits, gens, [], users, 100).users).toHaveLength(0);
  });

  it("should include user info for flagged users", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 200, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, failedCost: 0, unlinkedCost: 100, totalGenerations: 5, failedGenerations: 1 },
    ];

    const result = computeDiscrepancies(credits, gens, [], users, 50);

    expect(result.users[0].userName).toBe("Alice");
    expect(result.users[0].email).toBe("alice@test.com");
    expect(result.users[0].failedGenerations).toBe(1);
  });

  it("should handle unknown users gracefully (null name/email)", () => {
    const credits: CreditAgg[] = [
      { userId: 4, grossDeductions: 200, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 4, completedCost: 100, pendingCost: 0, failedCost: 0, unlinkedCost: 100, totalGenerations: 5, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, [], users, 50);

    expect(result.users[0].userName).toBeNull();
    expect(result.users[0].email).toBeNull();
  });

  it("should handle user not found in user info", () => {
    const credits: CreditAgg[] = [
      { userId: 999, grossDeductions: 200, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 999, completedCost: 100, pendingCost: 0, failedCost: 0, unlinkedCost: 100, totalGenerations: 5, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, [], users, 50);

    expect(result.users[0].userId).toBe(999);
    expect(result.users[0].userName).toBeNull();
    expect(result.users[0].email).toBeNull();
  });

  it("should clamp negative refunds to zero (netCost only — the discrepancy never saw them)", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 100, totalRefunds: -50 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 50, pendingCost: 0, failedCost: 0, unlinkedCost: 50, totalGenerations: 3, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, [], users, 50);

    // totalRefunds clamped to 0, netCost = 100, discrepancy = 100 - 50 = 50
    expect(result.users).toHaveLength(1);
    expect(result.users[0].totalRefunds).toBe(0);
    expect(result.users[0].netCost).toBe(100);
    expect(result.users[0].discrepancy).toBe(50);
  });

  it("should count scanned users correctly across all three tables", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 10, totalRefunds: 0 },
      { userId: 2, grossDeductions: 10, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 2, completedCost: 10, pendingCost: 0, failedCost: 0, unlinkedCost: 10, totalGenerations: 1, failedGenerations: 0 },
      { userId: 3, completedCost: 10, pendingCost: 0, failedCost: 0, unlinkedCost: 10, totalGenerations: 1, failedGenerations: 0 },
    ];
    const ops: OpAgg[] = [{ userId: 3, operationCost: 10 }];

    const result = computeDiscrepancies(credits, gens, ops, users, 1000);

    // Users 1, 2, 3 are scanned (deduplicated across all three)
    expect(result.scannedCount).toBe(3);
  });

  it("should handle empty inputs", () => {
    const result = computeDiscrepancies([], [], [], users, 50);

    expect(result.users).toHaveLength(0);
    expect(result.scannedCount).toBe(0);
  });

  // ── The shapes production actually holds (#119) ──

  it("a REFINE: charged through its operation with no `generations` row is NOT a discrepancy", () => {
    // Casting V2 charges a refine 25 credits through `generation_operations`
    // and writes no `generations` row at all. On one production account that
    // was 221 refines, 5,525 credits — read by the OLD rows-only formula as
    // 5,525 credits of missing records, which is how the founder's own account
    // came to be frozen.
    const credits: CreditAgg[] = [{ userId: 1, grossDeductions: 25, totalRefunds: 0 }];
    const gens: GenAgg[] = [];
    const ops: OpAgg[] = [{ userId: 1, operationCost: 25 }];

    const reading = computeDiscrepancy({
      grossDeductions: 25, totalRefunds: 0, completedCost: 0, pendingCost: 0,
      failedCost: 0, unlinkedCost: 0, operationCost: 25,
    });
    expect(reading.expectedCost).toBe(25);
    expect(reading.discrepancy).toBe(0); // the OLD formula would have read 25

    // and it reaches no moderator's screen, even at the lowest threshold.
    expect(computeDiscrepancies(credits, gens, ops, users, 1).users).toHaveLength(0);
  });

  it("a SIGN: the operation's own 450 charge is the record, not its five 50-credit audit rows", () => {
    // A Sign charges 450 through its operation and writes five `generations`
    // rows at 50 each, all LINKED to that operation (so `unlinkedCost` is 0).
    // Counting the rows instead would read 450 − 250 = +200, and climb 200 per
    // Sign for ever — #119's own defect class, a premise that drifts with
    // ordinary use.
    const credits: CreditAgg[] = [{ userId: 1, grossDeductions: 450, totalRefunds: 0 }];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 250, pendingCost: 0, failedCost: 0, unlinkedCost: 0, totalGenerations: 5, failedGenerations: 0 },
    ];
    const ops: OpAgg[] = [{ userId: 1, operationCost: 450 }];

    const reading = computeDiscrepancy({
      grossDeductions: 450, totalRefunds: 0, completedCost: 250, pendingCost: 0,
      failedCost: 0, unlinkedCost: 0, operationCost: 450,
    });
    expect(reading.operationCost).toBe(450);
    expect(reading.expectedCost).toBe(450);
    expect(reading.discrepancy).toBe(0); // rows-only would read +200

    expect(computeDiscrepancies(credits, gens, ops, users, 1).users).toHaveLength(0);
  });

  it("an UNREFUNDED FAILURE is the ruled outcome, reported and never flagged", () => {
    // Failures refund only catastrophically (founder ruling, `5c5a1f3f`), so a
    // failed row's cost is an explained charge. Production held 10,730 credits
    // of failed rows against 9,750 refunded overall.
    const credits: CreditAgg[] = [{ userId: 1, grossDeductions: 350, totalRefunds: 0 }];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 0, pendingCost: 0, failedCost: 350, unlinkedCost: 350, totalGenerations: 1, failedGenerations: 1 },
    ];

    const reading = computeDiscrepancy({
      grossDeductions: 350, totalRefunds: 0, completedCost: 0, pendingCost: 0,
      failedCost: 350, unlinkedCost: 350, operationCost: 0,
    });
    expect(reading.discrepancy).toBe(0);
    expect(reading.failedCost).toBe(350);
    expect(reading.unrefundedFailureCost).toBe(350);

    expect(computeDiscrepancies(credits, gens, [], users, 1).users).toHaveLength(0);
  });

  it("a GENUINE discrepancy still flags, in both directions", () => {
    // The rule is narrower, not blind: money charged that no record explains
    // is still the thing this scan exists to surface.
    const over = computeDiscrepancies(
      [{ userId: 1, grossDeductions: 5000, totalRefunds: 0 }],
      [{ userId: 1, completedCost: 1000, pendingCost: 0, failedCost: 0, unlinkedCost: 1000, totalGenerations: 20, failedGenerations: 0 }],
      [{ userId: 1, operationCost: 1500 }],
      users,
      2000,
    );
    expect(over.users).toHaveLength(1);
    expect(over.users[0].expectedCost).toBe(2500);
    expect(over.users[0].discrepancy).toBe(2500);

    // and the other direction — records showing more than was ever charged.
    const under = computeDiscrepancies(
      [{ userId: 2, grossDeductions: 2500, totalRefunds: 0 }],
      [{ userId: 2, completedCost: 3500, pendingCost: 0, failedCost: 0, unlinkedCost: 3500, totalGenerations: 20, failedGenerations: 0 }],
      [{ userId: 2, operationCost: 1500 }],
      users,
      2000,
    );
    expect(under.users).toHaveLength(1);
    expect(under.users[0].expectedCost).toBe(5000);
    expect(under.users[0].discrepancy).toBe(-2500);
  });

  it("REFUND ANOMALY: refunds exceeding every generation charge flag the account whatever the threshold", () => {
    // The refund-lane bound (module header): the charge-side rule cannot see
    // a double-fired refund, so an account credited more than it was ever
    // charged is flagged on that fact alone. 1,000 charged, 1,200 refunded,
    // records 1,000 — discrepancy 0, and it is still listed.
    const credits: CreditAgg[] = [{ userId: 1, grossDeductions: 1000, totalRefunds: 1200 }];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 700, pendingCost: 0, failedCost: 300, unlinkedCost: 1000, totalGenerations: 4, failedGenerations: 1 },
    ];
    const result = computeDiscrepancies(credits, gens, [], users, 2000);
    expect(result.users).toHaveLength(1);
    expect(result.users[0].discrepancy).toBe(0);
    expect(result.users[0].refundAnomaly).toBe(true);

    // Negative control: refunds AT the charges is not an anomaly (a fully refunded account is ordinary).
    const even = computeDiscrepancies(
      [{ userId: 1, grossDeductions: 1000, totalRefunds: 1000 }], gens, [], users, 2000,
    );
    expect(even.users).toHaveLength(0);
  });

  it("scannedCount counts a user present ONLY in the operation aggregation", () => {
    // A Casting V2 refine account can have no `credit_transactions` row in the
    // window and no `generations` row at all. Before the operation
    // aggregation existed, such a user was not scanned — invisible rather
    // than clean.
    const ops: OpAgg[] = [{ userId: 7, operationCost: 25 }];

    const result = computeDiscrepancies([], [], ops, users, 1);

    expect(result.scannedCount).toBe(1);
    // 0 charged against 25 recorded → -25, flagged at threshold 1.
    expect(result.users).toHaveLength(1);
    expect(result.users[0].userId).toBe(7);
    expect(result.users[0].discrepancy).toBe(-25);
  });
});
