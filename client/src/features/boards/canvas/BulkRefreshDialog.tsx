/**
 * BulkRefreshDialog — the aggregate-refresh confirm behind the comp card's
 * `{N} stale` strip segment (DS §5.17; D-29's bulk refresh at its
 * post-immutability scope). NOT red — refreshing regenerates work, it never
 * destroys it (D-8 keeps red for delete-cascade alone).
 *
 * Dormant in pass 1: D-43 removed the identity-edit stale trigger, so
 * nothing sets model_assets.status = stale yet — pass 2's stale-writer
 * lights this up with zero UI work. Costs are plan-derived (D-15); pinned
 * slots never appear (the server's plan filters them — pin law, not UI
 * courtesy).
 */
import { CostLabel } from "./CostLabel";
import type { CanonicalViewAngle } from "@shared/boardTypes";

export interface BulkRefreshSlotRow {
  angle: CanonicalViewAngle;
  label: string;
  cost: number;
}

export function BulkRefreshDialog({
  slots,
  totalCost,
  onConfirm,
  onCancel,
}: {
  /** The unpinned stale slots the plan says are refreshable. */
  slots: BulkRefreshSlotRow[];
  totalCost: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onCancel} />
      <div className="relative w-[400px] bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md shadow-none p-5">
        <p className="text-canvas-md font-medium text-canvas-ink">Refresh out-of-sync views?</p>
        <p className="text-canvas-xs text-canvas-ink-soft mt-1.5 leading-relaxed">
          Each view regenerates against the current headshot. Pinned views are kept as
          finished work and stay untouched.
        </p>
        <div className="mt-3 border-t border-hairline border-canvas-border">
          {slots.map((slot) => (
            <div
              key={slot.angle}
              className="flex items-center justify-between py-1.5 border-b border-hairline border-canvas-border"
            >
              <span className="text-canvas-sm text-canvas-ink">{slot.label}</span>
              <CostLabel credits={slot.cost} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-4">
          {/* Popover/dialog footers carry the total as the primary metric (DS §5.15) */}
          {totalCost !== null ? (
            <span className="text-canvas-lg font-medium text-canvas-ink">
              ~{totalCost.toLocaleString()} credits
            </span>
          ) : (
            <span />
          )}
          <div className="flex gap-1.5">
            <button
              type="button"
              autoFocus
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-canvas-pill text-canvas-xs text-canvas-ink-soft hover:bg-canvas-surface-inset transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={totalCost === null || slots.length === 0}
              onClick={onConfirm}
              className="px-3.5 py-1.5 rounded-canvas-pill text-canvas-xs font-medium bg-canvas-ink text-canvas-surface hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {slots.length === 1 ? "Refresh 1 view" : `Refresh ${slots.length} views`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
