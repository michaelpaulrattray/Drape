import { describe, expect, it } from "vitest";

import {
  MaskError,
  assertUsable,
  browRegion,
  coverage,
  dilateMask,
  eyeMaskFrom,
  eyeRegion,
  eyewearRegion,
  hairMaskFrom,
  hairRegion,
  harvestMatteFrom,
  mergeRegions,
  rasterise,
  subtractMask,
  unionMasks,
  type FaceGeometry,
  intersectMask,
  overlapWith,
  placeDestinationZone,
  requestMatte,
  type MatteRequest,
  type SegmentationSource,
  type UsableMask,
  type Shape,
} from "./maskGeometry";
import { compositeMasked, outsideMaskUnchanged, type Mask, type Raster } from "./maskedComposite";

/**
 * The product laws of WHERE an edit may happen, proved without a provider.
 *
 * Every one of these is a founder ruling or a walk defect turned into geometry:
 * the face carved out of hair, glasses surviving an eye edit, lens interiors
 * regenerating rather than being copied, and same-region demands sharing one
 * patch.
 */

const W = 64;
const H = 64;

const FACE: Shape = { kind: "ellipse", cx: 0.5, cy: 0.52, rx: 0.18, ry: 0.24 };

const GEOMETRY: FaceGeometry = {
  face: FACE,
  leftEye: { kind: "ellipse", cx: 0.43, cy: 0.47, rx: 0.05, ry: 0.03 },
  rightEye: { kind: "ellipse", cx: 0.57, cy: 0.47, rx: 0.05, ry: 0.03 },
  leftBrow: { kind: "ellipse", cx: 0.43, cy: 0.41, rx: 0.06, ry: 0.02 },
  rightBrow: { kind: "ellipse", cx: 0.57, cy: 0.41, rx: 0.06, ry: 0.02 },
  mouth: { kind: "ellipse", cx: 0.5, cy: 0.66, rx: 0.06, ry: 0.03 },
  hair: [{ kind: "ellipse", cx: 0.5, cy: 0.42, rx: 0.26, ry: 0.28 }],
};

const BESPECTACLED: FaceGeometry = {
  ...GEOMETRY,
  eyewear: {
    /* A frame ring drawn as the band between two rects around each lens. */
    frames: [
      { kind: "rect", left: 0.36, top: 0.42, right: 0.64, bottom: 0.44 },
      { kind: "rect", left: 0.36, top: 0.51, right: 0.64, bottom: 0.53 },
    ],
    lenses: [
      { kind: "rect", left: 0.37, top: 0.44, right: 0.49, bottom: 0.51 },
      { kind: "rect", left: 0.51, top: 0.44, right: 0.63, bottom: 0.51 },
    ],
  },
};

function solid(rgb: [number, number, number]): Raster {
  const data = Buffer.allocUnsafe(W * H * 3);
  for (let pixel = 0; pixel < W * H; pixel += 1) {
    data[pixel * 3] = rgb[0];
    data[pixel * 3 + 1] = rgb[1];
    data[pixel * 3 + 2] = rgb[2];
  }
  return { data, width: W, height: H };
}

/** Is this normalised point writable under the rasterised spec? */
function writable(mask: { data: Buffer; width: number; height: number }, nx: number, ny: number) {
  const x = Math.floor(nx * mask.width);
  const y = Math.floor(ny * mask.height);
  return mask.data[y * mask.width + x] === 255;
}

