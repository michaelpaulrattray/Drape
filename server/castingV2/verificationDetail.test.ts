/**
 * THE MAGNIFIER, DRIVEN — including the two ways it could quietly be a lie.
 *
 * This decides what the reader is shown before it decides whether somebody gets
 * charged, so it gets the same treatment as the reader itself: no live model,
 * no network, and a control for each way it could pass while being wrong.
 *
 * The two that matter, because a magnifier has exactly two dishonest failure
 * modes and neither shows up in a green suite that only checks the happy path:
 *
 *   IT NEVER FIRES     a detail that is silently `null` on the paid path leaves
 *                      the reader exactly as blind as before, and every test
 *                      about "the detail is correct" still passes. So the
 *                      contract is asserted **at the wire** — on what the
 *                      engine was actually handed (invariant 5).
 *   IT INVENTS PIGMENT a smooth resampler would hand the reader plausible
 *                      freckles the render does not contain, which is the
 *                      failure mode of the fix being a magnifier. The
 *                      nearest-neighbour promise is asserted by value, not by
 *                      reading the `kernel:` argument back.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import type { Mask } from "./maskedComposite";
import { facetOfSubject } from "./refineFacets";
import type { TextEngine, TextRequest, TextResult } from "../providers/types";
import { verifyRender } from "./renderVerification";
import {
  boxOfMask,
  detailForVerification,
  detailRegionNames,
  facetsNeedingMagnification,
  magnifiedDetail,
  needsMagnification,
} from "./verificationDetail";

const MARKS = facetOfSubject("marks");
const HAIR_WORN = facetOfSubject("hairWorn");

/** A mask with one filled rectangle, so the expected box is arithmetic. */
function maskWithRectangle(input: {
  width: number; height: number;
  left: number; top: number; right: number; bottom: number;
}): Mask {
  const data = Buffer.alloc(input.width * input.height, 0);
  for (let y = input.top; y <= input.bottom; y += 1) {
    for (let x = input.left; x <= input.right; x += 1) data[y * input.width + x] = 255;
  }
  return { data, width: input.width, height: input.height };
}

