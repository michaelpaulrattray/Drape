/**
 * Keeping the pixels a render earned — the write half of segment permanence.
 *
 * This is the step that turns a delivered facet from a sentence the next render
 * has to re-roll into an object the compositor pastes. It runs AFTER the
 * variant has landed, and it is deliberately the least important thing in the
 * request: the picture is already delivered and already paid for, so nothing
 * here may take it back.
 *
 * # Three orderings, each load-bearing
 *
 * 1. **The manifest before the bytes.** The mask and the crop go to permanently
 *    public keys, and nothing references them until the rows commit. A crash in
 *    between would leave pieces of a person's face at URLs no row knows about.
 *    The keys are handed to the cleanup worker BEFORE they exist, in their own
 *    committed transaction, and the row insert discharges that manifest as its
 *    last act — the same shape the variant landing uses one surface up.
 * 2. **The rows after the bytes.** A row pointing at an object that was never
 *    written is a record that lies, and the compositor would refuse a segment
 *    it cannot fetch on every later render.
 * 3. **Failure is silent to the user and loud in the log.** If any of this
 *    fails, the delivered picture stands; the facet simply keeps no pixels, and
 *    the next render treats it exactly as it does today — with words. Charging
 *    a person a second time, or refusing a render they can already see, because
 *    a mask did not upload is not a trade this product makes.
 */
import { randomUUID } from "node:crypto";

import { withTransaction } from "../db/connection";
import { createStorageCleanupManifestIn } from "../db/storageCleanup";
import { recordEditPatchSegments, type RecordedSegment } from "../db/castingV2Segments";
import { storagePut } from "../storage";
import { createModuleLogger } from "../logging/logger";
import { encodeCut, cutSegments, type SegmentCut } from "./segmentCuts";
import { captureCastingSegmentsEnabled } from "./castingV2Scope";
import { readRaster, type Mask } from "./maskedComposite";
import { regionNameOf } from "./maskedRefine";
import type { Facet } from "./refineFacets";

const log = createModuleLogger("castingV2/segmentPersistence");

/** One prefix, so an operator can see every segment object in one place. */
export const SEGMENT_KEY_PREFIX = "casting-v2/segments";

export type SegmentPersistenceDependencies = {
  store?: (input: { key: string; bytes: Buffer; contentType: string }) => Promise<{ key: string }>;
  record?: typeof recordEditPatchSegments;
  /** The flag read, injectable so a test can drive both sides of it. */
  enabledFor?: (userId: number) => boolean;
};

export type SegmentPersistenceResult = {
  /** `off` — the store is dark for this user, and nothing was attempted. */
  outcome: "stored" | "off" | "nothing-to-keep" | "failed";
  segments: RecordedSegment[];
};

async function defaultStore(input: { key: string; bytes: Buffer; contentType: string }) {
  return storagePut(input.key, input.bytes, input.contentType);
}

/**
 * The product path: take a landed render and keep what it earned.
 *
 * Everything expensive is behind the flag check — a dark deployment does not
 * decode a frame, does not touch storage, and does not open a transaction. The
 * evidence it cuts from is the harvest's OWN masks, kept rather than
 * re-derived, so this costs no vision call and cannot drift from the composite
 * it describes.
 */
export async function keepSegmentsFromRender(input: {
  userId: number;
  variantId: number;
  /** The delivered frame, with the composite's own working attached. */
  image: {
    bytes: Buffer;
    evidence?: { applied: Mask; masterRegions: ReadonlyMap<string, Mask> } | null;
  };
  /** The facets this render answered — the same set the harvest cut for. */
  facets: readonly Facet[];
  /** Where a facet lives when the facet alone does not say — the harvest's map. */
  regionOverrides?: Readonly<Partial<Record<Facet, string>>>;
  verdict?: string | null;
  verifiedAt?: Date | null;
  operationId?: string;
  dependencies?: SegmentPersistenceDependencies;
}): Promise<SegmentPersistenceResult> {
  const enabled = input.dependencies?.enabledFor ?? captureCastingSegmentsEnabled;
  if (!enabled(input.userId)) return { outcome: "off", segments: [] };

  /*
    No evidence means no composite happened — the masked path was off for this
    render, or it found no region. There is nothing to keep, and inventing a
    segment from the whole frame would file the entire face as one facet's
    property.
  */
  if (!input.image.evidence) return { outcome: "nothing-to-keep", segments: [] };

  try {
    const facetRegions = new Map<string, string>();
    for (const facet of input.facets) {
      /* The harvest's own answer, not a second derivation of it — the crop is
         keyed by region name, so a store that placed `makeup` differently from
         the harvest would look up a mask that is not there and file nothing. */
      const region = input.regionOverrides?.[facet] ?? regionNameOf(facet);
      if (region) facetRegions.set(facet, region);
    }
    if (facetRegions.size === 0) return { outcome: "nothing-to-keep", segments: [] };

    const composite = await readRaster(input.image.bytes);
    const cuts = cutSegments({
      composite,
      applied: input.image.evidence.applied,
      facetRegions,
      regionMasks: input.image.evidence.masterRegions,
    });

    return await persistSegmentsForVariant({
      userId: input.userId,
      variantId: input.variantId,
      cuts,
      verdict: input.verdict,
      verifiedAt: input.verifiedAt,
      operationId: input.operationId,
      dependencies: input.dependencies,
    });
  } catch (error) {
    log.error(
      { err: error, userId: input.userId, variantId: input.variantId, operationId: input.operationId },
      "[segments] this render could not be cut into segments — the picture stands",
    );
    return { outcome: "failed", segments: [] };
  }
}

