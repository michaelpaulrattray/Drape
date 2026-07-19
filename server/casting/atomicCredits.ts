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

import { randomUUID } from "node:crypto";
import { deductCredits, addCredits, normalizeCreditReferenceId } from "../db";
import { TRPCError } from "@trpc/server";
import { publicErrorMessage } from "../lib/publicError";
import { getDb } from "../db/connection";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("casting/atomicCredits");

interface AtomicCreditOptions {
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

interface AtomicCreditResult<T> {
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
/**
 * Deterministic refund reference for a charge reference. The charge writes a
 * `creditTransactions` row under its own referenceId. Charge and refund use
 * distinct deterministic ids so they remain different semantic transactions.
 * R7-1B's unique ledger index makes concurrent refund retries idempotent; an
 * accidental charge/refund reference reuse is now a typed collision instead
 * of a silently accepted duplicate.
 */
export function refundReferenceFor(chargeReferenceId: string): string {
  return normalizeCreditReferenceId(`refund:${chargeReferenceId}`);
}

/** What actually happened to a refund — the truth every user-facing surface
 *  must carry (final review correction 1): a refund that failed to record is
 *  NEVER reported as "you weren't charged". */
export interface RefundOutcome {
  recorded: boolean;
  amount: number;
  /** The deterministic refund reference — quoted to support for manual
   *  reconciliation when `recorded` is false. */
  reference: string;
}

/** Record a refund under the charge's derived reference, CHECK the result,
 *  and return the truthful outcome. The R7-1B database unique index is the
 *  final arbiter: exact concurrent retries return the winning current balance,
 *  while a mismatched amount/type is a critical collision failure. */
export async function recordRefund(
  userId: number,
  amount: number,
  description: string,
  chargeReferenceId: string,
): Promise<RefundOutcome> {
  const reference = refundReferenceFor(chargeReferenceId);
  const result = await addCredits(userId, amount, "refund", description, reference);
  if (!result.success) {
    log.error(
      { userId, amount, chargeReferenceId, reference, refundError: result.error },
      "[AtomicCredits] REFUND FAILED TO RECORD — user remains charged; recover manually with the refund reference",
    );
  }
  return { recorded: result.success, amount, reference };
}

/** The user-facing sentence for a refund outcome. */
export function refundTruth(outcome: RefundOutcome): string {
  return outcome.recorded
    ? `${outcome.amount} credits were refunded.`
    : `The automatic refund could not be recorded — quote reference ${outcome.reference} and support will restore the ${outcome.amount} credits.`;
}

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

  // One charge id per invocation — the refund id derives from it, so a retry
  // of the refund (never of the charge) is idempotent by construction. The
  // fallback is collision-resistant (final review correction 7): Date.now()
  // alone can collide across parallel requests.
  const chargeReferenceId = referenceId || `pending-${userId}-${randomUUID()}`;

  // Step 1: Atomically deduct credits BEFORE the operation
  const deductResult = await deductCredits(
    userId,
    amount,
    "generation",
    `${description} (pending)`,
    chargeReferenceId,
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
    // Step 4: Operation failed — refund under the DERIVED refund id (never
    // the charge id, which addCredits would dedupe against the deduction
    // row and silently skip), and CARRY THE TRUTH to the caller (final
    // review correction 1): the outgoing error message states exactly what
    // the ledger did, so no surface downstream can claim "you weren't
    // charged" when the refund didn't record.
    log.error({ err: error, userId, amount, chargeReferenceId }, `[AtomicCredits] Operation failed, refunding ${amount} credits`);
    const outcome = await recordRefund(userId, amount, `Refund: ${description} failed`, chargeReferenceId);

    // Sanitized outward message (final corrections): deliberately written
    // TRPCError/PublicError wording passes through; raw internal error text
    // (provider/DB/SDK) never does — it was logged in full above. The
    // truthful refund outcome is ALWAYS appended.
    const baseMessage = publicErrorMessage(error, "The operation failed.");
    if (error instanceof TRPCError) {
      throw new TRPCError({ code: error.code, message: `${baseMessage} ${refundTruth(outcome)}` });
    }
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `${baseMessage} ${refundTruth(outcome)}` });
  }
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
 * R7-1B LEDGER BOUNDARY: the balance update and ledger insert share one
 * transaction, and a unique (userId, referenceId) index arbitrates every
 * non-null reference. A losing transaction rolls its balance change back
 * before the existing row is classified. Exact refund retries are safe;
 * duplicate charges refuse and never authorize another provider call.
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
