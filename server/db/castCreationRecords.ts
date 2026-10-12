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
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";

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
  makerDisplayName: string | null;
  makerName: string | null;
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
    .select({ displayName: users.displayName, name: users.name })
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
    makerName: maker?.name ?? null,
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

/** The owner's record for one cast, or null. */
export async function getCastCreationRecord(
  userId: number,
  modelId: number,
): Promise<CastCreationRecordRow | null> {
  assertPositiveId(userId, "userId");
  assertPositiveId(modelId, "modelId");
  const db = await requireDb();
  const [row] = await db
    .select()
    .from(castCreationRecords)
    .where(and(eq(castCreationRecords.modelId, modelId), eq(castCreationRecords.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Store a signed record. A second writer for the same cast loses on the
 * unique `modelId` and is told so (`stored: false`) rather than overwriting —
 * the first record of a cast is the record.
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
    await db.insert(castCreationRecords).values({
      modelId: input.modelId,
      userId: input.userId,
      recordVersion: input.recordVersion,
      recordJson: input.recordJson,
      recordSha256: input.recordSha256,
      signature: input.signature,
      signingKeyId: input.signingKeyId,
    });
    return { stored: true };
  } catch (error) {
    if (isDuplicateKey(error)) return { stored: false };
    throw error;
  }
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
