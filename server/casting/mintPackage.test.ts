/**
 * tierCosts — pure pricing over missing slots (D-39).
 * The contract under test: upgrade anytime at the same price, i.e.
 * pricing counts only MISSING slots, so draft → core → production
 * always sums to the from-scratch production price.
 */
import { describe, it, expect } from "vitest";
import { tierCosts, slotCost, computePackageSlots } from "./mintPackage";
import { MINT_TIER_SLOTS } from "../../shared/boardTypes";
import { CREDIT_COSTS } from "./aiService";

// Assets arrive newest-first (getModelAssets order); a failed slot is a
// storageUrl-less row carrying a failed status marker.
const filled = (viewType: string, url = "https://r2/x.png") => ({ viewType, storageUrl: url });
const failedMarker = (viewType: string, reason = "identity mismatch") => ({
  viewType,
  storageUrl: "",
  status: { state: "failed", reason, refunded: 300, at: "2026-07-12T00:00:00Z" },
});

describe("tierCosts", () => {
  it("prices a fresh draft at zero (headshot already exists)", () => {
    const tiers = tierCosts(["frontClose"]);
    expect(tiers.draft.missing).toEqual([]);
    expect(tiers.draft.cost).toBe(0);
  });

  it("prices core from scratch as its three slots", () => {
    const tiers = tierCosts(["frontClose"]);
    expect(tiers.core.missing).toEqual(MINT_TIER_SLOTS.core);
    expect(tiers.core.cost).toBe(
      MINT_TIER_SLOTS.core.reduce((sum, a) => sum + slotCost(a), 0)
    );
  });

  it("prices production from scratch as its five slots", () => {
    const tiers = tierCosts(["frontClose"]);
    expect(tiers.production.missing).toEqual(MINT_TIER_SLOTS.production);
    expect(tiers.production.missing).toHaveLength(5);
  });

  it("charges only missing slots — existing views are free", () => {
    const tiers = tierCosts(["frontClose", "sideClose", "frontFull"]);
    expect(tiers.core.missing).toEqual(["threeQuarter"]);
    expect(tiers.core.cost).toBe(CREDIT_COSTS.multiView);
  });

  it("upgrade path costs the same as buying the top tier outright", () => {
    // Draft mint first (nothing), then core, then production
    const scratch = tierCosts(["frontClose"]);
    const afterCore = tierCosts(["frontClose", ...MINT_TIER_SLOTS.core]);
    expect(scratch.core.cost + afterCore.production.cost).toBe(
      scratch.production.cost
    );
  });

  it("a complete package costs zero everywhere", () => {
    const all = ["frontClose", ...MINT_TIER_SLOTS.production];
    const tiers = tierCosts(all);
    expect(tiers.draft.cost).toBe(0);
    expect(tiers.core.cost).toBe(0);
    expect(tiers.production.cost).toBe(0);
  });

  it("frontFull prices as fullBody; every other slot as multiView", () => {
    expect(slotCost("frontFull")).toBe(CREDIT_COSTS.fullBody);
    expect(slotCost("sideClose")).toBe(CREDIT_COSTS.multiView);
    expect(slotCost("threeQuarter")).toBe(CREDIT_COSTS.multiView);
    expect(slotCost("sideFull")).toBe(CREDIT_COSTS.multiView);
    expect(slotCost("backFull")).toBe(CREDIT_COSTS.multiView);
  });
});

describe("computePackageSlots — failure surfacing (D-40)", () => {
  it("a filled slot is filled, never failed", () => {
    const slots = computePackageSlots([filled("frontClose")]);
    const head = slots.find((s) => s.angle === "frontClose")!;
    expect(head.filled).toBe(true);
    expect(head.failed).toBeNull();
  });

  it("a failed-marker slot with no fill surfaces named + refunded", () => {
    const slots = computePackageSlots([filled("frontClose"), failedMarker("backFull", "the build didn't match")]);
    const back = slots.find((s) => s.angle === "backFull")!;
    expect(back.filled).toBe(false);
    expect(back.failed).toEqual({ reason: "the build didn't match", refunded: 300, at: "2026-07-12T00:00:00Z" });
  });

  it("a slot never attempted is neither filled nor failed (a plain empty slot)", () => {
    const slots = computePackageSlots([filled("frontClose")]);
    const walk = slots.find((s) => s.angle === "sideFull")!;
    expect(walk.filled).toBe(false);
    expect(walk.failed).toBeNull();
  });

  it("a later success supersedes an earlier failure (newest-first: success wins)", () => {
    // getModelAssets returns newest first — the retry's filled row precedes the marker
    const slots = computePackageSlots([filled("backFull"), failedMarker("backFull")]);
    const back = slots.find((s) => s.angle === "backFull")!;
    expect(back.filled).toBe(true);
    expect(back.failed).toBeNull();
  });

  it("reports all six canonical slots regardless of input", () => {
    const slots = computePackageSlots([]);
    expect(slots.map((s) => s.angle).sort()).toEqual(
      ["backFull", "frontClose", "frontFull", "sideClose", "sideFull", "threeQuarter"].sort(),
    );
    expect(slots.every((s) => !s.filled && s.failed === null)).toBe(true);
  });
});
