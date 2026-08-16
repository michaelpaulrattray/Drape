/**
 * WHAT A REJECTED INPUT SAYS TO THE PERSON WHO TYPED IT.
 *
 * # The defect, read at the wire
 *
 * A brief longer than the 2,000-character limit was refused correctly and then
 * put this on the customer's screen, verbatim, under the action "Edit the
 * brief":
 *
 *   [
 *     {
 *       "origin": "string",
 *       "code": "too_big",
 *       "maximum": 2000,
 *       "inclusive": true,
 *       "path": [ "briefText" ],
 *       "message": "Too big: expected string to have <=2000 characters"
 *     }
 *   ]
 *
 * That is zod's issue array, which tRPC uses as the error's message. It is the
 * same shape `dispatchFailure.ts` and `failureCopy.ts` were both written to
 * keep off a customer's screen — implementation detail in the one place a
 * person is trying to find out what went wrong and whether they paid for it.
 *
 * # Why the two client rules did not catch it
 *
 * Both decide "this sentence is ours" partly from the tRPC code, and
 * `failureCopy.ts` states the reasoning: *the code list is the structural
 * argument that a gateway cannot forge a 400.* True of a gateway — and blind
 * to our own framework, which authors a `BAD_REQUEST` for every input
 * validation failure and fills its message with machine text.
 *
 * # Why the fix is here and not there
 *
 * Not two consumers — dozens. `toast.error(err.message)` appears across
 * billing, boards, admin and the canvas, and every one of them would need the
 * same guard, forever, including the next one written. That is the mirror
 * working law 4 forbids. The wire is the one place that covers every procedure
 * and every consumer, present and future: a message the server did not write
 * for a reader never leaves the server.
 *
 * # The sentence is derived from the issue, not looked up in a table
 *
 * A table of field-name → copy is the same mirror one layer down, and it goes
 * stale the moment a schema changes. The issue itself carries what a person
 * needs — that it was too long, and the limit it passed — so the sentence is
 * built from that and nothing else. Field names (`briefText`) stay out: they
 * are implementation detail leaking in the other direction.
 */
import { ZodError } from "zod";

/**
 * When the issue cannot be spoken about usefully.
 *
 * Deliberately says nothing about money. A zod failure means the resolver never
 * ran, so nothing was charged — but most procedures reaching here are not about
 * money at all, and raising the subject where it was never in play reads as an
 * alarm rather than a reassurance. Surfaces where a charge IS in play keep
 * their own copy.
 */
export const INVALID_INPUT_FALLBACK =
  "That didn't go through — something in what was sent wasn't valid. Please check it and try again.";

type SpeakableIssue = {
  code?: string;
  /** zod v4 */
  origin?: string;
  /** zod v3 */
  type?: string;
  maximum?: unknown;
  minimum?: unknown;
};

/** zod v4 moved string/number/array onto `origin`; accept either spelling. */
function isStringIssue(issue: SpeakableIssue): boolean {
  return issue.origin === "string" || issue.type === "string";
}

function speakIssue(raw: unknown): string | null {
  const issue = raw as SpeakableIssue;
  if (!isStringIssue(issue)) return null;

  if (issue.code === "too_big" && typeof issue.maximum === "number") {
    return `That's longer than we can take — please keep it to ${issue.maximum.toLocaleString("en-GB")} characters or fewer.`;
  }

  if (issue.code === "too_small" && typeof issue.minimum === "number") {
    return issue.minimum <= 1
      ? "That came through empty — please write something first."
      : `That's shorter than we can take — please write at least ${issue.minimum.toLocaleString("en-GB")} characters.`;
  }

  return null;
}

/**
 * An authored sentence for a failed input, or `null` if this is not one.
 *
 * `null` rather than a sentence means "not my case, leave the shape alone" —
 * the formatter must not rewrite messages our own code wrote on purpose.
 */
export function invalidInputMessage(cause: unknown): string | null {
  if (!(cause instanceof ZodError)) return null;
  for (const issue of cause.issues) {
    const spoken = speakIssue(issue);
    if (spoken) return spoken;
  }
  return INVALID_INPUT_FALLBACK;
}
