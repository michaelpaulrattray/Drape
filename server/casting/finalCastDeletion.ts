import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import {
  AUDIT_ACTIONS,
  auditLogs,
  boardEdges,
  boardItems,
  boardItemVersions,
  boards,
  bugReports,
  generationOperationLocks,
  generationOperations,
  generations,
  modelAssets,
  models,
  wardrobeLooks,
  wardrobeSessions,
  type BoardItem,
} from "../../drizzle/schema";
import { withTransaction, type TransactionHandle } from "../db/connection";
import { createStorageCleanupManifestIn } from "../db/storageCleanup";
import {
  classifyStorageReference,
  parseJsonValue,
  readCastProvenance,
} from "./deletionAudit";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("casting/finalCastDeletion");

export interface FinalCastDeletionCounts {
  assets: number;
  canvasItems: number;
  canvasVersions: number;
  affectedBoards: number;
  wardrobeSessions: number;
  wardrobeLooks: number;
  generationAttempts: number;
  priorOperations: number;
  bugReportsScrubbed: number;
  cleanupObjects: number;
}

export interface FinalCastDeletionResult {
  deleted: true;
  counts: FinalCastDeletionCounts;
}

export type FinalCastDeletionFailurePoint =
  | "after_manifest"
  | "after_canvas"
  | "after_dependencies"
  | "before_tombstone"
  | "before_receipt";

function affectedRows(result: unknown): number {
  const header = result as { affectedRows?: number } | [{ affectedRows?: number }];
  return Array.isArray(header) ? header[0]?.affectedRows ?? 0 : header.affectedRows ?? 0;
}

function failAt(actual: FinalCastDeletionFailurePoint, requested?: FinalCastDeletionFailurePoint): void {
  if (actual === requested) throw new Error(`Injected Cast deletion failure: ${actual}`);
}

function hasRawModelIdCandidate(value: unknown, modelId: number): boolean {
  const parsed = parseJsonValue(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const record = parsed as Record<string, unknown>;
  const provenance = record.provenance;
  const nested = provenance && typeof provenance === "object" && !Array.isArray(provenance)
    ? (provenance as Record<string, unknown>).modelId
    : undefined;
  return Number(record.modelId) === modelId || Number(nested) === modelId;
}

function scrubMetadataValue(value: unknown, deletedUrls: ReadonlySet<string>, modelId: number): unknown {
  const parsed = parseJsonValue(value);
  if (typeof parsed === "string") return deletedUrls.has(parsed) ? undefined : parsed;
  if (Array.isArray(parsed)) {
    return parsed
      .map((entry) => scrubMetadataValue(entry, deletedUrls, modelId))
      .filter((entry) => entry !== undefined);
  }
  if (!parsed || typeof parsed !== "object") return parsed;
  if (readCastProvenance(parsed)?.modelId === modelId) return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(parsed as Record<string, unknown>)) {
    if (key === "modelId" && child === modelId) continue;
    const scrubbed = scrubMetadataValue(child, deletedUrls, modelId);
    if (scrubbed !== undefined) result[key] = scrubbed;
  }
  return result;
}

function collectManifestKey(
  keys: Set<string>,
  currentPublicUrl: string,
  reference: { storageKey?: unknown; url?: unknown },
): void {
  const classified = classifyStorageReference({ ...reference, currentPublicUrl });
  if (classified.kind === "explicit_key" || classified.kind === "current_origin_url") {
    keys.add(classified.key);
  } else if (classified.kind === "invalid" && reference.storageKey != null) {
    throw new Error("A model-owned storage key is invalid; deletion refused before losing cleanup authority");
  }
}

function collectKnownOutputHistory(keys: Set<string>, currentPublicUrl: string, value: unknown): void {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) return;
  for (const entry of parsed) {
    if (typeof entry === "string") collectManifestKey(keys, currentPublicUrl, { url: entry });
  }
}

