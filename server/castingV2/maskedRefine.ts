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
 * # Dark by default, and SCOPED when it opens
 *
 * `MASKED_EDITING_SCOPE` is `off`, so a deploy of this changes nothing at all:
 * the function returns the engine's own bytes, byte for byte, and a test proves
 * it.
 *
 * It is a SCOPE rather than a boolean because this program has one convention for
 * every spendable surface — `off` / `all` / `users:<ids>` — and the first flip
 * goes to the founder's account alone. A boolean would have made "on for me" and
 * "on for everyone" the same edit, which is exactly the decision that deserves
 * two. Widening is a separate founder call after the walk, never a rider on the
 * flip. Same parser as `CASTING_V2_SCOPE`, deliberately: a second scope grammar
 * would be a mirror, and mirrors drift (law #4).
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
import { castingV2EnabledForUser, parseCastingV2Scope } from "./castingV2Scope";
import type { Facet } from "./refineFacets";

const log = createModuleLogger("castingV2/maskedRefine");

/**
 * THE FLAG. **LIVE FOR THE FOUNDER'S ACCOUNT ONLY** (founder decision,
 * 2026-08-06, after the face wall passed).
 *
 * `users:1` — the sole admin, and the only account this path touches. Widening
 * to `all` is a separate founder decision after the walk, never a rider on this
 * one; that separation is the entire reason this is a scope rather than a
 * boolean.
 *
 * **The rollback is this line: set it back to `"off"`.** Nothing else has to
 * change, and every other user is already on that path.
 */
export const MASKED_EDITING_SCOPE = "users:1";

/** Is the masked path live for this user? Off means off for everyone. */
export function maskedEditingEnabledFor(userId: number | undefined): boolean {
  const scope = parseCastingV2Scope(MASKED_EDITING_SCOPE);
  if (scope.kind === "off") return false;
  if (scope.kind === "all") return true;
  return userId !== undefined && castingV2EnabledForUser(scope, userId);
}

/** Feathering the zone; the harvest matte supplies the visible edge. */
const FEATHER_PX = 4;
/**
 * REACHES ARE FRACTIONS OF THE FRAME, NOT PIXEL CONSTANTS.
 *
 * They were absolute — 40px for strand recovery, 14px for the interaction band —
 * which is local on the 1024x1536 the workstream was measured on and the WHOLE
 * FRAME on anything small. A constant in pixels is a constant that assumes a
 * resolution, and this path already promises never to resample; it should not
 * quietly assume one instead.
 *
 * The fractions are the measured values divided by 1024, so behaviour at the
 * resolution everything was calibrated on is unchanged.
 */
const STRAND_REACH_FRACTION = 40 / 1024;
const BAND_FRACTION = 14 / 1024;
const scaled = (fraction: number, width: number, height: number) =>
  Math.max(4, Math.round(Math.min(width, height) * fraction));

/**
 * What a region looks like to this module. One call per named region, so the
 * caller owns which segmenter answers and this owns what is done with it.
 */
export type RegionReader = {
  /** Everything the named region covers in this image. */
  region(input: { image: Buffer; name: string }): Promise<Mask>;
  /** A soft whole-subject matte, for edge ramps. */
  subject(input: { image: Buffer }): Promise<Mask>;
  /**
   * WHERE A THING WOULD BE, even when nothing can see it.
   *
   * A different capability from segmentation, not a worse one. A segmenter
   * answers *where is this in the picture* and returns nothing at all when hair
   * covers the ear; a landmark model answers *where is the ear on this face* and
   * still answers. That distinction is D-213's sibling, and it is the whole
   * reason an addition can be placed at all.
   */
  landmark(input: { image: Buffer; name: string }): Promise<{ x: number; y: number }[]>;
};

export type MaskedRefineInput = {
  /** The master — her current picture. Never resampled. */
  master: { bytes: Buffer; contentType: string };
  /** What the engine returned, whole-frame. */
  painted: { bytes: Buffer; contentType: string };
  /** Which facets this instruction wrote. Decides the zone's scope. */
  facets: readonly Facet[];
  reader: RegionReader;
  /** Whose refinement this is — the scope is per user, not per deploy. */
  userId?: number;
  /** What the instruction said the thing IS. Places an addition. */
  described?: string;
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
 * That path is now wired: `landmarkNameOf` names the anchor, `additionDestination`
 * builds the corridor, and boundary-contact auto-expand catches an under-estimate.
 * A facet with no landmark vocabulary — ink, whose "left forearm" is not a facial
 * landmark — still refuses by its own name rather than having one invented.
 */
export function needsLandmarkDestination(facet: Facet): boolean {
  return zoneScopeOf(facet) === "object";
}

/**
 * WHERE AN ADDITION IS PLACED — the landmark a facet is anchored to.
 *
 * Only accessories have one today. Ink has no landmark vocabulary — "left
 * forearm" is not a facial landmark, and inventing one would be the same lie as
 * inventing a region prompt — so it still refuses by name.
 */
const LANDMARK_OF_ACCESSORY: { words: readonly string[]; landmark: string; drops: boolean }[] = [
  { words: ["earring", "stud", "hoop", "dangle", "drop"], landmark: "earlobe", drops: true },
  { words: ["glasses", "spectacles", "frames", "sunglasses", "eyewear"], landmark: "eye", drops: false },
  { words: ["nose ring", "nose stud", "septum", "nostril"], landmark: "nose", drops: false },
];

/**
 * WHICH LANDMARK AN ADDITION HANGS FROM — facet AND instruction, again.
 *
 * `statedAccessories` is one facet covering earrings, glasses and piercings, and
 * they do not share an anchor: an earring hangs from the lobe, glasses sit at the
 * eyes. Keying the landmark on the facet alone would put her spectacles on her
 * earlobes — the same class as the audit's marks-versus-freckles finding, which
 * is now the second time the instruction has turned out to carry half the
 * placement.
 *
 * An accessory nobody has a landmark for REFUSES. Guessing an anchor is guessing
 * anatomy, and a guess dressed as anatomy is the D-210 family.
 *
 * **Longest match wins, not first match.** "A small nose stud" contains both
 * "stud" and "nose stud", and a first-match scan put it on her earlobe — the
 * answer depended on the order of a list, which is a defect waiting for someone
 * to tidy the array. The longest matched word is the most specific thing the
 * instruction said.
 */
function accessoryEntry(described?: string) {
  const said = (described ?? "").toLowerCase();
  let best: { landmark: string; drops: boolean; length: number } | null = null;
  for (const entry of LANDMARK_OF_ACCESSORY) {
    for (const word of entry.words) {
      if (!said.includes(word)) continue;
      if (!best || word.length > best.length) {
        best = { landmark: entry.landmark, drops: entry.drops, length: word.length };
      }
    }
  }
  return best;
}

export function landmarkNameOf(facet: Facet, described?: string): string | null {
  if (!needsLandmarkDestination(facet)) return null;
  if (facet !== "statedAccessories") return null;
  return accessoryEntry(described)?.landmark ?? null;
}

/** Does the described object hang below its anchor? A drop does; glasses do not. */
export function hangsBelowAnchor(described?: string): boolean {
  return accessoryEntry(described)?.drops ?? false;
}

/** A filled disc at a normalised point — the unit an addition is built from. */
function discAt(point: { x: number; y: number }, radius: number, width: number, height: number): Mask {
  const data = Buffer.alloc(width * height, 0);
  const cx = point.x * width;
  const cy = point.y * height;
  for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(height, Math.ceil(cy + radius)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(width, Math.ceil(cx + radius)); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) data[y * width + x] = 255;
    }
  }
  return { data, width, height };
}

