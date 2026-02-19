/** Generates a CSV string from reconciliation data for billing dispute tickets. */

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

function escCsv(value: string | number): string {
  const s = String(value);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function row(...cells: (string | number)[]): string {
  return cells.map(escCsv).join(",");
}

export function buildReconciliationCsv(
  data: ReconciliationData,
  userId: number,
  startDate?: string,
  endDate?: string,
): string {
  const lines: string[] = [];

  // ── Report Header ──
  lines.push(row("Drape — Credit Reconciliation Report"));
  lines.push(row("Generated", new Date().toISOString()));
  lines.push(row("User ID", userId));
  lines.push(row("Date Range", startDate || "All time", endDate || "Present"));
  lines.push("");

  // ── Credit Summary ──
  lines.push(row("CREDIT SUMMARY"));
  lines.push(row("Metric", "Value"));
  lines.push(row("Total Earned", data.credits.totalEarned));
  lines.push(row("Total Spent", data.credits.totalSpent));
  lines.push(row("Gross Generation Deductions", data.credits.grossGenerationDeductions));
  lines.push(row("Refunds (failed generations)", data.credits.totalRefunds));
  lines.push(row("Net Generation Cost", data.credits.netGenerationCost));
  lines.push("");

  // ── Credit Breakdown by Type ──
  lines.push(row("CREDIT BREAKDOWN BY TYPE"));
  lines.push(row("Type", "Count", "Total Amount"));
  for (const [type, info] of Object.entries(data.credits.byType)) {
    lines.push(row(type, info.count, info.totalAmount));
  }
  lines.push("");

  // ── Generation Summary ──
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

  // ── Generation Breakdown by Type ──
  lines.push(row("GENERATION BREAKDOWN BY TYPE"));
  lines.push(row("Type", "Count", "Total Cost"));
  for (const entry of data.generations.byType) {
    lines.push(row(entry.type, entry.totalCount, entry.totalCost));
  }
  lines.push("");

  // ── Reconciliation ──
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

  // ── Assessment ──
  lines.push(row("ASSESSMENT"));
  lines.push(row(data.reconciliation.summary));

  return lines.join("\n") + "\n";
}

export function downloadReconciliationCsv(
  data: ReconciliationData,
  userId: number,
  startDate?: string,
  endDate?: string,
): void {
  const csv = buildReconciliationCsv(data, userId, startDate, endDate);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const datePart = startDate && endDate ? `_${startDate}_${endDate}` : "";
  a.download = `reconciliation_user${userId}${datePart}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
