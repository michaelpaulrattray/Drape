import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => {
  const order: string[] = [];
  const keypointNames = [
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
  ];
  let backendReady = false;
  const maskTensor = {
    shape: [2, 2, 4],
    data: vi.fn(async () => new Float32Array([
      1, 0, 0, 1,
      1, 0, 0, 1,
      1, 0, 0, 1,
      1, 0, 0, 1,
    ])),
    dispose: vi.fn(),
  };
  const pose = {
    score: 0.99,
    keypoints: keypointNames.map((name, index) => ({
      name,
      x: index % 2,
      y: index % 2,
      z: 0,
      score: 0.99,
    })),
    keypoints3D: keypointNames.map((name) => ({
      name,
      x: 0,
      y: 0,
      z: 0,
      score: 0.99,
    })),
    segmentation: {
      mask: {
        toTensor: vi.fn(async () => maskTensor),
      },
    },
  };
  const detector = {
    reset: vi.fn(() => {
      order.push("reset");
    }),
    estimatePoses: vi.fn(async () => {
      order.push("estimatePoses");
      return [pose];
    }),
    dispose: vi.fn(),
  };
  return {
    order,
    maskTensor,
    detector,
    get backendReady() {
      return backendReady;
    },
    set backendReady(value: boolean) {
      backendReady = value;
    },
  };
});

vi.mock("@tensorflow/tfjs-backend-wasm", () => ({
  setWasmPaths: vi.fn(),
}));

vi.mock("@tensorflow/tfjs-core", () => ({
  setBackend: vi.fn(async () => {
    runtime.order.push("setBackend");
    runtime.backendReady = true;
    return true;
  }),
  ready: vi.fn(async () => {
    runtime.order.push("ready");
  }),
  tensor3d: vi.fn(() => {
    runtime.order.push("tensor3d");
    if (!runtime.backendReady) {
      throw new Error("Tensor backend was used before initialization");
    }
    return { dispose: vi.fn() };
  }),
}));

vi.mock("@tensorflow-models/pose-detection", () => ({
  SupportedModels: { BlazePose: "BlazePose" },
  createDetector: vi.fn(async () => {
    runtime.order.push("createDetector");
    return runtime.detector;
  }),
}));

vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    rotate() {
      return this;
    },
    resize() {
      return this;
    },
    removeAlpha() {
      return this;
    },
    raw() {
      return this;
    },
    async toBuffer() {
      return {
        data: Buffer.alloc(12, 128),
        info: { width: 2, height: 2, channels: 3 },
      };
    },
  })),
}));

import {
  analyzeInkPoseImage,
  resetInkPoseRuntimeForTests,
} from "./inkPoseRuntime";

describe("ink pose runtime", () => {
  beforeEach(() => {
    resetInkPoseRuntimeForTests();
    runtime.order.length = 0;
    runtime.backendReady = false;
    vi.clearAllMocks();
  });

  it("initializes the WASM detector before creating a cold-start tensor", async () => {
    const result = await analyzeInkPoseImage(Buffer.from("image"));

    expect(result).toMatchObject({
      width: 2,
      height: 2,
      poseScore: 0.99,
    });
    expect(result.landmarks).toHaveLength(33);
    expect(result.worldLandmarks).toHaveLength(33);
    expect(result.personMask).toEqual(new Uint8Array([255, 255, 255, 255]));
    expect(runtime.order).toEqual([
      "setBackend",
      "ready",
      "createDetector",
      "tensor3d",
      "reset",
      "estimatePoses",
    ]);
  });
});
