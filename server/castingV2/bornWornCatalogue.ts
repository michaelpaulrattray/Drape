/**
 * FILING WHAT THE PICTURE SAYS SHE ALREADY HAS — the born-worn catalogue's
 * write path (segment permanence, slice 1).
 *
 * `bornWornDetector.ts` reads the master; this decides what becomes a row. It
 * is the patch writer's sibling and deliberately shares its three orderings —
 * manifest before bytes, rows after bytes, failure silent to her and loud in
 * the log — because the harm they prevent is identical: pieces of a person's
 * face at permanently public URLs with nothing left that knows they exist.
 *
 * # What is different from a patch, and why
 *
 * A patch is evidence of a delivered render, so it is written after a landing
 * and carries the verdict that earned it. A detected row is evidence of nothing
 * anybody asked for: it is the master, described. So it is written from the
 * master alone, it carries no verdict (the writer refuses to give it one), and
 * it may run at any time — including a second and third time.
 *
 * # The re-scan is free, and that is the point
 *
 * fable-085: the catalogue must be re-runnable, because detectors improve. A
 * re-run by the SAME detector on the SAME master can learn nothing, so it is
 * skipped BEFORE the vision call rather than after it — the cheap half of
 * idempotency, in front of the only expensive thing here. A better detector
 * arrives with a new name, finds its class unheld, and files the next version
 * over its predecessor. The old row keeps its bytes and its name, so what the
 * worse detector believed stays readable.
 */
import { randomUUID } from "node:crypto";