describe("the face is carved out of every hair mask — founder law", () => {
  it("never lets a hair edit write on the face", () => {
    const mask = rasterise(hairRegion(GEOMETRY), W, H);
    /* Dead centre of the face: the nose, the thing that changed when "make her
       hair copper" came back a different woman. */
    expect(writable(mask, 0.5, 0.52)).toBe(false);
    expect(writable(mask, 0.5, 0.45)).toBe(false);
  });

  it("still writes on the hair itself, or it edits nothing", () => {
    const mask = rasterise(hairRegion(GEOMETRY), W, H);
    expect(writable(mask, 0.5, 0.20)).toBe(true);
    expect(writable(mask, 0.28, 0.40)).toBe(true);
  });

  it("cannot be talked out of the carve-out by adding includes", () => {
    /* A destination zone that overlaps the face must still not open it — the
       exclusion is subtracted last, by construction. */
    const overlapping: Shape = { kind: "rect", left: 0, top: 0, right: 1, bottom: 1 };
    const mask = rasterise(hairRegion(GEOMETRY, [overlapping]), W, H);
    expect(writable(mask, 0.5, 0.52)).toBe(false);
  });
});

describe("growing and shrinking hair need the destination zone", () => {
  const below: Shape = { kind: "rect", left: 0.3, top: 0.72, right: 0.7, bottom: 0.95 };

  it("cannot lengthen hair without it — the space is not writable", () => {
    const mask = rasterise(hairRegion(GEOMETRY), W, H);
    expect(writable(mask, 0.5, 0.85)).toBe(false);
  });

  it("opens exactly that space when the destination is given", () => {
    const mask = rasterise(hairRegion(GEOMETRY, [below]), W, H);
    expect(writable(mask, 0.5, 0.85)).toBe(true);
  });

  it("keeps the vacated space writable when hair gets shorter", () => {
    /* Shrinking is the same union from the other end: the mask must still cover
       where the hair IS, or nothing can paint background over it. */
    const shorter: Shape = { kind: "ellipse", cx: 0.5, cy: 0.34, rx: 0.2, ry: 0.16 };
    const mask = rasterise(hairRegion(GEOMETRY, [shorter]), W, H);
    expect(writable(mask, 0.28, 0.40)).toBe(true);
  });
});

describe("an eye edit does not delete her glasses — the walk defect, as geometry", () => {
  it("protects the opaque frames", () => {
    const mask = rasterise(eyeRegion(BESPECTACLED), W, H);
    expect(writable(mask, 0.5, 0.43)).toBe(false);
    expect(writable(mask, 0.5, 0.52)).toBe(false);
  });

  it("regenerates the lens interiors, which can never be copied back", () => {
    /* Those pixels hold the OLD eye seen through glass — preserving them would
       preserve the very thing being changed. */
    const mask = rasterise(eyeRegion(BESPECTACLED), W, H);
    expect(writable(mask, 0.43, 0.47)).toBe(true);
    expect(writable(mask, 0.57, 0.47)).toBe(true);
  });

  it("protects the frames from a brow edit too", () => {
    const mask = rasterise(browRegion(BESPECTACLED), W, H);
    expect(writable(mask, 0.5, 0.43)).toBe(false);
    expect(writable(mask, 0.43, 0.41)).toBe(true);
  });

  it("refuses to build an eyewear region for a face wearing none", () => {
    expect(() => eyewearRegion(GEOMETRY)).toThrow(MaskError);
  });
});

describe("same-region demands share one patch — batch by region, never by count", () => {
  it("merges eyes and brows into a single mask", () => {
    const merged = rasterise(
      mergeRegions([eyeRegion(BESPECTACLED), browRegion(BESPECTACLED)]),
      W,
      H,
    );
    expect(writable(merged, 0.43, 0.47)).toBe(true);
    expect(writable(merged, 0.43, 0.41)).toBe(true);
  });

  it("keeps an exclusion that only one member asked for", () => {
    /* Merging two safe regions must never produce an unsafe one. */
    const merged = rasterise(
      mergeRegions([eyeRegion(BESPECTACLED), browRegion(BESPECTACLED)]),
      W,
      H,
    );
    expect(writable(merged, 0.5, 0.43)).toBe(false);
  });

  it("does not grow the area beyond the two regions", () => {
    const merged = rasterise(
      mergeRegions([eyeRegion(BESPECTACLED), browRegion(BESPECTACLED)]),
      W,
      H,
    );
    /* The chin is neither eyes nor brows and must stay untouchable. */
    expect(writable(merged, 0.5, 0.72)).toBe(false);
  });
});

