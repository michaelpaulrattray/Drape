/**
 * THE TWO STATES A PROBLEM ROW CAN BE IN, AND THE ONE QUESTION THE PAGE ASKS
 * OF THEM (#1138 — the `crewPipelineStatus` precedent one file over).
 *
 * `CrewProblems` draws `state === "open"` and nothing else: a resolved row has
 * no surface anywhere on the page, exactly as a `merged` pipeline row has
 * none. At edition 493 that was **95 of 97 problems, 87 KB**, sent on every
 * poll of `crew.getState` to be dropped by a `.filter()` in the browser.
 *
 * ⚠ **WHY A MODULE FOR A TWO-VALUE ENUM.** Because the question is asked in
 * TWO places once the wire projection exists — the page's filter and the
 * server's projection — and working law 4 is about exactly that: a row this
 * product stops SENDING and a row the page declines to DRAW must be one
 * question, or the day they disagree the section silently shows nothing and no
 * test can say why. The zod enum is derived from the list below for the same
 * reason `CREW_CARD_STATES` is.
 */

/** Every state a problem row may hold. The briefing's zod enum is derived from it. */
export const CREW_PROBLEM_STATES = ["open", "resolved"] as const;

/**
 * Is this problem still live — something he can act on rather than a record?
 *
 * The one definition, asked by the page's filter and by the wire projection
 * that keeps the resolved rows off his browser in the first place.
 */
export function crewProblemIsOpen(state: string): boolean {
  return state === "open";
}

/**
 * ⚠ **A PROBLEM ROW ASSERTING A FAULT THAT IS FIXED — NOTHING HAS EVER RE-READ
 * ONE (#2247).**
 *
 * The desk sweep repairs a stale `needs-you` row and reports four kinds of
 * stale `pipeline` row. It has **no reader at all for `problems`**, so a row's
 * `state` is written by hand once and nothing ever asks it again — which is the
 * exact disease that script's own header says it exists to kill: *"a state
 * written once, at the moment it became true, and never re-read."*
 *
 * **Measured at edition 674: three of twenty-one rows asserted a live fault
 * that was fixed** — `data-export-breaks-for-big-accounts-1989` and
 * `db-hiccup-signs-you-out-1990` (both cards closed 2026-10-08) and
 * `face-scan-cap-counts-requests-2170`, whose own prose explained *"why this
 * row is still here"* about two remainders that had shipped before its card
 * closed.
 *
 * ⚠ **AND THE REASON NOBODY SAW IT IS WHY IT IS WORTH A READER.** `problemsFor`
 * retires a row live when a card it names has closed, so on a good night his
 * page draws none of these and the staleness is invisible. That reader needs
 * GitHub to have answered: with an empty reading nothing is known to be closed
 * and **all three stale rows are drawn**. GitHub silently refusing the crew's
 * reads is not hypothetical — it is #1399, four nights running. So the night
 * his page cannot reach GitHub is the night it shows him fixed faults as live,
 * which is precisely what he complained about by name.
 *
 * ⚠ **IT REPORTS AND NEVER REWRITES**, which is the sweep's standing posture
 * for a judgement (#1439, #2165): *resolved* and *still half-true* are
 * different answers, a row may name one card of several it depends on, and a
 * state nobody meant is worse than a stale one because the next reader believes
 * it. The repair is an edit to an edition a shift is writing anyway.
 */
export type CrewProblemRowFinding<T> = {
  readonly row: T;
  /** Every card its title and detail name, in the order they name them. */
  readonly cards: readonly number[];
  /** The ones judged CLOSED — empty on a row that names no card. */
  readonly closed: readonly number[];
};

export type CrewProblemRowPlan<T> = {
  /**
   * Open rows a card they name has CLOSED. His page already hides these when
   * GitHub answers; it draws every one of them when it cannot.
   */
  readonly stale: ReadonlyArray<CrewProblemRowFinding<T>>;
  /**
   * Open rows that name NO card — so no reader anywhere can retire them, ever.
   *
   * ⚠ **MEASURED AT ZERO, AND #2247's OWN TWO EXAMPLES ARE NOT IN IT.** That
   * card named `gh-graphql-burst-1399` and `scripts-typecheck-red-1231` as rows
   * that *"carry no `#N` in their title, so they could never retire by any
   * road"*. Read at `crewTypes.ts`'s filter instead: it reads
   * `${problem.title} ${problem.detail}` — the DETAIL too — and both rows name
   * their own card there (*"RESOLVED — card #1399 closed 2026-09-26"*). Both
   * were also already `resolved` at edition 674, so neither was ever in a live
   * population. **The requirement is still real and the examples were not**: a
   * row whose words name no card is retired by nothing, it is the `#2165` shape
   * one section over, and the only reason it has never bitten is that every row
   * so far happens to name its card in prose. This limb is what notices the
   * first one that does not.
   */
  readonly noCard: ReadonlyArray<CrewProblemRowFinding<T>>;
  /**
   * Open rows holding a card the caller could not judge. Never folded into
   * either list above: unread is not clean, and it is not stale either.
   */
  readonly unjudged: ReadonlyArray<CrewProblemRowFinding<T>>;
};

