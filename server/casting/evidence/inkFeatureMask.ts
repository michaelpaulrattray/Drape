import sharp from "sharp";

import type { NormalizedInkZone } from "./composer/inkZoneGuide";
import type { InkPoseAnatomyGuide } from "./inkPoseGeometry";

export const INK_FEATURE_MASK_RECIPE_VERSION =
  "ink.feature-mask.v1" as const;

export type InkFeatureMaskFailureCode =
  | "decode_failed"
  | "dimension_mismatch"
  | "feature_absent"
  | "feature_oversized"
  | "source_drift"
  | "feature_fragmented";

export class InkFeatureMaskError extends Error {
  constructor(
    readonly code: InkFeatureMaskFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "InkFeatureMaskError";
  }
}

export interface InkFeatureMask {
  recipeVersion: typeof INK_FEATURE_MASK_RECIPE_VERSION;
  width: number;
  height: number;
  mask: Uint8Array;
  normalizedBounds: NormalizedInkZone;
  featurePixelCount: number;
  anatomyPixelCount: number;
  outsideAnatomyChangedPixelCount: number;
  retainedComponentCount: number;
}

const MAX_PIXELS = 40_000_000;
const MIN_DIMENSION = 64;
const MAX_DIMENSION = 8192;
const BLUR_SIGMA = 0.65;
const COLOUR_DISTANCE_THRESHOLD = 38;
const MIN_FEATURE_PIXELS = 20;
const MIN_FEATURE_ANATOMY_FRACTION = 0.00045;
const MAX_FEATURE_ANATOMY_FRACTION = 0.72;
const MAX_OUTSIDE_IMAGE_FRACTION = 0.025;
const MAX_OUTSIDE_TO_FEATURE_RATIO = 8;
const MAX_RETAINED_COMPONENTS = 96;

interface DecodedImage {
  width: number;
  height: number;
  pixels: Buffer;
}

async function resizeDecoded(
  image: DecodedImage,
  width: number,
  height: number,
): Promise<DecodedImage> {
  if (image.width === width && image.height === height) return image;
  const resized = await sharp(image.pixels, {
    raw: {
      width: image.width,
      height: image.height,
      channels: 3,
    },
  }).resize(width, height, { fit: "fill" }).raw().toBuffer();
  return { width, height, pixels: resized };
}

async function decode(image: Uint8Array): Promise<DecodedImage> {
  try {
    const decoded = await sharp(Buffer.from(image), {
      failOn: "error",
      limitInputPixels: MAX_PIXELS,
    })
      .rotate()
      .removeAlpha()
      .toColourspace("srgb")
      .blur(BLUR_SIGMA)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = decoded.info;
    if (
      !Number.isSafeInteger(width)
      || !Number.isSafeInteger(height)
      || width < MIN_DIMENSION
      || height < MIN_DIMENSION
      || width > MAX_DIMENSION
      || height > MAX_DIMENSION
      || width * height > MAX_PIXELS
      || channels !== 3
      || decoded.data.length !== width * height * channels
    ) {
      throw new InkFeatureMaskError(
        "decode_failed",
        "Tattoo feature evidence has invalid image dimensions",
      );
    }
    return { width, height, pixels: decoded.data };
  } catch (error) {
    if (error instanceof InkFeatureMaskError) throw error;
    throw new InkFeatureMaskError(
      "decode_failed",
      "Tattoo feature evidence could not be decoded",
      { cause: error },
    );
  }
}

function changedPixel(
  source: Buffer,
  accepted: Buffer,
  pixelIndex: number,
): boolean {
  const offset = pixelIndex * 3;
  const red = source[offset]! - accepted[offset]!;
  const green = source[offset + 1]! - accepted[offset + 1]!;
  const blue = source[offset + 2]! - accepted[offset + 2]!;
  return Math.sqrt(red * red + green * green + blue * blue)
    >= COLOUR_DISTANCE_THRESHOLD;
}

function dilate(mask: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let present = false;
      for (let dy = -1; dy <= 1 && !present; dy += 1) {
        const sampleY = y + dy;
        if (sampleY < 0 || sampleY >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const sampleX = x + dx;
          if (
            sampleX >= 0
            && sampleX < width
            && mask[sampleY * width + sampleX]
          ) {
            present = true;
            break;
          }
        }
      }
      if (present) result[y * width + x] = 255;
    }
  }
  return result;
}

function erode(
  mask: Uint8Array,
  authority: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let present = true;
      for (let dy = -1; dy <= 1 && present; dy += 1) {
        const sampleY = y + dy;
        if (sampleY < 0 || sampleY >= height) {
          present = false;
          break;
        }
        for (let dx = -1; dx <= 1; dx += 1) {
          const sampleX = x + dx;
          if (
            sampleX < 0
            || sampleX >= width
            || !mask[sampleY * width + sampleX]
          ) {
            present = false;
            break;
          }
        }
      }
      const index = y * width + x;
      if (present && authority[index]) result[index] = 255;
    }
  }
  return result;
}

interface Component {
  pixels: number[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function components(
  mask: Uint8Array,
  width: number,
  height: number,
): Component[] {
  const visited = new Uint8Array(mask.length);
  const result: Component[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    const pixels: number[] = [];
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor]!;
      pixels.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (
            nextX < 0
            || nextX >= width
            || nextY < 0
            || nextY >= height
          ) {
            continue;
          }
          const next = nextY * width + nextX;
          if (mask[next] && !visited[next]) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }
    }
    result.push({ pixels, minX, maxX, minY, maxY });
  }
  return result;
}

function retainMaterialComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  initialFeaturePixels: number,
): {
  mask: Uint8Array;
  components: Component[];
  pixelCount: number;
} {
  const minimumComponentPixels = Math.max(
    3,
    Math.floor(initialFeaturePixels * 0.0025),
  );
  const retained = components(mask, width, height)
    .filter((component) => component.pixels.length >= minimumComponentPixels)
    .sort((left, right) => right.pixels.length - left.pixels.length);
  if (retained.length > MAX_RETAINED_COMPONENTS) {
    throw new InkFeatureMaskError(
      "feature_fragmented",
      "Tattoo feature evidence is too fragmented to project safely",
    );
  }
  const result = new Uint8Array(mask.length);
  let pixelCount = 0;
  for (const component of retained) {
    for (const index of component.pixels) result[index] = 255;
    pixelCount += component.pixels.length;
  }
  return { mask: result, components: retained, pixelCount };
}

function normalizedBounds(
  componentsValue: readonly Component[],
  width: number,
  height: number,
): NormalizedInkZone {
  const minX = Math.min(...componentsValue.map((value) => value.minX));
  const maxX = Math.max(...componentsValue.map((value) => value.maxX));
  const minY = Math.min(...componentsValue.map((value) => value.minY));
  const maxY = Math.max(...componentsValue.map((value) => value.maxY));
  return Object.freeze({
    x: minX / width,
    y: minY / height,
    width: (maxX - minX + 1) / width,
    height: (maxY - minY + 1) / height,
  });
}

/**
 * Derive the immutable pixels belonging to one accepted tattoo by comparing
 * its exact clean authoring asset with its exact accepted candidate. This is
 * deterministic evidence localization; it never infers placement from text.
 */
export async function extractAcceptedInkFeatureMask(input: {
  cleanSource: Uint8Array;
  acceptedCandidate: Uint8Array;
  anatomyGuide: InkPoseAnatomyGuide;
}): Promise<InkFeatureMask> {
  const [decodedSource, decodedAccepted] = await Promise.all([
    decode(input.cleanSource),
    decode(input.acceptedCandidate),
  ]);
  const { anatomyGuide } = input;
  if (
    decodedSource.width !== decodedAccepted.width
    || decodedSource.height !== decodedAccepted.height
    || anatomyGuide.mask.length !== anatomyGuide.width * anatomyGuide.height
    || Math.abs(
      decodedSource.width / decodedSource.height
      - anatomyGuide.width / anatomyGuide.height,
    ) > 0.005
  ) {
    throw new InkFeatureMaskError(
      "dimension_mismatch",
      "Tattoo feature evidence does not share one exact image frame",
    );
  }
  const [source, accepted] = await Promise.all([
    resizeDecoded(decodedSource, anatomyGuide.width, anatomyGuide.height),
    resizeDecoded(decodedAccepted, anatomyGuide.width, anatomyGuide.height),
  ]);

  let anatomyPixelCount = 0;
  let initialFeaturePixels = 0;
  let outsideAnatomyChangedPixelCount = 0;
  const initial = new Uint8Array(anatomyGuide.mask.length);
  for (let index = 0; index < initial.length; index += 1) {
    const withinAnatomy = anatomyGuide.mask[index]! >= 128;
    if (withinAnatomy) anatomyPixelCount += 1;
    if (!changedPixel(source.pixels, accepted.pixels, index)) continue;
    if (withinAnatomy) {
      initial[index] = 255;
      initialFeaturePixels += 1;
    } else {
      outsideAnatomyChangedPixelCount += 1;
    }
  }
  const minimumFeaturePixels = Math.max(
    MIN_FEATURE_PIXELS,
    Math.ceil(anatomyPixelCount * MIN_FEATURE_ANATOMY_FRACTION),
  );
  if (initialFeaturePixels < minimumFeaturePixels) {
    throw new InkFeatureMaskError(
      "feature_absent",
      "Accepted tattoo pixels could not be isolated from the clean source",
    );
  }
  if (
    initialFeaturePixels
      > Math.floor(anatomyPixelCount * MAX_FEATURE_ANATOMY_FRACTION)
  ) {
    throw new InkFeatureMaskError(
      "feature_oversized",
      "The accepted candidate changed too much of the authorized anatomy",
    );
  }
  if (
    outsideAnatomyChangedPixelCount
      > source.width * source.height * MAX_OUTSIDE_IMAGE_FRACTION
    || outsideAnatomyChangedPixelCount
      > initialFeaturePixels * MAX_OUTSIDE_TO_FEATURE_RATIO
  ) {
    throw new InkFeatureMaskError(
      "source_drift",
      "The accepted candidate changed too much outside the tattoo anatomy",
    );
  }

  const closed = erode(
    dilate(initial, source.width, source.height),
    anatomyGuide.mask,
    source.width,
    source.height,
  );
  const retained = retainMaterialComponents(
    closed,
    source.width,
    source.height,
    initialFeaturePixels,
  );
  if (
    retained.pixelCount < minimumFeaturePixels
    || retained.components.length < 1
  ) {
    throw new InkFeatureMaskError(
      "feature_absent",
      "Accepted tattoo pixels were not materially connected",
    );
  }
  return Object.freeze({
    recipeVersion: INK_FEATURE_MASK_RECIPE_VERSION,
    width: source.width,
    height: source.height,
    mask: retained.mask,
    normalizedBounds: normalizedBounds(
      retained.components,
      source.width,
      source.height,
    ),
    featurePixelCount: retained.pixelCount,
    anatomyPixelCount,
    outsideAnatomyChangedPixelCount,
    retainedComponentCount: retained.components.length,
  });
}
