import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type {
  ModelAsset,
  ModelIdentitySnapshot,
  ModelPackageSnapshot,
  ModelPackageSnapshotSlot,
} from "../../drizzle/schema";
import { buildIdentityAnchor } from "./geminiClient";
import {
  assessSnapshotPinConvergenceState,
  parseSnapshotPinConvergenceArgs,
} from "./snapshotPinConvergence";
import type { SnapshotShadowState } from "./snapshotShadow";

const devBase = [
  "--database-url", "mysql://user:pass@example.test/railway",
  "--app-id", "drape-local",
  "--user-id", "7",
  "--expected-model-count", "2",
  "--expected-pinned-row-count", "3",
];

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parityState(): SnapshotShadowState {
  const masterPrompt = "private prompt";
  const technicalSchema = { face: "oval" };
  const preferences = { hair: "brown" };
  const identityText = buildIdentityAnchor(masterPrompt, technicalSchema);
  const identity: ModelIdentitySnapshot = {
    id: "11111111-1111-4111-8111-111111111111",
    modelId: 7,
    sequence: 1,
    parentSnapshotId: null,
    restoredFromSnapshotId: null,
    reason: "bootstrap",
    masterPrompt,
    technicalSchema,
    preferences,
    identityText,
    identityTextHash: sha256(identityText),
    anchorAssetId: 1,
    recipeVersion: "test",
    createdByOperationId: null,
    createdAt: new Date("2026-07-24T00:00:00Z"),
  };
  const currentPackage: ModelPackageSnapshot = {
    id: "22222222-2222-4222-8222-222222222222",
    modelId: 7,
    identitySnapshotId: identity.id,
    sequence: 1,
    parentPackageSnapshotId: null,
    reason: "bootstrap",
    createdByOperationId: null,
    createdAt: new Date("2026-07-24T00:00:00Z"),
  };
  const assets: ModelAsset[] = [
    {
      id: 2,
      modelId: 7,
      viewType: "sideClose",
      resolution: "1K",
      storageUrl: "https://private.invalid/side.png",
      storageKey: "private/side.png",
      pointsCost: 0,
      pinned: true,
      status: null,
      provenance: { identityRevisionId: "genesis" },
      createdAt: new Date("2026-07-24T00:00:02Z"),
    },
    {
      id: 1,
      modelId: 7,
      viewType: "frontClose",
      resolution: "1K",
      storageUrl: "https://private.invalid/head.png",
      storageKey: "private/head.png",
      pointsCost: 0,
      pinned: false,
      status: null,
      provenance: { identityRole: "anchor" },
      createdAt: new Date("2026-07-24T00:00:01Z"),
    },
  ];
  const currentSlots: ModelPackageSnapshotSlot[] = [
    {
      id: "33333333-3333-4333-8333-333333333331",
      packageSnapshotId: currentPackage.id,
      viewAngle: "frontClose",
      selectedAssetId: 1,
      compatibility: "current",
      selectionReason: "bootstrap",
      sourceSelectionId: null,
      createdAt: new Date("2026-07-24T00:00:00Z"),
    },
    {
      id: "33333333-3333-4333-8333-333333333332",
      packageSnapshotId: currentPackage.id,
      viewAngle: "sideClose",
      selectedAssetId: 2,
      compatibility: "current",
      selectionReason: "bootstrap",
      sourceSelectionId: null,
      createdAt: new Date("2026-07-24T00:00:00Z"),
    },
  ];
  return {
    model: {
      id: 7,
      status: "draft",
      masterPrompt,
      technicalSchema,
      preferences,
      identityRevisionId: null,
      currentPackageSnapshotId: currentPackage.id,
      stateVersion: 1,
      sealedIdentitySnapshotId: null,
      sealedPackageSnapshotId: null,
    },
    assets,
    currentPackage,
    currentIdentity: identity,
    currentSlots,
    sealedPackage: null,
    sealedIdentity: null,
  };
}

