/**
 * The reference library's database layer (COMPOSITOR_SWAP_DESIGN §2, migration
 * 0028).
 *
 * # This file holds the STATEMENTS; the RULES live next door
 *
 * The walk below returns every library row along a branch's ancestry, in
 * order, and stops there. Deciding which of them are LIVE — newest version per
 * (slot, role), a retired newest meaning *gone from this branch* — and folding
 * them into the assembler's entries is one pure function in
 * `castingV2/referenceLibrary.ts`. That is deliberate: those rules are the ones
 * a fork-edit gets wrong (fable-091), and a rule that needs a database to
 * exercise is a rule that gets exercised once.
 *
 * # One rule governs every write here
 *
 * **A library row is addressable only THROUGH its owned parent.** The variant
 * (or, for a master-minted row, the candidate) is proved inside the same
 * transaction as the insert, and the row's `candidateId` is taken from the row
 * just proved rather than from the caller's number (invariants 1 and 2).
 *
 * # The shape invariants are enforced here because MySQL cannot be asked to
 *
 * `storageKey` NULL is the tier boundary rather than missing data, so the legal
 * combinations are a short list and this is the door they are checked at:
 *
 *   `anchor` with no image        refused — a frozen reference IS a picture
 *   `carry` on a SURFACE with an  refused — a surface is carried by words,
 *   image                         always (§3.0a). fable-195's carve-out is the
 *                                 other role: an UPLOADED makeup reference is a
 *                                 legal `anchor`, never a minted carry crop.
 *   a crop with no guard reading  refused — a crop enters the library because a
 *                                 second, independent read confirmed it (§2.4);
 *                                 a row that cannot say what was read is a crop
 *                                 that did not pass through the door
 *   a crop with no geometry       refused — a mask and a crop mean nothing
 *                                 except against a frame of the same size
 *   a crop with no mask           refused — the panel shows a cutout, and a
 *                                 coverage reading whose subject cannot be
 *                                 re-measured is a number with no artifact
 *   an anchor with a mask or a    refused — an anchor is an upload, not a cut
 *   bbox
 *
 * # Retention is not in this file's gift
 *
 * The purge helpers at the bottom take a transaction handle because they run
 * inside the candidate sweep's own transaction, on the candidate sweep's own
 * cleanup manifest. A library crop's lifetime is its candidate's, and there is
 * deliberately no second schedule for it.
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  castingCandidates,
  castingCandidateVariants,
  castingReferenceLibrary,
  storageCleanupBatches,
  storageCleanupItems,
  type CastingReferenceRole,
  type CastingReferenceTier,
} from "../../drizzle/schema";
/* A dependency-free vocabulary module, imported for its PARSER: the whole
   difference between the library's key space and the ledger's is that
   `makeup@face skin` does not parse, and the place to catch that is the write. */
import { parseSlot } from "../castingV2/referenceSlots";
/* The row shape and the live-rows rule both live next door, and this file
   imports them rather than restating them: a second copy of "which version is
   live" is the drift working law 4 is about, and it would be invisible until a
   fork put the wrong earring back on. */
import {
  liveReferences,
  type ReferenceGeometry,
  type ReferenceGuardReading,
  type StoredReference,
} from "../castingV2/referenceLibrary";
import { withTransaction, getDb, type TransactionHandle } from "./connection";

export type { ReferenceGeometry, ReferenceGuardReading, StoredReference };

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

export class ReferenceLibraryOwnershipError extends Error {
  constructor(readonly subject: "candidate" | "variant" | "reference") {
    super(`${subject} not available`);
    this.name = "ReferenceLibraryOwnershipError";
  }
}

/** A refused write. The reason is the shape rule that refused it. */
export class ReferenceLibraryShapeError extends Error {
  constructor(
    readonly reason:
      | "slotNotAFeatureSlot"
      | "anchorWithoutImage"
      | "surfaceCarriesCrop"
      | "imageWithoutDigest"
      | "cropWithoutGuard"
      | "cropWithoutGeometry"
      | "cropWithoutMask"
      | "anchorIsNotACut"
      | "manifestMissing",
    detail: string,
  ) {
    super(detail);
    this.name = "ReferenceLibraryShapeError";
  }
}

