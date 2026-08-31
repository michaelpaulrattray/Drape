import { useEffect, useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useAnchoredPanel } from "./useAnchoredPanel";

/**
 * The word-picker inside a sentence — a listbox on a word.
 *
 * One instance with many anchors, not many popovers. The brief echo has up to
 * six adjustable words in a single sentence, and six independently-stateful
 * popovers on one line is how you get two open at once and a stacking-order
 * problem nobody can reproduce.
 *
 * Keyboard is not a bolt-on here. The trigger is a real button carrying
 * `aria-expanded` and `aria-haspopup`, focus moves into the panel on open and
 * returns to the trigger on Escape, and arrow keys walk the options — because
 * the founder's condition was full keyboard treatment on the underlined spans,
 * and a control you can only reach with a mouse is a control half the people
 * using it do not have.
 *
 * ---------------------------------------------------------------------------
 * **#304 — this is now a SHAPE on `useAnchoredPanel`.** His ruling was "Option
 * one": one owner of the behaviour, two shapes on it. Open state, Escape,
 * outside-click and placement are the owner's; what stays here is what makes
 * this a LISTBOX rather than a menu — the arrow-key walk, focus landing on the
 * first option, and the option/footer markup.
 *
 * Two things changed underneath, and both are stated because neither is
 * invisible:
 *
 * 1. ⚠ **"One open at a time" is now true.** This header has claimed it since
 *    the file was written and nothing implemented it — every instance held its
 *    own `useState(false)`, so all six words in the echo could be open
 *    together. Measured on the foundation page before the collapse: clicking a
 *    second word left **two** panels open. The owner keeps a registry of one.
 * 2. ⚠ **The panel is placed from the WORD, not from the word's line box.** It
 *    was `position: absolute; top: calc(100% + 9px); left: -12px` against the
 *    inline `.dp-pop` wrapper, whose rect is a line box and therefore a few
 *    font-metric pixels shy of the button inside it. The 9px and the −12px are
 *    kept exactly; the anchor is the trigger, so the panel now sits a measured
 *    9.00px under the word where it sat 5.56px under it — **3.44px lower**,
 *    nothing sideways. That is a measurement rather than an estimate
 *    (`output/304/placement-*.json`), and it is the difference between a gap
 *    that holds at one font size and one that holds at every font size: the
 *    old distance was 9px minus whatever the line box happened to add.
 */

export type PopoverOption = {
  value: string;
  label: string;
  /** The value currently in force, marked rather than merely highlighted. */
  current?: boolean;
};

/**
 * The design's own two numbers, kept: the panel hangs 9px under the word and
 * 12px to its left, so the option labels rather than the panel's padding line
 * up under the word.
 */
const GAP = 9;
const NUDGE_X = -12;

export function Popover({
  label,
  heading,
  options,
  footer,
  onSelect,
  className,
  children,
}: {
  /** Accessible name for the trigger — says what clicking it would adjust. */
  label: string;
  /** Small caps heading inside the panel. */
  heading: string;
  options: PopoverOption[];
  /** A last action below a rule, e.g. "Let age vary". */
  footer?: { label: string; onSelect: () => void } | null;
  onSelect: (value: string) => void;
  className?: string;
  /** The trigger's visible content — a word inside a sentence. */
  children: ReactNode;
}) {
  const panel = useAnchoredPanel({ align: "fromTheLeft", gap: GAP, nudgeX: NUDGE_X });
  const { open, placed, setOpen, triggerRef, panelRef } = panel;
  const panelId = useId();

  useEffect(() => {
    /*
      ⚠ ON `placed`, NOT ON `open`. The panel spends one commit hidden while the
      owner measures its width, and `focus()` on a `visibility: hidden` element
      does nothing and reports nothing. Keyed on `open` alone this ran during
      that commit and the first arrow key went nowhere — which passed every
      source arm and was caught by driving the app (founder law 6).
    */
    if (!open || !placed) return;
    // Move focus into the panel so the first arrow key does something.
    const first = panelRef.current?.querySelector<HTMLElement>("[data-popover-option]");
    first?.focus();
  }, [open, placed, panelRef]);

  const walk = (event: React.KeyboardEvent, direction: 1 | -1) => {
    event.preventDefault();
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>("[data-popover-option]") ?? [],
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = (index + direction + items.length) % items.length;
    items[next]?.focus();
  };

  const choose = (run: () => void) => {
    run();
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <span className="dp-pop" {...panel.surfaceProps}>
      <button
        ref={triggerRef}
        type="button"
        className={cn("dp-pop__trigger", className)}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(!open)}
      >
        {children}
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="listbox"
          aria-label={heading}
          className="dp-pop__panel"
          style={panel.panelStyle}
          {...panel.surfaceProps}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") walk(event, 1);
            if (event.key === "ArrowUp") walk(event, -1);
          }}
        >
          <span className="dp-pop__heading">{heading}</span>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.current === true}
              data-popover-option
              className="dp-pop__option"
              onClick={() => choose(() => onSelect(option.value))}
            >
              {option.label}
              {option.current ? <span className="dp-pop__mark" aria-hidden="true" /> : null}
            </button>
          ))}
          {footer ? (
            <>
              <span className="dp-pop__rule" />
              <button
                type="button"
                data-popover-option
                className="dp-pop__option dp-pop__option--quiet"
                onClick={() => choose(footer.onSelect)}
              >
                {footer.label}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
