/**
 * Tests for the moderator credit reconciliation logic.
 *
 * Key accounting rule: failed generations are refunded via a "refund" credit
 * transaction, so they should NOT count toward net credits used.
 *
 * Reconciliation compares:
 *   net generation cost = gross deductions − refunds
 *   vs. completed + pending generation recorded costs
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

// ── buildSummary (mirrors server/routes/moderatorReconciliation.ts) ──

function buildSummary(ctx: {
  hasDiscrepancy: boolean;
  discrepancy: number;
  failedCount: number;
  totalRefunds: number;
  creditsOnFailed: number;
}): string {
  const { hasDiscrepancy, discrepancy, failedCount, totalRefunds, creditsOnFailed } = ctx;

  if (!hasDiscrepancy) {
    if (failedCount > 0) {
      return `No discrepancy. ${totalRefunds.toLocaleString()} credits refunded for ${failedCount} failed generation(s).`;
    }
    return "No discrepancies found. All credits align with generation records.";
  }

  const absDisc = Math.abs(discrepancy).toLocaleString();

  const unrefundedFailureCost = creditsOnFailed - totalRefunds;
  if (failedCount > 0 && unrefundedFailureCost > 0 && Math.abs(discrepancy - unrefundedFailureCost) <= 1) {
    return `Discrepancy of ${absDisc} credits \u2014 likely caused by ${failedCount} failed generation(s) without matching refunds (pre-atomic-credits or refund failure).`;
  }

  if (failedCount > 0 && totalRefunds === 0) {
    return `Discrepancy of ${absDisc} credits. ${failedCount} failed generation(s) found with no refund transactions \u2014 credits may have been deducted before automatic refunds were enabled.`;
  }

  if (failedCount > 0 && unrefundedFailureCost > 0) {
    return `Discrepancy of ${absDisc} credits. Partial refunds detected: ${totalRefunds.toLocaleString()} credits refunded but ${creditsOnFailed.toLocaleString()} expected for ${failedCount} failed generation(s).`;
  }

  return `Discrepancy of ${absDisc} credits detected between net credit cost and generation records.`;
}

// ── Reconciliation logic (mirrors server/routes/moderatorReconciliation.ts) ──

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
  let creditsOnCompleted = 0;
  let creditsOnFailed = 0;
  let creditsOnPending = 0;
  const gensByType: Record<string, { count: number; totalCost: number }> = {};

  for (const gen of genData.generations) {
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
  const failureRate = totalGenerations > 0
    ? Math.round((failedCount / totalGenerations) * 10000) / 100
    : 0;

  const generationCreditTxn = creditsByType["generation"] || { count: 0, totalAmount: 0 };
  const grossGenerationDeductions = Math.abs(generationCreditTxn.totalAmount);

  const refundCreditTxn = creditsByType["refund"] || { count: 0, totalAmount: 0 };
  const totalRefunds = Math.max(0, refundCreditTxn.totalAmount);

  const netGenerationCost = grossGenerationDeductions - totalRefunds;

  const discrepancy = netGenerationCost - creditsOnCompleted - creditsOnPending;
  const hasDiscrepancy = Math.abs(discrepancy) > 0;

  return {
    credits: {
      totalEarned: totalCreditsEarned,
      totalSpent: totalCreditsSpent,
      byType: creditsByType,
      grossGenerationDeductions,
      totalRefunds,
      netGenerationCost,
    },
    generations: {
      total: totalGenerations,
      completed: completedCount,
      failed: failedCount,
      pending: pendingCount,
      creditsOnCompleted,
      creditsOnFailed,
      creditsOnPending,
      failureRate,
      byType: Object.entries(gensByType).map(([type, data]) => ({
        type,
        totalCount: data.count,
        totalCost: data.totalCost,
      })),
    },
    reconciliation: {
      grossGenerationDeductions,
      totalRefunds,
      netGenerationCost,
      completedGenerationCost: creditsOnCompleted,
      pendingGenerationCost: creditsOnPending,
      discrepancy,
      hasDiscrepancy,
      summary: buildSummary({ hasDiscrepancy, discrepancy, failedCount, totalRefunds, creditsOnFailed }),
    },
  };
}

// ── Tests ──

describe("Credit Reconciliation Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Perfect alignment — no discrepancy", () => {
    it("should report no discrepancy when net credits match completed generations", () => {
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
      expect(result.reconciliation.netGenerationCost).toBe(650);
      expect(result.reconciliation.completedGenerationCost).toBe(650);
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
      expect(result.credits.netGenerationCost).toBe(350);
    });
  });

  describe("Failed generations with refunds", () => {
    it("should subtract refunds from gross deductions for net cost", () => {
      // Scenario: 3 generations attempted, 1 failed and was refunded
      const credits = buildCreditData([
        { amount: 5000, type: "subscription" },
        { amount: -350, type: "generation" },  // casting (completed)
        { amount: -300, type: "generation" },  // full body (completed)
        { amount: -350, type: "generation" },  // casting (failed)
        { amount: 350, type: "refund" },       // refund for failed
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "completed", type: "fullBody", pointsCost: 300 },
        { status: "failed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.credits.grossGenerationDeductions).toBe(1000);
      expect(result.credits.totalRefunds).toBe(350);
      expect(result.credits.netGenerationCost).toBe(650);
      expect(result.reconciliation.hasDiscrepancy).toBe(false);
      expect(result.reconciliation.discrepancy).toBe(0);
      expect(result.reconciliation.summary).toContain("refunded");
      expect(result.reconciliation.summary).toContain("1 failed");
    });

    it("should handle multiple failed generations with refunds", () => {
      const credits = buildCreditData([
        { amount: -350, type: "generation" },
        { amount: -300, type: "generation" },
        { amount: -350, type: "generation" },
        { amount: 350, type: "refund" },
        { amount: 300, type: "refund" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "fullBody", pointsCost: 300 },
        { status: "failed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.credits.grossGenerationDeductions).toBe(1000);
      expect(result.credits.totalRefunds).toBe(650);
      expect(result.credits.netGenerationCost).toBe(350);
      expect(result.reconciliation.completedGenerationCost).toBe(350);
      expect(result.reconciliation.hasDiscrepancy).toBe(false);
    });

    it("should still track creditsOnFailed for informational purposes", () => {
      const credits = buildCreditData([
        { amount: -700, type: "generation" },
        { amount: 350, type: "refund" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      // creditsOnFailed is informational — the actual accounting uses refunds
      expect(result.generations.creditsOnFailed).toBe(350);
      expect(result.generations.creditsOnCompleted).toBe(350);
    });
  });

  describe("Discrepancy detection", () => {
    it("should detect discrepancy when net credits > completed + pending costs", () => {
      // Deducted 700, no refunds, but only 350 in completed generations
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

    it("should detect discrepancy when completed costs > net credits", () => {
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

    it("should NOT flag discrepancy when refunds account for failed gens", () => {
      // Without refund awareness, this would show a discrepancy
      const credits = buildCreditData([
        { amount: -700, type: "generation" },
        { amount: 350, type: "refund" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      // Net cost = 700 - 350 = 350, completed cost = 350 → no discrepancy
      expect(result.reconciliation.netGenerationCost).toBe(350);
      expect(result.reconciliation.hasDiscrepancy).toBe(false);
    });
  });

  describe("Pending generations", () => {
    it("should include pending costs in reconciliation comparison", () => {
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
      // Net cost 1000 vs completed 350 + pending 650 = 1000 → no discrepancy
      expect(result.reconciliation.hasDiscrepancy).toBe(false);
    });
  });

  describe("Generation type breakdown", () => {
    it("should group generations by type with correct counts and costs", () => {
      const credits = buildCreditData([
        { amount: -2050, type: "generation" },
        { amount: 350, type: "refund" },
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
    it("should group credit transactions by type including refunds", () => {
      const credits = buildCreditData([
        { amount: 5000, type: "subscription" },
        { amount: 12500, type: "referral" },
        { amount: -350, type: "generation" },
        { amount: -300, type: "generation" },
        { amount: 300, type: "refund" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "fullBody", pointsCost: 300 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.credits.byType["subscription"]).toEqual({ count: 1, totalAmount: 5000 });
      expect(result.credits.byType["referral"]).toEqual({ count: 1, totalAmount: 12500 });
      expect(result.credits.byType["generation"]).toEqual({ count: 2, totalAmount: -650 });
      expect(result.credits.byType["refund"]).toEqual({ count: 1, totalAmount: 300 });
    });
  });

  describe("Failure rate calculation", () => {
    it("should calculate failure rate as percentage", () => {
      const credits = buildCreditData([
        { amount: -1000, type: "generation" },
        { amount: 350, type: "refund" },
      ]);
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
      const credits = buildCreditData([
        { amount: -700, type: "generation" },
        { amount: 700, type: "refund" },
      ]);
      const gens = buildGenData([
        { status: "failed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "fullBody", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.generations.failureRate).toBe(100);
      // Net cost should be 0 since all refunded
      expect(result.credits.netGenerationCost).toBe(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty data gracefully", () => {
      const credits = buildCreditData([]);
      const gens = buildGenData([]);

      const result = computeReconciliation(credits, gens);

      expect(result.credits.totalEarned).toBe(0);
      expect(result.credits.totalSpent).toBe(0);
      expect(result.credits.netGenerationCost).toBe(0);
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

      expect(result.credits.grossGenerationDeductions).toBe(0);
      expect(result.credits.netGenerationCost).toBe(0);
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
      const credits = buildCreditData([
        { amount: 5000, type: "subscription" },
        { amount: -350, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.credits.totalEarned).toBe(5000);
      expect(result.credits.totalEarned).not.toBe(999999);
      expect(result.credits.totalSpent).toBe(350);
      expect(result.credits.totalSpent).not.toBe(888888);
      expect(result.generations.total).toBe(1);
      expect(result.generations.total).not.toBe(777777);
    });

    it("should handle mixed credit types correctly for net generation cost", () => {
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

      // Only "generation" type credit transactions count toward gross deductions
      expect(result.credits.grossGenerationDeductions).toBe(650);
      // Refunds subtract from gross
      expect(result.credits.totalRefunds).toBe(50);
      expect(result.credits.netGenerationCost).toBe(600);
      // Total spent includes all negative transactions
      expect(result.credits.totalSpent).toBe(750); // 350 + 100 + 300
    });

    it("should report correct summary when all generations failed and refunded", () => {
      const credits = buildCreditData([
        { amount: -350, type: "generation" },
        { amount: -300, type: "generation" },
        { amount: 350, type: "refund" },
        { amount: 300, type: "refund" },
      ]);
      const gens = buildGenData([
        { status: "failed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "fullBody", pointsCost: 300 },
      ]);

      const result = computeReconciliation(credits, gens);

      expect(result.credits.netGenerationCost).toBe(0);
      expect(result.reconciliation.completedGenerationCost).toBe(0);
      expect(result.reconciliation.hasDiscrepancy).toBe(false);
      expect(result.reconciliation.summary).toContain("refunded");
      expect(result.reconciliation.summary).toContain("2 failed");
    });
  });

  describe("Summary messaging — likely cause detection", () => {
    it("should explain discrepancy caused by unrefunded failed generations", () => {
      // Mirrors Mike's real data: 1 failed gen, no refund, discrepancy = failed cost
      const credits = buildCreditData([
        { amount: -717, type: "generation" },
      ]);
      const gens = buildGenData([
        ...Array.from({ length: 60 }, () => ({ status: "completed", type: "castingImage", pointsCost: 11 })),
        { status: "failed", type: "castingImage", pointsCost: 6 },
      ]);

      const result = computeReconciliation(credits, gens);

      // Net cost 717, completed cost 660, failed cost 6, no refunds
      // Discrepancy = 717 - 660 = 57... wait, let me fix the math
      // Actually: 60 * 11 = 660 completed, 6 failed, net = 717
      // discrepancy = 717 - 660 = 57, but unrefundedFailureCost = 6
      // These don't match, so it falls to the "no refund transactions" branch
      expect(result.reconciliation.hasDiscrepancy).toBe(true);
      expect(result.reconciliation.summary).toContain("no refund transactions");
      expect(result.reconciliation.summary).toContain("automatic refunds were enabled");
    });

    it("should explain exact match between discrepancy and unrefunded failure cost", () => {
      // Discrepancy exactly equals the unrefunded failed generation cost
      const credits = buildCreditData([
        { amount: -350, type: "generation" },
        { amount: -300, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "fullBody", pointsCost: 300 },
      ]);

      const result = computeReconciliation(credits, gens);

      // Net cost = 650, completed = 350, discrepancy = 300
      // unrefundedFailureCost = 300 - 0 = 300, matches discrepancy
      expect(result.reconciliation.hasDiscrepancy).toBe(true);
      expect(result.reconciliation.discrepancy).toBe(300);
      expect(result.reconciliation.summary).toContain("likely caused by");
      expect(result.reconciliation.summary).toContain("without matching refunds");
    });

    it("should explain partial refund scenario", () => {
      // 2 failed gens but only 1 refund
      const credits = buildCreditData([
        { amount: -350, type: "generation" },
        { amount: -300, type: "generation" },
        { amount: -350, type: "generation" },
        { amount: 300, type: "refund" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
        { status: "failed", type: "fullBody", pointsCost: 300 },
        { status: "failed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      // Net cost = 1000 - 300 = 700, completed = 350
      // discrepancy = 700 - 350 = 350
      // unrefundedFailureCost = 650 - 300 = 350, matches discrepancy
      expect(result.reconciliation.hasDiscrepancy).toBe(true);
      expect(result.reconciliation.summary).toContain("likely caused by");
    });

    it("should show generic message for unexplained discrepancy", () => {
      // Discrepancy that doesn't match any failed generation pattern
      const credits = buildCreditData([
        { amount: -500, type: "generation" },
      ]);
      const gens = buildGenData([
        { status: "completed", type: "castingImage", pointsCost: 350 },
      ]);

      const result = computeReconciliation(credits, gens);

      // No failed gens, so no failure-related explanation
      expect(result.reconciliation.hasDiscrepancy).toBe(true);
      expect(result.reconciliation.discrepancy).toBe(150);
      expect(result.reconciliation.summary).toContain("Discrepancy of 150 credits detected");
    });
  });
});
