import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Settings2, X } from "lucide-react";

import {
  CAST_STYLE_LINES,
  CAST_STYLE_NAMES,
  CAST_STYLES,
  COMING_CAST_STYLES,
  DEFAULT_CAST_STYLE,
  type CastStyle,
} from "@shared/castStyles";
import {
  DEFAULT_IMAGINATION,
  IMAGINATION_LINES,
  IMAGINATION_NAMES,
  IMAGINATIONS,
  type Imagination,
} from "@shared/imagination";

import { castSettingsSummary } from "../castSettingsCopy";

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
  followHeld,
  onStyle,
  onImagination,
  onDismiss,
}: {
  style: CastStyle;
  imagination: Imagination;
  /**
   * TRUE DURING A STANDING FOLLOW (#177 Row A): an anchored roll never calls
   * the author — the followed photograph holds the family — so the
   * imagination row yields to a sentence saying so rather than standing as a
   * meter that reads nothing (a dead control, the no-dead-controls ruling).
   * The style row stays live: the style still picks the locked block.
   */
  followHeld?: boolean;
  onStyle: (style: CastStyle) => void;
  onImagination: (imagination: Imagination) => void;
  onDismiss: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isDefault = style === DEFAULT_CAST_STYLE && (followHeld || imagination === DEFAULT_IMAGINATION);

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

  /*
    THE CAROUSEL'S DECK — one browsable list of what the studio can photograph
    with, live styles first, then his named-and-not-yet ones (§3c).

    ⚠ **The coming rows are an ANNOUNCEMENT, not a control**, and that is the
    same rule they arrived under (#142; `castStyles.ts`'s own header): a row a
    customer cannot tap is not a question she cannot answer, whereas a disabled
    pill would be D-180's dead end. What changes here is only that they are
    SHOWN instead of listed — *"a single chip plus a text list of two names
    reads as a broken selector; one browsable deck of three cards does not, and
    it shows what is coming instead of listing it."*
  */
  const deck: Array<{
    key: string;
    name: string;
    line: string;
    value: CastStyle | null;
  }> = [
    ...CAST_STYLES.map((option) => ({
      key: option,
      name: CAST_STYLE_NAMES[option],
      line: CAST_STYLE_LINES[option],
      value: option as CastStyle | null,
    })),
    ...COMING_CAST_STYLES.map((coming) => ({
      key: coming.name,
      name: coming.name,
      line: coming.line,
      value: null,
    })),
  ];
  const currentIndex = Math.max(
    0,
    deck.findIndex((entry) => entry.value === style),
  );
  const [at, setAt] = useState(currentIndex);
  const index = Math.min(at, deck.length - 1);
  const step = (delta: number) => setAt((was) => (was + delta + deck.length) % deck.length);
  const shown = deck[index];

  return createPortal(
    <div
      className="dpc-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Cast settings"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div ref={cardRef} className="dpc-setm__card" onClick={(event) => event.stopPropagation()}>
        <div className="dpc-setm__head">
          <h2 className="dpc-setm__title">Cast settings</h2>
          <span className="dpc-setm__headair" aria-hidden="true" />
          {/* Reset is offered only when there is something to reset — a control that does nothing is D-180's dead end. */}
          {isDefault ? null : (
            <button
              type="button"
              className="dpc-setm__reset"
              onClick={() => {
                onStyle(DEFAULT_CAST_STYLE);
                if (!followHeld) onImagination(DEFAULT_IMAGINATION);
                setAt(deck.findIndex((entry) => entry.value === DEFAULT_CAST_STYLE));
              }}
            >
              Reset all
            </button>
          )}
          <button type="button" className="dpc-setm__close" aria-label="Close settings" onClick={onDismiss}>
            <X size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/*
          TWO COLUMNS AND NO NAV (§3a). The first version of this had a left nav
          after the reference it was cut from, and his brief retires it with the
          measurement: *"the nav cost 182px of a 724px modal to switch between
          two things that both fit on screen, and the two settings are read as
          one sentence — `Photoreal · Low` — so hiding half of it behind a click
          is pure cost."* The chip that opens this modal says that sentence; the
          modal should not then take it apart.
        */}
        <div className="dpc-setm__body">
          <section className="dpc-setm__col dpc-setm__col--style" aria-label="Style">
            <span className="dpc-setm__colhead">Style</span>
            <p className="dpc-setm__colline">The locked bundle every candidate is photographed with.</p>

            <div className="dpc-setm__stage">
              {/*
                THREE CARDS FROM [-1, 0, +1] around the index, absolutely
                positioned so the stage's own height is the only thing that
                sizes them — `container-type: size` makes `100cqh` mean THIS
                stage, which is what lets the deck shrink into a short window
                instead of demanding height the card may not have.

                Live styles solid, coming styles dashed: the system's existing
                rule, where solid is a fact and dashed is not yet.
              */}
              {[-1, 0, 1].map((offset) => {
                const entryIndex = (index + offset + deck.length) % deck.length;
                const entry = deck[entryIndex];
                const centre = offset === 0;
                return (
                  <div
                    key={`${entry.key}-${offset}`}
                    className={[
                      "dpc-setm__card3",
                      centre ? "dpc-setm__card3--centre" : "dpc-setm__card3--peek",
                      offset < 0 ? "dpc-setm__card3--left" : offset > 0 ? "dpc-setm__card3--right" : "",
                      entry.value === null ? "dpc-setm__card3--coming" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-hidden={centre ? undefined : true}
                  >
                    {/*
                      The name is a CAPTION on the card, in a bottom scrim, with
                      COMING SOON under it when the style is not live — both
                      facts about a card sitting together rather than one on the
                      card and one in a list somewhere else.
                    */}
                    {centre ? (
                      <span className="dpc-setm__caption">
                        <span className="dpc-setm__captionname">{entry.name}</span>
                        {entry.value === null ? (
                          <span className="dpc-setm__captionsoon">COMING SOON</span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                );
              })}
              {/*
                ARROWS ON THE STAGE, not a row beneath it — that row cost 52px,
                and this is where a carousel's arrows live.
              */}
              <button
                type="button"
                className="dpc-setm__arrow dpc-setm__arrow--prev"
                aria-label="Previous style"
                onClick={() => step(-1)}
              >
                <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="dpc-setm__arrow dpc-setm__arrow--next"
                aria-label="Next style"
                onClick={() => step(1)}
              >
                <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            {/*
              ⚠ **THE TWO `min-height`s BELOW ARE LOAD-BEARING AND LIVE IN THE
              STYLESHEET** (§3c, and his §4 forbids dropping them). Without them
              the flex stage absorbs their variance — the description is two
              lines for Photoreal and one for the coming styles, and the action
              swaps between a 26px pill and a 17px line — so the preview resized
              18% every time you stepped the carousel. *"A comparison surface
              whose subjects change size as you step through them has no
              comparison left."*
            */}
            <div className="dpc-setm__under">
              <p className="dpc-setm__desc">{shown.line}</p>
              <div className="dpc-setm__act">
                {shown.value === null ? (
                  <span className="dpc-setm__soon">Not available yet — we'll say when it lands.</span>
                ) : shown.value === style ? (
                  <span className="dpc-setm__inuse">IN USE</span>
                ) : (
                  <button
                    type="button"
                    className="dpc-setm__use"
                    onClick={() => shown.value !== null && onStyle(shown.value)}
                  >
                    Use {shown.name}
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="dpc-setm__col dpc-setm__col--mind" aria-label="Imagination">
            <span className="dpc-setm__colhead">Imagination</span>
            <p className="dpc-setm__colline">What the studio does with the words you leave out.</p>

            {followHeld ? (
              /*
                ⚠ **#177 Row A, AND HIS BRIEF DOES NOT KNOW ABOUT IT.** A follow
                is held by the photograph of the face you picked; the anchored
                roll never calls the author, so there is no meter to set. §3d
                writes "two cards" unconditionally — drawing them here would put
                a dead control back on the exact surface a founder ruling took
                one off. The style half stays live, because the style still
                picks the locked block.
              */
              <p className="dpc-setm__held">
                A follow holds the look of the face you picked — imagination applies to fresh casts.
              </p>
            ) : (
              /*
                TWO CARDS, NOT A SLIDER AND NOT A SEGMENTED CONTROL (§3d). Max
                does not do MORE of Low, it rewrites your brief: a track between
                two stops invites a drag toward a middle that cannot exist and
                frames a behaviour switch as a magnitude. And either control
                would show only the selected consequence, when the consequence
                IS the entire decision — so both lines stay on screen.
              */
              <div className="dpc-setm__minds">
                {IMAGINATIONS.map((option) => {
                  const on = imagination === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={on ? "dpc-setm__mind dpc-setm__mind--on" : "dpc-setm__mind"}
                      aria-pressed={on}
                      onClick={() => onImagination(option)}
                    >
                      <span className="dpc-setm__mindtop">
                        <span className="dpc-setm__mindname">{IMAGINATION_NAMES[option]}</span>
                        {option === DEFAULT_IMAGINATION ? (
                          <span className="dpc-setm__minddefault">DEFAULT</span>
                        ) : null}
                        {/* A spacer element, not `margin-left: auto` — his §4, for the whole surface. */}
                        <span className="dpc-setm__mindair" aria-hidden="true" />
                        {on ? <span className="dpc-setm__inuse">IN USE</span> : null}
                      </span>
                      <span className="dpc-setm__mindline">{IMAGINATION_LINES[option]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="dpc-setm__foot">
          <span className="dpc-setm__footline">
            These are defaults — anything your brief says about the look, light or setting overrides them.
          </span>
          <button type="button" className="dpc-setm__done" onClick={onDismiss}>
            Done
          </button>
        </div>
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
  followHeld,
  onStyle,
  onImagination,
  idPrefix,
}: {
  style: CastStyle;
  imagination: Imagination;
  /** See `CastSettingsModal.followHeld` — during a standing follow the summary names the style alone, because that is all the next roll reads. */
  followHeld?: boolean;
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
        aria-label="Cast settings"
        onClick={() => setOpen(true)}
      >
        {/*
          THE SLIDERS MARK (§2e) — and it stays LUCIDE's, deliberately.

          ⚠ **His brief asks for `P.filters`; there is no such key, and the
          foundation glyph he means — `P.settings`, two rules each with a knob —
          IS BANNED FROM THE CLIENT BY A GUARD STANDING ON HIS OWN RULING**
          (#373, verbatim: *"i want to change the setting icon at the bottom of
          the rail to a cog — this looks more like a filter icon"*).
          `foundation/icons-guard.test.ts` enforces it across every `.tsx` in
          the client, and its docblock records the near-miss that widened it:
          brief 04 §2b instructed this same key believing it was a cog.

          The two rulings may well be reconcilable — his #373 objection is to a
          filter mark standing for the APP's settings, and this chip tunes THIS
          ROLL, which is what a sliders mark actually means — **but that is his
          call and not a shift's**, so nothing here reinterprets it.

          `Settings2` is lucide's two-slider mark: the drawing his brief asks
          for, already on this control, and it moves no ruling. The question is
          on #435 for one word from him.
        */}
        <Settings2 size={13} strokeWidth={1.9} className="dpc-setbtn__glyph" aria-hidden="true" />
        <span className="dpc-setbtn__value">
          {followHeld ? CAST_STYLE_NAMES[style] : castSettingsSummary(style, imagination)}
        </span>
      </button>
      {open ? (
        <CastSettingsModal
          style={style}
          imagination={imagination}
          followHeld={followHeld}
          onStyle={onStyle}
          onImagination={onImagination}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
