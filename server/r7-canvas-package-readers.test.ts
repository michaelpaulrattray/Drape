import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    addBoardItem: vi.fn().mockResolvedValue(77),
    addBoardItemVersion: vi.fn().mockResolvedValue(undefined),
    fillEmptyCastNodeWithVersionIn: vi.fn().mockResolvedValue("filled"),
    getBoardById: vi.fn(),
    getBoardItemById: vi.fn(),
    getBoardItems: vi.fn().mockResolvedValue([]),
    getModelAssets: vi.fn().mockResolvedValue([]),
    getModelById: vi.fn(),
    withTransaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({})),
  };
});

vi.mock("./db/boardEdges", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/boardEdges")>();
  return {
    ...actual,
    addBoardEdge: vi.fn().mockResolvedValue(88),
    getEdgesFrom: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("./casting/effectiveCastRead", () => ({
  resolveEffectiveCastStateForRead: vi.fn(),
}));

vi.mock("./casting/snapshotReadScope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/snapshotReadScope")>();
  return {
    ...actual,
    captureSnapshotReadMode: vi.fn().mockReturnValue("snapshot"),
  };
});

import {
  addBoardItem,
  addBoardItemVersion,
  fillEmptyCastNodeWithVersionIn,
  getBoardById,
  getBoardItemById,
  getBoardItems,
  getModelAssets,
  getModelById,
} from "./db";
import { addBoardEdge, getEdgesFrom } from "./db/boardEdges";
import { resolveEffectiveCastStateForRead } from "./casting/effectiveCastRead";
import { captureSnapshotReadMode } from "./casting/snapshotReadScope";
import {
  executeFillFromLibrary,
  executePopOutView,
  resolveCanvasPackageView,
} from "./lib/boardOps";
import { appRouter } from "./routers";

const model = {
  id: 7,
  userId: 1,
  name: "Selected Cast",
  status: "draft",
  agencyId: null,
  mintedAt: null,
  deletedAt: null,
  masterPrompt: "mutable prompt",
  technicalSchema: {},
  preferences: {},
  currentPackageSnapshotId: "package-current",
  stateVersion: 2,
  sealedIdentitySnapshotId: null,
  sealedPackageSnapshotId: null,
  identityRevisionId: "revision-current",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const selectedFront = {
  id: 41,
  modelId: 7,
  viewType: "frontClose",
  storageUrl: "https://images.example/selected-front.png",
  storageKey: "models/7/selected-front.png",
  pinned: false,
  status: null,
  provenance: { engine: "snapshot-engine" },
  createdAt: new Date("2026-01-01"),
};

const selectedSide = {
  id: 42,
  modelId: 7,
  viewType: "sideClose",
  storageUrl: "https://images.example/selected-side.png",
  storageKey: "models/7/selected-side.png",
  pinned: false,
  status: null,
  provenance: { engine: "snapshot-engine" },
  createdAt: new Date("2026-01-01"),
};

const newerUnselectedSide = {
  ...selectedSide,
  id: 99,
  storageUrl: "https://images.example/newer-unselected-side.png",
  storageKey: "models/7/newer-unselected-side.png",
  createdAt: new Date("2026-02-01"),
};

function currentState(selectedViews: Array<{
  angle: "frontClose" | "sideClose";
  asset: typeof selectedFront;
}>) {
  return {
    authority: "snapshot",
    status: "current",
    model,
    stateVersion: 2,
    package: { id: "package-current", modelId: 7 },
    identity: { id: "identity-current", modelId: 7 },
    anchor: selectedFront,
    displayedHeadshot: selectedFront,
    selectedViews: selectedViews.map((view, index) => ({
      ...view,
      compatibility: "current",
      selection: {
        id: `selection-${index}`,
        packageSnapshotId: "package-current",
        selectedAssetId: view.asset.id,
        viewAngle: view.angle,
        compatibility: "current",
      },
    })),
    sealedPackage: null,
    sealedIdentity: null,
    ledger: { assets: [newerUnselectedSide, selectedSide, selectedFront] },
  };
}

const rootItem = {
  id: 11,
  boardId: 3,
  deletedAt: null,
  kind: "cast_config",
  label: "Canvas Cast",
  imageUrl: selectedFront.storageUrl,
  imageKey: null,
  positionX: 100,
  positionY: 200,
  width: 280,
  height: 420,
  sourceModelId: 7,
  metadata: {
    provenance: {
      type: "library_cast",
      modelId: 7,
      viewAngle: "frontClose",
    },
  },
};

function authCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "canvas-package-reader",
      email: "canvas@example.com",
      name: "Canvas Reader",
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as NonNullable<TrpcContext["user"]>,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.mocked(addBoardItem).mockReset().mockResolvedValue(77);
  vi.mocked(addBoardItemVersion).mockReset().mockResolvedValue(undefined);
  vi.mocked(fillEmptyCastNodeWithVersionIn).mockReset().mockResolvedValue("filled");
  vi.mocked(getBoardById).mockReset().mockResolvedValue({
    id: 3,
    userId: 1,
    status: "active",
  } as never);
  vi.mocked(getBoardItemById).mockReset().mockResolvedValue(rootItem as never);
  vi.mocked(getBoardItems).mockReset().mockResolvedValue([rootItem] as never);
  vi.mocked(getModelAssets).mockReset().mockResolvedValue([]);
  vi.mocked(getModelById).mockReset();
  vi.mocked(addBoardEdge).mockReset().mockResolvedValue(88);
  vi.mocked(getEdgesFrom).mockReset().mockResolvedValue([]);
  vi.mocked(resolveEffectiveCastStateForRead).mockReset();
  vi.mocked(captureSnapshotReadMode).mockReset().mockReturnValue("snapshot");
});

