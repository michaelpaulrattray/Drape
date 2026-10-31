import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { cutSegments, encodeCut } from "./segmentCuts";
import { readRaster, type Mask } from "./maskedComposite";
import { facetOfSubject } from "./refineFacets";
import {
  FEATHER_TOLERANCE,
  adjudicateCandidateCarries,
  featherToleranceFor,
} from "../../scripts/lib/carriedAdjudicator.mts";

/**
 * A KEPT ACCESSORY, JUDGED BY ARITHMETIC — what is left of the accessory
 * corridor suite (#2859).
 *
 * This file was written for the masked-edit harvest's addition corridor: on
 * 2026-08-09 not one accessory pixel had ever been kept, because the harvest
 * built the corridor at both earlobes and then filed it under no name the
 * segment cutter could look up. That harvest was retired with the paste road
 * (#1577 slice 4b) and deleted on his word *"delete dead code"*, and every arm
 * that drove it went with it.
 *
 * Two blocks stay, because their subjects still have readers: the carried-fact
 * adjudicator (`scripts/lib/carriedAdjudicator.mts`, run by the drive scripts)
 * and its feather allowance. No other suite drives either. Their fixture used to
 * come out of the harvest; it is now drawn directly — the hoops' own pixels as
 * both the applied ground and the earring region — which is what the harvest
 * handed the cutter on this face anyway, so the verdicts are the same verdicts.
 */

const W = 64;
const H = 64;

const SKIN: [number, number, number] = [190, 188, 186];
const METAL: [number, number, number] = [240, 205, 90];

async function png(fill: (x: number, y: number) => [number, number, number]): Promise<Buffer> {
  const data = Buffer.allocUnsafe(W * H * 3);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const [r, g, b] = fill(x, y);
      const at = (y * W + x) * 3;
      data[at] = r; data[at + 1] = g; data[at + 2] = b;
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
}

/** The lobes this suite hangs everything from, in pixels. */
const LOBES = [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }];
const LEFT_LOBE = { x: Math.round(LOBES[0].x * W), y: Math.round(LOBES[0].y * H) };
const RIGHT_LOBE = { x: Math.round(LOBES[1].x * W), y: Math.round(LOBES[1].y * H) };

/** A face wearing nothing, and the same face with a bead of metal at each lobe. */
const HOOP_RADIUS = 3;
const bareFace = () => png(() => SKIN);
const hoopedFace = () => png((x, y) => {
  const near = (p: { x: number; y: number }) => Math.hypot(x - p.x, y - p.y) <= HOOP_RADIUS;
  return near(LEFT_LOBE) || near(RIGHT_LOBE) ? METAL : SKIN;
});

/** Where the hoops are, as a mask — the same discs `hoopedFace` paints. */
const deliveredHoops = (): Mask => {
  const data = Buffer.alloc(W * H, 0);
  for (const lobe of [LEFT_LOBE, RIGHT_LOBE]) {
    for (let y = lobe.y - HOOP_RADIUS; y <= lobe.y + HOOP_RADIUS; y += 1) {
      for (let x = lobe.x - HOOP_RADIUS; x <= lobe.x + HOOP_RADIUS; x += 1) {
        if (Math.hypot(x - lobe.x, y - lobe.y) <= HOOP_RADIUS) data[y * W + x] = 255;
      }
    }
  }
  return { data, width: W, height: H };
};

/**
 * AND THE ADJUDICATOR COVERS IT FROM THE FIRST CUT (fable-120's condition 1).
 *
 * The byte adjudicator is facet-agnostic by construction — it asks "are these
 * the same pixels she already paid for", which is a question about a mask and a
 * frame and knows nothing about jewellery. That is an argument, though, and
 * this program has been wrong about exactly this kind of argument before:
 * `bornWornCatalogue` was built, tested and had no callers, so a capability
 * everybody believed in filed no rows at all.
 *
 * So an accessory-sized segment is driven through the real adjudicator here,
 * on its real encoded bytes, with the two controls that make the verdict mean
 * something: a frame that kept it, and a frame that did not.
 */
