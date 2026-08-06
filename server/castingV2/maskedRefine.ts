/**
 * MASKED EDITING, ON THE PRODUCT PATH — the workstream's seam, and it is one
 * function in one place.
 *
 * The founder's walk died on drift: a freckles edit replaced her hairstyle, an
 * earrings edit deleted her glasses, a removal refused at a face plainly wearing
 * the thing. The fix is not a better prompt or a stricter reader. **The model
 * returns a whole frame; we take only the pixels inside the region that was
 * asked about, and put them into an otherwise untouched master.** What happened
 * everywhere else stops being a question for a judge and becomes `Buffer.compare`.
 *
 * # Where this sits
 *
 * `refineService` already calls the engine once and gets a frame back. That call
 * does not change — **full-frame context with local harvest** is the standing
 * rider, because the model needs the whole face to know what it is editing. This
 * runs immediately after it, on the bytes, and returns a different set of bytes.
 * Everything downstream — the fault detector, the verification net, the retry,
 * the refund — is untouched and does not know this happened.
 *
 * # Dark by default, and the flag is a code constant
 *
 * `MASKED_EDITING_ENABLED` is `false`, so a deploy of this changes nothing at
 * all: the function returns the engine's own bytes, byte for byte, and a test
 * proves it. Founder precedent (brand translation, partial deference) is that a
 * behaviour switch like this is a code constant rather than a new env var — one
 * line to flip, one line to roll back.
 *
 * # It REFUSES rather than falling open
 *
 * When the flag is on and a mask cannot be built, this throws instead of quietly
 * returning the unmasked frame. Falling open would be the invoked-but-inert
 * class in its purest form: the guarantee would be present in the code, absent
 * in the picture, and nothing would say so. A throw routes into the refund path
 * that already exists for a failed refinement, which is the honest outcome —
 * the user is not charged for an edit the system could not make safely.
 *
 * The one exception is a facet with no region at all. An expression is not a
 * region edit (D-233): a smile moves cheeks, eyes, jaw and brow at once, and any
 * zone drawn for it would be a lie about what changes. Those route full-frame by
 * design, so this returns the engine's frame untouched and says why.
 */
import { createModuleLogger } from "../logging/logger";
import {
  MaskError,
  assertUsable,
  coverage,
  dilateMask,
  expandUntilClear,
  harvestMatteFrom,
  unionMasks,
} from "./maskGeometry";
import {
  adoptInteraction,
  compositeMasked,
  differenceMatte,
  harvestGate,
  outsideMaskUnchanged,
  readRaster,
  writePng,
  type Mask,
  type Raster,
} from "./maskedComposite";
import { hasRegion, isDistributed, zoneScopeOf } from "./zoneScope";
import type { Facet } from "./refineFacets";

const log = createModuleLogger("castingV2/maskedRefine");

/**
 * THE FLAG. `false` ships this dark — the deploy changes nothing.
 *
 * Flip to `true` only behind a founder decision, and expect the rollback to be
 * this line.
 */
export const MASKED_EDITING_ENABLED = false;

/** Feathering the zone; the harvest matte supplies the visible edge. */
const FEATHER_PX = 4;
/** How far strand tips are recovered past the confirmed content. */
const STRAND_REACH_PX = 40;
/** How far interaction (contact shadow) may reach from confirmed content. */
const BAND_PX = 14;
/** A pixel has moved when it moved by this much — used to find painted content. */
const MOVED_LEVELS = 25;

/**
 * What a region looks like to this module. One call per named region, so the
 * caller owns which segmenter answers and this owns what is done with it.
 */
export type RegionReader = {
  /** Everything the named region covers in this image. */
  region(input: { image: Buffer; name: string }): Promise<Mask>;
  /** A soft whole-subject matte, for edge ramps. */
  subject(input: { image: Buffer }): Promise<Mask>;
};

export type MaskedRefineInput = {
  /** The master — her current picture. Never resampled. */
  master: { bytes: Buffer; contentType: string };
  /** What the engine returned, whole-frame. */
  painted: { bytes: Buffer; contentType: string };
  /** Which facets this instruction wrote. Decides the zone's scope. */
  facets: readonly Facet[];
  reader: RegionReader;
  /** For the log line, so a composite can be traced to its operation. */
  operationId?: string;
};

export type MaskedRefineResult = {
  bytes: Buffer;
  contentType: string;
  /** What actually happened, for the record and the log. */
  outcome: "composited" | "flag-off" | "no-region";
  /** Present when composited — the promise, restated in numbers. */
  guarantee?: {
    outsideIdentical: boolean;
    blendBandPixels: number;
    zoneCoverage: number;
  };
};

