import { eq, desc, and, gte, gt, lt, lte, asc, sql, like, or, isNull, isNotNull, SQL } from "drizzle-orm";
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
): Promise<{ success: boolean; newBalance?: number; error?: string; duplicate?: boolean }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // IDEMPOTENCY CHECK: If referenceId is provided, check for duplicate transaction
    // This prevents double-crediting from Stripe webhook replays
    if (referenceId) {
      const existing = await db
        .select({ id: creditTransactions.id })
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.referenceId, referenceId),
            eq(creditTransactions.userId, userId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.warn(`[Database] Duplicate transaction detected: referenceId=${referenceId}, userId=${userId}. Skipping.`);
        const userCredits = await getUserCredits(userId);
        return { success: true, newBalance: userCredits?.balance ?? 0, duplicate: true };
      }
    }

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
): Promise<{ success: boolean; newBalance?: number; error?: string; duplicate?: boolean }> {
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


// ============ Account Suspension & Lockout Functions ============

/**
 * Suspend a user account
 */
export async function suspendUser(
  userId: number,
  reason: string,
  suspendedByAdminId: number
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    await db.update(users)
      .set({
        suspendedAt: new Date(),
        suspendedReason: reason,
        suspendedBy: suspendedByAdminId,
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to suspend user:", error);
    return { success: false, error: "Failed to suspend user" };
  }
}

/**
 * Unsuspend a user account
 */
export async function unsuspendUser(userId: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    await db.update(users)
      .set({
        suspendedAt: null,
        suspendedReason: null,
        suspendedBy: null,
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to unsuspend user:", error);
    return { success: false, error: "Failed to unsuspend user" };
  }
}

/**
 * Update a user's role (promote/demote between user and moderator)
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
    // Get current user to check existing role
    const [targetUser] = await db.select({ role: users.role, id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    // Prevent changing admin roles
    if (targetUser.role === "admin") {
      return { success: false, error: "Cannot change the role of an admin user" };
    }

    // Prevent self-role-change
    if (userId === changedByAdminId) {
      return { success: false, error: "Cannot change your own role" };
    }

    // Prevent no-op
    if (targetUser.role === newRole) {
      return { success: false, error: `User is already a ${newRole}` };
    }

    const previousRole = targetUser.role;

    await db.update(users)
      .set({ role: newRole })
      .where(eq(users.id, userId));

    return { success: true, previousRole };
  } catch (error) {
    console.error("[Database] Failed to update user role:", error);
    return { success: false, error: "Failed to update user role" };
  }
}

/**
 * Record a failed login attempt and potentially lock the account
 * Returns lockout info if account is now locked
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

    // Lock account if threshold exceeded
    if (newAttempts >= LOCKOUT_THRESHOLD) {
      lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    }

    await db.update(users)
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
    console.error("[Database] Failed to record failed login:", error);
    return { locked: false, attempts: 0 };
  }
}

/**
 * Reset failed login attempts on successful login
 */
export async function resetFailedLogins(openId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(users.openId, openId));
  } catch (error) {
    console.error("[Database] Failed to reset failed logins:", error);
  }
}

/**
 * Check if user account is locked
 */
export async function isAccountLocked(openId: string): Promise<{ locked: boolean; lockedUntil?: Date; reason?: string }> {
  const db = await getDb();
  if (!db) return { locked: false };

  try {
    const user = await getUserByOpenId(openId);
    if (!user) return { locked: false };

    // Check suspension
    if (user.suspendedAt) {
      return { 
        locked: true, 
        reason: user.suspendedReason || "Account suspended",
      };
    }

    // Check temporary lockout
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return { 
        locked: true, 
        lockedUntil: new Date(user.lockedUntil),
        reason: "Too many failed login attempts",
      };
    }

    return { locked: false };
  } catch (error) {
    console.error("[Database] Failed to check account lock:", error);
    return { locked: false };
  }
}


// ============================================================================
// IP BLOCKING HELPERS
// ============================================================================

