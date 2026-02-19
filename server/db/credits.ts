/**
 * Credits Domain — credit/point initialization, balance queries, deductions, additions.
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
import { getDb } from "./connection";

const INITIAL_CREDITS = 5000; // Free tier starting credits (50x display multiplier)

export async function initializeUserCredits(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot initialize credits: database not available");
    return;
  }

  try {
    // Create credits record
    await db.insert(credits).values({
      userId,
      balance: INITIAL_CREDITS,
      planTier: "free",
      creditsPurchased: 0,
      creditsUsed: 0,
      rolloverCredits: 0,
    });

    // Record the signup bonus transaction
    await db.insert(creditTransactions).values({
      userId,
      amount: INITIAL_CREDITS,
      type: "signup",
      description: "Welcome bonus - free credits for new users",
      balanceAfter: INITIAL_CREDITS,
    });
  } catch (error) {
    console.error("[Database] Failed to initialize user credits:", error);
    throw error;
  }
}

// Legacy alias
export const initializeUserPoints = initializeUserCredits;

export async function getUserCredits(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get credits: database not available");
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
    console.warn("[Database] Cannot get transactions: database not available");
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
    console.warn(
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
    // ATOMIC DEDUCTION: Use SQL conditional update to prevent race conditions
    const updateResult = await db.execute(
      sql`UPDATE ${credits} 
          SET balance = balance - ${amount},
              credits_used = COALESCE(credits_used, 0) + ${amount}
          WHERE user_id = ${userId} AND balance >= ${amount}`
    );

    const affectedRows =
      (updateResult as any)[0]?.affectedRows ??
      (updateResult as any).affectedRows ??
      0;

    if (affectedRows === 0) {
      const userCredits = await getUserCredits(userId);
      if (!userCredits) {
        return { success: false, error: "User credits not found" };
      }
      return { success: false, error: "Insufficient credits" };
    }

    const userCredits = await getUserCredits(userId);
    const newBalance = userCredits?.balance ?? 0;

    await db.insert(creditTransactions).values({
      userId,
      amount: -amount,
      type,
      description,
      referenceId,
      balanceAfter: newBalance,
      engineUsed: engineUsed || null,
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error("[Database] Failed to deduct credits:", error);
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
    // IDEMPOTENCY CHECK: If referenceId is provided, check for duplicate transaction
    if (referenceId) {
      const existing = await db
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
        console.warn(
          `[Database] Duplicate transaction detected: referenceId=${referenceId}, userId=${userId}. Skipping.`
        );
        const userCredits = await getUserCredits(userId);
        return {
          success: true,
          newBalance: userCredits?.balance ?? 0,
          duplicate: true,
        };
      }
    }

    // ATOMIC ADDITION: Use SQL balance + amount to prevent race conditions
    // (same pattern as deductCredits — never read-then-write)
    const isPurchase =
      type === "purchase" || type === "topup" || type === "subscription";

    const updateResult = await db.execute(
      isPurchase
        ? sql`UPDATE ${credits}
              SET balance = balance + ${amount},
                  credits_purchased = COALESCE(credits_purchased, 0) + ${amount}
              WHERE user_id = ${userId}`
        : sql`UPDATE ${credits}
              SET balance = balance + ${amount}
              WHERE user_id = ${userId}`
    );

    const affectedRows =
      (updateResult as any)[0]?.affectedRows ??
      (updateResult as any).affectedRows ??
      0;

    if (affectedRows === 0) {
      return { success: false, error: "User credits not found" };
    }

    // Read the new balance AFTER the atomic update for the transaction log
    const userCredits = await getUserCredits(userId);
    const newBalance = userCredits?.balance ?? 0;

    await db.insert(creditTransactions).values({
      userId,
      amount,
      type,
      description,
      referenceId,
      balanceAfter: newBalance,
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error("[Database] Failed to add credits:", error);
    return { success: false, error: "Failed to add credits" };
  }
}

// Legacy alias
export const addPoints = addCredits;
