/**
 * MINTING THE LIBRARY — cut, guard at the door, write (§2.3/§2.4, migration 0028).
 *
 * This is the step that turns a delivered render into what the next render
 * KNOWS about a face. It runs after the picture has landed and been paid for,
 * and it is deliberately the least important thing in the request: nothing here
 * may take that picture back.
 *
 * # References are minted FRESH — the old store seeds nothing
 *
 * Three sources, and no fourth (fable-173 on D-243's audit, plus fable-424 §4):
 *
 *   born anatomy    a fresh full region read on the MASTER
 *   edit-carried    the delivered-anchored cut on the DELIVERED frame,
 *                   `applied ∩ (region(delivered) ∪ region(master))`
 *   composed        a region no segmenter can be asked for, DERIVED from two it
 *                   can, on the frame in hand and bounded by nothing else. One
 *                   member: `build` is her silhouette below the bottom of her
 *                   head, and it is re-cut on EVERY delivered render because a
 *                   below-head crop is also a photograph of her clothes
 *
 * `casting_segments` is not consulted, re-cut or superseded. Its rows are the
 * undo store and they are correct there.
 *
 * # THE FOURTH SOURCE EXISTS NOW, AND IT IS NOT THIS MODULE'S
 *
 * "Three, and no fourth" is still true of the MINT — those are the three things
 * a RENDER can produce, and nothing here has grown a fourth. But a reference no
 * longer has to come from a render at all: migration 0040
 * (`casting_reference_crops`, ruled fable-1015 §3) holds a cut taken from a
 * picture the CUSTOMER supplied, for the crop-form features of the ingestion
 * map — hair today, eye colour behind it.
 *
 * It is a different table on purpose. The library's two image-bearing roles
 * assume a cut comes from her own delivered frame (`carry`) or that an upload
 * is never a cut at all (`anchor`, which refuses a mask outright); a hair
 * reference is an upload THAT IS A CUT, and neither role can hold it without
 * costing the distinction they exist to hold (opus-751 §2).
 *
 * Written here rather than only there because this header is the sentence the
 * next reader will consult when they ask *"where can a reference come from"*,
 * and a header that answers "three" to a question whose answer is now four is
 * how a true sentence becomes a false premise.
 *
 * # The guard is the door, and there are TWO of them
 *
 * A crop does not enter the library because it was produced; it enters because
 * something independent of the cut confirms it contains its subject.
 *
 *   measured     an independent second read of the crop's own region on its own
 *                frame, scored against a specimen family. The reader is injected
 *                into `mintGuardedReference`, so this module cannot hand the
 *                guard the same mask that cut the crop — the checker that cannot
 *                fail is unreachable rather than merely avoided. It costs one
 *                vision call per reference, and that is the declared price of the
 *                founder's fringe never entering the library again.
 *   geometric    for a COMPOSED region, where there is no second read to buy:
 *                the crop is complete iff its box holds every pixel the
 *                derivation kept, counted, never sampled. Stricter than a
 *                specimen and free. Borrowing another family's number instead
 *                would be a guard whose verdicts nobody calibrated (law 2).
 *
 * The two share their duplicate rule (`duplicateSlotFor`) and their precedence
 * on a disputed delivery, and nothing else.
 *
 * # What a REFUSED crop does, and why it is not "nothing"
 *
 * The slot still gets its words, as a words-only row.
 *
 * That is not a consolation prize, it is D-244's carrier hierarchy: for anatomy
 * the words are the carrier of record and the crop is an assist worth about a
 * third of its own value. The alternative was writing no row at all, which
 * looks tidier and is worse — the slot's previous crop would keep riding while
 * the words that describe it moved on, so the next prompt would carry a picture
 * of the old lips and a sentence about the new ones. A silently stale crop
 * beside a current sentence is two instructions about one feature, which is the
 * exact thing the assembler refuses one layer up.
 *
 * The refusal is loud either way, and it is in the result the caller records.
 *
 * # A DISPUTED slot is the one exception to all of that (fable-220 §3)
 *
 * The ask wrote the facet; the render's own reader then said the change is not
 * in the delivered picture. Under D-187/D-246 that is advisory — the render was
 * delivered and charged, and nothing here revisits either. But the library's
 * `earned` gate meant such a slot was never cut at all, so a kind whose asks
 * keep failing the `verified` gate could never acquire the completeness
 * specimen that would let it in. A subtle-quality detector, gating PIXELS one
 * layer below where D-246 disarmed it.
 *
 * So a disputed slot IS cut and IS guarded, and then:
 *
 *   it is never stored          an unverified delivery does not become what the
 *                               next render knows this feature is; the previous
 *                               version stays newest and stays good
 *   it files no words           a words-only row would be a version bump for a
 *                               delivery its own reader disputed
 *   it keeps its pixels         `disputedDelivery` on the row, crop and mask and
 *                               box, for the one instrument that can settle
 *                               whether the reader or the painter was wrong
 *
 * A disputed slot with no crop to keep therefore writes nothing at all, which is
 * exactly what it did before this existed.
 *
 * # AND ONE DISPUTE A RULER SETTLES INSTEAD (fable-429 §3)
 *
 * A body edit produces no caption, so the reader that decides whether an ask
 * landed answers a question about her build off a frame it cannot read — and
 * answers it wrongly in one direction only, which is why a paid build kept
 * vanishing. `buildSpan` has a court (`deliveryCourt.ts`): three faces, a floor
 * arm and a signal arm, a 0.00% negative control, and a live reading an eye
 * confirmed at full size. Where such a ruler can see the change, it settles the
 * dispute and the crop is judged on its own merits.
 *
 * Four things bound it, and each is checked rather than remembered: the ruler
 * speaks only for the facets it MEASURES; only where the anchor is the pair its
 * court was measured on; only toward delivery, never against it; and never near
 * money — the render was delivered and charged before any of this runs. The
 * reader's verdict rides on the record beside the ruler's, settled or declined.
 *
 * # Failure is silent to the user and loud in the log
 *
 * If any of this fails the delivered picture stands, the face simply keeps no
 * new reference this render, and the next render treats those slots exactly as
 * it does today — with words. Charging a person twice, or refusing a render
 * they can already see, because a crop did not upload is not a trade this
 * product makes.
 */
import { createHash, randomUUID } from "node:crypto";

import { withTransaction } from "../db/connection";
import {
  createStorageCleanupManifestIn,
  storageCleanupManifestHeldUntil,
} from "../db/storageCleanup";
import {
  recordReferenceRows,
  type ReferenceRowToRecord,
} from "../db/castingV2ReferenceLibrary";
import { storagePut } from "../storage";
import { createModuleLogger } from "../logging/logger";
import { captureCastingReferenceLibraryEnabled } from "./castingV2Scope";
import {
  boundsOf, cropMask, cropRaster, cutSegments, encodeCut,
  type SegmentBox, type SegmentCut,
} from "./segmentCuts";
import { readRaster, type Mask, type Raster } from "./maskedComposite";
import {
  belowHeadMask, belowHeadCropIsComplete, buildSpan, MaskError, type BuildSpan,
} from "./maskGeometry";
import {
  adjudicateDelivery, courtCovers, deliveryCourtFor,
  type DeliveryAdjudication,
} from "./deliveryCourt";
import type { SideRegions } from "./maskedRefine";
import {
  duplicateSlotFor,
  mintGuardedReference,
  refusalKeepsItsCrop,
  type GuardRefusal,
  type GuardRefusalReason,
  type GuardVerdict,
  type RegionReader,
} from "./referenceCompleteness";
import { DERIVED_REGION_ASKS, DERIVED_REGION_KEY, isDerivedRegion } from "./referenceSlotCatalogue";
import { INSTANCES, parseSlot, type Instance, type SlotFrame } from "./referenceSlots";
import { accessoryKindOfSlot, tidyStackWord } from "./slotWordShape";
import type { FeatureSlot, FeatureTier } from "./recipeAssembler";

const log = createModuleLogger("castingV2/referenceMint");

/** One prefix, so an operator can see every library object in one place. */
export const LIBRARY_KEY_PREFIX = "casting-v2/library";

/**
 * What this render has to say about one slot.
 *
 * The caller supplies the slot's identity because the caller is the assembler's
 * own ask list, where slots are the key by construction. Deriving them here
 * from `facet@region` would rebuild the ledger's key space inside the library's
 * front door — the one thing fable-173 ruled out.
 */
export type SlotSpec = {
  slot: FeatureSlot;
  tier: FeatureTier;
  /** Bare and plain, the stylist's word: `lips`, `left earring`. */
  noun: string;
  /** The full declarative stack for the slot as of this render. */
  words: readonly string[];
  /**
   * The segmentation question that names this slot's region on a frame.
   *
   * **NULL is a real answer** and it is the catalogue's, not a missing value:
   * the region vocabulary has no question that names a jawline, and the nearest
   * one (`face skin`) would file a crop of her whole face under the name "her
   * jaw" — complete against the wrong boundary. Such a slot is carried by words
   * by construction, and it still gets its row.
   */
  question: string | null;
  /** The completeness specimen family whose threshold applies (`hair`, `lips`).
   *  Null exactly when {@link SlotSpec.question} is — for every slot the
   *  CATALOGUE owns. See {@link SlotSpec.noSpecimen} for the one branch where
   *  that biconditional cannot hold. */
  guardKind: string | null;
  /**
   * WHY THIS SLOT HAS A QUESTION AND NO SPECIMEN FAMILY — the open lane's one
   * field, and the reason it is a sentence rather than a flag.
   *
   * An open kind (`open:fangs`) has a question — its own noun — and no
   * completeness family, because a family is a MEASUREMENT and nobody has
   * measured a kind nobody has catalogued. That breaks the catalogue's
   * biconditional, and fable-766 §2 ratified the honest way out: state the
   * invariant as closed-catalogue-only and have the open branch carry an
   * explicit reason.
   *
   * **Its presence is what routes this slot to the absence-control door**, so
   * the recorded fact is READ rather than merely written — the bound that came
   * with that ratification, and the gate-not-reader class it exists to avoid.
   * Absent, a slot with no `guardKind` is exactly what it has always been: a
   * feature the region vocabulary cannot name, carried by words.
   */
  noSpecimen?: string;
  /**
   * The frame this slot's question may be asked of.
   *
   * `ownSide` says this slot is one instance of a pair, so it may only be cut
   * from a region that is one side. Handed a whole-frame read — which is what a
   * bilateral question returns, both sides unioned into one mask — cutting
   * `earring@left` from it would produce a crop of BOTH her earrings, score it
   * against the same union, and read it as complete. That is the wrong-boundary
   * class, and this door is where it would enter the library wearing a number.
   *
   * So the slot is cut ONLY when {@link MintInput.masterSideRegions} answers for
   * its question, and otherwise carries WORDS with no coverage measured at all
   * — deliberately, because "the refusal is also the thing that produces the
   * specimen" and a specimen measured against both ears would then be adopted
   * for one.
   */
  frame: SlotFrame;
  /**
   * THE ASK WROTE THIS SLOT AND THE RENDER'S OWN READER DISPUTED THE DELIVERY
   * (fable-220 §3).
   *
   * A disputed slot is here for its PIXELS and nothing else. It is cut and
   * guarded like any other, it can never be stored, and — unlike every other
   * slot in this list — **it files no words-only row.** That asymmetry is the
   * approved scope exactly: a disputed row exists to be looked at, so a disputed
   * slot with no crop to look at writes nothing and leaves the library precisely
   * as this render found it.
   *
   * It is a property of the SLOT rather than of the render because two facets
   * can land in one slot with different verdicts — `hair.cut` verified,
   * `hair.colour` disputed — and the verified one wins. `mintedSlots` settles
   * that before the list arrives here.
   */
  disputed?: boolean;
  /**
   * WHICH FACETS THE READER DISPUTED — the names, not just the mark.
   *
   * Only a court reads them, and only to refuse: a calibrated instrument may
   * adjudicate the facets it MEASURES and no others (fable-429 §3 condition 3).
   * `build` holds five facets and `buildSpan` measures three of them, so a
   * dispute about her waist can never be settled by the width of her shoulders.
   *
   * Absent, no court applies and the dispute stands — which is every caller
   * that has not been taught to carry them, and is today's behaviour exactly.
   */
  disputedFacets?: readonly string[];
};

