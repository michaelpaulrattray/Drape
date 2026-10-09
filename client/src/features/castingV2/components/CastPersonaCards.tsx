/**
 * WHO SHE IS ON CAMERA, AND HOW SHE SOUNDS — N2b's two cards (#1242).
 *
 * His brief: *"Personality gets a card (none exists yet); the existing Voice
 * card stub gains this text half. Both wear a badge while machine-derived; both
 * are inline-editable plain text; editing is free and clears the badge."*
 *
 * ============================================================================
 * THE DISAPPEARING-TECHNOLOGY GATE, answered where the customer meets it
 * ============================================================================
 *
 *  1. **What must she learn?** Nothing. Two lines of plain text on a page she
 *     already opens. Clicking a line puts a cursor in it, which is what
 *     clicking text does everywhere else.
 *  2. **What decision does it put before her, and on what basis?** One, and
 *     only after the fact: keep this or change it — with the draft in front of
 *     her, which is the whole basis it needs.
 *  3. **Where does the technology show?** Nowhere. No model name, no
 *     confidence, no "generated". **The badge says *Drafted for you***, which
 *     is the customer's word for what happened — and it is not *Read from your
 *     brief*, because the picture she chose and her own corrections fed it too.
 *
 * ============================================================================
 * WHAT IT DOES NOT DRAW, AND WHY EACH ABSENCE IS DELIBERATE
 * ============================================================================
 *
 * **No card at all when there is no line.** A Cast signed before N2b has none,
 * and so does one whose read failed. His brief's own rule: *"a read that fails
 * leaves both lines empty with the badge absent — never a blank card that looks
 * like a feature missing."* So the absence is silence, not an empty state.
 *
 * **No Save button.** Blur saves and Escape abandons, which is how text behaves
 * on a page. A button would be a second thing to learn for a free edit.
 *
 * **No price, no spinner over the whole card.** The edit is free and is not a
 * generation — the only feedback it needs is that the badge goes.
 */
import { useEffect, useRef, useState } from "react";

import {
  CAST_PERSONALITY_MAX_LENGTH,
  CAST_VOICE_MAX_LENGTH,
} from "@shared/inputLimits";

/** One of the two lines, exactly as the room is handed it. */
export type PersonaField = { text: string; drafted: boolean };

export type CastPersonaFieldName = "personality" | "voice";

/**
 * THE BADGE'S WORDS, in one place.
 *
 * ⚠ **IT IS *Drafted for you* AND THE CARD SETTLED THAT** — not *Read from your
 * brief*, the earlier design's wording, because the frame she signed and her own
 * corrections feed the draft as much as her brief does. A badge that names only
 * the brief would be telling her something untrue about where her own words
 * went.
 */
export const PERSONA_DRAFT_BADGE = "Drafted for you";

type EditableLineProps = {
  line: CastPersonaFieldName;
  value: PersonaField;
  /** Free, and never a generation — so there is no price and no credit here. */
  onSave: (line: CastPersonaFieldName, text: string) => void;
  saving: boolean;
};

/**
 * ONE LINE, READ UNTIL SHE CLICKS IT.
 *
 * ⚠ **A `<button>` wrapping the text, not a click handler on a `<p>`.** The
 * line has to be reachable by keyboard and announced as something that does
 * something; a div with an `onClick` is reachable by a mouse alone, and the
 * room's own design laws already refuse an inner focus outline on a text field
 * rather than refusing the outline everywhere.
 */
function EditableLine({ line, value, onSave, saving }: EditableLineProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.text);
  const field = useRef<HTMLTextAreaElement | null>(null);

  /*
    HER OWN TEXT WINS OVER A REFETCH, BUT ONLY WHILE SHE IS NOT TYPING.

    The room refetches after a save, so `value.text` arrives again a moment
    later. Syncing unconditionally would overwrite what she is typing with what
    the server last said — the shape that eats a customer's sentence mid-word.
  */
  useEffect(() => {
    if (!editing) setDraft(value.text);
  }, [value.text, editing]);

  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);

  const max = line === "voice" ? CAST_VOICE_MAX_LENGTH : CAST_PERSONALITY_MAX_LENGTH;

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    /*
      NOTHING IS SENT WHEN NOTHING CHANGED, and an emptied line is ABANDONED
      rather than saved. The server refuses a blank line (it would draw a card
      with nothing in it); refusing it here too means she gets her line back
      instead of an error about a thing she did not mean to do.
    */
    if (!next || next === value.text) {
      setDraft(value.text);
      return;
    }
    onSave(line, next);
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="dpc-persona__read"
        onClick={() => setEditing(true)}
        disabled={saving}
      >
        {value.text}
      </button>
    );
  }

  return (
    <textarea
      ref={field}
      className="dpc-persona__field"
      value={draft}
      maxLength={max}
      rows={line === "voice" ? 2 : 3}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          /* Abandon: her line comes back exactly as it was. */
          setDraft(value.text);
          setEditing(false);
          return;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}

export type CastPersonaCardsProps = {
  personality: PersonaField | null;
  voice: PersonaField | null;
  onSave: (line: CastPersonaFieldName, text: string) => void;
  savingLine: CastPersonaFieldName | null;
};

/**
 * THE PERSONALITY CARD — new, and drawn only when there is a line to draw.
 *
 * The VOICE card is NOT here: it is the existing stub on the room, and his
 * brief says that stub *gains this text half* rather than being replaced. Its
 * player skeleton and its "arrives with voice" promise are still true, so the
 * line goes inside it beside them and this file exports the piece it needs.
 */
export function CastPersonalityCard({
  personality,
  onSave,
  savingLine,
}: Omit<CastPersonaCardsProps, "voice">) {
  if (!personality) return null;
  return (
    <section className="dpc-rcard" style={{ gap: 11 }}>
      <div className="dpc-rcard__head">
        {/*
          ⚠ THE BADGE SITS WITH THE LABEL, LEFT, IN BOTH CARDS, and that was
          decided at the rendered frame rather than in the markup. On the voice
          card the head already owns a right-hand control, so a badge pinned
          right would sit under the label on one card and beside a button on
          the other — two placements for one idea, on two cards a customer sees
          side by side.
        */}
        <span className="dpc-persona__head">
          <span className="dpc-rcard__label">PERSONALITY</span>
          {personality.drafted ? (
            <span className="dpc-persona__badge">{PERSONA_DRAFT_BADGE}</span>
          ) : null}
        </span>
      </div>
      <EditableLine
        line="personality"
        value={personality}
        onSave={onSave}
        saving={savingLine === "personality"}
      />
    </section>
  );
}

/**
 * THE VOICE CARD'S BADGE, for the head of the room's existing stub.
 *
 * Separate from the line below because the two go in different places inside a
 * card this file does not own: the badge beside the card's own label, the line
 * above its player skeleton.
 */
export function CastVoiceBadge({ voice }: { voice: PersonaField | null }) {
  if (!voice?.drafted) return null;
  return <span className="dpc-persona__badge">{PERSONA_DRAFT_BADGE}</span>;
}

/** The voice line, for the inside of the room's existing VOICE card. */
export function CastVoiceLine({
  voice,
  onSave,
  savingLine,
}: Omit<CastPersonaCardsProps, "personality">) {
  if (!voice) return null;
  return (
    <div className="dpc-persona__voice">
      <EditableLine
        line="voice"
        value={voice}
        onSave={onSave}
        saving={savingLine === "voice"}
      />
    </div>
  );
}