/**
 * Sort every live problem row by what the record says about the cards it names.
 *
 * ⚠ **`cardsIn` IS INJECTED AND THE CALLER PASSES HIS PAGE'S OWN READER**
 * (`cardsNamedInText`, `shared/crewBriefingCardToken.ts`) — the same style as
 * `planPipelineRowsWithoutPullRequests`, and here it is load-bearing rather
 * than tidy: this reader and `problemsFor` answer the identical question from
 * the two ends, so a second spelling would name rows his page hides.
 *
 * ⚠ **`isOpen` ANSWERS THREE STATES AND THE THIRD IS THE GUARD.** The caller
 * knows which cards are open from a `gh issue list` it has already made, and
 * that list is CAPPED — so a card missing from it is *either* closed *or* past
 * the cap, and those are opposite answers. `null` means "cannot tell", and a
 * row holding one lands in `unjudged` rather than being reported as fixed.
 *
 * ⚠ **ANY closed card, not every — because that is what his page does.**
 * `problemsFor` retires on `.some(closed)`, so a row naming a closed card is
 * already invisible to him however many live cards sit beside it; a reader
 * demanding all of them would stay silent about a row he cannot see.
 * ⚠ This is the OPPOSITE of `planPipelineRowsWithoutPullRequests`, which
 * demands every card closed — and the difference is not an inconsistency: that
 * reader has no live filter above it, so it must judge the row on its own.
 *
 * # ⚠ TWO THINGS IT DELIBERATELY DOES NOT JUDGE, STATED RATHER THAN SILENT
 *
 *   - **A `resolved` row whose card is still OPEN** — the other direction. It
 *     could be a fault he still has with its row switched off too early, or a
 *     card kept open for a remainder that is nothing to do with the row. The
 *     population is every resolved row ever written (20 of 21 at edition 675),
 *     so the honest version needs a rule for which card a row *depends* on, and
 *     inventing one is not a mechanical act. Not built, named here.
 *   - **`severity: "info"`** is judged like any other, and the caller says so in
 *     the line it prints. His page stopped DRAWING info rows (#1201), so a
 *     stale one costs him nothing today — but the row is still a wrong record,
 *     and a reader that skipped it would go quiet the day the page draws them
 *     again.
 */
export function planProblemRows<T extends { readonly title: string; readonly detail: string; readonly state: string }>(
  rows: readonly T[],
  cardsIn: (text: string) => number[],
  isOpen: (card: number) => boolean | null,
): CrewProblemRowPlan<T> {
  const stale: Array<CrewProblemRowFinding<T>> = [];
  const noCard: Array<CrewProblemRowFinding<T>> = [];
  const unjudged: Array<CrewProblemRowFinding<T>> = [];
  for (const row of rows) {
    /* The one declaration of *live* (law 4) — a resolved row has no surface on
       his page and the server does not even send it. */
    if (!crewProblemIsOpen(row.state)) continue;
    /* The same text `problemsFor` reads, in the same order, so the two cannot
       disagree about which cards a row names. */
    /* ⚠ **DEDUPED HERE AND NOT IN THE READER.** `cardsNamedInText`'s contract is
       *in the order it names them*, duplicates included, because its other
       caller only ever `.some()`s the answer and a row that mentions its card
       three times is perfectly normal prose. A FINDING carrying `#1989, #1989,
       #2000` is a report nobody wants — measured on the real briefing's three
       specimens, all of which name their card twice. Order is kept. */
    const named = cardsIn(`${row.title} ${row.detail}`);
    const cards = named.filter((card, at) => named.indexOf(card) === at);
    if (cards.length === 0) {
      noCard.push({ row, cards: [], closed: [] });
      continue;
    }
    const closed = cards.filter((card) => isOpen(card) === false);
    if (closed.length > 0) {
      stale.push({ row, cards, closed });
      continue;
    }
    if (cards.some((card) => isOpen(card) === null)) {
      unjudged.push({ row, cards, closed: [] });
    }
  }
  return { stale, noCard, unjudged };
}
