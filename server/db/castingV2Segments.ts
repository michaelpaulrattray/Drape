/**
 * The segment store's database layer — the unified store of named regions of a
 * face (segment permanence, slice 1).
 *
 * # One rule governs this whole file
 *
 * **A segment is addressable only THROUGH its owned parent.** A segment is a
 * child of a child of a child, and the way that goes wrong is proving the
 * candidate and then trusting ids handed in beside it. So every write proves
 * the parent inside the same transaction and re-anchors the segment's
 * `candidateId` to the row it just proved — never to the caller's number
 * (invariants 1 and 2).
 *
 * # And one that governs versions
 *
 * **One facet, one live segment, newest version wins.** "Make the freckles
 * heavier" does not contest its predecessor, it retires it. That is what keeps
 * D-146 dead — the painter is never handed the old copper as ground truth for
 * new copper — and it is why the retire and the insert are one transaction
 * rather than two statements that can be interrupted between.
 *
 * # Retention is not in this file's gift
 *
 * The purge helpers at the bottom take a transaction handle because they run
 * inside the candidate sweep's own transaction, on the candidate sweep's own
 * cleanup manifest. A segment's lifetime is its candidate's, and there is
 * deliberately no second schedule for it.
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  castingCandidates,
  castingCandidateVariants,
  castingSegments,
  storageCleanupBatches,
  storageCleanupItems,
  type CastingSegmentProvenance,
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

export class SegmentOwnershipError extends Error {
  constructor(readonly subject: "candidate" | "variant" | "segment") {
    super(`${subject} not available`);
    this.name = "SegmentOwnershipError";
  }
}

/**
 * Where the pixels sit, and in what frame.
 *
 * The frame is not decoration. A mask and a crop mean nothing except against a
 * frame of the same size: paste them onto a differently-sized one and nothing
 * fails — her freckles simply land on her cheekbone instead of her nose. The
 * dimensions travel with the geometry so the compositor can refuse.
 */
export type SegmentGeometry = {
  bbox: { x: number; y: number; width: number; height: number };
  frame: { width: number; height: number };
};

export type StoredSegment = {
  id: number;
  publicId: string;
  candidateId: number;
  variantId: number | null;
  provenance: CastingSegmentProvenance;
  facet: string;
  region: string;
  version: number;
  maskKey: string;
  contentKey: string;
  geometry: SegmentGeometry;
  verifiedAt: Date | null;
  verdict: string | null;
  detector: string | null;
  retiredAt: Date | null;
  createdAt: Date;
};

function assertGeometry(geometry: SegmentGeometry): void {
  const { bbox, frame } = geometry;
  const sides = [bbox.x, bbox.y, bbox.width, bbox.height, frame.width, frame.height];
  if (sides.some((side) => !Number.isSafeInteger(side) || side < 0)) {
    throw new TypeError("segment geometry must be whole non-negative pixel counts");
  }
  if (bbox.width <= 0 || bbox.height <= 0 || frame.width <= 0 || frame.height <= 0) {
    throw new TypeError("segment geometry must have a positive extent");
  }
  /*
    A box that leaves the frame is not a tight box on a big picture — it is a
    box measured against a DIFFERENT picture, which is the mislabelled-frame
    class. Caught here, at the write, because after this row exists every reader
    of it inherits the mistake.
  */
  if (bbox.x + bbox.width > frame.width || bbox.y + bbox.height > frame.height) {
    throw new TypeError("segment bbox falls outside its own frame");
  }
}

function toStoredSegment(row: typeof castingSegments.$inferSelect): StoredSegment {
  return {
    id: row.id,
    publicId: row.publicId,
    candidateId: row.candidateId,
    variantId: row.variantId,
    provenance: row.provenance,
    facet: row.facet,
    region: row.region,
    version: row.version,
    maskKey: row.maskKey,
    contentKey: row.contentKey,
    geometry: {
      bbox: { x: row.bboxX, y: row.bboxY, width: row.bboxW, height: row.bboxH },
      frame: { width: row.frameWidth, height: row.frameHeight },
    },
    verifiedAt: row.verifiedAt,
    verdict: row.verdict,
    detector: row.detector,
    retiredAt: row.retiredAt,
    createdAt: row.createdAt,
  };
}

