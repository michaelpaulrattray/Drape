import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The shell the sign and delete dialogs share.
 *
 * Both specs describe the same object — a 664px two-column card with a 4:5
 * portrait, wrapping to stacked below ~560px — and say to build it once with
 * different content rather than twice. Two copies of a scrim is two chances for
 * one of them to be mounted in the wrong place.
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
      // Focus stays inside a dialog that is about to spend or destroy.
      const focusable = cardRef.current?.querySelectorAll<HTMLElement>("button, input");
      if (!focusable || focusable.length === 0) return;
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
        <div className="dpc-signm__portrait">
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
