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
 *     confidence, no "generated" — and since #2238 no badge at all.
 *
 * ⚠ **#2238 (his word, 2026-10-11): ONE DOOR, NO BADGE, AN EXPLAINER.** *"dont
 * allow the text to be editable until its been clicked i dont want two doors
 * into editing the text, remove drafted for you badge and put a hover tooltip
 * next to personality and voice that explain what it is for"*. So the words are
 * a plain paragraph now (#2214's click-the-words door is reversed by that
 * sentence), the edit icon on each card's head is the only way in, the *Drafted
 * for you* badge is gone from both cards, and a ? beside each label says what
 * the line is for, in the wording he approved on the card.
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
 * generation — the only feedback it needs is the kept line itself (#2238 took
 * the badge whose going used to be the receipt).
 */
import { useEffect, useRef, useState } from "react";
import { Check, PenLine } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CAST_PERSONA_OWN_WORDS_MAX_LENGTH,
  CAST_PERSONALITY_MAX_LENGTH,
  CAST_VOICE_MAX_LENGTH,
} from "@shared/inputLimits";

/**
 * One of the two lines, exactly as the room is handed it.
 *
 * `ownWords` is the customer's own sentence the line was kept from ("say it
 * your way", #2197 / #2205), or null when it was not. Optional because a test
 * or a surface that only reads need not invent one; the room's projection
 * always carries it.
 */
export type PersonaField = { text: string; drafted: boolean; ownWords?: string | null };

export type CastPersonaFieldName = "personality" | "voice";

/**
 * WHAT EACH LINE IS FOR — the ? beside PERSONALITY and VOICE (#2238).
 *
 * His word, 2026-10-11: *"put a hover tooltip next to personality and voice
 * that explain what it is for etc. (essentially its used for video creation)"*.
 * The personality sentence is the wording he approved on the card; the voice
 * sentence is the same register, given on the card beside it.
 *
 * ⚠ **"when you make video" and not "it guides … in your videos"**: video is
 * not built, and nothing reads these lines yet (`server/castingV2/castPersona.ts`
 * says so in its header). The sentence describes what the line is FOR without
 * claiming a road that exists today. No engine is named and nobody is gendered:
 * the cast's name, or "they" when there is none.
 */
export function personaExplainer(line: CastPersonaFieldName, name?: string | null): string {
  const named = name?.trim();
  if (line === "voice") {
    return named
      ? `How ${named} sounds on camera. It guides ${named}'s voice when you make video.`
      : "How they sound on camera. It guides their voice when you make video.";
  }
  return named
    ? `How ${named} carries themselves on camera. It guides ${named}'s performance when you make video.`
    : "How they carry themselves on camera. It guides their performance when you make video.";
}

/** The quiet note in an open box that holds changes not yet kept (#2238). */
export const PERSONA_UNSAVED = "Unsaved";

/**
 * WHAT A KEY DOES IN A PERSONA TEXT BOX — one function, so the rule is driven
 * by a test rather than read off a handler (#2238).
 *
 * ⚠ **ENTER IS NOT HERE, AND THAT IS THE RULE.** Enter used to keep the line
 * (and send the sentence in *Say it your way*), so a half-finished edit was
 * stored the moment someone reached for a new line. Now Enter does what Enter
 * does in a text box — a new line — and only Keep, or the panel's send button,
 * acts. Escape is the one key with a meaning: put the line back (the editor)
 * or close the panel (the doors).
 */
export function personaKeyAction(key: string): "escape" | null {
  return key === "Escape" ? "escape" : null;
}

/**
 * THE QUIET ? BESIDE A CARD'S LABEL, opening the explainer on hover, on
 * keyboard focus, and on a tap — a phone has no hover, so the press toggles it
 * (Radix closes a tooltip on click by default; `preventDefault` stops that).
 */
export function PersonaExplainer({ line, name }: { line: CastPersonaFieldName; name?: string | null }) {
  const [open, setOpen] = useState(false);
  const words = personaExplainer(line, name);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="dpc-master__idhelp dpc-persona__help"
          aria-label={words}
          onClick={(event) => {
            event.preventDefault();
            setOpen((was) => !was);
          }}
        >
          ?
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-[260px]">
        {words}
      </TooltipContent>
    </Tooltip>
  );
}

/** A card's label and its ?, together, on both cards. */
export function PersonaLabel({ line, name }: { line: CastPersonaFieldName; name?: string | null }) {
  return (
    <span className="dpc-persona__head">
      <span className="dpc-rcard__label">{line === "voice" ? "VOICE" : "PERSONALITY"}</span>
      <PersonaExplainer line={line} name={name} />
    </span>
  );
}

/**
 * WHERE A LEAVE IS ASKED ABOUT — the room's window, or a stand-in a test drives.
 */
export type LeaveGuardWindow = {
  history: History;
  location: { pathname: string; href: string };
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
};

