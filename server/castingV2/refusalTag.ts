/**
 * EVERY DOOR HAS A NAME, AND ONE PLACE COUNTS THEM ALL.
 *
 * # The finding this exists to close
 *
 * `refusalCounter` landed so that a refusal a customer experiences leaves a
 * countable artifact — and it was wired into TWO doors. The refine road throws
 * roughly twenty user-visible free refusals. So the production tally read ZERO
 * `casting.refusal` rows on a morning the founder had himself been refused, in
 * that world, minutes between two audit rows written by the same helper: the
 * removal road's second reading (`refineService`, "re-read as an edit") throws
 * the customer's sentence straight past the counter.
 *
 * A count wired door by door was always going to end that way. It is the
 * "collected, never asserted" shape from the other side: seventeen writers, two
 * of which remembered.
 *
 * # The shape
 *
 * Two halves, and neither is a second list:
 *
 *   1. **The name lives at the throw.** `refusal("removal_absent", {...})` is a
 *      TRPCError with its reason carried on the instance, not a message anyone
 *      has to pattern-match afterwards. The name is new information — it is the
 *      only place the door's identity is written down.
 *   2. **The count lives at the seam.** `refineCandidate` already holds every
 *      escaping error in one place, so the counting happens there, once, for
 *      whatever escapes — including doors that do not exist yet. An untagged
 *      refusal is counted as `untagged:<CODE>` rather than dropped, so the next
 *      uncounted door shows up as a countable GAP instead of as silence.
 *
 * The reason may never be her sentence. These names are a closed vocabulary
 * written by us; staff read audit rows (see `refusalCounter`'s boundary note).
 */
import { TRPCError } from "@trpc/server";

/** What a tagged refusal carries beyond its sentence. */
export type RefusalTag = {
  /** The door's own name — our vocabulary, never the customer's words. */
  reason: string;
  /** The facet or subject it was raised about, where the door knows one. */
  facet: string | null;
  /**
   * `upheld` where the invention door ran and AGREED with containment — the
   * half that, against `rescued`, is the honest-ask-refused rate (fable-498
   * §4). Every other door is plainly `refused`.
   */
  outcome: "refused" | "upheld";
};

/**
 * Hidden on the instance rather than on `cause`, because `cause` is the place a
 * real underlying error belongs and a tag sitting there would be mistaken for
 * one by any handler that logs it.
 */
const TAG = Symbol.for("drape.castingV2.refusalTag");

/** Build a user-visible refusal that knows its own name. */
export function refusal(
  reason: string,
  input: {
    code: TRPCError["code"];
    message: string;
    facet?: string | null;
    outcome?: RefusalTag["outcome"];
  },
): TRPCError {
  const error = new TRPCError({ code: input.code, message: input.message });
  Object.defineProperty(error, TAG, {
    value: {
      reason, facet: input.facet ?? null, outcome: input.outcome ?? "refused",
    } satisfies RefusalTag,
    enumerable: false,
    configurable: true,
  });
  return error;
}

/** The tag, if this error carries one. */
export function refusalTagOf(error: unknown): RefusalTag | null {
  if (typeof error !== "object" || error === null) return null;
  const held = (error as Record<symbol, unknown>)[TAG];
  if (typeof held !== "object" || held === null) return null;
  const tag = held as RefusalTag;
  return typeof tag.reason === "string" ? tag : null;
}

/**
 * WHAT THE SEAM SHOULD COUNT, and why a fault is not a refusal.
 *
 * A refusal is the product's own ANSWER: an honest boundary, free, with nothing
 * else on record. A crash is not — it has a stack, a log line and a 500, and
 * filing it under refusals would put two different questions in one tally.
 * `INTERNAL_SERVER_ERROR` and anything that is not a TRPCError are therefore
 * left alone, and that exclusion is asserted in the suite rather than assumed.
 */
export function refusalOf(error: unknown): RefusalTag | null {
  const tagged = refusalTagOf(error);
  if (tagged) return tagged;
  if (!(error instanceof TRPCError)) return null;
  if (error.code === "INTERNAL_SERVER_ERROR") return null;
  return { reason: `untagged:${error.code}`, facet: null, outcome: "refused" };
}
