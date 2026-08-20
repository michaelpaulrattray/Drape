/**
 * THE DESIGN SHE POINTED AT, MADE INTO A ROW — the attach-pointed mint, road
 * (D) (ruled fable-1148 §3, doors countersigned fable-1149 §2, resolution order
 * ruled fable-1151 §3).
 *
 * A customer attaches a photograph and writes *"put this tattoo on her right
 * upper arm"*. Before this file there was nowhere for that design to LIVE: the
 * refine road could read her sentence, name the place, and then tell her it
 * could not put it on her. This is the step that files it — once — so the wire
 * downstream reads a row exactly as it reads a row somebody uploaded through
 * the studio door.
 *
 * # WHAT THIS FILE IS RESPONSIBLE FOR: the ORDER
 *
 * The decisions live elsewhere on purpose — which design an ask means is
 * `inkDesignForAsk`, what may be cut out of a picture is `inkReferenceCutter`,
 * what a design row may be is `inkUploadDoor`. What is HERE is the sequence,
 * and the sequence is the part that goes wrong invisibly:
 *
 *   1. her picture's BYTES, fetched by the server from the key it holds
 *   2. THE CUT — `cutInkDesign`, the one owner build 3a.2 minted
 *   3. the BYTE CHECK on what the cut produced (fable-1149 §2a)
 *   4. the MANIFEST, naming the exact key about to be written
 *   5. the BYTES, to that key
 *   6. the ROW, which discharges the manifest in its own transaction
 *
 * Steps 4–6 are `uploadInkDesign`'s own discipline and they are here for the
 * reason it learned them: bytes at a permanently public URL with no row
 * referencing them are litter nobody will ever go looking for. On THIS road
 * that litter would be a cut taken from a photograph of a person, which is the
 * strongest version of the argument there is.
 *
 * # A MINT THAT CANNOT CUT REFUSES FREE AND STORES NOTHING (fable-1148 §3b)
 *
 * Every exit at steps 1–3 leaves NO ROW AND NO OBJECT. Un-cut attachment bytes
 * never become a design row from this road under any failure — which is what
 * makes rows born here **examined at birth** rather than checked afterwards,
 * and it is why fable-1137 §4's containment condition has nothing to catch
 * here. The refusal names her picture's problem in the cutter's own sentence,
 * passed through unchanged: a re-worded refusal is how two surfaces come to say
 * different things about one wall.
 *
 * # THE CUT IS NOT OPTIONAL HERE, AND `CASTING_INK_CUT_SCOPE` IS NOT CONSULTED
 *
 * That flag governs whether the STUDIO UPLOAD door cuts what a customer hands
 * it. On this road there is no not-cutting position to take: the bytes at the
 * other end of the key are a photograph she attached, and a row born from them
 * uncut is precisely the exposure the cutter exists to close. So a mint that
 * cannot cut refuses; it never stores. (Approved fable-1151 §5.)
 *
 * # WHAT IT COSTS, stated rather than discovered later
 *
 * **Two segmenter calls of HOUSE money per mint** — the cutter's own pair, on
 * the shared `FAL_CONCURRENCY` courtesy pool, which is why this road declares
 * no fal allowance of its own and `assertFalBudget`'s ceiling arithmetic is
 * untouched. Never a customer's credits, and **once per (picture, placement,
 * side)** rather than once per render: the second ask about the same picture at
 * the same address finds the row this one wrote and rides it.
 *
 * # THE PHOTOGRAPH DOES NOT REACH AN ENGINE FROM HERE
 *
 * The segmenter READS her attachment, exactly as the upload door's cutter
 * already reads an uploaded picture under fable-1047's own licence — no new
 * class of read exists on this road. What is STORED is the cut, and what any
 * later consumer sees is `storageKey`. The widening tripwire's bound is the raw
 * upload reaching the plate MINT, which this road never touches (fable-1148
 * §3c): it stays armed and this file does not go near it.
 */
