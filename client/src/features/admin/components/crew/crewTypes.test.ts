/**
 * A reply is rendered SOMEWHERE on the page, whatever its card's state — the
 * regression for PR #72 gate-review finding 2.
 *
 * Needs You renders reply threads under OPEN cards only; everything else must
 * fall through to the GENERAL box (the journal until #293 removed it — the
 * rule is unchanged, only the box's name). The first version keyed it on
 * "card still listed", so a reply on an ANSWERED card — listed under
 * "Recently answered", thread nowhere — rendered on no part of the page. His
 * words are the steering wheel; a rendering rule that can drop them is the
 * server-side never-refuse promise broken at the last step.
 */
import { describe, expect, it } from "vitest";

import { CREW_CARD_STATES, crewCardNeedsHim } from "../../../../../../shared/crewCardState";
import { CREW_HOLD_WORD } from "../../../../../../shared/crewNextUpHold";
import { planProblemRows } from "../../../../../../shared/crewProblemState";
import {
  cardIsClosed,
  cardsNamedInText,
  stepsWithLiveState,
  eyeItemsFor,
  needsYouFor,
  partitionEyeItems,
  milestoneCountLine,
  milestoneProgress,
  heldCount,
  nextUpRows,
  pipelineNotDone,
  problemsFor,
} from "./crewTypes";

/** A live view carrying only what `cardIsClosed` reads. */
const liveWith = (desk: {
  closedCards?: number[];
  openCards?: number[];
  highestCard?: number;
  openComplete?: boolean;
}) => ({
  available: true as const,
  stale: false as const,
  why: null,
  desk: {
    closedCards: desk.closedCards ?? [],
    openCards: desk.openCards ?? [],
    highestCard: desk.highestCard ?? 0,
    openComplete: desk.openComplete ?? true,
  },
}) as unknown as Parameters<typeof cardIsClosed>[0];

const closedBy = (desk: Parameters<typeof liveWith>[0]) => cardIsClosed(liveWith(desk));


/**
 * ⚠ **THE PAGE'S PROBLEM FILTER AND THE DESK SWEEP'S PROBLEM READER ANSWER THE
 * SAME QUESTION FROM THE TWO ENDS, AND NEITHER HAD AN ARM (#2247).**
 *
 * `problemsFor` decides whether a stale row is DRAWN; `planProblemRows`
 * (`shared/crewProblemState.ts`, run by `scripts/crew-desk-sweep.mts`) decides
 * whether it is NAMED for repair. They already share the `#N` reader by import
 * — that is what moving it to `shared/` bought — but nothing held the two
 * JUDGEMENTS together, and they can drift in two ways that both fail silently:
 * narrow the page's read to the title, or move it from `.some` to `.every`, and
 * the sweep goes on reporting rows his page now keeps, or stays quiet about
 * rows it now hides.
 *
 * **The disagreement is only visible on the night GitHub will not answer**, when
 * the page's live filter cannot fire and every row the sweep should have had
 * repaired is drawn. That is #1399, four nights running, and it is the night he
 * complained about.
 */
describe("the page's filter and the sweep's reader agree, row for row (#2247)", () => {
  /* One corpus, carrying every shape either reader has a rule about. */
  const corpus = [
    { id: "card-closed", title: "A fault (#1989)", detail: "", severity: "warning" as const, state: "open" as const },
    { id: "card-open", title: "A fault (#999)", detail: "", severity: "warning" as const, state: "open" as const },
    { id: "in-the-detail", title: "A fault", detail: "card #1990 covers it", severity: "warning" as const, state: "open" as const },
    { id: "one-of-two", title: "A fault (#1989)", detail: "and (#999)", severity: "warning" as const, state: "open" as const },
    { id: "names-nothing-1399", title: "No card in the words", detail: "none here either", severity: "warning" as const, state: "open" as const },
  ];
  const closedCards = [1989, 1990];
  /*
    ⚠ **ONE RECORD, READ ONCE, SO A DISAGREEMENT IS THE READERS' AND NEVER THE
    FIXTURE'S.** The sweep's three-state `isOpen` is derived here from the
    page's own `cardIsClosed` rather than from a second hand-kept table — the
    first shape of this arm kept two and went red on its own fixture, because
    `cardIsClosed` reads a card absent from a COMPLETE open list as closed and
    the table beside it did not. That is the memory *deriving from a copy is not
    deriving*, met while writing the guard against it.
  */
  const live = liveWith({ closedCards, openCards: [999], highestCard: 3000 });
  const isOpen = (card: number) => !cardIsClosed(live)(card);

  it("every row the page hides is a row the sweep names, and no other", () => {
    const drawn = problemsFor(live, corpus).map((one) => one.id);
    const hidden = corpus.map((one) => one.id).filter((id) => !drawn.includes(id));

    const plan = planProblemRows(corpus, cardsNamedInText, isOpen);

    expect(plan.stale.map((one) => one.row.id)).toEqual(hidden);
    /* And the populations are not both empty, which would satisfy the line
       above with two readers that do nothing. */
    expect(hidden.length, "the corpus must contain a row the page hides").toBeGreaterThan(0);
    expect(drawn.length, "and one it draws").toBeGreaterThan(0);
  });

  it("⚠ a row the page draws for ever is the one the sweep reports separately", () => {
    /* Named by neither reader's closed-card rule, because it names no card: the
       page can never retire it and, until #2247, nothing named it either. */
    const plan = planProblemRows(corpus, cardsNamedInText, isOpen);
    expect(plan.noCard.map((one) => one.row.id)).toEqual(["names-nothing-1399"]);
    expect(
      problemsFor(live, corpus).map((one) => one.id),
      "and his page is still drawing it",
    ).toContain("names-nothing-1399");
  });

  it("⚠ an `info` row is drawn by neither and still judged by the sweep", () => {
    /* #1201 took info rows off the page; it did not make a stale one a correct
       record. The two readers disagree here ON PURPOSE, and the sweep's report
       says `[info — his page does not draw it today]` on the line. */
    const note = [{
      id: "note", title: "A note (#1989)", detail: "", severity: "info" as const, state: "open" as const,
    }];
    expect(problemsFor(live, note)).toEqual([]);
    expect(planProblemRows(note, cardsNamedInText, isOpen).stale).toHaveLength(1);
  });
});

