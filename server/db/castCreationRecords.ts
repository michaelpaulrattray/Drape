/**
 * THE CREATION RECORD'S STATEMENTS — N2d-1 (#2311), migration 0081.
 *
 * Every statement here carries the owner in its OWN `WHERE` or join (enforcement
 * invariants 1 and 2): there is no read-then-write keyed on an id alone, and a
 * child id (the roll, the candidate, the anchor asset) is re-anchored to the
 * owned cast in the statement that reads it.
 *
 * ⚠ **EXPLICIT PROJECTIONS ONLY (invariant 8).** The `models` read below names
 * its columns and never selects `masterPrompt`, `technicalSchema`,
 * `preferences` or the persona lines — the record is built from events and
 * hashes, and the cheapest way to keep the recipe out of it is never to load
 * the recipe at all. `castCreationRecords.test.ts` reads the SQL this module
 * really sends and asserts both halves.
 */
import { and, eq, getTableColumns, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";

import {
  castCreationRecords,
  castingCandidateVariants,
  castingCandidates,
  castingRolls,
  models,
  users,
  type CastCreationRecordRow,
} from "../../drizzle/schema";
import { getDb, type TransactionHandle } from "./connection";
import { isDuplicateKey } from "./castingV2InkDeliveryCrops";
import { readCastOriginalAnchorKey, signedCastWhere } from "./castingV2Sign";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("[castCreationRecords] database not available");
  return db;
}

function assertPositiveId(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}

/** Every fact a record is built from, except the master's hash (that needs bytes). */
export type CreationRecordSource = {
  modelId: number;
  kliegId: string;
  createdAt: Date;
  mintedAt: Date;
  /** `users.displayName` only — `users.name` is never read (finding 4 on PR #2317). */
  makerDisplayName: string | null;
  /** The ORIGINAL anchor — the lowest-sequence identity snapshot's — never a later edit's. */
  anchorStorageKey: string;
  rolledAt: Date | null;
  rollsInSession: number | null;
  keptAt: Date | null;
  refinements: { count: number; firstAt: Date | null; lastAt: Date | null };
};

export type CreationRecordSourceRefusal = "not_a_signed_cast" | "not_minted" | "no_anchor";

/**
 * Read the facts for one owned, live, signed and minted cast. Returns a
 * refusal rather than a partial source when the cast is not one this road can
 * certify — a provisioning cast has not finished being made.
 */
export async function readCreationRecordSource(
  userId: number,
  modelId: number,
): Promise<CreationRecordSource | { refused: CreationRecordSourceRefusal }> {
  assertPositiveId(userId, "userId");
  assertPositiveId(modelId, "modelId");
  const db = await requireDb();

  const [cast] = await db
    .select({
      id: models.id,
      agencyId: models.agencyId,
      createdAt: models.createdAt,
      mintedAt: models.mintedAt,
      sourceRollId: models.sourceRollId,
      sourceCandidateId: models.sourceCandidateId,
    })
    .from(models)
    .where(and(eq(models.id, modelId), signedCastWhere(userId)))
    .limit(1);
  if (!cast || !cast.agencyId) return { refused: "not_a_signed_cast" };
  if (!cast.mintedAt) return { refused: "not_minted" };

  const anchor = await readCastOriginalAnchorKey(userId, cast.id);
  if (!anchor) return { refused: "no_anchor" };

  const [maker] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  let rolledAt: Date | null = null;
  let rollsInSession: number | null = null;
  if (cast.sourceRollId) {
    const [roll] = await db
      .select({ id: castingRolls.id, sessionId: castingRolls.sessionId, createdAt: castingRolls.createdAt })
      .from(castingRolls)
      .where(and(eq(castingRolls.id, cast.sourceRollId), eq(castingRolls.userId, userId)))
      .limit(1);
    if (roll) {
      rolledAt = roll.createdAt;
      const [counted] = await db
        .select({ rolls: sql<number>`count(*)` })
        .from(castingRolls)
        .where(and(
          eq(castingRolls.sessionId, roll.sessionId),
          eq(castingRolls.userId, userId),
          lte(castingRolls.id, roll.id),
        ));
      rollsInSession = Number(counted?.rolls ?? 0) || null;
    }
  }

  let keptAt: Date | null = null;
  let refinements: CreationRecordSource["refinements"] = { count: 0, firstAt: null, lastAt: null };
  if (cast.sourceCandidateId) {
    const [candidate] = await db
      .select({ keptAt: castingCandidates.keptAt })
      .from(castingCandidates)
      .where(and(eq(castingCandidates.id, cast.sourceCandidateId), eq(castingCandidates.userId, userId)))
      .limit(1);
    keptAt = candidate?.keptAt ?? null;
    /* Refinements that DELIVERED — `ready`, or `expired` after delivering.
       A failed one was an ask that produced nothing to choose between. */
    const [refined] = await db
      .select({
        count: sql<number>`count(*)`,
        firstAt: sql<Date | null>`min(${castingCandidateVariants.createdAt})`,
        lastAt: sql<Date | null>`max(${castingCandidateVariants.createdAt})`,
      })
      .from(castingCandidateVariants)
      .where(and(
        eq(castingCandidateVariants.candidateId, cast.sourceCandidateId),
        eq(castingCandidateVariants.userId, userId),
        inArray(castingCandidateVariants.status, ["ready", "expired"]),
      ));
    refinements = {
      count: Number(refined?.count ?? 0),
      firstAt: toDate(refined?.firstAt),
      lastAt: toDate(refined?.lastAt),
    };
  }

  return {
    modelId: cast.id,
    kliegId: cast.agencyId,
    createdAt: cast.createdAt,
    mintedAt: cast.mintedAt,
    makerDisplayName: maker?.displayName ?? null,
    anchorStorageKey: anchor,
    rolledAt,
    rollsInSession,
    keptAt,
    refinements,
  };
}

