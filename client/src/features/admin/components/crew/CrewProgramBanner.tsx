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
import { useState } from "react";

import { Check } from "lucide-react";

import { indexIntentsByCard } from "@shared/crewCardIntents";
import type { CrewQueueTitle } from "@shared/crewQueueTitles";
import { cn } from "@/lib/utils";
import { TableHead } from "@/foundation";
import { staffDateTime } from "@/foundation/staffDate";
import { CardTitles } from "./CrewCardTitles";
import { milestoneCountLine, milestoneProgress, stepsWithLiveState } from "./crewTypes";
import type { CrewBriefingView, CrewCardIntentsView, CrewLadderCardsSource, CrewQueueRead } from "./crewTypes";
import { QueueReadStamp } from "./QueueReadStamp";

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

/**
 * The pseudo-rung the honest remainder expands under (#493). Real rungs enter
 * the open-set through `rungSetKey`, which prefixes them — so this key cannot
 * collide with a briefing rung whatever the ladder is keyed (PR #497 review,
 * finding 2): a real key `K` becomes `rung:K`, and no `rung:`-prefixed string
 * equals this bare word.
 */
const UNPLACED_KEY = "unplaced";
const rungSetKey = (key: string) => `rung:${key}`;
const finishedSetKey = (key: string | null) => `finished:${key ?? "unplaced"}`;

export function CrewProgramBanner({
  program, ladderCards, finished, closedCards, queueRead, now, cardIntents, onIntent, intentPendingCard,
}: {
  program: CrewBriefingView["program"];
  /** The ladder's cards — live from GitHub when it answers, the edition's list otherwise (#1193). */
  ladderCards: CrewLadderCardsSource;
  /** Ladder cards that finished in the window, on their rung — drawn struck through (#1201). */
  finished: readonly { readonly issueNumber: number; readonly title: string; readonly rung: string | null }[];
  /** Cards GitHub has closed; a milestone step naming one reads as done (#1201). */
  closedCards: readonly number[];
  queueRead: CrewQueueRead;
  now: number;
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
  /*
    FINISHED STEPS FOLD (#1193, 2026-09-25). His words: *"its difficult for me
    to decipher what is actually going on … i must be able to see the main
    program we are working on which milestones we are on etc still"*. On the
    day he said it the milestone held 28 done steps of long prose above the
    one in progress and the one waiting, so "which milestone we are on" was
    two screens down. The bar and the count still read off EVERY step; what
    folds is the reading copy of the finished ones, one tap away. Nothing is
    trimmed or paraphrased — a folded step is the whole step.
  */
  const [showDone, setShowDone] = useState(false);
  /* A step naming a closed card reads as done, whatever the edition says (#1201). */
  const steps = program.milestone ? stepsWithLiveState(program.milestone.steps, closedCards) : [];
  const finishedOn = (rungKey: string | null) => finished.filter((card) => card.rung === rungKey);
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
  const ladderItems = ladderCards.items;
  const kindByNumber = new Map(ladderItems.map((item) => [item.issueNumber, item.kind]));
  /* A live row carries its own note (a hold, "debt" — #1199); the kind word
     is the fallback and is all the edition's snapshot can say. */
  const noteByNumber = new Map(ladderItems.map((item) => [item.issueNumber, item.note ?? null]));
  const markOf = (card: CrewQueueTitle) =>
    noteByNumber.get(card.number) ?? LADDER_KIND_WORD[kindByNumber.get(card.number) ?? ""] ?? null;
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

      {/* THE READINGS BLOCK (#74 → #492) IS GONE ON HIS WORD (#1201, 2026-09-25:
          *"i barely read the overview circled in red"*). Its place at the top
          of the page is the section menu (`CrewNav`), which jumps and counts
          rather than narrates. The edition may still carry `chips`; nothing
          draws them. */}
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
              <span className="dp-crew__quoteWho"> — you, {staffDateTime(program.focus.quotedAt)}</span>
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
          {steps.length > 0 && (() => {
            const progress = milestoneProgress(steps);
            return (
              <div className="dp-crew__gap">
                <div className="dp-crew__track">
                  <div
                    className="dp-crew__fill"
                    style={{ width: `${Math.round(progress.fraction * 100)}%` }}
                  />
                </div>
                <p className="dp-chrome dp-crew__mono dp-crew__gap--tight">
                  {milestoneCountLine(progress)}
                </p>
              </div>
            );
          })()}

          <ol className="dp-crew__steps">
            {steps.map((step, index) => (showDone || step.state !== "done") && (
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
          {(() => {
            const done = steps.filter((step) => step.state === "done").length;
            if (done === 0) return null;
            return (
              <button
                type="button"
                className="dp-crew__more"
                aria-expanded={showDone}
                onClick={() => setShowDone((current) => !current)}
                data-testid="crew-milestone-done-toggle"
              >
                {showDone ? `Hide the ${done} finished` : `Show the ${done} finished`}
              </button>
            );
          })()}
        </div>
      )}

      {program.ladder.length > 0 && (
        <div className="dp-crew__rule">
          {/* The queue-read stamp rides the head (#493): the cards below are a
              derived snapshot, exactly NEXT UP's shape, and the block says when
              it looked rather than implying an instant it does not have. */}
          <div className="dp-crew__ladderhead">
            <h3 className="dp-crew__subhead">The ladder</h3>
            <QueueReadStamp read={queueRead} now={now} />
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
              const open = openRungs.has(rungSetKey(rung.key));
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
                        onClick={() => toggleRung(rungSetKey(rung.key))}
                        data-testid={`crew-rung-cards-${rung.key}`}
                      >
                        {cards.length} waiting
                      </button>
                    )}
                    {finishedOn(rung.key).length > 0 && (
                      <button
                        type="button"
                        className="dp-crew__rungcount dp-crew__rungcount--done"
                        aria-expanded={openRungs.has(finishedSetKey(rung.key))}
                        onClick={() => toggleRung(finishedSetKey(rung.key))}
                        data-testid={`crew-rung-finished-${rung.key}`}
                      >
                        {finishedOn(rung.key).length} finished
                      </button>
                    )}
                    <span className="dp-chrome dp-crew__mono">{RUNG_LABEL[rung.state] ?? rung.state}</span>
                  </div>
                  {openRungs.has(finishedSetKey(rung.key)) && finishedOn(rung.key).length > 0 && (
                    <ul className="dp-crew__titles dp-crew__rungdrop">
                      {finishedOn(rung.key).map((card) => (
                        <li key={card.issueNumber} className="dp-crew__finished">
                          <span className="dp-chrome dp-crew__ref">#{card.issueNumber}</span>
                          <s>{card.title}</s>
                        </li>
                      ))}
                    </ul>
                  )}
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
