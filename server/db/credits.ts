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
 * ⚠ WHAT SKIPPING THE SETTLE READS. Between two settles the bound only ever
 * moves on a grant; charges and refunds leave it alone, so `min(bound,
 * balance)` is the "plan spends first" rule applied to the NET of every charge
 * and refund since the last grant. For a refund of a charge made SINCE that
 * grant, the refund undoes its charge in that net, which is what restoring the
 * charge's own bucket means. Where several such charges were in flight, the
 * net is the reading: once one is refunded, the plan-first rule bills the ones
 * that remain to the plan first.
 *
 * ⚠ ITS STATED LIMIT, AND IT RUNS BOTH WAYS. A refund of a charge made BEFORE
 * the last grant (a renewal, a top-up, a bonus — any grant settles the bound
 * and forgets the charge) is not restored to its own bucket. Which way it
 * lands depends on what was spent since that grant:
 *   - it can come back as PLAN credits when its charge used top-up credits —
 *     the top-up share is lost, as every refund's was before this card;
 *   - it can be read as PURCHASED when its charge used plan credits and the
 *     top-up has been spent since — the customer's way. Worked: a renewal
 *     settles the bound to 5,000 on a balance of 15,000; a 15,000 charge spends
 *     the plan credits, then the top-up (balance 0, bound still 5,000); a 2,000
 *     refund of a PRE-renewal plan charge lands and `min(5,000, 2,000)` reads
 *     all 2,000 as purchased, so they escape expiry, rollover and a downgrade
 *     trim. Pinned in `server/refundRestoresItsBucket.test.ts`.
 * Either way the purchased reading is capped by the bound, a number the
 * customer paid for at the last grant, so a refund can never make more
 * credits protected than were bought. Roll and Sign refunds settle within
 * minutes, so they rarely straddle a grant; a dispute can take weeks. Closing
 * the limit needs the charge's purchased share written on its own ledger row,
 * which is a schema change and its own card.
 *
 * The same holds for every bound since #2185's second half: between two
 * grants none of them moves, so a refund of a charge made since the last grant
 * comes back to the buckets that charge used, whichever they were.
 *
 * Bonuses, signup credits and staff goodwill are NOT reversals and keep the
 * settle; which bucket each lands in is {@link grantBucket}'s answer.
 */
export function isSpendReversal(type: CreditTransactionType | string): boolean {
  return type === "refund";
}

/**
 * WHICH CREDITS ON A BALANCE ARE WHICH — the only reader of the four bound
 * columns (`purchasedBalance`, `keptBalance`, `signupBalance`, `promoBalance`),
 * and the whole of #1604's arithmetic, widened by #2185.
 *
 * His ruling on #2185, 2026-10-10 (terminal), verbatim: *"Referral credits
 * (proposed) Never expire, same as top-ups."*, *"promo and signup bonuses
 * after 90 days? Expire after 90 days."* and, on the Free account's starting
 * credits, *"the free plan credits can last forever sure"*. So:
 *
 *   purchased  top-ups                 never expire
 *   kept       referral, staff goodwill never expire
 *   signup     starting credits        never on Free; 90 days after an upgrade
 *   promo      promo bonuses           90 days after the grant
 *   plan       everything else         the plan's rules (rollover, downgrade
 *                                      trim, 30 days after a cancel)
 *
 * **The spend order is {@link BUCKET_SPEND_ORDER}: the plan's credits go
 * first, then the ones that expire, then the ones that never do, and top-ups
 * last of all.** That order is what makes one number per bucket enough: each
 * bucket remaining is the LESSER of its bound and what the buckets spent after
 * it leave over, exactly, with nothing written on the spend path. A grant
 * settles every bound to its reading first (`addCreditsIn`), so a bucket the
 * customer has spent cannot be resurrected by a later grant.
 *
 * Worked, #1604's own row: 25,000 bought and 10,000 of a plan's allowance is
 * `balance` 35,000, `purchasedBalance` 25,000 — 25,000 purchased, 10,000 plan.
 * Spend 30,000: balance 5,000, and `min(25,000, 5,000)` = 5,000 purchased,
 * 0 plan. Add a 2,000 referral reward on top of that and the settle leaves the
 * purchased bound at 5,000 and the kept bound at 2,000: balance 7,000, every
 * credit accounted for.
 *
 * ⚠ IT IS DEFENSIVE ABOUT ITS INPUTS AND SAYS SO. The columns are `NOT NULL
 * DEFAULT 0`, so none can be absent on a live row; a caller holding a partial
 * projection or a test double is the real case, and answering 0 there reads
 * those credits as the PLAN's — the direction that cannot invent protection
 * for credits nobody was given.
 */
export type CreditBucket = "plan" | "promo" | "signup" | "kept" | "purchased";

/** First spent to last spent. Every reader derives from this list. */
export const BUCKET_SPEND_ORDER: readonly CreditBucket[] = ["plan", "promo", "signup", "kept", "purchased"];

