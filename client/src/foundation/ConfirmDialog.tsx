import { useEffect, useId, useRef, useState } from "react";
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
 *
 * ## ⚠ Two additions from brief 09, and why they are here rather than at a call site
 *
 * His §4a: *"Unfreeze routes through the promoted confirm dialog, with the
 * notes field inside it. The dialog already handles required-input-before-
 * arming, from the delete-cast spec."*
 *
 * Half of that was already true and half was not. `DestructiveConfirm` does
 * hold required-input-before-arming — but its input is **typing a cast's first
 * name** beside a desaturated portrait. It is the delete-cast ceremony, not a
 * general dialog. So the behaviour he is pointing at moves HERE, where any
 * staff action can reach it, as an **optional** block:
 *
 *  - **`notes`** — a label, a placeholder and a `maxLength`, and the confirm
 *    sits inert until the text is non-empty. The dialog owns the state, so no
 *    call site can forget to clear it between openings.
 *  - **`cancelLabel`** — because the hard-lettered *"Keep it"* is cast wording.
 *    On *"Freeze this account?"* it reads as an answer to a different question.
 *
 * Both default to the previous behaviour, so the four existing callers are
 * untouched by construction rather than by inspection.
 *
 * ⚠ **The notes text is passed to `onConfirm`, never read back through a ref.**
 * A dialog that owns a required field and then makes the caller fetch it is one
 * refactor away from confirming with an empty string.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  busyLabel,
  busy,
  notes,
  cancelLabel = "Keep it",
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  /** Present = a required note, and the confirm stays inert until it is typed. */
  notes?: { label: string; placeholder: string; maxLength: number };
  cancelLabel?: string;
  onConfirm: (notes: string) => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const notesId = useId();
  const [typed, setTyped] = useState("");
  const armed = !notes || typed.trim().length > 0;

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
      /*
        ⚠ `textarea` joined this selector with the notes block. Trapping only
        buttons would have let Tab walk out of a dialog that now contains the
        one control the reader has to use — the trap would still have LOOKED
        like a trap, and the arm proving it holds is the only thing that could
        tell the difference.
      */
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>("button, textarea");
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
    /*
      The safe option takes focus, not the destructive one. Enter should never
      delete something because the dialog opened under the user's finger.

      ⚠ **With a required note the field takes focus instead, and the safety
      argument above is not weakened by it — it is what makes it possible.** The
      danger that sentence names is Enter reaching an armed destructive button;
      here the button is INERT until text exists, and Enter inside a textarea
      inserts a newline. Landing the reader on the cancel button and asking them
      to Tab backwards to the only control they must use would be friction with
      no safety bought.
    */
    if (notesRef.current) notesRef.current.focus();
    else cancelRef.current?.focus();

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
        {notes && (
          <div className="dpc-confirm__notes">
            <label className="dpc-confirm__noteslabel" htmlFor={notesId}>
              {notes.label}
            </label>
            <textarea
              ref={notesRef}
              id={notesId}
              className="dpc-confirm__notesfield"
              value={typed}
              placeholder={notes.placeholder}
              maxLength={notes.maxLength}
              rows={3}
              disabled={busy}
              onChange={(event) => setTyped(event.target.value)}
            />
            {/* The counter is derived from the same prop the field is capped by,
                so the two cannot disagree — the third-copy defect from #396. */}
            <p className="dpc-confirm__notescount">
              {typed.length}/{notes.maxLength}
            </p>
          </div>
        )}
        <div className="dpc-confirm__actions">
          <button
            ref={cancelRef}
            type="button"
            className="dpc-confirm__keep"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="dpc-confirm__go"
            onClick={() => onConfirm(typed.trim())}
            disabled={busy || !armed}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