/**
 * The library's own read: what is at this site, in one sentence.
 *
 * `view` says what the bytes ARE, because the two are read differently and only
 * one of them is safe for an accessory: a `cut` is the slot's own pixels and
 * cannot contain a neighbouring kind, where a `frame` is the whole picture and
 * the reader has to be trusted to stay inside a name.
 */
export type SlotWordsReader = (input: {
  bytes: Buffer;
  contentType: string;
  /** The stylist's word for the thing: `left earring`, `hair`, `jaw`. */
  noun: string;
  view: "cut" | "frame";
}) => Promise<string | null>;

/** Why a disputed slot kept no pixels: the guard's own refusal, or the reason
 *  no crop was ever cut for it. */
export type DisputedNothingKept =
  | GuardRefusalReason
  | "surface" | "noQuestion" | "noSide" | "noRegion" | "notAPair";

export type MintedSlot =
  | {
    slot: FeatureSlot;
    outcome: "stored";
    coverage: number;
    /** The render's reader disputed this delivery and a calibrated instrument
     *  settled it (fable-429 §3). Absent on an undisputed pass, which is every
     *  other stored crop in the product. */
    adjudicated?: true;
    /**
     * NO BAR DIVIDED THIS CROP — it read the ceiling exactly and was accepted on
     * that ground (`ceilingAccepted`, referenceCompleteness §2.4b).
     *
     * Carried out of the guard rather than left on the verdict, because the ROW
     * cannot say it: the library persists `guardKind/Coverage/Spill/Threshold`
     * and not the INSTRUMENT, so a ceiling acceptance and a derived-geometry
     * pass both land as coverage 10000 / threshold 10000 and are
     * indistinguishable afterwards. This is the flag's only durable reader, and
     * it is the render's own log line.
     */
    ceilingAccepted?: true;
  }
  | {
    slot: FeatureSlot;
    outcome: "words-only";
    /** `surface` — the tier never mints a crop. `noQuestion` — no segmentation
     *  question names this slot, so there is nothing honest to cut. `noSide` —
     *  the slot is one of a pair and this render has no read of its side alone.
     *  `notAPair` — a DISTRIBUTED open kind whose two sides did not both answer
     *  on this frame; the count is in the detail, because one wing filed under a
     *  name that means two is the failure this gate exists to prevent (D1 wire,
     *  fable-1001 §4). `noRegion` — this render has no evidence about the slot.
     *  `guardRefused` — a crop was cut and turned away. */
    reason: "surface" | "noQuestion" | "noSide" | "noRegion" | "notAPair" | "guardRefused";
    detail?: string;
    /** The refused crop's pixels were kept for a human to look at — true for the
     *  refusals in `REFUSALS_THAT_KEEP_THEIR_CROP`, which a human settles rather
     *  than an instrument. That list is the membership; this line does not
     *  count it. */
    keptForAdoption?: true;
  }
  /**
   * A slot whose delivery this render's reader disputed. Never `stored`, never
   * `words-only`: it either left a crop for a human or it left nothing.
   */
  | {
    slot: FeatureSlot;
    outcome: "disputed";
    /** A row was written carrying the refused pixels. */
    kept: true;
    coverage: number;
  }
  | {
    slot: FeatureSlot;
    outcome: "disputed";
    kept: false;
    reason: DisputedNothingKept;
    detail?: string;
  }
  /**
   * NOTHING COULD BE SAID ABOUT THIS SLOT, so nothing was filed.
   *
   * The library's words come from a read of the slot's own cut, and this is
   * what happens when there is no view to read: an accessory slot with no cut
   * (`noCut`), or a read that failed soft (`readFailedSoft`).
   *
   * **No row is written, and that is the point.** The slot's newest existing
   * row keeps carrying, which is what a version history is for. A row with an
   * empty stack and no crop would supersede a true sentence with silence — the
   * mint would be forgetting what it knows because one call did not come back.
   *
   * An accessory slot is never read against the frame, however cheap that would
   * be: "her left earring" asked of a whole picture is exactly the read that
   * wrote her glasses into an earring row eight times.
   */
  | { slot: FeatureSlot; outcome: "unread"; reason: "noCut" | "readFailedSoft" };

export type MintResult = {
  outcome: "stored" | "off" | "nothing-to-keep" | "failed";
  slots: MintedSlot[];
  /**
   * THE RATCHET'S READING, when a build was composed on this render.
   *
   * It decides nothing here. It is returned as well as logged so the instrument
   * can be driven by a caller and asserted by a test — a number that only ever
   * exists inside a log line is a number nobody can prove was taken.
   */
  build?: BuildSpan;
  /**
   * EVERY DISPUTE A COURT WAS ASKED ABOUT, settled or declined, carrying BOTH
   * verdicts (fable-429 §3 condition 2).
   *
   * Returned rather than only logged, and the DECLINES are here too: the
   * distribution worth having is *how often a reader and a ruler disagree*, and
   * a record of the wins alone answers a different question. The caller writes
   * these onto the render's own row, which is where a disagreement outlives a
   * log-retention window.
   */
  adjudications?: DeliveryAdjudication[];
};

export type MintDependencies = {
  /** The guard's independent read. Required in production; injected in tests. */
  read?: RegionReader;
  /**
   * THE GROUND READ, for a render that supplied no region map of its own.
   *
   * The old compositor hands this mint the masks its harvest already cut a
   * paste with, so the ground costs nothing. **A repaint has no harvest**: it
   * paints the whole frame from the master plus references and pastes nothing,
   * so `masterRegions` arrives empty and every cuttable slot would fall to
   * `noRegion` and file words — the library quietly ceasing to acquire crops on
   * the road built to make crops the carrier.
   *
   * So a render with no ground of its own may hand over a READER instead, and
   * the mint asks the delivered frame where each slot it is about to cut
   * actually is. That is §2.3's own definition of an edit-carried reference —
   * cut from a delivered frame that wears the thing — and with no `applied` to
   * intersect, the ground IS `region(delivered)`: the feature's whole extent on
   * the frame that delivered it.
   *
   * **It is a SECOND reader field rather than a second use of `read`**, and the
   * separation is the completeness guard's own law (§2.4): the guard's read must
   * not be the read that cut the crop, or it is scoring a crop against the very
   * mask that produced it — the checker that cannot fail. Two fields make that
   * structural instead of remembered.
   *
   * **Absent, nothing changes at all.** A render that supplies its own maps
   * never reaches this, so the old road is byte-identical with or without it.
   *
   * Costed honestly: one vision call per cuttable slot, on top of the guard's
   * existing one, and the log line says how many were spent.
   */
  readGround?: RegionReader;
  /**
   * WHAT THIS SLOT NOW IS, IN WORDS — read from the slot's own cut.
   *
   * Until this existed, a slot's words were its FACETS' captions, each read
   * against the whole frame and each carried forward from earlier renders. Two
   * defects fell out of that and both were live in production:
   *
   *   an earring slot's words named her GLASSES — `statedAccessories` is one
   *   facet over every object a face can wear, so its caption is a sentence
   *   about everything she has on, and D-244 re-says the stack every edit
   *
   *   one hair row held "warm reddish-copper" and "auburn-brown" at once — the
   *   colour caption carried from an earlier render, the cut caption fresh from
   *   this one, contradicting each other in a single prompt
   *
   * So the words are ONE read of ONE view, and the newest read REPLACES rather
   * than joining a pile (fable-286 ruling 2). A slot's words are the current
   * state of the object at that site; its history is the versioned rows, and a
   * pile inside one row is a second history that argues with itself.
   *
   * **Absent, nothing changes**: the slot files the words it arrived with,
   * which is exactly today's behaviour. Wired in `refineService`, and asserted
   * there rather than only here — a control nothing invokes is not a control.
   *
   * Costed honestly: one call per filed slot, counted as `wordReads` in the log
   * line beside `groundReads` and `disputedReads`.
   */
  readWords?: SlotWordsReader;
  /**
   * THE COMPOSER'S OWN TWO READS — both, or the composer is off.
   *
   * A DERIVED region is not asked for; it is composed from regions that ARE
   * answered (`referenceSlotCatalogue`'s `DERIVED_REGION_KEY`). `belowHead` — her
   * build — is the whole-subject matte below the bottom of the `face` box, so
   * composing it needs a matte and a head, and they must both be read on **the
   * frame the crop is cut from**. Nothing else will do:
   *
   *   `masterRegions`      the MASTER's face. Right question, wrong frame — a
   *                        chin taken from before the edit cutting a crop from
   *                        after it is the wrong-frame class with her body in it
   *   `deliveredRegions`   the PAINTED frame's face, which on the composited road
   *                        is not the frame the user is looking at either
   *
   * So the composer pays for its own two reads on `frame.bytes` and takes no
   * shortcut, and the log line says how many it spent (`derivedReads`). They are
   * one field rather than two so the composer cannot land half-wired: a matte
   * with no head, or a head with no matte, composes nothing and would file words
   * while looking configured.
   *
   * **Absent, nothing changes at all**: a derived slot falls straight to the
   * words-only row it filed before it had a region, which is exactly what the
   * mint did the day the geometry landed inert.
   */
  derivedGround?: {
    /** The named regions the composition stands on — `face`, and no key that
     *  `isDerivedRegion` would recognise. */
    region: RegionReader;
    /** Her silhouette, edge ramp and all. Not a question: the matting model has
     *  one job and no name to get wrong. */
    subject: (input: { frame: Buffer }) => Promise<Mask | null>;
  };
  store?: (input: { key: string; bytes: Buffer; contentType: string }) => Promise<{ key: string }>;
  record?: typeof recordReferenceRows;
  manifest?: (input: {
    id: string;
    userId: number;
    storageKeys: readonly string[];
  }) => Promise<void>;
  enabledFor?: (userId: number) => boolean;
};

export type MintInput = {
  userId: number;
  /** The render that minted these rows; NULL for a fresh read of the master. */
  variantId: number | null;
  /** Required when `variantId` is null — the parent the write proves instead. */
  candidateId?: number;
  /** The frame the crops are cut from, and the frame the guard re-reads. */
  frame: { bytes: Buffer };
  /**
   * Where the paint was allowed to go.
   *
   * NULL is the BORN read: no edit governed this frame, so a slot owns its
   * whole region. That is a different claim from "the edit touched nothing",
   * and passing an empty mask instead would file every slot as owning nothing
   * while every count read zero.
   */
  applied: Mask | null;
  /** The regions the harvest already read on the master, by question. */
  masterRegions: ReadonlyMap<string, Mask>;
  /** The same questions on the DELIVERED frame — the 88.7% union (§2.3). */
  deliveredRegions?: ReadonlyMap<string, Mask> | null;
  /**
   * THE BILATERAL ONES WITH THEIR SIDES APART — what makes a per-side slot
   * cuttable at all.
   *
   * A name present here is the capability, proven by data rather than claimed:
   * the reader answered this question two-sidedly on this frame. A name absent
   * is `noSide`, and the slot files words. There is no third state where the
   * mint splits something itself — a midline invented here would be a second
   * midline, disagreeing with the reader's on the frames that matter most.
   */
  masterSideRegions?: ReadonlyMap<string, SideRegions> | null;
  deliveredSideRegions?: ReadonlyMap<string, SideRegions> | null;
  slots: readonly SlotSpec[];
  /**
   * Digests the library already holds, by slot.
   *
   * Two slots holding one fact is D-242 one layer up, and it does not respect
   * render boundaries: `marks` and `makeup` at `face skin` produced byte-
   * identical crops on three separate production renders. Absent, the check
   * still catches collisions inside this render.
   */
  knownDigests?: ReadonlyMap<string, string>;
  /**
   * THE FRAME THIS RENDER WAS PAINTED FROM — the ruler's other end.
   *
   * Present only so a calibrated instrument can settle a delivery its reader
   * disputed (fable-429 §3). A change is a comparison and the mint holds one
   * frame; without this there is nothing to compare the delivered reading to,
   * so the dispute stands exactly as it does today.
   *
   * It is the frame the render was ANCHORED on, never the previous delivered
   * one where those differ — the court's specimens are `master → first body
   * edit` and a ruler quoted against a different pair is a ruler with no court.
   *
   * **Absent, nothing changes at all**: no adjudication is attempted, no read is
   * bought, and every disputed slot behaves as it did before this existed.
   */
  anchorFrame?: { bytes: Buffer };
  /** For the log line, so a reference can be traced to its operation. */
  operationId?: string;
  dependencies?: MintDependencies;
};

