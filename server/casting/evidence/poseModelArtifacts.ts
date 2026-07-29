import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import type { io } from "@tensorflow/tfjs-core";

export const INK_POSE_MODEL_VERSION =
  "blazepose.tfjs.full.detector-1.landmark-2" as const;

export type InkPoseModelKind = "detector" | "landmark";

type PinnedFile = Readonly<{
  path: string;
  bytes: number;
  sha256: string;
}>;

const PINNED_FILES = Object.freeze([
  {
    path: "blazepose_detector_v1/model.json",
    bytes: 140_772,
    sha256: "e7d678947790ba0578a5851fdb3cf70858a936fe09b9fe83e3d8ca6ce15f3567",
  },
  {
    path: "blazepose_detector_v1/group1-shard1of2.bin",
    bytes: 4_194_304,
    sha256: "c8d4ebfdcc6cb893f8cc6929ce2d2dfadc561e359d159e1aeb49b3f9eb034d98",
  },
  {
    path: "blazepose_detector_v1/group1-shard2of2.bin",
    bytes: 1_734_552,
    sha256: "f2a8eac1426dd73f250d48dee0295de0730a5559dfd713236eef2e44861ef835",
  },
  {
    path: "blazepose_landmark_full_v2/model.json",
    bytes: 164_941,
    sha256: "03676a196faf7c3fc26c0e4a434c5c20724606570240d47543dc290d1363d8e4",
  },
  {
    path: "blazepose_landmark_full_v2/group1-shard1of2.bin",
    bytes: 4_194_304,
    sha256: "16946f8b831d1b54de38f87d26b6ef401baa985da1df9dd188086f2528208502",
  },
  {
    path: "blazepose_landmark_full_v2/group1-shard2of2.bin",
    bytes: 2_144_898,
    sha256: "1c5653af7d08e4246a74755870cf1b7d5524ae4c90a4a7280d10c11400e36a40",
  },
] satisfies readonly PinnedFile[]);

const MODEL_DIRECTORIES = Object.freeze({
  detector: "blazepose_detector_v1",
  landmark: "blazepose_landmark_full_v2",
} satisfies Readonly<Record<InkPoseModelKind, string>>);

const MODEL_SHARDS = Object.freeze([
  "group1-shard1of2.bin",
  "group1-shard2of2.bin",
]);

type GraphManifest = Readonly<{
  format?: string;
  generatedBy?: string;
  convertedBy?: string | null;
  signature?: Record<string, unknown>;
  modelTopology: Record<string, unknown>;
  weightsManifest: readonly Readonly<{
    paths: readonly string[];
    weights: readonly io.WeightsManifestEntry[];
  }>[];
}>;

let poseModelRootPromise: Promise<string> | null = null;
let poseModelValidationPromise: Promise<void> | null = null;

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function resolvePoseModelRoot(): Promise<string> {
  if (!poseModelRootPromise) {
    poseModelRootPromise = (async () => {
      const candidates = [
        resolve(process.cwd(), "dist", "poseModels"),
        resolve(
          process.cwd(),
          "server",
          "casting",
          "evidence",
          "poseModels",
        ),
      ];
      for (const candidate of candidates) {
        if (await isDirectory(candidate)) return candidate;
      }
      throw new Error("Pinned tattoo pose models are unavailable");
    })();
  }
  return poseModelRootPromise;
}

function digest(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function validatePinnedInkPoseModels(): Promise<void> {
  if (!poseModelValidationPromise) {
    poseModelValidationPromise = (async () => {
      const root = await resolvePoseModelRoot();
      await Promise.all(PINNED_FILES.map(async (expected) => {
        const value = await readFile(resolve(root, expected.path));
        if (
          value.byteLength !== expected.bytes
          || digest(value) !== expected.sha256
        ) {
          throw new Error(`Pinned tattoo pose model failed integrity: ${expected.path}`);
        }
      }));
    })();
  }
  return poseModelValidationPromise;
}

function parseManifest(value: string): GraphManifest {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Pinned tattoo pose manifest is malformed");
  }
  const manifest = parsed as Partial<GraphManifest>;
  if (
    !manifest.modelTopology
    || !Array.isArray(manifest.weightsManifest)
    || manifest.weightsManifest.length !== 1
  ) {
    throw new Error("Pinned tattoo pose manifest is incomplete");
  }
  const paths = manifest.weightsManifest[0]?.paths;
  if (
    !Array.isArray(paths)
    || paths.length !== MODEL_SHARDS.length
    || paths.some((path, index) => path !== MODEL_SHARDS[index])
  ) {
    throw new Error("Pinned tattoo pose shard authority is malformed");
  }
  return manifest as GraphManifest;
}

function exactArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

export function createPinnedInkPoseModelHandler(
  kind: InkPoseModelKind,
): io.IOHandler {
  return Object.freeze({
    async load() {
      await validatePinnedInkPoseModels();
      const root = await resolvePoseModelRoot();
      const directory = resolve(root, MODEL_DIRECTORIES[kind]);
      const manifest = parseManifest(
        await readFile(resolve(directory, "model.json"), "utf8"),
      );
      const chunks = await Promise.all(
        MODEL_SHARDS.map((path) => readFile(resolve(directory, path))),
      );
      const weightData = Buffer.concat(chunks);
      return {
        modelTopology: manifest.modelTopology,
        signature: manifest.signature,
        weightSpecs: manifest.weightsManifest.flatMap(({ weights }) => weights),
        weightData: exactArrayBuffer(weightData),
        format: manifest.format,
        generatedBy: manifest.generatedBy,
        convertedBy: manifest.convertedBy,
      };
    },
  });
}

export const PINNED_INK_POSE_MODEL_FILES = PINNED_FILES;
