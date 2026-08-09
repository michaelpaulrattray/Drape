/**
 * WHERE AN EDIT IS ALLOWED TO HAPPEN — the LAWS, not the outlines.
 *
 * `maskedComposite` enforces a mask; this decides what the mask is allowed to
 * be. The laws here are product laws, not image-processing ones, and they are
 * the kind that get remembered at three call sites and forgotten at the fourth.
 * They are structural instead: you cannot ask this module for a hair mask that
 * includes the face, because there is no argument for it.
 *
 * # Masks come from segmentation machinery, never from geometry (founder rider)
 *
 * **A production mask is never hand-authored.** Named facial regions come from a
 * face-parsing model; hair and every other soft boundary comes from an
 * **alpha-matting** model — a matte, not a binary outline; arbitrary objects
 * come from SAM-class point/box segmentation. fal's catalogue is where we shop,
 * since the keys already exist.
 *
 * The reason is the same one that killed the vision judge: an ellipse over a
 * face is a GUESS at where the face is, and a guess dressed as a boundary is the
 * D-210 family — a control that looks exact and is not. A crude mask does not
 * fail loudly; it produces a slightly wrong edit with a hard edge, and the seam
 * is the only symptom.
 *
 * So **mask quality is scored by the seam gate like everything else**, and the
 * segmentation model is a routing-table row. If a mask reads crude in the
 * side-by-sides, **swap the model and re-run — never tune around it.**
 *
 * Everything below therefore operates on MASKS, from any source. The shape
 * rasteriser at the bottom exists to build fixtures for tests that must not cost
 * a credit; it is not a way to make a mask for a paying user, and it says so.
 *
 * # Soft mattes, and what that costs the guarantee
 *
 * A matte is continuous, not binary. The algebra below is written for that —
 * union is `max`, subtraction is `min(a, 255 - b)` — which reduces to the binary
 * behaviour when both sides are hard. The honest consequence: with a soft matte,
 * more of the frame sits in the blend band, so the region that is provably
 * byte-identical is smaller. It is still exact where the matte is zero, and the
 * band is still measured rather than assumed (D-209).
 */
import sharp from "sharp";

import { distanceOutside, type Mask } from "./maskedComposite";

/**
 * Where a production mask comes from. One model per region kind, chosen by
 * evidence and recorded in the routing table — not a single segmenter asked to
 * do everything.
 */
export type SegmentationSource = {
  /** Model id, so a mask can be traced to the thing that drew it. */
  id: string;
  /**
   * A matte for one named region, at the master's exact resolution — resizing a
   * mask to fit is a resample inside the one path that promises not to (§5).
   */
  matte(input: {
    image: Buffer;
    region: RegionKind;
    width: number;
    height: number;
  }): Promise<Mask>;
};

/** A normalised shape. Ellipse for anything anatomical; rect for a crop. */
export type Shape =
  | { kind: "rect"; left: number; top: number; right: number; bottom: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number };

export class MaskError extends Error {}

/** Every region an instruction can be scoped to. */
export type RegionKind =
  | "hair"
  | "eyes"
  | "brows"
  | "eyewearFrames"
  | "eyewearLenses"
  | "skin"
  | "mouth"
  | "ears";

export type RegionSpec = {
  kind: RegionKind;
  /** Where the edit may write. */
  include: Shape[];
  /**
   * Where it may NOT, whatever `include` says. Subtracted last, so an exclusion
   * can never be overridden by adding another include.
   */
  exclude?: Shape[];
};

function inside(shape: Shape, x: number, y: number): boolean {
  if (shape.kind === "rect") {
    return x >= shape.left && x < shape.right && y >= shape.top && y < shape.bottom;
  }
  const dx = (x - shape.cx) / (shape.rx || 1e-9);
  const dy = (y - shape.cy) / (shape.ry || 1e-9);
  return dx * dx + dy * dy <= 1;
}

/**
 * Rasterise a spec into a hard single-channel mask. **FIXTURES ONLY.**
 *
 * This is how the laws above are tested for free — an ellipse is a perfectly
 * good stand-in for a face when what you are proving is that the face gets
 * carved out, and a test that needed a segmentation model would cost a credit
 * per assertion and behave differently per vendor.
 *
 * It is **not** how a paying user's mask is made. A hand-drawn ellipse is a
 * guess at where a face is, and a guess dressed as a boundary is the D-210
 * family: it does not fail loudly, it produces a slightly wrong edit with a hard
 * edge. Production masks come from face parsing, alpha matting and SAM-class
 * segmentation (see `SegmentationSource`).
 *
 * **One byte per pixel, allocated from `width * height`** — the stride is
 * constructed rather than inherited, which is D-210's first door closed at the
 * point the buffer is born.
 */
export function rasterise(
  spec: RegionSpec,
  width: number,
  height: number,
): Mask {
  if (width <= 0 || height <= 0) throw new MaskError("mask needs a positive size");
  const data = Buffer.alloc(width * height, 0);
  for (let y = 0; y < height; y += 1) {
    /* Pixel centres, so a shape's edge lands where it should rather than half a
       pixel out — which shows on a small feature like a brow. */
    const ny = (y + 0.5) / height;
    for (let x = 0; x < width; x += 1) {
      const nx = (x + 0.5) / width;
      if (!spec.include.some((shape) => inside(shape, nx, ny))) continue;
      if (spec.exclude?.some((shape) => inside(shape, nx, ny))) continue;
      data[y * width + x] = 255;
    }
  }
  return { data, width, height };
}

/* ---- mask algebra: the laws run on MATTES, whatever drew them ---- */

function assertStride(mask: Mask, what: string): void {
  /* D-210, at every entry point. A matte arriving from a segmenter is exactly
     the kind of buffer whose channel count we did not choose. */
  if (mask.data.length !== mask.width * mask.height) {
    throw new MaskError(
      `${what} must be single-channel: ${mask.data.length} bytes for `
      + `${mask.width}x${mask.height}`,
    );
  }
}

function assertSameSize(a: Mask, b: Mask): void {
  if (a.width !== b.width || a.height !== b.height) {
    throw new MaskError("masks must share the master's resolution — never resize one to fit");
  }
}

/**
 * Union — `max`, because a matte is continuous.
 *
 * Reduces to binary OR when both sides are hard, which is what makes the same
 * law work whether the mask came from a face parser or a test fixture.
 */
