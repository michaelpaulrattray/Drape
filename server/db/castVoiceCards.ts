/**
 * A CAST'S HIDDEN VOICE CARD — the statements (card #2498, N4b).
 *
 * Every statement carries the owner in its own `WHERE` or join (enforcement
 * invariants 1 and 2), and the write re-proves the owned, live, signed cast in
 * the statement itself through the roster's own predicate (`signedCastWhere`).
 *
 * ⚠ **THIS MODULE READS THE RECIPE, AND IT IS THE ONLY VOICE MODULE THAT DOES.**
 * `castVoices.ts` deliberately loads nothing but the voice line. The card is
 * written FROM the customer's words, so the source read below loads the brief
 * (the roll's own sentence), the cast's description paragraph of
 * `masterPrompt`, both lines and the customer's own sentences behind them. It
 * returns them to the writer and to nothing else: no projection, no log line,
 * no staff surface (invariant 8; the schema header carries the full reading).
 */
import { and, eq, sql } from "drizzle-orm";

import { castingRolls, castVoiceCards, models } from "../../drizzle/schema";
import { getDb, withTransaction, type TransactionHandle } from "./connection";
import { signedCastWhere } from "./castingV2Sign";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("[castVoiceCards] database not available");
  return db;
}

function assertPositiveId(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}

/** What a card is written from. Server-side only; see the header. */
export type CastVoiceCardSources = {
  modelId: number;
  name: string | null;
  /** The customer's own typed brief — the roll's sentence. */
  briefText: string | null;
  /** `models.masterPrompt` in full; the writer keeps the description paragraph. */
  masterPrompt: string;
  personality: string | null;
  voice: string | null;
  personalityOwnWords: string | null;
  voiceOwnWords: string | null;
  /** Set when the CUSTOMER rewrote the line — then the line is their words too. */
  personalityEditedAt: Date | null;
  voiceEditedAt: Date | null;
};

/**
 * The card's sources, read off the owned live signed cast in ONE statement —
 * the roll joined on its own owner, so a cast can never borrow another
 * account's brief. `null` for a cast this road may not touch (not owned, not
 * live, not signed — one answer for all three).
 */
export async function readCastVoiceCardSources(
  userId: number,
  modelId: number,
): Promise<CastVoiceCardSources | null> {
  assertPositiveId(userId, "userId");
  assertPositiveId(modelId, "modelId");
  const db = await requireDb();
  const [row] = await db
    .select({
      modelId: models.id,
      name: models.name,
      briefText: castingRolls.briefText,
      masterPrompt: models.masterPrompt,
      personality: models.personality,
      voice: models.voice,
      personalityOwnWords: models.personalityOwnWords,
      voiceOwnWords: models.voiceOwnWords,
      personalityEditedAt: models.personalityEditedAt,
      voiceEditedAt: models.voiceEditedAt,
    })
    .from(models)
    .leftJoin(castingRolls, and(
      eq(castingRolls.id, models.sourceRollId),
      eq(castingRolls.userId, userId),
    ))
    .where(and(eq(models.id, modelId), signedCastWhere(userId)))
    .limit(1);
  return row ?? null;
}

/** The kept card, or `null`. Owner and cast in the one statement. */
export async function readCastVoiceCard(
  userId: number,
  modelId: number,
): Promise<{ sourceHash: string; voiceCard: string; previewLine: string } | null> {
  assertPositiveId(userId, "userId");
  assertPositiveId(modelId, "modelId");
  const db = await requireDb();
  const [row] = await db
    .select({
      sourceHash: castVoiceCards.sourceHash,
      voiceCard: castVoiceCards.voiceCard,
      previewLine: castVoiceCards.previewLine,
    })
    .from(castVoiceCards)
    .where(and(eq(castVoiceCards.modelId, modelId), eq(castVoiceCards.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Write (or replace) the cast's card.
 *
 * ⚠ **THE OWNED-AND-LIVE PROOF IS IN THE INSERT ITSELF** — an `INSERT … SELECT`
 * out of `signedCastWhere`, because the writer call takes tens of seconds and
 * the cast can be deleted inside it. The old row is removed in the same
 * transaction, so a lost insert (cast gone) rolls the delete back too and the
 * answer is `written: false`.
 */
export async function saveCastVoiceCard(input: {
  userId: number;
  modelId: number;
  sourceHash: string;
  voiceCard: string;
  previewLine: string;
  writerModel: string;
}): Promise<{ written: boolean }> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  await requireDb();
  try {
    return await withTransaction(async (tx) => {
      await tx.delete(castVoiceCards).where(and(
        eq(castVoiceCards.modelId, input.modelId),
        eq(castVoiceCards.userId, input.userId),
      ));
      const result = await tx.insert(castVoiceCards).select(
        tx
          .select({
            id: sql<number>`NULL`.as("id"),
            modelId: models.id,
            userId: models.userId,
            /* BOUND VALUES, never interpolation. */
            sourceHash: sql<string>`${input.sourceHash}`.as("sourceHash"),
            voiceCard: sql<string>`${input.voiceCard}`.as("voiceCard"),
            previewLine: sql<string>`${input.previewLine}`.as("previewLine"),
            writerModel: sql<string>`${input.writerModel}`.as("writerModel"),
            writtenAt: sql<Date>`CURRENT_TIMESTAMP`.as("writtenAt"),
          })
          .from(models)
          .where(and(eq(models.id, input.modelId), signedCastWhere(input.userId))),
      );
      if (affectedRows(result) !== 1) throw new CastVoiceCardNotWritten();
      return { written: true };
    });
  } catch (error) {
    if (error instanceof CastVoiceCardNotWritten) return { written: false };
    throw error;
  }
}

class CastVoiceCardNotWritten extends Error {}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

/** The card dies with its cast — inside the final-deletion transaction. */
export async function deleteCastVoiceCardsIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number },
): Promise<number> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  const result = await tx
    .delete(castVoiceCards)
    .where(and(eq(castVoiceCards.modelId, input.modelId), eq(castVoiceCards.userId, input.userId)));
  return (result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0;
}

/** Every card of one account — the erasure path's door. */
export async function deleteAccountVoiceCardsIn(
  tx: TransactionHandle,
  input: { userId: number },
): Promise<number> {
  assertPositiveId(input.userId, "userId");
  const result = await tx.delete(castVoiceCards).where(eq(castVoiceCards.userId, input.userId));
  return (result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0;
}
