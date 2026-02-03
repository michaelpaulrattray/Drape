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


// ============ Waitlist Functions ============

import { waitlist, InsertWaitlist } from "../drizzle/schema";
import { count } from "drizzle-orm";

export async function addToWaitlist(data: InsertWaitlist): Promise<{ success: boolean; position?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // Check if email already exists
    const existing = await db.select().from(waitlist).where(eq(waitlist.email, data.email)).limit(1);
    if (existing.length > 0) {
      // Return their existing position
      const position = await getWaitlistPosition(data.email);
      return { success: true, position, error: "already_registered" };
    }

    // Insert new waitlist entry
    await db.insert(waitlist).values(data);

    // Get their position
    const position = await getWaitlistPosition(data.email);

    return { success: true, position };
  } catch (error) {
    console.error("[Database] Failed to add to waitlist:", error);
    return { success: false, error: "Failed to join waitlist" };
  }
}

export async function getWaitlistPosition(email: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const entry = await db.select().from(waitlist).where(eq(waitlist.email, email)).limit(1);
    if (entry.length === 0) return 0;

    const result = await db
      .select({ count: count() })
      .from(waitlist)
      .where(eq(waitlist.id, entry[0].id));

    // Position is based on ID order (earlier signups have lower IDs)
    const countBefore = await db.select({ count: count() }).from(waitlist);
    const totalCount = countBefore[0]?.count ?? 0;
    
    // Find how many people signed up before this person
    const position = entry[0].id;
    return position;
  } catch (error) {
    console.error("[Database] Failed to get waitlist position:", error);
    return 0;
  }
}

export async function getWaitlistCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.select({ count: count() }).from(waitlist);
    return result[0]?.count ?? 0;
  } catch (error) {
    console.error("[Database] Failed to get waitlist count:", error);
    return 0;
  }
}

export async function checkEmailOnWaitlist(email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const result = await db.select().from(waitlist).where(eq(waitlist.email, email)).limit(1);
    return result.length > 0;
  } catch (error) {
    console.error("[Database] Failed to check waitlist:", error);
    return false;
  }
}


// ============ Model Functions ============

import { models, modelAssets, generations, InsertModel, InsertModelAsset, InsertGeneration } from "../drizzle/schema";

export async function createModel(data: InsertModel): Promise<{ success: boolean; modelId?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    const result = await db.insert(models).values(data);
    // Get the inserted model ID
    const inserted = await db.select().from(models).where(eq(models.agencyId, data.agencyId)).limit(1);
    return { success: true, modelId: inserted[0]?.id };
  } catch (error) {
    console.error("[Database] Failed to create model:", error);
    return { success: false, error: "Failed to create model" };
  }
}

export async function getModelById(modelId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(models).where(eq(models.id, modelId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getModelByAgencyId(agencyId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(models).where(eq(models.agencyId, agencyId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserModels(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(models)
    .where(eq(models.userId, userId))
    .orderBy(desc(models.createdAt))
    .limit(limit);
}

export async function updateModel(
  modelId: number,
  data: Partial<Pick<InsertModel, "name" | "status">>
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    await db.update(models).set(data).where(eq(models.id, modelId));
    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to update model:", error);
    return { success: false, error: "Failed to update model" };
  }
}

export async function deleteModel(modelId: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // Delete associated assets first
    await db.delete(modelAssets).where(eq(modelAssets.modelId, modelId));
    // Delete the model
    await db.delete(models).where(eq(models.id, modelId));
    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to delete model:", error);
    return { success: false, error: "Failed to delete model" };
  }
}

// ============ Model Asset Functions ============

export async function createModelAsset(data: InsertModelAsset): Promise<{ success: boolean; assetId?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    await db.insert(modelAssets).values(data);
    // Get the inserted asset
    const inserted = await db
      .select()
      .from(modelAssets)
      .where(eq(modelAssets.modelId, data.modelId))
      .orderBy(desc(modelAssets.createdAt))
      .limit(1);
    return { success: true, assetId: inserted[0]?.id };
  } catch (error) {
    console.error("[Database] Failed to create model asset:", error);
    return { success: false, error: "Failed to create model asset" };
  }
}

export async function getModelAssets(modelId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(modelAssets)
    .where(eq(modelAssets.modelId, modelId))
    .orderBy(desc(modelAssets.createdAt));
}

export async function getModelAssetByView(modelId: number, viewType: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(modelAssets)
    .where(eq(modelAssets.modelId, modelId))
    .orderBy(desc(modelAssets.createdAt));
  
  // Filter by viewType manually since we can't use enum in where clause easily
  const filtered = result.filter(a => a.viewType === viewType);
  return filtered.length > 0 ? filtered[0] : null;
}

// ============ Generation Tracking Functions ============

export async function createGeneration(data: InsertGeneration): Promise<{ success: boolean; generationId?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    await db.insert(generations).values(data);
    // Get the most recent generation for this user
    const inserted = await db
      .select()
      .from(generations)
      .where(eq(generations.userId, data.userId))
      .orderBy(desc(generations.createdAt))
      .limit(1);
    return { success: true, generationId: inserted[0]?.id };
  } catch (error) {
    console.error("[Database] Failed to create generation:", error);
    return { success: false, error: "Failed to create generation" };
  }
}

export async function updateGeneration(
  generationId: number,
  data: Partial<Pick<InsertGeneration, "status" | "resultUrl" | "errorMessage" | "completedAt">>
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    await db.update(generations).set(data).where(eq(generations.id, generationId));
    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to update generation:", error);
    return { success: false, error: "Failed to update generation" };
  }
}

export async function getUserGenerations(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(generations)
    .where(eq(generations.userId, userId))
    .orderBy(desc(generations.createdAt))
    .limit(limit);
}

export async function getGenerationById(generationId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(generations).where(eq(generations.id, generationId)).limit(1);
  return result.length > 0 ? result[0] : null;
}
