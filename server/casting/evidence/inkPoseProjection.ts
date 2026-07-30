import sharp from "sharp";

import type { NormalizedInkZone } from "./composer/inkZoneGuide";
import type { InkFeatureMask } from "./inkFeatureMask";
import {
  buildInkPoseAnatomyGuide,
  buildInkPoseGeometryPrimitives,
  INK_POSE_GEOMETRY_RECIPE_VERSION,
  type InkPoseAnatomyGuide,
  type InkPoseGeometryPoint,
  type InkPoseGeometryPrimitive,
} from "./inkPoseGeometry";
import type { InkAnatomyTuple } from "./inkAnatomyRegistry";
import type { InkPoseAnalysis } from "./inkPoseRuntime";

export const INK_POSE_PROJECTION_RECIPE_VERSION =
  "ink.pose-projection.v2" as const;

export type InkPoseProjectionFailureCode =
  | "dimension_mismatch"
  | "authority_mismatch"
  | "primitive_mismatch"
  | "source_outside_anatomy"
  | "target_surface_empty"
  | "delta_contaminated";

export class InkPoseProjectionError extends Error {
  constructor(
    readonly code: InkPoseProjectionFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "InkPoseProjectionError";
  }
}

export interface InkPoseProjection {
  recipeVersion: typeof INK_POSE_PROJECTION_RECIPE_VERSION;
  tuple: InkAnatomyTuple;
  width: number;
  height: number;
  mask: Uint8Array;
  normalizedSegments: readonly NormalizedInkZone[];
  projectedPixelCount: number;
  expectedPixelCount: number;
}

export interface DeterministicInkProjectionFeature {
  cleanSource: Uint8Array;
  acceptedCandidate: Uint8Array;
  sourceAnalysis: InkPoseAnalysis;
  sourceGuide: InkPoseAnatomyGuide;
  featureMask: InkFeatureMask;
  targetGuide: InkPoseAnatomyGuide;
  projection: InkPoseProjection;
}

export interface DeterministicInkProjectionComposite {
  bytes: Buffer;
  mime: "image/png";
  width: number;
  height: number;
  changedPixelCount: number;
  authorizedPixelCount: number;
  outsideAuthorizedChangeCount: 0;
  featureChangedPixelCounts: readonly number[];
}

type Point = InkPoseGeometryPoint;

const MAX_COMPOSITE_PIXELS = 40_000_000;
const GAIN_BIN_COUNT = 1001;
const MIN_GLOBAL_GAIN = 0.8;
const MAX_GLOBAL_GAIN = 1.25;
const MIN_INK_RATIO = 0.04;
const MAX_INK_RATIO = 4;

function distanceSquared(left: Point, right: Point): number {
  const x = left.x - right.x;
  const y = left.y - right.y;
  return x * x + y * y;
}

function pointSegmentDistanceSquared(
  point: Point,
  a: Point,
  b: Point,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const denominator = dx * dx + dy * dy;
  const ratio = denominator === 0
    ? 0
    : Math.min(
      1,
      Math.max(
        0,
        ((point.x - a.x) * dx + (point.y - a.y) * dy) / denominator,
      ),
    );
  return distanceSquared(point, {
    x: a.x + dx * ratio,
    y: a.y + dy * ratio,
  });
}