/* -------------------------------------------------------------- writing */

export type EditPatchToRecord = {
  /** A `Facet` id: what the edit answered. */
  facet: string;
  /** The segmentation question that drew the region. */
  region: string;
  maskKey: string;
  contentKey: string;
  geometry: SegmentGeometry;
};

export type RecordEditPatchesInput = {
  userId: number;
  /** The variant that delivered these pixels — the parent this write proves. */
  variantId: number;
  patches: readonly EditPatchToRecord[];
  /**
   * The manifest holding these objects until this transaction discharges it.
   *
   * The register-before-write pattern the variant landing already uses, and the
   * window it closes is the same one: the mask and the crop are put to public
   * keys BEFORE any row references them, so a crash in between would strand
   * pieces of a person's face at permanent URLs with nothing left that knows
   * they exist. Discharging the manifest inside the transaction that makes the
   * objects referenced is what stops the cleanup worker deleting a segment the
   * compositor is about to paste.
   */
  cleanupBatchId: string;
  /** The reading that earned these pixels — §6. */
  verdict?: string | null;
  verifiedAt?: Date | null;
  now?: Date;
};

export type RecordedSegment = {
  id: number;
  publicId: string;
  candidateId: number;
  facet: string;
  version: number;
  /** How many live predecessors this write retired — 0 or 1 in practice. */
  retired: number;
};

/**
 * File the pixels an edit added and the user kept — every facet of one render,
 * in one transaction.
 *
 * The whole point of the store is here: after these rows exist, those facets
 * are no longer sentences the next render has to re-roll. They are pixels, and
 * pasting them is arithmetic.
 *
 * All the facets together rather than one call each, because they are one
 * render: a crash between two of them would leave a face half-permanent, with
 * no record of which half.
 */
export async function recordEditPatchSegments(
  input: RecordEditPatchesInput,
): Promise<RecordedSegment[]> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.variantId, "variantId");
  if (input.patches.length === 0) return [];
  for (const patch of input.patches) assertGeometry(patch.geometry);
  const now = input.now ?? new Date();

  return withTransaction(async (tx) => {
    /*
      The parent, proved in the same transaction as the write, and the
      candidate id taken from the row rather than from the caller. A segment
      filed against someone else's candidate would be a stranger's pixels
      pasted onto her face on every later render.
    */
    const [variant] = await tx
      .select({
        id: castingCandidateVariants.id,
        candidateId: castingCandidateVariants.candidateId,
      })
      .from(castingCandidateVariants)
      .where(and(
        eq(castingCandidateVariants.id, input.variantId),
        eq(castingCandidateVariants.userId, input.userId),
      ))
      .limit(1);
    if (!variant) throw new SegmentOwnershipError("variant");

    const recorded: RecordedSegment[] = [];
    for (const patch of input.patches) {
      recorded.push(await insertVersionedSegmentIn(tx, {
        userId: input.userId,
        candidateId: variant.candidateId,
        variantId: variant.id,
        provenance: "edit_patch",
        facet: patch.facet,
        region: patch.region,
        maskKey: patch.maskKey,
        contentKey: patch.contentKey,
        geometry: patch.geometry,
        verdict: input.verdict ?? null,
        verifiedAt: input.verifiedAt ?? null,
        detector: null,
        now,
      }));
    }

    /*
      The objects are now referenced by rows, so the manifest holding them must
      go — in this same transaction, or the worker deletes pixels the
      compositor is relying on. Asserted rather than assumed: a manifest that
      does not delete means something else already claimed it, and committing
      on top of that files segments whose bytes are already scheduled to die.
    */
    await tx.delete(storageCleanupItems)
      .where(eq(storageCleanupItems.batchId, input.cleanupBatchId));
    const removedBatch = await tx.delete(storageCleanupBatches).where(and(
      eq(storageCleanupBatches.id, input.cleanupBatchId),
      eq(storageCleanupBatches.userId, input.userId),
      eq(storageCleanupBatches.status, "pending"),
    ));
    if (affectedRows(removedBatch) !== 1) throw new SegmentOwnershipError("segment");

    return recorded;
  });
}