/**
 * WHICH SEGMENTATION QUESTION A FACET ASKS.
 *
 * Deliberately small and explicit rather than derived from the facet id: the
 * words here are sent to a segmentation model, and D-213 is that a segmenter is
 * never asked an open question. A facet with no entry has no masked path and
 * says so, rather than having a prompt invented for it.
 */
const REGION_OF_FACET: Partial<Record<Facet, string>> = {
  "hair.cut": "hair",
  "hair.colour": "hair",
  "hair.texture": "hair",
  hairFinish: "hair",
  hairWorn: "hair",
  facialHair: "facial hair",
  marks: "face skin",
  "eye.colour": "eyes",
  "eye.shape": "eyes",
  brows: "eyebrows",
  lashes: "eyes",
  ears: "ear",
  cheekbones: "face skin",
  nose: "nose",
  lips: "lips",
  teeth: "lips",
  chin: "face skin",
  jaw: "face skin",
  makeup: "face skin",
  skinTone: "face skin",
  skinCharacter: "face skin",
};

export function regionNameOf(facet: Facet): string | null {
  return REGION_OF_FACET[facet] ?? null;
}

/**
 * THE NAMED GAP, declared rather than discovered.
 *
 * `object`-class facets — earrings, glasses, ink placements — have a zone, but
 * it does not come from segmenting the master: **the thing is not there yet, so
 * nothing can segment it** (D-213). Their destination is derived from a LANDMARK
 * plus the described object's own extent, which the harness has (`the-walk.mts`
 * builds earring corridors from `moondream3-preview/point`) and this adapter
 * does not yet.
 *
 * So the object path is scaffolding-declared: it refuses with its own name
 * rather than falling through to a region prompt that would be a lie. **This gap
 * closes before the flag flips**, because the founder's own walk includes
 * earrings.
 */
export function needsLandmarkDestination(facet: Facet): boolean {
  return zoneScopeOf(facet) === "object";
}

/**
 * Take only what was asked for, and leave the rest of her exactly as she was.
 */
