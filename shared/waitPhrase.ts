/**
 * HOW LONG TO WAIT, SAID THE WAY A PERSON SAYS IT (#1993).
 *
 * Every refusal that tells a customer when to come back reads its clause from
 * here, so there is ONE place this can be wrong. Before it, five sentences
 * built the clause by hand and three of them got it wrong in three different
 * ways: `Math.ceil(resetIn / 60000)` followed by a bare "minutes" says
 * *"Try again in 1 minutes"* for the whole last minute of every window (read
 * off a frame in #1962's render, not off the code); the account-lockout
 * refusal said *"minute(s)"*, a form nobody says out loud; and the shared
 * rate-limit sentence said *"in 1 seconds"* and *"in 0 seconds"*.
 *
 * The worked example was `exportRefusalMessage` in `server/routes/account.ts`
 * (#1962), and it now reads its clause from here rather than keeping a copy.
 *
 * Rules, each driven by `server/waitPhrase.test.ts`:
 *   - a wait is never zero: anything at or below the smallest unit (including
 *     a negative remainder, which a window that expired between the check and
 *     the throw can produce) reads as one unit;
 *   - one unit is said as a word — "in a minute", "in a second" — never "1";
 *   - `"second"` granularity answers in seconds only under a minute, and in
 *     minutes from there, so a long wait never reads as "in 840 seconds".
 */
export type WaitGranularity = "minute" | "second";

export function waitPhrase(
  remainingMs: number,
  granularity: WaitGranularity = "minute",
): string {
  const ms = Number.isFinite(remainingMs) ? remainingMs : 0;
  if (granularity === "second") {
    const seconds = Math.max(1, Math.ceil(ms / 1000));
    if (seconds < 60) {
      return seconds === 1 ? "in a second" : `in ${seconds} seconds`;
    }
  }
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return minutes === 1 ? "in a minute" : `in ${minutes} minutes`;
}

/** The same clause from a whole number of minutes (the login page receives
 *  minutes, not milliseconds, from `/api/auth/login`). */
export function waitPhraseFromMinutes(minutes: number): string {
  return waitPhrase(minutes * 60_000, "minute");
}
