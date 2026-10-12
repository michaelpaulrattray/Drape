import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { CastingModal } from "./CastingModal";

/**
 * THE DIALOG NAMES THE WHOLE CHARACTER, AND ASKS FOR THE WHOLE NAME (#2432).
 *
 * It used the first word of the name everywhere: for "Leave Test" it read
 * "Delete Leave?", "TYPE LEAVE" and "Keep Leave" — a name the customer never
 * gave anything, on the one screen where being sure WHICH character goes is
 * the whole job.
 *
 * Up to `CONFIRM_NAME_MAX` characters the customer types the name they chose,
 * which proves they are looking at the right one. Past it the typing becomes
 * a chore with no extra safety (the title already names the character in
 * full), so the word is DELETE — the same word the account's own delete asks
 * for (`SecuritySection`). Matching ignores case and extra spaces, never
 * punctuation the customer can see in the placeholder.
 */
export const CONFIRM_NAME_MAX = 24;

/** One name, spaced the way it reads. */
function wholeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** What the customer types to arm the delete. */
export function deleteConfirmWord(name: string): string {
  const whole = wholeName(name);
  return whole.length > 0 && whole.length <= CONFIRM_NAME_MAX ? whole : "DELETE";
}

/** The cancel button: the name when it fits, a plain phrase when it does not. */
export function keepLabel(name: string): string {
  const whole = wholeName(name);
  return whole.length > 0 && whole.length <= CONFIRM_NAME_MAX ? `Keep ${whole}` : "Keep this character";
}

/** Case and spacing never decide it. */
export function confirmMatches(typed: string, word: string): boolean {
  return wholeName(typed).toLowerCase() === wholeName(word).toLowerCase();
}

/**
 * The delete-cast ceremony, rebuilt to the prototype (spec, 2026-08-03).
 *
 * It shares the sign modal's shell and differs in four deliberate ways, each of
 * which is the point rather than decoration:
 *
 *  - **The portrait is desaturated.** She is already half-gone. That does work
 *    no warning label can, and it is the single detail that makes this feel
 *    considered rather than generic.
 *  - **The warning lives in the eyebrow** — `PERMANENT · NOT REFUNDABLE`, read
 *    first — so the body collapses to one line about *what is lost* instead of
 *    two paragraphs explaining irreversibility.
 *  - **The confirm never takes the commit treatment.** Solid `--ink` is the
 *    system's "yes, proceed" — the same fill as *Sign to your roster*. A
 *    destructive action must not look identical to a constructive one. It sits
 *    inert until the name matches, then arms into the danger-zone treatment:
 *    coral border and wash, never a solid coral fill, because solid accent
 *    already means KEPT on a candidate card and a delete button in the kept
 *    colour is a genuine misread.
 *  - **No arrow.** The arrow means "forward, proceed" and is wrong here.
 *
 * **The body branches on signed state.** Warning an unsigned draft about
 * non-refundable credits is simply false — nothing was spent — and getting that
 * right is most of what separates a considered destructive flow from a
 * boilerplate one.
 */
export function DestructiveConfirm({
  name,
  imageUrl,
  signed = true,
  busy,
  onCancel,
  onConfirm,
}: {
  name: string;
  imageUrl: string | null;
  /** FALSE for a draft nothing has been built on — the copy changes. */
  signed?: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  /*
    Case-insensitive and space-forgiving, on the WHOLE name (#2432) — the
    first word alone named someone the customer never made. The placeholder
    shows exactly what to type, punctuation included.
  */
  const whole = wholeName(name);
  const word = deleteConfirmWord(name);
  const armed = confirmMatches(typed, word);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const confirm = () => {
    // Re-checked here rather than trusted from the button's disabled state.
    if (!armed || busy) return;
    onConfirm();
  };

  return (
    <CastingModal
      label={`Delete ${whole}?`}
      portrait={imageUrl}
      portraitMuted
      busy={busy}
      onDismiss={onCancel}
    >
      <span className="dpc-modal__eyebrow dpc-modal__eyebrow--danger">
        PERMANENT · NOT REFUNDABLE
      </span>

      <h2 className="dpc-modal__title">Delete {whole}?</h2>

      <p className="dpc-modal__explainer">
        {signed
          ? "Their signed face, all of their views and every take made with them "
            + "go for good, and the credits it cost don't come back. The casting they "
            + "came from is untouched."
          : "An unsigned draft — nothing has been built on them yet, so only this "
            + "card goes."}
      </p>

      {/*
        Label and field on ONE row, which is what recovers the height the two
        removed paragraphs were using.
      */}
      <div className="dpc-modal__typerow">
        <label className="dpc-modal__label" htmlFor="dpc-delete-confirm">
          TYPE {word.toUpperCase()}
        </label>
        <div className={armed ? "dpc-modal__field is-armed" : "dpc-modal__field"}>
          <input
            id="dpc-delete-confirm"
            ref={inputRef}
            value={typed}
            disabled={busy}
            autoComplete="off"
            placeholder={word}
            aria-label={`Type ${word} to confirm deletion`}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") confirm();
            }}
          />
          {armed ? (
            <Check size={13} strokeWidth={2.4} className="dpc-modal__match" aria-hidden="true" />
          ) : null}
        </div>
      </div>

      <div className="dpc-modal__actions">
        <button
          type="button"
          className="dpc-modal__secondary"
          disabled={busy}
          onClick={onCancel}
        >
          {keepLabel(name)}
        </button>
        <button
          type="button"
          className={armed ? "dpc-modal__danger is-armed" : "dpc-modal__danger"}
          disabled={busy || !armed}
          onClick={confirm}
        >
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </CastingModal>
  );
}
