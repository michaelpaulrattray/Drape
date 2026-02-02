import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, points, pointTransactions, InsertPoints, InsertPointTransaction } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
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
      values.role = 'admin';
      updateSet.role = 'admin';
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
    const existingUser = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    if (existingUser.length > 0) {
      const userId = existingUser[0].id;
      // Check if user has points record
      const existingPoints = await db.select().from(points).where(eq(points.userId, userId)).limit(1);
      if (existingPoints.length === 0) {
        // Initialize points for new user
        await initializeUserPoints(userId);
      }
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ Points System Functions ============

const INITIAL_POINTS = 100;

export async function initializeUserPoints(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot initialize points: database not available");
    return;
  }

  try {
    // Create points record
    await db.insert(points).values({
      userId,
      balance: INITIAL_POINTS,
      planTier: "free",
    });

    // Record the signup bonus transaction
    await db.insert(pointTransactions).values({
      userId,
      amount: INITIAL_POINTS,
      type: "signup",
      description: "Welcome bonus - free points for new users",
      balanceAfter: INITIAL_POINTS,
    });
  } catch (error) {
    console.error("[Database] Failed to initialize user points:", error);
    throw error;
  }
}

export async function getUserPoints(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get points: database not available");
    return null;
  }

  const result = await db.select().from(points).where(eq(points.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getPointTransactions(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get transactions: database not available");
    return [];
  }

  return await db
    .select()
    .from(pointTransactions)
    .where(eq(pointTransactions.userId, userId))
    .orderBy(desc(pointTransactions.createdAt))
    .limit(limit);
}

export async function deductPoints(
  userId: number,
  amount: number,
  type: "generation" | "purchase" | "bonus" | "refund" | "signup",
  description: string,
  referenceId?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // Get current balance
    const userPoints = await getUserPoints(userId);
    if (!userPoints) {
      return { success: false, error: "User points not found" };
    }

    if (userPoints.balance < amount) {
      return { success: false, error: "Insufficient points" };
    }

    const newBalance = userPoints.balance - amount;

    // Update balance
    await db.update(points).set({ balance: newBalance }).where(eq(points.userId, userId));

    // Record transaction
    await db.insert(pointTransactions).values({
      userId,
      amount: -amount,
      type,
      description,
      referenceId,
      balanceAfter: newBalance,
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error("[Database] Failed to deduct points:", error);
    return { success: false, error: "Failed to deduct points" };
  }
}

export async function addPoints(
  userId: number,
  amount: number,
  type: "generation" | "purchase" | "bonus" | "refund" | "signup",
  description: string,
  referenceId?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // Get current balance
    const userPoints = await getUserPoints(userId);
    if (!userPoints) {
      return { success: false, error: "User points not found" };
    }

    const newBalance = userPoints.balance + amount;

    // Update balance
    await db.update(points).set({ balance: newBalance }).where(eq(points.userId, userId));

    // Record transaction
    await db.insert(pointTransactions).values({
      userId,
      amount,
      type,
      description,
      referenceId,
      balanceAfter: newBalance,
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error("[Database] Failed to add points:", error);
    return { success: false, error: "Failed to add points" };
  }
}
