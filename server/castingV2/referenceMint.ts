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
 * Two sources, and no third (fable-173, on D-243's audit):
 *
 *   born anatomy    a fresh full region read on the MASTER
 *   edit-carried    the delivered-anchored cut on the DELIVERED frame,
 *                   `applied ∩ (region(delivered) ∪ region(master))`
 *
 * `casting_segments` is not consulted, re-cut or superseded. Its rows are the
 * undo store and they are correct there.
 *
 * # The guard is the door, and it is a SECOND read
 *
 * A crop does not enter the library because it was produced; it enters because
 * an independent read of its own region on its own frame confirms it contains
 * its subject. The reader is injected into `mintGuardedReference`, so this
 * module cannot hand the guard the same mask that cut the crop — the checker
 * that cannot fail is unreachable rather than merely avoided. It costs one
 * vision call per reference, and that is the declared price of the founder's
 * fringe never entering the library again.
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
import { createStorageCleanupManifestIn } from "../db/storageCleanup";
import {
  recordReferenceRows,
  type ReferenceRowToRecord,
} from "../db/castingV2ReferenceLibrary";
import { storagePut } from "../storage";
import { createModuleLogger } from "../logging/logger";
import { captureCastingReferenceLibraryEnabled } from "./castingV2Scope";
import { cutSegments, encodeCut, type SegmentCut } from "./segmentCuts";
import { readRaster, type Mask } from "./maskedComposite";
import type { SideRegions } from "./maskedRefine";
import {
  mintGuardedReference,
  refusalKeepsItsCrop,
  type GuardRefusalReason,
  type RegionReader,
} from "./referenceCompleteness";
import { parseSlot, type Instance, type SlotFrame } from "./referenceSlots";
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
   *  Null exactly when {@link SlotSpec.question} is. */
  guardKind: string | null;
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
};

/** Why a disputed slot kept no pixels: the guard's own refusal, or the reason
 *  no crop was ever cut for it. */
export type DisputedNothingKept =
  | GuardRefusalReason
  | "surface" | "noQuestion" | "noSide" | "noRegion";

export type MintedSlot =
  | { slot: FeatureSlot; outcome: "stored"; coverage: number }
  | {
    slot: FeatureSlot;
    outcome: "words-only";
    /** `surface` — the tier never mints a crop. `noQuestion` — no segmentation
     *  question names this slot, so there is nothing honest to cut. `noSide` —
     *  the slot is one of a pair and this render has no read of its side alone.
     *  `noRegion` — this render has no evidence about the slot. `guardRefused` —
     *  a crop was cut and turned away. */
    reason: "surface" | "noQuestion" | "noSide" | "noRegion" | "guardRefused";
    detail?: string;
    /** The refused crop's pixels were kept for a human to look at — true for the
     *  two refusals a human settles rather than an instrument. */
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
  };

export type MintResult = {
  outcome: "stored" | "off" | "nothing-to-keep" | "failed";
  slots: MintedSlot[];
};

