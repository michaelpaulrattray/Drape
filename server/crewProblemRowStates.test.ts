/**
 * THE DESK SWEEP'S PROBLEMS PASS, DRIVEN (issue #2247).
 *
 * His Problems section is the one he complained about by name — *"problems
 * never seems to update and it doesnt feel useful either"* (2026-09-25). The
 * sweep repairs a stale needs-you row and reports four kinds of stale pipeline
 * row, and until this card it had **no reader at all for `problems`**: the
 * `state` was written by hand once and nothing ever asked it again.
 *
 * Three halves, and the second is the one no fixture can reach:
 *
 *  1. `planProblemRows` over fixtures, with the controls both ways the card
 *     insisted on — a stale row is named, a genuinely live one is NOT, and a
 *     card nobody could judge lands in neither list.
 *  2. The pass held at the BYTES of `crew-desk-sweep.mts`. Every arm above
 *     passes against a planner nothing calls, which is invariant 7 — *a control
 *     that is not invoked does not exist* — and this file's own siblings have
 *     paid for exactly that twice (#1099, #1101).
 *  3. The real briefing in the tree, re-driving the card's own measurement:
 *     the three rows that were `open` at edition 674 all name a card that has
 *     closed. A fixture cannot say that, because the point was never the rule —
 *     it was that nothing had ever applied the rule to his page.
 *
 * ⚠ **AND THE REAL-BRIEFING ARM NEEDS ITS POPULATION FORCED, WHICH IS SAID OUT
 * LOUD RATHER THAN LEFT TO BE NOTICED.** Edition 675 resolved all three rows by
 * hand (#2247's own *"not part of this card"*), so the live population is ZERO
 * and an arm over the briefing as it stands would pass against a reader that
 * answers nothing. It reads the rows out of the committed file and sets
 * `state: "open"` on the three the card measured, so the assertion is about the
 * REAL words on his page and still cannot pass by emptiness.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { cardsNamedInText } from "../shared/crewBriefingCardToken.js";
import { planProblemRows } from "../shared/crewProblemState.js";

const SWEEP = resolve("scripts/crew-desk-sweep.mts");
const BRIEFING = resolve("server/crew/crew-briefing.json");
const PAGE = resolve("client/src/features/admin/components/crew/crewTypes.ts");

/** Where the problems pass begins and ends in the sweep, for the slice arms. */
const PASS_OPENS = "const problemRows: CrewProblemRowPlan<PlannableProblemRow>";
const PASS_ENDS = "/* ─── 3. a finished card is done";

type Row = {
  id: string;
  title: string;
  detail: string;
  severity: string;
  state: string;
};

const row = (over: Partial<Row>): Row => ({
  id: "r",
  title: "A fault",
  detail: "",
  severity: "warning",
  state: "open",
  ...over,
});

/**
 * The three-state openness reader, as a table. Anything in `open` is open,
 * anything in `unknown` cannot be judged, everything else is closed — the same
 * shape `crew-desk-sweep.mts` builds from its one `gh issue list`.
 */
const openness = (open: number[], unknown: number[] = []) =>
  (card: number): boolean | null => {
    if (unknown.indexOf(card) !== -1) return null;
    return open.indexOf(card) !== -1;
  };

