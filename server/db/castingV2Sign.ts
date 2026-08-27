/**
 * Sign-domain persistence (plan §F "Sign", D-92).
 *
 * Every statement here carries the owner in its own WHERE, like the rest of the
 * casting domain. What makes this module different from `castingV2.ts` is that
 * these statements **create authority** — a Cast, and a spent candidate — and
 * the ordering laws that follow from that are the whole design:
 *
 * **1. The durable boundary is one transaction.** A Cast, its anchor, its
 * identity snapshot and the candidate CAS commit together or not at all. There
 * is no half-signed state, so there is no half-signed state to reason about.
 *
 * **2. The Sign transaction re-proves its own operation, FOR UPDATE.** This is
 * the sweep-versus-live defence (D-92). A live process can outlive its lease —
 * one heartbeat failure stops the heartbeat permanently while the work carries
 * on — so the recovery sweep can decide this Sign is dead and refund the whole
 * price while the "dead" process is still holding an open transaction. Re-proving
 * `status='running'` under a row lock inside the commit is what makes that
 * impossible: the sweep fences the operation out of `running` FIRST, so this
 * transaction finds it gone and aborts. Without it the outcome is a Cast that
 * exists and was fully refunded.
 *
 * **3. The same shape applies per slot.** `commitPackageSlotAsset` re-proves the
 * operation too. `models.status='provisioning'` alone is NOT a fence against
 * the sweep — the model stays provisioning throughout recovery, so that
 * predicate would let a stalled generation commit a slot the sweep had already
 * refunded. The provisioning predicate fences post-activation stragglers; the
 * operation predicate fences the sweep.
 *
 * **4. `affectedRows`, never `changedRows`.** Every CAS here changes the row it
 * matches, so matched implies changed — but reading the wrong field is a defect
 * that only shows up on the day a write is a no-op, which is the worst day to
 * discover it.
 */
import type { CastingPath } from "../../shared/castingPaths";
import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, like, ne, sql } from "drizzle-orm";

import {
  castingCandidates,
  castingCandidateVariants,
  castingRolls,
  castingSessions,
  generationOperations,
  generations,
  modelAssets,
  modelIdentitySnapshots,
  modelPackageSnapshots,
  modelPackageSnapshotSlots,
  models,
  storageCleanupBatches,
  storageCleanupItems,
  type CastingCandidate,
  type Model,
  type ModelAsset,
} from "../../drizzle/schema";
import { CAST_VIEW_ANGLES, type CastViewAngle } from "../../shared/boardTypes";
import { identityStampFor } from "../casting/identity/anchorSelector";
import { CASTING_SESSION_IDLE_MS } from "./castingV2";
import { getDb, withTransaction, type TransactionHandle } from "./connection";

/** The identity recipe this ceremony writes under (D-12 provenance). */
export const CASTING_V2_SIGN_RECIPE_VERSION = "castingv2-sign-v1";

export type SignFailureCode =
  /** The operation is no longer `running` — the sweep fenced it, or it was already settled. */
  | "operation_unavailable"
  /** The candidate is gone, foreign, already signed, or no longer `ready`. */
  | "candidate_unavailable"
  /** The sheet this candidate lives on is no longer open. */
  | "session_unavailable"
  /** A write inside the boundary did not land — nothing committed. */
  | "commit_conflict";

export class SignPersistenceError extends Error {
  readonly code: SignFailureCode;
  constructor(code: SignFailureCode) {
    super(`Sign could not complete (${code})`);
    this.name = "SignPersistenceError";
    this.code = code;
  }
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) return Number((result[0] as { affectedRows?: unknown })?.affectedRows ?? 0);
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

