import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The Sign confirmation (§H.1, D-15, and F2's ratified Sign law).
 *
 * A modal, for the same reason the discard confirmation is one: weight should
 * match consequence. Signing spends the largest single amount in the product
 * and it is the only action that creates something permanent — the candidate is
 * spent, the face is locked, and there is no un-signing.
 *
 * Three things here are rulings rather than preferences:
 *
 *  - **The price is on the affordance before it fires.** The founder lost 640
 *    credits to Follow reading as a free action; an unpriced button that spends
 *    is that mistake wearing a different hat.
 *  - **It says what the price includes** — the face lock and the complete view
 *    package — because "500 credits" on its own invites the reasonable
 *    assumption that the views cost extra later. They never do: there is no
 *    per-slot purchase anywhere in the product.
 *  - **One candidate per ceremony** (F2). The prototype's multi-select "Sign 3"
 *    is a prototype seam; signing three people is three deliberate ceremonies.
 *
 * It reuses the discard dialog's own surface rather than inventing a second
 * modal system — same scrim, same panel, same focus trap. The confirm button is
 * the accent rather than error red: this action is weighty but not destructive.
 *
 * **It leads with HER, not with her coordinates.** It used to open "Sign 02 ·
 * Quiet intensity" — a grid position, which is internal bookkeeping, at the
 * product's most important moment.
 *
 * **The name is required** (founder ruling, 2026-08-02): no Cast is ever born
 * "Unnamed". Focus lands on the field and the Sign button stays disabled until
 * it has content, so Enter can never spend anything by accident — which is the
 * property the drawn focus-on-Cancel default was protecting.
 */
export function SignConfirm({
  indexLabel,
  personaLine,
  imageUrl,
  priceCredits,
  viewCount,
  busy,
  onConfirm,
  onCancel,
}: {
  /** Kept for the accessible label only — it never appears on screen. */
  indexLabel: string;
  personaLine: string | null;
  /** Her face, at the size a decision this size deserves. */
  imageUrl: string | null;
  priceCredits: number;
  viewCount: number;
  busy: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!busy) onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>("button, input");
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
      Focus lands on the NAME, not on Cancel — the drawn safe-default belongs to
      a destructive dialog, and this one asks for something before it can
      proceed. The Sign button stays disabled until the field has content, so
      Enter cannot spend anything by accident.
    */
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [busy, onCancel]);

  return createPortal(
    <div
      className="dpc-confirm"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        className="dpc-confirm__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dpc-sign-title"
        aria-describedby="dpc-sign-body"
      >
        {/*
          HER FIRST, not her coordinates.

          This said "Sign 02 · Quiet intensity" — a grid position, which is
          internal bookkeeping, at the product's most important moment. The
          number is display metadata on a sheet and means nothing once she is a
          Cast. So the ceremony shows her face at a size worth deciding on, and
          the index survives only in the dialog's accessible name.
        */}
        {imageUrl ? (
          <div className="dpc-sign__portrait">
            <img src={imageUrl} alt="" />
          </div>
        ) : null}
        {personaLine ? <span className="dpc-sign__caption">{personaLine}</span> : null}

        <h2 id="dpc-sign-title" className="dpc-confirm__title">
          Sign her to your roster
        </h2>
        <p id="dpc-sign-body" className="dpc-confirm__body">
          This locks the face and builds the complete package — {viewCount} views of this exact
          person, included in the price. Nothing else on the sheet changes, and a candidate can
          only be signed once.
        </p>

        {/*
          NAMING IS PART OF THE CEREMONY (founder ruling, 2026-08-02). No Cast is
          ever born "Unnamed": a name is how she is found, referred to and cast
          later, and deferring it produces a roster of strangers. Required, and
          the button says so rather than failing silently on submit.
        */}
        <label className="dpc-sign__label" htmlFor="dpc-sign-name">
          Her name
        </label>
        <input
          id="dpc-sign-name"
          className="dp-input"
          value={name}
          maxLength={60}
          placeholder="Give her a name"
          disabled={busy}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && name.trim() && !busy) onConfirm(name.trim());
          }}
        />

        <div className="dpc-confirm__actions">
          <button
            ref={cancelRef}
            type="button"
            className="dpc-confirm__keep"
            onClick={onCancel}
            disabled={busy}
          >
            Not yet
          </button>
          <button
            type="button"
            className="dpc-confirm__sign"
            onClick={() => onConfirm(name.trim())}
            disabled={busy || !name.trim()}
          >
            {busy ? "Signing…" : `Sign to your roster · ${priceCredits} cr`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
