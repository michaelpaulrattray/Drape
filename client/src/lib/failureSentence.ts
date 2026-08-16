/**
 * OUR SENTENCE, NEVER THE ERROR'S — the rule, for the whole client.
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
 * whether they were charged.
 *
 * # Why it lives here and not in a feature folder
 *
 * Because the class kept outliving its fixes. It was found and fixed for ROLL
 * dispatch, then found again in the REFINE panel, and the header of the second
 * fix said the quiet part: *"The class was named and the fix landed on one
 * consumer."* It had in fact landed on two, out of **fifty** sites across
 * boards, wardrobe, billing, profile, admin and the canvas, every one of them
 * doing `toast.error(err.message)`. A rule that lives inside one feature is a
 * rule the next feature cannot find.
 *
 * # The rule
 *
 * A tRPC code means OUR server refused, and those sentences were written for a
 * reader — named wall, what it cost, what to do next. They pass through
 * untouched. Anything else came from a transport, a proxy or a parser and was
 * written for an engineer; it is replaced by the caller's own copy.
 *
 * Since 2026-08-16 the server also guarantees the first half of that: an input
 * that fails validation no longer arrives as zod's serialized issue array, so a
 * `BAD_REQUEST` reaching here really is a sentence
 * (`server/_core/invalidInputMessage.ts`).
 *
 * # The raw text is not lost, it is moved
 *
 * `readableFailure` is for the screen. Callers that replace a message should
 * still put the original somewhere a developer can find it — which is what
 * `logRawFailure` is for. Nothing about this rule is meant to make debugging
 * harder; the argument is only about who the sentence was written for.
 */

import { errorIsSpoken } from "@shared/spokenError";

type Trpcish = { message?: string; data?: { code?: string } };

/**
 * The codes whose messages our own server authors.
 *
 * Listed rather than inferred, because the fallback has to be what happens to
 * anything unrecognised — including a code added later. A new refusal that
 * forgets to appear here reads as the caller's fallback, which is merely vague;
 * the other default is a parser error on a customer's screen.
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

/**
 * Keep the original where a developer will find it.
 *
 * A sweep that replaces fifty messages without this is a sweep that makes the
 * next incident harder to read, and that is a fair objection to the whole idea.
 * The console is the right home: it is not the customer's screen.
 */
export function logRawFailure(context: string, error: unknown): void {
  const err = error as Trpcish;
  console.error(`[${context}]`, err?.data?.code ?? "no-code", err?.message ?? error);
}
