import { createRequire } from "node:module";
import { dirname, sep } from "node:path";

import * as poseDetection from "@tensorflow-models/pose-detection";
import * as wasmBackend from "@tensorflow/tfjs-backend-wasm";
import "@tensorflow/tfjs-converter";
import * as tf from "@tensorflow/tfjs-core";
import pLimit from "p-limit";
import sharp from "sharp";

import {
  createPinnedInkPoseModelHandler,
  INK_POSE_MODEL_VERSION,
} from "./poseModelArtifacts";

export const INK_POSE_KEYPOINTS = Object.freeze([
  "nose",
  "left_eye_inner",
  "left_eye",
  "left_eye_outer",
  "right_eye_inner",
  "right_eye",
  "right_eye_outer",
  "left_ear",
  "right_ear",
  "mouth_left",
  "mouth_right",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_pinky",
  "right_pinky",
  "left_index",
  "right_index",
  "left_thumb",
  "right_thumb",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
] as const);

export type InkPoseKeypointName = typeof INK_POSE_KEYPOINTS[number];

export interface InkPosePoint {
  name: InkPoseKeypointName;
  x: number;
  y: number;
  z: number;
  score: number;
}

export interface InkPoseAnalysis {
  recipeVersion: typeof INK_POSE_MODEL_VERSION;
  width: number;
  height: number;
  poseScore: number;
  landmarks: readonly InkPosePoint[];
  worldLandmarks: readonly InkPosePoint[];
  personMask: Uint8Array;
}

export type InkPoseFailureCode =
  | "decode_failed"
  | "model_unavailable"
  | "pose_not_found"
  | "pose_uncertain"
  | "mask_unavailable";

export class InkPoseAnalysisError extends Error {
  constructor(
    readonly code: InkPoseFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "InkPoseAnalysisError";
  }
}

const MAX_INFERENCE_EDGE = 1024;
const MIN_POSE_SCORE = 0.8;
const inferenceLimit = pLimit(1);
const require = createRequire(import.meta.url);

type PoseDetector = Awaited<
  ReturnType<typeof poseDetection.createDetector>
>;

let detectorPromise: Promise<PoseDetector> | null = null;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizedPoint(
  point: poseDetection.Keypoint,
  index: number,
  width: number,
  height: number,
): InkPosePoint {
  const expected = INK_POSE_KEYPOINTS[index];
  if (
    !expected
    || point.name !== expected
    || !finite(point.x)
    || !finite(point.y)
    || !finite(point.z)
    || !finite(point.score)
  ) {
    throw new InkPoseAnalysisError(
      "pose_uncertain",
      "Tattoo pose landmarks were malformed",
    );
  }
  return Object.freeze({
    name: expected,
    x: point.x / width,
    y: point.y / height,
    z: point.z / width,
    score: point.score,
  });
}

function worldPoint(
  point: poseDetection.Keypoint,
  index: number,
): InkPosePoint {
  const expected = INK_POSE_KEYPOINTS[index];
  if (
    !expected
    || point.name !== expected
    || !finite(point.x)
    || !finite(point.y)
    || !finite(point.z)
    || !finite(point.score)
  ) {
    throw new InkPoseAnalysisError(
      "pose_uncertain",
      "Tattoo world landmarks were malformed",
    );
  }
  return Object.freeze({
    name: expected,
    x: point.x,
    y: point.y,
    z: point.z,
    score: point.score,
  });
}

async function createDetector(): Promise<PoseDetector> {
  const wasmEntry = require.resolve("@tensorflow/tfjs-backend-wasm");
  wasmBackend.setWasmPaths(`${dirname(wasmEntry)}${sep}`);
  if (!(await tf.setBackend("wasm"))) {
    throw new InkPoseAnalysisError(
      "model_unavailable",
      "Tattoo pose inference backend is unavailable",
    );
  }
  await tf.ready();
  return poseDetection.createDetector(
    poseDetection.SupportedModels.BlazePose,
    {
      runtime: "tfjs",
      modelType: "full",
      enableSmoothing: false,
      enableSegmentation: true,
      smoothSegmentation: false,
      detectorModelUrl: createPinnedInkPoseModelHandler("detector"),
      landmarkModelUrl: createPinnedInkPoseModelHandler("landmark"),
    },
  );
}