export type ReferenceImageToRecord = {
  /** The RECTANGULAR crop — what a recipe sends (§5.1). */
  storageKey: string;
  /** The single-channel mask that makes it a cutout for the panel. Present on a
   *  minted crop; absent on an uploaded anchor, which is not a cut. */
  maskKey?: string;
  /** sha256 hex of the crop's bytes. */
  digest: string;
  /** Present on a minted crop; absent on an uploaded anchor. */
  geometry?: ReferenceGeometry;
  /** Present on a minted crop; absent on an uploaded anchor. */
  guard?: ReferenceGuardReading;
};

export type ReferenceRowToRecord = {
  role: CastingReferenceRole;
  /** A PANEL SLOT: `lips`, `eye@left`, `earring@right`. Never `facet@region`. */
  slot: string;
  tier: CastingReferenceTier;
  noun: string;
  /** The full declarative stack for the slot, oldest first. */
  words: readonly string[];
  /** Absent for a words-only row — a surface, or anatomy nothing has delivered. */
  image?: ReferenceImageToRecord;
};

export type RecordReferenceRowsInput = {
  userId: number;
  /**
   * The render that minted these rows, or NULL for rows minted from the
   * candidate's own master — born anatomy, or an item introduced before any
   * edit landed. A master-minted row belongs to every branch.
   */
  variantId: number | null;
  /** Required when `variantId` is null: the parent this write proves instead. */
  candidateId?: number;
  rows: readonly ReferenceRowToRecord[];
  /**
   * The manifest holding these objects until this transaction discharges it.
   *
   * Required whenever any row carries an image, and refused when it is absent:
   * the crops go to permanently public keys BEFORE any row references them, so
   * a crash in between would strand pieces of a person's face at URLs nothing
   * knows about. Words-only rows write no objects and need no manifest.
   */
  cleanupBatchId?: string;
  now?: Date;
};

export type RecordedReference = {
  id: number;
  publicId: string;
  candidateId: number;
  slot: string;
  role: CastingReferenceRole;
  version: number;
};

function assertGeometry(geometry: ReferenceGeometry): void {
  const { bbox, frame } = geometry;
  const sides = [bbox.x, bbox.y, bbox.width, bbox.height, frame.width, frame.height];
  if (sides.some((side) => !Number.isSafeInteger(side) || side < 0)) {
    throw new TypeError("reference geometry must be whole non-negative pixel counts");
  }
  if (bbox.width <= 0 || bbox.height <= 0 || frame.width <= 0 || frame.height <= 0) {
    throw new TypeError("reference geometry must have a positive extent");
  }
  /* A box that leaves its frame is a box measured against a DIFFERENT picture —
     the mislabelled-frame class, caught before every later reader inherits it. */
  if (bbox.x + bbox.width > frame.width || bbox.y + bbox.height > frame.height) {
    throw new TypeError("reference bbox falls outside its own frame");
  }
}

/**
 * The shape rules, in one place, applied to one row.
 *
 * Exported so they can be driven directly rather than through a database —
 * working law 3, and these are exactly the refusals a test would otherwise
 * "prove" by never triggering them.
 */
