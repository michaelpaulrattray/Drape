/**
 * Account Deletion — GDPR-compliant cascading deletion of all user data.
 *
 * Deletion order (respects foreign key dependencies):
 *   1. changeRequestAttachments (via changeRequests)
 *   2. changeRequests (submittedById or targetUserId)
 *   3. referrals (referrerUserId)
 *   4. complete board tree (edges, versions, items, boards)
 *   5. Wardrobe looks, sessions, outfits and garments
 *   6. model snapshot slots, packages and identities (via models.userId)
 *   7. modelAssets (via models.userId)
 *   8. models (userId)
 *   9. generations (userId)
 *  10. creditTransactions (userId)
 *  11. credits (userId)
 *  12. auditLogs (userId) — anonymize, don't delete (compliance)
 *  13. users (id)
 *
 * Owned-storage cleanup: persists an exact-key manifest in the same database
 * transaction; the leased R7-5D worker performs storage deletion later.
 */
import { randomUUID } from "node:crypto";
import { eq, or, inArray, sql } from "drizzle-orm";
import {
  users,
  credits,
  creditTransactions,
  models,
  modelAssets,
  modelIdentitySnapshots,
  modelPackageSnapshots,
  modelPackageSnapshotSlots,
  generations,
  auditLogs,
  changeRequests,
  changeRequestAttachments,
  referrals,
  wardrobeGarments,
  wardrobeOutfits,
  wardrobeSessions,
  wardrobeLooks,
  boards,
  boardItems,
  boardItemVersions,
  boardEdges,
} from "../../drizzle/schema";
import { getDb, withTransaction } from "./connection";
import type { TransactionHandle } from "./connection";
import { createStorageCleanupManifestIn } from "./storageCleanup";
import { classifyStorageReference, parseJsonValue } from "../casting/deletionAudit";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/accountDeletion");