export function unionMasks(...masks: Mask[]): Mask {
  if (masks.length === 0) throw new MaskError("nothing to union");
  masks.forEach((mask, index) => assertStride(mask, `mask ${index}`));
  masks.slice(1).forEach((mask) => assertSameSize(masks[0], mask));
  const data = Buffer.from(masks[0].data);
  for (const mask of masks.slice(1)) {
    for (let index = 0; index < data.length; index += 1) {
      if (mask.data[index] > data[index]) data[index] = mask.data[index];
    }
  }
  return { data, width: masks[0].width, height: masks[0].height };
}

/**
 * Subtraction — `min(a, 255 - b)`, so a soft carve-out stays soft.
 *
 * A hard subtraction of a matte would put a binary edge back into the one place
 * the matte was protecting: a face parser's jawline is soft on purpose, and
 * carving it out with a threshold reintroduces the cut-out the matte avoided.
 */
export function subtractMask(base: Mask, cut: Mask): Mask {
  assertStride(base, "base mask");
  assertStride(cut, "cut mask");
  assertSameSize(base, cut);
  const data = Buffer.allocUnsafe(base.data.length);
  for (let index = 0; index < data.length; index += 1) {
    const allowed = 255 - cut.data[index];
    data[index] = base.data[index] < allowed ? base.data[index] : allowed;
  }
  return { data, width: base.width, height: base.height };
}

/**
 * PAINT-ALLOWANCE — a generous dilation for destination zones only.
 *
 * The founder's rider draws the line exactly: a destination zone may be a coarse
 * dilation, because hair being lengthened needs somewhere to go and nobody can
 * segment hair that does not exist yet. **But every VISIBLE blend edge uses a
 * fine matte.** So a dilation is legitimate where it is buried under new paint,
 * and never as the thing the composite feathers against at the outer boundary.
 *
 * Blur-and-threshold rather than a true morphological dilate: sharp has no
 * dilate for raw single-channel buffers, and the low threshold makes this grow
 * outward the way a dilation does. It is coarse ON PURPOSE and used only where
 * coarse is allowed.
 */
export async function dilateMask(mask: Mask, radius: number): Promise<Mask> {
  assertStride(mask, "mask");
  if (radius <= 0) return mask;
  const { data, info } = await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  })
    .blur(radius)
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const grown = Buffer.allocUnsafe(data.length);
  for (let index = 0; index < data.length; index += 1) grown[index] = data[index] > 8 ? 255 : 0;
  return { data: grown, width: info.width, height: info.height };
}

/**
 * THE HAIR MASK, FROM MATTES — the carve-out law, on real segmentation.
 *
 * Same law as `hairRegion`, with nothing hand-drawn: the hair matte and the face
 * matte both come from models, and the face is subtracted softly so the jawline
 * stays a matte rather than becoming an outline.
 */
export function hairMaskFrom(input: {
  hair: Mask;
  face: Mask;
  /** Coarse paint-allowance for growth, already dilated. Optional. */
  destination?: Mask;
}): Mask {
  const reach = input.destination
    ? unionMasks(input.hair, input.destination)
    : input.hair;
  return subtractMask(reach, input.face);
}

/**
 * THE EYE MASK, FROM MATTES — frames protected, lenses regenerating.
 *
 * The frame matte is subtracted rather than thresholded for the same reason: a
 * wire frame is thin and partly transparent at its edges, and a binary cut would
 * either eat the eye around it or leave a halo of old frame.
 */
export function eyeMaskFrom(input: {
  eyes: Mask;
  lenses?: Mask;
  frames?: Mask;
}): Mask {
  const reach = input.lenses ? unionMasks(input.eyes, input.lenses) : input.eyes;
  return input.frames ? subtractMask(reach, input.frames) : reach;
}

/** How much of the frame a mask covers, 0..1. */
export function coverage(mask: Mask): number {
  /*
    WEIGHTED BY ALPHA, because a matte is not a count of pixels. Counting any
    non-zero byte would score a broad, mostly-transparent halo as though it were
    solid coverage — and the two refusals below are what stand between a user and
    a paid render that changes nothing or repaints everything. They should be
    measuring how much paint actually lands.
  */
  let sum = 0;
  for (let index = 0; index < mask.data.length; index += 1) sum += mask.data[index];
  return sum / (mask.width * mask.height * 255);
}

/**
 * How much of the frame a mask covers COUNTING PIXELS, 0..1 — the presence
 * arithmetic, which is a different question from the one above.
 *
 * `coverage` weighs by alpha because it governs how much paint lands. *Is this
 * thing in the picture at all* is not a question about paint: a segmenter's
 * binary answer has no ramp to weigh, and a soft-edged answer's ramp is the
 * thing's own boundary rather than its opacity. Weighing by alpha there would
 * make a wire frame read as less present than a lens, which is not a fact about
 * her face.
 *
 * Two arithmetics, one each, both named — rather than one that is subtly wrong
 * for whichever caller did not write it. This is the one the glasses floor was
 * measured with (`GLASSES_COVERAGE_FLOOR`), so it is the one the born-worn
 * detector reads with too.
 */
export function binaryCoverage(mask: { data: Buffer | Uint8Array; width: number; height: number }): number {
  const area = mask.width * mask.height;
  if (area <= 0) return 0;
  let covered = 0;
  for (let index = 0; index < mask.data.length; index += 1) {
    if (mask.data[index]! > 0) covered += 1;
  }
  return covered / area;
}

/**
 * A mask that selects nothing is a paid render that changes nothing.
 *
 * The composite would faithfully return the master, the verification net would
 * find the fact missing, and the user would be charged for a picture identical
 * to the one they already had. Refusing here is free; discovering it after
 * dispatch is not.
 *
 * The ceiling is the other half. A "local" edit covering most of the frame is
 * not local — it is a full re-render wearing a mask's clothes, and it would
 * carry all the drift the mask exists to prevent while claiming to be safe.
 */
const MIN_COVERAGE = 0.0005;
const MAX_COVERAGE = 0.6;

/**
 * A mask that has PASSED the refusals. The only way to get one is to be checked.
 *
 * **Invariant 7, enforced by the type system instead of by memory.** Both
 * refusals below were, at the moment they were written, controls with no call
 * site — the masked render path does not exist yet, so a test proving
 * `assertUsable` throws proved only that a function throws. That is the exact
 * shape of every inert control this program has catalogued: helper written, docs
 * written, todo ticked, call site never added.
 *
 * A driver cannot close that, because there is nothing yet to drive. So the
 * guarantee is moved to where forgetting is impossible: **the paid render path
 * will take a `UsableMask`, and the only function that produces one is the one
 * that runs the checks.** A caller who skips the check cannot compile.
 */
