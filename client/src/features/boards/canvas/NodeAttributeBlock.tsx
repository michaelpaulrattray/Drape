/**
 * Identity attributes below a selected cast root — DESIGN_SYSTEM.md §5.9,
 * as ruled at VC1.5 (founder, 2026-07-10). Two states, one component:
 *
 * - Resting (completed root, selected): a single tertiary-gray summary line of
 *   the filled values, truncating at card width. The card keeps one visual
 *   center — this replaces the retired filled-pill strip, which read as a
 *   second card.
 * - Engaged (tap the line, or any empty root): a no-fill spec-sheet row list —
 *   label column faint, value column soft — where every row opens its tactile
 *   component in a popover directly.
 *
 * Empty roots skip the summary (nothing to summarize) and show the rows
 * immediately with faint "Add" values, preserving the foundations §3a intent
 * that identity controls are visible and inviting before the first Run.
 * Collapses on deselect (the host unmounts it). Cast roots only; hidden below
 * the working zoom tier (§12).
 */
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { CanvasPopoverContent } from "./CanvasPopover";
import { useZoomTierContext } from "./zoomTiers";

export type AttributeId = "brand" | "vibe" | "ethnicity" | "skin" | "hair" | "eyes";

export interface AttributeDescriptor {
  id: AttributeId;
  label: string;
  value: string | null; // null = unset — row shows a faint "Add"
  popoverContent: React.ReactNode;
  popoverWidth?: number;
  /** Parser-override text surfaces as the row tooltip when present. */
  overrideTitle?: string;
}

export interface NodeAttributeBlockProps {
  attributes: AttributeDescriptor[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
}

export function NodeAttributeBlock({
  attributes,
  expanded,
  onExpandedChange,
  activeId,
  onActiveChange,
}: NodeAttributeBlockProps) {
  const { tier } = useZoomTierContext();
  if (tier !== "working" || attributes.length === 0) return null;

  const filled = attributes.filter((a) => a.value !== null);
  const showRows = expanded || filled.length === 0; // empty roots: rows immediately

  if (!showRows) {
    return (
      <button
        type="button"
        onClick={() => onExpandedChange(true)}
        onMouseDown={(e) => e.stopPropagation()}
        title="Edit identity"
        className="mt-2 block w-full text-left px-0.5 text-canvas-xs text-canvas-ink-faint hover:text-canvas-ink-soft transition-colors truncate"
      >
        {filled.map((a) => a.value).join(" · ")}
      </button>
    );
  }

  return (
    <div className="mt-2 w-full px-0.5" onMouseDown={(e) => e.stopPropagation()}>
      {attributes.map((attr) => (
        <Popover
          key={attr.id}
          open={activeId === attr.id}
          onOpenChange={(open) => onActiveChange(open ? attr.id : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              title={attr.overrideTitle}
              className="group grid grid-cols-[64px_1fr] items-baseline gap-2 w-full text-left py-[3px]"
            >
              <span className="text-canvas-xs text-canvas-ink-faint">{attr.label}</span>
              <span
                className={cn(
                  "text-canvas-xs truncate transition-colors",
                  activeId === attr.id
                    ? "text-canvas-ink font-medium"
                    : attr.value
                      ? "text-canvas-ink-soft group-hover:text-canvas-ink"
                      : "text-canvas-ink-faint group-hover:text-canvas-ink-soft",
                )}
              >
                {attr.value ?? "Add"}
              </span>
            </button>
          </PopoverTrigger>
          <CanvasPopoverContent
            side="right"
            align="start"
            style={{ width: attr.popoverWidth ?? 280 }}
          >
            {attr.popoverContent}
          </CanvasPopoverContent>
        </Popover>
      ))}
    </div>
  );
}
