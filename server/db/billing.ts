/**
 * Billing Domain — subscriptions, credit top-ups, usage stats, and daily usage charts.
 */

import { eq, and, desc, gte, lt, asc, sql } from "drizzle-orm";
import {
  credits,
  creditTransactions,
  users,
  PlanTier,
} from "../../drizzle/schema";
import { getDb, withTransaction } from "./connection";
import {
  addCredits,
  creditReferenceSemanticsMatch,
  getCreditTransactionByRef,
  getUserCredits,
  isDuplicateCreditReferenceError,
  normalizeCreditReferenceId,
  type CreditWriteResult,
} from "./credits";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/billing");

export async function updateUserSubscription(
  userId: number,
  data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?:
      | "active"
      | "canceled"
      | "past_due"
      | "unpaid"
      | "trialing"
      | null;
    planTier?: PlanTier;
    planExpiresAt?: Date | null;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    await db.update(credits).set(data).where(eq(credits.userId, userId));
    return { success: true };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to update subscription:");
    return { success: false, error: "Failed to update subscription" };
  }
}

export async function getUserByStripeCustomerId(
  stripeCustomerId: string
) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(credits)
    .where(eq(credits.stripeCustomerId, stripeCustomerId))
    .limit(1);

  if (result.length === 0) return null;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, result[0].userId))
    .limit(1);

  return user.length > 0 ? { ...user[0], credits: result[0] } : null;
}

export async function refreshMonthlyCredits(
  userId: number,
  monthlyCredits: number,
  rolloverCredits: number,
  referenceId: string,
): Promise<CreditWriteResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }
  const ledgerReferenceId = normalizeCreditReferenceId(referenceId);

  try {
    const userCredits = await getUserCredits(userId);
    if (!userCredits) {
      return { success: false, error: "User credits not found" };
    }

    const newBalance = monthlyCredits + rolloverCredits;

    return await withTransaction(async (tx) => {
      await tx
        .update(credits)
        .set({
          balance: newBalance,
          rolloverCredits: rolloverCredits,
          lastRefreshAt: new Date(),
        })
        .where(eq(credits.userId, userId));

      await tx.insert(creditTransactions).values({
        userId,
        amount: monthlyCredits,
        type: "subscription",
        description: `Monthly credit refresh (${monthlyCredits} credits + ${rolloverCredits} rollover)`,
        referenceId: ledgerReferenceId,
        balanceAfter: newBalance,
      });

      return { success: true, newBalance };
    });
  } catch (error) {
    if (isDuplicateCreditReferenceError(error)) {
      const existing = await getCreditTransactionByRef(userId, ledgerReferenceId);
      if (!existing || !creditReferenceSemanticsMatch(
        existing,
        { type: "subscription", amount: monthlyCredits },
      )) {
        log.fatal(
          {
            userId,
            referenceId: ledgerReferenceId,
            existing: existing && { id: existing.id, type: existing.type, amount: existing.amount },
            requested: { type: "subscription", amount: monthlyCredits },
          },
          "[Database] CRITICAL monthly-refresh reference collision",
        );
        return {
          success: false,
          error: "Credit reference collision",
          duplicate: true,
          collision: true,
        };
      }
      const current = await getUserCredits(userId);
      if (!current) return { success: false, error: "User credits not found", duplicate: true };
      return { success: true, newBalance: current.balance, duplicate: true };
    }
    log.error({ err: error }, "[Database] Failed to refresh monthly credits:");
    return { success: false, error: "Failed to refresh credits" };
  }
}

export async function addTopupCredits(
  userId: number,
  creditAmount: number,
  referenceId: string
): Promise<{
  success: boolean;
  newBalance?: number;
  error?: string;
  duplicate?: boolean;
}> {
  return addCredits(
    userId,
    creditAmount,
    "topup",
    `Credit top-up: ${creditAmount} credits`,
    referenceId
  );
}

