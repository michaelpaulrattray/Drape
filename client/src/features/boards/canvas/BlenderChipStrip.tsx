/**
 * Expressive-control chips below the control strip — DESIGN_SYSTEM.md §5.9.
 * Cast roots only; hidden below the working zoom tier (§12). Chip states:
 * ghost (dashed, `+ Brand`), filled (`Brand · Editorial` + chevron), active
 * (popover open: 1px ink border, inset bg). Popover content is the real
 * tactile component (M5); until then callers pass placeholder content.
 */
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { CanvasPopoverContent } from "./CanvasPopover";
import { useZoomTierContext } from "./zoomTiers";

export type BlenderChipId = "brand" | "vibe" | "ethnicity" | "skin" | "hair" | "eyes";

export interface BlenderChipProps {
  label: string;
  value: string | null; // null = ghost/unfilled
  active?: boolean;
  onOpenChange: (open: boolean) => void;
  popoverContent: React.ReactNode;
  popoverWidth?: number;
  /** Parser-override text surfaces as the chip tooltip when present. */
  overrideTitle?: string;
}

export function BlenderChip({
  label,
  value,
  active,
  onOpenChange,
  popoverContent,
  popoverWidth = 280,
  overrideTitle,
}: BlenderChipProps) {
  const isFilled = value !== null;

  return (
    <Popover open={active} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={overrideTitle}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-canvas-md text-canvas-xs whitespace-nowrap transition-colors",
            active && "bg-canvas-surface-inset border border-canvas-ink text-canvas-ink font-medium",
            !active &&
              isFilled &&
              "border-hairline bg-canvas-surface border-canvas-border text-canvas-ink-soft hover:border-canvas-border-strong",
            !active &&
              !isFilled &&
              "border-hairline border-dashed bg-transparent border-canvas-border-strong text-canvas-ink-faint hover:text-canvas-ink-soft hover:border-canvas-ink-soft",
          )}
        >
          <span>{isFilled ? `${label} · ${value}` : `+ ${label}`}</span>
          {isFilled && <ChevronDown className="w-2 h-2 opacity-60" strokeWidth={1.8} />}
        </button>
      </PopoverTrigger>
      <CanvasPopoverContent side="right" align="start" style={{ width: popoverWidth }}>
        {popoverContent}
      </CanvasPopoverContent>
    </Popover>
  );
}

export interface BlenderChipStripProps {
  chips: Array<{
    id: BlenderChipId;
    label: string;
    value: string | null;
    popoverContent: React.ReactNode;
    popoverWidth?: number;
    overrideTitle?: string;
  }>;
  activeChipId: string | null;
  onActiveChange: (id: string | null) => void;
}

export function BlenderChipStrip({ chips, activeChipId, onActiveChange }: BlenderChipStripProps) {
  const { tier } = useZoomTierContext();
  if (tier !== "working" || chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map((chip) => (
        <BlenderChip
          key={chip.id}
          label={chip.label}
          value={chip.value}
          active={activeChipId === chip.id}
          onOpenChange={(open) => onActiveChange(open ? chip.id : null)}
          popoverContent={chip.popoverContent}
          popoverWidth={chip.popoverWidth}
          overrideTitle={chip.overrideTitle}
        />
      ))}
    </div>
  );
}
