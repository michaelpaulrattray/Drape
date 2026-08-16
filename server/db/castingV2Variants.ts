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
  generationOperations,
  storageCleanupBatches,
  storageCleanupItems,
  CASTING_VARIANT_OUTCOMES,
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
  /**
   * Each instruction's OWN delta, in order — INTERNAL (D-163).
   *
   * Index i lines up with `instructions[i]`. Without it, removal is not
   * arithmetic: the composed delta cannot be un-composed, because a step that
   * restated a value the chain already held leaves no trace to subtract.
   */
  stepDeltas: unknown;
  /**
   * What the user TYPED — which differs from the last instruction on a removal.
   *
   * Removal deletes steps rather than appending one, so its sentence is
   * deliberately absent from the recipe. Kept here because the in-flight ghost
   * chip (D-161) has to name the thing the person is actually waiting on.
   */
  requestText?: string | null;
  /**
   * The face she had SELECTED when she asked — the branch this edit forks from
   * (fable-091). Null for an edit made from the candidate itself.
   *
   * Public id rather than internal, because that is what a request carries and
   * because it has to be re-proved against the candidate inside the same
   * transaction (invariant 2): a parent id trusted from input is how a variant
   * would end up claiming ancestry on somebody else's face.
   */
  parentVariantPublicId?: string | null;
  /**
   * WHICH VERSION THIS ONE REPLACES, when it is a fresh take of one (fable-703).
   *
   * The same fact `landVariant` writes when the picture arrives, written four
   * minutes earlier — at the moment the decision is made rather than at the
   * moment its result lands. The wait is the whole reason: an in-place
   * regenerate is not a new version, so the rail has nothing to hang a ghost
   * chip on, and the version being redrawn sat there wearing its old render
   * with no sign anything was happening to it. The founder reported exactly
   * that: *"it just stayed the same."*
   *
   * Null on an ordinary edit, which appends a version rather than replacing
   * one — so its presence is what tells a pending row's two shapes apart.
   */
  regeneratesVariantPublicId?: string | null;
  now?: Date;
};

export type ClaimedVariant = {
  id: number;
  publicId: string;
  candidateId: number;
  sessionId: number;
  /** The branch this edit forks from — null when made from the candidate. */
  parentVariantId: number | null;
  /** The face this refinement was rendered FROM — always the ORIGINAL. */
  baseImageKey: string;
  baseInternalPrompt: unknown;
  /**
   * What was ACTUALLY written to the row — read back, not echoed.
   *
   * Wall (d) composes the prompt from this rather than from the caller's own
   * object, so a filing failure can never produce a render. Echoing the input
   * here would rebuild exactly the coupling that defeats.
   */
  deltas: unknown;
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

    /*
      THE PARENT, RE-ANCHORED TO THE CANDIDATE JUST PROVED (invariant 2).

      Verifying the candidate does not validate a variant id handed in beside
      it. A parent taken on trust would let one face's edit claim ancestry on
      another's, and the segment store reads that ancestry to decide which kept
      pixels to paste — so the consequence is a stranger's freckles on her face.
    */
    let parentVariantId: number | null = null;
    if (input.parentVariantPublicId) {
      const [parent] = await tx
        .select({ id: castingCandidateVariants.id })
        .from(castingCandidateVariants)
        .where(and(
          eq(castingCandidateVariants.publicId, input.parentVariantPublicId),
          eq(castingCandidateVariants.userId, input.userId),
          eq(castingCandidateVariants.candidateId, candidate.id),
        ))
        .limit(1);
      if (!parent) throw new VariantOwnershipError("variant");
      parentVariantId = parent.id;
    }

    const publicId = randomUUID();
    const [inserted] = await tx
      .insert(castingCandidateVariants)
      .values({
        publicId,
        // Re-anchored ids, taken from the row just proved — never from input.
        candidateId: candidate.id,
        sessionId: candidate.sessionId,
        userId: input.userId,
        /*
          THE COLUMN THIS ROW CANNOT SHIP WITHOUT — a live incident, recorded
          where the next person will meet it.

          A lineage column is additive to an EXISTING table, which made it feel
          as safe as the segment store's brand-new one. It is not. A new table
          nobody reads is inert; a new COLUMN on the table every refinement
          writes is named in the INSERT whether or not anything reads it, so a
          deploy that lands before the migration turns every refinement into
          `Unknown column 'parentVariantId'`. That deploy was live for about a
          minute before it was reverted.

          The obvious defence — omit the key so the column is omitted — DOES NOT
          WORK, and believing it would have shipped the same outage twice.
          Drizzle names every column in the schema and passes `default` for the
          ones a caller left out. Proved by dropping the column under a real
          claim rather than by reading the library:
          `castingV2-segment-store-db.test.ts`, "a variant cannot be claimed at
          all until the lineage column exists".

          So the rule is an ORDERING rule, and it is written into the ceremony:
          **the migration lands before the code, always.**
        */
        parentVariantId,
        status: "queued",
        instructions: input.instructions,
        deltas: input.deltas,
        stepDeltas: input.stepDeltas,
        requestText: input.requestText ?? null,
        /*
          AND WHAT IT IS A FRESH TAKE OF, from the first instant (fable-703).

          `regeneratedFrom` is the key `landVariant` writes on arrival and
          `readRegeneratedFrom` reads; this seeds the same key with the same
          value, so the rail can say a version is being redrawn WHILE it is
          being redrawn. Landing rewrites this object wholesale from the same
          condition, so the two can never disagree.

          The column already exists and is nullable, so no migration and no
          ordering hazard — the lesson above is about a NEW column, which this
          deliberately is not.
        */
        internalPrompt: input.regeneratesVariantPublicId
          ? { regeneratedFrom: input.regeneratesVariantPublicId }
          : null,
        pointsCost: input.pointsCost,
        operationId: input.operationId,
        createdAt: input.now ?? new Date(),
      })
      .$returningId();
    if (!inserted?.id) throw new VariantOwnershipError("variant");

    const [written] = await tx
      .select({ deltas: castingCandidateVariants.deltas })
      .from(castingCandidateVariants)
      .where(eq(castingCandidateVariants.id, inserted.id))
      .limit(1);

    return {
      id: inserted.id,
      publicId,
      candidateId: candidate.id,
      sessionId: candidate.sessionId,
      parentVariantId,
      baseImageKey: candidate.imageKey,
      baseInternalPrompt: candidate.internalPrompt,
      deltas: written?.deltas ?? null,
    };
  });
}

