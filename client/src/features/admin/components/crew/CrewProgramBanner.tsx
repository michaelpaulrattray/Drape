/**
 * The program banner — mission, focus, current milestone, ladder.
 *
 * First on the page because it is first in his reading order on the Desk: what
 * we are building, what he has confirmed, where we are inside it. His verbatim
 * confirming quote is rendered as a quote and never paraphrased — a focus is
 * set by his word, and the word is the evidence that it was.
 *
 * ⚠ **#492 CHANGED THE FIRST BLOCK AND NOTHING BELOW IT.** The founder, at a
 * frame of the top of this card: *"the top of the programs card with the little
 * status card readings needs a better design honest it looks terribly designed
 * . if you agree with that file it onto the next up list so my agent can pick
 * it up when its ready."* The at-a-glance readings are a state strip now — a
 * grid of equal cells, a quiet eyebrow label capped at 40 AT THE SCHEMA, the
 * tone as a 6px dot, and the reading itself in the page's reading face. The
 * mission, the focus, the quote, the milestone bar, the steps and the ladder
 * are untouched, which is the card's own bar.
 *
 * ⚠ **BRIEF 08 CHANGED THE SURFACE AND NOTHING ELSE (#398).** The order of the
 * blocks, the words in them, the quote and its attribution, and the ONE
 * progress number read off the steps are all exactly as they were. What moved:
 * every hex literal became a token, every measured value became mono, the
 * `font-semibold` titles became 500, and the quote lost its italic — his §4,
 * whose argument is that a quote already carries two markers (its rule and its
 * attribution) and a third marker for one fact says nothing new.
 */
import { useState, type CSSProperties } from "react";

import { Check } from "lucide-react";

import { indexIntentsByCard } from "@shared/crewCardIntents";
import type { CrewQueueTitle } from "@shared/crewQueueTitles";
import { cn } from "@/lib/utils";
import { TableHead } from "@/foundation";
import { CardTitles } from "./CrewCardTitles";
import { milestoneCountLine, milestoneProgress } from "./crewTypes";
import type { CrewBriefingView, CrewCardIntentsView } from "./crewTypes";

const FOCUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  proposed: "Proposed — awaiting your word",
  none: "No focus set",
};

const STEP_LABEL: Record<string, string> = {
  done: "Done",
  "in-progress": "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
};

/*
  ⚠ **THE STEP MARKER'S FOUR STATES ARE THE RUNG BAR'S FOUR (#414 item 1).**

  His instruction was three: *"A done step is ✓; an open one is a hollow ring;
  a blocked one is a coral ring."* The data carries four states, so `waiting`
  and `in-progress` are both "open" and are told apart the way the ladder
  already tells `queued` from `current` — a soft ring against an ink one. That
  is a reading of his rule against the data, not an addition to it: the ladder
  block below has drawn exactly this distinction since #74, and inventing a
  second visual language for the same idea one card apart is the duplication
  this lane exists to remove.

  ⚠ **AND THE ORDINAL IS GONE, WHICH IS THE POINT.** His argument: *"the
  ordinal carries no information here — the list is already in order."* It is
  the same argument that removed the Actions column in brief 06.
*/
const STEP_MARK: Record<string, string> = {
  done: "dp-crew__stepmark--done",
  "in-progress": "dp-crew__stepmark--current",
  waiting: "",
  blocked: "dp-crew__stepmark--blocked",
};

const RUNG_LABEL: Record<string, string> = {
  done: "Done",
  current: "Current",
  queued: "Queued",
  parked: "Parked",
};

/*
  ⚠ **THE THREE TONES SURVIVED THE PILL; THE PILL DID NOT (#492).**

  His words at a frame of this block: *"the top of the programs card with the
  little status card readings needs a better design honest it looks terribly
  designed"*. The tones are not the fault and they do not change — `warn` is
  still the house red (`--errorInk`, brief 08 §5, and `--errorInk` rather than
  `--error` because this is TEXT). What changed is what carries them: a 6px dot
  beside a quiet label, instead of a stroked pill that was the loudest thing on
  the block while holding the least information on it.

  ⚠ **`warn` SAYS ITS WORD OUT LOUD.** It is the one tone that changes what he
  does, and a dot is a colour — the only encoding a screen reader cannot hear.
  `good` and `neutral` get no word on purpose: the absence of a warning is the
  resting state, and announcing it on every reading is noise.
*/
const STATE_DOT: Record<string, string> = {
  good: "dp-crew__statedot--good",
  warn: "dp-crew__statedot--warn",
  neutral: "",
};

