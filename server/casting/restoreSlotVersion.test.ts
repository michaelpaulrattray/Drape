/**
 * D-53 as amended by §7.4 (Batch C, M13): restore is COPY-FORWARD reuse of
 * images WITHIN the current identity revision — never an identity rollback.
 * Contracts under test: restore APPENDS (never mutates backward), moves no
 * money, arrives UNPINNED with `display` role and the CURRENT revision
 * stamped, carries restoredFromAssetId provenance; cross-revision and
 * uncertain-provenance sources refuse (headshots AND sibling views); the
 * legacy fingerprint case passes both ways; a restored frontClose is never
 * selected by the anchor selector; slotVersions carries the
 * offered-only-where-compatible flag.
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
  mintModelAtomically: vi.fn(),
  deductPoints: vi.fn(),
  addCredits: vi.fn(),
}));
vi.mock("../db", () => db);

import { executeRestoreSlotVersion, getSlotVersions } from "./mintPackage";
import { buildIdentityAnchor } from "./geminiClient";
import { selectIdentityAnchor } from "./identity/anchorSelector";
import { REFUSAL_COPY } from "./identity/refusalCopy";

const MODEL = {
  id: 7,
  userId: 42,
  masterPrompt: "a person",
  technicalSchema: { subject: { sex: "female" } },
  identityRevisionId: "rev-a",
};
/** The current canon fingerprint — what legacy rows must match. */
const CANON_TEXT = buildIdentityAnchor(MODEL.masterPrompt, MODEL.technicalSchema);

// Newest-first, like getModelAssets
const ASSETS = [
  { id: 30, viewType: "sideClose", storageUrl: "https://r2/side-v3.png", resolution: "1K", storageKey: "k3", pinned: false, provenance: { inputs: [{ imageUrl: "https://r2/head.png" }], identityRevisionId: "rev-a" }, createdAt: new Date("2026-07-12T03:00:00Z") },
  { id: 20, viewType: "sideClose", storageUrl: "https://r2/side-v2.png", resolution: "1K", storageKey: "k2", pinned: true, provenance: { inputs: [{ imageUrl: "https://r2/head.png" }], identityRevisionId: "rev-a" }, createdAt: new Date("2026-07-12T02:00:00Z") },
  // Legacy row: no recorded revision, but its D-12 fingerprint matches canon
  { id: 10, viewType: "sideClose", storageUrl: "https://r2/side-v1.png", resolution: "1K", storageKey: "k1", pinned: false, provenance: { identityText: CANON_TEXT }, createdAt: new Date("2026-07-12T01:00:00Z") },
  // Cross-revision row (an earlier identity)
  { id: 8, viewType: "sideClose", storageUrl: "https://r2/side-v0.png", resolution: "1K", storageKey: "k0", pinned: false, provenance: { identityRevisionId: "rev-OLD" }, createdAt: new Date("2026-07-12T00:30:00Z") },
  // Uncertain row: no provenance at all (legacy iterate output)
  { id: 6, viewType: "sideClose", storageUrl: "https://r2/side-vX.png", resolution: "1K", storageKey: "kx", pinned: false, provenance: null, createdAt: new Date("2026-07-12T00:10:00Z") },
  { id: 5, viewType: "frontClose", storageUrl: "https://r2/head.png", resolution: "1K", storageKey: "kh", pinned: false, provenance: { identityRevisionId: "rev-a", identityRole: "anchor" }, createdAt: new Date("2026-07-12T00:00:00Z") },
  { id: 4, viewType: "frontClose", storageUrl: "https://r2/head-old.png", resolution: "1K", storageKey: "kho", pinned: false, provenance: { identityRevisionId: "rev-OLD", identityRole: "anchor" }, createdAt: new Date("2026-07-11T00:00:00Z") },
];

beforeEach(() => {
  vi.clearAllMocks();
  db.getModelById.mockResolvedValue(MODEL);
  db.getModelAssets.mockResolvedValue(ASSETS);
  db.createModelAsset.mockResolvedValue({ success: true, assetId: 99 });
});