export type UsableMask = Mask & { readonly __checked: unique symbol };

/**
 * PLAUSIBLE SIZE PER REGION CLASS — guard two of three (D-213).
 *
 * One global floor cannot tell a 0.1% blob that is a reasonable pair of brows
 * from a 0.1% blob that is a hallucinated pair of glasses. A glasses mask has a
 * size range; so does hair; so do brows. Outside its own class's band, a mask is
 * refused as malformed rather than accepted for clearing a global minimum.
 *
 * **Provisional, and honestly so.** Seeded from the first shop's measurements on
 * one specimen (hair 4.4%, face 10.6%, brows 1.5%) with generous margins, which
 * is a starting point rather than a calibration. They tighten when the fixture
 * has more than one face in it, and the numbers live here so that tightening is
 * one edit rather than a hunt.
 */
export const COVERAGE_BANDS: Record<RegionKind, { min: number; max: number }> = {
  hair: { min: 0.01, max: 0.35 },
  eyes: { min: 0.0008, max: 0.03 },
  brows: { min: 0.0005, max: 0.02 },
  eyewearFrames: { min: 0.004, max: 0.06 },
  eyewearLenses: { min: 0.004, max: 0.08 },
  skin: { min: 0.02, max: 0.4 },
  mouth: { min: 0.001, max: 0.03 },
  ears: { min: 0.001, max: 0.04 },
};

/** How much of `mask` lands inside `prior`, 0..1 — guard three's measure. */
export function overlapWith(mask: Mask, prior: Mask): number {
  assertStride(mask, "mask");
  assertStride(prior, "prior");
  assertSameSize(mask, prior);
  let inside = 0;
  let total = 0;
  for (let index = 0; index < mask.data.length; index += 1) {
    const alpha = mask.data[index];
    if (!alpha) continue;
    total += alpha;
    if (prior.data[index]) inside += alpha;
  }
  return total ? inside / total : 0;
}

/** A mask must land mostly where its own anatomy says it can. */
const MIN_PRIOR_OVERLAP = 0.5;

export type MatteRequest = {
  image: Buffer;
  region: RegionKind;
  width: number;
  height: number;
  /**
   * THE RECORD GATE — guard one, and the only structural one.
   *
   * Does the record say this face HAS one? Base-worn inventory, the
   * presentation pin, the recipe. We never ask a segmentation model an open
   * question, because the first shop asked one — *"where are her eyeglasses?"* on
   * a woman wearing none — and got a confident little blob back that would have
   * cleared the empty-mask floor and landed an edit on nothing.
   *
   * With this gate the phantom cannot arise: the model is never asked the
   * question it hallucinated an answer to. Same shape as the removal fix in
   * D-206 — **consult the record before acting on the world.**
   *
   * An ADD of an absent feature does not come through here at all. It uses a
   * destination zone derived from anatomy, because segmenting a thing that does
   * not exist yet is the request that has no honest answer.
   */
  present: boolean;
  /**
   * THE SILHOUETTE LAW — guard four, and the same refusal as `present` wearing
   * different clothes (D-218, founder-ratified 2026-08-06).
   *
   * Does this edit change the region's OUTLINE, or only what is inside it?
   *
   *   false   recolour an iris, retexture skin, change a brow's weight — the
   *           object keeps its shape, so a tight segmentation of the object as
   *           it currently is is exactly the right destination
   *   true    swap in bolder glasses, lengthen hair, broaden a jaw — the new
   *           outline is somewhere the old outline is not
   *
   * Asked with `true`, this refuses. **A tight segmentation of the current
   * object is a destination zone for the object that is already there**, so an
   * engine drawing a larger frame paints outside the footprint, gets clipped at
   * the boundary, and leaves the new rim sitting inside the old rim's edges.
   * That is exactly what FLUX.2 Pro produced on the glasses fixture — ghosted
   * doubled frames — and the reason was structural rather than a bad model day.
   *
   * The kinship with `present` is worth seeing, because it is why both live
   * here: **you cannot segment a thing that is not there yet.** An accessory
   * being ADDED is not there yet; a reshaped object's new outline is not there
   * yet either. Both roads lead to a destination zone derived from anatomy and
   * grown, never to a matte of the status quo.
   */
  changesSilhouette: boolean;
  /** Where this region can anatomically be. Optional only where none exists. */
  prior?: Mask;
  /**
   * THE VISIBILITY GATE — guard five, and the third refuse-before-dispatch.
   *
   * Supplied whenever something could plausibly be in front of this region: the
   * current master's hair matte for an ear or an earring, the hair for a brow
   * under a fringe. Absent means nothing covers it, which is the common case and
   * must stay cheap to say.
   *
   * See `assertVisible` for why the matte is the authority and the presentation
   * pin only an optimisation, and for why the bar is near-total rather than
   * generous — a false refusal is the failure this program has already shipped
   * once and does not get to ship again.
   */
  visibility?: {
    /** What currently sits in front, from the CURRENT master. */
    occluder: Mask;
    /** Where the item would sit. Defaults to `prior` — the anatomy — when omitted. */
    item?: Mask;
    /** Offered in the re-ask: the edit that would make it visible. */
    enabledBy?: string;
    /** Offered in the re-ask, and scored before it is offered. See `assertVisible`. */
    alternative?: { label: string; item: Mask };
  };
};