function assertPositiveId(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Re-prove this Sign's operation inside the caller's transaction, FOR UPDATE.
 *
 * Law 2 above, and the single most important statement in this file. Called by
 * the Sign transaction and by every slot commit; NOT called by activation,
 * which is idempotent under its own `provisioning` CAS and moves no money.
 */
export async function requireRunningSignOperationIn(
  tx: TransactionHandle,
  input: { userId: number; operationId: string },
): Promise<void> {
  const [operation] = await tx
    .select({ id: generationOperations.id })
    .from(generationOperations)
    .where(and(
      eq(generationOperations.id, input.operationId),
      eq(generationOperations.userId, input.userId),
      eq(generationOperations.kind, "castingV2.sign"),
      eq(generationOperations.status, "running"),
    ))
    .limit(1)
    .for("update");
  if (!operation) throw new SignPersistenceError("operation_unavailable");
}

/* ------------------------------------------------------------ reading in */

export type SignableCandidate = {
  candidate: CastingCandidate;
  /**
   * THE FACE this Sign would spend — the selected variant, or the original.
   *
   * Not a convenience. Sign takes the image key AND the identity documents from
   * here, read in the same statement, because taking them from two places is
   * how the record comes to describe a different face than the picture: the
   * variant's image under the original's recipe. §11's first landmine.
   *
   * `variantId` is the value the CAS fence is armed with, and it is NULL for
   * every candidate that has never been refined — which is all of them until
   * a user refines one, and most of them afterwards.
   */
  face: {
    variantId: number | null;
    variantPublicId: string | null;
    imageKey: string | null;
    thumbKey: string | null;
    internalPrompt: unknown;
    /**
     * THE BRANCH'S OWN COMPOSED STATE — read in this statement and no other.
     *
     * The Sign's views carry this branch's delivered tattoos, and which ones it
     * WEARS is the composed delta's `inkDelivered`, never the delivery store's
     * full list: a Cast accumulates a crop per delivering frame, so the store
     * holds every tattoo it has ever worn while the branch wears the ones its
     * own steps left on it.
     *
     * Read HERE rather than in a second statement for the reason the field
     * above it exists: the pixels, the recipe and the branch state describing
     * one face is a property of being read together. A later read could return
     * a different branch's answer and nothing would say so.
     *
     * NULL for the pristine master, which is a real answer — a master wears no
     * tattoo, so the delivery store is not asked at all.
     */
    deltas: unknown;
  };
  roll: {
    id: number;
    publicId: string;
    briefText: string;
    cohortKey: string | null;
    styleKey: string | null;
    styleProfile: unknown;
    /**
     * The roll's compiled brief, on the join this statement already makes —
     * Sign consults `register.kind` before snapshotting the face's `resolved`
     * record, because an author-road roll's per-slice records are unsent
     * fiction (#176) and a Cast's identity documents are permanent.
     */
    compiledBrief: unknown;
    createdAt: Date;
    /**
     * THE TWO PATHS, arriving on a join this statement already makes (§3.1).
     *
     * The design promised Sign would gain both *"with no new read"*, and this
     * is that promise kept: the roll is already inner-joined here to re-anchor
     * the candidate through its owner's own parents, so the two columns cost
     * two more names in a `select` and nothing else.
     *
     * NULL on both means the sheet was cast before the paths existed — which is
     * every Cast signed to date, and the reason `currentWardrobeLine` answers
     * `unpathed` rather than guessing.
     */
    path: CastingPath | null;
    wardrobeLine: string | null;
  };
  session: { id: number; publicId: string };
};

/**
 * The candidate a Sign would spend, read owner-scoped and `ready`.
 *
 * A free refusal before anything is claimed: signing a discarded, expired or
 * foreign candidate costs the user nothing and leaves no operation to explain.
 * This read is NOT the authority — the CAS inside the boundary is, and it
 * re-proves every one of these predicates in the statement that spends the row.
 */
export async function getSignableCandidate(
  userId: number,
  candidatePublicId: string,
): Promise<SignableCandidate | null> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const [row] = await db
    .select({
      candidate: castingCandidates,
      variantId: castingCandidateVariants.id,
      variantPublicId: castingCandidateVariants.publicId,
      variantImageKey: castingCandidateVariants.imageKey,
      variantThumbKey: castingCandidateVariants.thumbKey,
      variantInternalPrompt: castingCandidateVariants.internalPrompt,
      variantDeltas: castingCandidateVariants.deltas,
      rollId: castingRolls.id,
      rollPublicId: castingRolls.publicId,
      briefText: castingRolls.briefText,
      cohortKey: castingRolls.cohortKey,
      styleKey: castingRolls.styleKey,
      styleProfile: castingRolls.styleProfile,
      rollCompiledBrief: castingRolls.compiledBrief,
      rollCreatedAt: castingRolls.createdAt,
      rollPath: castingRolls.path,
      rollWardrobeLine: castingRolls.wardrobeLine,
      sessionId: castingSessions.id,
      sessionPublicId: castingSessions.publicId,
    })
    .from(castingCandidates)
    // Re-anchored through the owner's own roll and session in one statement
    // (invariant 2): proving the candidate says nothing about the parents it
    // claims, and the Cast's lineage is written from those parents.
    .innerJoin(castingRolls, and(
      eq(castingRolls.id, castingCandidates.rollId),
      eq(castingRolls.userId, userId),
    ))
    .innerJoin(castingSessions, and(
      eq(castingSessions.id, castingCandidates.sessionId),
      eq(castingSessions.userId, userId),
    ))
    /*
      The selected refinement, if there is one — LEFT, because most candidates
      have never been refined and a candidate with no variant is signable.

      Owner-scoped in the JOIN rather than trusted from the pointer. The pointer
      is written by an owner-scoped statement, so a foreign id cannot get in
      there — but a join that reads it without saying so is a join whose safety
      depends on a fact stated somewhere else, and that is the shape invariant 1
      exists to refuse.
    */
    .leftJoin(castingCandidateVariants, and(
      eq(castingCandidateVariants.id, castingCandidates.selectedVariantId),
      eq(castingCandidateVariants.userId, userId),
      eq(castingCandidateVariants.candidateId, castingCandidates.id),
      eq(castingCandidateVariants.status, "ready"),
    ))
    .where(and(
      eq(castingCandidates.publicId, candidatePublicId),
      eq(castingCandidates.userId, userId),
      eq(castingCandidates.status, "ready"),
      isNull(castingCandidates.signedCastId),
    ))
    .limit(1);
  if (!row) return null;
  return {
    candidate: row.candidate,
    /*
      The variant wins where it exists, and the ORIGINAL is the fallback for
      every field together — never field by field. A variant that landed
      without a thumb must not borrow the original's thumb: that would show one
      face at tile size and a different one full size.
    */
    face: row.variantId
      ? {
        variantId: row.variantId,
        variantPublicId: row.variantPublicId,
        imageKey: row.variantImageKey,
        thumbKey: row.variantThumbKey,
        internalPrompt: row.variantInternalPrompt,
        deltas: row.variantDeltas,
      }
      : {
        variantId: null,
        variantPublicId: null,
        imageKey: row.candidate.imageKey,
        thumbKey: row.candidate.thumbKey,
        internalPrompt: row.candidate.internalPrompt,
        /* The pristine master, which wears nothing. */
        deltas: null,
      },
    roll: {
      id: row.rollId,
      publicId: row.rollPublicId,
      briefText: row.briefText,
      cohortKey: row.cohortKey,
      styleKey: row.styleKey,
      styleProfile: row.styleProfile,
      compiledBrief: row.rollCompiledBrief,
      createdAt: row.rollCreatedAt,
      path: row.rollPath ?? null,
      wardrobeLine: row.rollWardrobeLine ?? null,
    },
    session: { id: row.sessionId, publicId: row.sessionPublicId },
  };
}

/* ---------------------------------------------------- the durable boundary */

