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
 * ⚠ **THERE IS A KEEP BUTTON NOW, AND THIS PARAGRAPH SAID THE OPPOSITE UNTIL
 * #2137 (door 0).** It read: *"No Save button. Blur saves and Escape abandons,
 * which is how text behaves on a page. A button would be a second thing to
 * learn for a free edit."* That reasoning was sound on its own terms and his
 * design overrules it for a reason the old shape could not answer — **a Cancel
 * button cannot exist beside a blur-saving field**, because clicking Cancel
 * blurs the box first and the edit is already sent. Keep and Cancel arrive
 * together or neither does. The cost is named at the return below: clicking
 * away now leaves the box open instead of quietly storing.
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
  /**
   * The sentence under the open box saying where the words came from. Each
   * line has its own, out of his design: personality's came with door 0 of
   * #2137, voice's with #2139 — and they say different things, because the
   * voice line has a rule to teach (the sound, then how it is used) and the
   * personality line does not. `null` is still allowed, for a line whose own
   * design has not been written.
   */
  helper?: string | null;
  /**
   * WHETHER THE BOX IS OPEN, HELD BY THE CALLER — #2139.
   *
   * ⚠ **IT USED TO BE THIS COMPONENT'S OWN `useState`, AND THE VOICE CARD'S
   * *Change* BUTTON IS WHY IT MOVED.** That button sits in the card's HEAD,
   * which the room owns and this file does not — so a line that keeps the open
   * state to itself can never be opened by it, and *Change* stayed `disabled`
   * on a card whose whole subject is editing. Always controlled rather than
   * sometimes: one shape for both callers is cheaper to read than a component
   * that is its own master on one card and not on the other.
   */
  editing: boolean;
  onEditingChange: (open: boolean) => void;
};

/**
 * ONE LINE, READ UNTIL IT IS CLICKED.
 *
 * ⚠ **A `<button>` wrapping the text, not a click handler on a `<p>`.** The
 * line has to be reachable by keyboard and announced as something that does
 * something; a div with an `onClick` is reachable by a mouse alone, and the
 * room's own design laws already refuse an inner focus outline on a text field
 * rather than refusing the outline everywhere.
 */