import { createHash, randomUUID } from "node:crypto";

import type { InkPlacement } from "../../shared/inkPlacementVocabulary";
import type { InkSide } from "../../shared/inkReleasedPlacements";
import type { ReferenceIntent } from "../../shared/referenceIntents";
import {
  InkDesignCapError,
  InkDesignOwnershipError,
  recordInkDesign,
  type InkDesignToRecord,
  type RecordedInkDesign,
  type StoredInkDesign,
} from "../db/castingV2InkDesigns";
import type { AskReference } from "./askReference";
import { createModuleLogger } from "../logging/logger";
import { storageReadBytes } from "../storage";
import { storagePut } from "../storage";
import { defaultCutDesign, defaultManifest } from "./inkUploadService";
import type { CutInkDesignResult } from "./inkReferenceCutter";
import {
  INK_DESIGN_MAX_BYTES,
  INK_DESIGNS_PER_CANDIDATE,
  inkDesignContentType,
  inkDesignFormatOfContentType,
  inkDesignKey,
  type InkDesignFormat,
} from "./inkUploadDoor";

const log = createModuleLogger("castingV2/inkReferenceMint");

export type InkReferenceMintRefusalCode =
  /** The cutter refused — its code, carried so a caller can tell them apart. */
  | "cut"
  /**
   * THE CUT IS TOO BIG TO KEEP (fable-1149 §2a).
   *
   * Not a corner. A `cut` re-encodes as LOSSLESS PNG, so a large-dimension JPEG
   * that passed the attach door's 8MB cap comfortably can cut to a PNG well
   * over it — the door bounded the bytes she sent, and this bounds the bytes we
   * store, which are a different quantity.
   */
  | "tooLargeAfterCut"
  /** Her picture would not read back from storage at all. Ours, never hers. */
  | "bytesUnavailable"
  /** This Cast is already holding as many pictures as it may. */
  | "cap"
  /** The Cast is not this account's — said the way a missing one is. */
  | "noSuchCast";

export type InkReferenceMintRefusal = {
  readonly code: InkReferenceMintRefusalCode;
  /** Her sentence, not a code the client re-words. */
  readonly message: string;
};

export type InkReferenceMintOutcome =
  | { ok: true; design: StoredInkDesign }
  | { ok: false; refusal: InkReferenceMintRefusal };

export type InkReferenceMintRequest = {
  userId: number;
  candidatePublicId: string;
  /**
   * The picture she pointed at — the attachment's own row, narrowed to what
   * filing a design out of it needs.
   *
   * `digest` becomes the new row's `sourceDigest`, which is the reuse key's
   * first member: byte identity of what she POINTED AT, so the same picture at
   * the same address never becomes a second row (fable-1149 §2b).
   *
   * `provenance` is CARRIED and never invented — it is what she CLAIMED about
   * where the picture came from when she attached it, and a writer that made
   * one up would be filing an answer to a question nobody asked.
   *
   * A `Pick` of the resolver's own type rather than four fields re-listed: a
   * re-listed shape is a copy that drifts by losing a field nothing can see,
   * and the narrowing is the point — this road may not reach for anything else
   * the attachment row happens to carry.
   */
  reference: Pick<AskReference, "storageKey" | "digest" | "provenance" | "mime">;
  /** Where on her, as her own sentence named it and the resolver validated it. */
  placement: InkPlacement;
  /** Which of her. Never invented here — see the caller's own refusal. */
  side: InkSide;
  /**
   * WHAT SHE IS TAKING FROM THIS PICTURE (ruled fable-937; sited on this road
   * fable-1151 §1).
   *
   * Passed in rather than assumed, and the caller derives it from the SAME
   * predicate that decided this is a tattoo ask — so an ask that is not one
   * cannot produce a row claiming it was. The attachment record carries no
   * intents and that is its own door's design: it is reached before she has
   * typed anything, so there is no ask yet for an intent to authorise. Here
   * there is: her sentence, about this picture, naming a design.
   */
  intents: readonly ReferenceIntent[];
};

