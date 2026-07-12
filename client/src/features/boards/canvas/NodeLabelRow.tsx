/**
 * The tiny label row OUTSIDE and above the card — DESIGN_SYSTEM.md §5.5.
 * Renders at every zoom (D-37): small text at far zoom simply reads small.
 *
 * The engine slot is DEAD (founder, C7 label pass): raw provenance.engine
 * values ('package', 'gemini-3-pro-image-preview') are internal identifiers
 * — the D-41 leak class — and they truncated the name they shared a row
 * with. The label is the NAME (· view / · Draft), nothing else. Engine
 * stays truthful in provenance + the Info panel; a designed engine
 * vocabulary returns with pass-3 multi-engine (D-36c's dropdown).
 */
import { cn } from "@/lib/utils";

export interface NodeLabelRowProps {
  type: string; // "Cast · Maya R." or "Cast · Maya R. · Full front"
  selected?: boolean;
}

export function NodeLabelRow({ type, selected }: NodeLabelRowProps) {
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
    </div>
  );
}
