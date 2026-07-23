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
  compareSnapshotShadowState,
  type SnapshotShadowState,
} from "./snapshotShadow";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function asset(input: Partial<ModelAsset> & Pick<ModelAsset, "id" | "viewType" | "storageUrl">): ModelAsset {
  return {
    modelId: 7,
    resolution: "1K",
    storageKey: `models/${input.id}.png`,
    pointsCost: 350,
    pinned: false,
    status: null,
    provenance: null,
    createdAt: new Date(`2026-07-23T00:00:${String(input.id).padStart(2, "0")}Z`),
    ...input,
  };
}

function parityState(): SnapshotShadowState {
  const masterPrompt = "SECRET editorial identity";
  const technicalSchema = { face: { shape: "oval" } };
  const preferences = { hair: { color: "brown" } };
  const identityText = buildIdentityAnchor(masterPrompt, technicalSchema);
  const identity: ModelIdentitySnapshot = {
    id: "11111111-1111-4111-8111-111111111111",
    modelId: 7,
    sequence: 1,
    parentSnapshotId: null,
    restoredFromSnapshotId: null,
    reason: "create",
    masterPrompt,
    technicalSchema,
    preferences,
    identityText,
    identityTextHash: sha256(identityText),
    anchorAssetId: 1,
    recipeVersion: "test",
    createdByOperationId: null,
    createdAt: new Date("2026-07-23T00:00:00Z"),
  };
  const currentPackage: ModelPackageSnapshot = {
    id: "22222222-2222-4222-8222-222222222222",
    modelId: 7,
    identitySnapshotId: identity.id,
    sequence: 1,
    parentPackageSnapshotId: null,
    reason: "bootstrap",
    createdByOperationId: null,
    createdAt: new Date("2026-07-23T00:00:00Z"),
  };
  const slots: ModelPackageSnapshotSlot[] = [
    {
      id: "33333333-3333-4333-8333-333333333331",
      packageSnapshotId: currentPackage.id,
      viewAngle: "frontClose",
      selectedAssetId: 1,
      compatibility: "current",
      selectionReason: "bootstrap",
      sourceSelectionId: null,
      createdAt: new Date("2026-07-23T00:00:00Z"),
    },
    {
      id: "33333333-3333-4333-8333-333333333332",
      packageSnapshotId: currentPackage.id,
      viewAngle: "sideClose",
      selectedAssetId: 2,
      compatibility: "current",
      selectionReason: "bootstrap",
      sourceSelectionId: null,
      createdAt: new Date("2026-07-23T00:00:00Z"),
    },
  ];
  return {
    model: {
      id: 7,
      status: "draft",
      masterPrompt,
      technicalSchema,
      preferences,
      currentPackageSnapshotId: currentPackage.id,
      stateVersion: 1,
      sealedIdentitySnapshotId: null,
      sealedPackageSnapshotId: null,
    },
    assets: [
      asset({
        id: 2,
        viewType: "sideClose",
        storageUrl: "https://secret.invalid/side.png",
        provenance: { identityRevisionId: "genesis" },
      }),
      asset({
        id: 1,
        viewType: "frontClose",
        storageUrl: "https://secret.invalid/head.png",
        provenance: { identityRole: "anchor" },
      }),
    ],
    currentPackage,
    currentIdentity: identity,
    currentSlots: slots,
    sealedPackage: null,
    sealedIdentity: null,
  };
}

