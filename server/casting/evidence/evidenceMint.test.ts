import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { CastPublicIdAllocationError } from "../castPublicId";
import {
  computeEvidenceMintPlan,
  EvidenceMintSettlementUncertainError,
  executeEvidenceMint,
} from "./evidenceMint";

const INPUT = {
  userId: 1,
  modelId: 7,
  operationId: "11111111-1111-4111-8111-111111111111",
  tier: "core" as const,
  name: "Vera",
};

function currentState(input: {
  status?: "draft" | "active";
  stale?: string[];
  missing?: string[];
} = {}) {
  const angles = [
    "frontClose",
    "threeQuarter",
    "sideClose",
    "frontFull",
    "sideFull",
    "backFull",
  ] as const;
  const assets = angles.flatMap((angle, index) =>
    input.missing?.includes(angle)
      ? []
      : [{
          id: index + 1,
          modelId: 7,
          viewType: angle,
          storageUrl: `https://r2.invalid/${angle}.png`,
          storageKey: `models/7/${angle}.png`,
          resolution: "1K",
          pointsCost: 0,
          pinned: false,
          status: null,
          provenance: {
            identityRevisionId: "revision-1",
            ...(angle === "frontClose" ? { identityRole: "anchor" } : {}),
          },
          createdAt: new Date(),
        }]
  );
  const selectedViews = assets.map((asset, index) => ({
    angle: asset.viewType,
    compatibility: input.stale?.includes(asset.viewType)
      ? "stale"
      : "current",
    selection: {
      id: `selection-${index}`,
      packageSnapshotId: "package-1",
      viewAngle: asset.viewType,
      selectedAssetId: asset.id,
      compatibility: input.stale?.includes(asset.viewType)
        ? "stale"
        : "current",
      selectionReason: "bootstrap",
      sourceSelectionId: null,
      createdAt: new Date(),
    },
    asset,
  }));
  const frontClose = assets.find((asset) => asset.viewType === "frontClose");
  return {
    authority: "snapshot",
    status: "current",
    model: {
      id: 7,
      userId: 1,
      name: "Draft",
      status: input.status ?? "draft",
      agencyId: input.status === "active" ? "KI-2345-6789-ABCD-EFGH" : null,
      mintedAt: input.status === "active" ? new Date() : null,
      identityRevisionId: "revision-1",
    },
    stateVersion: 1,
    package: { id: "package-1" },
    identity: {
      id: "identity-1",
      identityText: "identity-1",
    },
    anchor: frontClose,
    displayedHeadshot: frontClose,
    selectedViews,
    sealedPackage: null,
    sealedIdentity: null,
    ledger: { assets },
  } as never;
}

describe("progressive evidence mint planning", () => {
  it("requires only the chosen tier and leaves optional stale views for later", () => {
    const plan = computeEvidenceMintPlan({
      state: currentState({ stale: ["sideFull", "backFull"] }),
      supported: true,
      pendingEvidence: false,
    });
    expect(plan.zeroGeneration).toBe(true);
    expect(plan.tiers.core).toMatchObject({
      ready: true,
      missingAngles: [],
      staleAngles: [],
      attentionAngles: [],
    });
    expect(plan.tiers.production).toMatchObject({
      ready: false,
      staleAngles: ["sideFull", "backFull"],
    });
  });

  it("blocks when a required selected-tier view is stale or missing", () => {
    expect(computeEvidenceMintPlan({
      state: currentState({ stale: ["sideClose"] }),
      supported: true,
      pendingEvidence: false,
    }).tiers.core).toMatchObject({
      ready: false,
      staleAngles: ["sideClose"],
    });
    expect(computeEvidenceMintPlan({
      state: currentState({ missing: ["threeQuarter"] }),
      supported: true,
      pendingEvidence: false,
    }).tiers.core).toMatchObject({
      ready: false,
      missingAngles: ["threeQuarter"],
    });
  });

  it("blocks unresolved evidence and refuses to remint an active Cast", () => {
    expect(computeEvidenceMintPlan({
      state: currentState(),
      supported: true,
      pendingEvidence: true,
    }).tiers.core.ready).toBe(false);
    expect(computeEvidenceMintPlan({
      state: currentState({ status: "active" }),
      supported: true,
      pendingEvidence: false,
    }).tiers.core.ready).toBe(false);
  });

  it("publishes no internal feature ids when the graph is unsupported", () => {
    const result = computeEvidenceMintPlan({
      state: currentState(),
      supported: false,
      pendingEvidence: false,
    });
    expect(result.supported).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/revision-1|identity-1|package-1/);
  });
});

describe("evidence-aware zero-generation mint execution", () => {
  it("allocates one public id and delegates only the atomic mint commit", async () => {
    const commit = vi.fn().mockResolvedValue({
      result: {
        agencyId: "KI-2345-6789-ABCD-EFGH",
        minted: true,
        tier: "core",
        generated: [],
        failedAngles: [],
      },
    });
    const allocate = vi.fn(async (callback) =>
      callback("KI-2345-6789-ABCD-EFGH")
    );

    await expect(executeEvidenceMint({ commit, allocate }, INPUT)).resolves
      .toEqual({
        agencyId: "KI-2345-6789-ABCD-EFGH",
        minted: true,
        tier: "core",
        generated: [],
        failed: [],
      });
    expect(allocate).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith({
      ...INPUT,
      agencyId: "KI-2345-6789-ABCD-EFGH",
    });
  });

  it("refuses a missing name before allocating or committing", async () => {
    const commit = vi.fn();
    const allocate = vi.fn();
    await expect(executeEvidenceMint(
      { commit, allocate },
      { ...INPUT, name: " " },
    )).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(allocate).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("preserves deterministic precondition refusals", async () => {
    const refusal = new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "The selected package changed.",
    });
    const allocate = vi.fn(async (callback) =>
      callback("KI-2345-6789-ABCD-EFGH")
    );
    await expect(executeEvidenceMint({
      allocate,
      commit: vi.fn().mockRejectedValue(refusal),
    }, INPUT)).rejects.toBe(refusal);
  });

  it("maps exhausted public-id allocation to fixed non-secret copy", async () => {
    await expect(executeEvidenceMint({
      allocate: vi.fn().mockRejectedValue(new CastPublicIdAllocationError()),
    }, INPUT)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "A unique Cast ID could not be allocated",
    });
  });

  it("marks an unknown commit outcome uncertain for deterministic recovery", async () => {
    const privateFailure = new Error("private database connection detail");
    await expect(executeEvidenceMint({
      allocate: vi.fn().mockRejectedValue(privateFailure),
    }, INPUT)).rejects.toSatisfy((error: unknown) =>
      error instanceof EvidenceMintSettlementUncertainError
      && error.cause === privateFailure
      && !error.message.includes("private database")
    );
  });
});