export type SignCandidateInput = {
  userId: number;
  operationId: string;
  candidateId: number;
  rollId: number;
  sessionId: number;
  /** Optional: an unnamed Cast shows its KI id until its owner names it. */
  name: string | null;
  cohortKey: string | null;
  styleKey: string | null;
  /** The identity documents, derived from the candidate's persisted identity. */
  masterPrompt: string;
  technicalSchema: unknown;
  preferences: unknown;
  identityText: string;
  identityRevisionId: string;
  /** Allocated under `withUniqueCastPublicId` by the caller. */
  agencyId: string;
  /**
   * The selection this Sign was quoted against — the CAS fence's second arm.
   *
   * NULL means "the original was selected when we read it", which is the case
   * for every candidate that has never been refined. Passing the value that was
   * READ, rather than re-reading it here, is the whole point: a selection
   * switched between the quote and the commit lands as `commit_conflict` and
   * refunds, exactly as a racing discard already does. Without it, a Sign could
   * snapshot one face's documents and copy another face's pixels.
   */
  selectedVariantId: number | null;
  /** The candidate image, already copied to a key this Cast owns. */
  anchor: { storageKey: string; storageUrl: string; provenance?: Record<string, unknown> };
  /** The manifest that owns that copy until this transaction discharges it. */
  cleanupBatchId: string;
  now?: Date;
};

export type SignedCastRecord = {
  modelId: number;
  agencyId: string;
  anchorAssetId: number;
  identitySnapshotId: string;
  identityRevisionId: string;
};

/**
 * The durable boundary: everything that makes a Cast exist, in one transaction.
 *
 * Order inside it is not arbitrary. The operation is re-proved first because
 * every later write is wasted if this Sign has been fenced. The session row is
 * locked before the candidate is spent, matching `expireSessionCandidates`
 * (session → candidates) so the two can never deadlock against each other, and
 * because that lock is what stops the retention sweep expiring the kept
 * siblings of a Cast that is being signed right now.
 *
 * The candidate CAS comes last among the writes and **throws** on loss rather
 * than returning: inside `withTransaction`, a throw is the rollback. A double
 * Sign of one candidate therefore leaves exactly one Cast and one spent
 * candidate, and the loser's model insert disappears with its transaction.
 */
export async function signCandidateIntoCast(
  input: SignCandidateInput,
): Promise<SignedCastRecord> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.candidateId, "candidateId");
  assertPositiveId(input.rollId, "rollId");
  assertPositiveId(input.sessionId, "sessionId");
  const now = input.now ?? new Date();

  return withTransaction(async (tx) => {
    await requireRunningSignOperationIn(tx, input);

    const [session] = await tx
      .select({ id: castingSessions.id })
      .from(castingSessions)
      .where(and(
        eq(castingSessions.id, input.sessionId),
        eq(castingSessions.userId, input.userId),
        eq(castingSessions.status, "open"),
      ))
      .limit(1)
      .for("update");
    if (!session) throw new SignPersistenceError("session_unavailable");

    const [insertedModel] = await tx
      .insert(models)
      .values({
        userId: input.userId,
        name: input.name,
        masterPrompt: input.masterPrompt,
        technicalSchema: input.technicalSchema,
        preferences: input.preferences,
        agencyId: input.agencyId,
        /*
          `provisioning`: invisible and under construction. Every legacy
          procedure already treats it as unavailable, which is exactly what the
          Sign→package window needs — a Cast that exists, is owned, and cannot
          be edited, minted, forked or listed until its package is terminal.
        */
        status: "provisioning",
        identityRevisionId: input.identityRevisionId,
        cohortKey: input.cohortKey,
        styleKey: input.styleKey,
        sourceCandidateId: input.candidateId,
        sourceRollId: input.rollId,
        stateVersion: 0,
      })
      .$returningId();
    if (!insertedModel?.id) throw new SignPersistenceError("commit_conflict");
    const modelId = insertedModel.id;

    /*
      THE ANCHOR IS THE FACE THEY CHOSE, not a re-render of it.

      Stamped `role: 'anchor'` so `selectIdentityAnchor` keeps choosing it after
      the 2K frontClose view lands — that view is stamped `display`, is newer,
      and would otherwise become the anchor, quietly making every future
      identity operation drift from a generated copy instead of the signed
      original.
    */
    const [insertedAnchor] = await tx
      .insert(modelAssets)
      .values({
        modelId,
        viewType: "frontClose",
        resolution: "1K",
        storageUrl: input.anchor.storageUrl,
        storageKey: input.anchor.storageKey,
        pointsCost: 0,
        pinned: false,
        provenance: {
          ...(input.anchor.provenance ?? {}),
          source: "castingV2.sign",
          ...identityStampFor({
            role: "anchor",
            revisionId: input.identityRevisionId,
            identityText: input.identityText,
          }),
        },
      })
      .$returningId();
    if (!insertedAnchor?.id) throw new SignPersistenceError("commit_conflict");
    const anchorAssetId = insertedAnchor.id;

    const identitySnapshotId = randomUUID();
    await tx.insert(modelIdentitySnapshots).values({
      id: identitySnapshotId,
      modelId,
      sequence: 1,
      parentSnapshotId: null,
      restoredFromSnapshotId: null,
      reason: "create",
      masterPrompt: input.masterPrompt,
      technicalSchema: input.technicalSchema,
      preferences: input.preferences,
      identityText: input.identityText,
      identityTextHash: sha256(input.identityText),
      anchorAssetId,
      recipeVersion: CASTING_V2_SIGN_RECIPE_VERSION,
      /*
        The RECOVERY LOCATOR, and the reason this column is written here.

        `generation_operations` has no payload column — only a hash — so a
        crashed Sign cannot be traced back to its candidate through the
        operation. This row can: it is written inside the boundary and nowhere
        else, so its existence *is* the proof the transaction committed, and it
        names the model. The FORK VARIABLE remains `casting_candidates.signedCastId`
        (D-92); this is only how the adjudicator finds the row to ask.
      */
      createdByOperationId: input.operationId,
    });

    /*
      THE CANDIDATE CAS — the double-Sign defence.

      `UNIQUE(signedCastId)` is a backstop that prevents two candidates claiming
      one Cast; it does nothing about two Signs of one candidate, because each
      would carry a different Cast id. This statement is what makes that
      impossible, and it re-proves ownership and `ready` in the same breath, so
      a Sign racing a discard loses to whichever commits first.
    */
    const claimed = await tx
      .update(castingCandidates)
      .set({ status: "signed", signedCastId: modelId })
      .where(and(
        eq(castingCandidates.id, input.candidateId),
        eq(castingCandidates.userId, input.userId),
        eq(castingCandidates.status, "ready"),
        isNull(castingCandidates.signedCastId),
        /*
          The SELECTION FENCE — and it is written null-safe on purpose.

          `selectedVariantId` is NULL for every candidate nobody has refined,
          and in SQL `x = NULL` is never true. Written as an ordinary equality
          this predicate would match nothing, so EVERY Sign in the product
          would fail `candidate_unavailable` and refund — a total outage that
          the happy-path tests would still catch, but only after the shape had
          been reasoned about wrongly. `<=>` is NULL-equals-NULL, so "nothing
          was selected then and nothing is selected now" passes.
        */
        sql`${castingCandidates.selectedVariantId} <=> ${input.selectedVariantId}`,
      ));
    if (affectedRows(claimed) !== 1) throw new SignPersistenceError("candidate_unavailable");

    // The sheet stays open — multiple Signs per session are legal (§G) — and
    // its idle window slides, because signing is the most active thing a user
    // can do on it.
    await tx
      .update(castingSessions)
      .set({
        signedCastCount: sql`${castingSessions.signedCastCount} + 1`,
        expiresAt: new Date(now.getTime() + CASTING_SESSION_IDLE_MS),
      })
      .where(and(
        eq(castingSessions.id, input.sessionId),
        eq(castingSessions.userId, input.userId),
      ));

    /*
      DISCHARGE THE ORPHAN-COPY MANIFEST.

      The copy was registered for deletion *before* it was made, so a crash
      between the copy and this commit leaves a pending cleanup batch that the
      worker deletes. Deleting the manifest here, inside the same transaction
      that makes the object referenced, is what stops the worker deleting an
      object the Cast now depends on. Both halves are asserted: a manifest that
      does not delete means something else already claimed it, and committing on
      top of that would hand the worker a live Cast's anchor.
    */
    await tx.delete(storageCleanupItems)
      .where(eq(storageCleanupItems.batchId, input.cleanupBatchId));
    const removedBatch = await tx.delete(storageCleanupBatches).where(and(
      eq(storageCleanupBatches.id, input.cleanupBatchId),
      eq(storageCleanupBatches.userId, input.userId),
      eq(storageCleanupBatches.operationId, input.operationId),
      eq(storageCleanupBatches.status, "pending"),
    ));
    if (affectedRows(removedBatch) !== 1) throw new SignPersistenceError("commit_conflict");

    return {
      modelId,
      agencyId: input.agencyId,
      anchorAssetId,
      identitySnapshotId,
      identityRevisionId: input.identityRevisionId,
    };
  });
}

