/**
 * Models Domain — model CRUD, minting, and model asset management.
 */

import { eq, ne, desc, and, inArray, isNull, sql } from "drizzle-orm";
import {
  models,
  modelAssets,
  InsertModel,
  InsertModelAsset,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import { MODEL_MINTED_STATUSES } from "../../shared/modelLifecycle";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/models");

export async function createModel(
  data: InsertModel
): Promise<{ success: boolean; modelId?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // R7-1A exact-insert authority: selecting the user's newest row after an
    // insert can return a sibling concurrent cast/fork/variation. The id
    // returned by this insert is the only model this caller may own.
    const [inserted] = await db.insert(models).values({
      ...data,
      status: "draft",
    }).$returningId();

    if (!inserted?.id) {
      log.error({ userId: data.userId }, "[Database] Model insert returned no id");
      return { success: false, error: "Failed to create model" };
    }
    return { success: true, modelId: inserted.id };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to create model:");
    return { success: false, error: "Failed to create model" };
  }
}

export async function getModelById(modelId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(models)
    .where(and(eq(models.id, modelId), isNull(models.deletedAt), ne(models.status, "archived")))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getModelByAgencyId(agencyId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(models)
    .where(eq(models.agencyId, agencyId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserModels(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  // Batch 0 (FR-4): archived is deleted — excluded from every active read
  // (library list, picker, lobby feeds all flow through here)
  return await db
    .select()
    .from(models)
    .where(and(eq(models.userId, userId), ne(models.status, "archived"), isNull(models.deletedAt)))
    .orderBy(desc(models.createdAt))
    .limit(limit);
}

export type ModelPlacementTruth = { status: string; name: string | null };

/** One-query lifecycle + name truth for model-linked board placements. Deleted
 * subjects are deliberately absent; R7-5C removes their linked placements in
 * the same transaction instead of rendering a Source unavailable card. */
export async function getModelStatusesIn(
  modelIds: number[],
  userId: number,
): Promise<Map<number, ModelPlacementTruth>> {
  if (modelIds.length === 0) return new Map();
  const db = await getDb();
  if (!db) return new Map();

  const rows = await db
    .select({ id: models.id, status: models.status, name: models.name })
    .from(models)
    .where(and(
      inArray(models.id, modelIds),
      eq(models.userId, userId),
      isNull(models.deletedAt),
      ne(models.status, "archived"),
    ));
  return new Map(rows.map((row) => [row.id, { status: row.status, name: row.name }]));
}

export async function updateModel(
  modelId: number,
  data: Partial<
    Pick<InsertModel, "name" | "status" | "masterPrompt" | "technicalSchema" | "preferences">
  >
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    const updated = await db
      .update(models)
      .set(data)
      .where(and(eq(models.id, modelId), isNull(models.deletedAt), ne(models.status, "archived")));
    const affected = Array.isArray(updated)
      ? (updated[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0
      : (updated as { affectedRows?: number }).affectedRows ?? 0;
    if (affected === 0) {
      const [available] = await db
        .select({ id: models.id })
        .from(models)
        .where(and(eq(models.id, modelId), isNull(models.deletedAt), ne(models.status, "archived")))
        .limit(1);
      if (!available) return { success: false, error: "Model not found" };
    }
    return { success: true };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to update model:");
    return { success: false, error: "Failed to update model" };
  }
}

/**
 * Mint a model on export — assigns agencyId and locks the identity.
 * Called when a user exports their model for the first time.
 */
export async function mintModelAtomically(
  input: {
    modelId: number;
    userId: number;
    agencyId: string;
    name: string;
    expectedIdentityRevisionId: string | null;
  },
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    const updated = await db
      .update(models)
      .set({
        name: input.name,
        agencyId: input.agencyId,
        status: "active",
        mintedAt: new Date(),
      })
      .where(and(
        eq(models.id, input.modelId),
        eq(models.userId, input.userId),
        eq(models.status, "draft"),
        isNull(models.deletedAt),
        isNull(models.agencyId),
        isNull(models.mintedAt),
        sql`${models.identityRevisionId} <=> ${input.expectedIdentityRevisionId}`,
      ));
    const affected = Array.isArray(updated)
      ? (updated[0] as { affectedRows?: number } | undefined)?.affectedRows
      : (updated as { affectedRows?: number }).affectedRows;
    if (affected !== 1) {
      return { success: false, error: "The Cast changed before minting could finish. Review it and try again." };
    }

    return { success: true };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to atomically mint model:");
    return { success: false, error: "Failed to mint model" };
  }
}

/**
 * Get user's minted (exported) models with their frontFull thumbnail.
 * Returns models whose STATUS reads minted — 'active' or the legacy 'locked'
 * alias (Batch B / FR-4; the filter is the shared MODEL_MINTED_STATUSES list
 * so it can never diverge from the read model) — that have a thumbnail asset.
 * Rows carry `status` so consumers derive minted state from status truth,
 * never from the row's gallery-of-origin.
 * Used by the studio lobby "My Models" gallery.
 */
export async function getUserMintedModels(
  userId: number,
  limit: number = 20,
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: models.id,
      name: models.name,
      status: models.status,
      agencyId: models.agencyId,
      masterPrompt: models.masterPrompt,
      mintedAt: models.mintedAt,
      createdAt: models.createdAt,
      updatedAt: models.updatedAt,
    })
    .from(models)
    .where(and(
      eq(models.userId, userId),
      inArray(models.status, [...MODEL_MINTED_STATUSES]),
      isNull(models.deletedAt),
    ))
    .orderBy(desc(models.mintedAt))
    .limit(limit);
}

export async function getUserMintedModelsWithThumbnail(
  userId: number,
  limit: number = 20
) {
  const userModels = await getUserMintedModels(userId, limit);
  if (userModels.length === 0) return [];
  const db = await getDb();
  if (!db) return [];

  // Get frontFull assets for these models
  const modelIds = userModels.map((m) => m.id);
  const assets = await db
    .select({
      modelId: modelAssets.modelId,
      storageUrl: modelAssets.storageUrl,
      viewType: modelAssets.viewType,
    })
    .from(modelAssets)
    .where(inArray(modelAssets.modelId, modelIds));

  // Build a map of modelId -> frontFull URL (prefer frontFull, fallback to frontClose)
  const thumbMap = new Map<number, string>();
  const assetViewTypes = new Map<number, Set<string>>();
  for (const asset of assets) {
    if (!asset.storageUrl) continue; // failed-slot markers aren't thumbnails
    if (!assetViewTypes.has(asset.modelId)) assetViewTypes.set(asset.modelId, new Set());
    assetViewTypes.get(asset.modelId)!.add(asset.viewType);
    if (asset.viewType === "frontFull") {
      thumbMap.set(asset.modelId, asset.storageUrl);
    } else if (asset.viewType === "frontClose" && !thumbMap.has(asset.modelId)) {
      thumbMap.set(asset.modelId, asset.storageUrl);
    }
  }

  // Only return models that have at least a thumbnail
  return userModels
    .filter((m) => thumbMap.has(m.id))
    .map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      agencyId: m.agencyId,
      masterPrompt: m.masterPrompt,
      thumbnailUrl: thumbMap.get(m.id)!,
      mintedAt: m.mintedAt,
      updatedAt: m.updatedAt,
      assetCount: assetViewTypes.get(m.id)?.size ?? 0,
    }));
}

