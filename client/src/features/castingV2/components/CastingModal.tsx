import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The shell the sign, delete and concept-review dialogs share.
 *
 * All three describe the same object — a 664px two-column card with a 4:5
 * portrait, wrapping to stacked below ~560px — and it is built once with
 * different content rather than three times. Two copies of a scrim is two
 * chances for one of them to be mounted in the wrong place.
 *
 * ⚠ **It is NOT only "for spending and destroying" — #196 added a third
 * consumer that does neither.** The concept review shows a photograph beside
 * the words read out of it and confirms nothing but which text to keep; it
 * passes `busy={false}` always, because the `busy` latch below blocks Esc,
 * which is right in front of a charge and wrong in front of a free review. If a
 * fourth consumer arrives that cannot be abandoned, `busy` is still there for
 * it — what changed is that abandonment is now a first-class exit rather than
 * an exception.
 *
 * **⚠️ The scrim must measure the viewport, which is why this portals.** Any
 * ancestor with `backdrop-filter`, `filter`, `transform`, `perspective` or
 * `will-change` becomes a containing block, and `position: fixed; inset: 0`
 * then resolves against IT. The sheet's dock has `backdrop-filter`, so a dialog
 * mounted inside it renders as an off-screen sliver. Portalling to
 * `document.body` puts the scrim beyond the reach of all of them, and the
 * definition of done checks it: `getBoundingClientRect()` must equal
 * `{0, 0, innerWidth, innerHeight}`.
 *
 * The rename dialog deliberately does NOT use this shell — it is 428px and
 * single-column, because weight should track stakes and a rename is a text
 * edit. Do not "unify" it back in.
 */
export function CastingModal({
  label,
  portrait,
  portraitMuted = false,
  portraitWhole = false,
  busy,
  onDismiss,
  children,
}: {
  /** The dialog's accessible name. */
  label: string;
  portrait: string | null;
  /**
   * Desaturate the portrait — the delete dialog's strongest signal.
   *
   * The person is already half-gone, and that does work no warning label can.
   */
  portraitMuted?: boolean;
  /**
   * SHOW THE WHOLE PICTURE rather than filling the frame with it (#196).
   *
   * The default crops to 4:5, which is right for the two dialogs that show OUR
   * OWN renders — every one of them is already that shape. The concept review
   * shows a picture the CUSTOMER chose, of unknown proportions, and its entire
   * job is letting her check a description against it: a cover-crop can hide
   * the very thing the words are describing. Caught by looking at the frame, on
   * a 2:3 upload whose lower half was cropped away.
   */
  portraitWhole?: boolean;
  busy: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!busy) onDismiss();
        return;
      }
      if (event.key !== "Tab") return;
      /*
        Focus stays inside the dialog. `textarea` is in the list because the
        concept review's whole body is one — omit it and Tab walks straight out
        of the field she is editing into the page behind the scrim, which is
        the trap failing in the one dialog that has something worth typing in.

        ⚠ `:not(:disabled)` IS LOAD-BEARING, and the review of #196 found why.
        The wrap only fires when the active element is the FIRST or LAST of this
        list — so a list whose ends are DISABLED can never match, the trap never
        engages, and Tab falls through to the browser default, which skips
        disabled elements and walks straight out of the card. That is not an
        edge case: it is the concept review's OPENING state on every single use
        (`[textarea disabled, Discard, primary disabled]`, ~9 s), and Enter
        behind an open scrim reaches a live control, because a scrim stops
        clicks and not keys.

        The evidence pack's focus walk could not see it — that walk ran AFTER
        the words arrived, when all three are enabled. An arm taken in the state
        where the defect does not exist is not a reading of the state where it
        does.
      */
      const focusable = cardRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), textarea:not(:disabled)",
      );
      /*
        NOTHING TO FOCUS IS STILL THE TRAP'S PROBLEM — the class fix, not just
        this dialog's instance. A dialog whose every control is disabled (a sign
        or a delete mid-commit, `busy`) had the same escape, and returning early
        here would hand Tab back to the browser at exactly the moment the dialog
        is refusing to be dismissed. Swallowing the key keeps focus where it is,
        which is what a modal means.
      */
      if (!focusable || focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onDismiss, busy]);

  return createPortal(
    <div
      className="dpc-signm"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onDismiss();
      }}
    >
      {/* Clicks inside never dismiss — only the scrim does. */}
      <div
        ref={cardRef}
        className="dpc-signm__card"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={
            portraitWhole ? "dpc-signm__portrait dpc-signm__portrait--whole" : "dpc-signm__portrait"
          }
        >
          {portrait ? (
            <span className={portraitMuted ? "dpc-signm__muted" : undefined}>
              <img src={portrait} alt="" />
            </span>
          ) : null}
        </div>
        <div className="dpc-signm__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** The first name — full names carry trailing initials, and "Maya R.?" reads as a bug. */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}
