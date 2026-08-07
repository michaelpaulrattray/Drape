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
  intersectMask,
  subtractMask,
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
import { hasRegion, zoneScopeOf } from "./zoneScope";
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
/**
 * How far the painted region is grown before the reveal is measured against it.
 *
 * Two segmentations of the same face on two frames do not agree pixel for pixel,
 * and every pixel they disagree on would read as vacated territory — painter
 * background shipped along an unchanged hair edge on an edit that only recoloured
 * it. This absorbs that wobble, and the novelty gate downstream catches whatever
 * survives it.
 *
 * A fraction rather than a pixel count, for the reason the two above it are:
 * **a constant in pixels is a constant that assumes a resolution**, on a path
 * that promises never to resample. Provisional at 8 — large enough to swallow
 * SAM 3's frame-to-frame boundary jitter on the specimens measured, small enough
 * that a real reveal (a shoulder, a temple) is orders of magnitude wider.
 */
const VACANCY_TOLERANCE_FRACTION = 8 / 1024;
/**
 * How far from her old region a DEPARTED strand is still looked for.
 *
 * Deliberately its own number rather than sharing `STRAND_REACH_FRACTION`,
 * because it answers a different physical question. That one asks how far a
 * newly painted strand tip may extend past the segmenter's confidence — a tip,
 * so a short distance. This asks how far her EXISTING loose hair lay from the
 * mass it belonged to, and on a long style that is not a tip: her flyaways run
 * most of the way down her chest, hundreds of pixels from the ponytail.
 *
 * The bound is not really this number — it is the projection, which fires only
 * where the master carries old-hair content against the painter's plate, and the
 * novelty gate under it. Distance is the cheap outer fence that keeps the
 * question anywhere near the hair at all.
 */
const DEPARTED_REACH_FRACTION = 160 / 1024;
/**
 * The share of old content above which a revealed pixel is replaced WHOLE.
 *
 * See the note at `departedFully`: for a removal the strand opacity is not the
 * alpha, it is the evidence. A pixel a quarter covered by the departing hair is
 * still a contaminated pixel, and taking the plate at a quarter strength leaves
 * a ghost. Low rather than zero so that the projection's own noise floor cannot
 * vacate a whole shoulder, and so the outer edge still has somewhere to ramp.
 */
const REMOVAL_TOTAL_ABOVE = 0.25;
const scaled = (fraction: number, width: number, height: number) =>
  Math.max(4, Math.round(Math.min(width, height) * fraction));

/**
 * What a region looks like to this module. One call per named region, so the
 * caller owns which segmenter answers and this owns what is done with it.
 */
