import { eq, desc, and, gte, lt, asc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  credits, creditTransactions, InsertCredits, InsertCreditTransaction,
  // Legacy aliases for backward compatibility
  points, pointTransactions, InsertPoints, InsertPointTransaction 
} from "../drizzle/schema";
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

// ============ Credits System Functions ============

const INITIAL_CREDITS = 100; // Free tier starting credits

export async function initializeUserCredits(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot initialize credits: database not available");
    return;
  }

  try {
    // Create credits record
    await db.insert(credits).values({
      userId,
      balance: INITIAL_CREDITS,
      planTier: "free",
      creditsPurchased: 0,
      creditsUsed: 0,
      rolloverCredits: 0,
    });

    // Record the signup bonus transaction
    await db.insert(creditTransactions).values({
      userId,
      amount: INITIAL_CREDITS,
      type: "signup",
      description: "Welcome bonus - free credits for new users",
      balanceAfter: INITIAL_CREDITS,
    });
  } catch (error) {
    console.error("[Database] Failed to initialize user credits:", error);
    throw error;
  }
}

// Legacy alias
export const initializeUserPoints = initializeUserCredits;

export async function getUserCredits(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get credits: database not available");
    return null;
  }

  const result = await db.select().from(credits).where(eq(credits.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// Legacy alias
export const getUserPoints = getUserCredits;

export async function getCreditTransactions(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get transactions: database not available");
    return [];
  }

  return await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);
}

// Legacy alias
export const getPointTransactions = getCreditTransactions;

export async function deductCredits(
  userId: number,
  amount: number,
  type: "generation" | "purchase" | "bonus" | "refund" | "signup" | "topup" | "subscription",
  description: string,
  referenceId?: string,
  engineUsed?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // ATOMIC DEDUCTION: Use SQL conditional update to prevent race conditions
    // This ensures credits are only deducted if balance >= amount at the moment of update
    // If two requests race, only one will succeed - the other will see 0 rows affected
    const updateResult = await db.execute(
      sql`UPDATE ${credits} 
          SET balance = balance - ${amount},
              credits_used = COALESCE(credits_used, 0) + ${amount}
          WHERE user_id = ${userId} AND balance >= ${amount}`
    );

    // Check if any rows were affected (cast to handle different MySQL driver responses)
    const affectedRows = (updateResult as any)[0]?.affectedRows ?? (updateResult as any).affectedRows ?? 0;
    
    if (affectedRows === 0) {
      // Either user not found or insufficient balance
      const userCredits = await getUserCredits(userId);
      if (!userCredits) {
        return { success: false, error: "User credits not found" };
      }
      return { success: false, error: "Insufficient credits" };
    }

    // Get the new balance for the transaction record
    const userCredits = await getUserCredits(userId);
    const newBalance = userCredits?.balance ?? 0;

    // Record transaction with engine info
    await db.insert(creditTransactions).values({
      userId,
      amount: -amount,
      type,
      description,
      referenceId,
      balanceAfter: newBalance,
      engineUsed: engineUsed || null,
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error("[Database] Failed to deduct credits:", error);
    return { success: false, error: "Failed to deduct credits" };
  }
}

// Legacy alias
export const deductPoints = deductCredits;

export async function addCredits(
  userId: number,
  amount: number,
  type: "generation" | "purchase" | "bonus" | "refund" | "signup" | "topup" | "subscription",
  description: string,
  referenceId?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // Get current balance
    const userCredits = await getUserCredits(userId);
    if (!userCredits) {
      return { success: false, error: "User credits not found" };
    }

    const newBalance = userCredits.balance + amount;
    const isPurchase = type === "purchase" || type === "topup" || type === "subscription";
    const newCreditsPurchased = isPurchase 
      ? (userCredits.creditsPurchased || 0) + amount 
      : userCredits.creditsPurchased;

    // Update balance and track purchases
    await db.update(credits).set({ 
      balance: newBalance,
      creditsPurchased: newCreditsPurchased,
    }).where(eq(credits.userId, userId));

    // Record transaction
    await db.insert(creditTransactions).values({
      userId,
      amount,
      type,
      description,
      referenceId,
      balanceAfter: newBalance,
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error("[Database] Failed to add credits:", error);
    return { success: false, error: "Failed to add credits" };
  }
}

// Legacy alias
export const addPoints = addCredits;


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
    // Insert the model (agencyId is null for drafts, assigned on export/minting)
    const result = await db.insert(models).values({
      ...data,
      status: 'draft', // All new models start as drafts
    });
    
    // Get the inserted model ID using the auto-increment ID
    // We need to query by the unique combination of userId + createdAt (most recent)
    const inserted = await db
      .select()
      .from(models)
      .where(eq(models.userId, data.userId))
      .orderBy(desc(models.createdAt))
      .limit(1);
    
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
  data: Partial<Pick<InsertModel, "name" | "status" | "masterPrompt" | "technicalSchema">>
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

/**
 * Mint a model on export - assigns agencyId and locks the identity
 * This is called when a user exports their model for the first time
 */
export async function mintModel(
  modelId: number,
  agencyId: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // Check if model is already minted
    const existing = await db.select().from(models).where(eq(models.id, modelId)).limit(1);
    if (existing.length === 0) {
      return { success: false, error: "Model not found" };
    }
    if (existing[0].agencyId) {
      return { success: false, error: "Model already minted" };
    }

    // Mint the model: assign agencyId, set status to active, record mint time
    await db.update(models).set({
      agencyId,
      status: 'active',
      mintedAt: new Date(),
    }).where(eq(models.id, modelId));

    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to mint model:", error);
    return { success: false, error: "Failed to mint model" };
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


// ============ User Profile Functions ============

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
    console.error("[Database] Failed to update user profile:", error);
    return { success: false, error: "Failed to update profile" };
  }
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserStorageInfo(userId: number): Promise<{ used: number; limit: number } | null> {
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
    console.error("[Database] Failed to update storage used:", error);
    return { success: false, error: "Failed to update storage" };
  }
}

// ============ Asset Cleanup Functions ============

export async function getModelAssetsForCleanup(modelId: number): Promise<{ storageKey: string | null }[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({ storageKey: modelAssets.storageKey })
    .from(modelAssets)
    .where(eq(modelAssets.modelId, modelId));
}

export async function deleteModelWithAssetKeys(modelId: number): Promise<{ 
  success: boolean; 
  assetKeys: string[]; 
  error?: string 
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, assetKeys: [], error: "Database not available" };
  }

  try {
    // Get all asset keys before deletion
    const assets = await getModelAssetsForCleanup(modelId);
    const assetKeys = assets.map(a => a.storageKey).filter((k): k is string => k !== null);

    // Delete associated assets first
    await db.delete(modelAssets).where(eq(modelAssets.modelId, modelId));
    // Delete the model
    await db.delete(models).where(eq(models.id, modelId));
    
    return { success: true, assetKeys };
  } catch (error) {
    console.error("[Database] Failed to delete model:", error);
    return { success: false, assetKeys: [], error: "Failed to delete model" };
  }
}


