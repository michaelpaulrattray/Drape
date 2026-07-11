/**
 * ParseSummaryStrip — what the brief was understood to mean, rendered where
 * the action happened (D-40/D-41; replaces the corner toast). Sits directly
 * under the brief field: "Understood:" + tappable chips (each jumps to its
 * control) + the engine's-choice tail for everything left open.
 *
 * Styled in the canvas language (new surface — survives the R6 restyle).
 */
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ParsedChip {
  /** data-sweep-field target to scroll to on tap */
  sweep: string;
  label: string;
  value: string;
}

export interface ParseSummary {
  chips: ParsedChip[];
  /** Human labels of the required fields left to the engine. */
  engineFields: string[];
}

export function ParseSummaryStrip({
  summary,
  onJump,
  onDismiss,
}: {
  summary: ParseSummary;
  onJump: (sweep: string) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mx-4 mb-3 px-3 py-2.5 bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 min-w-0">
          <span className="text-canvas-xs text-canvas-ink-faint">Understood:</span>
          {summary.chips.length === 0 && (
            <span className="text-canvas-xs text-canvas-ink-soft">no specifics —</span>
          )}
          {summary.chips.map((chip) => (
            <button
              key={`${chip.sweep}-${chip.label}`}
              type="button"
              onClick={() => onJump(chip.sweep)}
              title={`Jump to ${chip.label}`}
              className={cn(
                "px-1.5 py-[2px] rounded-canvas-sm border-hairline border-canvas-border",
                "text-canvas-xs text-canvas-ink hover:border-canvas-ink transition-colors",
              )}
            >
              <span className="text-canvas-ink-faint">{chip.label} · </span>
              {chip.value}
            </button>
          ))}
          {summary.engineFields.length > 0 && (
            <span
              className="text-canvas-xs text-canvas-ink-faint"
              title={`Left open — the casting resolves: ${summary.engineFields.join(", ")}`}
            >
              {summary.chips.length > 0 ? "· everything else stays open" : "everything stays open"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 w-5 h-5 rounded-canvas-sm flex items-center justify-center text-canvas-ink-faint hover:text-canvas-ink transition-colors"
        >
          <X className="w-3 h-3" strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}
