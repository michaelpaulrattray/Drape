/**
 * ATTACHING A DESIGN TO A CAST — the ink studio's only write, M12 row 15.
 *
 * A customer picks a tattoo she owns, says where on her it goes, and this keeps
 * a copy of it against her Cast. That is the whole of it today: nothing is
 * rendered, nothing is charged, and no credit path exists to charge on
 * (fable-921 §3b — an upload that cannot deliver is a promise the product
 * cannot keep, so the door stays dark until the plate exists).
 *
 * # WHAT THIS FILE IS RESPONSIBLE FOR: the ORDER
 *
 * The decisions are in `inkUploadDoor.ts` and the statements in
 * `db/castingV2InkDesigns.ts`. What lives here is the sequence, and the
 * sequence is the part that goes wrong invisibly:
 *
 *   1. the doors, before a single byte moves — a refusal costs nothing
 *   2. the MANIFEST, naming the exact key about to be written
 *   3. the BYTES, to that key
 *   4. the ROW, which discharges the manifest in its own transaction
 *
 * Steps 2–4 are the library's own discipline and they are here for the reason
 * it learned them: bytes at a permanently public URL with no row referencing
 * them are litter nobody will ever go looking for, and a crash between two
 * writes is not a rare event on a road that stores megabytes. If step 3 dies
 * the hold lapses and the worker collects; if step 4 dies the same; only a
 * committed row releases the receipt.
 *
 * # COPY, NEVER POINTER — and never a re-encode either
 *
 * The bytes stored are the bytes given, unchanged. A copy is what makes the
 * design OURS to purge with her Cast (`candidateRetention.ts`, unconditional),
 * and leaving them untouched is what makes the digest mean byte identity later
 * — the same thing the reference library's `digest` means, and the reason a
 * reference whose bytes have moved can be refused rather than painted.
 *
 * # THE PHOTOGRAPH NEVER REACHES A RENDER
 *
 * This is an ingestion path, not a reference path. The founder's architecture
 * re-draws ink onto a neutral ghost mannequin (D-138, fable-684 §2), and it is
 * that PLATE the engine is shown — which is how the real-person fence is met by
 * construction rather than by a filter. The distiller that makes the plate is
 * the next build, with its own court: a face-bearing reference must produce a
 * plate with ZERO person content, proven at the frames (fable-919 §3).
 */
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";

import type { InkPlacement } from "../../shared/inkPlacementVocabulary";
import type { InkProvenance } from "../../shared/inkProvenance";
import type { InkSide } from "../../shared/inkReleasedPlacements";
import type { ReferenceIntent } from "../../shared/referenceIntents";
import { withTransaction } from "../db/connection";
import {
  recordInkDesign,
  type InkDesignToRecord,
  type RecordedInkDesign,
} from "../db/castingV2InkDesigns";
import {
  createStorageCleanupManifestIn,
  storageCleanupManifestHeldUntil,
} from "../db/storageCleanup";
import { storagePut } from "../storage";
import {
  inkDesignBytesRefusal,
  inkDesignContentType,
  inkDesignKey,
  inkIntentRefusal,
  inkPlacementRefusal,
  isInkDesignFormat,
  type InkUploadRefusal,
} from "./inkUploadDoor";

export type InkUploadRequest = {
  userId: number;
  candidatePublicId: string;
  placement: InkPlacement;
  side: InkSide;
  provenance: InkProvenance;
  /** What is being taken from this picture (fable-937). Never inferred. */
  intents: readonly ReferenceIntent[];
  bytes: Buffer;
};

export type InkUploadOutcome =
  | { ok: true; design: RecordedInkDesign & { width: number; height: number } }
  | { ok: false; refusal: InkUploadRefusal };

export type InkUploadDependencies = {
  manifest: (input: { id: string; userId: number; storageKeys: readonly string[] }) => Promise<void>;
  store: (input: { key: string; bytes: Buffer; contentType: string }) => Promise<{ key: string; url: string }>;
  record: (input: InkDesignToRecord) => Promise<RecordedInkDesign>;
};

async function defaultManifest(input: {
  id: string;
  userId: number;
  storageKeys: readonly string[];
}): Promise<void> {
  await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
    id: input.id,
    userId: input.userId,
    /* A synthetic operation id, like the mint's and the sweep's: the column is
       unique and NOT NULL, and an upload is not a generation operation. */
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

const REAL: InkUploadDependencies = {
  manifest: defaultManifest,
  store: (one) => storagePut(one.key, one.bytes, one.contentType),
  record: recordInkDesign,
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

export async function uploadInkDesign(
  request: InkUploadRequest,
  dependencies: InkUploadDependencies = REAL,
): Promise<InkUploadOutcome> {
  /*
    THE DECLARATION FIRST, before the placement and long before the bytes.

    "No extraction without intent" reads backwards if the picture is examined
    first: a customer who declared a feature this product cannot take yet should
    hear that, rather than a verdict about her photograph.
  */
  const declared = inkIntentRefusal(request.intents);
  if (declared) return { ok: false, refusal: declared };

  /*
    THE FRAME IS THE MASTER, and it is stated rather than passed in. A Cast's
    photograph is `cohortPhotorealHuman`'s waist-up portrait until it is signed,
    and the placement vocabulary was measured on exactly those frames. When a
    design is eventually carried into a package VIEW, that view's framing is the
    render's question, and it is answered by the same total function.
  */
  const placement = inkPlacementRefusal({
    placement: request.placement,
    side: request.side,
    framing: "master",
  });
  if (placement) return { ok: false, refusal: placement };

  const decoded = await readBytes(request.bytes);
  const bytes = inkDesignBytesRefusal({ byteSize: request.bytes.byteLength, decoded });
  if (bytes) return { ok: false, refusal: bytes };
  /* Narrowed by the door above; restated for the type rather than re-decided. */
  if (!decoded || !isInkDesignFormat(decoded.format)) {
    return { ok: false, refusal: { code: "unreadable", message: "That file isn't an image we can read." } };
  }

  const storageKey = inkDesignKey(decoded.format);
  const cleanupBatchId = randomUUID();
  await dependencies.manifest({
    id: cleanupBatchId,
    userId: request.userId,
    storageKeys: [storageKey],
  });

  const contentType = inkDesignContentType(decoded.format);
  await dependencies.store({ key: storageKey, bytes: request.bytes, contentType });

  const design = await dependencies.record({
    userId: request.userId,
    candidatePublicId: request.candidatePublicId,
    placement: request.placement,
    side: request.side,
    provenance: request.provenance,
    intents: request.intents,
    storageKey,
    digest: createHash("sha256").update(request.bytes).digest("hex"),
    mime: contentType,
    byteSize: request.bytes.byteLength,
    width: decoded.width ?? 0,
    height: decoded.height ?? 0,
    cleanupBatchId,
  });

  return {
    ok: true,
    design: { ...design, width: decoded.width ?? 0, height: decoded.height ?? 0 },
  };
}