export function assertReferenceRowShape(row: ReferenceRowToRecord): void {
  if (parseSlot(row.slot) === null) {
    throw new ReferenceLibraryShapeError(
      "slotNotAFeatureSlot",
      `"${row.slot}" is not a panel slot; the library's keys are features (\`lips\`, \`eye@left\`), never the ledger's \`facet@region\``,
    );
  }
  if (row.role === "anchor" && !row.image) {
    throw new ReferenceLibraryShapeError(
      "anchorWithoutImage",
      `${row.slot}'s anchor has no image, and a frozen introduction reference is a picture or it is nothing`,
    );
  }
  if (row.role === "carry" && row.tier === "surface" && row.image) {
    throw new ReferenceLibraryShapeError(
      "surfaceCarriesCrop",
      `${row.slot} is a surface and is carried by words alone; a minted crop must not be stored for it`,
    );
  }
  if (!row.image) return;
  if (row.image.digest.trim() === "" || row.image.storageKey.trim() === "") {
    throw new ReferenceLibraryShapeError(
      "imageWithoutDigest",
      `${row.slot}'s image needs both a storage key and a digest; the digest is what the byte-identity refusal reads`,
    );
  }
  if (row.role === "anchor") {
    if (row.image.maskKey) {
      throw new ReferenceLibraryShapeError(
        "anchorIsNotACut",
        `${row.slot}'s anchor carries a mask, but an anchor is an upload rather than a cut`,
      );
    }
    if (row.image.geometry) {
      throw new ReferenceLibraryShapeError(
        "anchorIsNotACut",
        `${row.slot}'s anchor carries a bbox, but an anchor is an upload rather than a cut and was never in a frame`,
      );
    }
    return;
  }
  if (!row.image.geometry) {
    throw new ReferenceLibraryShapeError(
      "cropWithoutGeometry",
      `${row.slot}'s crop has no frame; a crop means nothing except against the frame it was cut from`,
    );
  }
  assertGeometry(row.image.geometry);
  if (!row.image.maskKey) {
    throw new ReferenceLibraryShapeError(
      "cropWithoutMask",
      `${row.slot}'s crop has no mask; the panel shows a cutout and the guard's reading can only be re-measured against one`,
    );
  }
  if (!row.image.guard) {
    throw new ReferenceLibraryShapeError(
      "cropWithoutGuard",
      `${row.slot}'s crop carries no completeness reading; a crop enters the library because a second read confirmed it, and a row that cannot say what was read did not come through that door`,
    );
  }
}

/* -------------------------------------------------------------- writing */

async function insertVersionedReferenceIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    candidateId: number;
    variantId: number | null;
    row: ReferenceRowToRecord;
    now: Date;
  },
): Promise<RecordedReference> {
  const identity = and(
    eq(castingReferenceLibrary.candidateId, input.candidateId),
    eq(castingReferenceLibrary.slot, input.row.slot),
    eq(castingReferenceLibrary.role, input.row.role),
  );

  /*
    The next version counts past RETIRED rows too. Versions are the slot's
    history, not a live counter: reusing a number would collide with the
    identity index, and worse, it would make two different deliveries share a
    name in the one table that is supposed to be evidence.
  */
  const [highest] = await tx
    .select({ version: castingReferenceLibrary.version })
    .from(castingReferenceLibrary)
    .where(identity)
    .orderBy(desc(castingReferenceLibrary.version))
    .limit(1);
  const version = (highest?.version ?? 0) + 1;

  const publicId = randomUUID();
  const image = input.row.image;
  const [inserted] = await tx
    .insert(castingReferenceLibrary)
    .values({
      publicId,
      userId: input.userId,
      candidateId: input.candidateId,
      variantId: input.variantId,
      role: input.row.role,
      slot: input.row.slot,
      tier: input.row.tier,
      noun: input.row.noun,
      words: [...input.row.words],
      storageKey: image?.storageKey ?? null,
      maskKey: image?.maskKey ?? null,
      digest: image?.digest ?? null,
      bboxX: image?.geometry?.bbox.x ?? null,
      bboxY: image?.geometry?.bbox.y ?? null,
      bboxW: image?.geometry?.bbox.width ?? null,
      bboxH: image?.geometry?.bbox.height ?? null,
      frameWidth: image?.geometry?.frame.width ?? null,
      frameHeight: image?.geometry?.frame.height ?? null,
      guardKind: image?.guard?.kind ?? null,
      guardCoverage: image?.guard?.coverage ?? null,
      guardSpill: image?.guard?.spill ?? null,
      guardThreshold: image?.guard?.threshold ?? null,
      version,
      createdAt: input.now,
    })
    .$returningId();
  if (!inserted?.id) throw new ReferenceLibraryOwnershipError("reference");

  return {
    id: inserted.id,
    publicId,
    candidateId: input.candidateId,
    slot: input.row.slot,
    role: input.row.role,
    version,
  };
}