function EditableLine({
  line,
  value,
  onSave,
  saving,
  helper = null,
  editing,
  onEditingChange,
}: EditableLineProps) {
  const [draft, setDraft] = useState(value.text);
  /**
   * WHAT WAS JUST TYPED, HELD ON SCREEN UNTIL THE SAVE SETTLES — the relay's
   * non-blocking note on PR #2114.
   *
   * ⚠ **THE READ VIEW SHOWED `value.text` THE INSTANT THE TEXTAREA CLOSED**, and
   * `value.text` is the SERVER's answer — still the old sentence until the save
   * comes back. So the customer watched their own edit flash back to what it
   * was and then change again, which reads as the product undoing them. Measured
   * on a real Cast before this landed: **2,230 ms of the old sentence.**
   *
   * Two windows had to close for that, and the cache write in `CastingRoom`
   * alone closes only the second one (its reply landing before the refetch).
   * This closes the first: from blur until the mutation settles, the card shows
   * the customer's words.
   *
   * ⚠ **AND IT IS CLEARED ON `saving` GOING FALSE, WHICH IS WHY A FAILED SAVE
   * IS STILL HONEST.** On success the room has already written the line into the
   * cache in the same handler that clears `saving`, so `value.text` is the new
   * text by then and nothing moves. On failure `value.text` is the old line, the card
   * returns to it, and the toast says why — rather than keeping a sentence on
   * screen that was never stored.
   */
  const [pending, setPending] = useState<string | null>(null);
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

  /* The save has settled, whichever way. `value.text` is authoritative again:
     the new line on success, the old one plus a toast on failure. */
  useEffect(() => {
    if (!saving) setPending(null);
  }, [saving]);

  const max = line === "voice" ? CAST_VOICE_MAX_LENGTH : CAST_PERSONALITY_MAX_LENGTH;

  const commit = () => {
    const next = draft.trim();
    onEditingChange(false);
    /*
      NOTHING IS SENT WHEN NOTHING CHANGED, and an emptied line is ABANDONED
      rather than saved. The server refuses a blank line (it would draw a card
      with nothing in it); refusing it here too means the customer gets their
      line back instead of an error about a thing they did not mean to do.
    */
    if (!next || next === value.text) {
      setDraft(value.text);
      return;
    }
    /* The typed words stay on the card from this moment until the save settles. */
    setPending(next);
    onSave(line, next);
  };

  /** Put the line back exactly as it was and close. Cancel and Escape share it. */
  const abandon = () => {
    setDraft(value.text);
    onEditingChange(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="dpc-persona__read"
        onClick={() => onEditingChange(true)}
        disabled={saving}
      >
        {pending ?? value.text}
      </button>
    );
  }

  /*
    THE OPEN BOX, ITS HELPER AND ITS TWO BUTTONS — door 0 of #2137.

    ⚠ **`onBlur` NO LONGER SAVES, AND REMOVING IT IS THE WHOLE REASON THIS IS
    A CODE CHANGE RATHER THAN TWO BUTTONS.** A Cancel button inside a blur-
    saving field cannot work: pressing it blurs the textarea FIRST, `commit`
    runs and the edit is already sent by the time the click lands — so the
    button that exists to throw the edit away would have saved it, every time,
    and nothing on screen would say so. Explicit Keep is what his design asks
    for and it is also the only shape in which Cancel means anything.

    What that costs is the one road blur-save gave for free: clicking off the
    card now leaves the box open with the words still in it, rather than
    quietly storing them. That is the safer of the two — an unsaved edit is
    visible and recoverable, a silently-saved one is neither — and Escape and
    Cancel both still put the line back exactly as it was.
  */
  return (
    <div className="dpc-persona__edit">
      <textarea
        ref={field}
        className="dpc-persona__field"
        value={draft}
        maxLength={max}
        /*
          SIZED TO THE SHAPE THE CRAFT RULES PRODUCE — #2136, measured in the
          running app rather than guessed.
  
          It was 3 and 2, sized for the one-sentence voice and the shorter
          personality the old instruction wrote. His craft corrections give each
          line a second job, and the court measured the result at 348-474 and
          258-303 characters. At `rows=3` that is a 60px box holding a 129px
          line, with `resize: none` — so editing a line WE wrote meant scrolling
          inside it, which is the machinery showing through on a card whose whole
          promise is "it's just words, fix anything that's off".
  
          7 and 5 are read off the RENDERED box rather than computed from a guess
          at the line height: at ~18.8px a row, the widest measured personality
          needs 7 rows and the widest voice needs 5. That also lands the edit box
          on the same height as the read view it replaces (131px), so the card no
          longer changes size when it is clicked into.
  
          ⚠ These two numbers are a FIT, not a design: #2137 rebuilds this
          editing affordance entirely (edit in place with Keep / Cancel, pick a
          different read, say it your way) and owns the final answer. This is the
          smallest change that stops the cap raise shipping a box it overflows.
        */
        rows={line === "voice" ? 5 : 7}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            /* Abandon: the line comes back exactly as it was. */
            abandon();
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            commit();
          }
        }}
      />
      {helper ? <p className="dpc-persona__helper">{helper}</p> : null}
      <div className="dpc-persona__acts">
        {/*
          KEEP IS THE COMMIT AND IT IS REFUSED ON AN EMPTY BOX, which is the
          same rule `commit` already has one function up — a blank line is
          abandoned, never stored, because the server refuses it and a card
          with nothing in it is not a thing to store. Disabling the button
          says that before the press instead of swallowing it after.
        */}
        <button
          type="button"
          className="dpc-persona__keep"
          onClick={commit}
          disabled={!draft.trim()}
        >
          Keep
        </button>
        <button type="button" className="dpc-persona__cancel" onClick={abandon}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export type CastPersonaCardsProps = {
  personality: PersonaField | null;
  voice: PersonaField | null;
  onSave: (line: CastPersonaFieldName, text: string) => void;
  savingLine: CastPersonaFieldName | null;
  /** The cast's own name, for the helper line. Blank or absent is handled. */
  name?: string | null;
};