function insidePolygon(point: Point, points: readonly Point[]): boolean {
  let inside = false;
  for (
    let current = 0, previous = points.length - 1;
    current < points.length;
    previous = current, current += 1
  ) {
    const a = points[current]!;
    const b = points[previous]!;
    if (
      (a.y > point.y) !== (b.y > point.y)
      && point.x
        < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function contains(
  primitive: InkPoseGeometryPrimitive,
  point: Point,
): boolean {
  if (primitive.kind === "capsule") {
    return pointSegmentDistanceSquared(point, primitive.a, primitive.b)
      <= primitive.radius * primitive.radius;
  }
  if (primitive.kind === "ellipse") {
    const x = (point.x - primitive.centre.x) / primitive.rx;
    const y = (point.y - primitive.centre.y) / primitive.ry;
    return x * x + y * y <= 1;
  }
  return insidePolygon(point, primitive.points);
}

function capsuleMap(
  point: Point,
  source: Extract<InkPoseGeometryPrimitive, { kind: "capsule" }>,
  target: Extract<InkPoseGeometryPrimitive, { kind: "capsule" }>,
): Point {
  const sourceDx = source.b.x - source.a.x;
  const sourceDy = source.b.y - source.a.y;
  const sourceLength = Math.hypot(sourceDx, sourceDy);
  const targetDx = target.b.x - target.a.x;
  const targetDy = target.b.y - target.a.y;
  const targetLength = Math.hypot(targetDx, targetDy);
  if (
    sourceLength < 0.005
    || targetLength < 0.005
    || source.radius <= 0
    || target.radius <= 0
  ) {
    throw new InkPoseProjectionError(
      "primitive_mismatch",
      "Tattoo limb projection geometry is degenerate",
    );
  }
  const sourceUnitX = sourceDx / sourceLength;
  const sourceUnitY = sourceDy / sourceLength;
  const along = (
    (point.x - source.a.x) * sourceUnitX
    + (point.y - source.a.y) * sourceUnitY
  ) / sourceLength;
  const across = (
    (point.x - source.a.x) * -sourceUnitY
    + (point.y - source.a.y) * sourceUnitX
  ) / source.radius;
  const targetUnitX = targetDx / targetLength;
  const targetUnitY = targetDy / targetLength;
  return {
    x:
      target.a.x
      + targetUnitX * along * targetLength
      - targetUnitY * across * target.radius,
    y:
      target.a.y
      + targetUnitY * along * targetLength
      + targetUnitX * across * target.radius,
  };
}

function ellipseMap(
  point: Point,
  source: Extract<InkPoseGeometryPrimitive, { kind: "ellipse" }>,
  target: Extract<InkPoseGeometryPrimitive, { kind: "ellipse" }>,
): Point {
  return {
    x:
      target.centre.x
      + ((point.x - source.centre.x) / source.rx) * target.rx,
    y:
      target.centre.y
      + ((point.y - source.centre.y) / source.ry) * target.ry,
  };
}

function barycentric(
  point: Point,
  a: Point,
  b: Point,
  c: Point,
): readonly [number, number, number] | null {
  const denominator =
    (b.y - c.y) * (a.x - c.x)
    + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(denominator) < 1e-8) return null;
  const first = (
    (b.y - c.y) * (point.x - c.x)
    + (c.x - b.x) * (point.y - c.y)
  ) / denominator;
  const second = (
    (c.y - a.y) * (point.x - c.x)
    + (a.x - c.x) * (point.y - c.y)
  ) / denominator;
  const third = 1 - first - second;
  return first >= -0.01 && second >= -0.01 && third >= -0.01
    ? [first, second, third]
    : null;
}

function polygonMap(
  point: Point,
  source: Extract<InkPoseGeometryPrimitive, { kind: "polygon" }>,
  target: Extract<InkPoseGeometryPrimitive, { kind: "polygon" }>,
): Point {
  if (source.points.length !== 4 || target.points.length !== 4) {
    throw new InkPoseProjectionError(
      "primitive_mismatch",
      "Tattoo torso projection requires matching quadrilaterals",
    );
  }
  const triangles = [
    [0, 1, 2],
    [0, 2, 3],
  ] as const;
  for (const [a, b, c] of triangles) {
    const weights = barycentric(
      point,
      source.points[a]!,
      source.points[b]!,
      source.points[c]!,
    );
    if (!weights) continue;
    return {
      x:
        weights[0] * target.points[a]!.x
        + weights[1] * target.points[b]!.x
        + weights[2] * target.points[c]!.x,
      y:
        weights[0] * target.points[a]!.y
        + weights[1] * target.points[b]!.y
        + weights[2] * target.points[c]!.y,
    };
  }
  throw new InkPoseProjectionError(
    "source_outside_anatomy",
    "Tattoo source pixels fell outside the authorized torso geometry",
  );
}

function mapPoint(
  point: Point,
  source: InkPoseGeometryPrimitive,
  target: InkPoseGeometryPrimitive,
): Point {
  if (source.kind !== target.kind) {
    throw new InkPoseProjectionError(
      "primitive_mismatch",
      "Tattoo source and target anatomy do not share one geometry",
    );
  }
  if (source.kind === "capsule" && target.kind === "capsule") {
    return capsuleMap(point, source, target);
  }
  if (source.kind === "ellipse" && target.kind === "ellipse") {
    return ellipseMap(point, source, target);
  }
  if (source.kind === "polygon" && target.kind === "polygon") {
    return polygonMap(point, source, target);
  }
  throw new InkPoseProjectionError(
    "primitive_mismatch",
    "Tattoo source and target anatomy do not share one geometry",
  );
}

function boundsForIndexes(
  indexes: readonly number[],
  width: number,
  height: number,
): NormalizedInkZone {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (const index of indexes) {
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return Object.freeze({
    x: minX / width,
    y: minY / height,
    width: (maxX - minX + 1) / width,
    height: (maxY - minY + 1) / height,
  });
}

function countMask(mask: Uint8Array): number {
  let count = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index]) count += 1;
  }
  return count;
}