import { blockedIps, emergencyTokens, type InsertBlockedIp, type InsertEmergencyToken } from "../drizzle/schema";

/**
 * Check if an IP address is blocked
 * Returns blocking info if blocked, null if not blocked
 */
export async function isIpBlocked(ipAddress: string): Promise<{ blocked: boolean; reason?: string; expiresAt?: Date | null }> {
  const db = await getDb();
  if (!db) return { blocked: false };

  try {
    const [block] = await db.select()
      .from(blockedIps)
      .where(eq(blockedIps.ipAddress, ipAddress))
      .limit(1);

    if (!block) return { blocked: false };

    // Check if block has expired
    if (block.expiresAt && new Date(block.expiresAt) < new Date()) {
      // Block expired, remove it
      await db.delete(blockedIps).where(eq(blockedIps.id, block.id));
      return { blocked: false };
    }

    return {
      blocked: true,
      reason: block.reason,
      expiresAt: block.expiresAt,
    };
  } catch (error) {
    console.error("[Database] Failed to check IP block:", error);
    return { blocked: false };
  }
}

/**
 * Block an IP address
 */
export async function blockIp(
  ipAddress: string,
  reason: string,
  blockedBy: number,
  expiresAt?: Date | null
): Promise<{ success: boolean; id?: number }> {
  const db = await getDb();
  if (!db) return { success: false };

  try {
    // Check if already blocked
    const existing = await isIpBlocked(ipAddress);
    if (existing.blocked) {
      return { success: true }; // Already blocked
    }

    const result = await db.insert(blockedIps).values({
      ipAddress,
      reason,
      blockedBy,
      expiresAt: expiresAt || null,
    });

    return { success: true, id: Number(result[0].insertId) };
  } catch (error) {
    console.error("[Database] Failed to block IP:", error);
    return { success: false };
  }
}

/**
 * Unblock an IP address
 */
export async function unblockIp(ipAddress: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(blockedIps).where(eq(blockedIps.ipAddress, ipAddress));
    return true;
  } catch (error) {
    console.error("[Database] Failed to unblock IP:", error);
    return false;
  }
}

/**
 * Get list of blocked IPs with pagination
 */
export async function getBlockedIps(
  limit: number = 50,
  offset: number = 0
): Promise<{ ips: typeof blockedIps.$inferSelect[]; total: number }> {
  const db = await getDb();
  if (!db) return { ips: [], total: 0 };

  try {
    const [ips, countResult] = await Promise.all([
      db.select()
        .from(blockedIps)
        .orderBy(desc(blockedIps.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(blockedIps),
    ]);

    return {
      ips,
      total: countResult[0]?.count || 0,
    };
  } catch (error) {
    console.error("[Database] Failed to get blocked IPs:", error);
    return { ips: [], total: 0 };
  }
}

// ============================================================================
// EMERGENCY TOKEN HELPERS
// ============================================================================

import { randomUUID } from "crypto";

/**
 * Create an emergency action token
 * Tokens are valid for 24 hours and single-use
 */
export async function createEmergencyToken(
  action: "block_ip" | "suspend_user",
  targetId: string,
  metadata?: Record<string, unknown>
): Promise<{ token: string; expiresAt: Date } | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(emergencyTokens).values({
      token,
      action,
      targetId,
      metadata: metadata || null,
      expiresAt,
    });

    return { token, expiresAt };
  } catch (error) {
    console.error("[Database] Failed to create emergency token:", error);
    return null;
  }
}

/**
 * Validate and consume an emergency token
 * Returns the token data if valid, null if invalid/expired/used
 */
