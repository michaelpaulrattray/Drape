/**
 * THE DELIVERED-TATTOO STORE'S DATABASE HALF — migration 0049, countersigned
 * fable-1194 §2.
 *
 * One row is the frame that FIRST delivered a design onto a Cast, cut down to
 * the tattoo as it sits on her, and where OUR copy of that cut lives. It is
 * what the carry lane sends instead of the customer's artwork, and the whole
 * reason is in the migration's own header: the artwork has no size in it and
 * the master has no tattoo on it, so a carry told to keep "the same size" had
 * nothing to measure and put the design on his shirt three times out of three.
 *
 * # Three rules, and two of them are somebody's scar
 *
 * 1. **The owner is in the statement that writes** (invariant 1). The
 *    candidate, the design and the variant are all re-proved against
 *    `userId` inside the transaction that inserts, and every id written into
 *    the row is taken from a row just proved rather than from a number a
 *    caller passed.
 * 2. **MINTED ONCE is the database's rule, not this file's.** There is no
 *    read-then-insert here and deliberately no update: the insert runs and a
 *    duplicate on `uq_casting_ink_delivery_crops_design` comes back as
 *    `already`, which is a fact rather than an error. A check-then-write would
 *    be the race invariant 1 exists about, and a rule enforced by a writer is
 *    a rule the next writer does not inherit.
 * 3. **The manifest is discharged in the transaction that files the row.** The
 *    bytes go to a permanently public key BEFORE this runs, registered for
 *    cleanup first and released here — a crash in between collects itself. The
 *    ink design store's own rule, for the same reason: on this road the litter
 *    would be a picture of a real person's neck.
 *
 * # Retention is not in this file's gift
 *
 * The purge helpers at the bottom take a transaction handle because they run
 * inside the candidate sweep's own transaction. A delivered crop's lifetime is
 * its Cast's, unconditionally — no flag governs whether it is purged, and the
 * sweep clause lands in the same commit as the writer rather than after it.
 */
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  castingCandidateVariants,
  castingCandidates,
  castingInkDeliveryCrops,
  castingInkDesigns,
  storageCleanupBatches,
  storageCleanupItems,
} from "../../drizzle/schema";
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

/**
 * IS THIS THE UNIQUE INDEX SAYING NO? — asked of the WHOLE CHAIN.
 *
 * Read off the driver's own code rather than off the message text, which is
 * localized and versioned. Anything else is re-thrown: a mint that swallowed a
 * connection error as "already minted" would report a crop that does not exist,
 * and the carry would fall back to the artwork with nothing in the log to say
 * why.
 *
 * ⚠ **THE CHAIN WALK IS THE WHOLE OF IT, and this file shipped without it.**
 * Drizzle wraps the driver's error in a `DrizzleQueryError` and hangs the
 * original off `cause`, so a top-level `error.code` read never matches and the
 * duplicate escapes as a throw — the mint then reports `failed` over a
 * perfectly working index. Driven live on the second delivery of one design
 * (variant `486` after `492`): expected `already`, got `failed / threw`.
 *
 * EXPORTED so both shapes can be driven without a database — the arm that was
 * missing is the arm that would have caught it, and one that can only run
 * through a live insert is one nobody runs.
 *
 * It is the SAME MISTAKE `candidateRetention.isMissingTable` made and wrote
 * down — *"the first version read `error.code` off the top-level error, which
 * is the shape a hand-written test error has and NOT the shape the real path
 * produces"* — and the reason it repeated is that the arm was written with an
 * invented error, so the invention was what got tested. Both shapes are
 * asserted now.
 */
export function isDuplicateKey(error: unknown): boolean {
  for (let link: unknown = error, depth = 0; link && depth < 5; depth += 1) {
    const { code, errno, cause } = link as { code?: string; errno?: number; cause?: unknown };
    if (code === "ER_DUP_ENTRY" || errno === 1062) return true;
    link = cause;
  }
  return false;
}