describe("a mask that cannot do its job is refused before the money", () => {
  it("refuses a region that selects nothing", () => {
    const empty = rasterise(
      { kind: "eyes", include: [{ kind: "rect", left: 0.5, top: 0.5, right: 0.5, bottom: 0.5 }] },
      W,
      H,
    );
    expect(() => assertUsable(empty, "eyes")).toThrow(/selects nothing/);
  });

  it("refuses a local edit that is really a full re-render", () => {
    const everything = rasterise(
      { kind: "skin", include: [{ kind: "rect", left: 0, top: 0, right: 1, bottom: 1 }] },
      W,
      H,
    );
    expect(() => assertUsable(everything, "skin")).toThrow(/re-render, not a local edit/);
  });

  it("accepts an ordinary hair region", () => {
    const mask = rasterise(hairRegion(GEOMETRY), W, H);
    expect(() => assertUsable(mask, "hair")).not.toThrow();
    expect(coverage(mask)).toBeGreaterThan(0.01);
  });

  /*
    INVARIANT 7, AND THE HONEST LIMIT OF THESE DRIVERS.

    The three tests above prove `assertUsable` THROWS. They cannot prove it
    BLOCKS, because the masked render path does not exist yet — so at the moment
    of writing these are controls with no call site, which is the exact shape of
    every inert protection this program has catalogued.

    A driver cannot close that gap. The type does: `assertUsable` is the only
    producer of `UsableMask`, and the paid render path will demand one, so a
    caller who skips the check cannot compile. This test pins the producer
    relationship so a later refactor cannot quietly widen the type back to `Mask`
    and re-open the door.
  */
  it("is the only way to obtain a mask the render path will accept", () => {
    const checked: UsableMask = assertUsable(rasterise(hairRegion(GEOMETRY), W, H), "hair");
    expect(checked.data.length).toBe(W * H);

    const raw: Mask = rasterise(hairRegion(GEOMETRY), W, H);
    // @ts-expect-error an unchecked mask is not a UsableMask, and must never be
    const smuggled: UsableMask = raw;
    expect(smuggled).toBeTruthy();
  });
});

