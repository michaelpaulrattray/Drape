/**
 * Prompt row at the bottom of a node card — DESIGN_SYSTEM.md §5.7.
 * Hidden below the working zoom tier (§12). Run is ghosted while there is
 * nothing to run (foundations 3a); when runnable it shows its cost inline
 * (Decision 6) via CostLabel.
 */
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { CostLabel } from "./CostLabel";
import { useZoomTierContext } from "./zoomTiers";

export type NodePromptState = "empty" | "ready" | "generating" | "complete";

export interface NodeInlinePromptProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  state: NodePromptState;
  placeholder?: string;
  /** From boardOps plan; shown when the node is runnable. Null = still loading. */
  runCost?: number | null;
  /** True once prompt text or a filled chip exists — enables Run (foundations 3a). */
  canRun?: boolean;
  autoFocus?: boolean;
}

export function NodeInlinePrompt({
  value,
  onChange,
  onSubmit,
  state,
  placeholder = "Describe your model...",
  runCost = null,
  canRun = false,
  autoFocus,
}: NodeInlinePromptProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { tier } = useZoomTierContext();
  if (tier !== "working") return null;

  const runnable = state === "ready" || (state === "empty" && canRun);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && state !== "generating" && (runnable || state === "complete")) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="flex items-center justify-between gap-2.5 px-3 py-2.5 border-t-hairline border-canvas-border">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={state === "generating"}
        readOnly={state === "complete"}
        className={cn(
          "flex-1 min-w-0 bg-transparent text-canvas-md placeholder:text-canvas-ink-faint focus:outline-none truncate disabled:text-canvas-ink-faint",
          // Completed nodes display the submitted prompt as a tertiary-gray readout (DS §5.7)
          state === "complete" ? "text-canvas-ink-faint" : "text-canvas-ink",
        )}
      />
      {runnable && <CostLabel credits={runCost} />}
      <RunButton state={state} runnable={runnable} onClick={onSubmit} />
    </div>
  );
}

function RunButton({
  state,
  runnable,
  onClick,
}: {
  state: NodePromptState;
  runnable: boolean;
  onClick: () => void;
}) {
  const label = state === "generating" ? "Running" : state === "complete" ? "Edit" : "Run";
  // Ghosted while there is nothing to run; dark pill once runnable or complete.
  const ghost = state === "generating" || (state !== "complete" && !runnable);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ghost}
      className={cn(
        "px-2.5 py-1 rounded-canvas-pill text-canvas-xs font-medium transition-colors shrink-0",
        ghost
          ? "bg-canvas-surface-inset text-canvas-ink-faint border-hairline border-canvas-border"
          : "bg-canvas-ink text-canvas-surface hover:opacity-90",
      )}
    >
      {label}
    </button>
  );
}