/**
 * WARN BEFORE AN UNSAVED PERSONA EDIT IS LEFT BEHIND (#2238).
 *
 * Three roads out of the room, one guard:
 *  - **closing or reloading the tab** — `beforeunload`, the browser's own ask;
 *  - **any in-app move** — every wouter `navigate` and `<Link>` goes through
 *    `history.pushState` / `replaceState`, so those are wrapped while armed and
 *    a call that would change the PATH is held and handed to `ask`. A same-path
 *    call (a query string) passes untouched;
 *  - **the back button** — see the sentinel below.
 *
 * ⚠ **THE BACK BUTTON NEEDS A SENTINEL, AND THAT WAS MEASURED, NOT ASSUMED.**
 * The first shape put the path back from a `popstate` listener. In the running
 * app the dialog came up over a room whose cards had REMOUNTED with the edit
 * gone: a browser-dispatched popstate runs a microtask checkpoint after each
 * listener, the router's listener is registered first, and React rendered the
 * page being left before this one ran (capture did not change the order in
 * Edge — read off a probe, `bubble` before `cap`). So arming pushes one extra
 * entry for the SAME page. Back then lands on the room's own entry — the same
 * path, so the router renders nothing — and this listener puts the sentinel
 * back and asks. Leaving goes two steps back, to where the button was going.
 *
 * `ask(proceed)` shows the room's own dialog; `proceed` disarms and completes
 * the move. Returns `disarm(stay)`: idempotent, restores both history methods,
 * and with `stay` (the edit was kept or cancelled, the customer is staying)
 * steps off the sentinel so the next Back is not a dead press.
 */
const LEAVE_SENTINEL = "__personaLeaveGuard";

export function armUnsavedLeaveGuard(
  win: LeaveGuardWindow,
  ask: (proceed: () => void) => void,
): (stay?: boolean) => void {
  const history = win.history;
  const push = history.pushState;
  const replace = history.replaceState;
  const home = win.location.pathname;
  let homeHref = win.location.href;
  let armed = true;

  const onSentinel = (state: unknown): boolean =>
    typeof state === "object" && state !== null && (state as Record<string, unknown>)[LEAVE_SENTINEL] === true;
  const plantSentinel = () => push.call(history, { [LEAVE_SENTINEL]: true }, "", homeHref);
  plantSentinel();

  const leaves = (url: string | URL | null | undefined): boolean => {
    if (url === null || url === undefined) return false;
    try {
      return new URL(String(url), win.location.href).pathname !== home;
    } catch {
      return false;
    }
  };

  const wrap = (original: History["pushState"], isPush: boolean): History["pushState"] =>
    function wrapped(data, unused, url) {
      if (armed && leaves(url)) {
        ask(() => {
          disarm();
          /* Leaving FROM the sentinel replaces it, so Back from the next page
             lands on the room once rather than twice. */
          const go = isPush && onSentinel(history.state) ? replace : original;
          go.call(history, data, unused, url);
        });
        return;
      }
      /* A same-page replace on the sentinel keeps it a sentinel. */
      const keep = !isPush && onSentinel(history.state) && (data === null || typeof data === "object")
        ? { ...(data as object | null), [LEAVE_SENTINEL]: true }
        : data;
      original.call(history, keep, unused, url);
      homeHref = win.location.href;
    };
  const wrappedPush = wrap(push, true);
  const wrappedReplace = wrap(replace, false);
  history.pushState = wrappedPush;
  history.replaceState = wrappedReplace;

  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    /* Older browsers read the return value rather than the default. */
    event.returnValue = "";
  };
  const onPopState = (event: PopStateEvent) => {
    if (!armed || onSentinel(event.state)) return;
    if (win.location.pathname === home) {
      /* Back stepped off the sentinel onto the room's own entry: nothing has
         rendered. Put the sentinel back and ask; leaving goes two steps back. */
      plantSentinel();
      ask(() => {
        disarm();
        history.go(-2);
      });
      return;
    }
    /* Further than one step (or Forward somewhere): put the room back and ask. */
    const targetHref = win.location.href;
    const targetState: unknown = event.state;
    plantSentinel();
    ask(() => {
      disarm();
      replace.call(history, targetState, "", targetHref);
    });
  };
  win.addEventListener("beforeunload", onBeforeUnload as EventListener);
  win.addEventListener("popstate", onPopState as EventListener);

  function disarm(stay = false) {
    if (!armed) return;
    armed = false;
    if (history.pushState === wrappedPush) history.pushState = push;
    if (history.replaceState === wrappedReplace) history.replaceState = replace;
    win.removeEventListener("beforeunload", onBeforeUnload as EventListener);
    win.removeEventListener("popstate", onPopState as EventListener);
    /* Staying: step off the sentinel (same page, so nothing renders). */
    if (stay && onSentinel(history.state)) history.back();
  }
  return disarm;
}

/** The leave dialog's body, naming which line holds the edit. */
export function personaLeaveBody(
  unsaved: Record<CastPersonaFieldName, boolean>,
  name?: string | null,
): string {
  const named = name?.trim();
  const whose = named ? `${named}'s` : "the cast's";
  const what = unsaved.personality && unsaved.voice
    ? "personality and voice"
    : unsaved.voice
      ? "voice"
      : "personality";
  return `Your edit to ${whose} ${what} has not been kept. If you leave now, it is lost.`;
}

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
  /**
   * A DOOR HAS THE CARD (#2238). The editor stays MOUNTED and hidden, so the
   * words typed in it are still there when Escape or *Back to the draft*
   * returns — it used to unmount, and every typed word went with it.
   */
  concealed?: boolean;
  /** Whether the open box holds words not yet kept — the room's leave guard. */
  onUnsavedChange?: (unsaved: boolean) => void;
};

