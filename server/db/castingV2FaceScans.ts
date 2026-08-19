/**
 * The kept face scan's database layer (migration 0032).
 *
 * A scan is twelve segmenter questions about one face-version — about ten
 * cents — and it used to live in memory alone, which meant every deploy bought
 * every open face again. This is where a finished scan is written down and read
 * back.
 *
 * # Three rules, and each of them is somebody's scar
 *
 * 1. **The owner is in the statement that reads or writes** (invariant 1).
 *    Never a SELECT to check and then a write keyed on an id: `userId` is in
 *    every WHERE here, so one account's face cannot be served to another even
 *    if a caller passes the wrong candidate.
 * 2. **Only a CLEAN scan is written**, and this file cannot see whether a scan
 *    is clean — the caller decides that, and the caller is the only one who
 *    knows what `failed` held. What this file guarantees is the other half: an
 *    upsert, so a re-scan of the same version replaces rather than
 *    accumulates, and the founder's one-row-per-version bound is the unique
 *    key rather than a convention.
 * 3. **The stencils are NOT in the row.** Each slot's entry names an object
 *    key; the objects are swept with the candidate by
 *    `candidateRetention.ts`, which reads {@link listPurgeableFaceScansIn}
 *    unconditionally — the flag governs whether rows are WRITTEN and nothing
 *    governs whether they are purged.
 */
import { and, eq, inArray } from "drizzle-orm";

import { randomUUID } from "node:crypto";

import { castingFaceScans, storageCleanupBatches, storageCleanupItems } from "../../drizzle/schema";
import { getDb, withTransaction, type TransactionHandle } from "./connection";
import { createStorageCleanupManifestIn, undischargedStorageCleanupBatchWhere } from "./storageCleanup";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return (header as { affectedRows?: number })?.affectedRows ?? 0;
}

/** One feature the scan found, as it is stored. */
export type StoredScanSlot = {
  slot: string;
  /**
   * THE BOX AND THE FRAME IT WAS MEASURED ON, together — `PanelBox`'s own rule
   * kept across the write: *"a box without its frame is a rectangle in an
   * unknown space"*. A row that stored four numbers alone would be readable and
   * wrong the first time a version was delivered at a different size.
   */
  box: { x: number; y: number; width: number; height: number; frame: { width: number; height: number } };
  /** The stencil's object key. Never the bytes — see the migration's note. */
  maskKey: string;
};

/**
 * What a row's `geometry` column holds.
 *
 * The shape is the panel's own reading minus the pictures: where each feature
 * is, the two rows that can only be described, and the counts that make a thin
 * scan legible rather than mysterious.
 */
export type StoredScanGeometry = {
  slots: readonly StoredScanSlot[];
  words: ReadonlyArray<readonly [string, readonly string[]]>;
  sides: string;
  asked: number;
  found: number;
  empty: readonly string[];
};

export type KeptFaceScan = {
  publicId: string;
  frameKey: string;
  geometry: StoredScanGeometry;
  stencilBytes: number;
};

/**
 * The version discriminator, in ONE place.
 *
 * The in-memory cache has always keyed on the variant id or the word `master`,
 * and the row's unique key is the same discriminator — so it is derived here
 * and nowhere else. A second spelling of this rule is a second thing to keep in
 * step, and the one that falls behind serves the master's scan for a version or
 * the other way round.
 */
export function versionKeyOf(variantId: number | null): string {
  return variantId === null ? "master" : String(variantId);
}

/**
 * The scan for this face-version, or null.
 *
 * `frameKey` is compared by the CALLER rather than in the WHERE, deliberately:
 * a row whose frame has moved is a different outcome from no row at all — one
 * is a first look and the other is a stale reading that should be replaced —
 * and a query that returned null for both would make them indistinguishable in
 * the log.
 */
export async function readKeptFaceScan(input: {
  userId: number;
  candidateId: number;
  variantId: number | null;
}): Promise<KeptFaceScan | null> {
  const db = await requireDb();
  const [row] = await db
    .select({
      publicId: castingFaceScans.publicId,
      frameKey: castingFaceScans.frameKey,
      geometry: castingFaceScans.geometry,
      stencilBytes: castingFaceScans.stencilBytes,
    })
    .from(castingFaceScans)
    .where(and(
      eq(castingFaceScans.userId, input.userId),
      eq(castingFaceScans.candidateId, input.candidateId),
      eq(castingFaceScans.versionKey, versionKeyOf(input.variantId)),
    ))
    .limit(1);
  if (!row) return null;
  return {
    publicId: row.publicId,
    frameKey: row.frameKey,
    geometry: row.geometry as StoredScanGeometry,
    stencilBytes: row.stencilBytes,
  };
}

