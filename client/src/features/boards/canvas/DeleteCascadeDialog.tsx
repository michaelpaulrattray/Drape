/**
 * DeleteCascadeDialog — the cascade-confirm before deleting a root whose
 * views fall with it (Decision 7). This is THE one red confirm in the app:
 * D-8 as sharpened by D-43 scopes red to delete-cascade alone. Plain deletes
 * never see this dialog — they soft-delete straight to the Undo toast.
 * Canvas language: hairline, no shadow, light scrim (DS §9 dialog spec).
 */
export function DeleteCascadeDialog({
  cascadeCount,
  onConfirm,
  onCancel,
}: {
  /** Connected views that fall with the selection (beyond the selection itself). */
  cascadeCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onCancel} />
      <div className="relative w-[400px] bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md shadow-none p-5">
        <p className="text-canvas-md font-medium text-canvas-ink">Delete this cast?</p>
        <p className="text-canvas-xs text-canvas-ink-soft mt-1.5 leading-relaxed">
          {cascadeCount === 1
            ? "Its connected view falls with it — they delete as one unit."
            : `Its ${cascadeCount} connected views fall with it — they delete as one unit.`}{" "}
          Undo brings everything back together.
        </p>
        <div className="flex justify-end gap-1.5 mt-4">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-canvas-pill text-canvas-xs text-canvas-ink-soft hover:bg-canvas-surface-inset transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3.5 py-1.5 rounded-canvas-pill text-canvas-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--color-canvas-destructive)" }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