/*
  THE SAME LAWS, ON REAL MATTES (founder rider, 2026-08-05).

  Production masks come from face parsing, alpha matting and SAM-class
  segmentation — never from the shapes above, which exist to make these tests
  free. What must hold is that the LAWS survive the change of source, and that a
  soft matte stays soft: a carve-out done by thresholding would put a binary edge
  back exactly where the matte was protecting one.
*/
describe("the laws run on mattes, not outlines", () => {
  const flat = (value: number): Mask => ({
    data: Buffer.alloc(4 * 4, value),
    width: 4,
    height: 4,
  });
  const ramp = (values: number[]): Mask => ({
    data: Buffer.from(values),
    width: values.length,
    height: 1,
  });

  it("unions by max, so two soft mattes stay soft", () => {
    const merged = unionMasks(ramp([0, 40, 200, 255]), ramp([10, 90, 20, 0]));
    expect([...merged.data]).toEqual([10, 90, 200, 255]);
  });

  it("subtracts softly, so a carved jawline does not become an outline", () => {
    /* A half-transparent face matte must halve the hair that overlaps it, not
       delete it — that gradient IS the jawline. */
    const carved = subtractMask(ramp([255, 255, 255, 255]), ramp([0, 64, 128, 255]));
    expect([...carved.data]).toEqual([255, 191, 127, 0]);
  });

  it("keeps the binary behaviour when both sides are hard", () => {
    expect([...subtractMask(ramp([255, 255]), ramp([0, 255])).data]).toEqual([255, 0]);
    expect([...unionMasks(ramp([255, 0]), ramp([0, 0])).data]).toEqual([255, 0]);
  });

  it("carves the face out of a hair matte from segmentation", () => {
    const hair = flat(255);
    const face: Mask = { data: Buffer.alloc(16, 0), width: 4, height: 4 };
    face.data[5] = 255;
    const mask = hairMaskFrom({ hair, face });
    expect(mask.data[5]).toBe(0);
    expect(mask.data[0]).toBe(255);
  });

  it("protects frames while letting lens interiors regenerate", () => {
    const eyes: Mask = { data: Buffer.alloc(16, 0), width: 4, height: 4 };
    eyes.data[5] = 255;
    const lenses: Mask = { data: Buffer.alloc(16, 0), width: 4, height: 4 };
    lenses.data[6] = 255;
    const frames: Mask = { data: Buffer.alloc(16, 0), width: 4, height: 4 };
    frames.data[6] = 128;

    const mask = eyeMaskFrom({ eyes, lenses, frames });
    expect(mask.data[5]).toBe(255);
    /* Half-opaque frame edge lets half the lens through — a wire rim is thin and
       partly transparent, and a binary cut would leave a halo of old frame. */
    expect(mask.data[6]).toBe(127);
  });

  it("refuses a multi-channel matte instead of walking off it (D-210)", () => {
    const threeChannel: Mask = { data: Buffer.alloc(4 * 4 * 3, 255), width: 4, height: 4 };
    expect(() => unionMasks(threeChannel, flat(0))).toThrow(/single-channel/);
    expect(() => subtractMask(threeChannel, flat(0))).toThrow(/single-channel/);
  });

  it("refuses to resize a matte to fit the master", () => {
    const other: Mask = { data: Buffer.alloc(9, 255), width: 3, height: 3 };
    expect(() => unionMasks(flat(255), other)).toThrow(/never resize/);
  });

  it("dilates a destination zone outward as paint-allowance", async () => {
    const seed: Mask = { data: Buffer.alloc(16 * 16, 0), width: 16, height: 16 };
    seed.data[8 * 16 + 8] = 255;
    const grown = await dilateMask(seed, 2);
    expect(grown.data[8 * 16 + 8]).toBe(255);
    expect(grown.data[8 * 16 + 9]).toBe(255);
    expect(grown.data.length).toBe(16 * 16);
  });

  it("weights coverage by alpha, so a faint halo is not solid area", () => {
    expect(coverage(flat(255))).toBeCloseTo(1);
    expect(coverage(flat(128))).toBeCloseTo(128 / 255, 2);
  });
});

describe("the geometry composes with the arithmetic", () => {
  it("leaves the face byte-identical when a hair patch redrew everything", async () => {
    /* The two halves of the workstream, end to end: geometry decides where, the
       composite proves what happened outside it. */
    const master = solid([10, 20, 30]);
    const patch = solid([200, 100, 50]);
    const mask = rasterise(hairRegion(GEOMETRY), W, H);

    const { composite, applied } = await compositeMasked({ master, patch, mask });
    expect(outsideMaskUnchanged(master, composite, applied).identical).toBe(true);

    const nose = ((Math.floor(0.52 * H)) * W + Math.floor(0.5 * W)) * 3;
    expect(composite.data[nose]).toBe(10);
  });

  it("hands the composite a mask of exactly one byte per pixel (D-210)", () => {
    const mask = rasterise(hairRegion(GEOMETRY), W, H);
    expect(mask.data.length).toBe(W * H);
  });
});