/**
 * IS SHE SMILING WITH HER TEETH SHOWING — the lips crop's own discriminator
 * (fable-493).
 *
 * The teeth region answers the teeth when they are in the picture and nothing
 * when they are not (measured on the founder's own two frames: 1,345px on the
 * smile, 0 on the closed mouth), so no reading of the LIPS is needed to know
 * whether a lips crop would carry them.
 *
 * A read that fails answers FALSE — the mint's own rule for a courtesy read:
 * an instrument that cannot answer must not be able to refuse a crop either.
 * The worst case is exactly the behaviour that shipped before this existed.
 */
async function teethAreShowing(read: RegionReader, frame: Buffer): Promise<boolean> {
  try {
    const mask = await read({ frame, question: "teeth" });
    if (!mask) return false;
    let set = 0;
    for (let at = 0; at < mask.data.length; at += 1) if (mask.data[at]! > 127) set += 1;
    return set / (mask.width * mask.height) > 0;
  } catch {
    return false;
  }
}

async function defaultStore(input: { key: string; bytes: Buffer; contentType: string }) {
  return storagePut(input.key, input.bytes, input.contentType);
}

async function defaultManifest(input: {
  id: string;
  userId: number;
  storageKeys: readonly string[];
}): Promise<void> {
  await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
    id: input.id,
    userId: input.userId,
    /* A synthetic operation id, like the segment store's and the retention
       sweep's: the column is unique and NOT NULL, and the real operation's own
       batch already exists. This work is not a user operation. */
    operationId: randomUUID(),
    /* BORN HELD, and the synthetic id above is exactly why: the worker's
       in-flight fence tests this batch against a live operation row, and a
       synthetic id matches none — so without a hold this manifest is claimable
       while the mint is still storing the crops it names. It was: a sweep took
       step 4's hair mid-mint, and the render carried a superseded version. */
    heldUntil: storageCleanupManifestHeldUntil(),
    kind: "casting_candidate_cleanup",
    storageItems: input.storageKeys.map((storageKey) => ({
      storageKey,
      storageBackend: "public_r2" as const,
    })),
  }));
}

/**
 * A SLOT THAT WILL FILE WORDS, WITH THE SENTENCE SAYING WHY — one shape for the
 * two lists that carry them.
 *
 * Written once rather than at each list, for the reason the Atlas states about
 * every re-listed shape: a copy drifts by losing a field nothing can see. The
 * lists stay SEPARATE because they are separate facts — `noSide` is nobody could
 * read one side at a time; `notAPair` is the read succeeding and answering a
 * count the product cannot file — and one list with a reason column would be the
 * two-meanings-of-none defect this module has already split apart once.
 */
type SlotOutOfTheCut = { slot: SlotSpec; detail: string };

/**
 * DOES THIS MASK CLAIM ANYTHING AT ALL — the difference between a side that
 * answers and a side that does not.
 *
 * `regionSides` returns two EMPTY masks when neither side wears the thing and
 * the caller has said absence is an answer, so a non-null mask is not a reading
 * of anything. Counted at the same midpoint every other mask in this module is
 * read at, because a mask read at two thresholds is how a crop passes a check it
 * should have failed.
 */
function maskHasPixels(mask: Mask): boolean {
  for (let at = 0; at < mask.data.length; at += 1) if (mask.data[at]! > MATTE_CLAIM) return true;
  return false;
}

/** A mask that claims the whole frame — the born read's "no edit governed this". */
function wholeFrame(width: number, height: number): Mask {
  return { data: Buffer.alloc(width * height, 255), width, height };
}