export async function consumeEmergencyToken(
  token: string,
  usedBy?: string
): Promise<{
  action: "block_ip" | "suspend_user";
  targetId: string;
  metadata: Record<string, unknown> | null;
} | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const [tokenRecord] = await db.select()
      .from(emergencyTokens)
      .where(eq(emergencyTokens.token, token))
      .limit(1);

    if (!tokenRecord) {
      console.warn("[EmergencyToken] Token not found");
      return null;
    }

    // Check if already used
    if (tokenRecord.usedAt) {
      console.warn("[EmergencyToken] Token already used");
      return null;
    }

    // Check if expired
    if (new Date(tokenRecord.expiresAt) < new Date()) {
      console.warn("[EmergencyToken] Token expired");
      return null;
    }

    // Mark as used
    await db.update(emergencyTokens)
      .set({
        usedAt: new Date(),
        usedBy: usedBy || null,
      })
      .where(eq(emergencyTokens.id, tokenRecord.id));

    return {
      action: tokenRecord.action,
      targetId: tokenRecord.targetId,
      metadata: tokenRecord.metadata as Record<string, unknown> | null,
    };
  } catch (error) {
    console.error("[Database] Failed to consume emergency token:", error);
    return null;
  }
}


// ============================================================================
// USER MANAGEMENT HELPERS (Admin)
// ============================================================================

/**
 * Get paginated list of all users with search and filters
 */
