/**
 * #1016 — DOES A FAILED CLAIM KEEP THE CODE FOR NEXT TIME?
 *
 * The hook used to clear `drape_referral_code` on ANY error, so a friend who
 * opened the link on a bad connection, signed in, and hit one network failure
 * on the automatic claim lost the referral for good — silently, for both
 * sides. Found by the reviewer on PR #1015 and left out of that PR on purpose
 * (#1010 was the wire; this is the hook's own behaviour).
 *
 * The rule: **keep the code on anything the next login might succeed at;
 * drop it only on a refusal that will recur however many times it is sent.**
 * The server's DESIGNED refusals of a code — invalid, self-referral, already
 * used — do not come through here at all: `referral.claim` answers them as a
 * 200 with `{ claimed: false }`, and the hook's `onSuccess` clears the key
 * for those exactly as before.
 *
 * So the only error that means "this code will never work" is `BAD_REQUEST`
 * — the input schema refusing the code's shape. Everything else is kept:
 *
 * - no code at all (a network failure, a dropped connection, a non-tRPC
 *   response) — the next page load retries;
 * - `INTERNAL_SERVER_ERROR`, `TIMEOUT`, `TOO_MANY_REQUESTS` (the 5/hour
 *   limiter #1015 added — one automatic claim cannot hit it alone, but a
 *   redeem beside it can, and the drop would be the same);
 * - `FORBIDDEN` — an unapproved account; approval may come later and the
 *   claim with it;
 * - `UNAUTHORIZED` — the client thought it was signed in and the server did
 *   not (an expired cookie in the gap). ⚠ The card listed this one as a DROP
 *   "after a signed-in attempt"; it is kept here on the card's own rule,
 *   because the hook only fires with a signed-in `user` and only ever
 *   retries with one — so a kept code is retried exactly when the session
 *   is real again, and a dropped one loses the referral to a cookie race.
 * - any code this list does not know — it fails toward KEEPING, because a
 *   kept code costs nothing (the server refuses a bad one as `claimed: false`
 *   on the next try) and a dropped one is a reward gone with no message.
 */
type Trpcish = { data?: { code?: string } };

/** Error codes after which the code will never succeed however often it is sent. */
const NEVER_SUCCEEDS = new Set(["BAD_REQUEST"]);

export function keepsReferralCodeAfterError(error: unknown): boolean {
  const code = (error as Trpcish | null | undefined)?.data?.code;
  if (typeof code !== "string") return true;
  return !NEVER_SUCCEEDS.has(code);
}
