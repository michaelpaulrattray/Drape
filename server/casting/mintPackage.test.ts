/**
 * tierCosts — pure pricing over missing slots (D-39).
 * The contract under test: upgrade anytime at the same price, i.e.
 * pricing counts only MISSING slots, so draft → core → production
 * always sums to the from-scratch production price.
 */
import { describe, it, expect } from "vitest";
import { tierCosts, slotCost } from "./mintPackage";
import { MINT_TIER_SLOTS } from "../../shared/boardTypes";
import { CREDIT_COSTS } from "./aiService";

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
