/**
 * The variant table's database layer — refinements of a candidate (M8, §11/§14).
 *
 * # One rule governs this whole file
 *
 * **A variant is addressable only THROUGH its owned parent candidate.** There
 * is deliberately no `getVariant(publicId)` here, and adding one would be the
 * defect this shape exists to prevent: a variant is a child of a child
 * (user → session → roll → candidate → variant), and the way that goes wrong is
 * proving the candidate and then trusting a `variantId` supplied alongside it.
 * Every statement below re-anchors the variant to the candidate AND to the
 * user, in the statement that does the work rather than in a check before it
 * (invariants 1 and 2).
 *
 * # And one that governs the writes
 *
 * **Selection is a pointer, never a flag.** MySQL has no partial unique index,
 * so "exactly one variant selected" enforced by a boolean on the variant rows
 * is two UPDATEs racing toward a state where zero or two are selected. The
 * pointer lives on the candidate and holds one value by construction.
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";

import {
  castingCandidates,
  castingCandidateVariants,
  type CastingCandidateVariant,
} from "../../drizzle/schema";
import { getDb, withTransaction, type TransactionHandle } from "./connection";

function assertPositiveId(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return (header as { affectedRows?: number })?.affectedRows ?? 0;
}

export class VariantOwnershipError extends Error {
  constructor(readonly subject: "candidate" | "variant") {
    super(`${subject} not available`);
    this.name = "VariantOwnershipError";
  }
}

/* ------------------------------------------------------------- creating */

export type ClaimVariantInput = {
  userId: number;
  candidatePublicId: string;
  operationId: string;
  pointsCost: number;
  /** The user's own sentences, oldest first — provenance, and the only
      refinement text a projection may return. */
  instructions: string[];
  /** The composed absolute deltas. INTERNAL. */
  deltas: unknown;
  now?: Date;
};

export type ClaimedVariant = {
  id: number;
  publicId: string;
  candidateId: number;
  sessionId: number;
  /** The face this refinement was rendered FROM — always the ORIGINAL. */
  baseImageKey: string;
  baseInternalPrompt: unknown;
};

/**
 * Claim a variant row before the money moves, re-proving the parent.
 *
 * The base is the CANDIDATE's own image and record, never the currently
 * selected variant's, and that is §13's base-anchoring law in the one statement
 * where it could quietly be broken: every variant is `edit(original,
 * instructions 1..N)`, never an edit of an edit. There is therefore no chain
 * for error to compound along, and the tenth refinement is exactly as close to
 * the face the user picked as the first.
 */
export async function claimVariant(input: ClaimVariantInput): Promise<ClaimedVariant> {
  assertPositiveId(input.userId, "userId");
  return withTransaction(async (tx) => {
    const [candidate] = await tx
      .select({
        id: castingCandidates.id,
        sessionId: castingCandidates.sessionId,
        imageKey: castingCandidates.imageKey,
        internalPrompt: castingCandidates.internalPrompt,
      })
      .from(castingCandidates)
      .where(and(
        eq(castingCandidates.publicId, input.candidatePublicId),
        eq(castingCandidates.userId, input.userId),
        eq(castingCandidates.status, "ready"),
      ))
      .limit(1);
    if (!candidate) throw new VariantOwnershipError("candidate");
    if (!candidate.imageKey) throw new VariantOwnershipError("candidate");

    const publicId = randomUUID();
    const [inserted] = await tx
      .insert(castingCandidateVariants)
      .values({
        publicId,
        // Re-anchored ids, taken from the row just proved — never from input.
        candidateId: candidate.id,
        sessionId: candidate.sessionId,
        userId: input.userId,
        status: "queued",
        instructions: input.instructions,
        deltas: input.deltas,
        pointsCost: input.pointsCost,
        operationId: input.operationId,
        createdAt: input.now ?? new Date(),
      })
      .$returningId();
    if (!inserted?.id) throw new VariantOwnershipError("variant");

    return {
      id: inserted.id,
      publicId,
      candidateId: candidate.id,
      sessionId: candidate.sessionId,
      baseImageKey: candidate.imageKey,
      baseInternalPrompt: candidate.internalPrompt,
    };
  });
}

/* -------------------------------------------------------------- landing */