export type MintDependencies = {
  /** The guard's independent read. Required in production; injected in tests. */
  read?: RegionReader;
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
  /** For the log line, so a reference can be traced to its operation. */
  operationId?: string;
  dependencies?: MintDependencies;
};

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
    kind: "casting_candidate_cleanup",
    storageItems: input.storageKeys.map((storageKey) => ({
      storageKey,
      storageBackend: "public_r2" as const,
    })),
  }));
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
    }> = [];
    /** Per-side slots with no side to cut from, with the reason each one is out. */
    const sideless: Array<{ slot: SlotSpec; detail: string }> = [];

    for (const slot of input.slots) {
      if (slot.tier === "surface") continue;
      if (slot.question === null || slot.guardKind === null) continue;
      const { question, guardKind } = slot;
      if (slot.frame !== "ownSide") {
        cuttable.push({ ...slot, question, guardKind, regionKey: question, side: null });
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
      const sides = input.masterSideRegions?.get(question) ?? null;
      if (!sides) {
        sideless.push({
          slot,
          detail: `"${question}" was not read one side at a time on this render, so a crop of it filed as ${slot.noun} would contain the other one too`,
        });
        continue;
      }

      const key = sideKey(question, side);
      regionsToCut.set(key, sides[side]);
      const delivered = input.deliveredSideRegions?.get(question);
      if (delivered) deliveredToCut.set(key, delivered[side]);
      cuttable.push({ ...slot, question, guardKind, regionKey: key, side });
    }
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

    for (const slot of input.slots) {
      if (slot.tier !== "surface") continue;
      if (slot.disputed) {
        disputedNothingKept(slot, "surface");
        continue;
      }
      rows.push({ role: "carry", slot: slot.slot, tier: slot.tier, noun: slot.noun, words: slot.words });
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
      if (slot.question !== null && slot.guardKind !== null) continue;
      if (slot.disputed) {
        disputedNothingKept(
          slot,
          "noQuestion",
          "no segmentation question names this slot, so there is nothing to cut and nothing a human could settle",
        );
        continue;
      }
      rows.push({ role: "carry", slot: slot.slot, tier: slot.tier, noun: slot.noun, words: slot.words });
      outcomes.push({
        slot: slot.slot,
        outcome: "words-only",
        reason: "noQuestion",
        detail: "no segmentation question names this slot, so there is nothing honest to cut",
      });
    }
    for (const { slot, detail } of sideless) {
      if (slot.disputed) {
        disputedNothingKept(slot, "noSide", detail);
        continue;
      }
      rows.push({ role: "carry", slot: slot.slot, tier: slot.tier, noun: slot.noun, words: slot.words });
      outcomes.push({ slot: slot.slot, outcome: "words-only", reason: "noSide", detail });
    }

    const frame = await readRaster(input.frame.bytes);
    const cuts = cuttable.length === 0 ? [] : cutSegments({
      composite: frame,
      applied: input.applied ?? wholeFrame(frame.width, frame.height),
      facetRegions: new Map(cuttable.map((slot) => [slot.slot, slot.regionKey])),
      regionMasks: regionsToCut,
      deliveredMasks: deliveredToCut.size > 0 ? deliveredToCut : null,
    });
    const cutBySlot = new Map(cuts.map((cut) => [cut.facet, cut]));

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
        if (slot.disputed) {
          disputedNothingKept(slot, "noRegion");
          continue;
        }
        rows.push({ role: "carry", slot: slot.slot, tier: slot.tier, noun: slot.noun, words: slot.words });
        outcomes.push({ slot: slot.slot, outcome: "words-only", reason: "noRegion" });
        continue;
      }

      const encoded = await encodeCut(cut);
      const digest = digestOf(encoded.content);
      if (!read) throw new Error("the completeness guard has no reader, and a crop may not enter the library unread");
      const verdict = await mintGuardedReference({
        kind: slot.guardKind,
        question: slot.question,
        /*
          AND THE GUARD IS ASKED THE SAME NARROW QUESTION THE CROP ANSWERS.

          A per-side crop scored against a read of both sides measures about half
          of a region it entirely contains — a refusal with a number nobody
          earned, which is exactly how a kind acquires a specimen it should not
          have. The reader that cannot scope to a side returns nothing, and
          nothing is `readDidNotSettle`: no pass, and no number either.
        */
        ...(slot.side === null ? {} : { side: slot.side }),
        frame: input.frame.bytes,
        crop: { mask: cut.mask, box: cut.box },
        digest,
        mintedDigests: digests,
        /* The guard owns the precedence: the three refusals about whether this
           is a real, unique picture of the subject come FIRST, and a dispute
           only ever displaces a completeness verdict. */
        ...(slot.disputed ? { disputed: true } : {}),
      }, read);
      if (slot.disputed) disputedReads += 1;

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

          Every refusal records what happened at the door: which of the six it
          was, the specimen family it was judged against, and the number it read
          if a reading happened. That is the difference between "this slot has
          words" and "this slot has words BECAUSE its crop was turned away for
          this reason at this coverage" — and it is the difference between
          buying a render to find out and reading the row.

          Two of them keep the crop as well, and both for the same reason: they
          are the refusals only a HUMAN can settle. `noSpecimen` exists in order
          to produce the specimen — the kind has no measured positive, so no
          number here is earned. `disputedDelivery` exists to settle whether the
          painter or the reader was wrong, which no instrument in this system can
          decide. The keys are the refusal's own, never `storageKey` — the
          assembler builds its prompt from `storageKey` and cannot see these,
          which is what makes an uncertified picture safe to keep at all.
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
          words: slot.words,
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
      if (slot.disputed) {
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
        words: slot.words,
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
      outcomes.push({ slot: slot.slot, outcome: "stored", coverage: verdict.reading.coverage });
    }

    if (rows.length === 0) return { outcome: "nothing-to-keep", slots: outcomes };

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
        const encoded = await encodeCut(cut);
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
        /* THE DISPUTED FACETS AND WHAT THEY COST, declared rather than implied
           (fable-220 §3, condition 2). `disputedReads` is one vision call each,
           spent on slots this render will file nothing for unless the crop is
           kept — so the line says what was bought and what it bought. */
        disputedReads,
        disputedKept: outcomes
          .filter((slot) => slot.outcome === "disputed" && slot.kept)
          .map((slot) => slot.slot),
        disputedNothingKept: outcomes
          .filter((slot): slot is Extract<MintedSlot, { outcome: "disputed"; kept: false }> => (
            slot.outcome === "disputed" && !slot.kept
          ))
          .map((slot) => `${slot.slot}:${slot.reason}`),
      },
      "[library] minted this render's references",
    );
    return { outcome: "stored", slots: outcomes };
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
