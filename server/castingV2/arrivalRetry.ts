/**
 * ASKING AGAIN FOR SOMETHING THAT NEVER ARRIVED — one budget, one spacing, two
 * roads (#1966).
 *
 * ## The question this answers, and it is one question
 *
 * *How many times do we re-ask for a render that never came back, and how long
 * do we leave between asks?* It is OUR failure to deliver something already
 * paid for, not a draw against a judgement — which is why it has always been a
 * separate budget from the judged attempts and why it may be spent freely: no
 * frame arrived, so nothing was spent on a picture.
 *
 * ## Why it moved out of `packageOrchestrator.ts`
 *
 * The per-view road has asked three times, spaced, since #1208. The SHEET road
 * — where every delivered view is a panel cut from one landscape frame — asked
 * **once**, because `settleSignSheet` called its `render` thunk and let a
 * throw out. So a transport fault on a sheet lost two or three views at once
 * and refunded them, where the same fault on a single view would have been
 * re-asked twice more. That is #1966, and his word on it (2026-10-08, on
 * #1904's question 1) was *"2) go with your recc"*.
 *
 * ⚠ **DERIVED RATHER THAN MIRRORED, AND THE PRECONDITION WAS CHECKED FIRST.**
 * Working law 4 bans a second list shadowing a source of truth, but it has a
 * precondition: the two readers must be answering the SAME question. They are
 * — both ask *"how many times is a render that never arrived asked for
 * again"*, about the same house transport, with no customer money moving
 * either way.
 *
 * ⚠ **AND IT IS THE OPPOSITE CALL FROM {@link SHEET_MAX_RENDERS}, WHOSE OWN
 * DOCBLOCK REFUSES TO BE DERIVED — the difference is the whole of why this is
 * safe.** That constant is *"how many frames the HOUSE pays for to rescue a
 * sheet"* against `VIEW_JUDGED_ATTEMPTS`'s *"how many draws a CUSTOMER's paid
 * slice gets against the judge"*: two questions, two moneys, so one number
 * moving must not move the other. Here there is one question and no money at
 * all.
 *
 * ## What is NOT here
 *
 * The decision of whether a failure may still arrive. That is
 * `mayStillArrive` in `providers/types.ts`, beside the failure classes
 * themselves, and #1212's whole finding was that a road holding its own
 * opinion about that union drifts from it. Both roads call it; neither
 * restates it.
 */

/**
 * How many times a render that never arrived is asked for — counting ARRIVAL
 * failures, not attempts in general.
 *
 * It is the number the customer is owed a true sentence about, so nothing may
 * restate it as a word.
 */
export const ARRIVAL_ATTEMPTS = 3;

/**
 * The spacing between one arrival failure and the next attempt.
 *
 * Short on purpose. The adapter has already exhausted its own transport
 * retries by the time a `ProviderError` reaches either road, so this is the
 * outer, slower breath — long enough for a provider blip or a rate-limit
 * window to pass, negligible against a 2K render (measured in tens of
 * seconds). The package's operation holds a renewing heartbeat while this
 * runs, so the added wait cannot hand a live Sign to the recovery sweep.
 *
 * Indexed by how many arrival failures have happened, so the second wait is
 * longer than the first.
 */
export const ARRIVAL_BACKOFF_MS: readonly number[] = [1_500, 4_000];

/**
 * How long to wait after `failures` arrival failures.
 *
 * The list is read with its last value repeated rather than indexed off the
 * end, so lengthening the budget without lengthening the ladder is safe.
 */
export function arrivalBackoffMs(failures: number): number {
  return ARRIVAL_BACKOFF_MS[Math.min(failures - 1, ARRIVAL_BACKOFF_MS.length - 1)] ?? 0;
}

/**
 * The real wait. Injected on both roads so a suite can prove the spacing — a
 * test that only asserts the attempt count cannot tell "spaced" from
 * "hammered".
 *
 * `.unref()` so a pending backoff never holds the process open; it is the
 * orchestrator's own timer, moved here rather than written twice.
 */
export function waitMs(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms).unref?.();
  });
}
