/**
 * Image-or-placeholder area inside a cast node card — DESIGN_SYSTEM.md §5.12.
 * Five states: empty, generating, complete, error, plus the stale `dimmed` cue.
 * Load failures render ImageFallback — never a broken image (§5.16 / D-12).
 * Renders identically at every zoom (D-37).
 */
import { User, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SafeImage } from "./ImageFallback";

/** Lifecycle of a cast node's generation, driven by the job store. */
export type NodePromptState = "empty" | "ready" | "generating" | "complete";

export interface CastImageAreaProps {
  imageUrl: string | null;
  promptState: NodePromptState;
  progressSeconds?: number;
  /** 0–1, time-based against the job's estimatedDurationMs. */
  progressFraction?: number;
  /** True when node status is "stale" — image recedes to 70% opacity. */
  dimmed?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

export function CastImageArea({
  imageUrl,
  promptState,
  progressSeconds,
  progressFraction = 0,
  dimmed,
  error,
  onRetry,
}: CastImageAreaProps) {
  return (
    // 3:4 — the exact ratio casting generates (896×1200, measured), so cover
    // never crops. The empty and generating states hold the same rectangle:
    // geometry is stable through the node's whole life (VC2 ruling, 2026-07-11).
    <div
      className="aspect-[3/4] bg-canvas-surface-inset flex flex-col items-center justify-center text-canvas-ink-faint"
    >
      {error ? (
        <>
          <XCircle className="w-4 h-4 text-canvas-destructive" strokeWidth={1.4} />
          <span className="text-canvas-xs mt-1.5 text-canvas-ink-soft">Generation failed</span>
          {/* Batch C final correction 1: the money truth rides the node's
              status message (set server-side from the ledger's actual
              outcome) — no unconditional "you weren't charged" claim here */}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 px-2.5 py-1 rounded-canvas-pill text-canvas-xs text-canvas-ink-soft border-hairline border-canvas-border hover:border-canvas-border-strong transition-colors"
            >
              Retry
            </button>
          )}
        </>
      ) : promptState === "generating" ? (
        <>
          <div className="w-[72%] h-[3px] bg-canvas-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-canvas-ink opacity-45"
              style={{
                width: `${Math.min(97, Math.round(progressFraction * 100))}%`,
                transition: "width 0.3s linear",
              }}
            />
          </div>
          <span className="text-canvas-xs mt-2">Generating · {progressSeconds ?? 0}s</span>
        </>
      ) : imageUrl ? (
        <SafeImage
          src={imageUrl}
          alt=""
          draggable={false}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-250",
            dimmed && "opacity-70",
          )}
        />
      ) : (
        <User className="w-5 h-5 opacity-50" strokeWidth={1.2} />
      )}
    </div>
  );
}