import {
  createStorageCleanupManifestIn,
  storageCleanupManifestHeldUntil,
} from "../db/storageCleanup";
import { withTransaction } from "../db/connection";
import {
  listLiveSegments,
  recordDetectedSegments,
  type RecordedSegment,
  type StoredSegment,
} from "../db/castingV2Segments";
import { createModuleLogger } from "../logging/logger";
import { storagePut } from "../storage";
import {
  BORN_WORN_CLASSES,
  BORN_WORN_DETECTOR,
  catalogueCanFile,
  detectBornWorn,
  type BornWornClass,
} from "./bornWornDetector";
import { captureCastingSegmentsEnabled } from "./castingV2Scope";
import { readRaster, type Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";
import { cutSegments, encodeCut } from "./segmentCuts";
import { SEGMENT_KEY_PREFIX } from "./segmentPersistence";

const log = createModuleLogger("castingV2/bornWornCatalogue");

export type BornWornCatalogueDependencies = {
  store?: (input: { key: string; bytes: Buffer; contentType: string }) => Promise<{ key: string }>;
  record?: typeof recordDetectedSegments;
  list?: typeof listLiveSegments;
  enabledFor?: (userId: number) => boolean;
  classes?: readonly BornWornClass[];
  detector?: string;
};

export type BornWornCatalogueResult = {
  outcome:
    | "catalogued"
    /** The store is dark for this user — nothing was asked and nothing spent. */
    | "off"
    /** This detector already holds every armed class on this master. */
    | "already-catalogued"
    /** Asked, answered, and she is wearing none of them. */
    | "nothing-found"
    | "failed";
  segments: RecordedSegment[];
  /** Detections dropped before filing, with the reason — never silent. */
  excluded: Array<{ facet: string; reason: "frameMismatch" | "emptyCut"; detail: string }>;
};

async function defaultStore(input: { key: string; bytes: Buffer; contentType: string }) {
  return storagePut(input.key, input.bytes, input.contentType);
}

/** A mask claiming the whole frame — the "applied" a fact stands on. */
function wholeFrame(width: number, height: number): Mask {
  return { data: Buffer.alloc(width * height, 255), width, height };
}

/**
 * Catalogue one master.
 *
 * Never throws. The worst outcome available here is that this face has no
 * catalogue yet, which costs the product a list and costs the customer nothing
 * — and a detector that can fail a cast is a detector that can lose a picture
 * because a segmenter had a bad minute.
 */
export async function catalogueBornWorn(input: {
  userId: number;
  candidateId: number;
  /** The master frame — the record of what she was born with. */
  master: Buffer;
  reader: RegionReader;
  dependencies?: BornWornCatalogueDependencies;
}): Promise<BornWornCatalogueResult> {
  const enabled = input.dependencies?.enabledFor ?? captureCastingSegmentsEnabled;
  if (!enabled(input.userId)) return { outcome: "off", segments: [], excluded: [] };

  const detector = input.dependencies?.detector ?? BORN_WORN_DETECTOR;
  const list = input.dependencies?.list ?? listLiveSegments;
  const store = input.dependencies?.store ?? defaultStore;
  const record = input.dependencies?.record ?? recordDetectedSegments;
  const catalogue = input.dependencies?.classes ?? BORN_WORN_CLASSES;

  try {
    /*
      The idempotency read, in front of the vision call. A class this detector
      already holds live on this candidate is a question whose answer cannot
      have changed: the master is immutable, and the detector is the same one
      that read it.
    */
    const existing: StoredSegment[] = await list({ userId: input.userId, candidateId: input.candidateId });
    const held = new Set(
      existing
        .filter((row) => row.provenance === "detected_born" && row.detector === detector)
        .map((row) => row.facet),
    );
    /*
      `catalogueCanFile` is asked here as well as inside the detector, and it is
      not a second copy of the rule — it is the same predicate, read for a
      different purpose. The detector refuses to READ a class it cannot file;
      this decides what this candidate still WANTS, and a class that can never
      be filed must not sit in that list or every re-run reports work outstanding
      on a master it has finished with.
    */
    const wanted = catalogue.filter((entry) => entry.armed && catalogueCanFile(entry) && !held.has(entry.id));
    if (wanted.length === 0) {
      return { outcome: "already-catalogued", segments: [], excluded: [] };
    }

    const scan = await detectBornWorn({ image: input.master, reader: input.reader, classes: wanted });
    if (scan.detections.length === 0) {
      log.info(
        {
          userId: input.userId,
          candidateId: input.candidateId,
          detector,
          absent: scan.absent.map((entry) => entry.facet),
          failed: scan.failed.map((entry) => entry.facet),
        },
        "[born-worn] nothing armed was found on this master",
      );
      return { outcome: "nothing-found", segments: [], excluded: [] };
    }

    const master = await readRaster(input.master);
    const excluded: BornWornCatalogueResult["excluded"] = [];
    const regionMasks = new Map<string, Mask>();
    const facetRegions = new Map<string, string>();
    for (const detection of scan.detections) {
      if (detection.mask.width !== master.width || detection.mask.height !== master.height) {
        /*
          NEVER RESIZE A MASK TO FIT. A mask measured against a different frame
          does not fail when pasted or cropped — it silently names the wrong
          part of her face, which is the worst thing this store could record.
          Same refusal the assembly makes for a frame-mismatched segment.
        */
        log.error(
          {
            userId: input.userId,
            candidateId: input.candidateId,
            facet: detection.facet,
            mask: `${detection.mask.width}x${detection.mask.height}`,
            frame: `${master.width}x${master.height}`,
          },
          "[born-worn] a detection was measured against a different frame — not filed, never resized",
        );
        excluded.push({
          facet: detection.facet,
          reason: "frameMismatch",
          detail: `${detection.mask.width}x${detection.mask.height} against ${master.width}x${master.height}`,
        });
        continue;
      }
      regionMasks.set(detection.region, detection.mask);
      facetRegions.set(detection.facet, detection.region);
    }
    if (facetRegions.size === 0) return { outcome: "nothing-found", segments: [], excluded };

    /*
      The cut is the SAME arithmetic a patch goes through, with the whole frame
      standing in for `applied`: a born thing is not confined to the ground some
      edit was allowed to touch, so the region it was segmented as is the region
      it owns. Reusing the patch cutter rather than restating it is what keeps
      one segment shaped like another (law 4) — including its refusal to file a
      zero-pixel cut.
    */
    const cuts = cutSegments({
      composite: master,
      applied: wholeFrame(master.width, master.height),
      facetRegions,
      regionMasks,
    });
    for (const facet of Array.from(facetRegions.keys())) {
      if (!cuts.some((cut) => cut.facet === facet)) {
        excluded.push({ facet, reason: "emptyCut", detail: "the detection claimed no pixels once cut" });
      }
    }
    if (cuts.length === 0) return { outcome: "nothing-found", segments: [], excluded };

    const planned = cuts.map((cut) => ({
      cut,
      maskKey: `${SEGMENT_KEY_PREFIX}/${randomUUID()}-mask.png`,
      contentKey: `${SEGMENT_KEY_PREFIX}/${randomUUID()}-content.png`,
    }));

    const cleanupBatchId = randomUUID();
    await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
      id: cleanupBatchId,
      userId: input.userId,
      /* A synthetic operation id: cataloguing is not a user operation, and the
         real operation's own batch must not be collided with. */
      operationId: randomUUID(),
      /* BORN HELD, and the synthetic id above is exactly why: the worker's
         in-flight fence tests this batch against a live operation row, and a
         synthetic id matches none — so without a hold this manifest is
         claimable while the catalogue is still storing the crops it names. */
      heldUntil: storageCleanupManifestHeldUntil(),
      kind: "casting_candidate_cleanup",
      storageItems: planned.flatMap(({ maskKey, contentKey }) => [
        { storageKey: maskKey, storageBackend: "public_r2" as const },
        { storageKey: contentKey, storageBackend: "public_r2" as const },
      ]),
    }));

    const detections = [];
    for (const { cut, maskKey, contentKey } of planned) {
      const encoded = await encodeCut(cut);
      await store({ key: maskKey, bytes: encoded.mask, contentType: "image/png" });
      await store({ key: contentKey, bytes: encoded.content, contentType: "image/png" });
      detections.push({
        facet: cut.facet,
        region: cut.region,
        maskKey,
        contentKey,
        geometry: { bbox: cut.box, frame: cut.frame },
      });
    }

    const segments = await record({
      userId: input.userId,
      candidateId: input.candidateId,
      detector,
      detections,
      cleanupBatchId,
    });

    log.info(
      {
        userId: input.userId,
        candidateId: input.candidateId,
        detector,
        found: segments.map((segment) => `${segment.facet}@v${segment.version}`),
        absent: scan.absent.map((entry) => entry.facet),
        failed: scan.failed.map((entry) => entry.facet),
        excluded,
      },
      "[born-worn] catalogued what this master already had",
    );
    return { outcome: "catalogued", segments, excluded };
  } catch (error) {
    /*
      The objects, if any were written, are still on their manifest — the
      discharge is the last statement of the row insert, so a failure anywhere
      before it leaves the cleanup worker holding them.
    */
    log.error(
      { err: error, userId: input.userId, candidateId: input.candidateId },
      "[born-worn] this master could not be catalogued — the face simply has no catalogue yet",
    );
    return { outcome: "failed", segments: [], excluded: [] };
  }
}
