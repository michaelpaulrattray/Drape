/**
 * Atomic Credit Deduction Helper
 * 
 * This module provides a universal security pattern for credit-based operations.
 * It ensures credits are deducted BEFORE expensive operations (like AI generation)
 * and automatically refunded if the operation fails.
 * 
 * SECURITY: This prevents race condition attacks where multiple simultaneous
 * requests could bypass balance checks and consume more credits than available.
 * 
 * USAGE:
 * ```typescript
 * const result = await withAtomicCredits(
 *   ctx.user.id,
 *   POINT_COSTS.castingImage,
 *   "Casting image generation",
 *   async () => {
 *     // Your expensive operation here
 *     return await generateCastingImage(...);
 *   }
 * );
 * ```
 */

import { deductCredits, addCredits } from "../db";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db/connection";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("casting/atomicCredits");

export interface AtomicCreditOptions {
  /** User ID to deduct credits from */
  userId: number;
  /** Amount of credits to deduct */
  amount: number;
  /** Description for the transaction log */
  description: string;
  /** Optional reference ID for tracking */
  referenceId?: string;
  /** Engine used for the operation (for analytics) */
  engineUsed?: string;
}

export interface AtomicCreditResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  creditsDeducted: number;
}

/**
 * Execute an operation with atomic credit deduction.
 * 
 * Credits are deducted BEFORE the operation starts.
 * If the operation fails, credits are automatically refunded.
 * 
 * @param options - Credit deduction options
 * @param operation - The async operation to execute
 * @returns The result of the operation
 * @throws TRPCError if insufficient credits or operation fails
 */
export async function withAtomicCredits<T>(
  options: AtomicCreditOptions,
  operation: () => Promise<T>
): Promise<T> {
  const { userId, amount, description, referenceId, engineUsed } = options;
  
  // Step 0: Check if account is frozen (blocks all generation)
  const db = await getDb();
  if (db) {
    const [user] = await db
      .select({ frozenAt: users.frozenAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (user?.frozenAt) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your account is currently under review. Generations are temporarily paused while we verify your billing records. This usually resolves within 24-48 hours.",
      });
    }
  }

  // Step 1: Atomically deduct credits BEFORE the operation
  const deductResult = await deductCredits(
    userId,
    amount,
    "generation",
    `${description} (pending)`,
    referenceId || `pending-${Date.now()}`,
    engineUsed
  );
  
  if (!deductResult.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: deductResult.error || `Insufficient credits. Need ${amount} credits.`,
    });
  }
  
  try {
    // Step 2: Execute the expensive operation
    const result = await operation();
    
    // Step 3: Operation succeeded - credits stay deducted
    return result;
    
  } catch (error) {
    // Step 4: Operation failed - refund the credits
    log.info(`[AtomicCredits] Operation failed, refunding ${amount} credits to user ${userId}`);
    
    await addCredits(
      userId,
      amount,
      "refund",
      `Refund: ${description} failed`,
      referenceId || `refund-${Date.now()}`
    );
    
    // Re-throw the original error
    throw error;
  }
}

/**
 * Convenience wrapper that includes rate limiting check.
 * Use this for generation endpoints that need both rate limiting and atomic credits.
 */
export async function withAtomicCreditsAndRateLimit<T>(
  options: AtomicCreditOptions & { rateLimitKey: string },
  checkRateLimitFn: (key: string) => { allowed: boolean; resetIn: number },
  rateLimitErrorFn: (resetIn: number) => string,
  operation: () => Promise<T>
): Promise<T> {
  const { rateLimitKey, ...creditOptions } = options;
  
  // Step 1: Check rate limit first (cheap operation)
  const rateCheck = checkRateLimitFn(rateLimitKey);
  if (!rateCheck.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: rateLimitErrorFn(rateCheck.resetIn),
    });
  }
  
  // Step 2: Execute with atomic credits
  return withAtomicCredits(creditOptions, operation);
}

/**
 * Documentation for future developers:
 * 
 * WHY ATOMIC CREDITS?
 * -------------------
 * Without atomic credit deduction, the following attack is possible:
 * 
 * 1. User has 10 credits, generation costs 5 credits
 * 2. User sends 5 simultaneous requests
 * 3. All 5 requests check balance: 10 >= 5 ✓ (all pass)
 * 4. All 5 requests start expensive AI generation
 * 5. All 5 requests deduct 5 credits each (total: 25 credits deducted)
 * 6. User gets 5 generations but only paid for 2
 * 
 * With atomic credits:
 * 1. User has 10 credits, generation costs 5 credits
 * 2. User sends 5 simultaneous requests
 * 3. Request 1 atomically deducts 5 → balance: 5 ✓
 * 4. Request 2 atomically deducts 5 → balance: 0 ✓
 * 5. Requests 3-5 fail: balance 0 < 5 ✗
 * 6. User gets exactly 2 generations as expected
 * 
 * HOW TO USE:
 * -----------
 * Replace this pattern:
 * ```typescript
 * // ❌ VULNERABLE - check then deduct
 * const balance = await getUserCredits(userId);
 * if (balance < cost) throw new Error("Insufficient credits");
 * const result = await expensiveOperation();
 * await deductCredits(userId, cost, ...);
 * ```
 * 
 * With this pattern:
 * ```typescript
 * // ✅ SECURE - atomic deduct with refund on failure
 * const result = await withAtomicCredits(
 *   { userId, amount: cost, description: "Operation" },
 *   async () => await expensiveOperation()
 * );
 * ```
 */
