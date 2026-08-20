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
 *   2. THE CUT, when this account is inside `CASTING_INK_CUT_SCOPE`
 *   3. the MANIFEST, naming the exact key about to be written
 *   4. the BYTES, to that key
 *   5. the ROW, which discharges the manifest in its own transaction
 *
 * Steps 3–5 are the library's own discipline and they are here for the reason
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
 * **Step 2 is the one deliberate exception, and it is not a re-encode.** With
 * `CASTING_INK_CUT_SCOPE` on, what is stored is the DESIGN CUT OUT of the
 * picture she gave us — a different object, not a recompression of the same one
 * — and every column describing it is read off the object that was written.
 * When the cutter says the frame rides whole, her bytes and her format go on
 * untouched and this paragraph is true in full.
 *
 * # THE CUT IS WHERE THE FENCE STOPS BEING A PROMISE ABOUT THE RENDER
 *
 * The paragraph below says the photograph never reaches a render, and that has
 * always been scoped to the RENDER: the plate mint is a second engine and it is
 * handed whatever sits at `storageKey`. Cutting at step 2 is what makes the
 * object there the design rather than the photograph — but the widening
 * tripwire retires on an arm asserting that AT THE MINT'S WIRE, and that arm
 * belongs to the build that mints. A flag that can be off is not a structural
 * fact, and rows written before it was flipped still hold photographs.
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
import { captureCastingInkCutEnabled, captureCastingInkRegionCropEnabled } from "./castingV2Scope";
import { upscaleToFloor } from "./inkReferenceUpscale";
import { createFalRegionReader } from "./falRegionReader";
import {
  cutInkDesign,
  type CutInkDesignInput,
  type CutInkDesignResult,
  type InkCutRoute,
} from "./inkReferenceCutter";
import { inkPlateEngine } from "./inkPlateEngine";
import { refusingRegionReader } from "./maskedRefine";
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
  type InkDesignFormat,
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
    /**
     * WHAT WAS STORED — the cut, or her frame whole, or `null` when the cutter
     * did not run at all because this account is outside `CASTING_INK_CUT_SCOPE`.
     *
     * Three values rather than two, and the third is not a tidy-away: `null`
     * means *nobody looked*, `rideWhole` means *somebody looked and there was
     * nobody in the picture*. Collapsing them would let an unflipped flag read
     * as a positive licence, which is the one reading this road cannot afford.
     */
    cut: { route: InkCutRoute } | null;
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
  /**
   * WHETHER THIS ACCOUNT'S DESIGN IS CUT BEFORE IT IS STORED — read per request
   * rather than captured at module load, so a deployment that gains the flag
   * does not stay stuck with the absence.
   */
  cutEnabled: (userId: number) => boolean;
  /**
   * TAKING THE DESIGN OUT OF HER PICTURE — injected so this file keeps owning
   * the ORDER and nothing else, and so a suite can drive the whole upload
   * without a provider, a key or a network.
   */
  cut: (input: { userId: number; candidatePublicId: string; bytes: Buffer }) => Promise<CutInkDesignResult>;
};

/**
 * THE HOLD ON BYTES THAT DO NOT YET HAVE A ROW.
 *
 * Exported since 2026-08-20 because the attach-pointed mint
 * (`inkReferenceMint.ts`) writes into this same store under this same purge
 * path, and the two decisions inside it — a synthetic operation id, and BORN
 * HELD so the worker cannot claim the batch while the bytes are still uploading
 * — are exactly the pair that must not be re-decided by a second hand. A
 * second writer spelling them again is how one of them comes to be spelled
 * differently.
 */
