import sharp from "sharp";
import { describe, expect, it } from "vitest";

import type { InkFeatureMask } from "./inkFeatureMask";
import { INK_FEATURE_MASK_RECIPE_VERSION } from "./inkFeatureMask";
import {
  buildInkPoseAnatomyGuide,
  INK_POSE_GEOMETRY_RECIPE_VERSION,
} from "./inkPoseGeometry";
import {
  composeAcceptedInkProjection,
  InkPoseProjectionError,
  projectAcceptedInkFeatureMask,
} from "./inkPoseProjection";
import {
  INK_POSE_KEYPOINTS,
  type InkPoseAnalysis,
  type InkPoseKeypointName,
} from "./inkPoseRuntime";
import { INK_POSE_MODEL_VERSION } from "./poseModelArtifacts";

const BASE_POINTS: Readonly<
  Partial<Record<InkPoseKeypointName, readonly [number, number]>>
> = Object.freeze({
  nose: [0.5, 0.13],
  left_eye_inner: [0.515, 0.12],
  left_eye: [0.53, 0.12],
  left_eye_outer: [0.545, 0.12],
  right_eye_inner: [0.485, 0.12],
  right_eye: [0.47, 0.12],
  right_eye_outer: [0.455, 0.12],
  left_ear: [0.57, 0.135],
  right_ear: [0.43, 0.135],
  mouth_left: [0.525, 0.17],
  mouth_right: [0.475, 0.17],
  left_shoulder: [0.62, 0.28],
  right_shoulder: [0.38, 0.28],
  left_elbow: [0.72, 0.42],
  right_elbow: [0.28, 0.42],
  left_wrist: [0.76, 0.57],
  right_wrist: [0.24, 0.57],
  left_pinky: [0.79, 0.62],
  right_pinky: [0.21, 0.62],
  left_index: [0.78, 0.61],
  right_index: [0.22, 0.61],
  left_thumb: [0.75, 0.61],
  right_thumb: [0.25, 0.61],
  left_hip: [0.57, 0.55],
  right_hip: [0.43, 0.55],
  left_knee: [0.59, 0.75],
  right_knee: [0.41, 0.75],
  left_ankle: [0.6, 0.93],
  right_ankle: [0.4, 0.93],
  left_heel: [0.57, 0.96],
  right_heel: [0.43, 0.96],
  left_foot_index: [0.64, 0.98],
  right_foot_index: [0.36, 0.98],
});

function analysis(options?: {
  mirrored?: boolean;
  rightArmRaised?: boolean;
  coordinateOverrides?: Partial<
    Record<InkPoseKeypointName, readonly [number, number]>
  >;
}): InkPoseAnalysis {
  const width = 240;
  const height = 320;
  const landmarks = INK_POSE_KEYPOINTS.map((name) => {
    let [baseX, y] =
      options?.coordinateOverrides?.[name] ?? BASE_POINTS[name]!;
    if (options?.rightArmRaised && name === "right_elbow") {
      [baseX, y] = [0.31, 0.2];
    }
    if (options?.rightArmRaised && name === "right_wrist") {
      [baseX, y] = [0.24, 0.1];
    }
    return Object.freeze({
      name,
      x: options?.mirrored ? 1 - baseX : baseX,
      y,
      z: 0,
      score: 0.99,
    });
  });
  return Object.freeze({
    recipeVersion: INK_POSE_MODEL_VERSION,
    width,
    height,
    poseScore: 0.99,
    landmarks: Object.freeze(landmarks),
    worldLandmarks: Object.freeze(landmarks),
    personMask: new Uint8Array(width * height).fill(255),
  });
}

function featureMask(
  guide: ReturnType<typeof buildInkPoseAnatomyGuide>,
  predicate: (x: number, y: number) => boolean,
): InkFeatureMask {
  const mask = new Uint8Array(guide.mask.length);
  let featurePixelCount = 0;
  let anatomyPixelCount = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (!guide.mask[index]) continue;
    anatomyPixelCount += 1;
    const x = (index % guide.width) / guide.width;
    const y = Math.floor(index / guide.width) / guide.height;
    if (predicate(x, y)) {
      mask[index] = 255;
      featurePixelCount += 1;
    }
  }
  return {
    recipeVersion: INK_FEATURE_MASK_RECIPE_VERSION,
    width: guide.width,
    height: guide.height,
    mask,
    normalizedBounds: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 },
    featurePixelCount,
    anatomyPixelCount,
    outsideAnatomyChangedPixelCount: 0,
    retainedComponentCount: 1,
  };
}

