/**
 * Users Domain — user CRUD, profile updates, and storage management.
 */

import { eq } from "drizzle-orm";
import { InsertUser, users, points } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb } from "./connection";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/users");

// Forward reference — initializeUserPoints lives in credits.ts
// We use a dynamic import to avoid circular dependency
async function ensurePointsInitialized(userId: number) {
  const { initializeUserPoints } = await import("./credits");
  await initializeUserPoints(userId);
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

export interface ProfileUpdateData {
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  avatarKey?: string | null;
  bannerUrl?: string | null;
  bannerKey?: string | null;
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
