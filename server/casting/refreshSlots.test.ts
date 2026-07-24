/**
 * computeRefreshPlan — R5's per-tile refresh, pure layer.
 * Contracts under test: the headshot is ALWAYS refused (it IS the minted
 * identity, D-43); pinned slots are refused (accepted-final, D-21);
 * never-attempted slots are upgrades, not refreshes — but a failed-marker
 * slot IS refreshable (the retry path); costs derive from CREDIT_COSTS
 * through slotCost (D-15) and total only over the refreshable set.
 */
import { describe, it, expect } from "vitest";
import {
  computeRefreshPlan,
  snapshotRefreshExecutionAuthority,
} from "./refreshSlots";
import { computePackageSlots, slotCost } from "./mintPackage";
import { CREDIT_COSTS } from "./aiService";

// Assets arrive newest-first (getModelAssets order)
const filled = (viewType: string, extra: Record<string, unknown> = {}) => ({
  viewType,
  storageUrl: `https://r2/${viewType}.png`,
  ...extra,
});
const failedMarker = (viewType: string) => ({
  viewType,
  storageUrl: "",
  status: { state: "failed", reason: "identity mismatch", refunded: 300, at: "2026-07-12T00:00:00Z" },
});

const corePackage = () =>
  computePackageSlots([
    filled("frontClose"),
    filled("sideClose"),
    filled("threeQuarter"),
    filled("frontFull"),
  ]);

describe("computeRefreshPlan — structural refusals", () => {
  it("ALWAYS refuses the headshot — it is the identity anchor (D-43)", () => {
    const plan = computeRefreshPlan(corePackage());
    const head = plan.slots.find((s) => s.angle === "frontClose")!;
    expect(head.refusal).toBe("identity_anchor");
    expect(plan.refreshable).not.toContain("frontClose");
    // Even when explicitly requested
    const requested = computeRefreshPlan(corePackage(), ["frontClose"]);
    expect(requested.refreshable).toEqual([]);
    expect(requested.totalCost).toBe(0);
  });

  it("refuses pinned slots — accepted-final work is exempt from refresh", () => {
    const slots = computePackageSlots([
      filled("frontClose"),
      filled("sideClose", { pinned: true }),
      filled("frontFull"),
    ]);
    const plan = computeRefreshPlan(slots);
    expect(plan.slots.find((s) => s.angle === "sideClose")!.refusal).toBe("pinned");
    expect(plan.refreshable).toEqual(["frontFull"]);
  });

  it("refuses never-attempted slots — those are upgrades, owned by the mint gate", () => {
    const plan = computeRefreshPlan(corePackage());
    expect(plan.slots.find((s) => s.angle === "backFull")!.refusal).toBe("unfilled");
    expect(plan.slots.find((s) => s.angle === "sideFull")!.refusal).toBe("unfilled");
  });

  it("a failed-marker slot IS refreshable — refresh is the retry path", () => {
    const slots = computePackageSlots([filled("frontClose"), failedMarker("backFull")]);
    const plan = computeRefreshPlan(slots);
    const back = plan.slots.find((s) => s.angle === "backFull")!;
    expect(back.refusal).toBeNull();
    expect(plan.refreshable).toContain("backFull");
  });
});

describe("computeRefreshPlan — pricing (D-15)", () => {
  it("prices every slot through slotCost — fullBody for frontFull, multiView elsewhere", () => {
    const plan = computeRefreshPlan(corePackage());
    expect(plan.slots.find((s) => s.angle === "frontFull")!.cost).toBe(CREDIT_COSTS.fullBody);
    expect(plan.slots.find((s) => s.angle === "sideClose")!.cost).toBe(CREDIT_COSTS.multiView);
  });

  it("totals only the refreshable set", () => {
    const plan = computeRefreshPlan(corePackage());
    expect(plan.refreshable.sort()).toEqual(["frontFull", "sideClose", "threeQuarter"].sort());
    expect(plan.totalCost).toBe(
      plan.refreshable.reduce((sum, a) => sum + slotCost(a), 0),
    );
  });

  it("respects a requested-angle filter", () => {
    const plan = computeRefreshPlan(corePackage(), ["sideClose"]);
    expect(plan.refreshable).toEqual(["sideClose"]);
    expect(plan.totalCost).toBe(CREDIT_COSTS.multiView);
  });
});

