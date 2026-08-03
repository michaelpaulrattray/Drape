/**
 * The retention confession.
 *
 * A sheet is cleared after seven quiet days. That has been enforced since M5
 * and, until now, said almost nowhere — the rule ran silently and a user could
 * lose a sheet they were still thinking about without ever having been told it
 * was possible.
 *
 * Three quiet surfaces, one module, so the wording cannot drift between them
 * and a copy audit has a single file to read.
 *
 * TONE, because this is the easy thing to get wrong: no alarm theatre. Nothing
 * counts down in red, nothing nags, nothing appears before it is relevant. The
 * rule is reasonable and the honest register is a quiet statement of fact —
 * the goal is that expiry is never a surprise, not that anybody feels chased.
 *
 * SEVEN QUIET DAYS IS LITERAL. `expiresAt` is reset to now + 7 days every time
 * the session is touched, so it is idle time and not age. A sheet you come
 * back to weekly never expires, and the copy must not imply otherwise.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * How close to expiry a card starts naming it.
 *
 * Two days, per the founder's ruling. Earlier than that and the line is
 * noise on a sheet nobody is at risk of losing; later and there is no
 * meaningful chance to act.
 */
export const EXPIRY_NOTICE_MS = 2 * DAY;

/** Whole days since a moment, floored — "today" until it has actually been one. */
function daysSince(then: number, now: number): number {
  return Math.floor((now - then) / DAY);
}

/**
 * The card's line: normally how long it has been idle, and inside the final
 * two days, when it goes.
 *
 * Returns `null` when there is nothing worth saying, so the card renders
 * nothing rather than an empty element.
 */
export function sheetAgeLine(
  input: { lastActivityAt: string | null; expiresAt: string | null },
  now = Date.now(),
): string | null {
  const expiresAt = input.expiresAt ? Date.parse(input.expiresAt) : NaN;

  if (Number.isFinite(expiresAt)) {
    const left = expiresAt - now;
    /*
      Rendered as "today" and "tomorrow" rather than "in 1 days". The founder's
      wording was "expires in N days"; at N of 0 and 1 that is worse English
      than the words people actually use, and the restrained register is the
      whole brief here.
    */
    if (left <= 0) return "Expired";
    if (left < DAY) return "Expires today";
    if (left < EXPIRY_NOTICE_MS) return "Expires tomorrow";
  }

  const lastActivityAt = input.lastActivityAt ? Date.parse(input.lastActivityAt) : NaN;
  if (!Number.isFinite(lastActivityAt)) return null;

  const days = daysSince(lastActivityAt, now);
  if (days <= 0) return "Rolled today";
  if (days === 1) return "Rolled yesterday";
  return `Rolled ${days} days ago`;
}

/** True when the card's line is about expiry rather than about age. */
export function isExpiryWarning(line: string | null): boolean {
  return line === "Expires today" || line === "Expires tomorrow" || line === "Expired";
}

/**
 * The sheet's own line, shown only when expiry is close enough to act on.
 *
 * One sentence, once, at the top of the sheet it concerns. It names the
 * deadline and the action, and nothing else.
 *
 * **The sentence gained "or sign" the day the button did**, which is what its
 * own comment promised when Sign was still M7 work. It read "keep what's worth
 * holding" for a while after Sign shipped — an honest sentence describing a
 * narrower product than the one in front of the user, which is the same class
 * of stale as a capability claimed too early, just pointing the other way.
 */
export function sheetExpiryNotice(expiresAt: string | null, now = Date.now()): string | null {
  if (!expiresAt) return null;
  const at = Date.parse(expiresAt);
  if (!Number.isFinite(at)) return null;

  const left = at - now;
  if (left <= 0 || left >= EXPIRY_NOTICE_MS) return null;
  const when = left < DAY ? "today" : "tomorrow";
  return `This sheet expires ${when} — keep or sign what's worth holding.`;
}

/**
 * The empty state, which explains the RULE and never claims an event.
 *
 * A sheet that expired and a sheet that was never cast leave exactly the same
 * empty page, and the client cannot tell them apart — expired sessions are
 * gone from the projection entirely. So this says what the rule is, which is
 * true in both cases, instead of asserting a history it cannot know.
 *
 * That is a deliberate narrowing of the brief ("the empty state after an
 * expiry says what happened"): saying "your sheet expired" to someone who
 * never made one would be inventing an event to fill a silence.
 */
export const RETENTION_EMPTY_STATE = "Unsigned sheets are cleared after 7 quiet days.";
