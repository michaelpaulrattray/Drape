/**
 * The tiny label row OUTSIDE and above the card — DESIGN_SYSTEM.md §5.5.
 * Type/title left, engine right. Hidden below the working zoom tier (§12).
 */
import { cn } from "@/lib/utils";
import { useZoomTierContext } from "./zoomTiers";

export interface NodeLabelRowProps {
  type: string; // "Cast · Maya R." or "Cast · Maya R. · Full front"
  engine?: string; // from provenance.engine — never hardcoded
  selected?: boolean;
}

export function NodeLabelRow({ type, engine, selected }: NodeLabelRowProps) {
  const { tier } = useZoomTierContext();
  if (tier !== "working") return null;

  return (
    <div className="flex justify-between items-center px-0.5 pb-1.5">
      <span
        className={cn(
          "text-canvas-xs truncate",
          selected ? "text-canvas-ink-soft" : "text-canvas-ink-faint",
        )}
      >
        {type}
      </span>
      {engine && (
        <span className="text-canvas-xs text-canvas-ink-faint shrink-0 pl-2">{engine}</span>
      )}
    </div>
  );
}