function digestOf(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Basis points, the unit the row stores. Rounded once, here, so no reader has
 *  to guess whether a number is a fraction or a percentage. */
function bp(value: number): number {
  return Math.round(value * 10_000);
}

/**
 * The alpha a matte pixel must exceed to be HER.
 *
 * One constant for the box, the completeness count and the pixel count, because
 * those are three readings of one mask and a mask read at two thresholds is how
 * a crop passes a check it should have failed. 127 is the same midpoint
 * `belowHeadMask` counts at.
 */
const MATTE_CLAIM = 127;

/**
 * HER BUILD, CUT FROM THE FRAME IN HAND — the composer (fable-424 §1/§2).
 *
 * Everything else in this mint cuts from a region a segmenter answered. This
 * cuts from a region nobody can be asked for: `belowHead` is arithmetic on two
 * answers the reader already gives — her silhouette, and where her head stops —
 * and D-213 forbids inventing a question that names a body instead.
 *
 * # It is exported so it can be driven, and it is pure so driving it is cheap
 *
 * No network, no store, no flag. Every refusal below is a `MaskError` naming
 * what could not be composed, and the caller turns one into the words-only row
 * `build` filed before it had a region at all — never into a lost render.
 */
export function composeBelowHeadCut(input: {
  /** The slot this cut belongs to, in the key space `cutSegments` uses. */
  facet: string;
  /** The delivered frame, decoded — the pixels the crop is made of. */
  frame: Raster;
  /** Her silhouette on that frame. */
  subject: Mask;
  /** `region("face")` on that same frame. Only its lowest row is used. */
  head: Mask;
}): { cut: SegmentCut; chinRow: number; complete: boolean; outside: number } {
  const { mask, chinRow } = belowHeadMask({ subject: input.subject, head: input.head });
  /*
    THE MASKS AND THE PIXELS MUST BE ONE PICTURE.

    Two models answer here — a matting model for the silhouette, a segmenter for
    the head — and neither promises the frame's own resolution. A mask at another
    size is refused rather than resized: a resample inside the one path that
    promises not to (§5), and a box measured in one grid and cut in another is
    the wrong-boundary class with her whole body inside it. The refusal is
    visible in the log line, which is also how we find out whether the two models
    ever disagree in production.
  */
  if (mask.width !== input.frame.width || mask.height !== input.frame.height) {
    throw new MaskError(
      `the composed region is ${mask.width}x${mask.height} and the frame is `
      + `${input.frame.width}x${input.frame.height} — never resize one to fit`,
    );
  }
  const box = boundsOf(mask, MATTE_CLAIM);
  if (box === null) throw new MaskError("nothing of her is below her chin in this frame");

  /*
    AND THE BOX IS PROVED AGAINST THE MASK THAT DREW IT — arithmetic, because it
    can be (fable-424 §2). Every other slot's crop is judged by a completeness
    specimen for its region family; there is no measured specimen for a
    below-head crop, and adopting another family's number would be a guard whose
    verdicts nobody calibrated (working law 2).

    SAID PLAINLY: under the box derivation on the line above, this cannot fail —
    the bounds of a mask contain the mask. It is asserted anyway because the box
    derivation is the thing most likely to change, and the obvious change is the
    wrong one: routing this through `cutSegments` would intersect the region with
    `applied`, and on a "green eyes" render `applied` is her eyes — a crop of her
    eyelids filed as her build. `belowHeadCropIsComplete` is driven with boxes
    that DO fail it in `maskGeometry.test.ts`; this call is the wiring that makes
    the day somebody changes the box a red test rather than a bad reference.
  */
  const verdict = belowHeadCropIsComplete({ mask, box });

  return {
    chinRow,
    complete: verdict.complete,
    outside: verdict.outside,
    cut: {
      facet: input.facet,
      region: DERIVED_REGION_KEY.belowHead,
      /* The subject's own alpha, cropped — never re-hardened. This is the one
         mask in the mint with a real edge ramp, and it is a matte because her
         silhouette is. */
      mask: cropMask(mask, box),
      content: cropRaster(input.frame, box),
      box,
      frame: { width: input.frame.width, height: input.frame.height },
      pixels: verdict.kept,
      /*
        THE UNION ACCOUNTING DOES NOT APPLY, and these say so rather than
        reporting a zero that means something else. `arrivedPixels` and
        `departedPixels` measure what a DELIVERED region reading found that the
        MASTER's did not, and vice versa. This region was composed once, on the
        delivered frame, from a matte and a head read on that same frame — there
        is no second reading for it to have arrived from or departed to.
        `deliveredRead: false` is the field's own honest state: no such split
        exists here.
      */
      arrivedPixels: 0,
      departedPixels: 0,
      deliveredRead: false,
    },
  };
}

/**
 * THE OPEN LANE'S SLOT, TOLD APART FROM A SLOT THE VOCABULARY CANNOT NAME.
 *
 * Both arrive with `guardKind: null`, and they are opposite situations. Her jaw
 * has no QUESTION — no region the segmenter can be asked for names it — so
 * there is nothing to cut and words are the whole of the answer. An open kind
 * has a perfectly good question, its own noun, and no measured FAMILY to score
 * the crop against; the catalogue records that as a reason rather than leaving
 * it a null (fable-766 §2), and the reason's presence is what routes the slot
 * to the absence-control door.
 *
 * One predicate, because three loops have to agree about it — the cut list, the
 * words-only list and the batched word read, which the file's own comment
 * requires to match "predicate for predicate". Three copies of this expression
 * is the shape where one of them keeps the old answer and a slot files twice.
 */
function isOpenKindSlot(slot: SlotSpec): slot is SlotSpec & { question: string; noSpecimen: string } {
  return slot.question !== null && slot.guardKind === null && slot.noSpecimen !== undefined;
}

/**
 * THE ABSENCE CONTROL — the door in FRONT of the door, for a kind nobody
 * catalogued (OPEN_LANE_DESIGN_NOTE §4, step 3).
 *
 * An open kind's crop has two ways of being worthless and they need two
 * different instruments:
 *
 *   is it a picture of ANYTHING      the segmenter answers *something* on every
 *                                    face, and a reader asked where the fangs
 *                                    are on a face with none returns a small
 *                                    confident region of mouth. **This control.**
 *   is it the WHOLE of the thing     the completeness guard's question, and it
 *                                    is answered at the ceiling — see the mint
 *                                    call's own note.
 *
 * The control is the shape this program uses everywhere: *an affirmative from an
 * instrument never seen to decline is not evidence.* The same reader is asked
 * the same question of the frame this render was painted FROM — which, for an
 * additive ask, cannot hold the thing. It returns the refusal, or `null` to mean
 * the crop may go on to be judged on its merits.
 */
function absenceRefusal(input: {
  kind: string;
  /** What the same reader answered on the before-picture. `null` is the clean
   *  decline this control is looking for; `undefined` is a control that could
   *  not be run at all, which is a different failure and not a pass. */
  before: Mask | null | undefined;
}): GuardRefusal | null {
  if (input.before === undefined) {
    return {
      ok: false, reason: "absenceUnread", kind: input.kind,
      detail: `nothing could be shown to the reader as a frame WITHOUT ${input.kind}, so whether it can decline for this kind is unknown`,
    };
  }
  /*
    ANY ANSWER AT ALL IS AN ANSWER, and the floor is zero on purpose.

    The one time this procedure has been run on a real kind it read
    **0.0000% on three visibly bare frames** against 0.39–0.87% on twelve worn
    ones (the horns detection court, quoted in OPEN_LANE_CARRY_DESIGN §6) — so
    zero is what a reader that can decline actually does, measured, rather than
    a bar chosen for tidiness. A floor above zero would be a number nobody has
    measured for a kind nobody has catalogued, which is the borrowed-specimen
    defect one layer along.

    It errs toward words, never toward a crop: a stray pixel on the
    before-picture costs this kind its carry for this render and costs nobody a
    picture. The specimen court is what says whether real unarmed kinds read
    clean zeroes; until it has, this is the strict direction and it is declared
    as one.
  */
  if (input.before !== null && input.before.data.some((value) => value !== 0)) {
    return {
      ok: false, reason: "absenceUnproven", kind: input.kind,
      detail: `the reader answered "${input.kind}" on the frame this render was painted FROM, which does not `
        + `hold it — so its answer on the delivered frame cannot be told from a confident region of nothing`,
    };
  }
  return null;
}

/**
 * THE GEOMETRIC DOOR — what stands in for the guard on a composed region.
 *
 * The measured door (`mintGuardedReference`) buys a second, independent read of
 * the crop's region and scores the crop against it. There is nothing to buy
 * here: the region was not read, it was DERIVED, and the honest check is whether
 * the crop holds every pixel the derivation kept. So this spends no vision call,
 * reaches 1.0 or refuses, and records `derived-geometry` as the instrument so no
 * row ever claims a specimen family it does not belong to.
 *
 * The duplicate rule is the measured door's own (`duplicateSlotFor`), imported
 * rather than restated: two slots may not hold one fact, whichever door let them
 * in.
 */
function geometricVerdict(input: {
  kind: string;
  digest: string;
  mintedDigests: ReadonlyMap<string, string>;
  composed: { complete: boolean; outside: number };
  cropPixels: number;
  /** The ask wrote this slot and the render's own reader disputed it. */
  disputed?: boolean;
}): GuardVerdict {
  /* Coverage is `|crop ∩ region| / |region|` everywhere in this product, and
     here the crop's mask IS the region cropped to its own box — so a complete
     crop reads exactly 1.0 with no spill, and an incomplete one reads the share
     it kept. Nothing is sampled and nothing is estimated. */
  const regionPixels = input.cropPixels + input.composed.outside;
  const reading = {
    coverage: regionPixels === 0 ? 0 : input.cropPixels / regionPixels,
    spill: 0,
    regionPixels,
    cropPixels: input.cropPixels,
  };
  const duplicate = duplicateSlotFor(input.digest, input.mintedDigests);
  if (duplicate) {
    return {
      ok: false, reason: "duplicateOfSlot", kind: input.kind, reading,
      detail: `this crop is byte-identical to ${duplicate}'s, and two slots may not hold one fact`,
    };
  }
  /*
    AND HERE, BEFORE COMPLETENESS — the measured door's own precedence, kept.

    A disputed slot is refused however well its crop measures, because the
    question it fails is not a question about the crop: the ask wrote this
    facet and the render's own reader said the change is not in the delivered
    picture. An unverified delivery may not become what the next render knows
    her build IS. Placed above the completeness check for the same reason it is
    placed there in `guardReference`: no completeness number can decide a
    question about delivery.
  */
  if (input.disputed) {
    return {
      ok: false, reason: "disputedDelivery", kind: input.kind, reading,
      detail: `this render's reader disputed that the ask landed on ${input.kind}; the composed crop is kept for a human rather than adopted`,
    };
  }
  if (!input.composed.complete) {
    return {
      ok: false,
      reason: "underCaptured",
      kind: input.kind,
      reading,
      judged: { instrument: "derived-geometry", coverage: reading.coverage, threshold: 1 },
      detail: `the crop's box leaves ${input.composed.outside} pixel(s) of the composed region outside it, and a crop of part of her build filed as her build is the failure this slot exists to avoid`,
    };
  }
  return {
    ok: true,
    kind: input.kind,
    reading,
    judged: { instrument: "derived-geometry", coverage: 1, threshold: 1 },
  };
}

export async function mintReferencesForRender(input: MintInput): Promise<MintResult> {
  const enabled = input.dependencies?.enabledFor ?? captureCastingReferenceLibraryEnabled;
  if (!enabled(input.userId)) return { outcome: "off", slots: [] };
  if (input.slots.length === 0) return { outcome: "nothing-to-keep", slots: [] };

  const read = input.dependencies?.read;
  const store = input.dependencies?.store ?? defaultStore;
  const record = input.dependencies?.record ?? recordReferenceRows;
  const manifest = input.dependencies?.manifest ?? defaultManifest;

  try {
    const outcomes: MintedSlot[] = [];
    const rows: ReferenceRowToRecord[] = [];
    const planned: Array<{ cut: SegmentCut; contentKey: string; maskKey: string }> = [];

    /*
      A SURFACE IS NEVER CUT AT ALL — not cut and discarded, not cut and
      refused. Its carrier is words (§3.0a), the tier that has no instrument
      able to certify a crop for it, and every vision call spent on one would be
      spent to produce something the write helper would then reject.
    */
    /*
      THE REGIONS THIS MINT WILL CUT FROM, whole-frame ones under their own
      question and per-side ones under a key that says which side.

      The key is qualified HERE and nowhere else: `cutSegments` looks a region up
      by string and does not care what the string means, so the two side masks of
      one question can travel through it as two regions without the cutter
      learning about laterality at all.
    */
    const regionsToCut = new Map<string, Mask>(input.masterRegions);
    const deliveredToCut = new Map<string, Mask>(input.deliveredRegions ?? []);
    const sideKey = (question: string, side: Instance) => `${question}@${side}`;

    /** Which instance a per-side slot is, from its own key. */
    const instanceOf = (slot: SlotSpec): Instance | null => parseSlot(slot.slot)?.instance ?? null;

    const cuttable: Array<SlotSpec & {
      question: string;
      guardKind: string;
      /** The region key this slot is cut from — its question, or one side of it. */
      regionKey: string;
      side: Instance | null;
      /**
       * COMPOSED, NOT ASKED — and this is what judges it.
       *
       * Present exactly on a derived slot whose region the composer built. Its
       * presence is what routes the slot past `mintGuardedReference` to the
       * geometric door: a derived key may never reach a reader, and a composed
       * region has no specimen family for a measured guard to consult.
       */
      composed?: { complete: boolean; outside: number };
      /**
       * A KIND NOBODY CATALOGUED, and this is what routes it through the
       * absence control (§4, step 3).
       *
       * A marker rather than a re-derivation, for the reason `composed` is one:
       * by the time a slot is in this list its `guardKind` has been filled in
       * with the noun so the row can name what was judged, and the very
       * property that identified it — a question with a null family — is no
       * longer readable off the record. A predicate that quietly stopped
       * matching would route every open kind to the measured door, where it
       * would refuse `noSpecimen` and the lane would go back to words with
       * nothing in the log to say why.
       */
      openKind?: true;
      /** THE READER WAS OVERRULED BY A CALIBRATED RULER (fable-429 §3), so this
       *  slot's crop is judged on its own merits from here on. The dispute is
       *  not erased — it rides on {@link MintResult.adjudications} and onto the
       *  outcome — it simply stops being the thing that refuses the pixels. */
      adjudicated?: true;
      /** Why no crop was cut for this slot, when the reason is more specific
       *  than "this render has no evidence about it". */
      noCutDetail?: string;
    }> = [];
    /** Per-side slots with no side to cut from, with the reason each one is out. */
    const sideless: SlotOutOfTheCut[] = [];
    /**
     * DISTRIBUTED OPEN KINDS WHOSE SIDES DID NOT COUNT TWO — the D1 gate's
     * refusal list, kept apart from `sideless` because they are two different
     * facts (fable-1001 §4).
     *
     * `noSide` is *nobody could read this one side at a time*. This is the read
     * SUCCEEDING and answering something the product cannot file: one wing, or
     * none, or — the arm the ruling insisted on — three. A pair with a bonus is
     * not a pair, and the count travels in the detail so the refusal names what
     * it saw rather than that it saw wrongly.
     */
    const notAPair: SlotOutOfTheCut[] = [];

    /*
      THE GROUND THIS RENDER DID NOT BRING, asked of the frame in hand.

      Only ever reached when the render supplied no map for the question — a
      repaint, which has no harvest to inherit one from. A render that brought
      its own never spends a call here, so the old road cannot pay for this even
      by accident. `null` from the reader is not a failure: the slot simply has
      no ground, falls to `noRegion` below, and files its words exactly as it
      would have done.
    */
    let groundReads = 0;
    /* The open lane's own price, counted apart from the ground's: one read per
       open kind that cut a crop, on the before-picture (§4, step 3). Separate
       because "what did the absence control cost" is a question the promotion
       decision asks, and a figure folded into another one cannot answer it. */
    let absenceReads = 0;
    const readGround = input.dependencies?.readGround;
    const groundFor = async (
      question: string, side: Instance | null, declaredTwoSided?: true,
    ): Promise<Mask | null> => {
      if (!readGround) return null;
      groundReads += 1;
      return readGround({
        frame: input.frame.bytes,
        question,
        ...(side === null ? {} : { side }),
        /*
          THE READER'S BILATERAL VOCABULARY IS CLOSED, AND AN OPEN KIND IS NOT IN
          IT (the D1 wire).

          `regionSides` answers `null` for a name it does not know two-sidedly —
          a nose, a hairstyle — and that null is the honest refusal that keeps a
          per-side crop from being guessed at. An open kind is outside that list
          by construction, so without this the distributed road could never read
          a side and every wing would file words forever.

          It is not the mint deciding a kind is two-sided: the LOCALITY
          CLASSIFIER decided that, on prompt kp-2, under three disagreeing
          controls (fangs co-located, wings distributed, halo single). This flag
          is that classification arriving at the reader, and it is only ever set
          from `locality === "distributed"`.
        */
        ...(declaredTwoSided === undefined ? {} : { declaredTwoSided }),
      });
    };

    /**
     * HOW MANY SIDES OF THIS KIND THE FRAME ANSWERS — D1, and it is the whole
     * gate (founder verdict fable-987 §1, wired per fable-1001 §4).
     *
     * The instrument is the one the counting court proved and the one the
     * product already runs: the frame is cut at her face's centroid and the
     * plain noun is asked of each half, and the count is how many halves answer.
     * Asking a segmenter *how many* would be buying an answer from a question it
     * cannot answer wrong — its own header records one mask every time for a
     * bilateral noun.
     *
     * Read ONCE per question and cached, because both side slots ask it and a
     * second read would be a second opinion about the same frame — the
     * read-the-same-pixels trap, which this program has already paid for once in
     * fictional drift.
     */
    const sidesCounted = new Map<string, Promise<{ count: number; masks: Record<Instance, Mask | null> }>>();
    const countSides = (question: string) => {
      const held = sidesCounted.get(question);
      if (held) return held;
      const reading = (async () => {
        const masks: Record<Instance, Mask | null> = { left: null, right: null };
        for (const side of INSTANCES) {
          const mask = await groundFor(question, side, true);
          masks[side] = mask !== null && maskHasPixels(mask) ? mask : null;
        }
        return { count: INSTANCES.filter((side) => masks[side] !== null).length, masks };
      })();
      sidesCounted.set(question, reading);
      return reading;
    };

    /*
      THE SLOTS WHOSE REGION IS COMPOSED RATHER THAN ASKED.

      Held back from the loop below rather than routed through it, because the
      key they travel under (`derived:below-head`) is deliberately a phrase no
      segmenter may ever be handed — so the generic path, which looks a region up
      by its question, must never see one. They are composed after the frame is
      decoded, since composing needs the frame's own resolution to refuse a
      mismatch against.
    */
    const derived: SlotSpec[] = [];

    for (const slot of input.slots) {
      if (slot.tier === "surface") continue;
      if (slot.question === null) continue;
      /*
        AN OPEN KIND IS CUT, and the recorded reason is what says so. A slot
        with no `guardKind` and no reason is the catalogue's ordinary null —
        her jaw — and still files words without a call being spent on it.
      */
      const openKind = isOpenKindSlot(slot);
      if (slot.guardKind === null && !openKind) continue;
      if (isDerivedRegion(slot.question)) { derived.push(slot); continue; }
      const question = slot.question;
      /*
        THE RECORD'S KIND, WHICH IS NOT A SPECIMEN FAMILY HERE. For a closed
        slot this is the family the crop is scored against. For an open one
        there is no family — that is the whole situation — and this is the noun
        the refusal and the reading are filed UNDER, so a row still says what
        was judged rather than leaving the column null. Nothing adopts it as a
        specimen, because the open door records no coverage on a refusal and
        the readings it does record are ceiling readings no bar divided.
      */
      const guardKind = slot.guardKind ?? question;
      if (slot.frame !== "ownSide") {
        if (!regionsToCut.has(question)) {
          const ground = await groundFor(question, null);
          if (ground) regionsToCut.set(question, ground);
        }
        cuttable.push({ ...slot, question, guardKind, regionKey: question, side: null, ...(openKind ? { openKind } : {}) });
        continue;
      }

      /*
        ONE OF A PAIR, AND ONLY A WHOLE-FRAME REGION TO CUT IT FROM.

        The slot has a perfectly good question — `earring`, `eye`, `ear` — and
        asked of the whole frame it comes back as the UNION of both sides, so
        `@left` and `@right` would be cut from one mask and each scored against
        it. Both would read complete. Both would be a picture of two things
        under the name of one.

        No coverage is taken when that happens, on purpose. A refusal here
        carrying a number would hand the next person a specimen measured against
        both of her ears, and the guard adopts a kind's specimen for every
        instance of it. The words still file, and for a pair they are the whole
        of what the panel needs: divergence is derived from words, never from
        pixels (referenceSlots).
      */
      const side = instanceOf(slot);
      if (side === null) {
        sideless.push({
          slot,
          detail: `"${slot.slot}" is a per-side slot whose key names no instance, so there is no side to cut`,
        });
        continue;
      }
      const key = sideKey(question, side);
      /*
        A DISTRIBUTED OPEN KIND IS COUNTED BEFORE IT IS CUT — the D1 gate.

        It takes this door rather than the two below it because neither of them
        can answer its question. The harvest brings no map for a kind nobody
        catalogued, and the ordinary side read would hand back one wing and cut
        it happily: the completeness guard cannot refuse that crop, because its
        own read finds the same one wing and any box containing it scores 1.0.
        The count is the only instrument that can tell a pair from half of one,
        and it must pass BEFORE a picture is filed under a name that means both.

        `count !== 2` refuses every other reading and says which it saw: zero (a
        frame that does not wear the thing), one (the failure this gate exists
        for — a wing under the name of wings), and anything else, because a
        three-winged read is not a pair with a bonus but a reading the product
        cannot file. The row still files its WORDS, so the kind survives the
        render exactly as it did before crops existed.
      */
      if (openKind) {
        const counted = await countSides(question);
        if (counted.count !== 2) {
          notAPair.push({
            slot,
            detail: `${question} answered on ${counted.count} of her two sides on this frame, and a crop `
              + `filed as ${slot.noun} needs both — one side under a name that means two is the picture `
              + "this gate exists to refuse",
          });
          continue;
        }
        const mine = counted.masks[side];
        if (mine === null) {
          /* Unreachable while `count === 2` means both sides answered, and
             reported rather than skipped for the reason every other should-be-
             unreachable branch in this file is: it would be the count and the
             masks disagreeing about one reading. */
          notAPair.push({
            slot,
            detail: `${question} counted two sides and then had no mask for her ${side}, which is one `
              + "reading contradicting itself",
          });
          continue;
        }
        regionsToCut.set(key, mine);
        cuttable.push({ ...slot, question, guardKind, regionKey: key, side, openKind });
        continue;
      }
      const sides = input.masterSideRegions?.get(question) ?? null;
      if (!sides) {
        /*
          A render that brought no side map may still have brought a READER, and
          a side is scoped by the reader or it is not scoped at all: this asks
          for HER side by name and takes `null` for an answer. A reader without
          the capability answers null, which lands in exactly the refusal below
          — words, no crop, and no coverage number measured against both of her
          ears. The refusal is what produces the specimen, so it is preserved
          rather than routed around.
        */
        const ground = await groundFor(question, side);
        if (!ground) {
          sideless.push({
            slot,
            detail: `"${question}" was not read one side at a time on this render, so a crop of it filed as ${slot.noun} would contain the other one too`,
          });
          continue;
        }
        regionsToCut.set(key, ground);
        cuttable.push({ ...slot, question, guardKind, regionKey: key, side, ...(openKind ? { openKind } : {}) });
        continue;
      }

      regionsToCut.set(key, sides[side]);
      const delivered = input.deliveredSideRegions?.get(question);
      if (delivered) deliveredToCut.set(key, delivered[side]);
      cuttable.push({ ...slot, question, guardKind, regionKey: key, side, ...(openKind ? { openKind } : {}) });
    }
    /*
      THE CUTS, TAKEN BEFORE ANY ROW IS FILED.

      They used to be taken after the words-only loops, which was fine while a
      slot's words arrived with it. Now the words are READ FROM THE CUT, so
      every row — including the ones that will never store a crop — has to know
      whether this render produced a view of its slot. Nothing else moved: the
      rows are pushed in the same order, by the same loops, on the same rules.
    */
    const frame = await readRaster(input.frame.bytes);
    const cuts = cuttable.length === 0 ? [] : cutSegments({
      composite: frame,
      applied: input.applied ?? wholeFrame(frame.width, frame.height),
      facetRegions: new Map(cuttable.map((slot) => [slot.slot, slot.regionKey])),
      regionMasks: regionsToCut,
      deliveredMasks: deliveredToCut.size > 0 ? deliveredToCut : null,
    });

    /*
      AND THE COMPOSED ONES, CUT FROM THE FRAME IN HAND.

      Deliberately NOT through `cutSegments`: that function intersects every
      region with `applied`, which is where the paint was allowed to go — and a
      build crop is re-cut on renders that painted her EYES. Her build
      intersected with her eyelids is a crop of her eyelids filed as her build.
      This region is not edit-carried and never was; it is the whole extent of
      her below her chin on the frame the user is looking at (fable-424 §4).

      A failure here costs the slot its crop and nothing else: it files the
      words-only row `build` filed before it had a region, with the reason on it.
    */
    let derivedReads = 0;
    let span: BuildSpan | null = null;
    const composedCuts: SegmentCut[] = [];
    const ground = input.dependencies?.derivedGround;
    const adjudications: DeliveryAdjudication[] = [];
    /*
      THE RULER'S OTHER END, read on the frame this render was painted from.

      Bought ONLY when a court is about to be asked something it can answer:
      the slot is disputed, an instrument holds a court for it, the court covers
      every facet the reader disputed, and the branch has no crop for this slot
      yet (the court's specimens are all first-body-edit). Any of those missing
      and no call is made — the dispute stands, which is today's behaviour and
      costs nothing.

      Two reads, on the same two seams the composer already uses. Counted
      separately from `derivedReads` because they are spent on a different frame
      for a different question, and a price folded into another price is a price
      nobody can audit.
    */
    let anchorReads = 0;
    const anchorSpanFor = async (): Promise<BuildSpan | null> => {
      if (!ground || !input.anchorFrame) return null;
      anchorReads += 2;
      const [head, subject] = await Promise.all([
        ground.region({
          frame: input.anchorFrame.bytes,
          question: DERIVED_REGION_ASKS.belowHead.head,
        }),
        ground.subject({ frame: input.anchorFrame.bytes }),
      ]);
      if (!head || !subject) return null;
      return buildSpan({ subject, head });
    };
    for (const slot of derived) {
      const detail = (why: string) => {
        cuttable.push({
          ...slot,
          question: slot.question!,
          guardKind: slot.guardKind!,
          regionKey: slot.question!,
          side: null,
          noCutDetail: why,
        });
      };
      if (!ground) {
        detail("this slot's region is composed rather than asked, and no composer is wired into this mint");
        continue;
      }
      try {
        derivedReads += 2;
        const [head, subject] = await Promise.all([
          ground.region({ frame: input.frame.bytes, question: DERIVED_REGION_ASKS.belowHead.head }),
          ground.subject({ frame: input.frame.bytes }),
        ]);
        if (!head || !subject) {
          detail(
            `her build is composed from her silhouette and the bottom of her head, and this frame gave up `
            + `${!head && !subject ? "neither" : !head ? "no head" : "no silhouette"}`,
          );
          continue;
        }
        /*
          One instrument rides the decision (fable-424 §4) — logged below,
          whether or not the crop survives the door.

          Taken only for the region it measures. `buildSpan` reads a SHOULDER
          span against a head height; handed some future derived region it would
          answer a number about her shoulders under that region's name, which is
          the wrong-boundary class wearing a metric.
        */
        if (slot.question === DERIVED_REGION_KEY.belowHead) span = buildSpan({ subject, head });
        const composed = composeBelowHeadCut({ facet: slot.slot, frame, subject, head });
        composedCuts.push(composed.cut);
        /*
          AND WHERE A CALIBRATED RULER EXISTS, THE DISPUTE IS THE RULER'S TO
          SETTLE (fable-429 §3).

          A body edit produces no caption at all — measured on the live pipeline
          — so the reader that decides whether an ask landed answers a question
          about her build by looking at a frame it cannot read, and answers it
          wrongly in one direction only. `buildSpan` has a court: three faces, a
          floor arm and a signal arm, a 0.00% negative control, and a live
          reading an eye confirmed. Where it can see the change, it says so.

          It can only ever settle TOWARD delivery. A reading below the bar
          declines rather than confirming the reader — a ruler that did not see
          a change has not proven there was none (D-235), and the crop then
          stays refused and kept for a human exactly as it is today.
        */
        const court = slot.disputed ? deliveryCourtFor(slot.slot) : null;
        let adjudicated: true | undefined;
        if (court) {
          const facets = slot.disputedFacets ?? [];
          const anchorCarriesPriorDelivery = input.knownDigests?.has(slot.slot) ?? false;
          /* The anchor read is bought only where the court could actually
             answer — a facet outside it, or an anchor already carrying a
             delivery, is refused for free. */
          const eligible = courtCovers(court, facets)
            && !anchorCarriesPriorDelivery
            && input.anchorFrame !== undefined;
          const verdict = adjudicateDelivery({
            court,
            facets,
            anchor: eligible ? await anchorSpanFor() : null,
            delivered: span,
            anchorCarriesPriorDelivery,
          });
          adjudications.push({
            slot: slot.slot,
            instrument: court.instrument,
            facets,
            /* BOTH VERDICTS, always. This record exists because a reader said
               no, and a stored crop with the dispute dropped from its record is
               indistinguishable from an ordinary pass. */
            reader: "disputed",
            verdict,
            bar: court.positive,
            source: court.source,
          });
          if (verdict.settled) adjudicated = true;
        }
        cuttable.push({
          ...slot,
          question: slot.question!,
          guardKind: slot.guardKind!,
          regionKey: slot.question!,
          side: null,
          composed: { complete: composed.complete, outside: composed.outside },
          ...(adjudicated ? { adjudicated } : {}),
        });
      } catch (error) {
        detail(error instanceof MaskError
          ? error.message
          : `her build could not be composed from this frame: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const cutBySlot = new Map([...cuts, ...composedCuts].map((cut) => [cut.facet, cut]));

    /* Encoded once per cut and remembered: the words read these bytes and the
       digest hashes them, and encoding a crop twice to answer one question
       about it twice is the copy law 4 warns about wearing a performance
       costume. */
    /*
      THE PROMISE IS THE CACHE ENTRY, not the answer (stage 3b).

      This used to store the encoded crop AFTER awaiting it, which is the same
      thing while one caller runs at a time and a different thing the moment two
      do: both would look, both would miss, and one crop would be encoded twice.
      Holding the promise makes the second caller wait on the first call instead
      of starting a second — the shape `pairWords` below already had.
    */
    const encodedCuts = new Map<string, Promise<Awaited<ReturnType<typeof encodeCut>>>>();
    const encodedFor = (cut: SegmentCut) => {
      const held = encodedCuts.get(cut.facet);
      if (held) return held;
      const encoding = encodeCut(cut);
      encodedCuts.set(cut.facet, encoding);
      return encoding;
    };

    /*
      WHAT THIS SLOT NOW IS, IN WORDS — one read, of the narrowest view there is.

      `null` is a real answer and it means *nothing could be said about this
      slot*: an accessory with no cut, or a read that failed soft. A slot with a
      cut still files its row — the crop is the carrier and `describe()` already
      says "the same left earring, unchanged" for an empty stack — but a slot
      with NEITHER writes nothing at all, so its newest existing row keeps
      carrying rather than being superseded by silence.
    */
    let wordReads = 0;
    const readWords = input.dependencies?.readWords;
    /*
      ONE DESCRIPTION FOR A MATCHED PAIR — and TWO for a pair that is genuinely
      two things (founder 2026-08-15, via fable-591 §1 and fable-592).

      His #193 delivered identical crosses and filed two different sentences
      about them, because the describer is asked once per side and two calls
      about one object come back with two answers. He also drew the limit
      himself: *"the description can genuinely be different if I edit the left
      or right earring to genuinely be a different earring, or ask for 2
      different earrings in the first place."* A patch that forced agreement
      onto a deliberate mismatch would erase the capability click-to-scope
      shipped, which is the worse bug.

      So the discriminator is the ASK, which the product already has: a slot's
      `words` are its declarative stack as of this render, and a pair asked as a
      pair carries the SAME stack on both sides — the recipe says it in the
      founder's own dispatch, *"Change only his left earring: dangly cross
      earrings; his right earring: dangly cross earrings."* Two sides whose
      stacks are identical were asked for as one thing, so they are described
      once and both rows file that description. Two sides whose stacks differ
      were asked for separately, and each keeps its own read.

      A per-side EDIT needs nothing from this rule: only the edited side is in
      this render's list at all, so the other keeps the row it already had.

      It also spends one vision call rather than two on the common case, which
      is the shape a matched-pair ask takes every time.
    */
    const stackOf = (slot: SlotSpec) => slot.words.join(" | ").trim().toLowerCase();
    const pairKeyBySlot = new Map<FeatureSlot, string>();
    {
      const bySide = new Map<string, SlotSpec[]>();
      for (const slot of input.slots) {
        const [feature, side] = slot.slot.split("@");
        if (!side || !feature) continue;
        const held = bySide.get(feature) ?? [];
        held.push(slot);
        bySide.set(feature, held);
      }
      for (const sides of Array.from(bySide.values())) {
        if (sides.length !== 2) continue;
        const [left, right] = sides as [SlotSpec, SlotSpec];
        if (stackOf(left) === "" || stackOf(left) !== stackOf(right)) continue;
        const feature = left.slot.split("@")[0];
        for (const slot of sides) pairKeyBySlot.set(slot.slot, `${feature}|${stackOf(left)}`);
      }
    }
    const pairWords = new Map<string, Promise<readonly string[] | null>>();
    /*
      AND ONE ASKING PER SLOT, held as a promise for the same reason.

      The five loops below each ask a disjoint set of slots, so this memo never
      merges two questions that were meant to be two — it exists so the reads
      can be STARTED before the loops and consumed inside them (stage 3b). A
      loop's `await wordsFor(slot)` then resolves against a call already in
      flight rather than opening one.
    */
    const wordsBySlot = new Map<FeatureSlot, Promise<readonly string[] | null>>();
    const wordsFor = (slot: SlotSpec): Promise<readonly string[] | null> => {
      const held = wordsBySlot.get(slot.slot);
      if (held) return held;
      const pairKey = pairKeyBySlot.get(slot.slot);
      const shared = pairKey === undefined ? undefined : pairWords.get(pairKey);
      const asked = shared ?? readOneSlotsWords(slot);
      if (pairKey !== undefined && !shared) pairWords.set(pairKey, asked);
      wordsBySlot.set(slot.slot, asked);
      return asked;
    };
    /**
     * THE WORDS A ROW FILES, and the one case where they are not a reading.
     *
     * A slot whose reading was DISPUTED files the words it ARRIVED with — the
     * ask — and buys no vision call to describe itself (fable-927 §3, swept to
     * every member of the class by fable-930 §2). Two reasons, and they are the
     * same reason from two ends:
     *
     *   the money      the reads are started in one batch before these loops,
     *                  from a predicate that excludes disputed slots. A loop
     *                  that asked for one anyway would buy a call per render
     *                  the batched version never made — the drift
     *                  `no slot is described that the mint would not have
     *                  asked about` exists to catch.
     *   the meaning    the reading that would supply a description is the very
     *                  one under dispute. On a fine sparse surface the founder's
     *                  eye has overturned that reader twice (working law 9), so
     *                  describing the frame again would file the denial. The ask
     *                  is what she paid for.
     */
    const wordsForRow = async (slot: SlotSpec): Promise<readonly string[] | null> => {
      if (!slot.disputed) return wordsFor(slot);
      return slot.words.length > 0 ? slot.words : null;
    };
    const readOneSlotsWords = async (slot: SlotSpec): Promise<readonly string[] | null> => {
      /* Not wired: the slot files the words it arrived with, byte for byte
         today's behaviour. */
      if (!readWords) return slot.words;
      const cut = cutBySlot.get(slot.slot);
      if (!cut) {
        /*
          AN ACCESSORY IS NEVER READ AGAINST THE FRAME, however cheap that would
          be. "Her left earring" asked of a whole picture is the read that wrote
          "plus dark tortoiseshell cat-eye glasses" into an earring row four
          times. An anatomy noun with no question — her jaw, her skin — names
          one thing a face has one of, so the frame is honest for it.
        */
        if (accessoryKindOfSlot(slot.slot) !== null) return null;
        wordReads += 1;
        const said = await readWords({
          bytes: input.frame.bytes,
          contentType: "image/png",
          noun: slot.noun,
          view: "frame",
        });
        return said === null ? null : [tidyStackWord(said)];
      }
      wordReads += 1;
      const encoded = await encodedFor(cut);
      const said = await readWords({
        bytes: encoded.content,
        contentType: "image/png",
        noun: slot.noun,
        view: "cut",
      });
      return said === null ? null : [tidyStackWord(said)];
    };

    /** Nothing could be said about this slot, so no row is written for it. */
    const unread = (slot: SlotSpec) => {
      outcomes.push({
        slot: slot.slot,
        outcome: "unread",
        reason: cutBySlot.has(slot.slot) ? "readFailedSoft" : "noCut",
      });
    };

    /*
      A DISPUTED SLOT NEVER FILES WORDS — the three loops below all skip one, and
      each skip is the same sentence: this slot is in the list for its pixels, and
      a words-only row for it would be a version bump asserting a delivery its own
      reader disputed. Today such a slot files nothing at all; after this change it
      files nothing at all UNLESS there is a crop to look at. Strictly additive, on
      purpose (fable-220 §3's "only the PIXELS gain an afterlife").
    */
    const disputedNothingKept = (slot: SlotSpec, reason: DisputedNothingKept, detail?: string) => {
      outcomes.push({
        slot: slot.slot,
        outcome: "disputed",
        kept: false,
        reason,
        ...(detail === undefined ? {} : { detail }),
      });
    };

    /*
      STAGE 3b — THE WORDS GO OUT TOGETHER, AND NOTHING ELSE MOVES (fable-695
      §4c, whose condition is that each site is proven independent at the
      artifact or stays serial with the reason said out loud).

      Five loops below ask the describer one slot at a time, each on the
      customer's paid wait, and a render with six slots waited through six calls
      in series. They are NOT parallelised: their order, their branches and
      every push into `rows` and `outcomes` are exactly as they were. What
      changes is that the reads are STARTED here, all at once, and each loop's
      `await wordsFor(slot)` then meets a call already in flight.

      Doing it this way rather than by rewriting the loops is deliberate, and it
      is what makes the change provable: the two artifacts this function
      produces are built by the same statements in the same order, so they
      cannot come out different — and the one genuinely order-dependent
      decision in the whole function, the duplicate-digest rule that catches a
      byte-identical crop BECAUSE an earlier slot is already in `digests`, is
      untouched. A parallelised cut loop would have had to reproduce that, and
      it is not what this stage buys.

      **The asked set is computed to match the loops exactly**, predicate for
      predicate — a slot the loops would skip must not be read here, or this
      would spend a call the serial version never made.

      One accepted cost, named: when a read fails, the serial version stopped at
      the first failure and never made the later calls. This has already made
      them. That is stage 1's trade — a few reads issued on a render that then
      fails — and the failure itself is unchanged, because each loop re-awaits
      the same rejected promise at exactly the point it would have thrown.
    */
    const willBeAskedForWords: SlotSpec[] = [
      ...input.slots.filter((slot) => slot.tier === "surface" && !slot.disputed),
      ...input.slots.filter((slot) => slot.tier !== "surface"
        && (slot.question === null || (slot.guardKind === null && !isOpenKindSlot(slot)))
        && !slot.disputed),
      ...sideless.filter(({ slot }) => !slot.disputed).map(({ slot }) => slot),
      ...notAPair.filter(({ slot }) => !slot.disputed).map(({ slot }) => slot),
      ...cuttable.filter((slot) => cutBySlot.has(slot.slot) || !slot.disputed),
    ];
    /* Settled rather than raced: a rejection here is re-thrown by the loop that
       owns it, and no sibling may be left with nobody listening. */
    await Promise.allSettled(willBeAskedForWords.map((slot) => wordsFor(slot)));

    for (const slot of input.slots) {
      if (slot.tier !== "surface") continue;
      /* A surface has no crop by construction, so a dispute has no pixels to
         withhold — see the class note at the `noQuestion` loop below. Its words
         are the whole carrier, and they are the ASK when the reading is
         disputed (fable-927 §3, swept to this member by fable-930 §2). */
      const said = await wordsForRow(slot);
      if (said === null) { unread(slot); continue; }
      rows.push({ role: "carry", slot: slot.slot, tier: slot.tier, noun: slot.noun, words: said });
      outcomes.push({ slot: slot.slot, outcome: "words-only", reason: "surface" });
    }
    /*
      A SLOT WITH NO QUESTION IS NOT A SLOT WITH NO WORDS. The catalogue hands
      one of these when the region vocabulary has nothing that names the feature
      — her jaw, her teeth, her skin — and the alternative to a words-only row
      is a crop of the nearest bigger region wearing the smaller name. The row
      is written for the same reason a refused crop's is: the words are the
      carrier of record, and a slot that files nothing leaves its previous crop
      riding beside words that have moved on.
    */
    for (const slot of input.slots) {
      if (slot.tier === "surface") continue;
      /* An open kind is NOT one of these — it has a question, it is in the cut
         list, and it files its row there. The predicate is shared with that
         list rather than restated, because a slot both loops claim files
         twice. */
      if (slot.question !== null && (slot.guardKind !== null || isOpenKindSlot(slot))) continue;
      /*
        AND A DISPUTE DOES NOT SILENCE A SLOT WHOSE ONLY CARRIER IS ITS WORDS.

        Everywhere else, `disputed` means: keep the refused CROP so a human can
        settle reader-versus-painter, and file no words that would assert a
        feature the reader says is not there. Here there is no crop — and this
        branch used to conclude from that "nothing a human could settle" and
        keep NOTHING at all.

        That reasoning is right about pixels and wrong about the row. The
        paragraph above this loop is the argument: for a question-less slot the
        words are the CARRIER OF RECORD, and the recipe's standing clauses are
        built from library rows alone (`recipeAssembler.ts`). A slot that files
        nothing is not a slot recorded as uncertain — it is a feature the next
        render is never told about, on a road that anchors every render on the
        pristine master.

        WHAT IT COST, measured on the chain (opus-682/683, ruled fable-927 §3):
        `skin` holds `marks`; freckles were asked for and paid for on v#457; the
        delivery reader called them absent — wrongly, they are visibly there at
        native pixels and the caption reader on the same frame saw them; the
        slot filed nothing; and v#458's recipe said not one word about her skin.
        Her BORN freckles ride the master's own pixels and survived. The ones
        she paid for did not. **The only part of her face that reverted was the
        part a customer bought.**

        THE WORDS ARE THE ASK, and only for this case. The library's discipline
        is to describe what was DELIVERED, and it stands everywhere else. Here
        the reading that would supply the delivered description is the very one
        under dispute, on a class the founder's eye has overturned twice
        (working law 9) — so the words that ride are the ones she paid for, and
        the outcome below is labelled `disputed` so the row never claims to be a
        confirmed reading.
      */
      const said = await wordsForRow(slot);
      if (said === null) { unread(slot); continue; }
      rows.push({ role: "carry", slot: slot.slot, tier: slot.tier, noun: slot.noun, words: said });
      outcomes.push({
        slot: slot.slot,
        outcome: "words-only",
        reason: "noQuestion",
        detail: slot.disputed
          ? "no segmentation question names this slot, so there is nothing honest to cut — and the "
            + "reading was DISPUTED, so these are the words she asked for rather than a description "
            + "of the delivered frame (working law 9, fable-927 3)"
          : "no segmentation question names this slot, so there is nothing honest to cut",
      });
    }
    for (const { slot, detail } of sideless) {
      if (slot.disputed) {
        disputedNothingKept(slot, "noSide", detail);
        continue;
      }
      const said = await wordsFor(slot);
      if (said === null) { unread(slot); continue; }
      rows.push({ role: "carry", slot: slot.slot, tier: slot.tier, noun: slot.noun, words: said });
      outcomes.push({ slot: slot.slot, outcome: "words-only", reason: "noSide", detail });
    }
    /* The D1 gate's refusals, filed exactly as `noSide` is — words keep the
       feature on her, and the reason says the count rather than "no side". */
    for (const { slot, detail } of notAPair) {
      if (slot.disputed) {
        disputedNothingKept(slot, "notAPair", detail);
        continue;
      }
      const said = await wordsFor(slot);
      if (said === null) { unread(slot); continue; }
      rows.push({ role: "carry", slot: slot.slot, tier: slot.tier, noun: slot.noun, words: said });
      outcomes.push({ slot: slot.slot, outcome: "words-only", reason: "notAPair", detail });
    }

    /* Digests already spoken for, so a byte-identical crop is caught whether it
       arrived this render or three renders ago. */
    const digests = new Map(input.knownDigests ?? []);

    /* One vision call per disputed facet is the declared price of settling
       reader-versus-painter (fable-220 §3, condition 2), and it is counted here
       so the log line states what was spent rather than implying it. */
    let disputedReads = 0;

    for (const slot of cuttable) {
      const cut = cutBySlot.get(slot.slot);
      if (!cut) {
        /* No evidence about this slot on this frame. Not a failure: the words
           still record, and the next render treats it exactly as today. */
        /* Same class again, and this is the member most likely to fire: it
           happens whenever a segmenter comes back empty on a frame, which is
           not a judgement about her picture at all. Withholding the words
           there would let one blank read delete a paid feature from every
           render after it (fable-930 §2). */
        const said = await wordsForRow(slot);
        if (said === null) { unread(slot); continue; }
        rows.push({ role: "carry", slot: slot.slot, tier: slot.tier, noun: slot.noun, words: said });
        outcomes.push({
          slot: slot.slot,
          outcome: "words-only",
          reason: "noRegion",
          /* A composed region that could not be composed says WHY, because
             "the segmenter found nothing" and "the two models disagreed about
             the frame's resolution" are different failures and only one of them
             is ours. */
          ...(slot.noCutDetail === undefined ? {} : { detail: slot.noCutDetail }),
        });
        continue;
      }

      /*
        THE WORDS ARE READ FROM THIS CUT, and a slot with a cut always files its
        row. An empty stack beside a crop is honest — the crop is the carrier and
        the assembler says "the same left earring, unchanged" for one — where an
        empty stack with NO crop would supersede a true sentence with silence.
      */
      const said = (await wordsFor(slot)) ?? [];
      const encoded = await encodedFor(cut);
      const digest = digestOf(encoded.content);
      /*
        TWO DOORS, AND WHICH ONE IS DECIDED BY WHERE THE REGION CAME FROM.

        A composed region has no second read to be scored against — that is what
        composed means — so it goes to the geometric door, which proves the crop
        holds every pixel the derivation kept and spends no vision call. A read
        region goes to the measured door, which buys its own independent read.
        The branch is on `composed` rather than on the slot's name, so a second
        derived slot needs no edit here and an asked slot can never reach the
        arithmetic by accident.
      */
      /*
        A LIPS CROP IS CUT FROM A CLOSED MOUTH, OR IT WAITS (fable-493).

        The founder asked what a lips reference contains when she is smiling.
        Until today the question could not arise: the old cutting word answered
        zero on an open mouth, so every lips crop in existence is closed-mouth
        by accident of the very defect just fixed. "The lips" removes the
        accident — it answers 0.2342% on his smiling frame — and a crop cut
        there would be PARTED lips with teeth between them, handed to every
        later render as "what her lips are". Expression is a per-render
        presentation clause on this road and deliberately NOT a carried fact.

        So the accident becomes a policy: the teeth region is its own
        discriminator (measured — 1,345px on his smile, 0 on his closed mouth),
        and a lips crop is refused where it answers. The row still files its
        words, the panel still draws its row and its box, and the crop waits for
        the next closed-mouth render exactly like a carrier awaiting its
        confirmation.

        IT RUNS BEFORE THE COMPLETENESS DOOR, and that ordering is the point.
        `lips` has no completeness specimen, so today every lips crop is
        refused `noSpecimen` — and that refusal KEEPS its pixels, because its
        whole purpose is to produce the specimen the bar will one day be
        derived from. A smiling crop kept there would calibrate the lips bar
        on a mouth full of teeth. So the mouth is asked first: no crop is
        stored, none is kept for adoption, and the words file as they always
        did.

        It costs ONE read, and only on a render that actually cut a lips crop.
      */
      const mouthIsOpen = slot.slot === "lips" && read !== undefined
        ? await teethAreShowing(read, input.frame.bytes)
        : false;
      /*
        THE ABSENCE CONTROL, BOUGHT ONLY WHERE IT DECIDES SOMETHING (§4, step 3).

        One read, on an open kind that actually cut a crop this render — a kind
        the delivered frame said nothing about never reaches here, and nothing
        is spent proving the absence of a thing nobody found. The reader is the
        GROUND reader, deliberately: the control's question is whether the
        instrument that produced this region can decline for this kind, and
        asking a different instrument would answer about a different one.

        The before-picture is the frame this render was painted FROM, which the
        mint is already handed for the ruler — so this costs no plumbing and no
        second fetch. If either the frame or the reader is missing the control
        is UNRUN, which is its own refusal and not a pass.
      */
      const absence = slot.openKind
        ? absenceRefusal({
          kind: slot.guardKind,
          before: input.anchorFrame && readGround
            ? await (async () => {
              absenceReads += 1;
              try {
                return await readGround({ frame: input.anchorFrame!.bytes, question: slot.question });
              } catch {
                /* A throw is a reading that did not happen. `undefined` is
                   `absenceUnread`, which is the honest outcome — the same rule
                   `mintGuardedReference` applies to its own reader. */
                return undefined;
              }
            })()
            : undefined,
        })
        : null;
      const verdict = absence
        ?? (mouthIsOpen
        ? {
          /* NO NUMBER. Nothing measured this crop's completeness — the mouth
             was asked before the door was — and a zero here would be a figure
             nobody earned wearing the clothes of one that was
             (`readDidNotSettle`'s precedent, same file). */
          ok: false as const,
          reason: "mouthOpen" as const,
          kind: slot.guardKind,
          detail: "the delivered frame is smiling, so this crop would carry her teeth "
            + "into every later render as what her lips are",
        }
        : slot.composed
        ? geometricVerdict({
          kind: slot.guardKind,
          digest,
          mintedDigests: digests,
          composed: slot.composed,
          cropPixels: cut.pixels,
          /* A dispute a calibrated ruler has settled no longer refuses the
             crop — and it is the ONLY thing that changes: the completeness
             arithmetic below still has to pass, the duplicate rule above still
             applies, and the dispute itself is on the record either way. */
          ...(slot.disputed && !slot.adjudicated ? { disputed: true } : {}),
        })
        : await (async () => {
          if (!read) throw new Error("the completeness guard has no reader, and a crop may not enter the library unread");
          return mintGuardedReference({
            kind: slot.guardKind,
            question: slot.question,
            /*
              AND THE GUARD IS ASKED THE SAME NARROW QUESTION THE CROP ANSWERS.

              A per-side crop scored against a read of both sides measures about
              half of a region it entirely contains — a refusal with a number
              nobody earned, which is exactly how a kind acquires a specimen it
              should not have. The reader that cannot scope to a side returns
              nothing, and nothing is `readDidNotSettle`: no pass, and no number
              either.
            */
            ...(slot.side === null ? {} : { side: slot.side }),
            /* The guard's read must reach the same side the crop was cut from,
               and an open kind's name is outside the reader's bilateral list —
               so the classifier's answer rides here too, or the door the count
               just opened refuses every crop behind it. */
            ...(slot.side !== null && slot.openKind ? { declaredTwoSided: true as const } : {}),
            frame: input.frame.bytes,
            crop: { mask: cut.mask, box: cut.box },
            digest,
            mintedDigests: digests,
            /* The guard owns the precedence: the three refusals about whether
               this is a real, unique picture of the subject come FIRST, and a
               dispute only ever displaces a completeness verdict. */
            ...(slot.disputed ? { disputed: true } : {}),
            /*
              THE OPEN KIND'S ONE ASSERTION, AND IT IS ABOUT THE CONTROL RATHER
              THAN ABOUT THE CROP.

              Reached only past `absence` above, so by construction the reader
              has been shown a frame without the thing and declined. That
              retires the half of `noSpecimen` a family would have answered —
              at a reading of exactly 1.0 there is no shortfall for any bar to
              divide — and leaves the other half to the control that just ran.
              Below the ceiling nothing changes: the crop still refuses
              `noSpecimen`, still keeps its pixels, and still waits for the
              specimen only a human can supply.
            */
            ...(slot.openKind ? { ceilingIsTheBar: true as const } : {}),
          }, read);
        })());
      /* Counted on the MEASURED door only: the geometric one spends nothing, and
         a composed slot's dispute costs a vision call nowhere. */
      if (slot.disputed && !slot.composed) disputedReads += 1;

      if (!verdict.ok) {
        log.warn(
          {
            userId: input.userId,
            variantId: input.variantId,
            operationId: input.operationId,
            slot: slot.slot,
            reason: verdict.reason,
            coverage: verdict.reading?.coverage,
          },
          `[library] a crop was turned away at the door — ${verdict.detail}`,
        );
        /*
          THE REFUSAL GOES ON THE ROW, and for one reason the PIXELS do too.

          Every refusal records what happened at the door: which of
          `GUARD_REFUSAL_REASONS` it was, the specimen family it was judged
          against, and the number it read if a reading happened. That is the
          difference between "this slot has words" and "this slot has words
          BECAUSE its crop was turned away for this reason at this coverage" —
          and it is the difference between buying a render to find out and
          reading the row.

          Some of them keep the crop as well, and the membership is
          `REFUSALS_THAT_KEEP_THEIR_CROP`'s to state rather than this comment's
          (it was two when this was written and is four today; the reasons for
          each are in `referenceCompleteness.ts` beside the list). What they
          share is that only a HUMAN can settle them — either because the crop
          is unjudgeable by any instrument here, or because the instrument that
          judged it stands on a bar thin enough that an eye overturns it. The
          keys are the refusal's own, never `storageKey` — the assembler builds
          its prompt from `storageKey` and cannot see these, which is what makes
          an uncertified picture safe to keep at all.
        */
        /*
          THE NUMBER ON THE ROW IS THE ONE THAT REFUSED IT.

          Two instruments live at the door and they read the same two masks in
          different units (§2.4c). `judged` is present whenever one of them
          reached a verdict, and it carries its own reading — so a `brokenOutline`
          row records the centreline percentage that turned the crop away, not the
          area percentage that had already declined to judge it. Where no
          instrument adjudicated (the structural refusals), the area reading is
          still the honest thing to record: it is what was measured.
        */
        const refused = verdict.judged?.coverage ?? verdict.reading?.coverage;
        const refusal: ReferenceRowToRecord["refusal"] = {
          reason: verdict.reason,
          kind: verdict.kind,
          ...(refused === undefined ? {} : { coverage: bp(refused) }),
        };
        if (refusalKeepsItsCrop(verdict.reason)) {
          const refusedContentKey = `${LIBRARY_KEY_PREFIX}/${randomUUID()}-refused.png`;
          const refusedMaskKey = `${LIBRARY_KEY_PREFIX}/${randomUUID()}-refused-mask.png`;
          /* Onto the same plan as a stored crop, so it goes onto the same
             manifest before any byte is written and is discharged by the same
             insert. A refused crop written outside that order is a piece of a
             face at a URL no row knows about. */
          planned.push({ cut, contentKey: refusedContentKey, maskKey: refusedMaskKey });
          refusal.crop = {
            contentKey: refusedContentKey,
            maskKey: refusedMaskKey,
            /* The box, because the mask is written at the box's own size — the
               refused pixels are meant to be looked at ON her frame, and this
               is the only thing that can put them back there. */
            geometry: { bbox: cut.box, frame: cut.frame },
          };
        }
        /*
          AND A DISPUTED SLOT WITH NOTHING TO SHOW WRITES NO ROW AT ALL.

          Reached when the guard refused it for one of the three reasons that
          come BEFORE the dispute: the frame does not wear the thing, the read
          did not settle, or another slot already holds these exact bytes. In
          each of those there is no crop worth a human's time, and the words
          would be a version bump for a delivery this render's own reader
          disputed. So the library is left exactly as this render found it —
          which is what it does today for every disputed facet — and the refusal
          is in the log line above rather than on a row.
        */
        if (slot.disputed && !refusal.crop) {
          disputedNothingKept(slot, verdict.reason, verdict.detail);
          continue;
        }
        rows.push({
          role: "carry",
          slot: slot.slot,
          tier: slot.tier,
          noun: slot.noun,
          words: said,
          refusal,
        });
        outcomes.push(slot.disputed
          ? {
            slot: slot.slot,
            outcome: "disputed",
            kept: true,
            coverage: verdict.reading?.coverage ?? 0,
          }
          : {
            slot: slot.slot,
            outcome: "words-only",
            reason: "guardRefused",
            detail: verdict.detail,
            ...(refusal.crop ? { keptForAdoption: true as const } : {}),
          });
        continue;
      }

      /*
        UNREACHABLE BY CONSTRUCTION, and it throws rather than storing.

        `guardReference` returns `disputedDelivery` before it consults any
        threshold, so a disputed slot cannot arrive here. If a later edit
        reorders that, the failure would be silent and expensive — an unverified
        delivery quietly becoming what the next render KNOWS this feature is. A
        throw costs this render its references and costs the user nothing (the
        catch below keeps the picture), which is the right side to fail on. The
        ordering itself is pinned exhaustively at the guard, where it can be
        driven; this line only refuses to be the place it goes wrong.
      */
      if (slot.disputed && !slot.adjudicated) {
        throw new Error(`${slot.slot}'s delivery was disputed and the guard passed it; a disputed crop may never enter the library`);
      }

      const contentKey = `${LIBRARY_KEY_PREFIX}/${randomUUID()}.png`;
      const maskKey = `${LIBRARY_KEY_PREFIX}/${randomUUID()}-mask.png`;
      digests.set(slot.slot, digest);
      planned.push({ cut, contentKey, maskKey });
      rows.push({
        role: "carry",
        slot: slot.slot,
        tier: slot.tier,
        noun: slot.noun,
        words: said,
        image: {
          storageKey: contentKey,
          maskKey,
          digest,
          geometry: { bbox: cut.box, frame: cut.frame },
          guard: {
            kind: verdict.kind,
            /* From the adjudication, unconditionally: the reading and the bar
               are the deciding instrument's own, so they are comparable to each
               other on the row. `spill` stays the area figure because it is
               instrument-independent — it says the crop strayed outside its
               region, which is true in whatever units the verdict was reached. */
            coverage: bp(verdict.judged.coverage),
            spill: bp(verdict.reading.spill),
            threshold: bp(verdict.judged.threshold),
          },
        },
      });
      outcomes.push({
        slot: slot.slot,
        outcome: "stored",
        coverage: verdict.reading.coverage,
        ...(slot.adjudicated ? { adjudicated: true as const } : {}),
        /* From the verdict, unchanged: the guard is the only thing that knows
           whether a bar divided this crop, and after this line nothing can
           recover it from the row. */
        ...(verdict.ceilingAccepted ? { ceilingAccepted: true as const } : {}),
      });
    }

    const ratchet = span === null ? {} : { build: span };
    /* A dispute that was adjudicated is on the record even when the render
       filed no row at all — a decline is exactly as much of a reading as a
       settlement, and it is the half that says how often the ruler cannot
       help. */
    const courtRecord = adjudications.length === 0 ? {} : { adjudications };
    if (rows.length === 0) {
      return { outcome: "nothing-to-keep", slots: outcomes, ...ratchet, ...courtRecord };
    }

    /*
      THE MANIFEST BEFORE THE BYTES. The crop and its mask go to permanently
      public keys, and nothing references them until the rows commit — so a
      crash in between would strand pieces of a person's face at URLs no row
      knows about. The manifest is registered first and discharged as the last
      statement of the insert, which means the failure path collects itself.
    */
    let cleanupBatchId: string | undefined;
    if (planned.length > 0) {
      cleanupBatchId = randomUUID();
      await manifest({
        id: cleanupBatchId,
        userId: input.userId,
        storageKeys: planned.flatMap(({ contentKey, maskKey }) => [contentKey, maskKey]),
      });
      for (const { cut, contentKey, maskKey } of planned) {
        const encoded = await encodedFor(cut);
        await store({ key: contentKey, bytes: encoded.content, contentType: "image/png" });
        await store({ key: maskKey, bytes: encoded.mask, contentType: "image/png" });
      }
    }

    const recorded = await record({
      userId: input.userId,
      variantId: input.variantId,
      candidateId: input.candidateId,
      rows,
      cleanupBatchId,
    });

    log.info(
      {
        userId: input.userId,
        variantId: input.variantId,
        operationId: input.operationId,
        minted: recorded.map((row) => `${row.slot}@v${row.version}`),
        refused: outcomes.filter((slot) => slot.outcome === "words-only" && slot.reason === "guardRefused")
          .map((slot) => slot.slot),
        /* The ones whose pixels are now sitting somewhere a human can open
           them. This is the line an adoption sitting starts from. */
        keptForAdoption: outcomes
          .filter((slot) => slot.outcome === "words-only" && slot.keptForAdoption)
          .map((slot) => slot.slot),
        /*
          THE CROPS NO BAR DIVIDED — §2.4b's ceiling acceptance, named per slot.

          fable-306's clause promised this mark so a later count of bar-measured
          specimens could not silently include them, and until this line the mark
          existed only on an in-process verdict that nothing read. It cannot go
          on the row (the row keeps no instrument; see `MintedSlot`), so it goes
          where the render's other declared costs go. It matters more since step
          3: EVERY open kind that carries is a ceiling acceptance, because an
          open kind has no specimen family for a bar to be drawn from.
        */
        ceilingAccepted: outcomes
          .filter((slot) => slot.outcome === "stored" && slot.ceilingAccepted)
          .map((slot) => slot.slot),
        /* THE DISPUTED FACETS AND WHAT THEY COST, declared rather than implied
           (fable-220 §3, condition 2). `disputedReads` is one vision call each,
           spent on slots this render will file nothing for unless the crop is
           kept — so the line says what was bought and what it bought. */
        disputedReads,
        /* AND WHAT THE GROUND COST, on a render that brought no map of its own.
           Zero on every render that did — which is every render on the old road
           — so a non-zero here is the repaint paying its declared price. */
        groundReads,
        /* AND WHAT THE ABSENCE CONTROL COST — one read on the before-picture
           per open kind that cut a crop (§4, step 3). Zero on every render of
           a face nobody has asked an out-of-vocabulary question about, which
           today is every render in production. */
        absenceReads,
        /* AND WHAT THE COMPOSER COST — two reads on the delivered frame per
           derived slot, spent only on a face that has a build to keep. Zero on
           every render of a face nobody has body-edited, which is most of them. */
        derivedReads,
        /*
          THE RATCHET'S READING (fable-424 §4).

          `build`'s crop is re-cut from the frame in hand on every delivered
          render, and the one honest worry with that is compounding: an un-asked
          per-render wobble riding forward because the crop tracks the newest
          frame rather than the paid one. The word stack re-says the bought state
          every render and SHOULD bound it — this line is what turns that claim
          into a distribution somebody can read across an edit chain. `clipped`
          rides with it because a saturated span is not a build.
        */
        ...(span === null ? {} : {
          build: {
            ratio: Number(span.ratio.toFixed(4)),
            spanPx: span.spanPx,
            headPx: span.headPx,
            atRow: Number(span.atRow.toFixed(4)),
            clipped: span.clipped,
          },
        }),
        /* AND WHAT THE WORDS COST — one read per filed slot, the declared price
           of a slot's words describing the object at that site rather than a
           sentence about her whole face. Zero when nothing wired a reader. */
        wordReads,
        /* The slots nothing could be said about, so nothing was filed and their
           newest existing row keeps carrying. An accessory with no cut is
           `noCut`; a read that came back empty is `readFailedSoft`. */
        unread: outcomes
          .filter((slot): slot is Extract<MintedSlot, { outcome: "unread" }> => slot.outcome === "unread")
          .map((slot) => `${slot.slot}:${slot.reason}`),
        disputedKept: outcomes
          .filter((slot) => slot.outcome === "disputed" && slot.kept)
          .map((slot) => slot.slot),
        disputedNothingKept: outcomes
          .filter((slot): slot is Extract<MintedSlot, { outcome: "disputed"; kept: false }> => (
            slot.outcome === "disputed" && !slot.kept
          ))
          .map((slot) => `${slot.slot}:${slot.reason}`),
        /*
          AND WHERE A RULER WAS ASKED (fable-429 §3), with BOTH verdicts and the
          two reads it cost.

          Settled and declined alike: the disagreement between a reader and a
          calibrated instrument is a distribution this program wants, and one
          that logged only its wins would report a reader that is never wrong.
          `anchorReads` is the price — two on the anchor frame, bought only
          where the court could actually answer.
        */
        ...(adjudications.length === 0 ? {} : {
          adjudicated: adjudications.map((entry) => (
            entry.verdict.settled
              ? `${entry.slot}:${entry.instrument}:settled@${(entry.verdict.change * 100).toFixed(1)}%`
              : `${entry.slot}:${entry.instrument}:declined:${entry.verdict.declined}`
          )),
          anchorReads,
        }),
      },
      "[library] minted this render's references",
    );
    return {
      outcome: "stored",
      slots: outcomes,
      ...ratchet,
      ...courtRecord,
    };
  } catch (error) {
    /*
      Anything written is still on the manifest, because the discharge is the
      last statement of the row insert. The picture stands; the face keeps no
      new reference this render.
    */
    log.error(
      { err: error, userId: input.userId, variantId: input.variantId, operationId: input.operationId },
      "[library] this render's references were not minted — the picture stands",
    );
    return { outcome: "failed", slots: [] };
  }
}