export async function getSubscriptionByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      planTier: credits.planTier,
      planExpiresAt: credits.planExpiresAt,
      stripeCustomerId: credits.stripeCustomerId,
      stripeSubscriptionId: credits.stripeSubscriptionId,
      subscriptionStatus: credits.subscriptionStatus,
      currentPeriodStart: credits.currentPeriodStart,
      currentPeriodEnd: credits.currentPeriodEnd,
      balance: credits.balance,
      creditsPurchased: credits.creditsPurchased,
      creditsUsed: credits.creditsUsed,
      rolloverCredits: credits.rolloverCredits,
      lastRefreshAt: credits.lastRefreshAt,
    })
    .from(credits)
    .where(eq(credits.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Get credit transaction history with pagination.
 */
export async function getCreditHistory(
  userId: number,
  limit: number = 20,
  offset: number = 0
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
}> {
  const db = await getDb();
  if (!db) {
    return { transactions: [], total: 0 };
  }

  try {
    const transactions = await db
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
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId));

    const total = countResult[0]?.count || 0;

    return { transactions, total };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to get credit history:");
    return { transactions: [], total: 0 };
  }
}

/**
 * Get usage statistics for a user.
 */
export async function getUsageStats(
  userId: number,
  days: number = 30
): Promise<{
  totalCreditsUsed: number;
  totalGenerations: number;
  averagePerDay: number;
  byType: Record<string, { count: number; credits: number }>;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalCreditsUsed: 0,
      totalGenerations: 0,
      averagePerDay: 0,
      byType: {},
    };
  }

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await db
      .select({
        amount: creditTransactions.amount,
        type: creditTransactions.type,
        createdAt: creditTransactions.createdAt,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, userId),
          gte(creditTransactions.createdAt, startDate)
        )
      );

    let totalCreditsUsed = 0;
    let totalGenerations = 0;
    const byType: Record<string, { count: number; credits: number }> = {};

    for (const tx of transactions) {
      if (tx.amount < 0) {
        totalCreditsUsed += Math.abs(tx.amount);
        totalGenerations++;

        const type = tx.type;
        if (!byType[type]) {
          byType[type] = { count: 0, credits: 0 };
        }
        byType[type].count++;
        byType[type].credits += Math.abs(tx.amount);
      }
    }

    const averagePerDay = days > 0 ? totalCreditsUsed / days : 0;

    return {
      totalCreditsUsed,
      totalGenerations,
      averagePerDay: Math.round(averagePerDay * 10) / 10,
      byType,
    };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to get usage stats:");
    return {
      totalCreditsUsed: 0,
      totalGenerations: 0,
      averagePerDay: 0,
      byType: {},
    };
  }
}

/**
 * Get daily usage data for charts.
 */
export async function getDailyUsage(
  userId: number,
  days: number = 30
): Promise<
  Array<{
    date: string;
    creditsUsed: number;
    generationCount: number;
  }>
> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await db
      .select({
        amount: creditTransactions.amount,
        createdAt: creditTransactions.createdAt,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, userId),
          gte(creditTransactions.createdAt, startDate),
          lt(creditTransactions.amount, 0)
        )
      )
      .orderBy(asc(creditTransactions.createdAt));

    const dailyMap = new Map<
      string,
      { creditsUsed: number; generationCount: number }
    >();

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split("T")[0];
      dailyMap.set(dateStr, { creditsUsed: 0, generationCount: 0 });
    }

    for (const tx of transactions) {
      const dateStr = new Date(tx.createdAt).toISOString().split("T")[0];
      const existing = dailyMap.get(dateStr) || {
        creditsUsed: 0,
        generationCount: 0,
      };
      existing.creditsUsed += Math.abs(tx.amount);
      existing.generationCount++;
      dailyMap.set(dateStr, existing);
    }

    return Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      creditsUsed: data.creditsUsed,
      generationCount: data.generationCount,
    }));
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to get daily usage:");
    return [];
  }
}
