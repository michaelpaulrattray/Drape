/**
 * Fetching what this face already has — the read side of segment permanence.
 *
 * # The two failures are not the same failure (spec: fable-088)
 *
 * **A store that cannot be read at all refuses the render.** Not here — this
 * function throws and the caller refuses and refunds, because a face
 * composited from a partial list looks exactly like a correct render. That is
 * the silently-short paste, and the whole reason it is dangerous is that
 * nobody can see it: her freckles are simply gone again, on a picture she paid
 * for, with every instrument green.
 *
 * **One segment's object missing degrades that facet alone.** The render
 * proceeds, the exclusion is recorded in the evidence and logged loudly, and
 * that facet reverts to pre-segment behaviour for this render. Losing one
 * thing's permanence must not hold her whole edit hostage — but it is never
 * silent, because a quiet degradation is how permanence would rot one facet at
 * a time with the numbers still reading well.
 *
 * # What is deliberately NOT carried
 *
 * - **Facets this edit writes.** The current ask outranks its own memory, and
 *   a segment for a facet being repainted would be pasted under fresh paint at
 *   best and fight it at worst.
 * - **Detected-born segments.** They have no pixels to re-composite: they live
 *   in the master already, and the master is the base of every assembly. Their
 *   masks and crops exist for reference and for the face chart.
 */
import sharp from "sharp";

import { listLineageSegments, type StoredSegment } from "../db/castingV2Segments";
import { storageReadBytes } from "../storage";
import { createModuleLogger } from "../logging/logger";
import { captureCastingSegmentsEnabled } from "./castingV2Scope";
import { readRaster, writePng, type Mask } from "./maskedComposite";
import { ProviderError } from "../providers/types";
import { assembleComposite, type AssemblyEvidence, type CarriedSegment } from "./segmentAssembly";

const log = createModuleLogger("castingV2/carriedSegments");

export type CarriedLoad = {
  segments: CarriedSegment[];
  /** Rows whose bytes could not be used, named so the render can say so. */
  excluded: Array<{ id: number; facet: string; reason: "objectMissing"; detail: string }>;
};

export type CarriedSegmentDependencies = {
  list?: typeof listLineageSegments;
  readBytes?: typeof storageReadBytes;
  enabledFor?: (userId: number) => boolean;
};

export type AssembledRender = {
  bytes: Buffer;
  contentType: string;
  /** The harvest's evidence, with `applied` widened to the carried ground. */
  evidence: { applied: Mask; masterRegions: ReadonlyMap<string, Mask> } | null;
  /** Facets present because a segment was pasted — the report's carried column. */
  carriedFacets: string[];
  /** What the assembly did, for the record. Null when nothing was carried. */
  assembly: AssemblyEvidence | null;
};

/**
 * Read a stored mask back as one byte per pixel.
 *
 * `toColourspace("b-w")` is forced for the reason `featherMask` documents: sharp
 * will hand back three channels given half a chance, and every loop that walks
 * a mask one byte per pixel then runs three times too far, comparing against
 * `undefined` — which is false, so the check passes by reading nothing.
 */
async function readMask(bytes: Buffer): Promise<Mask> {
  const { data, info } = await sharp(bytes)
    .removeAlpha()
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) {
    throw new Error(`a segment mask decoded to ${info.channels} channels`);
  }
  return { data, width: info.width, height: info.height };
}

/**
 * Everything this face is still wearing from earlier edits.
 *
 * Oldest first, which is the order the assembly wants: a later paste wins the
 * pixels it shares with an earlier one, and that order IS the user's own edit
 * order rather than a rule invented for the compositor.
 */
