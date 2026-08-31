import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

/**
 * THE ANCHORED PANEL — one owner of how a panel opens, closes and lands.
 *
 * **His ruling, Crew reply #55 (2026-08-30), on #304: "Option one".** The
 * question put to him was whether *"collapse to one"* meant one COMPONENT or
 * one implementation of the BEHAVIOUR, and he chose the behaviour: one owner,
 * with shapes on top of it. This file is that owner.
 *
 * It replaces three implementations that had grown apart:
 *
 *   `CardMenu`      a menu of actions   — placement, portal, re-place on scroll
 *   `Popover.tsx`   a listbox on a word — keyboard walk, focus return, NO placement
 *   `usePopover`    a hook, no shape    — the containing-block correction, capture-phase click-away
 *
 * **Casting's implementation is the survivor** — his standing rule is that
 * casting is the only page in the live app with real design in it, so where the
 * three collide, `CardMenu`'s answer wins and anything the ruling does not
 * cover is whatever casting already did. What the other two had that casting's
 * lacked is folded in here rather than left somewhere else to be rediscovered.
 *
 * ## What it owns, and where each rule came from
 *
 * 1. **Placement from the trigger, in fixed coordinates** (casting's). The
 *    panel is told where the trigger is and re-told whenever anything scrolls
 *    or resizes underneath it. `position: fixed` is also what lets a panel out
 *    of an `overflow: hidden` ancestor, which is the bug every dropdown in the
 *    redesign rediscovered separately.
 * 2. **The containing-block correction** (folded in from `usePopover`, and the
 *    single most-forgotten measurement in this app — see below).
 * 3. **A viewport clamp, both edges** (casting's `Math.max(8, …)`, generalised).
 *    Casting clamped one side per alignment; the other side is clamped here
 *    too, and it can only ever bind where the unclamped answer put the panel
 *    off-screen.
 * 4. **RE-PLACE on scroll, never close** (casting's, and it supersedes
 *    `usePopover`'s rule 4 rather than losing it). That hook closed on an
 *    outside scroll for a stated reason — *"one that stays pinned to a
 *    coordinate while the page moves underneath is worse"* — which is a
 *    complaint about a panel that does NOT re-place. Casting's re-places, so
 *    the thing that rule was defending against cannot happen, and closing a
 *    panel because something scrolled behind it stops being necessary.
 * 5. **Capture-phase click-away keyed on a marker** (folded in from
 *    `usePopover`). Bubble phase is not enough: a trigger inside a card whose
 *    own click calls `stopPropagation()` never lets a bubble listener see the
 *    event, and the panel stays open behind whatever opened next.
 *    `composedPath()` rather than `contains()` so a portalled panel still reads
 *    as inside.
 * 6. **Escape closes AND focus returns to the trigger** (folded in — casting's
 *    menu closed but moved focus nowhere, so a keyboard user landed on
 *    `<body>` and lost their place).
 * 7. **One open at a time** (`Popover.tsx` promised this in prose and nothing
 *    implemented it — each instance held its own `useState`, so the brief
 *    echo's six adjustable words could all be open at once). It is a registry
 *    of one, here, where every panel already passes.
 *
 * ## What it does NOT own
 *
 * **Where the panel is mounted.** `CardMenu` portals to `document.body`
 * because its cards live in rows with `overflow-x: auto`; the sentence popover
 * and the lobby menus render in place. That is a question about the DOM, not
 * about behaviour, and each shape answers it.
 *
 * **The panel's looks.** Width, padding, border, shadow and z-index are the
 * shape's CSS. This hook writes `position`, `top`, `left` and `visibility` and
 * nothing else.
 *
 * ⚠ **`foundation/Topbar.tsx`'s account chip is deliberately NOT on this hook.**
 * It is a fourth hand-rolled owner of open/Escape/click-away; his ruling names
 * three and its own docblock states why it declined the hook. Bringing it
 * across would change the anchoring of a menu he approved, which is his call
 * and not a shift's — it is filed rather than decided.
 */

/** Marks a node as belonging to the panel, so a click inside it is not "outside". */
export const POPOVER_MARKER = "data-popover-surface";

/**
 * WHICH WAY THE PANEL OPENS — casting's names, kept (fable-543 §2).
 *
 * `fromTheRight` is the default and what every card menu had: the panel's right
 * edge lines up with the trigger's and it opens LEFTWARD, which is right for a
 * card in a grid whose dots sit at its top-right corner. On the version rail
 * that same rule threw the panel into the gutter at the window's edge, so
 * `fromTheLeft` lines the panel's LEFT edge up with the trigger's instead.
 *
 * (`usePopover` called these `bottom-end` and `bottom-start`. Same two
 * placements, and casting's spelling is the one that survives.)
 */
export type PanelAlign = "fromTheLeft" | "fromTheRight";

