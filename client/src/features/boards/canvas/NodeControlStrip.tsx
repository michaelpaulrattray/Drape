/**
 * Pill strip below the card — DESIGN_SYSTEM.md §5.8. Selected nodes only.
 * Root cast: `+ Views · vN · ···`; view cast: `vN · ···` (+ pin glyph when
 * pinned). No view-switcher segment exists on any cast strip.
 */
import { cn } from "@/lib/utils";
import { ChevronDown, MoreHorizontal, Pin } from "lucide-react";

export interface ControlSegment {
  kind: "label" | "dropdown" | "action" | "pin";
  content: string;
  icon?: "chevron" | "more";
  onClick?: () => void;
  active?: boolean;
}

export interface NodeControlStripProps {
  segments: ControlSegment[];
}

export function NodeControlStrip({ segments }: NodeControlStripProps) {
  if (segments.length === 0) return null;

  return (
    <div
      className="mt-2 inline-flex items-center p-0.5 bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {segments.map((seg, i) => (
        <SegmentView key={i} segment={seg} showDivider={i > 0} />
      ))}
    </div>
  );
}

function SegmentView({ segment, showDivider }: { segment: ControlSegment; showDivider: boolean }) {
  const classes = cn(
    "px-2.5 py-1 text-canvas-xs flex items-center gap-1 rounded-[5px] transition-colors",
    segment.active
      ? "bg-canvas-surface-inset text-canvas-ink font-medium"
      : "text-canvas-ink-soft",
    (segment.kind === "dropdown" || segment.kind === "action") &&
      "hover:bg-canvas-surface-inset cursor-pointer",
  );

  const content =
    segment.kind === "pin" ? (
      <Pin className="w-2.5 h-2.5 fill-current" strokeWidth={1.6} aria-label={segment.content} />
    ) : (
      <>
        {segment.content}
        {segment.icon === "chevron" && (
          <ChevronDown className="w-2.5 h-2.5 opacity-60" strokeWidth={1.6} />
        )}
        {segment.icon === "more" && (
          <MoreHorizontal className="w-2.5 h-2.5 opacity-60" strokeWidth={1.6} />
        )}
      </>
    );

  return (
    <>
      {showDivider && <span className="w-px h-2.5 bg-canvas-border" aria-hidden />}
      {segment.kind === "label" || segment.kind === "pin" ? (
        <span className={classes} title={segment.kind === "pin" ? segment.content : undefined}>
          {content}
        </span>
      ) : (
        <button type="button" onClick={segment.onClick} className={classes}>
          {content}
        </button>
      )}
    </>
  );
}
