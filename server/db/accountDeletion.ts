/**
 * Account Deletion — GDPR-compliant cascading deletion of all user data.
 *
 * Deletion order (respects foreign key dependencies):
 *   1. changeRequestAttachments (via changeRequests)
 *   2. changeRequests (submittedById or targetUserId)
 *   3. referrals (referrerUserId)
 *   4. modelAssets (via models.userId)
 *   5. models (userId)
 *   6. generations (userId)
 *   7. creditTransactions (userId)
 *   8. credits (userId)
 *   9. auditLogs (userId) — anonymize, don't delete (compliance)
 *  10. users (id)
 *
 * S3 cleanup: Collects all storage keys before deletion and returns them
 * for the caller to delete from S3 separately (keeps DB ops clean).
 */
import { eq, or, inArray, sql } from "drizzle-orm";
import {
  users,
  credits,
  creditTransactions,
  models,
  modelAssets,
  generations,
  auditLogs,
  changeRequests,
  changeRequestAttachments,
  referrals,
} from "../../drizzle/schema";
import { getDb, withTransaction } from "./connection";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/accountDeletion");

export interface DeletionResult {
  success: boolean;
  storageKeysToDelete: string[];
  deletedCounts: {
    changeRequestAttachments: number;
    changeRequests: number;
    referrals: number;
    modelAssets: number;
    models: number;
    generations: number;
    creditTransactions: number;
    credits: number;
    auditLogsAnonymized: number;
    user: number;
  };
  error?: string;
}

/**
 * Extract S3 key from a full CloudFront/S3 URL.
 */
function extractKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length >= 3) {
      return pathParts.slice(2).join("/");
    }
    return parsed.pathname.slice(1);
  } catch {
    return url;
  }
}

/**
 * Collect all S3 storage keys associated with a user.
 */
async function collectStorageKeys(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const keys: string[] = [];

  // User avatar and banner
  const userRows = await db
    .select({ avatarKey: users.avatarKey, bannerKey: users.bannerKey })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userRows[0]?.avatarKey) keys.push(userRows[0].avatarKey);
  if (userRows[0]?.bannerKey) keys.push(userRows[0].bannerKey);

  // Model assets
  const userModels = await db
    .select({ id: models.id })
    .from(models)
    .where(eq(models.userId, userId));

  if (userModels.length > 0) {
    const modelIds = userModels.map((m: { id: number }) => m.id);
    const assets = await db
      .select({ storageUrl: modelAssets.storageUrl })
      .from(modelAssets)
      .where(inArray(modelAssets.modelId, modelIds));

    for (const asset of assets) {
      if (asset.storageUrl) {
        const key = extractKeyFromUrl(asset.storageUrl);
        if (key) keys.push(key);
      }
    }
  }

  // Change request attachments
  const attachments = await db
    .select({ fileKey: changeRequestAttachments.fileKey })
    .from(changeRequestAttachments)
    .where(eq(changeRequestAttachments.uploadedById, userId));

  for (const att of attachments) {
    if (att.fileKey) keys.push(att.fileKey);
  }

  return keys;
}

/**
 * Delete all user data from the database in the correct order.
 * Returns storage keys that need to be cleaned up from S3.
 */
export async function deleteUserAccount(userId: number): Promise<DeletionResult> {
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      storageKeysToDelete: [],
      deletedCounts: {
        changeRequestAttachments: 0, changeRequests: 0, referrals: 0,
        modelAssets: 0, models: 0, generations: 0,
        creditTransactions: 0, credits: 0, auditLogsAnonymized: 0, user: 0,
      },
      error: "Database not available",
    };
  }

  const counts: DeletionResult["deletedCounts"] = {
    changeRequestAttachments: 0,
    changeRequests: 0,
    referrals: 0,
    modelAssets: 0,
    models: 0,
    generations: 0,
    creditTransactions: 0,
    credits: 0,
    auditLogsAnonymized: 0,
    user: 0,
  };

  try {
    // Step 0: Collect S3 keys before deleting records (outside transaction)
    const storageKeysToDelete = await collectStorageKeys(userId);

    // All deletion steps run inside a single transaction for atomicity
    await withTransaction(async (tx) => {
      // Step 1: Delete change request attachments
      const userCRs = await tx
        .select({ id: changeRequests.id })
        .from(changeRequests)
        .where(
          or(
            eq(changeRequests.submittedById, userId),
            eq(changeRequests.targetUserId, userId),
          ),
        );

      if (userCRs.length > 0) {
        const crIds = userCRs.map((cr: { id: number }) => cr.id);
        const attResult = await tx
          .delete(changeRequestAttachments)
          .where(inArray(changeRequestAttachments.changeRequestId!, crIds));
        counts.changeRequestAttachments = (attResult as any)[0]?.affectedRows ?? 0;
      }

      // Step 2: Delete change requests
      const crResult = await tx
        .delete(changeRequests)
        .where(
          or(
            eq(changeRequests.submittedById, userId),
            eq(changeRequests.targetUserId, userId),
          ),
        );
      counts.changeRequests = (crResult as any)[0]?.affectedRows ?? 0;

      // Step 3: Delete referrals
      const refResult = await tx
        .delete(referrals)
        .where(eq(referrals.referrerUserId, userId));
      counts.referrals = (refResult as any)[0]?.affectedRows ?? 0;

      // Step 4: Delete model assets
      const userModels = await tx
        .select({ id: models.id })
        .from(models)
        .where(eq(models.userId, userId));

      if (userModels.length > 0) {
        const modelIds = userModels.map((m: { id: number }) => m.id);
        const assetResult = await tx
          .delete(modelAssets)
          .where(inArray(modelAssets.modelId, modelIds));
        counts.modelAssets = (assetResult as any)[0]?.affectedRows ?? 0;
      }

      // Step 5: Delete models
      const modelResult = await tx
        .delete(models)
        .where(eq(models.userId, userId));
      counts.models = (modelResult as any)[0]?.affectedRows ?? 0;

      // Step 6: Delete generations
      const genResult = await tx
        .delete(generations)
        .where(eq(generations.userId, userId));
      counts.generations = (genResult as any)[0]?.affectedRows ?? 0;

      // Step 7: Delete credit transactions
      const txResult = await tx
        .delete(creditTransactions)
        .where(eq(creditTransactions.userId, userId));
      counts.creditTransactions = (txResult as any)[0]?.affectedRows ?? 0;

      // Step 8: Delete credits
      const credResult = await tx
        .delete(credits)
        .where(eq(credits.userId, userId));
      counts.credits = (credResult as any)[0]?.affectedRows ?? 0;

      // Step 9: Anonymize audit logs (compliance — don't delete)
      const auditResult = await tx
        .update(auditLogs)
        .set({
          userId: null,
          metadata: sql`JSON_SET(COALESCE(metadata, '{}'), '$.deletedUser', true)`,
        })
        .where(eq(auditLogs.userId, userId));
      counts.auditLogsAnonymized = (auditResult as any)[0]?.affectedRows ?? 0;

      // Step 10: Delete user
      const userResult = await tx.delete(users).where(eq(users.id, userId));
      counts.user = (userResult as any)[0]?.affectedRows ?? 0;
    });

    return {
      success: counts.user > 0,
      storageKeysToDelete,
      deletedCounts: counts,
    };
  } catch (error) {
    log.error({ err: error }, "[AccountDeletion] Failed:");
    return {
      success: false,
      storageKeysToDelete: [],
      deletedCounts: counts,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
