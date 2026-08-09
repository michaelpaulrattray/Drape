/**
 * Taking one thing back off her face — the undo segments make free.
 *
 * "Take the earrings off" used to mean a render: the whole recipe re-composed,
 * a paid call to a painter, and every other facet re-rolled on the way past.
 * With a segment store it is arithmetic. Drop that facet's segment, assemble
 * the master with everything still standing, and the picture is done — no
 * engine, no dice, and nothing downstream to rebuild, because nothing
 * downstream was ever painted on top of it.
 *
 * # What this deliberately is NOT
 *
 * **It is not removal.** Removal is memory surgery on things she was BORN
 * wearing: the glasses that came with the roll do not come off by dropping a
 * row, they come off with a real render that has to invent the skin, hair and
 * shadow behind them. That is the departed/vacancy machinery and it is
 * untouched. This path refuses anything it has no segment for, rather than
 * quietly doing nothing and letting a caller believe the thing is gone.
 *
 * # Scope of this module, stated plainly
 *
 * This is the DOMAIN half: the drop, the reassembly and the bytes. There is no
 * tRPC procedure and no charge path here — what a free operation looks like in
 * the studio, and where its result is filed, belongs with the face chart's
 * surface (M12) rather than being invented at this layer.
 */
import { retireSegmentFacet } from "../db/castingV2Segments";
import { createModuleLogger } from "../logging/logger";
import { captureCastingSegmentsEnabled } from "./castingV2Scope";
import { loadCarriedSegments, type CarriedSegmentDependencies } from "./carriedSegments";
import { assembleComposite, type AssemblyEvidence } from "./segmentAssembly";
import { readRaster, writePng } from "./maskedComposite";

const log = createModuleLogger("castingV2/segmentPrune");

export type PruneResult =
  | { outcome: "off" }
  /** No live segment for that facet — nothing was dropped and nothing changed. */
  | { outcome: "nothing-to-drop" }
  | {
    outcome: "recomposited";
    bytes: Buffer;
    contentType: string;
    /** Facets still in the picture because a segment is still pasted. */
    carriedFacets: string[];
    evidence: AssemblyEvidence;
  };

/**
 * Drop one facet's segment and rebuild the picture from what is left.
 *
 * The order matters and is the opposite of the intuitive one: **retire first,
 * then read.** Reading the list first and filtering the dropped facet out of it
 * in memory would produce a picture that disagrees with the database if the
 * retire then failed — the record and the frame have to be settled by the same
 * pass, and the record goes first because it is the one another request can
 * see.
 */
export async function pruneSegmentFacet(input: {
  userId: number;
  candidateId: number;
  /**
   * The SELECTED variant — which branch's earrings come off (fable-091).
   * "Take the earrings off" means off the face she is LOOKING AT, and a prune
   * that reached every branch would undo an edit on a version she never opened.
   */
  anchorVariantId: number;
  /** The thing to take off, in her vocabulary: `marks`, `hair.colour`. */
  facet: string;
  /** Her sharp original — the base of every assembly, as always. */
  master: { bytes: Buffer; contentType: string };
  dependencies?: CarriedSegmentDependencies & { retire?: typeof retireSegmentFacet };
}): Promise<PruneResult> {
  const enabled = input.dependencies?.enabledFor ?? captureCastingSegmentsEnabled;
  if (!enabled(input.userId)) return { outcome: "off" };

  const retire = input.dependencies?.retire ?? retireSegmentFacet;
  const dropped = await retire({
    userId: input.userId,
    candidateId: input.candidateId,
    anchorVariantId: input.anchorVariantId,
    facet: input.facet,
  });
  if (dropped === 0) {
    /*
      Refusing to pretend. Nothing kept means either she never bought that
      facet, or it is something she was born wearing — and the second one needs
      a render, not a row change. A caller told "done" here would show her a
      picture with her glasses still on.
    */
    return { outcome: "nothing-to-drop" };
  }

  const remaining = await loadCarriedSegments({
    userId: input.userId,
    candidateId: input.candidateId,
    anchorVariantId: input.anchorVariantId,
    /* Nothing is being written: this is a rebuild, not an edit. */
    writing: [],
    dependencies: input.dependencies,
  });

  const master = await readRaster(input.master.bytes);
  const assembled = assembleComposite({ master, carried: remaining.segments });
  const evidence: AssemblyEvidence = {
    ...assembled.evidence,
    segmentsExcluded: [...assembled.evidence.segmentsExcluded, ...remaining.excluded],
  };

  log.info(
    {
      userId: input.userId,
      candidateId: input.candidateId,
      dropped: input.facet,
      remaining: assembled.carriedFacets,
      excluded: evidence.segmentsExcluded.map((entry) => `${entry.facet}:${entry.reason}`),
    },
    "[segments] dropped a facet and rebuilt the picture — no render, no charge",
  );

  return {
    outcome: "recomposited",
    bytes: await writePng(assembled.raster),
    contentType: "image/png",
    carriedFacets: assembled.carriedFacets,
    evidence,
  };
}
