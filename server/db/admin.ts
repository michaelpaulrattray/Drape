/**
 * Admin Domain — user management, statistics, and credit adjustments.
 */

import {
  eq,
  desc,
  and,
  gte,
  gt,
  lte,
  asc,
  sql,
  like,
  or,
  isNull,
  isNotNull,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  users,
  credits,
  creditTransactions,
  models,
  generations,
} from "../../drizzle/schema";
import { getDb, withTransaction } from "./connection";
import {
  creditReferenceSemanticsMatch,
  getCreditTransactionByRef,
  getUserCredits,
  isDuplicateCreditReferenceError,
  normalizeCreditReferenceId,
  type CreditWriteResult,
} from "./credits";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/admin");

// ============================================================================
// USER MANAGEMENT HELPERS (Admin)
// ============================================================================

/**
 * THE MODERATOR'S ACCOUNT SEARCH — and why a numeric term is its own branch.
 *
 * The surface shows a numeric account id beside every row (`#40486`) and had
 * offered to search by it since it was built. The server matched `name`,
 * `email` and `openId` — the auth-provider handle, never `users.id` — so
 * typing an id returned nothing at all, for any id, and #399 removed the
 * claim rather than leave a dead control on a staff surface. This is the
 * other half (#420): the capability, so the claim can come back.
 *
 * # A DIGIT TERM MATCHES THE ID EXACTLY, NEVER BY `LIKE`
 *
 * `LIKE '%1%'` over the id returns every account whose id merely CONTAINS a 1,
 * which on any real population is most of them — a worse answer than none, and
 * the thing the card asked to be checked on the way. So an all-digit term is
 * an identity lookup: this account or no account.
 *
 * It still matches the three text fields as well, because an email or a name
 * may legitimately be numeric and a moderator holding "40486" from a support
 * ticket should not have a matching email hidden from them.
 *
 * # ⚠ AND IT ACCEPTS THE SHAPE THIS PRODUCT ITSELF PRINTS: `#40486`
 *
 * Both staff surfaces render the id with a leading hash — `#40486`
 * (`UserInvestigationWidgets.tsx`, `admin/UserTable.tsx`) — so the likeliest
 * thing anyone will ever paste into this box is the string they copied off the
 * row in front of them, or off a ticket quoting it. The first version of this
 * function tested `/^\d+$/` and a pasted `#40486` fell straight through to
 * `LIKE '%#40486%'` over the text fields, found nothing, and printed *"No users
 * match that search"* — **the original defect's exact symptom, reproduced on
 * the one paste shape the product manufactures.** (Gate review, PR #569.)
 *
 * ONE optional leading hash is stripped, and only for the id test; the three
 * text clauses keep the term as it was typed, because someone searching for a
 * literal "#40486" in a name is asking a different question.
 *
 * # THE BOUND, AND WHY IT IS NOT DECORATION
 *
 * `users.id` is a signed 32-bit int. A term of twenty digits is not an id on
 * this table, and handing it to MySQL as one is asking a question about a
 * value the column cannot hold; out of range, it falls through to the text
 * fields alone. `Number.isSafeInteger` is checked first because a long digit
 * string parses to a float that compares wrongly rather than failing.
 *
 * # PRECONDITION
 *
 * The term must be non-empty — an empty one renders `LIKE '%%'`, which matches
 * every account. The only call site guards it (`if (search && search.trim())`)
 * and a second caller must do the same. Stated here because the rest of this
 * docblock states everything else, and a precondition that is only true by
 * accident at the one call site is how a mirror starts.
 */
export function userSearchCondition(search: string): SQL {
  const term = search.trim();
  const searchTerm = `%${term}%`;
  const clauses: SQL[] = [
    like(users.name, searchTerm),
    like(users.email, searchTerm),
    like(users.openId, searchTerm),
  ];

  const digits = term.startsWith("#") ? term.slice(1) : term;
  if (/^\d+$/.test(digits)) {
    const asNumber = Number(digits);
    if (Number.isSafeInteger(asNumber) && asNumber > 0 && asNumber <= 2147483647) {
      clauses.push(eq(users.id, asNumber));
    }
  }

  return or(...clauses)!;
}