/**
 * THE SENTENCE UNDER THE OPEN BOX — door 0's helper, and the one place it is
 * written.
 *
 * ⚠ **HIS DESIGN'S LAST CLAUSE IS NOT HERE, AND THAT IS A MEASURED CALL RATHER
 * THAN AN EDIT TO HIS WORDS.** The Desk design reads *"Written from your brief
 * and {name}'s look. Fix anything that's off. It's just words, and new takes
 * follow them."* — and **#2137's own body asks for exactly this check**: *"'new
 * takes follow them': takes are not built yet, so check this claim is honest
 * today."*
 *
 * Read at the code on the day this shipped, and it is untrue twice over:
 *
 *  - **There are no takes.** The room's refine card renders its input, its
 *    button and its chips all `disabled` (`CastingRoom.tsx`, the REFINE
 *    section), under its own honest line *"Refining arrives soon."* Nothing a
 *    customer can press produces a take.
 *  - **Nothing reads these lines.** `server/castingV2/castPersona.ts` says so
 *    in its own header — *"nothing reads these two lines to build a prompt
 *    anywhere"* — so even once takes exist, the clause is a promise about
 *    wiring that does not exist either.
 *
 * So the clause is dropped rather than softened: a sentence promising that an
 * edit changes future work, on a product where no future work can be started,
 * is the honesty contract failing on the one line whose whole job is to make
 * editing feel safe. **It returns, in his words, in the commit that makes it
 * true** — the card carries that note, and it is one string in one file.
 */
export function personaEditHelper(name?: string | null): string {
  const named = name?.trim();
  /* The room's own established fallback for a nameless cast, not a second one:
     `Refine ${name}'s look` / `Refine their look` one file over. */
  const look = named ? `${named}'s look` : "their look";
  return `Written from your brief and ${look}. Fix anything that's off. It's just words.`;
}

/**
 * THE VOICE LINE'S OWN SENTENCE — #2139, and it is NOT the personality one.
 *
 * His Desk design (Notion, *"Voice card: editing redesign (casting room)"*,
 * section 1, filed by Yuna with his approval): *"Written from your brief and
 * Pigman's look. Describe the sound, then how Pigman uses it. New takes follow
 * these words."*
 *
 * **The middle sentence is the whole reason this is a second helper rather
 * than a shared one.** It teaches #2136's voice rule in the place a customer
 * is about to use it — his own correction, verbatim on the design: *"The voice
 * text carries timbre AND performance style. The sound of him, then how he
 * uses it: pace, how much he says, how he answers."* A customer who edits this
 * line without that sentence writes half of it, and the half they drop is the
 * one that makes the cast directable.
 *
 * ⚠ **AND THE LAST SENTENCE IS DROPPED, ON THE SAME READING #2137 MADE AND
 * RE-TAKEN AT THE CODE HERE.** *"New takes follow these words"* is untrue
 * twice over today:
 *
 *  - **There are no takes.** The room's refine card draws its input, its
 *    button and its chips all `disabled`, under its own honest line *"Refining
 *    arrives soon."*
 *  - **Nothing reads this line.** `server/castingV2/castPersona.ts` says so in
 *    its own header, and a grep for a prompt builder reading `personality` or
 *    `voice` returns the sign write, the owner projection, the field edit and
 *    the deletion scrub — and no composer at all.
 *
 * It returns, in his words, in the commit that makes it true.
 */
export function voiceEditHelper(name?: string | null): string {
  const named = name?.trim();
  const look = named ? `${named}'s look` : "their look";
  /* The verb has to agree with whichever subject the fallback produces — "how
     Pigman uses it" against "how they use it" — so the clause is chosen whole
     rather than interpolated into one sentence shape. */
  const uses = named ? `how ${named} uses it` : "how they use it";
  return `Written from your brief and ${look}. Describe the sound, then ${uses}.`;
}

/* ========================================================================== *
 * DOOR 1 — SIX WAYS THIS CAST COULD CARRY THEMSELVES (#2196)
 * ========================================================================== */

/** One alternative, exactly as the entrance hands it over. */
export type CastReadOption = { label: string; personality: string };

