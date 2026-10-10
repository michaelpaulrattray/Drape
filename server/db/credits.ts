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
  FREE_SIGNUP_GRANT_CREDITS,
  InsertCredits,
  InsertCreditTransaction,
  // Legacy aliases
  points,
  pointTransactions,
  InsertPoints,
  InsertPointTransaction,
} from "../../drizzle/schema";
import { getDb, withTransaction, type DbInstance, type TransactionHandle } from "./connection";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/credits");

/**
 * The free signup grant, DERIVED and never restated (#1602, working law 4).
 *
 * This was its own literal `5000` beside `PLAN_TIERS.free.monthlyCredits`'s
 * `5000` and the `points.balance` column default's `5000` — three copies of
 * one product promise, each of which could have been changed alone. The name
 * stays because this module's two call sites read well with it; the number is
 * the schema's.
 */
const INITIAL_CREDITS = FREE_SIGNUP_GRANT_CREDITS;
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

/**
 * WHICH GRANTS ARE THE CUSTOMER'S OWN MONEY (#1604).
 *
 * ⚠ `subscription` IS NOT ONE OF THEM, and that is the whole distinction this
 * predicate exists to hold. The `isPurchase` test inside `addCredits` — the
 * one that feeds `creditsPurchased`, the admin panel's lifetime analytics —
 * counts `purchase`, `topup` AND `subscription` together, because for
 * "how much has this account ever paid us for" a plan's monthly allowance
 * belongs with a top-up. For "what must a renewal not take back" it is the
 * opposite: a plan's allowance is precisely the thing the plan's rollover
 * percentage governs. Folding the two readings into one predicate would
 * protect the allowance from its own rollover rule and no renewal would ever
 * forfeit anything.
 *
 * So the two live side by side on purpose. `creditsPurchased`'s predicate is
 * NOT changed by this card; the admin panel's numbers do not move.
 */
export function isPurchasedCreditGrant(type: CreditTransactionType | string): boolean {
  return type === "topup" || type === "purchase";
}

/**
 * WHICH GRANTS GIVE BACK A SPEND RATHER THAN ADD NEW CREDITS (#2185).
 *
 * A `refund` puts back credits a charge took: a failed roll, a lost Sign view,
 * a dispute the customer won, a Stripe refund that never went back. It is not
 * new money and not a gift, so it must come back to the bucket it left. The
 * settle in `addCreditsIn` cannot do that — it clamps the purchased bound to
 * the balance AFTER the charge, so the top-up credits the charge used are
 * forgotten before the refund lands, and the refund comes back as plan
 * credits that a cancelled plan's expiry, a renewal's rollover or a downgrade
 * then takes away.
 *
 * Worked, the card's own example: 10,000 plan credits and a 5,000 top-up
 * (balance 15,000, bound 5,000). A 15,000 roll spends the plan credits first
 * and the top-up last: balance 0, bound still 5,000 — the deduct never writes
 * it. The roll fails and 15,000 comes back. With the settle, the bound became
 * `min(5,000, 0)` = 0 first, and at day 30 the whole 15,000 expired. Without
 * it, `min(5,000, 15,000)` = 5,000 is still the customer's top-up and only the
 * 10,000 plan credits expire.
 *
 * ⚠ WHY SKIPPING THE SETTLE IS EXACT, NOT GENEROUS. Between two settles the
 * bound only ever moves on a grant; charges and refunds leave it alone, so
 * `min(bound, balance)` is the "plan spends first" rule applied to the NET of
 * every charge and refund since the last grant. A refund undoes its charge in
 * that net, which is what restoring the charge's own bucket means. Where
 * several charges were in flight, the net is the right reading: once one is
 * refunded, the plan-first rule bills the ones that remain to the plan first.
 * It can never protect more than the bound, which is a number the customer
 * paid for at the last grant.
 *
 * ⚠ ITS STATED LIMIT: a grant that lands BETWEEN the charge and its refund (a
 * renewal, a top-up, a bonus) settles the bound and forgets the charge, so
 * that refund comes back as plan credits, as every refund did before this
 * card. Roll and Sign refunds settle within minutes; a dispute can take weeks.
 * Closing that needs the charge's purchased share written on its own ledger
 * row, which is a schema change and its own card.
 *
 * Bonuses, signup credits and staff goodwill are NOT reversals and keep the
 * settle: how they should expire is the founder's decision on #2185, not this
 * predicate's.
 */
export function isSpendReversal(type: CreditTransactionType | string): boolean {
  return type === "refund";
}

