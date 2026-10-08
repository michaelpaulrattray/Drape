/**
 * Candidate retention sweep (plan §G.6).
 *
 * The founder's ruling is aggressive cleanup — "nothing unused outlives its
 * sheet" — with two deliberate survivors: a signed candidate (it is Cast
 * lineage) and the kept siblings of a signed candidate (the Siblings card
 * needs them while that Cast lives).
 *
 * This sweep never deletes an object itself. It hands exact keys to the
 * existing storage-cleanup worker and deletes the rows once they are handed
 * over, so there is exactly one thing in this system that talks to R2 about
 * deletion, and it is the thing that was audited for it.
 *
 * A retention sweep is not a user operation, so each batch mints a synthetic
 * UUID for its `operationId` — the column is NOT NULL, unique and
 * UUID-validated, and inventing a fake user operation id would poison the
 * receipt space (§G.6).
 */
import { randomUUID } from "node:crypto";

import {
  deleteReferenceRowsIn,
  listPurgeableReferencesIn,
} from "../db/castingV2ReferenceLibrary";
import { deleteFaceScanRowsIn, listPurgeableFaceScansIn } from "../db/castingV2FaceScans";
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
import { deleteInkPlateRowsIn, listPurgeableInkPlatesIn } from "../db/castingV2InkPlates";
import { deleteSegmentRowsIn, listPurgeableSegmentsIn } from "../db/castingV2Segments";
import { deleteVariantRowsIn, listPurgeableVariantsIn } from "../db/castingV2Variants";
import { withTransaction } from "../db/connection";
import { createStorageCleanupManifestIn } from "../db/storageCleanup";
import type { PurgeableCandidate } from "../db/castingV2";
import {
  deleteCandidateRowsIn,
  expireSessionCandidates,
  listExpiredSessions,
  listPurgeableCandidates,
  markSessionExpired,
} from "../db/castingV2";
import { createModuleLogger } from "../logging/logger";
import { checkCandidateInvariants } from "./candidateInvariants";
import { tolerateAbsentCandidateStore } from "./candidateStoreTolerance";
import { parseCastingV2Scope, CASTING_V2_SCOPE_ENV } from "./castingV2Scope";

/** This file's name in the tolerance log line. */
const TOLERANCE_CONTEXT = "candidateRetention";

const log = createModuleLogger("castingV2/candidateRetention");

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const FIRST_SWEEP_DELAY_MS = 90 * 1000;
/*
  THE ABSENT-TABLE TOLERANCES MOVED OUT — #1935.

  Every one of them (the error-chain reader, each store's arming question and
  its sentence) now lives in `./candidateStoreTolerance`, verbatim, because
  account deletion became the second road that purges a candidate's whole tree
  and two copies of those decisions is working law 4 with a customer's pictures
  as the cost of the drift. Nothing about any decision changed; the log line
  now names its caller rather than assuming this file.
*/

export type RetentionSweepResult = {
  sessionsExpired: number;
  candidatesPurged: number;
  objectsQueued: number;
};

/**
 * One pass. Expire idle sessions first, then purge everything the expiry (and
 * ordinary discarding) has made unreachable — so a session that expires in
 * this pass has its candidates collected in the same pass rather than an hour
 * later.
 */
