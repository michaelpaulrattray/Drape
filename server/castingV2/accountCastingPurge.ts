/**
 * WHAT A DELETED ACCOUNT TAKES WITH IT FROM THE CASTING STUDIO — #1935.
 *
 * # The defect this closes
 *
 * The delete-account screen says *"Permanent. Your casts, boards and everything
 * you made go with it."* Until this module existed, `deleteUserAccount` deleted
 * boards, wardrobe, the legacy `models` tree, generations and credits — and
 * **touched the casting studio not at all.** Sheets, rolls, every candidate
 * face, every refinement, the reference library, the pictures a customer
 * attached and the tattoos cut from them all survived, with their objects left
 * at permanently public R2 URLs that never expire by design
 * (`server/storage.ts`). A customer was told their work was gone while their
 * faces stayed up.
 *
 * Against his 2026-07-25 ruling — *"If a marketing team or content creator
 * comes on the platform and makes a model that's theirs, no one should be able
 * to steal or copy that work"* — that is the sharpest possible failure: the
 * only person who asked for the work to go is the one whose request did
 * nothing.
 *
 * # Why this is not a second purge path
 *
 * ⚠ **IT REACHES EVERY CHILD STORE THROUGH THE SAME DB HELPERS THE RETENTION
 * SWEEP USES, AND THAT IS THE WHOLE DESIGN.** Each of those helpers names the
 * key columns of its own table — four for a library row, two for a segment,
 * the slot masks inside a scan's geometry — and there are nine of them. A
 * second collector spelling those keys again is working law 4 with a
 * customer's photographs as the cost of the drift: the day somebody adds a
 * second mask column to a table, it lands in ONE of the two lists, and the
 * road that missed it leaves objects up forever with no failing test and no
 * error. So nothing here knows a key column's name. It knows the ORDER, which
 * is its own (children before parents), and it knows that account erasure has
 * no survivors to spare.
 *
 * The absent-table tolerances are shared for the same reason and live in
 * `./candidateStoreTolerance`.
 *
 * # What it does NOT do, stated rather than left to be discovered
 *
 * - **It does not run `purgeCastLineageIn`.** That purge exists to decide what
 *   ONE deleted Cast may take from a sheet other Casts and other candidates
 *   still live on — it releases rows to the retention feed and spares
 *   everything a survivor claims. In an account erasure there are no
 *   survivors and nothing to release to a later sweep: every candidate of the
 *   account goes now, in this transaction, signed and kept ones included. Its
 *   whole question is answered before it is asked.
 * ⚠ **AND THE CLAUSE THAT USED TO CLOSE THIS LIST IS REVERSED — #1948 L1.**
 *
 * It read: *"It does not reach an ORPHANED child row — a library row, crop or
 * attachment whose candidate row is already gone ... an orphan is a bug in one
 * of those paths rather than a case this one covers, and inventing a second
 * owner-scoped sweep here would hide it instead of fixing it."*
 *
 * **The reasoning is still right and the conclusion was wrong, and the two can
 * be separated.** What makes a silent sweep bad is the SILENCE — it turns a
 * bug in retention or `finalCastDeletion` into a thing nobody ever learns
 * about. What the refusal cost is a customer's picture: an orphan row's object
 * sits at a permanently public URL that never expires, and leaving the row
 * does not help, because nothing else walks it either. So an account erasure
 * that skips orphans leaves a face up forever rather than filing a bug.
 *
 * ⚠ **IT IS NOT A SECOND SWEEP, WHICH IS THE OTHER HALF OF THAT CLAUSE'S
 * WORRY AND IS HONOURED EXACTLY.** Nothing below walks the tree twice. The
 * orphans' candidate ids are found BEFORE the one walk and added to it, so
 * every key column is still named in precisely the one place that owns it and
 * there is no second list to drift. The reader that finds them knows two
 * column names, `userId` and `candidateId`, and **no storage key at all** —
 * which is the rule this header actually states.
 *
 * ⚠ **AND IT IS LOUD.** An orphan found here means a row survived the path
 * that should have taken it. `log.warn` names the store and the count, so the
 * finding reaches a log instead of being quietly absorbed — a cleanup that
 * hides the bug it cleans up is the thing the old clause was right about.
 *
 * ⚠ **ONE CLASS OF ORPHAN IS DELIBERATELY NOT SWEPT, AND IT IS THE ONE THIS
 * PARAGRAPH'S REASONING DOES NOT COVER — PR #1974, his ruling 2026-10-08,
 * verbatim and entire: *"i agree with you"*.** The sentence above weighs a
 * customer's face left up against a bug left visible, and that is the right
 * trade for a child row whose candidate is GONE. It is the wrong trade for a
 * child row of hers pointing at a candidate that still exists and belongs to
 * SOMEBODY ELSE: that row is work made on their cast, *"a customer's cast is
 * their work"* makes it theirs, and sweeping it broke a stranger's Cast —
 * including, where the row was the candidate's `selectedVariantId`, leaving
 * their chosen face pointing at nothing. **So those ids are filtered out of
 * the deletion scope and warned about instead.** The cost is named rather
 * than hidden: such a row outlives the deleted account with its object up.
 */