describe("R7-7A4 snapshot shadow comparator", () => {
  it("reports parity using only ids, counts, enums, booleans and hashes", () => {
    const report = compareSnapshotShadowState(parityState());
    expect(report).toMatchObject({
      modelId: 7,
      parity: true,
      headState: "current",
      stateVersion: 1,
      minted: false,
      mismatchKinds: [],
      legacyIdentity: { anchorAssetId: 1 },
      snapshotIdentity: { anchorAssetId: 1 },
      legacyPackage: { displayedHeadshotAssetId: 1, selectedSlotCount: 2 },
      snapshotPackage: { displayedHeadshotAssetId: 1, selectedSlotCount: 2 },
    });
    expect(report.legacyIdentity.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.legacyPackage.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.values(report.consumerParity).every((surface) => (
      surface.parity
      && /^[a-f0-9]{64}$/.test(surface.legacyHash ?? "")
      && /^[a-f0-9]{64}$/.test(surface.snapshotHash ?? "")
    ))).toBe(true);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("SECRET editorial identity");
    expect(serialized).not.toContain("secret.invalid");
    expect(serialized).not.toContain("models/1.png");
    expect(serialized).not.toContain("oval");
  });

  it("treats a genuinely headless model as valid parity", () => {
    const state = parityState();
    state.model.currentPackageSnapshotId = null;
    state.model.stateVersion = 0;
    state.assets = [];
    state.currentPackage = null;
    state.currentIdentity = null;
    state.currentSlots = [];
    const report = compareSnapshotShadowState(state);
    expect(report).toMatchObject({
      parity: true,
      headState: "headless",
      mismatchKinds: [],
    });
  });

  it("rejects a non-positive state version when a package head exists", () => {
    const state = parityState();
    state.model.stateVersion = -1;
    const report = compareSnapshotShadowState(state);
    expect(report.parity).toBe(false);
    expect(report.mismatchKinds).toContain("snapshot_pointer_state");
  });

  it("detects document, displayed-selection, slot and compatibility drift", () => {
    const state = parityState();
    state.model.masterPrompt = "SECRET drifted identity";
    state.assets.unshift(asset({
      id: 3,
      viewType: "frontClose",
      storageUrl: "https://secret.invalid/new-display.png",
      provenance: { identityRole: "display" },
    }));
    state.assets[1] = { ...state.assets[1], status: { state: "stale" } };
    const report = compareSnapshotShadowState(state);
    expect(report.parity).toBe(false);
    expect(report.mismatchKinds).toEqual(expect.arrayContaining([
      "identity_documents",
      "displayed_headshot",
      "slot_asset",
      "slot_compatibility",
      "consumer_package_state",
      "consumer_mint_plan",
      "consumer_refresh_plan",
      "consumer_export",
      "consumer_board_library",
      "consumer_models_registry",
    ]));
    expect(JSON.stringify(report)).not.toContain("drifted identity");
  });

  it("keeps provenance refusals in snapshot mint-plan parity", () => {
    const state = parityState();
    state.assets[0] = {
      ...state.assets[0],
      provenance: null,
    };
    const report = compareSnapshotShadowState(state);
    expect(report.mismatchKinds).toEqual([]);
    expect(report.consumerParity.casting_mint_plan.parity).toBe(true);
    expect(report.consumerParity.casting_package_state.parity).toBe(true);
    expect(report.consumerParity.casting_refresh_plan.parity).toBe(true);
  });

  it("keeps pinned stale selections and unselected failure markers in consumer parity", () => {
    const state = parityState();
    state.assets[0] = {
      ...state.assets[0],
      pinned: true,
      status: { state: "stale" },
    };
    state.currentSlots[1] = {
      ...state.currentSlots[1],
      compatibility: "stale",
    };
    state.assets.unshift(asset({
      id: 9,
      viewType: "backFull",
      storageUrl: "",
      storageKey: null,
      status: { state: "failed", refunded: 300 },
    }));
    const report = compareSnapshotShadowState(state);
    expect(report.parity).toBe(true);
    expect(report.mismatchKinds).toEqual([]);
    expect(Object.values(report.consumerParity).every((surface) => surface.parity)).toBe(true);
  });

  it("fails closed on invalid selections and incomplete minted seals", () => {
    const state = parityState();
    state.model.status = "active";
    state.currentSlots[1] = { ...state.currentSlots[1], selectedAssetId: 999 };
    state.model.sealedIdentitySnapshotId = state.currentIdentity!.id;
    const report = compareSnapshotShadowState(state);
    expect(report.parity).toBe(false);
    expect(report.mismatchKinds).toEqual(expect.arrayContaining([
      "snapshot_selection_invalid",
      "slot_asset",
      "seal_pointer_pair",
      "mint_seal_missing",
      "sealed_identity_missing",
    ]));
  });

  it("allows a late-view package to advance while the original mint package stays sealed", () => {
    const state = parityState();
    const mintPackage = state.currentPackage!;
    const latePackage: ModelPackageSnapshot = {
      ...mintPackage,
      id: "44444444-4444-4444-8444-444444444444",
      sequence: 2,
      parentPackageSnapshotId: mintPackage.id,
      reason: "late_view",
    };
    state.model.status = "active";
    state.model.currentPackageSnapshotId = latePackage.id;
    state.model.stateVersion = 2;
    state.model.sealedIdentitySnapshotId = state.currentIdentity!.id;
    state.model.sealedPackageSnapshotId = mintPackage.id;
    state.currentPackage = latePackage;
    state.currentSlots = state.currentSlots.map((slot) => ({
      ...slot,
      packageSnapshotId: latePackage.id,
    }));
    state.sealedIdentity = state.currentIdentity;
    state.sealedPackage = mintPackage;
    const report = compareSnapshotShadowState(state);
    expect(report).toMatchObject({
      parity: true,
      minted: true,
      currentPackageSnapshotId: latePackage.id,
      sealedPackageSnapshotId: mintPackage.id,
      mismatchKinds: [],
    });
  });
});
