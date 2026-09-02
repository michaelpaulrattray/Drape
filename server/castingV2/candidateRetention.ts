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
import {
  REFERENCE_INTENTS,
  referenceIntentIngestionForm,
  referenceIntentIsOpen,
} from "../../shared/referenceIntents";
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
import {
  castingInkStudioArmed,
  castingReferenceAttachArmed,
  castingReferenceLibraryArmed,
  castingScanTableArmed,
  castingInkDeliveryCropArmed,
  castingSegmentsArmed,
  parseCastingV2Scope,
  CASTING_V2_SCOPE_ENV,
} from "./castingV2Scope";

const log = createModuleLogger("castingV2/candidateRetention");

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const FIRST_SWEEP_DELAY_MS = 90 * 1000;

/**
 * IS THIS THE DRIVER SAYING "NO SUCH TABLE"? — asked of the whole chain.
 *
 * **Production taught this, within two minutes of the deploy.** The first
 * version read `error.code` off the top-level error, which is the shape a
 * hand-written test error has and NOT the shape the real path produces: Drizzle
 * wraps the driver's error in a `DrizzleQueryError` and hangs the original off
 * `cause`, so the tolerance never fired, the sweep threw, and 56 candidates
 * went uncollected on the first pass.
 *
 * A test that invents the error it expects is testing its own invention. The
 * chain walk is the fix; asserting BOTH shapes is what keeps it honest.
 */
function isMissingTable(error: unknown): boolean {
  for (let link: unknown = error, depth = 0; link && depth < 5; depth += 1) {
    const { code, errno, cause } = link as { code?: string; errno?: number; cause?: unknown };
    if (code === "ER_NO_SUCH_TABLE" || errno === 1146) return true;
    link = cause;
  }
  return false;
}

/**
 * THE ONE TOLERATED FAILURE OF THE SEGMENT PURGE, and its exact limit.
 *
 * A database whose segment table has not been created yet is a real state:
 * production gets the table by ceremony, and the code that knows about it
 * deploys on its own schedule. In that window there are no segments to purge,
 * because nothing can have written one — so skipping is not a lost object, it
 * is an empty set arrived at the slow way.
 *
 * The tolerance ends the moment the store is armed. If the flag is on and the
 * table is missing, something is wrong that a warning would bury, and the
 * sweep says so instead. Every other error — a lock, a connection, a syntax
 * mistake of ours — is rethrown at every setting: swallowing those is how a
 * purge becomes a claim rather than a fact.
 */
function tolerateAbsentSegmentStore(error: unknown): never | [] {
  if (!isMissingTable(error) || castingSegmentsArmed()) throw error;
  log.warn(
    "[candidateRetention] the segment store's table is absent — nothing can have been written to it, so nothing is being left behind. This is expected only before the segment migration lands.",
  );
  return [];
}

/**
 * The same tolerance, on the same terms, for the reference library.
 *
 * Its table lands by ceremony too, so the window where the code knows about
 * `casting_reference_library` and the database does not is real — and empty,
 * because the flag that would write a row is off until after the ceremony. The
 * moment the library is armed, a missing table stops being an empty set and
 * starts being a fault the sweep says out loud.
 */
function tolerateAbsentReferenceLibrary(error: unknown): never | [] {
  if (!isMissingTable(error) || castingReferenceLibraryArmed()) throw error;
  log.warn(
    "[candidateRetention] the reference library's table is absent — nothing can have been written to it, so nothing is being left behind. This is expected only before the library migration lands.",
  );
  return [];
}

/**
 * The same tolerance, on the same terms, for the kept face scan (0032).
 *
 * Its table lands by ceremony too, and the window where this code knows about
 * `casting_face_scans` and the database does not is real and empty. Armed, a
 * missing table stops being an empty set and becomes a fault said out loud.
 *
 * ⚠ **THE REASON IT IS EMPTY CHANGED, AND THE CONCLUSION DID NOT** (2026-08-23,
 * fable-1445 §2). This paragraph used to say *the flag that would write a row
 * refuses to arm until after the ceremony*, and that stopped being the whole
 * truth the day the render began filing CARRIED GEOMETRY here ungated — the
 * scan was only ever this table's first writer, not its meaning.
 *
 * What keeps the tolerance honest is the other end: `reMintCarriedGeometry`
 * catches an absent table, counts it and stands the picture up, so a world
 * without migration 0032 still has nothing in this table to be left behind. And
 * the loud signal for a missing table moved rather than disappeared — it is now
 * that writer's own countable line, which fires on every render instead of once
 * a sweep.
 */
function tolerateAbsentFaceScanStore(error: unknown): never | [] {
  if (!isMissingTable(error) || castingScanTableArmed()) throw error;
  log.warn(
    "[candidateRetention] the kept-scan table is absent — nothing can have been written to it, so nothing is being left behind. This is expected only before the scan-table migration lands.",
  );
  return [];
}

/**
 * The same tolerance, on the same terms, for an uploaded ink design (0034).
 *
 * This one's window is not hypothetical: production is running this sweep every
 * pass right now and has NOT taken the migration, so the table is genuinely
 * absent there — and genuinely empty, because the studio's door is off. Armed,
 * a missing table stops being an empty set and becomes a fault said out loud.
 */