async function decodeRgb(
  image: Uint8Array,
  options?: { width: number; height: number },
): Promise<{ width: number; height: number; pixels: Buffer }> {
  try {
    let pipeline = sharp(Buffer.from(image), {
      failOn: "error",
      limitInputPixels: MAX_COMPOSITE_PIXELS,
    }).rotate().removeAlpha().toColourspace("srgb");
    if (options) {
      pipeline = pipeline.resize(options.width, options.height, {
        fit: "fill",
        kernel: "lanczos3",
      });
    }
    const decoded = await pipeline.raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = decoded.info;
    if (
      !width
      || !height
      || width * height > MAX_COMPOSITE_PIXELS
      || channels !== 3
      || decoded.data.length !== width * height * 3
    ) {
      throw new Error("invalid deterministic projection image");
    }
    return { width, height, pixels: decoded.data };
  } catch (error) {
    throw new InkPoseProjectionError(
      "dimension_mismatch",
      "Tattoo projection pixels could not be decoded",
      { cause: error },
    );
  }
}

function ratioBin(value: number): number {
  const clamped = Math.min(1.5, Math.max(0.5, value));
  return Math.round((clamped - 0.5) * (GAIN_BIN_COUNT - 1));
}

function binRatio(index: number): number {
  return 0.5 + index / (GAIN_BIN_COUNT - 1);
}

function medianGlobalGain(input: {
  clean: Buffer;
  accepted: Buffer;
  guide: InkPoseAnatomyGuide;
  featureMask: InkFeatureMask;
}): readonly [number, number, number] {
  const bins = [
    new Uint32Array(GAIN_BIN_COUNT),
    new Uint32Array(GAIN_BIN_COUNT),
    new Uint32Array(GAIN_BIN_COUNT),
  ] as const;
  const counts = [0, 0, 0];
  for (let pixel = 0; pixel < input.guide.mask.length; pixel += 1) {
    if (
      input.guide.mask[pixel]! < 128
      || input.featureMask.mask[pixel]
    ) {
      continue;
    }
    const offset = pixel * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      const clean = input.clean[offset + channel]!;
      const accepted = input.accepted[offset + channel]!;
      if (clean < 24 || accepted < 8) continue;
      bins[channel]![ratioBin(accepted / clean)] += 1;
      counts[channel] += 1;
    }
  }
  const minimumSamples = Math.max(
    64,
    Math.floor(input.featureMask.anatomyPixelCount * 0.05),
  );
  return Object.freeze(counts.map((count, channel) => {
    if (count < minimumSamples) {
      throw new InkPoseProjectionError(
        "delta_contaminated",
        "Tattoo evidence does not retain enough unchanged skin authority",
      );
    }
    const midpoint = Math.ceil(count / 2);
    let total = 0;
    for (let index = 0; index < GAIN_BIN_COUNT; index += 1) {
      total += bins[channel]![index]!;
      if (total < midpoint) continue;
      const gain = binRatio(index);
      if (gain < MIN_GLOBAL_GAIN || gain > MAX_GLOBAL_GAIN) {
        throw new InkPoseProjectionError(
          "delta_contaminated",
          "Tattoo evidence contains an unsafe global colour shift",
        );
      }
      return gain;
    }
    throw new InkPoseProjectionError(
      "delta_contaminated",
      "Tattoo evidence colour authority could not be established",
    );
  }) as [number, number, number]);
}

