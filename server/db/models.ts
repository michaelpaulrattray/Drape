/**
 * Models Domain — model CRUD, minting, and model asset management.
 */

import { eq, desc, and, inArray } from "drizzle-orm";
import {
  models,
  modelAssets,
  wardrobeSessions,
  wardrobeLooks,
  InsertModel,
  InsertModelAsset,
} from "../../drizzle/schema";
import { getDb, withTransaction } from "./connection";
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
    const result = await db.insert(models).values({
      ...data,
      status: "draft",
    });

    const inserted = await db
      .select()
      .from(models)
      .where(eq(models.userId, data.userId))
      .orderBy(desc(models.createdAt))
      .limit(1);

    return { success: true, modelId: inserted[0]?.id };
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
    .where(eq(models.id, modelId))
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

  return await db
    .select()
    .from(models)
    .where(eq(models.userId, userId))
    .orderBy(desc(models.createdAt))
    .limit(limit);
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
    await db.update(models).set(data).where(eq(models.id, modelId));
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
export async function mintModel(
  modelId: number,
  agencyId: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    const existing = await db
      .select()
      .from(models)
      .where(eq(models.id, modelId))
      .limit(1);
    if (existing.length === 0) {
      return { success: false, error: "Model not found" };
    }
    if (existing[0].agencyId) {
      return { success: false, error: "Model already minted" };
    }

    await db
      .update(models)
      .set({
        agencyId,
        status: "active",
        mintedAt: new Date(),
      })
      .where(eq(models.id, modelId));

    return { success: true };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to mint model:");
    return { success: false, error: "Failed to mint model" };
  }
}

export async function deleteModel(
  modelId: number
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    await withTransaction(async (tx) => {
      await tx.delete(wardrobeLooks).where(eq(wardrobeLooks.modelId, modelId));
      await tx.delete(wardrobeSessions).where(eq(wardrobeSessions.modelId, modelId));
      await tx.delete(modelAssets).where(eq(modelAssets.modelId, modelId));
      await tx.delete(models).where(eq(models.id, modelId));
    });
    return { success: true };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to delete model:");
    return { success: false, error: "Failed to delete model" };
  }
}

/**
 * Get user's minted (exported) models with their frontFull thumbnail.
 * Only returns models with status 'active' that have a frontFull asset.
 * Used by the studio lobby "My Models" gallery.
 */
export async function getUserMintedModelsWithThumbnail(
  userId: number,
  limit: number = 20
) {
  const db = await getDb();
  if (!db) return [];

  // Get active (minted) models for this user
  const userModels = await db
    .select({
      id: models.id,
      name: models.name,
      agencyId: models.agencyId,
      masterPrompt: models.masterPrompt,
      mintedAt: models.mintedAt,
      createdAt: models.createdAt,
    })
    .from(models)
    .where(and(eq(models.userId, userId), eq(models.status, "active")))
    .orderBy(desc(models.mintedAt))
    .limit(limit);

  if (userModels.length === 0) return [];

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
  for (const asset of assets) {
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
      agencyId: m.agencyId,
      masterPrompt: m.masterPrompt,
      thumbnailUrl: thumbMap.get(m.id)!,
      mintedAt: m.mintedAt,
    }));
}

/**
 * Get user's draft (unfinished) models with their headshot thumbnail.
 * Only returns models with status 'draft' that have at least one asset.
 * Used by the studio lobby "Draft Casts" row.
 */
export async function getUserDraftModelsWithThumbnail(
  userId: number,
  limit: number = 3
) {
  const db = await getDb();
  if (!db) return [];

  const draftModels = await db
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
    .where(and(eq(models.userId, userId), eq(models.status, "draft")))
    .orderBy(desc(models.createdAt))
    .limit(limit);

  if (draftModels.length === 0) return [];

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
    await db.insert(modelAssets).values(data);
    const inserted = await db
      .select()
      .from(modelAssets)
      .where(eq(modelAssets.modelId, data.modelId))
      .orderBy(desc(modelAssets.createdAt))
      .limit(1);
    return { success: true, assetId: inserted[0]?.id };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to create model asset:");
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

  const filtered = result.filter((a) => a.viewType === viewType);
  return filtered.length > 0 ? filtered[0] : null;
}

// ============ Asset Cleanup ============

export async function getModelAssetsForCleanup(
  modelId: number
): Promise<{ storageKey: string | null }[]> {
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
  error?: string;
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, assetKeys: [], error: "Database not available" };
  }

  try {
    // Get all asset keys before deletion (read outside transaction is fine)
    const assets = await getModelAssetsForCleanup(modelId);
    const assetKeys = assets
      .map((a) => a.storageKey)
      .filter((k): k is string => k !== null);

    await withTransaction(async (tx) => {
      await tx.delete(wardrobeLooks).where(eq(wardrobeLooks.modelId, modelId));
      await tx.delete(wardrobeSessions).where(eq(wardrobeSessions.modelId, modelId));
      await tx.delete(modelAssets).where(eq(modelAssets.modelId, modelId));
      await tx.delete(models).where(eq(models.id, modelId));
    });

    return { success: true, assetKeys };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to delete model with assets:");
    return { success: false, assetKeys: [], error: "Failed to delete model" };
  }
}