/**
 * HOW MANY OF A BALANCE'S CREDITS THE CUSTOMER PAID FOR — the only reader of
 * `points.purchasedBalance`, and the whole of #1604's arithmetic.
 *
 * The product's rule, chosen here rather than inherited: **purchased credits
 * are the LAST to go.** A plan's monthly allowance spends first. That rule is
 * what makes one number enough where Phase 2 wants lots — the purchased
 * credits remaining are the LESSER of the column and the live balance, exactly,
 * with nothing written on the spend path.
 *
 * Worked, because the card's done-when is a row: a Starter account holding
 * 25,000 bought credits and 10,000 of its allowance has `balance` 35,000 and
 * `purchasedBalance` 25,000 — so 25,000 is protected and 10,000 is the plan's
 * part, which is what the rollover percentage is applied to. Spend 30,000 of
 * it and the balance is 5,000: the allowance went first, 20,000 of the bought
 * credits went after it, and `min(25,000, 5,000)` says 5,000 remain. Right
 * both times, from one number.
 *
 * ⚠ IT IS DEFENSIVE ABOUT ITS INPUTS AND SAYS SO. Both columns are
 * `NOT NULL DEFAULT 0`, so neither can be absent on a live row; a caller
 * holding a partial projection or a test double is the real case, and
 * answering 0 there is the only direction that cannot invent protection for
 * credits nobody bought.
 */
export function purchasedCreditsRemaining(row: {
  balance: number;
  purchasedBalance?: number | null;
}): number {
  const balance = Number.isFinite(row.balance) ? Math.max(0, Math.floor(row.balance)) : 0;
  const purchased =
    typeof row.purchasedBalance === "number" && Number.isFinite(row.purchasedBalance)
      ? Math.max(0, Math.floor(row.purchasedBalance))
      : 0;
  return Math.min(purchased, balance);
}

/**
 * The part of a balance the plan's own rules govern — everything that is not
 * the customer's purchased credits. This is what a rollover percentage is
 * applied to and what a plan-change unwind may claw back.
 */
export function planAllowanceRemaining(row: {
  balance: number;
  purchasedBalance?: number | null;
}): number {
  const balance = Number.isFinite(row.balance) ? Math.max(0, Math.floor(row.balance)) : 0;
  return balance - purchasedCreditsRemaining(row);
}

/**
 * What a tool charge MADE — the founder's output-kind taxonomy (#401, his
 * words: "i think for now tools should just refer to was an image generated?
 * its filed as image or video? its video or LLM its LLM or Text … but it can
 * grow"). A documented set over a varchar column, not a DB enum, so growing
 * it is an edit here rather than a migration. As of 2026-09-03 every tool
 * charge in the product generates images; "video" and "text" are reserved.
 */
export type CreditToolKind = "image" | "video" | "text";

/**
 * Required on every deduction — the ruling that keeps toolKind honest where
 * engineUsed rotted (null on 53% of real spend, #387):
 *
 * - `toolKind: CreditToolKind` states what the charge made.
 * - `toolKind: null` states, deliberately, that the row is NOT a tool charge
 *   at all. Two live cases: the chargeback revoke in stripe/webhooks.ts and
 *   the plan-change credit unwind in routes/billing.ts (#664).
 *   Null never means "unlabelled tool charge": the field is required, so a
 *   new charge site cannot compile without its author deciding.
 * - A charged operation with genuinely no output kind has no live instance
 *   today (measured at every call site, 2026-09-03: mint package, refresh
 *   views and the evidence package sync all charge only to generate view
 *   images). If one ever appears, its author grows the set here rather than
 *   writing null.
 */
export interface CreditDeductionAttribution {
  toolKind: CreditToolKind | null;
  /** Engine identifier (Flash fallback pricing / castingV2 transport). */
  engineUsed?: string;
}

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
        // Named rather than left to the column default (#1604,
        // `migration-before-code`): a new account has bought nothing, and the
        // row says so instead of inheriting it.
        purchasedBalance: 0,
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
    // ⚠ THROWS, NEVER `null` (#789, PR #787's round-2 review): `null` here
    // meant both "no such row" and "database unavailable", and the two
    // webhook handlers that restore credits from a deduction row read it as
    // the first — a delivery in a no-db window ACKed a real deduction as
    // "nothing to restore" and Stripe never sent it again. A throw reaches
    // the webhook's outer catch, which answers 400 so Stripe redelivers; the
    // moderator's refund door reports an error instead of a false "no
    // purchase matches"; and the two ledger callers in `admin.ts` and
    // `billing.ts` sit inside the catch of a transaction that just ran on
    // this same cached connection, so a null db cannot reach them.
    log.error("[Database] Cannot get transaction by ref: database not available");
    throw new Error("Database not available");
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
  referenceId: string | undefined,
  attribution: CreditDeductionAttribution
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
        engineUsed: attribution.engineUsed || null,
        toolKind: attribution.toolKind,
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
    return await withTransaction((tx) =>
      addCreditsIn(tx, userId, amount, type, description, ledgerReferenceId));
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

