/**
 * THE node action pill — DESIGN_SYSTEM.md §5.10 as amended at R6 drive 2
 * (founder-directed consolidation): ONE pill per node, anchored BELOW it,
 * carrying the icon verbs (Edit rides as a pen icon) plus the contextual
 * text segments that used to live in the separate NodeControlStrip (the
 * D-51 package verb, ledger vN, {N} stale, ···). Two toolbars around one
 * node was archaic; the strip is dead for cast nodes.
 * The D-50 GROUP toolbar keeps its ABOVE placement (position="top").
 * Screen-legible chrome (D-2 as narrowed by D-37): counter-scaled below 1×
 * zoom so it never shrinks past usable size; disabled actions stay visible
 * with explanatory tooltips.
 */
import { cn } from "@/lib/utils";
import { RefreshCw, Shuffle, Copy, Download, Trash2, Info, Maximize, Play, Minimize2, Pencil, LayoutGrid } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useCanvasZoom, screenLegibleScale } from "./canvasZoom";

export interface NodeToolbarAction {
  // focus/runAll belong to the D-50 group toolbar (GroupSelectionOverlay);
  // collapse is the popped-view slot (VC-R5 fix 3); edit is the pen (R6)
  id: "rerun" | "variations" | "duplicate" | "download" | "delete" | "info" | "focus" | "runAll" | "collapse" | "edit" | "tidy";
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

const ICONS: Record<
  NodeToolbarAction["id"],
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  rerun: RefreshCw,
  variations: Shuffle,
  duplicate: Copy,
  download: Download,
  delete: Trash2,
  info: Info,
  focus: Maximize,
  runAll: Play,
  collapse: Minimize2,
  edit: Pencil,
  tidy: LayoutGrid,
};

export function NodeFloatingToolbar({
  actions,
  position = "bottom",
  trailing,
}: {
  actions: NodeToolbarAction[];
  /** "bottom" (the node pill, R6 consolidation) or "top" (the D-50 group toolbar). */
  position?: "top" | "bottom";
  /** Contextual text segments (D-51 verb, vN, {N} stale, ···) after a divider. */
  trailing?: React.ReactNode;
}) {
  const { zoom } = useCanvasZoom();
  const counterScale = screenLegibleScale(zoom);

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "absolute left-1/2 flex items-center gap-0.5 p-0.5 bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-pill",
          position === "top" ? "-top-2" : "-bottom-2",
        )}
        style={{
          transform:
            position === "top"
              ? `translate(-50%, -100%) scale(${counterScale})`
              : `translate(-50%, 100%) scale(${counterScale})`,
          transformOrigin: position === "top" ? "bottom center" : "top center",
        }}
        onMouseDown={(e) => e.stopPropagation()} // don't start a React Flow drag
      >
        {actions.map((action) => {
          const Icon = ICONS[action.id];
          return (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  aria-label={action.label}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                    "text-canvas-ink-soft hover:bg-canvas-surface-inset hover:text-canvas-ink",
                    action.disabled && "opacity-40 pointer-events-none",
                  )}
                >
                  <Icon className="w-3 h-3" strokeWidth={1.6} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side={position === "top" ? "top" : "bottom"}
                className="text-canvas-xs bg-canvas-ink text-canvas-surface border-none shadow-none px-2 py-1 rounded-canvas-sm"
              >
                {action.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {trailing && (
          <>
            <div className="w-px h-3.5 mx-0.5 bg-canvas-border" />
            {trailing}
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
