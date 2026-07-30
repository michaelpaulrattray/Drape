import { describe, expect, it } from "vitest";

import {
  INK_ZONE_RULES,
  type InkAnatomyTuple,
} from "./inkAnatomyRegistry";
import {
  buildInkPoseAnatomyGuide,
  InkPoseGeometryError,
} from "./inkPoseGeometry";
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
  scoreOverrides?: Partial<Record<InkPoseKeypointName, number>>;
  coordinateOverrides?: Partial<
    Record<InkPoseKeypointName, readonly [number, number]>
  >;
  personMask?: Uint8Array;
}): InkPoseAnalysis {
  const width = 240;
  const height = 320;
  const landmarks = INK_POSE_KEYPOINTS.map((name) => {
    const [baseX, y] =
      options?.coordinateOverrides?.[name] ?? BASE_POINTS[name]!;
    return Object.freeze({
      name,
      x: options?.mirrored ? 1 - baseX : baseX,
      y,
      z: 0,
      score: options?.scoreOverrides?.[name] ?? 0.99,
    });
  });
  return Object.freeze({
    recipeVersion: INK_POSE_MODEL_VERSION,
    width,
    height,
    poseScore: 0.99,
    landmarks: Object.freeze(landmarks),
    worldLandmarks: Object.freeze(landmarks),
    personMask:
      options?.personMask ?? new Uint8Array(width * height).fill(255),
  });
}

function everyTuple(): InkAnatomyTuple[] {
  return Object.entries(INK_ZONE_RULES).flatMap(([zone, rule]) =>
    rule.surfaces.flatMap((surface) =>
      rule.sides.map((side) => ({
        zone: zone as InkAnatomyTuple["zone"],
        surface,
        side,
      }))
    )
  );
}

function maskCentroidX(guide: ReturnType<typeof buildInkPoseAnatomyGuide>): number {
  let sum = 0;
  let count = 0;
  for (let index = 0; index < guide.mask.length; index += 1) {
    if (!guide.mask[index]) continue;
    sum += index % guide.width;
    count += 1;
  }
  return sum / count / guide.width;
}

describe("deterministic tattoo pose geometry", () => {
  it("produces material, bounded geometry for every registered anatomy tuple", () => {
    const result = everyTuple().map((tuple) =>
      buildInkPoseAnatomyGuide(tuple, analysis())
    );

    expect(result).toHaveLength(110);
    for (const guide of result) {
      expect(guide.mask.some(Boolean)).toBe(true);
      expect(guide.normalizedSegments.length).toBeGreaterThanOrEqual(1);
      expect(guide.normalizedSegments.length).toBeLessThanOrEqual(4);
      for (const segment of guide.normalizedSegments) {
        expect(segment.x).toBeGreaterThanOrEqual(0);
        expect(segment.y).toBeGreaterThanOrEqual(0);
        expect(segment.x + segment.width).toBeLessThanOrEqual(1);
        expect(segment.y + segment.height).toBeLessThanOrEqual(1);
      }
    }
  });

  it("follows anatomical right landmarks when the rendered frame is mirrored", () => {
    const tuple: InkAnatomyTuple = {
      zone: "full_arm",
      surface: "circumferential",
      side: "right",
    };
    const normal = buildInkPoseAnatomyGuide(tuple, analysis());
    const mirrored = buildInkPoseAnatomyGuide(
      tuple,
      analysis({ mirrored: true }),
    );

    expect(maskCentroidX(normal)).toBeLessThan(0.5);
    expect(maskCentroidX(mirrored)).toBeGreaterThan(0.5);
  });

  it("fails closed when a required sided landmark is uncertain", () => {
    const tuple: InkAnatomyTuple = {
      zone: "upper_arm",
      surface: "lateral",
      side: "right",
    };

    expect(() =>
      buildInkPoseAnatomyGuide(
        tuple,
        analysis({ scoreOverrides: { right_elbow: 0.2 } }),
      )
    ).toThrowError(
      expect.objectContaining<Partial<InkPoseGeometryError>>({
        code: "landmark_uncertain",
      }),
    );
  });

  it("does not require cropped lower-body landmarks for a face tattoo", () => {
    const scoreOverrides = Object.fromEntries(
      INK_POSE_KEYPOINTS
        .filter((name) =>
          name.includes("hip")
          || name.includes("knee")
          || name.includes("ankle")
          || name.includes("heel")
          || name.includes("foot")
        )
        .map((name) => [name, 0.1]),
    ) as Partial<Record<InkPoseKeypointName, number>>;

    const guide = buildInkPoseAnatomyGuide(
      { zone: "face", surface: "anterior", side: "centre" },
      analysis({ scoreOverrides }),
    );

    expect(guide.mask.some(Boolean)).toBe(true);
  });

  it("does not require cropped arm or leg landmarks for a shoulder tattoo", () => {
    const scoreOverrides = Object.fromEntries(
      INK_POSE_KEYPOINTS
        .filter((name) =>
          name.includes("elbow")
          || name.includes("wrist")
          || name.includes("index")
          || name.includes("pinky")
          || name.includes("hip")
          || name.includes("knee")
          || name.includes("ankle")
          || name.includes("heel")
          || name.includes("foot")
        )
        .map((name) => [name, 0.1]),
    ) as Partial<Record<InkPoseKeypointName, number>>;

    const guide = buildInkPoseAnatomyGuide(
      { zone: "shoulder", surface: "anterior", side: "left" },
      analysis({ scoreOverrides }),
    );

    expect(guide.mask.some(Boolean)).toBe(true);
  });

  it("intersects anatomical geometry with the detected person mask", () => {
    const source = analysis();
    const personMask = new Uint8Array(source.width * source.height);
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width / 2; x += 1) {
        personMask[y * source.width + x] = 255;
      }
    }
    const guide = buildInkPoseAnatomyGuide(
      {
        zone: "full_arm",
        surface: "circumferential",
        side: "right",
      },
      analysis({ personMask }),
    );

    for (let index = 0; index < guide.mask.length; index += 1) {
      if (!guide.mask[index]) continue;
      expect(index % guide.width).toBeLessThan(guide.width / 2);
    }
  });

  it("clips a confidently tracked sleeve when its hand exits the frame", () => {
    const tuple: InkAnatomyTuple = {
      zone: "full_arm",
      surface: "circumferential",
      side: "right",
    };
    const cropped = analysis({
      coordinateOverrides: {
        right_wrist: [0.44, 1.064],
        right_index: [0.51, 1.125],
        right_pinky: [0.45, 1.137],
      },
    });

    expect(() => buildInkPoseAnatomyGuide(tuple, cropped)).toThrowError(
      expect.objectContaining<Partial<InkPoseGeometryError>>({
        code: "landmark_uncertain",
      }),
    );

    const clipped = buildInkPoseAnatomyGuide(
      tuple,
      cropped,
      { allowClippedVisibility: true },
    );

    expect(clipped.visiblePrimitiveIndexes).toEqual([0, 1]);
    expect(clipped.normalizedSegments).toHaveLength(2);
    expect(clipped.mask.some(Boolean)).toBe(true);
  });

  it("fails closed when the selected surface is absent from the person mask", () => {
    expect(() =>
      buildInkPoseAnatomyGuide(
        {
          zone: "forearm",
          surface: "anterior",
          side: "left",
        },
        analysis({ personMask: new Uint8Array(240 * 320) }),
      )
    ).toThrowError(
      expect.objectContaining<Partial<InkPoseGeometryError>>({
        code: "surface_empty",
      }),
    );
  });
});
