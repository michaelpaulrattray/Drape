import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * A destructive confirmation, in our own voice.
 *
 * The third home for this decision, and the reasoning is worth keeping. It was
 * `window.confirm` — the browser's chrome and a title bar reading localhost,
 * dropped into a monochrome editorial product. Then it armed inside the card's
 * menu, which was ours but small: a permanent delete of someone's work
 * confirmed in a 178px popover, in the same visual weight as "Copy link".
 *
 * A modal is right here because the action is not reversible. Weight should
 * match consequence, and the one thing this surface must not do is let a
 * permanent delete feel like a menu pick.
 *
 * On brand rather than borrowed: our surface, our radius, Archivo, the scrim we
 * already use for the candidate viewer, and error red on exactly one element.
 * The reference outlines its destructive button; ours fills it, because in this
 * system an outline reads as secondary and the destructive action is the
 * primary thing being asked about.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  busyLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      /*
        Focus stays inside. A destructive dialog that lets Tab wander back to
        the page behind it invites the user to answer a question they can no
        longer see.
      */
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>("button");
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

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The safe option takes focus, not the destructive one. Enter should never
    // delete something because the dialog opened under the user's finger.
    cancelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [onCancel]);

  return createPortal(
    <div
      className="dpc-confirm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={panelRef}
        className="dpc-confirm__panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dpc-confirm-title"
        aria-describedby="dpc-confirm-body"
      >
        <h2 id="dpc-confirm-title" className="dpc-confirm__title">
          {title}
        </h2>
        <p id="dpc-confirm-body" className="dpc-confirm__body">
          {body}
        </p>
        <div className="dpc-confirm__actions">
          <button
            ref={cancelRef}
            type="button"
            className="dpc-confirm__keep"
            onClick={onCancel}
            disabled={busy}
          >
            Keep it
          </button>
          <button type="button" className="dpc-confirm__go" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
