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

export interface AnatomicalInkZoneGuide {
  bytes: Buffer;
  mime: "image/png";
  width: number;
  height: number;
  normalizedZone: NormalizedInkZone;
}

export interface MultiAnatomicalInkZoneGuide {
  bytes: Buffer;
  mime: "image/png";
  width: number;
  height: number;
  normalizedZones: readonly NormalizedInkZone[];
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

function assertNormalizedInkZone(
  value: NormalizedInkZone,
): NormalizedInkZone {
  const coordinates = [value.x, value.y, value.width, value.height];
  if (
    coordinates.some((coordinate) => !Number.isFinite(coordinate))
    || value.x < 0
    || value.y < 0
    || value.width <= 0
    || value.height <= 0
    || value.x + value.width > 1
    || value.y + value.height > 1
  ) {
    throw new TypeError("Invalid server ink zone");
  }
  return value;
}

export async function buildAnatomicalInkZoneGuide(input: {
  targetBytes: Uint8Array;
  normalizedZone: NormalizedInkZone;
  label: string;
}): Promise<AnatomicalInkZoneGuide> {
  const zone = assertNormalizedInkZone(input.normalizedZone);
  const guideLabel = input.label.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!guideLabel || guideLabel.length > 80) {
    throw new TypeError("Invalid server ink zone label");
  }
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

  const x = Math.round(zone.x * width);
  const y = Math.round(zone.y * height);
  const boxWidth = Math.max(1, Math.round(zone.width * width));
  const boxHeight = Math.max(1, Math.round(zone.height * height));
  const strokeWidth = Math.max(2, Math.round(Math.min(width, height) * 0.004));
  const label = escapeXml(`${guideLabel.toUpperCase()} - INK ONLY HERE`);
  const fontSize = Math.max(12, Math.round(Math.min(width, height) * 0.018));
  const insideLabelY = y + fontSize + strokeWidth * 2;
  const labelY = insideLabelY <= y + boxHeight - strokeWidth
    ? insideLabelY
    : Math.max(fontSize + strokeWidth, y - fontSize * 0.45);
  const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="ink-zone-label">
      <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}"/>
    </clipPath>
  </defs>
  <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="${strokeWidth * 2}"
    fill="rgba(190,45,45,0.13)" stroke="rgba(190,45,45,0.92)" stroke-width="${strokeWidth}"/>
  <text x="${x + strokeWidth * 2}" y="${labelY}" font-family="Arial, sans-serif" font-size="${fontSize}"
    font-weight="700" fill="rgba(125,20,20,0.96)" clip-path="url(#ink-zone-label)">${label}</text>
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
    normalizedZone: zone,
  };
}

export async function buildMultiAnatomicalInkZoneGuide(input: {
  targetBytes: Uint8Array;
  zones: readonly {
    normalizedZone: NormalizedInkZone;
    label: string;
  }[];
}): Promise<MultiAnatomicalInkZoneGuide> {
  if (input.zones.length < 1 || input.zones.length > 9) {
    throw new TypeError("Invalid server ink zone set");
  }
  const zones = input.zones.map(({ normalizedZone, label }, index) => {
    const normalizedLabel = label.normalize("NFKC").replace(/\s+/g, " ").trim();
    if (!normalizedLabel || normalizedLabel.length > 80) {
      throw new TypeError("Invalid server ink zone label");
    }
    return {
      normalizedZone: assertNormalizedInkZone(normalizedZone),
      label: `F${index + 1} ${normalizedLabel}`.toUpperCase(),
    };
  });
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
  const strokeWidth = Math.max(
    2,
    Math.round(Math.min(width, height) * 0.004),
  );
  const fontSize = Math.max(
    12,
    Math.round(Math.min(width, height) * 0.016),
  );
  const rendered = zones.map(({ normalizedZone: zone, label }, index) => {
    const x = Math.round(zone.x * width);
    const y = Math.round(zone.y * height);
    const boxWidth = Math.max(1, Math.round(zone.width * width));
    const boxHeight = Math.max(1, Math.round(zone.height * height));
    const insideLabelY = y + fontSize + strokeWidth * 2;
    const labelY = insideLabelY <= y + boxHeight - strokeWidth
      ? insideLabelY
      : Math.max(fontSize + strokeWidth, y - fontSize * 0.4);
    const clipId = `ink-zone-label-${index}`;
    return {
      clip: `<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}"/></clipPath>`,
      element: `<rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="${strokeWidth * 2}"
      fill="rgba(190,45,45,0.10)" stroke="rgba(190,45,45,0.92)" stroke-width="${strokeWidth}"/>
    <text x="${x + strokeWidth * 2}" y="${labelY}" font-family="Arial, sans-serif" font-size="${fontSize}"
      font-weight="700" fill="rgba(125,20,20,0.96)" clip-path="url(#${clipId})">${escapeXml(label)}</text>`,
    };
  });
  const overlay = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>${rendered.map(({ clip }) => clip).join("\n")}</defs>
      ${rendered.map(({ element }) => element).join("\n")}
    </svg>`,
  );
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
    normalizedZones: Object.freeze(
      zones.map(({ normalizedZone }) => normalizedZone),
    ),
  };
}

export async function buildInkZoneGuide(input: {
  targetBytes: Uint8Array;
  side: InkAddSide;
}): Promise<InkZoneGuide> {
  assertInkAddSide(input.side);
  const guide = await buildAnatomicalInkZoneGuide({
    targetBytes: input.targetBytes,
    normalizedZone: FRONT_UPPER_TORSO_ZONES[input.side],
    label: `${input.side} chest`,
  });
  return {
    ...guide,
    side: input.side,
  };
}