/** The column holding each non-plan bucket's upper bound. */
export const BUCKET_BOUND_COLUMN = {
  promo: "promoBalance",
  signup: "signupBalance",
  kept: "keptBalance",
  purchased: "purchasedBalance",
} as const satisfies Record<Exclude<CreditBucket, "plan">, string>;

export type CreditBucketBounds = {
  [K in (typeof BUCKET_BOUND_COLUMN)[keyof typeof BUCKET_BOUND_COLUMN]]: number;
};

export type CreditBucketRow = {
  balance: number;
  purchasedBalance?: number | null;
  keptBalance?: number | null;
  signupBalance?: number | null;
  promoBalance?: number | null;
};

/** How long a timed bonus lasts: a promo from its grant, starting credits from an upgrade. */
export const TIMED_BONUS_LIFE_DAYS = 90;

function wholeNonNegative(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function creditBuckets(row: CreditBucketRow): Record<CreditBucket, number> {
  let left = wholeNonNegative(row.balance);
  const out = { plan: 0, promo: 0, signup: 0, kept: 0, purchased: 0 } as Record<CreditBucket, number>;
  // Last spent is read first: it keeps the most of what is left.
  for (const bucket of [...BUCKET_SPEND_ORDER].reverse()) {
    if (bucket === "plan") {
      out.plan = left;
      continue;
    }
    const take = Math.min(wholeNonNegative(row[BUCKET_BOUND_COLUMN[bucket]]), left);
    out[bucket] = take;
    left -= take;
  }
  return out;
}

/** Every bound settled to what its bucket actually holds — what a grant writes first. */
export function settledCreditBounds(row: CreditBucketRow): CreditBucketBounds {
  const buckets = creditBuckets(row);
  return {
    purchasedBalance: buckets.purchased,
    keptBalance: buckets.kept,
    signupBalance: buckets.signup,
    promoBalance: buckets.promo,
  };
}

/**
 * The part of a balance the plan's own rules govern — everything that is not a
 * top-up, a referral reward, staff goodwill, starting credits or a promo. This
 * is what a rollover percentage is applied to, what a plan-change unwind may
 * claw back, and what a cancelled plan's expiry takes.
 */
export function planAllowanceRemaining(row: CreditBucketRow): number {
  return creditBuckets(row).plan;
}

/**
 * The credits the plan's rules never touch — the balance minus the plan's
 * part. A renewal and a cancelled plan's expiry carry these across whole;
 * starting credits and promos leave only by their own expiry.
 */
export function creditsOutsidePlanRules(row: CreditBucketRow): number {
  return wholeNonNegative(row.balance) - planAllowanceRemaining(row);
}

/**
 * Where a `bonus` came from, stated by its caller (#2185). The ledger's `type`
 * column is one `bonus` for all of them, and it stays that way — the type is
 * a MySQL enum that the moderator filters and exports also list, so a new
 * value would be a column change and a wider diff than the rule needs.
 *
 * ⚠ OMITTED MEANS THE PLAN'S. The two remaining `bonus` writers are a plan
 * change's prorated credits (`server/stripe/planChangeSettlement.ts` and the
 * legacy road in `server/routes/billing.ts`), and those ARE plan credits.
 */
export type BonusSource = "referral" | "goodwill" | "promo";

/** Which bucket a grant lands in, or `reversal` for a refund (see {@link isSpendReversal}). */
export function grantBucket(
  type: CreditTransactionType | "admin_add" | string,
  bonusSource?: BonusSource,
): CreditBucket | "reversal" {
  if (isSpendReversal(type)) return "reversal";
  if (isPurchasedCreditGrant(type)) return "purchased";
  if (type === "admin_add") return "kept";
  if (type === "signup") return "signup";
  if (type === "bonus") {
    if (bonusSource === "referral" || bonusSource === "goodwill") return "kept";
    if (bonusSource === "promo") return "promo";
  }
  return "plan";
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
        // The starting credits are their own bucket (#2185): they never expire
        // while the account is on Free, and expire 90 days after an upgrade.
        signupBalance: INITIAL_CREDITS,
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

/** What a grant states beyond its type (#2185). */
export interface CreditGrantOptions {
  /** Where a `bonus` came from; omitted, it is the plan's. See {@link BonusSource}. */
  bonusSource?: BonusSource;
  /** The clock a promo's 90 days run from. Tests pass one; the product does not. */
  now?: Date;
}

export async function addCredits(
  userId: number,
  amount: number,
  type: CreditTransactionType,
  description: string,
  referenceId?: string,
  options: CreditGrantOptions = {},
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
      addCreditsIn(tx, userId, amount, type, description, ledgerReferenceId, options));
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

/** A deadline `TIMED_BONUS_LIFE_DAYS` after `from`, in whole seconds (the column has no fraction). */
export function timedCreditDeadline(from: Date): Date {
  return new Date(Math.floor((from.getTime() + TIMED_BONUS_LIFE_DAYS * 86_400_000) / 1000) * 1000);
}

/** When a promo granted at `now` expires, given the one already on the row (#2185). */
export function promoExpiryAfterGrant(
  existing: Date | null | undefined,
  promoStillHeld: number,
  now: Date,
): Date {
  const fresh = timedCreditDeadline(now);
  /* ⚠ ONE PROMO BUCKET, ONE DATE — A STATED LIMIT. Two promos held at once
     share the LATER of their two dates, so the earlier one lasts longer than
     its own 90 days rather than the later one being cut short. No promo grant
     exists yet (the ruling: "this is built with the first promo"); a product
     that runs overlapping promos needs one row per promo, and that is the
     first promo's card to decide. */
  if (promoStillHeld > 0 && existing instanceof Date && existing.getTime() > fresh.getTime()) {
    return existing;
  }
  return fresh;
}

/**
 * THE GRANT ITSELF, INSIDE A TRANSACTION THE CALLER ALREADY HOLDS (#2127).
 *
 * `addCredits` is this plus its own transaction and the duplicate-reference
 * classification. The reason to expose it is a refund that must be decided
 * under a lock the caller holds: a Sign view lost to a refused sheet refunds
 * its share in the SAME transaction that holds the Sign's operation row
 * `FOR UPDATE`, so the recovery sweep (which moves that row out of `running`
 * before it refunds) and the live refund are serialized by the database rather
 * than by timing.
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
  options: CreditGrantOptions = {},
): Promise<CreditWriteResult> {
  // ATOMIC ADDITION: Use SQL balance + amount to prevent race conditions.
  // The unique ledger index, not a prior SELECT, arbitrates concurrent
  // references. If the insert loses, this update rolls back before the
  // catch below classifies the already-committed row.
  const isPurchase =
    type === "purchase" || type === "topup" || type === "subscription";
  const bucket = grantBucket(type, options.bonusSource);

  /*
    ⚠ EVERY BOUND IS SETTLED AGAINST THE BALANCE *BEFORE* THIS GRANT LANDS
    (#1604, widened to all four bounds by #2185).

    Each bound is an upper bound that `creditBuckets` reads as the lesser of
    it and what the later-spent buckets leave over — exact, because the spend
    order is fixed. The one thing that can make a bound meaningless is a
    grant: an account that bought 25,000 credits and spent every one of them
    still carries 25,000 in the column, so the next bonus would arrive and be
    read as purchased credits the customer never has. Settling every bound to
    its reading first closes that, for every grant kind but one (below).

    The row is read `FOR UPDATE` and the settled bounds are computed from it,
    so no spend can land between the read and the write. That replaces
    #1604's single `LEAST(purchasedBalance, balance)` statement, which could
    not be widened to four layered bounds without depending on MySQL's
    left-to-right `SET` evaluation.

    ⚠ EXCEPT A REFUND (#2185). A refund gives back a spend, and the settle
    would forget which credits that spend used. See `isSpendReversal`.
  */
  if (bucket !== "reversal") {
    const [held] = await tx
      .select({
        balance: credits.balance,
        purchasedBalance: credits.purchasedBalance,
        keptBalance: credits.keptBalance,
        signupBalance: credits.signupBalance,
        promoBalance: credits.promoBalance,
        promoCreditsExpireAt: credits.promoCreditsExpireAt,
      })
      .from(credits)
      .where(eq(credits.userId, userId))
      .limit(1)
      .for("update");
    if (!held) {
      return { success: false, error: "User credits not found" };
    }
    const settled = settledCreditBounds(held);
    await tx
      .update(credits)
      .set({
        ...settled,
        ...(bucket === "promo"
          ? {
              promoCreditsExpireAt: promoExpiryAfterGrant(
                held.promoCreditsExpireAt,
                settled.promoBalance,
                options.now ?? new Date(),
              ),
            }
          : {}),
      })
      .where(eq(credits.userId, userId));
  }

  /*
    The grant: the balance always, and the bucket's own bound when it has
    one. `isPurchase` decides the lifetime analytics counter and keeps its own
    three types including `subscription`; the bucket decides what a renewal,
    a downgrade and an expiry must leave alone, and `subscription` is the
    plan's. Folding them would make a plan's allowance immune to its plan's
    rollover rule.
  */
  const boundColumn =
    bucket === "reversal" || bucket === "plan" ? null : credits[BUCKET_BOUND_COLUMN[bucket]];
  const analytics = isPurchase
    ? sql`, ${credits.creditsPurchased} = COALESCE(${credits.creditsPurchased}, 0) + ${amount}`
    : sql``;
  const bound = boundColumn ? sql`, ${boundColumn} = ${boundColumn} + ${amount}` : sql``;
  const grantStatement = sql`UPDATE ${credits}
            SET ${credits.balance} = ${credits.balance} + ${amount}${analytics}${bound}
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