export async function loadCarriedSegments(input: {
  userId: number;
  candidateId: number;
  /**
   * The SELECTED variant this edit is made from — the branch whose layers she
   * is looking at (fable-091). Without one there is no branch, so nothing is
   * carried: the first edit of a face carries nothing by definition.
   */
  anchorVariantId: number | null;
  /** The facets this edit writes — their segments are not carried. */
  writing: readonly string[];
  dependencies?: CarriedSegmentDependencies;
}): Promise<CarriedLoad> {
  const enabled = input.dependencies?.enabledFor ?? captureCastingSegmentsEnabled;
  if (!enabled(input.userId)) return { segments: [], excluded: [] };
  if (!input.anchorVariantId) return { segments: [], excluded: [] };

  const list = input.dependencies?.list ?? listLineageSegments;
  const readBytes = input.dependencies?.readBytes ?? storageReadBytes;

  /*
    Deliberately NOT caught. A store that cannot be read is a refusal, and it
    belongs to the caller — see the header. Swallowing it here would produce
    the render that looks right and is missing everything she paid for.
  */
  const rows = await list({
    userId: input.userId,
    candidateId: input.candidateId,
    anchorVariantId: input.anchorVariantId,
  });

  const writing = new Set(input.writing);
  const wanted = rows.filter((row: StoredSegment) =>
    row.provenance === "edit_patch" && !writing.has(row.facet));

  const segments: CarriedSegment[] = [];
  const excluded: CarriedLoad["excluded"] = [];

  for (const row of wanted) {
    try {
      const [mask, content] = await Promise.all([
        readBytes(row.maskKey).then((object) => readMask(object.bytes)),
        readBytes(row.contentKey).then((object) => readRaster(object.bytes)),
      ]);
      segments.push({
        id: row.id,
        facet: row.facet,
        version: row.version,
        mask,
        content,
        box: {
          x: row.geometry.bbox.x,
          y: row.geometry.bbox.y,
          width: row.geometry.bbox.width,
          height: row.geometry.bbox.height,
        },
        frame: row.geometry.frame,
      });
    } catch (error) {
      /*
        LOUD, and one facet wide. The row survives — it is evidence of a
        delivered render, and the object may simply be unreachable this minute
        rather than gone. What must not happen is this passing unremarked.
      */
      log.error(
        { err: error, userId: input.userId, candidateId: input.candidateId, segmentId: row.id, facet: row.facet },
        "[segments] a kept segment's pixels could not be read — that facet loses its permanence for this render",
      );
      excluded.push({
        id: row.id,
        facet: row.facet,
        reason: "objectMissing",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { segments, excluded };
}

/**
 * The product path: a harvested render, plus everything this face already has.
 *
 * Returns the harvest's own bytes UNTOUCHED whenever there is nothing to carry
 * — dark store, no segments, or a render the masked path never composited.
 * That last one matters: without an `applied` mask the frame is the engine's
 * whole-face answer rather than a master-anchored composite, and pasting kept
 * pixels onto a face that was entirely repainted would put an old jaw on a new
 * one. No evidence, no carrying.
 */
export async function assembleWithCarriedSegments(input: {
  userId: number;
  candidateId: number;
  /** The SELECTED variant this edit is made from — the branch she is on. */
  anchorVariantId: number | null;
  /** The facets this edit answers — their segments are not carried. */
  writing: readonly string[];
  master: { bytes: Buffer; contentType: string };
  harvested: {
    bytes: Buffer;
    contentType: string;
    evidence?: { applied: Mask; masterRegions: ReadonlyMap<string, Mask> } | null;
  };
  dependencies?: CarriedSegmentDependencies;
}): Promise<AssembledRender> {
  const unchanged: AssembledRender = {
    bytes: input.harvested.bytes,
    contentType: input.harvested.contentType,
    evidence: input.harvested.evidence ?? null,
    carriedFacets: [],
    assembly: null,
  };

  const enabled = input.dependencies?.enabledFor ?? captureCastingSegmentsEnabled;
  if (!enabled(input.userId)) return unchanged;
  if (!input.harvested.evidence) return unchanged;

  let load: CarriedLoad;
  try {
    load = await loadCarriedSegments({
      userId: input.userId,
      candidateId: input.candidateId,
      anchorVariantId: input.anchorVariantId,
      writing: input.writing,
      dependencies: input.dependencies,
    });
  } catch (error) {
    /*
      THE REFUSAL, and it is the whole reason this class exists.

      We do not know what belongs in this picture, so we do not deliver one.
      Degrading here would hand her a face missing edits she has already paid
      for, and it would look exactly like a correct render.
    */
    log.error(
      { err: error, userId: input.userId, candidateId: input.candidateId },
      "[segments] the store could not be read — refusing the render rather than delivering a face short of her kept edits",
    );
    throw new ProviderError(
      "segment_store",
      "we could not read this face's kept edits",
    );
  }

  if (load.segments.length === 0 && load.excluded.length === 0) return unchanged;

  const [master, painted] = await Promise.all([
    readRaster(input.master.bytes),
    readRaster(input.harvested.bytes),
  ]);
  const assembled = assembleComposite({
    master,
    painted,
    applied: input.harvested.evidence.applied,
    carried: load.segments,
  });
  /* The loader's own exclusions belong in the same record as the assembly's:
     one list of what did not make it into her picture, whatever the reason. */
  const assembly: AssemblyEvidence = {
    ...assembled.evidence,
    segmentsExcluded: [
      ...assembled.evidence.segmentsExcluded,
      ...load.excluded.map((entry) => ({
        id: entry.id,
        facet: entry.facet,
        reason: entry.reason,
        detail: entry.detail,
      })),
    ],
  };

  log.info(
    {
      userId: input.userId,
      candidateId: input.candidateId,
      carried: assembled.carriedFacets,
      applied: assembly.segmentsApplied.map((entry) => `${entry.facet}@v${entry.version}:${entry.pixels}px`),
      excluded: assembly.segmentsExcluded.map((entry) => `${entry.facet}:${entry.reason}`),
      intersections: assembly.intersections,
      superseded: assembly.supersededCandidates.map((entry) => entry.facet),
    },
    "[segments] assembled this render from the master, her kept segments, and the fresh paint",
  );

  return {
    bytes: await writePng(assembled.raster),
    contentType: "image/png",
    evidence: {
      /* Widened to the carried ground: the verification step's argument is
         "outside this, the picture IS the master", and a carried segment moved
         pixels the paint never touched. */
      applied: assembled.evidence.applied,
      masterRegions: input.harvested.evidence.masterRegions,
    },
    carriedFacets: assembled.carriedFacets,
    assembly,
  };
}