describe("executeRestoreSlotVersion — copy-forward within the current revision (§7.4)", () => {
  it("appends a new head from a same-revision row: free, unpinned, display role, current revision", async () => {
    const result = await executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 20 });

    expect(db.createModelAsset).toHaveBeenCalledTimes(1);
    const row = db.createModelAsset.mock.calls[0][0];
    expect(row.modelId).toBe(7);
    expect(row.viewType).toBe("sideClose");
    expect(row.storageUrl).toBe("https://r2/side-v2.png");
    expect(row.pointsCost).toBe(0); // a pointer copy moves no money
    expect(row.pinned).toBe(false); // a pin marks a row, not a lineage
    expect(row.provenance).toMatchObject({
      restoredFromAssetId: 20,
      engine: "restore",
      identityRole: "display",
      identityRevisionId: "rev-a",
    });
    expect(result.assetId).toBe(99);
  });

  it("LEGACY FINGERPRINT PASS: a no-revision row whose identityText matches canon restores", async () => {
    await executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 10 });
    expect(db.createModelAsset).toHaveBeenCalledTimes(1);
  });

  it("LEGACY FINGERPRINT FAIL: a no-revision row whose identityText mismatches refuses", async () => {
    db.getModelAssets.mockResolvedValue([
      ...ASSETS.filter((a) => a.id !== 10),
      { ...ASSETS.find((a) => a.id === 10)!, provenance: { identityText: "IDENTITY CONTEXT:\nsomeone else" } },
    ]);
    await expect(
      executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 10 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.crossRevisionRestore });
    expect(db.createModelAsset).not.toHaveBeenCalled();
  });

  it("CROSS-REVISION sibling view refuses with the §7.4 copy", async () => {
    await expect(
      executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 8 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.crossRevisionRestore });
    expect(db.createModelAsset).not.toHaveBeenCalled();
  });

  it("UNCERTAIN provenance (no revision, no fingerprint) refuses — never guesses", async () => {
    await expect(
      executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 6 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.uncertainRestoreProvenance });
    expect(db.createModelAsset).not.toHaveBeenCalled();
  });

  it("CROSS-REVISION headshot refuses — restore never resurrects an earlier identity's anchor", async () => {
    await expect(
      executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "frontClose", assetId: 4 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.crossRevisionRestore });
  });

  it("a restored frontClose is DISPLAY-ONLY — the §7 anchor selector ignores it", async () => {
    // Two same-revision headshots so the older can restore over the head
    const assets = [
      { id: 51, viewType: "frontClose", storageUrl: "https://r2/head-new.png", resolution: "1K", storageKey: "k51", pinned: false, provenance: { identityRevisionId: "rev-a", identityRole: "anchor" }, createdAt: new Date("2026-07-12T05:00:00Z") },
      { id: 50, viewType: "frontClose", storageUrl: "https://r2/head-prev.png", resolution: "1K", storageKey: "k50", pinned: false, provenance: { identityRevisionId: "rev-a", identityRole: "display" }, createdAt: new Date("2026-07-12T04:00:00Z") },
    ];
    db.getModelAssets.mockResolvedValue(assets);
    await executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "frontClose", assetId: 50 });
    const row = db.createModelAsset.mock.calls[0][0];
    expect(row.provenance.identityRole).toBe("display");
    // Simulate the ledger after the restore: the restored row is newest
    const after = [
      { id: 99, viewType: "frontClose", storageUrl: "https://r2/head-prev.png", pinned: false, provenance: row.provenance, createdAt: new Date("2026-07-12T06:00:00Z") },
      ...assets,
    ];
    expect(selectIdentityAnchor(after)?.id).toBe(51); // still the true anchor
  });

  it("refuses the current head — nothing to restore", async () => {
    await expect(
      executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 30 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.createModelAsset).not.toHaveBeenCalled();
  });

  it("refuses a no-op: restoring a row whose image equals the head (drive-2 ledger pollution)", async () => {
    db.getModelAssets.mockResolvedValue([
      { id: 30, viewType: "sideClose", storageUrl: "https://r2/same.png", resolution: "1K", storageKey: "k3", pinned: false, provenance: { identityRevisionId: "rev-a" }, createdAt: new Date("2026-07-12T03:00:00Z") },
      { id: 10, viewType: "sideClose", storageUrl: "https://r2/same.png", resolution: "1K", storageKey: "k1", pinned: false, provenance: { identityRevisionId: "rev-a" }, createdAt: new Date("2026-07-12T01:00:00Z") },
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
    db.getModelById.mockResolvedValue({ ...MODEL, userId: 1 });
    await expect(
      executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("surfaces a failed insert without pretending anything changed", async () => {
    db.createModelAsset.mockResolvedValue({ success: false });
    await expect(
      executeRestoreSlotVersion({ userId: 42, modelId: 7, angle: "sideClose", assetId: 20 }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

describe("getSlotVersions — the thumb-strip's data (offered-only-where-compatible, M13)", () => {
  it("lists filled rows newest-first with the head marked and compatibility flagged", async () => {
    const result = await getSlotVersions({ userId: 42, modelId: 7, angle: "sideClose" });
    expect(result.versions.map((v) => v.assetId)).toEqual([30, 20, 10, 8, 6]);
    expect(result.versions[0].isHead).toBe(true);
    expect(result.versions[1].isHead).toBe(false);
    expect(result.versions[1].pinned).toBe(true);
    // current revision + legacy-fingerprint-match are compatible …
    expect(result.versions.find((v) => v.assetId === 30)?.revisionCompatible).toBe(true);
    expect(result.versions.find((v) => v.assetId === 10)?.revisionCompatible).toBe(true);
    // … cross-revision and uncertain provenance are NOT (never offered)
    expect(result.versions.find((v) => v.assetId === 8)?.revisionCompatible).toBe(false);
    expect(result.versions.find((v) => v.assetId === 6)?.revisionCompatible).toBe(false);
  });

  it("refuses a foreign model", async () => {
    db.getModelById.mockResolvedValue({ ...MODEL, userId: 1 });
    await expect(getSlotVersions({ userId: 42, modelId: 7, angle: "sideClose" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