/**
 * ONE LINE, READ — and since #2238 only READ. The words are a paragraph; the
 * edit icon on the card's head is the one door into the box (his word: *"i
 * dont want two doors into editing the text"*).
 */
function EditableLine({
  line,
  value,
  onSave,
  saving,
  helper = null,
  editing,
  onEditingChange,
  concealed = false,
  onUnsavedChange,
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

  /* Focus on open, and again on the way back from a door. */
  useEffect(() => {
    if (editing && !concealed) field.current?.focus();
  }, [editing, concealed]);

  /*
    UNSAVED: the box is open and its words differ from the stored line. Trimmed,
    because `commit` treats trailing space as no change and the hint must agree
    with what Keep would actually do.
  */
  const unsaved = editing && draft.trim() !== value.text;
  useEffect(() => {
    onUnsavedChange?.(unsaved);
  }, [unsaved, onUnsavedChange]);
  useEffect(() => () => onUnsavedChange?.(false), [onUnsavedChange]);

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
    /* Words, not a control: the edit icon is the one door (#2238). */
    if (concealed) return null;
    return <p className="dpc-persona__read">{pending ?? value.text}</p>;
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
    <div className="dpc-persona__edit" hidden={concealed}>
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
        aria-label={line === "voice" ? "Voice" : "Personality"}
        onKeyDown={(event) => {
          /* Escape abandons: the line comes back exactly as it was. Enter is a
             new line and nothing else — only Keep stores (#2238). */
          if (personaKeyAction(event.key) === "escape") abandon();
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
        {unsaved ? (
          <span className="dpc-persona__unsaved" role="status">{PERSONA_UNSAVED}</span>
        ) : null}
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

/**
 * THE CAST'S OWN PRONOUNS, AS THE ROOM IS HANDED THEM — the subject word is
 * all the header needs. Read off the Cast's record on the server
 * (`castPronouns`), never guessed from a face or a name.
 */
export type PersonaPronouns = { subject: string };

/**
 * "CARRY HIMSELF / HERSELF / THEMSELVES" — #2238, his reviewer: the header
 * hard-coded *themselves* on every cast. Derived from the recorded pronouns;
 * anything other than he or she, or none recorded, is *themselves*.
 */
export function personaReflexive(pronouns?: PersonaPronouns | null): string {
  const subject = pronouns?.subject?.trim().toLowerCase();
  if (subject === "he") return "himself";
  if (subject === "she") return "herself";
  return "themselves";
}

/** Who the header is about: the name, or the cast's own subject word. */
function readsSubject(name?: string | null, pronouns?: PersonaPronouns | null): string {
  return castName(name) || pronouns?.subject?.trim() || "they";
}

/** The row under the open box: what the door is, before it is opened. */
export function personaReadsRowSubtitle(name?: string | null, pronouns?: PersonaPronouns | null): string {
  return `Six ways ${readsSubject(name, pronouns)} could carry ${personaReflexive(pronouns)}, in plain words`;
}

/** The line above the six, once they are there. */
export function personaReadsListSubtitle(name?: string | null, pronouns?: PersonaPronouns | null): string {
  return `Six ways ${readsSubject(name, pronouns)} could carry ${personaReflexive(pronouns)}. Pick the one you recognise.`;
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
  return personaReassurance("personality", name);
}

/**
 * THE SAME REASSURANCE, FOR EITHER LINE — one sentence shape, the changed
 * thing named per card.
 *
 * #2205 carries his voice-card wording verbatim — *"{name}'s face and look
 * stay exactly as they are. Only the voice changes, and only for new takes."*
 * — and asks for the same honesty check on the last five words. Re-taken at
 * the code for this card it fails on the same two facts the reads door's arm
 * holds (no takes exist; nothing reads the line), so the forecast is dropped
 * here too and the promise is kept: keeping a voice description writes the
 * voice line and touches nothing else.
 */
export function personaReassurance(line: CastPersonaFieldName, name?: string | null): string {
  const named = castName(name);
  const whose = named ? `${named}'s` : "Their";
  const changes = line === "voice" ? "the voice" : "the acting";
  return `${whose} face and look stay exactly as they are. Only ${changes} changes.`;
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

/** One way in, as a row under the open box. */
export type PersonaDoorRowSpec = { title: string; subtitle: string; onOpen: () => void };

/**
 * THE DOOR ROWS under the open box — his *"or"* divider and the ways in.
 *
 * ONE component for both cards (working law 4): the Personality card draws
 * *Pick a different read* and *Say it your way*, in that order, out of his
 * `01-door0-dark.png`; the Voice card draws *Say it your way* alone, out of
 * his `04-edit-in-place-dark.png`. The *or* is drawn once, above the first
 * row, and never when there is no row to offer — a divider over nothing reads
 * as a feature that failed to load.
 */
export function PersonaDoorRows({
  doors,
  disabled,
}: {
  doors: readonly PersonaDoorRowSpec[];
  disabled: boolean;
}) {
  if (doors.length === 0) return null;
  return (
    <div className="dpc-persona__doors">
      <span className="dpc-persona__or">or</span>
      {doors.map((door) => (
        <button
          type="button"
          key={door.title}
          className="dpc-persona__door"
          onClick={door.onOpen}
          disabled={disabled}
        >
          <span className="dpc-persona__doorText">
            <span className="dpc-persona__doorTitle">{door.title}</span>
            <span className="dpc-persona__doorSub">{door.subtitle}</span>
          </span>
          <span className="dpc-persona__doorChevron" aria-hidden="true">›</span>
        </button>
      ))}
    </div>
  );
}

/* ========================================================================== *
 * DOOR 2 — SAY IT YOUR WAY (#2197 on the Personality card, #2205 on Voice)
 * ========================================================================== */

/**
 * WHERE THE DOOR IS, held by the room because the room owns the call.
 *
 * `shut` — not open (the row is offered under the open box);
 * `writing` — the box, waiting for a sentence;
 * `reading` — the 2.5–5 s wait for the translation (measured on PR #2217);
 * `read` — the line it would store, with Keep this / Reword it;
 * `failed` — the translation did not come back, or the hour's bound was met.
 *
 * ⚠ **THE SENTENCE ITSELF IS NOT HERE.** The panel holds what is being typed;
 * the room is handed it on the press (`onTranslate`) and on the keep
 * (`onKeep`), so a keystroke never re-renders the room.
 */
export type PersonaOwnWordsDoor = {
  stage: "shut" | "writing" | "reading" | "read" | "failed";
  /** The line the translation came back with, at `read`. */
  result: string | null;
  /** The plain sentence a refusal says, at `failed`. */
  failure: string | null;
  onOpen: () => void;
  onTranslate: (ownWords: string) => void;
  onReword: () => void;
  /** `kept` is called once the line and the sentence are stored, so the card can shut its box. */
  onKeep: (ownWords: string, text: string, kept: () => void) => void;
  onBack: () => void;
};

/** The part of the door the room holds as state; the rest is its callbacks. */
export type PersonaOwnWordsState = Pick<PersonaOwnWordsDoor, "stage" | "result" | "failure">;

/** A door that is not open. */
export const PERSONA_OWN_WORDS_SHUT: PersonaOwnWordsState = { stage: "shut", result: null, failure: null };

/** His row title and the panel's, in one place. */
export const PERSONA_OWN_WORDS_TITLE = "Say it your way";

/**
 * THE WAIT, NAMED IN THE CUSTOMER'S WORDS (#55). It says what is happening to
 * their sentence and never what is doing it.
 */
export const PERSONA_OWN_WORDS_WORKING = "Reading your sentence…";

/** A translation that did not come back: what was refused, and what to do. */
export const PERSONA_OWN_WORDS_FAILED =
  "We could not read that sentence just now. Your words are still here, so try again in a moment.";

/**
 * THE HOUR'S BOUND, MET — the answer both cards gave the reword question
 * (free, and the house bounds it at sixty presses an hour per account,
 * `RATE_LIMITS.castPersonaTranslate`). Nobody rewording a sentence meets it;
 * the one who does is told plainly, with their sentence still in the box.
 * No number: a count of presses is not something they can act on.
 */
export const PERSONA_OWN_WORDS_BUSY =
  "That is a lot of rewording for one hour. Your words are still here, so try again a little later.";

/**
 * WHAT A PRESS LEAVES ON THE CARD — the room's three outcomes, decided here so
 * the rule is one function a test can drive rather than a branch inside a
 * mutation callback.
 *
 *  - a line came back: it is shown, with Keep this / Reword it;
 *  - the server's own `nothing` (the call failed, came back cut off, or could
 *    not be fitted to the line's cap) or any refusal: the plain failure;
 *  - the hour's bound (`TOO_MANY_REQUESTS`): the plain busy sentence, which is
 *    the one refusal whose next act differs ("later", not "in a moment").
 */
export function personaOwnWordsAfter(
  outcome: { kind: "line"; text: string } | { kind: "nothing" } | { kind: "error"; code?: string | null },
): PersonaOwnWordsState {
  if (outcome.kind === "line") return { stage: "read", result: outcome.text, failure: null };
  const busy = outcome.kind === "error" && outcome.code === "TOO_MANY_REQUESTS";
  return { stage: "failed", result: null, failure: busy ? PERSONA_OWN_WORDS_BUSY : PERSONA_OWN_WORDS_FAILED };
}

/**
 * THE ROWS UNDER ONE CARD'S OPEN BOX, in his frames' order — door 1 first,
 * door 2 second — and each only when the room handed its door over, so no row
 * is ever drawn that opens onto nothing. Both cards read this one function.
 */
export function personaDoorRowSpecs(
  line: CastPersonaFieldName,
  name: string | null | undefined,
  readsDoor: PersonaReadsDoor | null,
  ownWordsDoor: PersonaOwnWordsDoor | null,
  pronouns?: PersonaPronouns | null,
): PersonaDoorRowSpec[] {
  const doors: PersonaDoorRowSpec[] = [];
  /* Door 1 is the Personality card's alone — six ways to carry themselves. */
  if (readsDoor && line === "personality") {
    doors.push({ title: PERSONA_READS_TITLE, subtitle: personaReadsRowSubtitle(name, pronouns), onOpen: readsDoor.onOpen });
  }
  if (ownWordsDoor) {
    doors.push({
      title: PERSONA_OWN_WORDS_TITLE,
      subtitle: personaOwnWordsRowSubtitle(line, name),
      onOpen: ownWordsDoor.onOpen,
    });
  }
  return doors;
}

/** The row under the open box: what the door is, before it is opened. */
export function personaOwnWordsRowSubtitle(line: CastPersonaFieldName, name?: string | null): string {
  const named = castName(name);
  if (line === "voice") {
    return named
      ? `Describe how ${named} sounds in a sentence. We turn it into a voice description`
      : "Describe how they sound in a sentence. We turn it into a voice description";
  }
  return named
    ? `Describe ${named} in a sentence. We turn it into what the camera sees`
    : "Describe them in a sentence. We turn it into what the camera sees";
}

/** The ask above the box, in his words. */
export function personaOwnWordsPrompt(line: CastPersonaFieldName, name?: string | null): string {
  const named = castName(name);
  if (line === "voice") {
    return named
      ? `Describe how ${named} sounds, however you would to a friend.`
      : "Describe how they sound, however you would to a friend.";
  }
  return named
    ? `Describe ${named} however you would to a friend.`
    : "Describe them however you would to a friend.";
}

/** The note over the translated line. */
export function personaOwnWordsResultHeading(line: CastPersonaFieldName, name?: string | null): string {
  if (line === "personality") return "What the camera will see, read from your sentence";
  const named = castName(name);
  return named
    ? `What ${named} will sound like, read from your sentence`
    : "What they will sound like, read from your sentence";
}

/**
 * THE PRESS THAT ASKS FOR THE TRANSLATION. His frames draw only the state
 * after it (the line already under the box), so the button is ours: it says
 * what the customer will get, in the row's own words, and carries no price
 * because there is none.
 */
export function personaOwnWordsGoLabel(line: CastPersonaFieldName): string {
  return line === "voice" ? "See the voice description" : "See what the camera sees";
}

/**
 * THE OPEN DOOR — it replaces the card's body, as door 1 does.
 *
 * ⚠ **THE BOX IS READ-ONLY WHILE A TRANSLATION IS ON SCREEN, and *Reword it*
 * is what opens it again.** Keep this stores the sentence beside the line, so
 * the sentence in the box must be the one the line was read from; an editable
 * box under a finished translation would let the two drift apart and store a
 * sentence the line was never written from.
 *
 * The box opens on the sentence this line was last kept from, when there is
 * one — the customer is rewording their own words, not starting again.
 */
export function PersonaOwnWordsPanel({
  line,
  door,
  name,
  saving,
  initialWords,
  words: heldWords = null,
  onWordsChange,
  onKept,
  onPickRead,
}: {
  line: CastPersonaFieldName;
  door: PersonaOwnWordsDoor;
  name?: string | null;
  saving: boolean;
  initialWords?: string | null;
  /**
   * THE SENTENCE, HELD BY THE CARD (#2238) so closing the panel — Escape or
   * *Back to the draft* — and opening it again finds the words still there.
   * `null` is "not typed yet": the box opens on the sentence last kept.
   */
  words?: string | null;
  onWordsChange?: (words: string) => void;
  /** Shut the card's box once the keep has landed. */
  onKept: () => void;
  /** The Personality card's link across to door 1; absent on Voice. */
  onPickRead?: (() => void) | null;
}) {
  const [ownWords, setOwnWords] = useState(heldWords ?? initialWords ?? "");
  const words = heldWords ?? ownWords;
  const setWords = (next: string) => {
    setOwnWords(next);
    onWordsChange?.(next);
  };
  const field = useRef<HTMLTextAreaElement | null>(null);
  const settled = door.stage === "reading" || door.stage === "read";

  /* Focus on open and on Reword it — the two moments the box asks for words. */
  useEffect(() => {
    if (door.stage === "writing") field.current?.focus();
  }, [door.stage]);

  const sentence = words.trim();
  const ask = () => {
    if (!sentence || door.stage === "reading" || door.stage === "read") return;
    door.onTranslate(sentence);
  };

  return (
    <div
      className="dpc-persona__picker"
      onKeyDown={(event) => {
        /* Escape closes the panel and returns to the draft, words kept (#2238). */
        if (personaKeyAction(event.key) === "escape") {
          event.stopPropagation();
          door.onBack();
        }
      }}
    >
      <p className="dpc-persona__pickerTitle">{PERSONA_OWN_WORDS_TITLE}</p>
      <p className="dpc-persona__ownPrompt">{personaOwnWordsPrompt(line, name)}</p>
      <textarea
        ref={field}
        className="dpc-persona__field dpc-persona__ownField"
        value={words}
        maxLength={CAST_PERSONA_OWN_WORDS_MAX_LENGTH}
        rows={2}
        readOnly={settled}
        aria-label={personaOwnWordsPrompt(line, name)}
        /* Enter is a new line; only the button below sends (#2238). */
        onChange={(event) => setWords(event.target.value)}
      />

      {door.stage === "reading" ? <PersonaWait words={PERSONA_OWN_WORDS_WORKING} /> : null}
      {door.stage === "failed" && door.failure ? (
        <PersonaFailure words={door.failure} onRetry={ask} disabled={!sentence} />
      ) : null}
      {door.stage === "read" && door.result ? (
        <div className="dpc-persona__result">
          <p className="dpc-persona__resultHead">{personaOwnWordsResultHeading(line, name)}</p>
          <p className="dpc-persona__resultBody">{door.result}</p>
        </div>
      ) : null}

      <div className="dpc-persona__acts">
        {door.stage === "read" && door.result ? (
          <>
            <button
              type="button"
              className="dpc-persona__keep"
              onClick={() => door.onKeep(sentence, door.result as string, onKept)}
              disabled={saving}
            >
              Keep this
            </button>
            <button
              type="button"
              className="dpc-persona__cancel"
              onClick={door.onReword}
              disabled={saving}
            >
              Reword it
            </button>
          </>
        ) : door.stage === "failed" ? null : (
          <button
            type="button"
            className="dpc-persona__keep"
            onClick={ask}
            disabled={!sentence || door.stage === "reading"}
          >
            {personaOwnWordsGoLabel(line)}
          </button>
        )}
      </div>

      <p className="dpc-persona__helper dpc-persona__assure">{personaReassurance(line, name)}</p>
      <div className="dpc-persona__links">
        {onPickRead ? (
          <button type="button" className="dpc-persona__back" onClick={onPickRead}>
            {`${PERSONA_READS_TITLE} ›`}
          </button>
        ) : null}
        <button type="button" className="dpc-persona__back dpc-persona__backEnd" onClick={door.onBack}>
          Back to the draft
        </button>
      </div>
    </div>
  );
}

/**
 * THE WAIT, SEEN AS WELL AS SAID (#2238). The sentence names what is happening
 * to their cast (#55); the line under it moves, so a 3- or 14-second wait reads
 * as working rather than stuck. It is not a bar that fills — there is no
 * progress to report and a filling bar would be a number nobody can act on —
 * just a quiet sweep, which stops under reduced motion.
 */
export function PersonaWait({ words }: { words: string }) {
  return (
    <div className="dpc-persona__wait" role="status" aria-busy="true">
      <p className="dpc-persona__working">{words}</p>
      <span className="dpc-persona__pulse" aria-hidden="true" />
    </div>
  );
}

/** A failure line and its Try again, on every door (#2238). */
export function PersonaFailure({
  words,
  onRetry,
  disabled = false,
}: {
  words: string;
  onRetry: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="dpc-persona__failed" role="alert">
      <p className="dpc-persona__working">{words}</p>
      <button type="button" className="dpc-persona__cancel dpc-persona__retry" onClick={onRetry} disabled={disabled}>
        Try again
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
  onSayItYourWay = null,
  pronouns = null,
}: {
  door: PersonaReadsDoor;
  name?: string | null;
  /** The cast's recorded pronouns, for "carry himself" (#2238). */
  pronouns?: PersonaPronouns | null;
  saving: boolean;
  /** Across to door 2, when the room has one. */
  onSayItYourWay?: (() => void) | null;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = door.reads.find((read) => read.label === picked) ?? null;
  /*
    THE PANEL TAKES FOCUS WHEN IT OPENS, so Escape reaches it (#2238). The row
    that opened it has just unmounted, which would otherwise leave focus on the
    page body where no key press reaches the panel.
  */
  const panel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    panel.current?.focus();
  }, []);
  return (
    <div
      ref={panel}
      tabIndex={-1}
      className="dpc-persona__picker"
      onKeyDown={(event) => {
        /* Escape closes the list and returns to the draft, words kept (#2238). */
        if (personaKeyAction(event.key) === "escape") {
          event.stopPropagation();
          door.onBack();
        }
      }}
    >
      <p className="dpc-persona__pickerTitle">{PERSONA_READS_TITLE}</p>
      <p className="dpc-persona__pickerSub">{personaReadsListSubtitle(name, pronouns)}</p>

      {door.state === "drafting" ? <PersonaWait words={PERSONA_READS_WORKING} /> : null}
      {door.state === "failed" ? (
        <PersonaFailure words={PERSONA_READS_FAILED} onRetry={door.onOpen} />
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
                  {isPicked ? (
                    <span className="dpc-persona__picked">
                      <Check size={10} strokeWidth={2.25} aria-hidden="true" />
                      Picked
                    </span>
                  ) : null}
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
      {/*
        ⚠ PINNED (#2238), his word: *"After you pick one, Keep "The warm host"
        sits below the bottom of the screen, so it looks like nothing
        happened."* The row sticks to the bottom of the viewport while the list
        is on screen, so the button the pick produced is always in view.
      */}
      {chosen ? (
        <div className="dpc-persona__acts dpc-persona__pin">
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
      {/*
        HIS FOOTER, BOTH LINKS — `02-door1-dark.png` reads *None of these? Say
        it your way ›* on the left and *Back to the draft* on the right. The
        first link waited for door 2's client half (#2197) and arrives with it;
        absent when the room has no door 2 to open.
      */}
      <div className="dpc-persona__links">
        {onSayItYourWay ? (
          <button type="button" className="dpc-persona__back" onClick={onSayItYourWay}>
            {`None of these? ${PERSONA_OWN_WORDS_TITLE} ›`}
          </button>
        ) : null}
        <button type="button" className="dpc-persona__back dpc-persona__backEnd" onClick={door.onBack}>
          Back to the draft
        </button>
      </div>
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
  ownWordsDoor = null,
  onUnsavedChange,
  pronouns = null,
}: Omit<CastPersonaCardsProps, "voice"> & {
  /** The cast's recorded pronouns, for the reads header (#2238). */
  pronouns?: PersonaPronouns | null;
  /**
   * DOOR 1, OR NOTHING AT ALL (#2196).
   *
   * Optional, and `null` draws exactly the card door 0 shipped — so a caller
   * that has no entrance to call (a test, or a surface that only reads) is not
   * forced to invent one, and the door cannot half-exist.
   */
  readsDoor?: PersonaReadsDoor | null;
  /** DOOR 2, OR NOTHING AT ALL (#2197) — the same optional shape as door 1. */
  ownWordsDoor?: PersonaOwnWordsDoor | null;
  /** Whether this card holds an edit not yet kept — the room's leave guard (#2238). */
  onUnsavedChange?: (line: CastPersonaFieldName, unsaved: boolean) => void;
}) {
  /*
    ⚠ ABOVE THE EARLY RETURN, AND THAT IS NOT STYLE. A hook declared under a
    conditional `return null` runs on some renders and not others, which React
    ends the whole page on (#310) — and the render it would die on is exactly
    the common one here, a Cast signed before N2b with no line to draw.

    The voice line's open state is NOT held here: it lives in the room, because
    the voice card's edit icon sits in a head this file does not own. This
    card's icon sits in a head this card DOES own, so its state stays here.
  */
  const [editing, setEditing] = useState(false);
  const [editorUnsaved, setEditorUnsaved] = useState(false);
  /* The "say it your way" sentence, kept across closing the panel (#2238). */
  const [ownWords, setOwnWords] = useState<string | null>(null);
  /* Door 1 has the card whenever the room says it is past `shut` — the room
     owns that state because the room owns the call that moves it. */
  const inPicker = readsDoor ? readsDoor.state !== "shut" : false;
  const inOwnWords = ownWordsDoor ? ownWordsDoor.stage !== "shut" : false;
  const unsaved =
    editorUnsaved || (ownWordsDoor ? personaOwnWordsUnsaved(ownWordsDoor, ownWords, personality?.ownWords) : false);
  useEffect(() => {
    onUnsavedChange?.("personality", unsaved);
  }, [unsaved, onUnsavedChange]);
  if (!personality) return null;
  const doors = personaDoorRowSpecs("personality", name, readsDoor, ownWordsDoor, pronouns);
  /* The two footers cross to each other's door, as his two frames draw. */
  const toOwnWords = readsDoor && ownWordsDoor
    ? () => { readsDoor.onBack(); ownWordsDoor.onOpen(); }
    : null;
  const toReads = readsDoor && ownWordsDoor
    ? () => { ownWordsDoor.onBack(); readsDoor.onOpen(); }
    : null;
  return (
    <section className="dpc-rcard" style={{ gap: 11 }}>
      <div className="dpc-rcard__head">
        <PersonaLabel line="personality" name={name} />
        <PersonaEditButton
          line="personality"
          present
          /* While a door has the card, the icon has nothing to open — the box
             is already what *Back to the draft* returns to. */
          editing={editing || inPicker || inOwnWords}
          saving={savingLine === "personality"}
          onOpen={() => setEditing(true)}
        />
      </div>
      {/*
        A DOOR REPLACES THE CARD'S BODY, it does not sit under it — his
        `02-door1-dark.png` shows the words and the edit box gone and the six
        in their place. ⚠ Since #2238 the editor stays MOUNTED and hidden
        underneath, so the words typed in it survive the trip.
      */}
      {inPicker && readsDoor ? (
        <CastReadsPicker
          /* Keeping a read closes the box too: its draft is the line being
             replaced, and reopening onto it would show the old words marked
             unsaved over the read just kept. */
          door={{
            ...readsDoor,
            onKeep: (read) => {
              setEditing(false);
              readsDoor.onKeep(read);
            },
          }}
          name={name}
          pronouns={pronouns}
          saving={savingLine === "personality"}
          onSayItYourWay={toOwnWords}
        />
      ) : inOwnWords && ownWordsDoor ? (
        <PersonaOwnWordsPanel
          line="personality"
          door={ownWordsDoor}
          name={name}
          saving={savingLine === "personality"}
          initialWords={personality.ownWords ?? null}
          words={ownWords}
          onWordsChange={setOwnWords}
          onKept={() => {
            setOwnWords(null);
            setEditing(false);
          }}
          onPickRead={toReads}
        />
      ) : null}
      <EditableLine
        line="personality"
        value={personality}
        onSave={onSave}
        saving={savingLine === "personality"}
        helper={personaEditHelper(name)}
        editing={editing}
        onEditingChange={setEditing}
        concealed={inPicker || inOwnWords}
        onUnsavedChange={setEditorUnsaved}
      />
      {/*
        THE DOOR IS OFFERED ONLY FROM THE OPEN BOX, which is where his frame
        puts it: `01-door0-dark.png` draws the *or* divider and the door rows
        UNDER the open editor, never on the card at rest.
      */}
      {editing && !inPicker && !inOwnWords ? (
        <PersonaDoorRows doors={doors} disabled={savingLine === "personality"} />
      ) : null}
    </section>
  );
}

/**
 * WHETHER AN OPEN "SAY IT YOUR WAY" PANEL HOLDS SOMETHING NOT YET KEPT — a
 * sentence typed that differs from the one last kept, or a translation on
 * screen that has not been kept. A shut panel holds nothing at risk: the line
 * itself is unchanged.
 */
export function personaOwnWordsUnsaved(
  door: Pick<PersonaOwnWordsDoor, "stage" | "result">,
  typed: string | null,
  kept: string | null | undefined,
): boolean {
  if (door.stage === "shut") return false;
  if (door.stage === "read" && door.result) return true;
  return typed !== null && typed.trim() !== (kept ?? "").trim();
}

/**
 * THE EDIT ICON ON A PERSONA CARD'S HEAD — THE ONE DOOR INTO THE BOX (#2238).
 *
 * His word, 2026-10-11: *"change the "change" button to an editor icon which
 * fits our design language. dont allow the text to be editable until its been
 * clicked i dont want two doors into editing the text"*. So the quiet *Change*
 * text of #2139/#2214 is a lucide pen in the same quiet register, the same on
 * both cards, named for a screen reader and explained on hover.
 *
 * ⚠ **THE SHOWN/ABSENT RULE LIVES HERE, ONCE.** Drawn only when there is a
 * line to open and its box is shut: with no line there is nothing to edit, and
 * once the box is open the icon has nothing left to do.
 */
export function PersonaEditButton({
  line,
  present,
  editing,
  saving,
  onOpen,
}: {
  line: CastPersonaFieldName;
  /** Whether the card has a line at all. */
  present: boolean;
  editing: boolean;
  /** That line's save is in flight. */
  saving: boolean;
  onOpen: () => void;
}) {
  if (!present || editing) return null;
  const label = line === "voice" ? "Edit voice" : "Edit personality";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="dpc-rcard__quiet dpc-persona__editIcon"
          aria-label={label}
          onClick={onOpen}
          disabled={saving}
        >
          <PenLine size={13} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * THE VOICE LINE, for the inside of the room's existing VOICE card.
 *
 * ⚠ **ITS OPEN STATE COMES FROM THE ROOM, which is the one asymmetry with the
 * personality card and it is structural rather than a preference.** The voice
 * card's edit icon sits in a head the room draws; a line holding its own state
 * could never be opened from up there.
 */
export function CastVoiceLine({
  voice,
  onSave,
  savingLine,
  name,
  editing,
  onEditingChange,
  ownWordsDoor = null,
  onUnsavedChange,
}: Omit<CastPersonaCardsProps, "personality"> & {
  editing: boolean;
  onEditingChange: (open: boolean) => void;
  /**
   * DOOR 2 ON THE VOICE CARD (#2205) — the same panel the Personality card
   * draws, with the voice's own words. Optional, and `null` draws exactly the
   * line #2139 shipped.
   */
  ownWordsDoor?: PersonaOwnWordsDoor | null;
  /** Whether this card holds an edit not yet kept — the room's leave guard (#2238). */
  onUnsavedChange?: (line: CastPersonaFieldName, unsaved: boolean) => void;
}) {
  /* Above the early return (React #310). */
  const [editorUnsaved, setEditorUnsaved] = useState(false);
  const [ownWords, setOwnWords] = useState<string | null>(null);
  const inOwnWords = ownWordsDoor ? ownWordsDoor.stage !== "shut" : false;
  const unsaved =
    editorUnsaved || (ownWordsDoor ? personaOwnWordsUnsaved(ownWordsDoor, ownWords, voice?.ownWords) : false);
  useEffect(() => {
    onUnsavedChange?.("voice", unsaved);
  }, [unsaved, onUnsavedChange]);
  if (!voice) return null;
  return (
    <div className="dpc-persona__voice">
      {/* His `05-your-way-dark.png`: the door replaces the line. */}
      {inOwnWords && ownWordsDoor ? (
        <PersonaOwnWordsPanel
          line="voice"
          door={ownWordsDoor}
          name={name}
          saving={savingLine === "voice"}
          initialWords={voice.ownWords ?? null}
          words={ownWords}
          onWordsChange={setOwnWords}
          onKept={() => {
            setOwnWords(null);
            onEditingChange(false);
          }}
        />
      ) : null}
      <EditableLine
        line="voice"
        value={voice}
        onSave={onSave}
        saving={savingLine === "voice"}
        helper={voiceEditHelper(name)}
        editing={editing}
        onEditingChange={onEditingChange}
        concealed={inOwnWords}
        onUnsavedChange={setEditorUnsaved}
      />
      {/* His `04-edit-in-place-dark.png`: one row, under the open box only. */}
      {editing && !inOwnWords && ownWordsDoor ? (
        <PersonaDoorRows
          doors={personaDoorRowSpecs("voice", name, null, ownWordsDoor)}
          disabled={savingLine === "voice"}
        />
      ) : null}
    </div>
  );
}
