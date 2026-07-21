/**
 * IdentityChangeDialog — the D-11 confirm for identity edits to a placed,
 * minted cast, as amended by D-43 (founder-ratified 2026-07-11): minted
 * identities are IMMUTABLE, so the dialog is FORK-OR-KEEP. There is no
 * update option and no red — fork destroys nothing (D-8's red now belongs
 * to delete-cascade alone). Cost is plan-derived (D-15).
 *
 * Batch C review corrections:
 *  - the dialog OWNS the round-trip (finding 7): it stays open with a
 *    pending state until the fork lands, and a free server refusal renders
 *    HERE, in context, with the user's changes intact — never as a toast
 *    over an already-closed takeover;
 *  - honest copy (founder ruling 1): brand/vibe are casting CONTEXT, not a
 *    physical identity change — the copy never claims otherwise.
 */
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

export function IdentityChangeDialog({
  boardId,
  itemId,
  changedLabels,
  contextOnly,
  rerun,
  pending,
  errorMessage,
  onCommit,
  onCancel,
}: {
  boardId: number;
  itemId: number;
  changedLabels: string[];
  /** True when ONLY casting context changed (brand/vibe) — the copy then
   *  explains context honestly instead of calling it a new person. */
  contextOnly: boolean;
  /** Profile fork: create a fresh draft without pretending fields were edited. */
  rerun?: boolean;
  /** The fork mutation is in flight — buttons hold, the dialog stays. */
  pending: boolean;
  /** A free server refusal, rendered in context (the session stays intact). */
  errorMessage: string | null;
  onCommit: (decision: "fork") => void;
  onCancel: () => void;
}) {
  const plan = trpc.boardOps.applyModelEdit.plan.useQuery({ boardId, itemId });
  const cost = plan.data?.estimatedCreditCost ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (!pending) onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel, pending]);

  return (
    <div className="canvas-scope absolute inset-0 z-30 flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(10,10,10,0.3)" }}
        onClick={() => {
          if (!pending) onCancel();
        }}
      />
      <div className="relative w-[420px] max-w-[92vw] bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md p-5">
        <p className="text-canvas-md font-medium text-canvas-ink mb-1.5">
          {rerun ? "Fork this cast?" : contextOnly ? "This casts someone new" : "This is a new person"}
        </p>
        {rerun ? (
          <p className="text-canvas-sm text-canvas-ink-soft leading-relaxed">
            The minted identity stays locked. Forking casts a separate draft from the same starting point.
          </p>
        ) : contextOnly ? (
          <p className="text-canvas-sm text-canvas-ink-soft leading-relaxed">
            Brand and vibe are casting context, not a change to who this person is — and a
            minted cast keeps its context. A fork carries your new {changedLabels.join(", ")} into a new draft.
          </p>
        ) : (
          <p className="text-canvas-sm text-canvas-ink-soft leading-relaxed">
            Changing {changedLabels.join(", ")} means casting someone new — this identity is
            minted and stays as it is.
          </p>
        )}
        <p className="text-canvas-sm text-canvas-ink-soft leading-relaxed mt-1.5 mb-5">
          Fork lands the new cast beside the original as an unnamed draft, connected by lineage.
        </p>

        {errorMessage && (
          <div className="mb-4 px-3 py-2 rounded-canvas-md bg-canvas-surface-inset text-canvas-sm text-canvas-ink leading-relaxed">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-3 py-1.5 rounded-canvas-pill text-canvas-xs text-canvas-ink-soft hover:text-canvas-ink transition-colors disabled:opacity-40"
          >
            {rerun ? "Keep cast" : "Keep editing"}
          </button>
          <button
            type="button"
            onClick={() => onCommit("fork")}
            disabled={pending}
            className="px-3 py-1.5 rounded-canvas-pill text-canvas-xs font-medium bg-canvas-ink text-canvas-surface hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {pending ? "Forking…" : "Fork as new model"}
            {!pending && cost !== null && (
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
