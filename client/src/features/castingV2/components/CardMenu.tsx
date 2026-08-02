import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Trash2 } from "lucide-react";

/**
 * THE overflow menu. One component, one behaviour, everywhere.
 *
 * There were two of these — the sheet card's and the roster card's — grown
 * apart in the usual way: same placement logic, same outside-click handling,
 * same panel, different reveal rules and different treatments. The room needed
 * a third. Three copies of a hover rule is three chances for two of them to be
 * wrong, so there is now one.
 *
 * **The reveal ladder (founder ruling, 2026-08-03).** The dots were invisible
 * until pointed at directly, which is a control you can only find by knowing it
 * is there:
 *
 *   resting     absent
 *   card hover  the dots appear, on a soft fill
 *   dots hover  the fill goes solid — white or black per theme
 *
 * The middle rung is the one that was missing. Hovering the *card* is the
 * gesture that means "I am interested in this thing", and that is when its
 * actions should show themselves; hovering the dots is already a decision and
 * only needs confirming.
 *
 * **Placement is the caller's.** The sheet and roster cards pin it to a corner;
 * the room sits it beside the name. The component owns the trigger, the panel
 * and the behaviour — never where it lives. What every caller must supply is a
 * host element carrying `dpc-menuhost`, which is what the first rung hangs off.
 */

export type CardMenuItem = {
  label: string;
  onSelect: () => void;
  /** Destructive: separated by a rule and coloured on hover. */
  danger?: boolean;
};

export function CardMenu({
  label,
  items,
  open,
  onToggle,
  onCancel,
}: {
  /** Names the subject, for the trigger's accessible name. */
  label: string;
  /**
   * What this card can do. Items that cannot happen are ABSENT, never
   * disabled — a menu entry that always refuses is a dead control, and the
   * no-dead-controls law does not take exceptions for politeness.
   */
  items: readonly CardMenuItem[];
  open: boolean;
  onToggle: () => void;
  onCancel: () => void;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);

  /*
    The panel is fixed-positioned in the viewport, so it has to be told where
    the trigger is — and re-told if anything scrolls or resizes underneath it.
    Cheaper and more predictable than leaving it open and wrong: a menu that
    drifts off its card is worse than one that closes.
  */
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

  if (items.length === 0) return null;

  return (
    <span className="dpc-cardmenu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="dpc-cardmenu__trigger"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          // The card beneath is usually a link. The menu is not a way into it.
          event.preventDefault();
          event.stopPropagation();
          onToggle();
        }}
      >
        <MoreHorizontal size={14} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && at
        ? createPortal(
          /*
            Portalled, because these cards live in scrolling rows and
            `overflow-x: auto` computes `overflow-y` to auto too. An absolutely
            positioned panel inside that row is clipped at its edge.
          */
          <span
            ref={panelRef}
            className="dpc-cardmenu__panel"
            role="menu"
            style={{ top: at.top, right: at.right }}
          >
            {items.map((item, index) => (
              <span key={item.label}>
                {item.danger && index > 0 ? <span className="dpc-cardmenu__rule" /> : null}
                <button
                  type="button"
                  role="menuitem"
                  className={item.danger
                    ? "dpc-cardmenu__item dpc-cardmenu__item--danger"
                    : "dpc-cardmenu__item"}
                  onClick={item.onSelect}
                >
                  {item.danger ? <Trash2 size={12} strokeWidth={2} aria-hidden="true" /> : null}
                  {item.label}
                </button>
              </span>
            ))}
          </span>,
          document.body,
        )
        : null}
    </span>
  );
}
