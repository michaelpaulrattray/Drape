/**
 * Admin Time-Series Queries — daily aggregations for overview charts.
 * Returns arrays of { date, ...metrics } for the last N days.
 */

import { sql, gte, count } from "drizzle-orm";
import {
  users,
  creditTransactions,
  generations,
  changeRequests,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ============================================================================
// HELPERS
// ============================================================================

/** Generate an array of date strings (YYYY-MM-DD) for the last N days, inclusive of today. */
function getDateRange(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** Fill missing dates with zero values. */
function fillDates<T extends Record<string, unknown>>(
  dates: string[],
  rows: Array<{ date: string } & T>,
  defaults: Omit<T, "date">
): Array<{ date: string } & T> {
  const map = new Map(rows.map(r => [r.date, r]));
  return dates.map(date => {
    const existing = map.get(date);
    if (existing) return existing;
    return { date, ...defaults } as { date: string } & T;
  });
}

// ============================================================================
// DAILY GENERATION STATS (14 days)
// ============================================================================

export interface DailyGenerationStats {
  date: string;
  completed: number;
  failed: number;
  total: number;
  successRate: number;
}

export async function getDailyGenerationStats(days: number = 14): Promise<DailyGenerationStats[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dateRange = getDateRange(days);

  // Use raw SQL to avoid GROUP BY mismatch with only_full_group_by
  const rows = await db.execute(sql`
    SELECT
      DATE(${generations.createdAt}) AS gen_date,
      SUM(CASE WHEN ${generations.status} = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN ${generations.status} = 'failed' THEN 1 ELSE 0 END) AS failed,
      COUNT(*) AS total
    FROM ${generations}
    WHERE ${generations.createdAt} >= ${startDate}
    GROUP BY gen_date
    ORDER BY gen_date
  `);

  const mapped = (rows as unknown as Array<{ gen_date: string; completed: string | number; failed: string | number; total: string | number }>).map(r => {
    const completed = Number(r.completed);
    const failed = Number(r.failed);
    const denom = completed + failed;
    return {
      date: String(r.gen_date).slice(0, 10),
      completed,
      failed,
      total: Number(r.total),
      successRate: denom > 0 ? Math.round((completed / denom) * 100) : 100,
    };
  });

  return fillDates(dateRange, mapped, { completed: 0, failed: 0, total: 0, successRate: 100 });
}

// ============================================================================
// DAILY SIGNUP STATS (14 days)
// ============================================================================

export interface DailySignupStats {
  date: string;
  signups: number;
}

export async function getDailySignupStats(days: number = 14): Promise<DailySignupStats[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dateRange = getDateRange(days);

  const rows = await db.execute(sql`
    SELECT
      DATE(${users.createdAt}) AS signup_date,
      COUNT(*) AS signups
    FROM ${users}
    WHERE ${users.createdAt} >= ${startDate}
    GROUP BY signup_date
    ORDER BY signup_date
  `);

  const mapped = (rows as unknown as Array<{ signup_date: string; signups: string | number }>).map(r => ({
    date: String(r.signup_date).slice(0, 10),
    signups: Number(r.signups),
  }));

  return fillDates(dateRange, mapped, { signups: 0 });
}

// ============================================================================
// DAILY CREDIT FLOW (14 days)
// ============================================================================

export interface DailyCreditFlow {
  date: string;
  consumed: number;
  purchased: number;
  refunded: number;
}

export async function getDailyCreditFlow(days: number = 14): Promise<DailyCreditFlow[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dateRange = getDateRange(days);

  const rows = await db.execute(sql`
    SELECT
      DATE(${creditTransactions.createdAt}) AS txn_date,
      COALESCE(SUM(CASE WHEN ${creditTransactions.type} = 'generation' THEN ABS(${creditTransactions.amount}) ELSE 0 END), 0) AS consumed,
      COALESCE(SUM(CASE WHEN ${creditTransactions.type} IN ('purchase', 'subscription', 'topup') THEN ${creditTransactions.amount} ELSE 0 END), 0) AS purchased,
      COALESCE(SUM(CASE WHEN ${creditTransactions.type} = 'refund' THEN ${creditTransactions.amount} ELSE 0 END), 0) AS refunded
    FROM ${creditTransactions}
    WHERE ${creditTransactions.createdAt} >= ${startDate}
    GROUP BY txn_date
    ORDER BY txn_date
  `);

  const mapped = (rows as unknown as Array<{ txn_date: string; consumed: string | number; purchased: string | number; refunded: string | number }>).map(r => ({
    date: String(r.txn_date).slice(0, 10),
    consumed: Number(r.consumed),
    purchased: Number(r.purchased),
    refunded: Number(r.refunded),
  }));

  return fillDates(dateRange, mapped, { consumed: 0, purchased: 0, refunded: 0 });
}

// ============================================================================
// CHANGE REQUEST STATUS DISTRIBUTION
// ============================================================================

export interface ChangeRequestDistribution {
  status: string;
  count: number;
}

export async function getChangeRequestDistribution(): Promise<ChangeRequestDistribution[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      status: changeRequests.status,
      count: count(),
    })
    .from(changeRequests)
    .groupBy(changeRequests.status);

  return rows.map(r => ({ status: r.status, count: r.count }));
}
