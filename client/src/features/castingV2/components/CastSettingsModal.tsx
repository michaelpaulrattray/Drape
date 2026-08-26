import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Settings2, X } from "lucide-react";

import { ScopePill } from "@/foundation";
import {
  CAST_STYLE_LINES,
  CAST_STYLE_NAMES,
  CAST_STYLES,
  COMING_CAST_STYLES,
  DEFAULT_CAST_STYLE,
  type CastStyle,
} from "@shared/castStyles";
import { DEFAULT_IMAGINATION, type Imagination } from "@shared/imagination";

import { castSettingsSummary } from "../castSettingsCopy";
import { ImaginationToggle } from "./ImaginationToggle";

/**
 * THE MINIMAL SETTINGS MODAL (#142 — the author road's control surface; his
 * word, 2026-08-26: *"do it - add the minimal settings modal to N1"*). The
 * design it is cut from is `CASTING_SETTINGS_MODAL_DESIGN.md` §10 (his six
 * rulings) read against `PROMPT_AUTHOR_RULING_2026-08-26.md` §3, and the
 * reference is his Higgsfield "Film setup" screenshot
 * (`docs/specs/references/settings-modal-higgsfield-reference.png`) — the bones
 * transfer (a title, Reset, a close, one line of what each setting does, a
 * default that names itself), the picture-per-option carousel does not.
 *
 * What it holds, and nothing else:
 *   STYLE        — one live option today, Photoreal, the only style and the
 *                  default (rule 11a: a style is a bundle; the locked block is
 *                  chosen by it, `houseBlockForStyle`). Under it, his two named
 *                  styles as COMING SOON rows — labelled, non-interactive,
 *                  described never IP-named (rule 9; §10b: *"coming soon
 *                  features so the modal stays true"*). An announcement is not
 *                  a dead control; a disabled pill would be (D-180).
 *   IMAGINATION  — the meter (slice E) moved in here, its home (§10 ruling 2:
 *                  *"selected inside the modal as a setting not outside of
 *                  it"*). Same component, same two words.
 * No framing, lighting or background controls — advanced, N3. The modal never
 * shows the block's text.
 *
 * SETTINGS ARE DEFAULTS; THE PROMPT OVERRIDES (rule 8, in the footer line, in
 * the customer's words). EPHEMERAL (§10 ruling 4): the values live in the
 * page's own state and nowhere else, so leaving the page resets them by
 * construction — no store, no cookie, no stale-settings class.
 *
 * Drawn ONLY on the author road (`config.authorRoadEnabled`), like the meter it
 * replaces on the surface: an account off the road has nothing that reads
 * either value, so the gear is ABSENT rather than disabled and the entrance is
 * byte-identical for every other account.
 *
 * Its own shell rather than `CastingModal`'s: that card is a 664px two-column
 * portrait dialog built for spending and destroying; this is a 440px
 * single-column settings panel, and weight should track stakes (the rename
 * dialog makes the same argument). It portals for `CastingModal`'s reason —
 * the sheet's dock has `backdrop-filter`, which would make a fixed scrim
 * resolve against the dock instead of the viewport.
 */
export function CastSettingsModal({
  style,
  imagination,
  onStyle,
  onImagination,
  onDismiss,
}: {
  style: CastStyle;
  imagination: Imagination;
  onStyle: (style: CastStyle) => void;
  onImagination: (imagination: Imagination) => void;
  onDismiss: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isDefault = style === DEFAULT_CAST_STYLE && imagination === DEFAULT_IMAGINATION;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onDismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = cardRef.current?.querySelectorAll<HTMLElement>("button");
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
  }, [onDismiss]);

  return createPortal(
    <div
      className="dpc-signm"
      role="dialog"
      aria-modal="true"
      aria-label="Cast settings"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div ref={cardRef} className="dpc-setm__card" onClick={(event) => event.stopPropagation()}>
        <div className="dpc-setm__head">
          <div>
            <span className="dpc-signm__eyebrow">Settings</span>
            <h2 className="dpc-setm__title">How the next cast is made</h2>
          </div>
          <div className="dpc-setm__headactions">
            {/* Reset is offered only when there is something to reset — a control that does nothing is D-180's dead end. */}
            {isDefault ? null : (
              <button
                type="button"
                className="dpc-setm__reset"
                onClick={() => {
                  onStyle(DEFAULT_CAST_STYLE);
                  onImagination(DEFAULT_IMAGINATION);
                }}
              >
                Reset
              </button>
            )}
            <button type="button" className="dpc-setm__close" aria-label="Close settings" onClick={onDismiss}>
              <X size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="dpc-paths">
          <div className="dpc-paths__row" role="group" aria-label="Style">
            <span className="dp-chrome">STYLE</span>
            {CAST_STYLES.map((option) => (
              <ScopePill
                key={option}
                id={`dpc-settings-style-${option}`}
                active={style === option}
                onClick={() => onStyle(option)}
              >
                {CAST_STYLE_NAMES[option]}
              </ScopePill>
            ))}
          </div>
          <p className="dpc-paths__note">{CAST_STYLE_LINES[style]}</p>
          {/*
            COMING SOON — his styles, named and described, asking nothing. Not
            buttons: a row a customer cannot tap is not a question she cannot
            answer. The list is `shared/castStyles.ts`'s and leaves only by
            going live or by his word.
          */}
          <ul className="dpc-setm__coming" aria-label="Styles coming soon">
            {COMING_CAST_STYLES.map((coming) => (
              <li key={coming.name} className="dpc-setm__coming-row">
                <span className="dpc-setm__coming-name">{coming.name}</span>
                <span className="dpc-setm__coming-line">{coming.line}</span>
                <span className="dpc-setm__coming-tag">Coming soon</span>
              </li>
            ))}
          </ul>
        </div>

        <ImaginationToggle
          idPrefix="dpc-settings-imagination"
          label="How far the author goes"
          value={imagination}
          onChange={onImagination}
        />

        <p className="dpc-setm__foot">
          These are the studio's defaults. Anything you type in the brief overrides them.
        </p>
      </div>
    </div>,
    document.body,
  );
}

/**
 * THE GEAR — the one control on the surface, in the place the meter's pills
 * stood. It names the current settings (the reference's own grammar: a
 * default that names itself, "Lighting · Auto") so what will apply is read
 * without opening anything, and it opens the modal. Owns the open/closed
 * state; the VALUES are the page's, for the ephemerality rule above.
 */
export function CastSettingsButton({
  style,
  imagination,
  onStyle,
  onImagination,
  idPrefix,
}: {
  style: CastStyle;
  imagination: Imagination;
  onStyle: (style: CastStyle) => void;
  onImagination: (imagination: Imagination) => void;
  idPrefix: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        id={`${idPrefix}-settings`}
        className="dpc-setbtn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Settings2 size={13} strokeWidth={1.9} aria-hidden="true" />
        <span className="dp-chrome">SETTINGS</span>
        <span className="dpc-setbtn__value">{castSettingsSummary(style, imagination)}</span>
      </button>
      {open ? (
        <CastSettingsModal
          style={style}
          imagination={imagination}
          onStyle={onStyle}
          onImagination={onImagination}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
