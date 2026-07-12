/**
 * Above-card action pill on selection — DESIGN_SYSTEM.md §5.10.
 * Screen-legible chrome (D-2 as narrowed by D-37): counter-scaled below 1×
 * zoom so it never shrinks past usable size. Six icons max; disabled actions
 * stay visible with explanatory tooltips.
 */
import { cn } from "@/lib/utils";
import { RefreshCw, Shuffle, Copy, Download, Trash2, Info, Maximize, Play } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useCanvasZoom, screenLegibleScale } from "./canvasZoom";

export interface NodeToolbarAction {
  // focus/runAll belong to the D-50 group toolbar (GroupSelectionOverlay)
  id: "rerun" | "variations" | "duplicate" | "download" | "delete" | "info" | "focus" | "runAll";
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
};

export function NodeFloatingToolbar({ actions }: { actions: NodeToolbarAction[] }) {
  const { zoom } = useCanvasZoom();
  const counterScale = screenLegibleScale(zoom);

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="absolute left-1/2 -top-2 flex items-center gap-0.5 p-0.5 bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-pill"
        style={{
          transform: `translate(-50%, -100%) scale(${counterScale})`,
          transformOrigin: "bottom center",
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
                side="top"
                className="text-canvas-xs bg-canvas-ink text-canvas-surface border-none shadow-none px-2 py-1 rounded-canvas-sm"
              >
                {action.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
