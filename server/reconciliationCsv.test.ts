import { describe, it, expect } from "vitest";

// ── Mirror of buildReconciliationCsv from client (pure logic, no DOM) ──

function escCsv(value: string | number): string {
  const s = String(value);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function row(...cells: (string | number)[]): string {
  return cells.map(escCsv).join(",");
}

interface ReconciliationData {
  credits: {
    totalEarned: number;
    totalSpent: number;
    grossGenerationDeductions: number;
    totalRefunds: number;
    netGenerationCost: number;
    byType: Record<string, { count: number; totalAmount: number }>;
  };
  generations: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    creditsOnCompleted: number;
    creditsOnFailed: number;
    creditsOnPending: number;
    failureRate: number;
    byType: Array<{ type: string; totalCount: number; totalCost: number }>;
  };
  reconciliation: {
    grossGenerationDeductions: number;
    totalRefunds: number;
    netGenerationCost: number;
    completedGenerationCost: number;
    pendingGenerationCost: number;
    discrepancy: number;
    hasDiscrepancy: boolean;
    summary: string;
  };
}

function buildReconciliationCsv(
  data: ReconciliationData,
  userId: number,
  startDate?: string,
  endDate?: string,
): string {
  const lines: string[] = [];

  lines.push(row("Drape — Credit Reconciliation Report"));
  lines.push(row("Generated", new Date().toISOString()));
  lines.push(row("User ID", userId));
  lines.push(row("Date Range", startDate || "All time", endDate || "Present"));
  lines.push("");

  lines.push(row("CREDIT SUMMARY"));
  lines.push(row("Metric", "Value"));
  lines.push(row("Total Earned", data.credits.totalEarned));
  lines.push(row("Total Spent", data.credits.totalSpent));
  lines.push(row("Gross Generation Deductions", data.credits.grossGenerationDeductions));
  lines.push(row("Refunds (failed generations)", data.credits.totalRefunds));
  lines.push(row("Net Generation Cost", data.credits.netGenerationCost));
  lines.push("");

  lines.push(row("CREDIT BREAKDOWN BY TYPE"));
  lines.push(row("Type", "Count", "Total Amount"));
  for (const [type, info] of Object.entries(data.credits.byType)) {
    lines.push(row(type, info.count, info.totalAmount));
  }
  lines.push("");

  lines.push(row("GENERATION SUMMARY"));
  lines.push(row("Metric", "Value"));
  lines.push(row("Total Generations", data.generations.total));
  lines.push(row("Completed", data.generations.completed));
  lines.push(row("Failed", data.generations.failed));
  lines.push(row("Pending", data.generations.pending));
  lines.push(row("Failure Rate (%)", data.generations.failureRate));
  lines.push(row("Completed Cost (credits)", data.generations.creditsOnCompleted));
  lines.push(row("Failed Cost (credits)", data.generations.creditsOnFailed));
  lines.push(row("Pending Cost (credits)", data.generations.creditsOnPending));
  lines.push("");

  lines.push(row("GENERATION BREAKDOWN BY TYPE"));
  lines.push(row("Type", "Count", "Total Cost"));
  for (const entry of data.generations.byType) {
    lines.push(row(entry.type, entry.totalCount, entry.totalCost));
  }
  lines.push("");

  lines.push(row("RECONCILIATION"));
  lines.push(row("Metric", "Value"));
  lines.push(row("Gross Generation Deductions", data.reconciliation.grossGenerationDeductions));
  lines.push(row("Refunds", data.reconciliation.totalRefunds));
  lines.push(row("Net Generation Cost", data.reconciliation.netGenerationCost));
  lines.push(row("Completed Generation Cost", data.reconciliation.completedGenerationCost));
  lines.push(row("Pending Generation Cost", data.reconciliation.pendingGenerationCost));
  lines.push(row("Discrepancy", data.reconciliation.discrepancy));
  lines.push(row("Discrepancy Detected", data.reconciliation.hasDiscrepancy ? "YES" : "NO"));
  lines.push("");

  lines.push(row("ASSESSMENT"));
  lines.push(row(data.reconciliation.summary));

  return lines.join("\n") + "\n";
}

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
