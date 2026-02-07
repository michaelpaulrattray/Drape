/**
 * Account Deletion Helper
 * 
 * Handles GDPR-compliant self-service account deletion:
 * 1. Cancels active Stripe subscription (immediately, not at period end)
 * 2. Deletes S3 files (avatar, banner, model assets)
 * 3. Deletes user-created content (models, model assets, generations)
 * 4. Anonymizes user record (name, email, avatar → null)
 * 5. Zeros out credit balance
 * 6. Logs audit event
 * 
 * Financial records (credit transactions, change requests) are retained
 * in anonymized form for legal/compliance requirements.
 */

import { eq, sql } from "drizzle-orm";
import { getDb, getUserCredits, getUserById } from "../db";
import {
  users,
  credits,
  models,
  modelAssets,
  generations,
  auditLogs,
  changeRequests,
  AUDIT_ACTIONS,
} from "../../drizzle/schema";
import { storageDelete } from "../storage";
import { stripe } from "../stripe/stripeService";
import { logAuditEvent } from "../auditLog";

export interface DeleteUserResult {
  success: boolean;
  error?: string;
  /** Summary of what was cleaned up */
  summary?: {
    stripeSubscriptionCancelled: boolean;
    s3FilesDeleted: number;
    s3FilesFailed: number;
    modelsDeleted: number;
    generationsDeleted: number;
    creditsZeroed: boolean;
    userAnonymized: boolean;
  };
}

/**
 * Collect all S3 keys that belong to a user (avatar, banner, model assets).
 */
async function collectUserS3Keys(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number
): Promise<string[]> {
  const keys: string[] = [];

  // User avatar and banner keys
  const user = await db
    .select({ avatarKey: users.avatarKey, bannerKey: users.bannerKey })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user.length > 0) {
    if (user[0].avatarKey) keys.push(user[0].avatarKey);
    if (user[0].bannerKey) keys.push(user[0].bannerKey);
  }

  // Model asset S3 keys
  const userModels = await db
    .select({ id: models.id })
    .from(models)
    .where(eq(models.userId, userId));

  for (const model of userModels) {
    const assets = await db
      .select({ storageKey: modelAssets.storageKey })
      .from(modelAssets)
      .where(eq(modelAssets.modelId, model.id));

    for (const asset of assets) {
      if (asset.storageKey) keys.push(asset.storageKey);
    }
  }

  return keys;
}

/**
 * Delete all S3 files for a user. Best-effort — failures are logged but
 * do not block account deletion.
 */
async function deleteS3Files(keys: string[]): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;

  for (const key of keys) {
    try {
      const result = await storageDelete(key);
      if (result.success) {
        deleted++;
      } else {
        failed++;
        console.warn(`[DeleteUser] Failed to delete S3 key: ${key}`);
      }
    } catch (err) {
      failed++;
      console.error(`[DeleteUser] Error deleting S3 key ${key}:`, err);
    }
  }

  return { deleted, failed };
}

/**
 * Cancel a Stripe subscription immediately (not at period end).
 * Returns true if cancelled or no subscription existed.
 */
async function cancelStripeSubscriptionImmediate(
  subscriptionId: string | null | undefined
): Promise<boolean> {
  if (!subscriptionId) return true; // Nothing to cancel

  try {
    await stripe.subscriptions.cancel(subscriptionId);
    console.log(`[DeleteUser] Stripe subscription ${subscriptionId} cancelled immediately`);
    return true;
  } catch (err: any) {
    // If subscription is already cancelled/inactive, treat as success
    if (err?.code === "resource_missing" || err?.statusCode === 404) {
      console.log(`[DeleteUser] Stripe subscription ${subscriptionId} already cancelled`);
      return true;
    }
    console.error(`[DeleteUser] Failed to cancel Stripe subscription ${subscriptionId}:`, err);
    return false;
  }
}