export async function defaultManifest(input: {
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

/**
 * The real cut, exported so a suite can assert THIS — the thing the upload
 * actually calls — rather than a double that agrees with it.
 *
 * The reader is built PER UPLOAD rather than shared: `createFalRegionReader`
 * proves a frame's URL against the bytes in hand once per reader, so one reader
 * per picture is one proof per picture, and a shared one would carry another
 * picture's proof into these calls.
 *
 * `refusingRegionReader` when there is no key, which makes the missing-transport
 * case a REFUSAL rather than a photograph stored as though it had been cut. The
 * boot guard on `CASTING_INK_CUT_SCOPE` is what stops that being reachable in
 * production; this is the second half of the same posture, because a guard and
 * a fallback that disagree are how a fence gets a hole.
 */
export function defaultCutDesign(
  input: {
    userId: number;
    candidatePublicId: string;
    bytes: Buffer;
    /* WHERE IN HER PICTURE TO LOOK — forwarded, never invented here. The studio
       upload door passes none (it has no ask yet, only a picture); the
       attach-pointed mint passes one derived from the address her sentence
       named. A `scope` this function made up would be a narrowing nobody
       asked for. */
    scope?: CutInkDesignInput["scope"];
  },
): Promise<CutInkDesignResult> {
  const apiKey = process.env.FAL_KEY;
  return cutInkDesign({
    bytes: input.bytes,
    reader: apiKey ? createFalRegionReader({ apiKey }) : refusingRegionReader,
    ...(input.scope ? { scope: input.scope } : {}),
    /*
      WHETHER THE CUT MAY BE THE SURFACE — read HERE rather than injected,
      because this is the function that turns a request into the real world and
      the flag is a fact about the world. The unit under test is `cutInkDesign`
      itself, which takes the decision as an argument and is driven both ways.

      It only ever matters when a `scope` arrived: the studio upload door passes
      none (it has no ask yet, only a picture), so the region road belongs to the
      attach-pointed mint, which derives its region word from the placement her
      sentence named.
    */
    regionCrop: captureCastingInkRegionCropEnabled(input.userId),
    /*
      AND A CUT UNDER THE FLOOR IS ENLARGED RATHER THAN REFUSED — the floor
      court's verdict (opus-903, ruled fable-1210 §1), read here for the same
      reason the line above is: this is where a request meets the world.

      ⚠ **BEHIND THE REGION ROAD'S OWN FLAG, and it rescues BOTH roads' small
      cuts for a user inside it.** The floor is that flag's first flip
      precondition and the court that answered it was that road's, so this is
      where the answer belongs — but the rescue is not narrowed to a surface
      cut, because a road that enlarged the SURFACE and still refused the
      smaller ink patch inside it would admit the bigger picture and refuse the
      smaller one, which is the wrong way round.

      Absent when the flag is off or there is no transport, and absent means the
      cutter refuses `cutTooSmall` exactly as it does today — the enlarging is
      unreachable rather than merely unused.
    */
    /* The parameter's type comes FROM the contract rather than being re-listed
       beside it (law 4, and the Atlas says so mechanically): a second copy of
       `{ bytes, width, height }` here would drift by losing a field nothing can
       see. */
    ...(apiKey && captureCastingInkRegionCropEnabled(input.userId)
      ? {
        upscale: ((cut) => upscaleToFloor({
          ...cut,
          apiKey,
          about: { userId: input.userId, candidatePublicId: input.candidatePublicId },
        })) satisfies NonNullable<CutInkDesignInput["upscale"]>,
      }
      : {}),
    about: { userId: input.userId, candidatePublicId: input.candidatePublicId },
  });
}

const REAL: InkUploadDependencies = {
  manifest: defaultManifest,
  store: (one) => storagePut(one.key, one.bytes, one.contentType),
  record: recordInkDesign,
  mint: defaultMintPlate,
  cutEnabled: captureCastingInkCutEnabled,
  cut: defaultCutDesign,
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

  /*
    THE CUT — build 3a.2's upload wire, and it sits HERE for two reasons.

    AFTER every free door, because it is the first step that spends anything:
    two segmenter questions of house money, and a customer whose intent this
    product cannot serve should hear that rather than have her picture read.

    BEFORE the manifest, because what the manifest names is what the store is
    about to write, and after this line that is the CUT. Cutting after the
    write would leave the photograph at a permanently public address with a row
    pointing at it — the exact object the fence exists to prevent, created by
    the step that was supposed to prevent it.

    Every refusal here is free: nothing has been written and nothing charged.
  */
  let stored = request.bytes;
  let storedFormat: InkDesignFormat = decoded.format;
  let storedWidth = decoded.width ?? 0;
  let storedHeight = decoded.height ?? 0;
  let cut: { route: InkCutRoute } | null = null;

  if (dependencies.cutEnabled(request.userId)) {
    const taken = await dependencies.cut({
      userId: request.userId,
      candidatePublicId: request.candidatePublicId,
      bytes: request.bytes,
    });
    /* The cutter's own sentence, passed through unchanged. A re-worded refusal
       is how two surfaces come to say different things about one wall. */
    if (!taken.ok) return { ok: false, refusal: taken.refusal };
    cut = { route: taken.cut.route };
    if (taken.cut.route === "cut") {
      /*
        PNG, ALWAYS, and never `decoded.format` — the cut carries an alpha
        channel and a JPEG has none, so recording her original format here would
        write a mime that flattens the transparency the whole cut is made of.
        `rideWhole` deliberately touches none of these: her bytes and her format
        go on exactly as they arrived, which is what keeps the digest meaning
        byte identity.
      */
      stored = taken.cut.bytes;
      storedFormat = "png";
      storedWidth = taken.cut.width;
      storedHeight = taken.cut.height;
    }
  }

  const storageKey = inkDesignKey(storedFormat);
  const cleanupBatchId = randomUUID();
  await dependencies.manifest({
    id: cleanupBatchId,
    userId: request.userId,
    storageKeys: [storageKey],
  });

  const contentType = inkDesignContentType(storedFormat);
  await dependencies.store({ key: storageKey, bytes: stored, contentType });

  /*
    EVERY COLUMN DESCRIBES THE OBJECT THAT WAS ACTUALLY WRITTEN.

    `digest`, `byteSize`, `width` and `height` are read off `stored`, not off
    `request.bytes` — the two are the same buffer on the off and `rideWhole`
    roads and a different one on the cut road, and a row describing the
    photograph while the object is the cut is the wrong-frame class filed as a
    measurement. The mint compares `digest` against the bytes it fetches and
    would refuse on the mismatch, so this is also what keeps the plate road
    working rather than merely honest.
  */
  const design = await dependencies.record({
    userId: request.userId,
    candidatePublicId: request.candidatePublicId,
    placement: request.placement,
    side: request.side,
    provenance: request.provenance,
    intents: request.intents,
    storageKey,
    /*
      THE DISPOSITION, RECORDED RATHER THAN RETURNED AND DROPPED (0047).

      It used to be a local handed to the caller in the upload's projection and
      then forgotten — so at read time a cutout, a frame that rode whole and a
      photograph nobody looked at were indistinguishable, and fable-1137 §4's
      containment condition had no fact to read. `null` here is the honest
      answer for an account outside `CASTING_INK_CUT_SCOPE`: nobody looked, and
      the design may not ride to a render until somebody has.
    */
    cutRoute: cut?.route ?? null,
    /*
      SHE DID NOT TAKE THIS ONE OUT OF ANYTHING (migration 0048).

      `sourceDigest` names the PICTURE a design was cut from, and on this road
      the bytes she handed over ARE the design — there is no attachment behind
      them. Stated rather than omitted, for `cutRoute`'s reason one line above:
      the reuse key reads this column and cannot tell a deliberate null from a
      forgotten one.
    */
    sourceDigest: null,
    digest: createHash("sha256").update(stored).digest("hex"),
    mime: contentType,
    byteSize: stored.byteLength,
    width: storedWidth,
    height: storedHeight,
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
      design: { ...design, width: storedWidth, height: storedHeight },
      plate: { minted: false, note: MANNEQUIN_DEFERRED_NOTE },
      cut,
    };
  }

  const plate = await dependencies.mint({
    userId: request.userId,
    designPublicId: design.publicId,
  });

  return {
    ok: true,
    cut,
    design: { ...design, width: storedWidth, height: storedHeight },
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
