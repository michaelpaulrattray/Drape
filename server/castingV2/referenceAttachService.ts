/**
 * ATTACHING A PICTURE TO A CAST — build two's only write (design §2,
 * countersigned fable-1063 §1).
 *
 * A customer hands the product a photograph and gets a handle back. Nothing is
 * read from it, nothing is cut out of it, nothing is charged, and no engine of
 * any kind is called. That is the whole of this file, and the smallness is the
 * design: the attach is a separate door from `refine` precisely so that a paid,
 * rate-limited procedure does not carry a multi-megabyte upload on every ask.
 *
 * # WHAT THIS FILE IS RESPONSIBLE FOR: the ORDER
 *
 * The decisions are in `referenceAttachDoor.ts` and the statements in
 * `db/castingV2ReferenceAttachments.ts`. What lives here is the sequence, and
 * the sequence is the part that goes wrong invisibly:
 *
 *   1. the doors, before a single byte moves — a refusal costs nothing
 *   2. the MANIFEST, naming the exact key about to be written
 *   3. the BYTES, to that key
 *   4. the ROW, which discharges the manifest in its own transaction
 *
 * Steps 2–4 are the keeper-receipt pattern, and fable-1063 §1's rider names it
 * for this door because **this program has now paid for it twice**: bytes at a
 * permanently public URL with no row referencing them are litter nobody will
 * ever go looking for, and a crash between two writes is not a rare event on a
 * road that stores megabytes. If step 3 dies the hold lapses and the worker
 * collects; if step 4 dies the same; only a committed row releases the receipt.
 *
 * **On this road the litter would be a photograph of a person**, which is why
 * the order is not negotiable and why the sweep clause for the table landed with
 * the migration rather than with this file.
 *
 * # COPY, NEVER POINTER — and never a re-encode either
 *
 * The bytes stored are the bytes given, unchanged. A copy is what makes the
 * picture OURS to purge with her Cast (`candidateRetention.ts`, unconditional
 * and not gated on the attach flag), and leaving them untouched is what makes
 * the digest mean byte identity later — the same thing the reference library's
 * `digest` means, and the reason a reference whose bytes have moved can be
 * refused rather than painted.
 */
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";

import type { InkProvenance } from "../../shared/inkProvenance";
import { withTransaction } from "../db/connection";
import {
  recordReferenceAttachment,
  type RecordedReferenceAttachment,
  type ReferenceAttachmentToRecord,
} from "../db/castingV2ReferenceAttachments";
import {
  createStorageCleanupManifestIn,
  storageCleanupManifestHeldUntil,
} from "../db/storageCleanup";
import { storagePut } from "../storage";
import { inkDesignContentType, isInkDesignFormat } from "./inkUploadDoor";
import {
  REFERENCE_PICTURES_PER_CANDIDATE,
  referenceAttachBytesRefusal,
  referenceAttachmentKey,
  type ReferenceAttachRefusal,
} from "./referenceAttachDoor";

export type ReferenceAttachRequest = {
  userId: number;
  candidatePublicId: string;
  /** What was CLAIMED about the source. Never defaulted, never inferred. */
  provenance: InkProvenance;
  bytes: Buffer;
};

export type ReferenceAttachOutcome =
  | { ok: true; attachment: RecordedReferenceAttachment }
  | { ok: false; refusal: ReferenceAttachRefusal };

export type ReferenceAttachDependencies = {
  manifest: (input: { id: string; userId: number; storageKeys: readonly string[] }) => Promise<void>;
  store: (input: { key: string; bytes: Buffer; contentType: string }) => Promise<{ key: string; url: string }>;
  record: (input: ReferenceAttachmentToRecord) => Promise<RecordedReferenceAttachment>;
};

async function defaultManifest(input: {
  id: string;
  userId: number;
  storageKeys: readonly string[];
}): Promise<void> {
  await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
    id: input.id,
    userId: input.userId,
    /* A synthetic operation id, like the ink upload's and the sweep's: the
       column is unique and NOT NULL, and an attach is not a generation
       operation. */
    operationId: randomUUID(),
    /* BORN HELD, and the synthetic id above is exactly why — the worker's
       in-flight fence tests a batch against a live operation row, and a
       synthetic id matches none. Without the hold this manifest is claimable
       the instant it is written, while the bytes it names are still uploading. */
    heldUntil: storageCleanupManifestHeldUntil(),
    kind: "casting_candidate_cleanup",
    storageItems: input.storageKeys.map((storageKey) => ({
      storageKey,
      storageBackend: "public_r2" as const,
    })),
  }));
}

const REAL: ReferenceAttachDependencies = {
  manifest: defaultManifest,
  store: (one) => storagePut(one.key, one.bytes, one.contentType),
  record: recordReferenceAttachment,
};

/**
 * What the bytes ARE — asked of a decoder, never of the caller.
 *
 * There is no parameter on this path for a declared mime or a filename, which
 * is the point: a `.png` name over a PDF is a PDF here, and an image that will
 * not decode is refused rather than kept as an unopenable object.
 */
async function readBytes(bytes: Buffer): Promise<{ format?: string; width?: number; height?: number } | null> {
  try {
    const meta = await sharp(bytes).metadata();
    return { format: meta.format, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

export async function attachReference(
  request: ReferenceAttachRequest,
  dependencies: ReferenceAttachDependencies = REAL,
): Promise<ReferenceAttachOutcome> {
  const decoded = await readBytes(request.bytes);
  const bytes = referenceAttachBytesRefusal({ byteSize: request.bytes.byteLength, decoded });
  if (bytes) return { ok: false, refusal: bytes };
  /* Narrowed by the door above; restated for the type rather than re-decided,
     so a future edit to the door cannot leave a lie here. */
  if (!decoded || !isInkDesignFormat(decoded.format)) {
    return { ok: false, refusal: { code: "unreadable", message: "That file isn't an image we can read." } };
  }

  const storageKey = referenceAttachmentKey(decoded.format);
  const cleanupBatchId = randomUUID();
  await dependencies.manifest({
    id: cleanupBatchId,
    userId: request.userId,
    storageKeys: [storageKey],
  });

  const contentType = inkDesignContentType(decoded.format);
  await dependencies.store({ key: storageKey, bytes: request.bytes, contentType });

  /*
    THE ROW, and the CAP is enforced inside its transaction rather than read
    here (see the db half). A cap counted in this file would be a check-then-
    write, which is the shape invariant 1 exists to refuse — and it would also
    be counted against one store while the cap spans two.

    The cap is deliberately checked AFTER the bytes are stored rather than
    before: a refusal at the row leaves an undischarged manifest, and an
    undischarged manifest is exactly what the worker collects. Checking first
    would be one query cheaper and would put the cap in a different place from
    the ownership check, which is the thing that must not race.
  */
  const attachment = await dependencies.record({
    userId: request.userId,
    candidatePublicId: request.candidatePublicId,
    provenance: request.provenance,
    storageKey,
    digest: createHash("sha256").update(request.bytes).digest("hex"),
    mime: contentType,
    byteSize: request.bytes.byteLength,
    width: decoded.width ?? 0,
    height: decoded.height ?? 0,
    cap: REFERENCE_PICTURES_PER_CANDIDATE,
  });

  return { ok: true, attachment };
}
