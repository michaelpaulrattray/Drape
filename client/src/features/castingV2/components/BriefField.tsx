import { useLayoutEffect, useRef, type ComponentPropsWithRef } from "react";

import { useComposition } from "@/hooks/useComposition";
import { cn } from "@/lib/utils";

/**
 * The brief box, which can now be read.
 *
 * It was a single-line `<input>`. A brief is one sentence, so that was right
 * until briefs got long — and then it was quietly wrong in the way that matters
 * most for a paid action: past about sixty characters the beginning of your own
 * sentence scrolls out of the box, so the thing you are about to spend credits
 * on cannot be checked before you spend them. You could only ever see the end
 * of what you had typed.
 *
 * Four lines, then it scrolls. Four because it holds every real brief the
 * product has been given — the longest founder brief on file runs to about 340
 * characters, which is three lines at this width — while still leaving the dock
 * a dock. A box that grew without limit would push Roll again off the bottom of
 * the screen, which is the defect the shortlist tray was moved here to fix.
 *
 * It grows from one line rather than starting at four: an empty four-line box
 * is a form, and the resting state of this control should look like a place to
 * write a sentence.
 *
 * # AN ENTER PRESSED TO CONFIRM AN IME CONVERSION IS NOT AN ENTER
 *
 * The guard below is here because it was nearly LOST. The start page's hero was
 * the shadcn `Input`, which wraps its caller's `onKeyDown` in exactly this check
 * (`components/ui/input.tsx`) — so on that page, where Enter dispatches a
 * **160-credit roll**, a Japanese, Chinese or Korean customer pressing Enter to
 * accept a candidate mid-sentence never reached the page's handler. Swapping the
 * element for this one took the guard with it and left no failing test, because
 * the only other caller (the sheet) rolls from a BUTTON and so was never exposed.
 * That is working law 7's second half — a live control orphaned by a change
 * aimed at something else — caught in review rather than by a customer.
 *
 * So it lives HERE rather than at the one call site that needs it today: the box
 * is the thing that knows a composition is in progress, and the next surface to
 * put a submit on Enter should not have to rediscover this.
 */
export function BriefField({
  className,
  value,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  /*
    THE CALLER MAY HOLD IT TOO, and the box keeps its own hold either way.

    Two surfaces now put the caret in this box from somewhere else on the page
    (the start page's New-cast-member tile, and the concept card that fills it),
    and they should not have to find it by tag name — the selector that used to
    do that broke the day this stopped being an `<input>`.

    Merged rather than passed through: a forwarded `ref` landing in `...rest`
    would overwrite the internal one, and the internal one is what measures the
    height. The auto-grow would stop, silently, on exactly the long briefs it
    exists for.
  */
  ref: forwarded,
  ...rest
}: ComponentPropsWithRef<"textarea">) {
  const ref = useRef<HTMLTextAreaElement>(null);

  /*
    The IME guard, on the hook that already owns this for the whole client.

    `isComposing()` rather than the native flag alone: Safari fires
    `compositionend` BEFORE the keydown that ended it, so the native flag is
    already false on the very event that must not submit. The hook holds the
    just-ended window open across that gap; `input.tsx` learned it the hard way
    and it is the reason this is not one line of `event.nativeEvent.isComposing`.
  */
  const composition = useComposition<HTMLTextAreaElement>({
    onKeyDown: (event) => {
      const composing = event.nativeEvent.isComposing || composition.isComposing();
      if (event.key === "Enter" && composing) return;
      onKeyDown?.(event);
    },
    onCompositionStart,
    onCompositionEnd,
  });

  /*
    Measured, not guessed, and re-measured on every value change.

    `height: auto` first is load-bearing: `scrollHeight` on an element that is
    already tall enough reports the height it currently HAS, so without the
    reset the box can only ever grow. Deleting a line would leave the hole.

    Layout effect rather than effect, so the height is corrected before the
    browser paints. As a passive effect the box visibly jumps a frame after
    each keystroke that wraps.
  */
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    /*
      ⚠ **`hidden` BEFORE THE MEASUREMENT, AND IT IS NOT ONLY TIDINESS** (#435
      §2c). A scrollbar that is already showing takes width out of the content
      box, so the wrap points move and `scrollHeight` measures a NARROWER box
      than the one about to be painted. Reset it and the measurement is of the
      box as it will actually be.
    */
    field.style.overflowY = "hidden";
    field.style.height = "auto";
    /*
      The cap lives in CSS (`max-height`), so the measurement only has to
      decide the natural height — the browser clamps. Two places deciding the
      same maximum is how they come to disagree at some font size nobody
      tested.
    */
    const natural = field.scrollHeight;
    field.style.height = `${natural}px`;
    /*
      ⚠ **AND THE SCROLL WIDGET IS SWITCHED WHERE THE HEIGHT IS SWITCHED**
      (#435 §2c, his instruction: *"Set it in the same place you set the
      height"*).

      The stylesheet had `overflow-y: auto` on this box for as long as it has
      been a textarea. A `rows="1"` box whose content exceeds one line therefore
      exposed a scroll widget the `<input>` it replaced never had — and because
      `auto` is the resting value rather than a measured one, a box that had
      never been typed into could show one too. `clientHeight` after the clamp
      is the box as painted; if the content is taller, the cap has bitten and a
      scrollbar is honest. If it has not, there is nothing to scroll and the
      widget is noise on the product's primary control.
    */
    field.style.overflowY = natural > field.clientHeight ? "auto" : "hidden";
  }, [value]);

  return (
    <textarea
      ref={(node) => {
        ref.current = node;
        if (typeof forwarded === "function") forwarded(node);
        else if (forwarded) forwarded.current = node;
      }}
      value={value}
      rows={1}
      className={cn("dp-input", "dpc-brieffield", className)}
      onKeyDown={composition.onKeyDown}
      onCompositionStart={composition.onCompositionStart}
      onCompositionEnd={composition.onCompositionEnd}
      {...rest}
    />
  );
}