/* --------------------------------------------------- provisioning writers */

/**
 * One package view lands.
 *
 * A provisioning-scoped writer, following the `evidenceFork` precedent: a
 * direct insert inside the Sign operation rather than the fenced
 * standard fenced snapshot-transition writers, which are gated on available
 * statuses that
 * `provisioning` deliberately is not.
 *
 * Both fences are load-bearing and neither replaces the other: the operation
 * predicate keeps the recovery sweep and this process from both settling one
 * slot, and the `provisioning` predicate stops a straggler generation writing
 * into a Cast that has already been activated and shown to its owner.
 *
 * Returns `null` when the write did not land, so the caller can delete the
 * object it just stored rather than orphaning it in the bucket.
 */
export async function commitPackageSlotAsset(input: {
  userId: number;
  operationId: string;
  modelId: number;
  angle: CastViewAngle;
  storageKey: string;
  storageUrl: string;
  identityRevisionId: string;
  identityText: string;
  pointsCost: number;
  provenance: Record<string, unknown>;
}): Promise<number | null> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  try {
    return await withTransaction(async (tx) => {
      await requireRunningSignOperationIn(tx, input);
      const [model] = await tx
        .select({ id: models.id })
        .from(models)
        .where(and(
          eq(models.id, input.modelId),
          eq(models.userId, input.userId),
          eq(models.status, "provisioning"),
          isNull(models.deletedAt),
        ))
        .limit(1)
        .for("update");
      if (!model) throw new SignPersistenceError("commit_conflict");

      const [inserted] = await tx
        .insert(modelAssets)
        .values({
          modelId: input.modelId,
          viewType: input.angle,
          // §H.10: signed package views are 2K.
          resolution: "2K",
          storageUrl: input.storageUrl,
          storageKey: input.storageKey,
          pointsCost: input.pointsCost,
          pinned: false,
          provenance: {
            ...input.provenance,
            // `display`, never `anchor` — see the anchor comment above.
            ...identityStampFor({
              role: "display",
              revisionId: input.identityRevisionId,
              identityText: input.identityText,
            }),
          },
        })
        .$returningId();
      if (!inserted?.id) throw new SignPersistenceError("commit_conflict");
      return inserted.id;
    });
  } catch (error) {
    if (error instanceof SignPersistenceError) return null;
    throw error;
  }
}

export type SlotFailureRecord = {
  reason: string;
  refunded: number;
  refundReference: string;
  /** The per-axis verdict, so a dispute is answerable from the record. */
  conformance?: unknown;
};

/**
 * A view that will not be arriving, written down.
 *
 * `mintPackage`'s durable-marker idiom (a row with no `storageUrl` carrying a
 * failed status), because the room reads slots from the asset ledger and a
 * failure that exists only in a log is a failure the customer's screen cannot
 * confess to. It carries what actually happened — including `refunded: 0` when
 * the refund itself did not record — so the room never claims money moved that
 * did not.
 */