export async function runCandidateRetentionSweep(now = new Date()): Promise<RetentionSweepResult> {
  /*
    The tripwire runs FIRST, before this pass writes anything.
    
    It is the sweep's own work that turns candidates into `expired`, so checking
    afterwards would be checking our own output — and a guard lost inside this
    function would be reported as a pre-existing condition. Reading before we
    write means the count belongs to whatever came before.
  */
  await checkCandidateInvariants().catch((error: unknown) => {
    log.warn({ err: error }, "[retention] the candidate invariant check could not run");
  });

  let sessionsExpired = 0;
  for (const session of await listExpiredSessions({ now })) {
    // Candidates first: once the session row flips to `expired` it is no
    // longer selected, and a crash between the two statements would otherwise
    // strand its candidates outside every sweep's reach.
    await expireSessionCandidates({ sessionId: session.id, userId: session.userId });
    if (await markSessionExpired(session.id)) sessionsExpired += 1;
  }

  const purgeable = await listPurgeableCandidates({ now });
  if (purgeable.length === 0) {
    return { sessionsExpired, candidatesPurged: 0, objectsQueued: 0 };
  }

  // One batch per user: the manifest carries a userId, and the cleanup
  // worker's own guards are owner-scoped.
  const byUser = new Map<number, PurgeableCandidate[]>();
  for (const candidate of purgeable) {
    const bucket = byUser.get(candidate.userId) ?? [];
    bucket.push(candidate);
    byUser.set(candidate.userId, bucket);
  }

  let candidatesPurged = 0;
  let objectsQueued = 0;

  for (const [userId, candidates] of Array.from(byUser.entries())) {
    const candidateIds = candidates.map((candidate) => candidate.id);
    /*
      ⚠ AND THE FRAMING TRIM'S KEPT ORIGINAL, `sourceKey` (migration 0053).

      The third member of this list, and it is here UNCONDITIONALLY, for the
      reason every block below this one gives in its own words: **a flag governed
      whether it was WRITTEN, and nothing governs whether it is PURGED.**

      What it holds is the untrimmed 1536x2304 frame a delivered face was cut
      from — **a photograph of a person at a permanently public URL.** An
      original that outlived its cast is precisely the artifact the segment and
      library blocks below were written to destroy, arrived at by a third door.

      ⚠ **NOTHING WRITES ONE ANY MORE AND THAT MAKES THIS LINE MATTER MORE, NOT
      LESS** (2026-09-03 AEST, card #11 — the founder retired the trim on his own eye).
      The keys that exist were written while the flag was live and they are now
      the whole population, closed and unable to grow. A sweep that quietly
      stopped covering them would strand every one, with no new row ever arriving
      to make the gap visible — which is the retired-control class exactly.
      `candidateRetention.test.ts` drives it.
    */
    const storageItems = candidates.flatMap((candidate) =>
      [candidate.imageKey, candidate.thumbKey, candidate.sourceKey]
        .filter((key): key is string => Boolean(key))
        .map((storageKey) => ({ storageKey, storageBackend: "public_r2" as const })),
    );

    await withTransaction(async (tx) => {
      /*
        A candidate's REFINEMENTS purge with it (D-122, §G.6).

        Ordinary candidate retention, ruled rather than assumed: Sign copies its
        own anchor, so a Cast depends on nothing in the variant table and a
        signed candidate's unselected variants are ordinary sheet debris. Read
        inside the same transaction as the delete so a refinement written
        between the two cannot slip through and outlive the face it belonged to.

        The same sweep rather than a second retention path, deliberately: two
        schedules for one lifetime is two things to keep in step, and the one
        that falls behind leaves paid pictures of people at public URLs after
        their sheet is gone.
      */
      const variants = await listPurgeableVariantsIn(tx, candidateIds);
      for (const variant of variants) {
        for (const key of [variant.imageKey, variant.thumbKey]) {
          if (key) storageItems.push({ storageKey: key, storageBackend: "public_r2" as const });
        }
      }
      await deleteVariantRowsIn(tx, candidateIds);

      /*
        A candidate's SEGMENTS purge with it too — same transaction, same
        manifest, from the store's very first migration.

        This is the founder's condition on the segment store, and it is here
        rather than in a later slice for the reason the comment above gives:
        one lifetime, one schedule. A segment holds a crop of a person's FACE
        at a public URL, so a second retention path that fell behind would
        leave exactly the artifact the sheet promised to destroy.

        UNCONDITIONAL, and NOT gated on the segment flag. The flag governs
        whether segments are WRITTEN; nothing may govern whether they are
        purged. A flag turned back off after rows exist must not strand them —
        that failure would be silent, permanent, and made of paid pictures.
      */
      const segments = await listPurgeableSegmentsIn(tx, candidateIds).catch(
        tolerateAbsentCandidateStore("segments", TOLERANCE_CONTEXT),
      );
      for (const segment of segments) {
        for (const key of [segment.maskKey, segment.contentKey]) {
          if (key) storageItems.push({ storageKey: key, storageBackend: "public_r2" as const });
        }
      }
      if (segments.length > 0) await deleteSegmentRowsIn(tx, candidateIds);

      /*
        And a candidate's REFERENCE LIBRARY, on the same terms (migration 0028).

        Same transaction, same manifest, same unconditional posture: the flag
        governs whether library rows are WRITTEN, and nothing governs whether
        they are purged. A library row holds a crop of a person's face at a
        permanently public URL — the same artifact the segment purge above
        exists to destroy, arrived at by a different door.

        The list deliberately carries words-only rows too (a surface has a word
        stack and no object). They hand the worker nothing and are deleted with
        the rest, which is why the delete is keyed on the list being non-empty
        rather than on any key having been collected.
      */
      const references = await listPurgeableReferencesIn(tx, candidateIds).catch(
        tolerateAbsentCandidateStore("referenceLibrary", TOLERANCE_CONTEXT),
      );
      for (const reference of references) {
        /* The crop AND its mask — two objects per minted row, like a segment's.
           Either may be absent (an uploaded anchor has no mask; a words-only row
           has neither), and an absent one is skipped rather than queued as a
           key nothing will find.

           AND THE REFUSED CROP'S PAIR (migration 0029), on exactly the same
           terms. Those bytes are the same thing — a crop of a person's face at
           a permanently public URL — and the only difference is that a guard
           turned them away, which is a reason to keep them from the painter
           rather than a reason to let them outlive the face. */
        for (const key of [
          reference.storageKey,
          reference.maskKey,
          reference.refusedContentKey,
          reference.refusedMaskKey,
        ]) {
          if (key) storageItems.push({ storageKey: key, storageBackend: "public_r2" as const });
        }
      }
      if (references.length > 0) await deleteReferenceRowsIn(tx, candidateIds);

      /*
        And a candidate's KEPT SCANS, on exactly the same terms (migration
        0032).

        This is the founder's storage condition made mechanical: *"as long as
        it wont clog up storage"*. Scan rows die with their cast, so the table
        grows with LIVING casts and never with time — and the stencils they
        own, one small object per feature found, go into the same manifest as
        everything else in this transaction.

        UNCONDITIONAL, like the two above. `CASTING_SCAN_TABLE_SCOPE` governs
        whether a row is written; nothing governs whether it is purged. A flag
        turned back off after rows exist must not strand them.

        A scan that found nothing still has a row and hands the worker no keys,
        which is why the delete is keyed on the LIST being non-empty rather
        than on any object having been collected.
      */
      const scans = await listPurgeableFaceScansIn(tx, candidateIds).catch(
        tolerateAbsentCandidateStore("faceScans", TOLERANCE_CONTEXT),
      );
      for (const scan of scans) {
        for (const key of scan.maskKeys) {
          storageItems.push({ storageKey: key, storageBackend: "public_r2" as const });
        }
      }
      if (scans.length > 0) await deleteFaceScanRowsIn(tx, candidateIds);

      /*
        And a candidate's UPLOADED INK DESIGNS, on exactly the same terms
        (migration 0034).

        This block carries the promise the upload door is allowed to make. Every
        other artifact above is something this product MADE; a design is a
        picture a customer handed us, kept at a permanently public URL under her
        Cast's own path. "It leaves when your Cast does" is true because of
        these four lines and nothing else.

        UNCONDITIONAL, like the three above. `CASTING_INK_STUDIO_SCOPE` governs
        whether a row is written; nothing governs whether it is purged. Every
        design row owns exactly one object — there is no words-only ink row — so
        the delete could have keyed on either, and it keys on the LIST for the
        same reason its siblings do.
      */
      /*
        THE PLATES COME FIRST, AND THE ORDER IS LOAD-BEARING (migration 0037).

        A plate has no `candidateId` of its own — deliberately, because a
        mirrored parent id is a second source of truth that drifts (working law
        4) — so the only path from a Cast to its plates runs THROUGH the design
        row. Delete the designs first and every plate becomes an orphan nothing
        can find, with its bytes left at a permanently public URL forever.

        Unconditional, like everything above it, and on the same terms: a flag
        governs whether a plate is ever WRITTEN and nothing governs whether it
        is purged. Which flag that is moved in #1158 slice 4b — the tolerance
        above now asks the DESIGN's question, because a plate hangs off a design
        row and the studio is not the only door that mints one.
      */
      const inkPlates = await listPurgeableInkPlatesIn(tx, candidateIds).catch(
        tolerateAbsentCandidateStore("inkPlates", TOLERANCE_CONTEXT),
      );
      for (const plate of inkPlates) {
        storageItems.push({ storageKey: plate.storageKey, storageBackend: "public_r2" as const });
      }
      if (inkPlates.length > 0) await deleteInkPlateRowsIn(tx, candidateIds);

      const inkDesigns = await listPurgeableInkDesignsIn(tx, candidateIds).catch(
        tolerateAbsentCandidateStore("inkDesigns", TOLERANCE_CONTEXT),
      );
      for (const design of inkDesigns) {
        storageItems.push({ storageKey: design.storageKey, storageBackend: "public_r2" as const });
      }
      if (inkDesigns.length > 0) await deleteInkDesignRowsIn(tx, candidateIds);

      /*
        THE CROP OF THE TATTOO AS IT LANDED ON HER (0049).

        Unconditional and NOT gated on any ink flag, on the same terms as
        everything above it: a flag governs whether a crop is ever CUT and
        nothing governs whether it is purged.

        It goes AFTER the designs deliberately, and the reason is the plate's
        one clause up with the roles swapped: this row's only path back to a
        Cast is its own `candidateId`, so the order costs nothing here — but a
        reader comparing the two should see that a delivery crop is not reached
        THROUGH a design and therefore cannot be orphaned by deleting one.
      */
      const inkDeliveryCrops = await listPurgeableInkDeliveryCropsIn(tx, candidateIds).catch(
        tolerateAbsentCandidateStore("inkDeliveryCrops", TOLERANCE_CONTEXT),
      );
      for (const crop of inkDeliveryCrops) {
        storageItems.push({ storageKey: crop.storageKey, storageBackend: "public_r2" as const });
      }
      if (inkDeliveryCrops.length > 0) await deleteInkDeliveryCropRowsIn(tx, candidateIds);

      /*
        THE CUTS TAKEN FROM A CUSTOMER'S OWN REFERENCE (0040).

        Unconditional, on the same terms as everything above it: the ingestion
        map governs whether a crop is ever WRITTEN and nothing governs whether
        it is purged. This is here before there is a writer, deliberately —
        a row-driven sweep that gains its clause when the writer lands is a
        sweep that was missing for however long the writer shipped first, and
        the objects it would have missed are cut-outs of a real person.
      */
      const referenceCrops = await listPurgeableReferenceCropsIn(tx, candidateIds).catch(
        tolerateAbsentCandidateStore("referenceCrops", TOLERANCE_CONTEXT),
      );
      for (const crop of referenceCrops) {
        storageItems.push({ storageKey: crop.storageKey, storageBackend: "public_r2" as const });
      }
      if (referenceCrops.length > 0) await deleteReferenceCropRowsIn(tx, candidateIds);

      /*
        THE PICTURES SHE ATTACHED (0043).

        Unconditional and NOT gated on the attach flag, on the same terms as
        everything above it: the flag governs whether a row is ever WRITTEN and
        nothing governs whether it is purged. This clause lands with the
        migration and ahead of the writer, which matters more here than
        anywhere else on this road — an attachment is a FULL PHOTOGRAPH of a
        real person at a permanently public URL, and a sweep that gained its
        clause after the writer shipped would have missed every one written in
        between.
      */
      const attachments = await listPurgeableReferenceAttachmentsIn(tx, candidateIds).catch(
        tolerateAbsentCandidateStore("referenceAttachments", TOLERANCE_CONTEXT),
      );
      for (const attachment of attachments) {
        storageItems.push({ storageKey: attachment.storageKey, storageBackend: "public_r2" as const });
      }
      if (attachments.length > 0) await deleteReferenceAttachmentRowsIn(tx, candidateIds);

      if (storageItems.length > 0) {
        await createStorageCleanupManifestIn(tx, {
          userId,
          operationId: randomUUID(),
          kind: "casting_candidate_cleanup",
          storageItems,
        });
      }
      // Rows go only after their objects are handed over, and the delete is
      // itself owner-scoped and refuses signed or kept rows — belt and braces
      // against a selection bug ever reaching a protected candidate.
      const deleted = await deleteCandidateRowsIn(tx, { userId, candidateIds });
      candidatesPurged += deleted;
      objectsQueued += storageItems.length;
    });
  }

  if (candidatesPurged > 0) {
    log.info(
      { sessionsExpired, candidatesPurged, objectsQueued },
      "[candidateRetention] swept expired casting candidates",
    );
  }
  return { sessionsExpired, candidatesPurged, objectsQueued };
}

/**
 * Starts the hourly sweep, and only when Casting V2 is actually on.
 *
 * There is nothing to retain while the flag is off — no roll can have been
 * created — so an always-on timer would be a query loop against empty tables.
 * It reads the scope rather than a boolean so an operator sees the same
 * switch here as everywhere else.
 */
export function startCandidateRetentionSweep(): void {
  const scope = parseCastingV2Scope(process.env[CASTING_V2_SCOPE_ENV]);
  if (scope.kind === "off") return;

  const run = () => {
    runCandidateRetentionSweep().catch((error) => {
      log.error({ err: error }, "[candidateRetention] sweep failed");
    });
  };
  setTimeout(run, FIRST_SWEEP_DELAY_MS).unref?.();
  setInterval(run, SWEEP_INTERVAL_MS).unref?.();
}