/**
 * Delete all user-created content and anonymize the user record.
 * This is the main entry point for account deletion.
 */
export async function deleteUserData(
  userId: number,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<DeleteUserResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  // Verify user exists
  const user = await getUserById(userId);
  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Prevent admin self-deletion (admins should be demoted first)
  if (user.role === "admin") {
    return { success: false, error: "Admin accounts cannot be self-deleted. Contact support." };
  }

  const summary = {
    stripeSubscriptionCancelled: false,
    s3FilesDeleted: 0,
    s3FilesFailed: 0,
    modelsDeleted: 0,
    generationsDeleted: 0,
    creditsZeroed: false,
    userAnonymized: false,
  };

  try {
    // 1. Cancel Stripe subscription immediately
    const userCredits = await getUserCredits(userId);
    const subscriptionId = userCredits?.stripeSubscriptionId;
    summary.stripeSubscriptionCancelled = await cancelStripeSubscriptionImmediate(subscriptionId);

    // 2. Collect and delete S3 files (best-effort)
    const s3Keys = await collectUserS3Keys(db, userId);
    const s3Result = await deleteS3Files(s3Keys);
    summary.s3FilesDeleted = s3Result.deleted;
    summary.s3FilesFailed = s3Result.failed;

    // 3. Delete model assets (DB records)
    const userModels = await db
      .select({ id: models.id })
      .from(models)
      .where(eq(models.userId, userId));

    for (const model of userModels) {
      await db.delete(modelAssets).where(eq(modelAssets.modelId, model.id));
    }

    // 4. Delete models
    const modelDeleteResult = await db.delete(models).where(eq(models.userId, userId));
    summary.modelsDeleted = userModels.length;

    // 5. Delete generations
    const userGens = await db
      .select({ id: generations.id })
      .from(generations)
      .where(eq(generations.userId, userId));
    await db.delete(generations).where(eq(generations.userId, userId));
    summary.generationsDeleted = userGens.length;

    // 6. Zero out credits and reset subscription fields
    if (userCredits) {
      await db.update(credits).set({
        balance: 0,
        planTier: "free",
        stripeSubscriptionId: null,
        subscriptionStatus: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        planExpiresAt: null,
        creditsPurchased: 0,
        creditsUsed: 0,
        rolloverCredits: 0,
      }).where(eq(credits.userId, userId));
      summary.creditsZeroed = true;
    }

    // 7. Anonymize user record (keep the row for FK integrity but strip PII)
    await db.update(users).set({
      name: "Deleted User",
      displayName: null,
      email: null,
      avatarUrl: null,
      avatarKey: null,
      bannerUrl: null,
      bannerKey: null,
      bio: null,
      loginMethod: null,
      storageUsed: 0,
      suspendedAt: new Date(),
      suspendedReason: "Account deleted by user",
      failedLoginAttempts: 0,
      lockedUntil: null,
    }).where(eq(users.id, userId));
    summary.userAnonymized = true;

    // 8. Log audit event
    await logAuditEvent({
      userId,
      action: AUDIT_ACTIONS.ACCOUNT_DELETED,
      resourceType: "user",
      resourceId: String(userId),
      metadata: {
        summary,
        openId: user.openId,
        hadSubscription: !!subscriptionId,
      },
      severity: "warning",
      ipAddress,
      userAgent,
    });

    return { success: true, summary };
  } catch (error) {
    console.error("[DeleteUser] Account deletion failed:", error);

    // Still log the failed attempt
    await logAuditEvent({
      userId,
      action: AUDIT_ACTIONS.ACCOUNT_DELETED,
      resourceType: "user",
      resourceId: String(userId),
      metadata: { error: String(error), partialSummary: summary },
      severity: "critical",
      ipAddress,
      userAgent,
    }).catch(() => {}); // Don't throw if audit logging also fails

    return { success: false, error: "Account deletion failed. Please contact support." };
  }
}