describe("R7-7B6 bounded pin convergence ceremony", () => {
  it("requires a bounded cohort and both exact counts", () => {
    expect(() => parseSnapshotPinConvergenceArgs([]))
      .toThrow("--database-url is required");
    expect(() => parseSnapshotPinConvergenceArgs([
      "--database-url", "mysql://user:pass@example.test/railway",
      "--app-id", "drape-local",
      "--expected-model-count", "1",
      "--expected-pinned-row-count", "0",
    ])).toThrow("full-database pin convergence is refused");
    expect(() => parseSnapshotPinConvergenceArgs(devBase.slice(0, -2)))
      .toThrow("--expected-pinned-row-count is required");
  });

  it("is read-only by default, accepts an exact zero pin count and deduplicates ids", () => {
    expect(parseSnapshotPinConvergenceArgs([
      "--database-url", "mysql://user:pass@example.test/railway",
      "--app-id", "drape-local",
      "--model-id", "9",
      "--model-id", "3",
      "--model-id", "9",
      "--expected-model-count", "2",
      "--expected-pinned-row-count", "0",
    ])).toMatchObject({
      modelIds: [3, 9],
      expectedModelCount: 2,
      expectedPinnedRowCount: 0,
      apply: false,
      allowPinConvergenceWrite: false,
    });
  });

  it("requires explicit write authority and exact target confirmations", () => {
    expect(() => parseSnapshotPinConvergenceArgs([...devBase, "--apply"]))
      .toThrow("requires --allow-pin-convergence-write");
    expect(() => parseSnapshotPinConvergenceArgs([
      ...devBase,
      "--apply",
      "--allow-pin-convergence-write",
    ])).toThrow("--confirm-app-id must exactly match");
    expect(() => parseSnapshotPinConvergenceArgs([
      ...devBase,
      "--apply",
      "--allow-pin-convergence-write",
      "--confirm-app-id", "drape-local",
      "--confirm-host", "example.test",
      "--confirm-database", "railway",
    ])).not.toThrow();
  });

  it("separates production planning from production pin writes", () => {
    const production = devBase.map((value) => (
      value === "drape-local" ? "drape-production" : value
    ));
    expect(() => parseSnapshotPinConvergenceArgs(production))
      .toThrow("requires --allow-production-read-only");
    expect(() => parseSnapshotPinConvergenceArgs([
      ...production,
      "--apply",
      "--allow-pin-convergence-write",
      "--confirm-app-id", "drape-production",
      "--confirm-host", "example.test",
      "--confirm-database", "railway",
    ])).toThrow("requires --allow-production-pin-convergence");
    expect(parseSnapshotPinConvergenceArgs([
      ...production,
      "--apply",
      "--allow-pin-convergence-write",
      "--confirm-app-id", "drape-production",
      "--confirm-host", "example.test",
      "--confirm-database", "railway",
      "--allow-production-pin-convergence",
    ])).toMatchObject({
      apply: true,
      allowProductionPinConvergence: true,
    });
  });

  it("rejects write flags in read-only mode and non-decimal integer spellings", () => {
    expect(() => parseSnapshotPinConvergenceArgs([
      ...devBase,
      "--allow-pin-convergence-write",
    ])).toThrow("valid only with --apply");
    expect(() => parseSnapshotPinConvergenceArgs(
      devBase.map((value) => value === "3" ? "0x3" : value),
    )).toThrow("--expected-pinned-row-count must be a non-negative integer");
  });

  it("proves that clearing pins alone restores parity", () => {
    expect(assessSnapshotPinConvergenceState(parityState())).toEqual({
      pinnedRows: 1,
      postClearParity: true,
    });
  });

  it("does not let a pin clear conceal unrelated identity drift", () => {
    const state = parityState();
    state.model.masterPrompt = "different mutable prompt";
    expect(assessSnapshotPinConvergenceState(state)).toEqual({
      pinnedRows: 1,
      postClearParity: false,
    });
  });
});
