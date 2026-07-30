import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { buildPoseInkProjectionGuide } from "./inkPoseGuide";

describe("pose tattoo projection guide", () => {
  it("renders red authority only where the deterministic mask is present", async () => {
    const width = 120;
    const height = 160;
    const target = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 180, g: 140, b: 110 },
      },
    }).png().toBuffer();
    const mask = new Uint8Array(width * height);
    for (let y = 70; y < 100; y += 1) {
      for (let x = 80; x < 95; x += 1) mask[y * width + x] = 255;
    }
    const guide = await buildPoseInkProjectionGuide({
      targetBytes: target,
      features: [{
        width,
        height,
        mask,
        normalizedSegments: [{
          x: 80 / width,
          y: 70 / height,
          width: 15 / width,
          height: 30 / height,
        }],
        label: "subject right upper arm",
      }],
    });
    const output = await sharp(guide.bytes).removeAlpha().raw().toBuffer();
    const outside = 130 * width + 20;
    const inside = 85 * width + 87;

    expect([
      output[outside * 3],
      output[outside * 3 + 1],
      output[outside * 3 + 2],
    ]).toEqual([180, 140, 110]);
    expect(output[inside * 3]).toBeGreaterThan(output[inside * 3 + 1]!);

    let redAuthorityOutsideMask = 0;
    for (let index = 0; index < width * height; index += 1) {
      if (mask[index]) continue;
      const red = output[index * 3]!;
      const green = output[index * 3 + 1]!;
      const blue = output[index * 3 + 2]!;
      if (red > 180 && green < 135 && blue < 105) {
        redAuthorityOutsideMask += 1;
      }
    }
    expect(redAuthorityOutsideMask).toBe(0);
  });
});
