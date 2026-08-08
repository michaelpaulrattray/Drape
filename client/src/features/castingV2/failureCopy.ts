/**
 * What the refine panel says when a refinement does not come back.
 *
 * # The defect, found on production by run-9
 *
 * Step 5 of the walk — *"remove her glasses"* — waited 304.9 seconds and then
 * showed the customer this, in the panel where the product's refusal copy goes:
 *
 *   Unexpected token 'u', "upstream error" is not valid JSON
 *
 * That is a JSON parser talking about a gateway's plain-text 502: three layers
 * of implementation detail, in the one place a person is trying to find out
 * whether they were charged. The panel was doing
 * `.catch((error) => setRefineOutcome(error.message))`, so every failure that
 * was not one of our own written sentences arrived verbatim.
 *
 * # And it is a sibling, which is the point
 *
 * This exact string was found and fixed once already, for ROLL dispatch
 * (`classifyDispatchFailure`, whose comment quotes it word for word). The class
 * was named — *never show the error's sentence, show ours* — and the fix landed
 * on one consumer. The refine panel is the other one, and it kept the defect
 * for as long as nobody swept. Law 7: the sweep is part of the fix.
 *
 * # The rule
 *
 * A tRPC code means OUR server refused, and every one of those sentences was
 * written for a reader — named wall, what it cost, what to do next. Those pass
 * through untouched. Anything else came from a transport, a proxy or a parser
 * and was written for an engineer; it is replaced.
 */

import { errorIsSpoken } from "@shared/spokenError";

type Trpcish = { message?: string; data?: { code?: string } };

/**
 * The codes whose messages our own server authors.
 *
 * Listed rather than inferred, because the fallback has to be what happens to
 * anything unrecognised — including a code added later. A new refusal that
 * forgets to appear here reads as a lost-contact message, which is merely
 * vague; the other default is a parser error on a customer's screen.
 */
const OURS = new Set([
  "BAD_REQUEST",
  "PRECONDITION_FAILED",
  "FORBIDDEN",
  "TOO_MANY_REQUESTS",
  "NOT_FOUND",
  "CONFLICT",
  "UNAUTHORIZED",
]);

/**
 * IT DOES NOT PROMISE THE MONEY IS SAFE, and that is deliberate.
 *
 * Our own refusals say "nothing was charged" because they refuse before
 * claiming and know it. This branch cannot: losing contact means we never heard
 * the answer, and a refine charges up front. What IS true is the recovery
 * sweep's promise, which the panel already makes during a long wait — the
 * credits come back on their own — so the sentence says that instead of
 * asserting an outcome nobody knows yet.
 */
export const LOST_CONTACT =
  "We lost contact while that was rendering. If it landed it will appear here; "
  + "if it didn't, your credits come back on their own.";

/**
 * Our sentence, never the error's — with the caller naming the fallback.
 *
 * The fallback is a parameter because the honest thing to say depends on what
 * failed: a refine that may still be rendering, a keep that simply did not
 * save, a signing that did not happen. What does NOT vary is the rule, so the
 * rule lives once and the copy lives at each call site.
 */
export function readableFailure(error: unknown, fallback: string): string {
  const err = error as Trpcish;
  const code = err?.data?.code;
  const message = typeof err?.message === "string" ? err.message.trim() : "";
  /*
    TWO KINDS OF EVIDENCE THAT THE SENTENCE IS OURS, NOT TWO COPIES OF ONE LIST.

    `spoken` is the server saying so at the throw site (`shared/spokenError`);
    the code list is the structural argument that a gateway cannot forge a 400.
    The list is what drifted — five authored sentences were thrown as
    `INTERNAL_SERVER_ERROR` and every one of them was replaced by the
    lost-contact line, including three that said "Nothing was charged" — so the
    marker is checked first and the list stays as the older evidence.
  */
  if (errorIsSpoken(error) && message) return message;
  if (code && OURS.has(code) && message) return message;
  return fallback;
}

export function refineFailureMessage(error: unknown): string {
  return readableFailure(error, LOST_CONTACT);
}
