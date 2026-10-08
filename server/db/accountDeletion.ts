/**
 * Account Deletion — GDPR-compliant cascading deletion of all user data.
 *
 * Deletion order (respects foreign key dependencies):
 *   0. the whole casting studio — `purgeAccountCastingIn` (#1935)
 *   1. changeRequestAttachments (via changeRequests)
 *   2. changeRequests (submittedById or targetUserId)
 *   3. referrals (referrerUserId)
 *   4. complete board tree (edges, versions, items, boards)
 *   5. Wardrobe looks, sessions, outfits and garments
 *   6. model snapshot slots, packages and identities (via models.userId)
 *   7. modelAssets (via models.userId)
 *   8. models (userId)
 *   9. generations (userId)
 *  9b. generationOperationLocks (via the account's operations), then
 *      generationOperations (userId)
 *  9c. bugReports (userId), faceScanDailyUsage (userId)
 *  10. creditTransactions (userId)
 *  11. credits (userId)
 *  12. auditLogs (userId) — anonymize, don't delete (compliance)
 *  13. users (id)
 *
 * Owned-storage cleanup: persists an exact-key manifest in the same database
 * transaction; the leased R7-5D worker performs storage deletion later.
 *
 * ⚠ **WHICH TABLES THIS FUNCTION IS ANSWERABLE FOR IS NOT THIS LIST — IT IS
 * `ACCOUNT_DELETION_DISPOSITIONS` BELOW, WHICH A GUARD HOLDS AGAINST THE
 * SCHEMA (#1935).** An ordered prose list is the artifact that was wrong for
 * the whole life of this feature: it read as complete while seventeen
 * user-keyed tables, the entire casting studio among them, were untouched. A
 * list a person maintains cannot tell you what it is missing.
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
  castingEvidenceCandidateFeatureTargets,
  castingEvidenceCandidates,
  castingEvidenceIngestions,
  modelEvidenceCrops,
  modelReferencePlates,
  modelIdentitySnapshots,
  modelIdentityFeatureIntents,
  modelIdentityFeatures,
  modelIdentityFeatureVersions,
  modelIdentityFeatureProjectionEvidence,
  modelSnapshotFeatureSelections,
  modelPackageSnapshots,
  modelPackageSnapshotSlots,
  generations,
  generationOperations,
  generationOperationLocks,
  bugReports,
  faceScanDailyUsage,
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
  storageCleanupBatches,
  storageCleanupItems,
} from "../../drizzle/schema";
import { getDb, withTransaction } from "./connection";
import type { TransactionHandle } from "./connection";
import { createStorageCleanupManifestIn } from "./storageCleanup";
import { purgeAccountCastingIn } from "../castingV2/accountCastingPurge";
import { classifyStorageReference, parseJsonValue } from "../casting/deletionAudit";
import type { StorageCleanupManifestItem } from "../casting/storageCleanupContract";
import { createModuleLogger } from "../logging/logger";
import { assertOwnedEvidenceStorageKey } from "../casting/evidence/evidenceLifecycle";
import { parseEvidenceStorageKey } from "../casting/evidence/evidenceDelivery";
import { DIAGNOSTIC_KEY_PREFIX } from "../castingV2/diagnosticCapture";
import { REFUSAL_LOOP_KEY_PREFIX } from "../castingV2/refusalLoopCapture";
const log = createModuleLogger("db/accountDeletion");

/**
 * WHAT ACCOUNT ERASURE DOES WITH EVERY TABLE THAT CARRIES A `userId` — the
 * declaration `server/accountDeletionCoverage.test.ts` holds against
 * `drizzle/schema.ts` in both directions (#1935, working law 7).
 *
 * ⚠ **THIS EXISTS BECAUSE THE GAP WAS SILENT FOR THE WHOLE LIFE OF THE
 * FEATURE.** Seventeen user-keyed tables were missed — every casting table
 * among them — and nothing could notice: there is no `ON DELETE CASCADE` in
 * this schema to catch an omission, no foreign key to refuse one, and the
 * deletion's own tests assert the counts it reports rather than the rows it
 * leaves. A table added tomorrow would have joined them in exactly the same
 * silence. **The guard is the fix; this map is only the thing it reads.**
 *
 * `deleted` and `anonymised` mean what they say. `exempt` is a decision, so
 * every one of them carries its reason here and the guard refuses a reason
 * that is empty.
 *
 * ⚠ **KEYED ON THE DRIZZLE SYMBOL, NOT THE SQL TABLE NAME, and the guard's own
 * first run is why.** Two of these tables do not have the name their symbol
 * has: `credits` is the SQL table **`points`** and `creditTransactions` is
 * **`point_transactions`** — the pre-rename names, still in the database. A map
 * keyed on SQL names would read as a list of tables nobody writing this file
 * has ever typed, and the two that mattered most are the money ones.
 */
