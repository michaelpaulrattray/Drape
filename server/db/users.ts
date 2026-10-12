/**
 * Users Domain — user CRUD, profile updates, and storage management.
 */

import { and, eq, isNull, or } from "drizzle-orm";
import { InsertUser, users, points } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb } from "./connection";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/users");

// Forward reference — initializeUserCredits lives in credits.ts
// We use a dynamic import to avoid circular dependency
async function ensurePointsInitialized(userId: number) {
  const { initializeUserCredits } = await import("./credits");
  await initializeUserCredits(userId);
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    log.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "avatarUrl"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    // Auth provider fields
    if (user.passwordHash !== undefined) {
      values.passwordHash = user.passwordHash;
      updateSet.passwordHash = user.passwordHash;
    }
    if (user.authProvider !== undefined) {
      values.authProvider = user.authProvider;
      updateSet.authProvider = user.authProvider;
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });

    // Get the user to check if they need points initialized
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.openId, user.openId))
      .limit(1);
    if (existingUser.length > 0) {
      const userId = existingUser[0].id;
      // Check if user has points record
      const existingPoints = await db
        .select()
        .from(points)
        .where(eq(points.userId, userId))
        .limit(1);
      if (existingPoints.length === 0) {
        // Initialize points for new user
        await ensurePointsInitialized(userId);
      }
    }
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to upsert user:");
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    log.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    log.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * EVERY ACCOUNT BOUND TO ONE GOOGLE ACCOUNT (#2389) — the ones Google created
 * (`openId = google_<sub>`) and the ones that linked Google later
 * (`googleSub = <sub>`), in one statement.
 *
 * It returns up to TWO rows rather than one, on purpose: two accounts claiming
 * one Google account should never exist, and the caller refuses when it sees
 * both rather than signing into whichever the database happened to return
 * first.
 */
export async function getUsersByGoogleSub(sub: string) {
  const db = await getDb();
  if (!db) {
    log.warn("[Database] Cannot get user: database not available");
    return [];
  }

  return db
    .select()
    .from(users)
    .where(or(eq(users.openId, `google_${sub}`), eq(users.googleSub, sub)))
    .limit(2);
}

/**
 * RECORD THAT AN ACCOUNT IS NOW GOOGLE'S `sub` (#2389) — written once, the
 * first time an account that has no Google binding signs in with Google.
 *
 * The statement only writes a row that is still unbound, so two sign-ins racing
 * cannot each bind a different Google account; the unique index on `googleSub`
 * stops one Google account binding to two rows. Returns whether THIS call made
 * the binding — `false` means somebody else got there first, and the caller
 * refuses rather than guessing which.
 */
export async function bindGoogleSub(userId: number, sub: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    log.warn("[Database] Cannot bind Google account: database not available");
    return false;
  }

  const result = await db
    .update(users)
    .set({ googleSub: sub })
    .where(and(eq(users.id, userId), isNull(users.googleSub)));
  return ((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0) === 1;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// ============ Profile ============

interface ProfileUpdateData {
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  avatarKey?: string | null;
  bannerUrl?: string | null;
  bannerKey?: string | null;
}

/** D-9 first-run intro: one-way flag — the intro never returns once any
 *  board interaction dismisses it (profile-persisted, survives devices). */
export async function markCanvasIntroSeen(userId: number): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) return { success: false };
  await db.update(users).set({ canvasIntroSeen: true }).where(eq(users.id, userId));
  return { success: true };
}

/**
 * The Follow hint (#1909): one-way flag, the same shape as the canvas intro
 * above and for the same reason — the line is shown ONCE PER PERSON, so it
 * cannot live in a browser.
 *
 * ⚠ It is written on the FIRST KEEP, before she has done anything with the
 * hint, so a customer who never looks at it still never sees it twice. The
 * alternative — writing it on dismissal — leaves the hint on every device for
 * anyone who scrolls past it, which is the failure the server flag exists to
 * prevent.
 */
export async function markFollowHintSeen(userId: number): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) return { success: false };
  await db.update(users).set({ followHintSeen: true }).where(eq(users.id, userId));
  return { success: true };
}

export async function updateUserProfile(
  userId: number,
  data: ProfileUpdateData
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    const updateData: Record<string, unknown> = {};

    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.avatarKey !== undefined) updateData.avatarKey = data.avatarKey;
    if (data.bannerUrl !== undefined) updateData.bannerUrl = data.bannerUrl;
    if (data.bannerKey !== undefined) updateData.bannerKey = data.bannerKey;

    if (Object.keys(updateData).length === 0) {
      return { success: true }; // Nothing to update
    }

    await db.update(users).set(updateData).where(eq(users.id, userId));
    return { success: true };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to update user profile:");
    return { success: false, error: "Failed to update profile" };
  }
}

// ============ Storage ============

export async function getUserStorageInfo(
  userId: number
): Promise<{ used: number; limit: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({ storageUsed: users.storageUsed, storageLimit: users.storageLimit })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (result.length === 0) return null;
  return { used: result[0].storageUsed, limit: result[0].storageLimit };
}

export async function updateUserStorageUsed(
  userId: number,
  bytesChange: number
): Promise<{ success: boolean; newUsed?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const newUsed = Math.max(0, user.storageUsed + bytesChange);

    // Check if adding storage would exceed limit (only for positive changes)
    if (bytesChange > 0 && newUsed > user.storageLimit) {
      return { success: false, error: "Storage limit exceeded" };
    }

    await db.update(users).set({ storageUsed: newUsed }).where(eq(users.id, userId));
    return { success: true, newUsed };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to update storage used:");
    return { success: false, error: "Failed to update storage" };
  }
}
