import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

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
 */
export function BriefField({
  className,
  value,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

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
    field.style.height = "auto";
    /*
      The cap lives in CSS (`max-height`), so the measurement only has to
      decide the natural height — the browser clamps and turns on the
      scrollbar. Two places deciding the same maximum is how they come to
      disagree at some font size nobody tested.
    */
    field.style.height = `${field.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      className={cn("dp-input", "dpc-brieffield", className)}
      {...rest}
    />
  );
}
