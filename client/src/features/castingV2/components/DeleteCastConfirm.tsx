import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/foundation";

/**
 * The permanent-deletion ceremony for a signed Cast.
 *
 * D-64 made this deletion final: manifests, tombstones, a bounded worker that
 * removes the objects. Nothing here is recoverable and nothing is refunded, so
 * the confirmation asks for the one thing a mis-click cannot produce — **her
 * name, typed.**
 *
 * The copy is deliberately specific about what leaves with her. "Are you sure?"
 * is a question nobody reads; a list of what is about to stop existing is one
 * they do. And it says the money plainly, because the alternative is someone
 * discovering afterwards that 450 credits went with a Cast they deleted while
 * tidying up.
 *
 * Her image leads, for the same reason the Sign confirm leads with it: this is
 * a decision about a person, not about a row.
 */
export function DeleteCastConfirm({
  name,
  imageUrl,
  busy,
  onCancel,
  onConfirm,
}: {
  name: string;
  imageUrl: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onCancel, busy]);

  return createPortal(
    <div className="dpc-confirm" role="dialog" aria-modal="true">
      <div className="dpc-confirm__panel">
        {imageUrl ? (
          <div className="dpc-sign__portrait">
            <img src={imageUrl} alt="" />
          </div>
        ) : null}
        <span className="dpc-sign__caption">{name}</span>
        <h2 className="dpc-confirm__title">Delete {name}?</h2>
        <p className="dpc-confirm__body">
          This is permanent and it is not refundable. Her signed face, her whole
          package and any takes made with her are removed for good — and the
          credits her Sign cost do not come back.
        </p>
        <p className="dpc-confirm__body">
          Anything else from the sheet she came from is untouched — other casts
          you signed from it stay, and so do their siblings.
        </p>

        <label className="dpc-sign__label" htmlFor="delete-cast-confirm">
          Type <strong>{name}</strong> to confirm
        </label>
        <input
          id="delete-cast-confirm"
          ref={inputRef}
          className="dp-input"
          value={typed}
          disabled={busy}
          autoComplete="off"
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && matches && !busy) onConfirm();
          }}
          aria-label={`Type ${name} to confirm deletion`}
        />

        <div className="dpc-confirm__actions">
          <Button variant="quiet" size="small" disabled={busy} onClick={onCancel}>
            Keep her
          </Button>
          <Button
            variant="primary"
            size="small"
            disabled={busy || !matches}
            onClick={onConfirm}
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
