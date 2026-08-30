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
/**
 * THE SHELL'S BEHAVIOUR, ON ITS OWN — the portal, the scrim, Escape, the focus
 * trap and the outside-click dismiss, with the CARD left to the caller.
 *
 * Split out on the founder's ruling of 2026-08-30 (#262), verbatim: *"Build the
 * three dialogs on the promoted shell, not beside it. Rename, delete-by-typing
 * and sign are one shell with different contents — that's what the specs say,
 * and if they land as three independent components they'll drift the way the
 * popovers did."*
 *
 * ⚠ **The drift he is describing had already happened, which is why this split
 * and not a merge.** The rename dialog built its own `createPortal`, its own
 * scrim `<div className="dpc-modal">` and its own Escape handler, and borrowed
 * the shell's classes for the rest — so there were two owners of "what a modal
 * DOES" and one of them had no focus trap at all. What varies between the three
 * is the card: 664px and two-column for sign and delete, 428px and single-column
 * for the rename, because weight tracks stakes and a rename is a text edit. That
 * difference is CONTENT, and it survives; the behaviour underneath does not get
 * a second copy.
 *
 * The card element is rendered HERE rather than by the caller, because the focus
 * trap needs a ref to the thing that contains the focusables and a trap whose
 * boundary is supplied by each consumer is a trap each consumer can get wrong.
 */
export function ModalScrim({
  label,
  cardClassName,
  busy,
  onDismiss,
  children,
}: {
  label: string;
  /** The card's own class — this is where the three dialogs differ. */
  cardClassName: string;
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
      const focusable = Array.from(
        cardRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), textarea:not(:disabled)",
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      /*
        NOTHING TO FOCUS IS STILL THE TRAP'S PROBLEM — the class fix, not just
        this dialog's instance. A dialog whose every control is disabled (a sign
        or a delete mid-commit, `busy`) had the same escape, and returning early
        here would hand Tab back to the browser at exactly the moment the dialog
        is refusing to be dismissed. Swallowing the key keeps focus where it is,
        which is what a modal means.
      */
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      /*
        ⚠ AND FOCUS MAY NOT EVEN BE INSIDE THE CARD — the second review of #196,
        and it is the sharper half of the same defect. The wrap below fires only
        when the active element is this list's first or last member; with focus
        OUTSIDE the card and the list non-empty, neither branch matches and Tab
        falls through to the browser, straight into the page behind the scrim.

        That is not hypothetical for the concept review: its opener DISABLES
        itself on the pick, so the browser drops focus to `body` before the
        dialog has mounted. Every other consumer takes focus on mount and so
        never exposed it — the shell has always relied on a precondition none of
        them wrote down. Pulling focus back in is the sweep; the mount-focus in
        the consumer is the instance.
      */
      if (cardRef.current && !cardRef.current.contains(document.activeElement)) {
        event.preventDefault();
        focusable[0].focus();
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
      className="dpc-modal"
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
        className={cardClassName}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function CastingModal({
  label,
  portrait,
  portraitMuted = false,
  portraitWhole = false,
  portraitFallback,
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
  /**
   * WHAT STANDS IN THE PORTRAIT SLOT WHEN THERE IS NO PICTURE YET (#196,
   * amendment 2).
   *
   * Every consumer until now had its subject before the dialog existed — you
   * cannot sign or delete a candidate you have not chosen. The concept review
   * can now be opened by tapping the card with no file at all (his second
   * amendment: *"i can click the card and it opens up the modal and then i can
   * upload or drag and drop the reference image in"*), and the empty slot is
   * exactly where the drop zone belongs — it is the picture-shaped hole the
   * picture is about to fill.
   *
   * Absent, the slot stays what it has always been: the `--media` fill, which
   * is the right answer for a portrait that is merely still loading.
   */
  portraitFallback?: ReactNode;
  busy: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
  return (
    <ModalScrim label={label} cardClassName="dpc-modal__card" busy={busy} onDismiss={onDismiss}>
      <div
        className={
          portraitWhole ? "dpc-modal__portrait dpc-modal__portrait--whole" : "dpc-modal__portrait"
        }
      >
        {portrait ? (
          <span className={portraitMuted ? "dpc-modal__muted" : undefined}>
            <img src={portrait} alt="" />
          </span>
        ) : (portraitFallback ?? null)}
      </div>
      <div className="dpc-modal__body">{children}</div>
    </ModalScrim>
  );
}

/** The first name — full names carry trailing initials, and "Maya R.?" reads as a bug. */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}