/** A picture with visible structure, so a resize cannot be asserted trivially. */
async function speckledFrame(width = 400, height = 400): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3, 180);
  for (let y = 20; y < height; y += 17) {
    for (let x = 13; x < width; x += 23) {
      const at = (y * width + x) * 3;
      pixels[at] = 40;
      pixels[at + 1] = 40;
      pixels[at + 2] = 40;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

describe("which facets are magnified, and where the box comes from", () => {
  it("is seeded with marks and nothing anybody merely suspects", () => {
    expect(facetsNeedingMagnification()).toEqual([MARKS]);
  });

  it("magnifies for marks and leaves every other facet's reading alone", () => {
    expect(needsMagnification([MARKS])).toBe(true);
    expect(needsMagnification([HAIR_WORN])).toBe(false);
    expect(needsMagnification([HAIR_WORN, MARKS])).toBe(true);
  });

  it("takes the region name from the facet table rather than a second list", () => {
    /* Derive, never mirror: if `REGION_OF_FACET` moves, this moves with it. */
    expect(detailRegionNames([MARKS])).toEqual(["face skin"]);
    expect(detailRegionNames([HAIR_WORN])).toEqual([]);
  });
});

describe("the box", () => {
  it("is the mask's extent, padded, and never outside the frame", () => {
    const mask = maskWithRectangle({ width: 200, height: 200, left: 50, top: 60, right: 149, bottom: 159 });
    const box = boxOfMask(mask, 0.10);
    /* 100px wide, 10px pad each side. */
    expect(box).toEqual({ left: 40, top: 50, width: 120, height: 120 });
  });

  it("clamps rather than running off the edge", () => {
    const mask = maskWithRectangle({ width: 100, height: 100, left: 0, top: 0, right: 99, bottom: 99 });
    const box = boxOfMask(mask, 0.25)!;
    expect(box.left).toBe(0);
    expect(box.top).toBe(0);
    expect(box.left + box.width).toBeLessThanOrEqual(100);
    expect(box.top + box.height).toBeLessThanOrEqual(100);
  });

  it("REFUSES an empty mask rather than returning a crop of nothing", () => {
    const empty: Mask = { data: Buffer.alloc(100 * 100, 0), width: 100, height: 100 };
    expect(boxOfMask(empty)).toBeNull();
  });
});

describe("the enlargement cannot manufacture what it is looking for", () => {
  it("invents no value that was not already in the crop", async () => {
    /*
      THE NEAREST-NEIGHBOUR PROMISE, ASSERTED BY VALUE.

      A smooth resampler blends neighbours, so it produces greys that appear
      nowhere in the source — exactly how a magnifier would start handing the
      reader pigment the render does not contain. Nearest-neighbour can only
      repeat values it was given, so the enlarged image's value SET must be a
      subset of the crop's. Reading the `kernel:` argument back would prove we
      typed it; this proves what it does.
    */
    const frame = await speckledFrame();
    const box = { left: 50, top: 50, width: 200, height: 200 };
    const detail = await magnifiedDetail({ bytes: frame, box });
    expect(detail).not.toBeNull();

    const source = await sharp(frame).extract(box).greyscale().raw().toBuffer();
    const enlarged = await sharp(detail!.bytes).greyscale().raw().toBuffer();
    const sourceValues = new Set(source);
    const invented = Array.from(new Set(enlarged)).filter((value) => !sourceValues.has(value));
    expect(invented).toEqual([]);
  });

  it("actually enlarges — more pixels than the crop it came from", async () => {
    const frame = await speckledFrame();
    const box = { left: 50, top: 50, width: 200, height: 200 };
    const detail = await magnifiedDetail({ bytes: frame, box });
    const meta = await sharp(detail!.bytes).metadata();
    expect(meta.width).toBe(400);
  });

  it("declines a box too small to be a face rather than sending a thumbnail", async () => {
    const frame = await speckledFrame();
    const detail = await magnifiedDetail({ bytes: frame, box: { left: 0, top: 0, width: 32, height: 32 } });
    expect(detail).toBeNull();
  });

  it("declines rather than throwing when the crop is impossible", async () => {
    /* A detail improves a reading; it is never a precondition for one. A
       verification that failed because a crop failed would turn a
       nice-to-have into an outage. */
    const frame = await speckledFrame(400, 400);
    const detail = await magnifiedDetail({ bytes: frame, box: { left: 300, top: 300, width: 300, height: 300 } });
    expect(detail).toBeNull();
  });
});

describe("choosing a detail from what the harvest already segmented", () => {
  const faceSkin = maskWithRectangle({ width: 400, height: 400, left: 100, top: 100, right: 299, bottom: 299 });

  it("uses the master region the composite already had — no new segmentation", async () => {
    const detail = await detailForVerification({
      bytes: await speckledFrame(),
      facets: [MARKS],
      masterRegions: new Map([["face skin", faceSkin]]),
    });
    expect(detail).not.toBeNull();
    expect(detail!.contentType).toBe("image/png");
  });

  it("sends nothing when the step's harvest never touched the face", async () => {
    /* The honest partial. Frame 04's step segmented an earlobe, not skin. */
    const detail = await detailForVerification({
      bytes: await speckledFrame(),
      facets: [MARKS],
      masterRegions: new Map([["earring", faceSkin]]),
    });
    expect(detail).toBeNull();
  });

  it("sends nothing when there is no composite evidence at all", async () => {
    expect(await detailForVerification({
      bytes: await speckledFrame(), facets: [MARKS], masterRegions: null,
    })).toBeNull();
  });

  it("sends nothing for facets nobody has measured a blindness for", async () => {
    expect(await detailForVerification({
      bytes: await speckledFrame(),
      facets: [HAIR_WORN],
      masterRegions: new Map([["face skin", faceSkin]]),
    })).toBeNull();
  });
});

describe("at the wire — what the reader was actually handed", () => {
  function capturingEngine(): TextEngine & { requests: TextRequest[] } {
    const requests: TextRequest[] = [];
    return {
      id: "capturing",
      requests,
      async complete(request: TextRequest): Promise<TextResult> {
        requests.push(request);
        return {
          text: '{"results":[{"id":1,"present":true,"saw":"light freckles across nose and cheeks"}]}',
          provenance: { provider: "test", model: "capturing" } as unknown as TextResult["provenance"],
          latencyMs: 1,
        };
      },
    };
  }

  const facts = [{ facet: MARKS, asked: "freckles", binding: false }] as const;
  const frame = Buffer.from("the frame");
  const detail = { bytes: Buffer.from("the enlargement"), contentType: "image/png" };

  it("sends BOTH images, in order, and says what the second one is", async () => {
    const engine = capturingEngine();
    await verifyRender({ bytes: frame, contentType: "image/png", detail, facts, engine });

    const request = engine.requests[0]!;
    expect(request.images?.map((image) => image.bytes.toString()))
      .toEqual(["the frame", "the enlargement"]);
    expect(request.system).toContain("THE SECOND IMAGE IS THE SAME PHOTOGRAPH, ENLARGED");
  });

  it("sends ONE image and never mentions a second when there is no detail", async () => {
    /* A standing sentence about a photograph that is usually absent is a
       standing invitation to describe one. */
    const engine = capturingEngine();
    await verifyRender({ bytes: frame, contentType: "image/png", facts, engine });

    const request = engine.requests[0]!;
    expect(request.images).toHaveLength(1);
    expect(request.system).not.toContain("SECOND IMAGE");
  });

  it("carries the detail into the RE-READ too, not just the first look", async () => {
    /*
      The re-read is where a refusal is actually decided (D-194). A magnifier
      present on the first reading and absent on the one that spends the user's
      credits would make the second reading systematically blinder than the
      first — and the suite would be green.
    */
    const engine = capturingEngine();
    const read = () => verifyRender({ bytes: frame, contentType: "image/png", detail, facts, engine });
    await read();
    await read();

    expect(engine.requests).toHaveLength(2);
    for (const request of engine.requests) {
      expect(request.images).toHaveLength(2);
    }
  });
});