export type DetectedToRecord = {
  /** The worn class — the user's word for the thing (`glasses`). */
  facet: string;
  /** The segmentation question that found it. */
  region: string;
  maskKey: string;
  contentKey: string;
  geometry: SegmentGeometry;
};

export type RecordDetectedInput = {
  userId: number;
  /** The candidate whose MASTER was read — the parent this write proves. */
  candidateId: number;
  /** Which detector said so; a row that cannot say cannot be re-earned. */
  detector: string;
  detections: readonly DetectedToRecord[];
  /** Same register-before-write manifest the patch writer discharges. */
  cleanupBatchId: string;
  now?: Date;
};

/**
 * File what the picture says she already has — the born-worn catalogue's write.
 *
 * Everything that separates a FACT from a DELIVERY is enforced here rather than
 * asked of the caller:
 *
 * - **No variant.** Nothing delivered these pixels; they were found on the
 *   master, and the NULL says so rather than standing for missing data.
 * - **No verdict, ever.** A verdict is a reading of whether a promise was kept,
 *   and nothing promised her the glasses she was rolled wearing. This is the
 *   line that keeps the catalogue out of every delivery denominator, so it is
 *   drawn in the writer and not left to a caller passing the right nulls.
 * - **The detector's name on every row**, because detectors improve.
 *
 * Idempotency is the caller's cheap half and this function's authoritative one:
 * a re-scan skips classes it already holds before spending a vision call, and
 * anything that reaches here retires its own predecessor and writes the next
 * version, so a race leaves one live row rather than two copies of one fact.
 */
export async function recordDetectedSegments(
  input: RecordDetectedInput,
): Promise<RecordedSegment[]> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.candidateId, "candidateId");
  if (!input.detector.trim()) throw new TypeError("a detected segment must name its detector");
  if (input.detections.length === 0) return [];
  for (const detection of input.detections) assertGeometry(detection.geometry);
  const now = input.now ?? new Date();

  return withTransaction(async (tx) => {
    /*
      The parent, proved in the same transaction as the write, with the id taken
      from the row rather than from the caller — the same rule the patch writer
      follows one function up, and for the same reason: a fact filed against a
      stranger's candidate would put a claim about someone else's face into her
      catalogue.
    */
    const [candidate] = await tx
      .select({ id: castingCandidates.id })
      .from(castingCandidates)
      .where(and(
        eq(castingCandidates.id, input.candidateId),
        eq(castingCandidates.userId, input.userId),
      ))
      .limit(1);
    if (!candidate) throw new SegmentOwnershipError("candidate");

    const recorded: RecordedSegment[] = [];
    for (const detection of input.detections) {
      recorded.push(await insertVersionedSegmentIn(tx, {
        userId: input.userId,
        candidateId: candidate.id,
        variantId: null,
        provenance: "detected_born",
        facet: detection.facet,
        region: detection.region,
        maskKey: detection.maskKey,
        contentKey: detection.contentKey,
        geometry: detection.geometry,
        verdict: null,
        verifiedAt: null,
        detector: input.detector,
        now,
      }));
    }

    await tx.delete(storageCleanupItems)
      .where(eq(storageCleanupItems.batchId, input.cleanupBatchId));
    const removedBatch = await tx.delete(storageCleanupBatches).where(and(
      eq(storageCleanupBatches.id, input.cleanupBatchId),
      eq(storageCleanupBatches.userId, input.userId),
      eq(storageCleanupBatches.status, "pending"),
    ));
    if (affectedRows(removedBatch) !== 1) throw new SegmentOwnershipError("segment");

    return recorded;
  });
}

/**
 * Retire whatever this identity currently holds, then write the next version.
 *
 * Both halves in one statement each, both inside one transaction. The retire
 * is scoped by owner as well as by candidate — a write path that trusts the
 * candidate id it was handed is exactly the check-then-write shape invariant 1
 * exists to forbid.
 */
