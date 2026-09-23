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
