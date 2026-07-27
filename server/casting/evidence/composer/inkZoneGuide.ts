import sharp from "sharp";
import { assertInkAddSide, type InkAddSide } from "./inkAddRecipe";

const MAX_GUIDE_PIXELS = 40_000_000;
const MIN_GUIDE_DIMENSION = 256;
const MAX_GUIDE_BYTES = 20 * 1024 * 1024;

export interface NormalizedInkZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Front-facing image coordinates. Anatomical left appears on the viewer's
 * right. These are recipe authority, never client-provided geometry.
 */
export const FRONT_UPPER_TORSO_ZONES: Readonly<
  Record<InkAddSide, NormalizedInkZone>
> = Object.freeze({
  left: Object.freeze({ x: 0.54, y: 0.2, width: 0.27, height: 0.25 }),
  centre: Object.freeze({ x: 0.365, y: 0.19, width: 0.27, height: 0.26 }),
  right: Object.freeze({ x: 0.19, y: 0.2, width: 0.27, height: 0.25 }),
});

export interface InkZoneGuide {
  bytes: Buffer;
  mime: "image/png";
  width: number;
  height: number;
  side: InkAddSide;
  normalizedZone: NormalizedInkZone;
}

function boundedDimension(value: number | undefined): value is number {
  return value !== undefined
    && Number.isSafeInteger(value)
    && value >= MIN_GUIDE_DIMENSION
    && value <= 8192;
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

export async function buildInkZoneGuide(input: {
  targetBytes: Uint8Array;
  side: InkAddSide;
}): Promise<InkZoneGuide> {
  assertInkAddSide(input.side);
  const normalized = await sharp(Buffer.from(input.targetBytes), {
    failOn: "error",
    limitInputPixels: MAX_GUIDE_PIXELS,
  })
    .rotate()
    .png()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = normalized.info;
  if (
    !boundedDimension(width)
    || !boundedDimension(height)
    || width * height > MAX_GUIDE_PIXELS
  ) {
    throw new TypeError("Target view is not eligible for this ink recipe");
  }

  const zone = FRONT_UPPER_TORSO_ZONES[input.side];
  const x = Math.round(zone.x * width);
  const y = Math.round(zone.y * height);
  const boxWidth = Math.max(1, Math.round(zone.width * width));
  const boxHeight = Math.max(1, Math.round(zone.height * height));
  const strokeWidth = Math.max(2, Math.round(Math.min(width, height) * 0.004));
  const label = escapeXml(`${input.side.toUpperCase()} CHEST - INK ONLY HERE`);
  const fontSize = Math.max(12, Math.round(Math.min(width, height) * 0.018));
  const labelY = Math.max(fontSize + strokeWidth, y - fontSize * 0.45);
  const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="${strokeWidth * 2}"
    fill="rgba(190,45,45,0.13)" stroke="rgba(190,45,45,0.92)" stroke-width="${strokeWidth}"/>
  <text x="${x}" y="${labelY}" font-family="Arial, sans-serif" font-size="${fontSize}"
    font-weight="700" fill="rgba(125,20,20,0.96)">${label}</text>
</svg>`);

  const guided = await sharp(normalized.data)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();
  if (guided.length > MAX_GUIDE_BYTES) {
    throw new TypeError("Target view is not eligible for this ink recipe");
  }
  return {
    bytes: guided,
    mime: "image/png",
    width,
    height,
    side: input.side,
    normalizedZone: zone,
  };
}
