/**
 * FloatingToolPill — bottom-center tool pill (DESIGN_SYSTEM.md §5.3).
 * Canvas only, never the refinement studio. The Add action opens the node
 * menu (host decides how); geometry accommodates future tool entries
 * (video, pass 4) without redesign — nothing is sized to the icon count.
 */
import { Plus, MousePointer2, Type, Square, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type PillTool = "add" | "select" | "note" | "frame";

export interface FloatingToolPillProps {
  activeTool: Exclude<PillTool, "add">;
  onSelectTool: (tool: PillTool) => void;
  onMore?: () => void;
}

export function FloatingToolPill({ activeTool, onSelectTool, onMore }: FloatingToolPillProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 p-1 bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-pill">
      <ToolButton onClick={() => onSelectTool("add")} label="Add">
        <Plus className="w-3 h-3" strokeWidth={1.8} />
      </ToolButton>
      <ToolButton active={activeTool === "select"} onClick={() => onSelectTool("select")} label="Select">
        <MousePointer2 className="w-3 h-3" strokeWidth={1.6} />
      </ToolButton>
      <ToolButton active={activeTool === "frame"} onClick={() => onSelectTool("frame")} label="Frame">
        <Square className="w-3 h-3" strokeWidth={1.6} />
      </ToolButton>
      <ToolButton active={activeTool === "note"} onClick={() => onSelectTool("note")} label="Note">
        <Type className="w-3 h-3" strokeWidth={1.6} />
      </ToolButton>
      {onMore && (
        <>
          <span className="w-px h-3.5 bg-canvas-border mx-1" aria-hidden />
          <ToolButton onClick={onMore} label="More">
            <MoreHorizontal className="w-3 h-3" strokeWidth={1.6} />
          </ToolButton>
        </>
      )}
    </div>
  );
}

function ToolButton({
  children,
  active,
  onClick,
  label,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
        active ? "bg-canvas-ink text-canvas-surface" : "text-canvas-ink-soft hover:bg-canvas-surface-inset",
      )}
    >
      {children}
    </button>
  );
}