describe("computeRefreshPlan — staleness passthrough (the F6 stale-writer feeds this)", () => {
  it("surfaces stale from the newest filled row; pinned-stale stays refused", () => {
    const slots = computePackageSlots([
      filled("frontClose"),
      filled("sideClose", { status: { state: "stale" } }),
      filled("threeQuarter", { status: { state: "stale" }, pinned: true }),
    ]);
    const plan = computeRefreshPlan(slots);
    const side = plan.slots.find((s) => s.angle === "sideClose")!;
    const threeQ = plan.slots.find((s) => s.angle === "threeQuarter")!;
    expect(side.stale).toBe(true);
    expect(side.refusal).toBeNull();
    expect(threeQ.stale).toBe(true);
    expect(threeQ.refusal).toBe("pinned"); // the pin exemption beats staleness pressure
  });
});

describe("computePackageSlots — R5 additions (stale + version)", () => {
  it("counts filled generations as the slot's vN", () => {
    const slots = computePackageSlots([
      filled("sideClose"), // newest (the refresh)
      failedMarker("sideClose"),
      filled("sideClose"), // the original
      filled("frontClose"),
    ]);
    const side = slots.find((s) => s.angle === "sideClose")!;
    expect(side.version).toBe(2); // markers don't count
    expect(side.filled).toBe(true);
  });

  it("a newer clean row clears staleness by construction (newest-wins)", () => {
    const slots = computePackageSlots([
      filled("sideClose"), // the refresh — no status
      filled("sideClose", { status: { state: "stale" } }), // the stale original
      filled("frontClose"),
    ]);
    expect(slots.find((s) => s.angle === "sideClose")!.stale).toBe(false);
  });
});

describe("snapshot refresh execution authority", () => {
  it("uses explicit selections, immutable identity documents, and the identity anchor", () => {
    const anchor = {
      id: 1,
      modelId: 7,
      viewType: "frontClose",
      storageUrl: "https://r2/snapshot-anchor.png",
      pinned: false,
      status: null,
    };
    const displayed = {
      ...anchor,
      id: 2,
      storageUrl: "https://r2/displayed.png",
    };
    const selected = {
      ...anchor,
      id: 3,
      viewType: "threeQuarter",
      storageUrl: "https://r2/selected-three-quarter.png",
    };
    const newerUnselected = {
      ...selected,
      id: 4,
      storageUrl: "https://r2/newer-unselected.png",
      pinned: true,
    };

    const authority = snapshotRefreshExecutionAuthority({
      authority: "snapshot",
      status: "current",
      model: {
        id: 7,
        status: "draft",
        masterPrompt: "mutable legacy prompt",
        technicalSchema: { subject: { sex: "female" } },
        preferences: { bodyType: "Mutable" },
        identityRevisionId: "rev-current",
      },
      stateVersion: 2,
      package: {},
      identity: {
        masterPrompt: "immutable snapshot prompt",
        technicalSchema: { subject: { sex: "male" } },
        preferences: { bodyType: "Athletic" },
      },
      anchor,
      displayedHeadshot: displayed,
      selectedViews: [
        {
          angle: "frontClose",
          compatibility: "current",
          selection: {},
          asset: displayed,
        },
        {
          angle: "threeQuarter",
          compatibility: "stale",
          selection: {},
          asset: selected,
        },
      ],
      sealedPackage: null,
      sealedIdentity: null,
      ledger: { assets: [newerUnselected, selected, displayed, anchor] },
    } as never);

    expect(authority.anchorUrl).toBe("https://r2/snapshot-anchor.png");
    expect(authority.generationModel).toEqual({
      masterPrompt: "immutable snapshot prompt",
      technicalSchema: { subject: { sex: "male" } },
      preferences: { bodyType: "Athletic" },
      identityRevisionId: "rev-current",
    });
    expect(authority.slots.find((slot) => slot.angle === "threeQuarter")).toMatchObject({
      url: "https://r2/selected-three-quarter.png",
      pinned: false,
      stale: true,
    });
  });
});