/**
 * And again for a reference CROP (0040) — a different table, a different
 * migration, and an arming condition that is not a flag at all.
 *
 * There is no `CASTING_REFERENCE_CROP_SCOPE`. What decides whether a crop can
 * exist is the ingestion map itself: a crop-form feature whose `open` is false
 * cannot be acted on by any door, so no row can have been written. So the
 * tolerance is armed by the MAP, derived rather than listed (law 4) — the day
 * somebody flips `hair.open`, a missing table stops being an empty set and
 * becomes a fault said out loud, without anybody remembering to edit this.
 */
function cropStoreArmed(): boolean {
  return REFERENCE_INTENTS.some(
    (key) => referenceIntentIngestionForm(key) === "crop" && referenceIntentIsOpen(key),
  );
}

function tolerateAbsentReferenceCropStore(error: unknown): never | [] {
  if (!isMissingTable(error) || cropStoreArmed()) throw error;
  log.warn(
    "[candidateRetention] the reference crop table is absent — no crop-form feature is open, so nothing can have been written to it and nothing is being left behind. This is expected only before the 0040 migration lands.",
  );
  return [];
}

/**
 * And the same for an ATTACHMENT (0043).
 *
 * Its arming question is its own FLAG rather than the ingestion map, because an
 * attachment is not a form — any open intent can produce one, and the thing that
 * decides whether a row can exist is whether the attach door is open at all. The
 * moment it is, an absent table becomes a fault said out loud instead of a
 * tolerated warning, without anybody remembering to edit this.
 */
function tolerateAbsentReferenceAttachmentStore(error: unknown): never | [] {
  if (!isMissingTable(error) || castingReferenceAttachArmed()) throw error;
  log.warn(
    "[candidateRetention] the reference attachment table is absent — the attach door is closed for everyone, so nothing can have been written to it and nothing is being left behind. This is expected only before the 0043 migration lands.",
  );
  return [];
}

function tolerateAbsentInkDesignStore(error: unknown): never | [] {
  if (!isMissingTable(error) || castingInkStudioArmed()) throw error;
  log.warn(
    "[candidateRetention] the ink design table is absent — nothing can have been written to it, so nothing is being left behind. This is expected only before the ink-studio migration lands.",
  );
  return [];
}

/**
 * And the same again for a PLATE (0037) — a different table with a different
 * migration, so a different tolerance rather than one that covers both.
 *
 * Its window is the widest of the three: production has taken neither 0034 nor
 * 0037, and a plate cannot exist without a design, so an absent plate table is
 * doubly empty. Armed by the same flag, because the same door governs whether
 * either row is ever written.
 */
function tolerateAbsentInkPlateStore(error: unknown): never | [] {
  if (!isMissingTable(error) || castingInkStudioArmed()) throw error;
  log.warn(
    "[candidateRetention] the ink plate table is absent — nothing can have been written to it, so nothing is being left behind. This is expected only before the plate migration lands.",
  );
  return [];
}

/**
 * And the same again for a DELIVERED-TATTOO CROP (0049).
 *
 * Its arming question is neither a single flag nor the ingestion map: a crop
 * here cannot exist without a design row, and TWO doors mint one — the studio's
 * upload and the take from an attached picture. `castingInkDeliveryCropArmed`
 * is that OR, derived where the scopes live rather than spelled a second time
 * here (law 4).
 *
 * This clause lands with the migration and with the writer in one commit,
 * which is the ordering that matters most on this road: the object is a crop of
 * a real person's neck at a permanently public URL, and a row-driven sweep that
 * gained its clause afterwards would have missed every crop written in between.
 */
function tolerateAbsentInkDeliveryCropStore(error: unknown): never | [] {
  if (!isMissingTable(error) || castingInkDeliveryCropArmed()) throw error;
  log.warn(
    "[candidateRetention] the delivered-tattoo crop table is absent — no ink door is open, so nothing can have been written to it and nothing is being left behind. This is expected only before the 0049 migration lands.",
  );
  return [];
}

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
      LESS** (2026-09-03, card #11 — the founder retired the trim on his own eye).
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
        (error: unknown) => tolerateAbsentSegmentStore(error),
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
        (error: unknown) => tolerateAbsentReferenceLibrary(error),
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
        (error: unknown) => tolerateAbsentFaceScanStore(error),
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

        Unconditional, like everything above it, and on the same terms: the
        studio flag governs whether a plate is written and nothing governs
        whether it is purged.
      */
      const inkPlates = await listPurgeableInkPlatesIn(tx, candidateIds).catch(
        (error: unknown) => tolerateAbsentInkPlateStore(error),
      );
      for (const plate of inkPlates) {
        storageItems.push({ storageKey: plate.storageKey, storageBackend: "public_r2" as const });
      }
      if (inkPlates.length > 0) await deleteInkPlateRowsIn(tx, candidateIds);

      const inkDesigns = await listPurgeableInkDesignsIn(tx, candidateIds).catch(
        (error: unknown) => tolerateAbsentInkDesignStore(error),
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
        (error: unknown) => tolerateAbsentInkDeliveryCropStore(error),
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
        (error: unknown) => tolerateAbsentReferenceCropStore(error),
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
        (error: unknown) => tolerateAbsentReferenceAttachmentStore(error),
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
