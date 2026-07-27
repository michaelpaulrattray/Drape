import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  FRONT_UPPER_TORSO_ZONES,
  buildInkZoneGuide,
} from "./inkZoneGuide";

async function target(): Promise<Buffer> {
  return sharp({
    create: {
      width: 600,
      height: 900,
      channels: 3,
      background: { r: 190, g: 165, b: 145 },
    },
  }).jpeg().toBuffer();
}

describe("R7-7D server-owned ink zone guide", () => {
  it("pins anatomical left to the viewer's right and preserves image dimensions", async () => {
    expect(FRONT_UPPER_TORSO_ZONES.left.x)
      .toBeGreaterThan(FRONT_UPPER_TORSO_ZONES.right.x);
    const guide = await buildInkZoneGuide({
      targetBytes: await target(),
      side: "left",
    });
    expect(guide).toMatchObject({
      mime: "image/png",
      width: 600,
      height: 900,
      side: "left",
      normalizedZone: FRONT_UPPER_TORSO_ZONES.left,
    });
    const metadata = await sharp(guide.bytes).metadata();
    expect(metadata).toMatchObject({ width: 600, height: 900, format: "png" });
  });

  it("uses only the closed side vocabulary and refuses undersized targets", async () => {
    await expect(buildInkZoneGuide({
      targetBytes: await target(),
      side: "shoulder" as "left",
    })).rejects.toThrow("Unknown ink placement");
    const tiny = await sharp({
      create: {
        width: 120,
        height: 120,
        channels: 3,
        background: "white",
      },
    }).png().toBuffer();
    await expect(buildInkZoneGuide({ targetBytes: tiny, side: "centre" }))
      .rejects.toThrow("not eligible");
  });
});
