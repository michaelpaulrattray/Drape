import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight } from "lucide-react";

/**
 * The sign-to-roster modal, rebuilt to the prototype (spec, 2026-08-03).
 *
 * The version it replaces broke four system rules at once, and the first is the
 * one that made it look foreign:
 *
 *  - **Accent means STATE — kept, locked, signed, running — never a button
 *    fill.** A washed-accent CTA reads as disabled, and it collided with the
 *    kept-ring on the card behind the scrim. Every primary action in this
 *    product is solid `--ink` with `--surface` text.
 *  - A four-line paragraph where the house voice is one short line.
 *  - No mono eyebrow. Every titled surface in the app opens with one, and its
 *    absence was most of why this read as someone else's dialog.
 *  - A vertical stack. The modal grew out of a 4:5 candidate card and should
 *    echo that card rather than become a generic centred box.
 *
 * **The scrim mounts at the top of the view, never inside the dock.** The dock
 * carries `backdrop-filter`, which makes it a containing block — `position:
 * fixed; inset: 0` would then resolve against the dock rather than the viewport
 * and the modal would render as an off-screen sliver. Portalling to
 * `document.body` puts it beyond the reach of any such ancestor, which is the
 * same reason the viewer is portalled.
 *
 * **The name is still required**, which is the one place this departs from the
 * spec's behaviour notes: naming is part of the ceremony by founder ruling
 * (2026-08-02) and the server's input schema refuses an absent name outright.
 * Enabling the button without one would only produce a refusal.
 */
export function SignConfirm({
  indexLabel,
  personaLine,
  imageUrl,
  priceCredits,
  busy,
  onConfirm,
  onCancel,
}: {
  /** The sheet index — the eyebrow's first half. */
  indexLabel: string;
  /** Her disposition — the eyebrow's second half, and the placeholder's seed. */
  personaLine: string | null;
  /** Her face, at the size a decision this size deserves. */
  imageUrl: string | null;
  priceCredits: number;
  busy: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!busy) onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      // Focus stays inside a modal that is about to spend money.
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
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onCancel, busy]);

  const disposition = personaLine?.trim() || null;

  return createPortal(
    <div
      className="dpc-signm"
      role="dialog"
      aria-modal="true"
      aria-label="Sign them to your roster"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      {/* Clicks inside never dismiss — only the scrim does. */}
      <div
        ref={panelRef}
        className="dpc-signm__card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dpc-signm__portrait">
          {imageUrl ? <img src={imageUrl} alt="" /> : null}
        </div>

        <div className="dpc-signm__body">
          {/*
            The mono eyebrow, index and disposition. Every titled surface in the
            app opens with one; this modal was the exception.
          */}
          <span className="dpc-signm__eyebrow">
            CANDIDATE {indexLabel}
            {disposition ? ` · ${disposition.toUpperCase()}` : ""}
          </span>

          <h2 className="dpc-signm__title">Sign them to your roster</h2>

          {/*
            ONE line. The pricing and uniqueness sentences are deliberately not
            restored: the cost is stated below, and "can only be signed once" is
            implied by the roster itself.
          */}
          <p className="dpc-signm__explainer">
            Locks this face and builds five canonical views. Nothing else on the
            sheet changes.
          </p>

          <label className="dpc-signm__label" htmlFor="dpc-signm-name">
            THEIR NAME
          </label>
          <div className="dpc-signm__field">
            <input
              id="dpc-signm-name"
              ref={inputRef}
              value={name}
              maxLength={60}
              placeholder={disposition ? `e.g. ${disposition}` : "e.g. Grounded"}
              disabled={busy}
              autoComplete="off"
              aria-label={`Name for candidate ${indexLabel}`}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && name.trim() && !busy) onConfirm(name.trim());
              }}
            />
          </div>

          {/*
            Approximate, and the tilde stays: generation cost varies, and a
            number presented as exact that then differs is worse than one that
            never claimed to be.
          */}
          <span className="dpc-signm__cost">
            <span className="dpc-signm__tilde">~</span> {priceCredits} credits
          </span>

          <div className="dpc-signm__actions">
            <button
              type="button"
              className="dpc-signm__secondary"
              disabled={busy}
              onClick={onCancel}
            >
              Not yet
            </button>
            <button
              type="button"
              className="dpc-signm__primary"
              disabled={busy || !name.trim()}
              onClick={() => onConfirm(name.trim())}
            >
              {busy ? "Signing…" : "Sign to your roster"}
              {busy ? null : <ArrowRight size={12} strokeWidth={2.2} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
