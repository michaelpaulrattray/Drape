import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

/**
 * Popover discipline, in one hook (brief 00 §5; grammar:
 * `docs/specs/Casting-ui-ux-design/design_handoff_studio/10-shared-patterns.md`
 * → *Popover discipline*).
 *
 * The grammar names four rules and every dropdown in the redesign owes all
 * four. They were prose until now, which is why the prototype's model picker
 * shipped clipped: a panel inside an `overflow: hidden` ancestor is invisible
 * however correct its own styles are, and each dropdown rediscovered that
 * separately. The fix is `position: fixed` — and the moment a panel is fixed it
 * needs the containing-block correction below, which is the part nobody
 * remembers. So it lives here once rather than in each component.
 *
 * The four rules, and what each is defending against:
 *
 * 1. **Capture-phase click-away keyed on a data-marker.** Bubble phase is not
 *    enough: a trigger inside a component that calls `stopPropagation()` — a
 *    card whose own click opens something — never lets the document listener
 *    see the event, and the panel stays open behind the new surface. The marker
 *    (rather than a ref containment test) is what lets a panel portal elsewhere
 *    in the DOM and still count as "inside".
 * 2. **Escape closes and focus returns to the trigger.** Otherwise focus lands
 *    on `<body>` and a keyboard user loses their place.
 * 3. **Fixed panels measure their trigger AND correct for containing-block
 *    ancestors.** See `panelStyle` below — this is the whole reason the hook
 *    exists.
 * 4. **Close on outside scroll, never on internal scroll.** A panel that closes
 *    when you scroll its own list is unusable; one that stays pinned to a
 *    coordinate while the page moves underneath is worse.
 *
 * ⚠ **This does not replace `Popover.tsx`.** That component is a live,
 * keyboard-complete listbox on the casting sentence, and brief 00 excludes
 * "any change to an existing primitive's API". A dropdown that needs fixed
 * positioning uses this hook; the sentence popover keeps working as it is.
 */

/** Marks a node as belonging to the popover, so a click inside it is not "outside". */
export const POPOVER_MARKER = "data-popover-surface";

export type PopoverPlacement = "bottom-start" | "bottom-end";

export type UsePopoverResult = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  close: () => void;
  /** Spread onto the trigger element. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  /** Spread onto the fixed panel element. */
  panelRef: RefObject<HTMLDivElement | null>;
  /** `position: fixed` coordinates, already corrected for the containing block. */
  panelStyle: CSSProperties;
  /** Marker props for any node that counts as inside the popover. */
  surfaceProps: Record<string, string>;
};

/**
 * THE CONTAINING-BLOCK CORRECTION — the one measurement everybody gets wrong.
 *
 * `position: fixed` is normally relative to the viewport, so
 * `getBoundingClientRect()` coordinates can be used directly. But a fixed
 * element is relative to the nearest ancestor that establishes a containing
 * block instead, and `transform`, `filter`, `perspective`, `backdrop-filter`,
 * `contain: paint` and `will-change` on any of those properties all do that.
 *
 * This app has such ancestors: the topbar is a `backdrop-filter` glass bar, and
 * framer-motion writes `transform` onto anything it animates. Inside one, the
 * panel lands offset by that ancestor's own position — the classic "my dropdown
 * is 56px too low" bug, which reproduces only on the surfaces that happen to
 * have a transformed parent.
 *
 * Rather than enumerate the properties (a list that is wrong the moment a
 * browser adds one), the offset is MEASURED: an empty fixed probe at 0,0
 * reports where the containing block's origin actually is, and the panel's
 * viewport coordinates are shifted by it. Zero in the ordinary case.
 */
function containingBlockOffset(panel: HTMLElement): { x: number; y: number } {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden";
  panel.parentElement?.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return { x: rect.left, y: rect.top };
}

export function usePopover({
  placement = "bottom-start",
  gap = 6,
}: { placement?: PopoverPlacement; gap?: number } = {}): UsePopoverResult {
  const [open, setOpenState] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpenState(false), []);
  const setOpen = useCallback((next: boolean) => setOpenState(next), []);
  const toggle = useCallback(() => setOpenState((was) => !was), []);

  /* Position once the panel exists, so its own width can be measured for
     `bottom-end`. A layout effect would be marginally smoother, but this runs
     before paint often enough and keeps the hook usable during SSR-less tests. */
  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const anchor = trigger.getBoundingClientRect();
    const offset = containingBlockOffset(panel);
    const left =
      placement === "bottom-end"
        ? anchor.right - panel.offsetWidth - offset.x
        : anchor.left - offset.x;
    setCoords({ top: anchor.bottom + gap - offset.y, left });
  }, [open, placement, gap]);

  useEffect(() => {
    if (!open) return;

    /*
      Rule 1 — CAPTURE phase, keyed on the marker. `composedPath()` rather than
      `contains()` so a panel rendered through a portal still reads as inside.
    */
    const onPointerDown = (event: PointerEvent) => {
      const inside = event
        .composedPath()
        .some((node) => node instanceof Element && node.hasAttribute(POPOVER_MARKER));
      if (!inside) setOpenState(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpenState(false);
      triggerRef.current?.focus();
    };

    /*
      Rule 4 — outside scroll closes, internal scroll does not. The listener is
      on the capture phase of `scroll`, which does not bubble; the target tells
      us which it was. A panel with its own scrolling list is the ordinary case,
      not the exception.
    */
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      setOpenState(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return {
    open,
    setOpen,
    toggle,
    close,
    triggerRef,
    panelRef,
    /* Hidden until measured: a panel painted at 0,0 for one frame is a visible
       flash in the top-left corner, which reads as a bug rather than a hop. */
    panelStyle: {
      position: "fixed",
      top: coords?.top ?? 0,
      left: coords?.left ?? 0,
      visibility: coords ? "visible" : "hidden",
    },
    surfaceProps: { [POPOVER_MARKER]: "" },
  };
}