/**
 * File what one render made of a face's features — every slot it touched, in
 * one transaction.
 *
 * All the slots together rather than one call each, because they are one
 * render: a crash between two of them would leave a library that half-believes
 * an edit happened, and the assembler would build its next prompt from the
 * half.
 */
export async function recordReferenceRows(
  input: RecordReferenceRowsInput,
): Promise<RecordedReference[]> {
  assertPositiveId(input.userId, "userId");
  if (input.rows.length === 0) return [];
  for (const row of input.rows) assertReferenceRowShape(row);

  const carriesObjects = input.rows.some((row) => row.image !== undefined);
  if (carriesObjects && !input.cleanupBatchId) {
    throw new ReferenceLibraryShapeError(
      "manifestMissing",
      "these rows carry objects, and objects are registered for cleanup BEFORE they are written; a write with no manifest to discharge is a write that never held them",
    );
  }
  const now = input.now ?? new Date();

  return withTransaction(async (tx) => {
    /*
      The parent, proved in the same transaction as the write, and the candidate
      id taken from the proved row rather than from the caller. A reference
      filed against someone else's candidate would be a stranger's face riding
      in every later render of this one.
    */
    let candidateId: number;
    if (input.variantId === null) {
      assertPositiveId(input.candidateId ?? 0, "candidateId");
      const [candidate] = await tx
        .select({ id: castingCandidates.id })
        .from(castingCandidates)
        .where(and(
          eq(castingCandidates.id, input.candidateId!),
          eq(castingCandidates.userId, input.userId),
        ))
        .limit(1);
      if (!candidate) throw new ReferenceLibraryOwnershipError("candidate");
      candidateId = candidate.id;
    } else {
      assertPositiveId(input.variantId, "variantId");
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
      if (!variant) throw new ReferenceLibraryOwnershipError("variant");
      candidateId = variant.candidateId;
    }

    const recorded: RecordedReference[] = [];
    for (const row of input.rows) {
      recorded.push(await insertVersionedReferenceIn(tx, {
        userId: input.userId,
        candidateId,
        variantId: input.variantId,
        row,
        now,
      }));
    }

    if (input.cleanupBatchId) {
      /*
        The objects are now referenced by rows, so the manifest holding them
        must go — in this same transaction, or the worker deletes pixels the
        next render is relying on. Asserted rather than assumed: a manifest that
        does not delete means something else already claimed it, and committing
        on top of that files references whose bytes are already scheduled to die.
      */
      await tx.delete(storageCleanupItems)
        .where(eq(storageCleanupItems.batchId, input.cleanupBatchId));
      const removedBatch = await tx.delete(storageCleanupBatches).where(and(
        eq(storageCleanupBatches.id, input.cleanupBatchId),
        eq(storageCleanupBatches.userId, input.userId),
        eq(storageCleanupBatches.status, "pending"),
      ));
      if (affectedRows(removedBatch) !== 1) {
        throw new ReferenceLibraryOwnershipError("reference");
      }
    }

    return recorded;
  });
}

/* -------------------------------------------------------------- reading */

function toStoredReference(
  row: typeof castingReferenceLibrary.$inferSelect,
): StoredReference {
  const hasGeometry = row.bboxX !== null && row.bboxY !== null
    && row.bboxW !== null && row.bboxH !== null
    && row.frameWidth !== null && row.frameHeight !== null;
  const hasGuard = row.guardKind !== null && row.guardCoverage !== null
    && row.guardSpill !== null && row.guardThreshold !== null;
  return {
    id: row.id,
    publicId: row.publicId,
    candidateId: row.candidateId,
    variantId: row.variantId,
    role: row.role,
    slot: row.slot,
    tier: row.tier,
    noun: row.noun,
    /* The driver hands JSON back parsed on one path and as text on another;
       normalized here so no caller has to know which one it got. */
    words: parseWords(row.words),
    storageKey: row.storageKey,
    maskKey: row.maskKey,
    digest: row.digest,
    geometry: hasGeometry
      ? {
        bbox: { x: row.bboxX!, y: row.bboxY!, width: row.bboxW!, height: row.bboxH! },
        frame: { width: row.frameWidth!, height: row.frameHeight! },
      }
      : null,
    guard: hasGuard
      ? {
        kind: row.guardKind!,
        coverage: row.guardCoverage!,
        spill: row.guardSpill!,
        threshold: row.guardThreshold!,
      }
      : null,
    version: row.version,
    retiredAt: row.retiredAt === null ? null : new Date(row.retiredAt),
    createdAt: new Date(row.createdAt),
  };
}