export async function harvestRefinement(input: MaskedRefineInput): Promise<MaskedRefineResult> {
  if (!MASKED_EDITING_ENABLED) {
    /* The dark path, and it is byte-for-byte the engine's own answer. */
    return { bytes: input.painted.bytes, contentType: input.painted.contentType, outcome: "flag-off" };
  }

  /*
    A FACET WITH NO REGION ROUTES FULL-FRAME (D-233). An expression is the whole
    face re-posing; there is no zone that contains it, and drawing one would be
    the fringe error at maximum scale. If ANY facet in this edit is regionless
    the whole edit is, because one render cannot be half-masked.
  */
  const regionless = input.facets.filter((facet) => !hasRegion(facet));
  if (regionless.length > 0) {
    log.info(
      { operationId: input.operationId, facets: regionless },
      "[maskedRefine] facet has no region — routing full-frame by design",
    );
    return { bytes: input.painted.bytes, contentType: input.painted.contentType, outcome: "no-region" };
  }

  const objects = input.facets.filter(needsLandmarkDestination);
  if (objects.length > 0) {
    /* Declared scaffolding, not a silent fallthrough. An add's destination comes
       from a landmark and the described object's extent; this adapter does not
       carry that yet, and inventing a region prompt for a thing that is not
       there is precisely what D-213 forbids. */
    throw new MaskError(
      `${objects.join(", ")} is an addition — its destination comes from a landmark, not from `
      + "segmenting the master, and that path is not wired into the refine adapter yet",
    );
  }

  const names = input.facets.map((facet) => {
    const name = regionNameOf(facet);
    if (!name) {
      /* Loud. A facet with no segmentation question has no masked path, and
         inventing a prompt for it is exactly what D-213 forbids. */
      throw new MaskError(`facet "${facet}" has no region to segment — add it to REGION_OF_FACET`);
    }
    return name;
  });

  const master: Raster = await readRaster(input.master.bytes);
  const painted: Raster = await readRaster(input.painted.bytes);
  if (painted.width !== master.width || painted.height !== master.height) {
    throw new MaskError(
      `the engine returned ${painted.width}x${painted.height} for a ${master.width}x${master.height} master `
      + "— a masked composite never resizes the master to fit",
    );
  }

  /*
    THE ZONE FOLLOWS THE FACET, NOT THE DELTA (D-233). A distributed facet — a
    cut, a colour, a texture — takes its whole region; scoping it to where the
    pixels move is what made a fringe into appliqué.
  */
  let zone: Mask | null = null;
  for (let index = 0; index < input.facets.length; index += 1) {
    const region = await input.reader.region({ image: input.master.bytes, name: names[index] });
    const scoped = isDistributed(input.facets[index])
      ? await dilateMask(region, 48)
      : region;
    zone = zone ? unionMasks(zone, scoped) : scoped;
  }
  if (!zone) throw new MaskError("no facets to mask");

  const paintedSubject = await input.reader.subject({ image: input.painted.bytes });
  const paintedContent = await input.reader.region({ image: input.painted.bytes, name: names[0] });
  const harvest = await harvestMatteFrom({
    content: paintedContent, matte: paintedSubject, taperPx: 8,
  });

  /* The strand alpha the segmenter's boundary discards — exact, because we own
     the background (D-230). */
  const strands = differenceMatte({ master, patch: painted, confirmed: harvest, reachPx: STRAND_REACH_PX });
  const withStrands: Mask = {
    data: Buffer.from(harvest.data.map((value, index) => Math.max(value, strands.alpha.data[index]))),
    width: harvest.width,
    height: harvest.height,
  };

  /* The painter's own drift, measured per render, and the content it painted. */
  const paintedPixels: Mask = {
    data: Buffer.alloc(master.width * master.height, 0),
    width: master.width,
    height: master.height,
  };
  const quietSamples: number[] = [];
  for (let pixel = 0; pixel < paintedPixels.data.length; pixel += 1) {
    const at = pixel * 3;
    const delta = (Math.abs(painted.data[at] - master.data[at])
      + Math.abs(painted.data[at + 1] - master.data[at + 1])
      + Math.abs(painted.data[at + 2] - master.data[at + 2])) / 3;
    if (delta > MOVED_LEVELS) paintedPixels.data[pixel] = 255;
    if (withStrands.data[pixel] === 0 && pixel % 37 === 0) quietSamples.push(delta);
  }
  quietSamples.sort((a, b) => a - b);
  const baselineDelta = quietSamples[Math.floor(quietSamples.length / 2)] ?? 0;

  /* Only what is really the new content — not her surface rendered again. */
  const gated = harvestGate({
    master, patch: painted, alpha: withStrands, strandColour: strands.strandColour, baselineDelta,
  }).alpha;

  /* A zone that stops where the content does not is a guillotine (D-230). */
  const grown = await expandUntilClear({
    painted: paintedPixels, zone, stepPx: 48, effective: gated,
  });

  /* Contact shadows, darkening only — her hue cannot change (D-229). */
  const adopted = adoptInteraction({
    master, patch: painted, harvest: gated, bandPx: BAND_PX, mode: "shadow",
  });

  /* Refused before the composite if the mask cannot do its job. */
  assertUsable(adopted.alpha, "skin");

  const composed = await compositeMasked({
    master, patch: adopted.patch, mask: grown.zone, edgeMatte: adopted.alpha, featherRadius: FEATHER_PX,
  });
  const outside = outsideMaskUnchanged(master, composed.composite, composed.applied);
  if (!outside.identical) {
    /* Arithmetic, so this cannot happen — which is exactly why it is checked.
       A guarantee nobody verifies at the point of use is a claim. */
    throw new MaskError(
      `the composite changed ${outside.changedPixels} px outside the applied mask — refusing to deliver it`,
    );
  }

  log.info(
    {
      operationId: input.operationId,
      facets: input.facets,
      zoneCoverage: Number(coverage(grown.zone).toFixed(4)),
      blendBand: outside.bandPixels,
      expansionPasses: grown.passes,
    },
    "[maskedRefine] composited — outside the mask, byte-identical to her master",
  );

  return {
    bytes: await writePng(composed.composite),
    contentType: "image/png",
    outcome: "composited",
    guarantee: {
      outsideIdentical: outside.identical,
      blendBandPixels: outside.bandPixels,
      zoneCoverage: coverage(grown.zone),
    },
  };
}

/**
 * The reader a caller gets when it has not supplied one.
 *
 * It refuses rather than returning an empty mask, because an empty mask would
 * compose to "nothing changed" and the user would be charged for a picture
 * identical to the one they already had. While the flag is dark nothing ever
 * reaches it — `harvestRefinement` returns before consulting a reader at all,
 * and a test proves the segmenter is not called.
 */
export const refusingRegionReader: RegionReader = {
  region: async () => {
    throw new MaskError("masked editing is enabled but no segmentation reader was supplied");
  },
  subject: async () => {
    throw new MaskError("masked editing is enabled but no segmentation reader was supplied");
  },
};
