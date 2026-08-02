import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Trash2 } from "lucide-react";

/**
 * The roster card's overflow menu.
 *
 * The sheet card's grammar, applied to a signed Cast: a hover-revealed ⋮ that
 * portals its panel, because the roster grid scrolls and an absolutely
 * positioned panel inside a scrolling container is clipped at its edge.
 *
 * **Only what exists, and only what can happen.** Rename and Delete, and
 * Delete only when BOTH are true:
 *
 *  - the server says the permanent-deletion door is open
 *    (`models.deleteAvailability`), and
 *  - she has finished building.
 *
 * The second is the founder's ruling and it is the stricter reading of the
 * no-dead-controls law: the deletion authority excludes `provisioning` models
 * by design, so a Delete on a building tile could only ever refuse. *A menu
 * item that always refuses is a dead control, and the law does not take
 * exceptions for politeness.* The item appears when she finishes.
 *
 * Delete opens a confirmation rather than resolving here — a permanent delete
 * of someone's work, confirmed in a popover at the same weight as "Rename", is
 * too quiet for what it does. Weight matches consequence.
 */
export function CastCardMenu({
  name,
  open,
  canDelete,
  onToggle,
  onRename,
  onArmDelete,
  onCancel,
}: {
  name: string;
  open: boolean;
  /** False while she builds, and false while the door is shut. */
  canDelete: boolean;
  onToggle: () => void;
  onRename: () => void;
  onArmDelete: () => void;
  onCancel: () => void;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setAt(null);
      return;
    }
    const place = () => {
      const box = triggerRef.current?.getBoundingClientRect();
      if (!box) return;
      setAt({ top: box.bottom + 6, right: Math.max(8, window.innerWidth - box.right) });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onCancel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onCancel]);

  return (
    <span className="dpc-sheetmenu dpc-castmenu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="dpc-sheetmenu__trigger"
        aria-label={`Actions for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          // The card itself is a link to her room; the menu is not a way in.
          event.preventDefault();
          event.stopPropagation();
          onToggle();
        }}
      >
        <MoreHorizontal size={14} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && at
        ? createPortal(
          <span
            ref={panelRef}
            className="dpc-sheetmenu__panel"
            role="menu"
            style={{ top: at.top, right: at.right }}
          >
            <button type="button" role="menuitem" className="dpc-sheetmenu__item" onClick={onRename}>
              Rename
            </button>
            {canDelete ? (
              <>
                <span className="dpc-sheetmenu__rule" />
                <button
                  type="button"
                  role="menuitem"
                  className="dpc-sheetmenu__item dpc-sheetmenu__item--danger"
                  onClick={onArmDelete}
                >
                  <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
                  Delete
                </button>
              </>
            ) : null}
          </span>,
          document.body,
        )
        : null}
    </span>
  );
}