export const ACCOUNT_DELETION_DISPOSITIONS = {
  /* ---- the account itself and its money ---- */
  /* `users` itself has no `userId` column and is therefore not in this map —
     it IS the account, and it is deleted last. */
  credits: "deleted",
  creditTransactions: "deleted",

  /* ---- the legacy studio ---- */
  models: "deleted",
  generations: "deleted",
  generationOperations: "deleted",
  castingEvidenceIngestions: "deleted",
  castingEvidenceCandidates: "deleted",
  castingEvidenceCandidateFeatureTargets: "deleted",
  modelReferencePlates: "deleted",
  modelEvidenceCrops: "deleted",
  modelIdentityFeatureIntents: "deleted",
  modelIdentityFeatureProjectionEvidence: "deleted",

  /* ---- boards and wardrobe ---- */
  boards: "deleted",
  wardrobeGarments: "deleted",
  wardrobeOutfits: "deleted",
  wardrobeSessions: "deleted",
  wardrobeLooks: "deleted",

  /* ---- the casting studio (`purgeAccountCastingIn`) ---- */
  castingSessions: "deleted",
  castingRolls: "deleted",
  castingCandidates: "deleted",
  castingCandidateVariants: "deleted",
  castingSegments: "deleted",
  castingReferenceLibrary: "deleted",
  castingFaceScans: "deleted",
  castingInkDesigns: "deleted",
  castingInkPlates: "deleted",
  castingReferenceCrops: "deleted",
  castingReferenceAttachments: "deleted",
  castingInkDeliveryCrops: "deleted",

  /* ---- her own words, at her own request ---- */
  /*
    #255 ruled that a staff queue gets no delete button, because *"removing a
    person's words is a founder decision, not a queue button"*. This is the
    other party asking: a customer erasing her own account is the person whose
    words they are, and nothing in the product reads a bug report for money or
    for a legal obligation. So they go with her.
  */
  bugReports: "deleted",

  /* ---- a quiet limit with nothing to remember ---- */
  /*
    One row per account per UTC day, counting house-money face scans. It is
    keyed on the account id, so a new account starts at zero whether these
    rows survive or not — deleting them loses no control at all.
  */
  faceScanDailyUsage: "deleted",

  /* ---- anonymised ---- */
  /*
    Compliance keeps the trail and drops the person: `userId` goes null and the
    row records that its user was deleted. Pre-dates #1935 and is unchanged.
  */
  auditLogs: "anonymised",

  /* ---- exempt, each for its own stated reason ---- */
  /*
    ⚠ THE SCHEMA ITSELF ALREADY RULED ON THIS ONE, and the sentence is on the
    column: *"Not a foreign key, for the same reason the audit log is not: a
    deleted account must not take the record with it."* It is the free-grant
    fraud guard — grants per device, grants per network, inside a window — so
    deleting it on request turns delete-and-register into a credit farm. The
    row holds a device key and an IP and no content of hers.
  */
  freeGrantClaims: "exempt: the free-grant fraud guard, which delete-and-re-register would defeat — the schema's own column comment rules it",
  /*
    A money record mirroring a settled Stripe invoice, one per plan change,
    whose own status comment says *"Never deleted"*. Credits owed or handed
    back beside real money moving; the accounting outlives the account.
  */
  planChangeSettlements: "exempt: the Stripe-invoice settlement ledger — a money record that outlives the account, and its own column comment says never deleted",
  /*
    The manifest this very deletion writes. Deleting the account's batches
    would delete the instruction to go and remove its objects.
  */
  storageCleanupBatches: "exempt: the deletion's own storage-cleanup manifest — the instruction that removes its objects",
} as const satisfies Record<string, `deleted` | `anonymised` | `exempt: ${string}`>;

/**
 * Every count this function reports, at zero — ONE list.
 *
 * ⚠ **IT WAS WRITTEN OUT THREE TIMES BEFORE #1935**: once as the type, once in
 * the no-database early return and once as the live accumulator. Three copies
 * of a 31-name list is working law 4, and the failure mode is quiet — a field
 * missed in the early return is a `deletedCounts` object with a hole in it on
 * the one path nobody drives. The type is DERIVED from this function's return
 * now, so a count has exactly one place to be added.
 */
