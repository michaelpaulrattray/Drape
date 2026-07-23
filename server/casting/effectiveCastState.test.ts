import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type {
  Model,
  ModelAsset,
  ModelIdentitySnapshot,
  ModelPackageSnapshot,
  ModelPackageSnapshotSlot,
} from "../../drizzle/schema";
import {
  EffectiveCastStateError,
  buildEffectiveCastState,
  type EffectiveCastStateRows,
} from "./effectiveCastState";

const now = new Date("2026-07-24T00:00:00.000Z");

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function asset(input: {
  id: number;
  modelId?: number;
  angle?: ModelAsset["viewType"];
  role?: "anchor" | "display";
  url?: string;
  status?: unknown;
}): ModelAsset {
  return {
    id: input.id,
    modelId: input.modelId ?? 10,
    viewType: input.angle ?? "frontClose",
    resolution: "1K",
    storageUrl: input.url ?? `https://example.invalid/${input.id}.png`,
    storageKey: `models/10/${input.id}.png`,
    pointsCost: 0,
    pinned: false,
    status: input.status ?? null,
    provenance: input.role ? { identityRole: input.role } : {},
    createdAt: now,
  };
}

function currentRows(): EffectiveCastStateRows {
  const packageId = randomUUID();
  const identityId = randomUUID();
  const identityText = "authoritative identity";
  const model = {
    id: 10,
    userId: 1,
    name: "Resolver Cast",
    agencyId: null,
    masterPrompt: "legacy compatibility",
    technicalSchema: {},
    preferences: {},
    status: "draft",
    identityRevisionId: null,
    currentPackageSnapshotId: packageId,
    stateVersion: 1,
    sealedIdentitySnapshotId: null,
    sealedPackageSnapshotId: null,
    mintedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  } as Model;
  const currentPackage = {
    id: packageId,
    modelId: model.id,
    identitySnapshotId: identityId,
    sequence: 1,
    parentPackageSnapshotId: null,
    reason: "bootstrap",
    createdByOperationId: null,
    createdAt: now,
  } as ModelPackageSnapshot;
  const currentIdentity = {
    id: identityId,
    modelId: model.id,
    sequence: 1,
    parentSnapshotId: null,
    restoredFromSnapshotId: null,
    reason: "bootstrap",
    masterPrompt: "snapshot identity",
    technicalSchema: {},
    preferences: {},
    identityText,
    identityTextHash: sha256(identityText),
    anchorAssetId: 1,
    recipeVersion: "r7-bootstrap-v1",
    createdByOperationId: null,
    createdAt: now,
  } as ModelIdentitySnapshot;
  const currentSlots = [
    {
      id: randomUUID(),
      packageSnapshotId: packageId,
      viewAngle: "sideClose",
      selectedAssetId: 3,
      compatibility: "current",
      selectionReason: "bootstrap",
      sourceSelectionId: null,
      createdAt: now,
    },
    {
      id: randomUUID(),
      packageSnapshotId: packageId,
      viewAngle: "frontClose",
      selectedAssetId: 2,
      compatibility: "stale",
      selectionReason: "bootstrap",
      sourceSelectionId: null,
      createdAt: now,
    },
  ] as ModelPackageSnapshotSlot[];
  return {
    model,
    assets: [
      asset({ id: 3, angle: "sideClose" }),
      asset({ id: 2, role: "display" }),
      asset({ id: 1, role: "anchor" }),
    ],
    currentPackage,
    currentIdentity,
    currentSlots,
    sealedPackage: null,
    sealedIdentity: null,
  };
}

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error("Expected effective Cast state to refuse");
  } catch (error) {
    expect(error).toBeInstanceOf(EffectiveCastStateError);
    expect(error).toMatchObject({ code });
    expect((error as Error).message).not.toContain("snapshot identity");
    expect((error as Error).message).not.toContain("example.invalid");
  }
}