async function lockModelIn(tx: TransactionHandle, input: { modelId: number; userId: number }) {
  const [model] = await tx
    .select()
    .from(models)
    .where(and(
      eq(models.id, input.modelId),
      eq(models.userId, input.userId),
      isNull(models.deletedAt),
      ne(models.status, "archived"),
    ))
    .limit(1)
    .for("update");
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  return model;
}

async function recomputeBoardThumbnailIn(tx: TransactionHandle, boardId: number): Promise<void> {
  const [newest] = await tx
    .select({ imageUrl: boardItems.imageUrl, imageKey: boardItems.imageKey })
    .from(boardItems)
    .where(and(eq(boardItems.boardId, boardId), isNull(boardItems.deletedAt), sql`${boardItems.imageUrl} IS NOT NULL`))
    .orderBy(desc(boardItems.id))
    .limit(1);
  await tx
    .update(boards)
    .set({ thumbnailUrl: newest?.imageUrl ?? null, thumbnailKey: newest?.imageKey ?? null })
    .where(eq(boards.id, boardId));
}

async function collectCanvasCleanupKeysIn(input: {
  tx: TransactionHandle;
  modelId: number;
  assetUrls: string[];
  storageKeys: Set<string>;
  currentPublicUrl: string;
}): Promise<void> {
  const { tx, modelId, assetUrls, storageKeys, currentPublicUrl } = input;
  const linked = await tx
    .select({
      id: boardItems.id,
      sourceModelId: boardItems.sourceModelId,
      imageUrl: boardItems.imageUrl,
      imageKey: boardItems.imageKey,
      metadata: boardItems.metadata,
    })
    .from(boardItems)
    .where(or(
      eq(boardItems.sourceModelId, modelId),
      sql`CAST(JSON_UNQUOTE(JSON_EXTRACT(${boardItems.metadata}, '$.provenance.modelId')) AS UNSIGNED) = ${modelId}`,
      sql`CAST(JSON_UNQUOTE(JSON_EXTRACT(${boardItems.metadata}, '$.modelId')) AS UNSIGNED) = ${modelId}`,
      ...(assetUrls.length ? [inArray(boardItems.imageUrl, assetUrls)] : []),
    ));
  const linkedIds: number[] = [];
  for (const item of linked) {
    const provenance = readCastProvenance(item.metadata);
    const isCast = item.sourceModelId === modelId || provenance?.modelId === modelId;
    if (!isCast && item.imageUrl && assetUrls.includes(item.imageUrl)) continue;
    linkedIds.push(item.id);
    collectManifestKey(storageKeys, currentPublicUrl, { storageKey: item.imageKey, url: item.imageUrl });
  }
  if (linkedIds.length) {
    const versions = await tx
      .select({ imageUrl: boardItemVersions.imageUrl })
      .from(boardItemVersions)
      .where(inArray(boardItemVersions.itemId, linkedIds));
    for (const version of versions) collectManifestKey(storageKeys, currentPublicUrl, { url: version.imageUrl });
  }
}

