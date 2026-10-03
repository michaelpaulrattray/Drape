/**
 * The generalized node status indicator — DESIGN_SYSTEM.md §5.14.
 * One component for ALL node statuses; pass 1 wires `stale` and `error`
 * (others reserved in the union). One 22px corner badge with a hover card,
 * counter-scaled below 1× zoom so statuses stay screen-legible at any zoom
 * (D-6 / D-37 survivor — a stale or failed node must never become invisible).
 * The error glyph is the one red mark on the canvas (§2.1). Extend this
 * component; never fork it.
 */
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { AlertCircle, AlertTriangle, Eye, XCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasZoom, screenLegibleScale } from "./canvasZoom";

type NodeStatus =
  | {
      type: "stale";
      message: string;
      context?: {
        causedByItemId?: number;
        oldValues?: Record<string, unknown>;
        newValues?: Record<string, unknown>;
      };
    }
  | { type: "quality_flagged"; message: string; context?: { flaggedBy?: string; issues?: string[] } }
  | { type: "needs_review"; message: string; context?: { requestedBy?: string } }
  | { type: "error"; message: string; context?: { errorCode?: string } }
  | { type: "moderation"; message: string; context?: { caseId?: number } };

export interface NodeStatusBadgeProps {
  status: NodeStatus;
  /** Primary action label may embed a cost, e.g. "Refresh · ~300 credits". */
  primaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  /**
   * A sentence shown WHERE THE PRIMARY ACTION WOULD BE, when that action is not
   * on offer at all (#1785 — the canvas casting door, his word: "seal").
   *
   * ⚠ It exists so a closed road is a SENTENCE and not an absence. Dropping
   * `onPrimary` alone already removes the button — and would leave a customer
   * looking at "Out of sync" with nothing to do and no reason given, which is
   * the disappearing-technology law failing in its own named way: a refusal
   * says what was refused and what to do. Extending this component rather than
   * forking it is this file's own standing instruction.
   */
  closedNote?: string;
}

interface VariantConfig {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  primaryLabel: string;
  secondaryLabel: string;
  destructiveGlyph?: boolean;
}

const VARIANT_CONFIG: Record<NodeStatus["type"], VariantConfig> = {
  stale: { Icon: AlertCircle, title: "Out of sync", primaryLabel: "Refresh", secondaryLabel: "Keep old" },
  error: { Icon: XCircle, title: "Generation failed", primaryLabel: "Retry", secondaryLabel: "Dismiss", destructiveGlyph: true },
  quality_flagged: { Icon: AlertTriangle, title: "Quality flag", primaryLabel: "Regenerate", secondaryLabel: "Accept anyway" },
  needs_review: { Icon: Eye, title: "Needs review", primaryLabel: "Approve", secondaryLabel: "Reject" },
  moderation: { Icon: Shield, title: "Under review", primaryLabel: "Open case", secondaryLabel: "Dismiss" },
};

export function NodeStatusBadge({ status, primaryLabel, onPrimary, onSecondary, closedNote }: NodeStatusBadgeProps) {
  const { zoom } = useCanvasZoom();
  const config = VARIANT_CONFIG[status.type];
  const { Icon } = config;
  const glyphColor = config.destructiveGlyph ? "text-canvas-destructive" : "text-canvas-ink";

  const counterScale = screenLegibleScale(zoom);

  return (
    <HoverCard openDelay={100} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={config.title}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-2 right-2 z-10 rounded-full flex items-center justify-center transition-colors",
            "w-[22px] h-[22px] bg-canvas-surface border-hairline border-canvas-border-strong hover:border-canvas-ink",
            glyphColor,
          )}
          style={counterScale !== 1 ? { transform: `scale(${counterScale})`, transformOrigin: "top right" } : undefined}
        >
          <Icon className="w-[11px] h-[11px]" strokeWidth={1.5} />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-[250px] p-3.5 bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md shadow-none"
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className={cn("w-3 h-3", glyphColor)} strokeWidth={1.5} />
          <span className="text-canvas-sm font-medium text-canvas-ink">{config.title}</span>
          {status.type === "needs_review" && status.context?.requestedBy && (
            <span className="text-canvas-xs text-canvas-ink-faint">@{status.context.requestedBy}</span>
          )}
        </div>
        <div className="text-canvas-sm text-canvas-ink-soft leading-relaxed mb-3">{status.message}</div>
        {/* #1785: the closed road's sentence stands where its button stood. No
            button, no cost, nothing to press — the hover card is where this
            node's story is already told, so the reason belongs beside it. */}
        {!onPrimary && closedNote && (
          <div className="text-canvas-xs text-canvas-ink-faint leading-relaxed">{closedNote}</div>
        )}
        <div className="flex gap-1.5">
          {onPrimary && (
            <button
              type="button"
              onClick={onPrimary}
              className="flex-1 bg-canvas-ink text-canvas-surface border-none py-1.5 px-2.5 rounded-canvas-md text-canvas-xs font-medium hover:opacity-90 transition-opacity"
            >
              {primaryLabel ?? config.primaryLabel}
            </button>
          )}
          {onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="flex-1 bg-transparent border-hairline border-canvas-border py-1.5 px-2.5 rounded-canvas-md text-canvas-xs text-canvas-ink-soft hover:border-canvas-border-strong transition-colors"
            >
              {config.secondaryLabel}
            </button>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
