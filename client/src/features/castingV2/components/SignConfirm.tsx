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
 * modal system — same scrim, same panel, same focus trap. The one deliberate
 * difference is the confirm button: this action is weighty but not destructive,
 * so it is the accent rather than error red, and FOCUS STARTS ON CANCEL for the
 * same reason it does there — Enter should never spend 500 credits because a
 * dialog opened under someone's finger.
 *
 * The name is optional and says so. A Cast with no name shows its Klieg id
 * until its owner gives it one, which is a better first minute than a required
 * field standing between someone and the thing they just decided to buy.
 */
export function SignConfirm({
  indexLabel,
  personaLine,
  priceCredits,
  viewCount,
  busy,
  onConfirm,
  onCancel,
}: {
  indexLabel: string;
  personaLine: string | null;
  priceCredits: number;
  viewCount: number;
  busy: boolean;
  onConfirm: (name: string | null) => void;
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
    cancelRef.current?.focus();
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
        <h2 id="dpc-sign-title" className="dpc-confirm__title">
          Sign {indexLabel}
        </h2>
        <p id="dpc-sign-body" className="dpc-confirm__body">
          {personaLine ? `${personaLine}. ` : ""}
          This locks the face and builds the complete package — {viewCount} views of this exact
          person, included in the price. Nothing else on the sheet changes, and a candidate can
          only be signed once.
        </p>

        <label className="dpc-sign__label" htmlFor="dpc-sign-name">
          Name — optional, and you can add it later
        </label>
        <input
          id="dpc-sign-name"
          className="dp-input"
          value={name}
          maxLength={60}
          placeholder="Unnamed"
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
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
            onClick={() => onConfirm(name.trim() || null)}
            disabled={busy}
          >
            {busy ? "Signing…" : `Sign · ${priceCredits} cr`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
