import { useEffect, useRef } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";

/**
 * The unsigned sheet card's overflow menu.
 *
 * A three-dot menu rather than a bare delete chip, at the founder's direction
 * and for a reason worth stating: a card that owns exactly one action should
 * show that action, but a card with several needs somewhere to keep them, and a
 * row of chips on a thumbnail is worse than a menu.
 *
 * **Only what exists.** The pattern this follows offers Duplicate, Rename and
 * Share; none of those are real here. A sheet has no name of its own — the
 * label is its latest roll's brief — nothing duplicates a session, and there is
 * no sharing model. Offering them greyed out would still be a claim. So the
 * menu is Open, Copy link and Delete, which is everything a sheet can actually
 * do today, and it grows when the operations do.
 *
 * Delete confirms inside the menu rather than in a system dialog. It was
 * `window.confirm` — the browser's chrome and a title bar reading localhost,
 * dropped into a monochrome editorial product.
 */
export function SheetCardMenu({
  label,
  open,
  armed,
  deleting,
  onToggle,
  onOpenSheet,
  onCopyLink,
  onArm,
  onCancel,
  onDelete,
}: {
  label: string;
  open: boolean;
  armed: boolean;
  deleting: boolean;
  onToggle: () => void;
  onOpenSheet: () => void;
  onCopyLink: () => void;
  onArm: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      onCancel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onCancel();
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onCancel]);

  return (
    <span className="dpc-sheetmenu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="dp-btn--onmedia dpc-sheetmenu__trigger"
        aria-label={`Actions for the sheet "${label}"`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        <MoreHorizontal size={14} strokeWidth={2} aria-hidden="true" />
      </button>

      {open ? (
        <span className="dpc-sheetmenu__panel" role="menu">
          {armed ? (
            /*
              The confirm replaces the menu's contents rather than opening a
              second layer on top of it. One surface, one decision — and the
              destructive item is the only thing on screen at the moment it
              matters.
            */
            <>
              <span className="dpc-sheetmenu__ask">Delete this sheet and its candidates?</span>
              <button
                type="button"
                role="menuitem"
                className="dpc-sheetmenu__item dpc-sheetmenu__item--danger"
                disabled={deleting}
                onClick={onDelete}
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
              <button type="button" role="menuitem" className="dpc-sheetmenu__item" onClick={onCancel}>
                Keep it
              </button>
            </>
          ) : (
            <>
              <button type="button" role="menuitem" className="dpc-sheetmenu__item" onClick={onOpenSheet}>
                Open sheet
              </button>
              <button type="button" role="menuitem" className="dpc-sheetmenu__item" onClick={onCopyLink}>
                Copy link
              </button>
              <span className="dpc-sheetmenu__rule" />
              <button
                type="button"
                role="menuitem"
                className="dpc-sheetmenu__item dpc-sheetmenu__item--danger"
                onClick={onArm}
              >
                <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
                Delete
              </button>
            </>
          )}
        </span>
      ) : null}
    </span>
  );
}
