/**
 * WHAT A CUSTOMER IS TOLD WHEN A CHARGE IS REFUSED (#2387).
 *
 * Every paid road in the casting studio charges through `deductCredits` and,
 * on a refused charge, used to throw
 *
 *     new TRPCError({ code: "BAD_REQUEST", message: charge.error || <the road's "Not enough credits. … costs N credits."> })
 *
 * The written sentence after `||` could never be reached: `deductCredits`
 * returns an error string on EVERY refusal (`"Insufficient credits"`,
 * `"User credits not found"`, `"Database not available"` …), so the bare
 * ledger wording went out instead. And `BAD_REQUEST` is the brief compiler's
 * code, so the casting sheet drew a customer who was simply short of credits
 * as **"That brief can't be cast — Insufficient credits"** with an
 * **"Edit the brief"** button. The brief was never the problem.
 *
 * So the refusal is chosen on the REASON the ledger states, never on `||`:
 *
 * - **Not enough credits** (`insufficient: true`, set only where the
 *   conditional `UPDATE … WHERE balance >= amount` touched no row and the
 *   account's credits row exists) → `PRECONDITION_FAILED` carrying the road's
 *   own sentence with its price. `PRECONDITION_FAILED` is the code the sheet's
 *   failure mapping already reads as an ACCOUNT problem
 *   (`client/src/features/castingV2/dispatchFailure.ts`), never a brief one.
 * - **Anything else** (no database, a ledger write that threw, a duplicate or
 *   colliding reference, a missing credits row) is the system, not the
 *   customer's balance. It must not say "not enough credits" — that would be a
 *   lie about their money — and it must not say "nothing was charged" either,
 *   because a duplicate reference means an earlier attempt WAS charged. It
 *   says only what is known.
 *
 * Both are `spoken`: our own words, written for a person.
 */
import { spokenError, type SpokenError } from "../_core/spokenError";
import type { CreditWriteResult } from "../db/credits";

/** The sentence a charge the system could not take says. No money claim. */
export const CHARGE_UNAVAILABLE_SENTENCE =
  "We couldn't take payment for that just now. Try again in a moment.";

/**
 * The error a refused charge throws.
 *
 * @param notEnoughSentence the road's own "Not enough credits. … costs N
 *   credits." — written at the call site, beside the price it quotes.
 */
export function chargeRefusal(
  charge: Pick<CreditWriteResult, "insufficient">,
  notEnoughSentence: string,
): SpokenError {
  if (charge.insufficient === true) {
    return spokenError({ code: "PRECONDITION_FAILED", message: notEnoughSentence });
  }
  return spokenError({ code: "INTERNAL_SERVER_ERROR", message: CHARGE_UNAVAILABLE_SENTENCE });
}