/**
 * ⚠ **THIS HAS NO PRODUCTION CALL SITE, AND SAYING SO IS THE POINT.**
 *
 * It was written as *"the one way to get a mask from a model, with all the
 * guards in the contract rather than in the callers"*, and that sentence was
 * true of the design and never of the code. The paid path is
 * `maskedRefine.harvestRefinement`, which reads regions straight off a
 * `RegionReader` and has never called this. A module describing itself as the
 * only door, with nobody walking through it, is invariant 7 exactly — a control
 * that is not invoked does not exist — and D-231's sibling: **spec'd-but-never-
 * implemented is the invoked-but-inert class wearing better paperwork.**
 *
 * It is kept, deliberately, rather than deleted or wired:
 *
 *   `present` (D-213)      **a live gap on the product path.** Nothing gates the
 *                          question before it is asked, so an ADD of an absent
 *                          distributed facet — "give him a beard" on a clean-
 *                          shaven man — segments "facial hair" on a face that
 *                          has none. That is the phantom this guard exists for.
 *                          The harvest NARROWS it — a phantom landing where the
 *                          painter drew nothing yields an empty harvest and an
 *                          honest refund — but does not close it: when the
 *                          painter draws the beard it was asked for, the guess
 *                          and the paint agree and the edit lands on a face that
 *                          has no beard. QUEUED, NAMED, NOT CLOSED; marked by a
 *                          current-behaviour test in `maskedRefine.test.ts`.
 *   `changesSilhouette`    **measured, and it does not bite on this path.** The
 *                          predicted defect was that fuller lips would be
 *                          clipped at her current lip line. Driven on a real
 *                          render (`scripts/calibration/fuller-lips.mts`): the
 *                          boundary-contact auto-expand grew the scoped zone
 *                          23.6x and 1,905 px were delivered beyond it — the
 *                          fuller lip is there in the picture. `expandUntilClear`
 *                          IS the destination allowance D-218 asks for, reached
 *                          by a different route. Adding a shape dimension to the
 *                          zone-scope table would be a second mechanism doing a
 *                          ratified mechanism's job, which is law #4.
 *   `visibility`           built and wired here, never calibrated (D-226).
 *
 * So this is a specification with tests, not a control. **Do not cite it as
 * enforcement of anything.** Wiring it would mean mapping `RegionKind` onto the
 * facet vocabulary and teaching it to GROW a zone rather than refuse — that is
 * a real piece of work with a real design question in it, and pretending it is
 * already done is the more expensive option.
 */
export async function requestMatte(
  source: SegmentationSource,
  request: MatteRequest,
): Promise<UsableMask> {
  if (!request.present) {
    throw new MaskError(
      `the record says this face has no ${request.region} — refusing to ask a `
      + "segmentation model where it is",
    );
  }
  /*
    Refused BEFORE the model is called, like the record gate above it. There is
    nothing to learn from segmenting the old shape when the edit is about to
    change it, and paying for that answer would only produce a mask that clips
    the result.
  */
  if (request.changesSilhouette) {
    throw new MaskError(
      `this edit changes the ${request.region} silhouette — a matte of the current `
      + "shape would clip the new one; use a grown destination zone",
    );
  }
  /*
    Third of the family, and refused before the model like both siblings. An
    edit predicted invisible never silently charges — "don't spend on a question
    the record already answers", except that here the answer comes from the
    pixels rather than the record, which is stronger.
  */
  if (request.visibility) {
    const item = request.visibility.item ?? request.prior;
    if (!item) {
      throw new MaskError(
        `a visibility check on ${request.region} needs somewhere the item would sit — `
        + "pass `visibility.item` or `prior`",
      );
    }
    assertVisible({
      item,
      occluder: request.visibility.occluder,
      what: request.region,
      enabledBy: request.visibility.enabledBy,
      alternative: request.visibility.alternative,
    });
  }
  const mask = await source.matte({
    image: request.image,
    region: request.region,
    width: request.width,
    height: request.height,
  });
  assertStride(mask, `${request.region} matte from ${source.id}`);
  if (mask.width !== request.width || mask.height !== request.height) {
    /* Never resize a mask to fit — that is a resample inside the one path that
       promises not to have one (§5), and it moves every edge it touches. */
    throw new MaskError(
      `${source.id} returned a ${mask.width}x${mask.height} ${request.region} matte for a `
      + `${request.width}x${request.height} master`,
    );
  }
  const band = COVERAGE_BANDS[request.region];
  const area = coverage(mask);
  if (area < band.min || area > band.max) {
    throw new MaskError(
      `${source.id} returned a ${request.region} matte covering ${(area * 100).toFixed(2)}% — `
      + `outside the ${(band.min * 100).toFixed(2)}–${(band.max * 100).toFixed(2)}% this region `
      + "can plausibly be",
    );
  }
  if (request.prior && overlapWith(mask, request.prior) < MIN_PRIOR_OVERLAP) {
    throw new MaskError(
      `${source.id} put most of its ${request.region} matte outside the anatomy — malformed`,
    );
  }
  return assertUsable(mask, request.region);
}

export function assertUsable(mask: Mask, kind: RegionKind): UsableMask {
  const area = coverage(mask);
  if (area < MIN_COVERAGE) {
    throw new MaskError(`the ${kind} region selects nothing — nothing would change`);
  }
  if (area > MAX_COVERAGE) {
    throw new MaskError(
      `the ${kind} region covers ${Math.round(area * 100)}% of the frame — that is a `
      + "re-render, not a local edit",
    );
  }
  return mask as UsableMask;
}

/**
 * Intersection — `min(a, b)`. The operation D-216 named and the module lacked.
 *
 * Reduces to binary AND on hard inputs, like its siblings, and keeps a soft
 * side soft: intersecting a region with a matte is how a hair mask gets an edge
 * it can actually blend on.
 */
export function intersectMask(a: Mask, b: Mask): Mask {
  assertStride(a, "mask a");
  assertStride(b, "mask b");
  assertSameSize(a, b);
  const data = Buffer.allocUnsafe(a.data.length);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = a.data[index] < b.data[index] ? a.data[index] : b.data[index];
  }
  return { data, width: a.width, height: a.height };
}

/**
 * THE PART OF A CLAIM THAT IS ATTACHED TO THE THING IT IS ABOUT.
 *
 * A flood fill through `mask`, starting from every pixel of it that touches
 * `seed`. Everything the fill cannot reach is dropped.
 *
 * # Why an object's own edge is a connectivity question
 *
 * The reversed difference matte answers *what content LEFT this region* with a
 * reach of 160px, because a shrinking ponytail's old flyaways lie that far from
 * the mass they belonged to. For a REMOVAL the same recovery is asked a much
 * smaller question — where does this object's anti-aliased edge and contact
 * shadow run — and at that reach it also returns scattered specks all over the
 * face wherever her master happens to sit a few levels toward the frames'
 * colour. Feeding those to a grow-until-clear loop makes the loop chase them:
 * measured, it ran to its pass ceiling and returned a territory ninety-six
 * pixels wider than her glasses.
 *
 * The bound is not a smaller number, it is the physical fact: **the edge of a
 * thing is joined to the thing.** A speck across her cheek is not her frames'
 * boundary however dark it is, and no pad or threshold expresses that as well as
 * asking whether it is connected.
 *
 * Four-connectivity, deliberately: eight would walk diagonal noise across a
 * one-pixel gap, which is the failure this exists to prevent. The honest limit,
 * stated: a genuine contact shadow separated from the object by a clean gap of
 * background is dropped. That is the safe direction — it leaves a pixel to her
 * master rather than handing her one that was never the thing that left.
 */
