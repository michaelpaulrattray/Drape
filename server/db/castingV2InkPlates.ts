/**
 * THE PLATE STORE'S STATEMENTS (migration 0037, ruled fable-959 §3).
 *
 * One row is a design re-drawn onto a blank ghost mannequin by a named engine.
 *
 * ⚠ **THIS TABLE CAN NO LONGER GAIN A ROW, NOBODY READS IT FOR CONTENT ANY
 * MORE, AND THE MODULE STAYS ANYWAY.** His ruling of 2026-09-24 — *"It retires
 * with N2"* — retired the ink studio; slice 2 deleted the mint
 * (`inkPlateDoor.ts`, `castingV2/inkTemplates.ts`), **slice 4e deleted the
 * statement itself**, `recordInkPlate`, and **slice 4f deleted the last
 * CONTENT read**, `listCandidateInkPlates`, when the paid Sign road stopped
 * carrying plates. Both worlds held zero plate rows at slice 4f, read at the
 * rows rather than assumed, so a table that can no longer gain one orphans
 * nothing.
 *
 * **What is left is PURGE ONLY, and each path is named with its caller**:
 *
 *   `listPurgeableInkPlatesIn` + `deleteInkPlateRowsIn`
 *                                        `candidateRetention`, the Cast sweep
 *   `listPurgeableInkPlatesForDesignIn` + `deleteInkPlateRowsForDesignIn`
 *                                        `castingV2InkDesignRemoval`, an owner's delete
 *
 * ⚠ **A TABLE THAT CANNOT GAIN A ROW STILL NEEDS ITS SWEEP, AND THAT IS NOT A
 * CONTRADICTION.** The purge pair is what makes the emptiness a fact rather
 * than a reading taken on one night: any row that ever existed leaves with its
 * Cast, and its bytes leave at a permanently public URL with it. Deleting the
 * sweep because the count is zero today is how a row written before a retirement
 * outlives every account that could reach it.
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