function bilinearChannel(
  pixels: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  channel: number,
): number {
  const left = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const top = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const right = Math.min(width - 1, left + 1);
  const bottom = Math.min(height - 1, top + 1);
  const xWeight = Math.max(0, Math.min(1, x - left));
  const yWeight = Math.max(0, Math.min(1, y - top));
  const topLeft = pixels[(top * width + left) * 3 + channel]!;
  const topRight = pixels[(top * width + right) * 3 + channel]!;
  const bottomLeft = pixels[(bottom * width + left) * 3 + channel]!;
  const bottomRight = pixels[(bottom * width + right) * 3 + channel]!;
  const topValue = topLeft + (topRight - topLeft) * xWeight;
  const bottomValue = bottomLeft + (bottomRight - bottomLeft) * xWeight;
  return topValue + (bottomValue - topValue) * yWeight;
}

function bilinearMask(
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const left = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const top = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const right = Math.min(width - 1, left + 1);
  const bottom = Math.min(height - 1, top + 1);
  const xWeight = Math.max(0, Math.min(1, x - left));
  const yWeight = Math.max(0, Math.min(1, y - top));
  const topValue =
    mask[top * width + left]!
    + (mask[top * width + right]! - mask[top * width + left]!) * xWeight;
  const bottomValue =
    mask[bottom * width + left]!
    + (
      mask[bottom * width + right]!
      - mask[bottom * width + left]!
    ) * xWeight;
  return (topValue + (bottomValue - topValue) * yWeight) / 255;
}

function targetMaskIndex(
  x: number,
  y: number,
  outputWidth: number,
  outputHeight: number,
  projection: InkPoseProjection,
): number {
  const targetX = Math.min(
    projection.width - 1,
    Math.floor(((x + 0.5) / outputWidth) * projection.width),
  );
  const targetY = Math.min(
    projection.height - 1,
    Math.floor(((y + 0.5) / outputHeight) * projection.height),
  );
  return targetY * projection.width + targetX;
}

function validateCompositeFeature(
  feature: DeterministicInkProjectionFeature,
  targetAnalysis: InkPoseAnalysis,
): void {
  if (
    !sameTuple(feature.projection.tuple, feature.sourceGuide.tuple)
    || !sameTuple(feature.projection.tuple, feature.targetGuide.tuple)
    || feature.projection.width !== targetAnalysis.width
    || feature.projection.height !== targetAnalysis.height
    || feature.targetGuide.width !== targetAnalysis.width
    || feature.targetGuide.height !== targetAnalysis.height
    || feature.sourceGuide.width !== feature.sourceAnalysis.width
    || feature.sourceGuide.height !== feature.sourceAnalysis.height
    || feature.featureMask.width !== feature.sourceAnalysis.width
    || feature.featureMask.height !== feature.sourceAnalysis.height
    || feature.projection.mask.length
      !== targetAnalysis.width * targetAnalysis.height
    || feature.sourceGuide.mask.length
      !== feature.sourceAnalysis.width * feature.sourceAnalysis.height
    || feature.featureMask.mask.length
      !== feature.sourceAnalysis.width * feature.sourceAnalysis.height
  ) {
    throw new InkPoseProjectionError(
      "authority_mismatch",
      "Tattoo projection colour authority is inconsistent",
    );
  }
}

/**
 * Transfer only the accepted tattoo's multiplicative colour delta through the
 * deterministic pose map. The saved target is copied first and pixels outside
 * the projected feature masks are never written.
 */