describe("planProblemRows — a problem row asserting a fault that is fixed (#2247)", () => {
  it("⚠ names a row whose card has CLOSED, and carries the card it judged it on", () => {
    const plan = planProblemRows(
      [row({
        id: "data-export-breaks-for-big-accounts-1989",
        title: "Asking for a copy of your own data fails (#1989)",
      })],
      cardsNamedInText,
      openness([]),
    );

    expect(plan.stale.map((one) => one.row.id)).toEqual(["data-export-breaks-for-big-accounts-1989"]);
    /* The cards travel with the finding so the report names what it judged the
       row against, rather than asserting "closed" with nothing behind it. */
    expect(plan.stale[0]!.closed).toEqual([1989]);
    expect(plan.noCard).toEqual([]);
    expect(plan.unjudged).toEqual([]);
  });

  it("⚠ CONTROL — a row whose card is OPEN is not a finding", () => {
    /* Without this the reader could answer for every open row and the arm above
       would still pass, which is an enumeration guard enumerating everything. */
    const plan = planProblemRows(
      [row({ id: "live", title: "Something real (#1989)" })],
      cardsNamedInText,
      openness([1989]),
    );

    expect(plan.stale).toEqual([]);
    expect(plan.noCard).toEqual([]);
    expect(plan.unjudged).toEqual([]);
  });

  it("ANY closed card, not every — because that is what his page already does", () => {
    /*
      `problemsFor` retires on `.some(closed)`, so a row naming one closed card
      is ALREADY invisible to him however many live cards sit beside it. A
      reader demanding all of them would stay silent about a row his page hides
      — and would therefore say nothing on the night GitHub goes quiet and the
      page draws every one of them.

      ⚠ This is the OPPOSITE of `planPipelineRowsWithoutPullRequests`, which
      demands every card closed. That reader has no live filter above it, so it
      must judge its row alone; this one must agree with a filter that already
      ran.
    */
    const plan = planProblemRows(
      [row({ id: "two-cards", title: "A fault (#1989)", detail: "and its follow-up (#2000)" })],
      cardsNamedInText,
      openness([2000]),
    );

    expect(plan.stale.map((one) => one.row.id)).toEqual(["two-cards"]);
    expect(plan.stale[0]!.cards).toEqual([1989, 2000]);
    expect(plan.stale[0]!.closed, "only the closed one is named as the evidence").toEqual([1989]);
  });

  it("⚠ a card it CANNOT TELL about is in neither list — the cap guard", () => {
    /*
      The sweep answers `null` when the open queue failed or came back AT
      `OPEN_QUEUE_LIMIT`, because a card missing from a capped list is either
      closed or past the cap and those are opposite answers. Reporting a live
      card as closed is the finding-shaped lie the whole sweep exists to
      prevent — and reporting it as CLEAN is the silent direction, which is
      worse, so it has a list of its own.
    */
    const plan = planProblemRows(
      [row({ id: "unknowable", title: "A fault (#1989)" })],
      cardsNamedInText,
      openness([], [1989]),
    );

    expect(plan.stale).toEqual([]);
    expect(plan.noCard).toEqual([]);
    expect(plan.unjudged.map((one) => one.row.id)).toEqual(["unknowable"]);
  });

  it("a closed card settles it even when another card beside it is unreadable", () => {
    /* His page retires the row on the closed one without waiting, so a reader
       that deferred the whole row to `unjudged` would disagree with the screen. */
    const plan = planProblemRows(
      [row({ id: "mixed", title: "A fault (#1989) and (#2000)" })],
      cardsNamedInText,
      openness([], [2000]),
    );

    expect(plan.stale.map((one) => one.row.id)).toEqual(["mixed"]);
    expect(plan.unjudged).toEqual([]);
  });

  it("⚠ a row whose words name NO card is reported — nothing can ever retire it", () => {
    /*
      The `#2165` shape one section over: `problemsFor` reads the title and the
      detail, so a card number living only in the row's `id` slug is read by
      nothing and the row outlives its fault for ever.
    */
    const plan = planProblemRows(
      [row({ id: "gh-graphql-burst-1399", title: "This page can silently keep yesterday's lists" })],
      cardsNamedInText,
      openness([]),
    );

    expect(plan.noCard.map((one) => one.row.id)).toEqual(["gh-graphql-burst-1399"]);
    expect(plan.noCard[0]!.cards, "there was nothing to judge it against").toEqual([]);
    expect(plan.stale, "a row with no card is never called stale").toEqual([]);
  });

  it("⚠ the id's own trailing number is NOT read as a card", () => {
    /* It is a slug. Reading it would turn `face-scan-cap-counts-requests-2170`
       into evidence about #2170 that the row never actually offered, which is
       `planPipelineRowsWithoutPullRequests`' own stated refusal. */
    const plan = planProblemRows(
      [row({ id: "something-1989", title: "No card named here", detail: "nor here" })],
      cardsNamedInText,
      openness([]),
    );

    expect(plan.noCard).toHaveLength(1);
    expect(plan.stale).toEqual([]);
  });

  it("a RESOLVED row is outside every list — the server does not even send it", () => {
    const plan = planProblemRows(
      [row({ id: "done", title: "Fixed (#1989)", state: "resolved" })],
      cardsNamedInText,
      openness([]),
    );

    expect(plan).toEqual({ stale: [], noCard: [], unjudged: [] });
  });

  it("an `info` row is judged like any other — the page's drawing rule is not this reader's", () => {
    /*
      #1201 stopped his page DRAWING an info row; it did not make a stale info
      row a correct record. A reader that skipped them would go quiet the day
      the page draws them again, and the caller prints `[info …]` on the line
      instead so nobody mistakes it for something on his screen today.
    */
    const plan = planProblemRows(
      [row({ id: "note", title: "A note (#1989)", severity: "info" })],
      cardsNamedInText,
      openness([]),
    );

    expect(plan.stale.map((one) => one.row.id)).toEqual(["note"]);
  });
});

