/**
 * Admin Overview Queries — aggregation queries for the admin dashboard KPIs.
 * All queries hit the database directly for real-time data.
 */

import {
  eq,
  and,
  gte,
  sql,
  isNotNull,
  desc,
  count,
} from "drizzle-orm";
import {
  users,
  credits,
  creditTransactions,
  generations,
  auditLogs,
  changeRequests,
  referrals,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ============================================================================
// PLATFORM HEALTH METRICS
// ============================================================================

/**
 * Get generation health metrics for the last 24 hours.
 * Returns total, completed, failed, pending counts and success rate.
 */
export async function getGenerationHealth(): Promise<{
  total24h: number;
  completed24h: number;
  failed24h: number;
  pending: number;
  processing: number;
  successRate: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get 24h generation counts by status
  const statusCounts = await db
    .select({
      status: generations.status,
      count: count(),
    })
    .from(generations)
    .where(gte(generations.createdAt, twentyFourHoursAgo))
    .groupBy(generations.status);

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

/**
 * Get active users count in the last 24 hours (users who signed in).
 */
export async function getActiveUsers24h(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await db
    .select({ count: count() })
    .from(users)
    .where(gte(users.lastSignedIn, twentyFourHoursAgo));

  return result[0]?.count || 0;
}

// ============================================================================
// USER GROWTH METRICS
// ============================================================================

/**
 * Get user growth and account status metrics.
 */
export async function getUserGrowthMetrics(): Promise<{
  totalUsers: number;
  newSignups7d: number;
  newSignups24h: number;
  frozenAccounts: number;
  suspendedAccounts: number;
  planDistribution: Array<{ plan: string; count: number }>;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Total users
  const [totalResult] = await db
    .select({ count: count() })
    .from(users);
  const totalUsers = totalResult?.count || 0;

  // New signups in last 7 days
  const [signups7dResult] = await db
    .select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, sevenDaysAgo));
  const newSignups7d = signups7dResult?.count || 0;

  // New signups in last 24 hours
  const [signups24hResult] = await db
    .select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, twentyFourHoursAgo));
  const newSignups24h = signups24hResult?.count || 0;

  // Frozen accounts
  const [frozenResult] = await db
    .select({ count: count() })
    .from(users)
    .where(isNotNull(users.frozenAt));
  const frozenAccounts = frozenResult?.count || 0;

  // Suspended accounts
  const [suspendedResult] = await db
    .select({ count: count() })
    .from(users)
    .where(isNotNull(users.suspendedAt));
  const suspendedAccounts = suspendedResult?.count || 0;

  // Plan distribution
  const planRows = await db
    .select({
      plan: credits.planTier,
      count: count(),
    })
    .from(credits)
    .groupBy(credits.planTier);

  const planDistribution = planRows.map(r => ({
    plan: r.plan,
    count: r.count,
  }));

  return {
    totalUsers,
    newSignups7d,
    newSignups24h,
    frozenAccounts,
    suspendedAccounts,
    planDistribution,
  };
}

// ============================================================================
// CREDIT ECONOMY METRICS
// ============================================================================

/**
 * Get credit economy metrics.
 */
