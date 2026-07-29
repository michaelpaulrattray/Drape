import { describe, expect, it } from "vitest";

import {
  createPinnedInkPoseModelHandler,
  PINNED_INK_POSE_MODEL_FILES,
  validatePinnedInkPoseModels,
} from "./poseModelArtifacts";

describe("pinned tattoo pose model artifacts", () => {
  it("matches every pinned byte length and sha256 digest", async () => {
    await expect(validatePinnedInkPoseModels()).resolves.toBeUndefined();
    expect(PINNED_INK_POSE_MODEL_FILES).toHaveLength(6);
  });

  it.each([
    ["detector", 5_928_856],
    ["landmark", 6_339_202],
  ] as const)("loads the %s graph and exact local shards", async (kind, bytes) => {
    const artifacts = await createPinnedInkPoseModelHandler(kind).load();

    expect(artifacts.modelTopology).toBeTruthy();
    expect(artifacts.signature).toBeTruthy();
    expect(artifacts.weightSpecs?.length).toBeGreaterThan(0);
    expect(artifacts.weightData).toBeInstanceOf(ArrayBuffer);
    expect((artifacts.weightData as ArrayBuffer).byteLength).toBe(bytes);
  });
});