async function deleteCanvasDependenciesIn(input: {
  tx: TransactionHandle;
  modelId: number;
  userId: number;
  assetUrls: string[];
  storageKeys: Set<string>;
  currentPublicUrl: string;
  wardrobeSessionIds: number[];
  wardrobeLookIds: number[];
}): Promise<{ items: number; versions: number; boards: number }> {
  const {
    tx, modelId, userId, assetUrls, storageKeys, currentPublicUrl,
    wardrobeSessionIds, wardrobeLookIds,
  } = input;
  const urlSet = new Set(assetUrls);
  const matchingVersions = assetUrls.length
    ? await tx
      .select({
        id: boardItemVersions.id,
        itemId: boardItemVersions.itemId,
        imageUrl: boardItemVersions.imageUrl,
        boardId: boardItems.boardId,
        boardUserId: boards.userId,
      })
      .from(boardItemVersions)
      .innerJoin(boardItems, eq(boardItemVersions.itemId, boardItems.id))
      .innerJoin(boards, eq(boardItems.boardId, boards.id))
      .where(inArray(boardItemVersions.imageUrl, assetUrls))
      .for("update")
    : [];
  if (matchingVersions.some((row) => row.boardUserId !== userId)) {
    log.fatal({ modelId }, "Cross-owner Canvas version references a Cast being deleted");
    throw new Error("Cross-owner Canvas dependency detected");
  }

  const versionItemIds = matchingVersions.map((row) => row.itemId);
  const candidateCondition = or(
    eq(boardItems.sourceModelId, modelId),
    sql`CAST(JSON_UNQUOTE(JSON_EXTRACT(${boardItems.metadata}, '$.provenance.modelId')) AS UNSIGNED) = ${modelId}`,
    sql`CAST(JSON_UNQUOTE(JSON_EXTRACT(${boardItems.metadata}, '$.modelId')) AS UNSIGNED) = ${modelId}`,
    ...(assetUrls.length ? [inArray(boardItems.imageUrl, assetUrls)] : []),
    ...(versionItemIds.length ? [inArray(boardItems.id, versionItemIds)] : []),
  );
  const candidates = await tx
    .select({ item: boardItems, boardUserId: boards.userId })
    .from(boardItems)
    .innerJoin(boards, eq(boardItems.boardId, boards.id))
    .where(candidateCondition)
    .for("update");
  if (candidates.some((row) => row.boardUserId !== userId)) {
    log.fatal({ modelId }, "Cross-owner Canvas item references a Cast being deleted");
    throw new Error("Cross-owner Canvas dependency detected");
  }

  const versionsByItem = new Map<number, typeof matchingVersions>();
  for (const version of matchingVersions) {
    const list = versionsByItem.get(version.itemId) ?? [];
    list.push(version);
    versionsByItem.set(version.itemId, list);
  }
  const deleteItemIds: number[] = [];
  const affectedBoards = new Set<number>();
  let removedVersions = 0;

  if (assetUrls.length) {
    const thumbnailBoards = await tx
      .select({ id: boards.id, userId: boards.userId })
      .from(boards)
      .where(inArray(boards.thumbnailUrl, assetUrls))
      .for("update");
    if (thumbnailBoards.some((board) => board.userId !== userId)) {
      log.fatal({ modelId }, "Cross-owner board thumbnail references a Cast being deleted");
      throw new Error("Cross-owner Canvas dependency detected");
    }
    for (const board of thumbnailBoards) affectedBoards.add(board.id);
  }

  for (const { item } of candidates) {
    const provenance = readCastProvenance(item.metadata);
    if (item.sourceModelId && provenance && item.sourceModelId !== provenance.modelId) {
      throw new Error("Canvas Cast provenance disagrees with its direct model link");
    }
    const linked = item.sourceModelId === modelId || provenance?.modelId === modelId;
    const currentUrlMatch = !!item.imageUrl && urlSet.has(item.imageUrl);
    const matchedHistory = versionsByItem.get(item.id) ?? [];
    if (!linked && hasRawModelIdCandidate(item.metadata, modelId)) {
      throw new Error("Unrecognized Canvas model-link candidate");
    }
    if (!linked && !currentUrlMatch && matchedHistory.length === 0) {
      throw new Error("Unrecognized Canvas model-link candidate");
    }
    affectedBoards.add(item.boardId);

    if (linked) {
      collectManifestKey(storageKeys, currentPublicUrl, { storageKey: item.imageKey, url: item.imageUrl });
      const allVersions = await tx
        .select({ id: boardItemVersions.id, imageUrl: boardItemVersions.imageUrl })
        .from(boardItemVersions)
        .where(eq(boardItemVersions.itemId, item.id))
        .for("update");
      for (const version of allVersions) collectManifestKey(storageKeys, currentPublicUrl, { url: version.imageUrl });
      removedVersions += allVersions.length;
      deleteItemIds.push(item.id);
      continue;
    }

    if (matchedHistory.length) {
      await tx.delete(boardItemVersions).where(inArray(boardItemVersions.id, matchedHistory.map((row) => row.id)));
      removedVersions += matchedHistory.length;
    }
    const scrubbedMetadata = scrubMetadataValue(item.metadata, urlSet, modelId) as BoardItem["metadata"];
    if (currentUrlMatch) {
      const [newestSurvivor] = await tx
        .select({ imageUrl: boardItemVersions.imageUrl })
        .from(boardItemVersions)
        .where(eq(boardItemVersions.itemId, item.id))
        .orderBy(desc(boardItemVersions.version), desc(boardItemVersions.id))
        .limit(1);
      if (!newestSurvivor) {
        deleteItemIds.push(item.id);
      } else {
        await tx.update(boardItems).set({
          imageUrl: newestSurvivor.imageUrl,
          imageKey: null,
          metadata: scrubbedMetadata,
        }).where(eq(boardItems.id, item.id));
      }
    } else {
      await tx.update(boardItems).set({ metadata: scrubbedMetadata }).where(eq(boardItems.id, item.id));
    }
  }

  const wardrobeCondition = or(
    ...(wardrobeSessionIds.length ? [inArray(boardItems.sourceSessionId, wardrobeSessionIds)] : []),
    ...(wardrobeLookIds.length ? [inArray(boardItems.sourceLookId, wardrobeLookIds)] : []),
  );
  if (wardrobeCondition) {
    const wardrobeLinked = await tx
      .select({ id: boardItems.id, boardId: boardItems.boardId, boardUserId: boards.userId })
      .from(boardItems)
      .innerJoin(boards, eq(boardItems.boardId, boards.id))
      .where(wardrobeCondition)
      .for("update");
    if (wardrobeLinked.some((item) => item.boardUserId !== userId)) {
      log.fatal({ modelId }, "Cross-owner Canvas item references deleted Cast Wardrobe state");
      throw new Error("Cross-owner Canvas dependency detected");
    }
    for (const item of wardrobeLinked) {
      affectedBoards.add(item.boardId);
      if (!deleteItemIds.includes(item.id)) {
        await tx.update(boardItems).set({ sourceSessionId: null, sourceLookId: null }).where(eq(boardItems.id, item.id));
      }
    }
  }

  if (deleteItemIds.length) {
    await tx.delete(boardEdges).where(or(
      inArray(boardEdges.sourceItemId, deleteItemIds),
      inArray(boardEdges.targetItemId, deleteItemIds),
    ));
    await tx.update(boardItems).set({ parentItemId: null }).where(inArray(boardItems.parentItemId, deleteItemIds));
    await tx.delete(boardItemVersions).where(inArray(boardItemVersions.itemId, deleteItemIds));
    await tx.delete(boardItems).where(inArray(boardItems.id, deleteItemIds));
  }
  for (const boardId of Array.from(affectedBoards).sort((a, b) => a - b)) {
    await recomputeBoardThumbnailIn(tx, boardId);
  }
  return { items: deleteItemIds.length, versions: removedVersions, boards: affectedBoards.size };
}

