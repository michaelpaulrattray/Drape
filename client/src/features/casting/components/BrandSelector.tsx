/**
 * BrandSelector — brand-direction grid, extracted from ControlPanel and
 * redesigned in the canvas language (DESIGN_SYSTEM.md §13.6): canvas tokens,
 * hairline borders, no inline style blocks.
 */
import { cn } from "@/lib/utils";
import { BRAND_OPTIONS } from "../constants";

export function BrandSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {BRAND_OPTIONS.map((b) => {
        const sel = value === b.value;
        return (
          <button
            key={b.value}
            type="button"
            onClick={() => onChange(b.value)}
            className={cn(
              "rounded-canvas-md text-center transition-colors px-1 py-2",
              sel
                ? "bg-canvas-surface-inset border border-canvas-ink"
                : "bg-canvas-surface border-hairline border-canvas-border hover:border-canvas-border-strong",
            )}
          >
            <div className={cn("text-canvas-sm", sel ? "text-canvas-ink font-medium" : "text-canvas-ink-soft")}>
              {b.value}
            </div>
            <div className={cn("text-canvas-xs mt-0.5", sel ? "text-canvas-ink-soft" : "text-canvas-ink-faint")}>
              {b.desc}
            </div>
          </button>
        );
      })}
    </div>
  );
}
