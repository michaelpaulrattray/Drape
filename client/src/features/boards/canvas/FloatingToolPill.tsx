/**
 * FloatingToolPill — bottom-center tool pill (DESIGN_SYSTEM.md §5.3).
 * Canvas only, never the refinement studio.
 *
 * VC-R4 ruling R1: the pointer splits into Select (marquee-capable) and
 * Hand/Pan as a left cluster; Space temporarily switches to hand (React
 * Flow's panActivationKeyCode). Frames removed per ruling R3 — they return
 * at pass 3 as export units (D-20) wearing their real job.
 *
 * VC-R5 follow-up ruling B: the pill is FLAT — no + → popup menu; every
 * addable node type is its own segment (Cast · Note today; Image/Video/etc.
 * join as passes land — D-18 spirit: nothing is sized to the segment count,
 * new types are one ToolButton each). A legible pill on a quiet board IS
 * the empty-state answer (ruling A). The right-click AddNodeMenu survives
 * as the at-cursor context path.
 */
import { MousePointer2, Hand, Type, UserPlus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type PillTool = "cast" | "select" | "hand" | "note";

export interface FloatingToolPillProps {
  activeTool: Exclude<PillTool, "cast">;
  onSelectTool: (tool: PillTool) => void;
  onMore?: () => void;
}

export function FloatingToolPill({ activeTool, onSelectTool, onMore }: FloatingToolPillProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 p-1 bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-pill">
      {/* Pointer cluster (R1): Select marquees, Hand pans; Space = temporary hand */}
      <ToolButton active={activeTool === "select"} onClick={() => onSelectTool("select")} label="Select">
        <MousePointer2 className="w-3 h-3" strokeWidth={1.6} />
      </ToolButton>
      <ToolButton active={activeTool === "hand"} onClick={() => onSelectTool("hand")} label="Hand — pan (hold Space)">
        <Hand className="w-3 h-3" strokeWidth={1.6} />
      </ToolButton>
      <span className="w-px h-3.5 bg-canvas-border mx-1" aria-hidden />
      {/* Node-type cluster (ruling B): one segment per addable type */}
      <ToolButton onClick={() => onSelectTool("cast")} label="Cast">
        <UserPlus className="w-3 h-3" strokeWidth={1.6} />
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