/**
 * Get paginated list of all users with search and filters.
 */
export async function listAllUsers(options: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: "active" | "suspended" | "locked" | "frozen" | "all";
  role?: "user" | "admin" | "moderator" | "all";
  sortBy?: "createdAt" | "lastSignedIn" | "name";
  sortOrder?: "asc" | "desc";
}): Promise<{
  users: Array<{
    id: number;
    openId: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    role: "user" | "admin" | "moderator";
    suspendedAt: Date | null;
    suspendedReason: string | null;
    frozenAt: Date | null;
    lockedUntil: Date | null;
    createdAt: Date;
    lastSignedIn: Date;
  }>;
  total: number;
}> {
  const db = await getDb();
  if (!db) return { users: [], total: 0 };

  const {
    limit = 20,
    offset = 0,
    search,
    status = "all",
    role = "all",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  try {
    const conditions: SQL[] = [];

    if (search && search.trim()) {
      conditions.push(userSearchCondition(search));
    }

    if (status === "suspended") {
      conditions.push(isNotNull(users.suspendedAt));
    } else if (status === "locked") {
      conditions.push(gt(users.lockedUntil, new Date()));
    } else if (status === "frozen") {
      conditions.push(isNotNull(users.frozenAt));
    } else if (status === "active") {
      conditions.push(isNull(users.suspendedAt));
      conditions.push(isNull(users.frozenAt));
      conditions.push(
        or(isNull(users.lockedUntil), lte(users.lockedUntil, new Date()))!
      );
    }

    if (role !== "all") {
      conditions.push(eq(users.role, role));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);
    const total = countResult?.count || 0;

    const orderColumn =
      sortBy === "name"
        ? users.name
        : sortBy === "lastSignedIn"
          ? users.lastSignedIn
          : users.createdAt;
    const orderDirection =
      sortOrder === "asc" ? asc(orderColumn) : desc(orderColumn);

    const userList = await db
      .select({
        id: users.id,
        openId: users.openId,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: users.role,
        suspendedAt: users.suspendedAt,
        suspendedReason: users.suspendedReason,
        frozenAt: users.frozenAt,
        lockedUntil: users.lockedUntil,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .where(whereClause)
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);

    return { users: userList, total };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to list users:");
    return { users: [], total: 0 };
  }
}

/**
 * Get detailed user information including credits.
 */
export async function getUserFullDetails(userId: number): Promise<{
  user: {
    id: number;
    openId: string;
    name: string | null;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    bio: string | null;
    role: "user" | "admin" | "moderator";
    storageUsed: number;
    storageLimit: number;
    suspendedAt: Date | null;
    suspendedReason: string | null;
    suspendedBy: number | null;
    frozenAt: Date | null;
    frozenReason: string | null;
    frozenBy: string | null;
    lockedUntil: Date | null;
    failedLoginAttempts: number;
    createdAt: Date;
    lastSignedIn: Date;
  };
  credits: {
    balance: number;
    planTier: string;
    creditsPurchased: number;
    creditsUsed: number;
    rolloverCredits: number;
    subscriptionStatus: string | null;
  } | null;
  stats: {
    totalModels: number;
    totalGenerations: number;
  };
} | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return null;

    const [userCredits] = await db
      .select({
        balance: credits.balance,
        planTier: credits.planTier,
        creditsPurchased: credits.creditsPurchased,
        creditsUsed: credits.creditsUsed,
        rolloverCredits: credits.rolloverCredits,
        subscriptionStatus: credits.subscriptionStatus,
      })
      .from(credits)
      .where(eq(credits.userId, userId))
      .limit(1);

    const [modelCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(models)
      .where(eq(models.userId, userId));

    const [genCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(generations)
      .where(eq(generations.userId, userId));

    return {
      user: {
        id: user.id,
        openId: user.openId,
        name: user.name,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        bio: user.bio,
        role: user.role,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
        suspendedAt: user.suspendedAt,
        suspendedReason: user.suspendedReason,
        suspendedBy: user.suspendedBy,
        frozenAt: user.frozenAt,
        frozenReason: user.frozenReason,
        frozenBy: user.frozenBy,
        lockedUntil: user.lockedUntil,
        failedLoginAttempts: user.failedLoginAttempts,
        createdAt: user.createdAt,
        lastSignedIn: user.lastSignedIn,
      },
      credits: userCredits || null,
      stats: {
        totalModels: modelCount?.count || 0,
        totalGenerations: genCount?.count || 0,
      },
    };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to get user details:");
    return null;
  }
}

/**
 * Adjust user credits (add or deduct) with audit logging.
 */
export async function adjustUserCredits(
  userId: number,
  amount: number,
  reason: string,
  adminId: number,
  referenceId?: string,
): Promise<CreditWriteResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };
  const ledgerReferenceId = referenceId
    ? normalizeCreditReferenceId(referenceId)
    : undefined;
  const transactionType = amount > 0 ? "admin_add" : "admin_deduct";

  try {
    return await withTransaction(async (tx) => {
      const [userCredits] = await tx
        .select({ balance: credits.balance })
        .from(credits)
        .where(eq(credits.userId, userId))
        .limit(1);

      if (!userCredits) {
        return { success: false, error: "User credits record not found" };
      }

      const newBalance = userCredits.balance + amount;
      if (newBalance < 0) {
        return { success: false, error: "Cannot reduce balance below zero" };
      }

      if (amount > 0) {
        await tx
          .update(credits)
          .set({
            balance: newBalance,
            creditsPurchased: sql`${credits.creditsPurchased} + ${amount}`,
          })
          .where(eq(credits.userId, userId));
      } else {
        await tx
          .update(credits)
          .set({ balance: newBalance })
          .where(eq(credits.userId, userId));
      }

      await tx.insert(creditTransactions).values({
        userId,
        amount,
        type: transactionType,
        description: `Admin adjustment by admin ${adminId}: ${reason}`,
        referenceId: ledgerReferenceId,
        balanceAfter: newBalance,
      });

      return { success: true, newBalance };
    });
  } catch (error) {
    if (ledgerReferenceId && isDuplicateCreditReferenceError(error)) {
      const existing = await getCreditTransactionByRef(userId, ledgerReferenceId);
      if (!existing || !creditReferenceSemanticsMatch(
        existing,
        { type: transactionType, amount },
      )) {
        log.fatal(
          {
            userId,
            referenceId: ledgerReferenceId,
            existing: existing && { id: existing.id, type: existing.type, amount: existing.amount },
            requested: { type: transactionType, amount },
          },
          "[Database] CRITICAL admin-adjustment reference collision",
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
    log.error({ err: error }, "[Database] Failed to adjust credits:");
    return { success: false, error: "Failed to adjust credits" };
  }
}

/**
 * Get user statistics summary for admin dashboard.
 */
export async function getUserStatistics(): Promise<{
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  lockedUsers: number;
  newUsersThisMonth: number;
  adminCount: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalUsers: 0,
      activeUsers: 0,
      suspendedUsers: 0,
      lockedUsers: 0,
      newUsersThisMonth: 0,
      adminCount: 0,
    };
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    const [suspendedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(isNotNull(users.suspendedAt));

    const [lockedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(gt(users.lockedUntil, now));

    const [newResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, startOfMonth));

    const [adminResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, "admin"));

    const total = totalResult?.count || 0;
    const suspended = suspendedResult?.count || 0;
    const locked = lockedResult?.count || 0;

    return {
      totalUsers: total,
      activeUsers: total - suspended - locked,
      suspendedUsers: suspended,
      lockedUsers: locked,
      newUsersThisMonth: newResult?.count || 0,
      adminCount: adminResult?.count || 0,
    };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to get user statistics:");
    return {
      totalUsers: 0,
      activeUsers: 0,
      suspendedUsers: 0,
      lockedUsers: 0,
      newUsersThisMonth: 0,
      adminCount: 0,
    };
  }
}
