/**
 * WHOSE SENTENCE THE PANEL IS HOLDING, and what may replace it.
 *
 * The refine panel has one calm slot for an outcome (D-154) and several things
 * write into it: a refusal the server authored, a question, a note about a free
 * edit, the panel's own fallback when a request never came back, and — since
 * Landing A — a settled row's true sentence arriving after the fact.
 *
 * The rule for that last one used to be one expression inside the component:
 *
 *   setRefineOutcome((current) => current ?? newest.message)
 *
 * …which is the hazard this module exists to close. It lives here rather than
 * there for doctrine 19's reason: a decision spread between a component
 * expression and a test that restates it is a decision nothing can fail on.
 *
 * # THE HAZARD, in the founder's own sequence
 *
 * He asks for an edit. The render outlives the ~305 s gateway, so the socket
 * dies and the panel says what it honestly can:
 *
 *   "We lost contact while that was rendering. If it landed it will appear
 *    here; if it didn't, your credits come back on their own."
 *
 * Then the settled row arrives carrying the answer the server had written down
 * all along — *"That one came back twice without fox eyes, so it wasn't
 * delivered and your credits have been returned. Try saying it a different
 * way."* — and `current ?? newest.message` **throws it away**, because the slot
 * is not empty: it holds the fallback.
 *
 * Worse than merely showing the weaker sentence: one loop above, Landing A
 * marks that request `server` so the bridge yields. The panel promises the
 * bridge it has shown the server's words while showing its own. **The true
 * sentence, and the actionable half of it, reach nobody.**
 *
 * # THE RULE
 *
 * A settled row's true sentence SUPERSEDES a fallback (fable-847 §3). The
 * fallback's own words already promise this — *"if it landed it will appear
 * here"* — so completing the promise is the design rather than a patch, and the
 * mark becomes honest by construction: what is displayed IS the server's
 * sentence.
 *
 * It supersedes a fallback and nothing else. A sentence the server authored for
 * the edit somebody is reading right now is never replaced by a settled row,
 * which is D-154's "until dismissed, or until superseded by their own next ask".
 *
 * **And only by the row about the SAME request** — a narrowing of fable-847's
 * words, stated here so the next reader meets the reason rather than the rule:
 * this file is keyed per request everywhere else for one incident's sake
 * (fable-465, "another cast's request must not mute this one"), and replacing
 * *"we lost contact"* about the edit he just typed with a refusal about a
 * different one would be a wrong-request sentence — the same defect wearing a
 * fix's clothes. When the slot is EMPTY the newest row is still adopted, exactly
 * as Landing A shipped it: nobody is reading anything, so there is nothing to
 * be wrong about.
 */

/** Whose words the slot is holding. The panel decides this at the moment it
 *  writes, with the same `failureIsOurs` it uses to mark the request. */
export type OutcomeOrigin = "server" | "fallback";

export type HeldOutcome = {
  text: string;
  origin: OutcomeOrigin;
  /** The refine this sentence is about, where there is one. `null` for a
   *  sentence that belongs to no single request (a selection failure). */
  requestId: string | null;
} | null;

/** The shape Landing A's read returns, narrowed to what this decision needs. */
export type SettledOutcomeRow = {
  clientRequestId: string;
  message: string | null;
};

/**
 * What the outcome slot should hold, given what it holds now and what the
 * server has settled.
 *
 * Returns `input.held` ITSELF when nothing changes, so a caller passing this
 * straight into `setState` re-renders only on a real change.
 */
export function adoptSettledOutcome(input: {
  held: HeldOutcome;
  /** Newest first, as the server returns them. */
  settled: readonly SettledOutcomeRow[];
  /** Requests whose sentence the user has closed. Dismissal is theirs and it
   *  stays dismissed — a poll two seconds later may not re-raise it. */
  dismissed: ReadonlySet<string>;
}): HeldOutcome {
  const adopt = (row: SettledOutcomeRow): HeldOutcome => ({
    text: row.message!,
    origin: "server",
    requestId: row.clientRequestId,
  });

  const newest = input.settled[0];
  if (!newest?.message) return input.held;

  if (input.held === null) {
    return input.dismissed.has(newest.clientRequestId) ? input.held : adopt(newest);
  }

  /*
    THE SUPERSEDE (fable-847 §3), and it is the whole fix.

    A fallback is the panel saying *"I don't know"*. The row below is the
    server saying what happened to that same request. Keeping the first over
    the second is not caution — it is the surface refusing the answer it
    promised would appear here.

    `find` on the request rather than `settled[0]`: the row that answers HIS
    edit is the one that may speak over the sentence about HIS edit, whatever
    else has settled since.
  */
  if (input.held.origin === "fallback" && input.held.requestId !== null) {
    const answer = input.settled.find((row) =>
      row.clientRequestId === input.held!.requestId && row.message);
    if (answer && !input.dismissed.has(answer.clientRequestId)) return adopt(answer);
  }

  return input.held;
}

/**
 * Which request the user just closed, when what they closed was a settled row's
 * sentence — and `null` when it was anything else.
 *
 * Matched on the request AND the words, not on the words alone. The slot can
 * legitimately hold an identical sentence about a different request (two edits
 * refused the same way is not exotic), and recording the wrong id would leave
 * the real one free to be re-raised on the next poll by a dismissal that looked
 * like it worked.
 */
export function settledDismissalFor(
  held: HeldOutcome,
  settled: readonly SettledOutcomeRow[],
): string | null {
  if (held === null || held.requestId === null) return null;
  const row = settled.find((entry) =>
    entry.clientRequestId === held.requestId && entry.message === held.text);
  return row ? row.clientRequestId : null;
}