/**
 * Write this reading down, replacing whatever was there for the same version.
 *
 * An upsert rather than an insert because a re-scan is a legitimate event: the
 * frame moved, or the row was refused as stale. Two rows for one version would
 * break the founder's bound, and the unique key would refuse the second write
 * anyway — so the replace is stated here rather than discovered as an error.
 *
 * # THE MANIFEST IS DISCHARGED HERE, AND ITS ABSENCE COST THE WHOLE TABLE
 *
 * The library's discipline is manifest → bytes → row, and **the row's own
 * transaction releases the receipt**. Every other writer on this road does it
 * (`recordInkDesign`, the plate mint); this one did not, and the consequence
 * was not a leak — it was the exact opposite, and it was silent.
 *
 * `keepScan` registered the stencil keys for cleanup, wrote the bytes, and
 * wrote this row with nothing to discharge. So the hold lapsed at five minutes,
 * the sweep ran within sixty seconds, and **the worker deleted the stencils the
 * scan had just paid for.** The row survived, pointing at objects that no
 * longer existed; `serveKeptScan` found it, matched the frame, failed to fetch
 * a stencil and returned null — on the one branch that logs nothing. Every look
 * at that face then re-bought a twenty-call segmenter scan, forever.
 *
 * Measured on production, 2026-08-19: three faces re-scanned at 01:16, 01:17
 * and 01:20 despite holding matching kept rows, each with a cleanup batch born
 * seconds later and `succeeded` about six minutes after that. The table had
 * never once answered since it was flipped on.
 *
 * # AND THE REPLACED ROW'S OWN STENCILS ARE HANDED TO THE WORKER
 *
 * The other half, and it is the same rule pointing the other way. An upsert
 * that replaced a row used to orphan the previous reading's objects: nothing
 * referenced them and nothing would ever collect them, because the candidate
 * purge reads the CURRENT row's geometry. So the old keys are registered on a
 * fresh manifest in this same transaction — the receipt for bytes that have
 * just stopped being referenced.
 */
export async function keepFaceScan(input: {
  publicId: string;
  userId: number;
  candidateId: number;
  variantId: number | null;
  frameKey: string;
  geometry: StoredScanGeometry;
  stencilBytes: number;
  /**
   * The manifest holding the new stencils while this row is written.
   *
   * Optional in the type only so a caller with nothing to discharge cannot be
   * forced to invent one — a scan that found no slots writes no objects. On
   * every path that DID store bytes, the caller passes it.
   */
  cleanupBatchId?: string;
}): Promise<void> {
  const row = {
    publicId: input.publicId,
    userId: input.userId,
    candidateId: input.candidateId,
    versionKey: versionKeyOf(input.variantId),
    frameKey: input.frameKey,
    geometry: input.geometry,
    stencilBytes: input.stencilBytes,
  };
  return withTransaction(async (tx) => {
    /* What is about to be replaced, read INSIDE the transaction — a reading
       taken before it would be a claim about a row another write may have
       moved. */
    const [previous] = await tx
      .select({ geometry: castingFaceScans.geometry })
      .from(castingFaceScans)
      .where(and(
        eq(castingFaceScans.userId, input.userId),
        eq(castingFaceScans.candidateId, input.candidateId),
        eq(castingFaceScans.versionKey, row.versionKey),
      ))
      .limit(1);

    await tx.insert(castingFaceScans).values(row).onDuplicateKeyUpdate({
      set: {
        frameKey: row.frameKey,
        geometry: row.geometry,
        stencilBytes: row.stencilBytes,
      },
    });

    if (input.cleanupBatchId) {
      /*
        The new stencils are now referenced by a row, so the manifest holding
        them must go — in this same transaction, or the worker deletes the
        objects this reading depends on. Asserted rather than assumed: a
        manifest that does not delete means something else already claimed it,
        and committing on top of that files a row whose bytes are already
        scheduled to die. Which is the state this function was in.
      */
      await tx.delete(storageCleanupItems)
        .where(eq(storageCleanupItems.batchId, input.cleanupBatchId));
      const removed = await tx.delete(storageCleanupBatches).where(and(
        eq(storageCleanupBatches.id, input.cleanupBatchId),
        eq(storageCleanupBatches.userId, input.userId),
        undischargedStorageCleanupBatchWhere(),
      ));
      if (affectedRows(removed) !== 1) {
        throw new Error("the kept scan's manifest was already claimed — refusing to file a row whose stencils are scheduled for deletion");
      }
    }

    const orphaned = ((previous?.geometry as StoredScanGeometry | null)?.slots ?? [])
      .map((slot) => slot.maskKey)
      .filter((key): key is string => Boolean(key));
    if (orphaned.length > 0) {
      /* Nothing references these any more, and the candidate purge only ever
         sees the CURRENT row — so without this they outlive everything. */
      await createStorageCleanupManifestIn(tx, {
        id: randomUUID(),
        userId: input.userId,
        operationId: randomUUID(),
        kind: "casting_candidate_cleanup",
        storageItems: orphaned.map((storageKey) => ({
          storageKey,
          storageBackend: "public_r2" as const,
        })),
      });
    }
  });
}

/**
 * Every kept scan belonging to these candidates, with the objects it owns.
 *
 * Read inside the purge's own transaction. Rows with no slots are returned too
 * — a scan that found nothing still has a row, and the caller decides to delete
 * on the LENGTH of this list, so filtering here would let such a row outlive
 * its candidate.
 */
export async function listPurgeableFaceScansIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<Array<{ id: number; maskKeys: readonly string[] }>> {
  if (candidateIds.length === 0) return [];
  const rows = await tx
    .select({ id: castingFaceScans.id, geometry: castingFaceScans.geometry })
    .from(castingFaceScans)
    .where(inArray(castingFaceScans.candidateId, [...candidateIds]));
  return rows.map((row) => ({
    id: row.id,
    maskKeys: ((row.geometry as StoredScanGeometry | null)?.slots ?? [])
      .map((slot) => slot.maskKey)
      .filter((key): key is string => Boolean(key)),
  }));
}

export async function deleteFaceScanRowsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<number> {
  if (candidateIds.length === 0) return 0;
  const result = await tx
    .delete(castingFaceScans)
    .where(inArray(castingFaceScans.candidateId, [...candidateIds]));
  return affectedRows(result);
}