/*
  THE INVENTED-MASK GAP (D-213) — the shop's negative control, closed.

  Asked for "eyeglasses" on a woman wearing none, a real segmenter returned a
  confident 0.1% blob. That cleared the empty-mask floor, so the refusal that
  catches an EMPTY mask would have passed an INVENTED one — and an invented mask
  means an edit lands somewhere nothing was.

  Three stacked guards, all in the contract rather than in callers.
*/
describe("a mask that was invented rather than found", () => {
  const SIZE = 32;
  const blank = () => Buffer.alloc(SIZE * SIZE, 0);
  const patch = (fill: number, from: number, to: number): Mask => {
    const data = blank();
    for (let y = from; y < to; y += 1) for (let x = from; x < to; x += 1) data[y * SIZE + x] = fill;
    return { data, width: SIZE, height: SIZE };
  };
  const sourceReturning = (mask: Mask): SegmentationSource => ({
    id: "test-segmenter",
    matte: async () => mask,
  });
  const request = (over: Partial<MatteRequest> = {}): MatteRequest => ({
    image: Buffer.from("png"),
    region: "eyewearFrames",
    width: SIZE,
    height: SIZE,
    present: true,
    changesSilhouette: false,
    ...over,
  });

  it("never asks where a thing is when the record says it is not there", async () => {
    /* Guard one, and the only structural one: the phantom cannot arise because
       the question is never put. */
    let asked = false;
    const source: SegmentationSource = {
      id: "test-segmenter",
      matte: async () => { asked = true; return patch(255, 8, 16); },
    };
    await expect(requestMatte(source, request({ present: false })))
      .rejects.toThrow(/refusing to ask a segmentation model/);
    expect(asked, "the model must not be called at all").toBe(false);
  });

  it("never segments the current shape when the edit is about to change it", async () => {
    /*
      D-218, and the same refusal as the record gate: you cannot segment a thing
      that is not there yet, and a reshaped object's NEW outline is not there
      yet. The glasses fixture is the exhibit — an engine drawing bolder frames
      inside a matte cut from the old frames produced ghosted doubled rims.

      Refused BEFORE the call, so this asserts the model is never reached. A
      version that refused afterwards would still be paying for an answer it had
      already decided not to use.
    */
    let asked = false;
    const source: SegmentationSource = {
      id: "test-segmenter",
      matte: async () => { asked = true; return patch(255, 12, 19); },
    };
    await expect(requestMatte(source, request({ changesSilhouette: true })))
      .rejects.toThrow(/use a grown destination zone/);
    expect(asked, "the model must not be called at all").toBe(false);
  });

  it("still allows an edit that stays inside the region's own outline", async () => {
    /* The counter-case, without which the guard above could be `() => false` and
       nobody would notice. Recolouring an iris changes nothing's shape. */
    const good = patch(255, 12, 19);
    const mask: UsableMask = await requestMatte(
      sourceReturning(good),
      request({ changesSilhouette: false }),
    );
    expect(mask.data.length).toBe(SIZE * SIZE);
  });

  it("refuses a blob too small for its own class, though it clears the global floor", async () => {
    /* The shop's exact failure: 0.1% coverage — above MIN_COVERAGE (0.05%) and
       far below what a pair of glasses can plausibly be. */
    const tiny = patch(255, 15, 16);
    expect(coverage(tiny)).toBeGreaterThan(0.0005);
    await expect(requestMatte(sourceReturning(tiny), request()))
      .rejects.toThrow(/outside the .* this region can plausibly be/);
  });

  it("refuses a mask that ignores its own anatomy", async () => {
    const elsewhere = patch(255, 2, 8);
    const prior = patch(255, 20, 30);
    await expect(requestMatte(sourceReturning(elsewhere), request({ prior })))
      .rejects.toThrow(/outside the anatomy/);
  });

  it("refuses a matte at the wrong resolution rather than resizing it", async () => {
    const wrong: Mask = { data: Buffer.alloc(16 * 16, 255), width: 16, height: 16 };
    await expect(requestMatte(sourceReturning(wrong), request()))
      .rejects.toThrow(/for a 32x32 master/);
  });

  it("returns a UsableMask when all three guards are satisfied", async () => {
    /* 7x7 of 32x32 = 4.8%, inside the frames band of 0.4-6%. The first draft
       used 8x8 and was refused at 6.25% — the guard catching the test's own
       fixture is the guard working. */
    const good = patch(255, 12, 19);
    const prior = patch(255, 10, 24);
    const mask: UsableMask = await requestMatte(sourceReturning(good), request({ prior }));
    expect(mask.data.length).toBe(SIZE * SIZE);
    expect(overlapWith(good, prior)).toBe(1);
  });
});

