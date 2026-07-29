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

export interface SegmentedAnatomicalInkZoneGuide {
  bytes: Buffer;
  mime: "image/png";
  width: number;
  height: number;
  normalizedZoneGroups: readonly (readonly NormalizedInkZone[])[];
}

export interface InkCoordinateGridGuide {
  bytes: Buffer;
  mime: "image/png";
  width: number;
  height: number;
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

export async function buildSegmentedAnatomicalInkZoneGuide(input: {
  targetBytes: Uint8Array;
  features: readonly {
    normalizedZones: readonly NormalizedInkZone[];
    label: string;
  }[];
}): Promise<SegmentedAnatomicalInkZoneGuide> {
  if (input.features.length < 1 || input.features.length > 9) {
    throw new TypeError("Invalid server segmented ink feature set");
  }
  const features = input.features.map(({ normalizedZones, label }) => {
    const normalizedLabel = label.normalize("NFKC").replace(/\s+/g, " ").trim();
    if (
      !normalizedLabel
      || normalizedLabel.length > 80
      || normalizedZones.length < 1
      || normalizedZones.length > 4
    ) {
      throw new TypeError("Invalid server segmented ink feature");
    }
    return {
      normalizedZones: normalizedZones.map(assertNormalizedInkZone),
      label: normalizedLabel.toUpperCase(),
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
    Math.round(Math.min(width, height) * 0.014),
  );
  const rendered = features.flatMap((feature, featureIndex) =>
    feature.normalizedZones.map((zone, segmentIndex) => {
      const x = Math.round(zone.x * width);
      const y = Math.round(zone.y * height);
      const boxWidth = Math.max(1, Math.round(zone.width * width));
      const boxHeight = Math.max(1, Math.round(zone.height * height));
      const insideLabelY = y + fontSize + strokeWidth * 2;
      const labelY = insideLabelY <= y + boxHeight - strokeWidth
        ? insideLabelY
        : Math.max(fontSize + strokeWidth, y - fontSize * 0.4);
      const clipId = `ink-segment-label-${featureIndex}-${segmentIndex}`;
      const segmentLabel =
        `F${featureIndex + 1}.${segmentIndex + 1} ${feature.label}`;
      return {
        clip: `<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}"/></clipPath>`,
        element: `<rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="${strokeWidth * 2}"
      fill="rgba(190,45,45,0.10)" stroke="rgba(190,45,45,0.92)" stroke-width="${strokeWidth}"/>
    <text x="${x + strokeWidth * 2}" y="${labelY}" font-family="Arial, sans-serif" font-size="${fontSize}"
      font-weight="700" fill="rgba(125,20,20,0.96)" clip-path="url(#${clipId})">${escapeXml(segmentLabel)}</text>`,
      };
    })
  );
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
    normalizedZoneGroups: Object.freeze(features.map((feature) =>
      Object.freeze([...feature.normalizedZones])
    )),
  };
}

/**
 * A server-owned ruler for model-returned geometry. Coordinates are measured
 * against the complete image canvas, never a detected person/body bounding
 * box. The clean target remains separate composition authority.
 */
export async function buildInkCoordinateGridGuide(input: {
  targetBytes: Uint8Array;
}): Promise<InkCoordinateGridGuide> {
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
    1,
    Math.round(Math.min(width, height) * 0.0015),
  );
  const fontSize = Math.max(
    10,
    Math.round(Math.min(width, height) * 0.014),
  );
  const vertical = Array.from({ length: 11 }, (_unused, index) => {
    const value = index * 10;
    const x = Math.round((index / 10) * (width - 1));
    const labelX = Math.min(
      width - fontSize * 2.4,
      Math.max(strokeWidth * 2, x + strokeWidth * 2),
    );
    return {
      line: `<line x1="${x}" y1="0" x2="${x}" y2="${height - 1}"/>`,
      label:
        `<text x="${labelX}" y="${fontSize + strokeWidth * 2}">X${value}</text>`,
    };
  });
  const horizontal = Array.from({ length: 11 }, (_unused, index) => {
    const value = index * 10;
    const y = Math.round((index / 10) * (height - 1));
    const labelY = Math.min(
      height - strokeWidth * 2,
      Math.max(fontSize + strokeWidth * 2, y + fontSize),
    );
    return {
      line: `<line x1="0" y1="${y}" x2="${width - 1}" y2="${y}"/>`,
      label: `<text x="${strokeWidth * 3}" y="${labelY}">Y${value}</text>`,
    };
  });
  const overlay = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" stroke="rgba(22,96,180,0.62)" stroke-width="${strokeWidth}">
        ${vertical.map(({ line }) => line).join("\n")}
        ${horizontal.map(({ line }) => line).join("\n")}
      </g>
      <g font-family="Arial, sans-serif" font-size="${fontSize}"
        font-weight="700" fill="rgb(8,65,140)" stroke="rgba(255,255,255,0.92)"
        stroke-width="${Math.max(2, strokeWidth * 2)}" paint-order="stroke">
        ${vertical.map(({ label }) => label).join("\n")}
        ${horizontal.map(({ label }) => label).join("\n")}
      </g>
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
