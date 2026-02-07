/**
 * Moderator Read-Only Queries — detailed credit/generation history,
 * and credit purchase velocity limits.
 */

import {
  eq,
  desc,
  and,
  gte,
  lte,
  sql,
} from "drizzle-orm";
import {
  creditTransactions,
  generations,
  models,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ============================================================================
// MODERATOR READ-ONLY QUERY FUNCTIONS
// ============================================================================

/**
 * Get detailed credit transaction history for a user (moderator read-only).
 * Includes filtering by transaction type and date range.
 */
export async function getDetailedCreditHistory(
  userId: number,
  options: {
    limit?: number;
    offset?: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  transactions: Array<{
    id: number;
    amount: number;
    type: string;
    description: string | null;
    referenceId: string | null;
    balanceAfter: number;
    engineUsed: string | null;
    createdAt: Date;
  }>;
  total: number;
  summary: {
    totalCreditsEarned: number;
    totalCreditsSpent: number;
    netChange: number;
    transactionsByType: Record<
      string,
      { count: number; totalAmount: number }
    >;
  };
}> {
  const db = await getDb();
  if (!db) {
    return {
      transactions: [],
      total: 0,
      summary: {
        totalCreditsEarned: 0,
        totalCreditsSpent: 0,
        netChange: 0,
        transactionsByType: {},
      },
    };
  }

  const { limit = 50, offset = 0, type, startDate, endDate } = options;

  try {
    const conditions = [eq(creditTransactions.userId, userId)];
    if (type) {
      conditions.push(eq(creditTransactions.type, type as any));
    }
    if (startDate) {
      conditions.push(gte(creditTransactions.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(creditTransactions.createdAt, endDate));
    }

    const whereClause = and(...conditions);

    const txns = await db
      .select({
        id: creditTransactions.id,
        amount: creditTransactions.amount,
        type: creditTransactions.type,
        description: creditTransactions.description,
        referenceId: creditTransactions.referenceId,
        balanceAfter: creditTransactions.balanceAfter,
        engineUsed: creditTransactions.engineUsed,
        createdAt: creditTransactions.createdAt,
      })
      .from(creditTransactions)
      .where(whereClause)
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(creditTransactions)
      .where(whereClause);

    const total = countResult?.count || 0;

    const allTxns = await db
      .select({
        amount: creditTransactions.amount,
        type: creditTransactions.type,
      })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId));

    let totalCreditsEarned = 0;
    let totalCreditsSpent = 0;
    const transactionsByType: Record<
      string,
      { count: number; totalAmount: number }
    > = {};

    for (const txn of allTxns) {
      if (txn.amount > 0) {
        totalCreditsEarned += txn.amount;
      } else {
        totalCreditsSpent += Math.abs(txn.amount);
      }

      if (!transactionsByType[txn.type]) {
        transactionsByType[txn.type] = { count: 0, totalAmount: 0 };
      }
      transactionsByType[txn.type].count++;
      transactionsByType[txn.type].totalAmount += txn.amount;
    }

    return {
      transactions: txns,
      total,
      summary: {
        totalCreditsEarned,
        totalCreditsSpent,
        netChange: totalCreditsEarned - totalCreditsSpent,
        transactionsByType,
      },
    };
  } catch (error) {
    console.error(
      "[Database] Failed to get detailed credit history:",
      error
    );
    return {
      transactions: [],
      total: 0,
      summary: {
        totalCreditsEarned: 0,
        totalCreditsSpent: 0,
        netChange: 0,
        transactionsByType: {},
      },
    };
  }
}

/**
 * Get detailed generation history for a user (moderator read-only).
 * Includes filtering by status, type, and date range.
 */
export async function getDetailedGenerationHistory(
  userId: number,
  options: {
    limit?: number;
    offset?: number;
    status?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  generations: Array<{
    id: number;
    modelId: number | null;
    type: string;
    status: string;
    pointsCost: number;
    resultUrl: string | null;
    errorMessage: string | null;
    metadata: unknown;
    createdAt: Date;
    completedAt: Date | null;
    modelName: string | null;
  }>;
  total: number;
  summary: {
    totalGenerations: number;
    completedCount: number;
    failedCount: number;
    pendingCount: number;
    totalCreditsUsed: number;
    generationsByType: Record<string, { count: number; totalCost: number }>;
    failureRate: number;
  };
}> {
  const db = await getDb();
  if (!db) {
    return {
      generations: [],
      total: 0,
      summary: {
        totalGenerations: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        totalCreditsUsed: 0,
        generationsByType: {},
        failureRate: 0,
      },
    };
  }

  const { limit = 50, offset = 0, status, type, startDate, endDate } =
    options;

  try {
    const conditions = [eq(generations.userId, userId)];
    if (status) {
      conditions.push(eq(generations.status, status as any));
    }
    if (type) {
      conditions.push(eq(generations.type, type as any));
    }
    if (startDate) {
      conditions.push(gte(generations.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(generations.createdAt, endDate));
    }

    const whereClause = and(...conditions);

    const gens = await db
      .select({
        id: generations.id,
        modelId: generations.modelId,
        type: generations.type,
        status: generations.status,
        pointsCost: generations.pointsCost,
        resultUrl: generations.resultUrl,
        errorMessage: generations.errorMessage,
        metadata: generations.metadata,
        createdAt: generations.createdAt,
        completedAt: generations.completedAt,
        modelName: models.name,
      })
      .from(generations)
      .leftJoin(models, eq(generations.modelId, models.id))
      .where(whereClause)
      .orderBy(desc(generations.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(generations)
      .where(whereClause);

    const total = countResult?.count || 0;

    const allGens = await db
      .select({
        status: generations.status,
        type: generations.type,
        pointsCost: generations.pointsCost,
      })
      .from(generations)
      .where(eq(generations.userId, userId));

    let completedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let totalCreditsUsed = 0;
    const generationsByType: Record<
      string,
      { count: number; totalCost: number }
    > = {};

    for (const gen of allGens) {
      if (gen.status === "completed") completedCount++;
      else if (gen.status === "failed") failedCount++;
      else pendingCount++;

      totalCreditsUsed += gen.pointsCost;

      if (!generationsByType[gen.type]) {
        generationsByType[gen.type] = { count: 0, totalCost: 0 };
      }
      generationsByType[gen.type].count++;
      generationsByType[gen.type].totalCost += gen.pointsCost;
    }

    const totalGenerations = allGens.length;
    const failureRate =
      totalGenerations > 0
        ? (failedCount / totalGenerations) * 100
        : 0;

    return {
      generations: gens,
      total,
      summary: {
        totalGenerations,
        completedCount,
        failedCount,
        pendingCount,
        totalCreditsUsed,
        generationsByType,
        failureRate: Math.round(failureRate * 100) / 100,
      },
    };
  } catch (error) {
    console.error(
      "[Database] Failed to get detailed generation history:",
      error
    );
    return {
      generations: [],
      total: 0,
      summary: {
        totalGenerations: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        totalCreditsUsed: 0,
        generationsByType: {},
        failureRate: 0,
      },
    };
  }
}

// ============================================================================
// CREDIT PURCHASE VELOCITY LIMITS
// ============================================================================

/**
 * Get count of recent topup transactions for a user within a time window.
 * Used for velocity limiting credit purchases.
 */
export async function getRecentTopupCount(
  userId: number,
  sinceTimestamp: Date
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.type, "topup"),
        gte(creditTransactions.createdAt, sinceTimestamp)
      )
    );
  return Number(result[0]?.count ?? 0);
}

/**
 * Get total credits purchased from topup transactions for a user within a time window.
 * Used for daily dollar-amount velocity cap.
 */
export async function getRecentTopupCredits(
  userId: number,
  sinceTimestamp: Date
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.type, "topup"),
        gte(creditTransactions.createdAt, sinceTimestamp)
      )
    );
  return Number(result[0]?.total ?? 0);
}

