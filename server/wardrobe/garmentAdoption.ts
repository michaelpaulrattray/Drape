/**
 * A GARMENT OWNS THE PICTURES ON ITS ROW — it does not borrow them from a
 * scratch upload (#1961, the relay's finding on PR #1979).
 *
 * # What was wrong, and it was worse than the card said
 *
 * `wardrobe.garments.import` wrote `originalImageUrl` and `sourceImageUrl`
 * straight from the URLs `quickDetect` and `decompose.analyze` had handed the
 * client. Those keys are now registered in a storage-cleanup manifest, so the
 * worker deletes them — and the garment row was left pointing at nothing. The
 * relay read it at the hold: `STORAGE_CLEANUP_MANIFEST_HOLD_MS` was five
 * minutes, so *"about 5 minutes after detect, the garment's images point at
 * nothing. A customer who imports after 5 minutes feeds a deleted URL into the
 * paid digitize."*
 *
 * ⚠ **AND RELEASING THE MANIFEST WOULD NOT HAVE CLOSED IT — read at
 * `server/db/accountDeletion.ts:596`.** The account-erasure sweep takes a
 * garment's objects from `originalImageKey`, `isolatedImageKey` and
 * `sourceImageKey` — the KEY columns. The import road set none of them, and
 * still does not set `isolatedImageKey` (its own card). So a garment imported
 * from a decomposition had **no key anywhere on its row**: releasing the
 * scratch manifest would have moved the orphan from *"a manifest promises to
 * delete it"* to *"nothing names it at all"*, which is the card's own defect
 * wearing the other hat.
 *
 * # The shape, and it is Sign's
 *
 * `server/casting/castLineagePurge.ts` states the precedent in its own words:
 * *"Sign COPIES the chosen image to a new Cast-owned object
 * (`storageCopyExact`), so deleting the Cast destroys the copy and leaves the
 * sheet's own face untouched."* The same sentence, one feature over: **import
 * copies the chosen pictures to garment-owned objects, so deleting the garment
 * or the account destroys the copies, and the decomposition's own scratch is
 * swept by the worker exactly as it was registered to be.**
 *
 * It is the second of the two repairs the relay offered — *"or copy the bytes
 * to a row-owned key"* — and it was taken over the first for three reasons,
 * each read rather than argued:
 *
 * 1. **A release needs the keys on the row anyway** (the sweep above), so the
 *    release road is this road plus a release.
 * 2. **A release keyed on a batch id the client returns can disagree with the
 *    key being persisted.** Verifying that the batch names the key makes the
 *    key the identifier and the batch id redundant.
 * 3. **The scratch manifests stay true.** `scratchUpload.ts` remains a
 *    COLLECTOR in `server/storageManifestReceipt.test.ts` — its bytes really
 *    are collected once the request is over — and this module is the KEEPER,
 *    which is the classification that table exists to force.
 *
 * # Register, copy, then the row discharges the receipt
 *
 * The destination is registered in its own held manifest BEFORE the bytes are
 * copied, so a crash between the two leaves a manifest naming an object that
 * may or may not exist — which the worker handles — and never bytes that
 * nothing names. `createGarment` then deletes the manifest **in the same
 * transaction as the insert**, which is the keeper-receipt pattern
 * `server/db/castingV2ReferenceAttachments.ts` carries, with its own history of
 * the row that survived pointing at nothing.
 *
 * # What a customer notices
 *
 * Nothing, today: `import` refuses on his word (#1537, *"SWITCH IT OFF"*), so
 * this road cannot run until wardrobe reopens. That is the point — the relay's
 * words: *"That plants the break for the day wardrobe reopens."*
 */
/* `node:crypto`, not `crypto` — `server/storage-key-generation.test.ts`
   requires the prefixed specifier of every file that interpolates a uuid into a
   storage key, so the randomness a public key rests on names its own source. */
import { randomUUID } from "node:crypto";

import { classifyStorageReference } from "../casting/deletionAudit";
import { createStorageCleanupManifestIn } from "../db/storageCleanup";
import { withTransaction } from "../db/connection";
import { storageCopyExact } from "../storage";
import { spokenError } from "../_core/spokenError";
import { GarmentPictureReceiptError } from "../db/wardrobe";
import { wardrobeScratchHeldUntil } from "./scratchUpload";

/**
 * The one sentence a customer could ever see from here, and it names what to
 * do. It is unreachable from the product's own surfaces — every URL `import`
 * is sent comes from `quickDetect` or `decompose.analyze` on the same account —
 * so reaching it means the picture was not one of ours.
 */
export const GARMENT_PICTURE_NOT_YOURS =
  "That picture isn't one of yours. Scan or decompose a photo again, then import from it.";

export class GarmentPictureNotYoursError extends Error {
  constructor() {
    super(GARMENT_PICTURE_NOT_YOURS);
    this.name = "GarmentPictureNotYoursError";
  }
}