describe("a milestone step that names a closed card reads as done (#1201)", () => {
  const steps = [
    { title: "The N1 deep review — asked for on #1121", state: "in-progress" as const },
    { title: "THE SWITCH LIST IS ON YOUR DESK (#1132)", state: "waiting" as const },
    { title: "Still open (#999)", state: "waiting" as const },
    { title: "No card named", state: "blocked" as const },
  ];

  it("overrides waiting and in-progress when the card is closed, and leaves the rest alone", () => {
    const only = (...closed: number[]) =>
      stepsWithLiveState(steps, (n) => closed.includes(n)).map((s) => s.state);
    expect(only(1132)).toEqual(["in-progress", "done", "waiting", "blocked"]);
    expect(only(1121, 1132)).toEqual(["done", "done", "waiting", "blocked"]);
    expect(only()).toEqual(["in-progress", "waiting", "waiting", "blocked"]);
  });

  /*
    #1586 — THE ARM THAT FAILS AGAINST THE SHIPPED READING. His words,
    2026-09-30: *"why does it still say all these things are in progress? are
    they?"*. The three cards below are CLOSED and none of them is in
    `closedCards`, which is one page of a 48-hour search: #1408 closed four
    days earlier, and #1278 and #1459 closed inside the window but were
    crowded off a page of 100 by the 132 items that closed in it. Handed
    `closedCards` alone — the shipped input — every one of these steps reads
    "in progress"; read through the OPEN set's complement they read done.
  */
  it("a step whose card closed outside the recent window, or off its page, still reads done", () => {
    const his = [
      { title: "the dressed signed views (#1278)", state: "in-progress" as const },
      { title: "the checker's bounded copy (#1408)", state: "in-progress" as const },
      { title: "the outfit test (#1459)", state: "in-progress" as const },
    ];
    /* Nothing recently-closed is known; 1594 is the only thing OPEN. */
    const closed = closedBy({ closedCards: [], openCards: [1594], highestCard: 1594 });
    expect(stepsWithLiveState(his, closed).map((s) => s.state)).toEqual(["done", "done", "done"]);
  });

  it("POSITIVE CONTROL: an OPEN card's step is left exactly as the crew wrote it", () => {
    const open = [
      { title: "N2c — Campaigns (#1469)", state: "waiting" as const },
      { title: "the seat gate's rung read (#1541)", state: "in-progress" as const },
    ];
    const closed = closedBy({ openCards: [1469, 1541], highestCard: 1594 });
    expect(stepsWithLiveState(open, closed).map((s) => s.state)).toEqual(["waiting", "in-progress"]);
  });
});

describe("cardIsClosed — the one reading four surfaces ask (#1586)", () => {
  it("a number at or below the highest seen and not open is CLOSED", () => {
    const closed = closedBy({ openCards: [1469, 1594], highestCard: 1594 });
    expect(closed(1278)).toBe(true);
    expect(closed(1408)).toBe(true);
    expect(closed(1469)).toBe(false);
    expect(closed(1594)).toBe(false);
  });

  it("the recent window still answers on its own — it is a fact, not a fallback", () => {
    const closed = closedBy({ closedCards: [1278], openCards: [], highestCard: 0 });
    expect(closed(1278), "in the window, and above the bound").toBe(true);
  });

  /*
    THE DIRECTION THIS FAILS IN, driven rather than asserted in prose. A card
    above the bound, and every card when the open read truncated, is treated
    as OPEN — his page saying *less done than it is*, which costs him a
    question. The other direction would draw a milestone as finished when it
    is not, which is what THE MILESTONE GATE exists to stop.
  */
  it("a number ABOVE the highest seen is not closed — a typo never reads as done", () => {
    const closed = closedBy({ openCards: [1594], highestCard: 1594 });
    expect(closed(9999)).toBe(false);
  });

  it("a TRUNCATED open read falls back to the window alone, never to the complement", () => {
    const closed = closedBy({
      closedCards: [1278], openCards: [1594], highestCard: 1594, openComplete: false,
    });
    expect(closed(1278), "the window still answers").toBe(true);
    expect(closed(1408), "absent from a page that overflowed proves nothing").toBe(false);
  });

  it("an unavailable live view closes nothing at all", () => {
    const closed = cardIsClosed({ available: false, why: "GitHub has not answered" } as unknown as Parameters<typeof cardIsClosed>[0]);
    expect(closed(1278)).toBe(false);
  });
});

describe("cardsNamedInText — one reader for the `#N` token", () => {
  it("reads every card a sentence names, and nothing that only looks like one", () => {
    expect(cardsNamedInText("closes #1278 and #0409 after #12")).toEqual([1278, 409, 12]);
    expect(cardsNamedInText("no cards here"), "no tokens").toEqual([]);
    /* The shipped token's own two edges, pinned rather than reinvented: what
       PRECEDES a `#` must not be a letter or digit, and what FOLLOWS the
       number may be anything but a digit. So `abc#99` is not a card and
       `#1278a` is #1278 — moving either is a change to how every problem row
       and milestone step is read, not a tidy-up. */
    expect(cardsNamedInText("abc#99"), "a letter before the # is not a card").toEqual([]);
    expect(cardsNamedInText("#1278a"), "a letter after the number still names it").toEqual([1278]);
    expect(cardsNamedInText("#12345"), "a digit after the number is part of it").toEqual([12345]);
    expect(cardsNamedInText("#0"), "zero is not a card").toEqual([]);
  });

  it("is re-entrant — a shared regex with lastIndex would drop the second call", () => {
    expect(cardsNamedInText("#1278")).toEqual([1278]);
    expect(cardsNamedInText("#1278")).toEqual([1278]);
  });
});

describe("the milestone progress bar (#74)", () => {
  it("counts each state and fills done + half of in-progress", () => {
    const progress = milestoneProgress([
      { state: "done" },
      { state: "in-progress" },
      { state: "waiting" },
      { state: "blocked" },
    ]);
    expect(progress).toEqual({
      done: 1,
      inProgress: 1,
      waiting: 1,
      blocked: 1,
      total: 4,
      fraction: (1 + 0.5) / 4,
    });
  });

  it("an empty step list is 0, not NaN — a NaN width collapses the bar silently", () => {
    expect(milestoneProgress([]).fraction).toBe(0);
  });

  it("all done reads 1.0 — the bar can actually fill", () => {
    expect(milestoneProgress([{ state: "done" }, { state: "done" }]).fraction).toBe(1);
  });

  it("the count line says only what is non-zero", () => {
    expect(
      milestoneCountLine(milestoneProgress([{ state: "done" }, { state: "waiting" }, { state: "waiting" }])),
    ).toBe("1 done · 2 waiting");
    expect(milestoneCountLine(milestoneProgress([{ state: "blocked" }]))).toBe("1 blocked");
  });
});