export function parseWords(value: unknown): readonly string[] {
  const raw = typeof value === "string" ? safeParse(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw.filter((word): word is string => typeof word === "string");
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * `db.execute` hands back a driver-shaped result whose rows sit in different
 * places on different drivers. Unwrapped in one place, so no caller has to know.
 */
function asLibraryRows(result: unknown): Array<typeof castingReferenceLibrary.$inferSelect> {
  const rows = Array.isArray(result) ? result[0] : (result as { rows?: unknown })?.rows ?? result;
  return (Array.isArray(rows) ? rows : []) as Array<typeof castingReferenceLibrary.$inferSelect>;
}

/**
 * Every library row along one branch's ancestry, oldest first.
 *
 * **The walk, not the fold.** Retired rows come back too, and so do superseded
 * versions: which of them are live is `deriveLibrary`'s question, and it is
 * answered there because a retired newest means *gone from this branch* while a
 * retired older one means nothing at all. Filtering here would put half that
 * rule in SQL and half in TypeScript, which is how the undo inside a tree goes
 * wrong (fable-091).
 *
 * `anchorVariantId` NULL is the first edit of a face: no branch exists yet, so
 * the only rows that belong to it are the ones minted from the master.
 */
export async function listLineageReferences(input: {
  userId: number;
  candidateId: number;
  anchorVariantId: number | null;
}): Promise<StoredReference[]> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.candidateId, "candidateId");
  const db = await requireDb();

  if (input.anchorVariantId === null) {
    const rows = await db
      .select()
      .from(castingReferenceLibrary)
      .where(and(
        eq(castingReferenceLibrary.candidateId, input.candidateId),
        eq(castingReferenceLibrary.userId, input.userId),
        isNull(castingReferenceLibrary.variantId),
      ))
      .orderBy(asc(castingReferenceLibrary.createdAt), asc(castingReferenceLibrary.id));
    return rows.map(toStoredReference);
  }

  assertPositiveId(input.anchorVariantId, "anchorVariantId");
  /*
    A DEPTH COLUMN AND A CEILING, because a cycle in a self-referencing table is
    a hang rather than an error. `parentVariantId` is only ever written to a
    variant that already existed, so a cycle should be unreachable — and "should
    be unreachable" is exactly the class of thing that takes a product down at
    3am. The ceiling is far above any real chain.

    The LEFT JOIN plus `variantId IS NULL` is what makes master-minted rows
    belong to every branch: born anatomy was never delivered by a render, so
    there is no ancestor for it to hang from, and a plain join would silently
    drop her own eyes out of every library.
  */
  const rows = await db.execute(sql`
    WITH RECURSIVE ancestry (id, parentVariantId, depth) AS (
      SELECT id, parentVariantId, 0 FROM casting_candidate_variants
       WHERE id = ${input.anchorVariantId}
         AND userId = ${input.userId}
         AND candidateId = ${input.candidateId}
      UNION ALL
      SELECT v.id, v.parentVariantId, a.depth + 1
        FROM casting_candidate_variants v
        JOIN ancestry a ON v.id = a.parentVariantId
       WHERE v.userId = ${input.userId}
         AND v.candidateId = ${input.candidateId}
         AND a.depth < 512
    )
    SELECT l.* FROM casting_reference_library l
      LEFT JOIN ancestry a ON a.id = l.variantId
     WHERE l.userId = ${input.userId}
       AND l.candidateId = ${input.candidateId}
       AND (l.variantId IS NULL OR a.id IS NOT NULL)
     ORDER BY l.createdAt ASC, l.id ASC
  `);
  return asLibraryRows(rows).map(toStoredReference);
}