/**
 * R7-5C's single durable boundary. No storage call occurs here: this commits
 * only the exact-owned cleanup manifest that R7-5D will process later.
 */
export async function executeFinalCastDeletion(input: {
  userId: number;
  modelId: number;
  operationId: string;
  currentPublicUrl?: string;
  audit?: { ipAddress?: string | null; userAgent?: string | null };
  failurePoint?: FinalCastDeletionFailurePoint;
}): Promise<FinalCastDeletionResult> {
  const currentPublicUrl = input.currentPublicUrl ?? process.env.R2_PUBLIC_URL ?? "";
  if (!currentPublicUrl) throw new Error("R2_PUBLIC_URL is required to plan safe storage cleanup");
  return withTransaction(async (tx) => {
    await lockModelIn(tx, input);
    const [operation] = await tx
      .select()
      .from(generationOperations)
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.modelId, input.modelId),
        eq(generationOperations.kind, "model.delete"),
        eq(generationOperations.status, "running"),
      ))
      .limit(1)
      .for("update");
    if (!operation) throw new Error("The active deletion receipt was not found");
    const [ownedLock] = await tx
      .select({ operationId: generationOperationLocks.operationId })
      .from(generationOperationLocks)
      .where(eq(generationOperationLocks.lockKey, `model:${input.modelId}`))
      .limit(1)
      .for("update");
    if (ownedLock?.operationId !== input.operationId) throw new Error("Deletion no longer owns the model lock");

    const assets = await tx.select().from(modelAssets).where(eq(modelAssets.modelId, input.modelId)).for("update");
    const attempts = await tx.select().from(generations).where(eq(generations.modelId, input.modelId)).for("update");
    const priorOperations = await tx
      .select()
      .from(generationOperations)
      .where(and(eq(generationOperations.modelId, input.modelId), ne(generationOperations.id, input.operationId)))
      .for("update");
    const unsettledPrior = priorOperations.find((candidate) =>
      candidate.status === "claimed" ||
      candidate.status === "running" ||
      candidate.status === "recovery_required"
    );
    if (unsettledPrior) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This Cast still has work in progress. Wait for it to finish, then delete it.",
      });
    }
    const sessions = await tx.select().from(wardrobeSessions).where(eq(wardrobeSessions.modelId, input.modelId)).for("update");
    const looks = await tx.select().from(wardrobeLooks).where(eq(wardrobeLooks.modelId, input.modelId)).for("update");
    const storageKeys = new Set<string>();
    for (const asset of assets) {
      collectManifestKey(storageKeys, currentPublicUrl, { storageKey: asset.storageKey, url: asset.storageUrl });
    }
    for (const attempt of attempts) {
      collectManifestKey(storageKeys, currentPublicUrl, { url: attempt.resultUrl });
    }
    const assetUrlSet = new Set(assets.map((asset) => asset.storageUrl));
    for (const session of sessions) {
      // A linked Wardrobe session may point at a shared upload. Only the Cast
      // asset itself and Wardrobe's known output history prove object ownership.
      if (assetUrlSet.has(session.modelImageUrl)) {
        collectManifestKey(storageKeys, currentPublicUrl, { url: session.modelImageUrl });
      }
      collectKnownOutputHistory(storageKeys, currentPublicUrl, session.history);
    }
    for (const look of looks) collectManifestKey(storageKeys, currentPublicUrl, { url: look.imageUrl });

    // preferences.referenceImage is a temporary input, not an owned output.
    // Without a durable ownership key and a complete reverse-reference proof,
    // preserve the object; tombstoning the preferences removes the Cast link.

    // Canvas references may contribute explicit item/history keys. Discover
    // them before persisting the manifest; only then may source rows change.
    await collectCanvasCleanupKeysIn({
      tx,
      modelId: input.modelId,
      assetUrls: assets.map((asset) => asset.storageUrl),
      storageKeys,
      currentPublicUrl,
    });
    const manifest = await createStorageCleanupManifestIn(tx, {
      userId: input.userId,
      operationId: input.operationId,
      kind: "model_delete",
      storageKeys: Array.from(storageKeys),
    });
    failAt("after_manifest", input.failurePoint);
    const manifestKeyCount = storageKeys.size;
    const canvas = await deleteCanvasDependenciesIn({
      tx,
      modelId: input.modelId,
      userId: input.userId,
      assetUrls: assets.map((asset) => asset.storageUrl),
      storageKeys,
      currentPublicUrl,
      wardrobeSessionIds: sessions.map((session) => session.id),
      wardrobeLookIds: looks.map((look) => look.id),
    });
    if (storageKeys.size !== manifestKeyCount) {
      throw new Error("Canvas cleanup discovered a storage key after the manifest boundary");
    }
    failAt("after_canvas", input.failurePoint);

    await tx.delete(wardrobeLooks).where(eq(wardrobeLooks.modelId, input.modelId));
    await tx.delete(wardrobeSessions).where(eq(wardrobeSessions.modelId, input.modelId));
    await tx.delete(modelAssets).where(eq(modelAssets.modelId, input.modelId));
    await tx.update(generations).set({
      modelId: null,
      operationId: null,
      stepKey: null,
      viewAngle: null,
      resultUrl: null,
      errorMessage: null,
      metadata: null,
    }).where(eq(generations.modelId, input.modelId));
    const scrubbedBugReports = await tx.update(bugReports).set({ modelId: null }).where(eq(bugReports.modelId, input.modelId));
    await tx.update(auditLogs).set({ metadata: null }).where(and(
      eq(auditLogs.resourceType, "model"),
      eq(auditLogs.resourceId, String(input.modelId)),
    ));
    if (priorOperations.length) {
      await tx.update(generationOperations).set({
        modelId: null,
        originBoardId: null,
        originItemId: null,
        expectedIdentityRevisionId: null,
        chargeReferenceId: null,
        result: null,
        errorCode: null,
        publicMessage: null,
        phase: null,
        progress: null,
        heartbeatAt: null,
        leaseExpiresAt: null,
        landedItemId: null,
        landingStatus: "not_applicable",
        landingAcknowledgedAt: null,
        recoveryAttemptedAt: null,
        subjectDeletedAt: new Date(),
      }).where(inArray(generationOperations.id, priorOperations.map((row) => row.id)));
      await tx.delete(generationOperationLocks).where(inArray(
        generationOperationLocks.operationId,
        priorOperations.map((row) => row.id),
      ));
    }
    failAt("after_dependencies", input.failurePoint);

    const now = new Date();
    failAt("before_tombstone", input.failurePoint);
    const tombstoned = await tx.update(models).set({
      agencyId: null,
      name: null,
      masterPrompt: "[deleted]",
      technicalSchema: { deleted: true },
      preferences: {},
      status: "archived",
      identityRevisionId: null,
      mintedAt: null,
      deletedAt: now,
    }).where(and(
      eq(models.id, input.modelId),
      eq(models.userId, input.userId),
      isNull(models.deletedAt),
      ne(models.status, "archived"),
    ));
    if (affectedRows(tombstoned) !== 1) throw new Error("Deletion lost the model tombstone race");

    const counts: FinalCastDeletionCounts = {
      assets: assets.length,
      canvasItems: canvas.items,
      canvasVersions: canvas.versions,
      affectedBoards: canvas.boards,
      wardrobeSessions: sessions.length,
      wardrobeLooks: looks.length,
      generationAttempts: attempts.length,
      priorOperations: priorOperations.length,
      bugReportsScrubbed: affectedRows(scrubbedBugReports),
      cleanupObjects: manifest.expectedCount,
    };
    await tx.insert(auditLogs).values({
      userId: input.userId,
      action: AUDIT_ACTIONS.MODEL_DELETED,
      resourceType: "model",
      resourceId: String(input.modelId),
      metadata: { counts },
      severity: "info",
      ipAddress: input.audit?.ipAddress ?? null,
      userAgent: input.audit?.userAgent ?? null,
    });

    failAt("before_receipt", input.failurePoint);
    const result: FinalCastDeletionResult = { deleted: true, counts };
    const finalized = await tx.update(generationOperations).set({
      status: "succeeded",
      modelId: null,
      expectedIdentityRevisionId: null,
      chargeReferenceId: null,
      result,
      errorCode: null,
      publicMessage: null,
      chargedCredits: 0,
      refundedCredits: 0,
      completedAt: now,
      heartbeatAt: null,
      leaseExpiresAt: null,
    }).where(and(
      eq(generationOperations.id, input.operationId),
      eq(generationOperations.userId, input.userId),
      eq(generationOperations.status, "running"),
    ));
    if (affectedRows(finalized) !== 1) throw new Error("Deletion receipt finalization lost its state race");
    await tx.delete(generationOperationLocks).where(eq(generationOperationLocks.operationId, input.operationId));
    return result;
  });
}
