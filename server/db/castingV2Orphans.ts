/**
 * THE CHILD ROWS WHOSE CANDIDATE IS ALREADY GONE — #1948 L1.
 *
 * # What an orphan is, and why it is not somebody else's problem
 *
 * Every casting child store — a refinement, a segment, a library row, a kept
 * scan, an ink design, a crop, a customer's own attached photograph — is
 * reached through the candidate that owns it, by `candidateId`. That is how
 * retention reaches them, how `finalCastDeletion` reaches them, and how
 * `accountCastingPurge` reached them until this module existed.
 *
 * A row whose candidate is gone is reached by none of them. **It is a bug in
 * whichever path dropped the candidate without its children** — and the
 * purge's own header said so, and declined to sweep, on the ground that a
 * cleanup which quietly absorbs a bug hides it.
 *
 * ⚠ **THAT GROUND IS RIGHT AND THE CONCLUSION WAS WRONG.** The cost of
 * declining is not a bug left visible; it is a customer's face left at a
 * permanently public R2 URL that never expires (`server/storage.ts`), with the
 * last database pointer to it deleted alongside the account. Nothing walks it
 * afterwards. So the orphan is swept — and the finding is LOGGED by the
 * caller, which is how a sweep stays honest about what it found.
 *
 * # ⚠ WHAT THIS MODULE DELIBERATELY DOES NOT KNOW
 *
 * **Not one storage key column.** `accountCastingPurge.ts`'s header states the
 * rule this module is built to obey: a second collector spelling those key
 * names again is working law 4, with a customer's photographs as the cost of
 * the drift. So {@link listAccountOrphanCandidateIdsIn} reads **`candidateId`
 * and `userId` and nothing else**, and hands the ids it finds back to the
 * caller, which feeds them through the SAME `listPurgeable*In` helpers the
 * live candidates go through. There is no second walk and no second key list.
 *
 * **Ink plates are the one store this module cannot answer for, and they are
 * answered next door instead.** A plate carries no `candidateId` —
 * deliberately, because a mirrored parent id is a second source of truth — so
 * its only path back to a candidate runs through its design row, and a plate
 * whose DESIGN is also gone is unreachable by candidate id at any depth. The
 * only column left pointing home is its own `userId`, and asking by owner
 * means naming `storageKey`. That read lives in `castingV2InkPlates.ts`
 * (`listAccountOrphanInkPlatesIn`), beside the only other reader that names
 * that column, rather than being a second file that knows where a plate's
 * bytes are.
 */
import { and, eq, inArray, notInArray } from "drizzle-orm";

import {
  castingCandidates,
  castingCandidateVariants,
  castingFaceScans,
  castingInkDeliveryCrops,
  castingInkDesigns,
  castingReferenceAttachments,
  castingReferenceCrops,
  castingReferenceLibrary,
  castingSegments,
} from "../../drizzle/schema";
import type { TransactionHandle } from "./connection";

/**
 * The eight child stores that carry a `candidateId`, by the name the caller
 * logs them under.
 *
 * ⚠ **`castingInkPlates` IS ABSENT ON PURPOSE AND ITS ABSENCE IS CHECKED.**
 * It has no `candidateId`; {@link listAccountOrphanInkPlatesIn} is its road,
 * and `server/accountDeletionOrphans.test.ts` holds this list equal to the
 * set of casting child tables that declare the column, so a ninth store
 * gaining one cannot be left out by being forgotten.
 */
export const ORPHAN_SCANNED_STORES = {
  variants: castingCandidateVariants,
  segments: castingSegments,
  referenceLibrary: castingReferenceLibrary,
  faceScans: castingFaceScans,
  inkDesigns: castingInkDesigns,
  inkDeliveryCrops: castingInkDeliveryCrops,
  referenceCrops: castingReferenceCrops,
  referenceAttachments: castingReferenceAttachments,
} as const;

export type OrphanStoreName = keyof typeof ORPHAN_SCANNED_STORES;