/**
 * The sentence for the other refusal on the same road: the garment could not
 * take its pictures over (`GarmentPictureReceiptError` — the manifest naming
 * the copy was no longer there to discharge). That is our failure rather than
 * hers, so it says nothing about her picture, and it is raised before the
 * credit hold, so "nothing was charged" is true wherever it is spoken (#2028).
 */
export const GARMENT_PICTURE_NOT_SAVED =
  "That garment couldn't be saved just now. Nothing was charged. Try importing it again.";

/**
 * Turn the import road's two pre-charge refusals into the sentence written for
 * the customer (#2028); anything else passes through untouched.
 *
 * Both are plain `Error` subclasses, so reaching tRPC raw they answered as a
 * generic 500 and the sentence above was never seen by anyone. A pure function
 * rather than a branch inside the handler, because a decision written inside a
 * tRPC handler is one nothing in `pnpm test` can drive on its own.
 *
 * ⚠ It is applied ONLY around the adoption and the garment insert, which both
 * run before `withAtomicCredits`. A receipt refusal after the charge must not
 * be told "nothing was charged".
 */
export function spokenImportRefusal(error: unknown): unknown {
  if (error instanceof GarmentPictureNotYoursError) {
    return spokenError({ code: "BAD_REQUEST", message: GARMENT_PICTURE_NOT_YOURS, cause: error });
  }
  if (error instanceof GarmentPictureReceiptError) {
    return spokenError({ code: "BAD_REQUEST", message: GARMENT_PICTURE_NOT_SAVED, cause: error });
  }
  return error;
}

/**
 * What `import` may adopt: an object this account itself put under its own
 * wardrobe prefix, at the bucket we are serving from today.
 *
 * ⚠ **The prefix is `-wardrobe/` and not the account id alone**, so a model
 * photo (`<id>-models/upload-…`) cannot be smuggled onto a garment row. The
 * trailing `-wardrobe/` also does the work of separating account 1 from account
 * 12, which a bare `${userId}` prefix would not.
 */
export function wardrobeAdoptableKey(input: {
  userId: number;
  url: string;
  currentPublicUrl: string;
}): string | null {
  const classified = classifyStorageReference({
    url: input.url,
    currentPublicUrl: input.currentPublicUrl,
  });
  if (classified.kind !== "current_origin_url") return null;
  if (!classified.key.startsWith(`${input.userId}-wardrobe/`)) return null;
  return classified.key;
}

/**
 * The garment's own key. The extension is CARRIED from the source rather than
 * spelled `png` here: all four scratch writers put `image/png` today, and a key
 * whose extension states that independently is a key that can come to lie.
 * `storageCopyExact` copies the source's real content type regardless.
 */
export function garmentOwnedKey(input: { userId: number; sourceKey: string }): string {
  const extension = input.sourceKey.match(/\.[a-z0-9]{1,5}$/i)?.[0] ?? "";
  return `${input.userId}-wardrobe/garment/${randomUUID()}${extension}`;
}

export type AdoptedGarmentPicture = {
  /** The garment's own public URL — what goes on the row. */
  url: string;
  /** The garment's own key — what the account-erasure sweep reads. */
  key: string;
  /** The receipt `createGarment` discharges inside the insert's transaction. */
  cleanupBatchId: string;
};

/**
 * Everything this reaches, injectable so the ORDER can be driven without a
 * database or a bucket — the order is the whole contract, exactly as it is for
 * {@link putWardrobeScratchUpload}.
 */
export interface GarmentAdoptionDeps {
  registerManifest: (input: {
    id: string;
    userId: number;
    operationId: string;
    storageKey: string;
  }) => Promise<void>;
  copy: (input: {
    sourceKey: string;
    destinationKey: string;
  }) => Promise<{ key: string; url: string }>;
}

function liveDeps(): GarmentAdoptionDeps {
  return {
    registerManifest: async (input) => {
      /*
        ITS OWN COMMITTED TRANSACTION, not the row's — the refine road's reason,
        verbatim in its own comment: the failure it guards against must not be
        able to roll it back.
      */
      await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
        id: input.id,
        userId: input.userId,
        operationId: input.operationId,
        kind: "wardrobe_scratch_cleanup",
        storageItems: [{ storageKey: input.storageKey, storageBackend: "public_r2" }],
        /* BORN HELD, for the same reason every other register-before-write
           carries a hold: the worker's in-flight fence tests the batch against
           a live operation row, a synthetic id matches none, and without a hold
           this manifest is claimable while the copy is still running. */
        heldUntil: wardrobeScratchHeldUntil(),
      }));
    },
    copy: async (input) => {
      const copied = await storageCopyExact({
        sourceKey: input.sourceKey,
        destinationKey: input.destinationKey,
      });
      return { key: copied.key, url: copied.url };
    },
  };
}

