import { describe, expect, it } from "vitest";
import type { SnapshotShadowReport } from "./snapshotShadow";
import {
  parseSnapshotShadowAuditArgs,
  summarizeSnapshotShadowReports,
} from "./snapshotShadowAudit";

function report(input: Partial<SnapshotShadowReport> & Pick<SnapshotShadowReport, "modelId">): SnapshotShadowReport {
  return {
    parity: true,
    headState: "current",
    stateVersion: 1,
    minted: false,
    currentPackageSnapshotId: "11111111-1111-4111-8111-111111111111",
    currentIdentitySnapshotId: "22222222-2222-4222-8222-222222222222",
    sealedIdentitySnapshotId: null,
    sealedPackageSnapshotId: null,
    legacyIdentity: { hash: "a".repeat(64), anchorAssetId: 1 },
    snapshotIdentity: { hash: "a".repeat(64), anchorAssetId: 1 },
    legacyPackage: { hash: "b".repeat(64), displayedHeadshotAssetId: 1, selectedSlotCount: 2 },
    snapshotPackage: { hash: "b".repeat(64), displayedHeadshotAssetId: 1, selectedSlotCount: 2 },
    mismatchKinds: [],
    ...input,
  };
}

describe("R7-7A4 snapshot shadow cohort audit", () => {
  it("requires an explicit database, app identity and bounded cohort selector", () => {
    expect(() => parseSnapshotShadowAuditArgs([])).toThrow("--database-url is required");
    expect(() => parseSnapshotShadowAuditArgs([
      "--database-url", "mysql://user:pass@example.test/drape",
      "--app-id", "drape-local",
    ])).toThrow("full-database scans are refused");
    expect(() => parseSnapshotShadowAuditArgs([
      "--database-url", "postgres://example.test/drape",
      "--app-id", "drape-local",
      "--model-id", "1",
    ])).toThrow("must use mysql:");
  });

  it("deduplicates model selectors and refuses production without the explicit read-only flag", () => {
    const base = [
      "--database-url", "mysql://user:pass@example.test/drape",
      "--app-id", "drape-production",
      "--user-id", "7",
      "--model-id", "9",
      "--model-id", "9",
      "--model-id", "3",
    ];
    expect(() => parseSnapshotShadowAuditArgs(base)).toThrow(
      "Production snapshot audit requires --allow-production-read-only",
    );
    expect(parseSnapshotShadowAuditArgs([...base, "--allow-production-read-only"])).toEqual({
      databaseUrl: "mysql://user:pass@example.test/drape",
      appId: "drape-production",
      userId: 7,
      modelIds: [3, 9],
      allowProductionReadOnly: true,
    });
  });

  it("maps identity, package and seal mismatches to the affected reader surfaces", () => {
    const result = summarizeSnapshotShadowReports([
      report({
        modelId: 3,
        parity: false,
        mismatchKinds: ["identity_documents", "slot_asset", "mint_seal_missing"],
      }),
    ]);
    expect(result.models[0].affectedSurfaces).toEqual([
      "identity_profile",
      "casting_package_state",
      "casting_mint_plan",
      "casting_refresh_plan",
      "casting_export",
      "board_library",
      "models_registry",
      "mint_seal",
    ]);
    expect(result.summary.affectedSurfaces.identity_profile).toBe(1);
    expect(result.summary.affectedSurfaces.mint_seal).toBe(1);
  });

  it.each(["slot_compatibility", "displayed_headshot"] as const)(
    "marks mint planning affected by %s drift",
    (mismatch) => {
      const result = summarizeSnapshotShadowReports([
        report({ modelId: 3, parity: false, mismatchKinds: [mismatch] }),
      ]);
      expect(result.models[0].affectedSurfaces).toContain("casting_mint_plan");
    },
  );

  it("sorts models and produces deterministic zero-filled aggregate counts", () => {
    const result = summarizeSnapshotShadowReports([
      report({ modelId: 8 }),
      report({
        modelId: 2,
        parity: false,
        headState: "invalid",
        mismatchKinds: ["snapshot_selection_invalid"],
      }),
      report({
        modelId: 5,
        headState: "headless",
        stateVersion: 0,
        currentPackageSnapshotId: null,
        currentIdentitySnapshotId: null,
        legacyIdentity: { hash: null, anchorAssetId: null },
        snapshotIdentity: { hash: null, anchorAssetId: null },
        legacyPackage: { hash: null, displayedHeadshotAssetId: null, selectedSlotCount: 0 },
        snapshotPackage: { hash: null, displayedHeadshotAssetId: null, selectedSlotCount: 0 },
      }),
    ]);
    expect(result.models.map((model) => model.modelId)).toEqual([2, 5, 8]);
    expect(result.summary).toMatchObject({
      auditedModels: 3,
      parityModels: 2,
      mismatchedModels: 1,
      headStates: { headless: 1, current: 1, invalid: 1 },
    });
    expect(result.summary.mismatchKinds.snapshot_selection_invalid).toBe(1);
    expect(result.summary.mismatchKinds.identity_documents).toBe(0);
  });
});
