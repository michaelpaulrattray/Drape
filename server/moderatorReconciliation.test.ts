/**
 * Tests for the moderator credit reconciliation logic.
 *
 * These tests validate the reconciliation computation that compares
 * credit transactions against generation records to detect discrepancies.
 */

// Mock moderatorQueries
vi.mock("./db/moderatorQueries", () => ({
  getDetailedCreditHistory: vi.fn(),
  getDetailedGenerationHistory: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Helper: build mock credit data ──

function buildCreditData(transactions: Array<{ amount: number; type: string }>) {
  return {
    transactions: transactions.map((t, i) => ({
      id: i + 1,
      amount: t.amount,
      type: t.type,
      description: null,
      referenceId: null,
      balanceAfter: 0,
      engineUsed: null,
      createdAt: new Date("2026-01-15"),
    })),
    total: transactions.length,
    // Summary is intentionally wrong — reconciliation should NOT use it
    summary: {
      totalCreditsEarned: 999999,
      totalCreditsSpent: 888888,
      netChange: 111111,
      transactionsByType: {},
    },
  };
}

function buildGenData(
  gens: Array<{ status: string; type: string; pointsCost: number }>
) {
  return {
    generations: gens.map((g, i) => ({
      id: i + 1,
      modelId: 1,
      type: g.type,
      status: g.status,
      pointsCost: g.pointsCost,
      resultUrl: g.status === "completed" ? "https://example.com/img.png" : null,
      errorMessage: g.status === "failed" ? "Generation failed" : null,
      metadata: null,
      createdAt: new Date("2026-01-15"),
      completedAt: g.status === "completed" ? new Date("2026-01-15") : null,
      modelName: "Test Model",
    })),
    total: gens.length,
    // Summary is intentionally wrong — reconciliation should NOT use it
    summary: {
      totalGenerations: 777777,
      completedCount: 666666,
      failedCount: 555555,
      pendingCount: 444444,
      totalCreditsUsed: 333333,
      generationsByType: {},
      failureRate: 99.99,
    },
  };
}

// ── Reconciliation logic (extracted from router for direct testing) ──

function computeReconciliation(
  creditData: ReturnType<typeof buildCreditData>,
  genData: ReturnType<typeof buildGenData>
) {
  let totalCreditsEarned = 0;
  let totalCreditsSpent = 0;
  const creditsByType: Record<string, { count: number; totalAmount: number }> = {};

  for (const txn of creditData.transactions) {
    if (txn.amount > 0) totalCreditsEarned += txn.amount;
    else totalCreditsSpent += Math.abs(txn.amount);

    if (!creditsByType[txn.type]) {
      creditsByType[txn.type] = { count: 0, totalAmount: 0 };
    }
    creditsByType[txn.type].count++;
    creditsByType[txn.type].totalAmount += txn.amount;
  }

  let completedCount = 0;
  let failedCount = 0;
  let pendingCount = 0;
  let totalGenCreditsUsed = 0;
  let creditsOnFailed = 0;
  let creditsOnCompleted = 0;
  let creditsOnPending = 0;
  const gensByType: Record<string, { count: number; totalCost: number }> = {};

  for (const gen of genData.generations) {
    totalGenCreditsUsed += gen.pointsCost;
    if (gen.status === "completed") {
      completedCount++;
      creditsOnCompleted += gen.pointsCost;
    } else if (gen.status === "failed") {
      failedCount++;
      creditsOnFailed += gen.pointsCost;
    } else {
      pendingCount++;
      creditsOnPending += gen.pointsCost;
    }
    const t = gen.type;
    if (!gensByType[t]) gensByType[t] = { count: 0, totalCost: 0 };
    gensByType[t].count++;
    gensByType[t].totalCost += gen.pointsCost;
  }

  const totalGenerations = genData.generations.length;
  const failureRate =
    totalGenerations > 0
      ? Math.round((failedCount / totalGenerations) * 10000) / 100
      : 0;

  const generationCreditTxn = creditsByType["generation"] || { count: 0, totalAmount: 0 };
  const creditDeductedForGenerations = Math.abs(generationCreditTxn.totalAmount);
  const discrepancy = creditDeductedForGenerations - totalGenCreditsUsed;
  const hasDiscrepancy = Math.abs(discrepancy) > 0;

  return {
    credits: {
      totalEarned: totalCreditsEarned,
      totalSpent: totalCreditsSpent,
      byType: creditsByType,
      generationDeductions: creditDeductedForGenerations,
    },
    generations: {
      total: totalGenerations,
      completed: completedCount,
      failed: failedCount,
      pending: pendingCount,
      totalCreditsUsed: totalGenCreditsUsed,
      creditsOnFailed,
      creditsOnCompleted,
      creditsOnPending,
      failureRate,
      byType: Object.entries(gensByType).map(([type, data]) => ({
        type,
        totalCount: data.count,
        totalCost: data.totalCost,
      })),
    },
    reconciliation: {
      creditDeductedForGenerations,
      generationRecordedCost: totalGenCreditsUsed,
      discrepancy,
      hasDiscrepancy,
      creditsLostToFailures: creditsOnFailed,
      summary: hasDiscrepancy
        ? `Discrepancy of ${Math.abs(discrepancy).toLocaleString()} credits detected between credit transactions and generation records.`
        : creditsOnFailed > 0
          ? `No discrepancy found, but ${creditsOnFailed.toLocaleString()} credits were spent on ${failedCount} failed generation(s).`
          : "No discrepancies found. All credits align with generation records.",
    },
  };
}

// ── Tests ──

describe("Credit Reconciliation Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Perfect alignment — no discrepancy", () => {
    it("should report no discrepancy when credits match generations", () => {
      const credits = buildCreditData([
        { amount: 5000, type: "subscription" },
        { amount: -350, type: "generation" },
        { amount: -300, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "completed", type: "fullBody", pointsCost: 300 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.reconciliation.hasDiscrepancy).toBe(false);
      expect(result.reconciliation.discrepancy).toBe(0);
      expect(result.reconciliation.creditDeductedForGenerations).toBe(650);
      expect(result.reconciliation.generationRecordedCost).toBe(650);
      expect(result.reconciliation.summary).toContain("No discrepancies found");
    });

    it("should compute correct credit totals from filtered rows", () => {
      const credits = buildCreditData([
        { amount: 5000, type: "subscription" },
        { amount: 12500, type: "referral" },
        { amount: -350, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      // Should compute from rows, NOT from the fake summary values
      expect(result.credits.totalEarned).toBe(17500);
      expect(result.credits.totalSpent).toBe(350);
      expect(result.credits.generationDeductions).toBe(350);
    });
  });

  describe("Discrepancy detection", () => {
    it("should detect discrepancy when credits > generation costs", () => {
      const credits = buildCreditData([
        { amount: -700, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.reconciliation.hasDiscrepancy).toBe(true);
      expect(result.reconciliation.discrepancy).toBe(350); // 700 - 350
      expect(result.reconciliation.summary).toContain("Discrepancy");
    });

    it("should detect discrepancy when generation costs > credits", () => {
      const credits = buildCreditData([
        { amount: -350, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "completed", type: "fullBody", pointsCost: 300 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.reconciliation.hasDiscrepancy).toBe(true);
      expect(result.reconciliation.discrepancy).toBe(-300); // 350 - 650
    });
  });

  describe("Failed generations", () => {
    it("should track credits lost to failed generations", () => {
      const credits = buildCreditData([
        { amount: -350, type: "generation" },
        { amount: -300, type: "generation" },
        { amount: -350, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "fullBody", pointsCost: 300 },
        { status: "failed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.generations.creditsOnFailed).toBe(650);
      expect(result.generations.creditsOnCompleted).toBe(350);
      expect(result.generations.failed).toBe(2);
      expect(result.generations.completed).toBe(1);
      expect(result.reconciliation.creditsLostToFailures).toBe(650);
    });

    it("should report failed generations in summary when no discrepancy", () => {
      const credits = buildCreditData([
        { amount: -650, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "fullBody", pointsCost: 300 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.reconciliation.hasDiscrepancy).toBe(false);
      expect(result.reconciliation.summary).toContain("300");
      expect(result.reconciliation.summary).toContain("failed generation");
    });
  });

  describe("Pending generations", () => {
    it("should track credits on pending generations separately", () => {
      const credits = buildCreditData([
        { amount: -1000, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "pending", type: "fullBody", pointsCost: 300 },
        { status: "pending", type: "castingImage", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.generations.creditsOnPending).toBe(650);
      expect(result.generations.pending).toBe(2);
    });
  });

  describe("Generation type breakdown", () => {
    it("should group generations by type with correct counts and costs", () => {
      const credits = buildCreditData([
        { amount: -2050, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "completed", type: "fullBody", pointsCost: 300 },
        { status: "completed", type: "upscale", pointsCost: 300 },
        { status: "failed", type: "castingImage", pointsCost: 350 },
        { status: "completed", type: "iteration", pointsCost: 400 },
      ]);

      const result = computeReconciliation(credits, gens);

      const castingType = result.generations.byType.find(t => t.type === "castingImage");
      expect(castingType).toBeDefined();
      expect(castingType!.totalCount).toBe(3);
      expect(castingType!.totalCost).toBe(1050);

      const fullBodyType = result.generations.byType.find(t => t.type === "fullBody");
      expect(fullBodyType).toBeDefined();
      expect(fullBodyType!.totalCount).toBe(1);
      expect(fullBodyType!.totalCost).toBe(300);
    });
  });

  describe("Credit type breakdown", () => {
    it("should group credit transactions by type", () => {
      const credits = buildCreditData([
        { amount: 5000, type: "subscription" },
        { amount: 12500, type: "referral" },
        { amount: -350, type: "generation" },
        { amount: -300, type: "generation" },
        { amount: 50, type: "refund" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "completed", type: "fullBody", pointsCost: 300 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.credits.byType["subscription"]).toEqual({ count: 1, totalAmount: 5000 });
      expect(result.credits.byType["referral"]).toEqual({ count: 1, totalAmount: 12500 });
      expect(result.credits.byType["generation"]).toEqual({ count: 2, totalAmount: -650 });
      expect(result.credits.byType["refund"]).toEqual({ count: 1, totalAmount: 50 });
    });
  });

  describe("Failure rate calculation", () => {
    it("should calculate failure rate as percentage", () => {
      const credits = buildCreditData([{ amount: -1000, type: "generation" }]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "castingImage", pointsCost: 350 },
        { status: "completed", type: "fullBody", pointsCost: 300 },
      ]);

      const result = computeReconciliation(credits, gens);

      // 1 failed out of 3 = 33.33%
      expect(result.generations.failureRate).toBe(33.33);
    });

    it("should return 0% failure rate when no generations", () => {
      const credits = buildCreditData([]);
      const gens = buildGenData([]);

      const result = computeReconciliation(credits, gens);

      expect(result.generations.failureRate).toBe(0);
      expect(result.generations.total).toBe(0);
    });

    it("should return 100% failure rate when all failed", () => {
      const credits = buildCreditData([{ amount: -700, type: "generation" }]);
      const gens = buildGenData([
        { status: "failed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "fullBody", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.generations.failureRate).toBe(100);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty data gracefully", () => {
      const credits = buildCreditData([]);
      const gens = buildGenData([]);

      const result = computeReconciliation(credits, gens);

      expect(result.credits.totalEarned).toBe(0);
      expect(result.credits.totalSpent).toBe(0);
      expect(result.generations.total).toBe(0);
      expect(result.reconciliation.hasDiscrepancy).toBe(false);
      expect(result.reconciliation.summary).toContain("No discrepancies found");
    });

    it("should handle credits with no generation transactions", () => {
      const credits = buildCreditData([
        { amount: 5000, type: "subscription" },
        { amount: 12500, type: "referral" },
      ]);
      const gens = buildGenData([]);

      const result = computeReconciliation(credits, gens);

      expect(result.credits.generationDeductions).toBe(0);
      expect(result.reconciliation.hasDiscrepancy).toBe(false);
    });

    it("should handle generations with no credit transactions", () => {
      const credits = buildCreditData([]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.reconciliation.hasDiscrepancy).toBe(true);
      expect(result.reconciliation.discrepancy).toBe(-350);
    });

    it("should NOT use the unfiltered summary from query helpers", () => {
      // The mock summary has intentionally wrong values (999999, etc.)
      // Reconciliation should compute from rows instead
      const credits = buildCreditData([
        { amount: 5000, type: "subscription" },
        { amount: -350, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      // These should NOT be the fake summary values
      expect(result.credits.totalEarned).toBe(5000);
      expect(result.credits.totalEarned).not.toBe(999999);
      expect(result.credits.totalSpent).toBe(350);
      expect(result.credits.totalSpent).not.toBe(888888);
      expect(result.generations.total).toBe(1);
      expect(result.generations.total).not.toBe(777777);
    });

    it("should handle mixed credit types correctly for generation deductions", () => {
      const credits = buildCreditData([
        { amount: 5000, type: "subscription" },
        { amount: -350, type: "generation" },
        { amount: -100, type: "export" },
        { amount: -300, type: "generation" },
        { amount: 50, type: "refund" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "completed", type: "fullBody", pointsCost: 300 },
      ]);

      const result = computeReconciliation(credits, gens);

      // Only "generation" type credit transactions count toward deductions
      expect(result.credits.generationDeductions).toBe(650);
      // Total spent includes all negative transactions
      expect(result.credits.totalSpent).toBe(750); // 350 + 100 + 300
    });
  });
});