export async function markVariantDispatched(input: {
  userId: number;
  variantId: number;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  const db = await requireDb();
  const result = await db
    .update(castingCandidateVariants)
    .set({ status: "dispatched" })
    .where(and(
      eq(castingCandidateVariants.id, input.variantId),
      eq(castingCandidateVariants.userId, input.userId),
      eq(castingCandidateVariants.status, "queued"),
    ));
  return affectedRows(result) === 1;
}

/**
 * The variant landed — and it becomes the selected face in the same breath.
 *
 * One transaction on purpose. A landed refinement the user cannot see, because
 * the pointer move failed separately, is a paid picture that does not exist as
 * far as the product is concerned. Selecting it is what "the refinement
 * happened" MEANS.
 */
export async function landVariant(input: {
  userId: number;
  variantId: number;
  imageKey: string;
  internalPrompt: unknown;
  provider: string | null;
  providerModel: string | null;
  providerRef: string | null;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  return withTransaction(async (tx) => {
    const landed = await tx
      .update(castingCandidateVariants)
      .set({
        status: "ready",
        imageKey: input.imageKey,
        internalPrompt: input.internalPrompt,
        provider: input.provider,
        providerModel: input.providerModel,
        providerRef: input.providerRef,
      })
      .where(and(
        eq(castingCandidateVariants.id, input.variantId),
        eq(castingCandidateVariants.userId, input.userId),
        inArray(castingCandidateVariants.status, ["queued", "dispatched"]),
      ));
    if (affectedRows(landed) !== 1) return false;

    /*
      The pointer moves through the variant's OWN parent link, read inside this
      statement — so the candidate it selects on is provably the candidate this
      variant belongs to, and a caller cannot aim a landing at someone else's
      face by supplying a candidate id.
    */
    const selected = await tx
      .update(castingCandidates)
      .set({
        selectedVariantId: sql`(
          SELECT v.id FROM casting_candidate_variants v
          WHERE v.id = ${input.variantId}
            AND v.userId = ${input.userId}
            AND v.candidateId = ${castingCandidates.id}
        )`,
      })
      .where(and(
        eq(castingCandidates.userId, input.userId),
        eq(castingCandidates.status, "ready"),
        sql`${castingCandidates.id} = (
          SELECT v.candidateId FROM casting_candidate_variants v
          WHERE v.id = ${input.variantId} AND v.userId = ${input.userId}
        )`,
      ));
    return affectedRows(selected) === 1;
  });
}

export async function failVariant(input: {
  userId: number;
  variantId: number;
  failureClass: string;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  const db = await requireDb();
  const result = await db
    .update(castingCandidateVariants)
    .set({ status: "failed", failureClass: input.failureClass })
    .where(and(
      eq(castingCandidateVariants.id, input.variantId),
      eq(castingCandidateVariants.userId, input.userId),
      inArray(castingCandidateVariants.status, ["queued", "dispatched"]),
    ));
  return affectedRows(result) === 1;
}

/* ------------------------------------------------------------- selecting */

/**
 * Point the candidate at one of ITS OWN ready variants, or back at the original.
 *
 * `variantPublicId: null` means the original, which is the free "back up the
 * stack" move D-121 distinguishes from a paid re-render.
 *
 * ONE statement, and the join is the ownership proof: the subquery re-anchors
 * the variant to this user and to the candidate being updated, so a variant
 * public id belonging to another account resolves to nothing and the update
 * affects zero rows — a refusal, never a cross-account selection.
 */
export async function selectVariant(input: {
  userId: number;
  candidatePublicId: string;
  variantPublicId: string | null;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  const db = await requireDb();
  const result = await db
    .update(castingCandidates)
    .set({
      selectedVariantId: input.variantPublicId === null
        ? null
        : sql`(
          SELECT v.id FROM casting_candidate_variants v
          WHERE v.publicId = ${input.variantPublicId}
            AND v.userId = ${input.userId}
            AND v.candidateId = ${castingCandidates.id}
            AND v.status = 'ready'
        )`,
    })
    .where(and(
      eq(castingCandidates.publicId, input.candidatePublicId),
      eq(castingCandidates.userId, input.userId),
      eq(castingCandidates.status, "ready"),
      /*
        Refuse rather than silently deselect. Without this, a bad or foreign
        variant id would make the subquery NULL and quietly reset the candidate
        to its original — an unrelated destructive act dressed as a no-op.
      */
      input.variantPublicId === null
        ? sql`1 = 1`
        : sql`EXISTS (
          SELECT 1 FROM casting_candidate_variants v
          WHERE v.publicId = ${input.variantPublicId}
            AND v.userId = ${input.userId}
            AND v.candidateId = ${castingCandidates.id}
            AND v.status = 'ready'
        )`,
    ));
  return affectedRows(result) === 1;
}

/* --------------------------------------------------------------- reading */

/**
 * Every ready refinement of one owned candidate, oldest first.
 *
 * The stack the viewer walks. Owner-scoped and parent-scoped in the same
 * statement; a caller holding only a candidate public id can never widen this
 * to somebody else's refinements.
 */
export async function listCandidateVariants(
  userId: number,
  candidatePublicId: string,
): Promise<CastingCandidateVariant[]> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const rows = await db
    .select({ variant: castingCandidateVariants })
    .from(castingCandidateVariants)
    .innerJoin(castingCandidates, and(
      eq(castingCandidates.id, castingCandidateVariants.candidateId),
      eq(castingCandidates.publicId, candidatePublicId),
      eq(castingCandidates.userId, userId),
    ))
    .where(and(
      eq(castingCandidateVariants.userId, userId),
      eq(castingCandidateVariants.status, "ready"),
    ))
    .orderBy(asc(castingCandidateVariants.id));
  return rows.map((row) => row.variant);
}

/**
 * The variant a given operation created — the recovery adjudicator's fork.
 *
 * `generation_operations` has no payload column, so a crashed refine cannot be
 * traced back through the operation itself. This read is how the sweep finds
 * the row to ask "did it land?", and the unique index on `operationId` is what
 * makes the answer singular.
 */
export async function findVariantByOperation(
  userId: number,
  operationId: string,
): Promise<CastingCandidateVariant | null> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const [variant] = await db
    .select()
    .from(castingCandidateVariants)
    .where(and(
      eq(castingCandidateVariants.operationId, operationId),
      eq(castingCandidateVariants.userId, userId),
    ))
    .limit(1);
  return variant ?? null;
}

/* ------------------------------------------------------------- retention */

/**
 * Variants whose objects the cleanup worker should delete (D-122).
 *
 * Ordinary candidate retention, ruled rather than assumed: Sign copies its own
 * anchor, so a Cast depends on nothing in this table and a signed candidate's
 * unselected variants are ordinary sheet debris. Expiring with the parent is
 * what stops a refinement outliving the sheet it belonged to — §G.6 — and it is
 * the same sweep, not a second retention path to keep in step.
 */
export async function listPurgeableVariantsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<Array<{ id: number; imageKey: string | null; thumbKey: string | null }>> {
  if (candidateIds.length === 0) return [];
  const rows = await tx
    .select({
      id: castingCandidateVariants.id,
      imageKey: castingCandidateVariants.imageKey,
      thumbKey: castingCandidateVariants.thumbKey,
    })
    .from(castingCandidateVariants)
    .where(inArray(castingCandidateVariants.candidateId, [...candidateIds]));
  return rows;
}

export async function deleteVariantRowsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<number> {
  if (candidateIds.length === 0) return 0;
  /*
    The pointer goes first. A candidate row that survives its variants while
    still pointing at one would resolve its face to a deleted row — the join
    returns nothing, so the face silently falls back to the original, which
    LOOKS fine and is a record quietly disagreeing with what was signed.
  */
  await tx
    .update(castingCandidates)
    .set({ selectedVariantId: null })
    .where(inArray(castingCandidates.id, [...candidateIds]));
  const result = await tx
    .delete(castingCandidateVariants)
    .where(inArray(castingCandidateVariants.candidateId, [...candidateIds]));
  return affectedRows(result);
}

/**
 * Variants of candidates that are already gone, plus ones aged past their own
 * expiry — the belt-and-braces sweep for rows an earlier purge missed.
 */
export async function listOrphanedVariants(
  limit: number,
  now: Date = new Date(),
): Promise<Array<{ id: number; imageKey: string | null; thumbKey: string | null }>> {
  const db = await requireDb();
  return db
    .select({
      id: castingCandidateVariants.id,
      imageKey: castingCandidateVariants.imageKey,
      thumbKey: castingCandidateVariants.thumbKey,
    })
    .from(castingCandidateVariants)
    .where(or(
      lt(castingCandidateVariants.expiresAt, now),
      sql`NOT EXISTS (
        SELECT 1 FROM casting_candidates c
        WHERE c.id = ${castingCandidateVariants.candidateId}
      )`,
    ))
    .limit(limit);
}