/** The Cast, the design or the frame is not this account's. */
export class InkDeliveryCropOwnershipError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "InkDeliveryCropOwnershipError";
  }
}

export type InkDeliveryCropToRecord = {
  userId: number;
  candidatePublicId: string;
  /** The design that was delivered, by the name the chain carries. */
  designPublicId: string;
  /** The frame it was cut from, by the name the ledger carries. */
  variantPublicId: string;
  slot: string;
  /** The segmentation question that drew the cut. */
  region: string;
  storageKey: string;
  digest: string;
  mime: string;
  byteSize: number;
  width: number;
  height: number;
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
  frameWidth: number;
  frameHeight: number;
  maskPixels: number;
  keptPixels: number;
  /** The manifest holding these bytes until a row points at them. */
  cleanupBatchId?: string;
};

export type InkDeliveryCropRecorded =
  /** Written. The bytes are now a row's and the manifest is discharged. */
  | { outcome: "minted"; publicId: string }
  /**
   * The unique index refused it: this design already has its delivery crop on
   * this Cast, and MINTED ONCE means the first one stands.
   *
   * **The manifest is NOT discharged in this case**, and that is the design:
   * nothing points at the bytes just written, so they must remain the cleanup
   * worker's — discharging would strand a picture of a person at a public key
   * with no row naming it.
   */
  | { outcome: "already" };

/**
 * Keep the crop this render's delivery earned.
 *
 * Never called on a carry render — the caller decides that, and the reason is
 * fable-1193 §3b's chained-anchor trap — but the index means a caller that got
 * it wrong writes nothing rather than a copy of a copy.
 */
export async function recordInkDeliveryCrop(
  input: InkDeliveryCropToRecord,
): Promise<InkDeliveryCropRecorded> {
  if (!Number.isInteger(input.userId) || input.userId <= 0) {
    throw new Error("userId must be a positive integer");
  }
  const publicId = randomUUID();

  return withTransaction(async (tx) => {
    const [candidate] = await tx
      .select({ id: castingCandidates.id })
      .from(castingCandidates)
      .where(and(
        eq(castingCandidates.publicId, input.candidatePublicId),
        eq(castingCandidates.userId, input.userId),
      ))
      .limit(1);
    if (!candidate) throw new InkDeliveryCropOwnershipError("candidate");

    /* The design is re-proved on BOTH sides of its own join — this account AND
       this Cast — so a design id from another of her Casts cannot file a
       delivery against this one. */
    const [design] = await tx
      .select({ id: castingInkDesigns.id })
      .from(castingInkDesigns)
      .where(and(
        eq(castingInkDesigns.publicId, input.designPublicId),
        eq(castingInkDesigns.userId, input.userId),
        eq(castingInkDesigns.candidateId, candidate.id),
      ))
      .limit(1);
    if (!design) throw new InkDeliveryCropOwnershipError("design");

    /* And the frame, scoped through the candidate it belongs to: a crop
       claiming to come from somebody else's render would be geometry about a
       picture this Cast has never seen. */
    const [variant] = await tx
      .select({ id: castingCandidateVariants.id })
      .from(castingCandidateVariants)
      .where(and(
        eq(castingCandidateVariants.publicId, input.variantPublicId),
        eq(castingCandidateVariants.candidateId, candidate.id),
      ))
      .limit(1);
    if (!variant) throw new InkDeliveryCropOwnershipError("variant");

    try {
      await tx.insert(castingInkDeliveryCrops).values({
        publicId,
        userId: input.userId,
        candidateId: candidate.id,
        designId: design.id,
        variantId: variant.id,
        slot: input.slot,
        region: input.region,
        storageKey: input.storageKey,
        digest: input.digest,
        mime: input.mime,
        byteSize: input.byteSize,
        width: input.width,
        height: input.height,
        bboxX: input.bboxX,
        bboxY: input.bboxY,
        bboxW: input.bboxW,
        bboxH: input.bboxH,
        frameWidth: input.frameWidth,
        frameHeight: input.frameHeight,
        maskPixels: input.maskPixels,
        keptPixels: input.keptPixels,
      });
    } catch (error) {
      if (isDuplicateKey(error)) return { outcome: "already" } as const;
      throw error;
    }

    if (input.cleanupBatchId) {
      await tx.delete(storageCleanupItems)
        .where(eq(storageCleanupItems.batchId, input.cleanupBatchId));
      const removed = await tx.delete(storageCleanupBatches).where(and(
        eq(storageCleanupBatches.id, input.cleanupBatchId),
        eq(storageCleanupBatches.userId, input.userId),
        undischargedStorageCleanupBatchWhere(),
      ));
      if (affectedRows(removed) !== 1) throw new InkDeliveryCropOwnershipError("crop");
    }

    return { outcome: "minted", publicId } as const;
  });
}

