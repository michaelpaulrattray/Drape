/**
 * Generations Domain — generation record CRUD and history queries.
 */

import { eq, desc } from "drizzle-orm";
import { generations, InsertGeneration } from "../../drizzle/schema";
import { getDb } from "./connection";

export async function createGeneration(
  data: InsertGeneration
): Promise<{ success: boolean; generationId?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    await db.insert(generations).values(data);
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
  data: Partial<
    Pick<
      InsertGeneration,
      "status" | "resultUrl" | "errorMessage" | "completedAt"
    >
  >
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    await db
      .update(generations)
      .set(data)
      .where(eq(generations.id, generationId));
    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to update generation:", error);
    return { success: false, error: "Failed to update generation" };
  }
}

export async function getUserGenerations(
  userId: number,
  limit: number = 50
) {
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

  const result = await db
    .select()
    .from(generations)
    .where(eq(generations.id, generationId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}