describe("a kept accessory is judged by arithmetic like every other carried fact", () => {
  const CARRIED = facetOfSubject("statedAccessories");

  const carriedCandidate = async () => {
    const frame = await hoopedFace();
    const { cuts: [cut] } = cutSegments({
      composite: await readRaster(frame),
      applied: deliveredHoops(),
      facetRegions: new Map([[CARRIED, "earring"]]),
      regionMasks: new Map([["earring", deliveredHoops()]]),
    });
    const encoded = await encodeCut(cut);
    return { frame, cut, encoded };
  };

  const run = async (input: {
    frame: Buffer;
    encoded: { mask: Buffer; content: Buffer };
    cut: { box: { x: number; y: number; width: number; height: number } };
    intersections: Array<{ winner: string; loser: string; pixels: number }>;
  }) => adjudicateCandidateCarries({
    variants: [{
      id: 2,
      imageKey: "frame",
      requestText: "she wear her hair down",
      internalPrompt: {
        verification: { checks: [{ facet: CARRIED, read: true, verified: false, carried: true }] },
        assembly: { intersections: input.intersections },
      },
    }],
    segments: [{
      facet: CARRIED,
      variantId: 1,
      version: 1,
      maskKey: "mask",
      contentKey: "content",
      bboxX: input.cut.box.x,
      bboxY: input.cut.box.y,
      bboxW: input.cut.box.width,
      bboxH: input.cut.box.height,
    }],
    fetchBytes: async (key: string) => (
      key === "mask" ? input.encoded.mask : key === "content" ? input.encoded.content : input.frame
    ),
  });

  it("cuts a pair of hoops as ONE accessory segment spanning both lobes", async () => {
    /* The precondition the three verdicts below rest on, asserted rather than
       assumed: one cut, filed as the accessory facet, holding both lobes. */
    const { cut } = await carriedCandidate();
    expect(cut.facet).toBe(CARRIED);
    expect(cut.region).toBe("earring");
    expect(cut.box.x, "it starts at her right lobe").toBeLessThanOrEqual(LEFT_LOBE.x);
    expect(cut.box.x + cut.box.width, "and reaches her left").toBeGreaterThan(RIGHT_LOBE.x);
  });

  it("says KEPT when the hoops are byte-identical in the later frame", async () => {
    const { frame, cut, encoded } = await carriedCandidate();
    const { verdicts, unadjudicable } = await run({
      frame, cut, encoded, intersections: [],
    });

    expect(unadjudicable, "an accessory is not a fact this instrument skips").toEqual([]);
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].facet).toBe(CARRIED);
    expect(verdicts[0].owned).toBeGreaterThan(0);
    expect(verdicts[0].unexplained).toBe(0);
    expect(verdicts[0].kept).toBe(true);
  });

  it("CONTROL — says DEFICIT when the hoops are gone and nothing wrote it down", async () => {
    /*
      The instrument's ability to FAIL, which is the only thing that makes the
      verdict above worth reading. This frame is her bare face: every pixel the
      segment owns has been replaced by skin, and no intersection accounts for
      any of it.
    */
    const { cut, encoded } = await carriedCandidate();
    const { verdicts } = await run({
      frame: await bareFace(), cut, encoded, intersections: [],
    });

    expect(verdicts[0].identical, "the metal is not in this picture").toBeLessThan(verdicts[0].owned);
    expect(verdicts[0].unexplained).toBeGreaterThan(featherToleranceFor(verdicts[0].owned));
    expect(verdicts[0].kept).toBe(false);
    /*
      AND THE ALLOWANCE IS SMALLER THAN THE THING IT IS JUDGING — the reason
      this control failed the first time it was written.

      The flat 64 was calibrated on a 24,056-pixel freckle patch. A pair of
      hoops is under a hundred pixels, so the old tolerance was larger than the
      whole segment and this frame — her bare face, with no jewellery in it at
      all — was scored KEPT. An instrument that cannot fail was reporting
      success.
    */
    expect(verdicts[0].owned).toBeLessThan(FEATHER_TOLERANCE);
    expect(featherToleranceFor(verdicts[0].owned)).toBeLessThan(verdicts[0].owned);
  });

  it("says KEPT when her new hair is RECORDED as having won those pixels", async () => {
    /*
      The same missing metal, with the compositor's own note beside it. This is
      the arithmetic half of the occluded verdict: a hoop behind new hair is not
      a broken promise, and the difference between the two is whether anybody
      wrote down that the hair took the ground.
    */
    const { cut, encoded } = await carriedCandidate();
    const owned = cut as unknown as { pixels: number };
    const { verdicts } = await run({
      frame: await bareFace(),
      cut,
      encoded,
      intersections: [{ winner: "fresh paint", loser: `${CARRIED}@v1`, pixels: owned.pixels }],
    });

    expect(verdicts[0].recorded).toBe(owned.pixels);
    expect(verdicts[0].unexplained).toBe(0);
    expect(verdicts[0].kept).toBe(true);
  });
});

/**
 * THE ALLOWANCE ITSELF, since changing it changes every carried verdict there
 * has ever been.
 *
 * The claim that has to hold is narrow and worth pinning exactly: the founding
 * specimen's arithmetic is untouched, and only segments too small for a flat 64
 * to mean anything move.
 */
describe("the feather allowance scales with the segment it is judging", () => {
  it("leaves the founding specimen's number exactly where it was", async () => {
    /* 24,056 pixels is the freckle patch the flat 64 was calibrated against.
       Any segment at or above 256 keeps the old number, so no verdict already
       in the record can flip on this change. */
    expect(featherToleranceFor(24_056)).toBe(FEATHER_TOLERANCE);
    expect(featherToleranceFor(256)).toBe(FEATHER_TOLERANCE);
    expect(featherToleranceFor(255)).toBeLessThan(FEATHER_TOLERANCE);
  });

  it("never lets the allowance approve the loss of the whole thing", async () => {
    /* The property, rather than a table of numbers: whatever the size, an
       allowance that could excuse a segment vanishing is not an allowance. */
    for (const owned of [1, 8, 58, 120, 999, 24_056]) {
      expect(featherToleranceFor(owned), `${owned} px`).toBeLessThan(owned);
    }
  });
});