// ============ Subscription & Billing Functions ============

import { PlanTier } from "../drizzle/schema";

export async function updateUserSubscription(
  userId: number,
  data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: "active" | "canceled" | "past_due" | "unpaid" | "trialing" | null;
    planTier?: PlanTier;
    planExpiresAt?: Date | null;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    await db.update(credits).set(data).where(eq(credits.userId, userId));
    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to update subscription:", error);
    return { success: false, error: "Failed to update subscription" };
  }
}

export async function getUserByStripeCustomerId(stripeCustomerId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(credits)
    .where(eq(credits.stripeCustomerId, stripeCustomerId))
    .limit(1);
  
  if (result.length === 0) return null;
  
  // Get the user record
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, result[0].userId))
    .limit(1);
  
  return user.length > 0 ? { ...user[0], credits: result[0] } : null;
}

export async function refreshMonthlyCredits(
  userId: number,
  monthlyCredits: number,
  rolloverCredits: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    const userCredits = await getUserCredits(userId);
    if (!userCredits) {
      return { success: false, error: "User credits not found" };
    }

    const newBalance = monthlyCredits + rolloverCredits;

    await db.update(credits).set({
      balance: newBalance,
      rolloverCredits: rolloverCredits,
      lastRefreshAt: new Date(),
    }).where(eq(credits.userId, userId));

    // Record the subscription credit transaction
    await db.insert(creditTransactions).values({
      userId,
      amount: monthlyCredits,
      type: "subscription",
      description: `Monthly credit refresh (${monthlyCredits} credits + ${rolloverCredits} rollover)`,
      balanceAfter: newBalance,
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error("[Database] Failed to refresh monthly credits:", error);
    return { success: false, error: "Failed to refresh credits" };
  }
}

export async function addTopupCredits(
  userId: number,
  credits: number,
  referenceId: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  return addCredits(
    userId,
    credits,
    "topup",
    `Credit top-up: ${credits} credits`,
    referenceId
  );
}

export async function getSubscriptionByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      planTier: credits.planTier,
      planExpiresAt: credits.planExpiresAt,
      stripeCustomerId: credits.stripeCustomerId,
      stripeSubscriptionId: credits.stripeSubscriptionId,
      subscriptionStatus: credits.subscriptionStatus,
      currentPeriodStart: credits.currentPeriodStart,
      currentPeriodEnd: credits.currentPeriodEnd,
      balance: credits.balance,
      creditsPurchased: credits.creditsPurchased,
      creditsUsed: credits.creditsUsed,
      rolloverCredits: credits.rolloverCredits,
      lastRefreshAt: credits.lastRefreshAt,
    })
    .from(credits)
    .where(eq(credits.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}


/**
 * Get credit transaction history with pagination
 */
export async function getCreditHistory(
  userId: number,
  limit: number = 20,
  offset: number = 0
): Promise<{
  transactions: Array<{
    id: number;
    amount: number;
    type: string;
    description: string | null;
    referenceId: string | null;
    balanceAfter: number;
    engineUsed: string | null;
    createdAt: Date;
  }>;
  total: number;
}> {
  const db = await getDb();
  if (!db) {
    return { transactions: [], total: 0 };
  }

  try {
    // Get transactions with pagination
    const transactions = await db
      .select({
        id: creditTransactions.id,
        amount: creditTransactions.amount,
        type: creditTransactions.type,
        description: creditTransactions.description,
        referenceId: creditTransactions.referenceId,
        balanceAfter: creditTransactions.balanceAfter,
        engineUsed: creditTransactions.engineUsed,
        createdAt: creditTransactions.createdAt,
      })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId));

    const total = countResult[0]?.count || 0;

    return { transactions, total };
  } catch (error) {
    console.error("[Database] Failed to get credit history:", error);
    return { transactions: [], total: 0 };
  }
}