export function attachedTo(mask: Mask, seed: Mask): Mask {
  assertStride(mask, "mask");
  assertStride(seed, "seed");
  assertSameSize(mask, seed);
  const { width, height } = mask;
  const kept = Buffer.alloc(mask.data.length, 0);
  const queued = new Uint8Array(mask.data.length);
  const stack: number[] = [];

  /* The seeds: mask pixels that touch the thing itself. The matte never fires
     INSIDE the region it was confirmed from, so an intersection would be empty
     — adjacency is the join, not overlap. */
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (mask.data[pixel] === 0 || seed.data[pixel] > 0) continue;
      const touching = (x > 0 && seed.data[pixel - 1] > 0)
        || (x < width - 1 && seed.data[pixel + 1] > 0)
        || (y > 0 && seed.data[pixel - width] > 0)
        || (y < height - 1 && seed.data[pixel + width] > 0);
      if (touching) { queued[pixel] = 1; stack.push(pixel); }
    }
  }

  while (stack.length > 0) {
    const pixel = stack.pop()!;
    kept[pixel] = mask.data[pixel];
    const x = pixel % width;
    const y = (pixel - x) / width;
    const neighbours = [
      x > 0 ? pixel - 1 : -1,
      x < width - 1 ? pixel + 1 : -1,
      y > 0 ? pixel - width : -1,
      y < height - 1 ? pixel + width : -1,
    ];
    for (const neighbour of neighbours) {
      if (neighbour < 0 || queued[neighbour] === 1 || mask.data[neighbour] === 0) continue;
      queued[neighbour] = 1;
      stack.push(neighbour);
    }
  }
  return { data: kept, width, height };
}

/**
 * How far the content segmentation is grown before it meets the matte.
 *
 * D-216 measured why this cannot be zero: a SAM-class segmenter draws a HARD
 * edge, and on hair that edge sits INSIDE the matte's flyaway zone. Intersecting
 * the two directly therefore clips off exactly the wisps the matte was brought in
 * for — ramp share 0%. Growing the hard region a few pixels first lets the
 * matte's own soft edge govern: ramp 17.4%, wisps survive.
 *
 * Provisional at 4 on one specimen. r=16 visibly bleeds onto the forehead, so
 * the useful band is narrow and the number lives here rather than at call sites.
 */
const DEFAULT_HARVEST_GROWTH = 4;

/**
 * THE HARVEST GATE — founder law, 2026-08-06. **Hair is a layer over the master
 * world**, and this is the arithmetic that makes that true.
 *
 * A destination zone may cover ANY territory the style plausibly reaches: face,
 * ears, shoulders, clothing, background. That generosity is safe — and only safe
 * — because of what happens on the way out: **only matte-confirmed content
 * survives the composite, and every other pixel inside the zone reverts to the
 * master.** Forehead skin, t-shirt fabric and wall alike. A 30%-alpha strand is
 * 30% new hair over 70% of her actual cheek.
 *
 * It is the glasses doctrine in reverse — there the master composites over the
 * paint, here the painted strands composite over the master — and in both **the
 * skin in the sandwich is always hers.** Geometric carve-outs govern where the
 * two agree; harvest-gating governs where they conflict.
 *
 * **Corollary, and the reason this is a law rather than a finish trick: it
 * enforces person-never-stage BY CONSTRUCTION.** The painter returns a whole
 * frame and repaints all of it — on the specimen this was measured against,
 * 99.6% of pixels moved and the sleeves and neckline were visibly displaced.
 * None of that can reach the customer, because none of it is hair.
 *
 * # The defect this exists to prevent, which shipped once
 *
 * The first version passed BiRefNet's **subject** matte here. A subject matte is
 * opaque across the whole person, so it confirms the painter's repainted
 * CLOTHING as readily as the hair, and the wall silently did nothing. It looked
 * enforced only because the fixtures ran hair against a plain wall, where there
 * was no clothing inside the zone for it to fail on. **The mechanism was right;
 * the input was wrong** — which is why this function takes the two masks
 * separately and names what each one is for.
 *
 *   `content`   WHERE the overlay content is — a SAM-class segmentation of the
 *               region kind being edited, run on the PATCH. Binary, and that is
 *               fine; it is not the visible edge.
 *   `matte`     the soft edge ramp on that same patch. It supplies strand
 *               texture, not territory.
 *
 * Neither alone is the harvest matte: the first has no blendable edge, the
 * second has no opinion about what the pixels are.
 *
 * # NAMED LIMIT — the gate is exactly as good as `content`
 *
 * Everything above is arithmetic and cannot be argued with. What CAN be wrong is
 * the segmentation feeding it, and it has been: asked for "hair" on a patch
 * where the painter had turned her glasses into dark sunglasses, SAM 3 returned
 * the LENSES as hair — dark, adjacent to dark hair, high contrast against skin —
 * and the harvest faithfully harvested them
 * (`output/masked/anchoring-relative/LOOK-anchored-3.png`).
 *
 * So the wall does not fail open in the sense of leaking everything; it fails
 * exactly where the segmenter is confused, and a dark accessory beside dark hair
 * is a known confusion. The module's own standing rule is the answer and it is
 * not tuning: **if a mask reads wrong in the side-by-sides, swap the model and
 * re-run.** A second, independent confirmation — asking a different segmenter
 * for the accessory and subtracting it — is the shape of the fix if this recurs,
 * and it composes with `occludedBy` rather than needing new machinery.
 */
