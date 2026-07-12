/**
 * D-53: the slot ledger governs generated views — restore is COPY-FORWARD.
 * Contracts under test: restore APPENDS (never mutates backward), moves no
 * money (pointsCost 0), arrives UNPINNED, carries restoredFromAssetId
 * provenance (D-12 audit chain); the current head is refused; foreign
 * models and wrong-angle rows are refused; slotVersions lists filled rows
 * newest-first with the head marked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  getModelById: vi.fn(),
  getModelAssets: vi.fn(),
  createModelAsset: vi.fn(),
  setModelAssetPinned: vi.fn(),
  createGeneration: vi.fn(),
  updateGeneration: vi.fn(),
  updateModel: vi.fn(),
  mintModel: vi.fn(),
  deductPoints: vi.fn(),
  addCredits: vi.fn(),
}));
vi.mock("../db", () => db);

import { executeRestoreSlotVersion, getSlotVersions } from "./mintPackage";

// Newest-first, like getModelAssets
const ASSETS = [
  { id: 30, viewType: "sideClose", storageUrl: "https://r2/side-v3.png", resolution: "1K", storageKey: "k3", pinned: false, provenance: { inputs: [{ imageUrl: "https://r2/head.png" }] }, createdAt: new Date("2026-07-12T03:00:00Z") },
  { id: 20, viewType: "sideClose", storageUrl: "https://r2/side-v2.png", resolution: "1K", storageKey: "k2", pinned: true, provenance: { inputs: [{ imageUrl: "https://r2/head.png" }] }, createdAt: new Date("2026-07-12T02:00:00Z") },
  { id: 10, viewType: "sideClose", storageUrl: "https://r2/side-v1.png", resolution: "1K", storageKey: "k1", pinned: false, provenance: null, createdAt: new Date("2026-07-12T01:00:00Z") },
  { id: 5, viewType: "frontClose", storageUrl: "https://r2/head.png", resolution: "1K", storageKey: "kh", pinned: false, provenance: null, createdAt: new Date("2026-07-12T00:00:00Z") },
];

beforeEach(() => {
  vi.clearAllMocks();
  db.getModelById.mockResolvedValue({ id: 7, userId: 42 });
  db.getModelAssets.mockResolvedValue(ASSETS);
  db.createModelAsset.mockResolvedValue({ success: true, assetId: 99 });
});

describe("executeRestoreSlotVersion — copy-forward (D-53)", () => {
  it("appends a new head from an old row: free, unpinned, provenance chained", async () => {
    const result = await executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 10 });

    expect(db.createModelAsset).toHaveBeenCalledTimes(1);
    const row = db.createModelAsset.mock.calls[0][0];
    expect(row.modelId).toBe(7);
    expect(row.viewType).toBe("sideClose");
    expect(row.storageUrl).toBe("https://r2/side-v1.png");
    expect(row.pointsCost).toBe(0); // a pointer copy moves no money
    expect(row.pinned).toBe(false); // a pin marks a row, not a lineage
    expect(row.provenance).toMatchObject({ restoredFromAssetId: 10, engine: "restore" });

    expect(result.assetId).toBe(99);
    expect(result.url).toBe("https://r2/side-v1.png");
  });

  it("carries the source row's recorded inputs into the restored provenance", async () => {
    await executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 20 });
    const row = db.createModelAsset.mock.calls[0][0];
    expect(row.provenance.inputs).toEqual([{ imageUrl: "https://r2/head.png" }]);
  });

  it("restoring a PINNED old row still arrives unpinned (pins never carry forward)", async () => {
    await executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 20 });
    expect(db.createModelAsset.mock.calls[0][0].pinned).toBe(false);
    // and the source row itself is untouched — restore is append-only
    expect(db.setModelAssetPinned).not.toHaveBeenCalled();
  });

  it("refuses the current head — nothing to restore", async () => {
    await expect(
      executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 30 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.createModelAsset).not.toHaveBeenCalled();
  });

  it("refuses a no-op: restoring a row whose image equals the head (drive-2 ledger pollution)", async () => {
    // v1 and the head carry the same storageUrl (e.g. a prior restore) —
    // appending again is pure ledger noise
    db.getModelAssets.mockResolvedValue([
      { id: 30, viewType: "sideClose", storageUrl: "https://r2/same.png", resolution: "1K", storageKey: "k3", pinned: false, provenance: null, createdAt: new Date("2026-07-12T03:00:00Z") },
      { id: 10, viewType: "sideClose", storageUrl: "https://r2/same.png", resolution: "1K", storageKey: "k1", pinned: false, provenance: null, createdAt: new Date("2026-07-12T01:00:00Z") },
    ]);
    await expect(
      executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 10 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.createModelAsset).not.toHaveBeenCalled();
  });

  it("refuses a row from a different angle", async () => {
    await expect(
      executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "frontFull", assetId: 10 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.createModelAsset).not.toHaveBeenCalled();
  });

  it("refuses a foreign model", async () => {
    db.getModelById.mockResolvedValue({ id: 7, userId: 1 });
    await expect(
      executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("surfaces a failed insert without pretending anything changed", async () => {
    db.createModelAsset.mockResolvedValue({ success: false });
    await expect(
      executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 10 }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

describe("getSlotVersions — the thumb-strip's data", () => {
  it("lists filled rows newest-first with the head marked", async () => {
    const result = await getSlotVersions({ userId: 42, modelId: 7, angle: "sideClose" });
    expect(result.versions.map((v) => v.assetId)).toEqual([30, 20, 10]);
    expect(result.versions[0].isHead).toBe(true);
    expect(result.versions[1].isHead).toBe(false);
    expect(result.versions[1].pinned).toBe(true);
  });

  it("refuses a foreign model", async () => {
    db.getModelById.mockResolvedValue({ id: 7, userId: 1 });
    await expect(getSlotVersions({ userId: 42, modelId: 7, angle: "sideClose" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
