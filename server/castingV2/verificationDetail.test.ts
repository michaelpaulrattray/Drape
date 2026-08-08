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

  it("gives the crop a NARROW franchise — only the facets its own region covers", async () => {
    /* A crop of her cheeks must not answer a question about her hair merely
       because it happened to be in the call. */
    const detail = await detailForVerification({
      bytes: await speckledFrame(),
      facets: [MARKS, HAIR_WORN],
      masterRegions: new Map([["face skin", faceSkin]]),
    });
    expect(detail!.answers).toEqual([MARKS]);
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
  /** Answers each call from a script, and keeps every request it was sent. */
  function capturingEngine(replies: string[]): TextEngine & { requests: TextRequest[] } {
    const requests: TextRequest[] = [];
    return {
      id: "capturing",
      requests,
      async complete(request: TextRequest): Promise<TextResult> {
        const text = replies[Math.min(requests.length, replies.length - 1)]!;
        requests.push(request);
        return {
          text,
          provenance: { provider: "test", model: "capturing" } as unknown as TextResult["provenance"],
          latencyMs: 1,
        };
      },
    };
  }

  const SAW_THEM = '{"results":[{"id":1,"present":true,"saw":"light freckles across nose and cheeks"}]}';
  const SAW_NONE = '{"results":[{"id":1,"present":false,"saw":"clear skin, no visible freckles"}]}';

  const facts = [{ facet: MARKS, asked: "freckles", binding: false }] as const;
  const frame = Buffer.from("the frame");
  const detail = { bytes: Buffer.from("the enlargement"), contentType: "image/png", answers: [MARKS] };

  it("reads the crop in a SEPARATE call, on its own, never alongside the frame", async () => {
    /*
      The shape matters and was measured, not assumed. Sending the frame and the
      crop together in one call scored 1/5 on run-12's frame 03 where the crop
      alone scored 5/5 — the full portrait dominates and the reader answers from
      it. A magnifier you are allowed to ignore is not a magnifier.
    */
    const engine = capturingEngine([SAW_NONE, SAW_THEM]);
    await verifyRender({ bytes: frame, contentType: "image/png", detail, facts, engine });

    expect(engine.requests).toHaveLength(2);
    expect(engine.requests[0]!.images?.map((image) => image.bytes.toString())).toEqual(["the frame"]);
    expect(engine.requests[1]!.images?.map((image) => image.bytes.toString())).toEqual(["the enlargement"]);
    expect(engine.requests[1]!.system).toContain("MAGNIFIED CROP");
  });

  it("lets the close reading OVERTURN the frame's miss — the whole point", async () => {
    const engine = capturingEngine([SAW_NONE, SAW_THEM]);
    const verdict = await verifyRender({ bytes: frame, contentType: "image/png", detail, facts, engine });

    expect(verdict.checks[0]!.verified).toBe(true);
    expect(verdict.checks[0]!.saw).toBe("light freckles across nose and cheeks");
  });

  it("and equally lets it stand a miss up — it is a reading, not a rubber stamp", async () => {
    /* The direction that would manufacture a false pass. If the crop says the
       freckles are not there, they are not there. */
    const engine = capturingEngine([SAW_THEM, SAW_NONE]);
    const verdict = await verifyRender({ bytes: frame, contentType: "image/png", detail, facts, engine });

    expect(verdict.checks[0]!.verified).toBe(false);
    expect(verdict.checks[0]!.saw).toBe("clear skin, no visible freckles");
  });

  it("asks the crop ONLY about the facets it is entitled to answer", async () => {
    const engine = capturingEngine([
      '{"results":[{"id":1,"present":false,"saw":"clear skin"},{"id":2,"present":true,"saw":"hair gathered at the nape"}]}',
      SAW_THEM,
    ]);
    await verifyRender({
      bytes: frame,
      contentType: "image/png",
      detail,
      facts: [{ facet: MARKS, asked: "freckles" }, { facet: HAIR_WORN, asked: "tied up" }],
      engine,
    });

    expect(engine.requests[0]!.user).toContain("tied up");
    expect(engine.requests[1]!.user).not.toContain("tied up");
    expect(engine.requests[1]!.user).toContain("freckles");
  });

  it("reads once and never mentions a crop when there is no detail", async () => {
    /* A standing sentence about a photograph that is usually absent is a
       standing invitation to describe one. */
    const engine = capturingEngine([SAW_THEM]);
    await verifyRender({ bytes: frame, contentType: "image/png", facts, engine });

    expect(engine.requests).toHaveLength(1);
    expect(engine.requests[0]!.images).toHaveLength(1);
    expect(engine.requests[0]!.system).not.toContain("MAGNIFIED CROP");
  });

  it("keeps the frame's verdict when the close reading comes back unusable", async () => {
    /* A magnifier is an improvement to a reading, never a precondition for
       one. An outage on the second call must not destroy the first. */
    const engine = capturingEngine([SAW_THEM, "not json at all"]);
    const verdict = await verifyRender({ bytes: frame, contentType: "image/png", detail, facts, engine });

    expect(verdict.checks[0]!.verified).toBe(true);
    expect(verdict.unavailable).toBeUndefined();
  });

  it("magnifies on the RE-READ too, not just the first look", async () => {
    /*
      The re-read is where a refusal is actually decided (D-194). A magnifier
      present on the first reading and absent on the one that spends the user's
      credits would make the deciding reading blinder than the first — and the
      suite would be green.
    */
    const engine = capturingEngine([SAW_NONE, SAW_THEM]);
    const read = () => verifyRender({ bytes: frame, contentType: "image/png", detail, facts, engine });
    await read();
    await read();

    expect(engine.requests).toHaveLength(4);
    expect(engine.requests[3]!.system).toContain("MAGNIFIED CROP");
  });
});