export type InkReferenceMintDependencies = {
  /** Her picture, read by the server from a key that never leaves it. */
  readBytes: (key: string) => Promise<{ bytes: Buffer }>;
  /** The one cutter, injected so a suite drives the order without a provider. */
  cut: (input: { userId: number; candidatePublicId: string; bytes: Buffer }) => Promise<CutInkDesignResult>;
  manifest: (input: { id: string; userId: number; storageKeys: readonly string[] }) => Promise<void>;
  store: (input: { key: string; bytes: Buffer; contentType: string }) => Promise<{ key: string; url: string }>;
  record: (input: InkDesignToRecord) => Promise<RecordedInkDesign>;
};

/**
 * THE SHIPPED WIRING, exported so a suite can assert THESE — the things the
 * mint actually calls — rather than a double that agrees with them.
 *
 * The two that matter are shared with the studio upload door on purpose: one
 * cutter, so a sabotage of it reddens both roads, and one manifest, so the two
 * decisions inside it (a synthetic operation id, born held) are not re-made by
 * a second hand.
 */
export const MINT_DEPENDENCIES: InkReferenceMintDependencies = {
  readBytes: storageReadBytes,
  /* THE SAME CUTTER THE UPLOAD DOOR CALLS — its exported default, never a
     second construction of a reader. One owner, so a sabotage of it reddens
     both roads' arms. */
  cut: defaultCutDesign,
  /* And the same hold: one synthetic operation id, born held, decided once. */
  manifest: defaultManifest,
  store: (one) => storagePut(one.key, one.bytes, one.contentType),
  record: recordInkDesign,
};

/**
 * Her sentences for the refusals this file owns.
 *
 * The cutter's own are carried through untouched, so they are not restated
 * here — there is exactly one place each wall is worded.
 */
/**
 * WHAT SHE IS TOLD AT THE DESIGN CAP — exported so a suite can hold it to the
 * router (ruled fable-1173 §2).
 *
 * ⚠ **THE NOUN WAS "PICTURES" AND THE THING IS A DESIGN** (found in the running
 * app 2026-08-20). The move this names is real — `castingV2.ink.remove` takes a
 * design — but a customer told she is holding eight PICTURES goes looking at
 * the pictures she attached, where there is nothing to remove. A true sentence
 * about a real move, pointed at the wrong object.
 *
 * Its sibling in `referenceAttachDoor` was the louder half of the same class:
 * that one named a move that does not exist at all. Both were changed with no
 * test going red, which is why this constant is now exported and armed:
 * `inkReferenceMint.test.ts` pins *"remove one"* to a `remove` procedure
 * existing in `routes/castingV2.ts`, rather than to a copy of these words.
 */
export const INK_DESIGN_CAP_REFUSAL =
  `This Cast is holding ${INK_DESIGNS_PER_CANDIDATE} designs already — remove one `
  + "and send this again. Nothing was charged.";

const REFUSALS: Readonly<Record<Exclude<InkReferenceMintRefusalCode, "cut">, string>> = Object.freeze({
  tooLargeAfterCut:
    "I found the design in that picture, but it came out too big to keep. "
    + "A smaller photo of the design works better. Nothing was charged.",
  bytesUnavailable:
    "I couldn't open the picture you attached just now — try attaching it again. "
    + "Nothing was charged.",
  /*
    THE NOUN IS "DESIGNS", AND IT SAID "PICTURES" — swept up beside its sibling
    in `referenceAttachDoor` (found 2026-08-20, ruled fable-1173 §2).

    This cap counts `INK_DESIGNS_PER_CANDIDATE`, and the move it names is real:
    `castingV2.ink.remove` takes a design. But a customer told she is holding
    eight PICTURES goes looking at the pictures she attached, where there is
    nothing to remove — so a true sentence about a real move sent her to the
    wrong object. The attachment door's version of this sentence named a move
    that does not exist at all; this one named the right move and the wrong
    thing, which is the quieter half of the same class.
  */
  cap: INK_DESIGN_CAP_REFUSAL,
  noSuchCast: "I couldn't find that Cast. Nothing was charged.",
});

