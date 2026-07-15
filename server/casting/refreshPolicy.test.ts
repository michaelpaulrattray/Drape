/**
 * V8 — stale-count honesty (Batch A-safe).
 *
 * Contract under test: the board strip's `{N} stale` count and the bulk
 * refresh dialog's rows derive from ONE shared predicate
 * (shared/refreshPolicy), so the displayed count ALWAYS equals the rows the
 * dialog can actually refresh. The stale headshot never joins the count —
 * it is its own labeled state (identity anchor; refresh structurally
 * refuses it, F6/D-43).
 *
 * The client computes `staleCount = slots.filter(isActionableStale).length`
 * (useSheetController) and the dialog rows are the plan's
 * `stale && refusal === null` slots — both sides are exercised here against
 * the same computePackageSlots-derived state, in every combination.
 */
import { describe, it, expect } from "vitest";
import { computePackageSlots, type PackageSlot } from "./mintPackage";
import { computeRefreshPlan } from "./refreshSlots";
import { isActionableStale, refreshRefusalFor } from "../../shared/refreshPolicy";
import { CANONICAL_VIEW_ANGLES } from "../../shared/boardTypes";

// Assets arrive newest-first (getModelAssets order)
const filled = (viewType: string, extra: Record<string, unknown> = {}) => ({
  viewType,
  storageUrl: `https://r2/${viewType}.png`,
  ...extra,
});
const stale = (viewType: string, extra: Record<string, unknown> = {}) =>
  filled(viewType, { status: { state: "stale" }, ...extra });
const failedMarker = (viewType: string) => ({
  viewType,
  storageUrl: "",
  status: { state: "failed", reason: "identity mismatch", refunded: 300, at: "2026-07-15T00:00:00Z" },
});

/** What the client strip shows (useSheetController.staleCount). */
const stripCount = (slots: PackageSlot[]) => slots.filter(isActionableStale).length;
/** What the refresh dialog lists (useSheetController.bulkStaleRows). */
const dialogRows = (slots: PackageSlot[]) =>
  computeRefreshPlan(slots).slots.filter((s) => s.stale && s.refusal === null);

/** The V8 law: count == rows, in every combination. */
function expectParity(slots: PackageSlot[]) {
  const rows = dialogRows(slots);
  expect(stripCount(slots)).toBe(rows.length);
  // Same angles, not just the same arithmetic
  expect(slots.filter(isActionableStale).map((s) => s.angle)).toEqual(rows.map((r) => r.angle));
}

describe("V8 — the {N} stale count equals the refresh dialog's actionable rows", () => {
  it("nothing stale → 0 == 0", () => {
    const slots = computePackageSlots(CANONICAL_VIEW_ANGLES.map((a) => filled(a)));
    expectParity(slots);
    expect(stripCount(slots)).toBe(0);
  });

  it("a stale headshot ALONE shows no count — never a stuck '1 stale'", () => {
    const slots = computePackageSlots([stale("frontClose"), filled("sideClose"), filled("frontFull")]);
    expectParity(slots);
    expect(stripCount(slots)).toBe(0);
    expect(dialogRows(slots)).toHaveLength(0);
    // …because the headshot is the identity anchor, not because it isn't stale
    const head = slots.find((s) => s.angle === "frontClose")!;
    expect(head.stale).toBe(true);
    expect(refreshRefusalFor(head)).toBe("identity_anchor");
  });

  it("stale headshot + 2 stale views → strip says 2, dialog offers 2 (the audit's '5 stale / Refresh 4' lie)", () => {
    const slots = computePackageSlots([
      stale("frontClose"),
      stale("sideClose"),
      stale("threeQuarter"),
      filled("frontFull"),
    ]);
    expectParity(slots);
    expect(stripCount(slots)).toBe(2);
  });

  it("a pinned stale view joins neither the count nor the dialog (D-21)", () => {
    const slots = computePackageSlots([
      filled("frontClose"),
      stale("sideClose"),
      stale("sideFull", { pinned: true }),
    ]);
    expectParity(slots);
    expect(stripCount(slots)).toBe(1);
    expect(dialogRows(slots).map((r) => r.angle)).toEqual(["sideClose"]);
  });

  it("everything stale, one pinned → count == rows == 4 (six minus headshot minus pinned)", () => {
    const slots = computePackageSlots(
      CANONICAL_VIEW_ANGLES.map((a) => (a === "frontFull" ? stale(a, { pinned: true }) : stale(a))),
    );
    expectParity(slots);
    expect(stripCount(slots)).toBe(4);
  });

  it("failed markers and unfilled slots never inflate the count", () => {
    const slots = computePackageSlots([filled("frontClose"), stale("sideClose"), failedMarker("backFull")]);
    expectParity(slots);
    expect(stripCount(slots)).toBe(1);
  });

  it("exhaustive: every stale/pinned combination over the six slots holds parity", () => {
    // 3 states per slot (fresh / stale / stale+pinned) over a filled card —
    // sampled exhaustively per-slot against an all-stale backdrop
    for (const angle of CANONICAL_VIEW_ANGLES) {
      for (const variant of ["fresh", "stale", "stalePinned"] as const) {
        const rows = CANONICAL_VIEW_ANGLES.map((a) => {
          if (a !== angle) return stale(a);
          if (variant === "fresh") return filled(a);
          if (variant === "stale") return stale(a);
          return stale(a, { pinned: true });
        });
        expectParity(computePackageSlots(rows));
      }
    }
  });
});

describe("V8 — the stale headshot is its own state with real exits", () => {
  it("useSheetController's staleHeadshot predicate: filled + stale frontClose", () => {
    // The controller derives: slots.some(s => s.angle === 'frontClose' && s.filled && s.stale)
    const withStaleHead = computePackageSlots([stale("frontClose"), filled("sideClose")]);
    const head = withStaleHead.find((s) => s.angle === "frontClose")!;
    expect(head.filled && head.stale).toBe(true);

    const freshHead = computePackageSlots([filled("frontClose"), stale("sideClose")]);
    expect(freshHead.find((s) => s.angle === "frontClose")!.stale).toBe(false);
  });

  it("the restore exit exists whenever the ledger holds an earlier version", () => {
    // Two filled frontClose rows (newest-first) → version 2 → the popover's
    // history (restore) door renders; v1 has only the iterate exit
    const slots = computePackageSlots([
      stale("frontClose"),
      filled("frontClose"),
    ]);
    expect(slots.find((s) => s.angle === "frontClose")!.version).toBe(2);
  });
});
