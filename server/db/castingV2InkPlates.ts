/**
 * THE PLATE STORE'S STATEMENTS (migration 0037, ruled fable-959 §3).
 *
 * One row is a design re-drawn onto a blank ghost mannequin by a named engine.
 * The DECISIONS — when a mint may refuse, what the engine is told, which blank
 * form a placement stands on — live in `castingV2/inkPlateDoor.ts` and
 * `castingV2/inkTemplates.ts`, where each can be driven without a database.
 *
 * # The three rules it inherits from its sibling, and one it adds
 *
 * 1. **The owner is in the statement that writes** (invariant 1). The design is
 *    proved through its own candidate, both sides carrying the account, in the
 *    same transaction as the insert — and the row's `designId` is taken from the
 *    row just proved rather than from anything a caller passed.
 * 2. **The design row is LOCKED while the plate is written**, so two mints of
 *    one design queue behind each other rather than both reading "no plate yet".
 *    The unique key on `(designId, engine)` is the backstop underneath that, and
 *    it is a backstop rather than the mechanism: a duplicate-key error arriving
 *    at a customer is a worse sentence than a door's own refusal.
 * 3. **The manifest is discharged in the transaction that files the row.** The
 *    plate's bytes are written to a permanently public key BEFORE this runs, so
 *    they are registered for cleanup first and released here — a crash in
 *    between collects itself.
 * 4. **THE ONE THIS TABLE ADDS: a plate is never filed against a design this
 *    account does not own, even though the plate's own `userId` would say it
 *    did.** A denormalized owner is a claim until the parent agrees with it,
 *    which is why the statement below joins all the way up to the candidate.
 *
 * # Retention is not in this file's gift
 *
 * The purge helpers take a transaction handle and run inside the candidate
 * sweep's own transaction. A plate's lifetime is its design's, which is its
 * Cast's, unconditionally — the studio flag governs whether a row is WRITTEN and
 * nothing governs whether it is purged. They reach these rows THROUGH the design
 * rather than through a mirrored `candidateId` column (working law 4), which is
 * also what fixes the delete order: plates first, then the designs they hang off.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  castingCandidates,
  castingInkDesigns,
  castingInkPlates,
  storageCleanupBatches,
  storageCleanupItems,
} from "../../drizzle/schema";
import type { InkTemplateKind } from "../../shared/inkTemplateKinds";
import type { InkPlacement } from "../../shared/inkPlacementVocabulary";
import type { InkSide } from "../../shared/inkReleasedPlacements";
import { getDb, withTransaction, type TransactionHandle } from "./connection";
import { undischargedStorageCleanupBatchWhere } from "./storageCleanup";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return (header as { affectedRows?: number })?.affectedRows ?? 0;
}

/** The design is not this account's — said the same way a missing one is. */
export class InkPlateOwnershipError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "InkPlateOwnershipError";
  }
}

/**
 * This design already has a plate on this engine.
 *
 * Not a failure: `inkPlateAlreadyMintedRefusal` is the whole cost argument of
 * minting once and reusing forever, and this is that door arriving from
 * underneath when two mints race.
 */
export class InkPlateAlreadyMintedError extends Error {
  constructor() {
    super("that design is already plated on this engine");
    this.name = "InkPlateAlreadyMintedError";
  }
}

export type InkPlateToRecord = {
  userId: number;
  /** The seed, named the way a customer's client names it. */
  designPublicId: string;
  /** The model as the provider names it — the court's axis, never derived. */
  engine: string;
  templateKind: InkTemplateKind;
  /** The digest the mint READ off disk, never the one it expected. */
  templateDigest: string;
  /**
   * sha256 of the exact prompt that was SENT — the other half of the input.
   *
   * `templateDigest` pins the sheet; this pins the words, and the words moved
   * once already (the one-view sentence against a turnaround sheet, 2026-08-18)
   * leaving two plates indistinguishable in this table.
   */
  promptDigest: string;
  /** Our object, under the candidate's purge path. Never a pointer. */
  storageKey: string;
  /** sha256 of the plate's bytes — byte identity, as the library does it. */
  digest: string;
  mime: string;
  byteSize: number;
  width: number;
  height: number;
  /**
   * The manifest holding the bytes while this row is written.
   *
   * Optional in the type only so a caller with nothing to discharge cannot be
   * forced to invent one; on this road there are always bytes.
   */
  cleanupBatchId?: string;
};

export type RecordedInkPlate = {
  publicId: string;
  designPublicId: string;
  engine: string;
  templateKind: InkTemplateKind;
  templateDigest: string;
  /** NULL on the rows minted before this column existed — they refuse rather
   *  than approximate, exactly as `stepDeltas` does on the variants table. */
  promptDigest: string | null;
  storageKey: string;
  digest: string;
  mime: string;
  byteSize: number;
  width: number;
  height: number;
  createdAt: Date;
};

