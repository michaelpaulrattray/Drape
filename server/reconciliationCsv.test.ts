import { describe, it, expect } from "vitest";

/*
 * ⚠ A HUNDRED LINES OF `client/src/features/moderator/reconciliation-csv.ts`
 * USED TO BE RE-TYPED HERE, under a heading that said so: "Mirror of
 * buildReconciliationCsv from client (pure logic, no DOM)". Every arm below
 * tested the copy — the CSV quoting rule, the section order, the money
 * columns of a BILLING DISPUTE export.
 *
 * The mirror was never necessary: `buildReconciliationCsv` is and was an
 * `export`, and vitest's `@` alias resolves to `client/src`, so this file
 * could always have imported it. Diffed before repointing (2026-08-25): copy
 * and source differed only in seven section COMMENTS the copy had dropped, so
 * nothing had drifted yet — which is the state every mirror is in right up
 * until it isn't. Filed under 3g's A. Working law 4: derive, never mirror.
 *
 * The `ReconciliationData` shape is taken off the real function's own
 * signature rather than re-declared, so a field added or renamed there is a
 * typecheck failure here instead of a silent divergence.
 */
import { buildReconciliationCsv } from "@/features/moderator/reconciliation-csv";

type ReconciliationData = Parameters<typeof buildReconciliationCsv>[0];

// ── Test data helpers ──

function makeSampleData(overrides?: Partial<ReconciliationData>): ReconciliationData {
  return {
    credits: {
      totalEarned: 5000,
      totalSpent: 717,
      grossGenerationDeductions: 717,
      totalRefunds: 0,
      netGenerationCost: 717,
      byType: {
        generation: { count: 63, totalAmount: -717 },
        signup: { count: 1, totalAmount: 100 },
      },
      ...overrides?.credits,
    },
    generations: {
      total: 61,
      completed: 60,
      failed: 1,
      pending: 0,
      creditsOnCompleted: 711,
      creditsOnFailed: 6,
      creditsOnPending: 0,
      failureRate: 1.64,
      byType: [
        { type: "castingImage", totalCount: 43, totalCost: 479 },
        { type: "fullBody", totalCount: 7, totalCost: 52 },
      ],
      ...overrides?.generations,
    },
    reconciliation: {
      grossGenerationDeductions: 717,
      totalRefunds: 0,
      netGenerationCost: 717,
      completedGenerationCost: 711,
      pendingGenerationCost: 0,
      discrepancy: 6,
      hasDiscrepancy: true,
      summary: "Discrepancy of 6 credits.",
      ...overrides?.reconciliation,
    },
  };
}

// ── Tests ──

