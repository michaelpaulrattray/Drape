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

import { type Mask } from "./maskedComposite";

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

export function assertUsable(mask: Mask, kind: RegionKind): void {
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