export async function recordInkPlate(input: InkPlateToRecord): Promise<RecordedInkPlate> {
  if (!Number.isInteger(input.userId) || input.userId <= 0) {
    throw new Error("userId must be a positive integer");
  }
  const publicId = randomUUID();
  const now = new Date();

  return withTransaction(async (tx) => {
    /*
      The seed, proved through its own parent and LOCKED. Both sides of the join
      carry the account: the design's `userId` is denormalized, and a
      denormalized column is a claim until the parent agrees with it.
    */
    const [design] = await tx
      .select({ id: castingInkDesigns.id })
      .from(castingInkDesigns)
      .innerJoin(castingCandidates, eq(castingCandidates.id, castingInkDesigns.candidateId))
      .where(and(
        eq(castingInkDesigns.publicId, input.designPublicId),
        eq(castingInkDesigns.userId, input.userId),
        eq(castingCandidates.userId, input.userId),
      ))
      .limit(1)
      .for("update");
    if (!design) throw new InkPlateOwnershipError("design");

    const [existing] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(castingInkPlates)
      .where(and(
        eq(castingInkPlates.designId, design.id),
        eq(castingInkPlates.engine, input.engine),
      ));
    if (Number(existing?.count ?? 0) > 0) throw new InkPlateAlreadyMintedError();

    await tx.insert(castingInkPlates).values({
      publicId,
      userId: input.userId,
      /* From the row just proved, never from a number a caller supplied. */
      designId: design.id,
      engine: input.engine,
      templateKind: input.templateKind,
      templateDigest: input.templateDigest,
      promptDigest: input.promptDigest,
      storageKey: input.storageKey,
      digest: input.digest,
      mime: input.mime,
      byteSize: input.byteSize,
      width: input.width,
      height: input.height,
      createdAt: now,
    });

    if (input.cleanupBatchId) {
      /*
        The bytes are now referenced by a row, so the manifest holding them must
        go — in this same transaction, or the worker deletes a plate a render is
        about to be handed. Asserted rather than assumed: a manifest that does
        not delete means something else already claimed it, and committing on top
        of that files a row whose bytes are already scheduled to die.
      */
      await tx.delete(storageCleanupItems)
        .where(eq(storageCleanupItems.batchId, input.cleanupBatchId));
      const removed = await tx.delete(storageCleanupBatches).where(and(
        eq(storageCleanupBatches.id, input.cleanupBatchId),
        eq(storageCleanupBatches.userId, input.userId),
        undischargedStorageCleanupBatchWhere(),
      ));
      if (affectedRows(removed) !== 1) throw new InkPlateOwnershipError("plate");
    }

    return {
      publicId,
      designPublicId: input.designPublicId,
      engine: input.engine,
      templateKind: input.templateKind,
      templateDigest: input.templateDigest,
      promptDigest: input.promptDigest,
      storageKey: input.storageKey,
      digest: input.digest,
      mime: input.mime,
      byteSize: input.byteSize,
      width: input.width,
      height: input.height,
      createdAt: now,
    };
  });
}

/**
 * Every plate this design has, oldest first — owner-scoped in the read itself,
 * and an explicit projection (invariant 8) so no internal id crosses out.
 *
 * Plural because the court's whole question is a comparison: one design, both
 * engines, two rows. The mint's own "is it already plated" is this list filtered
 * by engine rather than a second statement that could disagree with it.
 */
export async function listInkPlatesForDesign(input: {
  userId: number;
  designPublicId: string;
}): Promise<readonly RecordedInkPlate[]> {
  const db = await requireDb();
  const rows = await db
    .select({
      publicId: castingInkPlates.publicId,
      engine: castingInkPlates.engine,
      templateKind: castingInkPlates.templateKind,
      templateDigest: castingInkPlates.templateDigest,
      promptDigest: castingInkPlates.promptDigest,
      storageKey: castingInkPlates.storageKey,
      digest: castingInkPlates.digest,
      mime: castingInkPlates.mime,
      byteSize: castingInkPlates.byteSize,
      width: castingInkPlates.width,
      height: castingInkPlates.height,
      createdAt: castingInkPlates.createdAt,
    })
    .from(castingInkPlates)
    .innerJoin(castingInkDesigns, eq(castingInkDesigns.id, castingInkPlates.designId))
    .innerJoin(castingCandidates, eq(castingCandidates.id, castingInkDesigns.candidateId))
    .where(and(
      eq(castingInkDesigns.publicId, input.designPublicId),
      /* Every link in the chain carries the owner — the plate's own column is a
         claim, the design's is a claim, and the candidate is where they stop
         being claims. */
      eq(castingInkPlates.userId, input.userId),
      eq(castingInkDesigns.userId, input.userId),
      eq(castingCandidates.userId, input.userId),
    ))
    .orderBy(castingInkPlates.id);
  return rows.map((row) => ({
    ...row,
    designPublicId: input.designPublicId,
    createdAt: new Date(row.createdAt),
  }));
}

