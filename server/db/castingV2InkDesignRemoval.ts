/**
 * REMOVING ONE DESIGN — the customer's own delete (ruled fable-1138 §3).
 *
 * # Why this exists at all
 *
 * opus-841 §4 made the shown cut the flip's precondition in the words *"see or
 * reject"*, and until this landed **reject had no road**: the only deletion of a
 * design anywhere in the product was the sweep taking it with its whole Cast
 * (`candidateRetention.ts`). A customer who disliked what the cutter made of her
 * design could destroy her Cast or live with it, and a studio holding its eight
 * (`INK_DESIGNS_PER_CANDIDATE`) stayed full forever.
 *
 * # Its own file, not a sixth function on the store
 *
 * `castingV2InkDesigns.ts` is the WRITE-and-READ store and its purge helpers are
 * the sweep's — they take a transaction handle because they run inside the
 * sweep's transaction, on the sweep's manifest. This is a second deletion PATH
 * with its own transaction, its own manifest and its own owner proof, and
 * putting it beside helpers whose docblock says *"retention is not in this
 * file's gift"* is how the next reader ends up calling the wrong one.
 *
 * # The order, which is the whole of it
 *
 * ```
 *   1. the design row, PROVED THROUGH ITS CANDIDATE and locked
 *   2. its plates' rows — BEFORE the design, or they are orphans
 *   3. every object it owned, handed to the cleanup manifest
 *   4. the design row itself
 * ```
 *
 * All four inside one transaction, and that is stronger than the
 * bytes-then-row order fable-1138 §3 asked for rather than a departure from it.
 * The goal named there is that no orphan bytes can survive a crash, and a
 * manifest written in the same transaction as the row's delete cannot leave
 * either half behind: commit and the object is queued for the worker that
 * already deletes every other object this product retires; fail, and the row is
 * still there with its bytes, which is the state the customer can retry from.
 * Deleting bytes first and the row second has a crash window in which she owns a
 * design that cannot be looked at, which is the failure the delivery route
 * refuses on.
 *
 * # THE PLATES GO FIRST, AND HERE THAT IS A HABIT RATHER THAN A LOAD-BEARING
 * # ORDER — said this way because the sabotage caught the comment lying
 *
 * The sweep's version of this order IS load-bearing and says so: a plate has no
 * `candidateId` of its own — deliberately, because a mirrored parent id is a
 * second source of truth that drifts (working law 4) — so the sweep's only path
 * from a Cast to its plates runs THROUGH the design row, and deleting the
 * designs first would leave every plate a row nothing can find with its bytes at
 * a permanently public URL forever.
 *
 * **That argument does not transfer to this file, and the first draft of this
 * paragraph claimed it did.** Here the design's internal id is already in hand —
 * proved and locked above — so the plates are reachable by `designId` whether or
 * not the design row still exists. The order was flipped as a deliberate
 * sabotage and the suite stayed green in all fourteen arms, which is the only
 * reason this paragraph is right: a comment nobody can make fail is a comment.
 *
 * The order is kept anyway, because two deletion paths that differ in shape for
 * no reason is how the next editor learns the wrong rule from the wrong one.
 * What the suite DOES prove is the thing that matters — that a design's plates
 * go with it, rows and bytes — and removing the plate handling entirely reddens
 * exactly one arm.
 *
 * # The manifest's `kind`
 *
 * `casting_candidate_cleanup`, reused rather than extended. These ARE a casting
 * candidate's objects on the public bucket, the worker does not branch on
 * `kind` anywhere, and a new enum member is a production migration ceremony for
 * a distinction nothing acts on. The enum's own comment draws its line between
 * RETENTION POLICIES — when a thing dies — and there is no retention policy
 * here at all: she asked, so it dies now.
 */
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { castingCandidates, castingInkDesigns } from "../../drizzle/schema";
import { withTransaction } from "./connection";
import {
  deleteInkPlateRowsForDesignIn,
  listPurgeableInkPlatesForDesignIn,
} from "./castingV2InkPlates";
import { createStorageCleanupManifestIn } from "./storageCleanup";

export type InkDesignRemoval = {
  /** The design that was removed, by the name its owner knows it by. */
  designPublicId: string;
  /** Objects handed to the cleanup worker — the design's, plus any plates'. */
  objectsQueued: number;
  /** How many designs this Cast holds now, so the caller never recounts. */
  remaining: number;
};

/**
 * Remove one design and everything hanging off it.
 *
 * Answers `null` when no such design belongs to this account — a design that
 * never existed and one belonging to somebody else are the same answer, and the
 * caller must keep them the same at the wire.
 */
export async function removeInkDesign(input: {
  userId: number;
  designPublicId: string;
}): Promise<InkDesignRemoval | null> {
  if (!Number.isInteger(input.userId) || input.userId <= 0) {
    throw new Error("userId must be a positive integer");
  }

  return withTransaction(async (tx) => {
    /*
      THE OWNER IS IN THE STATEMENT THAT SELECTS THE ROW TO DELETE, on both
      sides of the join (invariant 1): the design's denormalized `userId` is a
      claim until its candidate agrees with it. Locked, so a mint racing this
      removal queues behind it rather than filing a plate against a design that
      is being deleted.
    */
    const [design] = await tx
      .select({
        id: castingInkDesigns.id,
        candidateId: castingInkDesigns.candidateId,
        storageKey: castingInkDesigns.storageKey,
      })
      .from(castingInkDesigns)
      .innerJoin(castingCandidates, eq(castingCandidates.id, castingInkDesigns.candidateId))
      .where(and(
        eq(castingInkDesigns.publicId, input.designPublicId),
        eq(castingInkDesigns.userId, input.userId),
        eq(castingCandidates.userId, input.userId),
      ))
      .limit(1)
      .for("update");
    if (!design) return null;

    const storageItems: Array<{ storageKey: string; storageBackend: "public_r2" }> = [];

    /* The plates first — a HABIT here rather than a load-bearing order, and the
       header says which and how that was found out. Their objects ride the same
       manifest as the design's. */
    const plates = await listPurgeableInkPlatesForDesignIn(tx, design.id);
    for (const plate of plates) {
      storageItems.push({ storageKey: plate.storageKey, storageBackend: "public_r2" });
    }
    if (plates.length > 0) await deleteInkPlateRowsForDesignIn(tx, design.id);

    storageItems.push({ storageKey: design.storageKey, storageBackend: "public_r2" });
    await createStorageCleanupManifestIn(tx, {
      userId: input.userId,
      operationId: randomUUID(),
      kind: "casting_candidate_cleanup",
      storageItems,
    });

    /*
      The row goes last, and the delete carries the owner AGAIN rather than
      keying on the id alone. It costs nothing and it means no future edit can
      turn the read above into an advisory check followed by an unscoped write —
      which is the exact shape invariant 1 was written about.
    */
    await tx.delete(castingInkDesigns).where(and(
      eq(castingInkDesigns.id, design.id),
      eq(castingInkDesigns.userId, input.userId),
    ));

    /*
      Counted inside the same transaction, after the delete. A caller told
      "removed" and left to work out how many are left would be a second list;
      and counted anywhere but here it could be read before this commits.
    */
    const remaining = await tx
      .select({ id: castingInkDesigns.id })
      .from(castingInkDesigns)
      .where(eq(castingInkDesigns.candidateId, design.candidateId));

    return {
      designPublicId: input.designPublicId,
      objectsQueued: storageItems.length,
      remaining: remaining.length,
    };
  });
}