export async function listAllUsers(options: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: "active" | "suspended" | "locked" | "all";
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

    // Search filter
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

    // Status filter
    if (status === "suspended") {
      conditions.push(isNotNull(users.suspendedAt));
    } else if (status === "locked") {
      conditions.push(gt(users.lockedUntil, new Date()));
    } else if (status === "active") {
      conditions.push(isNull(users.suspendedAt));
      conditions.push(or(isNull(users.lockedUntil), lte(users.lockedUntil, new Date()))!);
    }

    // Role filter
    if (role !== "all") {
      conditions.push(eq(users.role, role));
    }

    // Build where clause
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);
    const total = countResult?.count || 0;

    // Get paginated users with sorting
    const orderColumn = sortBy === "name" ? users.name : sortBy === "lastSignedIn" ? users.lastSignedIn : users.createdAt;
    const orderDirection = sortOrder === "asc" ? asc(orderColumn) : desc(orderColumn);

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
 * Get detailed user information including credits
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
    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return null;

    // Get credits
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

    // Get model count
    const [modelCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(models)
      .where(eq(models.userId, userId));

    // Get generation count
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
 * Adjust user credits (add or deduct) with audit logging
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
    // Get current balance
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

    // Update balance
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
        .set({
          balance: newBalance,
        })
        .where(eq(credits.userId, userId));
    }

    // Log transaction
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
 * Get user statistics summary for admin dashboard
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

    // Total users
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    // Suspended users
    const [suspendedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(isNotNull(users.suspendedAt));

    // Locked users (currently locked)
    const [lockedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(gt(users.lockedUntil, now));

    // New users this month
    const [newResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, startOfMonth));

    // Admin count
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


// ============ Moderator Read-Only Query Functions ============

/**
 * Get detailed credit transaction history for a user (moderator read-only).
 * Includes filtering by transaction type and date range.
 */
export async function getDetailedCreditHistory(
  userId: number,
  options: {
    limit?: number;
    offset?: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
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
  summary: {
    totalCreditsEarned: number;
    totalCreditsSpent: number;
    netChange: number;
    transactionsByType: Record<string, { count: number; totalAmount: number }>;
  };
}> {
  const db = await getDb();
  if (!db) {
    return {
      transactions: [],
      total: 0,
      summary: { totalCreditsEarned: 0, totalCreditsSpent: 0, netChange: 0, transactionsByType: {} },
    };
  }

  const { limit = 50, offset = 0, type, startDate, endDate } = options;

  try {
    // Build where conditions
    const conditions = [eq(creditTransactions.userId, userId)];
    if (type) {
      conditions.push(eq(creditTransactions.type, type as any));
    }
    if (startDate) {
      conditions.push(gte(creditTransactions.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(creditTransactions.createdAt, endDate));
    }

    const whereClause = and(...conditions);

    // Get transactions with pagination
    const txns = await db
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
      .where(whereClause)
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count with same filters
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(creditTransactions)
      .where(whereClause);

    const total = countResult?.count || 0;

    // Get all transactions for this user (unfiltered) for summary stats
    const allTxns = await db
      .select({
        amount: creditTransactions.amount,
        type: creditTransactions.type,
      })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId));

    // Calculate summary
    let totalCreditsEarned = 0;
    let totalCreditsSpent = 0;
    const transactionsByType: Record<string, { count: number; totalAmount: number }> = {};

    for (const txn of allTxns) {
      if (txn.amount > 0) {
        totalCreditsEarned += txn.amount;
      } else {
        totalCreditsSpent += Math.abs(txn.amount);
      }

      if (!transactionsByType[txn.type]) {
        transactionsByType[txn.type] = { count: 0, totalAmount: 0 };
      }
      transactionsByType[txn.type].count++;
      transactionsByType[txn.type].totalAmount += txn.amount;
    }

    return {
      transactions: txns,
      total,
      summary: {
        totalCreditsEarned,
        totalCreditsSpent,
        netChange: totalCreditsEarned - totalCreditsSpent,
        transactionsByType,
      },
    };
  } catch (error) {
    console.error("[Database] Failed to get detailed credit history:", error);
    return {
      transactions: [],
      total: 0,
      summary: { totalCreditsEarned: 0, totalCreditsSpent: 0, netChange: 0, transactionsByType: {} },
    };
  }
}

/**
 * Get detailed generation history for a user (moderator read-only).
 * Includes filtering by status, type, and date range.
 */
export async function getDetailedGenerationHistory(
  userId: number,
  options: {
    limit?: number;
    offset?: number;
    status?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{
  generations: Array<{
    id: number;
    modelId: number | null;
    type: string;
    status: string;
    pointsCost: number;
    resultUrl: string | null;
    errorMessage: string | null;
    metadata: unknown;
    createdAt: Date;
    completedAt: Date | null;
    modelName: string | null;
  }>;
  total: number;
  summary: {
    totalGenerations: number;
    completedCount: number;
    failedCount: number;
    pendingCount: number;
    totalCreditsUsed: number;
    generationsByType: Record<string, { count: number; totalCost: number }>;
    failureRate: number;
  };
}> {
  const db = await getDb();
  if (!db) {
    return {
      generations: [],
      total: 0,
      summary: {
        totalGenerations: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        totalCreditsUsed: 0,
        generationsByType: {},
        failureRate: 0,
      },
    };
  }

  const { limit = 50, offset = 0, status, type, startDate, endDate } = options;

  try {
    // Build where conditions
    const conditions = [eq(generations.userId, userId)];
    if (status) {
      conditions.push(eq(generations.status, status as any));
    }
    if (type) {
      conditions.push(eq(generations.type, type as any));
    }
    if (startDate) {
      conditions.push(gte(generations.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(generations.createdAt, endDate));
    }

    const whereClause = and(...conditions);

    // Get generations with model name join
    const gens = await db
      .select({
        id: generations.id,
        modelId: generations.modelId,
        type: generations.type,
        status: generations.status,
        pointsCost: generations.pointsCost,
        resultUrl: generations.resultUrl,
        errorMessage: generations.errorMessage,
        metadata: generations.metadata,
        createdAt: generations.createdAt,
        completedAt: generations.completedAt,
        modelName: models.name,
      })
      .from(generations)
      .leftJoin(models, eq(generations.modelId, models.id))
      .where(whereClause)
      .orderBy(desc(generations.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count with same filters
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(generations)
      .where(whereClause);

    const total = countResult?.count || 0;

    // Get all generations for this user (unfiltered) for summary stats
    const allGens = await db
      .select({
        status: generations.status,
        type: generations.type,
        pointsCost: generations.pointsCost,
      })
      .from(generations)
      .where(eq(generations.userId, userId));

    // Calculate summary
    let completedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let totalCreditsUsed = 0;
    const generationsByType: Record<string, { count: number; totalCost: number }> = {};

    for (const gen of allGens) {
      if (gen.status === "completed") completedCount++;
      else if (gen.status === "failed") failedCount++;
      else pendingCount++;

      totalCreditsUsed += gen.pointsCost;

      if (!generationsByType[gen.type]) {
        generationsByType[gen.type] = { count: 0, totalCost: 0 };
      }
      generationsByType[gen.type].count++;
      generationsByType[gen.type].totalCost += gen.pointsCost;
    }

    const totalGenerations = allGens.length;
    const failureRate = totalGenerations > 0 ? (failedCount / totalGenerations) * 100 : 0;

    return {
      generations: gens,
      total,
      summary: {
        totalGenerations,
        completedCount,
        failedCount,
        pendingCount,
        totalCreditsUsed,
        generationsByType,
        failureRate: Math.round(failureRate * 100) / 100,
      },
    };
  } catch (error) {
    console.error("[Database] Failed to get detailed generation history:", error);
    return {
      generations: [],
      total: 0,
      summary: {
        totalGenerations: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        totalCreditsUsed: 0,
        generationsByType: {},
        failureRate: 0,
      },
    };
  }
}


// ============================================================
// Change Request CRUD Helpers
// ============================================================

import { changeRequests, ChangeRequest, InsertChangeRequest } from "../drizzle/schema";

/**
 * Create a new change request submitted by a moderator.
 */
export async function createChangeRequest(
  data: Omit<InsertChangeRequest, "id" | "status" | "createdAt" | "updatedAt">
): Promise<{ success: boolean; requestId?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    const [result] = await db.insert(changeRequests).values({
      ...data,
      status: "pending",
    });
    return { success: true, requestId: result.insertId };
  } catch (error) {
    console.error("[Database] Failed to create change request:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get a single change request by ID.
 */
export async function getChangeRequestById(id: number): Promise<ChangeRequest | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const [row] = await db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.id, id))
      .limit(1);
    return row || null;
  } catch (error) {
    console.error("[Database] Failed to get change request:", error);
    return null;
  }
}

/**
 * List change requests with filtering and pagination.
 * Used by admins to review pending requests and by moderators to view their own.
 */
export async function listChangeRequests(options: {
  status?: "pending" | "approved" | "denied" | "cancelled" | "expired" | "pending_execution";
  type?: string;
  submittedById?: number;
  targetUserId?: number;
  priority?: string;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "priority" | "updatedAt";
  sortOrder?: "asc" | "desc";
} = {}): Promise<{
  requests: ChangeRequest[];
  total: number;
  summary: {
    pendingCount: number;
    approvedCount: number;
    deniedCount: number;
    cancelledCount: number;
    expiredCount: number;
    pendingExecutionCount: number;
    totalCount: number;
  };
}> {
  const db = await getDb();
  if (!db) {
    return {
      requests: [],
      total: 0,
      summary: { pendingCount: 0, approvedCount: 0, deniedCount: 0, cancelledCount: 0, expiredCount: 0, pendingExecutionCount: 0, totalCount: 0 },
    };
  }

  const {
    status,
    type,
    submittedById,
    targetUserId,
    priority,
    limit = 50,
    offset = 0,
    sortOrder = "desc",
  } = options;

  try {
    // Build where conditions
    const conditions: SQL[] = [];
    if (status) conditions.push(eq(changeRequests.status, status));
    if (type) conditions.push(eq(changeRequests.type, type as any));
    if (submittedById) conditions.push(eq(changeRequests.submittedById, submittedById));
    if (targetUserId) conditions.push(eq(changeRequests.targetUserId, targetUserId));
    if (priority) conditions.push(eq(changeRequests.priority, priority as any));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get paginated results
    const orderFn = sortOrder === "asc" ? asc : desc;
    const requests = await db
      .select()
      .from(changeRequests)
      .where(whereClause)
      .orderBy(orderFn(changeRequests.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(changeRequests)
      .where(whereClause);
    const total = countResult?.count || 0;

    // Get summary counts (unfiltered by status, but filtered by submittedById/targetUserId if set)
    const summaryConditions: SQL[] = [];
    if (submittedById) summaryConditions.push(eq(changeRequests.submittedById, submittedById));
    if (targetUserId) summaryConditions.push(eq(changeRequests.targetUserId, targetUserId));
    const summaryWhere = summaryConditions.length > 0 ? and(...summaryConditions) : undefined;

    const summaryRows = await db
      .select({
        status: changeRequests.status,
        count: sql<number>`count(*)`,
      })
      .from(changeRequests)
      .where(summaryWhere)
      .groupBy(changeRequests.status);

    let pendingCount = 0;
    let approvedCount = 0;
    let deniedCount = 0;
    let cancelledCount = 0;
    let expiredCount = 0;
    let pendingExecutionCount = 0;
    let totalCount = 0;
    for (const row of summaryRows) {
      totalCount += row.count;
      if (row.status === "pending") pendingCount = row.count;
      else if (row.status === "approved") approvedCount = row.count;
      else if (row.status === "denied") deniedCount = row.count;
      else if (row.status === "cancelled") cancelledCount = row.count;
      else if (row.status === "expired") expiredCount = row.count;
      else if (row.status === "pending_execution") pendingExecutionCount = row.count;
    }

    return {
      requests,
      total,
      summary: { pendingCount, approvedCount, deniedCount, cancelledCount, expiredCount, pendingExecutionCount, totalCount },
    };
  } catch (error) {
    console.error("[Database] Failed to list change requests:", error);
    return {
      requests: [],
      total: 0,
      summary: { pendingCount: 0, approvedCount: 0, deniedCount: 0, cancelledCount: 0, expiredCount: 0, pendingExecutionCount: 0, totalCount: 0 },
    };
  }
}

/**
 * Update the status of a change request (approve, deny, cancel, expire).
 * Used by admins to review requests.
 */
export async function updateChangeRequestStatus(
  id: number,
  update: {
    status: "approved" | "denied" | "cancelled" | "expired" | "pending_execution";
    reviewedById?: number;
    reviewedByName?: string;
    reviewNotes?: string;
    slackApprovalId?: string;
  },
  /** Which current status to match. Defaults to "pending". */
  fromStatus: "pending" | "pending_execution" = "pending"
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    const setData: Record<string, unknown> = {
      status: update.status,
      updatedAt: new Date(),
    };
    if (update.reviewedById !== undefined) setData.reviewedById = update.reviewedById;
    if (update.reviewedByName !== undefined) setData.reviewedByName = update.reviewedByName;
    if (update.reviewNotes !== undefined) setData.reviewNotes = update.reviewNotes;
    if (update.slackApprovalId !== undefined) setData.slackApprovalId = update.slackApprovalId;
    // Only set reviewedAt when transitioning from pending (first review)
    if (fromStatus === "pending") setData.reviewedAt = new Date();

    const [result] = await db
      .update(changeRequests)
      .set(setData)
      .where(and(eq(changeRequests.id, id), eq(changeRequests.status, fromStatus)));

    if (result.affectedRows === 0) {
      return { success: false, error: `Change request not found or not in ${fromStatus} status` };
    }

    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to update change request status:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get change requests submitted by a specific moderator.
 * Convenience wrapper around listChangeRequests.
 */
export async function getChangeRequestsByModerator(
  moderatorId: number,
  options: {
    status?: "pending" | "approved" | "denied" | "cancelled" | "expired" | "pending_execution";
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  requests: ChangeRequest[];
  total: number;
  summary: {
    pendingCount: number;
    approvedCount: number;
    deniedCount: number;
    totalCount: number;
  };
}> {
  return listChangeRequests({
    submittedById: moderatorId,
    status: options.status,
    limit: options.limit,
    offset: options.offset,
  });
}
