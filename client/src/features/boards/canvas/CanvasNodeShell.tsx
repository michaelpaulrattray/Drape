/**
 * The generic white card every node type composes — DESIGN_SYSTEM.md §5.6.
 * Border weight is zoom-tier aware (§12): the hairline *look* is preserved by
 * upgrading the canvas-space width as zoom falls, since 0.5px below 1× zoom
 * renders sub-pixel.
 */
import { cn } from "@/lib/utils";
import { useZoomTierContext } from "./zoomTiers";

export interface CanvasNodeShellProps {
  selected?: boolean;
  children: React.ReactNode;
  className?: string;
}

const BORDER_WIDTH: Record<string, { rest: string; selected: string }> = {
  working: { rest: "0.5px", selected: "1px" },
  mid: { rest: "1px", selected: "1.5px" },
  far: { rest: "1px", selected: "2px" },
};

export function CanvasNodeShell({ selected, children, className }: CanvasNodeShellProps) {
  const { tier } = useZoomTierContext();
  const width = BORDER_WIDTH[tier];

  return (
    <div
      className={cn(
        "relative bg-canvas-surface overflow-hidden border-solid transition-[border-color,border-width] duration-150 ease-out",
        tier === "far" ? "rounded-canvas-sm" : "rounded-canvas-md",
        selected ? "border-canvas-ink" : "border-canvas-border",
        className,
      )}
      style={{ borderWidth: selected ? width.selected : width.rest }}
    >
      {children}
    </div>
  );
}
