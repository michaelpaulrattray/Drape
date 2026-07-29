import { describe, expect, it } from "vitest";
import {
  buildPublicCastStateHistory,
  resolveWholeCastRestorePoint,
} from "./wholeCastRestore";

function fixture() {
  const anchor = {
    id: 11,
    modelId: 7,
    viewType: "frontClose",
    storageUrl: "https://r2/anchor.png",
    storageKey: "models/7/anchor.png",
    resolution: "1K",
    pointsCost: 0,
    pinned: false,
    status: null,
    provenance: {
      identityRole: "anchor",
      identityRevisionId: "genesis",
      identityAnchorHash: "hash",
    },
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
  const body = {
    ...anchor,
    id: 12,
    viewType: "frontFull",
    storageUrl: "https://r2/body.png",
    storageKey: "models/7/body.png",
    provenance: {
      identityRole: "display",
      identityRevisionId: "genesis",
      identityAnchorHash: "hash",
    },
  };
  const identityText = "immutable identity";
  const hash = "ff9b2aa603d3ca2660a3083b7acdf7b0f0977e9a7e40f4157ea647ba42f0bd22";
  const rows = {
    model: {
      id: 7,
      userId: 1,
      status: "draft",
      currentPackageSnapshotId: "package-2",
      stateVersion: 2,
      identityRevisionId: null,
      masterPrompt: "current prompt",
      technicalSchema: {},
      preferences: {},
    },
    identities: [
      {
        id: "identity-2",
        modelId: 7,
        sequence: 2,
        parentSnapshotId: "identity-1",
        restoredFromSnapshotId: null,
        reason: "evidence_accept",
        masterPrompt: "current prompt",
        technicalSchema: {},
        preferences: {},
        identityText,
        identityTextHash: hash,
        anchorAssetId: 11,
        recipeVersion: "accept-v1",
        createdByOperationId: "operation-2",
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        id: "identity-1",
        modelId: 7,
        sequence: 1,
        parentSnapshotId: null,
        restoredFromSnapshotId: null,
        reason: "bootstrap",
        masterPrompt: "original prompt",
        technicalSchema: {},
        preferences: {},
        identityText,
        identityTextHash: hash,
        anchorAssetId: 11,
        recipeVersion: "bootstrap-v1",
        createdByOperationId: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ],
    packages: [
      {
        id: "package-2",
        modelId: 7,
        identitySnapshotId: "identity-2",
        sequence: 2,
        parentPackageSnapshotId: "package-1",
        reason: "evidence_accept",
        createdByOperationId: "operation-2",
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        id: "package-1",
        modelId: 7,
        identitySnapshotId: "identity-1",
        sequence: 1,
        parentPackageSnapshotId: null,
        reason: "bootstrap",
        createdByOperationId: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ],
    slots: [
      {
        id: "slot-2-head",
        packageSnapshotId: "package-2",
        viewAngle: "frontClose",
        selectedAssetId: 11,
        compatibility: "current",
        selectionReason: "carried",
        sourceSelectionId: "slot-1-head",
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        id: "slot-2-body",
        packageSnapshotId: "package-2",
        viewAngle: "frontFull",
        selectedAssetId: 12,
        compatibility: "current",
        selectionReason: "evidence_accept",
        sourceSelectionId: null,
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        id: "slot-1-head",
        packageSnapshotId: "package-1",
        viewAngle: "frontClose",
        selectedAssetId: 11,
        compatibility: "current",
        selectionReason: "bootstrap",
        sourceSelectionId: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: "slot-1-missing",
        packageSnapshotId: "package-1",
        viewAngle: "threeQuarter",
        selectedAssetId: 999,
        compatibility: "current",
        selectionReason: "bootstrap",
        sourceSelectionId: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ],
    assets: [body, anchor],
    featureSelections: [
      {
        id: "selection-1",
        modelId: 7,
        identitySnapshotId: "identity-2",
        featureId: "feature-1",
        featureVersionId: "version-1",
        selectionReason: "accepted",
        sourceSelectionId: null,
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    ],
    features: [{
      id: "feature-1",
      modelId: 7,
      category: "ink",
      createdByOperationId: "operation-2",
      createdAt: new Date("2026-01-02T00:00:00Z"),
    }],
    featureVersions: [{
      id: "version-1",
      modelId: 7,
      featureId: "feature-1",
      operation: "present",
      ontologyVersion: "ink-v1",
      zone: "front_upper_torso",
      surface: "anterior",
      side: "left",
      normalizedDescriptor: "black star",
      sourceAssetId: 11,
      sourceViewAngle: "frontFull",
      sourceReferencePlateId: null,
      acceptedCandidatePlateId: "plate-1",
      evidenceCropId: null,
      recipeVersion: "recipe-v1",
      createdByOperationId: "operation-2",
      createdAt: new Date("2026-01-02T00:00:00Z"),
      acceptedAssetId: 12,
    }],
    plates: [{
      id: "plate-1",
      userId: 1,
      modelId: 7,
      featureIntentId: null,
      kind: "accepted_candidate",
      storageKey: "users/1/models/7/plate.webp",
      mime: "image/webp",
      width: 1024,
      height: 1024,
      byteSize: 100,
      contentHash: "a".repeat(64),
      createdByOperationId: "operation-2",
      createdByOperationStepKey: "primary",
      createdAt: new Date("2026-01-02T00:00:00Z"),
    }],
    crops: [],
    pendingEvidence: false,
  };
  return rows as never;
}

describe("R7-7F whole-Cast history authority", () => {
  it("pairs one identity with the package from the same operation", () => {
    const rows = fixture();
    const target = resolveWholeCastRestorePoint(rows, rows.identities[0]);
    expect(target?.packageSnapshot.id).toBe("package-2");
    expect(target?.featureSelections).toHaveLength(1);
  });

  it("restores accumulated features after a later candidate replaces an earlier accepted slot asset", () => {
    const rows = fixture();
    const latestBody = {
      ...rows.assets[0],
      id: 13,
      storageUrl: "https://r2/body-with-two-features.png",
      storageKey: "models/7/body-with-two-features.png",
    };
    rows.assets.push(latestBody);
    const bodySlot = rows.slots.find(
      (slot) =>
        slot.packageSnapshotId === "package-2"
        && slot.viewAngle === "frontFull",
    );
    bodySlot.selectedAssetId = latestBody.id;
    rows.features.push({
      ...rows.features[0],
      id: "feature-2",
      createdByOperationId: "operation-3",
    });
    rows.featureVersions.push({
      ...rows.featureVersions[0],
      id: "version-2",
      featureId: "feature-2",
      acceptedCandidatePlateId: "plate-2",
      acceptedAssetId: latestBody.id,
      createdByOperationId: "operation-3",
    });
    rows.featureSelections.push({
      ...rows.featureSelections[0],
      id: "selection-2",
      featureId: "feature-2",
      featureVersionId: "version-2",
    });
    rows.plates.push({
      ...rows.plates[0],
      id: "plate-2",
      storageKey: "users/1/models/7/plate-2.webp",
      createdByOperationId: "operation-3",
    });

    const target = resolveWholeCastRestorePoint(rows, rows.identities[0]);
    expect(target?.availableSlots.map((row) => row.asset.id))
      .toEqual([11, 13]);
    expect(target?.featureSelections).toHaveLength(2);
    const current = buildPublicCastStateHistory(rows, true).restorePoints[0];
    expect(current).toMatchObject({
      selectedViewCount: 2,
      featureCount: 2,
      current: true,
      unavailableReason: "current",
    });
  });

  it("keeps an unavailable non-anchor slot missing without substituting", () => {
    const rows = fixture();
    const target = resolveWholeCastRestorePoint(rows, rows.identities[1]);
    expect(target?.availableSlots.map((row) => row.selection.viewAngle)).toEqual([
      "frontClose",
    ]);
    expect(target?.unavailableAngles).toEqual(["threeQuarter"]);
  });

  it("projects a simple public timeline without identity documents", () => {
    const history = buildPublicCastStateHistory(fixture(), true);
    expect(history).toMatchObject({
      enabled: true,
      lifecycle: "draft",
      canRestore: true,
      forkRequired: false,
    });
    expect(history.restorePoints.map((point) => ({
      id: point.restorePointId,
      current: point.current,
      available: point.available,
    }))).toEqual([
      { id: "package-2", current: true, available: false },
      { id: "package-1", current: false, available: true },
    ]);
    const serialized = JSON.stringify(history);
    expect(serialized).not.toContain("original prompt");
    expect(serialized).not.toContain("identity-1");
    expect(serialized).not.toContain("black star");
  });

  it("collapses restore audit hops into unique semantic Cast states", () => {
    const rows = fixture();
    const restoredEvidence = {
      ...rows.identities[0],
      id: "identity-3",
      sequence: 3,
      parentSnapshotId: "identity-2",
      restoredFromSnapshotId: "identity-2",
      reason: "restore",
      recipeVersion: "restore-v1",
      createdByOperationId: "operation-3",
      createdAt: new Date("2026-01-03T00:00:00Z"),
    };
    const restoredOriginal = {
      ...rows.identities[1],
      id: "identity-4",
      sequence: 4,
      parentSnapshotId: "identity-3",
      restoredFromSnapshotId: "identity-1",
      reason: "restore",
      recipeVersion: "restore-v1",
      createdByOperationId: "operation-4",
      createdAt: new Date("2026-01-04T00:00:00Z"),
    };
    const restoredOriginalAgain = {
      ...restoredOriginal,
      id: "identity-5",
      sequence: 5,
      parentSnapshotId: "identity-4",
      restoredFromSnapshotId: "identity-4",
      createdByOperationId: "operation-5",
      createdAt: new Date("2026-01-05T00:00:00Z"),
    };
    rows.identities = [
      restoredOriginalAgain,
      restoredOriginal,
      restoredEvidence,
      ...rows.identities,
    ];
    rows.packages = [
      {
        ...rows.packages[0],
        id: "package-5",
        identitySnapshotId: restoredOriginalAgain.id,
        sequence: 5,
        parentPackageSnapshotId: "package-4",
        reason: "whole_restore",
        createdByOperationId: "operation-5",
        createdAt: new Date("2026-01-05T00:00:00Z"),
      },
      {
        ...rows.packages[0],
        id: "package-4",
        identitySnapshotId: restoredOriginal.id,
        sequence: 4,
        parentPackageSnapshotId: "package-3",
        reason: "whole_restore",
        createdByOperationId: "operation-4",
        createdAt: new Date("2026-01-04T00:00:00Z"),
      },
      {
        ...rows.packages[0],
        id: "package-3",
        identitySnapshotId: restoredEvidence.id,
        sequence: 3,
        parentPackageSnapshotId: "package-2",
        reason: "whole_restore",
        createdByOperationId: "operation-3",
        createdAt: new Date("2026-01-03T00:00:00Z"),
      },
      ...rows.packages,
    ];
    rows.model.currentPackageSnapshotId = "package-5";

    const history = buildPublicCastStateHistory(rows, true);

    expect(history.restorePoints.map((point) => ({
      label: point.label,
      current: point.current,
      featureCount: point.featureCount,
      restorePointId: point.restorePointId,
    }))).toEqual([
      {
        label: "Original Cast",
        current: true,
        featureCount: 0,
        restorePointId: "package-1",
      },
      {
        label: "Evidence accepted",
        current: false,
        featureCount: 1,
        restorePointId: "package-2",
      },
    ]);
  });

  it("keeps malformed restore provenance visible but fail-closed", () => {
    const rows = fixture();
    const brokenRestore = {
      ...rows.identities[0],
      id: "identity-broken",
      sequence: 3,
      parentSnapshotId: "identity-2",
      restoredFromSnapshotId: "identity-missing",
      reason: "restore",
      recipeVersion: "restore-v1",
      createdByOperationId: "operation-broken",
      createdAt: new Date("2026-01-03T00:00:00Z"),
    };
    rows.identities = [brokenRestore, ...rows.identities];
    rows.packages = [
      {
        ...rows.packages[0],
        id: "package-broken",
        identitySnapshotId: brokenRestore.id,
        sequence: 3,
        parentPackageSnapshotId: "package-2",
        reason: "whole_restore",
        createdByOperationId: "operation-broken",
        createdAt: new Date("2026-01-03T00:00:00Z"),
      },
      ...rows.packages,
    ];

    const history = buildPublicCastStateHistory(rows, true);

    expect(history.restorePoints[0]).toMatchObject({
      label: "Evidence accepted",
      current: true,
    });
    expect(history.restorePoints.find(
      (point) => point.label === "Restored state",
    )).toMatchObject({
      current: false,
      available: false,
      unavailableReason: "pair_unavailable",
    });
  });

  it("fails feature-bearing closure when its accepted private plate is absent", () => {
    const rows = fixture();
    rows.plates = [];
    expect(resolveWholeCastRestorePoint(rows, rows.identities[0])).toBeNull();
  });

  it("fails feature-bearing closure when its accepted plate role is invalid", () => {
    const rows = fixture();
    rows.plates[0].kind = "uploaded_reference";
    expect(resolveWholeCastRestorePoint(rows, rows.identities[0])).toBeNull();
  });

  it("fails feature-bearing closure when its accepted asset was not selected", () => {
    const rows = fixture();
    rows.slots = rows.slots.filter(
      (selection: { id: string }) => selection.id !== "slot-2-body",
    );
    expect(resolveWholeCastRestorePoint(rows, rows.identities[0])).toBeNull();
  });

  it("does not expose an internal identity id for an unavailable pair", () => {
    const rows = fixture();
    rows.packages = rows.packages.filter(
      (snapshot: { id: string }) => snapshot.id !== "package-1",
    );
    const history = buildPublicCastStateHistory(rows, true);
    const unavailable = history.restorePoints.find(
      (point) => !point.current,
    );
    expect(unavailable?.restorePointId).toMatch(/^unavailable:[a-f0-9]{24}$/);
    expect(unavailable?.restorePointId).not.toContain("identity-1");
  });

  it("disables restore under pending evidence without hiding history", () => {
    const rows = fixture();
    rows.pendingEvidence = true;
    const history = buildPublicCastStateHistory(rows, true);
    expect(history.blockedByPendingEvidence).toBe(true);
    expect(history.canRestore).toBe(false);
    expect(history.restorePoints).toHaveLength(2);
    expect(history.restorePoints.every((point) => !point.available)).toBe(true);
  });
});