export async function harvestMatteFrom(input: {
  /** Segmentation of the overlay content, on the PATCH — never on the master. */
  content: Mask;
  /** Soft matte on the same patch, for the edge ramp only. */
  matte: Mask;
  /** How far to grow `content` before intersecting. See `DEFAULT_HARVEST_GROWTH`. */
  growPx?: number;
  /**
   * THE DEPTH STACK, and it is one subtraction rather than machinery.
   *
   * Overlay content sits at a depth: background → clothes → earrings → hair and
   * glasses. An earring added under hair worn over the ears must render BEHIND
   * that hair — studs occluded, drops emerging below the hair's edge — and the
   * honest way to get that is not to ask a model to remember it.
   *
   * Pass the layers that sit IN FRONT, taken from the CURRENT MASTER's mattes.
   * Subtracting them from the harvest means painted pixels land only where
   * nothing of hers already covers that spot, so the master's own hair composites
   * over the new earrings **by construction**. Soft subtraction keeps it
   * physical: a 30%-alpha strand lets 70% of the earring through, which is what a
   * real strand does to the light behind it.
   *
   * **Hair and glasses are NOT linearly ordered, and they need no rule.** Wisps
   * fall in front of frames while the arms tuck under hair, simultaneously. The
   * per-pixel harvest already resolves that: painted-glasses pixels land only
   * where glasses were confirmed, and every hair pixel in the zone reverts to
   * MASTER strands, which therefore overlay the new frames in their exact
   * original positions. Record the stack as governing DISTINCT layers, with
   * interleaves resolved BY HARVEST rather than by ordering.
   */
  occludedBy?: Mask;
  /**
   * THE TIP TAPER — founder observation, 2026-08-06: *the ends cut off straight.*
   *
   * A SAM-class segmentation is binary and stops where its confidence does, which
   * on hair is short of the finest strand ends. `intersect` then multiplies those
   * tips by zero, and a strand that the matte knew was 20% there composites at 0%
   * — a straight cut where a taper belongs. It is one of the three things that
   * make an edit read as a sticker.
   *
   * So just outside the confirmed region, the matte's own value is adopted
   * DIRECTLY: **a tip the matte is 20% confident of renders at 20%.** The matte
   * is the confidence, so no new number invents the alpha.
   *
   * Two things bound it, because an unbounded version of this is exactly the r=16
   * forehead bleed D-216 measured:
   *
   *   DISTANCE   only within `taperPx` of confirmed content. A strand end is
   *              near its strand; a cheek is not.
   *   RAMP-NESS  only where the matte carries a genuine EDGE value rather than
   *              interior opacity. D-215 already had to draw that line to score
   *              softness at all — BiRefNet's interior sits at 250–254 while a
   *              real edge ramp lives below — so this reuses the ratified band
   *              instead of inventing a threshold. Forehead skin inside the
   *              subject is opaque, scores zero ramp-ness, and is never adopted.
   */
  taperPx?: number;
}): Promise<Mask> {
  assertStride(input.content, "content segmentation");
  assertStride(input.matte, "edge matte");
  assertSameSize(input.content, input.matte);
  const grown = await dilateMask(input.content, input.growPx ?? DEFAULT_HARVEST_GROWTH);
  const harvested = intersectMask(grown, input.matte);
  const tapered = input.taperPx && input.taperPx > 0
    ? adoptTips(harvested, grown, input.matte, input.taperPx)
    : harvested;
  /* Subtracted LAST, like every other exclusion in this module — what is in
     front cannot be talked open by anything that ran before it. */
  return input.occludedBy ? subtractMask(tapered, input.occludedBy) : tapered;
}

/**
 * BOUNDARY-CONTACT AUTO-EXPAND — the ratified rider, finally built, and the
 * thing that was actually cutting the hair.
 *
 * The rider has been canonical since `RIDER_boundary-contact.md` and was never
 * implemented, and the cost of that is on the record: the founder saw hair "cut
 * off straight" three passes running, and the diagnosis went to the painter, then
 * to the segmenter, before landing here. **A destination zone that stops where
 * the hair does not is a guillotine.** The composite takes `min(feather(zone),
 * matte)`, so beyond the zone the alpha is zero no matter what any matte says —
 * every strand the painter drew past that line is discarded, and the cut is
 * straight because the zone's edge is.
 *
 * The rider's own words are the specification, and the important half is the
 * second: it fires on **PAINTED CONTENT** — pixels where the patch differs from
 * the master inside the zone — touching the zone's **HARD edge**. Never on mask
 * geometry. A generous zone whose paint sits comfortably inside passes untouched
 * and costs nothing; real hair never ends in a straight line where a mask
 * stopped.
 *
 * **The signal was already in front of me and I read past it.** The hem
 * diagnostic reported *351 of 738 columns where the paint touches the zone edge*
 * — that IS this rider firing — and it was set aside in favour of a shape
 * correlation that answered a different question. A measurement nobody acts on is
 * worth what an unbuilt rider is worth.
 */
export async function expandUntilClear(input: {
  /** Painted content: where the patch meaningfully differs from the master. */
  painted: Mask;
  zone: Mask;
  /** How much to grow per pass. */
  stepPx: number;
  /** Stop here whatever happens — past this an edit is a re-render (D-218). */
  maxCoverage?: number;
  /** The effective edit the ceiling is measured on — the harvest, when there is one. */
  effective?: Mask;
  maxPasses?: number;
}): Promise<{ zone: Mask; passes: number; contactAtStart: number; contactAtEnd: number; stoppedBy: string }> {
  const maxCoverage = input.maxCoverage ?? MAX_COVERAGE;
  const maxPasses = input.maxPasses ?? 24;

  /** Painted pixels sitting ON the zone's hard edge — the rider's trigger. */
  const contact = (zone: Mask): number => {
    const { width, height } = zone;
    let touching = 0;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const pixel = y * width + x;
        if (zone.data[pixel] === 0 || input.painted.data[pixel] === 0) continue;
        if (zone.data[pixel - 1] === 0 || zone.data[pixel + 1] === 0
          || zone.data[pixel - width] === 0 || zone.data[pixel + width] === 0) touching += 1;
      }
    }
    return touching;
  };

  const contactAtStart = contact(input.zone);
  let zone = input.zone;
  let passes = 0;
  let stoppedBy = "no contact";
  while (contact(zone) > 0 && passes < maxPasses) {
    const grown = await dilateMask(zone, input.stepPx);
    /*
      A ZONE THAT CANNOT GROW ENDS THE LOOP. Paint running to the frame edge can
      never stop touching a boundary — the hair-down case reaches row 1534 of
      1536 — and without this the loop spins until a cap fires and reports the
      cap as the finding.
    */
    if (coverage(grown) <= coverage(zone)) { stoppedBy = "zone cannot grow further"; break; }
    /*
      THE CEILING IS MEASURED ON THE EFFECTIVE EDIT, NOT THE ZONE.
      Under harvest gating the zone is only an outer bound: a hair instruction
      may legitimately need a zone across her whole torso while the edit itself —
      what the harvest actually keeps — is a quarter of that. Testing the ZONE
      against the re-render ceiling would refuse the generous zones the harvest
      law exists to make safe. `effective` is the harvest when the caller has one.
    */
    const measured = input.effective ? intersectMask(input.effective, grown) : grown;
    if (coverage(measured) > maxCoverage) { stoppedBy = "coverage ceiling"; break; }
    zone = grown;
    passes += 1;
    if (passes >= maxPasses) stoppedBy = "pass ceiling";
  }
  return { zone, passes, contactAtStart, contactAtEnd: contact(zone), stoppedBy };
}