/**
 * WHERE THE DOOR IS, held by the room because the room owns the call.
 *
 * `shut` is the row under the open box; `drafting` is the ~14-second wait;
 * `open` is his six-row list; `failed` is the honest refusal. This file draws
 * all four and decides none of them — the mutation, its price and its error
 * live one level up with every other tRPC call in this room, which is how
 * every other control here is already built.
 */
export type PersonaReadsDoor = {
  state: "shut" | "drafting" | "open" | "failed";
  reads: readonly CastReadOption[];
  onOpen: () => void;
  onBack: () => void;
  onKeep: (read: CastReadOption) => void;
};

/** His row title, and the list's, in one place. */
export const PERSONA_READS_TITLE = "Pick a different read";

/** The room's own fallback for a nameless cast, as door 0 uses it. */
function castName(name?: string | null): string {
  return name?.trim() ?? "";
}

/** The row under the open box: what the door is, before it is opened. */
export function personaReadsRowSubtitle(name?: string | null): string {
  const named = castName(name);
  return named
    ? `Six ways ${named} could carry themselves, in plain words`
    : "Six ways they could carry themselves, in plain words";
}

/** The line above the six, once they are there. */
export function personaReadsListSubtitle(name?: string | null): string {
  const named = castName(name);
  return named
    ? `Six ways ${named} could carry themselves. Pick the one you recognise.`
    : "Six ways they could carry themselves. Pick the one you recognise.";
}

/**
 * HIS REASSURANCE, WITH ITS LAST CLAUSE DROPPED — the third time this rung has
 * made the same check and the third time it has come out the same way.
 *
 * His design reads *"{name}'s face and look stay exactly as they are. Only the
 * acting changes, and only for new takes."* **The card itself asks for the
 * check** — *"the last five words need the same honesty check door 0 made and
 * failed"* — and re-taken at the code for THIS card it is still untrue twice
 * over:
 *
 *  - **There are no takes.** The room's refine card draws its input, its button
 *    and its chips all `disabled`, under its own line *"Refining arrives soon."*
 *  - **Nothing reads this line.** `server/castingV2/castPersona.ts` says so in
 *    its own header, and no prompt builder anywhere reads `personality`.
 *
 * The first half is the half this door needs and it is TRUE: keeping a read
 * writes the personality line and touches nothing else — not the face, not the
 * views, not the voice. So the sentence keeps its promise and drops its
 * forecast, and the forecast returns in his words in the commit that makes it
 * true.
 */
export function personaReadsReassurance(name?: string | null): string {
  const named = castName(name);
  const whose = named ? `${named}'s` : "Their";
  return `${whose} face and look stay exactly as they are. Only the acting changes.`;
}

/**
 * THE WAIT, NAMED IN THE CUSTOMER'S WORDS — #55's honest loader, measured.
 *
 * The open takes 13.0–15.4 s (mean 13.8 s, measured through the real entrance
 * on his own casts). That is far too long for nothing to be said, and what is
 * said names what is happening to THEIR cast and never what is doing it: no
 * engine, no percentage, no countdown nobody can act on.
 */
export const PERSONA_READS_WORKING = "Working out other ways to play them…";

/** What a refusal says, and what to do about it. */
export const PERSONA_READS_FAILED = "We could not write the other reads just now. Try again in a moment.";

/**
 * THE DOOR ROW under the open box — his *"or"* divider and one way in.
 *
 * ⚠ **HIS DESIGN DRAWS TWO ROWS HERE AND THIS SHIPS ONE.** The second is *Say
 * it your way* (#2197), which is not built: its store is still being designed,
 * and it is the sibling of the voice card's own second door. A row that opens
 * nothing is the lesser path shipped silently — the same call #2205 recorded
 * for the voice card, made here the same way. It arrives when #2197 does.
 */
export function PersonaReadsDoorRow({
  name,
  onOpen,
  disabled,
}: {
  name?: string | null;
  onOpen: () => void;
  disabled: boolean;
}) {
  return (
    <div className="dpc-persona__doors">
      <span className="dpc-persona__or">or</span>
      <button type="button" className="dpc-persona__door" onClick={onOpen} disabled={disabled}>
        <span className="dpc-persona__doorText">
          <span className="dpc-persona__doorTitle">{PERSONA_READS_TITLE}</span>
          <span className="dpc-persona__doorSub">{personaReadsRowSubtitle(name)}</span>
        </span>
        <span className="dpc-persona__doorChevron" aria-hidden="true">›</span>
      </button>
    </div>
  );
}

