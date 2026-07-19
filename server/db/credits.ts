/**
 * Credits Domain — credit/point initialization, balance queries, deductions, additions.
 *
 * All multi-step write operations are wrapped in database transactions
 * to prevent data inconsistency on partial failures.
 */

import { createHash } from "node:crypto";
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
import { getDb, withTransaction, type DbInstance } from "./connection";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/credits");

const INITIAL_CREDITS = 5000; // Free tier starting credits (50x display multiplier)
const CREDIT_REFERENCE_MAX_LENGTH = 64;

/** Preserve readable references that fit varchar(64); hash longer child ids. */
export function normalizeCreditReferenceId(referenceId: string): string {
  if (referenceId.length <= CREDIT_REFERENCE_MAX_LENGTH) return referenceId;
  const digest = createHash("sha256").update(referenceId).digest("hex");
  return `sha256:${digest.slice(0, CREDIT_REFERENCE_MAX_LENGTH - "sha256:".length)}`;
}

export type CreditTransactionType =
  | "generation"
  | "purchase"
  | "bonus"
  | "refund"
  | "signup"
  | "topup"
  | "subscription";

export interface CreditWriteResult {
  success: boolean;
  newBalance?: number;
  error?: string;
  /** The unique ledger reference already exists. */
  duplicate?: boolean;
  /** The existing row disagrees with the requested type or signed amount. */
  collision?: boolean;
}

interface CreditReferenceSemantics {
  type: string;
  amount: number;
}

interface ExistingCreditReference extends CreditReferenceSemantics {
  id: number;
}

/** MySQL/Drizzle can wrap driver errors, so inspect the short cause chain. */
export function isDuplicateCreditReferenceError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; errno?: unknown; cause?: unknown };
    if (candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062) return true;
    current = candidate.cause;
  }
  return false;
}

export function creditReferenceSemanticsMatch(
  existing: CreditReferenceSemantics,
  expected: CreditReferenceSemantics,
): boolean {
  return existing.type === expected.type && existing.amount === expected.amount;
}

async function loadReferenceAndBalance(
  db: DbInstance,
  userId: number,
  referenceId: string,
) {
  const [existing] = await db
    .select({
      id: creditTransactions.id,
      type: creditTransactions.type,
      amount: creditTransactions.amount,
    })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.referenceId, referenceId),
      ),
    )
    .limit(1);
  const [balanceRow] = await db
    .select({ balance: credits.balance })
    .from(credits)
    .where(eq(credits.userId, userId))
    .limit(1);
  return { existing, balance: balanceRow?.balance };
}

async function resolveDuplicateCreditReference(
  db: DbInstance,
  mode: "add" | "deduct",
  userId: number,
  referenceId: string,
  expected: CreditReferenceSemantics,
): Promise<CreditWriteResult> {
  const { existing, balance } = await loadReferenceAndBalance(db, userId, referenceId);
  if (!existing) {
    log.error(
      { userId, referenceId, mode },
      "[Database] Unique credit-reference violation had no readable winning row",
    );
    return { success: false, error: "Failed to reconcile duplicate credit reference" };
  }

  return classifyExistingCreditReference(mode, userId, referenceId, existing, expected, balance);
}

function classifyExistingCreditReference(
  mode: "add" | "deduct",
  userId: number,
  referenceId: string,
  existing: ExistingCreditReference,
  expected: CreditReferenceSemantics,
  balance?: number,
): CreditWriteResult {
  if (!creditReferenceSemanticsMatch(existing, expected)) {
    log.fatal(
      {
        userId,
        referenceId,
        mode,
        existing: { id: existing.id, type: existing.type, amount: existing.amount },
        requested: expected,
      },
      "[Database] CRITICAL credit-reference collision — refusing mismatched ledger write",
    );
    return {
      success: false,
      error: "Credit reference collision",
      duplicate: true,
      collision: true,
    };
  }

  if (mode === "deduct") {
    log.warn({ userId, referenceId }, "[Database] Duplicate credit deduction refused");
    return {
      success: false,
      error: "Credit charge already recorded",
      duplicate: true,
    };
  }

  if (balance === undefined) {
    log.error(
      { userId, referenceId },
      "[Database] Duplicate credit addition matched but current balance was unavailable",
    );
    return { success: false, error: "User credits not found", duplicate: true };
  }

  log.warn({ userId, referenceId }, "[Database] Duplicate credit addition confirmed; returning current balance");
  return { success: true, newBalance: balance, duplicate: true };
}

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

  const ledgerReferenceId = normalizeCreditReferenceId(referenceId);
  const result = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.referenceId, ledgerReferenceId)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function deductCredits(
  userId: number,
  amount: number,
  type: CreditTransactionType,
  description: string,
  referenceId?: string,
  engineUsed?: string
): Promise<CreditWriteResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }
  const ledgerReferenceId = referenceId
    ? normalizeCreditReferenceId(referenceId)
    : undefined;

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
        // A replay can arrive after the winning charge reduced the balance
        // below this amount. Classify the existing reference before reporting
        // insufficient credits so every repeated charge remains a typed
        // duplicate refusal even when it cannot reach the unique insert.
        if (ledgerReferenceId) {
          const [existing] = await tx
            .select({
              id: creditTransactions.id,
              type: creditTransactions.type,
              amount: creditTransactions.amount,
            })
            .from(creditTransactions)
            .where(
              and(
                eq(creditTransactions.userId, userId),
                eq(creditTransactions.referenceId, ledgerReferenceId),
              ),
            )
            .limit(1);
          if (existing) {
            return classifyExistingCreditReference(
              "deduct",
              userId,
              ledgerReferenceId,
              existing,
              { type, amount: -amount },
            );
          }
        }

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
        referenceId: ledgerReferenceId,
        balanceAfter: newBalance,
        engineUsed: engineUsed || null,
      });

      return { success: true, newBalance };
    });
  } catch (error) {
    // A duplicate ledger insert rolls the preceding balance update back.
    // Classify the already-committed row only after that rollback completes.
    if (ledgerReferenceId && isDuplicateCreditReferenceError(error)) {
      return resolveDuplicateCreditReference(
        db,
        "deduct",
        userId,
        ledgerReferenceId,
        { type, amount: -amount },
      );
    }
    log.error({ err: error }, "[Database] Failed to deduct credits:");
    return { success: false, error: "Failed to deduct credits" };
  }
}

// Legacy alias
export const deductPoints = deductCredits;

export async function addCredits(
  userId: number,
  amount: number,
  type: CreditTransactionType,
  description: string,
  referenceId?: string
): Promise<CreditWriteResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }
  const ledgerReferenceId = referenceId
    ? normalizeCreditReferenceId(referenceId)
    : undefined;

  try {
    return await withTransaction(async (tx) => {
      // ATOMIC ADDITION: Use SQL balance + amount to prevent race conditions.
      // The unique ledger index, not a prior SELECT, arbitrates concurrent
      // references. If the insert loses, this update rolls back before the
      // catch below classifies the already-committed row.
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
        referenceId: ledgerReferenceId,
        balanceAfter: newBalance,
      });

      return { success: true, newBalance };
    });
  } catch (error) {
    if (ledgerReferenceId && isDuplicateCreditReferenceError(error)) {
      return resolveDuplicateCreditReference(
        db,
        "add",
        userId,
        ledgerReferenceId,
        { type, amount },
      );
    }
    log.error({ err: error }, "[Database] Failed to add credits:");
    return { success: false, error: "Failed to add credits" };
  }
}

// Legacy alias
export const addPoints = addCredits;