async function getDetector(): Promise<PoseDetector> {
  if (!detectorPromise) {
    detectorPromise = createDetector().catch((error) => {
      detectorPromise = null;
      if (error instanceof InkPoseAnalysisError) throw error;
      throw new InkPoseAnalysisError(
        "model_unavailable",
        "Tattoo pose model could not be initialized",
        { cause: error },
      );
    });
  }
  return detectorPromise;
}

function maskBytes(values: tf.TypedArray, pixels: number): Uint8Array {
  if (values.length !== pixels * 4) {
    throw new InkPoseAnalysisError(
      "mask_unavailable",
      "Tattoo person mask dimensions were malformed",
    );
  }
  const result = new Uint8Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    const alpha = values[index * 4 + 3];
    if (!finite(alpha) || alpha < 0 || alpha > 1) {
      throw new InkPoseAnalysisError(
        "mask_unavailable",
        "Tattoo person mask values were malformed",
      );
    }
    result[index] = Math.round(alpha * 255);
  }
  return result;
}

export async function analyzeInkPoseImage(
  image: Buffer | Uint8Array,
): Promise<InkPoseAnalysis> {
  return inferenceLimit(async () => {
    let decoded: {
      data: Buffer;
      info: sharp.OutputInfo;
    };
    try {
      decoded = await sharp(image, { failOn: "error" })
        .rotate()
        .resize({
          width: MAX_INFERENCE_EDGE,
          height: MAX_INFERENCE_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    } catch (error) {
      throw new InkPoseAnalysisError(
        "decode_failed",
        "Tattoo pose source could not be decoded",
        { cause: error },
      );
    }

    const { width, height, channels } = decoded.info;
    if (channels !== 3 || width < 1 || height < 1) {
      throw new InkPoseAnalysisError(
        "decode_failed",
        "Tattoo pose source dimensions were malformed",
      );
    }

    // A cold process has no usable tensor backend until the detector runtime
    // has selected and initialized WASM. Creating the input tensor first makes
    // the first projection request fail before inference can start.
    const detector = await getDetector();
    const tensor = tf.tensor3d(
      new Uint8Array(
        decoded.data.buffer,
        decoded.data.byteOffset,
        decoded.data.byteLength,
      ),
      [height, width, channels],
    );
    let maskTensor: tf.Tensor3D | null = null;
    try {
      detector.reset();
      const poses = await detector.estimatePoses(tensor, {
        flipHorizontal: false,
        maxPoses: 1,
      });
      const pose = poses[0];
      if (!pose) {
        throw new InkPoseAnalysisError(
          "pose_not_found",
          "No person pose was found for tattoo projection",
        );
      }
      if (!finite(pose.score) || pose.score < MIN_POSE_SCORE) {
        throw new InkPoseAnalysisError(
          "pose_uncertain",
          "The person pose was not certain enough for tattoo projection",
        );
      }
      if (
        pose.keypoints.length !== INK_POSE_KEYPOINTS.length
        || pose.keypoints3D?.length !== INK_POSE_KEYPOINTS.length
      ) {
        throw new InkPoseAnalysisError(
          "pose_uncertain",
          "Tattoo pose landmarks were incomplete",
        );
      }
      maskTensor = await pose.segmentation?.mask.toTensor() ?? null;
      if (
        !maskTensor
        || maskTensor.shape[0] !== height
        || maskTensor.shape[1] !== width
        || maskTensor.shape[2] !== 4
      ) {
        throw new InkPoseAnalysisError(
          "mask_unavailable",
          "Tattoo person mask was unavailable",
        );
      }
      const values = await maskTensor.data();
      return Object.freeze({
        recipeVersion: INK_POSE_MODEL_VERSION,
        width,
        height,
        poseScore: pose.score,
        landmarks: Object.freeze(
          pose.keypoints.map((point, index) =>
            normalizedPoint(point, index, width, height)
          ),
        ),
        worldLandmarks: Object.freeze(
          pose.keypoints3D.map((point, index) => worldPoint(point, index)),
        ),
        personMask: maskBytes(values, width * height),
      });
    } catch (error) {
      if (error instanceof InkPoseAnalysisError) throw error;
      throw new InkPoseAnalysisError(
        "model_unavailable",
        "Tattoo pose inference failed",
        { cause: error },
      );
    } finally {
      maskTensor?.dispose();
      tensor.dispose();
    }
  });
}

export function resetInkPoseRuntimeForTests(): void {
  const active = detectorPromise;
  detectorPromise = null;
  void active?.then((detector) => detector.dispose()).catch(() => undefined);
}