export type RegionReader = {
  /**
   * Everything the named region covers in this image.
   *
   * `absentIsAnswer` is the difference between *the model could not answer* and
   * *the answer is nowhere*, and conflating them is what made a removal
   * impossible. Asked of the MASTER for a region the record says is there, an
   * empty reply is a failed question and must refuse — composing on it would
   * deliver "nothing changed" at full price. Asked of the PAINTED frame after
   * *"take her glasses off"*, an empty reply is **the painter doing the job**,
   * and refusing it charges her for the picture she already had.
   *
   * The caller knows which of the two it is asking, so the caller says. Same
   * asymmetry D-235 drew for the reader's affirmatives: silence resolves in
   * whichever direction does not take the user's money, and which direction that
   * is depends on the question.
   */
  region(input: { image: Buffer; name: string; absentIsAnswer?: boolean }): Promise<Mask>;
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
  /**
   * RETURN THE WORKING, for calibration only.
   *
   * The alternative is a harness that rebuilds this pipeline to look inside it,
   * and that alternative has already cost this program three silent divergences
   * — `maskedRefine` and the calibration harness drifting apart while both stayed
   * green. A fixture that inspects THIS function's own masks cannot drift from
   * it. Off on every product path, and it only adds allocations.
   */
  explain?: boolean;
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
  /**
   * The masks this composite was actually built from, when `explain` was asked
   * for. `applied` is the canonical one: it is the only boundary source that
   * cannot disagree with the picture, and three of this session's four wrong
   * measurements came from checking against something else.
   */
  explain?: {
    zone: Mask;
    harvested: Mask;
    vacated: Mask;
    departed: Mask;
    delivered: Mask;
    applied: Mask;
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
const LANDMARK_OF_ACCESSORY: {
  words: readonly string[];
  landmark: string;
  drops: boolean;
  /**
   * WHAT TO ASK A SEGMENTER FOR ONCE IT EXISTS — the other half of the same
   * table, and it was missing.
   *
   * An addition cannot be segmented before it is painted, but it can be
   * segmented AFTER, and that is what the harvest asks. The name for that
   * question was a hardcoded `"earring"` fallback, so **an edit adding or
   * removing GLASSES harvested wherever her earrings were.** Exactly the defect
   * `landmarkNameOf` exists to prevent, one line lower down: `statedAccessories`
   * is one facet over several objects, and every question about it needs the
   * instruction as well as the facet.
   */
  region: string;
}[] = [
  { words: ["earring", "stud", "hoop", "dangle", "drop"], landmark: "earlobe", drops: true, region: "earring" },
  { words: ["glasses", "spectacles", "frames", "sunglasses", "eyewear"], landmark: "eye", drops: false, region: "glasses" },
  { words: ["nose ring", "nose stud", "septum", "nostril"], landmark: "nose", drops: false, region: "nose stud" },
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
  let best: { landmark: string; drops: boolean; region: string; length: number } | null = null;
  for (const entry of LANDMARK_OF_ACCESSORY) {
    for (const word of entry.words) {
      if (!said.includes(word)) continue;
      if (!best || word.length > best.length) {
        best = { landmark: entry.landmark, drops: entry.drops, region: entry.region, length: word.length };
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
 * HOW BIG THE ZONE IS FOR THIS FACET — every scope class handled by NAME, and
 * the unimplemented ones throwing rather than defaulting.
 *
 * # Why this is a switch and not a ternary
 *
 * It was `isDistributed(facet) ? dilate(region, 48) : region` — a five-valued
 * table collapsed to a boolean, so three classes shared one branch that had been
 * written for one of them. **`allSkin` was the casualty and it was silent:**
 * `zoneScope.ts` says a tan or a skin tone spans all visible skin, *"scoping a
 * tan to the face manufactures a body mismatch"* — and the adapter handed it
 * `region("face skin")`, which is her face. Her neck and arms would have kept
 * her old tone, and nothing anywhere would have said so.
 *
 * That is the same class as the `"earring"` fallback one screen up: **a default
 * that was true for the only implemented case and silent about being
 * scaffolding.** The rule the module already practices twenty lines above
 * (`REGION_OF_FACET` throws by name rather than inventing a prompt) applies to
 * every dispatch over a facet or an object type: handle the case, or throw
 * naming it. A default value may not stand in for an unimplemented branch.
 *
 * TypeScript's exhaustiveness check does the rest — a sixth `ZoneScope` stops
 * compiling here rather than quietly taking somebody else's branch.
 */
async function scopedZone(facet: Facet, region: Mask): Promise<Mask> {
  const scope = zoneScopeOf(facet);
  switch (scope) {
    case "distributedFacet":
      /* A pattern through a region is rendered WHOLE, with a destination
         allowance — scoping it to where it shows is the fringe error (D-233). */
      return dilateMask(region, 48);
    case "bilateralPair":
      /* Two regions, one question. The two sides are already unioned by the
         reader, which is the only door that rule cannot be forgotten behind. */
      return region;
    case "localFacet":
      /* The thing occupies one bounded place and stays there. */
      return region;
    case "allSkin":
      /*
        DECLARED, NOT IMPLEMENTED — and it says so instead of shipping a face.
        The honest zone is every visible patch of her skin (neck, chest, arms),
        which is a different segmentation question from "face skin" and does not
        have one written yet. Refusing costs a refund; the quiet version costs a
        customer a picture whose face and neck do not match.
      */
      throw new MaskError(
        `"${facet}" spans all of her visible skin, and this path can only ask about her face `
        + "— scoping it to the face would leave her neck and arms behind",
      );
    case "object":
      /* Unreachable: an addition's destination comes from a landmark, and those
         facets are filtered out before this runs. Named anyway — "it cannot get
         here" is the sentence every quiet default was written under. */
      throw new MaskError(`"${facet}" is an addition and is placed from a landmark, never segmented`);
    case "fullFrame":
      /* Unreachable: regionless facets are routed out before any zone is built.
         Kept so the switch is total rather than nearly total. */
      throw new MaskError(`"${facet}" is not a region edit and should never have reached a zone builder`);
    default: {
      const unhandled: never = scope;
      throw new MaskError(`facet "${facet}" has an unhandled zone scope ${String(unhandled)}`);
    }
  }
}

/**
 * THE REVEAL — territory the region USED to occupy and no longer does.
 *
 * Exported and pure so it can be driven with masks instead of with a painter.
 * The behaviour it encodes is the difference between a shrink that works and one
 * that is silently undone, and a test of it that has to summon a real render to
 * fire is a test of the render (working law #3).
 *
 * Read it as one sentence: **inside the zone, where her region was and the
 * painted one is not.** No instruction is consulted, so no phrasing can be
 * missed; a grow returns nothing here and takes the path it always took.
 */
export async function vacancyOf(input: {
  /** The outer bound. Vacancy can never exceed it, like every other claim. */
  zone: Mask;
  /** Where the thing is on HER picture — the territory that may be given up. */
  masterRegion: Mask;
  /** Where the painter left it. Empty is a legitimate answer: a removal. */
  paintedRegion: Mask;
  /** Grown before subtraction, so a jittering boundary vacates nothing. */
  tolerancePx: number;
}): Promise<Mask> {
  const kept = input.tolerancePx > 0
    ? await dilateMask(input.paintedRegion, input.tolerancePx)
    : input.paintedRegion;
  return intersectMask(input.zone, subtractMask(input.masterRegion, kept));
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
  let painted: Raster = await readRaster(input.painted.bytes);
  if (painted.width !== master.width || painted.height !== master.height) {
    /*
      MASTER HYGIENE, STATED RATHER THAN HIDDEN — and this is the line that
      refused the founder's first three real edits.
    
      **The MASTER is never resampled**, and that half does not bend: it is the
      picture the guarantee is about. The PATCH is another matter — we are about
      to discard most of it anyway, and the calibration harness has resized it
      since the first fixture for exactly that reason.
    
      Refusing outright was too strict for the wrong half. The engine is now
      told the exact size to return (`createFalMaskedEditEngine` pins
      `image_size`), so this should never fire; it stays as the honest fallback
      for an engine that ignores the ask, and it says so in the log rather than
      quietly resampling.
    */
    log.warn(
      {
        operationId: input.operationId,
        returned: `${painted.width}x${painted.height}`,
        master: `${master.width}x${master.height}`,
      },
      "[maskedRefine] the engine ignored the pinned size — resampling the PATCH, never the master",
    );
    const sharp = (await import("sharp")).default;
    painted = await readRaster(
      await sharp(input.painted.bytes)
        .resize(master.width, master.height, { fit: "fill" })
        .png()
        .toBuffer(),
    );
  }

  /*
    THE ZONE FOLLOWS THE FACET, NOT THE DELTA (D-233). A distributed facet — a
    cut, a colour, a texture — takes its whole region; scoping it to where the
    pixels move is what made a fringe into appliqué.
  */
  /* One paid segmentation per distinct question. Two facets that ask the same
     thing — `hair.cut` and `hair.colour` both segment "hair" — are one call. */
  const asked = new Map<string, Promise<Mask>>();
  const regionOf = (which: "master" | "painted", name: string, absentIsAnswer = false) => {
    const key = `${which}:${name}:${absentIsAnswer}`;
    const pending = asked.get(key)
      ?? input.reader.region({
        image: which === "master" ? input.master.bytes : input.painted.bytes,
        name,
        absentIsAnswer,
      });
    asked.set(key, pending);
    return pending;
  };

  let zone: Mask | null = null;
  for (let index = 0; index < segmentable.length; index += 1) {
    const region = await regionOf("master", names[index]);
    const scoped = await scopedZone(segmentable[index], region);
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

  /*
    THE HARVEST'S OWN QUESTION, named from the instruction for an object exactly
    the way its landmark is. It used to fall back to the literal string
    `"earring"` whenever no facet was segmentable, which is every pure accessory
    edit — so an ask about GLASSES harvested wherever her earrings were.
  */
  const harvestsAnObject = names.length === 0 && objects.length > 0;
  const harvestName = harvestsAnObject
    ? accessoryEntry(input.described)?.region ?? null
    : names[0] ?? null;
  if (!harvestName) throw new MaskError("nothing names what this edit is about — refusing to guess a region");

  /*
    WHERE THE THING IS *NOW* — and this is the question that makes a shrink
    possible, without anything ever classifying the instruction.

    For a segmentable facet the answer is already in hand (the zone was built
    from it, so this is a cache hit). For an object it is the honest question
    that separates an addition from a removal: she is wearing glasses, or she is
    not, and "nowhere" is a legitimate answer to it rather than a failure.
  */
  const masterRegion = await regionOf("master", harvestName, harvestsAnObject);
  /*
    FOR A REMOVAL, HER CURRENT OBJECT IS THE TERRITORY THAT MUST STOP BEING IT.

    The landmark corridor is two small discs at the eyes; her frames run out to
    her temples. A zone that does not contain the thing being removed cannot
    remove it — the harness's SHRINK arm has always taken the master's own region
    as the zone, and this is that, unioned rather than substituted so an addition
    keeps its destination allowance.
  */
  if (harvestsAnObject && coverage(masterRegion) > 0) zone = unionMasks(zone, masterRegion);

  const paintedSubject = await input.reader.subject({ image: input.painted.bytes });
  /*
    The harvest asks what the PAINTER actually drew. For an addition that is the
    object itself — now that it exists it can be segmented, which is the whole
    asymmetry: unsegmentable before, segmentable after. And for a removal the
    honest answer is *nothing*, which is the point rather than a problem.
  */
  const paintedContent = await regionOf("painted", harvestName, true);
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

  /*
    THE REVEAL — territory her region USED to occupy and the painted one no
    longer does. Without this the harvest is self-defeating in one direction and
    we charge for renders that were correct until we composited them.

    `harvestMatteFrom` asks where the thing IS in the painted frame. That is
    right for a growth and exactly wrong for a shrink or a removal: when a
    ponytail becomes an updo, the revealed shoulder is not "hair", so nothing is
    harvested there, alpha is zero, and **the master's old ponytail survives a
    perfect render.** Measured on the founder's own specimen (exhibit 32): the
    painter moved 19.2% and 18.1% of the two shoulder bands and the composite
    moved 0.0% of them. The same arithmetic makes a glasses removal keep the
    glasses.

    # Vacancy, not direction

    The obvious fix is to classify the instruction — shrink, grow, remove — and
    harvest differently per class. That would be a second vocabulary beside
    `namesRemoval`, and it would have to be right about *"tie her hair up"*,
    *"shorter"*, *"off the shoulders"* and every phrasing nobody has typed yet.

    This asks the pixels instead, which is the house direction of travel — the
    removal ruling (`96640590`) is *the record gates nothing; the picture
    decides*, and D-232 is *prefer the thing that CHANGED over the thing that was
    asked*. Where her region was and the painter's is not, the master pixel **is
    the thing being removed**, so reverting to it is the defect and the painter's
    reconstruction ships — her shoulder, her neck, the wall behind where the
    ponytail hung.

    All three edit classes fall out of the one formula as limiting cases, with
    nothing classifying anything:

      GROW     vacancy is empty; the path is byte-for-byte what it was
      SHRINK   vacancy is the revealed band; the harvest still governs the updo
      REMOVAL  vacancy is the whole region; the harvest is empty, correctly

    # What this costs the wall, stated rather than discovered

    The person-never-stage guarantee gets one honest amendment: **her surface
    reverts wherever it still exists, and a VACATED surface is the removed thing
    rather than her.** Everything outside the zone is untouched as before, and
    everything inside it that her region still occupies is still harvest-gated.

    Two defences against a segmenter that merely jitters between two frames of
    the same face — which would otherwise mint slivers of painter-background at
    an unchanged hair edge on a pure colour edit:

      TOLERANCE  the painted region is grown before subtraction, so a boundary
                 that wobbles a few pixels vacates nothing
      NOVELTY    the same measured-per-render criterion the harvest gate uses.
                 A pixel the painter did not actually change cannot be a reveal,
                 and "actually" is scaled against this render's own drift rather
                 than a constant.
  */
  const vacated = await vacancyOf({
    zone,
    masterRegion,
    paintedRegion: paintedContent,
    tolerancePx: scaled(VACANCY_TOLERANCE_FRACTION, master.width, master.height),
  });
  /*
    THE OLD CONTENT'S OWN STRANDS — D-230's arithmetic, run in the other
    direction, and the geometric term is a patch without it.

    First measurement of the reveal delivered the shoulder and left **a hard
    outline of surviving flyaways tracing where the ponytail had been**: the bulk
    vacated, a halo of strands still standing around an empty middle. The bands
    called it a pass — they cannot see a seam — and the 100% crop did not.

    The cause is the one this workstream has now met from three sides: **a
    SAM-class mask fills the SILHOUETTE.** Its boundary is a confidence frontier,
    so the bulk is inside it and the fine strands lying over her shirt are not.
    Vacating exactly that region removes exactly the bulk.

    D-230 closed the same defect for a GROW by noting we own the plate — the
    master IS the background, so the strand alpha is the exact projection of the
    observed move onto the move an opaque strand would make. A shrink owns the
    plate just as exactly, and it is the other frame: **the painter's
    reconstruction is what is there once the hair is gone.** So this is
    `differenceMatte` with the two frames swapped, and it reads off, per pixel,
    *how much old hair was here* — flyaways at their true partial alpha, which is
    the ramp the geometric boundary could not have.

    Not an approximation standing in for a segmentation; the same exact solution
    to the same compositing equation, pointed the other way. Bounded by the zone
    like every other claim, and narrowed by the same novelty gate below — a pixel
    the painter did not really change cannot be a strand that really left.
  */
  const departed = differenceMatte({
    master: painted,
    patch: master,
    confirmed: masterRegion,
    reachPx: scaled(DEPARTED_REACH_FRACTION, master.width, master.height),
  });
  /*
    A REVEAL IS NOT AN OVERLAY, AND THE ALPHA MEANS SOMETHING DIFFERENT.

    This is the arithmetic slip that left a ghost of the ponytail after the
    strands were being found correctly. `differenceMatte` returns an OPACITY —
    *how much of this pixel is the strand* — and for an overlay that is exactly
    the number to composite with: a 60% strand laid over her cheek should be 60%
    strand and 40% cheek.

    A removal inverts what that number is for. A master pixel holding a 60%
    strand is `0.6·strand + 0.4·shirt`, and compositing the plate at 0.6 leaves
    `0.24·strand` behind — the strand dimmed, not gone. Measured: the wisps came
    out at roughly a quarter strength and read as a ghost tracing exactly where
    her hair had been, which is a worse artifact than leaving them alone.

    **Where the thing being removed contributed at all, the pixel underneath is
    contaminated by it, so the plate must be taken WHOLE.** Opacity therefore
    stops being the alpha and becomes the QUESTION: was any of it here? Above a
    low floor the answer is yes and the replacement is total; below it the alpha
    ramps to nothing, which is what keeps the outer edge soft. The ramp moves
    from "how solid was the hair" to "where does hair content end" — and the
    second is the boundary a viewer can actually see.

    This is also why the contour appeared at the segmentation boundary: inside it
    the vacancy was 255 and just outside it the strand opacity was ~128, so the
    two terms met in a step. With the floor applied they meet at 255 and the only
    ramp left is at the true end of the hair.
  */
  const departedFully: Mask = {
    data: Buffer.from(departed.alpha.data.map((value) =>
      Math.min(255, Math.round(value / REMOVAL_TOTAL_ABOVE)))),
    width: departed.alpha.width,
    height: departed.alpha.height,
  };
  /*
    THROUGH THE SAME FENCE, and this is not tidiness — it is what keeps a GROW
    on the path it was always on.

    The projection asks whether the master moved toward the old content's colour
    relative to the painter's frame, and on a growth that question has a
    misleading answer: her shirt against a NEW head of hair projects onto
    (old hair − new hair) perfectly well, so the term would claim territory the
    harvest gate is supposed to govern and hand it the painter's frame ungated.

    The fence is the one the geometric term already uses: **nothing departed
    where the painter still has the thing.** A grow therefore produces an empty
    reveal by construction rather than by a threshold happening to hold.

    **REASONED, NOT MEASURED — say so rather than let a green suite imply it.**
    The leak above is derived from the arithmetic; no fixture in this suite has
    been driven red by removing this fence, because the synthetic frames are
    64x64 and the frame-fraction reaches collapse to about ten pixels there. What
    IS measured is that it costs the shrink nothing: the founder's specimen gives
    identical shoulder bands with and without it. So this is cheap insurance
    against a derived hazard, and it stays on the honest side of the line the
    visibility gate drew — built and wired, not calibrated.
  */
  const departedVacated = await vacancyOf({
    zone,
    masterRegion: departedFully,
    paintedRegion: paintedContent,
    tolerancePx: scaled(VACANCY_TOLERANCE_FRACTION, master.width, master.height),
  });
  const vacancy = unionMasks(vacated, departedVacated);

  /*
    The painter's own drift, measured per render — from territory this composite
    claims NOTHING in. The vacancy is claimed, so it is excluded from the sample
    for the same reason the harvest always was: a baseline drawn through the loud
    part of the frame raises the bar the loud part then has to clear.
  */
  const claimed = unionMasks(withStrands, vacancy);
  const quietSamples: number[] = [];
  for (let pixel = 0; pixel < claimed.data.length; pixel += 1) {
    if (claimed.data[pixel] !== 0 || pixel % 37 !== 0) continue;
    const at = pixel * 3;
    quietSamples.push((Math.abs(painted.data[at] - master.data[at])
      + Math.abs(painted.data[at + 1] - master.data[at + 1])
      + Math.abs(painted.data[at + 2] - master.data[at + 2])) / 3);
  }
  quietSamples.sort((a, b) => a - b);
  const baselineDelta = quietSamples[Math.floor(quietSamples.length / 2)] ?? 0;

  /* Only what is really the new content — not her surface rendered again. */
  const harvested = harvestGate({
    master, patch: painted, alpha: withStrands, strandColour: strands.strandColour, baselineDelta,
  }).alpha;
  /*
    The reveal is narrowed by the SAME gate on the SAME criterion, and only that
    one — `novelty` asks *is this her surface*, which is precisely the jitter
    question. The strand projection would be the wrong question entirely: what
    lands in a reveal is background and skin, and asking it to look like hair
    would revert every pixel of it.
  */
  const revealed = harvestGate({
    master, patch: painted, alpha: vacancy, strandColour: strands.strandColour,
    baselineDelta, criterion: "novelty",
  }).alpha;
  const gated = unionMasks(harvested, revealed);

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
    ...(input.explain
      ? {
        explain: {
          zone: grown.zone,
          harvested,
          vacated,
          departed: departed.alpha,
          delivered: gated,
          applied: composed.applied,
        },
      }
      : {}),
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
