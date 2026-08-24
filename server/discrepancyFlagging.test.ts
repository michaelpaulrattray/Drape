/**
 * Tests for the credit discrepancy flagging logic.
 *
 * These tests verify the pure computation that determines which users
 * have discrepancies above a given threshold, without hitting the DB.
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
 */
import {
  attachUserInfoToFlagged,
  computeFlaggedDiscrepancies,
  type FlaggedUserDiscrepancy,
} from "./db/discrepancyQueries";

/** The production pair, composed the way `getUsersWithDiscrepancies` composes them. */
function computeDiscrepancies(
  creditAgg: Parameters<typeof computeFlaggedDiscrepancies>[0],
  genAgg: Parameters<typeof computeFlaggedDiscrepancies>[1],
  userInfo: Array<{ id: number; name: string | null; email: string | null }>,
  threshold: number,
): { users: FlaggedUserDiscrepancy[]; scannedCount: number } {
  const { flagged, scannedCount } = computeFlaggedDiscrepancies(creditAgg, genAgg, threshold);
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
      { userId: 1, completedCost: 400, pendingCost: 0, totalGenerations: 10, failedGenerations: 0 },
      { userId: 2, completedCost: 200, pendingCost: 0, totalGenerations: 5, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, users, 50);

    expect(result.users).toHaveLength(1);
    expect(result.users[0].userId).toBe(1);
    expect(result.users[0].discrepancy).toBe(100);
    expect(result.scannedCount).toBe(2);
  });

  it("should return empty when no discrepancies exceed threshold", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 100, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, totalGenerations: 5, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, users, 50);

    expect(result.users).toHaveLength(0);
    expect(result.scannedCount).toBe(1);
  });

  it("should account for refunds when computing net cost", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 500, totalRefunds: 200 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 300, pendingCost: 0, totalGenerations: 10, failedGenerations: 2 },
    ];

    const result = computeDiscrepancies(credits, gens, users, 50);

    // netCost = 500 - 200 = 300, completedCost = 300, discrepancy = 0
    expect(result.users).toHaveLength(0);
  });

  it("should account for pending costs", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 500, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 400, pendingCost: 100, totalGenerations: 12, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, users, 50);

    // netCost = 500, completedCost + pendingCost = 500, discrepancy = 0
    expect(result.users).toHaveLength(0);
  });

  it("should sort results by absolute discrepancy descending", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 200, totalRefunds: 0 },
      { userId: 2, grossDeductions: 500, totalRefunds: 0 },
      { userId: 3, grossDeductions: 350, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, totalGenerations: 5, failedGenerations: 0 },
      { userId: 2, completedCost: 200, pendingCost: 0, totalGenerations: 10, failedGenerations: 0 },
      { userId: 3, completedCost: 200, pendingCost: 0, totalGenerations: 8, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, users, 50);

    expect(result.users).toHaveLength(3);
    expect(result.users[0].userId).toBe(2); // 300 discrepancy
    expect(result.users[1].userId).toBe(3); // 150 discrepancy
    expect(result.users[2].userId).toBe(1); // 100 discrepancy
  });

  it("should handle users with only credit transactions (no generations)", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 100, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [];

    const result = computeDiscrepancies(credits, gens, users, 50);

    expect(result.users).toHaveLength(1);
    expect(result.users[0].discrepancy).toBe(100);
    expect(result.users[0].totalGenerations).toBe(0);
  });

  it("should handle users with only generations (no credit transactions)", () => {
    const credits: CreditAgg[] = [];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, totalGenerations: 5, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, users, 50);

    // netCost = 0, completedCost = 100, discrepancy = -100
    expect(result.users).toHaveLength(1);
    expect(result.users[0].discrepancy).toBe(-100);
  });

  it("should flag negative discrepancies (more generation cost than deductions)", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 50, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 200, pendingCost: 0, totalGenerations: 10, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, users, 50);

    expect(result.users).toHaveLength(1);
    expect(result.users[0].discrepancy).toBe(-150);
  });

  it("should respect different threshold values", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 130, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, totalGenerations: 5, failedGenerations: 0 },
    ];

    // Discrepancy = 30
    expect(computeDiscrepancies(credits, gens, users, 25).users).toHaveLength(1);
    expect(computeDiscrepancies(credits, gens, users, 30).users).toHaveLength(1);
    expect(computeDiscrepancies(credits, gens, users, 31).users).toHaveLength(0);
    expect(computeDiscrepancies(credits, gens, users, 100).users).toHaveLength(0);
  });

  it("should include user info for flagged users", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 200, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 100, pendingCost: 0, totalGenerations: 5, failedGenerations: 1 },
    ];

    const result = computeDiscrepancies(credits, gens, users, 50);

    expect(result.users[0].userName).toBe("Alice");
    expect(result.users[0].email).toBe("alice@test.com");
    expect(result.users[0].failedGenerations).toBe(1);
  });

  it("should handle unknown users gracefully (null name/email)", () => {
    const credits: CreditAgg[] = [
      { userId: 4, grossDeductions: 200, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 4, completedCost: 100, pendingCost: 0, totalGenerations: 5, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, users, 50);

    expect(result.users[0].userName).toBeNull();
    expect(result.users[0].email).toBeNull();
  });

  it("should handle user not found in user info", () => {
    const credits: CreditAgg[] = [
      { userId: 999, grossDeductions: 200, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 999, completedCost: 100, pendingCost: 0, totalGenerations: 5, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, users, 50);

    expect(result.users[0].userId).toBe(999);
    expect(result.users[0].userName).toBeNull();
    expect(result.users[0].email).toBeNull();
  });

  it("should clamp negative refunds to zero", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 100, totalRefunds: -50 },
    ];
    const gens: GenAgg[] = [
      { userId: 1, completedCost: 50, pendingCost: 0, totalGenerations: 3, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, users, 50);

    // totalRefunds clamped to 0, netCost = 100, discrepancy = 50
    expect(result.users).toHaveLength(1);
    expect(result.users[0].netCost).toBe(100);
    expect(result.users[0].discrepancy).toBe(50);
  });

  it("should count scanned users correctly across both tables", () => {
    const credits: CreditAgg[] = [
      { userId: 1, grossDeductions: 10, totalRefunds: 0 },
      { userId: 2, grossDeductions: 10, totalRefunds: 0 },
    ];
    const gens: GenAgg[] = [
      { userId: 2, completedCost: 10, pendingCost: 0, totalGenerations: 1, failedGenerations: 0 },
      { userId: 3, completedCost: 10, pendingCost: 0, totalGenerations: 1, failedGenerations: 0 },
    ];

    const result = computeDiscrepancies(credits, gens, users, 1000);

    // Users 1, 2, 3 are scanned (deduplicated)
    expect(result.scannedCount).toBe(3);
  });

  it("should handle empty inputs", () => {
    const result = computeDiscrepancies([], [], users, 50);

    expect(result.users).toHaveLength(0);
    expect(result.scannedCount).toBe(0);
  });
});