describe("placeDestinationZone — a boundary is not allowed to sit on open skin", () => {
  const SIZE = 64;
  const blank = () => Buffer.alloc(SIZE * SIZE, 0);
  const box = (from: { x: number; y: number }, to: { x: number; y: number }, fill = 255): Mask => {
    const data = blank();
    for (let y = from.y; y < to.y; y += 1) for (let x = from.x; x < to.x; x += 1) data[y * SIZE + x] = fill;
    return { data, width: SIZE, height: SIZE };
  };

  /* A head: hair across the top, skin below it, background either side. */
  const hair = box({ x: 20, y: 8 }, { x: 44, y: 24 });
  const subject = box({ x: 20, y: 8 }, { x: 44, y: 60 });

  it("grows generously into background and barely onto skin", async () => {
    const zone = await placeDestinationZone({ region: hair, subject, reach: 12, skinMargin: 3 });
    const at = (x: number, y: number) => zone.data[y * SIZE + x] > 0;

    /* Background above and beside the hair: taken, because hair may grow there. */
    expect(at(32, 2), "background above the hair").toBe(true);
    expect(at(12, 16), "background beside the hair").toBe(true);

    /* Skin just under the hairline: taken, because the new hairline is drawn there. */
    expect(at(32, 25), "a small margin of skin below the hairline").toBe(true);

    /*
      OPEN FOREHEAD, well below the hairline but inside a 12px dilation: NOT
      taken. This is the assertion the founder's law exists for — a plain
      dilation would have swept it, and the seam would have landed in open skin.
    */
    expect(at(32, 32), "open skin a plain dilation would have swept").toBe(false);
  });

  it("a plain dilation DOES sweep that skin — the control that makes the test mean something", async () => {
    /* Without this, the assertion above could pass because the zone was small
       for some unrelated reason. This proves the skin in question is genuinely
       within reach and is being declined deliberately. */
    const swept = await dilateMask(hair, 12);
    expect(swept.data[32 * SIZE + 32], "the naive zone reaches this forehead pixel").toBeGreaterThan(0);
  });

  it("still subtracts its exclusion last", async () => {
    const face = box({ x: 24, y: 24 }, { x: 40, y: 40 });
    const zone = await placeDestinationZone({ region: hair, subject, reach: 12, skinMargin: 6, exclude: face });
    expect(zone.data[30 * SIZE + 32], "the exclusion wins over the skin margin").toBe(0);
  });
});