describe("R7-7B3 Canvas package readers", () => {
  it("resolves only the explicitly selected snapshot asset, never a newer ledger row", async () => {
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValue(
      currentState([
        { angle: "frontClose", asset: selectedFront },
        { angle: "sideClose", asset: selectedSide },
      ]) as never,
    );

    const result = await resolveCanvasPackageView({
      userId: 1,
      modelId: 7,
      angle: "sideClose",
      readMode: "snapshot",
      r6Selection: "filled_angle",
    });

    expect(result.asset?.id).toBe(selectedSide.id);
    expect(result.asset?.storageUrl).toBe(selectedSide.storageUrl);
    expect(getModelById).not.toHaveBeenCalled();
    expect(getModelAssets).not.toHaveBeenCalled();
  });

  it("fills an empty Cast node from the selected frontClose", async () => {
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValue(
      currentState([{ angle: "frontClose", asset: selectedFront }]) as never,
    );

    const result = await executeFillFromLibrary({
      userId: 1,
      itemId: 11,
      modelId: 7,
      readMode: "snapshot",
    });

    expect(result.imageUrl).toBe(selectedFront.storageUrl);
    expect(fillEmptyCastNodeWithVersionIn).toHaveBeenCalledOnce();
    expect(getModelById).not.toHaveBeenCalled();
    expect(getModelAssets).not.toHaveBeenCalled();
  });

  it("captures the mode at the fill route and rejects client authority fields", async () => {
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValue(
      currentState([{ angle: "frontClose", asset: selectedFront }]) as never,
    );
    const caller = appRouter.createCaller(authCtx());

    const result = await caller.boardOps.fillFromLibrary({
      boardId: 3,
      itemId: 11,
      modelId: 7,
    });

    expect(result.imageUrl).toBe(selectedFront.storageUrl);
    expect(captureSnapshotReadMode).toHaveBeenCalledTimes(1);
    expect(captureSnapshotReadMode).toHaveBeenCalledWith(1);
    await expect(caller.boardOps.fillFromLibrary({
      boardId: 3,
      itemId: 11,
      modelId: 7,
      readMode: "r6",
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("pops out the selected package view and ignores a newer unselected image", async () => {
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValue(
      currentState([
        { angle: "frontClose", asset: selectedFront },
        { angle: "sideClose", asset: selectedSide },
      ]) as never,
    );

    const result = await executePopOutView({
      userId: 1,
      boardId: 3,
      itemId: 11,
      angle: "sideClose",
      readMode: "snapshot",
    });

    expect(result.imageUrl).toBe(selectedSide.storageUrl);
    expect(addBoardItem).toHaveBeenCalledWith(expect.objectContaining({
      imageUrl: selectedSide.storageUrl,
      sourceModelId: 7,
      metadata: expect.objectContaining({
        provenance: expect.objectContaining({
          type: "cast_view",
          viewAngle: "sideClose",
          inputs: [{ itemId: 11, imageUrl: selectedSide.storageUrl }],
        }),
      }),
    }));
    expect(addBoardItemVersion).toHaveBeenCalledWith(expect.objectContaining({
      imageUrl: selectedSide.storageUrl,
    }));
    expect(addBoardEdge).toHaveBeenCalledOnce();
    expect(getModelById).not.toHaveBeenCalled();
    expect(getModelAssets).not.toHaveBeenCalled();
  });

  it("preserves the historical R6 first-row fallback for Library fill only", async () => {
    vi.mocked(getModelById).mockResolvedValue(model as never);
    vi.mocked(getModelAssets).mockResolvedValue([selectedSide] as never);

    const result = await resolveCanvasPackageView({
      userId: 1,
      modelId: 7,
      angle: "frontClose",
      readMode: "r6",
      r6Selection: "fill_front_close",
    });

    expect(result.asset?.id).toBe(selectedSide.id);
    expect(resolveEffectiveCastStateForRead).not.toHaveBeenCalled();
  });

  it("preserves the R6 pop-out rule that skips an empty failure marker", async () => {
    vi.mocked(getModelById).mockResolvedValue(model as never);
    vi.mocked(getModelAssets).mockResolvedValue([
      { ...newerUnselectedSide, storageUrl: "", status: { state: "failed" } },
      selectedSide,
    ] as never);

    const result = await resolveCanvasPackageView({
      userId: 1,
      modelId: 7,
      angle: "sideClose",
      readMode: "r6",
      r6Selection: "filled_angle",
    });

    expect(result.asset?.id).toBe(selectedSide.id);
    expect(resolveEffectiveCastStateForRead).not.toHaveBeenCalled();
  });

  it("refuses a headless snapshot without falling back to the ledger", async () => {
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValue({
      authority: "snapshot",
      status: "headless",
      model: { ...model, currentPackageSnapshotId: null, stateVersion: 0 },
      stateVersion: 0,
      package: null,
      identity: null,
      anchor: null,
      displayedHeadshot: null,
      selectedViews: [],
      sealedPackage: null,
      sealedIdentity: null,
      ledger: { assets: [selectedFront] },
    } as never);

    await expect(executeFillFromLibrary({
      userId: 1,
      itemId: 11,
      modelId: 7,
      readMode: "snapshot",
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "This model has no canonical imagery yet",
    });
    expect(fillEmptyCastNodeWithVersionIn).not.toHaveBeenCalled();
    expect(getModelAssets).not.toHaveBeenCalled();
  });
});
