/**
 * The toast, and what a toast is FOR.
 *
 * **D-110: a toast is the fallback channel. It is never a second copy.**
 *
 * The rule is ownership, not precedence. Wherever a live surface owns the
 * action, D-40 governs and the feedback renders in place — the casting sheet
 * polls itself and every outcome already has a home on it (the failure banner,
 * the per-tile captions, the cancel line that counts refunds down, the notice
 * slot). Toasts govern the other case only: work with no surface to report to,
 * which is `GenerationOperationBridge`'s whole reason to exist — a canvas draft
 * landing on a board the user has navigated away from.
 *
 * So nothing here should be firing often, and **no toast may duplicate a notice
 * a surface already owns.** The founder watched "That roll was cancelled. 160
 * credits were refunded" arrive bottom-right while they were doing something
 * else entirely, describing something they had chosen on purpose and had
 * already watched resolve. That exclusion (`castingV2.roll`, 2026-08-01) was
 * the first instance of this law; D-110 is the law.
 *
 * # The form
 *
 * The ink pill from the foundation prototype: bottom-centre, fully rounded,
 * inverse of the page, one accent dot, ~2.1s. It replaces the flat white card
 * of the 2026-07-11 directive — **and that directive's "never restyle
 * per-surface" is unharmed.** It always meant one toast form everywhere rather
 * than a general form plus a casting form. What changed is which form that is.
 *
 * `--ink` and `--surface` invert together between themes, so the pill is always
 * the opposite of the page it floats over. `data-theme` lives on `<html>`, so
 * the portal resolves both.
 */
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-center"
      className="toaster group"
      gap={8}
      // ~2.1s, from the prototype. A pill is one short sentence; anything that
      // needs longer than this to read needed a surface, not a toast.
      duration={2100}
      /*
        ABOVE THE MODAL LAYER, which is why this is not the prototype's literal
        80. There, 80 sat above a modal layer at 40 and the number meant "on
        top of everything". Here 80 IS the top — `.dpc-confirm` uses it — so
        copying the digit would have put a toast level with, and sometimes
        under, the dialog it is reporting on. The intent is the law; the number
        is local to a stacking context.
      */
      style={
        {
          zIndex: 90,
          "--normal-bg": "var(--ink)",
          "--normal-text": "var(--surface)",
          "--normal-border": "transparent",
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          background: "var(--ink)",
          color: "var(--surface)",
          border: "none",
          borderRadius: 999,
          padding: "9px 15px",
          /*
            CENTRED INSIDE THE CONTAINER, which took three attempts to get
            right and is worth recording.

            Sonner centres its container (fixed width, translated half its own
            width) and positions each toast ABSOLUTELY inside it. So
            `margin: 0 auto` alone does nothing — measured, the pill sat flush
            left in a 356px box. Shrinking the container to `fit-content` was
            worse: its children are absolutely positioned, so it collapsed to
            zero width and the pill hung off the centre line.

            The form that works is the standard one for an absolutely
            positioned element: pin both edges and let auto margins share the
            slack.
          */
          width: "fit-content",
          left: 0,
          right: 0,
          marginLeft: "auto",
          marginRight: "auto",
          // `gap` is what separates the dot from the sentence; the dot itself
          // is drawn in CSS (see `foundation.css`) because this sonner build
          // renders no icon node at all for an untyped toast, which is nearly
          // every call site in the product.
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 12px 30px rgba(17, 17, 18, 0.22)",
          font: "500 11.5px/1.35 var(--font-sans)",
          letterSpacing: "0.005em",
        },
        classNames: {
          description: "opacity-70",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
