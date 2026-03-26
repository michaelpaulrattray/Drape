/**
 * Wardrobe DB Helpers — CRUD operations for garments, outfits, and sessions.
 */
import { eq, and, desc, isNotNull, sql } from "drizzle-orm";
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
  const sessions = await getRecentUserSessions(userId, 1);
  return sessions[0] ?? null;
}

const MAX_SESSIONS_PER_USER = 4;

/**
 * Get the user's N most recent sessions that have at least 1 VTO result.
 * Enriches each session with model name/masterPrompt if linked to a cast model.
 */
export async function getRecentUserSessions(userId: number, limit = MAX_SESSIONS_PER_USER) {
  const db = (await getDb())!;

  const rows = await db
    .select()
    .from(wardrobeSessions)
    .where(
      and(
        eq(wardrobeSessions.userId, userId),
        isNotNull(wardrobeSessions.history),
      ),
    )
    .orderBy(desc(wardrobeSessions.updatedAt))
    .limit(limit);

  // Batch-fetch model names for sessions linked to cast models
  const modelIds = Array.from(new Set(rows.map((r) => r.modelId).filter(Boolean))) as number[];
  const modelMap = new Map<number, { name: string | null; masterPrompt: string | null }>();
  if (modelIds.length > 0) {
    const modelRows = await db
      .select({ id: models.id, name: models.name, masterPrompt: models.masterPrompt })
      .from(models)
      .where(sql`${models.id} IN (${sql.join(modelIds.map((id) => sql`${id}`), sql`, `)})`);
    for (const m of modelRows) {
      modelMap.set(m.id, { name: m.name, masterPrompt: m.masterPrompt });
    }
  }

  return rows
    .map((session) => {
      const history = (session.history as string[]) || [];
      if (history.length === 0) return null;
      const model = session.modelId ? modelMap.get(session.modelId) : null;
      return {
        tool: "wardrobe" as const,
        sessionId: session.id,
        modelId: session.modelId,
        modelName: model?.name ?? null,
        masterPrompt: model?.masterPrompt ?? null,
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
    })
    .filter(Boolean) as Array<NonNullable<ReturnType<typeof formatSession>>>;
}

/** Placeholder for type inference — not called directly */
function formatSession() {
  return null as null | {
    tool: "wardrobe";
    sessionId: number;
    modelId: number | null;
    modelName: string | null;
    masterPrompt: string | null;
    modelImageUrl: string;
    lastResultUrl: string;
    iterationCount: number;
    activeGarmentIds: number[];
    history: string[];
    historyIndex: number;
    updatedAt: Date;
    tattooMapData: unknown;
    styleNotes: Record<string, string> | null;
  };
}

/**
 * Cap sessions per user — delete oldest sessions beyond the limit.
 * Called after creating a new session to enforce the cap.
 */
export async function capUserSessions(userId: number) {
  const db = (await getDb())!;
  const allSessions = await db
    .select({ id: wardrobeSessions.id })
    .from(wardrobeSessions)
    .where(eq(wardrobeSessions.userId, userId))
    .orderBy(desc(wardrobeSessions.updatedAt));

  if (allSessions.length <= MAX_SESSIONS_PER_USER) return;

  const idsToDelete = allSessions.slice(MAX_SESSIONS_PER_USER).map((s) => s.id);
  for (const id of idsToDelete) {
    await db.delete(wardrobeSessions).where(eq(wardrobeSessions.id, id));
  }
}