export async function recordPackageSlotFailure(input: {
  userId: number;
  operationId: string;
  modelId: number;
  angle: CastViewAngle;
  failure: SlotFailureRecord;
  now?: Date;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  const at = (input.now ?? new Date()).toISOString();
  try {
    return await withTransaction(async (tx) => {
      await requireRunningSignOperationIn(tx, input);
      const [model] = await tx
        .select({ id: models.id })
        .from(models)
        .where(and(
          eq(models.id, input.modelId),
          eq(models.userId, input.userId),
          eq(models.status, "provisioning"),
          isNull(models.deletedAt),
        ))
        .limit(1)
        .for("update");
      if (!model) throw new SignPersistenceError("commit_conflict");
      await tx.insert(modelAssets).values({
        modelId: input.modelId,
        viewType: input.angle,
        resolution: "2K",
        storageUrl: "",
        storageKey: null,
        pointsCost: 0,
        pinned: false,
        status: {
          state: "failed",
          reason: input.failure.reason,
          refunded: input.failure.refunded,
          refundReference: input.failure.refundReference,
          ...(input.failure.conformance ? { conformance: input.failure.conformance } : {}),
          at,
        },
        provenance: { source: "castingV2.sign" },
      });
      return true;
    });
  } catch (error) {
    if (error instanceof SignPersistenceError) return false;
    throw error;
  }
}

/**
 * The failure record the recovery sweep writes for a slot nobody settled.
 *
 * Separate from `recordPackageSlotFailure` because the sweep has, by
 * construction, already fenced the operation out of `running` — the predicate
 * that makes the live writer safe is exactly the predicate the sweep can no
 * longer satisfy. The fence is what makes this safe instead: once the operation
 * has left `running`, no live process can commit this slot, so there is nothing
 * left to race.
 */
export async function recordRecoveredSlotFailure(input: {
  userId: number;
  modelId: number;
  angle: CastViewAngle;
  failure: SlotFailureRecord;
  now?: Date;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  const at = (input.now ?? new Date()).toISOString();
  const db = await requireDb();
  const [model] = await db
    .select({ id: models.id })
    .from(models)
    .where(and(
      eq(models.id, input.modelId),
      eq(models.userId, input.userId),
      isNull(models.deletedAt),
    ))
    .limit(1);
  if (!model) return false;
  await db.insert(modelAssets).values({
    modelId: input.modelId,
    viewType: input.angle,
    resolution: "2K",
    storageUrl: "",
    storageKey: null,
    pointsCost: 0,
    pinned: false,
    status: {
      state: "failed",
      reason: input.failure.reason,
      refunded: input.failure.refunded,
      refundReference: input.failure.refundReference,
      ...(input.failure.conformance ? { conformance: input.failure.conformance } : {}),
      at,
    },
    provenance: { source: "castingV2.sign.recovery" },
  });
  return true;
}

/**
 * The per-view audit rows a Sign opened — its durable promise.
 *
 * Written before any view is generated, so their existence records what the
 * customer paid for rather than what this deploy would sell them. Recovery
 * reads this instead of the profile constant; see `promisedPackageAngles`.
 */
export async function listOperationViewSteps(
  operationId: string,
): Promise<Array<{ viewAngle: string | null }>> {
  const db = await requireDb();
  return db
    .select({ viewAngle: generations.viewAngle })
    .from(generations)
    .where(and(
      eq(generations.operationId, operationId),
      like(generations.stepKey, "view:%"),
    ));
}

/**
 * The views a CAST was promised, from the audit rows its Sign opened.
 *
 * Same durable source `promisedPackageAngles` reads, keyed by the model rather
 * than the operation so the room can use it without knowing which Sign built
 * this Cast. It is what lets a finished Cast confess to a slot that produced
 * nothing at all: an asset can be missing, but the promise cannot.
 */
export async function listCastPromisedAngles(
  userId: number,
  modelId: number,
): Promise<CastViewAngle[]> {
  assertPositiveId(userId, "userId");
  assertPositiveId(modelId, "modelId");
  const db = await requireDb();
  const rows = await db
    .select({ viewAngle: generations.viewAngle })
    .from(generations)
    .innerJoin(models, and(eq(models.id, generations.modelId), eq(models.userId, userId)))
    .where(and(
      eq(generations.modelId, modelId),
      like(generations.stepKey, "view:%"),
    ));
  const seen = new Set(rows.map((row) => row.viewAngle));
  return CAST_VIEW_ANGLES.filter((angle) => seen.has(angle));
}

/**
 * The living Casts a sheet produced — names, for the delete confirmation.
 *
 * The confirm copy has to say what SURVIVES ("Two casts came from this sheet —
 * they're safe"), and a count alone would make that a claim the user has to
 * take on faith about their own work. Names make it checkable.
 *
 * Living means `deletedAt IS NULL`, not `availableModelWhere()` — a Cast whose
 * package is still building is `provisioning`, and she is exactly as safe as a
 * finished one (D-107).
 */
export async function listSessionSignedCastNames(
  userId: number,
  sessionId: number,
): Promise<string[]> {
  assertPositiveId(userId, "userId");
  assertPositiveId(sessionId, "sessionId");
  const db = await requireDb();
  const rows = await db
    .select({ name: models.name, agencyId: models.agencyId })
    .from(castingCandidates)
    .innerJoin(models, and(
      eq(models.id, castingCandidates.signedCastId),
      eq(models.userId, userId),
      isNull(models.deletedAt),
    ))
    .where(and(
      eq(castingCandidates.sessionId, sessionId),
      eq(castingCandidates.userId, userId),
      isNotNull(castingCandidates.signedCastId),
    ))
    .orderBy(asc(castingCandidates.id));
  return rows.map((row) => row.name ?? row.agencyId ?? "Unnamed");
}

/** Every asset row of an owned Cast, newest first (the ledger's own order). */
export async function listCastAssets(userId: number, modelId: number): Promise<ModelAsset[]> {
  assertPositiveId(userId, "userId");
  assertPositiveId(modelId, "modelId");
  const db = await requireDb();
  return db
    .select({ asset: modelAssets })
    .from(modelAssets)
    .innerJoin(models, and(eq(models.id, modelAssets.modelId), eq(models.userId, userId)))
    .where(eq(modelAssets.modelId, modelId))
    .orderBy(desc(modelAssets.id))
    .then((rows) => rows.map((row) => row.asset));
}

/* -------------------------------------------------------------- activation */

export type ActivationOutcome =
  | { type: "activated"; modelId: number; packageSnapshotId: string; slots: CastViewAngle[] }
  /** Someone else activated first. Their activation stands. */
  | { type: "already_active"; modelId: number }
  | { type: "unavailable" };

/**
 * `provisioning → active`: the package's terminal transition.
 *
 * Assembled from the durable asset rows rather than from anything the building
 * process remembered, which is what lets the recovery adjudicator run this
 * exact function after a crash and reach the same Cast. Committed views stand;
 * missing ones simply have no slot, and the room confesses to them.
 *
 * **The headshot slot always fills**, and that is a deliberate structural
 * guarantee rather than a convenience. `buildEffectiveCastState` refuses a
 * package with no `frontClose` selection (`displayed_headshot_missing`), so if
 * the 2K headshot were the only thing that could fill that slot, a single
 * provider failure would produce a Cast the snapshot authority cannot read.
 * The 1K anchor is a real filled `frontClose` asset, so it fills the slot when
 * the re-render did not arrive. The customer still gets their 50 credits back
 * for the view that failed — what they keep is the face they signed, which they
 * had already paid for on the sheet.
 */
export async function activateSignedCast(input: {
  userId: number;
  operationId: string;
  modelId: number;
  now?: Date;
}): Promise<ActivationOutcome> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.modelId, "modelId");
  const now = input.now ?? new Date();

  return withTransaction(async (tx) => {
    const [model] = await tx
      .select()
      .from(models)
      .where(and(
        eq(models.id, input.modelId),
        eq(models.userId, input.userId),
        isNull(models.deletedAt),
      ))
      .limit(1)
      .for("update");
    if (!model) return { type: "unavailable" };
    if (model.status !== "provisioning") {
      return model.currentPackageSnapshotId
        ? { type: "already_active", modelId: model.id }
        : { type: "unavailable" };
    }

    const [identity] = await tx
      .select()
      .from(modelIdentitySnapshots)
      .where(and(
        eq(modelIdentitySnapshots.modelId, model.id),
        eq(modelIdentitySnapshots.createdByOperationId, input.operationId),
      ))
      .limit(1);
    if (!identity) return { type: "unavailable" };

    const assets = await tx
      .select()
      .from(modelAssets)
      .where(eq(modelAssets.modelId, model.id))
      .orderBy(desc(modelAssets.id));

    /*
      Newest filled row per angle wins, which is the repo's settled
      newest-filled selection law. The anchor is the oldest `frontClose` row, so
      it is chosen only when no 2K headshot landed — exactly the fallback the
      comment above describes.
    */
    const filledByAngle = new Map<CastViewAngle, number>();
    for (const asset of assets) {
      if (!asset.storageUrl) continue;
      const angle = asset.viewType as CastViewAngle;
      if (!(CAST_VIEW_ANGLES as readonly string[]).includes(angle)) continue;
      if (!filledByAngle.has(angle)) filledByAngle.set(angle, asset.id);
    }
    if (!filledByAngle.has("frontClose")) {
      // Structurally unreachable: the anchor is inserted inside the same
      // transaction that created this model. If it ever happens, refusing to
      // activate is right — an unreadable Cast is worse than one that stays
      // invisible until support looks at it.
      return { type: "unavailable" };
    }

    const packageSnapshotId = randomUUID();
    await tx.insert(modelPackageSnapshots).values({
      id: packageSnapshotId,
      modelId: model.id,
      identitySnapshotId: identity.id,
      sequence: 1,
      parentPackageSnapshotId: null,
      reason: "mint",
      createdByOperationId: input.operationId,
    });
    const slotAngles = CAST_VIEW_ANGLES.filter((angle) => filledByAngle.has(angle));
    await tx.insert(modelPackageSnapshotSlots).values(
      slotAngles.map((angle) => ({
        id: randomUUID(),
        packageSnapshotId,
        viewAngle: angle,
        selectedAssetId: filledByAngle.get(angle)!,
        compatibility: "current" as const,
        selectionReason: "generated" as const,
        sourceSelectionId: null,
      })),
    );

    const activated = await tx
      .update(models)
      .set({
        status: "active",
        mintedAt: now,
        currentPackageSnapshotId: packageSnapshotId,
        // Pointer and stateVersion move together or `buildEffectiveCastState`
        // refuses the pair (`snapshot_pointer_state`).
        stateVersion: 1,
        sealedIdentitySnapshotId: identity.id,
        sealedPackageSnapshotId: packageSnapshotId,
      })
      .where(and(
        eq(models.id, model.id),
        eq(models.userId, input.userId),
        eq(models.status, "provisioning"),
        eq(models.stateVersion, 0),
        isNull(models.currentPackageSnapshotId),
        isNull(models.deletedAt),
      ));
    if (affectedRows(activated) !== 1) throw new SignPersistenceError("commit_conflict");
    return { type: "activated", modelId: model.id, packageSnapshotId, slots: [...slotAngles] };
  });
}