// ============================================================================
// FLAGGED REFERRALS (same-IP fraud detection)
// ============================================================================

import { referrals, users } from "../../drizzle/schema";

/**
 * Get referrals flagged with sameIpFlag = true for moderator review.
 * Joins user info for both referrer and referee.
 */
export async function getFlaggedReferrals(
  limit: number = 50,
  offset: number = 0
): Promise<{
  items: Array<{
    id: number;
    referrerUserId: number;
    referrerName: string | null;
    referrerEmail: string | null;
    referredUserId: number | null;
    referredName: string | null;
    referredEmail: string | null;
    referrerIp: string | null;
    referredIp: string | null;
    status: string;
    creditsAwarded: number;
    referrerCredited: boolean;
    referredCredited: boolean;
    createdAt: Date;
    completedAt: Date | null;
  }>;
  total: number;
}> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  // Alias for the referred user join
  const referrerUser = users;

  const flaggedRows = await db
    .select({
      id: referrals.id,
      referrerUserId: referrals.referrerUserId,
      referredUserId: referrals.referredUserId,
      referredEmail: referrals.referredEmail,
      referrerIp: referrals.referrerIp,
      referredIp: referrals.referredIp,
      status: referrals.status,
      creditsAwarded: referrals.creditsAwarded,
      referrerCredited: referrals.referrerCredited,
      referredCredited: referrals.referredCredited,
      createdAt: referrals.createdAt,
      completedAt: referrals.completedAt,
    })
    .from(referrals)
    .where(eq(referrals.sameIpFlag, true))
    .orderBy(desc(referrals.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(referrals)
    .where(eq(referrals.sameIpFlag, true));
  const total = Number(countResult[0]?.count ?? 0);

  // Enrich with user names/emails
  const enriched = await Promise.all(
    flaggedRows.map(async (row) => {
      let referrerName: string | null = null;
      let referrerEmail: string | null = null;
      let referredName: string | null = null;

      // Get referrer info
      const referrerRows = await db
        .select({ name: referrerUser.name, email: referrerUser.email })
        .from(referrerUser)
        .where(eq(referrerUser.id, row.referrerUserId))
        .limit(1);
      if (referrerRows[0]) {
        referrerName = referrerRows[0].name;
        referrerEmail = referrerRows[0].email;
      }

      // Get referred user info
      if (row.referredUserId) {
        const referredRows = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, row.referredUserId))
          .limit(1);
        if (referredRows[0]) {
          referredName = referredRows[0].name;
        }
      }

      return {
        ...row,
        referrerName,
        referrerEmail,
        referredName,
        referredEmail: row.referredEmail,
      };
    })
  );

  return { items: enriched, total };
}