/** Above this a matte byte is interior opacity, not an edge ramp (D-215). */
const RAMP_CEILING = 229;
/** At and above this it is unambiguously interior. */
const INTERIOR_AT = 250;

function adoptTips(harvested: Mask, confirmed: Mask, matte: Mask, taperPx: number): Mask {
  const distance = distanceOutside(confirmed, taperPx);
  const data = Buffer.from(harvested.data);
  for (let pixel = 0; pixel < data.length; pixel += 1) {
    const away = distance[pixel];
    if (away <= 0) continue;
    const value = matte.data[pixel];
    if (value === 0) continue;
    /* Ramp-ness: full across a genuine edge value, nothing at interior opacity,
       and smooth between so the adoption has no cliff of its own. */
    const rampness = value <= RAMP_CEILING
      ? 1
      : Math.max(0, (INTERIOR_AT - value) / (INTERIOR_AT - RAMP_CEILING));
    const adopted = Math.round(value * rampness);
    if (adopted > data[pixel]) data[pixel] = adopted;
  }
  return { data, width: harvested.width, height: harvested.height };
}

/**
 * How much of `item` is hidden behind `occluder`, 0..1 — the visibility score.
 *
 * Alpha-weighted on BOTH sides, which is the difference between this and
 * `overlapWith`. A wisp of hair at 30% alpha hides 30% of what is behind it, not
 * all of it; treating any non-zero occluder byte as opaque would score a soft
 * fringe as a wall and refuse an edit that would have been perfectly visible.
 *
 * D-215's shape: the score has a constructible FLOOR (nothing in front → 0.0)
 * and CEILING (solid cover → 1.0), and both are pinned by test. A score with
 * neither is a number nobody can calibrate.
 */
export function occludedShare(item: Mask, occluder: Mask): number {
  assertStride(item, "item");
  assertStride(occluder, "occluder");
  assertSameSize(item, occluder);
  let hidden = 0;
  let total = 0;
  for (let index = 0; index < item.data.length; index += 1) {
    const alpha = item.data[index];
    if (!alpha) continue;
    total += alpha;
    hidden += (alpha * occluder.data[index]) / 255;
  }
  return total ? hidden / total : 0;
}

/**
 * WHEN AN EDIT WOULD BE INVISIBLE — the third refuse-before-dispatch guard.
 *
 * Its two siblings live on `MatteRequest`: `present: false` (you cannot segment a
 * thing that is not there) and `changesSilhouette: true` (a reshaped object's new
 * outline is not there either). This one is the same family in a third costume:
 * **the item would be there, and nobody could see it.** All three are derived
 * from what we already hold, cost nothing, and answer before a credit moves.
 *
 * The rule that makes it honest is the founder's: **THE MATTE DECIDES, THE PIN
 * SUGGESTS.** The presentation pin — *hair worn covering the ears* — is a free
 * pre-check that triggers the look; the authority is the CURRENT MASTER'S matte,
 * because occlusion is a question about current pixels and we possess the current
 * pixels. Trusting a record while the artifact is in hand would break law #1 in
 * its own house. A stale pin then costs one unnecessary matte consult and can
 * never block a visible edit or wave through an invisible one.
 *
 * **The bar is deliberately near-total.** A false refusal is the worse failure by
 * a distance — the founder's walk died on a reader refusing "remove her glasses"
 * at a bespectacled face, and this program does not get to repeat that with
 * arithmetic. Partly hidden is VISIBLE; only all-but-hidden refuses.
 */
export const INVISIBLE_AT = 0.98;

export function assertVisible(input: {
  /** Where the asked-for item would sit — anatomy for an add, the region for an edit. */
  item: Mask;
  /** What currently covers it, from the CURRENT master's mattes. Never the record. */
  occluder: Mask;
  /** For the message: what was asked for, and what would enable it. */
  what: string;
  enabledBy?: string;
  /**
   * A DIFFERENT ITEM THAT WOULD BE VISIBLE — and it is **scored before it is
   * offered**, which the rider did not originally require and the measurement
   * says it must.
   *
   * The intuition was that a drop earring escapes hair that hides a stud, since
   * it hangs below the hair's edge. On real faces that is sometimes exactly
   * backwards: on `fresh-03`, hair worn down over the shoulders leaves the LOBE
   * 17.9% covered and the DROP 83.2% covered, because the drop hangs into the
   * hair rather than out of it. Offering it as the visible alternative would
   * have sold a second invisible edit as the fix for the first.
   *
   * So an alternative arrives with the geometry of what it actually is, gets the
   * same score as the refused item, and is named in the re-ask only if it
   * passes. **Never offer a chip whose outcome you have not measured.**
   */
  alternative?: { label: string; item: Mask };
}): void {
  const hidden = occludedShare(input.item, input.occluder);
  if (hidden < INVISIBLE_AT) return;
  const alternativeWorks = input.alternative
    && occludedShare(input.alternative.item, input.occluder) < INVISIBLE_AT;
  const offers = [
    input.enabledBy ? `"${input.enabledBy}"` : null,
    alternativeWorks ? `"${input.alternative!.label}"` : null,
  ].filter(Boolean).join(" or ");
  throw new MaskError(
    `${(hidden * 100).toFixed(0)}% of the ${input.what} would sit behind what is already there — `
    + `nothing would be visible${offers ? `; try ${offers}` : ""}`,
  );
}

/** How far a destination zone may reach onto skin. See `placeDestinationZone`. */
const DEFAULT_SKIN_MARGIN = 8;