/* ---------------------------------------------------------- recovery reads */

export type SignedCastLocation = {
  modelId: number;
  modelStatus: Model["status"];
  agencyId: string | null;
  identityRevisionId: string | null;
  identitySnapshotId: string;
  identityText: string;
  anchorAssetId: number;
  candidateId: number;
  candidatePublicId: string;
  candidateSignedCastId: number | null;
  candidateStatus: string;
};

/**
 * Find the Cast a Sign operation created, if it created one.
 *
 * The existence of this row is the proof the durable boundary committed — it is
 * written inside that transaction and nowhere else. The verdict is then taken
 * from `casting_candidates.signedCastId` (D-92's fork variable), which this
 * returns alongside so the caller can prove the two agree rather than trusting
 * the locator.
 *
 * Never `generation_operations.modelId`: that column is bound at activation, so
 * a Sign that crashed mid-package has a Cast and an unbound operation, and an
 * adjudicator keyed on it would conclude nothing was ever created.
 */
export async function findCastBySignOperation(
  userId: number,
  operationId: string,
): Promise<SignedCastLocation | null> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const [row] = await db
    .select({
      modelId: models.id,
      modelStatus: models.status,
      agencyId: models.agencyId,
      identityRevisionId: models.identityRevisionId,
      identitySnapshotId: modelIdentitySnapshots.id,
      identityText: modelIdentitySnapshots.identityText,
      anchorAssetId: modelIdentitySnapshots.anchorAssetId,
      sourceCandidateId: models.sourceCandidateId,
    })
    .from(modelIdentitySnapshots)
    .innerJoin(models, and(
      eq(models.id, modelIdentitySnapshots.modelId),
      eq(models.userId, userId),
    ))
    .where(eq(modelIdentitySnapshots.createdByOperationId, operationId))
    .limit(1);
  if (!row || !row.sourceCandidateId) return null;

  const [candidate] = await db
    .select({
      id: castingCandidates.id,
      publicId: castingCandidates.publicId,
      signedCastId: castingCandidates.signedCastId,
      status: castingCandidates.status,
    })
    .from(castingCandidates)
    .where(and(
      eq(castingCandidates.id, row.sourceCandidateId),
      eq(castingCandidates.userId, userId),
    ))
    .limit(1);
  if (!candidate) return null;

  return {
    modelId: row.modelId,
    modelStatus: row.modelStatus,
    agencyId: row.agencyId,
    identityRevisionId: row.identityRevisionId,
    identitySnapshotId: row.identitySnapshotId,
    identityText: row.identityText,
    anchorAssetId: row.anchorAssetId,
    candidateId: candidate.id,
    candidatePublicId: candidate.publicId,
    candidateSignedCastId: candidate.signedCastId,
    candidateStatus: candidate.status,
  };
}

