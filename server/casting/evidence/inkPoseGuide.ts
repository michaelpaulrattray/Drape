import sharp from "sharp";

import type { NormalizedInkZone } from "./composer/inkZoneGuide";

export const INK_POSE_GUIDE_RECIPE_VERSION =
  "ink.pose-guide.v1" as const;

export interface InkPoseGuideFeature {
  width: number;
  height: number;
  mask: Uint8Array;
  normalizedSegments: readonly NormalizedInkZone[];
  label: string;
}

export interface InkPoseProjectionGuide {
  recipeVersion: typeof INK_POSE_GUIDE_RECIPE_VERSION;
  bytes: Buffer;
  mime: "image/png";
  width: number;
  height: number;
  normalizedZoneGroups: readonly (readonly NormalizedInkZone[])[];
}

const MAX_PIXELS = 40_000_000;
const MAX_BYTES = 20 * 1024 * 1024;

function validZone(zone: NormalizedInkZone): boolean {
  return [
    zone.x,
    zone.y,
    zone.width,
    zone.height,
  ].every(Number.isFinite)
    && zone.x >= 0
    && zone.y >= 0
    && zone.width > 0
    && zone.height > 0
    && zone.x + zone.width <= 1
    && zone.y + zone.height <= 1;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]!);
}

/**
 * Render the exact pose-projected pixel authority. Red pixels are the only
 * area in which the image composer may reproduce a selected tattoo.
 */
export async function buildPoseInkProjectionGuide(input: {
  targetBytes: Uint8Array;
  features: readonly InkPoseGuideFeature[];
}): Promise<InkPoseProjectionGuide> {
  if (input.features.length < 1 || input.features.length > 9) {
    throw new TypeError("Invalid pose tattoo guide feature set");
  }
  for (const feature of input.features) {
    const label = feature.label.normalize("NFKC").replace(/\s+/g, " ").trim();
    if (
      feature.width < 1
      || feature.height < 1
      || feature.mask.length !== feature.width * feature.height
      || !feature.mask.some(Boolean)
      || feature.normalizedSegments.length < 1
      || feature.normalizedSegments.length > 4
      || feature.normalizedSegments.some((zone) => !validZone(zone))
      || label.length < 2
      || label.length > 120
    ) {
      throw new TypeError("Invalid pose tattoo guide feature");
    }
  }
  const normalized = await sharp(Buffer.from(input.targetBytes), {
    failOn: "error",
    limitInputPixels: MAX_PIXELS,
  }).rotate().png().toBuffer({ resolveWithObject: true });
  const { width, height } = normalized.info;
  if (
    !width
    || !height
    || width * height > MAX_PIXELS
    || Math.abs(
      width / height - input.features[0]!.width / input.features[0]!.height,
    ) > 0.005
  ) {
    throw new TypeError("Pose tattoo guide dimensions do not match target");
  }

  const combinedAlpha = new Uint8Array(width * height);
  for (const feature of input.features) {
    if (
      Math.abs(width / height - feature.width / feature.height) > 0.005
    ) {
      throw new TypeError("Pose tattoo guide dimensions do not match target");
    }
    const resized = await sharp(Buffer.from(feature.mask), {
      raw: {
        width: feature.width,
        height: feature.height,
        channels: 1,
      },
    })
      .resize(width, height, { kernel: "nearest" })
      .threshold(127)
      .raw()
      .toBuffer();
    for (let index = 0; index < combinedAlpha.length; index += 1) {
      if (resized[index]) combinedAlpha[index] = 72;
    }
  }
  const overlay = Buffer.alloc(width * height * 4);
  for (let index = 0; index < combinedAlpha.length; index += 1) {
    const offset = index * 4;
    overlay[offset] = 190;
    overlay[offset + 1] = 45;
    overlay[offset + 2] = 45;
    overlay[offset + 3] = combinedAlpha[index]!;
  }
  const fontSize = Math.max(12, Math.round(Math.min(width, height) * 0.016));
  const strokeWidth = Math.max(2, Math.round(Math.min(width, height) * 0.003));
  const labels = input.features.map((feature, index) => {
    const segment = feature.normalizedSegments[0]!;
    const x = Math.max(4, Math.round(segment.x * width));
    const y = Math.max(
      fontSize + 4,
      Math.round(segment.y * height) + fontSize + strokeWidth,
    );
    return `<text x="${x}" y="${y}" font-family="Arial, sans-serif"
      font-size="${fontSize}" font-weight="700" fill="rgba(20,60,145,0.98)"
      stroke="rgba(255,255,255,0.8)" stroke-width="${strokeWidth * 0.35}"
      paint-order="stroke">${escapeXml(
        `F${index + 1} ${feature.label.toUpperCase()} - BLUE LABEL IS METADATA`,
      )}</text>`;
  }).join("\n");
  const labelOverlay = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${labels}</svg>`,
  );
  const bytes = await sharp(normalized.data)
    .composite([
      {
        input: overlay,
        raw: { width, height, channels: 4 },
        left: 0,
        top: 0,
      },
      { input: labelOverlay, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
  if (bytes.length > MAX_BYTES) {
    throw new TypeError("Pose tattoo guide is too large");
  }
  return Object.freeze({
    recipeVersion: INK_POSE_GUIDE_RECIPE_VERSION,
    bytes,
    mime: "image/png",
    width,
    height,
    normalizedZoneGroups: Object.freeze(
      input.features.map((feature) =>
        Object.freeze([...feature.normalizedSegments])
      ),
    ),
  });
}
