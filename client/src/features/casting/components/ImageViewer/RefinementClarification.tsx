import type { CastingClarification } from "@shared/castingClarification";

interface RefinementClarificationProps {
  clarification: CastingClarification;
  onChoose: (instruction: string) => void;
  onDescribe: () => void;
}

/** A free server follow-up beside the composer. A pill prepares the precise
 * instruction; the visibly priced Apply button remains the generation door. */
export function RefinementClarification({
  clarification,
  onChoose,
  onDescribe,
}: RefinementClarificationProps) {
  return (
    <section
      data-casting-clarification={clarification.kind}
      aria-labelledby="casting-clarification-question"
      className="mx-auto mb-2 w-full max-w-2xl rounded-canvas-lg border-hairline border-canvas-border-strong bg-canvas-surface p-3"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 id="casting-clarification-question" className="text-canvas-md font-medium text-canvas-ink">
            {clarification.question}
          </h3>
          <p className="mt-0.5 text-canvas-sm text-canvas-ink-faint">{clarification.detail}</p>
        </div>
        <button
          type="button"
          onClick={onDescribe}
          className="flex-shrink-0 text-canvas-sm font-medium text-canvas-ink-soft hover:text-canvas-ink"
        >
          I'll describe it
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={clarification.question}>
        {clarification.choices.map((choice) => (
          <button
            key={choice.label}
            type="button"
            onClick={() => onChoose(choice.instruction)}
            className="rounded-canvas-pill border-hairline border-canvas-border-strong px-3 py-1.5 text-canvas-sm font-medium text-canvas-ink transition-colors hover:bg-canvas-surface-inset"
          >
            {choice.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-canvas-xs text-canvas-ink-faint">
        Your choice fills the refinement field. Review it, then apply when ready.
      </p>
    </section>
  );
}
