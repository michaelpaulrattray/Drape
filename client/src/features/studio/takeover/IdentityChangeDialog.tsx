/**
 * IdentityChangeDialog — the D-11 confirm for identity edits to a placed,
 * minted cast (R3). Every save in a minted-edit session lands here; the
 * options are the ratified set: update-with-cascade (RED confirm per D-8 —
 * the cast becomes a different person), fork-as-new-model (original
 * untouched; the fork lands as an unnamed draft beside it, D-42), or cancel.
 * Costs are plan-derived (D-15) — never client literals.
 *
 * Styled in the canvas language (new surface — survives the R6 restyle).
 */
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

export function IdentityChangeDialog({
  boardId,
  itemId,
  changedLabels,
  onCommit,
  onCancel,
}: {
  boardId: number;
  itemId: number;
  changedLabels: string[];
  onCommit: (decision: "update" | "fork") => void;
  onCancel: () => void;
}) {
  const plan = trpc.boardOps.applyModelEdit.plan.useQuery({ boardId, itemId });
  const cost = plan.data?.estimatedCreditCost ?? null;
  const affectedViews = plan.data?.affectedViewCount ?? 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="canvas-scope absolute inset-0 z-30 flex items-center justify-center">
      <div className="absolute inset-0" style={{ background: "rgba(10,10,10,0.3)" }} onClick={onCancel} />
      <div className="relative w-[420px] max-w-[92vw] bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md p-5">
        <p className="text-canvas-md font-medium text-canvas-ink mb-1.5">
          This is an identity change
        </p>
        <p className="text-canvas-sm text-canvas-ink-soft leading-relaxed">
          Changing {changedLabels.join(", ")} makes this a different person.
        </p>
        <p className="text-canvas-sm text-canvas-ink-soft leading-relaxed mt-1.5 mb-5">
          {affectedViews > 0
            ? `${affectedViews} view${affectedViews === 1 ? "" : "s"} will go out of sync until refreshed.`
            : "No views exist yet — the update applies directly."}
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-canvas-pill text-canvas-xs text-canvas-ink-soft hover:text-canvas-ink transition-colors"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={() => onCommit("fork")}
            title="The original stays untouched — a new unnamed draft lands beside it"
            className="px-3 py-1.5 rounded-canvas-pill text-canvas-xs font-medium text-canvas-ink border-hairline border-canvas-border-strong hover:border-canvas-ink transition-colors"
          >
            Fork as new model
          </button>
          <button
            type="button"
            onClick={() => onCommit("update")}
            // D-8: the one red mark — this confirm destroys the previous identity
            className="px-3 py-1.5 rounded-canvas-pill text-canvas-xs font-medium text-white transition-opacity hover:opacity-90 inline-flex items-center gap-1.5"
            style={{ background: "var(--color-canvas-destructive, #B3261E)" }}
          >
            Update this cast
            {cost !== null && (
              <span className="opacity-80 font-normal">
                <CostLabelInverse credits={cost} />
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Inverse-color cost readout for the red confirm — value is plan-derived (D-15). */
function CostLabelInverse({ credits }: { credits: number }) {
  return <span className="whitespace-nowrap">~{credits.toLocaleString()} credits</span>;
}
