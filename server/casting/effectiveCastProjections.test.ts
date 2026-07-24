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
  buildEffectiveCastState,
  type EffectiveCastStateRows,
} from "./effectiveCastState";
import {
  computeEffectivePackageSlots,
  planMintPackageFromEffectiveState,
} from "./mintPackage";
import { computeRefreshPlan } from "./refreshSlots";

const now = new Date("2026-07-24T00:00:00.000Z");

function asset(input: {
  id: number;
  angle: ModelAsset["viewType"];
  role?: "anchor" | "display";
  url?: string;
  pinned?: boolean;
  status?: unknown;
}): ModelAsset {
  return {
    id: input.id,
    modelId: 10,
    viewType: input.angle,
    resolution: "1K",
    storageUrl: input.url ?? `https://example.invalid/${input.id}.png`,
    storageKey: input.url === "" ? null : `models/10/${input.id}.png`,
    pointsCost: 0,
    pinned: input.pinned ?? false,
    status: input.status ?? null,
    provenance: {
      ...(input.role ? { identityRole: input.role } : {}),
      identityRevisionId: "revision-1",
    },
    createdAt: now,
  };
}

function currentRows(): EffectiveCastStateRows {
  const packageId = randomUUID();
  const identityId = randomUUID();
  const identityText = "snapshot identity";
  const model = {
    id: 10,
    userId: 1,
    name: "Projection Cast",
    agencyId: null,
    masterPrompt: "legacy text must not become snapshot authority",
    technicalSchema: {},
    preferences: {},
    status: "draft",
    identityRevisionId: "revision-1",
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
    masterPrompt: "snapshot prompt",
    technicalSchema: {},
    preferences: {},
    identityText,
    identityTextHash: createHash("sha256").update(identityText).digest("hex"),
    anchorAssetId: 1,
    recipeVersion: "r7-bootstrap-v1",
    createdByOperationId: null,
    createdAt: now,
  } as ModelIdentitySnapshot;
  const selected = [
    ["frontClose", 2, "current"],
    ["sideClose", 3, "stale"],
    ["threeQuarter", 6, "current"],
    ["frontFull", 7, "current"],
    ["sideFull", 8, "current"],
    ["backFull", 9, "current"],
  ] as const;
  const currentSlots = selected.map(([viewAngle, selectedAssetId, compatibility]) => ({
    id: randomUUID(),
    packageSnapshotId: packageId,
    viewAngle,
    selectedAssetId,
    compatibility,
    selectionReason: selectedAssetId === 6 ? "restored" : "bootstrap",
    sourceSelectionId: selectedAssetId === 6 ? randomUUID() : null,
    createdAt: now,
  })) as ModelPackageSnapshotSlot[];
  return {
    model,
    // Newest-first. id 4 is deliberately newer than the selected side id 3.
    // The failed marker is unselected and carries the ledger refund truth.
    assets: [
      asset({
        id: 10,
        angle: "backFull",
        url: "",
        status: {
          state: "failed",
          reason: "Back view did not pass",
          refunded: 17,
          refundReference: "op:test:charge:slot:backFull",
          at: now.toISOString(),
        },
      }),
      asset({ id: 4, angle: "sideClose" }),
      asset({ id: 3, angle: "sideClose", pinned: true }),
      asset({ id: 9, angle: "backFull" }),
      asset({ id: 8, angle: "sideFull" }),
      asset({ id: 7, angle: "frontFull" }),
      asset({ id: 6, angle: "threeQuarter" }),
      asset({ id: 2, angle: "frontClose", role: "display" }),
      asset({ id: 1, angle: "frontClose", role: "anchor" }),
    ],
    currentPackage,
    currentIdentity,
    currentSlots,
    sealedPackage: null,
    sealedIdentity: null,
  };
}

describe("R7-7B2 effective Cast projections", () => {
  it("projects all six explicit slots and keeps ledger history separate", () => {
    const state = buildEffectiveCastState(currentRows());
    const slots = computeEffectivePackageSlots(state);
    expect(slots.map((slot) => slot.angle)).toEqual([
      "frontClose",
      "threeQuarter",
      "sideClose",
      "frontFull",
      "sideFull",
      "backFull",
    ]);
    expect(slots.find((slot) => slot.angle === "sideClose")).toMatchObject({
      url: "https://example.invalid/3.png",
      pinned: true,
      stale: true,
      version: 2,
      failed: null,
    });
    expect(slots.find((slot) => slot.angle === "threeQuarter")).toMatchObject({
      url: "https://example.invalid/6.png",
      stale: false,
      version: 1,
    });
    // The selected filled back view wins presentation; the newer failed
    // attempt remains ledger evidence and never becomes the selection.
    expect(slots.find((slot) => slot.angle === "backFull")).toMatchObject({
      url: "https://example.invalid/9.png",
      filled: true,
      failed: null,
    });
  });

  it("runs all three mint tiers through the shared integrity law", () => {
    const state = buildEffectiveCastState(currentRows());
    const plan = planMintPackageFromEffectiveState(state);
    expect(Object.keys(plan.tiers)).toEqual(["draft", "core", "production"]);
    expect(plan.hasHeadshot).toBe(true);
    expect(plan.tiers.draft.cost).toBe(0);
    expect(plan.tiers.draft.missing).toEqual([]);
    expect(plan.integrity.draft.ok).toBe(true);
    expect(plan.integrity.core.tierViews.find((view) => view.angle === "sideClose"))
      .toMatchObject({ present: true, ok: false, reason: "pinned_stale" });
    expect(plan.integrity.production.ok).toBe(false);
  });

  it("derives six-angle refresh truth from selected slots without spending", () => {
    const state = buildEffectiveCastState(currentRows());
    const plan = computeRefreshPlan(computeEffectivePackageSlots(state));
    expect(plan.slots).toHaveLength(6);
    expect(plan.slots.find((slot) => slot.angle === "frontClose")?.refusal)
      .toBe("identity_anchor");
    expect(plan.slots.find((slot) => slot.angle === "sideClose")?.refusal)
      .toBe("pinned");
    expect(plan.refreshable).toEqual([
      "threeQuarter",
      "frontFull",
      "sideFull",
      "backFull",
    ]);
  });

  it("keeps a genuinely headless draft empty without inventing selections", () => {
    const rows = currentRows();
    rows.model = {
      ...rows.model,
      currentPackageSnapshotId: null,
      stateVersion: 0,
    };
    rows.assets = [
      asset({
        id: 10,
        angle: "backFull",
        url: "",
        status: { state: "failed", reason: "failed", refunded: 17, at: now.toISOString() },
      }),
    ];
    rows.currentPackage = null;
    rows.currentIdentity = null;
    rows.currentSlots = [];
    const state = buildEffectiveCastState(rows);
    const slots = computeEffectivePackageSlots(state);
    expect(slots.every((slot) => !slot.filled && slot.url === null && slot.version === 0))
      .toBe(true);
    expect(slots.find((slot) => slot.angle === "backFull")?.failed)
      .toMatchObject({ refunded: 17 });
    const mint = planMintPackageFromEffectiveState(state);
    expect(mint.hasHeadshot).toBe(false);
    expect(mint.integrity.draft.anchor.ok).toBe(false);
  });
});
