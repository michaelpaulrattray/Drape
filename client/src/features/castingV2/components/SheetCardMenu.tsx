import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 * Delete opens a confirmation dialog rather than resolving here. A permanent
 * delete of someone's work confirmed in a 178px popover, at the same visual
 * weight as "Copy link", was too quiet for what it does — weight should match
 * consequence.
 */
export function SheetCardMenu({
  label,
  open,
  onToggle,
  onOpenSheet,
  onCopyLink,
  onArm,
  onCancel,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  onOpenSheet: () => void;
  onCopyLink: () => void;
  onArm: () => void;
  onCancel: () => void;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);

  /*
    The panel is fixed-positioned in the viewport, so it has to be told where
    the trigger is — and re-told if the row scrolls or the window resizes
    underneath it. Cheaper and more predictable than leaving it open and
    wrong: a menu that drifts off its card is worse than one that closes.
  */
  useLayoutEffect(() => {
    if (!open) {
      setAt(null);
      return;
    }
    const place = () => {
      const box = triggerRef.current?.getBoundingClientRect();
      if (!box) return;
      setAt({ top: box.bottom + 6, right: window.innerWidth - box.right });
    };
    place();
    const row = rootRef.current?.closest(".dpc-sheetrow");
    row?.addEventListener("scroll", onCancel, { passive: true });
    window.addEventListener("resize", onCancel);
    return () => {
      row?.removeEventListener("scroll", onCancel);
      window.removeEventListener("resize", onCancel);
    };
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      /*
        The panel is portalled to body, so it is NOT inside rootRef any more.
        Checking only the root would fire this on the menu's own items:
        pointerdown closes the menu, the panel unmounts, and the click never
        lands on the button the user pressed.
      */
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
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
        className="dpc-sheetmenu__trigger"
        aria-label={`Actions for the sheet "${label}"`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        <MoreHorizontal size={14} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && at
        ? createPortal(
            /*
              Portalled, because the cards now live in a horizontally scrolling
              row and `overflow-x: auto` computes `overflow-y` to auto too. An
              absolutely-positioned panel inside that row would be clipped at
              its edge — which is exactly the defect the brief echo shipped a
              day ago, and there is no reason to rediscover it here.
            */
            <span
              ref={panelRef}
              className="dpc-sheetmenu__panel"
              role="menu"
              style={{ top: at.top, right: at.right }}
            >
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
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
