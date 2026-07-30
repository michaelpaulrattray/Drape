import sharp from "sharp";
import { describe, expect, it } from "vitest";

import type { InkPoseAnatomyGuide } from "./inkPoseGeometry";
import {
  extractAcceptedInkFeatureMask,
  InkFeatureMaskError,
} from "./inkFeatureMask";
import { INK_POSE_GEOMETRY_RECIPE_VERSION } from "./inkPoseGeometry";

const WIDTH = 160;
const HEIGHT = 240;

function guide(maskBounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): InkPoseAnatomyGuide {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (
    let y = maskBounds.y;
    y < maskBounds.y + maskBounds.height;
    y += 1
  ) {
    for (
      let x = maskBounds.x;
      x < maskBounds.x + maskBounds.width;
      x += 1
    ) {
      mask[y * WIDTH + x] = 255;
    }
  }
  return {
    recipeVersion: INK_POSE_GEOMETRY_RECIPE_VERSION,
    tuple: {
      zone: "upper_arm",
      surface: "anterior",
      side: "right",
    },
    width: WIDTH,
    height: HEIGHT,
    mask,
    normalizedSegments: [{
      x: maskBounds.x / WIDTH,
      y: maskBounds.y / HEIGHT,
      width: maskBounds.width / WIDTH,
      height: maskBounds.height / HEIGHT,
    }],
    visiblePrimitiveIndexes: [0],
    minimumLandmarkScore: 0.99,
  };
}

async function image(
  edits: readonly {
    x: number;
    y: number;
    width: number;
    height: number;
    colour: { r: number; g: number; b: number };
  }[] = [],
): Promise<Buffer> {
  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: { r: 188, g: 139, b: 112 },
    },
  })
    .composite(edits.map((edit) => ({
      input: {
        create: {
          width: edit.width,
          height: edit.height,
          channels: 3,
          background: edit.colour,
        },
      },
      left: edit.x,
      top: edit.y,
    })))
    .png()
    .toBuffer();
}

describe("accepted tattoo feature mask", () => {
  it("isolates only the newly accepted tattoo inside pose anatomy", async () => {
    const priorTattoo = {
      x: 20,
      y: 50,
      width: 9,
      height: 18,
      colour: { r: 18, g: 18, b: 18 },
    };
    const newTattoo = {
      x: 104,
      y: 82,
      width: 12,
      height: 24,
      colour: { r: 12, g: 12, b: 12 },
    };
    const result = await extractAcceptedInkFeatureMask({
      cleanSource: await image([priorTattoo]),
      acceptedCandidate: await image([priorTattoo, newTattoo]),
      anatomyGuide: guide({ x: 90, y: 60, width: 42, height: 80 }),
    });

    expect(result.featurePixelCount).toBeGreaterThan(200);
    expect(result.normalizedBounds.x).toBeGreaterThan(0.6);
    expect(result.normalizedBounds.y).toBeGreaterThan(0.3);
    expect(result.outsideAnatomyChangedPixelCount).toBe(0);
    expect(result.mask[55 * WIDTH + 24]).toBe(0);
    expect(result.mask[90 * WIDTH + 110]).toBe(255);
  });

  it("drops diffuse generative drift while retaining the dominant tattoo", async () => {
    const result = await extractAcceptedInkFeatureMask({
      cleanSource: await image(),
      acceptedCandidate: await image([
        {
          x: 104,
          y: 82,
          width: 12,
          height: 24,
          colour: { r: 12, g: 12, b: 12 },
        },
        {
          x: 92,
          y: 120,
          width: 38,
          height: 12,
          colour: { r: 160, g: 116, b: 95 },
        },
      ]),
      anatomyGuide: guide({ x: 90, y: 60, width: 42, height: 80 }),
    });

    expect(result.mask[90 * WIDTH + 110]).toBe(255);
    expect(result.mask[125 * WIDTH + 110]).toBe(0);
    expect(result.normalizedBounds.y).toBeLessThan(0.5);
  });

  it("retains similarly strong disconnected parts of one tattoo", async () => {
    const result = await extractAcceptedInkFeatureMask({
      cleanSource: await image(),
      acceptedCandidate: await image([
        {
          x: 98,
          y: 82,
          width: 8,
          height: 20,
          colour: { r: 12, g: 12, b: 12 },
        },
        {
          x: 116,
          y: 82,
          width: 8,
          height: 20,
          colour: { r: 12, g: 12, b: 12 },
        },
      ]),
      anatomyGuide: guide({ x: 90, y: 60, width: 42, height: 80 }),
    });

    expect(result.retainedComponentCount).toBe(2);
    expect(result.mask[90 * WIDTH + 101]).toBe(255);
    expect(result.mask[90 * WIDTH + 119]).toBe(255);
  });

  it("fails closed when no material feature was added", async () => {
    const unchanged = await image();
    await expect(extractAcceptedInkFeatureMask({
      cleanSource: unchanged,
      acceptedCandidate: unchanged,
      anatomyGuide: guide({ x: 90, y: 60, width: 42, height: 80 }),
    })).rejects.toMatchObject<Partial<InkFeatureMaskError>>({
      code: "feature_absent",
    });
  });

  it("fails closed when evidence contains only moderate diffuse drift", async () => {
    await expect(extractAcceptedInkFeatureMask({
      cleanSource: await image(),
      acceptedCandidate: await image([{
        x: 92,
        y: 76,
        width: 38,
        height: 50,
        colour: { r: 160, g: 116, b: 95 },
      }]),
      anatomyGuide: guide({ x: 90, y: 60, width: 42, height: 80 }),
    })).rejects.toMatchObject<Partial<InkFeatureMaskError>>({
      code: "feature_absent",
    });
  });

  it("fails closed when the change is on the opposite anatomy", async () => {
    await expect(extractAcceptedInkFeatureMask({
      cleanSource: await image(),
      acceptedCandidate: await image([{
        x: 18,
        y: 75,
        width: 18,
        height: 30,
        colour: { r: 5, g: 5, b: 5 },
      }]),
      anatomyGuide: guide({ x: 90, y: 60, width: 42, height: 80 }),
    })).rejects.toMatchObject<Partial<InkFeatureMaskError>>({
      code: "feature_absent",
    });
  });

  it("rejects broad candidate drift outside the authorized anatomy", async () => {
    await expect(extractAcceptedInkFeatureMask({
      cleanSource: await image(),
      acceptedCandidate: await image([
        {
          x: 104,
          y: 82,
          width: 12,
          height: 24,
          colour: { r: 12, g: 12, b: 12 },
        },
        {
          x: 0,
          y: 150,
          width: WIDTH,
          height: 60,
          colour: { r: 120, g: 90, b: 80 },
        },
      ]),
      anatomyGuide: guide({ x: 90, y: 60, width: 42, height: 80 }),
    })).rejects.toMatchObject<Partial<InkFeatureMaskError>>({
      code: "source_drift",
    });
  });

  it("rejects evidence frames with different dimensions", async () => {
    const accepted = await sharp({
      create: {
        width: WIDTH + 1,
        height: HEIGHT,
        channels: 3,
        background: { r: 188, g: 139, b: 112 },
      },
    }).png().toBuffer();
    await expect(extractAcceptedInkFeatureMask({
      cleanSource: await image(),
      acceptedCandidate: accepted,
      anatomyGuide: guide({ x: 90, y: 60, width: 42, height: 80 }),
    })).rejects.toMatchObject<Partial<InkFeatureMaskError>>({
      code: "dimension_mismatch",
    });
  });
});