export type AnchoredPanel<P extends HTMLElement = HTMLDivElement> = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  close: () => void;
  /** Goes on the trigger button. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  /** Goes on the panel element. */
  panelRef: RefObject<P | null>;
  /** `position: fixed` coordinates, already corrected for the containing block. */
  panelStyle: CSSProperties;
  /**
   * TRUE ONCE THE PANEL HAS BEEN MEASURED AND IS ACTUALLY VISIBLE.
   *
   * A shape that moves focus into its panel on open MUST wait for this. The
   * panel is rendered `visibility: hidden` for one commit so its own width can
   * be measured, and `HTMLElement.focus()` on a hidden element does nothing at
   * all — silently, with no error. That is not a hypothetical: the sentence
   * popover lost its focus-into-the-panel exactly this way during #304, it
   * passed every source arm written about it, and it was caught only by driving
   * the running app (founder law 6).
   */
  placed: boolean;
  /** Marker props for any node that counts as inside the panel. */
  surfaceProps: Record<string, string>;
};

/** How close to the viewport edge a panel may sit. Casting's number. */
const EDGE = 8;

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
 * viewport coordinates are shifted by it. Zero in the ordinary case, which
 * includes every panel portalled to `document.body`.
 */
function containingBlockOffset(panel: HTMLElement): { x: number; y: number } {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden";
  panel.parentElement?.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return { x: rect.left, y: rect.top };
}

/*
  ONE OPEN AT A TIME — a registry of one, module-level.

  `Popover.tsx`'s header has claimed this since it was written ("dismissed by
  Escape, by an outside click, or by opening another") and nothing implemented
  it: every instance held its own `useState(false)`. The brief echo puts up to
  six adjustable words in one sentence, so six panels could be open together.

  A panel registers when it opens and closes whoever was open before it. It
  unregisters on close, so this only ever points at a panel that really is
  open — which is what keeps a parent-controlled set (the card menus, where one
  parent already holds a single open id) from closing the one it just opened.
*/
let openPanel: { close: () => void } | null = null;

export function useAnchoredPanel<P extends HTMLElement = HTMLDivElement>({
  align = "fromTheRight",
  gap = 6,
  nudgeX = 0,
  open: controlledOpen,
  onOpenChange,
}: {
  align?: PanelAlign;
  /** Distance between the trigger's bottom edge and the panel's top. */
  gap?: number;
  /**
   * A horizontal nudge applied to `fromTheLeft`, for a shape whose panel is
   * optically aligned to something other than the trigger's box — the sentence
   * popover hangs 12px to the left of its word so the option labels, not the
   * panel's padding, line up under it.
   */
  nudgeX?: number;
  /**
   * Pass this to hand the open state to the caller. The card menus are
   * controlled: their parent holds which single card has its menu open, and
   * that is the behaviour their surfaces already had.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}): AnchoredPanel<P> {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<P | null>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);
  const toggle = useCallback(() => setOpen(!open), [setOpen, open]);

  /*
    Placement. A layout effect rather than an ordinary one because the panel is
    already in the DOM by the time this runs — it is rendered hidden so its own
    width can be measured for `fromTheRight` — and measuring before paint is
    what keeps the hidden frame down to one.
  */
  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const anchor = trigger.getBoundingClientRect();
      const offset = containingBlockOffset(panel);
      const width = panel.offsetWidth;

      const wanted = align === "fromTheLeft" ? anchor.left + nudgeX : anchor.right - width;
      /* Both edges, where casting clamped the one its alignment could hit. The
         second bound can only bind where the unclamped answer put the panel
         off-screen, which is the case `fromTheLeft` was invented for. */
      const rightmost = Math.max(EDGE, window.innerWidth - EDGE - width);
      const left = Math.min(Math.max(wanted, EDGE), rightmost);

      setCoords({ top: anchor.bottom + gap - offset.y, left: left - offset.x });
    };

    place();
    /* Capture, because `scroll` does not bubble and the thing that moved is
       usually an ancestor rather than the document. */
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, align, gap, nudgeX]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const inside = event
        .composedPath()
        .some(
          (node) =>
            node === panelRef.current ||
            node === triggerRef.current ||
            (node instanceof Element && node.hasAttribute(POPOVER_MARKER)),
        );
      if (!inside) setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      // Or focus lands on <body> and a keyboard user loses their place.
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    const me = { close: () => setOpen(false) };
    const previous = openPanel;
    openPanel = me;
    if (previous) previous.close();
    return () => {
      if (openPanel === me) openPanel = null;
    };
  }, [open, setOpen]);

  return {
    open,
    setOpen,
    toggle,
    close,
    triggerRef,
    panelRef,
    /* Hidden until measured: a panel painted at 0,0 for one frame is a visible
       flash in the top-left corner, which reads as a bug rather than a hop. */
    placed: coords !== null,
    panelStyle: {
      position: "fixed",
      top: coords?.top ?? 0,
      left: coords?.left ?? 0,
      visibility: coords ? "visible" : "hidden",
    },
    surfaceProps: { [POPOVER_MARKER]: "" },
  };
}