export async function composeAcceptedInkProjection(input: {
  targetBytes: Uint8Array;
  targetAnalysis: InkPoseAnalysis;
  features: readonly DeterministicInkProjectionFeature[];
}): Promise<DeterministicInkProjectionComposite> {
  if (input.features.length < 1 || input.features.length > 9) {
    throw new InkPoseProjectionError(
      "authority_mismatch",
      "Tattoo projection requires one bounded feature set",
    );
  }
  input.features.forEach((feature) =>
    validateCompositeFeature(feature, input.targetAnalysis)
  );
  const target = await decodeRgb(input.targetBytes);
  if (
    Math.abs(
      target.width / target.height
      - input.targetAnalysis.width / input.targetAnalysis.height,
    ) > 0.005
  ) {
    throw new InkPoseProjectionError(
      "dimension_mismatch",
      "Tattoo projection target dimensions do not match pose authority",
    );
  }
  const output = Buffer.from(target.pixels);
  const authorized = new Uint8Array(target.width * target.height);
  const featureChangedPixelCounts: number[] = [];

  for (const feature of input.features) {
    const [clean, accepted] = await Promise.all([
      decodeRgb(feature.cleanSource, {
        width: feature.sourceAnalysis.width,
        height: feature.sourceAnalysis.height,
      }),
      decodeRgb(feature.acceptedCandidate, {
        width: feature.sourceAnalysis.width,
        height: feature.sourceAnalysis.height,
      }),
    ]);
    const gain = medianGlobalGain({
      clean: clean.pixels,
      accepted: accepted.pixels,
      guide: feature.sourceGuide,
      featureMask: feature.featureMask,
    });
    const sourcePrimitives = buildInkPoseGeometryPrimitives(
      feature.projection.tuple,
      feature.sourceAnalysis,
    );
    const targetPrimitives = buildInkPoseGeometryPrimitives(
      feature.projection.tuple,
      input.targetAnalysis,
      { allowClippedVisibility: true },
    );
    const visibleTargetPrimitiveIndexes = new Set(
      feature.targetGuide.visiblePrimitiveIndexes,
    );
    let featureChangedPixelCount = 0;
    for (let y = 0; y < target.height; y += 1) {
      for (let x = 0; x < target.width; x += 1) {
        const outputPixel = y * target.width + x;
        const projectionPixel = targetMaskIndex(
          x,
          y,
          target.width,
          target.height,
          feature.projection,
        );
        if (!feature.projection.mask[projectionPixel]) continue;
        authorized[outputPixel] = 255;
        const targetPoint = {
          x: (x + 0.5) / target.width,
          y: (y + 0.5) / target.height,
        };
        const primitiveIndex = targetPrimitives.findIndex(
          (primitive, index) =>
            visibleTargetPrimitiveIndexes.has(index)
            && contains(primitive, targetPoint),
        );
        if (primitiveIndex < 0) continue;
        const sourcePoint = mapPoint(
          targetPoint,
          targetPrimitives[primitiveIndex]!,
          sourcePrimitives[primitiveIndex]!,
        );
        const sourceX =
          sourcePoint.x * feature.sourceAnalysis.width - 0.5;
        const sourceY =
          sourcePoint.y * feature.sourceAnalysis.height - 0.5;
        if (
          sourceX < -0.5
          || sourceX > feature.sourceAnalysis.width - 0.5
          || sourceY < -0.5
          || sourceY > feature.sourceAnalysis.height - 0.5
        ) {
          continue;
        }
        const alpha = bilinearMask(
          feature.featureMask.mask,
          feature.featureMask.width,
          feature.featureMask.height,
          sourceX,
          sourceY,
        );
        if (alpha <= 0.01) continue;
        const offset = outputPixel * 3;
        let changed = false;
        for (let channel = 0; channel < 3; channel += 1) {
          const cleanValue = bilinearChannel(
            clean.pixels,
            clean.width,
            clean.height,
            sourceX,
            sourceY,
            channel,
          );
          const acceptedValue = bilinearChannel(
            accepted.pixels,
            accepted.width,
            accepted.height,
            sourceX,
            sourceY,
            channel,
          ) / gain[channel]!;
          const ratio = Math.min(
            MAX_INK_RATIO,
            Math.max(MIN_INK_RATIO, acceptedValue / Math.max(8, cleanValue)),
          );
          const current = output[offset + channel]!;
          const projected = Math.max(0, Math.min(255, current * ratio));
          const next = Math.round(current + (projected - current) * alpha);
          if (next !== current) changed = true;
          output[offset + channel] = next;
        }
        if (changed) featureChangedPixelCount += 1;
      }
    }
    const outputScale =
      (target.width * target.height)
      / (feature.projection.width * feature.projection.height);
    const minimumChangedPixels = Math.max(
      8,
      Math.floor(feature.projection.expectedPixelCount * outputScale * 0.3),
    );
    if (featureChangedPixelCount < minimumChangedPixels) {
      throw new InkPoseProjectionError(
        "target_surface_empty",
        "Tattoo colour pixels did not map materially onto the target anatomy",
      );
    }
    featureChangedPixelCounts.push(featureChangedPixelCount);
  }

  let changedPixelCount = 0;
  let authorizedPixelCount = 0;
  let outsideAuthorizedChangeCount = 0;
  for (let pixel = 0; pixel < authorized.length; pixel += 1) {
    if (authorized[pixel]) authorizedPixelCount += 1;
    const offset = pixel * 3;
    const changed =
      output[offset] !== target.pixels[offset]
      || output[offset + 1] !== target.pixels[offset + 1]
      || output[offset + 2] !== target.pixels[offset + 2];
    if (changed) {
      changedPixelCount += 1;
      if (!authorized[pixel]) outsideAuthorizedChangeCount += 1;
    }
  }
  if (outsideAuthorizedChangeCount !== 0) {
    throw new InkPoseProjectionError(
      "authority_mismatch",
      "Tattoo projection changed pixels outside its authority",
    );
  }
  const bytes = await sharp(output, {
    raw: { width: target.width, height: target.height, channels: 3 },
  }).png().toBuffer();
  return Object.freeze({
    bytes,
    mime: "image/png",
    width: target.width,
    height: target.height,
    changedPixelCount,
    authorizedPixelCount,
    outsideAuthorizedChangeCount: 0 as const,
    featureChangedPixelCounts: Object.freeze(featureChangedPixelCounts),
  });
}