describe("what is not done — the pipeline, cut and ranked (#291)", () => {
  const ITEMS = [
    { id: "a", title: "a", status: "building", prNumber: null, note: null },
    { id: "b", title: "b", status: "merged", prNumber: 1, note: null },
    { id: "c", title: "c", status: "blocked", prNumber: null, note: null },
    { id: "d", title: "d", status: "in-review", prNumber: 2, note: null },
    { id: "e", title: "e", status: "waiting-founder", prNumber: null, note: null },
  ] as const;

  it("merged rows leave — they are history, and history has one place now", () => {
    /* 107 entries, 92 merged: the section was a changelog wearing the word
       "pipeline", and the 15 rows that could change what he does were
       scattered through it. */
    expect(pipelineNotDone([...ITEMS]).map((item) => item.id)).not.toContain("b");
  });

  it("⚠ ranked by how much a row wants a human, never by when it was written", () => {
    expect(pipelineNotDone([...ITEMS]).map((item) => item.id)).toEqual(["c", "e", "d", "a"]);
  });

  it("stable within a rank, so equal rows keep the order the shifts recorded", () => {
    const two = [
      { id: "first", title: "t", status: "in-review", prNumber: null, note: null },
      { id: "second", title: "t", status: "in-review", prNumber: null, note: null },
    ] as const;
    expect(pipelineNotDone([...two]).map((item) => item.id)).toEqual(["first", "second"]);
  });

  it("does not mutate the array it was given", () => {
    const items = [...ITEMS];
    pipelineNotDone(items);
    expect(items.map((item) => item.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
});

/*
  ⚠ NINE ARMS OVER `recentHistory` AND `foldHistory` WERE HERE AND WENT
  WITH THEIR SUBJECT (#438, 2026-09-02). The founder deleted `ALREADY DEALT
  WITH`; after its component was removed, nothing in the product read either
  derivation and these arms were the only thing keeping them alive. **A suite
  that cannot go red when its own subject is deleted is how dead code keeps a
  live reputation** — this repository's credit-velocity lesson, and the reason
  they were removed rather than left passing over unreachable functions.

  What replaced the coverage, so it is not simply gone: `section08-guard.test.ts`
  §7 now asserts that no surface reads `recentHistory(`, that the derivations
  are absent from `crewTypes.ts`, that the component file is gone, and that
  none of the FOUR dead history headings can come back — with a positive
  control and a population floor on each sweep.
*/

describe("NEXT UP — blocked-on-him is derived off his desk, never stored (#290)", () => {
  const NEXT_UP = {
    readAt: "2026-08-30T09:00:00Z",
    items: [
      { issueNumber: 278, title: "the shell is empty", urgent: true },
      { issueNumber: 287, title: "desk hygiene", urgent: false },
    ],
  } as const;
  const card = (issueNumber: number | null, state: string) => ({
    id: `card-${issueNumber}`, title: "t", productImpact: "", workedExample: null,
    options: [], recommendation: null, state, issueNumber,
    filedAt: "2026-08-30T00:00:00+10:00",
  });

  it("⚠ an OPEN card naming the issue makes it visibly waiting on him", () => {
    /* #278 sat looking like ordinary queued work while it was actually waiting
       on one sentence from him — a queue that cannot show that is the same
       failure with a nicer surface. */
    const rows = nextUpRows(NEXT_UP as never, [card(278, "open")] as never);
    expect(rows.find((row) => row.issueNumber === 278)!.blockedOnYou).toBe(true);
    expect(rows.find((row) => row.issueNumber === 287)!.blockedOnYou).toBe(false);
  });

  it("an ANSWERED card stops blocking the moment he answers — no shift edit needed", () => {
    const rows = nextUpRows(NEXT_UP as never, [card(278, "answered")] as never);
    expect(rows.every((row) => !row.blockedOnYou)).toBe(true);
  });

  it("a card with no issue number blocks nothing (and cannot match by accident)", () => {
    const rows = nextUpRows(NEXT_UP as never, [card(null, "open")] as never);
    expect(rows.every((row) => !row.blockedOnYou)).toBe(true);
  });

  it("the rows are the block's own list, in its own order, unfiltered", () => {
    /* The count must agree with `gh issue list --label founder-ordered
       --state open`, which is his card's stated check: nothing here may drop
       or reorder a row. */
    expect(nextUpRows(NEXT_UP as never, []).map((row) => row.issueNumber)).toEqual([278, 287]);
  });
});

describe("NEXT UP — a skipped row says why, and the reason cannot outlive it (#298)", () => {
  /**
   * His question, looking at his own page: *"on my desk it says [8 items] but
   * its currently working on [#280] did it skip things or what happened"*.
   *
   * It skipped five, correctly, for FOUR different reasons — and the block
   * could render exactly one of them. These arms are the four, plus the
   * property that makes the fourth safe.
   */
  const rowsFor = (items: unknown[], cards: unknown[] = []) =>
    nextUpRows({ readAt: "2026-08-30T09:00:00Z", items } as never, cards as never);
  const card = (issueNumber: number | null, state: string) => ({
    id: `card-${issueNumber}`, title: "t", productImpact: "", workedExample: null,
    options: [], recommendation: null, state, issueNumber,
    filedAt: "2026-08-30T00:00:00+10:00",
  });

  it("a takeable row carries NO chip — the silence is what makes the order readable", () => {
    /* The first build of this block put a word on every row and he could not
       see the order for the labels. Only an exception gets a word. */
    const [row] = rowsFor([{ issueNumber: 281, title: "invite", urgent: false }]);
    expect(row.hold).toBeNull();
  });

  it("each held state says its own plain word, never a label name", () => {
    /* He is not code-savvy: the chip says "Needs Fable", not `awaiting-fable`. */
    const rows = rowsFor([
      { issueNumber: 267, title: "labels", urgent: true, held: { state: "blocked" } },
      { issueNumber: 279, title: "fitted", urgent: true, held: { state: "fable" } },
      { issueNumber: 293, title: "park", urgent: true, held: { state: "sitting" } },
    ]);
    expect(rows.map((row) => row.hold?.word)).toEqual(["Blocked", "Needs Fable", "Needs a sitting"]);
    expect(rows.map((row) => row.hold?.kind)).toEqual(["blocked", "fable", "sitting"]);
  });

  it("⚠ his desk outranks a label — an answer he can act on is the one worth showing", () => {
    const [row] = rowsFor(
      [{ issueNumber: 267, title: "labels", urgent: true, held: { state: "sitting" } }],
      [card(267, "open")],
    );
    expect(row.hold?.kind).toBe("you");
    expect(row.hold?.word).toBe("Waiting on you");
  });

  it("the filer's sentence rides the chip", () => {
    const [row] = rowsFor([{
      issueNumber: 267, title: "labels", urgent: true,
      held: { state: "blocked", because: "the sectioned Settings modal (your section 03 brief)" },
    }]);
    expect(row.hold?.because).toBe("the sectioned Settings modal (your section 03 brief)");
  });

  /**
   * ⚠ **THE ANTI-ROT PROPERTY, AND IT IS THE WHOLE POINT OF THE DESIGN.**
   * #298: *"A row whose reason is stale is this bug again"* — `#278` told him
   * it was blocked for two shifts after it was unblocked, because the state
   * lived in prose. Removing the label removes the chip AND the sentence in one
   * act, so a stale reason can never be shown: the state is what renders it.
   */
  it("clearing the hold clears the reason with it, in one act", () => {
    const held = {
      issueNumber: 267, title: "labels", urgent: true,
      held: { state: "blocked", because: "a sentence that is now wrong" },
    };
    const { held: _dropped, ...unblocked } = held;
    expect(rowsFor([held])[0].hold?.because).toBe("a sentence that is now wrong");
    expect(rowsFor([unblocked])[0].hold).toBeNull();
  });

  it("held rows keep their place, and the count is honest about how many", () => {
    /* His own instruction: *"Do not quietly hide blocked rows — he needs to see
       that seven of eight are stuck."* Nothing sorts, nothing filters. */
    const rows = rowsFor([
      { issueNumber: 267, title: "a", urgent: true, held: { state: "blocked" } },
      { issueNumber: 281, title: "b", urgent: false },
      { issueNumber: 293, title: "c", urgent: false, held: { state: "sitting" } },
    ]);
    expect(rows.map((row) => row.issueNumber)).toEqual([267, 281, 293]);
    expect(heldCount(rows)).toBe(2);
    expect(heldCount(rowsFor([{ issueNumber: 281, title: "b", urgent: false }]))).toBe(0);
  });
});

/* ================================================================
   #493 — THE ONE-PLACE RULE AS A GUARD, NOT A SENTENCE
   ================================================================ */

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  CREW_LADDER_GROUP_KEYS,
  CREW_PIPELINE_ORPHAN_GROUPS,
  PIPELINE_SWITCHED_KEY,
  onePlaceViolations,
  pipelineGroupFor,
} from "@shared/crewPipelineGroups";
import { exclusionFor } from "@shared/crewQueueExclusions";

describe("#493 — every open card is drawn in exactly one section", () => {
  /**
   * The four sections that draw cards, derived from ONE partition over a
   * fixture of real label shapes — including this card's own awkward ones: a
   * roadmap card also offered as a small fix, a founder-ordered design card,
   * a rung-labelled card that is also debt.
   */
  const FIXTURE: ReadonlyArray<{ readonly number: number; readonly labels: readonly string[] }> = [
    { number: 493, labels: ["founder-ordered"] },
    { number: 404, labels: ["founder-ordered", "design-unbuilt"] },
    { number: 26, labels: ["debt", "roadmap", "small-fix"] },
    { number: 108, labels: ["debt", "parked", "seat:janitor"] },
    { number: 246, labels: ["debt", "roadmap", "rung:N3"] },
    { number: 203, labels: ["parked", "rung:N2"] },
    { number: 22, labels: ["design-unbuilt"] },
    { number: 45, labels: ["debt", "parked", "seat:warden"] },
    { number: 219, labels: ["urgent"] },
    { number: 7777, labels: [] },
    { number: 484, labels: ["debt", "roadmap"] },
  ];

  const drawnSections = (cards: typeof FIXTURE) => {
    const orphanKeys = CREW_PIPELINE_ORPHAN_GROUPS.map((group) => group.key);
    const nextUp = cards.filter((card) => card.labels.includes("founder-ordered"));
    const rest = cards.filter((card) => !card.labels.includes("founder-ordered"));
    return [
      /* NEXT UP — the sweep's own rule (#290). */
      nextUp.map((card) => card.number),
      /* The switches' titles — the OFFERED population (#324's exclusions). */
      rest
        .filter((card) => pipelineGroupFor(card.labels) === PIPELINE_SWITCHED_KEY)
        .filter((card) => exclusionFor(card.labels) === null)
        .map((card) => card.number),
      /* The ladder (#493 move 2) — the partition's ladder homes. */
      rest
        .filter((card) => CREW_LADDER_GROUP_KEYS.includes(pipelineGroupFor(card.labels)))
        .map((card) => card.number),
      /* The pipeline block — the orphans. */
      rest
        .filter((card) => orphanKeys.includes(pipelineGroupFor(card.labels)))
        .map((card) => card.number),
    ];
  };

  it("the four drawn populations are pairwise disjoint over the real label shapes", () => {
    const sections = drawnSections(FIXTURE);
    expect(onePlaceViolations(sections)).toEqual([]);
    /* THE FLOOR, and it is exact rather than approximate: a card not drawn as
       a title anywhere must be a switch-reached card the panel EXCLUDED for a
       reason it says out loud in the count's own parenthesis (#324) — here
       the two parked seat cards. Anything else undrawn is the no-place
       failure this guard exists to catch. */
    const drawn = new Set(sections.flat());
    const undrawn = FIXTURE.filter((card) => !drawn.has(card.number));
    expect(undrawn.map((card) => card.number).sort((a, b) => a - b)).toEqual([45, 108]);
    for (const card of undrawn) {
      expect(pipelineGroupFor(card.labels)).toBe(PIPELINE_SWITCHED_KEY);
      expect(exclusionFor(card.labels)).not.toBeNull();
    }
  });

  it("⚠ POSITIVE CONTROL — a card duplicated into two sections reddens, by name", () => {
    const sections = drawnSections(FIXTURE).map((section) => [...section]);
    /* The exact doubling his order names: a NEXT UP card re-listed by the
       pipeline block. */
    sections[3].push(493);
    expect(onePlaceViolations(sections)).toEqual([493]);
  });

  it("the deployed briefing itself lists no card in both NEXT UP and the ladder", () => {
    /* The schema refuses this at the parse on the server; this arm reads the
       REAL file so the rule is also proven where the components consume it. */
    const briefing = JSON.parse(
      readFileSync(
        path.resolve(__dirname, "../../../../../../server/crew/crew-briefing.json"),
        "utf8",
      ),
    ) as {
      nextUp: { items: { issueNumber: number }[] };
      program: { ladderCards: { items: { issueNumber: number }[] } };
    };
    const nextUpNumbers = briefing.nextUp.items.map((item) => item.issueNumber);
    const ladderNumbers = briefing.program.ladderCards.items.map((item) => item.issueNumber);
    expect(onePlaceViolations([nextUpNumbers, ladderNumbers])).toEqual([]);
    /* The floor: both populations are real, or this arm is reading air. */
    expect(nextUpNumbers.length + ladderNumbers.length).toBeGreaterThan(0);
  });
});

type WaitingRow = {
  issueNumber: number;
  title: string;
  reason: string;
  filedAt: string;
  url: string;
  urgent: boolean;
};

describe("what still needs him — answered leaves the desk, not only closed (his question, 2026-09-25)", () => {
  const liveWith = (closedCards: number[], heldCards: number[], waitingOnYou: WaitingRow[] = []) =>
    ({ available: true, stale: false, why: null, desk: { closedCards, heldCards, waitingOnYou } }) as unknown as Parameters<typeof needsYouFor>[0];
  const card = (issueNumber: number | null) => ({ issueNumber, id: `c${issueNumber}` }) as unknown as Parameters<typeof needsYouFor>[1][number];
  const waiting = (issueNumber: number, reason: string): WaitingRow => ({
    issueNumber,
    title: `Card ${issueNumber}`,
    reason,
    filedAt: "2026-09-29T10:00:00Z",
    url: `https://github.com/x/y/issues/${issueNumber}`,
    urgent: false,
  });

  it("keeps a card that is open AND held; drops one that is open and no longer held (answered); drops a closed one", () => {
    const rows = [card(1208), card(1220), card(1207), card(null)];
    const kept = needsYouFor(liveWith([1207], [1208]), rows).map((c) => c.issueNumber);
    expect(kept).toEqual([1208, null]);
  });

  it("with no live read, everything the edition filed stays — the page cannot vouch either way", () => {
    const rows = [card(1208), card(1220)];
    const off = { available: false, why: "x" } as unknown as Parameters<typeof needsYouFor>[0];
    expect(needsYouFor(off, rows).map((c) => c.issueNumber)).toEqual([1208, 1220]);
  });

  it("a card whose own hold sentence names him is drawn even though no edition wrote it up (#1467)", () => {
    /* The measured night: every card in the edition was marked `done`, so the
       subtraction above had nothing to keep and the section read "Nothing is
       waiting on you" over #1492's open question. */
    const drawn = needsYouFor(
      liveWith([], [1492], [waiting(1492, "Michael's ruling on the retry shape (A / B / C in the body).")]),
      [],
    );
    expect(drawn).toHaveLength(1);
    expect(drawn[0].issueNumber).toBe(1492);
    /* The reply box and the thread key on the id, so it has to be one his
       answer can be filed under — and one the row can be sure of. */
    expect(drawn[0].id).toBe("card-1492");
    expect(drawn[0].state).toBe("open");
    /* Product impact leads the row: the filer's own sentence, with the marker
       put back so it reads as a sentence — the one word this row composes. */
    expect(drawn[0].productImpact)
      .toBe("Waiting on Michael's ruling on the retry shape (A / B / C in the body).");
    expect(drawn[0].options).toEqual([]);
    expect(drawn[0].recommendation).toBeNull();
  });

  it("a card the edition HAS written up keeps its prose and is not listed twice", () => {
    const rows = [card(1492)];
    const drawn = needsYouFor(
      liveWith([], [1492], [waiting(1492, "Michael's ruling on the retry shape")]),
      rows,
    );
    expect(drawn.map((c) => c.id)).toEqual(["c1492"]);
  });

  /*
    ⚠ **THE MARKER IS PUT BACK (the relay's nit on PR #1527, filed on #1467).**
    `holdReasonFromBody` strips `**Waiting on:**` to get the sentence, so a bare
    row printed #1434's as a line that begins with a pronoun. These arms pin the
    restored words and the one case that must NOT take them twice.
  */
  it("a bare row reads as a sentence rather than starting on a pronoun (#1467 slice 2)", () => {
    const drawn = needsYouFor(
      liveWith([], [1434], [waiting(1434, "you — a yes or no, and no is a fine answer.")]),
      [],
    );
    expect(drawn[0].productImpact).toBe("Waiting on you — a yes or no, and no is a fine answer.");
  });

  it("⚠ does not say it twice when the filer already wrote the words", () => {
    for (const sentence of [
      "Waiting on the founder's word",
      "waiting  on you — a yes or no",
      "  Waiting on him",
    ]) {
      const drawn = needsYouFor(liveWith([], [700], [waiting(700, sentence)]), []);
      expect(drawn[0].productImpact, sentence).toBe(sentence);
    }
  });

  it("the filer's own words are never edited — only prefixed", () => {
    const sentence = "YOU. And the frames are in the comment, not the body.";
    const drawn = needsYouFor(liveWith([], [701], [waiting(701, sentence)]), []);
    expect(drawn[0].productImpact).toBe(`Waiting on ${sentence}`);
  });

  it("with no live read the bare half is absent — nothing can vouch for it", () => {
    const off = { available: false, why: "x" } as unknown as Parameters<typeof needsYouFor>[0];
    expect(needsYouFor(off, [])).toEqual([]);
  });

  it("an eye item leaves when its card is closed, and stays while it is open", () => {
    const items = [
      { id: "sifr", issueNumber: 1207 },
      { id: "board", issueNumber: 1210 },
      { id: "loose", issueNumber: null },
    ] as unknown as Parameters<typeof eyeItemsFor>[1];
    expect(eyeItemsFor(liveWith([1207], []), items).map((i) => i.id)).toEqual(["board", "loose"]);
    const off = { available: false, why: "x" } as unknown as Parameters<typeof eyeItemsFor>[0];
    expect(eyeItemsFor(off, items).map((i) => i.id)).toEqual(["sifr", "board", "loose"]);
  });
});

describe("NEXT UP carries the build phrase the other lists carry (#1345)", () => {
  /**
   * Seen on his desk, 2026-09-26: row 7 read `#1307 Every concurrent PR
   * conflicts on the atlas fingerprint line…` with nothing beside it, while PR
   * #1336 sat in *In flight* as *Reviewed — merging* for that same card. #1094's
   * first piece put the phrase on Background Work and Not-on-any-road; NEXT UP —
   * the list he reads first — was not in its scope, so his page said two
   * different things about one card depending on which block he looked at.
   *
   * The phrases themselves are `shared/crewCardBuildState.ts`'s and are driven in
   * `server/crewCardBuildState.test.ts`. These arms are about the JOIN: the right
   * phrase on the right row, nothing on a row nobody is on, and an absent read
   * behaving exactly as no read did before this existed.
   */
  const NEXT_UP = {
    readAt: "2026-09-26T13:57:00Z",
    items: [
      { issueNumber: 1307, title: "every concurrent PR conflicts on the atlas line", urgent: false },
      { issueNumber: 1345, title: "the NEXT UP rows carry no build phrase", urgent: false },
    ],
  } as const;
  const rowsWith = (builds: unknown[]) => nextUpRows(NEXT_UP as never, [], builds as never);

  it("⚠ THE SPECIMEN — #1307's row now says its PR passed", () => {
    const rows = rowsWith([{ issueNumber: 1307, phrase: "passed and merging — PR #1336" }]);
    expect(rows.find((row) => row.issueNumber === 1307)!.build).toBe("passed and merging — PR #1336");
  });

  it("a row nobody is on carries nothing — the silence is what makes the phrase mean something", () => {
    const rows = rowsWith([{ issueNumber: 1307, phrase: "being built — PR #1336" }]);
    expect(rows.find((row) => row.issueNumber === 1345)!.build).toBeNull();
  });

  it("a phrase for a card that is not in this list reaches no row", () => {
    /* The join is by issue number, so a Background-Work card being built must
       not leak a phrase onto an ordered row that happens to sit beside it. */
    const rows = rowsWith([{ issueNumber: 999, phrase: "being built — PR #12" }]);
    expect(rows.every((row) => row.build === null)).toBe(true);
  });

  it("⚠ NO READ BEHAVES AS IT DID BEFORE THIS EXISTED — an absent list invents no builder", () => {
    /* GitHub not answering is the window every live list on this page falls back
       in. The wrong direction here would be a row inheriting a neighbour's
       phrase or the call failing; it reads as nobody's, which is honest, and the
       footer sentence is what says the read was thin. */
    expect(nextUpRows(NEXT_UP as never, []).every((row) => row.build === null)).toBe(true);
    expect(rowsWith([]).every((row) => row.build === null)).toBe(true);
  });

  it("the phrase rides BESIDE the hold, never instead of it — both facts survive", () => {
    /* A held card can also be under construction, and his page must not have to
       choose: the hold says why no shift took it, the phrase says who is on it. */
    /* `blocked` is one of the real hold states (`CrewHeldState` in
       `shared/crewNextUpHold.ts`), and the chip word is read back out of that
       module rather than typed here — an arm that invents a hold shape passes on
       a picture the product never draws. The first draft of this arm used
       `kind: "card"`, which is no state at all, and it went green. */
    const rows = nextUpRows(
      {
        readAt: "2026-09-26T13:57:00Z",
        items: [{
          issueNumber: 1307,
          title: "t",
          urgent: false,
          held: { state: "blocked", because: "rides #1234" },
        }],
      } as never,
      [] as never,
      [{ issueNumber: 1307, phrase: "being built — PR #1336" }] as never,
    );
    expect(rows[0]!.build).toBe("being built — PR #1336");
    expect(rows[0]!.hold?.word).toBe(CREW_HOLD_WORD.blocked);
    expect(rows[0]!.hold?.because).toBe("rides #1234");
  });
});

/**
 * ONE QUESTION, ONE CARD — `partitionEyeItems` (#1895).
 *
 * His word, 2026-10-07: *"i dont want double up of cards on my desk … its
 * making my desk look overcrowded"*, with two screenshots of #1837. **He
 * answered that one-word question twice, seventeen minutes apart** (replies
 * #260 on the eye item, #262 on the decision card, both *YES*) — the two
 * write-ups asked the same thing in different words, so from his side there was
 * nothing to say that answering one had settled the other.
 *
 * This is the pure half of the repair, and every arm below is a state the page
 * really reaches. Both sections read this ONE function, so the gallery cannot
 * draw an item a card is also drawing.
 */
describe("one question, one card — which eye items merge (#1895)", () => {
  const item = (id: string, cardId: string | null) =>
    ({ id, cardId, frames: [], state: "open" }) as unknown as Parameters<
      typeof partitionEyeItems
    >[0][number];
  const card = (id: string, state: string) =>
    ({ id, state }) as unknown as Parameters<typeof partitionEyeItems>[1][number];

  it("an item whose card is still on the desk merges into it, and leaves the gallery", () => {
    const { standalone, mergedInto } = partitionEyeItems(
      [item("frames-1837", "card-1837")],
      [card("card-1837", "open")],
      [card("card-1837", "open")],
    );
    expect(standalone, "the gallery would still draw it — two cards again").toEqual([]);
    expect(mergedInto.get("card-1837")?.map((i) => i.id)).toEqual(["frames-1837"]);
  });

  it("an item with NO card stands on its own, exactly as before", () => {
    const { standalone, mergedInto } = partitionEyeItems(
      [item("loose", null)],
      [card("card-1837", "open")],
      [card("card-1837", "open")],
    );
    expect(standalone.map((i) => i.id)).toEqual(["loose"]);
    expect(mergedInto.size).toBe(0);
  });

  /**
   * ⚠ **#1938 — THIS ARM IS THE REVERSE OF THE ONE IT REPLACES, AND THE REASON
   * IS THAT THE OLD ANSWER WAS THE DEFECT.**
   *
   * It read *"an item whose card is DONE stands on its own — a merge into a
   * card nobody draws is a vanishing"*, citing #354's *"the vanishing the
   * design forbids"*. That reasoning is still right about a card the page
   * cannot explain, and it is wrong about one he has ANSWERED: his answer is
   * what retired the question, so showing the frames again with their own reply
   * box asks it a second time. The briefing schema refuses an OPEN item on a
   * card that no longer needs him (#133), so an item reaching this branch is
   * one `CrewEyeGallery` would filter out anyway — the old arm was asserting a
   * place in a list nothing drew.
   */
  it("⚠ an item whose card he has ANSWERED is dropped, not stood on its own (#1938)", () => {
    for (const dead of ["done", "answered"]) {
      const { standalone, mergedInto, answered } = partitionEyeItems(
        [item("frames", "card")],
        [card("card", dead)],
        [card("card", dead)],
      );
      expect(standalone, `${dead}: the frames came back asking again`).toEqual([]);
      expect(answered.map((i) => i.id)).toEqual(["frames"]);
      expect(mergedInto.size).toBe(0);
    }
    /* And a `waiting` card IS still his, so its frames go with it (#354). */
    expect(
      partitionEyeItems(
        [item("frames", "card")],
        [card("card", "waiting")],
        [card("card", "waiting")],
      ).standalone,
    ).toEqual([]);
  });

  /**
   * ⚠ **THE ARM THIS CARD EXISTS FOR, AND IT FAILS AGAINST THE SHIPPED
   * READING.** The card is OPEN — its next slice is being built — and the relay
   * has lifted the hold because his answer is recorded, so `needsYouFor` takes
   * it off the live desk (#1193) while `eyeItemsFor` cannot see it: that reader
   * drops an item only when its issue is CLOSED. Handed one list, the host
   * failed the `drawn` test and the frames fell into the gallery with their own
   * reply box, from his answer until the next edition.
   */
  it("⚠ an item whose card the LIVE desk dropped because he answered it is dropped too (#1938)", () => {
    const { standalone, mergedInto, answered } = partitionEyeItems(
      [item("frames-1612", "law9-sign-card-1612")],
      /* What the page draws: `needsYouFor` subtracted the answered card. */
      [],
      /* What the edition wrote: the card, still `open`, with its frames. */
      [card("law9-sign-card-1612", "open")],
    );
    expect(standalone, "the pictures came back as their own question").toEqual([]);
    expect(answered.map((i) => i.id)).toEqual(["frames-1612"]);
    expect(mergedInto.size).toBe(0);
  });

  it("an item naming a card the EDITION never had stands on its own", () => {
    /* The one case the function cannot explain: the schema refuses an unpaired
       `cardId` (#133), so this is a malformed edition rather than a live
       narrowing — and frames cannot be re-created from a dropped item, so the
       direction it fails in is toward his eye (law 9). */
    const { standalone, answered } = partitionEyeItems([item("frames", "card-gone")], [], []);
    expect(standalone.map((i) => i.id)).toEqual(["frames"]);
    expect(answered).toEqual([]);
  });

  it("several items on one card all merge into it, in their own order", () => {
    /* Real shape: `sheet-shape-1278` carries three. */
    const { standalone, mergedInto } = partitionEyeItems(
      [item("a", "card"), item("loose", null), item("b", "card")],
      [card("card", "open")],
      [card("card", "open")],
    );
    expect(mergedInto.get("card")?.map((i) => i.id)).toEqual(["a", "b"]);
    expect(standalone.map((i) => i.id)).toEqual(["loose"]);
  });

  it("⚠ nothing is lost: every item is in exactly one of the three halves", () => {
    /* The property that matters more than any single case — the halves between
       them account for the whole list, and nothing appears twice. `answered` is
       returned rather than quietly discarded precisely so this stays provable
       after #1938 gave the function something to drop. */
    const items = [
      item("a", "card"),
      item("b", null),
      item("c", "card-done"),
      item("d", "card"),
      item("e", "card-missing"),
    ];
    const edition = [card("card", "open"), card("card-done", "done")];
    const { standalone, mergedInto, answered } = partitionEyeItems(items, edition, edition);
    const seen = [
      ...standalone.map((i) => i.id),
      ...[...mergedInto.values()].flat().map((i) => i.id),
      ...answered.map((i) => i.id),
    ];
    expect(seen.sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(new Set(seen).size, "an item is accounted for twice").toBe(items.length);
    /* And the three halves are the ones this card settled. */
    expect(standalone.map((i) => i.id)).toEqual(["b", "e"]);
    expect(answered.map((i) => i.id)).toEqual(["c"]);
    expect(mergedInto.get("card")?.map((i) => i.id)).toEqual(["a", "d"]);
  });

  /**
   * ⚠ **THE SAME QUESTION ASKED OF THE DEPLOYED EDITION, not of a fixture
   * (#1938, working law 1).** Every arm above builds its own two-item world,
   * and a partition rule can be right about those and wrong about the shapes a
   * real file carries — paired items whose own `issueNumber` differs from their
   * host's (`retry-outfit-1474` hosts on `sheet-shape-1278`), several items per
   * host, and hosts in four different states.
   *
   * It simulates the ONE thing the live desk does that an edition cannot
   * record: his answer arriving, which takes a host off `needsYou` while the
   * card stays open. Every paired item in the file must then be accounted for
   * as answered rather than reappearing in the gallery.
   */
  it("the deployed briefing's paired frames never reappear when their host is answered", () => {
    const briefing = JSON.parse(
      readFileSync(
        path.resolve(__dirname, "../../../../../../server/crew/crew-briefing.json"),
        "utf8",
      ),
    ) as {
      needsYou: { id: string; state: string }[];
      eyeItems: { id: string; cardId?: string | null; state: string }[];
    };
    const items = briefing.eyeItems as unknown as Parameters<typeof partitionEyeItems>[0];
    const edition = briefing.needsYou as unknown as Parameters<typeof partitionEyeItems>[1];
    const paired = briefing.eyeItems.filter((item) =>
      item.cardId != null && briefing.needsYou.some((card) => card.id === item.cardId));
    /* The floor: a file with no paired item would pass this arm by holding
       nothing, which is the shape a population control exists to refuse. */
    expect(paired.length, "the real edition carries no paired eye item to judge")
      .toBeGreaterThan(5);

    /* HE ANSWERS EVERYTHING: the live desk hands the page an empty needs-you
       list while the edition still carries every card and every pairing. */
    const afterHisAnswers = partitionEyeItems(items, [], edition);
    expect(afterHisAnswers.mergedInto.size, "nothing can merge into a card nobody draws").toBe(0);
    const pairedIds = new Set(paired.map((item) => item.id));
    expect(
      afterHisAnswers.standalone.filter((item) => pairedIds.has(item.id)).map((item) => item.id),
      "these frames came back as their own question",
    ).toEqual([]);
    /*
      ⚠ **THIS WAS AN EQUALITY AND IS NOW A CONTAINMENT, BECAUSE #1950 WIDENED
      WHAT `answered` MEANS — and the arm failing was the measurement.**

      It read `expect(answered.map(id).sort()).toEqual([...pairedIds].sort())`
      and `expect(standalone.length).toBe(eyeItems.length - paired.length)`,
      both true when `answered` meant only *paired, but its host is not drawn*.
      It now also holds an item whose OWN state no longer needs him, which is
      what stopped the section menu counting things the gallery drops.

      Run against this very file the day it changed: of **127** eye items,
      **87** were standalone under the old rule and **0** of those were ones
      the gallery would draw. The equality is therefore the wrong shape — it
      would pin a number about the current edition's contents — and the
      property that actually matters is the two below.
    */
    for (const id of pairedIds) {
      expect(
        afterHisAnswers.answered.some((item) => item.id === id),
        `${id} is paired with a card he answered and is not accounted for as answered`,
      ).toBe(true);
    }
    /* And every item left standing alone is one the gallery will actually
       draw — the whole of #1950, asked of the real file. */
    expect(
      afterHisAnswers.standalone.filter((item) => !crewCardNeedsHim(item.state)).map((i) => i.id),
      "an item the gallery filters out is still in `standalone`, so the section menu"
        + " would count a picture nobody is shown",
    ).toEqual([]);
    /* Nothing is lost, still, over the real file. */
    expect(
      afterHisAnswers.standalone.length
      + afterHisAnswers.answered.length
      + [...afterHisAnswers.mergedInto.values()].flat().length,
    ).toBe(briefing.eyeItems.length);
  });
});

/**
 * THE SECTION MENU'S COUNT IS WHAT THE SECTIONS DRAW — #1950.
 *
 * The menu put `needsYou.length + standaloneEyeItems.length` beside **Needs
 * you**, and neither list was filtered by state — while `CrewNeedsYou` draws
 * `cards.filter(crewCardNeedsHim)` and `CrewEyeGallery` draws
 * `items.filter(crewCardNeedsHim)` and returns `null` outright when that
 * leaves nothing. **Both halves were wrong in the same direction**: the menu
 * told him things were waiting over a section that was shorter, or empty.
 *
 * ⚠ **AND THE COMMENT DIRECTLY ABOVE THE COUNT SAID THE OPPOSITE** —
 * *"THE SECTION MENU'S COUNT IS WHAT THE SECTION DRAWS"* — which is the part
 * worth keeping in mind, because a confident sentence is what stops anybody
 * looking. It was a claim, not a fact (working law 1).
 *
 * ⚠ **THESE ARMS ASSERT THE EQUALITY, NOT THE IMPLEMENTATION.** Pinning
 * `drawnCardCount` to a number would pass the day somebody counts the wrong
 * list again with the same arithmetic. What is asserted is that the figure the
 * menu renders equals the figure the two sections render, computed the way the
 * sections compute it — so the two can never disagree without this going red.
 */
describe("the Needs-you count equals what the two sections draw (#1950)", () => {
  const item = (id: string, cardId: string | null, state: string) =>
    ({ id, cardId, frames: [], state }) as unknown as Parameters<
      typeof partitionEyeItems
    >[0][number];
  const card = (id: string, state: string) =>
    ({ id, state }) as unknown as Parameters<typeof partitionEyeItems>[1][number];

  /** What the menu renders, read exactly as `AdminCrew.tsx` reads it. */
  function menuCount(
    cards: Parameters<typeof partitionEyeItems>[1],
    items: Parameters<typeof partitionEyeItems>[0],
    edition: Parameters<typeof partitionEyeItems>[2],
  ): number {
    const { standalone, drawnCardCount } = partitionEyeItems(items, cards, edition);
    return drawnCardCount + standalone.length;
  }

  /** What the two sections render, read exactly as each component reads it. */
  function sectionsDraw(
    cards: Parameters<typeof partitionEyeItems>[1],
    items: Parameters<typeof partitionEyeItems>[0],
    edition: Parameters<typeof partitionEyeItems>[2],
  ): number {
    const { standalone } = partitionEyeItems(items, cards, edition);
    const drawnCards = cards.filter((entry) => crewCardNeedsHim(entry.state));
    const drawnEyes = standalone.filter((entry) => crewCardNeedsHim(entry.state));
    return drawnCards.length + drawnEyes.length;
  }

  it("⚠ answered and done rows in BOTH lists are counted by neither", () => {
    /*
      The fixture the card asks for. Two cards and two loose eye items still
      need him; two of each do not. Before this card the menu said SIX.
    */
    const cards = [
      card("open-card", "open"),
      card("waiting-card", "waiting"),
      card("answered-card", "answered"),
      card("done-card", "done"),
    ];
    const items = [
      item("loose-open", null, "open"),
      item("loose-waiting", null, "waiting"),
      item("loose-answered", null, "answered"),
      item("loose-done", null, "done"),
    ];

    expect(sectionsDraw(cards, items, cards), "the fixture's own arithmetic").toBe(4);
    expect(
      menuCount(cards, items, cards),
      "the menu counts a card or a picture the sections do not draw",
    ).toBe(4);
  });

  it("the two agree when everything is open, so the arm is not passing by refusing", () => {
    const cards = [card("a", "open"), card("b", "waiting")];
    const items = [item("x", null, "open"), item("y", null, "open")];
    expect(menuCount(cards, items, cards)).toBe(4);
    expect(sectionsDraw(cards, items, cards)).toBe(4);
  });

  it("the two agree when everything is answered — the section is empty and says zero", () => {
    const cards = [card("a", "answered"), card("b", "done")];
    const items = [item("x", null, "answered"), item("y", null, "done")];
    /* The gallery returns null outright at zero, so the menu must too. */
    expect(menuCount(cards, items, cards)).toBe(0);
    expect(sectionsDraw(cards, items, cards)).toBe(0);
  });

  it("a merged item is counted ONCE, on its card, and never again in the gallery", () => {
    /*
      The property #1895 shipped, now also held of the number: frames drawn
      inside a card must not add to the count, or the menu sends him looking
      for a section that holds them already.
    */
    const cards = [card("host", "open")];
    const items = [item("frames", "host", "open")];
    expect(menuCount(cards, items, cards), "the merged frames were counted twice").toBe(1);
    expect(sectionsDraw(cards, items, cards)).toBe(1);
  });

  it("⚠ the real deployed edition: the menu and the sections agree", () => {
    /*
      Working law 1 — the fixtures above are a claim about the rule, and this
      is the artifact. The fallback path is the one driven here: when GitHub
      has not answered, the page draws the edition's own lists, and that is a
      state the page really reaches.
    */
    const briefing = JSON.parse(
      readFileSync(
        path.resolve(__dirname, "../../../../../../server/crew/crew-briefing.json"),
        "utf8",
      ),
    ) as {
      needsYou: Parameters<typeof partitionEyeItems>[1];
      eyeItems: Parameters<typeof partitionEyeItems>[0];
    };
    const cards = briefing.needsYou;
    const items = briefing.eyeItems;
    expect(cards.length, "the edition carries no needs-you rows to judge").toBeGreaterThan(5);
    expect(items.length, "the edition carries no eye items to judge").toBeGreaterThan(5);
    expect(
      menuCount(cards, items, cards),
      "on the real edition the menu still disagrees with its own sections",
    ).toBe(sectionsDraw(cards, items, cards));
  });
});
