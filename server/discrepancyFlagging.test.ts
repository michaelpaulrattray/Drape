/**
 * Tests for the credit discrepancy flagging logic.
 *
 * These tests verify the pure computation that determines which users
 * have discrepancies above a given threshold, without hitting the DB.
 */

import { describe, it, expect } from "vitest";

// ── Mirror the core computation logic from discrepancyQueries.ts ──

interface FlaggedUserDiscrepancy {
  userId: number;
  userName: string | null;
  email: string | null;
  grossDeductions: number;
  totalRefunds: number;
  netCost: number;
  completedCost: number;
  pendingCost: number;
  discrepancy: number;
  totalGenerations: number;
  failedGenerations: number;
}

interface CreditAgg {
  userId: number;
  grossDeductions: number;
  totalRefunds: number;
}

interface GenAgg {
  userId: number;
  completedCost: number;
  pendingCost: number;
  totalGenerations: number;
  failedGenerations: number;
}

function computeDiscrepancies(
  creditAgg: CreditAgg[],
  genAgg: GenAgg[],
  userInfo: Array<{ id: number; name: string | null; email: string | null }>,
  threshold: number
): { users: FlaggedUserDiscrepancy[]; scannedCount: number } {
  const creditMap = new Map(creditAgg.map((r) => [r.userId, r]));
  const genMap = new Map(genAgg.map((r) => [r.userId, r]));
  const allUserIds = Array.from(
    new Set([...Array.from(creditMap.keys()), ...Array.from(genMap.keys())])
  );

  const flagged: Array<{
    userId: number;
    data: Omit<FlaggedUserDiscrepancy, "userId" | "userName" | "email">;
  }> = [];

  for (const uid of allUserIds) {
    const credit = creditMap.get(uid);
    const gen = genMap.get(uid);

    const grossDeductions = Number(credit?.grossDeductions ?? 0);
    const totalRefunds = Math.max(0, Number(credit?.totalRefunds ?? 0));
    const netCost = grossDeductions - totalRefunds;
    const completedCost = Number(gen?.completedCost ?? 0);
    const pendingCost = Number(gen?.pendingCost ?? 0);
    const discrepancy = netCost - completedCost - pendingCost;

    if (Math.abs(discrepancy) >= threshold) {
      flagged.push({
        userId: uid,
        data: {
          grossDeductions,
          totalRefunds,
          netCost,
          completedCost,
          pendingCost,
          discrepancy,
          totalGenerations: Number(gen?.totalGenerations ?? 0),
          failedGenerations: Number(gen?.failedGenerations ?? 0),
        },
      });
    }
  }

  const userMap = new Map(userInfo.map((u) => [u.id, u]));

  const result: FlaggedUserDiscrepancy[] = flagged
    .map((f) => {
      const u = userMap.get(f.userId);
      return {
        userId: f.userId,
        userName: u?.name ?? null,
        email: u?.email ?? null,
        ...f.data,
      };
    })
    .sort((a, b) => Math.abs(b.discrepancy) - Math.abs(a.discrepancy));

  return { users: result, scannedCount: allUserIds.length };
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
