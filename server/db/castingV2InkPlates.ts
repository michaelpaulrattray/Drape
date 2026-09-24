/**
 * THE PLATE STORE'S STATEMENTS (migration 0037, ruled fable-959 §3).
 *
 * One row is a design re-drawn onto a blank ghost mannequin by a named engine.
 *
 * ⚠ **THIS TABLE CAN NO LONGER GAIN A ROW, AND THE MODULE STAYS ANYWAY.** His
 * ruling of 2026-09-24 — *"It retires with N2"* — retired the ink studio;
 * slice 2 deleted the mint (`inkPlateDoor.ts`, `castingV2/inkTemplates.ts`)
 * and **slice 4e deleted the statement itself**, `recordInkPlate`, with its
 * two error classes and its two types. Production held zero plate rows all
 * time, read at the rows rather than assumed, so a table that can no longer
 * gain one orphans nothing.
 *
 * **What is left is every LIVE path, and each one is named with its caller**:
 *
 *   `listCandidateInkPlates`            `signService.carriedInkPlates`, the paid sign road
 *   `listPurgeableInkPlatesIn` + `deleteInkPlateRowsIn`
 *                                        `candidateRetention`, the Cast sweep
 *   `listPurgeableInkPlatesForDesignIn` + `deleteInkPlateRowsForDesignIn`
 *                                        `castingV2InkDesignRemoval`, an owner's delete
 *
 * ⚠ **AND THE FOUR WRITE RULES THAT USED TO BE DOCUMENTED HERE LEFT WITH THE
 * STATEMENT THAT IMPLEMENTED THEM.** They were real — the owner in the writing
 * statement, the design row locked while the plate was written, the manifest
 * discharged in the filing transaction, and a plate never filed against a
 * design this account does not own. Keeping them as prose over a module that no
 * longer writes would be this repository's most expensive shape: a document
 * confident about code that moved underneath it. They are in git, in the
 * commit that removed them, which is where a rule with no code belongs.
 *
 * # What IS still a rule here, because it is still enforced
 *
 * **Owner-scoping at every link.** A plate's `userId` is denormalized, and a
 * denormalized column is a claim until the parent agrees with it, so every
 * surviving read joins through the design to the candidate and carries the
 * account on each link.
 *
 * # Retention is not in this file's gift
 *
 * The purge helpers take a transaction handle and run inside the candidate
 * sweep's own transaction. A plate's lifetime is its design's, which is its
 * Cast's, unconditionally. They reach these rows THROUGH the design rather than
 * through a mirrored `candidateId` column (working law 4), which is also what
 * fixes the delete ORDER: plates first, then the designs they hang off. ⚠ That
 * order is the one property here a test still has to prove, and it is proved
 * against a real database in two places — `castingV2-ink-plate-db.test.ts` for
 * the Cast sweep, `castingV2-ink-design-db.test.ts` for an owner's delete —
 * both of which now build their fixture row with a raw INSERT, because the
 * helper that used to build it is gone.
 */
import { and, eq, inArray } from "drizzle-orm";

import {
  castingCandidates,
  castingInkDesigns,
  castingInkPlates,
} from "../../drizzle/schema";
import type { InkPlacement } from "../../shared/inkPlacementVocabulary";
import type { InkSide } from "../../shared/inkReleasedPlacements";
import { getDb, type TransactionHandle } from "./connection";

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
 * EVERY PLATED TATTOO THIS CANDIDATE WEARS — what a Sign carries into its views
 * (FOUNDER RULING, his words at fable-987 §3).
 *
 * Through the DESIGN rather than a mirrored candidate column on the plate, for
 * the reason the purge reader gives one section down (working law 4): the plate
 * hangs off the design and the design hangs off the candidate, and a second
 * parent id on the plate row would be a copy that can disagree with its source.
 *
 * Owner-scoped at every link: the plate's `userId` is a claim, the design's
 * is a claim, and the candidate is where they stop being claims. (This used to
 * say "exactly as `listInkPlatesForDesign` is", and that sibling left in #1158
 * slice 4e — a property is stated here rather than pointed at, so the next
 * deletion cannot quietly take the reason with the neighbour.)
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
/**
 * The plates hanging off ONE design — read inside the deleting transaction.
 *
 * The candidate-keyed sibling below is the sweep's; this is the owner's own
 * per-design removal (`castingV2.ink.remove`). Same path and same reason: a
 * plate reaches its Cast only THROUGH its design, so a design deleted without
 * its plates leaves rows nothing can find and bytes at a permanently public URL
 * forever.
 *
 * Keyed on the design's internal id, which the caller has only because it just
 * proved and LOCKED that row through its candidate. Nothing here re-proves an
 * owner, and it does not need to: the id it is handed is not a caller's.
 */
export async function listPurgeableInkPlatesForDesignIn(
  tx: TransactionHandle,
  designId: number,
): Promise<Array<{ id: number; storageKey: string }>> {
  return tx
    .select({ id: castingInkPlates.id, storageKey: castingInkPlates.storageKey })
    .from(castingInkPlates)
    .where(eq(castingInkPlates.designId, designId));
}

/**
 * Delete those plate rows. **Before the design row, and the order is
 * load-bearing** for {@link listPurgeableInkPlatesForDesignIn}'s reason.
 */
export async function deleteInkPlateRowsForDesignIn(
  tx: TransactionHandle,
  designId: number,
): Promise<number> {
  const result = await tx
    .delete(castingInkPlates)
    .where(eq(castingInkPlates.designId, designId));
  return affectedRows(result);
}

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