/**
 * File every facet this render earned, or none of them.
 *
 * Never throws. The caller is a landed, paid render; the worst outcome
 * available here is that permanence did not happen this time, and that is a log
 * line rather than an error the user meets.
 */
export async function persistSegmentsForVariant(input: {
  userId: number;
  variantId: number;
  cuts: readonly SegmentCut[];
  /** The reading that earned these pixels, carried onto every row. */
  verdict?: string | null;
  verifiedAt?: Date | null;
  /** For the log line, so a segment can be traced to its operation. */
  operationId?: string;
  dependencies?: SegmentPersistenceDependencies;
}): Promise<SegmentPersistenceResult> {
  const enabled = input.dependencies?.enabledFor ?? captureCastingSegmentsEnabled;
  if (!enabled(input.userId)) return { outcome: "off", segments: [] };
  if (input.cuts.length === 0) return { outcome: "nothing-to-keep", segments: [] };

  const store = input.dependencies?.store ?? defaultStore;
  const record = input.dependencies?.record ?? recordEditPatchSegments;

  try {
    const planned = input.cuts.map((cut) => ({
      cut,
      maskKey: `${SEGMENT_KEY_PREFIX}/${randomUUID()}-mask.png`,
      contentKey: `${SEGMENT_KEY_PREFIX}/${randomUUID()}-content.png`,
    }));

    /*
      A synthetic operation id, like the retention sweep's: the column is NOT
      NULL and unique, the variant landing already holds the real operation's
      batch, and inventing a second batch under the same operation id would
      collide with it. This work is not a user operation.
    */
    const cleanupBatchId = randomUUID();
    await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
      id: cleanupBatchId,
      userId: input.userId,
      operationId: randomUUID(),
      kind: "casting_candidate_cleanup",
      storageItems: planned.flatMap(({ maskKey, contentKey }) => [
        { storageKey: maskKey, storageBackend: "public_r2" as const },
        { storageKey: contentKey, storageBackend: "public_r2" as const },
      ]),
    }));

    const patches = [];
    for (const { cut, maskKey, contentKey } of planned) {
      const encoded = await encodeCut(cut);
      await store({ key: maskKey, bytes: encoded.mask, contentType: "image/png" });
      await store({ key: contentKey, bytes: encoded.content, contentType: "image/png" });
      patches.push({
        facet: cut.facet,
        region: cut.region,
        maskKey,
        contentKey,
        geometry: { bbox: cut.box, frame: cut.frame },
      });
    }

    const segments = await record({
      userId: input.userId,
      variantId: input.variantId,
      patches,
      cleanupBatchId,
      verdict: input.verdict ?? null,
      verifiedAt: input.verifiedAt ?? null,
    });

    log.info(
      {
        userId: input.userId,
        variantId: input.variantId,
        operationId: input.operationId,
        facets: segments.map((segment) => `${segment.facet}@v${segment.version}`),
        retired: segments.reduce((total, segment) => total + segment.retired, 0),
      },
      "[segments] kept this render's pixels",
    );
    return { outcome: "stored", segments };
  } catch (error) {
    /*
      The objects, if any were written, are still on the manifest — the
      discharge is the last statement of the row insert, so a failure anywhere
      before it leaves the cleanup worker holding them. That is the whole point
      of registering first: the failure path collects itself.
    */
    log.error(
      { err: error, userId: input.userId, variantId: input.variantId, operationId: input.operationId },
      "[segments] this render's pixels were not kept — the picture stands, the facet keeps no segment",
    );
    return { outcome: "failed", segments: [] };
  }
}
