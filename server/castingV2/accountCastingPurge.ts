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
 * - **It does not reach an ORPHANED child row** — a library row, crop or
 *   attachment whose candidate row is already gone. The tree is reached
 *   through the owned candidate, which is how retention and
 *   `finalCastDeletion` reach it too; an orphan is a bug in one of those
 *   paths rather than a case this one covers, and inventing a second
 *   owner-scoped sweep here would hide it instead of fixing it.
 */
import { createModuleLogger } from "../logging/logger";
import type { TransactionHandle } from "../db/connection";
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
import { deleteInkPlateRowsIn, listPurgeableInkPlatesIn } from "../db/castingV2InkPlates";
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
import { tolerateAbsentCandidateStore } from "./candidateStoreTolerance";

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
  const candidateIds = candidates.map((candidate) => candidate.id);

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

  if (candidateIds.length > 0) {
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
    for (const plate of inkPlates) storageItems.push(publicItem(plate.storageKey));
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

  counts.castingCandidates = await deleteAccountCandidateRowsIn(tx, userId);
  counts.castingRolls = await deleteAccountRollRowsIn(tx, userId);
  counts.castingSessions = await deleteAccountSessionRowsIn(tx, userId);

  log.info(
    { userId, objects: storageItems.length, ...counts },
    "[accountCastingPurge] casting studio erased with the account",
  );
  return { storageItems, counts };
}
