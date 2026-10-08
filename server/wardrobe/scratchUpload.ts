/**
 * A WARDROBE SCRATCH UPLOAD — registered before it exists, so nothing is an
 * orphan at birth (#1961).
 *
 * ## The defect this closes
 *
 * Four wardrobe writes put a customer's photograph to the **public** bucket
 * and recorded the key nowhere. `server/storage.ts`'s own header says those
 * URLs are not presigned and never expire, so each object stayed reachable
 * forever by anyone who had the link — and because no row and no manifest
 * named it, no cleanup could ever reach it either, for every account and not
 * only a deleted one. `git grep` for either key prefix returned the write line
 * and nothing else: no reader, no manifest, no sweep.
 *
 * ⚠ **IT IS A DIFFERENT DEFECT FROM #1954'S RACE, which is why it is a
 * different card and a different fix.** #1954 is a render that writes AFTER an
 * erasure took its manifest — a window. This is an orphan from the moment the
 * bytes land, with no window to narrow.
 *
 * ## Why these objects exist at all, which is the uncomfortable part
 *
 * None of them needs to be public, and two of them need not exist. The
 * detector inlines its image (`toInlinePart` → `urlToBase64`, which accepts a
 * `data:` URL by name) and the cropper works from a `Buffer`, so the upload is
 * a way of handing the server a URL for bytes it already holds and is about to
 * download again. ⚠ **That is NOT repaired here and the reason is stated
 * rather than left to be discovered**: the URLs escape to the client and are
 * what `wardrobe.garments.import` persists on a garment row, so removing them
 * is a change to a contract rather than a cleanup. It is filed, with the
 * import-side half beside it.
 *
 * ## The shape, and it is the refine road's
 *
 * `server/castingV2/refineService.ts` states the rule its own manifest keeps:
 * *"a thumbnail put to a public key with nothing that knows it exists is the
 * same orphan as a frame"*. The manifest is written in its own committed
 * transaction BEFORE the bytes, so a crash between the two leaves a manifest
 * naming an object that may or may not exist — which the worker handles — and
 * never bytes that nothing names.
 *
 * ⚠ **BORN HELD.** A manifest written before its bytes is claimable the
 * instant it lands, because the in-flight fence tests a live operation row and
 * these batches carry a synthetic operation id that matches none. That race
 * really fired once (it deleted a delivered crop mid-mint), so the hold is the
 * one `createStorageCleanupManifestIn` already speaks, and it is the same
 * lease an in-flight operation holds — derived, not chosen.
 *
 * ## What a customer notices: nothing
 *
 * Nothing in the product renders these objects — the decomposition drawer
 * draws its preview from a local `URL.createObjectURL` of the file in the
 * browser, read at `client/src/features/wardrobe/components/DecompositionDrawer.tsx`
 * — and the one road that would persist them, `wardrobe.garments.import`,
 * refuses on his word (#1537, *"SWITCH IT OFF"*). So the sweep that follows
 * takes bytes no screen was showing.
 */
import { randomUUID } from "crypto";

import { createStorageCleanupManifestIn, storageCleanupManifestHeldUntil } from "../db/storageCleanup";
import { withTransaction } from "../db/connection";
import { storagePut } from "../storage";

export interface ScratchUploadResult {
  /** The public URL, exactly as `storagePut` returns it. */
  url: string;
  /** The key, so a caller that wants to say what it registered can. */
  key: string;
  /** The manifest that names it — the receipt a driven arm reads. */
  cleanupBatchId: string;
}

/**
 * Everything this reaches, injectable so the ordering can be driven without a
 * database or a bucket. The ORDER is the whole contract, so the arms assert a
 * sequence rather than two calls having happened.
 */
export interface ScratchUploadDeps {
  registerManifest: (input: {
    id: string;
    userId: number;
    operationId: string;
    storageKey: string;
  }) => Promise<void>;
  put: (key: string, bytes: Buffer, contentType: string) => Promise<{ url: string }>;
}

function liveDeps(): ScratchUploadDeps {
  return {
    registerManifest: async (input) => {
      /*
        ITS OWN COMMITTED TRANSACTION, not the caller's — the refine road's
        reason, verbatim in its own comment: the failure it guards against must
        not be able to roll it back.
      */
      await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
        id: input.id,
        userId: input.userId,
        operationId: input.operationId,
        kind: "wardrobe_scratch_cleanup",
        storageItems: [{ storageKey: input.storageKey, storageBackend: "public_r2" }],
        heldUntil: storageCleanupManifestHeldUntil(),
      }));
    },
    put: (key, bytes, contentType) => storagePut(key, bytes, contentType),
  };
}

/**
 * Register the key, then write the bytes. Never the other way round.
 *
 * ⚠ **A REGISTRATION THAT FAILS REFUSES THE WRITE**, by doing nothing to catch
 * it: the throw propagates, the route fails, and no unregistered object is
 * created. That is invariant 7's second clause — a control refuses rather than
 * allows when its dependency is missing — and it is the reason migration 0074
 * is sequenced ahead of this code rather than assumed to have landed.
 */
export async function putWardrobeScratchUpload(
  input: { userId: number; key: string; bytes: Buffer; contentType: string },
  deps: ScratchUploadDeps = liveDeps(),
): Promise<ScratchUploadResult> {
  const cleanupBatchId = randomUUID();
  await deps.registerManifest({
    id: cleanupBatchId,
    userId: input.userId,
    /* A synthetic id: there is no generation operation behind a free detector
       read. It is a uuid for the same reason the manifest's own id is one —
       `buildStorageCleanupManifest` asserts the shape — and the batch table's
       unique index on it is what keeps two scratch uploads apart. */
    operationId: cleanupBatchId,
    storageKey: input.key,
  });
  const { url } = await deps.put(input.key, input.bytes, input.contentType);
  return { url, key: input.key, cleanupBatchId };
}
