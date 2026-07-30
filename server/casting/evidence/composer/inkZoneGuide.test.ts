import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  FRONT_UPPER_TORSO_ZONES,
  buildAnatomicalInkZoneGuide,
  buildInkZoneGuide,
} from "./inkZoneGuide";
import { inkViewDirectiveV2 } from "../inkAnatomyRegistry";

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

  it("renders arbitrary server-owned anatomy without accepting client geometry", async () => {
    const zone = { x: 0.64, y: 0.24, width: 0.18, height: 0.4 };
    const guide = await buildAnatomicalInkZoneGuide({
      targetBytes: await target(),
      normalizedZone: zone,
      label: "left full arm",
    });
    expect(guide).toMatchObject({
      width: 600,
      height: 900,
      normalizedZone: zone,
    });
    await expect(buildAnatomicalInkZoneGuide({
      targetBytes: await target(),
      normalizedZone: { x: 0.9, y: 0.2, width: 0.2, height: 0.3 },
      label: "invalid",
    })).rejects.toThrow("Invalid server ink zone");
  });

  it("keeps a right full-arm guide entirely on frame-left", async () => {
    const source = await target();
    const normalizedZone = inkViewDirectiveV2({
      zone: "full_arm",
      surface: "circumferential",
      side: "right",
    }, "frontFull").normalizedTargetZone!;
    const guide = await buildAnatomicalInkZoneGuide({
      targetBytes: source,
      normalizedZone,
      label: "subject right - frame left",
    });
    const [sourceRaw, guideRaw] = await Promise.all([
      sharp(source).rotate().ensureAlpha().raw()
        .toBuffer({ resolveWithObject: true }),
      sharp(guide.bytes).ensureAlpha().raw()
        .toBuffer({ resolveWithObject: true }),
    ]);
    const channels = guideRaw.info.channels;
    let changedFrameRightBytes = 0;
    for (let y = 0; y < guideRaw.info.height; y += 1) {
      for (
        let x = Math.floor(guideRaw.info.width / 2);
        x < guideRaw.info.width;
        x += 1
      ) {
        const offset = (y * guideRaw.info.width + x) * channels;
        for (let channel = 0; channel < channels; channel += 1) {
          if (guideRaw.data[offset + channel] !== sourceRaw.data[offset + channel]) {
            changedFrameRightBytes += 1;
          }
        }
      }
    }
    expect(changedFrameRightBytes).toBe(0);
  });
});