/** An aggregate over a timestamp comes back as a string on this driver. */
function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const text = String(value);
  const parsed = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text.replace(" ", "T")}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The owner's record for one LIVE cast, or null.
 *
 * ⚠ **THE CAST IS JOINED, NOT TRUSTED TO STILL BE THERE** (the relay's finding
 * 1 on PR #2317). A record row on its own proves only that a cast once
 * existed; this reader answers only while that cast is this owner's live,
 * signed cast (`signedCastWhere`, the roster's own predicate). So even a row
 * that somehow outlived its cast is served to nobody — and the re-stamp road,
 * which starts here, cannot reach it either.
 */
export async function getCastCreationRecord(
  userId: number,
  modelId: number,
): Promise<CastCreationRecordRow | null> {
  assertPositiveId(userId, "userId");
  assertPositiveId(modelId, "modelId");
  const db = await requireDb();
  const [row] = await db
    .select(getTableColumns(castCreationRecords))
    .from(castCreationRecords)
    .innerJoin(models, and(eq(models.id, castCreationRecords.modelId), signedCastWhere(userId)))
    .where(and(eq(castCreationRecords.modelId, modelId), eq(castCreationRecords.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Store a signed record — ONLY WHILE ITS CAST IS STILL THIS OWNER'S LIVE,
 * MINTED CAST, decided in the insert itself.
 *
 * ⚠ **AN `INSERT … SELECT` OVER THE ROSTER'S OWN PREDICATE, NOT A PLAIN
 * INSERT** (the relay's finding 1 on PR #2317). The road reads the cast, then
 * reads the picture, signs, and only then stores — seconds later. A cast
 * deleted in that window has already had its records deleted by
 * `finalCastDeletion`, so a plain insert would leave an orphan holding the
 * Klieg ID and the maker's name: exactly what the deletion promised to forget.
 * Here the row is copied out of the live `models` row or not written at all,
 * and InnoDB's locking read of that row serialises it against the deletion's
 * own write to it. `stored: false` covers both a cast that is gone and a
 * second writer that lost the unique `modelId`; the caller tells them apart
 * by reading back through `getCastCreationRecord`, which joins the live cast.
 */
export async function insertCastCreationRecord(input: {
  userId: number;
  modelId: number;
  recordVersion: string;
  recordJson: string;
  recordSha256: string;
  signature: string;
  signingKeyId: string;
}): Promise<{ stored: boolean }> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  const db = await requireDb();
  try {
    const result = await db.insert(castCreationRecords).select(
      db
        .select({
          id: sql<number>`NULL`.as("id"),
          modelId: models.id,
          userId: models.userId,
          recordVersion: sql<string>`${input.recordVersion}`.as("recordVersion"),
          recordJson: sql<string>`${input.recordJson}`.as("recordJson"),
          recordSha256: sql<string>`${input.recordSha256}`.as("recordSha256"),
          signature: sql<string>`${input.signature}`.as("signature"),
          signingKeyId: sql<string>`${input.signingKeyId}`.as("signingKeyId"),
          timestampToken: sql<string | null>`NULL`.as("timestampToken"),
          timestampAuthority: sql<string | null>`NULL`.as("timestampAuthority"),
          stampedAt: sql<Date | null>`NULL`.as("stampedAt"),
          stampAttempts: sql<number>`0`.as("stampAttempts"),
          lastStampAttemptAt: sql<Date | null>`NULL`.as("lastStampAttemptAt"),
          publicAt: sql<Date | null>`NULL`.as("publicAt"),
          createdAt: sql<Date>`CURRENT_TIMESTAMP`.as("createdAt"),
        })
        .from(models)
        .where(and(eq(models.id, input.modelId), signedCastWhere(input.userId), isNotNull(models.mintedAt))),
    );
    return { stored: affectedRows(result) === 1 };
  } catch (error) {
    if (isDuplicateKey(error)) return { stored: false };
    throw error;
  }
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

/**
 * Record one stamping attempt, and the token if it landed. Only ever fills a
 * record that has NO token yet — a stamped record is never re-stamped.
 */
export async function recordCastCreationStamp(input: {
  userId: number;
  recordId: number;
  token: { tokenBase64: string; authority: string; stampedAt: Date } | null;
  now?: Date;
}): Promise<void> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.recordId, "recordId");
  const db = await requireDb();
  const now = input.now ?? new Date();
  await db
    .update(castCreationRecords)
    .set({
      stampAttempts: sql`${castCreationRecords.stampAttempts} + 1`,
      lastStampAttemptAt: now,
      ...(input.token
        ? {
          timestampToken: input.token.tokenBase64,
          timestampAuthority: input.token.authority,
          stampedAt: input.token.stampedAt,
        }
        : {}),
    })
    .where(and(
      eq(castCreationRecords.id, input.recordId),
      eq(castCreationRecords.userId, input.userId),
      isNull(castCreationRecords.timestampToken),
      /* The re-stamp is gated on the live cast too (finding 1): a token is
         never written onto a record whose cast is gone. */
      inArray(
        castCreationRecords.modelId,
        db.select({ id: models.id }).from(models).where(signedCastWhere(input.userId)),
      ),
    ));
}

/**
 * The record dies with its cast — called from inside the final-deletion
 * transaction, owner and cast in the one `WHERE`.
 */
export async function deleteCastCreationRecordsIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number },
): Promise<number> {
  const result = await tx
    .delete(castCreationRecords)
    .where(and(
      eq(castCreationRecords.modelId, input.modelId),
      eq(castCreationRecords.userId, input.userId),
    ));
  return (result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0;
}