describe("the sweep actually RUNS the pass — invariant 7 at the bytes", () => {
  /**
   * ⚠ **THE SUBJECT IS SLICED OUT BEFORE IT IS SEARCHED.** A whole-file
   * `toContain` is satisfied by an identical line in a neighbouring block —
   * that script has four passes printing nearly the same sentences — so each
   * arm reads the problems pass alone, and the slice's own anchors are asserted
   * unique first (memory: *guard arm satisfied by a sibling*).
   */
  const source = () => readFileSync(SWEEP, "utf8");

  const passOnly = (text: string): string => {
    expect(text.split(PASS_OPENS), "the pass's opening anchor must appear exactly once").toHaveLength(2);
    expect(text.split(PASS_ENDS), "the pass's closing anchor must appear exactly once").toHaveLength(2);
    const start = text.indexOf(PASS_OPENS);
    const end = text.indexOf(PASS_ENDS);
    expect(end, "the two anchors must be in this order").toBeGreaterThan(start);
    return text.slice(start, end);
  };

  it("calls the shared planner over the briefing's own rows", () => {
    const pass = passOnly(source());
    expect(pass).toContain("planProblemRows(");
    expect(pass).toContain("briefing.problems");
  });

  it("⚠ hands it HIS PAGE'S OWN `#N` reader, not the card-body one", () => {
    /*
      `cardNumbersIn` (`shared/crewQueuePossiblyDone.ts`) answers a different
      question and drops a `reply #168` or a `run #26` as another numbering
      space. Pass that here and a problem row mentioning one would silently stop
      being judged by the card it actually names, while `problemsFor` carried on
      retiring it — the sweep going quiet about a row his page hides.
    */
    const pass = passOnly(source());
    expect(pass).toContain("cardsNamedInText");
    expect(pass).not.toContain("cardNumbersIn");
  });

  it("⚠ shares the pipeline pass's three-state openness reader", () => {
    /* Two copies of the cap rule is two readers of one question, and the day
       one of them learned about the cap and the other did not, only the capped
       one would stop calling live cards closed. */
    const text = source();
    expect(text.split("const isCardOpen = (card: number): boolean | null =>")).toHaveLength(2);
    expect(passOnly(text)).toContain("isCardOpen");
  });

  it("⚠ says the queue was UNREAD rather than reporting a clean population", () => {
    const pass = passOnly(source());
    expect(pass).toContain("allOpen === null");
    expect(pass).toContain("That is unread, NOT clean.");
  });

  it("prints all three lists, so a finding cannot be computed and then dropped", () => {
    const text = source();
    for (const list of ["problemRows.stale", "problemRows.noCard", "problemRows.unjudged"]) {
      expect(text, `${list} must reach the report`).toContain(`${list}.length > 0`);
    }
  });
});

