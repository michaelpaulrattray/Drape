/**
 * WHERE AN EDIT IS ALLOWED TO HAPPEN.
 *
 * `maskedComposite` enforces a mask; this decides what the mask IS. The split
 * matters because the laws here are product laws, not image-processing ones, and
 * they are the kind that get remembered at three call sites and forgotten at the
 * fourth. They are structural instead: you cannot ask this module for a hair
 * mask that includes the face, because there is no argument for it.
 *
 * Deliberately provider-independent. Region boxes arrive from somewhere — a
 * landmark model, a segmenter, eventually a cheap detector — and every one of
 * those costs money and changes behaviour between vendors. The geometry, the
 * carve-outs and the refusals do not, so they are testable for free and pinned
 * before a single credit is spent.
 *
 * Coordinates are NORMALISED (0..1) so a region survives a change of working
 * resolution. They are resolved to pixels once, here, at the end.
 */
import { type Mask } from "./maskedComposite";

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
 * Rasterise a spec into a hard single-channel mask.
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

/** How much of the frame a mask covers, 0..1. */
export function coverage(mask: Mask): number {
  let on = 0;
  for (let index = 0; index < mask.data.length; index += 1) if (mask.data[index]) on += 1;
  return on / (mask.width * mask.height);
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
