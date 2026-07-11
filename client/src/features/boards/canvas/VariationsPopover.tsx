/**
 * VariationsPopover — plan → confirm → N sibling candidates (foundations §4
 * runVariations). The count is chosen here; the total is plan-derived on
 * every change (D-15 — the footer total is the primary metric, DS §5.15).
 */
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";

const MAX_VARIATIONS = 4; // mirrors server clamp; server re-clamps regardless

interface VariationsPopoverContentProps {
  boardId: number;
  itemId: number;
  onGenerate: (count: number, positions: Array<{ x: number; y: number }>) => void;
  onCancel: () => void;
}

export function VariationsPopoverContent({
  boardId,
  itemId,
  onGenerate,
  onCancel,
}: VariationsPopoverContentProps) {
  const [count, setCount] = useState(2);
  const { data: plan } = trpc.boardOps.runVariations.plan.useQuery(
    { boardId, itemId, count },
    { enabled: itemId > 0, staleTime: 60_000 },
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-canvas-md font-medium text-canvas-ink">Variations</p>
        <p className="text-canvas-xs text-canvas-ink-soft mt-0.5">
          New candidates cast from this identity — the original stays untouched.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-canvas-xs text-canvas-ink-soft">Candidates</span>
        <div className="flex items-center gap-1">
          <StepButton
            label="Fewer"
            disabled={count <= 1}
            onClick={() => setCount((c) => Math.max(1, c - 1))}
          >
            <Minus className="w-3 h-3" strokeWidth={1.6} />
          </StepButton>
          <span className="w-6 text-center text-canvas-sm font-medium text-canvas-ink tabular-nums">
            {count}
          </span>
          <StepButton
            label="More"
            disabled={count >= MAX_VARIATIONS}
            onClick={() => setCount((c) => Math.min(MAX_VARIATIONS, c + 1))}
          >
            <Plus className="w-3 h-3" strokeWidth={1.6} />
          </StepButton>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-canvas-border">
        {/* Footer total is the primary metric (DS §5.15) */}
        <span className="text-canvas-lg font-medium text-canvas-ink tabular-nums">
          {plan ? `~${plan.estimatedCreditCost.toLocaleString()} credits` : "—"}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-canvas-pill text-canvas-xs text-canvas-ink-soft hover:bg-canvas-surface-inset transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!plan}
            onClick={() =>
              plan && onGenerate(count, plan.creates.map((c) => c.position))
            }
            className="px-3.5 py-1.5 rounded-canvas-pill text-canvas-xs font-medium bg-canvas-ink text-canvas-surface hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="w-6 h-6 rounded-full flex items-center justify-center text-canvas-ink-soft hover:bg-canvas-surface-inset hover:text-canvas-ink transition-colors disabled:opacity-30 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}