/**
 * Copy one picture a customer chose into an object the garment row owns.
 *
 * ⚠ **A URL THAT IS NOT THIS ACCOUNT'S OWN WARDROBE OBJECT IS REFUSED, NOT
 * PASSED THROUGH.** Falling back to writing the given URL onto the row is the
 * silently-lesser path the fidelity law forbids, and it is the exact state this
 * repair exists to end — a row holding a URL it does not own.
 */
export async function adoptGarmentPicture(
  input: { userId: number; url: string; currentPublicUrl: string },
  deps: GarmentAdoptionDeps = liveDeps(),
): Promise<AdoptedGarmentPicture> {
  const sourceKey = wardrobeAdoptableKey(input);
  if (!sourceKey) throw new GarmentPictureNotYoursError();

  const destinationKey = garmentOwnedKey({ userId: input.userId, sourceKey });
  const cleanupBatchId = randomUUID();
  await deps.registerManifest({
    id: cleanupBatchId,
    userId: input.userId,
    /* A synthetic id, like the scratch upload's and the attach road's: the
       column is unique and NOT NULL, and an import is not a generation
       operation. */
    operationId: cleanupBatchId,
    storageKey: destinationKey,
  });
  const copied = await deps.copy({ sourceKey, destinationKey });
  return { url: copied.url, key: copied.key, cleanupBatchId };
}

/**
 * Which pictures an import is adopting, from what it was sent.
 *
 * Extracted from the route rather than left inline because it is a DECISION —
 * *the crop is the garment and the photograph is its source, unless there is no
 * crop, in which case the photograph is both* — and a decision inside a tRPC
 * handler cannot be driven by anything in `pnpm test`.
 */
export function importPictureChoice(input: {
  sourceImageUrl: string;
  cropUrl?: string | undefined;
}): { imageUrl: string; sourceUrl: string | undefined } {
  return {
    imageUrl: input.cropUrl || input.sourceImageUrl,
    sourceUrl: input.cropUrl ? input.sourceImageUrl : undefined,
  };
}

export type AdoptedGarmentPictures = {
  /** What goes in `originalImageUrl` / `originalImageKey`. */
  image: AdoptedGarmentPicture;
  /** What goes in `sourceImageUrl` / `sourceImageKey`, when there is one. */
  source: AdoptedGarmentPicture | null;
  /** The receipts `createGarment` discharges — one per object actually copied. */
  receipts: readonly string[];
};

/**
 * Adopt the one or two pictures an import is about to persist.
 *
 * ⚠ **THE TWO URLS CAN BE THE SAME ONE, AND THAT IS THE COMMON ROAD RATHER
 * THAN AN EDGE CASE.** The drawer's *import the whole photograph* press sends
 * `cropUrl` equal to `sourceImageUrl` (`DecompositionDrawer.tsx`), so adopting
 * per column would copy the same bytes twice and leave one row holding two keys
 * for one picture — two objects for the account sweep to carry, and two
 * receipts, for no second picture. Copied once, pointed at twice.
 */
export async function adoptGarmentPictures(
  input: {
    userId: number;
    imageUrl: string;
    sourceUrl?: string | undefined;
    currentPublicUrl: string;
  },
  deps: GarmentAdoptionDeps = liveDeps(),
): Promise<AdoptedGarmentPictures> {
  const image = await adoptGarmentPicture({
    userId: input.userId,
    url: input.imageUrl,
    currentPublicUrl: input.currentPublicUrl,
  }, deps);
  if (input.sourceUrl === undefined) {
    return { image, source: null, receipts: [image.cleanupBatchId] };
  }
  if (input.sourceUrl === input.imageUrl) {
    return { image, source: image, receipts: [image.cleanupBatchId] };
  }
  const source = await adoptGarmentPicture({
    userId: input.userId,
    url: input.sourceUrl,
    currentPublicUrl: input.currentPublicUrl,
  }, deps);
  return { image, source, receipts: [image.cleanupBatchId, source.cleanupBatchId] };
}

/**
 * The four picture fields a garment row is written with.
 *
 * ⚠ **IT TAKES THE ADOPTION AND NOTHING ELSE, AND THAT IS THE CONTROL RATHER
 * THAN A TIDINESS.** The defect the relay found was a statement that had both
 * the customer's URL and (after the repair) the garment's own one in scope, and
 * wrote the wrong one. A mapping function with no access to the input cannot
 * write a scratch URL onto a row — there is nothing to reach for. The arms
 * assert the mapping; the SIGNATURE is what makes the mistake unrepresentable.
 */
export function garmentRowPictures(adopted: AdoptedGarmentPictures): {
  originalImageUrl: string;
  originalImageKey: string;
  sourceImageUrl: string | undefined;
  sourceImageKey: string | undefined;
} {
  return {
    originalImageUrl: adopted.image.url,
    originalImageKey: adopted.image.key,
    sourceImageUrl: adopted.source?.url,
    sourceImageKey: adopted.source?.key,
  };
}