async function insertVersionedSegmentIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    candidateId: number;
    variantId: number | null;
    provenance: CastingSegmentProvenance;
    facet: string;
    region: string;
    maskKey: string;
    contentKey: string;
    geometry: SegmentGeometry;
    verdict: string | null;
    verifiedAt: Date | null;
    detector: string | null;
    now: Date;
  },
): Promise<RecordedSegment> {
  const identity = and(
    eq(castingSegments.candidateId, input.candidateId),
    eq(castingSegments.userId, input.userId),
    eq(castingSegments.facet, input.facet),
    eq(castingSegments.region, input.region),
  );

  /*
    THE RETIRE IS SCOPED BY PROVENANCE; THE VERSION COUNTER IS NOT.

    Two different things could in principle land on one identity — a fact the
    master already had and a patch an edit added over the same ground — and they
    supersede each other in neither direction. A better detector re-reading her
    glasses must not retire the patch that repainted them, and a repaint must
    not delete the record of what she came with. So the retire names its own
    provenance.

    The counter deliberately does NOT, because the unique index is
    (candidate, facet, region, version) and knows nothing about provenance: two
    rows sharing an identity must still take different version numbers or the
    second insert dies on the index. The vocabularies are disjoint today
    (`bornWornDetector.test.ts` proves it), so this is defence in depth rather
    than a case anyone can currently reach.
  */
  const retired = affectedRows(
    await tx
      .update(castingSegments)
      .set({ retiredAt: input.now })
      .where(and(
        identity,
        eq(castingSegments.provenance, input.provenance),
        isNull(castingSegments.retiredAt),
      )),
  );

  /*
    The next version counts past RETIRED rows too. Versions are the segment's
    history (§7), not a live counter — reusing a number would collide with the
    identity index, and worse, it would make two different deliveries share a
    name in the one table that is supposed to be evidence.
  */
  const [highest] = await tx
    .select({ version: castingSegments.version })
    .from(castingSegments)
    .where(identity)
    .orderBy(desc(castingSegments.version))
    .limit(1);
  const version = (highest?.version ?? 0) + 1;

  const publicId = randomUUID();
  const [inserted] = await tx
    .insert(castingSegments)
    .values({
      publicId,
      userId: input.userId,
      candidateId: input.candidateId,
      variantId: input.variantId,
      provenance: input.provenance,
      facet: input.facet,
      region: input.region,
      version,
      maskKey: input.maskKey,
      contentKey: input.contentKey,
      bboxX: input.geometry.bbox.x,
      bboxY: input.geometry.bbox.y,
      bboxW: input.geometry.bbox.width,
      bboxH: input.geometry.bbox.height,
      frameWidth: input.geometry.frame.width,
      frameHeight: input.geometry.frame.height,
      verdict: input.verdict,
      verifiedAt: input.verifiedAt,
      detector: input.detector,
      createdAt: input.now,
    })
    .$returningId();
  if (!inserted?.id) throw new SegmentOwnershipError("segment");

  return {
    id: inserted.id,
    publicId,
    candidateId: input.candidateId,
    facet: input.facet,
    version,
    retired,
  };
}

/* -------------------------------------------------------------- reading */

/**
 * The segments a composite should assemble from — live only, oldest first.
 *
 * Ordered by creation so a later paste sits over an earlier one, which is the
 * same "the newer edit wins the pixels it claims" rule the surrender rules
 * state, applied in the one place a caller could otherwise get it backwards.
 */
export async function listLiveSegments(input: {
  userId: number;
  candidateId: number;
}): Promise<StoredSegment[]> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.candidateId, "candidateId");
  const db = await requireDb();
  const rows = await db
    .select()
    .from(castingSegments)
    .where(and(
      eq(castingSegments.candidateId, input.candidateId),
      eq(castingSegments.userId, input.userId),
      isNull(castingSegments.retiredAt),
    ))
    .orderBy(asc(castingSegments.createdAt), asc(castingSegments.id));
  return rows.map(toStoredSegment);
}

