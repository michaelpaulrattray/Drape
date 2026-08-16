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
