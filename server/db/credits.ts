/**
 * Credits Domain — credit/point initialization, balance queries, deductions, additions.
 *
 * All multi-step write operations are wrapped in database transactions
 * to prevent data inconsistency on partial failures.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import {
  credits,
  creditTransactions,
  InsertCredits,
  InsertCreditTransaction,
  // Legacy aliases
  points,
  pointTransactions,
  InsertPoints,
  InsertPointTransaction,
} from "../../drizzle/schema";
import { getDb, withTransaction } from "./connection";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/credits");

const INITIAL_CREDITS = 5000; // Free tier starting credits (50x display multiplier)

export async function initializeUserCredits(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    log.warn("[Database] Cannot initialize credits: database not available");
    return;
  }

  try {
    await withTransaction(async (tx) => {
      // Create credits record
      await tx.insert(credits).values({
        userId,
        balance: INITIAL_CREDITS,
        planTier: "free",
        creditsPurchased: 0,
        creditsUsed: 0,
        rolloverCredits: 0,
      });

      // Record the signup bonus transaction
      await tx.insert(creditTransactions).values({
        userId,
        amount: INITIAL_CREDITS,
        type: "signup",
        description: "Welcome bonus - free credits for new users",
        balanceAfter: INITIAL_CREDITS,
      });
    });
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to initialize user credits:");
    throw error;
  }
}

// Legacy alias
export const initializeUserPoints = initializeUserCredits;

export async function getUserCredits(userId: number) {
  const db = await getDb();
  if (!db) {
    log.warn("[Database] Cannot get credits: database not available");
    return null;
  }

  const result = await db
    .select()
    .from(credits)
    .where(eq(credits.userId, userId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// Legacy alias
export const getUserPoints = getUserCredits;

export async function getCreditTransactions(
  userId: number,
  limit: number = 20
) {
  const db = await getDb();
  if (!db) {
    log.warn("[Database] Cannot get transactions: database not available");
    return [];
  }

  return await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);
}

// Legacy alias
export const getPointTransactions = getCreditTransactions;

/**
 * Get a specific credit transaction by userId and referenceId.
 * Used to look up dispute-related transactions for credit restoration.
 */
export async function getCreditTransactionByRef(
  userId: number,
  referenceId: string
) {
  const db = await getDb();
  if (!db) {
    log.warn(
      "[Database] Cannot get transaction by ref: database not available"
    );
    return null;
  }

  const result = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.referenceId, referenceId)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function deductCredits(
  userId: number,
  amount: number,
  type:
    | "generation"
    | "purchase"
    | "bonus"
    | "refund"
    | "signup"
    | "topup"
    | "subscription",
  description: string,
  referenceId?: string,
  engineUsed?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    return await withTransaction(async (tx) => {
      // ATOMIC DEDUCTION: Use SQL conditional update to prevent race conditions
      const updateResult = await tx.execute(
        sql`UPDATE ${credits} 
            SET ${credits.balance} = ${credits.balance} - ${amount},
                ${credits.creditsUsed} = COALESCE(${credits.creditsUsed}, 0) + ${amount}
            WHERE ${credits.userId} = ${userId} AND ${credits.balance} >= ${amount}`
      );

      const affectedRows =
        (updateResult as any)[0]?.affectedRows ??
        (updateResult as any).affectedRows ??
        0;

      if (affectedRows === 0) {
        // Read inside transaction to determine failure reason
        const userCreditsResult = await tx
          .select()
          .from(credits)
          .where(eq(credits.userId, userId))
          .limit(1);
        if (userCreditsResult.length === 0) {
          return { success: false, error: "User credits not found" };
        }
        return { success: false, error: "Insufficient credits" };
      }

      // Read new balance inside transaction for accurate balanceAfter
      const userCreditsResult = await tx
        .select({ balance: credits.balance })
        .from(credits)
        .where(eq(credits.userId, userId))
        .limit(1);
      const newBalance = userCreditsResult[0]?.balance ?? 0;

      await tx.insert(creditTransactions).values({
        userId,
        amount: -amount,
        type,
        description,
        referenceId,
        balanceAfter: newBalance,
        engineUsed: engineUsed || null,
      });

      return { success: true, newBalance };
    });
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to deduct credits:");
    return { success: false, error: "Failed to deduct credits" };
  }
}

// Legacy alias
export const deductPoints = deductCredits;

export async function addCredits(
  userId: number,
  amount: number,
  type:
    | "generation"
    | "purchase"
    | "bonus"
    | "refund"
    | "signup"
    | "topup"
    | "subscription",
  description: string,
  referenceId?: string
): Promise<{
  success: boolean;
  newBalance?: number;
  error?: string;
  duplicate?: boolean;
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    return await withTransaction(async (tx) => {
      // IDEMPOTENCY CHECK: If referenceId is provided, check for duplicate transaction
      if (referenceId) {
        const existing = await tx
          .select({ id: creditTransactions.id })
          .from(creditTransactions)
          .where(
            and(
              eq(creditTransactions.referenceId, referenceId),
              eq(creditTransactions.userId, userId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          log.warn(
            `[Database] Duplicate transaction detected: referenceId=${referenceId}, userId=${userId}. Skipping.`
          );
          const userCreditsResult = await tx
            .select({ balance: credits.balance })
            .from(credits)
            .where(eq(credits.userId, userId))
            .limit(1);
          return {
            success: true,
            newBalance: userCreditsResult[0]?.balance ?? 0,
            duplicate: true,
          };
        }
      }

      // ATOMIC ADDITION: Use SQL balance + amount to prevent race conditions
      // (same pattern as deductCredits — never read-then-write)
      const isPurchase =
        type === "purchase" || type === "topup" || type === "subscription";

      const updateResult = await tx.execute(
        isPurchase
          ? sql`UPDATE ${credits}
                SET ${credits.balance} = ${credits.balance} + ${amount},
                    ${credits.creditsPurchased} = COALESCE(${credits.creditsPurchased}, 0) + ${amount}
                WHERE ${credits.userId} = ${userId}`
          : sql`UPDATE ${credits}
                SET ${credits.balance} = ${credits.balance} + ${amount}
                WHERE ${credits.userId} = ${userId}`
      );

      const affectedRows =
        (updateResult as any)[0]?.affectedRows ??
        (updateResult as any).affectedRows ??
        0;

      if (affectedRows === 0) {
        return { success: false, error: "User credits not found" };
      }

      // Read the new balance AFTER the atomic update for the transaction log
      const userCreditsResult = await tx
        .select({ balance: credits.balance })
        .from(credits)
        .where(eq(credits.userId, userId))
        .limit(1);
      const newBalance = userCreditsResult[0]?.balance ?? 0;

      await tx.insert(creditTransactions).values({
        userId,
        amount,
        type,
        description,
        referenceId,
        balanceAfter: newBalance,
      });

      return { success: true, newBalance };
    });
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to add credits:");
    return { success: false, error: "Failed to add credits" };
  }
}

// Legacy alias
export const addPoints = addCredits;
