/**
 * Security Domain — account suspension, role management, and login lockout.
 */

import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb } from "./connection";
import { getUserByOpenId } from "./users";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/security");

/**
 * Suspend a user account.
 */
export async function suspendUser(
  userId: number,
  reason: string,
  suspendedByAdminId: number
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    await db
      .update(users)
      .set({
        suspendedAt: new Date(),
        suspendedReason: reason,
        suspendedBy: suspendedByAdminId,
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to suspend user:");
    return { success: false, error: "Failed to suspend user" };
  }
}

/**
 * Unsuspend a user account.
 */
export async function unsuspendUser(
  userId: number
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    await db
      .update(users)
      .set({
        suspendedAt: null,
        suspendedReason: null,
        suspendedBy: null,
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to unsuspend user:");
    return { success: false, error: "Failed to unsuspend user" };
  }
}

/**
 * Freeze a user account (blocks generation and purchases, but user can still log in).
 * Used for automated billing discrepancy investigation.
 */
export async function freezeUser(
  userId: number,
  reason: string,
  frozenBy: string // "system" for auto-freeze, or moderator user ID as string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    await db
      .update(users)
      .set({
        frozenAt: new Date(),
        frozenReason: reason,
        frozenBy,
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to freeze user:");
    return { success: false, error: "Failed to freeze user" };
  }
}

/**
 * Unfreeze a user account after moderator review.
 */
export async function unfreezeUser(
  userId: number
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    await db
      .update(users)
      .set({
        frozenAt: null,
        frozenReason: null,
        frozenBy: null,
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to unfreeze user:");
    return { success: false, error: "Failed to unfreeze user" };
  }
}

/**
 * Update a user's role (promote/demote between user and moderator).
 * Only admins can change roles, and they cannot change their own role or promote to admin.
 */
export async function updateUserRole(
  userId: number,
  newRole: "user" | "moderator",
  changedByAdminId: number
): Promise<{ success: boolean; previousRole?: string; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    const [targetUser] = await db
      .select({ role: users.role, id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    if (targetUser.role === "admin") {
      return {
        success: false,
        error: "Cannot change the role of an admin user",
      };
    }

    if (userId === changedByAdminId) {
      return { success: false, error: "Cannot change your own role" };
    }

    if (targetUser.role === newRole) {
      return { success: false, error: `User is already a ${newRole}` };
    }

    const previousRole = targetUser.role;

    await db.update(users).set({ role: newRole }).where(eq(users.id, userId));

    return { success: true, previousRole };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to update user role:");
    return { success: false, error: "Failed to update user role" };
  }
}

/**
 * Record a failed login attempt and potentially lock the account.
 */
export async function recordFailedLogin(
  openId: string
): Promise<{ locked: boolean; lockedUntil?: Date; attempts: number }> {
  const db = await getDb();
  if (!db) return { locked: false, attempts: 0 };

  try {
    const user = await getUserByOpenId(openId);
    if (!user) return { locked: false, attempts: 0 };

    const newAttempts = (user.failedLoginAttempts || 0) + 1;
    const LOCKOUT_THRESHOLD = 5;
    const LOCKOUT_DURATION_MINUTES = 15;

    let lockedUntil: Date | null = null;

    if (newAttempts >= LOCKOUT_THRESHOLD) {
      lockedUntil = new Date(
        Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000
      );
    }

    await db
      .update(users)
      .set({
        failedLoginAttempts: newAttempts,
        lockedUntil: lockedUntil,
      })
      .where(eq(users.id, user.id));

    return {
      locked: !!lockedUntil,
      lockedUntil: lockedUntil || undefined,
      attempts: newAttempts,
    };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to record failed login:");
    return { locked: false, attempts: 0 };
  }
}

/**
 * Reset failed login attempts on successful login.
 */
export async function resetFailedLogins(openId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(users.openId, openId));
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to reset failed logins:");
  }
}

/**
 * Check if user account is locked.
 */
export async function isAccountLocked(
  openId: string
): Promise<{ locked: boolean; lockedUntil?: Date; reason?: string }> {
  const db = await getDb();
  if (!db) return { locked: false };

  try {
    const user = await getUserByOpenId(openId);
    if (!user) return { locked: false };

    if (user.suspendedAt) {
      return {
        locked: true,
        reason: user.suspendedReason || "Account suspended",
      };
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return {
        locked: true,
        lockedUntil: new Date(user.lockedUntil),
        reason: "Too many failed login attempts",
      };
    }

    return { locked: false };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to check account lock:");
    return { locked: false };
  }
}
