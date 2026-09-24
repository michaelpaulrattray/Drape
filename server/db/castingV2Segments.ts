/**
 * THE SEGMENT STORE'S DATABASE LAYER — AND ALL THAT IS LEFT OF IT IS THE PURGE.
 *
 * The store itself is RETIRED. His ruling, 2026-09-24 (Crew reply #212):
 *
 *   > Retire both. The paste road is gone; nothing reads these.
 *
 * #1160 took it out in three slices — the refine entrance, then every read
 * path, route and panel, then this. What survives here is the two helpers the
 * candidate sweep calls, and they survive for one reason only: **the
 * `casting_segments` TABLE still exists.** A writer can be deleted by a shift;
 * dropping a table is a destructive migration and therefore the founder's own
 * act, so until he drops it the sweep must keep collecting whatever it holds.
 *
 * ⚠ What it holds today is NOTHING, read at the rows rather than assumed: zero
 * segments on production and zero on dev, all time, with 4 and 7 users as the
 * positive control. The store was *structurally* unwritable on the live road —
 * its only writer refused without `image.evidence`, and `repaintOnce` (the road
 * every production render takes under `CASTING_REPAINT_SCOPE=all`) declares
 * that field `undefined`. So this purge has always collected an empty set, and
 * keeping it is about the table's existence rather than about any object anyone
 * expects to find.
 *
 * ⚠ AND THE ONE THING IN THIS FILE THAT WAS NEVER THE STORE'S:
 * `resolveOwnedCandidateId` proved a candidate belonged to a user and handed
 * back its internal id, and its only caller is the FACE PANEL — the live v2
 * surface that REPLACED the thing being retired, whose own docblock names it as
 * one of three statements carrying `userId` into its WHERE (invariant 1). It
 * moved to `castingV2.ts`, where the candidates table lives, rather than dying
 * with a module whose name it never belonged to. **A module's NAME is not its
 * population**: slice 2 paid for that lesson with `maskFetchUrl`, and this is
 * the same shape one rung sharper, because this one is access control.
 *
 * Retention is not in this file's gift: both helpers take a transaction handle
 * because they run inside the candidate sweep's own transaction, on the sweep's
 * own cleanup manifest. A segment's lifetime is its candidate's, and there is
 * deliberately no second schedule for it.
 */
import { inArray } from "drizzle-orm";

import { castingSegments } from "../../drizzle/schema";
import { type TransactionHandle } from "./connection";

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return (header as { affectedRows?: number })?.affectedRows ?? 0;
}

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
