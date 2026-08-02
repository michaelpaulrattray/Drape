import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The rename dialog (spec, 2026-08-03).
 *
 * **The defect it replaces was not styling.** The old dialog said "Rename this
 * cast?" and offered *Save name* — with nothing to type into. The one control
 * it existed for was missing. Its primary was also red, which signals danger on
 * the most harmless and most reversible action in the app, and collides with
 * both the coral that means *kept* and the coral that arms *Delete
 * permanently*.
 *
 * **Deliberately lighter than its siblings** — 428px and single-column, not the
 * 664px two-column shell that sign and delete share. Weight should track
 * stakes: those two are consequential, this is a text edit. That is the
 * reasoning behind every size difference here, so do not "unify" it back.
 *
 * **Solid `--ink` when ready, never red.** Ink is the system's constructive
 * commit colour. Inert while empty OR unchanged, which also stops the dialog
 * "saving" a no-op — the most common way it gets used by accident.
 *
 * Same containing-block warning as the others: this portals to `document.body`
 * so the scrim measures the viewport rather than some ancestor with a
 * `backdrop-filter`.
 */
export function RenameCastDialog({
  currentName,
  imageUrl,
  busy,
  onCancel,
  onSave,
}: {
  currentName: string;
  imageUrl: string | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = name.trim();
  const ready = trimmed.length > 0 && trimmed !== currentName.trim();

  useEffect(() => {
    /*
      Focused AND selected, so typing replaces rather than appends. A prefilled
      field you have to clear first is a field that fights you.
    */
    inputRef.current?.focus();
    inputRef.current?.select();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onCancel, busy]);

  const save = () => {
    // Re-checked here rather than trusted from the button's disabled state.
    if (!ready || busy) return;
    onSave(trimmed);
  };

  return createPortal(
    <div
      className="dpc-signm"
      role="dialog"
      aria-modal="true"
      aria-label={`Rename ${currentName}`}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div className="dpc-renamem" onClick={(event) => event.stopPropagation()}>
        <div className="dpc-renamem__head">
          <span className="dpc-renamem__thumb">
            {imageUrl ? <img src={imageUrl} alt="" /> : null}
          </span>
          <span>
            {/* The eyebrow names WHO — the old title said "this cast" and left
                the user to remember which card they clicked. */}
            <span className="dpc-signm__eyebrow">
              CAST MEMBER · {currentName.toUpperCase()}
            </span>
            {/* Not "Rename this cast?" — a question mark implies a consequence
                this action does not carry. */}
            <h2 className="dpc-renamem__title">Rename them</h2>
          </span>
        </div>

        <div>
          <div className="dpc-signm__field">
            <input
              ref={inputRef}
              value={name}
              maxLength={60}
              placeholder={currentName}
              disabled={busy}
              autoComplete="off"
              aria-label="Name"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") save();
              }}
            />
          </div>
          {/* BELOW the field: it is reassurance, not instruction, and should not
              stand between the user and the control they opened this for. */}
          <p className="dpc-renamem__helper">
            Only how you find them on the roster. Their face, views and takes are
            untouched.
          </p>
        </div>

        <div className="dpc-signm__actions">
          <button
            type="button"
            className="dpc-renamem__secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={ready ? "dpc-renamem__primary is-ready" : "dpc-renamem__primary"}
            disabled={busy || !ready}
            onClick={save}
          >
            {busy ? "Saving…" : "Save name"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
