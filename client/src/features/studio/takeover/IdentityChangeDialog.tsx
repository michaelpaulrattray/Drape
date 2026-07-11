/**
 * IdentityChangeDialog — the D-11 confirm for identity edits to a placed,
 * minted cast, as amended by D-43 (founder-ratified 2026-07-11): minted
 * identities are IMMUTABLE, so the dialog is FORK-OR-KEEP. There is no
 * update option and no red — fork destroys nothing (D-8's red now belongs
 * to delete-cascade alone). The copy teaches the model: changing identity
 * fields means casting someone new. Cost is plan-derived (D-15).
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
  onCommit: (decision: "fork") => void;
  onCancel: () => void;
}) {
  const plan = trpc.boardOps.applyModelEdit.plan.useQuery({ boardId, itemId });
  const cost = plan.data?.estimatedCreditCost ?? null;

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
          This is a new person
        </p>
        <p className="text-canvas-sm text-canvas-ink-soft leading-relaxed">
          Changing {changedLabels.join(", ")} means casting someone new — this identity is
          minted and stays as it is.
        </p>
        <p className="text-canvas-sm text-canvas-ink-soft leading-relaxed mt-1.5 mb-5">
          Fork lands the new cast beside the original as an unnamed draft, connected by lineage.
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
            className="px-3 py-1.5 rounded-canvas-pill text-canvas-xs font-medium bg-canvas-ink text-canvas-surface hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
          >
            Fork as new model
            {cost !== null && (
              <span className="opacity-70 font-normal whitespace-nowrap">
                ~{cost.toLocaleString()} credits
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