export async function getCreditEconomyMetrics(): Promise<{
  creditsConsumed24h: number;
  creditsPurchased7d: number;
  creditsRefunded7d: number;
  totalCreditsInCirculation: number;
  generationsByType24h: Array<{ type: string; count: number; totalCost: number }>;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Credits consumed in last 24h (generation type transactions, negative amounts)
  const [consumed24hResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)`,
    })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.type, "generation"),
        gte(creditTransactions.createdAt, twentyFourHoursAgo)
      )
    );
  const creditsConsumed24h = consumed24hResult?.total || 0;

  // Credits purchased in last 7 days (purchase + subscription + topup types)
  const [purchased7dResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)`,
    })
    .from(creditTransactions)
    .where(
      and(
        sql`${creditTransactions.type} IN ('purchase', 'subscription', 'topup')`,
        gte(creditTransactions.createdAt, sevenDaysAgo)
      )
    );
  const creditsPurchased7d = purchased7dResult?.total || 0;

  // Credits refunded in last 7 days
  const [refunded7dResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)`,
    })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.type, "refund"),
        gte(creditTransactions.createdAt, sevenDaysAgo)
      )
    );
  const creditsRefunded7d = refunded7dResult?.total || 0;

  // Total credits in circulation (sum of all balances)
  const [circulationResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${credits.balance}), 0)`,
    })
    .from(credits);
  const totalCreditsInCirculation = circulationResult?.total || 0;

  // Generations by type in last 24h with total cost
  const genByType = await db
    .select({
      type: generations.type,
      count: count(),
      totalCost: sql<number>`COALESCE(SUM(${generations.pointsCost}), 0)`,
    })
    .from(generations)
    .where(gte(generations.createdAt, twentyFourHoursAgo))
    .groupBy(generations.type);

  const generationsByType24h = genByType.map(r => ({
    type: r.type,
    count: r.count,
    totalCost: r.totalCost,
  }));

  return {
    creditsConsumed24h,
    creditsPurchased7d,
    creditsRefunded7d,
    totalCreditsInCirculation,
    generationsByType24h,
  };
}

// ============================================================================
// GOVERNANCE METRICS
// ============================================================================

/**
 * Get pending change requests and governance metrics.
 */
export async function getGovernanceMetrics(): Promise<{
  pendingChangeRequests: number;
  urgentChangeRequests: number;
  changeRequestsThisWeek: number;
  activeReferrals: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Pending change requests
  const [pendingResult] = await db
    .select({ count: count() })
    .from(changeRequests)
    .where(eq(changeRequests.status, "pending"));
  const pendingChangeRequests = pendingResult?.count || 0;

  // Urgent pending change requests
  const [urgentResult] = await db
    .select({ count: count() })
    .from(changeRequests)
    .where(
      and(
        eq(changeRequests.status, "pending"),
        eq(changeRequests.priority, "urgent")
      )
    );
  const urgentChangeRequests = urgentResult?.count || 0;

  // Change requests created this week
  const [weekResult] = await db
    .select({ count: count() })
    .from(changeRequests)
    .where(gte(changeRequests.createdAt, sevenDaysAgo));
  const changeRequestsThisWeek = weekResult?.count || 0;

  // Active referrals (pending or signed_up, not yet completed)
  const [referralResult] = await db
    .select({ count: count() })
    .from(referrals)
    .where(
      sql`${referrals.status} IN ('pending', 'signed_up')`
    );
  const activeReferrals = referralResult?.count || 0;

  return {
    pendingChangeRequests,
    urgentChangeRequests,
    changeRequestsThisWeek,
    activeReferrals,
  };
}

// ============================================================================
// ALERTS FEED
// ============================================================================

/**
 * Get the latest critical audit events for the alerts feed.
 * Focuses on security events, auto-freezes, billing issues, and abuse detection.
 */
export async function getRecentAlerts(limit: number = 15): Promise<Array<{
  id: number;
  action: string;
  severity: string;
  userId: number | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: Date;
}>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get critical and warning events, plus specific important info events
  const alerts = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      severity: auditLogs.severity,
      userId: auditLogs.userId,
      metadata: auditLogs.metadata,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(
      sql`${auditLogs.severity} IN ('critical', 'warning') OR ${auditLogs.action} IN (
        'account.auto_frozen',
        'account.unfrozen',
        'admin.account_suspended',
        'admin.account_unsuspended',
        'admin.ip_blocked',
        'security.rate_limit',
        'abuse.detected',
        'abuse.credits_exploit_attempt',
        'abuse.billing_anomaly',
        'abuse.global_attack_detected',
        'security.emergency_action',
        'billing.stripe_refund_issued'
      )`
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return alerts;
}
