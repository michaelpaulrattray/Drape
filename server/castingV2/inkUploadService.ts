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
 * construction rather than by a filter. The fence held on both engines at the
 * founder's own eye (fable-963), and the plate is minted HERE, as step 5.
 *
 * # WHY THE MINT IS INSIDE THE UPLOAD, AND WHY IT WAITS FOR IT
 *
 * fable-936 §2 ruled that a plate is drawn at UPLOAD rather than at the ask, so
 * the customer is not made to wait twice; fable-937 narrowed it to DECLARED
 * INTENT, so no money moves for a feature nobody asked to take. Both are
 * satisfied by minting once, here, after the row exists.
 *
 * It is synchronous, and that is a decision rather than an omission (fable-968
 * §2 as filed in opus-710 §2). A mint is ~37s measured on the ruled engine,
 * against a paid refine that already holds its request for a production median
 * of 173.3s — this is not a new shape for the product. The alternative,
 * fire-and-forget, is the shape with NO OWNER: a mint that dies with the
 * process leaves no plate, no error, and nobody whose job it is to notice.
 *
 * **A refused mint does not fail the upload.** Her design is stored and hers;
 * whether a plate was drawn from it is a second fact, and it travels beside the
 * first. Re-driving is free of a second row: the mint is idempotent per
 * (design, engine) and answers `reused`.
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
import { inkPlateEngine } from "./inkPlateEngine";
import { mintInkPlate, type InkPlateMintOutcome } from "./inkPlateMint";
import {
  MANNEQUIN_DEFERRED_NOTE,
  MANNEQUIN_ROAD_DEFERRED,
} from "../../shared/inkMannequinDeferral";
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

/**
 * WHETHER A PLATE WAS DRAWN, and it is never inferred from the design's row.
 *
 * `reused` distinguishes *drawn now* from *already there*, because the mint is
 * idempotent and a caller that could not tell them apart would report a second
 * upload as a second $0.15.
 */
export type InkUploadPlate =
  | { minted: true; plateId: string; reused: boolean; engine: string; width: number; height: number }
  /** The mint's own sentence, unchanged — a client that re-worded it is how two
   *  surfaces come to say different things about one wall. */
  | { minted: false; note: string };

export type InkUploadOutcome =
  | {
    ok: true;
    design: RecordedInkDesign & { width: number; height: number };
    /** Her design is stored either way; this says what became of the plate. */
    plate: InkUploadPlate;
  }
  | { ok: false; refusal: InkUploadRefusal };

export type InkUploadDependencies = {
  /**
   * Whether the mannequin road is parked — defaults to the ruling's own
   * constant, and is a seam rather than a switch.
   *
   * It exists so the PARKED road keeps its tests. Deleting them would leave the
   * day it resumes with nothing proving how it behaves, and a suite that cannot
   * fail when its subject returns is the shape this program has paid for
   * before. Production never passes it: `REAL` carries no such field, so the
   * constant decides.
   */
  mannequinDeferred?: boolean;
  manifest: (input: { id: string; userId: number; storageKeys: readonly string[] }) => Promise<void>;
  store: (input: { key: string; bytes: Buffer; contentType: string }) => Promise<{ key: string; url: string }>;
  record: (input: InkDesignToRecord) => Promise<RecordedInkDesign>;
  /**
   * DRAWING THE DESIGN ONTO THE BLANK FORM — injected so this file keeps owning
   * the ORDER and nothing else, and so a suite can drive the whole upload
   * without a provider, a key or a network.
   *
   * The real one carries the RULED engine (`inkPlateEngine()`), which is `null`
   * on a deployment with no transport — and the mint turns that absence into a
   * sentence rather than a crash.
   */
  mint: (input: { userId: number; designPublicId: string }) => Promise<InkPlateMintOutcome>;
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

/**
 * The real mint, exported so a suite can assert THIS — the thing the upload
 * actually calls — rather than a double that agrees with it.
 *
 * The engine is read per mint rather than captured at module load, so a
 * deployment that gains its key does not stay stuck with the absence.
 */
export function defaultMintPlate(
  input: { userId: number; designPublicId: string },
): Promise<InkPlateMintOutcome> {
  return mintInkPlate({ ...input, engine: inkPlateEngine() });
}

const REAL: InkUploadDependencies = {
  manifest: defaultManifest,
  store: (one) => storagePut(one.key, one.bytes, one.contentType),
  record: recordInkDesign,
  mint: defaultMintPlate,
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

  /*
    STEP 5 — THE PLATE, and it is the only step here that spends.

    After the row, never before it: the mint reads the design by its public id
    and re-proves ownership in its own statement, so there is nothing to mint
    from until the row is committed. It also means a mint that fails leaves a
    stored design rather than orphaned bytes — the receipt was discharged one
    line above.

    ⚠ AND IT IS PARKED. The founder deferred the mannequin road (fable-1053 §2)
    while this door was already open on his account, so every upload was buying
    a fal call and ~37 seconds to draw a design for a road nobody is building.
    The mint-on-intent ruling predates the deferral and the deferral supersedes
    the spend (gated fable-1060 §1). **Storing is not spending**: the row above
    still lands, the bytes are still hers, still purged with her Cast — the
    deferral parks the drawing, not the keeping. One line, reversible.
  */
  if (dependencies.mannequinDeferred ?? MANNEQUIN_ROAD_DEFERRED) {
    return {
      ok: true,
      design: { ...design, width: decoded.width ?? 0, height: decoded.height ?? 0 },
      plate: { minted: false, note: MANNEQUIN_DEFERRED_NOTE },
    };
  }

  const plate = await dependencies.mint({
    userId: request.userId,
    designPublicId: design.publicId,
  });

  return {
    ok: true,
    design: { ...design, width: decoded.width ?? 0, height: decoded.height ?? 0 },
    plate: plate.ok
      ? {
        minted: true,
        plateId: plate.plate.publicId,
        reused: plate.reused,
        engine: plate.plate.engine,
        width: plate.plate.width,
        height: plate.plate.height,
      }
      : { minted: false, note: plate.refusal.message },
  };
}