function centroid(mask: Uint8Array, width: number): { x: number; y: number } {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    sumX += index % width;
    sumY += Math.floor(index / width);
    count += 1;
  }
  return { x: sumX / count / width, y: sumY / count / (mask.length / width) };
}

async function paintedImage(
  mask: Uint8Array,
  base: readonly [number, number, number],
  ink?: readonly [number, number, number],
): Promise<Buffer> {
  const pixels = Buffer.alloc(mask.length * 3);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const colour = ink && mask[pixel] ? ink : base;
    const offset = pixel * 3;
    pixels[offset] = colour[0];
    pixels[offset + 1] = colour[1];
    pixels[offset + 2] = colour[2];
  }
  return sharp(pixels, {
    raw: { width: 240, height: 320, channels: 3 },
  }).png().toBuffer();
}

async function rawRgb(image: Uint8Array): Promise<Buffer> {
  return sharp(Buffer.from(image)).removeAlpha().raw().toBuffer();
}

describe("deterministic tattoo pose projection", () => {
  it("round-trips accepted tattoo pixels while keeping every outside pixel exact", async () => {
    const tuple = {
      zone: "upper_arm",
      surface: "anterior",
      side: "right",
    } as const;
    const sourceAnalysis = analysis();
    const sourceGuide = buildInkPoseAnatomyGuide(tuple, sourceAnalysis);
    const sourceFeature = featureMask(
      sourceGuide,
      (x, y) => x > 0.28 && x < 0.37 && y > 0.3 && y < 0.4,
    );
    const targetGuide = buildInkPoseAnatomyGuide(tuple, sourceAnalysis);
    const projection = projectAcceptedInkFeatureMask({
      tuple,
      sourceAnalysis,
      sourceGuide,
      featureMask: sourceFeature,
      targetAnalysis: sourceAnalysis,
      targetGuide,
    });
    const clean = await paintedImage(
      new Uint8Array(sourceFeature.mask.length),
      [188, 139, 112],
    );
    const accepted = await paintedImage(
      sourceFeature.mask,
      [188, 139, 112],
      [18, 16, 14],
    );
    const result = await composeAcceptedInkProjection({
      targetBytes: clean,
      targetAnalysis: sourceAnalysis,
      features: [{
        cleanSource: clean,
        acceptedCandidate: accepted,
        sourceAnalysis,
        sourceGuide,
        featureMask: sourceFeature,
        targetGuide,
        projection,
      }],
    });
    const [cleanPixels, acceptedPixels, outputPixels] = await Promise.all([
      rawRgb(clean),
      rawRgb(accepted),
      rawRgb(result.bytes),
    ]);

    expect(result.outsideAuthorizedChangeCount).toBe(0);
    expect(result.changedPixelCount).toBeGreaterThan(20);
    let outsideMismatch = 0;
    let acceptedMismatch = 0;
    for (let pixel = 0; pixel < projection.mask.length; pixel += 1) {
      const offset = pixel * 3;
      if (
        !projection.mask[pixel]
        && !outputPixels.subarray(offset, offset + 3)
          .equals(cleanPixels.subarray(offset, offset + 3))
      ) {
        outsideMismatch += 1;
      }
      if (
        sourceFeature.mask[pixel]
        && !outputPixels.subarray(offset, offset + 3)
          .equals(acceptedPixels.subarray(offset, offset + 3))
      ) {
        acceptedMismatch += 1;
      }
    }
    expect(outsideMismatch).toBe(0);
    expect(acceptedMismatch).toBe(0);
  });

  it("moves accepted tattoo colour with mirrored anatomical geometry", async () => {
    const tuple = {
      zone: "upper_arm",
      surface: "anterior",
      side: "right",
    } as const;
    const sourceAnalysis = analysis();
    const targetAnalysis = analysis({ mirrored: true });
    const sourceGuide = buildInkPoseAnatomyGuide(tuple, sourceAnalysis);
    const sourceFeature = featureMask(
      sourceGuide,
      (_x, y) => y > 0.3 && y < 0.39,
    );
    const targetGuide = buildInkPoseAnatomyGuide(tuple, targetAnalysis);
    const projection = projectAcceptedInkFeatureMask({
      tuple,
      sourceAnalysis,
      sourceGuide,
      featureMask: sourceFeature,
      targetAnalysis,
      targetGuide,
    });
    const empty = new Uint8Array(sourceFeature.mask.length);
    const cleanSource = await paintedImage(empty, [190, 145, 118]);
    const accepted = await paintedImage(
      sourceFeature.mask,
      [190, 145, 118],
      [20, 18, 16],
    );
    const target = await paintedImage(empty, [166, 124, 101]);
    const result = await composeAcceptedInkProjection({
      targetBytes: target,
      targetAnalysis,
      features: [{
        cleanSource,
        acceptedCandidate: accepted,
        sourceAnalysis,
        sourceGuide,
        featureMask: sourceFeature,
        targetGuide,
        projection,
      }],
    });
    const output = await rawRgb(result.bytes);
    const darkMask = new Uint8Array(targetAnalysis.width * targetAnalysis.height);
    for (let pixel = 0; pixel < darkMask.length; pixel += 1) {
      if (output[pixel * 3]! < 80) darkMask[pixel] = 255;
    }

    expect(result.outsideAuthorizedChangeCount).toBe(0);
    expect(centroid(darkMask, targetAnalysis.width).x).toBeGreaterThan(0.5);
  });

  it("preserves anatomical right when the target frame is mirrored", () => {
    const tuple = {
      zone: "upper_arm",
      surface: "anterior",
      side: "right",
    } as const;
    const sourceAnalysis = analysis();
    const sourceGuide = buildInkPoseAnatomyGuide(tuple, sourceAnalysis);
    const result = projectAcceptedInkFeatureMask({
      tuple,
      sourceAnalysis,
      sourceGuide,
      featureMask: featureMask(sourceGuide, (_x, y) => y < 0.37),
      targetAnalysis: analysis({ mirrored: true }),
    });

    expect(centroid(result.mask, result.width).x).toBeGreaterThan(0.5);
    expect(result.projectedPixelCount).toBeGreaterThan(20);
  });

  it("moves a right forearm tattoo with a raised target arm", () => {
    const tuple = {
      zone: "forearm",
      surface: "lateral",
      side: "right",
    } as const;
    const sourceAnalysis = analysis();
    const sourceGuide = buildInkPoseAnatomyGuide(tuple, sourceAnalysis);
    const sourceFeature = featureMask(
      sourceGuide,
      (x, y) => x < 0.27 && y > 0.45,
    );
    const baseline = projectAcceptedInkFeatureMask({
      tuple,
      sourceAnalysis,
      sourceGuide,
      featureMask: sourceFeature,
      targetAnalysis: analysis(),
    });
    const raised = projectAcceptedInkFeatureMask({
      tuple,
      sourceAnalysis,
      sourceGuide,
      featureMask: sourceFeature,
      targetAnalysis: analysis({ rightArmRaised: true }),
    });

    expect(centroid(raised.mask, raised.width).y)
      .toBeLessThan(centroid(baseline.mask, baseline.width).y - 0.2);
  });

  it("keeps upper-torso placement on the same relative torso region", () => {
    const tuple = {
      zone: "upper_torso",
      surface: "anterior",
      side: "right",
    } as const;
    const sourceAnalysis = analysis();
    const sourceGuide = buildInkPoseAnatomyGuide(tuple, sourceAnalysis);
    const result = projectAcceptedInkFeatureMask({
      tuple,
      sourceAnalysis,
      sourceGuide,
      featureMask: featureMask(
        sourceGuide,
        (x, y) => x > 0.37 && x < 0.43 && y > 0.31 && y < 0.39,
      ),
      targetAnalysis: analysis({ mirrored: true }),
    });

    expect(centroid(result.mask, result.width).x).toBeGreaterThan(0.5);
    expect(result.normalizedSegments).toHaveLength(1);
  });

  it("projects only the visible sleeve segments when the hand is cropped", () => {
    const tuple = {
      zone: "full_arm",
      surface: "circumferential",
      side: "right",
    } as const;
    const sourceAnalysis = analysis();
    const sourceGuide = buildInkPoseAnatomyGuide(tuple, sourceAnalysis);
    const targetAnalysis = analysis({
      coordinateOverrides: {
        right_wrist: [0.44, 1.064],
        right_index: [0.51, 1.125],
        right_pinky: [0.45, 1.137],
      },
    });
    const targetGuide = buildInkPoseAnatomyGuide(
      tuple,
      targetAnalysis,
      { allowClippedVisibility: true },
    );

    const result = projectAcceptedInkFeatureMask({
      tuple,
      sourceAnalysis,
      sourceGuide,
      featureMask: featureMask(sourceGuide, () => true),
      targetAnalysis,
      targetGuide,
    });

    expect(targetGuide.visiblePrimitiveIndexes).toEqual([0, 1]);
    expect(result.normalizedSegments).toHaveLength(2);
    expect(result.projectedPixelCount).toBeGreaterThan(20);
    expect(result.normalizedSegments.every(
      (segment) => segment.y + segment.height <= 1,
    )).toBe(true);
  });

  it("rejects a feature mask outside its source anatomy authority", () => {
    const tuple = {
      zone: "upper_arm",
      surface: "anterior",
      side: "right",
    } as const;
    const sourceAnalysis = analysis();
    const sourceGuide = buildInkPoseAnatomyGuide(tuple, sourceAnalysis);
    const sourceFeature = featureMask(sourceGuide, () => false);
    for (let y = 30; y < 50; y += 1) {
      for (let x = 170; x < 190; x += 1) {
        sourceFeature.mask[y * sourceFeature.width + x] = 255;
        sourceFeature.featurePixelCount += 1;
      }
    }

    expect(() =>
      projectAcceptedInkFeatureMask({
        tuple,
        sourceAnalysis,
        sourceGuide,
        featureMask: sourceFeature,
        targetAnalysis: analysis(),
      })
    ).toThrowError(
      expect.objectContaining({ code: "source_outside_anatomy" }),
    );
  });

  it("rejects a pose guide for a different anatomical authority", () => {
    const tuple = {
      zone: "upper_arm",
      surface: "anterior",
      side: "right",
    } as const;
    const sourceAnalysis = analysis();
    const sourceGuide = buildInkPoseAnatomyGuide(tuple, sourceAnalysis);
    const wrongTargetGuide = buildInkPoseAnatomyGuide({
      ...tuple,
      side: "left",
    }, analysis());

    expect(() =>
      projectAcceptedInkFeatureMask({
        tuple,
        sourceAnalysis,
        sourceGuide,
        featureMask: featureMask(sourceGuide, (_x, y) => y < 0.37),
        targetAnalysis: analysis(),
        targetGuide: wrongTargetGuide,
      })
    ).toThrowError(
      expect.objectContaining<Partial<InkPoseProjectionError>>({
        code: "authority_mismatch",
      }),
    );
  });

  it("rejects reordered clipped-segment authority", () => {
    const tuple = {
      zone: "full_arm",
      surface: "circumferential",
      side: "right",
    } as const;
    const sourceAnalysis = analysis();
    const sourceGuide = buildInkPoseAnatomyGuide(tuple, sourceAnalysis);
    const targetAnalysis = analysis();
    const targetGuide = buildInkPoseAnatomyGuide(tuple, targetAnalysis);

    expect(() =>
      projectAcceptedInkFeatureMask({
        tuple,
        sourceAnalysis,
        sourceGuide,
        featureMask: featureMask(sourceGuide, () => true),
        targetAnalysis,
        targetGuide: {
          ...targetGuide,
          visiblePrimitiveIndexes: [1, 0, 2],
        },
      })
    ).toThrowError(
      expect.objectContaining<Partial<InkPoseProjectionError>>({
        code: "authority_mismatch",
      }),
    );
  });
});