/**
 * Everything ever filed for this face's features, newest first — history and
 * retirements included. The panel's version history reads this.
 */
export async function listReferenceHistory(input: {
  userId: number;
  candidateId: number;
}): Promise<StoredReference[]> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.candidateId, "candidateId");
  const db = await requireDb();
  const rows = await db
    .select()
    .from(castingReferenceLibrary)
    .where(and(
      eq(castingReferenceLibrary.candidateId, input.candidateId),
      eq(castingReferenceLibrary.userId, input.userId),
    ))
    .orderBy(desc(castingReferenceLibrary.createdAt), desc(castingReferenceLibrary.id));
  return rows.map(toStoredReference);
}

/**
 * Take an introduced thing back out — on ONE branch.
 *
 * D-244 line 5 makes ordinary removal an EDIT: strike the words, regenerate
 * from the anchor with what survives, mint a new row. This is the other half —
 * dropping the introduced reference itself ("take the tattoo off"), where there
 * is no surviving state to regenerate from and the frozen anchor must stop
 * riding.
 *
 * **The row survives; only `retiredAt` moves.** It is evidence of a render that
 * was delivered, and the bytes are what a redo would need.
 *
 * It is anchored to a branch for the same reason the segment undo is: "take it
 * off" means *off the face I am looking at*. Retiring every live row for the
 * slot would reach across forks and take it off a version she never had open.
 * Scoped by owner in the statement that writes, never in a check before it.
 */
export async function retireReferenceSlot(input: {
  userId: number;
  candidateId: number;
  anchorVariantId: number;
  slot: string;
  role?: CastingReferenceRole;
  now?: Date;
}): Promise<number> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.candidateId, "candidateId");
  assertPositiveId(input.anchorVariantId, "anchorVariantId");

  const live = await listLineageReferences({
    userId: input.userId,
    candidateId: input.candidateId,
    anchorVariantId: input.anchorVariantId,
  });
  const wanted = liveReferences(live).filter((row) => row.slot === input.slot
    && (input.role === undefined || row.role === input.role));
  if (wanted.length === 0) return 0;

  const db = await requireDb();
  const result = await db
    .update(castingReferenceLibrary)
    .set({ retiredAt: input.now ?? new Date() })
    .where(and(
      inArray(castingReferenceLibrary.id, wanted.map((row) => row.id)),
      eq(castingReferenceLibrary.userId, input.userId),
      eq(castingReferenceLibrary.candidateId, input.candidateId),
      isNull(castingReferenceLibrary.retiredAt),
    ));
  return affectedRows(result);
}

/* ------------------------------------------------------------ retention */

/**
 * Every library object belonging to these candidates — read INSIDE the sweep's
 * transaction, so a reference written between the read and the delete cannot
 * slip through and outlive the face it belonged to.
 *
 * Deliberately not scoped to live rows. A retired reference's bytes are exactly
 * the ones nothing else will ever collect.
 */
export async function listPurgeableReferencesIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<Array<{ id: number; storageKey: string | null; maskKey: string | null }>> {
  if (candidateIds.length === 0) return [];
  /*
    EVERY row, including the words-only ones that hold no object at all.
    Filtering those out here would make an empty result mean two different
    things — "no rows" and "no objects" — and the caller decides whether to
    delete on the length of this list. A surface slot's row would then survive
    its own candidate.
  */
  return tx
    .select({
      id: castingReferenceLibrary.id,
      storageKey: castingReferenceLibrary.storageKey,
      maskKey: castingReferenceLibrary.maskKey,
    })
    .from(castingReferenceLibrary)
    .where(inArray(castingReferenceLibrary.candidateId, [...candidateIds]));
}

export async function deleteReferenceRowsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<number> {
  if (candidateIds.length === 0) return 0;
  const result = await tx
    .delete(castingReferenceLibrary)
    .where(inArray(castingReferenceLibrary.candidateId, [...candidateIds]));
  return affectedRows(result);
}