function refuse(code: Exclude<InkReferenceMintRefusalCode, "cut">): InkReferenceMintOutcome {
  return { ok: false, refusal: { code, message: REFUSALS[code] } };
}

/**
 * FILE THE DESIGN IN HER PICTURE AGAINST HER CAST, or say why not.
 *
 * Returns a refusal rather than throwing: every failure here is a customer's to
 * read and none of them is an exception to swallow. The caller answers with the
 * sentence, before the claim, and charges nothing.
 */
export async function mintInkDesignFromReference(
  request: InkReferenceMintRequest,
  dependencies: InkReferenceMintDependencies = MINT_DEPENDENCIES,
): Promise<InkReferenceMintOutcome> {
  const about = { userId: request.userId, candidatePublicId: request.candidatePublicId };

  /* 1 — HER PICTURE'S BYTES, fetched by the server from the key it holds. The
     key never leaves this process: it is a permanently public address for a
     photograph of a person. */
  let attached: Buffer;
  try {
    attached = (await dependencies.readBytes(request.reference.storageKey)).bytes;
  } catch (error) {
    log.warn({ ...about, err: error }, "[inkReferenceMint] her attached picture could not be read back — refused free");
    return refuse("bytesUnavailable");
  }

  /* 2 — THE CUT, through the one owner. Its refusals are hers and travel
     unchanged, with the code kept so a caller can tell a provider failure from
     a fact about her picture. */
  const taken = await dependencies.cut({
    userId: request.userId,
    candidatePublicId: request.candidatePublicId,
    bytes: attached,
  });
  if (!taken.ok) {
    log.info(
      { ...about, why: taken.refusal.code },
      "[inkReferenceMint] the design could not be taken out of her picture — nothing stored, nothing charged",
    );
    return { ok: false, refusal: { code: "cut", message: taken.refusal.message } };
  }

  /*
    3 — THE BYTE CHECK, ON WHAT THE CUT ACTUALLY PRODUCED (fable-1149 §2a).

    My own first draft of the design paragraph said a cutout is smaller than the
    picture it came from. That is true of PIXELS and false of BYTES: the cut
    re-encodes as lossless PNG, and a large-dimension JPEG comfortably under the
    attach door's cap can cut to a PNG well over it. The `rideWhole` route
    inherits her bytes and that door's cap honestly; the `cut` route was bounded
    by nothing.

    So the quantity checked is the quantity STORED, against the same constant
    the upload door uses rather than a second number — and it is checked HERE,
    before the manifest, so a refusal has still written nothing.
  */
  if (taken.cut.bytes.byteLength > INK_DESIGN_MAX_BYTES) {
    log.info(
      { ...about, bytes: taken.cut.bytes.byteLength, cap: INK_DESIGN_MAX_BYTES, route: taken.cut.route },
      "[inkReferenceMint] the cut came out larger than a design may be — nothing stored, nothing charged",
    );
    return refuse("tooLargeAfterCut");
  }

  /*
    WHAT FORMAT THE STORED OBJECT IS, and the two routes differ.

    `cut` is PNG BY CONSTRUCTION — the cutter encodes it, and the alpha channel
    the whole cut is made of has nowhere to live in a JPEG. `rideWhole` stores
    HER bytes exactly as they arrived, so the format is the one her attachment
    row records, read back through the mapping's own owner.

    A mime the vocabulary cannot name is treated as PNG's opposite: there is no
    key extension to invent for it, so the row is not written at all. It cannot
    happen through the attach door, which validated the format from the decoded
    bytes — which is exactly why it is answered rather than asserted.
  */
  const storedFormat: InkDesignFormat | null = taken.cut.route === "cut"
    ? "png"
    : inkDesignFormatOfContentType(request.reference.mime);
  if (storedFormat === null) {
    log.error(
      { ...about, mime: request.reference.mime },
      "[inkReferenceMint] her attachment's mime is not a design format — refusing rather than inventing a key for it",
    );
    return refuse("bytesUnavailable");
  }

  /* 4 — THE MANIFEST, naming the exact key about to be written. Born held, so
     the worker cannot claim it while the bytes are still going up. */
  const storageKey = inkDesignKey(storedFormat);
  const cleanupBatchId = randomUUID();
  await dependencies.manifest({
    id: cleanupBatchId,
    userId: request.userId,
    storageKeys: [storageKey],
  });

  /* 5 — THE BYTES. */
  const contentType = inkDesignContentType(storedFormat);
  await dependencies.store({ key: storageKey, bytes: taken.cut.bytes, contentType });

  /*
    6 — THE ROW, and every column describes the object that was actually
    written. `digest`, `byteSize`, `width` and `height` are read off the CUT,
    never off her attachment — a row describing the photograph while the object
    is the cutout is the wrong-frame class filed as a measurement.

    `cutRoute` is the cutter's own answer and is therefore never `null` on this
    road: rows born here are examined at birth, which is 1137 §4's containment
    condition satisfied by construction rather than checked afterwards.

    `sourceDigest` is the attachment's, which is what makes the next ask about
    the same picture at the same address a RIDE rather than a second cut.
  */
  const digest = createHash("sha256").update(taken.cut.bytes).digest("hex");
  let design: RecordedInkDesign;
  try {
    design = await dependencies.record({
      userId: request.userId,
      candidatePublicId: request.candidatePublicId,
      placement: request.placement,
      side: request.side,
      provenance: request.reference.provenance,
      intents: request.intents,
      storageKey,
      cutRoute: taken.cut.route,
      sourceDigest: request.reference.digest,
      digest,
      mime: contentType,
      byteSize: taken.cut.bytes.byteLength,
      width: taken.cut.width,
      height: taken.cut.height,
      cleanupBatchId,
    });
  } catch (error) {
    /*
      THE CAP AND THE OWNER ARE THE STORE'S OWN REFUSALS, AND THEY ARRIVE AS
      THROWS BECAUSE THAT IS WHERE THEY ARE DECIDED — under the parent's own
      `FOR UPDATE`, in the transaction that would have written the row.

      Turned into her sentences here rather than escaping as a 500. The bytes
      just written stay under the manifest, which was NOT discharged because the
      transaction did not commit, so the worker collects them — the same
      keeper-receipt property that makes every other failure on this road cost
      nothing.

      Hitting the cap REFUSES and never evicts: making room by deleting would be
      destroying a design a customer owns to serve a render she did not know
      cost her one.
    */
    if (error instanceof InkDesignCapError) {
      log.info({ ...about }, "[inkReferenceMint] this Cast is holding as many pictures as it may — refused, nothing evicted");
      return refuse("cap");
    }
    if (error instanceof InkDesignOwnershipError) {
      log.warn({ ...about }, "[inkReferenceMint] the Cast is not this account's — refused the way a missing one is");
      return refuse("noSuchCast");
    }
    throw error;
  }

  log.info(
    {
      ...about,
      design: design.publicId,
      route: taken.cut.route,
      placement: request.placement,
      side: request.side,
      bytes: taken.cut.bytes.byteLength,
      size: `${taken.cut.width}x${taken.cut.height}`,
    },
    "[inkReferenceMint] the design in her picture is now a row — cut once, kept, and purged with her Cast",
  );

  /* The caller reads this exactly as it reads a design it found: the same
     shape, so the ride path downstream has one road rather than two. */
  return {
    ok: true,
    design: {
      ...design,
      digest,
      mime: contentType,
      byteSize: taken.cut.bytes.byteLength,
      width: taken.cut.width,
      height: taken.cut.height,
    },
  };
}