export interface DeletionResult {
  success: boolean;
  cleanupBatchId: string | null;
  cleanupObjects: number;
  deletedCounts: {
    changeRequestAttachments: number;
    changeRequests: number;
    referrals: number;
    boardEdges: number;
    boardItemVersions: number;
    boardItems: number;
    boards: number;
    wardrobeLooks: number;
    wardrobeSessions: number;
    wardrobeOutfits: number;
    wardrobeGarments: number;
    modelPackageSnapshotSlots: number;
    modelPackageSnapshots: number;
    modelIdentitySnapshots: number;
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

function addOwnedAccountKey(
  keys: Set<string>,
  currentPublicUrl: string,
  reference: { storageKey?: unknown; url?: unknown },
): void {
  const classified = classifyStorageReference({ ...reference, currentPublicUrl });
  if (classified.kind === "explicit_key" || classified.kind === "current_origin_url") {
    keys.add(classified.key);
  }
}

/** Account erasure owns all rows selected by user id. This collector uses the
 * same exact-origin law as Cast deletion and includes model-less VTO attempts. */
export async function collectAccountOwnedStorageKeysIn(
  tx: TransactionHandle,
  userId: number,
  currentPublicUrl: string,
): Promise<string[]> {
  const keys = new Set<string>();
  const userRows = await tx
    .select({
      avatarKey: users.avatarKey,
      bannerKey: users.bannerKey,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (userRows[0]) {
    addOwnedAccountKey(keys, currentPublicUrl, { storageKey: userRows[0].avatarKey });
    addOwnedAccountKey(keys, currentPublicUrl, { storageKey: userRows[0].bannerKey });
  }

  const userModels = await tx
    .select({ id: models.id })
    .from(models)
    .where(eq(models.userId, userId));
  if (userModels.length > 0) {
    const modelIds = userModels.map((m: { id: number }) => m.id);
    const assets = await tx
      .select({ storageKey: modelAssets.storageKey, storageUrl: modelAssets.storageUrl })
      .from(modelAssets)
      .where(inArray(modelAssets.modelId, modelIds));
    for (const asset of assets) addOwnedAccountKey(keys, currentPublicUrl, {
      storageKey: asset.storageKey,
      url: asset.storageUrl,
    });
  }

  const attempts = await tx.select({ resultUrl: generations.resultUrl })
    .from(generations).where(eq(generations.userId, userId));
  for (const attempt of attempts) addOwnedAccountKey(keys, currentPublicUrl, { url: attempt.resultUrl });

  const attachments = await tx
    .select({ fileKey: changeRequestAttachments.fileKey, url: changeRequestAttachments.url })
    .from(changeRequestAttachments)
    .where(eq(changeRequestAttachments.uploadedById, userId));
  for (const attachment of attachments) addOwnedAccountKey(keys, currentPublicUrl, {
    storageKey: attachment.fileKey,
    url: attachment.url,
  });

  const garments = await tx.select().from(wardrobeGarments).where(eq(wardrobeGarments.userId, userId));
  for (const garment of garments) {
    addOwnedAccountKey(keys, currentPublicUrl, { storageKey: garment.originalImageKey });
    addOwnedAccountKey(keys, currentPublicUrl, { storageKey: garment.isolatedImageKey });
    addOwnedAccountKey(keys, currentPublicUrl, { storageKey: garment.sourceImageKey });
  }
  const outfits = await tx.select().from(wardrobeOutfits).where(eq(wardrobeOutfits.userId, userId));
  for (const outfit of outfits) addOwnedAccountKey(keys, currentPublicUrl, {
    storageKey: outfit.resultThumbKey,
    url: outfit.resultThumbUrl,
  });
  const sessions = await tx.select().from(wardrobeSessions).where(eq(wardrobeSessions.userId, userId));
  for (const session of sessions) {
    // A session's modelImageUrl is a reference input and may be shared. Only
    // generated history is deletion authority when no explicit key exists.
    const history = parseJsonValue(session.history);
    if (Array.isArray(history)) {
      for (const url of history) addOwnedAccountKey(keys, currentPublicUrl, { url });
    }
  }
  const looks = await tx.select().from(wardrobeLooks).where(eq(wardrobeLooks.userId, userId));
  for (const look of looks) addOwnedAccountKey(keys, currentPublicUrl, { url: look.imageUrl });

  const userBoards = await tx.select().from(boards).where(eq(boards.userId, userId));
  for (const board of userBoards) addOwnedAccountKey(keys, currentPublicUrl, { storageKey: board.thumbnailKey });
  if (userBoards.length > 0) {
    const boardIds = userBoards.map((board) => board.id);
    const items = await tx.select().from(boardItems).where(inArray(boardItems.boardId, boardIds));
    for (const item of items) addOwnedAccountKey(keys, currentPublicUrl, { storageKey: item.imageKey });
    // URL-only Canvas references/history can be shared inputs. The dry-run
    // orphan audit counts them, but they are not automatic delete authority.
  }

  return Array.from(keys).sort();
}

/**
 * Delete all user data from the database in the correct order and atomically
 * retain only a durable storage-cleanup manifest for asynchronous processing.
 */
export async function deleteUserAccount(userId: number): Promise<DeletionResult> {
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      cleanupBatchId: null,
      cleanupObjects: 0,
      deletedCounts: {
        changeRequestAttachments: 0, changeRequests: 0, referrals: 0,
        boardEdges: 0, boardItemVersions: 0, boardItems: 0, boards: 0,
        wardrobeLooks: 0, wardrobeSessions: 0, wardrobeOutfits: 0, wardrobeGarments: 0,
        modelPackageSnapshotSlots: 0, modelPackageSnapshots: 0, modelIdentitySnapshots: 0,
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
    boardEdges: 0,
    boardItemVersions: 0,
    boardItems: 0,
    boards: 0,
    wardrobeLooks: 0,
    wardrobeSessions: 0,
    wardrobeOutfits: 0,
    wardrobeGarments: 0,
    modelPackageSnapshotSlots: 0,
    modelPackageSnapshots: 0,
    modelIdentitySnapshots: 0,
    modelAssets: 0,
    models: 0,
    generations: 0,
    creditTransactions: 0,
    credits: 0,
    auditLogsAnonymized: 0,
    user: 0,
  };

  try {
    const operationId = randomUUID();
    let cleanupBatchId: string | null = null;
    let cleanupObjects = 0;

    // All deletion steps run inside a single transaction for atomicity
    await withTransaction(async (tx) => {
      const currentPublicUrl = process.env.R2_PUBLIC_URL ?? "";
      if (!currentPublicUrl) throw new Error("R2_PUBLIC_URL is required for account cleanup");
      const storageKeys = await collectAccountOwnedStorageKeysIn(tx, userId, currentPublicUrl);
      const manifest = await createStorageCleanupManifestIn(tx, {
        userId,
        operationId,
        kind: "account_delete",
        storageKeys,
      });
      cleanupBatchId = manifest.id;
      cleanupObjects = manifest.expectedCount;

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

      // Step 4: Delete the user's complete Canvas tree. Explicit board/item
      // keys entered the manifest only because these source rows disappear in
      // the same transaction.
      const userBoards = await tx
        .select({ id: boards.id })
        .from(boards)
        .where(eq(boards.userId, userId));
      if (userBoards.length > 0) {
        const boardIds = userBoards.map((board) => board.id);
        const userItems = await tx
          .select({ id: boardItems.id })
          .from(boardItems)
          .where(inArray(boardItems.boardId, boardIds));
        const edgeResult = await tx.delete(boardEdges).where(inArray(boardEdges.boardId, boardIds));
        counts.boardEdges = (edgeResult as any)[0]?.affectedRows ?? 0;
        if (userItems.length > 0) {
          const itemIds = userItems.map((item) => item.id);
          const versionResult = await tx
            .delete(boardItemVersions)
            .where(inArray(boardItemVersions.itemId, itemIds));
          counts.boardItemVersions = (versionResult as any)[0]?.affectedRows ?? 0;
        }
        const itemResult = await tx.delete(boardItems).where(inArray(boardItems.boardId, boardIds));
        counts.boardItems = (itemResult as any)[0]?.affectedRows ?? 0;
        const boardResult = await tx.delete(boards).where(inArray(boards.id, boardIds));
        counts.boards = (boardResult as any)[0]?.affectedRows ?? 0;
      }

      // Step 5: Delete every Wardrobe row whose owned output entered the
      // manifest. Looks precede sessions; outfits precede garments.
      const lookResult = await tx.delete(wardrobeLooks).where(eq(wardrobeLooks.userId, userId));
      counts.wardrobeLooks = (lookResult as any)[0]?.affectedRows ?? 0;
      const sessionResult = await tx.delete(wardrobeSessions).where(eq(wardrobeSessions.userId, userId));
      counts.wardrobeSessions = (sessionResult as any)[0]?.affectedRows ?? 0;
      const outfitResult = await tx.delete(wardrobeOutfits).where(eq(wardrobeOutfits.userId, userId));
      counts.wardrobeOutfits = (outfitResult as any)[0]?.affectedRows ?? 0;
      const garmentResult = await tx.delete(wardrobeGarments).where(eq(wardrobeGarments.userId, userId));
      counts.wardrobeGarments = (garmentResult as any)[0]?.affectedRows ?? 0;

      // Step 6: Delete immutable snapshot selections before the assets and
      // model rows they reference. These rows contain identity documents and
      // must not survive account erasure.
      const userModels = await tx
        .select({ id: models.id })
        .from(models)
        .where(eq(models.userId, userId));

      if (userModels.length > 0) {
        const modelIds = userModels.map((m: { id: number }) => m.id);
        const packageRows = await tx
          .select({ id: modelPackageSnapshots.id })
          .from(modelPackageSnapshots)
          .where(inArray(modelPackageSnapshots.modelId, modelIds));
        if (packageRows.length > 0) {
          const slotResult = await tx
            .delete(modelPackageSnapshotSlots)
            .where(inArray(modelPackageSnapshotSlots.packageSnapshotId, packageRows.map((row) => row.id)));
          counts.modelPackageSnapshotSlots = (slotResult as any)[0]?.affectedRows ?? 0;
        }
        const packageResult = await tx
          .delete(modelPackageSnapshots)
          .where(inArray(modelPackageSnapshots.modelId, modelIds));
        counts.modelPackageSnapshots = (packageResult as any)[0]?.affectedRows ?? 0;
        const identityResult = await tx
          .delete(modelIdentitySnapshots)
          .where(inArray(modelIdentitySnapshots.modelId, modelIds));
        counts.modelIdentitySnapshots = (identityResult as any)[0]?.affectedRows ?? 0;

        // Step 7: Delete model assets.
        const assetResult = await tx
          .delete(modelAssets)
          .where(inArray(modelAssets.modelId, modelIds));
        counts.modelAssets = (assetResult as any)[0]?.affectedRows ?? 0;
      }

      // Step 8: Delete models
      const modelResult = await tx
        .delete(models)
        .where(eq(models.userId, userId));
      counts.models = (modelResult as any)[0]?.affectedRows ?? 0;

      // Step 9: Delete generations
      const genResult = await tx
        .delete(generations)
        .where(eq(generations.userId, userId));
      counts.generations = (genResult as any)[0]?.affectedRows ?? 0;

      // Step 10: Delete credit transactions
      const txResult = await tx
        .delete(creditTransactions)
        .where(eq(creditTransactions.userId, userId));
      counts.creditTransactions = (txResult as any)[0]?.affectedRows ?? 0;

      // Step 11: Delete credits
      const credResult = await tx
        .delete(credits)
        .where(eq(credits.userId, userId));
      counts.credits = (credResult as any)[0]?.affectedRows ?? 0;

      // Step 12: Anonymize audit logs (compliance — don't delete)
      const auditResult = await tx
        .update(auditLogs)
        .set({
          userId: null,
          metadata: sql`JSON_SET(COALESCE(metadata, '{}'), '$.deletedUser', true)`,
        })
        .where(eq(auditLogs.userId, userId));
      counts.auditLogsAnonymized = (auditResult as any)[0]?.affectedRows ?? 0;

      // Step 13: Delete user
      const userResult = await tx.delete(users).where(eq(users.id, userId));
      counts.user = (userResult as any)[0]?.affectedRows ?? 0;
    });

    return {
      success: counts.user > 0,
      cleanupBatchId,
      cleanupObjects,
      deletedCounts: counts,
    };
  } catch (error) {
    log.error({ err: error }, "[AccountDeletion] Failed:");
    return {
      success: false,
      cleanupBatchId: null,
      cleanupObjects: 0,
      deletedCounts: counts,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