/**
 * Every candidate id this account's child rows point at that is NOT one of the
 * candidates the account still has a row for.
 *
 * Returns the ids per store, so the caller can say which store was carrying
 * the orphan rather than reporting a bare number nobody can act on.
 *
 * ⚠ **THE LIVE IDS ARE EXCLUDED IN THE STATEMENT, NOT AFTERWARDS**, for the
 * ordinary reason: an account with thousands of candidates would otherwise
 * drag every child row's parent id back over the wire to throw almost all of
 * them away. With no live candidates at all the `NOT IN` is dropped rather
 * than sent empty — `NOT IN ()` is a syntax error, and a filter that silently
 * matched nothing would make this reader blind exactly when the account is
 * most likely to hold orphans.
 */
export async function listAccountOrphanCandidateIdsIn(
  tx: TransactionHandle,
  store: OrphanStoreName,
  userId: number,
  liveCandidateIds: readonly number[],
): Promise<number[]> {
  const table = ORPHAN_SCANNED_STORES[store];
  const owned = eq(table.userId, userId);
  const rows = await tx
    .selectDistinct({ candidateId: table.candidateId })
    .from(table)
    .where(
      liveCandidateIds.length > 0
        ? and(owned, notInArray(table.candidateId, [...liveCandidateIds]))
        : owned,
    );
  const ids: number[] = [];
  for (const row of rows) {
    if (typeof row.candidateId === "number") ids.push(row.candidateId);
  }
  return ids;
}

/**
 * Which of these candidate ids still have a `castingCandidates` row — for ANY
 * owner, which is the whole point of the read (#1959).
 *
 * ⚠ **IT DECIDES WHAT IS DELETED, AND THIS DOCBLOCK SAID THE OPPOSITE UNTIL
 * PR #1974 — the reversal is his, 2026-10-08, verbatim and entire: *"i agree
 * with you"*.** What stood here is kept below, because its reasoning is why
 * the first shape was chosen and is the thing his ruling overturns rather
 * than a mistake:
 *
 * > *"IT DECIDES NOTHING ABOUT WHAT IS DELETED, AND THAT IS DELIBERATE. #1959
 * > proposed gating the orphan set on `NOT EXISTS` … That closes the
 * > cross-account erasure — but it also abandons the row it was reading: a
 * > child row carrying the deleting account's `userId` while pointing at
 * > ANOTHER customer's live candidate would then be in no set at all, and
 * > would outlive the account as litter with its object still up. The deletion
 * > is made safe instead by putting the owner in the statement."*
 *
 * **Both halves of that were true; the conclusion weighed them wrongly.**
 * Owner-scoping does remove exactly her row and nothing else — and her row,
 * when it sits under somebody else's LIVE candidate, is a refinement, segment,
 * scan or attachment made ON THAT PERSON'S CAST. *"A customer's cast is their
 * work"* (founder, 2026-07-25) makes it theirs whatever `userId` it was
 * mis-stamped with, and it can be the candidate's own `selectedVariantId` —
 * so the safe delete was still breaking a stranger's cast. **Litter that
 * outlives an account is the cheaper of the two costs**, and it is logged
 * loudly so the mis-stamp gets fixed at its source.
 *
 * So the answer now does two jobs, and the caller
 * (`castingV2/accountCastingPurge.ts`) is where both are spelled out: ids with
 * NO row are swept owner-scoped; ids WITH one are skipped and warned about.
 * The second job is still the diagnosis this read was added for — the two
 * cases are genuinely different bugs and one warning used to stand for both.
 */
export async function listExistingCandidateIdsIn(
  tx: TransactionHandle,
  candidateIds: readonly number[],
): Promise<number[]> {
  if (candidateIds.length === 0) return [];
  const rows = await tx
    .select({ id: castingCandidates.id })
    .from(castingCandidates)
    .where(inArray(castingCandidates.id, [...candidateIds]));
  return rows.map((row) => row.id);
}
