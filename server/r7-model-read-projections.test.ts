import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db/models", () => ({
  getUserDraftModels: vi.fn(),
  getUserDraftModelsWithThumbnail: vi.fn(),
  getUserMintedModels: vi.fn(),
  getUserMintedModelsWithThumbnail: vi.fn(),
}));

vi.mock("./casting/effectiveCastRead", () => ({
  resolveEffectiveCastStatesForRead: vi.fn(),
}));

import {
  getUserDraftModels,
  getUserDraftModelsWithThumbnail,
  getUserMintedModels,
  getUserMintedModelsWithThumbnail,
} from "./db/models";
import { resolveEffectiveCastStatesForRead } from "./casting/effectiveCastRead";
import {
  getUserDraftModelsWithThumbnailForRead,
  getUserMintedModelsWithThumbnailForRead,
  projectEffectiveModelForClient,
} from "./casting/modelReadProjections";
import { buildHistoryFromAssets } from "../client/src/features/casting/utils/buildHistoryFromAssets";

const mutableModel = {
  id: 7,
  userId: 1,
  name: "Editorial Cast",
  status: "active",
  agencyId: "MOD-26-EXAMPLE",
  masterPrompt: "mutable drift",
  technicalSchema: { mutable: true },
  preferences: { hair: "mutable" },
  currentPackageSnapshotId: "package-current",
  stateVersion: 4,
  identityRevisionId: "revision-current",
  sealedIdentitySnapshotId: "identity-sealed",
  sealedPackageSnapshotId: "package-sealed",
  mintedAt: new Date("2026-01-02"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-03"),
};

function asset(id: number, viewType: "frontClose" | "frontFull", storageUrl: string) {
  return {
    id,
    modelId: 7,
    viewType,
    storageUrl,
    storageKey: `models/7/${id}.png`,
    pinned: false,
    status: null,
    provenance: null,
    createdAt: new Date(),
  };
}

const selectedFront = asset(11, "frontClose", "https://images.example/selected-front.png");
const selectedFull = asset(12, "frontFull", "https://images.example/selected-full.png");
const newerUnselected = asset(99, "frontFull", "https://images.example/newer-full.png");

function currentState(status: "active" | "draft" = "active") {
  const model = { ...mutableModel, status };
  return {
    authority: "snapshot",
    status: "current",
    model,
    stateVersion: 4,
    package: { id: "package-current", modelId: 7 },
    identity: {
      id: "identity-current",
      modelId: 7,
      masterPrompt: "immutable prompt",
      technicalSchema: { immutable: true },
      preferences: { hair: "immutable" },
    },
    anchor: selectedFront,
    displayedHeadshot: selectedFront,
    selectedViews: [
      {
        angle: "frontClose",
        compatibility: "current",
        selection: { id: "slot-front", selectedAssetId: 11 },
        asset: selectedFront,
      },
      {
        angle: "frontFull",
        compatibility: "current",
        selection: { id: "slot-full", selectedAssetId: 12 },
        asset: selectedFull,
      },
    ],
    sealedPackage: null,
    sealedIdentity: null,
    ledger: { assets: [newerUnselected, selectedFull, selectedFront] },
  };
}

beforeEach(() => {
  vi.mocked(getUserDraftModels).mockReset().mockResolvedValue([]);
  vi.mocked(getUserDraftModelsWithThumbnail).mockReset().mockResolvedValue([]);
  vi.mocked(getUserMintedModels).mockReset().mockResolvedValue([]);
  vi.mocked(getUserMintedModelsWithThumbnail).mockReset().mockResolvedValue([]);
  vi.mocked(resolveEffectiveCastStatesForRead).mockReset();
});

describe("snapshot thumbnail projections", () => {
  it("keeps the minted gallery's frontFull preference over selected slots", async () => {
    vi.mocked(getUserMintedModels).mockResolvedValue([{
      id: 7,
      name: "Editorial Cast",
      status: "active",
      agencyId: "MOD-26-EXAMPLE",
      masterPrompt: "mutable drift",
      mintedAt: mutableModel.mintedAt,
      createdAt: mutableModel.createdAt,
      updatedAt: mutableModel.updatedAt,
    }] as never);
    vi.mocked(resolveEffectiveCastStatesForRead).mockResolvedValue(
      new Map([[7, currentState() as never]]),
    );

    const result = await getUserMintedModelsWithThumbnailForRead({
      userId: 1,
      limit: 20,
      readMode: "snapshot",
    });

    expect(result).toEqual([expect.objectContaining({
      id: 7,
      thumbnailUrl: selectedFull.storageUrl,
      masterPrompt: "immutable prompt",
      assetCount: 2,
    })]);
    expect(getUserMintedModelsWithThumbnail).not.toHaveBeenCalled();
  });

  it("uses selected frontClose for draft cards and immutable documents", async () => {
    vi.mocked(getUserDraftModels).mockResolvedValue([{
      id: 7,
      name: "Editorial Cast",
      masterPrompt: "mutable drift",
      technicalSchema: { mutable: true },
      preferences: { hair: "mutable" },
      createdAt: mutableModel.createdAt,
      updatedAt: mutableModel.updatedAt,
    }] as never);
    vi.mocked(resolveEffectiveCastStatesForRead).mockResolvedValue(
      new Map([[7, currentState("draft") as never]]),
    );

    const result = await getUserDraftModelsWithThumbnailForRead({
      userId: 1,
      limit: 4,
      readMode: "snapshot",
    });

    expect(result).toEqual([expect.objectContaining({
      thumbnailUrl: selectedFront.storageUrl,
      masterPrompt: "immutable prompt",
      technicalSchema: { immutable: true },
      preferences: { hair: "immutable" },
      assetCount: 2,
    })]);
    expect(getUserDraftModelsWithThumbnail).not.toHaveBeenCalled();
  });

  it("preserves the exact R6 return and never resolves snapshots when scope is off", async () => {
    const rows = [{ id: 7, thumbnailUrl: newerUnselected.storageUrl }];
    vi.mocked(getUserMintedModelsWithThumbnail).mockResolvedValue(rows as never);

    const result = await getUserMintedModelsWithThumbnailForRead({
      userId: 1,
      limit: 20,
      readMode: "r6",
    });

    expect(result).toBe(rows);
    expect(resolveEffectiveCastStatesForRead).not.toHaveBeenCalled();
  });
});

describe("selected package hydration", () => {
  it("exposes selected presentation as a minimal public DTO", () => {
    const projected = projectEffectiveModelForClient(currentState() as never);

    expect(projected.selectedAssets).toEqual([
      {
        id: selectedFront.id,
        viewType: selectedFront.viewType,
        storageUrl: selectedFront.storageUrl,
      },
      {
        id: selectedFull.id,
        viewType: selectedFull.viewType,
        storageUrl: selectedFull.storageUrl,
      },
    ]);
    expect(projected.selectedAssets[0]).not.toHaveProperty("storageKey");
    expect(projected.selectedAssets[0]).not.toHaveProperty("provenance");
  });

  it("keeps the full ledger history but makes a restored package the current state", () => {
    const result = buildHistoryFromAssets(
      [newerUnselected, selectedFull, selectedFront],
      [selectedFront, selectedFull],
    );

    expect(result.currentAssets.map((row) => row.id)).toEqual([11, 12]);
    expect(result.history.at(-1)?.map((row) => row.id)).toEqual([11, 12]);
    expect(result.history.flat().map((row) => row.id)).toContain(99);
  });

  it("keeps legacy newest-ledger hydration unchanged without selectedAssets", () => {
    const result = buildHistoryFromAssets([
      newerUnselected,
      selectedFull,
      selectedFront,
    ]);
    expect(result.currentAssets.map((row) => row.id)).toEqual([99, 11]);
  });

  it("does not launder historical ledger rows into a snapshot-headless current state", () => {
    const result = buildHistoryFromAssets(
      [newerUnselected, selectedFront],
      [],
    );
    expect(result.currentAssets).toEqual([]);
    expect(result.historyIndex).toBe(-1);
  });
});