/**
 * Get user's draft (unfinished) models with their headshot thumbnail.
 * Only returns models with status 'draft' that have at least one asset.
 * Used by the studio lobby "Draft Casts" row.
 */
export async function getUserDraftModels(
  userId: number,
  limit: number = 3,
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: models.id,
      name: models.name,
      masterPrompt: models.masterPrompt,
      preferences: models.preferences,
      technicalSchema: models.technicalSchema,
      createdAt: models.createdAt,
      updatedAt: models.updatedAt,
    })
    .from(models)
    .where(and(eq(models.userId, userId), eq(models.status, "draft"), isNull(models.deletedAt)))
    .orderBy(desc(models.createdAt))
    .limit(limit);
}

export async function getUserDraftModelsWithThumbnail(
  userId: number,
  limit: number = 3
) {
  const draftModels = await getUserDraftModels(userId, limit);
  if (draftModels.length === 0) return [];
  const db = await getDb();
  if (!db) return [];

  const modelIds = draftModels.map((m) => m.id);
  const assets = await db
    .select({
      modelId: modelAssets.modelId,
      storageUrl: modelAssets.storageUrl,
      viewType: modelAssets.viewType,
    })
    .from(modelAssets)
    .where(inArray(modelAssets.modelId, modelIds));

  // Build thumbnail map — prefer frontClose (headshot), fallback to any asset
  const thumbMap = new Map<number, string>();
  const assetViewTypes = new Map<number, Set<string>>();
  for (const asset of assets) {
    if (!assetViewTypes.has(asset.modelId)) assetViewTypes.set(asset.modelId, new Set());
    assetViewTypes.get(asset.modelId)!.add(asset.viewType);
    if (asset.viewType === "frontClose") {
      thumbMap.set(asset.modelId, asset.storageUrl);
    } else if (!thumbMap.has(asset.modelId)) {
      thumbMap.set(asset.modelId, asset.storageUrl);
    }
  }

  // Only return drafts that have at least one asset (user paid for generation)
  return draftModels
    .filter((m) => thumbMap.has(m.id))
    .map((m) => ({
      id: m.id,
      name: m.name,
      masterPrompt: m.masterPrompt,
      preferences: m.preferences,
      technicalSchema: m.technicalSchema,
      thumbnailUrl: thumbMap.get(m.id)!,
      assetCount: assetViewTypes.get(m.id)?.size ?? 0,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
}

// ============ Model Assets ============

export async function createModelAsset(
  data: InsertModelAsset
): Promise<{ success: boolean; assetId?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // $returningId, never newest-by-createdAt (D-46 R7 log): the mint runs
    // every slot through Promise.all, so a newest-row lookup could return a
    // SIBLING slot's id — which then rides back to the client and misroutes
    // the next iterate (VC-R6 final r2 defect 1). The inserted id must be
    // exactly this row's.
    const [inserted] = await db.insert(modelAssets).values(data).$returningId();
    return { success: true, assetId: inserted?.id };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to create model asset:");
    return { success: false, error: "Failed to create model asset" };
  }
}

export async function getModelAssets(modelId: number) {
  const db = await getDb();
  if (!db) return [];

  // id DESC tiebreak: refresh writes rows seconds after mint rows — same-second
  // createdAt ties must still resolve newest-first (the whole package read
  // model is newest-wins).
  return await db
    .select()
    .from(modelAssets)
    .where(eq(modelAssets.modelId, modelId))
    .orderBy(desc(modelAssets.createdAt), desc(modelAssets.id));
}

/**
 * Newest frontClose asset per model, ONE query (the picker's N+1 fix —
 * one getModelAssets roundtrip per model put the picker's first paint
 * past 10s at ~30 models on the remote dev DB). Newest-wins per the
 * package read model (createdAt DESC, id DESC tiebreak).
 */
export async function getHeadshotsForModels(
  modelIds: number[]
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (modelIds.length === 0) return out;
  const db = await getDb();
  if (!db) return out;

  const rows = await db
    .select({
      modelId: modelAssets.modelId,
      storageUrl: modelAssets.storageUrl,
    })
    .from(modelAssets)
    .where(and(inArray(modelAssets.modelId, modelIds), eq(modelAssets.viewType, "frontClose")))
    .orderBy(desc(modelAssets.createdAt), desc(modelAssets.id));
  for (const row of rows) {
    if (!out.has(row.modelId) && row.storageUrl) out.set(row.modelId, row.storageUrl);
  }
  return out;
}

/** R5 per-slot pin (D-21 on the package ledger): flips `pinned` on ONE asset
 *  row — callers resolve which row via the newest-filled rule (mintPackage's
 *  newestFilledAssetId) so pin state always rides the row the read model shows. */
export async function setModelAssetPinned(assetId: number, pinned: boolean): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) return { success: false };
  await db.update(modelAssets).set({ pinned }).where(eq(modelAssets.id, assetId));
  return { success: true };
}

/** F6/D-53 stale-writer: mark asset rows out-of-sync on model_assets. The
 *  entire read side (tile dimming + dots, {N} stale strip segment, bulk
 *  refresh, composer warnings) shipped dormant with R5 — this is the writer
 *  that lights it. Refresh/restore clear it by APPENDING a new head row
 *  (newest-wins), never by editing status back. */
export async function markModelAssetsStale(assetIds: number[]): Promise<{ success: boolean }> {
  if (assetIds.length === 0) return { success: true };
  const db = await getDb();
  if (!db) return { success: false };
  await db
    .update(modelAssets)
    .set({ status: { state: "stale", at: new Date().toISOString() } })
    .where(inArray(modelAssets.id, assetIds));
  return { success: true };
}

export async function getModelAssetByView(modelId: number, viewType: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(modelAssets)
    .where(eq(modelAssets.modelId, modelId))
    .orderBy(desc(modelAssets.createdAt));

  const filtered = result.filter((a) => a.viewType === viewType);
  return filtered.length > 0 ? filtered[0] : null;
}
