import type { ReactNode } from "react";

interface CastingDescribeStartProps {
  briefField: ReactNode;
  onSurprise: () => void;
  onOpenDetails: () => void;
}

interface DescribeStartVisibility {
  hasAssets: boolean;
  hasExistingModel: boolean;
  isReadOnly: boolean;
  mintedEdit: boolean;
  detailsOpen: boolean;
}

export function shouldShowCastingDescribeStart({
  hasAssets,
  hasExistingModel,
  isReadOnly,
  mintedEdit,
  detailsOpen,
}: DescribeStartVisibility) {
  return !hasAssets && !hasExistingModel && !isReadOnly && !mintedEdit && !detailsOpen;
}

/**
 * Act 1 of Casting: one sentence is the whole room. The expert selector sheet
 * remains one deliberate click away and translation never starts generation.
 */
export function CastingDescribeStart({
  briefField,
  onSurprise,
  onOpenDetails,
}: CastingDescribeStartProps) {
  return (
    <section
      data-casting-describe-start
      className="flex-1 min-h-0 flex items-center justify-center px-5 py-10"
      style={{
        background: "var(--color-canvas-field)",
        backgroundImage: "radial-gradient(circle, var(--color-canvas-field-dot) 0.75px, transparent 0.75px)",
        backgroundSize: "24px 24px",
      }}
      aria-labelledby="casting-describe-title"
    >
      <div className="w-full max-w-[640px] text-center">
        <h2
          id="casting-describe-title"
          className="font-medium text-canvas-ink tracking-[-0.01em]"
          style={{ fontSize: 22 }}
        >
          Cast a model
        </h2>
        <p className="mt-2 text-canvas-md text-canvas-ink-faint">
          Describe them, and the studio sets everything up.
        </p>

        <div className="mt-7 text-left">{briefField}</div>

        <div className="mt-5 flex items-center justify-center gap-4 text-canvas-md">
          <button
            type="button"
            onClick={onSurprise}
            className="rounded-canvas-sm text-canvas-ink-soft transition-colors hover:text-canvas-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-canvas-ink"
          >
            Surprise me
          </button>
          <span aria-hidden="true" className="text-canvas-border-strong">·</span>
          <button
            type="button"
            onClick={onOpenDetails}
            className="rounded-canvas-sm text-canvas-ink-soft transition-colors hover:text-canvas-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-canvas-ink"
          >
            Set details myself
          </button>
        </div>
      </div>
    </section>
  );
}

export default CastingDescribeStart;