const STATE_SPOKEN: Record<string, string | null> = {
  good: null,
  warn: "Needs attention: ",
  neutral: null,
};

/**
 * The word beside a ladder card that is not ordinary roadmap work (#493) — a
 * DISPLAY word for a kind the vocabulary already owns, so `roadmap` (the
 * default meaning: waits on its rung) stays unmarked and the two exceptions
 * say their name.
 */
const LADDER_KIND_WORD: Record<string, string | null> = {
  roadmap: null,
  parked: "parked",
  "design-unbuilt": "unbuilt design",
};

/** The pseudo-rung the honest remainder expands under (#493). */
const UNPLACED_KEY = "unplaced";

export function CrewProgramBanner({
  program, cardIntents, onIntent, intentPendingCard,
}: {
  program: CrewBriefingView["program"];
  cardIntents: CrewCardIntentsView;
  onIntent: (issueNumber: number, intent: "close" | null) => void;
  intentPendingCard: number | null;
}) {
  /*
    WHICH RUNGS ARE OPEN (#493 — his card: the count always shows, and
    "tapped, the cards"). Collapsed by default: this is already the tallest
    block on the page, by his own accepted trade, and nineteen extra rows
    always-open would be the split he declined arriving as clutter.
  */
  const [openRungs, setOpenRungs] = useState<ReadonlySet<string>>(new Set());
  const toggleRung = (key: string) =>
    setOpenRungs((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /*
    The ladder's cards by rung, plus the honest remainder. `mark` says
    *parked* / *unbuilt design* on the rows that are not ordinary roadmap
    work, from one kind map the titles component draws.
  */
  const ladderItems = program.ladderCards.items;
  const kindByNumber = new Map(ladderItems.map((item) => [item.issueNumber, item.kind]));
  const markOf = (card: CrewQueueTitle) => LADDER_KIND_WORD[kindByNumber.get(card.number) ?? ""] ?? null;
  const cardsOn = (rungKey: string | null): CrewQueueTitle[] =>
    ladderItems
      .filter((item) => item.rung === rungKey)
      .map((item) => ({ number: item.issueNumber, title: item.title }));
  const unplaced = cardsOn(null);

  /* The tap is withheld while the intents table is absent, exactly as the
     background panel withholds it — a control that silently forgets is worse
     than one that is not there (#325). */
  const intentsByCard = indexIntentsByCard(cardIntents.intents);
  const liveIntent = cardIntents.available ? onIntent : null;

  return (
    <section className="dp-crew__card">
      <TableHead eyebrow="The program" />

      {/*
        STATE AT A GLANCE (#74's readings, #492's shape).

        ⚠ **THE HIERARCHY IS THE FIX.** His frame showed a stroked pill holding
        a 67-character headline over a 10px grey paragraph carrying the actual
        reading — the loudest element on the page's first block carrying the
        least information per pixel. So the label is now a quiet eyebrow capped
        at 40 AT THE SCHEMA, and `source` — the reading it cites — is drawn in
        the page's normal reading face. It is still shown under the label and
        still never hidden in a tooltip he has to discover.

        ⚠ **THE GRID IS WHAT FIXES THE RAGGED EDGE, and it fixes it by
        construction rather than by a shift writing shorter sentences.** Three
        pills in a wrapping flex row put two on the first line and orphaned the
        third, each cell as tall as its own paragraph. Equal grid cells share a
        row, so the labels align whatever the sources do. The column count is
        the number of readings (`chips.max(6)` at the schema), capped at three
        so six readings become two rows of three rather than six slivers —
        `.dp-set__statcard`'s own pattern, and the reason this sets a custom
        property instead of a class per count.
      */}
      {program.chips.length > 0 && (
        <div
          className="dp-crew__state dp-crew__gap"
          style={{ "--dp-statecols": Math.min(program.chips.length, 3) } as CSSProperties}
        >
          {program.chips.map((chip, index) => (
            /* Composite key (PR #78 review nit): labels are writer-controlled
               and the schema does not force them unique. */
            <div key={`${index}-${chip.label}`} className="dp-crew__statecell">
              <p className="dp-crew__statelabel">
                <span
                  aria-hidden="true"
                  className={cn("dp-crew__statedot", STATE_DOT[chip.tone] ?? STATE_DOT.neutral)}
                />
                {STATE_SPOKEN[chip.tone] && (
                  <span className="sr-only">{STATE_SPOKEN[chip.tone]}</span>
                )}
                {chip.label}
              </p>
              {chip.source && <p className="dp-crew__statesrc">{chip.source}</p>}
            </div>
          ))}
        </div>
      )}

      <p className="dp-crew__mission dp-crew__gap">{program.mission}</p>

      <div className="dp-crew__rule">
        <div className="dp-crew__focus">
          <span className="dp-crew__subhead">Focus</span>
          <span className="dp-crew__title">{program.focus.title || "—"}</span>
          <span
            className={cn(
              "dp-crew__chip",
              program.focus.state === "confirmed" && "dp-crew__chip--good",
            )}
          >
            {FOCUS_LABEL[program.focus.state] ?? program.focus.state}
          </span>
        </div>

        {/* ⚠ VERBATIM, AND NOT ITALIC (§4). The words are untouchable — §1's
            first rule — and the face is the only thing this brief changes. */}
        {program.focus.quote && (
          <blockquote className="dp-crew__quote">
            “{program.focus.quote}”
            {program.focus.quotedAt && (
              <span className="dp-crew__quoteWho"> — you, {shortDate(program.focus.quotedAt)}</span>
            )}
          </blockquote>
        )}
      </div>

      {program.milestone && (
        <div className="dp-crew__rule">
          <h3 className="dp-crew__title">{program.milestone.title}</h3>

          {/* The progress bar (#74 item 1) — READ off the steps below, never a
              second number beside them. An in-progress step fills half, so the
              bar moves the day work starts. */}
          {program.milestone.steps.length > 0 && (() => {
            const progress = milestoneProgress(program.milestone.steps);
            return (
              <div className="dp-crew__gap">
                <div className="dp-crew__track">
                  <div
                    className="dp-crew__fill"
                    style={{ width: `${Math.round(progress.fraction * 100)}%` }}
                  />
                </div>
                <p className="dp-crew__mono dp-crew__gap--tight">
                  {milestoneCountLine(progress)}
                </p>
              </div>
            );
          })()}

          <ol className="dp-crew__steps">
            {program.milestone.steps.map((step, index) => (
              <li key={`${index}-${step.title}`} className="dp-crew__step">
                {/* aria-hidden: the state is said in words in the pill at the
                    row's end, so a screen reader hearing the marker too would
                    hear every step's state twice. */}
                <span
                  aria-hidden="true"
                  className={cn("dp-crew__stepmark", STEP_MARK[step.state])}
                >
                  {step.state === "done" && <Check size={10} strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    "dp-crew__steptext",
                    step.state === "done" && "dp-crew__steptext--done",
                  )}
                >
                  {step.title}
                </span>
                {/* The banner's OWN outlined chip, not a second pill class —
                    it already carries the two tones #414 asks for, and the
                    words are `STEP_LABEL`'s, unchanged. */}
                <span
                  className={cn(
                    "dp-crew__chip dp-crew__stepstate",
                    step.state === "blocked" && "dp-crew__chip--warn",
                  )}
                >
                  {STEP_LABEL[step.state] ?? step.state}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {program.ladder.length > 0 && (
        <div className="dp-crew__rule">
          {/* The queue-read stamp rides the head (#493): the cards below are a
              derived snapshot, exactly NEXT UP's shape, and the block says when
              it looked rather than implying an instant it does not have. */}
          <div className="dp-crew__ladderhead">
            <h3 className="dp-crew__subhead">The ladder</h3>
            {ladderItems.length > 0 && (
              <span className="dp-crew__mono">queue read {shortDate(program.ladderCards.readAt)}</span>
            )}
          </div>

          {/* The rung bar (#74 item 2) — the whole climb in one glance: filled
              is done, ringed is where we stand, light is queued, dashed is
              parked. The list below stays the reading copy. */}
          <div className="dp-crew__rungbar dp-crew__gap" aria-hidden="true">
            {program.ladder.map((rung) => (
              <div key={`bar-${rung.key}`} className="dp-crew__rungcell">
                <span className={cn("dp-crew__rungseg", `dp-crew__rungseg--${rung.state}`)} />
                <span
                  className={cn(
                    "dp-crew__rungkey",
                    rung.state === "current" && "dp-crew__rungkey--current",
                  )}
                >
                  {rung.key}
                </span>
              </div>
            ))}
          </div>

          <ul className="dp-crew__rungs">
            {program.ladder.map((rung) => {
              const cards = cardsOn(rung.key);
              const open = openRungs.has(rung.key);
              return (
                <li key={rung.key}>
                  <div className="dp-crew__rung">
                    <span className="dp-crew__num dp-crew__rungid">{rung.key}</span>
                    <span
                      className={cn(
                        "dp-crew__rungtitle",
                        rung.state === "current" && "dp-crew__rungtitle--current",
                      )}
                    >
                      {rung.title}
                    </span>
                    {/* THE COUNT ALWAYS SHOWS; THE CARDS SHOW ON A TAP (#493
                        move 2, his card's own words). A rung with nothing
                        waiting draws no control — a button promising a list
                        with nothing in it is a dead control. */}
                    {cards.length > 0 && (
                      <button
                        type="button"
                        className="dp-crew__rungcount"
                        aria-expanded={open}
                        onClick={() => toggleRung(rung.key)}
                        data-testid={`crew-rung-cards-${rung.key}`}
                      >
                        {cards.length} waiting
                      </button>
                    )}
                    <span className="dp-crew__mono">{RUNG_LABEL[rung.state] ?? rung.state}</span>
                  </div>
                  {open && cards.length > 0 && (
                    <ul className="dp-crew__titles dp-crew__rungdrop">
                      <CardTitles
                        titles={cards}
                        intents={intentsByCard}
                        onIntent={liveIntent}
                        pendingCard={intentPendingCard}
                        mark={markOf}
                      />
                    </ul>
                  )}
                </li>
              );
            })}

            {/* THE HONEST REMAINDER (#493): on the ladder, rung not yet named.
                A rung label is transcription — applied only where the record
                names the rung — so a card nobody has placed says so here
                rather than being guessed onto a rung. One word from him
                places one; the relay applies the label. */}
            {unplaced.length > 0 && (
              <li>
                <div className="dp-crew__rung">
                  <span className="dp-crew__num dp-crew__rungid" aria-hidden="true">—</span>
                  <span className="dp-crew__rungtitle">
                    Rung not yet named — a word from you places one
                  </span>
                  <button
                    type="button"
                    className="dp-crew__rungcount"
                    aria-expanded={openRungs.has(UNPLACED_KEY)}
                    onClick={() => toggleRung(UNPLACED_KEY)}
                    data-testid="crew-rung-cards-unplaced"
                  >
                    {unplaced.length} waiting
                  </button>
                </div>
                {openRungs.has(UNPLACED_KEY) && (
                  <ul className="dp-crew__titles dp-crew__rungdrop">
                    <CardTitles
                      titles={unplaced}
                      intents={intentsByCard}
                      onIntent={liveIntent}
                      pendingCard={intentPendingCard}
                      mark={markOf}
                    />
                  </ul>
                )}
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * A date he can read at a glance. Never a relative "2 hours ago" — a ruling's
 * date is a fact and relative time makes it a moving one.
 *
 * ⚠ **24-HOUR, FORCED — AND THIS IS THE SECOND INSTANCE OF A CLASS THE PAGE
 * HAD ALREADY RULED ON.** `CrewWorkingNow`'s `clockTime` carries the ruling in
 * its own docblock: *"the locale default here is `03:48 pm` … every other time
 * in his world is 24-hour — the runner's close-stamps, the shift rows, his own
 * #295 report quoting `19:46` and `20:17` — so the one clock he would be
 * comparing against was the one written differently."*
 *
 * That fix reached one of the three formatters on this page. This one and
 * `CrewNextUp`'s `readStamp` were its siblings and were missed, so his own
 * confirming quote read *"— you, 25 Aug, 07:17 pm"* directly above a shift
 * strip printing `20:17`. Found by LOOKING at the rendered page during brief
 * 08's drive, which is how the first instance was found too.
 */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
