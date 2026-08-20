/**
 * The ink studio's database layer (migration 0034).
 *
 * One row is a design a customer supplied, the place on her it is meant for,
 * and where OUR copy of the bytes lives. This file holds the STATEMENTS; the
 * decisions — which placements exist, which sides a placement has, what a
 * design may be — live in `castingV2/inkUploadDoor.ts`, where they can be
 * driven without a database.
 *
 * # Three rules, and each of them is somebody's scar
 *
 * 1. **The owner is in the statement that writes** (invariant 1). The candidate
 *    is proved by `(publicId, userId)` inside the same transaction as the
 *    insert, and the row's `candidateId` is taken from the row just proved
 *    rather than from anything a caller passed. A design filed against a
 *    stranger's Cast would be a picture we keep, and eventually paint, on
 *    somebody else's work.
 * 2. **The cap is counted under a lock, not near one.** The candidate row is
 *    selected `FOR UPDATE`, so two uploads racing on the same Cast queue behind
 *    each other rather than both reading seven and both writing. A cap that can
 *    be beaten by clicking twice is a cap in the comments.
 * 3. **The manifest is discharged in the transaction that files the row.** The
 *    bytes are written to a permanently public key BEFORE this runs, so they
 *    are registered for cleanup first and released here — a crash in between
 *    collects itself, and a row that fails to commit leaves nothing behind.
 *    The library's own rule, and it is here for the same reason: manifest
 *    before bytes is a race this program has already paid for.
 *
 * # Retention is not in this file's gift
 *
 * The purge helpers at the bottom take a transaction handle because they run
 * inside the candidate sweep's own transaction, on the candidate sweep's own
 * manifest. A design's lifetime is its Cast's, unconditionally — the studio
 * flag governs whether a row is WRITTEN and nothing governs whether it is
 * purged.
 */
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  castingCandidates,
  castingInkDesigns,
  storageCleanupBatches,
  storageCleanupItems,
} from "../../drizzle/schema";
import type { InkPlacement } from "../../shared/inkPlacementVocabulary";
import type { InkProvenance } from "../../shared/inkProvenance";
import type { InkCutRoute } from "../../shared/inkCutRoute";
import type { InkSide } from "../../shared/inkReleasedPlacements";
import { isReferenceIntent, type ReferenceIntent } from "../../shared/referenceIntents";
import { INK_DESIGNS_PER_CANDIDATE } from "../castingV2/inkUploadDoor";
import { countHeldPicturesIn } from "./castingV2ReferenceAttachments";
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

/** The Cast is not this account's — said the same way a missing one is. */
export class InkDesignOwnershipError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "InkDesignOwnershipError";
  }
}

/** This Cast already holds as many designs as it may. */
export class InkDesignCapError extends Error {
  constructor() {
    super(`a Cast may hold ${INK_DESIGNS_PER_CANDIDATE} ink designs`);
    this.name = "InkDesignCapError";
  }
}

export type InkDesignToRecord = {
  userId: number;
  candidatePublicId: string;
  placement: InkPlacement;
  side: InkSide;
  provenance: InkProvenance;
  /**
   * What this reference is being taken FOR (ruled fable-937).
   *
   * Never defaulted here. The door decides what a legal declaration is, and a
   * writer that invented one would be filing an answer to a question nobody was
   * asked, which is the defect `provenance` exists to avoid one column along.
   */
  intents: readonly ReferenceIntent[];
  /** Our object, under the candidate's purge path. Never a pointer. */
  storageKey: string;
  /**
   * WHAT WAS DONE TO THE BYTES BEFORE THEY WERE STORED (migration 0047).
   *
   * `null` is a real answer and the one this field exists to carry: NOBODY
   * LOOKED, because `CASTING_INK_CUT_SCOPE` was off for this account. It is
   * therefore REQUIRED rather than optional — a writer that omitted it would be
   * filing "nobody looked" by silence, and the containment condition that reads
   * this column (fable-1137 §4) cannot tell a deliberate null from a forgotten
   * one. Every caller says which of the three it is.
   */
  cutRoute: InkCutRoute | null;
  /**
   * THE PICTURE THIS DESIGN WAS TAKEN OUT OF (migration 0048).
   *
   * The sha256 of the ATTACHMENT the mint cut it from, and `null` for a design
   * the customer uploaded through the studio door — she did not take that one
   * out of anything. REQUIRED rather than optional, for `cutRoute`'s reason:
   * the reuse key reads this column, and it cannot tell a deliberate null from
   * a forgotten one. Every caller says which of the two it is.
   */
  sourceDigest: string | null;
  /** sha256 of the stored bytes — byte identity, as the library does it. */
  digest: string;
  mime: string;
  byteSize: number;
  width: number;
  height: number;
  /**
   * The manifest holding the bytes while this row is written.
   *
   * Optional in the type only so a caller with nothing to discharge cannot be
   * forced to invent one; on this road there are always bytes, so the procedure
   * always passes it.
   */
  cleanupBatchId?: string;
};

