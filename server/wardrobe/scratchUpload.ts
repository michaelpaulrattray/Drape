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
 * one `createStorageCleanupManifestIn` already speaks.
 *
 * ⚠ **AND THE HOLD IS THE CUSTOMER'S WORKING WINDOW, NOT THE WRITE'S — IT WAS
 * FIVE MINUTES AND THAT WAS THE SECOND DEFECT THE RELAY FOUND ON PR #1979.**
 * It was `storageCleanupManifestHeldUntil()`, derived from the in-flight
 * generation lease, on the stated ground that one constant should mean one
 * thing. The derivation was the mistake: *how long may a writer keep its claim
 * while it writes* and *how long does a customer work against this picture* are
 * different questions, and borrowing the answer to the first silently answered
 * the second. See {@link WARDROBE_SCRATCH_HOLD_MS}.
 *
 * ## What a customer notices
 *
 * The decomposition drawer draws its own preview from a local
 * `URL.createObjectURL` of the file in the browser (read at
 * `client/src/features/wardrobe/components/DecompositionDrawer.tsx`), so the
 * scan and the outfit photo are never rendered from these URLs.
 *
 * ⚠ **The MODEL PHOTO is, and that is why the hold had to move.** The studio
 * keeps it in a Zustand store and the wardrobe workspace renders it as the base
 * picture (`WardrobeWorkspaceSection.tsx`, `displayUrl={gen.currentResult ||
 * modelImageUrl}`), so a five-minute sweep took the picture off the screen
 * mid-session.
 *
 * ⚠ **AND THE ONE REMAINDER IS NAMED RATHER THAN LEFT TO BE FOUND: a model
 * photo outlives this hold and is then swept, so a session RESUMED later than
 * the hold shows a picture that is gone.** No row owns that key and the
 * account-erasure sweep says why in its own comment — *"A session's
 * modelImageUrl is a reference input and may be shared"* — so a
 * `modelImageKey` column written only for upload-only sessions is a build with
 * a migration, filed as its own card rather than folded in here. Before this
 * card the same object lived at a public URL **for ever**, which is what the
 * sweep is for.
 */
import { randomUUID } from "crypto";

import { createStorageCleanupManifestIn } from "../db/storageCleanup";
import { withTransaction } from "../db/connection";
import { storagePut } from "../storage";

/**
 * How long a wardrobe scratch object is held before the worker may collect it.
 *
 * ⚠ **IT ANSWERS "HOW LONG IS A CUSTOMER STILL USING THIS PICTURE", AND
 * NOTHING ELSE.** It was `STORAGE_CLEANUP_MANIFEST_HOLD_MS` — five minutes, the
 * in-flight generation lease — and that is a writer's claim on bytes it is
 * still writing. These four objects are a customer's working set: a scan they
 * are picking garments out of, an outfit photo and its crops they will import
 * from, a model photo the workspace is rendering. Five minutes is shorter than
 * choosing, and shorter than the paid digitize the chosen crop feeds.
 *
 * **A day**, and the number is stated with its trade rather than derived from a
 * constant that answers a different question:
 *
 * - It is the one window in this tree answering the same shape of question —
 *   `CASTING_DISCARD_RETENTION_MS`, *"a discarded candidate stays undoable"* —
 *   and it is the figure the relay named on the finding.
 * - ⚠ **What it costs, said plainly: one of these objects now sits at a
 *   permanently public, unguessable URL for up to a day instead of up to five
 *   minutes.** Against *for ever*, which is what #1961 is about, and against a
 *   working feature, which five minutes was not.
 * - It is **not** derived from `vtoSession.ts`'s 30-minute `SESSION_TTL_MS`,
 *   which was the tempting read: that evicts an in-memory chat on an engine
 *   Google shut down, behind the closed door. Deriving from a constant that
 *   answers a different question is how the five minutes got here.
 */
export const WARDROBE_SCRATCH_HOLD_MS = 24 * 60 * 60 * 1000;

/** The instant a wardrobe scratch manifest born now stops holding itself. */
export function wardrobeScratchHeldUntil(now: Date = new Date()): Date {
  return new Date(now.getTime() + WARDROBE_SCRATCH_HOLD_MS);
}

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
        heldUntil: wardrobeScratchHeldUntil(),
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