/**
 * THE DESTINATION FOR AN ADDITION — a corridor per landmark, conservative on
 * purpose.
 *
 * The extent comes from the described object, and this deliberately does not try
 * to be clever about it: a stud is a disc at the lobe, a drop hangs below it, and
 * the founder's rider is explicit that **boundary-contact auto-expand catches
 * under-estimates.** So the default is the smaller guess and the expansion loop
 * grows it when paint presses against the edge. Guessing generously would hand
 * the painter more canvas than the ask deserves.
 *
 * **Scale comes from the face, never from a number somebody liked.** The distance
 * between the two landmarks is the head's width at that feature, so a stud is a
 * fraction of it on any face at any framing.
 */
export function additionDestination(input: {
  landmarks: { x: number; y: number }[];
  width: number;
  height: number;
  /** How far the object hangs below its anchor, in multiples of its own radius. */
  dropSteps?: number;
}): Mask {
  if (input.landmarks.length === 0) {
    throw new MaskError("an addition needs a landmark to be placed against — none was returned");
  }
  const { width, height, landmarks } = input;
  const span = landmarks.length > 1
    ? Math.hypot((landmarks[0].x - landmarks[1].x) * width, (landmarks[0].y - landmarks[1].y) * height)
    : Math.min(width, height) * 0.25;
  const radius = Math.max(4, span * 0.035);
  const steps = input.dropSteps ?? 0;
  const parts: Mask[] = [];
  for (const landmark of landmarks) {
    for (let step = 0; step <= steps; step += 1) {
      parts.push(discAt(
        { x: landmark.x, y: landmark.y + (step * radius * 1.4) / height },
        radius, width, height,
      ));
    }
  }
  return parts.length === 1 ? parts[0] : unionMasks(...parts);
}

/**
 * Take only what was asked for, and leave the rest of her exactly as she was.
 */
