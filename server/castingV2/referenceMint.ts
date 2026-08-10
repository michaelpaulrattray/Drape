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
import { mintGuardedReference, type RegionReader } from "./referenceCompleteness";
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
  /** The segmentation question that names this slot's region on a frame. */
  question: string;
  /** The completeness specimen family whose threshold applies (`hair`, `lips`). */
  guardKind: string;
};

export type MintedSlot =
  | { slot: FeatureSlot; outcome: "stored"; coverage: number }
  | {
    slot: FeatureSlot;
    outcome: "words-only";
    /** `surface` — the tier never mints a crop. `noRegion` — this render has no
     *  evidence about the slot. `guardRefused` — a crop was cut and turned away. */
    reason: "surface" | "noRegion" | "guardRefused";
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
    const cuttable = input.slots.filter((slot) => slot.tier !== "surface");
    for (const slot of input.slots) {
      if (slot.tier !== "surface") continue;
      rows.push({ role: "carry", slot: slot.slot, tier: slot.tier, noun: slot.noun, words: slot.words });
      outcomes.push({ slot: slot.slot, outcome: "words-only", reason: "surface" });
    }

    const frame = await readRaster(input.frame.bytes);
    const cuts = cuttable.length === 0 ? [] : cutSegments({
      composite: frame,
      applied: input.applied ?? wholeFrame(frame.width, frame.height),
      facetRegions: new Map(cuttable.map((slot) => [slot.slot, slot.question])),
      regionMasks: input.masterRegions,
      deliveredMasks: input.deliveredRegions ?? null,
    });
    const cutBySlot = new Map(cuts.map((cut) => [cut.facet, cut]));

    /* Digests already spoken for, so a byte-identical crop is caught whether it
       arrived this render or three renders ago. */
    const digests = new Map(input.knownDigests ?? []);

    for (const slot of cuttable) {
      const cut = cutBySlot.get(slot.slot);
      if (!cut) {
        /* No evidence about this slot on this frame. Not a failure: the words
           still record, and the next render treats it exactly as today. */
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
        frame: input.frame.bytes,
        crop: { mask: cut.mask, box: cut.box },
        digest,
        mintedDigests: digests,
      }, read);

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
        rows.push({ role: "carry", slot: slot.slot, tier: slot.tier, noun: slot.noun, words: slot.words });
        outcomes.push({
          slot: slot.slot,
          outcome: "words-only",
          reason: "guardRefused",
          detail: verdict.detail,
        });
        continue;
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
            coverage: bp(verdict.reading.coverage),
            spill: bp(verdict.reading.spill),
            threshold: bp(verdict.threshold),
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