export type RecordedInkDesign = {
  publicId: string;
  candidateId: number;
  placement: InkPlacement;
  side: InkSide;
  provenance: InkProvenance;
  intents: readonly ReferenceIntent[];
  storageKey: string;
  cutRoute: InkCutRoute | null;
  /** The picture it was taken out of, or `null` for one uploaded as a design. */
  sourceDigest: string | null;
  createdAt: Date;
};

export async function recordInkDesign(input: InkDesignToRecord): Promise<RecordedInkDesign> {
  if (!Number.isInteger(input.userId) || input.userId <= 0) {
    throw new Error("userId must be a positive integer");
  }
  const publicId = randomUUID();
  const now = new Date();

  return withTransaction(async (tx) => {
    /*
      The parent, proved and LOCKED in the same transaction as the write. The
      lock is what makes the cap below exact: without it two uploads on one Cast
      both read the same count and both write.
    */
    const [candidate] = await tx
      .select({ id: castingCandidates.id })
      .from(castingCandidates)
      .where(and(
        eq(castingCandidates.publicId, input.candidatePublicId),
        eq(castingCandidates.userId, input.userId),
      ))
      .limit(1)
      .for("update");
    if (!candidate) throw new InkDesignOwnershipError("candidate");

    /*
      THE CAP COUNTS BOTH STORES, AND UNTIL 2026-08-20 IT COUNTED ONE.

      fable-1063 §2 ruled the eight is SHARED between the designs and the
      attached pictures — *"not 8 + 8, so the purge surface stays bounded"* —
      and the attach door enforced exactly that while this writer counted
      `casting_ink_designs` alone. A Cast holding eight attachments still
      admitted eight designs: sixteen kept objects against a bound of eight,
      and the bound read as held because the door somebody tested enforced it
      (found opus-854 §6, ruled fable-1151 §4).

      Through the attachment store's own counter rather than a second count
      spelled the same way here (law 4): one owner, so one sabotage reddens
      both suites.
    */
    if (await countHeldPicturesIn(tx, candidate.id) >= INK_DESIGNS_PER_CANDIDATE) {
      throw new InkDesignCapError();
    }

    await tx.insert(castingInkDesigns).values({
      publicId,
      userId: input.userId,
      /* From the row just proved, never from a number a caller supplied. */
      candidateId: candidate.id,
      placement: input.placement,
      side: input.side,
      provenance: input.provenance,
      intents: input.intents,
      storageKey: input.storageKey,
      cutRoute: input.cutRoute,
      sourceDigest: input.sourceDigest,
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
        go — in this same transaction, or the worker deletes the design a render
        is about to be handed. Asserted rather than assumed: a manifest that does
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
      if (affectedRows(removed) !== 1) throw new InkDesignOwnershipError("design");
    }

    return {
      publicId,
      candidateId: candidate.id,
      placement: input.placement,
      side: input.side,
      provenance: input.provenance,
      intents: input.intents,
      storageKey: input.storageKey,
      cutRoute: input.cutRoute,
      sourceDigest: input.sourceDigest,
      createdAt: now,
    };
  });
}

export type StoredInkDesign = RecordedInkDesign & {
  digest: string;
  mime: string;
  byteSize: number;
  width: number;
  height: number;
};

/**
 * Every design on this Cast, oldest first — owner-scoped in the read itself.
 *
 * An explicit projection (invariant 8): the row is never spread across the
 * serialization boundary, and the internal ids stay inside.
 */
export async function listInkDesigns(input: {
  userId: number;
  candidatePublicId: string;
}): Promise<readonly StoredInkDesign[]> {
  const db = await requireDb();
  const rows = await db
    .select({
      publicId: castingInkDesigns.publicId,
      candidateId: castingInkDesigns.candidateId,
      placement: castingInkDesigns.placement,
      side: castingInkDesigns.side,
      provenance: castingInkDesigns.provenance,
      intents: castingInkDesigns.intents,
      storageKey: castingInkDesigns.storageKey,
      cutRoute: castingInkDesigns.cutRoute,
      sourceDigest: castingInkDesigns.sourceDigest,
      digest: castingInkDesigns.digest,
      mime: castingInkDesigns.mime,
      byteSize: castingInkDesigns.byteSize,
      width: castingInkDesigns.width,
      height: castingInkDesigns.height,
      createdAt: castingInkDesigns.createdAt,
    })
    .from(castingInkDesigns)
    .innerJoin(castingCandidates, eq(castingCandidates.id, castingInkDesigns.candidateId))
    .where(and(
      eq(castingCandidates.publicId, input.candidatePublicId),
      /* BOTH sides of the join carry the owner. The design row's `userId` is
         denormalized, and a denormalized column is a claim until the parent
         agrees with it. */
      eq(castingCandidates.userId, input.userId),
      eq(castingInkDesigns.userId, input.userId),
    ))
    .orderBy(castingInkDesigns.id);
  /* The driver hands JSON back parsed on one path and as text on another, so
     it is normalized here and no caller has to know which one it got. The
     reference library's `words` are read back the same way. */
  return rows.map((row) => ({
    ...row,
    intents: parseIntents(row.intents),
    createdAt: new Date(row.createdAt),
  }));
}

/** JSON as either shape, read back as the set it is. */
function parseIntents(value: unknown): readonly ReferenceIntent[] {
  const raw = typeof value === "string" ? safeParseIntents(value) : value;
  return Array.isArray(raw) ? raw.filter(isReferenceIntent) : [];
}

function safeParseIntents(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * ONE design, by the name a customer's client knows it by — owner-scoped in the
 * statement, with the same all-the-way-up join `listInkDesigns` uses.
 *
 * The mint needs this and could not be given it by its caller. A plate is drawn
 * from a design's BYTES at a placement, and both facts have to come from the row
 * rather than from a request: a caller who could name the storage key could name
 * somebody else's, and a caller who could name the placement could plate an
 * upper-arm design onto a neck.
 */
export async function readInkDesign(input: {
  userId: number;
  designPublicId: string;
}): Promise<StoredInkDesign | null> {
  const db = await requireDb();
  const [row] = await db
    .select({
      publicId: castingInkDesigns.publicId,
      candidateId: castingInkDesigns.candidateId,
      placement: castingInkDesigns.placement,
      side: castingInkDesigns.side,
      provenance: castingInkDesigns.provenance,
      intents: castingInkDesigns.intents,
      storageKey: castingInkDesigns.storageKey,
      cutRoute: castingInkDesigns.cutRoute,
      sourceDigest: castingInkDesigns.sourceDigest,
      digest: castingInkDesigns.digest,
      mime: castingInkDesigns.mime,
      byteSize: castingInkDesigns.byteSize,
      width: castingInkDesigns.width,
      height: castingInkDesigns.height,
      createdAt: castingInkDesigns.createdAt,
    })
    .from(castingInkDesigns)
    .innerJoin(castingCandidates, eq(castingCandidates.id, castingInkDesigns.candidateId))
    .where(and(
      eq(castingInkDesigns.publicId, input.designPublicId),
      /* Both sides, for `listInkDesigns`' reason: the design's `userId` is
         denormalized, and a denormalized column is a claim until the parent
         agrees with it. */
      eq(castingInkDesigns.userId, input.userId),
      eq(castingCandidates.userId, input.userId),
    ))
    .limit(1);
  if (!row) return null;
  return { ...row, intents: parseIntents(row.intents), createdAt: new Date(row.createdAt) };
}

/**
 * THE CAST'S OWN BUILD, for the design's sake — one owner-scoped statement.
 *
 * A design plates onto a blank form, and which torso form depends on the build
 * of the Cast the design is attached to (`inkTemplates.inkTemplateFor`). That
 * fact lives on the candidate's `internalPrompt`, which is INTERNAL and never
 * projected, so it is read here and parsed by its one owner
 * (`rollService.readResolvedIdentity`) rather than re-parsed at the call site.
 *
 * A separate statement rather than a field on {@link readInkDesign}: the
 * compiled instruction is the single most sensitive thing on a candidate row,
 * and putting it on a type that four modules already pass around is how an
 * internal field reaches a projection by accident (invariant 8). This returns
 * the blob to ONE caller that needs one value out of it.
 *
 * Owner-scoped on BOTH sides, for `readInkDesign`'s reason: the design's
 * `userId` is denormalized, and a denormalized column is a claim until the
 * parent agrees with it.
 */
export async function readInkDesignCastIdentity(input: {
  userId: number;
  designPublicId: string;
}): Promise<{ internalPrompt: unknown } | null> {
  const db = await requireDb();
  const [row] = await db
    .select({ internalPrompt: castingCandidates.internalPrompt })
    .from(castingInkDesigns)
    .innerJoin(castingCandidates, eq(castingCandidates.id, castingInkDesigns.candidateId))
    .where(and(
      eq(castingInkDesigns.publicId, input.designPublicId),
      eq(castingInkDesigns.userId, input.userId),
      eq(castingCandidates.userId, input.userId),
    ))
    .limit(1);
  return row ? { internalPrompt: row.internalPrompt } : null;
}

/* ------------------------------------------------------------ retention */

/**
 * Every design object belonging to these candidates — read INSIDE the sweep's
 * transaction, so a design uploaded between the read and the delete cannot slip
 * through and outlive the Cast it was attached to.
 */
export async function listPurgeableInkDesignsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<Array<{ id: number; storageKey: string }>> {
  if (candidateIds.length === 0) return [];
  return tx
    .select({ id: castingInkDesigns.id, storageKey: castingInkDesigns.storageKey })
    .from(castingInkDesigns)
    .where(inArray(castingInkDesigns.candidateId, [...candidateIds]));
}

export async function deleteInkDesignRowsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<number> {
  if (candidateIds.length === 0) return 0;
  const result = await tx
    .delete(castingInkDesigns)
    .where(inArray(castingInkDesigns.candidateId, [...candidateIds]));
  return affectedRows(result);
}
