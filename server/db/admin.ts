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
import { getDb } from "./connection";

// ============================================================================
// USER MANAGEMENT HELPERS (Admin)
// ============================================================================

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
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          like(users.name, searchTerm),
          like(users.email, searchTerm),
          like(users.openId, searchTerm)
        )!
      );
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
    console.error("[Database] Failed to list users:", error);
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
    console.error("[Database] Failed to get user details:", error);
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
  adminId: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    const [userCredits] = await db
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
      await db
        .update(credits)
        .set({
          balance: newBalance,
          creditsPurchased: sql`${credits.creditsPurchased} + ${amount}`,
        })
        .where(eq(credits.userId, userId));
    } else {
      await db
        .update(credits)
        .set({ balance: newBalance })
        .where(eq(credits.userId, userId));
    }

    await db.insert(creditTransactions).values({
      userId,
      amount,
      type: amount > 0 ? "admin_add" : "admin_deduct",
      description: `Admin adjustment by admin ${adminId}: ${reason}`,
      balanceAfter: newBalance,
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error("[Database] Failed to adjust credits:", error);
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
    console.error("[Database] Failed to get user statistics:", error);
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