export type StoredInkDeliveryCrop = {
  /** The design this crop is OF, by the name the chain's `inkApplied` carries. */
  designPublicId: string;
  slot: string;
  storageKey: string;
  digest: string;
  width: number;
  height: number;
};

/**
 * Every delivered-tattoo crop on this Cast — owner-scoped in the read itself,
 * and joined to the design so the caller can match on the name the chain holds
 * rather than on an internal id it has no business seeing.
 *
 * An explicit projection (invariant 8): the geometry stays in the row. It is
 * evidence for somebody re-reading a delivery, and the carry needs the key and
 * the digest and nothing else.
 */
export async function listInkDeliveryCrops(input: {
  userId: number;
  candidatePublicId: string;
}): Promise<readonly StoredInkDeliveryCrop[]> {
  const db = await requireDb();
  return db
    .select({
      designPublicId: castingInkDesigns.publicId,
      slot: castingInkDeliveryCrops.slot,
      storageKey: castingInkDeliveryCrops.storageKey,
      digest: castingInkDeliveryCrops.digest,
      width: castingInkDeliveryCrops.width,
      height: castingInkDeliveryCrops.height,
    })
    .from(castingInkDeliveryCrops)
    .innerJoin(castingCandidates, eq(castingCandidates.id, castingInkDeliveryCrops.candidateId))
    /* The design is joined ON THE CANDIDATE as well as on the id, so the row's
       own two keys have to agree before a crop can be named — the ink-design
       route's both-sides rule, one store along. */
    .innerJoin(castingInkDesigns, and(
      eq(castingInkDesigns.id, castingInkDeliveryCrops.designId),
      eq(castingInkDesigns.candidateId, castingInkDeliveryCrops.candidateId),
    ))
    .where(and(
      eq(castingCandidates.publicId, input.candidatePublicId),
      eq(castingCandidates.userId, input.userId),
      eq(castingInkDeliveryCrops.userId, input.userId),
    ));
}

/**
 * Every crop object belonging to these candidates — read INSIDE the sweep's
 * transaction, so a crop minted between the read and the delete cannot slip
 * through and outlive the Cast it was cut for.
 */
export async function listPurgeableInkDeliveryCropsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<Array<{ id: number; storageKey: string }>> {
  if (candidateIds.length === 0) return [];
  return tx
    .select({ id: castingInkDeliveryCrops.id, storageKey: castingInkDeliveryCrops.storageKey })
    .from(castingInkDeliveryCrops)
    .where(inArray(castingInkDeliveryCrops.candidateId, [...candidateIds]));
}

export async function deleteInkDeliveryCropRowsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<number> {
  if (candidateIds.length === 0) return 0;
  const result = await tx
    .delete(castingInkDeliveryCrops)
    .where(inArray(castingInkDeliveryCrops.candidateId, [...candidateIds]));
  return affectedRows(result);
}