/**
 * THE GRANT ITSELF, INSIDE A TRANSACTION THE CALLER ALREADY HOLDS (#2127).
 *
 * `addCredits` is this plus its own transaction and the duplicate-reference
 * classification, and it is unchanged in behaviour — its body moved here
 * verbatim. The reason to expose it is a refund that must be decided under a
 * lock the caller holds: a Sign view lost to a refused sheet refunds its share
 * in the SAME transaction that holds the Sign's operation row `FOR UPDATE`,
 * so the recovery sweep (which moves that row out of `running` before it
 * refunds) and the live refund are serialized by the database rather than
 * by timing.
 *
 * ⚠ **A duplicate reference THROWS here and rolls the caller's transaction
 * back** — there is no classification inside a transaction that has already
 * failed. A caller that can meet a repeat checks for the reference first, in
 * the same transaction.
 */
export async function addCreditsIn(
  tx: TransactionHandle,
  userId: number,
  amount: number,
  type: CreditTransactionType,
  description: string,
  ledgerReferenceId: string | undefined,
): Promise<CreditWriteResult> {
  // ATOMIC ADDITION: Use SQL balance + amount to prevent race conditions.
  // The unique ledger index, not a prior SELECT, arbitrates concurrent
  // references. If the insert loses, this update rolls back before the
  // catch below classifies the already-committed row.
  const isPurchase =
    type === "purchase" || type === "topup" || type === "subscription";

  /*
    ⚠ THE PURCHASED UPPER BOUND IS SETTLED AGAINST THE BALANCE *BEFORE*
    THIS GRANT LANDS (#1604), AND IT IS ITS OWN STATEMENT ON PURPOSE.

    `purchasedBalance` is an upper bound that `purchasedCreditsRemaining`
    reads as `min(column, balance)` — exact, because purchased credits
    spend last. The one thing that can make the bound meaningless is a
    grant: an account that bought 25,000 credits and spent every one of
    them still carries 25,000 in the column, so the next bonus or admin
    adjustment would arrive and be read as purchased credits the customer
    never has. Settling the bound to the pre-grant balance is what closes
    that, and it runs for every grant kind but one (below).

    It is a separate UPDATE rather than a clause because the clamp must
    read the OLD balance. MySQL evaluates `SET` assignments left to right,
    so a clamp folded into the statement below would be correct only while
    it sat ABOVE the `balance` assignment — a silent, order-dependent
    correctness nobody reading the SQL would suspect. Two statements inside
    one transaction cost a grant one round trip, grants are not the hot
    path (the deduct is, and this card does not touch it), and the second
    statement below is still the one whose `affectedRows` decides whether
    the account exists.

    ⚠ EXCEPT A REFUND (#2185). A refund gives back a spend, and the settle
    would forget which credits that spend used — so a refunded top-up came
    back as plan credits and expired with the plan. See `isSpendReversal`.
  */
  if (!isSpendReversal(type)) {
    await tx.execute(
      sql`UPDATE ${credits}
          SET ${credits.purchasedBalance} = LEAST(${credits.purchasedBalance}, ${credits.balance})
          WHERE ${credits.userId} = ${userId}`
    );
  }

  /*
    Three statements, and the two predicates are deliberately NOT one.
    `isPurchase` decides the lifetime analytics counter and keeps its own
    three types including `subscription`; `isPurchasedCreditGrant` decides
    what a renewal must protect and excludes it. See the predicate's own
    docblock — folding them would make a plan's allowance immune to its
    plan's rollover rule.
  */
  const grantStatement = isPurchasedCreditGrant(type)
    ? sql`UPDATE ${credits}
            SET ${credits.balance} = ${credits.balance} + ${amount},
                ${credits.creditsPurchased} = COALESCE(${credits.creditsPurchased}, 0) + ${amount},
                ${credits.purchasedBalance} = ${credits.purchasedBalance} + ${amount}
            WHERE ${credits.userId} = ${userId}`
    : isPurchase
      ? sql`UPDATE ${credits}
            SET ${credits.balance} = ${credits.balance} + ${amount},
                ${credits.creditsPurchased} = COALESCE(${credits.creditsPurchased}, 0) + ${amount}
            WHERE ${credits.userId} = ${userId}`
      : sql`UPDATE ${credits}
            SET ${credits.balance} = ${credits.balance} + ${amount}
            WHERE ${credits.userId} = ${userId}`;

  const updateResult = await tx.execute(grantStatement);

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
}