/**
 * WHAT THIS RENDER SENT, WRITTEN BEFORE ANYONE KNOWS WHETHER IT WORKED.
 *
 * `landVariant` records the repaint recipe on the row it lands, which covers
 * every render that succeeded and no render that did not. The five-ask proof met
 * the other half: two renders refused, both refunded correctly, and neither left
 * any account of what it had actually dispatched — so "did the recipe carry her
 * earrings, or did it send the master alone?" was unanswerable about exactly the
 * two renders where it mattered.
 *
 * This writes the same record at the moment of dispatch. On success the landing
 * overwrites `internalPrompt` wholesale with the full record — which contains
 * this same key, built from the same object — so a delivered row is unchanged by
 * this existing. On failure it is the only thing left, and it is the truth.
 *
 * SCOPED TO A ROW THAT HAS NOT LANDED. A `ready` variant's `internalPrompt` is
 * its whole record — the prompt, the resolved identity, the captions, the
 * verification — and a stray write here must not be able to reduce one to a
 * recipe. The status predicate is in the same statement as the write, per
 * invariant 1, along with the owner.
 */
export async function recordVariantDispatch(input: {
  userId: number;
  variantId: number;
  repaint: unknown;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  const db = await requireDb();
  const result = await db
    .update(castingCandidateVariants)
    .set({ internalPrompt: { repaint: input.repaint } })
    .where(and(
      eq(castingCandidateVariants.id, input.variantId),
      eq(castingCandidateVariants.userId, input.userId),
      inArray(castingCandidateVariants.status, ["queued", "dispatched"]),
    ));
  return affectedRows(result) === 1;
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
export class VariantLandingError extends Error {
  constructor(
    readonly code:
      | "operation_unavailable"
      | "not_landable"
      | "not_selectable"
      /* Its own code, not a reused one: a manifest contention sends whoever
         reads the log to the cleanup batch, and "not_selectable" would send
         them to the candidate pointer instead. This taxonomy exists for
         incident legibility, so a borrowed label is a wrong signpost. */
      | "manifest_claimed",
  ) {
    super(code);
    this.name = "VariantLandingError";
  }
}

export async function landVariant(input: {
  userId: number;
  operationId: string;
  variantId: number;
  imageKey: string;
  /** The small copy for rails and first paints, when one could be made. */
  thumbKey?: string | null;
  /**
   * The manifest holding this object until this transaction discharges it.
   *
   * Sign's register-before-write pattern, and the window it closes is real: the
   * bytes are put to a public key BEFORE any row references them, so a crash —
   * or the landing refusals above — would strand a paid picture of a person at
   * a permanent URL with nothing left that knows it exists. The key is handed
   * to the cleanup worker first; discharging the manifest here, inside the
   * transaction that makes the object referenced, is what stops the worker
   * deleting a variant somebody is looking at.
   */
  cleanupBatchId: string;
  internalPrompt: unknown;
  provider: string | null;
  providerModel: string | null;
  providerRef: string | null;
}): Promise<void> {
  assertPositiveId(input.userId, "userId");
  return withTransaction(async (tx) => {
    /*
      THE SWEEP FENCE (D-92's law 2, borrowed from Sign whole).

      A refine has ONE long await after `markRunning` — around 90 seconds — so
      a single missed heartbeat can let the lease expire while the work is very
      much alive. The recovery sweep then reads a variant that has not landed
      yet, decides to refund, and this landing commits in the gap: the user
      keeps the picture AND gets the 25 back.

      Re-proving the operation `running` FOR UPDATE inside this transaction is
      what closes it. The sweep moves the operation out of `running` before it
      touches money, so a landing that starts after that point cannot commit,
      and a landing already holding this row makes the sweep wait.

      **Every exit from here throws.** `withTransaction` is `db.transaction`,
      which COMMITS on any non-throw return — so returning a boolean on the
      pointer-move miss below would commit a `ready` variant that nothing
      points at, while the caller refunded it. One state, two verdicts.
    */
    const [operation] = await tx
      .select({ id: generationOperations.id })
      .from(generationOperations)
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.kind, "castingV2.refine"),
        eq(generationOperations.status, "running"),
      ))
      .limit(1)
      .for("update");
    if (!operation) throw new VariantLandingError("operation_unavailable");

    const landed = await tx
      .update(castingCandidateVariants)
      .set({
        status: "ready",
        imageKey: input.imageKey,
        thumbKey: input.thumbKey ?? null,
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
    if (affectedRows(landed) !== 1) throw new VariantLandingError("not_landable");

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
    /*
      Throwing rolls the landing back, which is the only correct answer.

      The candidate left `ready` during the ~90 seconds this edit took — a
      discard in another tab, a session expiry, a Sign that beat us — so there
      is nothing to point at. Committing the `ready` variant anyway would hand
      the user a listable, selectable picture that the caller then refunds in
      full, and would tell the recovery sweep a completely different story than
      it tells the caller.
    */
    if (affectedRows(selected) !== 1) throw new VariantLandingError("not_selectable");

    /*
      The object is now referenced by a row, so the manifest holding it must go
      — in this same transaction, or the worker deletes a live variant's image.
      Both halves asserted: a manifest that does not delete means something else
      already claimed it, and committing on top of that hands the worker a
      picture the user just paid for.
    */
    await tx.delete(storageCleanupItems)
      .where(eq(storageCleanupItems.batchId, input.cleanupBatchId));
    const removedBatch = await tx.delete(storageCleanupBatches).where(and(
      eq(storageCleanupBatches.id, input.cleanupBatchId),
      eq(storageCleanupBatches.userId, input.userId),
      eq(storageCleanupBatches.operationId, input.operationId),
      eq(storageCleanupBatches.status, "pending"),
    ));
    if (affectedRows(removedBatch) !== 1) throw new VariantLandingError("manifest_claimed");
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

/**
 * What became of a refinement — the satisfaction ledger's WRITER (D-175).
 *
 * The columns were designed, migrated to production in a ceremony and verified
 * by direct query — "37 variants, 0 labelled" — and nothing anywhere could ever
 * write one. The zero read as "none yet" when it meant "none possible", which
 * is the invoked-but-inert class wearing a migration.
 *
 * Owner-scoped in the statement that writes, like everything else here. Last
 * writer wins: a variant that was selected, then backed away from, then
 * selected again ends as `selected`, which is the honest present tense.
 */
export async function recordVariantOutcome(input: {
  userId: number;
  variantId: number;
  outcome: (typeof CASTING_VARIANT_OUTCOMES)[number];
  now?: Date;
}): Promise<boolean> {
  assertPositiveId(input.userId, "userId");
  const db = await requireDb();
  const result = await db
    .update(castingCandidateVariants)
    .set({ outcome: input.outcome, outcomeAt: input.now ?? new Date() })
    .where(and(
      eq(castingCandidateVariants.id, input.variantId),
      eq(castingCandidateVariants.userId, input.userId),
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
 * The refinements of one owned candidate that are still IN FLIGHT (D-161).
 *
 * The panel used to know a refine was running only from its own mutation state,
 * so closing the sheet and reopening it erased the fact — and the founder,
 * seeing nothing, bought the same edit a second time. Both renders arrived, both
 * charges stand, and the defect was never the money: it was that the product
 * knew something the person could not see.
 *
 * Owner-scoped and parent-scoped in the one statement, like every other read
 * here. Returns the user's own sentences and a timestamp, nothing else — a
 * pending row's `deltas` are as internal as a landed one's.
 */
export async function listPendingVariants(
  userId: number,
  candidatePublicId: string,
): Promise<Array<{
  publicId: string;
  instructions: unknown;
  requestText: string | null;
  createdAt: Date;
  /**
   * How far along it actually is — the only progress this pipeline has.
   *
   * `queued` means claimed and not yet handed to the image model; `dispatched`
   * means the model has it. There is nothing after that until the picture
   * lands, which is exactly why the surface says two words and no percentage.
   */
  status: "queued" | "dispatched";
  /**
   * The row's own internal record — INTERNAL, and read by the caller for ONE
   * answer: which version this row is a fresh take of (fable-703).
   *
   * It leaves this function and goes no further: the projection above turns it
   * into a public id and nothing else crosses the boundary (invariant 8).
   */
  internalPrompt: unknown;
  /**
   * WHEN THIS ROW STOPS BEING SOMEBODY'S PROMISE — the lease of the operation
   * that owns it (fable-467).
   *
   * A refine's worker renews this every 30 seconds while it lives. When the
   * worker dies the renewals stop, the lease passes, and the recovery sweep
   * takes the row over and refunds it — but the row itself still says
   * `dispatched`, because nothing has run to change it. Read as "still
   * rendering", that is a customer held shut on a render nobody is doing; the
   * founder lived five minutes of it with no way out.
   *
   * NULL only for a row whose operation is missing, which is not a state this
   * schema can reach — `operationId` is NOT NULL with a unique index — so the
   * null branch means "cannot tell", and cannot-tell reads as still running.
   */
  leaseExpiresAt: Date | null;
}>> {
  assertPositiveId(userId, "userId");
  const db = await requireDb();
  const rows = await db
    .select({
      publicId: castingCandidateVariants.publicId,
      instructions: castingCandidateVariants.instructions,
      /* What they TYPED — a removal's sentence is not in the recipe (D-163). */
      requestText: castingCandidateVariants.requestText,
      createdAt: castingCandidateVariants.createdAt,
      status: castingCandidateVariants.status,
      /* Which version this one replaces, seeded at the claim — the rail draws
         the wait on THAT chip rather than promising a new one (fable-703). */
      internalPrompt: castingCandidateVariants.internalPrompt,
      /*
        The lease travels with the row rather than being fetched beside it: the
        question "is anyone still working on this?" is about this exact
        variant, and a second statement to answer it is a second answer that
        can disagree with the first.
      */
      leaseExpiresAt: generationOperations.leaseExpiresAt,
    })
    .from(castingCandidateVariants)
    .innerJoin(castingCandidates, and(
      eq(castingCandidates.id, castingCandidateVariants.candidateId),
      eq(castingCandidates.publicId, candidatePublicId),
      eq(castingCandidates.userId, userId),
    ))
    /*
      LEFT, not inner: the operation is what tells us whether the row is still
      owned by a living worker, and it must never be able to DELETE a pending
      row from the wait. A missing operation would silently empty the list —
      the customer would see nothing in flight while a charge was out, which is
      the exact defect (D-161) this whole read exists to prevent.
    */
    .leftJoin(
      generationOperations,
      eq(generationOperations.id, castingCandidateVariants.operationId),
    )
    .where(and(
      eq(castingCandidateVariants.userId, userId),
      inArray(castingCandidateVariants.status, ["queued", "dispatched"]),
    ))
    .orderBy(asc(castingCandidateVariants.id));
  return rows.map((row) => ({
    ...row,
    /* The column is the whole variant enum; this read is fenced to two of them
       in the WHERE, so the narrowing is a fact rather than a cast. */
    status: row.status === "dispatched" ? ("dispatched" as const) : ("queued" as const),
  }));
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
