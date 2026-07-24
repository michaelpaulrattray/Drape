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

import { getSlotVersions } from "./mintPackage";
import { buildIdentityAnchor } from "./geminiClient";
import { selectIdentityAnchor } from "./identity/anchorSelector";
import { REFUSAL_COPY } from "./identity/refusalCopy";
import { prepareRestoreSlotTransition } from "./restoreSlotTransition";

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

function prepare(
  angle: "frontClose" | "sideClose" | "frontFull",
  assetId: number,
  assets = ASSETS,
  model = MODEL,
) {
  return prepareRestoreSlotTransition({ userId: 42, model, assets, angle, assetId });
}

describe("prepareRestoreSlotTransition — copy-forward within the current revision (§7.4)", () => {
  it("appends a new head from a same-revision row: free, unpinned, display role, current revision", async () => {
    const result = prepare("sideClose", 20);
    const row = result.assetInsert;
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
    expect(result.url).toBe("https://r2/side-v2.png");
    expect(result.version).toBe(6);
  });

  it("LEGACY FINGERPRINT PASS: a no-revision row whose identityText matches canon restores", async () => {
    expect(() => prepare("sideClose", 10)).not.toThrow();
  });

  it("LEGACY FINGERPRINT FAIL: a no-revision row whose identityText mismatches refuses", async () => {
    const assets = [
      ...ASSETS.filter((a) => a.id !== 10),
      { ...ASSETS.find((a) => a.id === 10)!, provenance: { identityText: "IDENTITY CONTEXT:\nsomeone else" } },
    ];
    expect(() => prepare("sideClose", 10, assets)).toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.crossRevisionRestore }),
    );
  });

  it("CROSS-REVISION sibling view refuses with the §7.4 copy", async () => {
    expect(() => prepare("sideClose", 8)).toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.crossRevisionRestore }),
    );
  });

  it("UNCERTAIN provenance (no revision, no fingerprint) refuses — never guesses", async () => {
    expect(() => prepare("sideClose", 6)).toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.uncertainRestoreProvenance }),
    );
  });

  it("CROSS-REVISION headshot refuses — restore never resurrects an earlier identity's anchor", async () => {
    expect(() => prepare("frontClose", 4)).toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.crossRevisionRestore }),
    );
  });

  it("a restored frontClose is DISPLAY-ONLY — the §7 anchor selector ignores it", async () => {
    // Two same-revision headshots so the older can restore over the head
    const assets = [
      { id: 51, viewType: "frontClose", storageUrl: "https://r2/head-new.png", resolution: "1K", storageKey: "k51", pinned: false, provenance: { identityRevisionId: "rev-a", identityRole: "anchor" }, createdAt: new Date("2026-07-12T05:00:00Z") },
      { id: 50, viewType: "frontClose", storageUrl: "https://r2/head-prev.png", resolution: "1K", storageKey: "k50", pinned: false, provenance: { identityRevisionId: "rev-a", identityRole: "display" }, createdAt: new Date("2026-07-12T04:00:00Z") },
    ];
    const prepared = prepare("frontClose", 50, assets);
    const row = prepared.assetInsert;
    expect((row.provenance as { identityRole?: string }).identityRole).toBe("display");
    // Simulate the ledger after the restore: the restored row is newest
    const after = [
      { id: 99, viewType: "frontClose", storageUrl: "https://r2/head-prev.png", pinned: false, provenance: row.provenance, createdAt: new Date("2026-07-12T06:00:00Z") },
      ...assets,
    ];
    expect(selectIdentityAnchor(after)?.id).toBe(51); // still the true anchor
  });

  it("refuses the current head — nothing to restore", async () => {
    expect(() => prepare("sideClose", 30)).toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED" }),
    );
  });

  it("snapshot mode treats the package selection as current, not a newer unselected ledger row", async () => {
    const selected = ASSETS.find((candidate) => candidate.id === 20)!;
    const prepared = prepareRestoreSlotTransition({
      userId: 42,
      model: MODEL,
      assets: ASSETS,
      angle: "sideClose",
      assetId: 30,
      snapshotTruth: {
        identityText: CANON_TEXT,
        selectedAsset: selected,
      },
    });
    expect(prepared.url).toBe("https://r2/side-v3.png");
    expect(prepared.assetInsert.provenance).toMatchObject({ restoredFromAssetId: 30 });
  });

  it("snapshot mode refuses the selected package version even when a newer ledger row exists", async () => {
    const selected = ASSETS.find((candidate) => candidate.id === 20)!;
    expect(() => prepareRestoreSlotTransition({
      userId: 42,
      model: MODEL,
      assets: ASSETS,
      angle: "sideClose",
      assetId: 20,
      snapshotTruth: {
        identityText: CANON_TEXT,
        selectedAsset: selected,
      },
    })).toThrowError(expect.objectContaining({
      code: "PRECONDITION_FAILED",
      message: "That's already the current version",
    }));
  });

  it("snapshot mode uses the immutable identity text for legacy compatibility", async () => {
    const selected = ASSETS.find((candidate) => candidate.id === 20)!;
    const driftedLegacyModel = { ...MODEL, masterPrompt: "different mutable document" };
    expect(() => prepareRestoreSlotTransition({
      userId: 42,
      model: driftedLegacyModel,
      assets: ASSETS,
      angle: "sideClose",
      assetId: 10,
      snapshotTruth: {
        identityText: CANON_TEXT,
        selectedAsset: selected,
      },
    })).not.toThrow();
  });

  it("refuses a no-op: restoring a row whose image equals the head (drive-2 ledger pollution)", async () => {
    const assets = [
      { id: 30, viewType: "sideClose", storageUrl: "https://r2/same.png", resolution: "1K", storageKey: "k3", pinned: false, provenance: { identityRevisionId: "rev-a" }, createdAt: new Date("2026-07-12T03:00:00Z") },
      { id: 10, viewType: "sideClose", storageUrl: "https://r2/same.png", resolution: "1K", storageKey: "k1", pinned: false, provenance: { identityRevisionId: "rev-a" }, createdAt: new Date("2026-07-12T01:00:00Z") },
    ];
    expect(() => prepare("sideClose", 10, assets)).toThrowError(
      expect.objectContaining({ code: "PRECONDITION_FAILED" }),
    );
  });

  it("refuses a row from a different angle", async () => {
    expect(() => prepare("frontFull", 10)).toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));
  });

  it("refuses a foreign model", async () => {
    expect(() => prepare("sideClose", 10, ASSETS, { ...MODEL, userId: 1 })).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
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
