/**
 * Models Domain — model CRUD, minting, and model asset management.
 */

import { eq, desc } from "drizzle-orm";
import {
  models,
  modelAssets,
  InsertModel,
  InsertModelAsset,
} from "../../drizzle/schema";
import { getDb } from "./connection";

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
    console.error("[Database] Failed to create model:", error);
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
    Pick<InsertModel, "name" | "status" | "masterPrompt" | "technicalSchema">
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
    console.error("[Database] Failed to update model:", error);
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
    console.error("[Database] Failed to mint model:", error);
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
    await db.delete(modelAssets).where(eq(modelAssets.modelId, modelId));
    await db.delete(models).where(eq(models.id, modelId));
    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to delete model:", error);
    return { success: false, error: "Failed to delete model" };
  }
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
    // Get all asset keys before deletion
    const assets = await getModelAssetsForCleanup(modelId);
    const assetKeys = assets
      .map((a) => a.storageKey)
      .filter((k): k is string => k !== null);

    await db.delete(modelAssets).where(eq(modelAssets.modelId, modelId));
    await db.delete(models).where(eq(models.id, modelId));

    return { success: true, assetKeys };
  } catch (error) {
    console.error("[Database] Failed to delete model with assets:", error);
    return { success: false, assetKeys: [], error: "Failed to delete model" };
  }
}
