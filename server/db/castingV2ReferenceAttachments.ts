/**
 * THE ATTACHED REFERENCE'S DATABASE HALF — migration 0043, design §2,
 * countersigned fable-1063 §1–§2.
 *
 * **The sweep is written first and the writer second, in that order in this
 * file too.** `candidateRetention.ts` is ROW-DRIVEN — it builds its purge list
 * by enumerating rows and collecting their storage keys — so a store whose rows
 * nothing sweeps is a store whose objects nothing deletes. The founder-queue's
 * §1a defect is exactly that shape, and here the objects would be **full
 * photographs of real people**, which is the strongest possible reason not to
 * ship the writer first and mean to come back.
 *
 * # OWNERSHIP IS IN THE STATEMENT, NEVER IN A CHECK BEFORE IT
 *
 * Invariant 1, and fable-1063 §1's rider states it for this door by name: the
 * attachment resolves THROUGH the owning candidate on every read and every
 * write. `recordReferenceAttachment` takes a candidate PUBLIC id and a userId
 * and resolves them in one statement; `readOwnedReferenceAttachment` puts the
 * userId in its own WHERE rather than trusting the resolve that found it. A
 * SELECT to check ownership followed by a write keyed on id alone is a
 * check-then-write race, and it is what went wrong in D-64.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { InkProvenance } from "../../shared/inkProvenance";
import {
  castingCandidates,
  castingInkDesigns,
  castingReferenceAttachments,
} from "../../drizzle/schema";
import { getDb, type TransactionHandle } from "./connection";

/* Local, like every other store in this directory — the mysql2 header shape is
   the driver's, and a shared helper for three lines would be a module whose
   only job is to be imported. */
function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return (header as { affectedRows?: number })?.affectedRows ?? 0;
}

/**
 * Every attached object belonging to these candidates — read INSIDE the sweep's
 * transaction, so a picture attached between the read and the delete cannot
 * slip through and outlive the Cast it was attached to.
 */
export async function listPurgeableReferenceAttachmentsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<Array<{ id: number; storageKey: string }>> {
  if (candidateIds.length === 0) return [];
  return tx
    .select({ id: castingReferenceAttachments.id, storageKey: castingReferenceAttachments.storageKey })
    .from(castingReferenceAttachments)
    .where(inArray(castingReferenceAttachments.candidateId, [...candidateIds]));
}

export async function deleteReferenceAttachmentRowsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<number> {
  if (candidateIds.length === 0) return 0;
  const result = await tx
    .delete(castingReferenceAttachments)
    .where(inArray(castingReferenceAttachments.candidateId, [...candidateIds]));
  return affectedRows(result);
}

/** Somebody else's Cast, or none — answered the way a missing one is. */
export class ReferenceAttachmentOwnershipError extends Error {}

/** This Cast is already holding as many pictures as it may. */
export class ReferenceAttachmentCapError extends Error {}

export type ReferenceAttachmentToRecord = {
  userId: number;
  candidatePublicId: string;
  provenance: InkProvenance;
  storageKey: string;
  digest: string;
  mime: string;
  byteSize: number;
  width: number;
  height: number;
  /**
   * How many pictures one Cast may hold ACROSS BOTH STORES — passed in rather
   * than imported, because the number is the door's decision and this file owns
   * the statement that enforces it.
   */
  cap: number;
};

export type RecordedReferenceAttachment = {
  publicId: string;
  provenance: InkProvenance;
  width: number;
  height: number;
};

/**
 * How many pictures this Cast is holding — **the ink designs and the
 * attachments together**, which is the shared cap's whole point (fable-1063 §2:
 * the ink door's 8, shared, not 8 + 8, so the purge surface stays bounded).
 *
 * Counted in the same transaction as the insert that may exceed it. A count
 * outside the transaction is a number that was true a moment ago.
 */
async function countHeldPictures(
  tx: TransactionHandle,
  candidateId: number,
): Promise<number> {
  const [designs] = await tx
    .select({ n: sql<number>`count(*)` })
    .from(castingInkDesigns)
    .where(eq(castingInkDesigns.candidateId, candidateId));
  const [attachments] = await tx
    .select({ n: sql<number>`count(*)` })
    .from(castingReferenceAttachments)
    .where(eq(castingReferenceAttachments.candidateId, candidateId));
  return Number(designs?.n ?? 0) + Number(attachments?.n ?? 0);
}

/**
 * File one attached picture against a Cast this account owns.
 *
 * The ownership resolve and the cap count and the insert are ONE transaction.
 * Two accounts attaching to one Cast at the same instant is not a case anybody
 * will hit, and the cap is not the reason for the transaction — the reason is
 * that a cap read outside it is a check-then-write, which is the shape this
 * repository writes down as invariant 1.
 */
export async function recordReferenceAttachment(
  input: ReferenceAttachmentToRecord,
): Promise<RecordedReferenceAttachment> {
  const db = await getDb();
  if (!db) throw new Error("no database");
  return db.transaction(async (tx) => {
    /* THE CANDIDATE, SCOPED TO THE OWNER IN THE STATEMENT — not a select
       followed by a comparison in JavaScript. */
    const [candidate] = await tx
      .select({ id: castingCandidates.id })
      .from(castingCandidates)
      .where(and(
        eq(castingCandidates.publicId, input.candidatePublicId),
        eq(castingCandidates.userId, input.userId),
      ))
      .limit(1);
    if (!candidate) throw new ReferenceAttachmentOwnershipError("no such candidate for this account");

    if (await countHeldPictures(tx, candidate.id) >= input.cap) {
      throw new ReferenceAttachmentCapError("this cast is holding as many pictures as it may");
    }

    const publicId = randomUUID();
    await tx.insert(castingReferenceAttachments).values({
      publicId,
      userId: input.userId,
      candidateId: candidate.id,
      provenance: input.provenance,
      storageKey: input.storageKey,
      digest: input.digest,
      mime: input.mime,
      byteSize: input.byteSize,
      width: input.width,
      height: input.height,
    });
    return {
      publicId,
      provenance: input.provenance,
      width: input.width,
      height: input.height,
    };
  });
}

/**
 * One attachment, by its handle, for THIS account.
 *
 * The refine that spends will hand back a `referenceId` a client is holding, and
 * this is the statement that decides whether it is hers. `userId` is in the
 * WHERE beside the public id — not resolved first and compared after — so there
 * is no window between the check and the use (invariant 1).
 *
 * It returns the storage key and never a URL: an attachment's object sits at a
 * permanently public address, and handing one to a client before anything needs
 * it is a URL that outlives every reason it was minted for.
 */
export async function readOwnedReferenceAttachment(input: {
  userId: number;
  attachmentPublicId: string;
}): Promise<{
  id: number;
  candidateId: number;
  provenance: InkProvenance;
  storageKey: string;
  digest: string;
  mime: string;
  width: number;
  height: number;
} | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({
      id: castingReferenceAttachments.id,
      candidateId: castingReferenceAttachments.candidateId,
      provenance: castingReferenceAttachments.provenance,
      storageKey: castingReferenceAttachments.storageKey,
      digest: castingReferenceAttachments.digest,
      mime: castingReferenceAttachments.mime,
      width: castingReferenceAttachments.width,
      height: castingReferenceAttachments.height,
    })
    .from(castingReferenceAttachments)
    .where(and(
      eq(castingReferenceAttachments.publicId, input.attachmentPublicId),
      eq(castingReferenceAttachments.userId, input.userId),
    ))
    .limit(1);
  return row ?? null;
}