/**
 * Everything ever filed against this face, newest first — history included.
 *
 * A retired segment is not deleted (§3's one deliberate asymmetry): the bytes
 * survive so redo can exist, and the row survives because it is evidence of a
 * render that was delivered.
 */
export async function listSegmentHistory(input: {
  userId: number;
  candidateId: number;
}): Promise<StoredSegment[]> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.candidateId, "candidateId");
  const db = await requireDb();
  const rows = await db
    .select()
    .from(castingSegments)
    .where(and(
      eq(castingSegments.candidateId, input.candidateId),
      eq(castingSegments.userId, input.userId),
    ))
    .orderBy(desc(castingSegments.createdAt), desc(castingSegments.id));
  return rows.map(toStoredSegment);
}

/**
 * Prove a candidate is this user's, and hand back its internal id.
 *
 * The public id is what a request carries; every statement below wants the
 * internal one, and the only safe way across that boundary is a statement that
 * asks for both facts at once.
 */
export async function resolveOwnedCandidateId(input: {
  userId: number;
  candidatePublicId: string;
}): Promise<number> {
  assertPositiveId(input.userId, "userId");
  const db = await requireDb();
  const [candidate] = await db
    .select({ id: castingCandidates.id })
    .from(castingCandidates)
    .where(and(
      eq(castingCandidates.publicId, input.candidatePublicId),
      eq(castingCandidates.userId, input.userId),
    ))
    .limit(1);
  if (!candidate) throw new SegmentOwnershipError("candidate");
  return candidate.id;
}

/**
 * Take one facet back out of the composite — §7's undo.
 *
 * **The bytes survive.** Only `retiredAt` moves, so the redo in §7 can exist
 * and so the row stays readable as evidence of a render that was delivered.
 * Her account-level deletion still removes everything, because that runs on the
 * candidate.
 *
 * Scoped by owner in the statement that writes, not in a check before it — the
 * same rule every other write in this file follows, and the reason is that a
 * check-then-write is a race with someone else's edit.
 */
export async function retireSegmentFacet(input: {
  userId: number;
  candidateId: number;
  facet: string;
  now?: Date;
}): Promise<number> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.candidateId, "candidateId");
  const db = await requireDb();
  const result = await db
    .update(castingSegments)
    .set({ retiredAt: input.now ?? new Date() })
    .where(and(
      eq(castingSegments.candidateId, input.candidateId),
      eq(castingSegments.userId, input.userId),
      eq(castingSegments.facet, input.facet),
      /*
        EDIT PATCHES ONLY, and this is the born-versus-added line drawn in SQL.

        Retiring a `detected_born` row would take a fact about her face out of
        the catalogue while leaving the thing itself in the picture — the
        glasses she was rolled wearing do not come off by dropping a row, they
        come off with a real render into the skin behind them.
      */
      eq(castingSegments.provenance, "edit_patch"),
      isNull(castingSegments.retiredAt),
    ));
  return affectedRows(result);
}

/* ------------------------------------------------------------- retention */

/**
 * Every segment object belonging to these candidates — read INSIDE the sweep's
 * transaction, so a segment written between the read and the delete cannot
 * slip through and outlive the face it belonged to.
 *
 * Deliberately not scoped to live rows. A retired segment's bytes are exactly
 * the ones nothing else will ever collect.
 */
export async function listPurgeableSegmentsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<Array<{ id: number; maskKey: string; contentKey: string }>> {
  if (candidateIds.length === 0) return [];
  return tx
    .select({
      id: castingSegments.id,
      maskKey: castingSegments.maskKey,
      contentKey: castingSegments.contentKey,
    })
    .from(castingSegments)
    .where(inArray(castingSegments.candidateId, [...candidateIds]));
}

export async function deleteSegmentRowsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<number> {
  if (candidateIds.length === 0) return 0;
  const result = await tx
    .delete(castingSegments)
    .where(inArray(castingSegments.candidateId, [...candidateIds]));
  return affectedRows(result);
}
