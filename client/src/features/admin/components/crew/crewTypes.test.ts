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

import {
  GENERAL_FOLD_VISIBLE,
  foldTimeline,
  milestoneCountLine,
  milestoneProgress,
  heldCount,
  nextUpRows,
  pipelineNotDone,
  replyFallsToGeneral,
} from "./crewTypes";

const CARDS = [
  { id: "open-card", state: "open" },
  { id: "answered-card", state: "answered" },
  { id: "done-card", state: "done" },
] as const;

describe("where a reply renders", () => {
  it("a cardless reply is a general note", () => {
    expect(replyFallsToGeneral(null, CARDS)).toBe(true);
  });

  it("a reply on an OPEN card stays with its card's thread", () => {
    expect(replyFallsToGeneral("open-card", CARDS)).toBe(false);
  });

  it("⚠ a reply on an ANSWERED or DONE card falls to the General box — the card is listed but renders no thread", () => {
    expect(replyFallsToGeneral("answered-card", CARDS)).toBe(true);
    expect(replyFallsToGeneral("done-card", CARDS)).toBe(true);
  });

  it("a reply whose card left the briefing entirely falls to the General box", () => {
    expect(replyFallsToGeneral("a-card-no-briefing-holds", CARDS)).toBe(true);
  });

  it("exhaustive: every card state routes every reply somewhere", () => {
    /* The invariant itself: for ANY cardId, the reply renders in the General box
       OR under an open card's thread — never neither. */
    const everyCardId = [null, ...CARDS.map((card) => card.id), "gone-card"];
    for (const cardId of everyCardId) {
      const inGeneral = replyFallsToGeneral(cardId, CARDS);
      const inOpenThread =
        cardId !== null && CARDS.some((card) => card.id === cardId && card.state === "open");
      expect(inGeneral || inOpenThread, `a reply on ${String(cardId)} renders nowhere`).toBe(true);
      expect(inGeneral && inOpenThread, `a reply on ${String(cardId)} renders twice`).toBe(false);
    }
  });
});

/* ─── #74's derivations. Each is the Desk's information design READ off data
   the briefing already carries — these arms are what stops the bar, the split
   and the fold from quietly becoming second copies of state. ─── */

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

describe("the General box fold (#74 — his standing Desk rule)", () => {
  it(`shows ${GENERAL_FOLD_VISIBLE} and folds the rest, order preserved`, () => {
    const items = Array.from({ length: 11 }, (_, index) => index);
    const { recent, older } = foldTimeline(items);
    expect(recent).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(older).toEqual([8, 9, 10]);
  });

  it("a short list folds nothing — no empty disclosure button", () => {
    const { recent, older } = foldTimeline([0, 1, 2]);
    expect(recent).toEqual([0, 1, 2]);
    expect(older).toEqual([]);
  });

  it("the boundary itself: exactly the visible count folds nothing", () => {
    const items = Array.from({ length: GENERAL_FOLD_VISIBLE }, (_, index) => index);
    expect(foldTimeline(items).older).toEqual([]);
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
