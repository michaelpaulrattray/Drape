/**
 * THE ONE SENTENCE A REFUSED FREE SIGNUP EVER SEES (#1603, P1-4).
 *
 * ⚠ **IT LIVES IN `shared/` BECAUSE IT HAS TWO READERS AND A COPY WOULD DRIFT**
 * (working law 4). The email register path answers it as JSON straight from the
 * server; the Google callback is an OAuth redirect with no body to read, so the
 * login page renders it from the error code. A second copy typed into
 * `Login.tsx` is the shape this repository has been bitten by repeatedly — two
 * lists describing one thing — and here the drift would be a customer reading
 * one sentence on one road and a different one on the other.
 *
 * `server/security/freeGrantLimit.ts` is where the cap itself is argued and
 * where the copy's reasoning is recorded: it names what was refused and what to
 * do, and names no device, no network, no window and no number.
 */

/** The refusal, verbatim, on both roads. */
export const FREE_GRANT_REFUSAL_SENTENCE =
  "We couldn't set up a new free account just now. "
  + "If you already have an account, sign in instead — "
  + "otherwise email support@klieglabs.com and we'll get you started.";

/**
 * The `?error=` code the Google callback redirects with, and the key the login
 * page's own error map is keyed on. One constant, so the redirect and the lookup
 * cannot disagree — a code with no entry renders no banner at all, which is a
 * refused customer shown nothing.
 */
export const FREE_GRANT_REFUSAL_ERROR_CODE = "signup_unavailable";
