import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The foundation's first popover.
 *
 * The reconciliation adopted "popover discipline" as a pattern in §3 and nobody
 * had built one, so this is it: **one open at a time, anchored to what was
 * clicked, dismissed by Escape, by an outside click, or by opening another.**
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
 */

export type PopoverOption = {
  value: string;
  label: string;
  /** The value currently in force, marked rather than merely highlighted. */
  current?: boolean;
};

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
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    /*
      Outside-click and Escape both close, and both are registered only while
      open. A listener that lives for the component's whole life runs on every
      click on the page for a control that is shut.
    */
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      // Focus goes back where it came from, or it lands on <body> and the
      // keyboard user loses their place in the sentence.
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    // Move focus into the panel so the first arrow key does something.
    const first = panelRef.current?.querySelector<HTMLElement>("[data-popover-option]");
    first?.focus();

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

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
    <span className="dp-pop">
      <button
        ref={triggerRef}
        type="button"
        className={cn("dp-pop__trigger", className)}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((was) => !was)}
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