/**
 * THE SIX, AND THE ONE THE CUSTOMER RECOGNISES.
 *
 * ⚠ **NOTHING IS PICKED WHEN THE LIST OPENS, AND THAT IS READ OFF HIS FRAME
 * RATHER THAN CHOSEN.** `02-door1-dark.png` shows one row ringed, a *Picked*
 * tag beside its label, and the button reading `Keep "The patient hulk"` — a
 * button that cannot be drawn before a label exists to put in it. So the frame
 * is the state AFTER a press, and the caption under it says the act plainly:
 * *"Pick a read by recognising it."* Opening with one already chosen would be
 * the product making the choice and then asking them to confirm it, which is
 * the decision-without-a-basis his candidate-count ruling refused.
 */
export function CastReadsPicker({
  door,
  name,
  saving,
}: {
  door: PersonaReadsDoor;
  name?: string | null;
  saving: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = door.reads.find((read) => read.label === picked) ?? null;
  return (
    <div className="dpc-persona__picker">
      <p className="dpc-persona__pickerTitle">{PERSONA_READS_TITLE}</p>
      <p className="dpc-persona__pickerSub">{personaReadsListSubtitle(name)}</p>

      {door.state === "drafting" ? (
        <p className="dpc-persona__working">{PERSONA_READS_WORKING}</p>
      ) : null}
      {door.state === "failed" ? (
        <p className="dpc-persona__working">{PERSONA_READS_FAILED}</p>
      ) : null}

      {door.state === "open"
        ? door.reads.map((read) => {
            const isPicked = read.label === picked;
            return (
              <button
                type="button"
                key={read.label}
                className={`dpc-persona__option${isPicked ? " is-picked" : ""}`}
                aria-pressed={isPicked}
                onClick={() => setPicked(read.label)}
              >
                <span className="dpc-persona__optionHead">
                  <span className="dpc-persona__optionName">{read.label}</span>
                  {isPicked ? <span className="dpc-persona__picked">Picked</span> : null}
                </span>
                <span className="dpc-persona__optionBody">{read.personality}</span>
              </button>
            );
          })
        : null}

      {/*
        THE KEEP BUTTON NAMES WHAT IT WILL KEEP, which is why it is absent
        until something is picked rather than present and disabled: `Keep ""`
        has nothing to say, and a disabled button with an empty name reads as a
        feature that failed to load.
      */}
      {chosen ? (
        <div className="dpc-persona__acts">
          <button
            type="button"
            className="dpc-persona__keep"
            onClick={() => door.onKeep(chosen)}
            disabled={saving}
          >
            {`Keep “${chosen.label}”`}
          </button>
        </div>
      ) : null}

      <p className="dpc-persona__helper">{personaReadsReassurance(name)}</p>
      <button type="button" className="dpc-persona__back" onClick={door.onBack}>
        Back to the draft
      </button>
    </div>
  );
}

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
  name,
  readsDoor = null,
}: Omit<CastPersonaCardsProps, "voice"> & {
  /**
   * DOOR 1, OR NOTHING AT ALL (#2196).
   *
   * Optional, and `null` draws exactly the card door 0 shipped — so a caller
   * that has no entrance to call (a test, or a surface that only reads) is not
   * forced to invent one, and the door cannot half-exist.
   */
  readsDoor?: PersonaReadsDoor | null;
}) {
  /*
    ⚠ ABOVE THE EARLY RETURN, AND THAT IS NOT STYLE. A hook declared under a
    conditional `return null` runs on some renders and not others, which React
    ends the whole page on (#310) — and the render it would die on is exactly
    the common one here, a Cast signed before N2b with no line to draw.

    The voice line's open state is NOT held here: it lives in the room, because
    the voice card's *Change* button sits in a head this file does not own.
    This card's *Change* (#2214) sits in a head this card DOES own, so its
    state has no reason to leave — the same controlled pair, held one level up
    from the line in both cases.
  */
  const [editing, setEditing] = useState(false);
  /* Door 1 has the card whenever the room says it is past `shut` — the room
     owns that state because the room owns the call that moves it. */
  const inPicker = readsDoor ? readsDoor.state !== "shut" : false;
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
        <PersonaChangeButton
          present
          /* While door 1 has the card, *Change* has nothing to open — the box
             is already what *Back to the draft* returns to. Treated as open
             for the same reason the box's own press is. */
          editing={editing || inPicker}
          saving={savingLine === "personality"}
          onOpen={() => setEditing(true)}
        />
      </div>
      {/*
        DOOR 1 REPLACES THE CARD'S BODY, it does not sit under it — his
        `02-door1-dark.png` shows the words and the edit box gone and the six
        in their place. Drawing both would put two things to read and two
        things to press on one card, which is the busyness his design removes.
      */}
      {inPicker && readsDoor ? (
        <CastReadsPicker door={readsDoor} name={name} saving={savingLine === "personality"} />
      ) : (
        <>
          <EditableLine
            line="personality"
            value={personality}
            onSave={onSave}
            saving={savingLine === "personality"}
            helper={personaEditHelper(name)}
            editing={editing}
            onEditingChange={setEditing}
          />
          {/*
            THE DOOR IS OFFERED ONLY FROM THE OPEN BOX, which is where his
            frame puts it: `01-door0-dark.png` draws the *or* divider and the
            door rows UNDER the open editor, never on the card at rest. A shut
            card stays one line of words and a quiet *Change* — adding a second
            control to it would make the common case busier to serve the rarer
            one.
          */}
          {editing && readsDoor ? (
            <PersonaReadsDoorRow
              name={name}
              onOpen={readsDoor.onOpen}
              disabled={savingLine === "personality"}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * THE QUIET *Change* ON A PERSONA CARD'S HEAD — ONE BUTTON FOR BOTH CARDS (#2214).
 *
 * #2139 drew it on the voice card alone, and the personality card beside it had
 * none although clicking its words already opened the same editor. His word on
 * the two cards side by side, 2026-10-10: *"yes go ahead"* — to the relay's
 * recommendation that *Change* be a SECOND way in on both cards and never a
 * required step. So clicking the words keeps working, and this is the other
 * door.
 *
 * ⚠ **THE SHOWN/ABSENT RULE LIVES HERE, ONCE.** Drawn only when there is a
 * line to open and its box is shut: with no line the card draws no text, so a
 * *Change* would open an empty box, and once the box is open the button has
 * nothing left to do (his #2139 frames show it gone). Two cards each spelling
 * that condition for themselves is the drift working law 4 forbids.
 */
export function PersonaChangeButton({
  present,
  editing,
  saving,
  onOpen,
}: {
  /** Whether the card has a line at all. */
  present: boolean;
  editing: boolean;
  /** That line's save is in flight — the same refusal the read view has. */
  saving: boolean;
  onOpen: () => void;
}) {
  if (!present || editing) return null;
  return (
    <button type="button" className="dpc-rcard__quiet" onClick={onOpen} disabled={saving}>
      Change
    </button>
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

/**
 * THE VOICE LINE, for the inside of the room's existing VOICE card.
 *
 * ⚠ **ITS OPEN STATE COMES FROM THE ROOM, which is the one asymmetry with the
 * personality card and it is structural rather than a preference.** The voice
 * card's head carries a *Change* button and the head belongs to the room; a
 * line holding its own state could never be opened from up there, which is why
 * that button sat `disabled` on the one card whose subject is editing.
 */
export function CastVoiceLine({
  voice,
  onSave,
  savingLine,
  name,
  editing,
  onEditingChange,
}: Omit<CastPersonaCardsProps, "personality"> & {
  editing: boolean;
  onEditingChange: (open: boolean) => void;
}) {
  if (!voice) return null;
  return (
    <div className="dpc-persona__voice">
      <EditableLine
        line="voice"
        value={voice}
        onSave={onSave}
        saving={savingLine === "voice"}
        helper={voiceEditHelper(name)}
        editing={editing}
        onEditingChange={onEditingChange}
      />
    </div>
  );
}
