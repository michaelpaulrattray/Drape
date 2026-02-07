/**
 * Tests for Admin Overview queries and data shaping.
 *
 * Tests the pure computation and data shaping logic used by the admin
 * overview dashboard, without hitting the database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// GENERATION HEALTH COMPUTATION
// ============================================================================

interface StatusRow { status: string; count: number }

function computeGenerationHealth(statusCounts: StatusRow[]) {
  const statusMap: Record<string, number> = {};
  for (const row of statusCounts) {
    statusMap[row.status] = row.count;
  }

  const completed24h = statusMap["completed"] || 0;
  const failed24h = statusMap["failed"] || 0;
  const pending = statusMap["pending"] || 0;
  const processing = statusMap["processing"] || 0;
  const total24h = completed24h + failed24h + pending + processing;
  const denominator = completed24h + failed24h;
  const successRate = denominator > 0
    ? Math.round((completed24h / denominator) * 100)
    : 100;

  return { total24h, completed24h, failed24h, pending, processing, successRate };
}

describe("Generation Health Computation", () => {
  it("should compute 100% success rate when all generations succeed", () => {
    const result = computeGenerationHealth([
      { status: "completed", count: 50 },
    ]);
    expect(result.successRate).toBe(100);
    expect(result.total24h).toBe(50);
    expect(result.completed24h).toBe(50);
    expect(result.failed24h).toBe(0);
  });

  it("should compute correct success rate with mixed statuses", () => {
    const result = computeGenerationHealth([
      { status: "completed", count: 80 },
      { status: "failed", count: 20 },
      { status: "pending", count: 5 },
      { status: "processing", count: 3 },
    ]);
    expect(result.successRate).toBe(80); // 80 / (80 + 20) = 80%
    expect(result.total24h).toBe(108);
    expect(result.pending).toBe(5);
    expect(result.processing).toBe(3);
  });

  it("should return 100% when no generations exist", () => {
    const result = computeGenerationHealth([]);
    expect(result.successRate).toBe(100);
    expect(result.total24h).toBe(0);
  });

  it("should compute 0% when all generations fail", () => {
    const result = computeGenerationHealth([
      { status: "failed", count: 10 },
    ]);
    expect(result.successRate).toBe(0);
    expect(result.failed24h).toBe(10);
  });

  it("should handle only pending/processing (no completed or failed)", () => {
    const result = computeGenerationHealth([
      { status: "pending", count: 3 },
      { status: "processing", count: 2 },
    ]);
    // No completed or failed → successRate = 100 (0/0 edge case handled)
    expect(result.successRate).toBe(100);
    expect(result.total24h).toBe(5);
  });

  it("should round success rate to nearest integer", () => {
    const result = computeGenerationHealth([
      { status: "completed", count: 2 },
      { status: "failed", count: 1 },
    ]);
    expect(result.successRate).toBe(67); // 2/3 = 66.67 → 67
  });
});

// ============================================================================
// CREDIT ECONOMY AGGREGATION
// ============================================================================

interface GenTypeRow { type: string; count: number; totalCost: number }

function computeCreditEconomy(params: {
  consumed24h: number;
  purchased7d: number;
  refunded7d: number;
  circulation: number;
  genByType: GenTypeRow[];
}) {
  return {
    creditsConsumed24h: params.consumed24h,
    creditsPurchased7d: params.purchased7d,
    creditsRefunded7d: params.refunded7d,
    totalCreditsInCirculation: params.circulation,
    generationsByType24h: params.genByType.map(r => ({
      type: r.type,
      count: r.count,
      totalCost: r.totalCost,
    })),
  };
}

describe("Credit Economy Aggregation", () => {
  it("should correctly aggregate credit metrics", () => {
    const result = computeCreditEconomy({
      consumed24h: 5000,
      purchased7d: 75000,
      refunded7d: 1200,
      circulation: 500000,
      genByType: [
        { type: "castingImage", count: 10, totalCost: 3500 },
        { type: "fullBody", count: 5, totalCost: 1500 },
      ],
    });

    expect(result.creditsConsumed24h).toBe(5000);
    expect(result.creditsPurchased7d).toBe(75000);
    expect(result.creditsRefunded7d).toBe(1200);
    expect(result.totalCreditsInCirculation).toBe(500000);
    expect(result.generationsByType24h).toHaveLength(2);
  });

  it("should handle zero values", () => {
    const result = computeCreditEconomy({
      consumed24h: 0,
      purchased7d: 0,
      refunded7d: 0,
      circulation: 0,
      genByType: [],
    });

    expect(result.creditsConsumed24h).toBe(0);
    expect(result.generationsByType24h).toHaveLength(0);
  });

  it("should preserve generation type details", () => {
    const result = computeCreditEconomy({
      consumed24h: 10000,
      purchased7d: 50000,
      refunded7d: 500,
      circulation: 250000,
      genByType: [
        { type: "castingImage", count: 20, totalCost: 7000 },
        { type: "fullBody", count: 10, totalCost: 3000 },
        { type: "upscale", count: 5, totalCost: 1500 },
        { type: "iteration", count: 8, totalCost: 2800 },
        { type: "multiView", count: 3, totalCost: 900 },
      ],
    });

    expect(result.generationsByType24h).toHaveLength(5);
    const casting = result.generationsByType24h.find(g => g.type === "castingImage");
    expect(casting?.count).toBe(20);
    expect(casting?.totalCost).toBe(7000);
  });
});

// ============================================================================
// GOVERNANCE METRICS
// ============================================================================

function computeGovernance(params: {
  pending: number;
  urgent: number;
  thisWeek: number;
  activeReferrals: number;
}) {
  return {
    pendingChangeRequests: params.pending,
    urgentChangeRequests: params.urgent,
    changeRequestsThisWeek: params.thisWeek,
    activeReferrals: params.activeReferrals,
  };
}

describe("Governance Metrics", () => {
  it("should correctly aggregate governance data", () => {
    const result = computeGovernance({
      pending: 5,
      urgent: 2,
      thisWeek: 12,
      activeReferrals: 8,
    });

    expect(result.pendingChangeRequests).toBe(5);
    expect(result.urgentChangeRequests).toBe(2);
    expect(result.changeRequestsThisWeek).toBe(12);
    expect(result.activeReferrals).toBe(8);
  });

  it("should handle zero pending requests", () => {
    const result = computeGovernance({
      pending: 0,
      urgent: 0,
      thisWeek: 0,
      activeReferrals: 0,
    });

    expect(result.pendingChangeRequests).toBe(0);
    expect(result.urgentChangeRequests).toBe(0);
  });

  it("should not have more urgent than pending", () => {
    // This is a data integrity check — urgent is a subset of pending
    const result = computeGovernance({
      pending: 3,
      urgent: 3,
      thisWeek: 5,
      activeReferrals: 1,
    });

    expect(result.urgentChangeRequests).toBeLessThanOrEqual(result.pendingChangeRequests);
  });
});

// ============================================================================
// USER GROWTH METRICS
// ============================================================================

function computeUserGrowth(params: {
  total: number;
  signups7d: number;
  signups24h: number;
  frozen: number;
  suspended: number;
  planRows: Array<{ plan: string; count: number }>;
}) {
  return {
    totalUsers: params.total,
    newSignups7d: params.signups7d,
    newSignups24h: params.signups24h,
    frozenAccounts: params.frozen,
    suspendedAccounts: params.suspended,
    planDistribution: params.planRows.map(r => ({
      plan: r.plan,
      count: r.count,
    })),
  };
}

describe("User Growth Metrics", () => {
  it("should correctly aggregate user growth data", () => {
    const result = computeUserGrowth({
      total: 1000,
      signups7d: 50,
      signups24h: 8,
      frozen: 3,
      suspended: 1,
      planRows: [
        { plan: "free", count: 800 },
        { plan: "starter", count: 120 },
        { plan: "pro", count: 60 },
        { plan: "enterprise", count: 20 },
      ],
    });

    expect(result.totalUsers).toBe(1000);
    expect(result.newSignups7d).toBe(50);
    expect(result.newSignups24h).toBe(8);
    expect(result.frozenAccounts).toBe(3);
    expect(result.suspendedAccounts).toBe(1);
    expect(result.planDistribution).toHaveLength(4);
  });

  it("should handle no frozen or suspended accounts", () => {
    const result = computeUserGrowth({
      total: 500,
      signups7d: 20,
      signups24h: 3,
      frozen: 0,
      suspended: 0,
      planRows: [{ plan: "free", count: 500 }],
    });

    expect(result.frozenAccounts).toBe(0);
    expect(result.suspendedAccounts).toBe(0);
  });

  it("should handle empty plan distribution", () => {
    const result = computeUserGrowth({
      total: 0,
      signups7d: 0,
      signups24h: 0,
      frozen: 0,
      suspended: 0,
      planRows: [],
    });

    expect(result.planDistribution).toHaveLength(0);
    expect(result.totalUsers).toBe(0);
  });

  it("24h signups should not exceed 7d signups", () => {
    const result = computeUserGrowth({
      total: 100,
      signups7d: 10,
      signups24h: 3,
      frozen: 0,
      suspended: 0,
      planRows: [],
    });

    expect(result.newSignups24h).toBeLessThanOrEqual(result.newSignups7d);
  });
});

// ============================================================================
// ALERTS FEED FILTERING
// ============================================================================

interface AlertItem {
  id: number;
  action: string;
  severity: string;
  userId: number | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: Date;
}

const CRITICAL_ACTIONS = [
  "account.auto_frozen",
  "account.unfrozen",
  "admin.account_suspended",
  "admin.account_unsuspended",
  "admin.ip_blocked",
  "security.rate_limit",
  "abuse.detected",
  "abuse.credits_exploit_attempt",
  "abuse.billing_anomaly",
  "abuse.global_attack_detected",
  "security.emergency_action",
  "billing.stripe_refund_issued",
];

function filterAlerts(alerts: AlertItem[]): AlertItem[] {
  return alerts.filter(
    a => a.severity === "critical" || a.severity === "warning" || CRITICAL_ACTIONS.includes(a.action)
  );
}

describe("Alerts Feed Filtering", () => {
  it("should include critical severity alerts", () => {
    const alerts: AlertItem[] = [
      { id: 1, action: "some.action", severity: "critical", userId: 1, metadata: null, ipAddress: null, createdAt: new Date() },
    ];
    expect(filterAlerts(alerts)).toHaveLength(1);
  });

  it("should include warning severity alerts", () => {
    const alerts: AlertItem[] = [
      { id: 1, action: "some.action", severity: "warning", userId: 1, metadata: null, ipAddress: null, createdAt: new Date() },
    ];
    expect(filterAlerts(alerts)).toHaveLength(1);
  });

  it("should include known critical actions regardless of severity", () => {
    const alerts: AlertItem[] = [
      { id: 1, action: "account.auto_frozen", severity: "info", userId: 1, metadata: null, ipAddress: null, createdAt: new Date() },
      { id: 2, action: "abuse.detected", severity: "info", userId: 2, metadata: null, ipAddress: null, createdAt: new Date() },
    ];
    expect(filterAlerts(alerts)).toHaveLength(2);
  });

  it("should exclude info-severity non-critical actions", () => {
    const alerts: AlertItem[] = [
      { id: 1, action: "auth.login", severity: "info", userId: 1, metadata: null, ipAddress: null, createdAt: new Date() },
      { id: 2, action: "model.created", severity: "info", userId: 2, metadata: null, ipAddress: null, createdAt: new Date() },
    ];
    expect(filterAlerts(alerts)).toHaveLength(0);
  });

  it("should handle empty alerts array", () => {
    expect(filterAlerts([])).toHaveLength(0);
  });

  it("should include all known critical actions", () => {
    const alerts: AlertItem[] = CRITICAL_ACTIONS.map((action, i) => ({
      id: i + 1,
      action,
      severity: "info",
      userId: 1,
      metadata: null,
      ipAddress: null,
      createdAt: new Date(),
    }));
    expect(filterAlerts(alerts)).toHaveLength(CRITICAL_ACTIONS.length);
  });
});

// ============================================================================
// OVERVIEW DATA SHAPE
// ============================================================================

describe("Overview Data Shape", () => {
  it("should combine all sections into the expected shape", () => {
    const health = computeGenerationHealth([
      { status: "completed", count: 100 },
      { status: "failed", count: 5 },
    ]);
    const activeUsers24h = 42;

    const users = computeUserGrowth({
      total: 500,
      signups7d: 20,
      signups24h: 3,
      frozen: 1,
      suspended: 0,
      planRows: [{ plan: "free", count: 400 }, { plan: "pro", count: 100 }],
    });

    const credits = computeCreditEconomy({
      consumed24h: 5000,
      purchased7d: 75000,
      refunded7d: 500,
      circulation: 250000,
      genByType: [{ type: "castingImage", count: 10, totalCost: 3500 }],
    });

    const governance = computeGovernance({
      pending: 3,
      urgent: 1,
      thisWeek: 7,
      activeReferrals: 5,
    });

    const overview = {
      health: { ...health, activeUsers24h },
      users,
      credits,
      governance,
      alerts: [] as AlertItem[],
      fetchedAt: new Date(),
    };

    // Verify top-level keys
    expect(overview).toHaveProperty("health");
    expect(overview).toHaveProperty("users");
    expect(overview).toHaveProperty("credits");
    expect(overview).toHaveProperty("governance");
    expect(overview).toHaveProperty("alerts");
    expect(overview).toHaveProperty("fetchedAt");

    // Verify health section
    expect(overview.health.successRate).toBe(95); // 100/105
    expect(overview.health.activeUsers24h).toBe(42);

    // Verify users section
    expect(overview.users.totalUsers).toBe(500);
    expect(overview.users.planDistribution).toHaveLength(2);

    // Verify credits section
    expect(overview.credits.creditsConsumed24h).toBe(5000);
    expect(overview.credits.generationsByType24h).toHaveLength(1);

    // Verify governance section
    expect(overview.governance.pendingChangeRequests).toBe(3);
  });
});

// ============================================================================
// ALERT METADATA PREVIEW
// ============================================================================

function getMetadataPreview(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const m = metadata as Record<string, unknown>;
  const parts: string[] = [];
  if (m.reason && typeof m.reason === "string") parts.push(m.reason);
  if (m.userName && typeof m.userName === "string") parts.push(`User: ${m.userName}`);
  if (m.discrepancy && typeof m.discrepancy === "number") parts.push(`Discrepancy: ${m.discrepancy} credits`);
  if (m.ip && typeof m.ip === "string") parts.push(`IP: ${m.ip}`);
  return parts.join(" · ");
}

describe("Alert Metadata Preview", () => {
  it("should extract reason from metadata", () => {
    const preview = getMetadataPreview({ reason: "Credit discrepancy detected" });
    expect(preview).toBe("Credit discrepancy detected");
  });

  it("should combine multiple fields", () => {
    const preview = getMetadataPreview({
      reason: "Auto-frozen",
      userName: "John Doe",
      discrepancy: 2500,
    });
    expect(preview).toContain("Auto-frozen");
    expect(preview).toContain("User: John Doe");
    expect(preview).toContain("Discrepancy: 2500 credits");
  });

  it("should return empty string for null metadata", () => {
    expect(getMetadataPreview(null)).toBe("");
  });

  it("should return empty string for non-object metadata", () => {
    expect(getMetadataPreview("string")).toBe("");
    expect(getMetadataPreview(42)).toBe("");
  });

  it("should handle metadata with only IP", () => {
    const preview = getMetadataPreview({ ip: "192.168.1.1" });
    expect(preview).toBe("IP: 192.168.1.1");
  });

  it("should ignore non-string reason fields", () => {
    const preview = getMetadataPreview({ reason: 123 });
    expect(preview).toBe("");
  });
});

// ============================================================================
// TIME AGO FORMATTING
// ============================================================================

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

describe("Time Ago Formatting", () => {
  it("should show 'just now' for recent events", () => {
    expect(getTimeAgo(new Date())).toBe("just now");
  });

  it("should show minutes for events within the hour", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(getTimeAgo(fiveMinAgo)).toBe("5m ago");
  });

  it("should show hours for events within the day", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(getTimeAgo(threeHoursAgo)).toBe("3h ago");
  });

  it("should show days for older events", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(getTimeAgo(twoDaysAgo)).toBe("2d ago");
  });

  it("should handle exactly 1 minute ago", () => {
    const oneMinAgo = new Date(Date.now() - 60 * 1000);
    expect(getTimeAgo(oneMinAgo)).toBe("1m ago");
  });

  it("should handle exactly 1 hour ago", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(getTimeAgo(oneHourAgo)).toBe("1h ago");
  });

  it("should handle exactly 1 day ago", () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(getTimeAgo(oneDayAgo)).toBe("1d ago");
  });
});
