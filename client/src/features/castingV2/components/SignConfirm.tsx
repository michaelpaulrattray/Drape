import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { CastingModal } from "@/foundation/CastingModal";
import { CAST_NAME_MAX_LENGTH } from "@shared/inputLimits";

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

  useEffect(() => { inputRef.current?.focus(); }, []);

  const disposition = personaLine?.trim() || null;

  return (
    <CastingModal
      label="Sign them to your roster"
      portrait={imageUrl}
      busy={busy}
      onDismiss={onCancel}
    >
          {/*
            The mono eyebrow, index and disposition. Every titled surface in the
            app opens with one; this modal was the exception.
          */}
          <span className="dpc-modal__eyebrow">
            CANDIDATE {indexLabel}
            {disposition ? ` · ${disposition.toUpperCase()}` : ""}
          </span>

          <h2 className="dpc-modal__title">Sign them to your roster</h2>

          {/*
            ONE line. The pricing and uniqueness sentences are deliberately not
            restored: the cost is stated below, and "can only be signed once" is
            implied by the roster itself.
          */}
          <p className="dpc-modal__explainer">
            Locks this face and builds five canonical views. Nothing else on the
            sheet changes.
          </p>

          <label className="dpc-modal__label" htmlFor="dpc-modal-name">
            THEIR NAME
          </label>
          <div className="dpc-modal__field">
            <input
              id="dpc-modal-name"
              ref={inputRef}
              value={name}
              maxLength={CAST_NAME_MAX_LENGTH}
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
          <span className="dpc-modal__cost">
            <span className="dpc-modal__tilde">~</span> {priceCredits} credits
          </span>

          <div className="dpc-modal__actions">
            <button
              type="button"
              className="dpc-modal__secondary"
              disabled={busy}
              onClick={onCancel}
            >
              Not yet
            </button>
            <button
              type="button"
              className="dpc-modal__primary"
              disabled={busy || !name.trim()}
              onClick={() => onConfirm(name.trim())}
            >
              {busy ? "Signing…" : "Sign to your roster"}
              {busy ? null : <ArrowRight size={12} strokeWidth={2.2} aria-hidden="true" />}
            </button>
          </div>
    </CastingModal>
  );
}
