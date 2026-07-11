/**
 * The tiny label row OUTSIDE and above the card — DESIGN_SYSTEM.md §5.5.
 * Type/title left, engine right. Renders at every zoom (D-37): small text at
 * far zoom simply reads small.
 */
import { cn } from "@/lib/utils";

export interface NodeLabelRowProps {
  type: string; // "Cast · Maya R." or "Cast · Maya R. · Full front"
  engine?: string; // from provenance.engine — never hardcoded
  selected?: boolean;
}

export function NodeLabelRow({ type, engine, selected }: NodeLabelRowProps) {
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
