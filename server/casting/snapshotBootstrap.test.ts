import { describe, expect, it } from "vitest";
import { buildIdentityAnchor } from "./geminiClient";
import {
  deriveBootstrapState,
  SNAPSHOT_BOOTSTRAP_RECIPE_VERSION,
} from "./snapshotBootstrap";

const model = {
  masterPrompt: "Editorial person",
  technicalSchema: { hair: { color: "Brown" } },
};

const asset = (over: Partial<{
  id: number;
  viewType: "frontClose" | "threeQuarter" | "frontFull" | "sideClose" | "sideFull" | "backFull";
  storageUrl: string;
  status: unknown;
  provenance: unknown;
}> = {}) => ({
  id: 1,
  viewType: "frontClose" as const,
  storageUrl: "https://r2/head.png",
  status: null,
  provenance: { identityRole: "anchor" },
  ...over,
});

describe("R7-7A2 snapshot bootstrap derivation", () => {
  it("keeps identity anchor separate from the newest displayed headshot", () => {
    const derived = deriveBootstrapState(model, [
      asset({
        id: 20,
        storageUrl: "https://r2/display.png",
        status: { state: "stale" },
        provenance: { identityRole: "display" },
      }),
      asset({ id: 10, storageUrl: "https://r2/anchor.png" }),
      asset({ id: 30, viewType: "sideClose", storageUrl: "https://r2/side-new.png" }),
      asset({ id: 29, viewType: "sideClose", storageUrl: "https://r2/side-old.png" }),
      asset({ id: 40, viewType: "backFull", storageUrl: "", status: { state: "failed" } }),
    ]);
    expect(derived).not.toBeNull();
    expect(derived?.anchorAssetId).toBe(10);
    expect(derived?.slots).toEqual([
      { viewAngle: "frontClose", selectedAssetId: 20, compatibility: "stale" },
      { viewAngle: "sideClose", selectedAssetId: 30, compatibility: "current" },
    ]);
    expect(derived?.identityText).toBe(buildIdentityAnchor(model.masterPrompt, model.technicalSchema));
    expect(derived?.identityTextHash).toMatch(/^[a-f0-9]{64}$/);
    expect(SNAPSHOT_BOOTSTRAP_RECIPE_VERSION).toBe("r7-snapshot-bootstrap-v1");
  });

  it("returns headless when only a display headshot or a failure marker exists", () => {
    expect(deriveBootstrapState(model, [
      asset({ provenance: { identityRole: "display" } }),
      asset({ id: 2, storageUrl: "", status: { state: "failed" } }),
    ])).toBeNull();
  });

  it("treats pre-Batch-C no-role headshots as legacy anchors", () => {
    expect(deriveBootstrapState(model, [asset({ provenance: null })])?.anchorAssetId).toBe(1);
  });
});