export async function harvestRefinement(input: MaskedRefineInput): Promise<MaskedRefineResult> {
  if (!maskedEditingEnabledFor(input.userId)) {
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

  /*
    ADDITIONS ARE PLACED, NOT SEGMENTED. The thing is not there yet, so nothing
    can segment it (D-213) — its destination comes from a landmark on HER face
    plus the described object's own extent. A facet with no landmark vocabulary
    still refuses by name rather than having one invented for it.
  */
  const objects = input.facets.filter(needsLandmarkDestination);
  const unplaceable = objects.filter((facet) => landmarkNameOf(facet, input.described) === null);
  if (unplaceable.length > 0) {
    throw new MaskError(
      `${unplaceable.join(", ")} is an addition with no landmark to place it against`
      + (input.described ? ` for "${input.described}"` : "")
      + " — inventing an anchor would be a guess dressed as anatomy",
    );
  }

  const segmentable = input.facets.filter((facet) => !needsLandmarkDestination(facet));
  const names = segmentable.map((facet) => {
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
  for (let index = 0; index < segmentable.length; index += 1) {
    const region = await input.reader.region({ image: input.master.bytes, name: names[index] });
    const scoped = isDistributed(segmentable[index])
      ? await dilateMask(region, 48)
      : region;
    zone = zone ? unionMasks(zone, scoped) : scoped;
  }
  for (const facet of objects) {
    /* Two landmarks means two corridors — the bilateral law, and the reason a
       stud's scale can be read off her face rather than guessed. */
    const points = await input.reader.landmark({
      image: input.master.bytes, name: landmarkNameOf(facet, input.described)!,
    });
    const destination = additionDestination({
      landmarks: points,
      width: master.width,
      height: master.height,
      /* A drop hangs; glasses sit. The described object says which. */
      dropSteps: hangsBelowAnchor(input.described) ? 6 : 0,
    });
    zone = zone ? unionMasks(zone, destination) : destination;
  }
  if (!zone) throw new MaskError("no facets to mask");

  const paintedSubject = await input.reader.subject({ image: input.painted.bytes });
  /*
    The harvest asks what the PAINTER actually drew. For an addition that is the
    object itself — now that it exists it can be segmented, which is the whole
    asymmetry: unsegmentable before, segmentable after.
  */
  const harvestName = names.length > 0 ? names[0] : "earring";
  const paintedContent = await input.reader.region({ image: input.painted.bytes, name: harvestName });
  /*
    THE DEPTH STACK, for additions. Her hair sits in front of anything at the
    lobe, so it rides as `occludedBy` and an earring under it renders BEHIND it
    by construction — softly, so a half-transparent strand passes half the metal
    through, which is what a real strand does to the light behind it.
  */
  const inFront = objects.length > 0
    ? await input.reader.region({ image: input.master.bytes, name: "hair" }).catch(() => null)
    : null;
  const harvest = await harvestMatteFrom({
    content: paintedContent,
    matte: paintedSubject,
    taperPx: 8,
    ...(inFront ? { occludedBy: inFront } : {}),
  });

  /* The strand alpha the segmenter's boundary discards — exact, because we own
     the background (D-230). */
  const strands = differenceMatte({
    master, patch: painted, confirmed: harvest,
    reachPx: scaled(STRAND_REACH_FRACTION, master.width, master.height),
  });
  const withStrands: Mask = {
    data: Buffer.from(harvest.data.map((value, index) => Math.max(value, strands.alpha.data[index]))),
    width: harvest.width,
    height: harvest.height,
  };

  /* The painter's own drift, measured per render. */
  const quietSamples: number[] = [];
  for (let pixel = 0; pixel < withStrands.data.length; pixel += 1) {
    if (withStrands.data[pixel] !== 0 || pixel % 37 !== 0) continue;
    const at = pixel * 3;
    quietSamples.push((Math.abs(painted.data[at] - master.data[at])
      + Math.abs(painted.data[at + 1] - master.data[at + 1])
      + Math.abs(painted.data[at + 2] - master.data[at + 2])) / 3);
  }
  quietSamples.sort((a, b) => a - b);
  const baselineDelta = quietSamples[Math.floor(quietSamples.length / 2)] ?? 0;

  /* Only what is really the new content — not her surface rendered again. */
  const gated = harvestGate({
    master, patch: painted, alpha: withStrands, strandColour: strands.strandColour, baselineDelta,
  }).alpha;

  /* A zone that stops where the content does not is a guillotine (D-230). */
  const grown = await expandUntilClear({
    /*
      THE PAINT THAT WILL ACTUALLY BE DELIVERED, not everything the painter
      touched — and the difference is the whole behaviour of this loop.

      Defined as "any pixel differing by 25 levels", the mask was the painter's
      WHOLE-FRAME DRIFT: a generated frame differs almost everywhere, so content
      pressed against every edge of the zone forever and the loop grew to its
      pass cap with the zone covering 100% of the frame. Sixteen dilations of a
      1024x1536 mask, twenty to thirty seconds, and a destination zone that had
      stopped meaning anything.

      The rider's subject is the CONTENT, and the content is what the harvest
      keeps. A strand pressing against the boundary is a clipped strand; a
      repainted background pixel is not, and it never was.
    */
    painted: { data: Buffer.from(gated.data), width: gated.width, height: gated.height },
    zone,
    stepPx: 48,
    effective: gated,
  });

  /* Contact shadows, darkening only — her hue cannot change (D-229). */
  const adopted = adoptInteraction({
    master, patch: painted, harvest: gated,
    bandPx: scaled(BAND_FRACTION, master.width, master.height),
    mode: "shadow",
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
  landmark: async () => {
    throw new MaskError("masked editing is enabled but no segmentation reader was supplied");
  },
};