/** One owned Cast by its KI public id, in any status including `provisioning`. */
export async function getOwnedCastByPublicId(
  userId: number,
  agencyId: string,
): Promise<Model | null> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const [model] = await db
    .select()
    .from(models)
    .where(and(
      eq(models.agencyId, agencyId),
      eq(models.userId, userId),
      isNull(models.deletedAt),
      ne(models.status, "archived"),
    ))
    .limit(1);
  return model ?? null;
}

export type CastLineage = {
  rollPublicId: string | null;
  rollIndex: number | null;
  sessionPublicId: string | null;
  candidatePublicId: string | null;
  personaLine: string | null;
  castFromAt: Date | null;
};

/**
 * Where a Cast came from, as public ids.
 *
 * The `models` lineage columns hold internal numeric ids, which must never
 * leave the server (§J). Both halves are nullable and the asymmetry is real:
 * the source candidate survives with its Cast (§G.6) but a Cast whose sheet was
 * purged still knows the date it was cast on.
 */
export async function getCastLineage(
  userId: number,
  model: Pick<Model, "sourceRollId" | "sourceCandidateId">,
): Promise<CastLineage> {
  assertPositiveId(userId, "userId");
  const empty: CastLineage = {
    rollPublicId: null,
    rollIndex: null,
    sessionPublicId: null,
    candidatePublicId: null,
    personaLine: null,
    castFromAt: null,
  };
  if (!model.sourceRollId && !model.sourceCandidateId) return empty;
  const db = await requireDb();

  const [roll] = model.sourceRollId
    ? await db
      .select({
        publicId: castingRolls.publicId,
        rollIndex: castingRolls.rollIndex,
        createdAt: castingRolls.createdAt,
        sessionPublicId: castingSessions.publicId,
      })
      .from(castingRolls)
      .innerJoin(castingSessions, and(
        eq(castingSessions.id, castingRolls.sessionId),
        eq(castingSessions.userId, userId),
      ))
      .where(and(eq(castingRolls.id, model.sourceRollId), eq(castingRolls.userId, userId)))
      .limit(1)
    : [];

  const [candidate] = model.sourceCandidateId
    ? await db
      .select({
        publicId: castingCandidates.publicId,
        personaLine: castingCandidates.personaLine,
      })
      .from(castingCandidates)
      .where(and(
        eq(castingCandidates.id, model.sourceCandidateId),
        eq(castingCandidates.userId, userId),
      ))
      .limit(1)
    : [];

  return {
    rollPublicId: roll?.publicId ?? null,
    rollIndex: roll?.rollIndex ?? null,
    sessionPublicId: roll?.sessionPublicId ?? null,
    candidatePublicId: candidate?.publicId ?? null,
    personaLine: candidate?.personaLine ?? null,
    castFromAt: roll?.createdAt ?? null,
  };
}

/**
 * Signed candidates → the public id of the Cast each became.
 *
 * Owner-scoped through `models` in the same statement, so a candidate row
 * carrying a foreign `signedCastId` resolves to nothing rather than leaking
 * another account's Cast id onto this user's sheet.
 */
export async function listCastPublicIdsForCandidates(
  userId: number,
  candidates: readonly { id: number; signedCastId: number | null }[],
): Promise<Map<number, string>> {
  assertPositiveId(userId, "userId");
  const signed = candidates.filter((candidate) => candidate.signedCastId !== null);
  if (signed.length === 0) return new Map();
  const db = await requireDb();
  const rows = await db
    .select({ modelId: models.id, agencyId: models.agencyId })
    .from(models)
    .where(and(
      inArray(models.id, signed.map((candidate) => candidate.signedCastId!)),
      eq(models.userId, userId),
      isNull(models.deletedAt),
    ));
  const byModelId = new Map(rows.map((row) => [row.modelId, row.agencyId]));
  const result = new Map<number, string>();
  for (const candidate of signed) {
    const agencyId = byModelId.get(candidate.signedCastId!);
    if (agencyId) result.set(candidate.id, agencyId);
  }
  return result;
}

