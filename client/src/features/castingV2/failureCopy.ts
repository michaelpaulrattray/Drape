/**
 * What the refine panel says when a refinement does not come back.
 *
 * The RULE this file used to hold now lives at `@/lib/failureSentence` — it was
 * moved on 2026-08-16 when the sweep found fifty sites outside castingV2 doing
 * `toast.error(err.message)`, which is the same defect this file's header
 * describes. A rule kept inside one feature is a rule the next feature cannot
 * find; the incident and the reasoning moved with it.
 *
 * What stays here is what is genuinely castingV2's: the copy.
 */

import { readableFailure } from "@/lib/failureSentence";

export { readableFailure };

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

export function refineFailureMessage(error: unknown): string {
  return readableFailure(error, LOST_CONTACT);
}

/**
 * A FLAG-FIRST `NOT_FOUND` IS A PROBE ANSWER, NOT COPY — for the controls a
 * scope may switch off underneath the customer (review of #188, LOW finding).
 *
 * Every flag-gated procedure in `routes/castingV2.ts` answers outside its scope
 * with `NOT_FOUND: "No such thing."`, and that sentence is exactly right for
 * what it is: outside the scope there is no such capability, and a code saying
 * "not yet" would advertise one. It was never written for a screen.
 *
 * `readableFailure` passes it through, because `NOT_FOUND` is on its OURS list —
 * correctly, since most of ours ("that sheet is gone") ARE for a reader. So the
 * two rules meet in one place and produce a customer-facing toast reading
 * **"No such thing."** on a control that was drawn LIVE.
 *
 * It needs a stale answer to happen at all: the config said the scope admits
 * her, she was removed from it (or the flag narrowed) while the page was open,
 * and then she tapped. Rare, harmless, and nothing is charged — but it is the
 * one path where our own toast contract shows her a sentence nobody wrote.
 *
 * Fixed as the CLASS rather than at the card that found it (working law 7): the
 * concept card and the Retry button are both flag-gated controls today, and the
 * next one will be too. Everything else about `readableFailure` is unchanged —
 * a `NOT_FOUND` that is genuinely about a missing THING still needs the caller's
 * own fallback to be the right sentence for that surface, which it already is.
 */
export function readableGatedFailure(error: unknown, fallback: string): string {
  const code = (error as { data?: { code?: string } } | null)?.data?.code;
  if (code === "NOT_FOUND") return fallback;
  return readableFailure(error, fallback);
}