describe("Reconciliation CSV Export", () => {
  it("should produce valid CSV with all sections", () => {
    const csv = buildReconciliationCsv(makeSampleData(), 42);
    const lines = csv.trim().split("\n");

    expect(lines[0]).toContain("Drape");
    expect(lines[2]).toBe("User ID,42");
    expect(lines[3]).toContain("All time");
    expect(lines[3]).toContain("Present");

    // Credit summary section
    expect(csv).toContain("CREDIT SUMMARY");
    expect(csv).toContain("Total Earned,5000");
    expect(csv).toContain("Total Spent,717");
    expect(csv).toContain("Net Generation Cost,717");

    // Generation summary section
    expect(csv).toContain("GENERATION SUMMARY");
    expect(csv).toContain("Total Generations,61");
    expect(csv).toContain("Completed,60");
    expect(csv).toContain("Failed,1");

    // Reconciliation section
    expect(csv).toContain("RECONCILIATION");
    expect(csv).toContain("Discrepancy,6");
    expect(csv).toContain("Discrepancy Detected,YES");

    // Assessment
    expect(csv).toContain("ASSESSMENT");
    expect(csv).toContain("Discrepancy of 6 credits.");
  });

  it("should include date range when provided", () => {
    const csv = buildReconciliationCsv(makeSampleData(), 42, "2026-01-01", "2026-01-31");

    expect(csv).toContain("Date Range,2026-01-01,2026-01-31");
  });

  it("should show NO for discrepancy when none exists", () => {
    const data = makeSampleData({
      reconciliation: {
        grossGenerationDeductions: 711,
        totalRefunds: 0,
        netGenerationCost: 711,
        completedGenerationCost: 711,
        pendingGenerationCost: 0,
        discrepancy: 0,
        hasDiscrepancy: false,
        summary: "No discrepancies found.",
      },
    });
    const csv = buildReconciliationCsv(data, 42);

    expect(csv).toContain("Discrepancy,0");
    expect(csv).toContain("Discrepancy Detected,NO");
  });

  it("should include credit type breakdown rows", () => {
    const csv = buildReconciliationCsv(makeSampleData(), 42);

    expect(csv).toContain("CREDIT BREAKDOWN BY TYPE");
    expect(csv).toContain("generation,63,-717");
    expect(csv).toContain("signup,1,100");
  });

  it("should include generation type breakdown rows", () => {
    const csv = buildReconciliationCsv(makeSampleData(), 42);

    expect(csv).toContain("GENERATION BREAKDOWN BY TYPE");
    expect(csv).toContain("castingImage,43,479");
    expect(csv).toContain("fullBody,7,52");
  });

  it("should include refund data when present", () => {
    const data = makeSampleData({
      credits: {
        totalEarned: 5000,
        totalSpent: 650,
        grossGenerationDeductions: 650,
        totalRefunds: 300,
        netGenerationCost: 350,
        byType: {
          generation: { count: 2, totalAmount: -650 },
          refund: { count: 1, totalAmount: 300 },
        },
      },
      reconciliation: {
        grossGenerationDeductions: 650,
        totalRefunds: 300,
        netGenerationCost: 350,
        completedGenerationCost: 350,
        pendingGenerationCost: 0,
        discrepancy: 0,
        hasDiscrepancy: false,
        summary: "No discrepancy.",
      },
    });
    const csv = buildReconciliationCsv(data, 7);

    expect(csv).toContain("Refunds (failed generations),300");
    expect(csv).toContain("Refunds,300");
    expect(csv).toContain("refund,1,300");
  });

  it("should escape CSV values containing commas", () => {
    const data = makeSampleData({
      reconciliation: {
        grossGenerationDeductions: 717,
        totalRefunds: 0,
        netGenerationCost: 717,
        completedGenerationCost: 711,
        pendingGenerationCost: 0,
        discrepancy: 6,
        hasDiscrepancy: true,
        summary: 'Discrepancy of 6 credits, likely caused by failures.',
      },
    });
    const csv = buildReconciliationCsv(data, 42);

    // Summary contains a comma, so it should be quoted
    expect(csv).toContain('"Discrepancy of 6 credits, likely caused by failures."');
  });

  it("should escape CSV values containing double quotes", () => {
    const data = makeSampleData({
      reconciliation: {
        grossGenerationDeductions: 717,
        totalRefunds: 0,
        netGenerationCost: 717,
        completedGenerationCost: 711,
        pendingGenerationCost: 0,
        discrepancy: 6,
        hasDiscrepancy: true,
        summary: 'Discrepancy "detected" in records.',
      },
    });
    const csv = buildReconciliationCsv(data, 42);

    expect(csv).toContain('"Discrepancy ""detected"" in records."');
  });

  it("should handle empty generation types gracefully", () => {
    const data = makeSampleData({
      generations: {
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        creditsOnCompleted: 0,
        creditsOnFailed: 0,
        creditsOnPending: 0,
        failureRate: 0,
        byType: [],
      },
    });
    const csv = buildReconciliationCsv(data, 42);

    expect(csv).toContain("Total Generations,0");
    expect(csv).toContain("GENERATION BREAKDOWN BY TYPE");
    // No type rows, just the header then empty line
    const lines = csv.split("\n");
    const headerIdx = lines.findIndex((l) => l === "Type,Count,Total Cost");
    expect(lines[headerIdx + 1]).toBe("");
  });

  it("should end with a trailing newline", () => {
    const csv = buildReconciliationCsv(makeSampleData(), 42);
    expect(csv.endsWith("\n")).toBe(true);
  });
});