import { createModuleLogger } from "../logging/logger";
import type { TransactionHandle } from "../db/connection";
import {
  purgeScopeIsEmpty,
  type PurgeCandidateScope,
} from "../db/castingV2PurgeScope";
import type { StorageCleanupManifestItem } from "../casting/storageCleanupContract";
import {
  deleteAccountCandidateRowsIn,
  deleteAccountRollRowsIn,
  deleteAccountSessionRowsIn,
  listAccountCandidatesIn,
} from "../db/castingV2";
import { deleteVariantRowsIn, listPurgeableVariantsIn } from "../db/castingV2Variants";
import { deleteSegmentRowsIn, listPurgeableSegmentsIn } from "../db/castingV2Segments";
import {
  deleteReferenceRowsIn,
  listPurgeableReferencesIn,
} from "../db/castingV2ReferenceLibrary";
import { deleteFaceScanRowsIn, listPurgeableFaceScansIn } from "../db/castingV2FaceScans";
import {
  deleteInkPlateRowsByIdIn,
  deleteInkPlateRowsIn,
  listAccountOrphanInkPlatesIn,
  listPurgeableInkPlatesIn,
} from "../db/castingV2InkPlates";
import { deleteInkDesignRowsIn, listPurgeableInkDesignsIn } from "../db/castingV2InkDesigns";
import {
  deleteInkDeliveryCropRowsIn,
  listPurgeableInkDeliveryCropsIn,
} from "../db/castingV2InkDeliveryCrops";
import {
  deleteReferenceCropRowsIn,
  listPurgeableReferenceCropsIn,
} from "../db/castingV2ReferenceCrops";
import {
  deleteReferenceAttachmentRowsIn,
  listPurgeableReferenceAttachmentsIn,
} from "../db/castingV2ReferenceAttachments";
import {
  listAccountOrphanCandidateIdsIn,
  listExistingCandidateIdsIn,
  ORPHAN_SCANNED_STORES,
  type OrphanStoreName,
} from "../db/castingV2Orphans";
import {
  CANDIDATE_CHILD_STORES,
  tolerateAbsentCandidateStore,
  type CandidateChildStore,
} from "./candidateStoreTolerance";

const log = createModuleLogger("castingV2/accountCastingPurge");

/** This file's name in the tolerance log line. */
const TOLERANCE_CONTEXT = "accountCastingPurge";

export type AccountCastingPurgeResult = {
  /** Every object the casting studio owned for this account, exact keys. */
  storageItems: StorageCleanupManifestItem[];
  counts: {
    castingCandidates: number;
    castingCandidateVariants: number;
    castingSegments: number;
    castingReferenceLibrary: number;
    castingFaceScans: number;
    castingInkPlates: number;
    castingInkDesigns: number;
    castingInkDeliveryCrops: number;
    castingReferenceCrops: number;
    castingReferenceAttachments: number;
    castingRolls: number;
    castingSessions: number;
  };
};

