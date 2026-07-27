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
import { and, eq, or, inArray, sql } from "drizzle-orm";
import {
  users,
  credits,
  creditTransactions,
  models,
  modelAssets,
  castingEvidenceCandidateAttempts,
  castingEvidenceCandidates,
  castingEvidenceIngestions,
  modelEvidenceCrops,
  modelReferencePlates,
  modelIdentitySnapshots,
  modelIdentityFeatureIntents,
  modelIdentityFeatures,
  modelIdentityFeatureVersions,
  modelSnapshotFeatureSelections,
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
import type { StorageCleanupManifestItem } from "../casting/storageCleanupContract";
import { createModuleLogger } from "../logging/logger";
import { assertOwnedEvidenceStorageKey } from "../casting/evidence/evidenceLifecycle";
import { parseEvidenceStorageKey } from "../casting/evidence/evidenceDelivery";
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
    evidenceIngestions: number;
    evidenceCandidates: number;
    evidenceCandidateAttempts: number;
    featureIntents: number;
    identityFeatures: number;
    identityFeatureVersions: number;
    snapshotFeatureSelections: number;
    referencePlates: number;
    evidenceCrops: number;
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
export async function collectAccountOwnedStorageItemsIn(
  tx: TransactionHandle,
  userId: number,
  currentPublicUrl: string,
): Promise<StorageCleanupManifestItem[]> {
  const publicKeys = new Set<string>();
  const privateEvidenceKeys = new Set<string>();
  const userRows = await tx
    .select({
      avatarKey: users.avatarKey,
      bannerKey: users.bannerKey,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (userRows[0]) {
    addOwnedAccountKey(publicKeys, currentPublicUrl, { storageKey: userRows[0].avatarKey });
    addOwnedAccountKey(publicKeys, currentPublicUrl, { storageKey: userRows[0].bannerKey });
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
    for (const asset of assets) addOwnedAccountKey(publicKeys, currentPublicUrl, {
      storageKey: asset.storageKey,
      url: asset.storageUrl,
    });
  }
  const modelIds = userModels.map((model) => model.id);
  const evidenceIngestions = await tx
    .select()
    .from(castingEvidenceIngestions)
    .where(modelIds.length > 0
      ? or(
        eq(castingEvidenceIngestions.userId, userId),
        inArray(castingEvidenceIngestions.modelId, modelIds),
      )
      : eq(castingEvidenceIngestions.userId, userId));
  const candidateAttempts = await tx
    .select({
      attempt: castingEvidenceCandidateAttempts,
      ownerId: castingEvidenceCandidates.userId,
      modelId: castingEvidenceCandidates.modelId,
    })
    .from(castingEvidenceCandidateAttempts)
    .innerJoin(
      castingEvidenceCandidates,
      eq(castingEvidenceCandidates.id, castingEvidenceCandidateAttempts.candidateId),
    )
    .where(modelIds.length > 0
      ? or(
        eq(castingEvidenceCandidates.userId, userId),
        inArray(castingEvidenceCandidates.modelId, modelIds),
      )
      : eq(castingEvidenceCandidates.userId, userId));
  const referencePlates = await tx
    .select()
    .from(modelReferencePlates)
    .where(modelIds.length > 0
      ? or(
        eq(modelReferencePlates.userId, userId),
        inArray(modelReferencePlates.modelId, modelIds),
      )
      : eq(modelReferencePlates.userId, userId));
  const evidenceCrops = await tx
    .select()
    .from(modelEvidenceCrops)
    .where(modelIds.length > 0
      ? or(
        eq(modelEvidenceCrops.userId, userId),
        inArray(modelEvidenceCrops.modelId, modelIds),
      )
      : eq(modelEvidenceCrops.userId, userId));
  for (const receipt of evidenceIngestions) {
    if (receipt.userId !== userId) {
      throw new Error("Evidence receipt ownership disagrees with the deleting account");
    }
    assertOwnedEvidenceStorageKey({
      storageKey: receipt.storageKey,
      userId: receipt.userId,
      modelId: receipt.modelId,
      purpose: receipt.purpose,
    });
    privateEvidenceKeys.add(receipt.storageKey);
  }
  for (const row of candidateAttempts) {
    if (row.ownerId !== userId) {
      throw new Error("Evidence candidate ownership disagrees with the deleting account");
    }
    if (row.attempt.privateStorageKey) {
      const parsed = parseEvidenceStorageKey(row.attempt.privateStorageKey);
      if (
        parsed.userId !== userId
        || parsed.modelId !== row.modelId
        || parsed.kind !== "candidate"
        || parsed.entityId !== row.attempt.privatePlateId
      ) {
        throw new Error("Evidence candidate key ownership is invalid");
      }
      privateEvidenceKeys.add(row.attempt.privateStorageKey);
    }
    if (row.attempt.promotedPublicStorageKey) {
      publicKeys.add(row.attempt.promotedPublicStorageKey);
    }
  }
  for (const plate of referencePlates) {
    if (plate.userId !== userId) {
      throw new Error("Reference plate ownership disagrees with the deleting account");
    }
    assertOwnedEvidenceStorageKey({
      storageKey: plate.storageKey,
      userId: plate.userId,
      modelId: plate.modelId,
      purpose: plate.kind,
    });
    privateEvidenceKeys.add(plate.storageKey);
  }
  for (const crop of evidenceCrops) {
    if (crop.userId !== userId) {
      throw new Error("Evidence crop ownership disagrees with the deleting account");
    }
    assertOwnedEvidenceStorageKey({
      storageKey: crop.storageKey,
      userId: crop.userId,
      modelId: crop.modelId,
      purpose: "evidence_crop",
    });
    privateEvidenceKeys.add(crop.storageKey);
  }

  const attempts = await tx.select({ resultUrl: generations.resultUrl })
    .from(generations).where(eq(generations.userId, userId));
  for (const attempt of attempts) addOwnedAccountKey(publicKeys, currentPublicUrl, { url: attempt.resultUrl });

  const attachments = await tx
    .select({ fileKey: changeRequestAttachments.fileKey, url: changeRequestAttachments.url })
    .from(changeRequestAttachments)
    .where(eq(changeRequestAttachments.uploadedById, userId));
  for (const attachment of attachments) addOwnedAccountKey(publicKeys, currentPublicUrl, {
    storageKey: attachment.fileKey,
    url: attachment.url,
  });

  const garments = await tx.select().from(wardrobeGarments).where(eq(wardrobeGarments.userId, userId));
  for (const garment of garments) {
    addOwnedAccountKey(publicKeys, currentPublicUrl, { storageKey: garment.originalImageKey });
    addOwnedAccountKey(publicKeys, currentPublicUrl, { storageKey: garment.isolatedImageKey });
    addOwnedAccountKey(publicKeys, currentPublicUrl, { storageKey: garment.sourceImageKey });
  }
  const outfits = await tx.select().from(wardrobeOutfits).where(eq(wardrobeOutfits.userId, userId));
  for (const outfit of outfits) addOwnedAccountKey(publicKeys, currentPublicUrl, {
    storageKey: outfit.resultThumbKey,
    url: outfit.resultThumbUrl,
  });
  const sessions = await tx.select().from(wardrobeSessions).where(eq(wardrobeSessions.userId, userId));
  for (const session of sessions) {
    // A session's modelImageUrl is a reference input and may be shared. Only
    // generated history is deletion authority when no explicit key exists.
    const history = parseJsonValue(session.history);
    if (Array.isArray(history)) {
      for (const url of history) addOwnedAccountKey(publicKeys, currentPublicUrl, { url });
    }
  }
  const looks = await tx.select().from(wardrobeLooks).where(eq(wardrobeLooks.userId, userId));
  for (const look of looks) addOwnedAccountKey(publicKeys, currentPublicUrl, { url: look.imageUrl });

  const userBoards = await tx.select().from(boards).where(eq(boards.userId, userId));
  for (const board of userBoards) addOwnedAccountKey(publicKeys, currentPublicUrl, { storageKey: board.thumbnailKey });
  if (userBoards.length > 0) {
    const boardIds = userBoards.map((board) => board.id);
    const items = await tx.select().from(boardItems).where(inArray(boardItems.boardId, boardIds));
    for (const item of items) addOwnedAccountKey(publicKeys, currentPublicUrl, { storageKey: item.imageKey });
    // URL-only Canvas references/history can be shared inputs. The dry-run
    // orphan audit counts them, but they are not automatic delete authority.
  }

  return [
    ...Array.from(privateEvidenceKeys, (storageKey) => ({
      storageKey,
      storageBackend: "private_evidence_r2" as const,
    })),
    ...Array.from(publicKeys, (storageKey) => ({
      storageKey,
      storageBackend: "public_r2" as const,
    })),
  ].sort((left, right) =>
    left.storageBackend.localeCompare(right.storageBackend)
    || left.storageKey.localeCompare(right.storageKey)
  );
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
        evidenceIngestions: 0, evidenceCandidates: 0, evidenceCandidateAttempts: 0,
        featureIntents: 0, identityFeatures: 0, identityFeatureVersions: 0,
        snapshotFeatureSelections: 0, referencePlates: 0, evidenceCrops: 0,
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
    evidenceIngestions: 0,
    evidenceCandidates: 0,
    evidenceCandidateAttempts: 0,
    featureIntents: 0,
    identityFeatures: 0,
    identityFeatureVersions: 0,
    snapshotFeatureSelections: 0,
    referencePlates: 0,
    evidenceCrops: 0,
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
      const storageItems = await collectAccountOwnedStorageItemsIn(tx, userId, currentPublicUrl);
      const manifest = await createStorageCleanupManifestIn(tx, {
        userId,
        operationId,
        kind: "account_delete",
        storageItems,
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
      const modelIds = userModels.map((model) => model.id);

      const candidateRows = await tx
        .select({ id: castingEvidenceCandidates.id })
        .from(castingEvidenceCandidates)
        .where(eq(castingEvidenceCandidates.userId, userId));
      const candidateIds = candidateRows.map((candidate) => candidate.id);
      if (modelIds.length > 0) {
        const selectionResult = await tx.delete(modelSnapshotFeatureSelections)
          .where(inArray(modelSnapshotFeatureSelections.modelId, modelIds));
        counts.snapshotFeatureSelections = (selectionResult as any)[0]?.affectedRows ?? 0;
        const versionResult = await tx.delete(modelIdentityFeatureVersions)
          .where(inArray(modelIdentityFeatureVersions.modelId, modelIds));
        counts.identityFeatureVersions = (versionResult as any)[0]?.affectedRows ?? 0;
        const featureResult = await tx.delete(modelIdentityFeatures)
          .where(inArray(modelIdentityFeatures.modelId, modelIds));
        counts.identityFeatures = (featureResult as any)[0]?.affectedRows ?? 0;
      }
      if (candidateIds.length > 0) {
        const attemptResult = await tx.delete(castingEvidenceCandidateAttempts)
          .where(inArray(castingEvidenceCandidateAttempts.candidateId, candidateIds));
        counts.evidenceCandidateAttempts = (attemptResult as any)[0]?.affectedRows ?? 0;
      }
      const candidateResult = await tx.delete(castingEvidenceCandidates)
        .where(eq(castingEvidenceCandidates.userId, userId));
      counts.evidenceCandidates = (candidateResult as any)[0]?.affectedRows ?? 0;
      const intentResult = await tx.delete(modelIdentityFeatureIntents)
        .where(eq(modelIdentityFeatureIntents.userId, userId));
      counts.featureIntents = (intentResult as any)[0]?.affectedRows ?? 0;

      const cropResult = await tx
        .delete(modelEvidenceCrops)
        .where(eq(modelEvidenceCrops.userId, userId));
      counts.evidenceCrops = (cropResult as any)[0]?.affectedRows ?? 0;
      const plateResult = await tx
        .delete(modelReferencePlates)
        .where(eq(modelReferencePlates.userId, userId));
      counts.referencePlates = (plateResult as any)[0]?.affectedRows ?? 0;
      const ingestionResult = await tx
        .delete(castingEvidenceIngestions)
        .where(eq(castingEvidenceIngestions.userId, userId));
      counts.evidenceIngestions = (ingestionResult as any)[0]?.affectedRows ?? 0;

      if (userModels.length > 0) {
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
