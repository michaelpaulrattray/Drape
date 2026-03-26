/**
 * Wardrobe DB Helpers — CRUD operations for garments, outfits, and sessions.
 */
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { getDb } from "./connection";
import {
  wardrobeGarments,
  wardrobeOutfits,
  wardrobeSessions,
  models,
  type InsertWardrobeGarment,
  type InsertWardrobeOutfit,
  type InsertWardrobeSession,
} from "../../drizzle/schema";

// ── Garments ───────────────────────────────────────────────────────────────

export async function createGarment(data: InsertWardrobeGarment) {
  const db = (await getDb())!;
  const [result] = await db.insert(wardrobeGarments).values(data).$returningId();
  return result.id;
}

export async function getGarmentById(garmentId: number) {
  const db = (await getDb())!;
  const [garment] = await db
    .select()
    .from(wardrobeGarments)
    .where(eq(wardrobeGarments.id, garmentId))
    .limit(1);
  return garment || null;
}

export async function getUserGarments(userId: number) {
  const db = (await getDb())!;
  return db
    .select()
    .from(wardrobeGarments)
    .where(eq(wardrobeGarments.userId, userId))
    .orderBy(desc(wardrobeGarments.createdAt));
}

export async function getUserGarmentsBySlot(userId: number, slotType: string) {
  const db = (await getDb())!;
  return db
    .select()
    .from(wardrobeGarments)
    .where(
      and(
        eq(wardrobeGarments.userId, userId),
        eq(wardrobeGarments.slotType, slotType as any),
      ),
    )
    .orderBy(desc(wardrobeGarments.createdAt));
}

export async function updateGarment(
  garmentId: number,
  data: Partial<InsertWardrobeGarment>,
) {
  const db = (await getDb())!;
  await db
    .update(wardrobeGarments)
    .set(data)
    .where(eq(wardrobeGarments.id, garmentId));
}

export async function deleteGarment(garmentId: number, userId: number) {
  const db = (await getDb())!;
  await db
    .delete(wardrobeGarments)
    .where(
      and(
        eq(wardrobeGarments.id, garmentId),
        eq(wardrobeGarments.userId, userId),
      ),
    );
}

// ── Outfits ────────────────────────────────────────────────────────────────

export async function createOutfit(data: InsertWardrobeOutfit) {
  const db = (await getDb())!;
  const [result] = await db.insert(wardrobeOutfits).values(data).$returningId();
  return result.id;
}

export async function getUserOutfits(userId: number) {
  const db = (await getDb())!;
  return db
    .select()
    .from(wardrobeOutfits)
    .where(eq(wardrobeOutfits.userId, userId))
    .orderBy(desc(wardrobeOutfits.createdAt));
}

export async function getOutfitById(outfitId: number) {
  const db = (await getDb())!;
  const [outfit] = await db
    .select()
    .from(wardrobeOutfits)
    .where(eq(wardrobeOutfits.id, outfitId))
    .limit(1);
  return outfit || null;
}

export async function updateOutfit(
  outfitId: number,
  data: Partial<InsertWardrobeOutfit>,
) {
  const db = (await getDb())!;
  await db
    .update(wardrobeOutfits)
    .set(data)
    .where(eq(wardrobeOutfits.id, outfitId));
}

export async function deleteOutfit(outfitId: number, userId: number) {
  const db = (await getDb())!;
  await db
    .delete(wardrobeOutfits)
    .where(
      and(
        eq(wardrobeOutfits.id, outfitId),
        eq(wardrobeOutfits.userId, userId),
      ),
    );
}

// ── Sessions ───────────────────────────────────────────────────────────────

export async function createSession(data: InsertWardrobeSession) {
  const db = (await getDb())!;
  const [result] = await db.insert(wardrobeSessions).values(data).$returningId();
  return result.id;
}

export async function getSessionById(sessionId: number) {
  const db = (await getDb())!;
  const [session] = await db
    .select()
    .from(wardrobeSessions)
    .where(eq(wardrobeSessions.id, sessionId))
    .limit(1);
  return session || null;
}

export async function getUserSessions(userId: number) {
  const db = (await getDb())!;
  return db
    .select()
    .from(wardrobeSessions)
    .where(eq(wardrobeSessions.userId, userId))
    .orderBy(desc(wardrobeSessions.updatedAt));
}

export async function updateSession(
  sessionId: number,
  data: Partial<InsertWardrobeSession>,
) {
  const db = (await getDb())!;
  await db
    .update(wardrobeSessions)
    .set(data)
    .where(eq(wardrobeSessions.id, sessionId));
}

export async function deleteSession(sessionId: number, userId: number) {
  const db = (await getDb())!;
  await db
    .delete(wardrobeSessions)
    .where(
      and(
        eq(wardrobeSessions.id, sessionId),
        eq(wardrobeSessions.userId, userId),
      ),
    );
}

/**
 * Get the user's most recent active session across all tools.
 * Currently queries wardrobe_sessions; future tools (scenery, editorial)
 * can be added as additional queries in a union pattern.
 *
 * Returns null if no session with at least 1 VTO result exists.
 */
export async function getLatestUserSession(userId: number) {
  const db = (await getDb())!;

  // Get most recent wardrobe session that has at least one history entry
  const [session] = await db
    .select()
    .from(wardrobeSessions)
    .where(
      and(
        eq(wardrobeSessions.userId, userId),
        isNotNull(wardrobeSessions.history),
      ),
    )
    .orderBy(desc(wardrobeSessions.updatedAt))
    .limit(1);

  if (!session) return null;

  const history = (session.history as string[]) || [];
  if (history.length === 0) return null;

  // If session is linked to a cast model, fetch model name
  let modelName: string | null = null;
  let masterPrompt: string | null = null;
  if (session.modelId) {
    const [model] = await db
      .select({ name: models.name, masterPrompt: models.masterPrompt })
      .from(models)
      .where(eq(models.id, session.modelId))
      .limit(1);
    if (model) {
      modelName = model.name;
      masterPrompt = model.masterPrompt;
    }
  }

  return {
    tool: "wardrobe" as const,
    sessionId: session.id,
    modelId: session.modelId,
    modelName,
    masterPrompt,
    modelImageUrl: session.modelImageUrl,
    lastResultUrl: history[history.length - 1],
    iterationCount: history.length,
    activeGarmentIds: (session.activeGarmentIds as number[]) || [],
    history,
    historyIndex: session.historyIndex ?? history.length - 1,
    updatedAt: session.updatedAt,
    tattooMapData: session.tattooMapData ?? null,
    styleNotes: (session.styleNotes as Record<string, string>) ?? null,
  };
}