/**
 * This account's signed Casts, newest first — the roster read.
 *
 * Includes `provisioning`: a Cast whose package is still building has been paid
 * for and must be reachable, which is the whole point of this query existing.
 * Legacy surfaces correctly exclude that status; an owner-scoped V2 read does
 * not (plan §F).
 */
export async function listSignedCasts(
  userId: number,
  limit = 60,
): Promise<Array<{
  model: Model;
  anchorUrl: string | null;
  personaLine: string | null;
}>> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const rows = await db
    .select()
    .from(models)
    .where(and(
      eq(models.userId, userId),
      inArray(models.status, ["provisioning", "active", "locked"]),
      isNull(models.deletedAt),
      // V2 Casts only: a Cast made by Sign carries the candidate it came from.
      isNotNull(models.sourceCandidateId),
    ))
    .orderBy(desc(models.id))
    .limit(limit);
  if (rows.length === 0) return [];

  const assets = await db
    .select({ modelId: modelAssets.modelId, storageUrl: modelAssets.storageUrl, id: modelAssets.id })
    .from(modelAssets)
    .where(and(
      inArray(modelAssets.modelId, rows.map((row) => row.id)),
      eq(modelAssets.viewType, "frontClose"),
    ))
    .orderBy(asc(modelAssets.id));
  const faceByModel = new Map<number, string>();
  for (const asset of assets) {
    // Oldest filled frontClose = the anchor: the face they signed, which is
    // present from the durable boundary onward and never depends on a view
    // having landed.
    if (asset.storageUrl && !faceByModel.has(asset.modelId)) {
      faceByModel.set(asset.modelId, asset.storageUrl);
    }
  }

  const candidates = await db
    .select({ id: castingCandidates.id, personaLine: castingCandidates.personaLine })
    .from(castingCandidates)
    .where(and(
      inArray(
        castingCandidates.id,
        rows.map((row) => row.sourceCandidateId!).filter((id): id is number => id !== null),
      ),
      eq(castingCandidates.userId, userId),
    ));
  const lineByCandidate = new Map(candidates.map((row) => [row.id, row.personaLine]));

  return rows.map((model) => ({
    model,
    anchorUrl: faceByModel.get(model.id) ?? null,
    personaLine: model.sourceCandidateId
      ? lineByCandidate.get(model.sourceCandidateId) ?? null
      : null,
  }));
}

/**
 * A Cast's siblings: the faces kept on the same sheet, minus herself.
 *
 * "Variants cast from the same sheet. Useful when a campaign needs a near-miss
 * rather than a new face." Scoped to the SESSION rather than the roll, because
 * a shortlist crosses rolls — that is what the tray is for — and a sibling from
 * roll 1 is every bit as near a miss as one from roll 3.
 *
 * **Only KEPT candidates**, and that is a retention fact rather than a taste
 * one: §G.6 protects the kept siblings of a signed Cast from sheet expiry
 * precisely so this card keeps working for as long as she lives. An unkept
 * candidate is purged with its session, so listing one would be promising a
 * face that disappears in seven days.
 */
/**
 * The two statuses a face can be in and still be somebody's sibling.
 *
 * Named rather than inlined because the deletion ceremony has to know it: a
 * Cast deleted off a dead sheet must land on a status that is NOT in this list,
 * or she haunts every surviving Cast's card forever (fable-367 §1, and she did
 * — production candidate `ea5b4811`). `castLineagePurge.test.ts` asserts the
 * status it retires her to against THIS array, so the two cannot drift apart
 * the way a second copy of the list would.
 */
export const SIBLING_VISIBLE_STATUSES = ["ready", "signed"] as const;
export async function listCastSiblings(input: {
  userId: number;
  sessionId: number;
  excludeCandidateId: number;
  limit?: number;
}): Promise<CastingCandidate[]> {
  assertPositiveId(input.userId, "userId");
  assertPositiveId(input.sessionId, "sessionId");
  const db = await requireDb();
  return db
    .select()
    .from(castingCandidates)
    .where(and(
      eq(castingCandidates.sessionId, input.sessionId),
      eq(castingCandidates.userId, input.userId),
      isNotNull(castingCandidates.keptAt),
      ne(castingCandidates.id, input.excludeCandidateId),
      inArray(castingCandidates.status, [...SIBLING_VISIBLE_STATUSES]),
    ))
    .orderBy(asc(castingCandidates.keptAt))
    .limit(input.limit ?? 6);
}

/**
 * The session a Cast was signed from, resolved owner-scoped from her candidate.
 *
 * Needed by the siblings read, which is session-scoped; the Cast itself only
 * records the candidate and the roll.
 */
export async function getCastSessionId(
  userId: number,
  candidateId: number,
): Promise<{ id: number; live: boolean } | null> {
  assertPositiveId(userId, "userId");
  assertPositiveId(candidateId, "candidateId");
  const db = await requireDb();
  /*
    LIVENESS, not just the id — and it is the difference between a link and a
    dead one.

    A signed Cast's kept siblings are protected by the §G.6 retention exemption
    for as long as she lives, but that exemption covers the CANDIDATE rows and
    their objects. The SHEET they came from expires on its own seven-day clock.
    So "open the sheet she came from" is a link that rots quietly: the faces are
    still there, the page they lived on is not.

    Joined here rather than read separately so a caller cannot forget to ask.
  */
  const [row] = await db
    .select({
      sessionId: castingCandidates.sessionId,
      status: castingSessions.status,
    })
    .from(castingCandidates)
    .innerJoin(castingSessions, eq(castingSessions.id, castingCandidates.sessionId))
    .where(and(eq(castingCandidates.id, candidateId), eq(castingCandidates.userId, userId)))
    .limit(1);
  if (!row) return null;
  return { id: row.sessionId, live: row.status === "open" };
}