describe("the real briefing — #2247's own measurement, re-driven", () => {
  /** Every problem row in the committed edition. */
  const rows = (): Row[] =>
    (JSON.parse(readFileSync(BRIEFING, "utf8")) as { problems: Row[] }).problems;

  it("⚠ the three rows that were `open` at edition 674 all name a card that has CLOSED", () => {
    /*
      #1989 closed 2026-10-08, #1990 the same day, #2170 on 2026-10-10 — read at
      `gh issue view` while this was written. Edition 675 resolved all three by
      hand, so the population is forced back open here: the words are the real
      ones on his page, and the arm cannot pass by emptiness.
    */
    const measured = [
      "data-export-breaks-for-big-accounts-1989",
      "db-hiccup-signs-you-out-1990",
      "face-scan-cap-counts-requests-2170",
    ];
    const live = rows().filter((one) => measured.indexOf(one.id) !== -1);
    expect(live, "the three rows the card measured are still in the edition").toHaveLength(3);

    const plan = planProblemRows(
      live.map((one) => ({ ...one, state: "open" })),
      cardsNamedInText,
      /* The record as it actually stands, read at `gh issue view` while this was
         written: of the five other cards those three rows mention, only #2191
         is open (#2000 and #1997 closed, and #2178 is a PULL REQUEST number, so
         no issue list will ever carry it). */
      openness([2191]),
    );

    expect(plan.stale.map((one) => one.row.id).sort()).toEqual([...measured].sort());
    expect(plan.noCard, "each of the three names its card in its own words").toEqual([]);
    expect(plan.unjudged).toEqual([]);
    /* ⚠ And the evidence is DEDUPED — every one of the three names its own card
       TWICE, so without it the report would read `#1989, #1989, #2000` at him.
       Two closed cards each: its own, plus #2000 / #1997 / #2178 (and #2191,
       which is open, is correctly not evidence). */
    expect(plan.stale.map((one) => one.closed.length)).toEqual([2, 2, 2]);
    for (const finding of plan.stale) {
      expect(new Set(finding.cards).size, "no card is named twice in a finding").toBe(finding.cards.length);
    }
  });

  it("⚠ the two rows #2247 called unretirable DO name their card — in the detail", () => {
    /*
      The card's body says `gh-graphql-burst-1399` and `scripts-typecheck-red-1231`
      *"carry no `#N` in their title, so they could never retire by any road"*.
      Read at `crewTypes.ts`'s filter instead: it reads
      `${problem.title} ${problem.detail}`, and both rows name their own card in
      the detail. The REQUIREMENT the card drew from them is real and is driven
      above with a fixture; the two examples were not, and this arm is why the
      planner's docblock says so rather than repeating them.
    */
    for (const id of ["gh-graphql-burst-1399", "scripts-typecheck-red-1231"]) {
      const found = rows().find((one) => one.id === id);
      expect(found, `${id} is still in the edition`).toBeDefined();
      expect(cardsNamedInText(found!.title), `${id}'s title names no card`).toEqual([]);
      expect(
        cardsNamedInText(`${found!.title} ${found!.detail}`),
        `${id} names its card in the detail, which the page reads too`,
      ).toContain(Number(id.slice(id.lastIndexOf("-") + 1)));
    }
  });

  it("the page's filter reads the DETAIL as well as the title — the premise above, at its bytes", () => {
    /* The one line the correction rests on. A change here narrowing the filter
       to the title would make the card's claim true again and this suite's
       reasoning wrong, so it is pinned rather than quoted. */
    expect(readFileSync(PAGE, "utf8")).toContain("cardsNamedInText(`${problem.title} ${problem.detail}`)");
  });
});
