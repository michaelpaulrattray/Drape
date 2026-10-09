import { useEffect, useRef, useState } from "react";
import { displayPrice, formatCredits } from "@shared/creditDisplay";
import { ArrowRight } from "lucide-react";

import { CastingModal } from "@/foundation/CastingModal";
import { SIGN_VERSION_COPY, type SignVersion } from "@/features/castingV2/signVersion";
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
  imageUrl,
  signsVersion,
  priceCredits,
  busy,
  onConfirm,
  onCancel,
}: {
  /**
   * The sheet index — the eyebrow, in full.
   *
   * It used to be half of it: a candidate disposition followed it, and seeded
   * the name placeholder. Candidates are auditioners and carry no disposition
   * (his ruling, #1241), so the eyebrow is the index alone.
   */
  indexLabel: string;
  /** Her face, at the size a decision this size deserves. */
  imageUrl: string | null;
  /**
   * WHICH VERSION THAT FACE IS, when she has more than one (#1478, his ruling
   * **A**). `null` says nothing — she has never been edited, so there is no
   * version to name and naming one would invent the question.
   *
   * `signVersion.ts` holds the rule and the words; this component only draws
   * them. It is `null` while the answer is still being fetched and `null` if
   * the fetch fails, which is deliberate: the line is a claim about where the
   * Sign's credits are going, and silence is today's product while a wrong
   * sentence would be a new defect. (It said 8,500 until the flat price; the
   * figure is served, so no number belongs in this prose at all.)
   */
  signsVersion: SignVersion | null;
  /**
   * ⚠ **`null` MEANS THE PRICE HAS NOT BEEN READ, AND IT IS NOT THE SAME FACT
   * AS A PRICE OF ZERO — #1727.** The sheet's settings query races the roll
   * query on mount and can fail outright, so this arrives unread; under
   * `?? 0` the modal stated **`~ 0 credits`** over a button that spends the
   * Sign's whole flat charge.
   * The slot below draws an em dash instead, for the same reason the version
   * line above says nothing rather than guessing.
   */
  priceCredits: number | null;
  busy: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <CastingModal
      label="Sign them to your roster"
      portrait={imageUrl}
      busy={busy}
      onDismiss={onCancel}
    >
          {/*
            The mono eyebrow. Every titled surface in the app opens with one;
            this modal was the exception.
          */}
          <span className="dpc-modal__eyebrow">CANDIDATE {indexLabel}</span>

          <h2 className="dpc-modal__title">Sign them to your roster</h2>

          {/*
            ONE line. The pricing and uniqueness sentences are deliberately not
            restored: the cost is stated below, and "can only be signed once" is
            implied by the roster itself.
          */}
          <p className="dpc-modal__explainer">
            Locks this face and builds five matching views of them. Nothing else
            on the sheet changes.
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
              placeholder="e.g. Grounded"
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
            WHAT THIS IS ABOUT TO MAKE PERMANENT (#1478) — said last, because
            the button is next.

            Rendered only when she has been edited at all. On a face with one
            picture the sentence would name a distinction she does not have,
            which is the disappearing-technology law's own failure mode; the
            reasoning and the words both live in `signVersion.ts`.
          */}
          {signsVersion ? (
            <p className="dpc-modal__version">{SIGN_VERSION_COPY[signsVersion]}</p>
          ) : null}

          {/*
            ⚠ **THE TILDE IS GONE — #1968, AND IT IS A FACT CHANGING RATHER THAN
            A COPY PREFERENCE.** It read *"Approximate, and the tilde stays:
            generation cost varies, and a number presented as exact that then
            differs is worse than one that never claimed to be."* That was true
            of a price with a refundable per-view slice: what a Sign finally
            cost DID vary, because a view that failed gave part of it back, so
            the figure on this button was genuinely an estimate.

            His word of 2026-10-08 makes it exact. A Sign is one flat charge,
            the only refund is the whole of it when nothing is delivered at all,
            and no partial outcome moves the number — so there is nothing left
            for a hedge to be honest about, and a tilde in front of an exact
            price is now the thing that misleads.

            ⚠ **AND THE WHOLE CLAIM STANDS DOWN WHEN THE PRICE IS UNREAD
            (#1727) — the SLOT stays, the sentence goes.** The tilde and the
            word `credits` are both part of the claim, so an unread price keeps
            none of them: a hedge in front of nothing is still a sentence about
            a price. What it must not do is disappear, because
            `.dpc-modal__cost + .dpc-modal__actions` zeroes the actions' own
            top margin — omitting the element would walk the buttons up the
            card and then back down when the figure landed, which is the
            layout shift the em-dash convention exists to avoid.
          */}
          <span className="dpc-modal__cost">
            {priceCredits === null ? (
              "—"
            ) : (
              <>{formatCredits(displayPrice(priceCredits))} credits</>
            )}
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