describe("the harvest gate — only confirmed content survives, everything else is hers", () => {
  const SIZE = 64;
  const blank = () => Buffer.alloc(SIZE * SIZE, 0);
  const paint = (
    data: Buffer,
    from: { x: number; y: number },
    to: { x: number; y: number },
    value: number,
  ) => {
    for (let y = from.y; y < to.y; y += 1) {
      for (let x = from.x; x < to.x; x += 1) data[y * SIZE + x] = value;
    }
  };

  /*
    A person, as two masks a real pipeline would actually hold.

    `content` is what a SAM-class segmenter says the HAIR is on the patch: hard
    edged, and stopping short of the flyaway strands. `subject` is what BiRefNet
    says the PERSON is: soft at the outer silhouette, opaque across hair, skin
    and shirt alike — because a subject matte has no opinion about which is
    which. That indifference is the whole defect.
  */
  const content = (() => {
    const data = blank();
    paint(data, { x: 18, y: 6 }, { x: 46, y: 22 }, 255);
    return { data, width: SIZE, height: SIZE };
  })();

  const subject = (() => {
    const data = blank();
    /* head, torso and shirt — one opaque person */
    paint(data, { x: 16, y: 6 }, { x: 48, y: 64 }, 255);
    /* flyaway strands above the hard hair edge: soft, and OUTSIDE `content` */
    paint(data, { x: 18, y: 3 }, { x: 46, y: 6 }, 100);
    return { data, width: SIZE, height: SIZE };
  })();

  const HAIR = { x: 32, y: 14 };
  const FLYAWAY = { x: 32, y: 4 };
  const SHIRT = { x: 32, y: 52 };
  const at = (mask: Mask, point: { x: number; y: number }) => mask.data[point.y * SIZE + point.x];

  it("keeps the hair", async () => {
    const harvest = await harvestMatteFrom({ content, matte: subject });
    expect(at(harvest, HAIR), "confirmed hair survives the harvest").toBe(255);
  });

  it("drops the shirt — the painter's clothing never reaches the customer", async () => {
    const harvest = await harvestMatteFrom({ content, matte: subject });
    expect(at(harvest, SHIRT), "clothing is not hair, so it does not survive").toBe(0);
  });

  it("the subject matte DOES confirm that shirt — the control that makes the wall mean something", () => {
    /*
      Without this the assertion above could pass because the shirt happened to
      be outside every mask in the fixture. It is not: a subject matte claims it
      at full opacity, which is exactly what shipped, and exactly why the wall
      looked enforced while doing nothing.
    */
    expect(at(subject, SHIRT), "the wrong matte would hand the shirt straight through").toBe(255);
  });

  it("grows the hard edge first, or the wisps it was brought in for are clipped off (D-216)", async () => {
    const clipped = await harvestMatteFrom({ content, matte: subject, growPx: 0 });
    const grown = await harvestMatteFrom({ content, matte: subject });
    expect(at(clipped, FLYAWAY), "a hard segmentation cuts the flyaway strands to nothing").toBe(0);
    expect(at(grown, FLYAWAY), "grown first, the matte's own soft edge governs").toBeGreaterThan(0);
  });

  it("takes its content from the patch and its edge from the matte, never one mask twice", async () => {
    /* Passing the subject as BOTH is the shipped defect written out in one line:
       the harvest matte becomes the subject matte and the wall disappears. */
    const degenerate = await harvestMatteFrom({ content: subject, matte: subject });
    expect(at(degenerate, SHIRT), "one mask twice is no wall at all").toBe(255);
  });

  it("reverts every non-hair pixel in a generous zone to the master, byte for byte", async () => {
    /*
      The founder-facing form, end to end. The zone is deliberately generous —
      it covers the shirt, which the harvest law explicitly permits — and the
      patch redrew the entire frame, which is what the painter actually does.
    */
    const master = solid([120, 120, 120]);
    const patch = solid([20, 200, 40]);
    const zone = (() => {
      const data = blank();
      paint(data, { x: 10, y: 0 }, { x: 54, y: 64 }, 255);
      return { data, width: SIZE, height: SIZE };
    })();

    const harvest = await harvestMatteFrom({ content, matte: subject });
    const walled = await compositeMasked({ master, patch, mask: zone, edgeMatte: harvest });
    const shirtAt = (SHIRT.y * SIZE + SHIRT.x) * 3;
    expect(
      [walled.composite.data[shirtAt], walled.composite.data[shirtAt + 1], walled.composite.data[shirtAt + 2]],
      "her own shirt, unchanged, inside a zone that was allowed to cover it",
    ).toEqual([120, 120, 120]);
    /* And the hair genuinely did change, or the wall is just a broken composite. */
    const hairAt = (HAIR.y * SIZE + HAIR.x) * 3;
    expect(walled.composite.data[hairAt + 1], "the hair still took the paint").toBe(200);
  });

  it("and the subject matte hands that same shirt through — the end-to-end control", async () => {
    const master = solid([120, 120, 120]);
    const patch = solid([20, 200, 40]);
    const zone = (() => {
      const data = blank();
      paint(data, { x: 10, y: 0 }, { x: 54, y: 64 }, 255);
      return { data, width: SIZE, height: SIZE };
    })();

    const leaky = await compositeMasked({ master, patch, mask: zone, edgeMatte: subject });
    const shirtAt = (SHIRT.y * SIZE + SHIRT.x) * 3;
    expect(
      leaky.composite.data[shirtAt + 1],
      "the defect, reproduced: the painter's clothing survives on a subject matte",
    ).toBe(200);
  });
});
