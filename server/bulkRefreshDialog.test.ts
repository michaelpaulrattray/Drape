/**
 * V8 count honesty at the loading beat (Batch A-safe correction round 3):
 * while the refresh plan is in flight (`totalCost === null`) the dialog's
 * rows aren't known yet — it must say "Loading…", never flash the false
 * claim "Refresh 0 views". Once the plan resolves, the real count renders.
 *
 * Real component, rendered via react-dom/server static markup.
 */
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BulkRefreshDialog, type BulkRefreshSlotRow } from "../client/src/features/boards/canvas/BulkRefreshDialog";

const rows: BulkRefreshSlotRow[] = [
  { angle: "sideClose", label: "Side profile", cost: 300 },
  { angle: "threeQuarter", label: "Three-quarter", cost: 300 },
];

function render(slots: BulkRefreshSlotRow[], totalCost: number | null) {
  return renderToStaticMarkup(
    createElement(BulkRefreshDialog, { slots, totalCost, onConfirm: () => {}, onCancel: () => {} }),
  );
}

describe("BulkRefreshDialog — loading state never lies about the count", () => {
  it("while the plan loads: 'Loading…', and NEVER 'Refresh 0 views'", () => {
    const html = render([], null);
    expect(html).toContain("Loading…");
    expect(html).not.toContain("Refresh 0 views");
    // The confirm stays disabled until the plan lands
    expect(html).toContain("disabled");
  });

  it("resolved plan: the real count renders (plural and singular)", () => {
    expect(render(rows, 600)).toContain("Refresh 2 views");
    expect(render(rows.slice(0, 1), 300)).toContain("Refresh 1 view");
  });

  it("resolved rows render their labels and the plan total", () => {
    const html = render(rows, 600);
    expect(html).toContain("Side profile");
    expect(html).toContain("Three-quarter");
    expect(html).toContain("600");
  });
});