function sameTuple(
  left: InkAnatomyTuple,
  right: InkAnatomyTuple,
): boolean {
  return left.zone === right.zone
    && left.surface === right.surface
    && left.side === right.side;
}

/**
 * Transfer exact accepted tattoo pixels through deterministic pose-relative
 * anatomy coordinates. Anatomical left/right comes from BlazePose landmarks,
 * never from viewer-side or the canonical angle label.
 */
export function projectAcceptedInkFeatureMask(input: {
  tuple: InkAnatomyTuple;
  sourceAnalysis: InkPoseAnalysis;
  sourceGuide: InkPoseAnatomyGuide;
  featureMask: InkFeatureMask;
  targetAnalysis: InkPoseAnalysis;
  targetGuide?: InkPoseAnatomyGuide;
}): InkPoseProjection {
  const targetGuide =
    input.targetGuide
    ?? buildInkPoseAnatomyGuide(input.tuple, input.targetAnalysis);
  if (
    input.featureMask.width !== input.sourceAnalysis.width
    || input.featureMask.height !== input.sourceAnalysis.height
    || input.featureMask.mask.length
      !== input.sourceAnalysis.width * input.sourceAnalysis.height
    || input.sourceGuide.width !== input.sourceAnalysis.width
    || input.sourceGuide.height !== input.sourceAnalysis.height
    || input.sourceGuide.mask.length
      !== input.sourceAnalysis.width * input.sourceAnalysis.height
    || targetGuide.width !== input.targetAnalysis.width
    || targetGuide.height !== input.targetAnalysis.height
    || targetGuide.mask.length
      !== input.targetAnalysis.width * input.targetAnalysis.height
  ) {
    throw new InkPoseProjectionError(
      "dimension_mismatch",
      "Tattoo pose projection dimensions do not match their evidence",
    );
  }
  if (
    input.sourceGuide.recipeVersion !== INK_POSE_GEOMETRY_RECIPE_VERSION
    || targetGuide.recipeVersion !== INK_POSE_GEOMETRY_RECIPE_VERSION
    || !sameTuple(input.sourceGuide.tuple, input.tuple)
    || !sameTuple(targetGuide.tuple, input.tuple)
    || input.featureMask.featurePixelCount < 1
    || input.featureMask.anatomyPixelCount < 1
    || countMask(input.featureMask.mask) !== input.featureMask.featurePixelCount
  ) {
    throw new InkPoseProjectionError(
      "authority_mismatch",
      "Tattoo pose projection authority is inconsistent",
    );
  }
  const sourcePrimitives = buildInkPoseGeometryPrimitives(
    input.tuple,
    input.sourceAnalysis,
  );
  const targetPrimitives = buildInkPoseGeometryPrimitives(
    input.tuple,
    input.targetAnalysis,
    { allowClippedVisibility: true },
  );
  if (
    sourcePrimitives.length !== targetPrimitives.length
    || sourcePrimitives.length < 1
    || sourcePrimitives.length > 4
  ) {
    throw new InkPoseProjectionError(
      "primitive_mismatch",
      "Tattoo source and target anatomy segment counts do not match",
    );
  }
  if (
    input.sourceGuide.visiblePrimitiveIndexes.length
      !== sourcePrimitives.length
    || input.sourceGuide.visiblePrimitiveIndexes.some(
      (index, position) => index !== position,
    )
    || targetGuide.normalizedSegments.length
      !== targetGuide.visiblePrimitiveIndexes.length
  ) {
    throw new InkPoseProjectionError(
      "authority_mismatch",
      "Tattoo pose guide segment authority is inconsistent",
    );
  }

  const targetMask = new Uint8Array(
    input.targetAnalysis.width * input.targetAnalysis.height,
  );
  const visibleTargetPrimitiveIndexes = new Set(
    targetGuide.visiblePrimitiveIndexes,
  );
  if (
    targetGuide.visiblePrimitiveIndexes.length < 1
    || targetGuide.visiblePrimitiveIndexes.some(
      (index, position) =>
        !Number.isInteger(index)
        || index < 0
        || index >= targetPrimitives.length
        || (
          position > 0
          && index <= targetGuide.visiblePrimitiveIndexes[position - 1]!
        ),
    )
  ) {
    throw new InkPoseProjectionError(
      "authority_mismatch",
      "Tattoo target guide segment authority is inconsistent",
    );
  }
  const segmentIndexes: number[][] =
    sourcePrimitives.map(() => []);
  let sourceOutside = 0;
  for (let index = 0; index < input.featureMask.mask.length; index += 1) {
    if (!input.featureMask.mask[index]) continue;
    if (!input.sourceGuide.mask[index]) {
      sourceOutside += 1;
      continue;
    }
    const sourcePoint = {
      x: ((index % input.sourceAnalysis.width) + 0.5)
        / input.sourceAnalysis.width,
      y: (Math.floor(index / input.sourceAnalysis.width) + 0.5)
        / input.sourceAnalysis.height,
    };
    const primitiveIndex = sourcePrimitives.findIndex((primitive) =>
      contains(primitive, sourcePoint)
    );
    if (primitiveIndex < 0) {
      sourceOutside += 1;
      continue;
    }
    if (!visibleTargetPrimitiveIndexes.has(primitiveIndex)) continue;
    const targetPoint = mapPoint(
      sourcePoint,
      sourcePrimitives[primitiveIndex]!,
      targetPrimitives[primitiveIndex]!,
    );
    const centreX = Math.round(
      targetPoint.x * input.targetAnalysis.width - 0.5,
    );
    const centreY = Math.round(
      targetPoint.y * input.targetAnalysis.height - 0.5,
    );
    const radius = 1;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = centreX + dx;
        const y = centreY + dy;
        if (
          x < 0
          || x >= input.targetAnalysis.width
          || y < 0
          || y >= input.targetAnalysis.height
        ) {
          continue;
        }
        const targetIndex = y * input.targetAnalysis.width + x;
        if (!targetGuide.mask[targetIndex]) continue;
        if (!targetMask[targetIndex]) {
          targetMask[targetIndex] = 255;
          segmentIndexes[primitiveIndex]!.push(targetIndex);
        }
      }
    }
  }
  if (
    sourceOutside
      > Math.max(4, Math.floor(input.featureMask.featurePixelCount * 0.01))
  ) {
    throw new InkPoseProjectionError(
      "source_outside_anatomy",
      "Accepted tattoo pixels exceed the source anatomy authority",
    );
  }
  const targetAnatomyPixels = countMask(targetGuide.mask);
  const expectedPixelCount = Math.max(
    12,
    Math.round(
      (
        input.featureMask.featurePixelCount
        / input.featureMask.anatomyPixelCount
      ) * targetAnatomyPixels,
    ),
  );
  const projectedPixelCount = countMask(targetMask);
  if (projectedPixelCount < Math.max(8, expectedPixelCount * 0.15)) {
    throw new InkPoseProjectionError(
      "target_surface_empty",
      "Tattoo pixels did not map materially onto the visible target anatomy",
    );
  }
  const normalizedSegments = segmentIndexes
    .filter((indexes) => indexes.length > 0)
    .map((indexes) =>
      boundsForIndexes(
        indexes,
        input.targetAnalysis.width,
        input.targetAnalysis.height,
      )
    );
  if (normalizedSegments.length < 1 || normalizedSegments.length > 4) {
    throw new InkPoseProjectionError(
      "target_surface_empty",
      "Tattoo target geometry did not produce bounded visible segments",
    );
  }
  return Object.freeze({
    recipeVersion: INK_POSE_PROJECTION_RECIPE_VERSION,
    tuple: Object.freeze({ ...input.tuple }),
    width: input.targetAnalysis.width,
    height: input.targetAnalysis.height,
    mask: targetMask,
    normalizedSegments: Object.freeze(normalizedSegments),
    projectedPixelCount,
    expectedPixelCount,
  });
}