function publicItem(storageKey: string): StorageCleanupManifestItem {
  return { storageKey, storageBackend: "public_r2" as const };
}

/**
 * Collect every casting object this account owns and delete every casting row,
 * inside the caller's transaction.
 *
 * The caller hands the returned keys to the storage-cleanup manifest it is
 * already writing, so there is still exactly ONE thing in this system that
 * talks to R2 about deletion and it is the thing that was audited for it.
 *
 * Order is children → parents throughout, and two steps' order is
 * load-bearing: a PLATE's only path back to a candidate runs through its
 * DESIGN row, so plates go first; and every child is reached through the
 * candidate, so candidates go after all of them, then rolls, then sheets.
 */
export async function purgeAccountCastingIn(
  tx: TransactionHandle,
  userId: number,
): Promise<AccountCastingPurgeResult> {
  const storageItems: StorageCleanupManifestItem[] = [];
  const counts: AccountCastingPurgeResult["counts"] = {
    castingCandidates: 0,
    castingCandidateVariants: 0,
    castingSegments: 0,
    castingReferenceLibrary: 0,
    castingFaceScans: 0,
    castingInkPlates: 0,
    castingInkDesigns: 0,
    castingInkDeliveryCrops: 0,
    castingReferenceCrops: 0,
    castingReferenceAttachments: 0,
    castingRolls: 0,
    castingSessions: 0,
  };

  const candidates = await listAccountCandidatesIn(tx, userId);
  const liveCandidateIds = candidates.map((candidate) => candidate.id);

  /*
    THE ORPHANS JOIN THE ONE WALK — #1948 L1.

    A child row whose candidate row is already gone is reached by nothing in
    the product: retention, `finalCastDeletion` and the walk below all start
    at the candidate. Its object is then litter at a permanently public URL
    forever, and deleting the account removes the last pointer to it.

    ⚠ **SO THEIR PARENT IDS ARE FOUND FIRST AND ADDED TO THE SAME LIST**,
    rather than a second owner-scoped sweep being written underneath. Every
    `listPurgeable*In` below then collects their keys and every
    `delete*RowsIn` removes their rows, through the one set of helpers that
    knows those key columns. A dead candidate id is simply an id with no
    candidate row, which the helpers neither notice nor care about.

    The absent-store tolerance is the same one the walk uses: a store whose
    table does not exist cannot be holding an orphan either.
  */
  /* Carried out of the candidate block for the orphan-plate sweep below,
     which must run even for an account that has no candidate rows left. */
  const handledPlateIds: number[] = [];
  const orphanIds = new Set<number>();
  const orphansByStore: Partial<Record<OrphanStoreName, number>> = {};
  for (const store of Object.keys(ORPHAN_SCANNED_STORES) as OrphanStoreName[]) {
    const read = listAccountOrphanCandidateIdsIn(tx, store, userId, liveCandidateIds);
    /*
      The tolerance is applied to exactly the stores that HAVE one, read off
      its own map rather than listed here — `variants` is not a tolerated
      store, because the refinements table has always existed and an
      ER_NO_SUCH_TABLE from it is a real fault to be thrown, not absorbed.
    */
    const found = store in CANDIDATE_CHILD_STORES
      ? await read.catch(
        tolerateAbsentCandidateStore(store as unknown as CandidateChildStore, TOLERANCE_CONTEXT),
      )
      : await read;
    if (found.length === 0) continue;
    orphansByStore[store] = found.length;
    for (const id of found) orphanIds.add(id);
  }
  /*
    THE TWO KINDS OF ORPHAN ID, AND ONLY ONE OF THEM IS HERS TO TAKE — #1959.

    An orphan id was read OFF a child row of hers that points somewhere her
    own candidates are not. Whether that id still has a `castingCandidates`
    row decides which of two different bugs this is, and — since his ruling
    of 2026-10-08 — decides whether her row may be deleted at all:

    - **DROPPED** (no candidate row anywhere): a path dropped a candidate
      without its children. Her child row is reached by nothing in the
      product and its object sits at a permanently public URL forever, so it
      is swept here with the account. The id still proves nothing, so the
      owner travels in the statement beside it.
    - **STILL PRESENT** (a candidate row exists, and it is not hers): her
      child row carries her `userId` while pointing at a candidate somebody
      else owns. ⚠ **IT IS SKIPPED, AND THAT IS HIS RULING RATHER THAN A
      TOLERANCE** — the relay's finding on PR #1974, confirmed the same day,
      verbatim and entire: *"i agree with you"*. A child row under a live
      candidate is work made ON THAT CUSTOMER'S CAST, so *"a customer's cast
      is their work"* (founder, 2026-07-25) makes it the candidate owner's
      whatever `userId` it was mis-stamped with. It is not the deleting
      person's personal data and it is not ours to destroy on her way out.

    ⚠ **WHAT SKIPPING COSTS IS STATED RATHER THAN HIDDEN**: the mis-owned row
    outlives the account with its object still up. That is the price of not
    breaking a stranger's cast, and the warning below is how somebody comes
    to fix the mis-stamp at its source. What it buys off was concrete:
    `castingCandidates.selectedVariantId` can be the very variant deleted
    here, which left another customer's candidate pointing at a face that no
    longer existed — and the old log line said her rows were untouched while
    it happened.
  */
  const orphanIdList = Array.from(orphanIds);
  const stillPresent = new Set(await listExistingCandidateIdsIn(tx, orphanIdList));
  const dropped = orphanIdList.filter((id) => !stillPresent.has(id));
  /*
    LOUD ON PURPOSE, AND IT NAMES WHICH OF THE TWO IT FOUND. An orphan here
    means a row survived the path that should have taken it, and a cleanup
    that absorbs the bug it cleans up is what the header's old clause was
    right to object to. One warning used to stand for both, saying *a path
    dropped a candidate without its children* — true of only one of them and
    the opposite of true for the other.
  */
  if (dropped.length > 0) {
    log.warn(
      { userId, orphanCandidates: dropped.length, ...orphansByStore },
      "[accountCastingPurge] child rows found whose candidate row was already gone — "
        + "a path dropped a candidate without its children; swept here with the account",
    );
  }
  if (stillPresent.size > 0) {
    log.warn(
      { userId, misownedCandidates: stillPresent.size, ...orphansByStore },
      "[accountCastingPurge] child rows found carrying this account's userId while pointing "
        + "at a candidate it does not own — LEFT IN PLACE with their objects, because the "
        + "candidate's owner made that work and it is theirs. Fix the mis-stamp at its "
        + "source; these rows outlive the deleted account",
    );
  }

  /*
    THE TWO KINDS OF ID, AND THE TERMS EACH TRAVELS ON — #1959.

    The live ids came out of `listAccountCandidatesIn(tx, userId)`, so the
    candidate itself is the proof of ownership and every child row under it
    goes whatever `userId` the row carries — a mis-owned row under a candidate
    that IS hers is the litter this sweep is for.

    ⚠ **ONLY THE DROPPED ORPHANS TRAVEL, AND THEY ARE STILL SCOPED TO HER IN
    THE STATEMENT.** They were read OFF a child row, and that row is itself
    the evidence that something went wrong, so it cannot also be the warrant
    for a delete. The owner clause is NOT made redundant by the `dropped`
    filter and removing it would reopen the same hole one step over: two
    accounts' child rows can both point at the same DROPPED candidate, and
    `dropped` is a list of ids read off rows rather than a list of things she
    owns. `castingV2PurgeScope` carries that rule.
  */
  const candidateIds: PurgeCandidateScope = {
    candidateIds: liveCandidateIds,
    ownerScoped: { candidateIds: dropped, userId },
  };

  /*
    The candidate's own three objects — the delivered face, its thumbnail and
    the framing trim's kept original. `sourceKey` is here because the
    projection carries it, not because this file remembered it.
  */
  for (const candidate of candidates) {
    for (const key of [candidate.imageKey, candidate.thumbKey, candidate.sourceKey]) {
      if (key) storageItems.push(publicItem(key));
    }
  }

  if (!purgeScopeIsEmpty(candidateIds)) {
    // Refinements (D-122): a variant is a paid picture of a person.
    const variants = await listPurgeableVariantsIn(tx, candidateIds);
    for (const variant of variants) {
      for (const key of [variant.imageKey, variant.thumbKey]) {
        if (key) storageItems.push(publicItem(key));
      }
    }
    counts.castingCandidateVariants = await deleteVariantRowsIn(tx, candidateIds);

    // Segments: a crop of a face. The store is retired; the rows outlive it.
    const segments = await listPurgeableSegmentsIn(tx, candidateIds).catch(
      tolerateAbsentCandidateStore("segments", TOLERANCE_CONTEXT),
    );
    for (const segment of segments) {
      for (const key of [segment.maskKey, segment.contentKey]) {
        if (key) storageItems.push(publicItem(key));
      }
    }
    if (segments.length > 0) counts.castingSegments = await deleteSegmentRowsIn(tx, candidateIds);

    // The reference library — the crop, its mask, and the refused pair.
    const references = await listPurgeableReferencesIn(tx, candidateIds).catch(
      tolerateAbsentCandidateStore("referenceLibrary", TOLERANCE_CONTEXT),
    );
    for (const reference of references) {
      for (const key of [
        reference.storageKey,
        reference.maskKey,
        reference.refusedContentKey,
        reference.refusedMaskKey,
      ]) {
        if (key) storageItems.push(publicItem(key));
      }
    }
    if (references.length > 0) {
      counts.castingReferenceLibrary = await deleteReferenceRowsIn(tx, candidateIds);
    }

    // Kept scans: one small stencil per feature found.
    const scans = await listPurgeableFaceScansIn(tx, candidateIds).catch(
      tolerateAbsentCandidateStore("faceScans", TOLERANCE_CONTEXT),
    );
    for (const scan of scans) {
      for (const key of scan.maskKeys) storageItems.push(publicItem(key));
    }
    if (scans.length > 0) counts.castingFaceScans = await deleteFaceScanRowsIn(tx, candidateIds);

    /*
      PLATES BEFORE DESIGNS, AND THE ORDER IS LOAD-BEARING. A plate has no
      `candidateId` of its own — deliberately, because a mirrored parent id is
      a second source of truth that drifts — so the only path from an account
      to its plates runs THROUGH the design row. Delete the designs first and
      every plate becomes an orphan nothing can find, with its bytes left at a
      permanently public URL forever.
    */
    const inkPlates = await listPurgeableInkPlatesIn(tx, candidateIds).catch(
      tolerateAbsentCandidateStore("inkPlates", TOLERANCE_CONTEXT),
    );
    for (const plate of inkPlates) {
      storageItems.push(publicItem(plate.storageKey));
      handledPlateIds.push(plate.id);
    }
    if (inkPlates.length > 0) {
      counts.castingInkPlates = await deleteInkPlateRowsIn(tx, candidateIds);
    }

    /*
      An uploaded ink design is a picture the CUSTOMER handed us, kept at a
      permanently public URL under her Cast's own path. *"It leaves when your
      Cast does"* is a promise these lines keep — and until #1935 it was not
      kept when the whole ACCOUNT left, which is the larger promise.
    */
    const inkDesigns = await listPurgeableInkDesignsIn(tx, candidateIds).catch(
      tolerateAbsentCandidateStore("inkDesigns", TOLERANCE_CONTEXT),
    );
    for (const design of inkDesigns) storageItems.push(publicItem(design.storageKey));
    if (inkDesigns.length > 0) {
      counts.castingInkDesigns = await deleteInkDesignRowsIn(tx, candidateIds);
    }

    // The crop of the tattoo as it landed on her.
    const inkDeliveryCrops = await listPurgeableInkDeliveryCropsIn(tx, candidateIds).catch(
      tolerateAbsentCandidateStore("inkDeliveryCrops", TOLERANCE_CONTEXT),
    );
    for (const crop of inkDeliveryCrops) storageItems.push(publicItem(crop.storageKey));
    if (inkDeliveryCrops.length > 0) {
      counts.castingInkDeliveryCrops = await deleteInkDeliveryCropRowsIn(tx, candidateIds);
    }

    // The cuts taken from a customer's own reference.
    const referenceCrops = await listPurgeableReferenceCropsIn(tx, candidateIds).catch(
      tolerateAbsentCandidateStore("referenceCrops", TOLERANCE_CONTEXT),
    );
    for (const crop of referenceCrops) storageItems.push(publicItem(crop.storageKey));
    if (referenceCrops.length > 0) {
      counts.castingReferenceCrops = await deleteReferenceCropRowsIn(tx, candidateIds);
    }

    /*
      THE PICTURES SHE ATTACHED. A full photograph of a real person, at a
      permanently public URL, kept because there is no other way to carry her
      own reference into a render. Of everything in this function it is the one
      an account deletion most obviously promised to destroy.
    */
    const attachments = await listPurgeableReferenceAttachmentsIn(tx, candidateIds).catch(
      tolerateAbsentCandidateStore("referenceAttachments", TOLERANCE_CONTEXT),
    );
    for (const attachment of attachments) storageItems.push(publicItem(attachment.storageKey));
    if (attachments.length > 0) {
      counts.castingReferenceAttachments = await deleteReferenceAttachmentRowsIn(tx, candidateIds);
    }
  }

  /*
    AND THE PLATES EVEN AN ORPHAN CANDIDATE ID CANNOT REACH — #1948 L1.

    The widened `candidateIds` above carries every orphan the eight stores
    that declare a `candidateId` pointed at. A plate declares none: its only
    path back is its design row, so a plate whose DESIGN is also gone is
    invisible at every depth — the one store the orphan reader cannot answer
    for. The column still pointing home is its own `userId`, so that is what
    this asks on, excluding what the pass above already handled.

    ⚠ **IT SITS OUTSIDE THE CANDIDATE BLOCK ON PURPOSE.** An account whose
    candidate rows are ALL gone has `candidateIds` empty and skips that block
    entirely — and that is precisely the account most likely to be carrying a
    plate nothing can reach. Written inside it, this sweep would be absent
    exactly where it is needed.
  */
  const orphanPlates = await listAccountOrphanInkPlatesIn(tx, userId, handledPlateIds)
    .catch(tolerateAbsentCandidateStore("inkPlates", TOLERANCE_CONTEXT));
  if (orphanPlates.length > 0) {
    for (const plate of orphanPlates) storageItems.push(publicItem(plate.storageKey));
    counts.castingInkPlates += await deleteInkPlateRowsByIdIn(
      tx,
      orphanPlates.map((plate) => plate.id),
    );
    log.warn(
      { userId, orphanPlates: orphanPlates.length },
      "[accountCastingPurge] ink plates found whose design row was already gone — "
        + "a path dropped a design without its plates; swept here with the account",
    );
  }

  counts.castingCandidates = await deleteAccountCandidateRowsIn(tx, userId);
  counts.castingRolls = await deleteAccountRollRowsIn(tx, userId);
  counts.castingSessions = await deleteAccountSessionRowsIn(tx, userId);

  log.info(
    { userId, objects: storageItems.length, ...counts },
    "[accountCastingPurge] casting studio erased with the account",
  );
  return { storageItems, counts };
}