describe("R7-7B1 effective Cast state", () => {
  it("resolves explicit selections while preserving anchor/display separation", () => {
    const state = buildEffectiveCastState(currentRows());
    expect(state).toMatchObject({
      authority: "snapshot",
      status: "current",
      stateVersion: 1,
      anchor: { id: 1 },
      displayedHeadshot: { id: 2 },
    });
    expect(state.selectedViews.map((view) => ({
      angle: view.angle,
      assetId: view.asset.id,
      compatibility: view.compatibility,
    }))).toEqual([
      { angle: "frontClose", assetId: 2, compatibility: "stale" },
      { angle: "sideClose", assetId: 3, compatibility: "current" },
    ]);
  });

  it("accepts a genuinely headless model without inventing state", () => {
    const rows = currentRows();
    rows.model = {
      ...rows.model,
      currentPackageSnapshotId: null,
      stateVersion: 0,
    };
    rows.assets = [asset({ id: 2, role: "display" })];
    rows.currentPackage = null;
    rows.currentIdentity = null;
    rows.currentSlots = [];
    expect(buildEffectiveCastState(rows)).toMatchObject({
      authority: "snapshot",
      status: "headless",
      stateVersion: 0,
      selectedViews: [],
    });
  });

  it("refuses a pointerless model that already has an anchor", () => {
    const rows = currentRows();
    rows.model = {
      ...rows.model,
      currentPackageSnapshotId: null,
      stateVersion: 0,
    };
    rows.currentPackage = null;
    rows.currentIdentity = null;
    rows.currentSlots = [];
    expectCode(() => buildEffectiveCastState(rows), "snapshot_head_missing");
  });

  it("refuses pointer/version and missing-head disagreements", () => {
    const badVersion = currentRows();
    badVersion.model = { ...badVersion.model, stateVersion: 0 };
    expectCode(() => buildEffectiveCastState(badVersion), "snapshot_pointer_state");

    const missingPackage = currentRows();
    missingPackage.currentPackage = null;
    expectCode(() => buildEffectiveCastState(missingPackage), "current_package_missing");

    const missingIdentity = currentRows();
    missingIdentity.currentIdentity = null;
    expectCode(() => buildEffectiveCastState(missingIdentity), "current_identity_missing");
  });

  it("refuses tampered identity text and non-anchor authority", () => {
    const badHash = currentRows();
    badHash.currentIdentity = {
      ...badHash.currentIdentity!,
      identityTextHash: sha256("different"),
    };
    expectCode(() => buildEffectiveCastState(badHash), "identity_hash_invalid");

    const displayAnchor = currentRows();
    displayAnchor.assets = displayAnchor.assets.map((row) => (
      row.id === 1 ? { ...row, provenance: { identityRole: "display" } } : row
    ));
    expectCode(() => buildEffectiveCastState(displayAnchor), "identity_anchor_invalid");
  });

  it("refuses invalid selected assets and failure markers", () => {
    const crossModel = currentRows();
    crossModel.assets = crossModel.assets.map((row) => (
      row.id === 3 ? { ...row, modelId: 999 } : row
    ));
    expectCode(() => buildEffectiveCastState(crossModel), "slot_asset_invalid");

    const wrongAngle = currentRows();
    wrongAngle.assets = wrongAngle.assets.map((row) => (
      row.id === 3 ? { ...row, viewType: "backFull" } : row
    ));
    expectCode(() => buildEffectiveCastState(wrongAngle), "slot_asset_invalid");

    const marker = currentRows();
    marker.assets = marker.assets.map((row) => (
      row.id === 3 ? { ...row, storageUrl: "", status: { state: "failed" } } : row
    ));
    expectCode(() => buildEffectiveCastState(marker), "slot_failure_marker");
  });

  it("refuses duplicate selection closure and a missing displayed headshot", () => {
    const wrongPackage = currentRows();
    wrongPackage.currentSlots = wrongPackage.currentSlots.map((slot, index) => (
      index === 0 ? { ...slot, packageSnapshotId: randomUUID() } : slot
    ));
    expectCode(() => buildEffectiveCastState(wrongPackage), "slot_package_invalid");

    const duplicateAngle = currentRows();
    duplicateAngle.currentSlots = [
      ...duplicateAngle.currentSlots,
      {
        ...duplicateAngle.currentSlots[0],
        id: randomUUID(),
        selectedAssetId: 1,
      },
    ];
    expectCode(() => buildEffectiveCastState(duplicateAngle), "slot_duplicate_angle");

    const duplicateAsset = currentRows();
    duplicateAsset.currentSlots = [
      duplicateAsset.currentSlots.find((slot) => slot.viewAngle === "frontClose")!,
      {
        ...duplicateAsset.currentSlots.find((slot) => slot.viewAngle === "sideClose")!,
        selectedAssetId: 2,
        viewAngle: "threeQuarter",
      },
    ];
    expectCode(() => buildEffectiveCastState(duplicateAsset), "slot_duplicate_asset");

    const noFront = currentRows();
    noFront.currentSlots = noFront.currentSlots.filter((slot) => slot.viewAngle !== "frontClose");
    expectCode(() => buildEffectiveCastState(noFront), "displayed_headshot_missing");
  });

  it("enforces draft and minted seal closure", () => {
    const unsealedMint = currentRows();
    unsealedMint.model = { ...unsealedMint.model, status: "active" };
    expectCode(() => buildEffectiveCastState(unsealedMint), "mint_seal_missing");

    const sealedDraft = currentRows();
    sealedDraft.model = {
      ...sealedDraft.model,
      sealedIdentitySnapshotId: sealedDraft.currentIdentity!.id,
      sealedPackageSnapshotId: sealedDraft.currentPackage!.id,
    };
    sealedDraft.sealedIdentity = sealedDraft.currentIdentity;
    sealedDraft.sealedPackage = sealedDraft.currentPackage;
    expectCode(() => buildEffectiveCastState(sealedDraft), "draft_seal_present");

    const sealedMint = currentRows();
    sealedMint.model = {
      ...sealedMint.model,
      status: "active",
      sealedIdentitySnapshotId: sealedMint.currentIdentity!.id,
      sealedPackageSnapshotId: sealedMint.currentPackage!.id,
    };
    sealedMint.sealedIdentity = sealedMint.currentIdentity;
    sealedMint.sealedPackage = sealedMint.currentPackage;
    expect(buildEffectiveCastState(sealedMint)).toMatchObject({
      status: "current",
      sealedIdentity: { id: sealedMint.currentIdentity!.id },
      sealedPackage: { id: sealedMint.currentPackage!.id },
    });
  });
});
