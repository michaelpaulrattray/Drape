import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { CastingModal, firstNameOf } from "./CastingModal";

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
export function DeleteCastConfirm({
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
    Case-insensitive, trimmed, FIRST NAME only. Requiring an exact-case full
    name is friction without safety — and full names carry trailing initials,
    so "type Maya R." asks for punctuation nobody will guess.
  */
  const first = firstNameOf(name);
  const armed = typed.trim().toLowerCase() === first.toLowerCase();

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
      label={`Delete ${first}?`}
      portrait={imageUrl}
      portraitMuted
      busy={busy}
      onDismiss={onCancel}
    >
      <span className="dpc-signm__eyebrow dpc-signm__eyebrow--danger">
        PERMANENT · NOT REFUNDABLE
      </span>

      <h2 className="dpc-signm__title">Delete {first}?</h2>

      <p className="dpc-signm__explainer">
        {signed
          ? "Their signed face, every canonical view and every take made with them "
            + "go for good, and the credits it cost don't come back. The sheet they "
            + "were cast from is untouched."
          : "An unsigned draft — nothing has been built on them yet, so only this "
            + "card goes."}
      </p>

      {/*
        Label and field on ONE row, which is what recovers the height the two
        removed paragraphs were using.
      */}
      <div className="dpc-signm__typerow">
        <label className="dpc-signm__label" htmlFor="dpc-delete-confirm">
          TYPE {first.toUpperCase()}
        </label>
        <div className={armed ? "dpc-signm__field is-armed" : "dpc-signm__field"}>
          <input
            id="dpc-delete-confirm"
            ref={inputRef}
            value={typed}
            disabled={busy}
            autoComplete="off"
            placeholder={first}
            aria-label={`Type ${first} to confirm deletion`}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") confirm();
            }}
          />
          {armed ? (
            <Check size={13} strokeWidth={2.4} className="dpc-signm__match" aria-hidden="true" />
          ) : null}
        </div>
      </div>

      <div className="dpc-signm__actions">
        <button
          type="button"
          className="dpc-signm__secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Keep {first}
        </button>
        <button
          type="button"
          className={armed ? "dpc-signm__danger is-armed" : "dpc-signm__danger"}
          disabled={busy || !armed}
          onClick={confirm}
        >
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </CastingModal>
  );
}
