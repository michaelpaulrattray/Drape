import { createPortal } from "react-dom";
import { MoreHorizontal, Trash2 } from "lucide-react";

import { useAnchoredPanel, type PanelAlign } from "./useAnchoredPanel";

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
 *
 * ---------------------------------------------------------------------------
 * **#304 — this is now a SHAPE, and the behaviour under it is shared.** His
 * ruling was "Option one": one owner of how a panel opens, closes and lands,
 * with shapes on top. What used to be this file's own placement, outside-click
 * and Escape handling moved to `useAnchoredPanel`, which is CASTING'S
 * implementation — this one — with two things folded in that it lacked: the
 * containing-block correction, and focus returning to the trigger on Escape.
 *
 * ⚠ **Nothing about this component's API changed and nothing about its
 * placement moved**, which is measured rather than asserted: both card menus
 * and the foundation specimen were read in the running app before and after,
 * and the panel sits at the same offset from its trigger in each
 * (`output/304/placement-*.json`).
 */

export type CardMenuItem = {
  label: string;
  onSelect: () => void;
  /** Destructive: separated by a rule and coloured on hover. */
  danger?: boolean;
  /**
   * THE QUIET LINE UNDER THE LABEL — what this costs, before the click.
   *
   * D-109 keeps a price OUT of button text and the UI contract requires a paid
   * action to say what it costs before it is taken. Both are satisfied by
   * saying it here: the label is the action, the meta line is the price, and it
   * is read in the same glance rather than discovered on a receipt.
   *
   * Absent on every free item, which is all of them until a paid one arrives.
   */
  meta?: string;
};

export function CardMenu({
  label,
  items,
  open,
  onToggle,
  onCancel,
  align = "fromTheRight",
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
  /**
   * WHICH WAY THE PANEL OPENS — per usage, because the right answer depends on
   * where the host sits (fable-543 §2).
   *
   * `fromTheRight` is the default and what every caller had: the panel's right
   * edge lines up with the trigger's and it opens LEFTWARD, which is right for
   * a card in a grid whose dots sit at its top-right corner.
   *
   * On the version rail that same rule threw the panel into the gutter at the
   * window's edge — a control appearing somewhere other than where you clicked
   * reads as broken, which is the one impression this surface exists to avoid.
   * `fromTheLeft` lines the panel's LEFT edge up with the trigger's instead, so
   * it opens toward the picture.
   *
   * A per-usage option rather than a smarter default: the placement of the
   * sheet's and the roster's menus is measured byte-identical across this
   * change (`measure-cardmenu-placement-disposable.mts`), which is what makes
   * touching a shared component safe rather than hopeful.
   *
   * The two names are the OWNER's type rather than a copy of it — a second
   * union shadowing the first is working law 4, and these are the placements
   * every shape on the owner shares.
   */
  align?: PanelAlign;
}) {
  /*
    THE SHARED OWNER, in controlled mode. The open state stays the caller's —
    a roster holds which single card has its menu open, and that is the
    behaviour those surfaces already had — so the hook is told `open` and
    reports a close rather than keeping state of its own.
  */
  const panel = useAnchoredPanel<HTMLSpanElement>({
    align,
    open,
    onOpenChange: (next) => {
      if (!next) onCancel();
    },
  });

  if (items.length === 0) return null;

  return (
    <span className="dpc-cardmenu" {...panel.surfaceProps}>
      <button
        ref={panel.triggerRef}
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

      {open
        ? createPortal(
          /*
            Portalled, because these cards live in scrolling rows and
            `overflow-x: auto` computes `overflow-y` to auto too. An absolutely
            positioned panel inside that row is clipped at its edge. Where the
            panel is MOUNTED is the shape's question; where it LANDS is the
            owner's, and `panelStyle` is that answer.
          */
          <span
            ref={panel.panelRef}
            className="dpc-cardmenu__panel"
            role="menu"
            style={panel.panelStyle}
            {...panel.surfaceProps}
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
                  {/* The action and, UNDER it, what it costs — a column inside
                      the row so the icon stays beside the label and the price
                      gets its own line (D-109: never in the button text). */}
                  <span className="dpc-cardmenu__lines">
                    <span className="dpc-cardmenu__label">{item.label}</span>
                    {item.meta ? <span className="dpc-cardmenu__meta">{item.meta}</span> : null}
                  </span>
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