/**
 * Get usage statistics for a user
 */
export async function getUsageStats(
  userId: number,
  days: number = 30
): Promise<{
  totalCreditsUsed: number;
  totalGenerations: number;
  averagePerDay: number;
  byType: Record<string, { count: number; credits: number }>;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalCreditsUsed: 0,
      totalGenerations: 0,
      averagePerDay: 0,
      byType: {},
    };
  }

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all transactions in the period
    const transactions = await db
      .select({
        amount: creditTransactions.amount,
        type: creditTransactions.type,
        createdAt: creditTransactions.createdAt,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, userId),
          gte(creditTransactions.createdAt, startDate)
        )
      );

    // Calculate stats
    let totalCreditsUsed = 0;
    let totalGenerations = 0;
    const byType: Record<string, { count: number; credits: number }> = {};

    for (const tx of transactions) {
      // Only count negative amounts (usage)
      if (tx.amount < 0) {
        totalCreditsUsed += Math.abs(tx.amount);
        totalGenerations++;

        const type = tx.type;
        if (!byType[type]) {
          byType[type] = { count: 0, credits: 0 };
        }
        byType[type].count++;
        byType[type].credits += Math.abs(tx.amount);
      }
    }

    const averagePerDay = days > 0 ? totalCreditsUsed / days : 0;

    return {
      totalCreditsUsed,
      totalGenerations,
      averagePerDay: Math.round(averagePerDay * 10) / 10,
      byType,
    };
  } catch (error) {
    console.error("[Database] Failed to get usage stats:", error);
    return {
      totalCreditsUsed: 0,
      totalGenerations: 0,
      averagePerDay: 0,
      byType: {},
    };
  }
}

/**
 * Get daily usage data for charts
 */
export async function getDailyUsage(
  userId: number,
  days: number = 30
): Promise<Array<{
  date: string;
  creditsUsed: number;
  generationCount: number;
}>> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all transactions in the period
    const transactions = await db
      .select({
        amount: creditTransactions.amount,
        createdAt: creditTransactions.createdAt,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, userId),
          gte(creditTransactions.createdAt, startDate),
          lt(creditTransactions.amount, 0) // Only usage (negative amounts)
        )
      )
      .orderBy(asc(creditTransactions.createdAt));

    // Group by date
    const dailyMap = new Map<string, { creditsUsed: number; generationCount: number }>();

    // Initialize all days with zero values
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split("T")[0];
      dailyMap.set(dateStr, { creditsUsed: 0, generationCount: 0 });
    }

    // Aggregate transactions by date
    for (const tx of transactions) {
      const dateStr = new Date(tx.createdAt).toISOString().split("T")[0];
      const existing = dailyMap.get(dateStr) || { creditsUsed: 0, generationCount: 0 };
      existing.creditsUsed += Math.abs(tx.amount);
      existing.generationCount++;
      dailyMap.set(dateStr, existing);
    }

    // Convert to array
    return Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      creditsUsed: data.creditsUsed,
      generationCount: data.generationCount,
    }));
  } catch (error) {
    console.error("[Database] Failed to get daily usage:", error);
    return [];
  }
}