/**
 * EVERY PLATED TATTOO THIS CANDIDATE WEARS — what a Sign carries into its views
 * (FOUNDER RULING, his words at fable-987 §3).
 *
 * Through the DESIGN rather than a mirrored candidate column on the plate, for
 * the reason the purge reader gives one section down (working law 4): the plate
 * hangs off the design and the design hangs off the candidate, and a second
 * parent id on the plate row would be a copy that can disagree with its source.
 *
 * Owner-scoped at every link, exactly as `listInkPlatesForDesign` is: the
 * plate's `userId` is a claim, the design's is a claim, and the candidate is
 * where they stop being claims.
 *
 * It returns the DESIGN's placement and side beside the plate, because the
 * sentence that rides with the picture names the surface, and reading it from
 * the design's own row is what stops a caller supplying one.
 */
export type CandidateInkPlate = {
  readonly designPublicId: string;
  readonly placement: InkPlacement;
  readonly side: InkSide;
  /**
   * NULL when the design has no plate at all — the row is the DESIGN's and the
   * plate half is absent.
   *
   * A LEFT JOIN rather than two statements, and the difference is the whole
   * point: a caller that read plates alone cannot see the design that has none,
   * and "this design did not ride" is exactly the fact that has to be sayable
   * (fable-1005 §2). Two reads would also be two moments, and a design uploaded
   * between them would appear in one and not the other.
   */
  readonly engine: string | null;
  readonly storageKey: string | null;
  readonly digest: string | null;
  readonly mime: string | null;
};

export async function listCandidateInkPlates(input: {
  userId: number;
  candidateId: number;
}): Promise<readonly CandidateInkPlate[]> {
  const db = await requireDb();
  const rows = await db
    .select({
      designPublicId: castingInkDesigns.publicId,
      placement: castingInkDesigns.placement,
      side: castingInkDesigns.side,
      engine: castingInkPlates.engine,
      storageKey: castingInkPlates.storageKey,
      digest: castingInkPlates.digest,
      mime: castingInkPlates.mime,
    })
    .from(castingInkDesigns)
    .innerJoin(castingCandidates, eq(castingCandidates.id, castingInkDesigns.candidateId))
    /* LEFT, so a design with no plate still arrives — see the type's own note.
       The owner is carried on the JOIN rather than in the WHERE, because a
       plate belonging to somebody else must not silence this design; it must
       fail to join at all. */
    .leftJoin(castingInkPlates, and(
      eq(castingInkPlates.designId, castingInkDesigns.id),
      eq(castingInkPlates.userId, input.userId),
    ))
    .where(and(
      eq(castingInkDesigns.candidateId, input.candidateId),
      eq(castingInkDesigns.userId, input.userId),
      eq(castingCandidates.userId, input.userId),
    ))
    /* Stable order, so the reference array a package sends and the sentence that
       quotes its ordinals are built from the same list twice running. */
    .orderBy(castingInkDesigns.id, castingInkPlates.id);
  return rows;
}

/* ------------------------------------------------------------ retention */

/**
 * Every plate object belonging to these candidates — read INSIDE the sweep's
 * transaction, through the DESIGN rather than through a mirrored parent id, so
 * a plate minted between the read and the delete cannot slip through and outlive
 * the Cast it was drawn for.
 */
export async function listPurgeableInkPlatesIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<Array<{ id: number; storageKey: string }>> {
  if (candidateIds.length === 0) return [];
  const rows = await tx
    .select({ id: castingInkPlates.id, storageKey: castingInkPlates.storageKey })
    .from(castingInkPlates)
    .innerJoin(castingInkDesigns, eq(castingInkDesigns.id, castingInkPlates.designId))
    .where(inArray(castingInkDesigns.candidateId, [...candidateIds]));
  return rows;
}

/**
 * Delete the plate rows for these candidates.
 *
 * **This runs BEFORE the designs are deleted, and it has to.** The join above is
 * the only path from a candidate to its plates; once the design rows are gone a
 * plate row is an orphan nothing can find, and its bytes are litter at a
 * permanently public URL. The order is asserted in the sweep's own suite rather
 * than left to whoever edits the sweep next.
 */
export async function deleteInkPlateRowsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<number> {
  if (candidateIds.length === 0) return 0;
  const doomed = await listPurgeableInkPlatesIn(tx, candidateIds);
  if (doomed.length === 0) return 0;
  const result = await tx
    .delete(castingInkPlates)
    .where(inArray(castingInkPlates.id, doomed.map((plate) => plate.id)));
  return affectedRows(result);
}