/**
 * WHERE A ZONE'S BOUNDARY IS ALLOWED TO SIT — founder law, 2026-08-06.
 *
 * > A zone boundary should follow natural image edges wherever feasible — the
 * > hairline, a jawline, a contour — and never cross open smooth skin if it can
 * > help it.
 *
 * The reasoning is about where a seam can hide. **Smooth skin is the worst seam
 * real estate in the picture**: no texture to disappear into and an eye that is
 * more sensitive to a gradient there than anywhere else. The same residual
 * mismatch that is invisible along a hairline glows in the middle of a forehead.
 * Grain matching and tone harmonisation reduce that mismatch; putting the
 * boundary somewhere else removes the problem.
 *
 * A plain dilation cannot obey this, and that is exactly what went wrong: it
 * sweeps outward equally in every direction, so growing a hair mask to make room
 * for longer hair also pushes the boundary DOWN across the forehead, and the
 * seam ends up in open skin because the dilation happened to sweep there.
 *
 * So growth is asymmetric, which is the whole idea:
 *
 *   into BACKGROUND   generous — `reach` px. Hair being lengthened needs
 *                     somewhere to go and nobody can segment hair that does not
 *                     exist yet.
 *   onto the SUBJECT  `skinMargin` px and no more. Enough for the new hairline
 *                     to be drawn, and not one pixel of forehead beyond it.
 *
 * The zone therefore takes the skin it MUST rather than the skin a dilation
 * swept, and its lower boundary hugs the hairline, where texture hides a seam
 * for free.
 *
 * `subject` is a whole-subject matte (BiRefNet, ratified round one). It is what
 * tells background from person; without it there is no way to grow one way and
 * not the other, which is why this takes it rather than deriving it.
 */
export async function placeDestinationZone(input: {
  /** The region as it currently is — a real segmentation. */
  region: Mask;
  /** Whole-subject matte: background outside, person inside. */
  subject: Mask;
  /** How far the edit may reach into BACKGROUND. */
  reach: number;
  /** How far it may reach onto the subject's skin. Small on purpose. */
  skinMargin?: number;
  /** Carved out last, by law (D-211) — the face is never inside a hair zone. */
  exclude?: Mask;
}): Promise<Mask> {
  const skinMargin = input.skinMargin ?? DEFAULT_SKIN_MARGIN;
  assertStride(input.region, "region");
  assertStride(input.subject, "subject matte");
  assertSameSize(input.region, input.subject);

  const outward = await dilateMask(input.region, input.reach);
  const inward = skinMargin > 0 ? await dilateMask(input.region, skinMargin) : input.region;

  /* Background is everything the subject matte does not claim. */
  const background: Mask = {
    data: Buffer.from(input.subject.data.map((value) => 255 - value)),
    width: input.subject.width,
    height: input.subject.height,
  };

  const zone = unionMasks(
    input.region,
    /* generous, but only where there is nothing to disturb */
    intersectMask(outward, background),
    /* minimal, where there is */
    intersectMask(inward, input.subject),
  );
  /* Exclusion subtracts LAST and cannot be talked open (D-211). */
  return input.exclude ? subtractMask(zone, input.exclude) : zone;
}

export type FaceGeometry = {
  /** The face oval — carved out of every hair mask, by law. */
  face: Shape;
  leftEye: Shape;
  rightEye: Shape;
  leftBrow: Shape;
  rightBrow: Shape;
  mouth: Shape;
  /** The hair as it currently sits. */
  hair: Shape[];
  /** Present only when she is wearing glasses. */
  eyewear?: { frames: Shape[]; lenses: Shape[] };
};

/**
 * THE HAIR MASK, WITH THE FACE ALWAYS CARVED OUT — founder law.
 *
 * A hair instruction that may write on the face is how "make her hair copper"
 * comes back with a different jaw. The carve-out is not a parameter and there is
 * no flag to disable it: hair edits paint hair, and the face is not hair.
 *
 * `destination` is the second half, and it is what makes growing and shrinking
 * work. Hair that gets LONGER must paint into space that is currently
 * background; hair that gets SHORTER must paint background over space that is
 * currently hair. Either way the writable zone is the UNION of where the hair is
 * and where it is going — a mask covering only the current hair can lengthen
 * nothing, and one covering only the destination cannot clear what it leaves
 * behind.
 */
export function hairRegion(
  geometry: FaceGeometry,
  destination: Shape[] = [],
): RegionSpec {
  return {
    kind: "hair",
    include: [...geometry.hair, ...destination],
    exclude: [geometry.face],
  };
}

/**
 * THE EYE REGION, AND THE ONE PLACE PIXELS CANNOT BE COPIED BACK.
 *
 * Eye edits on a bespectacled face split in two, and the split is physical
 * rather than stylistic:
 *
 * - **Frames are opaque.** Nothing behind them changed, so they are composited
 *   back from the master verbatim — excluded from the writable region entirely.
 *   That is what keeps an eye edit from deleting her glasses, which is what the
 *   founder's walk did.
 * - **Lens interiors CANNOT be copied.** Those pixels contain the OLD eye seen
 *   through glass. Preserving them would preserve the very thing being changed,
 *   so they must regenerate — inside frame-edge anchors, which is why the frames
 *   are excluded rather than the whole eyewear.
 *
 * Brows get their own sub-mask (`browRegion`) rather than riding along, because
 * "thicker brows" and "green eyes" are different demands that happen to be
 * neighbours, and D-209's batching law is by REGION, not by proximity.
 */
export function eyeRegion(geometry: FaceGeometry): RegionSpec {
  return {
    kind: "eyes",
    include: [geometry.leftEye, geometry.rightEye, ...(geometry.eyewear?.lenses ?? [])],
    exclude: geometry.eyewear?.frames ?? [],
  };
}

export function browRegion(geometry: FaceGeometry): RegionSpec {
  return {
    kind: "brows",
    include: [geometry.leftBrow, geometry.rightBrow],
    exclude: geometry.eyewear?.frames ?? [],
  };
}

/** Frames only — for changing the glasses themselves without touching the eyes. */
export function eyewearRegion(geometry: FaceGeometry): RegionSpec {
  if (!geometry.eyewear) throw new MaskError("this face is not wearing eyewear");
  return { kind: "eyewearFrames", include: geometry.eyewear.frames };
}

/**
 * ONE PATCH FOR DEMANDS THAT SHARE A REGION (D-209, founder ruling).
 *
 * "Fox eyes, seafoam, and thicker brows" is three demands and ONE area the model
 * must reinterpret, so it is one mask and one pass. Batching by count would put
 * a jacket and a hand in the same patch; batching by region never can.
 *
 * The union is taken over includes and the INTERSECTION over excludes —
 * deliberately. An exclusion that only one member asked for must still hold, or
 * merging two safe regions could produce an unsafe one: merge a brow edit with
 * an eye edit on a bespectacled face and the frames must stay protected by both.
 */
export function mergeRegions(specs: RegionSpec[]): RegionSpec {
  if (specs.length === 0) throw new MaskError("nothing to merge");
  if (specs.length === 1) return specs[0];
  const excludes = specs.flatMap((spec) => spec.exclude ?? []);
  return {
    kind: specs[0].kind,
    include: specs.flatMap((spec) => spec.include),
    exclude: excludes,
  };
}