function zeroDeletionCounts() {
  return {
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
    evidenceCandidateFeatureTargets: 0,
    featureIntents: 0,
    identityFeatures: 0,
    identityFeatureVersions: 0,
    identityFeatureProjectionEvidence: 0,
    snapshotFeatureSelections: 0,
    referencePlates: 0,
    evidenceCrops: 0,
    modelPackageSnapshotSlots: 0,
    modelPackageSnapshots: 0,
    modelIdentitySnapshots: 0,
    modelAssets: 0,
    models: 0,
    generations: 0,
    generationOperations: 0,
    generationOperationLocks: 0,
    bugReports: 0,
    faceScanDailyUsage: 0,
    creditTransactions: 0,
    credits: 0,
    auditLogsAnonymized: 0,
    user: 0,
    /* The casting studio's twelve, keyed by table (#1935). */
    castingSessions: 0,
    castingRolls: 0,
    castingCandidates: 0,
    castingCandidateVariants: 0,
    castingSegments: 0,
    castingReferenceLibrary: 0,
    castingFaceScans: 0,
    castingInkDesigns: 0,
    castingInkPlates: 0,
    castingReferenceCrops: 0,
    castingReferenceAttachments: 0,
    castingInkDeliveryCrops: 0,
  };
}

export interface DeletionResult {
  success: boolean;
  cleanupBatchId: string | null;
  cleanupObjects: number;
  deletedCounts: ReturnType<typeof zeroDeletionCounts>;
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

/**
 * The private-bucket prefixes that hold a customer's words or frames kept for
 * diagnosis and are known ONLY to the cleanup manifest — no product row points
 * at them, so the collector below cannot find them the way it finds a model's
 * assets. Each key carries its owner as the segment after the prefix.
 */
export const DIAGNOSTIC_OWNED_PREFIXES = [REFUSAL_LOOP_KEY_PREFIX, DIAGNOSTIC_KEY_PREFIX] as const;

/** Is this manifest key one of this account's kept diagnostics? */
export function isAccountDiagnosticKey(userId: number, storageKey: string): boolean {
  return DIAGNOSTIC_OWNED_PREFIXES.some((prefix) => storageKey.startsWith(`${prefix}/${userId}/`));
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

  /*
    AND THE WORDS AND FRAMES KEPT FOR DIAGNOSIS (#129).

    The refusal loop keeps a refused roll's sent prompts for 30 days under a
    manifest born HELD for the whole window, and the refused-frame capture
    reserves its frames the same way. No product row names those keys — the
    manifest item is the only record — so they are found there, by owner and
    by prefix, and queued with the account's own manifest to go now rather
    than on their clock. The held batch later meets an absent key, which every
    cleanup path already tolerates.

    Only items not yet settled: a deleted object needs no second instruction.
  */
  const keptForDiagnosis = await tx
    .select({ storageKey: storageCleanupItems.storageKey })
    .from(storageCleanupItems)
    .innerJoin(storageCleanupBatches, eq(storageCleanupBatches.id, storageCleanupItems.batchId))
    .where(and(
      eq(storageCleanupBatches.userId, userId),
      eq(storageCleanupBatches.kind, "casting_diagnostic_cleanup"),
      eq(storageCleanupItems.storageBackend, "private_evidence_r2"),
      inArray(storageCleanupItems.status, ["pending", "processing", "failed"]),
    ));
  for (const item of keptForDiagnosis) {
    if (isAccountDiagnosticKey(userId, item.storageKey)) privateEvidenceKeys.add(item.storageKey);
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
  ].sort(byBackendThenKey);
}

/** One manifest order, so two contributors cannot each have their own. */
function byBackendThenKey(
  left: StorageCleanupManifestItem,
  right: StorageCleanupManifestItem,
): number {
  return left.storageBackend.localeCompare(right.storageBackend)
    || left.storageKey.localeCompare(right.storageKey);
}

/**
 * The account's manifest, from its two contributors.
 *
 * ⚠ **DEDUPED, AND THE DUPLICATE IS NOT HYPOTHETICAL.** A casting render files
 * a `generations` row whose `resultUrl` is the very object the candidate row
 * names in `imageKey`, so the same key arrives from both readers. The manifest
 * carries an `expectedCount` the cleanup worker reconciles against, and two
 * items for one object would make a correct run look like a half-done one
 * forever.
 */
function accountManifest(
  ...contributions: readonly StorageCleanupManifestItem[][]
): StorageCleanupManifestItem[] {
  const seen = new Map<string, StorageCleanupManifestItem>();
  for (const contribution of contributions) {
    for (const item of contribution) {
      seen.set(`${item.storageBackend}\u0000${item.storageKey}`, item);
    }
  }
  return Array.from(seen.values()).sort(byBackendThenKey);
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
      deletedCounts: zeroDeletionCounts(),
      error: "Database not available",
    };
  }

  const counts: DeletionResult["deletedCounts"] = zeroDeletionCounts();

  try {
    const operationId = randomUUID();
    let cleanupBatchId: string | null = null;
    let cleanupObjects = 0;

    // All deletion steps run inside a single transaction for atomicity
    await withTransaction(async (tx) => {
      const currentPublicUrl = process.env.R2_PUBLIC_URL ?? "";
      if (!currentPublicUrl) throw new Error("R2_PUBLIC_URL is required for account cleanup");
      const storageItems = await collectAccountOwnedStorageItemsIn(tx, userId, currentPublicUrl);

      /*
        STEP 0: THE CASTING STUDIO (#1935).

        It collects AND deletes in one pass, which is the retention
        authority's own shape and is why it is here rather than inside
        `collectAccountOwnedStorageItemsIn`: the nine child stores it reaches
        are reached through the owned candidate, so the rows have to go in the
        same walk that found their keys. Running before the manifest exists
        costs nothing — every statement in this function is one transaction,
        so the keys and the row deletions commit together or not at all, which
        is the same reason the board and item keys below enter a manifest
        written before their rows disappear.
      */
      const castingPurge = await purgeAccountCastingIn(tx, userId);
      Object.assign(counts, castingPurge.counts);

      const manifest = await createStorageCleanupManifestIn(tx, {
        userId,
        operationId,
        kind: "account_delete",
        storageItems: accountManifest(storageItems, castingPurge.storageItems),
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
        const projectionResult = await tx
          .delete(modelIdentityFeatureProjectionEvidence)
          .where(inArray(
            modelIdentityFeatureProjectionEvidence.modelId,
            modelIds,
          ));
        counts.identityFeatureProjectionEvidence =
          (projectionResult as any)[0]?.affectedRows ?? 0;
        const versionResult = await tx.delete(modelIdentityFeatureVersions)
          .where(inArray(modelIdentityFeatureVersions.modelId, modelIds));
        counts.identityFeatureVersions = (versionResult as any)[0]?.affectedRows ?? 0;
        const featureResult = await tx.delete(modelIdentityFeatures)
          .where(inArray(modelIdentityFeatures.modelId, modelIds));
        counts.identityFeatures = (featureResult as any)[0]?.affectedRows ?? 0;
      }
      if (candidateIds.length > 0) {
        const targetResult = await tx
          .delete(castingEvidenceCandidateFeatureTargets)
          .where(inArray(
            castingEvidenceCandidateFeatureTargets.candidateId,
            candidateIds,
          ));
        counts.evidenceCandidateFeatureTargets =
          (targetResult as any)[0]?.affectedRows ?? 0;
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

      /*
        Step 9b: the operation receipts, and their leases BEFORE them (#1935).

        A lock row carries no `userId` — its only path back to an account runs
        through the operation it fences — so deleting the operations first
        would strand every lease with nothing able to find it, and a stranded
        lease's `lockKey` is a key a LATER account could be refused on.

        These rows carry `chargedCredits`, `refundedCredits` and a saved
        `result`, so they are the subject content and the money story of an
        account that has asked to be gone. Deleting them is the same decision
        this function already makes two statements below about the credit
        ledger itself, which is the money record a receipt only mirrors.
      */
      const userOperations = await tx
        .select({ id: generationOperations.id })
        .from(generationOperations)
        .where(eq(generationOperations.userId, userId));
      if (userOperations.length > 0) {
        const lockResult = await tx
          .delete(generationOperationLocks)
          .where(inArray(
            generationOperationLocks.operationId,
            userOperations.map((row) => row.id),
          ));
        counts.generationOperationLocks = (lockResult as any)[0]?.affectedRows ?? 0;
      }
      const opResult = await tx
        .delete(generationOperations)
        .where(eq(generationOperations.userId, userId));
      counts.generationOperations = (opResult as any)[0]?.affectedRows ?? 0;

      /*
        Step 9c: her own words, and a day's face-scan tally (#1935).

        `ACCOUNT_DELETION_DISPOSITIONS` carries why each one goes rather than
        staying or being anonymised; the reasons are decisions and they are
        written down where the guard reads them.
      */
      const bugResult = await tx.delete(bugReports).where(eq(bugReports.userId, userId));
      counts.bugReports = (bugResult as any)[0]?.affectedRows ?? 0;
      const scanUsageResult = await tx
        .delete(faceScanDailyUsage)
        .where(eq(faceScanDailyUsage.userId, userId));
      counts.faceScanDailyUsage = (scanUsageResult as any)[0]?.affectedRows ?? 0;

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
